import "dotenv/config";
import path from "path";
import fs from "fs";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, writeBatch, setLogLevel } from "firebase/firestore";
import { allocatePromotionalBonus } from "./promo-helper.js";

setLogLevel("silent");

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

  const { paymentId } = req.body;
  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }

  console.log(`🧪 [Simulator Serverless] Webhook simulation request for ID: ${paymentId}`);

  if (db) {
    try {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("paymentId", "==", String(paymentId)));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        let anyCollision = false;
        const currentNow = Date.now();
        const promises = querySnapshot.docs.map(async (docSnap) => {
          const order = docSnap.data();
          const orderId = docSnap.id;
          const orderNums = order.nums || [];

          // IDEMPOTENCY GUARD: If order is already Pago or paid, strictly ignore
          if (order.status === "Pago" || order.status === "paid") {
            console.log(`ℹ️ [Simulator Serverless] Order ${orderId} is already marked as 'Pago'. Skipping.`);
            return;
          }

          // 1. Check if the reservation/order has expired
          const isExpired = order.status === "expired" || order.status === "PAYMENT_AFTER_EXPIRATION" || (order.expiresAt && order.expiresAt <= currentNow);

          if (isExpired) {
            console.log(`⚠️ [Simulator Serverless] Order ${orderId} has expired. Rejecting simulated payment.`);
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
            console.log(`❌ [Simulator Serverless] Order ${orderId} marked as PAYMENT_AFTER_EXPIRATION.`);
            return;
          }

          // Direct checking of number conflicts in /raffles/current/numbers/{numId}
          let hasCollision = false;
          const conflictingDocuments: string[] = [];

          for (const num of orderNums) {
            const numSnap = await getDoc(doc(db, "raffles", "current", "numbers", num));
            if (numSnap.exists()) {
              const numData = numSnap.data();
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
              const numRef = doc(db, "raffles", "current", "numbers", num);
              const numSnap = await getDoc(numRef);
              if (numSnap.exists() && numSnap.data()?.orderId === orderId) {
                batch.delete(numRef);
              }
            }

            anyCollision = true;
            const collisionReason = `Pagamento recebido após expiração, mas deparou-se com conflito: ${conflictingDocuments.join("; ")}`;
            
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
            console.log(`⚠️ [Simulator Serverless] Collision detected for simulated paymentId: ${paymentId}. Order left as Canceled.`);
          } else {
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
              const numDocRef = doc(db, "raffles", "current", "numbers", num);
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
            console.log(`🔥 [Simulator Serverless] Atomically approved Order ${orderId} and allocated paid numbers.`);
          }
        });
        await Promise.all(promises);
        
        if (anyCollision) {
          return res.status(200).json({ success: true, message: "Aprovação simulada, porém conflito de cotas detectado! O pedido foi mantido como cancelado e com flag de erro." });
        }
        return res.status(200).json({ success: true, message: "Aprovação simulada com sucesso!" });
      } else {
        return res.status(404).json({ error: "Ordem correspondente não encontrada." });
      }
    } catch (dbErr: any) {
      console.error("❌ [Simulator Serverless] Error updating doc:", dbErr);
      return res.status(500).json({ error: dbErr.message || "Erro no banco de dados." });
    }
  }

  return res.status(500).json({ error: "Banco de dados não disponível." });
}
