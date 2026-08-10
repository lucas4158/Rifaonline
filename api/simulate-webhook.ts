import "dotenv/config";
import path from "path";
import fs from "fs";


import { allocatePromotionalBonus } from "./_promoHelper.js";
import { serverSupabaseSync } from "./_supabaseSync.js";

import admin from "firebase-admin";
import { getAdminFirestore } from "./_firebaseAdmin.js";




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

  if (true) {
    try {
      const ordersRef = getAdminFirestore().collection("orders");
      const q = ordersRef.where("paymentId", "==", String(paymentId));
      const querySnapshot = await q.get();

      if (!querySnapshot.empty) {
        let anyCollision = false;
        const currentNow = Date.now();
        const promises = querySnapshot.docs.map(async (docSnap) => {
          const orderId = docSnap.id;
          
          let transactionSuccess = false;
          let paymentConfirmedEvent = false;
          let needsPromoAllocation = false;
          let orderDataSnapshot: any = null;
          
          try {
            await getAdminFirestore().runTransaction(async (transaction: any) => {
              const orderRef = getAdminFirestore().collection("orders").doc(orderId);
              const reservationRef = getAdminFirestore().collection("reservations").doc(orderId);
              const paymentRef = getAdminFirestore().collection("payments").doc(paymentId);
              
              const currentOrderSnap = await transaction.get(orderRef);
              if (!currentOrderSnap.exists) {
                 throw new Error("ORDER_NOT_FOUND");
              }
              const order = currentOrderSnap.data();
              orderDataSnapshot = order;
              const orderNums = order.nums || [];
              const orderRaffleId = order.raffleId || "current";
              
              // IDEMPOTENCY GUARD
              if (order.status === "Pago" || order.status === "paid" || order.status === "Cancelado" || order.status === "PAYMENT_AFTER_EXPIRATION") {
                console.log(`ℹ️ [Webhook Serverless] Order ${orderId} is already ${order.status}. Skipping to prevent duplicate processing.`);
                throw new Error("ALREADY_PROCESSED");
              }
              
              const isExpired = order.status === "expired" || (order.expiresAt && order.expiresAt <= currentNow);
              if (isExpired) {
                transaction.update(orderRef, {
                  status: "PAYMENT_AFTER_EXPIRATION",
                  receivedLatePayment: true,
                  approvedAt: null,
                  paymentCollisionError: true,
                  paymentCollisionReason: "Pagamento atrasado recebido após a expiração da reserva."
                });
                transaction.update(reservationRef, { status: "PAYMENT_AFTER_EXPIRATION", approvedAt: null });
                transaction.set(paymentRef, {
                  id: paymentId,
                  orderId: orderId,
                  status: "PAYMENT_AFTER_EXPIRATION",
                  amount: Number(order.val || 0),
                  createdAt: order.createdAt || new Date().toISOString(),
                  collisionError: true,
                  collisionNotes: "Pagamento atrasado."
                }, { merge: true });
                throw new Error("EXPIRED");
              }
              
              // Collision check inside transaction
              let hasCollision = false;
              const conflictingDocuments: string[] = [];
              const numRefs = orderNums.map((num: string) => getAdminFirestore().collection("raffles").doc(orderRaffleId).collection("numbers").doc(num));
              const numSnaps = await Promise.all(numRefs.map((ref: any) => transaction.get(ref)));
              
              for (let i = 0; i < orderNums.length; i++) {
                const numSnap = numSnaps[i];
                if (numSnap.exists) {
                  const numData = numSnap.data();
                  if (numData && numData.orderId !== orderId) {
                    const statusClean = (numData.status || "").toLowerCase().trim();
                    const isPaidStatus = statusClean === "paid" || statusClean === "pago" || statusClean === "approved";
                    const isReservedStatus = statusClean === "reserved" || statusClean === "pending_payment" || statusClean === "aguardando";
                    if (isPaidStatus || (isReservedStatus && (!numData.expiresAt || numData.expiresAt > currentNow))) {
                      hasCollision = true;
                      conflictingDocuments.push(`Número ${orderNums[i]} (Pedido ${numData.orderId})`);
                    }
                  }
                }
              }
              
              if (hasCollision) {
                // Remove our own reserved numbers
                for (let i = 0; i < orderNums.length; i++) {
                  const numSnap = numSnaps[i];
                  if (numSnap.exists && numSnap.data()?.orderId === orderId) {
                    transaction.delete(numRefs[i]);
                  }
                }
                const collisionReason = `Pagamento recebido, mas conflito detectado: ${conflictingDocuments.join("; ")}`;
                transaction.update(orderRef, {
                  status: "Cancelado",
                  paymentCollisionError: true,
                  paymentCollisionReason: collisionReason,
                  approvedAt: new Date().toISOString(),
                  receivedLatePayment: true
                });
                transaction.update(reservationRef, { status: "Cancelado", paymentCollisionError: true, approvedAt: new Date().toISOString() });
                transaction.set(paymentRef, {
                  id: paymentId,
                  orderId: orderId,
                  status: "canceled",
                  amount: Number(order.val || 0),
                  createdAt: order.createdAt || new Date().toISOString(),
                  collisionError: true,
                  collisionNotes: collisionReason
                }, { merge: true });
                throw new Error("COLLISION");
              } else {
                // SUCCESS: Mark as paid
                transaction.update(orderRef, { status: "Pago", approvedAt: new Date().toISOString() });
                transaction.update(reservationRef, { status: "Pago", approvedAt: new Date().toISOString() });
                transaction.set(paymentRef, {
                  id: paymentId,
                  orderId: orderId,
                  status: "approved",
                  amount: Number(order.val || 0),
                  createdAt: order.createdAt || new Date().toISOString(),
                  approvedAt: new Date().toISOString()
                }, { merge: true });
                
                const bonusNumsSet = new Set<string>(order.bonusNums || []);
                let mainPaidCount = 0;
                
                for (let i = 0; i < orderNums.length; i++) {
                  transaction.set(numRefs[i], {
                    id: orderNums[i],
                    status: "paid",
                    orderId: orderId,
                    name: order.name,
                    phone: order.phone,
                    isBonus: bonusNumsSet.has(orderNums[i]),
                    updatedAt: new Date().toISOString()
                  });
                  // Only count non-bonus numbers for soldCount
                  if (!bonusNumsSet.has(orderNums[i])) {
                    mainPaidCount++;
                  }
                }
                
                // Atomically increment soldCount on the raffle
                const raffleRef = getAdminFirestore().collection("raffles").doc(orderRaffleId);
                transaction.update(raffleRef, {
                  soldCount: admin.firestore.FieldValue.increment(mainPaidCount)
                });
                
                paymentConfirmedEvent = true;
                
                // NOTA TÉCNICA (LIMITAÇÃO DE ARQUITETURA): 
                // Não executamos allocatePromotionalBonus dentro da transaction porque a função 
                // precisa realizar um getDocs(collection(numbers)) para encontrar cotas livres. 
                // Firestore não suporta queries dentro de transações de cliente (somente gets diretos).
                // Portanto, alocamos os bônus num writeBatch em seguida. A atomicidade crítica (venda e soldCount)
                // já está garantida acima.
                needsPromoAllocation = true;
              }
            });
            transactionSuccess = true;
          } catch (error: any) {
             if (error.message !== "ALREADY_PROCESSED" && error.message !== "ORDER_NOT_FOUND" && error.message !== "EXPIRED" && error.message !== "COLLISION") {
               console.error(`❌ [Webhook Transaction] Error processing ${orderId}:`, error);
             }
          }
          
          if (transactionSuccess && needsPromoAllocation) {
             try {
                const batch = getAdminFirestore().batch();
                await allocatePromotionalBonus(getAdminFirestore(), orderId, orderDataSnapshot, batch);
                await batch.commit();
             } catch (bonusErr) {
                console.error(`❌ [Webhook Bonus] Failed to allocate bonus after successful transaction for ${orderId}:`, bonusErr);
             }
          }
          
          if (paymentConfirmedEvent) {
            console.log(`[PAYMENT_CONFIRMED] Webhook confirmed payment approved successfully! orderId: ${orderId}, paymentId: ${paymentId}`);
            const orderNums = orderDataSnapshot.nums || [];
            const orderRaffleId = orderDataSnapshot.raffleId || "current";
            serverSupabaseSync.syncConfirmedPayment({
              orderId,
              raffleId: orderRaffleId,
              customerName: orderDataSnapshot.name,
              customerPhone: orderDataSnapshot.phone,
              amount: Number(orderDataSnapshot.val || 0),
              paymentId: String(paymentId),
              numsCount: orderNums.length,
            }).catch((syncErr) => console.error("Non-critical error syncing to Supabase:", syncErr));
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
