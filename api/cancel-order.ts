import "dotenv/config";
import { getAdminFirestore } from "./_firebaseAdmin.js";
import { serverSupabaseSync } from "./_supabaseSync.js";
import { MercadoPagoConfig, Payment } from "mercadopago";

let mpPayment: any = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    mpPayment = new Payment(mpClient);
  } catch (err) {
    console.error("❌ [CancelOrder API Mercado Pago] Init error:", err);
  }
}

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId, sessionId, raffleId } = req.body;
  const targetRaffleId = raffleId || "current";

  if (!orderId && !sessionId) {
    return res.status(400).json({ error: "Parâmetro orderId ou sessionId é obrigatório." });
  }

  try {
    const db = getAdminFirestore();
    const nowIso = new Date().toISOString();

    if (orderId) {
      let cancelError: string | null = null;
      let transactionFailed = false;
      let orderNums: string[] = [];

      try {
        await db.runTransaction(async (transaction: any) => {
          const orderRef = db.collection("orders").doc(orderId);
          const reservationRef = db.collection("reservations").doc(orderId);

          // READ 1: Order snapshot
          const orderSnap = await transaction.get(orderRef);
          if (!orderSnap.exists) {
            return;
          }

          const orderData = orderSnap.data();
          const statusLower = (orderData?.status || "").toLowerCase();

          // CRITICAL: NEVER cancel paid orders
          if (
            statusLower === "pago" ||
            statusLower === "paid" ||
            statusLower === "confirmed" ||
            statusLower === "approved"
          ) {
            cancelError = "Este pedido já está pago e confirmado. Não pode ser cancelado.";
            throw new Error("ORDER_ALREADY_PAID");
          }

          orderNums = orderData?.nums || [];
          const orderRaffleId = orderData?.raffleId || targetRaffleId;

          // READ 2: ALL number and lock snapshots BEFORE ANY WRITES
          const numRefs = orderNums.map((num: string) =>
            db.collection("raffles").doc(orderRaffleId).collection("numbers").doc(num)
          );
          const lockRefs = orderNums.map((num: string) =>
            db.collection("locks").doc(num)
          );

          const numSnaps = await Promise.all(numRefs.map((ref: any) => transaction.get(ref)));
          const lockSnaps = await Promise.all(lockRefs.map((ref: any) => transaction.get(ref)));

          // NOW PERFORM ALL WRITES (Zero reads after this point)
          transaction.update(orderRef, { status: "Cancelado", canceledAt: nowIso });
          transaction.set(reservationRef, { status: "Cancelado", canceledAt: nowIso }, { merge: true });

          for (let i = 0; i < orderNums.length; i++) {
            const numSnap = numSnaps[i];
            if (numSnap.exists) {
              const numData = numSnap.data();
              const nStatus = (numData?.status || "").toLowerCase();
              if (
                nStatus !== "paid" &&
                nStatus !== "pago" &&
                (numData?.orderId === orderId || (sessionId && numData?.sessionId === sessionId))
              ) {
                transaction.delete(numRefs[i]);
                if (numData?.isBonus) {
                  console.log(`[BONUS_RELEASED] Bonus cota ${orderNums[i]} released for order ${orderId}`);
                }
              }
            }

            const lockSnap = lockSnaps[i];
            if (lockSnap.exists) {
              const lockData = lockSnap.data();
              if (lockData?.sessionId === sessionId || lockData?.orderId === orderId) {
                transaction.delete(lockRefs[i]);
              }
            }
          }
        });

        console.log(`[ORDER_CANCELLED] orderId: ${orderId}, sessionId: ${sessionId || "N/A"}`);
        console.log(`[LOCK_RELEASED] Locks released for order ${orderId}`);
        if (orderNums.length > 0) {
          serverSupabaseSync.syncDeleteNumbers(targetRaffleId, orderNums).catch(() => {});
        }
      } catch (txErr: any) {
        transactionFailed = true;
        if (cancelError) {
          return res.status(400).json({ error: cancelError });
        }
        console.error(`❌ [CancelOrder Transaction Error] Order ${orderId}:`, txErr);
        return res.status(500).json({ error: "Falha ao processar cancelamento no banco de dados." });
      }
    }

    // Process additional sessionId locks cleanup if provided
    if (sessionId) {
      try {
        const locksSnap = await db
          .collection("locks")
          .where("sessionId", "==", sessionId)
          .get();

        const batch = db.batch();
        locksSnap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      } catch (e) {
        console.warn("⚠️ Failed to query locks by sessionId during cancel-order:", e);
      }
    }

    return res.status(200).json({ success: true, message: "Cancelamento concluído e cotas liberadas com sucesso." });
  } catch (error: any) {
    console.error("❌ [CancelOrder API] Internal error:", error);
    return res.status(500).json({ error: "Falha ao cancelar pedido e liberar cotas." });
  }
}
