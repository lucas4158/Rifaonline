import "dotenv/config";
import { getAdminFirestore } from "./_firebaseAdmin.js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { allocatePromotionalBonus } from "./_promoHelper.js";
import { serverSupabaseSync } from "./_supabaseSync.js";
import admin from "firebase-admin";

let mpPayment: any = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    mpPayment = new Payment(mpClient);
  } catch (err) {
    console.error("❌ [CheckPayment API] MercadoPago Init error:", err);
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

  const { paymentId, orderId, raffleId } = req.body;
  const targetRaffleId = raffleId || "current";

  if (!paymentId && !orderId) {
    return res.status(400).json({ error: "Parâmetro paymentId ou orderId é obrigatório." });
  }

  try {
    const db = getAdminFirestore();
    const currentNow = Date.now();

    // 1. Locate order by orderId or paymentId (O(1) direct lookup priority)
    let targetOrderSnap: any = null;
    let targetOrderId = orderId;

    if (targetOrderId) {
      const orderRef = db.collection("orders").doc(targetOrderId);
      targetOrderSnap = await orderRef.get();
    }

    if ((!targetOrderSnap || !targetOrderSnap.exists) && paymentId) {
      try {
        const paySnap = await db.collection("payments").doc(String(paymentId)).get();
        if (paySnap.exists && paySnap.data()?.orderId) {
          targetOrderId = paySnap.data().orderId;
          targetOrderSnap = await db.collection("orders").doc(targetOrderId).get();
        }
      } catch (payLookErr) {
        console.warn(`⚠️ [CheckPayment] Payment lookup warning for ${paymentId}:`, payLookErr);
      }
    }

    if ((!targetOrderSnap || !targetOrderSnap.exists) && paymentId) {
      const q = db.collection("orders").where("paymentId", "==", String(paymentId)).limit(1);
      const qSnap = await q.get();
      if (!qSnap.empty) {
        targetOrderSnap = qSnap.docs[0];
        targetOrderId = targetOrderSnap.id;
      }
    }

    if (!targetOrderSnap || !targetOrderSnap.exists) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    const orderData = targetOrderSnap.data();
    const currentOrderStatus = (orderData?.status || "").toLowerCase();

    // If already paid, return early
    if (currentOrderStatus === "pago" || currentOrderStatus === "paid" || currentOrderStatus === "approved") {
      console.log(`[PAYMENT_STATUS_CHECKED] Order ${targetOrderId} is already PAID. Returning confirmed status.`);
      return res.status(200).json({
        approved: true,
        status: "approved",
        orderStatus: "Pago",
        orderId: targetOrderId,
        nums: orderData.nums || [],
        bonusNums: orderData.bonusNums || [],
        val: Number(orderData.val || 0),
      });
    }

    // Check payment status on Gateway (Mercado Pago only - SIM_ simulation completely removed)
    const effectivePaymentId = paymentId || orderData.paymentId;
    let isApprovedOnGateway = false;
    let gatewayStatus = "pending";

    if (String(effectivePaymentId).startsWith("SIM_")) {
      console.warn(`⚠️ [CheckPayment] Rejected simulated payment ID: ${effectivePaymentId}`);
      isApprovedOnGateway = false;
    } else if (effectivePaymentId && mpPayment) {
      try {
        const mpInfo = await mpPayment.get({ id: Number(effectivePaymentId) });
        gatewayStatus = mpInfo?.status || "pending";
        if (gatewayStatus === "approved") {
          const metaOrderId = mpInfo?.metadata?.order_id || mpInfo?.metadata?.orderId;
          const metaRaffleId = mpInfo?.metadata?.raffle_id || mpInfo?.metadata?.raffleId;
          const orderRaffleId = orderData.raffleId || "current";

          if (metaOrderId && metaOrderId !== targetOrderId) {
            console.error(`❌ [CheckPayment] CRITICAL SECURITY: Payment metadata order_id (${metaOrderId}) does not match orderId (${targetOrderId})!`);
            return res.status(200).json({ approved: false, error: "Payment does not belong to this order." });
          }
          if (metaRaffleId && metaRaffleId !== orderRaffleId) {
            console.error(`❌ [CheckPayment] CRITICAL SECURITY: Payment metadata raffle_id (${metaRaffleId}) does not match order raffleId (${orderRaffleId})!`);
            return res.status(200).json({ approved: false, error: "Payment raffle mismatch." });
          }

          const expectedValCents = Math.round(Number(orderData?.val || 0) * 100);
          const paidValCents = Math.round(Number(mpInfo?.transaction_amount || mpInfo?.total_paid_amount || 0) * 100);
          if (expectedValCents > 0 && paidValCents > 0 && paidValCents === expectedValCents) {
            isApprovedOnGateway = true;
          } else {
            console.error(`❌ [CheckPayment] Amount mismatch: expected ${expectedValCents} cents, paid ${paidValCents} cents`);
          }
        }
      } catch (mpErr) {
        console.error(`❌ [CheckPayment] Error fetching payment ${effectivePaymentId} from MP API:`, mpErr);
      }
    }

    console.log(`[PAYMENT_STATUS_CHECKED] orderId: ${targetOrderId}, paymentId: ${effectivePaymentId}, gatewayStatus: ${gatewayStatus}, isApprovedOnGateway: ${isApprovedOnGateway}`);

    if (!isApprovedOnGateway) {
      return res.status(200).json({
        approved: false,
        status: gatewayStatus,
        orderStatus: orderData.status,
        orderId: targetOrderId,
      });
    }

    // If approved on gateway, confirm payment atomically in Firestore
    let transactionSuccess = false;
    let needsPromoAllocation = false;
    let freshOrderSnapshot: any = orderData;

    try {
      await db.runTransaction(async (transaction: any) => {
        const orderRef = db.collection("orders").doc(targetOrderId);
        const reservationRef = db.collection("reservations").doc(targetOrderId);
        const paymentRef = db.collection("payments").doc(String(effectivePaymentId));

        // Idempotency check (Correction 3)
        const idempotencyKey = `mp:${targetOrderId}:${effectivePaymentId}:${gatewayStatus}`;
        const eventRef = db.collection("processedWebhooks").doc(idempotencyKey);
        const eventSnap = await transaction.get(eventRef);
        if (eventSnap.exists) {
          return;
        }
        transaction.set(eventRef, {
          key: idempotencyKey,
          orderId: targetOrderId,
          processedAt: new Date().toISOString(),
        });

        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) {
          throw new Error("ORDER_NOT_FOUND");
        }
        const currentOrder = orderSnap.data();
        freshOrderSnapshot = currentOrder;

        const statusLower = (currentOrder.status || "").toLowerCase();
        if (statusLower === "pago" || statusLower === "paid" || statusLower === "approved") {
          return;
        }

        if (statusLower === "cancelado" || statusLower === "canceled" || statusLower === "expired") {
          transaction.update(orderRef, {
            receivedLatePayment: true,
            latePaymentStatus: "approved_on_mp_after_cancellation",
            approvedAt: new Date().toISOString(),
          });
          transaction.set(paymentRef, {
            id: String(effectivePaymentId),
            orderId: targetOrderId,
            status: "approved_after_cancellation",
            amount: Number(currentOrder.val || 0),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          throw new Error("CANCELLED_OR_EXPIRED");
        }

        const orderNums: string[] = currentOrder.nums || [];
        const orderRaffleId = currentOrder.raffleId || targetRaffleId;

        // Collision check
        let hasCollision = false;
        const numRefs = orderNums.map((num: string) => db.collection("raffles").doc(orderRaffleId).collection("numbers").doc(num));
        const numSnaps = await Promise.all(numRefs.map((ref: any) => transaction.get(ref)));

        for (let i = 0; i < orderNums.length; i++) {
          const numSnap = numSnaps[i];
          if (numSnap.exists) {
            const numData = numSnap.data();
            if (numData && numData.orderId !== targetOrderId) {
              const st = (numData.status || "").toLowerCase().trim();
              if (st === "paid" || st === "pago" || (st === "reserved" && (!numData.expiresAt || numData.expiresAt > currentNow))) {
                hasCollision = true;
                break;
              }
            }
          }
        }

        if (hasCollision) {
          transaction.update(orderRef, {
            status: "Cancelado",
            paymentCollisionError: true,
            receivedLatePayment: true,
          });
          throw new Error("COLLISION");
        }

        // Mark order as PAID
        transaction.update(orderRef, { status: "Pago", approvedAt: new Date().toISOString() });
        transaction.set(reservationRef, { status: "Pago", approvedAt: new Date().toISOString() }, { merge: true });
        transaction.set(paymentRef, {
          id: String(effectivePaymentId),
          orderId: targetOrderId,
          status: "approved",
          amount: Number(currentOrder.val || 0),
          approvedAt: new Date().toISOString(),
        }, { merge: true });

        const bonusSet = new Set<string>(currentOrder.bonusNums || []);
        if (bonusSet.size > 0) {
          console.log(`[BONUS_PAID] orderId: ${targetOrderId}, bonusNums: ${Array.from(bonusSet).join(", ")}`);
        }
        let mainPaidCount = 0;

        for (let i = 0; i < orderNums.length; i++) {
          const isBonus = bonusSet.has(orderNums[i]);
          transaction.set(numRefs[i], {
            id: orderNums[i],
            status: "paid",
            orderId: targetOrderId,
            name: currentOrder.name,
            phone: currentOrder.phone,
            isBonus: isBonus,
            updatedAt: new Date().toISOString(),
          });
          if (!isBonus) {
            mainPaidCount++;
          }
        }

        const raffleRef = db.collection("raffles").doc(orderRaffleId);
        transaction.update(raffleRef, {
          soldCount: admin.firestore.FieldValue.increment(mainPaidCount),
        });

        needsPromoAllocation = true;
      });

      transactionSuccess = true;
    } catch (txErr: any) {
      console.log(`ℹ️ [CheckPayment Transaction] ${targetOrderId}: ${txErr?.message || txErr}`);
      if (txErr?.message === "ALREADY_PROCESSED") {
        transactionSuccess = true;
      }
    }

    if (transactionSuccess && needsPromoAllocation) {
      try {
        const batch = db.batch();
        await allocatePromotionalBonus(db, targetOrderId, freshOrderSnapshot, batch, targetRaffleId);
        await batch.commit();
        console.log(`[BONUS_ALLOCATED] Bonus checked and allocated for order: ${targetOrderId}`);
      } catch (bErr) {
        console.error(`❌ [CheckPayment Bonus] Error allocating bonus for ${targetOrderId}:`, bErr);
      }

      console.log(`[PAYMENT_APPROVED] orderId: ${targetOrderId}, paymentId: ${effectivePaymentId}`);
      console.log(`[ORDER_PAID] orderId: ${targetOrderId}`);

      serverSupabaseSync.syncConfirmedPayment({
        orderId: targetOrderId,
        raffleId: freshOrderSnapshot.raffleId || targetRaffleId,
        customerName: freshOrderSnapshot.name,
        customerPhone: freshOrderSnapshot.phone,
        amount: Number(freshOrderSnapshot.val || 0),
        paymentId: String(effectivePaymentId),
        numsCount: (freshOrderSnapshot.nums || []).length,
        numbers: freshOrderSnapshot.nums || [],
        bonusNums: Array.isArray(freshOrderSnapshot.bonusNums) ? freshOrderSnapshot.bonusNums : [],
      }).catch(() => {});
    }

    // Refetch latest order data to return exact numbers & bonus
    const updatedOrderSnap = await db.collection("orders").doc(targetOrderId).get();
    const finalData = updatedOrderSnap.exists ? updatedOrderSnap.data() : freshOrderSnapshot;

    return res.status(200).json({
      approved: true,
      status: "approved",
      orderStatus: finalData?.status || "Pago",
      orderId: targetOrderId,
      nums: finalData?.nums || [],
      bonusNums: finalData?.bonusNums || [],
      val: Number(finalData?.val || 0),
    });
  } catch (err: any) {
    console.error("❌ [CheckPayment API] Internal error:", err);
    return res.status(500).json({ error: "Erro ao verificar status do pagamento." });
  }
}
