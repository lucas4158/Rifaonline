import "dotenv/config";
import path from "path";
import fs from "fs";



import { getAdminFirestore, isAdminInitialized } from "./_firebaseAdmin.js";

import { MercadoPagoConfig, Payment } from "mercadopago";

// Initialize Mercado Pago
let mpPayment: any = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    mpPayment = new Payment(mpClient);
  } catch (err) {
    console.error("❌ [Mercado Pago Serverless] Init error:", err);
  }
}



// Simple memory rate-limiter map for anti-flood / security protection
const requestTimestamps = new Map<string, number>();
const FLOOD_COOLDOWN_MS = 4000; // 4 seconds request lock cooldown

export default async function handler(req: any, res: any) {
  const tStart = Date.now();
  let tRaffle = 0;
  let tValAndTrans = 0;
  let tMercadoPago = 0;
  let tFinalSave = 0;

  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { name, phone, nums, totalAmount, price, sessionId, raffleId } = req.body;
  const targetRaffleId = raffleId || "current";
  const rawExistingBonus = req.body.existingBonusNums;
  const existingBonusNums: string[] = Array.isArray(rawExistingBonus)
    ? rawExistingBonus.map((n: any) => String(n))
    : [];

  if (!name || !phone || !nums || !Array.isArray(nums) || nums.length === 0) {
    return res.status(400).json({ error: "Dados inválidos ou incompletos." });
  }

  // Rate limit flood check by IP and normalized phone number
  const clientIp = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "Unknown");
  const dNormPhone = String(phone || "").replace(/\D/g, "");
  const currentNow = Date.now();

  const lastIpRequest = requestTimestamps.get(clientIp) || 0;
  const lastPhoneRequest = dNormPhone ? (requestTimestamps.get(dNormPhone) || 0) : 0;

  if (currentNow - lastIpRequest < FLOOD_COOLDOWN_MS) {
    console.warn(`[CONFLICT_DETECTED] Cooldown active for IP: ${clientIp}. Spam checkout attempt rejected.`);
    return res.status(429).json({ error: "Aguarde alguns segundos entre tentativas de checkout (Anti-Flood)." });
  }

  if (dNormPhone && (currentNow - lastPhoneRequest < FLOOD_COOLDOWN_MS)) {
    console.warn(`[CONFLICT_DETECTED] Cooldown active for phone number: ${dNormPhone}. Spam checkout attempt rejected.`);
    return res.status(429).json({ error: "Muitos pedidos sendo gerados para o mesmo telefone. Aguarde alguns segundos (Anti-Spam)." });
  }

  // Register state
  requestTimestamps.set(clientIp, currentNow);
  if (dNormPhone) requestTimestamps.set(dNormPhone, currentNow);

  let allNums = [...nums];
  let bonusNums: string[] = [];

  const orderId = Math.random().toString(36).substring(2, 7).toUpperCase();
  const expiresAt = currentNow + 10 * 60 * 1000; // 10 minutes
  let raffleTitle = "Rifa";

  // Atomic Double Check and Immediate Lock Reservation using Firestore runTransaction
  if (true) {
    try {
      // 1. Fetch config (single document getDoc, eliminating getDocs scan)
      const tRaffleStart = Date.now();
      const configRef = getAdminFirestore().collection("raffles").doc(targetRaffleId);
      const configSnap = await configRef.get();
      tRaffle = Date.now() - tRaffleStart;

      const configData = configSnap.exists ? configSnap.data() : {};
      if (configData.title) {
        raffleTitle = configData.title;
      }

      const promotionEnabled = !!configData.promotionEnabled;
      const buy = Number(configData.promotionBuy || 5);
      const promoBonus = Number(configData.promotionBonus || 1);
      const totalRaffleNumbers = Number(configData.totalNumbers || 150);
      const padLen = String(totalRaffleNumbers).length < 3 ? 3 : String(totalRaffleNumbers).length;

      const predictedBonus = promotionEnabled ? Math.floor(nums.length / buy) * promoBonus : 0;

      // Prepare candidate pool for bonus allocation without getDocs scanning all numbers
      const candidateBonusPool: string[] = [];
      const retainedBonus: string[] = [];

      if (predictedBonus > 0) {
        // Retain any existing bonus numbers provided by user session if not in purchased nums
        existingBonusNums.forEach((num: string) => {
          if (!nums.includes(num) && !retainedBonus.includes(num)) {
            retainedBonus.push(num);
          }
        });

        // Pick random candidates from 1..totalRaffleNumbers if retained bonus isn't enough
        const excludedSet = new Set([...nums, ...retainedBonus]);
        let attempts = 0;
        const maxAttempts = totalRaffleNumbers * 2;
        const maxNeededCandidates = predictedBonus + 2;
        while (
          retainedBonus.length + candidateBonusPool.length < maxNeededCandidates &&
          attempts < maxAttempts
        ) {
          attempts++;
          const randomVal = Math.floor(Math.random() * totalRaffleNumbers) + 1;
          const formatted = String(randomVal).padStart(padLen, "0");
          if (!excludedSet.has(formatted) && !candidateBonusPool.includes(formatted)) {
            candidateBonusPool.push(formatted);
          }
        }
      }

      // Collect all distinct numbers that need lock & status verification in parallel
      const allCheckNumbers = Array.from(new Set([...nums, ...retainedBonus, ...candidateBonusPool]));

      // 2. Execute parallelized read-before-write transaction
      const tTransStart = Date.now();
      const transactionResult = await getAdminFirestore().runTransaction(async (transaction: any) => {
        // Single batch read for all lock and number documents using transaction.getAll
        const lockRefs = allCheckNumbers.map((n) => getAdminFirestore().collection("locks").doc(n));
        const numRefs = allCheckNumbers.map((n) => getAdminFirestore().collection("raffles").doc(targetRaffleId).collection("numbers").doc(n));

        const allSnaps = await transaction.getAll(...lockRefs, ...numRefs);
        const lockSnaps = allSnaps.slice(0, lockRefs.length);
        const numSnaps = allSnaps.slice(lockRefs.length);

        // Map snapshots by number for fast evaluation
        const lockMap = new Map<string, any>();
        lockSnaps.forEach((snap: any, idx: number) => {
          if (snap.exists) {
            lockMap.set(allCheckNumbers[idx], snap.data());
          }
        });

        const numMap = new Map<string, any>();
        numSnaps.forEach((snap: any, idx: number) => {
          if (snap.exists) {
            numMap.set(allCheckNumbers[idx], snap.data());
          }
        });

        // Evaluate requested numbers (nums) for conflicts
        const conflicts: string[] = [];
        for (const num of nums) {
          const lockData = lockMap.get(num);
          if (lockData) {
            const isLockExpired = currentNow >= (lockData.expiresAt || 0);
            if (!isLockExpired && lockData.sessionId && lockData.sessionId !== sessionId) {
              conflicts.push(num);
              continue;
            }
          }

          const numData = numMap.get(num);
          if (numData) {
            const status = (numData.status || "").toLowerCase().trim();
            const expiresAtValue = numData.expiresAt || 0;
            const isExpired = expiresAtValue > 0 && currentNow >= expiresAtValue;

            if (status === "paid" || status === "pago") {
              conflicts.push(num);
              continue;
            }

            if (
              (status === "reserved" || status === "pending_payment" || status === "aguardando") &&
              !isExpired
            ) {
              const isSameSession = numData.sessionId && sessionId && numData.sessionId === sessionId;
              const isSamePhone =
                numData.phone &&
                phone &&
                String(numData.phone).replace(/\D/g, "") === String(phone).replace(/\D/g, "");

              if (!isSameSession && !isSamePhone) {
                conflicts.push(num);
                continue;
              }
            }
          }
        }

        if (conflicts.length > 0) {
          console.warn(`⚠️ [CONFLICT_DETECTED] Conflict detected for cotas: ${conflicts.join(", ")} on session: ${sessionId}`);
          return { success: false, conflicts };
        }

        // Evaluate and select free bonus numbers up to predictedBonus
        const selectedBonus: string[] = [];
        if (predictedBonus > 0) {
          const candidateList = [...retainedBonus, ...candidateBonusPool];
          for (const cand of candidateList) {
            if (selectedBonus.length >= predictedBonus) break;

            const lockData = lockMap.get(cand);
            if (lockData) {
              const isLockExpired = currentNow >= (lockData.expiresAt || 0);
              if (!isLockExpired && lockData.sessionId && lockData.sessionId !== sessionId) {
                continue;
              }
            }

            const numData = numMap.get(cand);
            if (numData) {
              const status = (numData.status || "").toLowerCase().trim();
              const expiresAtValue = numData.expiresAt || 0;
              const isExpired = expiresAtValue > 0 && currentNow >= expiresAtValue;

              if (status === "paid" || status === "pago") continue;

              if (
                (status === "reserved" || status === "pending_payment" || status === "aguardando") &&
                !isExpired
              ) {
                const isSameSession = numData.sessionId && sessionId && numData.sessionId === sessionId;
                const isSamePhone =
                  numData.phone &&
                  phone &&
                  String(numData.phone).replace(/\D/g, "") === String(phone).replace(/\D/g, "");

                if (!isSameSession && !isSamePhone) continue;
              }
            }

            selectedBonus.push(cand);
          }
        }

        bonusNums = selectedBonus;
        allNums = [...nums, ...bonusNums];

        // All numbers validated! Reserve atomically inside transaction
        for (const num of allNums) {
          const numDocRef = getAdminFirestore().collection("raffles").doc(targetRaffleId).collection("numbers").doc(num);
          transaction.set(numDocRef, {
            id: num,
            status: "reserved",
            orderId: orderId,
            sessionId: sessionId,
            name: name,
            phone: dNormPhone,
            expiresAt: expiresAt,
            isBonus: bonusNums.includes(num),
            updatedAt: new Date().toISOString(),
          });
        }

        // Delete selection locks for requested numbers
        for (const num of nums) {
          const lockDocRef = getAdminFirestore().collection("locks").doc(num);
          transaction.delete(lockDocRef);
        }

        return { success: true };
      });

      tValAndTrans = Date.now() - tTransStart;

      if (!transactionResult.success) {
        return res.status(400).json({
          error: `As seguintes cotas acabaram de ser adquiridas ou reservadas por outro cliente: ${transactionResult.conflicts?.join(", ")}. Por favor, escolha outros números.`,
          conflicts: transactionResult.conflicts,
        });
      }
    } catch (dbErr: any) {
      console.error("❌ [Firestore Serverless] Error checking/locking numbers atomically:", dbErr);
      const errStr = String(dbErr) + " " + String(dbErr?.message || "");
      if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded") || dbErr?.code === 8) {
        return res.status(429).json({
          error: "O sistema está com alta demanda de reservas no momento. Por favor, tente novamente em alguns segundos."
        });
      }
      return res.status(500).json({ error: "Erro ao processar as cotas em lote no banco de dados. Por favor, tente novamente." });
    }
  }

  // Check if we use real Mercado Pago or simulation fallback
  const hasMP = !!process.env.MP_ACCESS_TOKEN && mpPayment;

  // Block simulated payments when running on Vercel if Mercado Pago is not configured
  if (!hasMP && process.env.VERCEL === "1") {
    console.warn("⚠️ [Mercado Pago Unconfigured] Simulated payment mode is blocked on Vercel environment.");
    if (true) {
      try {
        const cleanupBatch = getAdminFirestore().batch();
        allNums.forEach((num: string) => {
          cleanupBatch.delete(getAdminFirestore().collection("raffles").doc(targetRaffleId).collection("numbers").doc(num));
        });
        await cleanupBatch.commit();
        console.log(`🧹 [Simulated Mode Blocked Rollback] Cleaned up reservation holds for cotas: ${allNums.join(", ")} in raffle ${targetRaffleId}`);
      } catch (cleanErr) {
        console.error("❌ [Simulated Mode Blocked Rollback] Error cleaning up holds:", cleanErr);
      }
    }
    return res.status(503).json({
      error: "O sistema de pagamento por PIX está temporariamente indisponível. Por favor, tente novamente em alguns instantes.",
    });
  }

  let paymentId = "";
  let qrCode = "";
  let qrCodeBase64 = "";
  let isSimulated = true;

  // Simple, lightweight CPF Generator so users don't have to input CPF on checkout
  const generateValidCPF = (): string => {
    const rnt = (max: number) => Math.floor(Math.random() * max);
    const n = Array.from({ length: 9 }, () => rnt(10));
    let d1 = n.reduce((acc, curr, idx) => acc + curr * (10 - idx), 0);
    d1 = 11 - (d1 % 11);
    if (d1 >= 10) d1 = 0;
    let d2 = n.reduce((acc, curr, idx) => acc + curr * (11 - idx), 0) + d1 * 2;
    d2 = 11 - (d2 % 11);
    if (d2 >= 10) d2 = 0;
    return [...n, d1, d2].join("");
  };

  if (hasMP) {
    try {
      const tMPStart = Date.now();
      const sanitizedPhone = phone.replace(/\D/g, "");
      let areaCode = "11";
      let phoneNumber = "999999999";
      if (sanitizedPhone.length >= 10) {
        areaCode = sanitizedPhone.substring(0, 2);
        phoneNumber = sanitizedPhone.substring(2);
      } else if (sanitizedPhone.length > 0) {
        phoneNumber = sanitizedPhone;
      }

      const mpPayerEmail = `cliente_${orderId.toLowerCase()}@exemplo.com`;
      const mpPayerFirstName = name.split(" ")[0] || "Cliente";
      const mpPayerLastName = name.split(" ").slice(1).join(" ") || "Rifa";

      // Detect current application URL dynamically for the webhooks
      const requestHost = req.headers.host || "";
      const dynamicProtocol = req.headers["x-forwarded-proto"] || "https";
      const webhookUrl = `${dynamicProtocol}://${requestHost}/api/webhook`;

      // Validate webhook URL before sending to Mercado Pago
      const isValidWebhookUrl =
        webhookUrl.startsWith("https://") &&
        !webhookUrl.includes("localhost") &&
        !webhookUrl.includes("127.0.0.1") &&
        !/:\d+/.test(webhookUrl) &&
        !webhookUrl.includes(".local") &&
        !webhookUrl.includes("ais-dev-");

      // Configure absolute expiration on Mercado Pago API
      const expirationDateStr = new Date(expiresAt).toISOString();

      // Deterministic Idempotency Key for Mercado Pago call
      const idempotencyKey =
        req.body.idempotencyKey ||
        req.body.orderId ||
        `pix_${targetRaffleId}_${orderId}_${dNormPhone}_${nums.slice().sort().join("-")}`;

      // Call MP official API with idempotencyKey in requestOptions
      const mpResponse = await mpPayment.create({
        body: {
          transaction_amount: Number(totalAmount),
          description: `Rifa: ${raffleTitle || "Venda"} - Cotas: ${nums.join(", ")}${
            bonusNums.length > 0 ? ` + Bônus: ${bonusNums.join(", ")}` : ""
          }`,
          payment_method_id: "pix",
          date_of_expiration: expirationDateStr,
          ...(isValidWebhookUrl ? { notification_url: webhookUrl } : {}),
          external_reference: targetRaffleId,
          metadata: {
            raffle_id: targetRaffleId,
            raffleId: targetRaffleId,
            order_id: orderId,
            orderId: orderId,
            raffle_name: raffleTitle,
            raffleName: raffleTitle,
          },
          payer: {
            email: mpPayerEmail,
            first_name: mpPayerFirstName,
            last_name: mpPayerLastName,
            identification: {
              type: "CPF",
              number: generateValidCPF(),
            },
            phone: {
              area_code: areaCode,
              number: phoneNumber,
            },
          },
        },
        requestOptions: {
          idempotencyKey,
        },
      });

      tMercadoPago = Date.now() - tMPStart;

      paymentId = String(mpResponse.id);
      qrCode = mpResponse.point_of_interaction?.transaction_data?.qr_code || "";
      qrCodeBase64 = mpResponse.point_of_interaction?.transaction_data?.qr_code_base64 || "";
      isSimulated = false;

      console.log(`✅ [MercadoPago Serverless] Real payment generated! ID: ${paymentId} (Key: ${idempotencyKey})`);
    } catch (mpError: any) {
      console.error("❌ [MercadoPago Serverless] API creation failed:", mpError);

      // Clean up / rollback the reserved numbers we created in the transaction
      if (true) {
        try {
          const cleanupBatch = getAdminFirestore().batch();
          allNums.forEach((num: string) => {
            cleanupBatch.delete(getAdminFirestore().collection("raffles").doc(targetRaffleId).collection("numbers").doc(num));
          });
          await cleanupBatch.commit();
          console.log(`🧹 [MercadoPago Failure Rollback] Cleaned up reservation holds for cotas: ${allNums.join(", ")} in raffle ${targetRaffleId}`);
        } catch (cleanErr) {
          console.error("❌ [MercadoPago Failure Rollback] Error cleaning up holds:", cleanErr);
        }
      }

      let detailMsg = mpError.message || String(mpError);

      if (mpError.api_response) {
        try {
          const apiData = mpError.api_response;
          if (apiData.message) {
            detailMsg += ` (${apiData.message})`;
          }
        } catch (_) {}
      }

      if (mpError.cause && Array.isArray(mpError.cause)) {
        const causes = mpError.cause.map((c: any) => c.description || c.code).join(", ");
        if (causes) {
          detailMsg += ` - Causa: ${causes}`;
        }
      } else if (mpError.cause) {
        detailMsg += ` - Causa: ${JSON.stringify(mpError.cause)}`;
      }

      return res.status(400).json({
        error: `Falha na API do Mercado Pago: ${detailMsg}. Verifique as credenciais ou as informações digitadas.`,
      });
    }
  }

  if (isSimulated) {
    paymentId = "SIM_" + Math.random().toString(36).substring(2, 11).toUpperCase();
    qrCode = "00020101021226830014BR.GOV.BCB.PIX2561api.mercadopago.com/pix/v1/qr/active/simulado-" + paymentId;
    qrCodeBase64 = "";
    console.log(`🧪 [MercadoPago Serverless] Simulated payment generated! ID: ${paymentId}`);
  }

  // Create order and all associated documents in Firestore using high performance Batch Writes
  try {
    const tSaveStart = Date.now();
    if (true) {
      const batch = getAdminFirestore().batch();

      // 1. Setup legacy/compatibility Order document
      const orderRef = getAdminFirestore().collection("orders").doc(orderId);
      const newOrder = {
        id: orderId,
        raffleId: targetRaffleId,
        name,
        phone: dNormPhone,
        nums: allNums,
        bonusNums: bonusNums,
        val: Number(totalAmount),
        status: "pending_payment",
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt,
        paymentId,
        paymentType: isSimulated ? "SimulatedPix" : "MercadoPagoPix",
        qrCode,
        qrCodeBase64,
        isSimulated,
      };
      batch.set(orderRef, newOrder);

      // 2. Setup scalable Reservation document
      const reservationRef = getAdminFirestore().collection("reservations").doc(orderId);
      const newReservation = {
        id: orderId,
        raffleId: targetRaffleId,
        name,
        phone: dNormPhone,
        nums: allNums,
        bonusNums: bonusNums,
        val: Number(totalAmount),
        status: "pending_payment",
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt,
      };
      batch.set(reservationRef, newReservation);

      // 3. Setup scalable Payment logs document
      const paymentRef = getAdminFirestore().collection("payments").doc(paymentId);
      const newPayment = {
        id: paymentId,
        orderId: orderId,
        raffleId: targetRaffleId,
        status: "pending_payment",
        amount: Number(totalAmount),
        createdAt: new Date().toISOString(),
        isSimulated,
      };
      batch.set(paymentRef, newPayment);

      await batch.commit();
      tFinalSave = Date.now() - tSaveStart;

      const tTotal = Date.now() - tStart;
      console.log(
        `⏱️ [PERF_METRICS] Total: ${tTotal}ms | RaffleRead: ${tRaffle}ms | Val&Trans: ${tValAndTrans}ms | MP: ${tMercadoPago}ms | Save: ${tFinalSave}ms`
      );
    } else {
      console.error("❌ [Firestore Serverless] Connection not initialized!");
    }

    return res.status(200).json({
      success: true,
      orderId,
      paymentId,
      qrCode,
      qrCodeBase64,
      isSimulated,
      expiresAt,
      bonusNums,
      perf: {
        totalMs: Date.now() - tStart,
        raffleMs: tRaffle,
        valTransMs: tValAndTrans,
        mpMs: tMercadoPago,
        saveMs: tFinalSave,
      },
    });
  } catch (err: any) {
    console.error("❌ [Serverless] Error committing batch in database:", err);
    return res.status(500).json({ error: "Erro ao criar reserva no banco de dados." });
  }
}
