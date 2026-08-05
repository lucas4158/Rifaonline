import "dotenv/config";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, writeBatch, setLogLevel } from "firebase/firestore";
import { allocatePromotionalBonus } from "./promo-helper.js";

setLogLevel("silent");
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

// Initialize Firebase
let db: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  }
} catch (err) {
  console.error("❌ [Firebase Serverless] Init error:", err);
}

export default async function handler(req: any, res: any) {
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

  try {
    console.log("📥 [Webhook Serverless] Received from Mercado Pago:", JSON.stringify(req.body));
    
    if (process.env.MP_WEBHOOK_SECRET) {
      console.log(`🔒 [Webhook Serverless] Webhook secret signature key configured! X-Signature header:`, req.headers['x-signature'] || 'None');
    }

    // Capture paymentId from query string or body
    let paymentId = req.query?.["data.id"] || req.body?.data?.id || req.body?.id || req.query?.id;

    if (req.query?.topic === "payment" && req.query?.id) {
      paymentId = req.query.id;
    }

    if (!paymentId) {
      return res.status(200).json({ status: "ignored", message: "No paymentId found." });
    }

    console.log(`🔍 [Webhook Serverless] Processing payment ID: ${paymentId}`);

    if (process.env.MP_WEBHOOK_SECRET) {
      const xSignature = req.headers["x-signature"];
      const xRequestId = req.headers["x-request-id"] || "";

      if (!xSignature) {
        console.warn("⚠️ [Webhook] Assinatura x-signature ausente!");
        console.log("[SIGNATURE_CHECK]", "INVALID");
      } else {
        let ts = "";
        let v1 = "";
        String(xSignature).split(",").forEach((part) => {
          const [key, val] = part.split("=").map((s) => s.trim());
          if (key === "ts") ts = val;
          if (key === "v1") v1 = val;
        });

        if (!ts || !v1) {
          console.warn("⚠️ [Webhook] Formato inválido no cabeçalho x-signature!");
          console.log("[SIGNATURE_CHECK]", "INVALID");
        } else {
          const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
          const hmac = crypto.createHmac("sha256", process.env.MP_WEBHOOK_SECRET);
          hmac.update(manifest);
          const calculatedHash = hmac.digest("hex");

          let isSignatureValid = false;
          if (v1.length === calculatedHash.length) {
            isSignatureValid = crypto.timingSafeEqual(
              Buffer.from(calculatedHash),
              Buffer.from(v1)
            );
          } else {
            console.error("❌ [Webhook] Assinatura com tamanho inválido!");
          }

          console.log("[SIGNATURE_CHECK]", isSignatureValid ? "VALID" : "INVALID");

          if (!isSignatureValid) {
            console.error("❌ [Webhook] Assinatura HMAC inválida do Mercado Pago!");
          } else {
            console.log("✅ [Webhook] Assinatura do Mercado Pago validada com sucesso!");
          }
        }
      }
    } else {
      console.log("ℹ️ [Webhook] MP_WEBHOOK_SECRET não configurado. Validação de assinatura ignorada.");
    }

    const isProduction = process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
    const hasMP = !!process.env.MP_ACCESS_TOKEN && mpPayment;
    let paymentIsApproved = false;

    if (String(paymentId).startsWith("SIM_")) {
      if (isProduction) {
        console.warn(`⚠️ [Webhook Serverless] Simulated payment ID (${paymentId}) rejected in production environment!`);
        paymentIsApproved = false;
      } else {
        paymentIsApproved = true;
        console.log("🧪 [Webhook Serverless] Processing SIMULATED payment approval (non-production environment)!");
      }
    } else if (hasMP && mpPayment) {
      try {
        const paymentInfo = await mpPayment.get({ id: Number(paymentId) });
        if (paymentInfo && paymentInfo.status === "approved") {
          paymentIsApproved = true;
          console.log(`💰 [Webhook Serverless] MercadoPago verified payment ${paymentId} is APPROVED!`);
        } else {
          console.log(`⏳ [Webhook Serverless] MercadoPago payment ${paymentId} status: ${paymentInfo ? paymentInfo.status : "unknown"}`);
        }
      } catch (mpErr) {
        console.error(`❌ [Webhook Serverless] Error fetching payment info:`, mpErr);
      }
    } else {
      console.log(`⚠️ [Webhook Serverless] No access token or SDK configuration to verify real payment ID: ${paymentId}`);
    }

    // If approved, update Firestore Documents atomically
    if (paymentIsApproved && db) {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("paymentId", "==", String(paymentId)));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const currentNow = Date.now();
        const promises = querySnapshot.docs.map(async (docSnap) => {
          const order = docSnap.data();
          const orderId = docSnap.id;
          const orderNums = order.nums || [];

          // IDEMPOTENCY GUARD: If order is already Pago or paid, strictly ignore
          if (order.status === "Pago" || order.status === "paid") {
            console.log(`ℹ️ [Webhook Serverless] Order ${orderId} is already marked as 'Pago'. Skipping to prevent duplicate processing.`);
            return;
          }
          
          // 1. Check if the reservation/order has expired
          const isExpired = order.status === "expired" || order.status === "PAYMENT_AFTER_EXPIRATION" || (order.expiresAt && order.expiresAt <= currentNow);

          if (isExpired) {
            console.log(`⚠️ [Webhook Serverless] Order ${orderId} has expired. Rejecting payment.`);
            console.log(`[PIX_EXPIRED] Pix expired or late check-in! orderId: ${orderId}, paymentId: ${paymentId}`);
            console.log(`[PAYMENT_AFTER_EXPIRATION] Late payment received for order ${orderId} (payment ${paymentId}) after expiration list.`);
            
            const batch = writeBatch(db);

            batch.update(doc(db, "orders", orderId), {
              status: "PAYMENT_AFTER_EXPIRATION",
              receivedLatePayment: true,
              approvedAt: null,
              paymentCollisionError: true,
              paymentCollisionReason: "Pagamento atrasado recebido após a expiração da reserva de 10 minutos."
            });

            batch.update(doc(db, "reservations", orderId), {
              status: "PAYMENT_AFTER_EXPIRATION",
              approvedAt: null
            });

            batch.set(doc(db, "payments", paymentId), {
              id: paymentId,
              orderId: orderId,
              status: "PAYMENT_AFTER_EXPIRATION",
              amount: Number(order.val || 0),
              createdAt: order.createdAt || new Date().toISOString(),
              collisionError: true,
              collisionNotes: "Pagamento atrasado recebido após a expiração."
            }, { merge: true });

            await batch.commit();
            console.log(`❌ [Webhook Serverless] Order ${orderId} marked as PAYMENT_AFTER_EXPIRATION to prevent duplicate processing.`);
            return;
          }

          const orderRaffleId = order.raffleId || "current";
          
          // Direct checking of number conflicts in /raffles/{orderRaffleId}/numbers/{numId}
          let hasCollision = false;
          const conflictingDocuments: string[] = [];

          for (const num of orderNums) {
            const numSnap = await getDoc(doc(db, "raffles", orderRaffleId, "numbers", num));
            if (numSnap.exists()) {
              const numData = numSnap.data();
              // Conflict if owned by another order AND status is active (paid or unexpired reservation)
              if (numData && numData.orderId !== orderId) {
                const statusClean = (numData.status || "").toLowerCase().trim();
                const isPaidStatus = statusClean === "paid" || statusClean === "pago" || statusClean === "approved";
                const isReservedStatus = statusClean === "reserved" || statusClean === "pending_payment" || statusClean === "aguardando";

                if (
                  isPaidStatus ||
                  (isReservedStatus && (!numData.expiresAt || numData.expiresAt > currentNow))
                ) {
                  hasCollision = true;
                  conflictingDocuments.push(`Número ${num} (Pedido ${numData.orderId})`);
                }
              }
            }
          }

          const batch = writeBatch(db);

          if (hasCollision) {
            // Cancel and release any of our own reserved numbers so they don't remain locked
            for (const num of orderNums) {
              const numRef = doc(db, "raffles", orderRaffleId, "numbers", num);
              const numSnap = await getDoc(numRef);
              if (numSnap.exists() && numSnap.data()?.orderId === orderId) {
                batch.delete(numRef);
              }
            }

            // Commit cancel state to avoid double booking
            const collisionReason = `Pagamento recebido pós-expiração, mas conflito de cotas detectado: ${conflictingDocuments.join("; ")}`;
            console.warn(`[CONFLICT_DETECTED] Webhook payment conflict detected for order ${orderId}, paymentId: ${paymentId}. Reason: ${collisionReason}`);
            
            batch.update(doc(db, "orders", orderId), {
              status: "Cancelado",
              paymentCollisionError: true,
              paymentCollisionReason: collisionReason,
              approvedAt: new Date().toISOString(),
              receivedLatePayment: true
            });

            batch.update(doc(db, "reservations", orderId), {
              status: "Cancelado",
              paymentCollisionError: true,
              approvedAt: new Date().toISOString()
            });

            batch.set(doc(db, "payments", paymentId), {
              id: paymentId,
              orderId: orderId,
              status: "canceled",
              amount: Number(order.val || 0),
              createdAt: order.createdAt || new Date().toISOString(),
              collisionError: true,
              collisionNotes: collisionReason
            }, { merge: true });

            await batch.commit();
            console.log(`⚠️ [Webhook Serverless] Conflict detected! Order, Reservation left as Cancelled with warning logs for paymentId: ${paymentId}`);
          } else {
            // Mark as approved atomically across all entities
            batch.update(doc(db, "orders", orderId), {
              status: "Pago",
              approvedAt: new Date().toISOString()
            });

            batch.update(doc(db, "reservations", orderId), {
              status: "Pago",
              approvedAt: new Date().toISOString()
            });

            batch.set(doc(db, "payments", paymentId), {
              id: paymentId,
              orderId: orderId,
              status: "approved",
              amount: Number(order.val || 0),
              createdAt: order.createdAt || new Date().toISOString(),
              approvedAt: new Date().toISOString()
            }, { merge: true });

            // Lock numbers as strictly PAID
            const bonusNumsSet = new Set<string>(order.bonusNums || []);
            orderNums.forEach((num: string) => {
              const numDocRef = doc(db, "raffles", orderRaffleId, "numbers", num);
              batch.set(numDocRef, {
                id: num,
                status: "paid",
                orderId: orderId,
                name: order.name,
                phone: order.phone,
                isBonus: bonusNumsSet.has(num),
                updatedAt: new Date().toISOString()
              });
            });

             await allocatePromotionalBonus(db, orderId, order, batch);

            await batch.commit();
            console.log(`[PAYMENT_CONFIRMED] Webhook confirmed payment approved successfully! orderId: ${orderId}, paymentId: ${paymentId}, amount: ${Number(order.val)}, cotas: ${orderNums.join(", ")}`);
            console.log(`🔥 [Webhook Serverless] Atomically approved Order, Reservation, Payment and set PAID status for cotas: ${orderNums.join(", ")}`);
          }
        });
        await Promise.all(promises);
      } else {
        console.log(`⚠️ [Webhook Serverless] No order found matching paymentId: ${paymentId}`);
      }
    }

    return res.status(200).json({ status: "success" });
  } catch (err: any) {
    console.error("❌ [Webhook Serverless] Exception in webhook handler:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
