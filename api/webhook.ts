import "dotenv/config";
import crypto from "crypto";
import { allocatePromotionalBonus } from "./_promoHelper.js";
import { serverSupabaseSync } from "./_supabaseSync.js";
import admin from "firebase-admin";
import { getAdminFirestore } from "./_firebaseAdmin.js";
import { MercadoPagoConfig, Payment } from "mercadopago";

// Initialize Mercado Pago
let mpPayment: any = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    mpPayment = new Payment(mpClient);
  } catch (err) {
    console.error("❌ [Webhook] Mercado Pago init error:", err);
  }
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
    console.log("📥 [WEBHOOK_RECEIVED] Raw notification payload from Mercado Pago:", JSON.stringify(req.body));

    const rawBody = req.body || {};
    const rawQuery = req.query || {};

    const rawXSignature = req.headers["x-signature"];
    const rawXRequestId = req.headers["x-request-id"];

    const hasXSignature = !!rawXSignature;
    const hasXRequestId = !!rawXRequestId;

    // 1. Extract data.id for modern v2 webhooks
    const dataId =
      rawBody?.data?.id ||
      rawQuery?.["data.id"] ||
      rawQuery?.["data[id]"] ||
      "";

    const hasDataId = !!dataId;

    // Determine notification format and action
    const action = String(rawBody?.action || rawBody?.topic || rawQuery?.topic || "unknown");
    const isLegacyFormat =
      !!(rawBody?.resource || rawBody?.topic || rawQuery?.topic) &&
      !rawBody?.action &&
      !hasDataId;

    const notificationFormat = isLegacyFormat ? "legacy_ipn" : "modern_webhook";

    // Extract paymentId from all supported formats
    let paymentId = String(dataId || rawBody?.id || rawQuery?.id || "").trim();
    if (!paymentId && rawBody?.resource) {
      const match = String(rawBody.resource).match(/\/(\d+)$/);
      if (match) {
        paymentId = match[1];
      } else if (!isNaN(Number(rawBody.resource))) {
        paymentId = String(rawBody.resource);
      }
    }

    const logDiagnostic = (hmacResult: string, httpStatus: number) => {
      console.log(
        `🔍 [WEBHOOK_DIAGNOSTIC] ` +
        `format: "${notificationFormat}", ` +
        `hasXSignature: ${hasXSignature}, ` +
        `hasXRequestId: ${hasXRequestId}, ` +
        `hasDataId: ${hasDataId}, ` +
        `hmacResult: "${hmacResult}", ` +
        `paymentId: "${paymentId || "N/A"}", ` +
        `action: "${action}", ` +
        `httpStatus: ${httpStatus}`
      );
    };

    if (!paymentId) {
      logDiagnostic("IGNORED_NO_PAYMENT_ID", 200);
      return res.status(200).json({ status: "ignored", message: "No paymentId found." });
    }

    // 2. Safe handling of Legacy IPN notifications (Acknowledged without financial processing)
    if (isLegacyFormat) {
      logDiagnostic("BYPASSED_LEGACY_IGNORED", 200);
      return res.status(200).json({
        status: "ignored",
        message: "Legacy IPN notification acknowledged without financial processing.",
      });
    }

    // 3. Strict HMAC Signature Validation for Modern Webhooks
    if (process.env.MP_WEBHOOK_SECRET) {
      if (!hasXSignature || !hasDataId) {
        logDiagnostic("FAILED_MISSING_SIGNATURE", 401);
        return res.status(401).json({ error: "Missing x-signature or data.id parameter" });
      }

      let ts = "";
      let v1 = "";
      String(rawXSignature).split(",").forEach((part) => {
        const [key, val] = part.split("=").map((s) => s.trim());
        if (key === "ts") ts = val;
        if (key === "v1") v1 = val;
      });

      if (!ts || !v1) {
        logDiagnostic("FAILED_INVALID_SIGNATURE_FORMAT", 401);
        return res.status(401).json({ error: "Invalid x-signature header format" });
      }

      const xRequestIdStr = String(rawXRequestId || "").trim();
      const manifest = `id:${dataId};request-id:${xRequestIdStr};ts:${ts};`;
      const hmac = crypto.createHmac("sha256", process.env.MP_WEBHOOK_SECRET);
      hmac.update(manifest);
      const calculatedHash = hmac.digest("hex");

      let isSignatureValid = false;
      if (v1.length === calculatedHash.length) {
        isSignatureValid = crypto.timingSafeEqual(
          Buffer.from(calculatedHash),
          Buffer.from(v1)
        );
      }

      if (!isSignatureValid) {
        logDiagnostic("FAILED_HMAC_MISMATCH", 401);
        return res.status(401).json({ error: "Invalid HMAC signature" });
      }

      logDiagnostic("SUCCESS", 200);
    } else {
      logDiagnostic("BYPASSED_NO_SECRET_CONFIGURED", 200);
    }

    // 3. Consult payment status directly from Mercado Pago API using Access Token
    const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
    const hasMP = !!process.env.MP_ACCESS_TOKEN && mpPayment;
    let paymentIsApproved = false;
    let mpStatus = "unknown";
    let mpPaymentInfo: any = null;

    if (String(paymentId).startsWith("SIM_")) {
      if (isProduction) {
        console.warn(`⚠️ [WEBHOOK_PAYMENT_FLOW] Simulated payment ID (${paymentId}) rejected in production environment!`);
        paymentIsApproved = false;
      } else {
        paymentIsApproved = true;
        mpStatus = "approved";
        console.log("🧪 [WEBHOOK_PAYMENT_FLOW] Processing SIMULATED payment approval (non-production)!");
      }
    } else if (hasMP) {
      try {
        mpPaymentInfo = await mpPayment.get({ id: Number(paymentId) });
        mpStatus = mpPaymentInfo?.status || "unknown";
        console.log(`[WEBHOOK_PAYMENT_FLOW] Mercado Pago API status check: paymentId=${paymentId}, mpStatus=${mpStatus}`);
        if (mpPaymentInfo && mpPaymentInfo.status === "approved") {
          paymentIsApproved = true;
        }
      } catch (mpErr: any) {
        console.error(`❌ [WEBHOOK_PAYMENT_FLOW] Error fetching payment info for paymentId=${paymentId}:`, mpErr?.message || mpErr);
        return res.status(500).json({ error: "Error verifying payment with Mercado Pago API." });
      }
    } else {
      console.warn(`⚠️ [WEBHOOK_PAYMENT_FLOW] No MP_ACCESS_TOKEN configured to verify payment ID: ${paymentId}`);
    }

    if (!paymentIsApproved) {
      console.log(`ℹ️ [WEBHOOK_PAYMENT_FLOW] Payment paymentId=${paymentId} is not approved (status=${mpStatus}). No database changes made.`);
      return res.status(200).json({ status: "ignored", message: `Payment status is ${mpStatus}.` });
    }

    // 4. Efficient direct lookup: paymentId -> orderId (O(1) lookup without full collection scan)
    const db = getAdminFirestore();
    let orderId = "";
    let orderDocSnap: any = null;

    // Step A: Check payments collection direct doc lookup
    try {
      const paymentDocSnap = await db.collection("payments").doc(String(paymentId)).get();
      if (paymentDocSnap.exists) {
        const pData = paymentDocSnap.data();
        if (pData && pData.orderId) {
          orderId = pData.orderId;
          const oSnap = await db.collection("orders").doc(orderId).get();
          if (oSnap.exists) {
            orderDocSnap = oSnap;
          }
        }
      }
    } catch (payLookErr: any) {
      console.warn(`⚠️ [WEBHOOK_PAYMENT_FLOW] Direct payment doc lookup warning for paymentId=${paymentId}:`, payLookErr?.message || payLookErr);
    }

    // Step B: Fallback to MP payment info metadata
    if (!orderDocSnap && mpPaymentInfo && mpPaymentInfo.metadata) {
      const metaOrderId = mpPaymentInfo.metadata.order_id || mpPaymentInfo.metadata.orderId;
      if (metaOrderId) {
        try {
          const oSnap = await db.collection("orders").doc(metaOrderId).get();
          if (oSnap.exists) {
            orderDocSnap = oSnap;
            orderId = metaOrderId;
          }
        } catch (metaLookErr: any) {
          console.warn(`⚠️ [WEBHOOK_PAYMENT_FLOW] Metadata order lookup warning for metaOrderId=${metaOrderId}:`, metaLookErr?.message || metaLookErr);
        }
      }
    }

    // Step C: Fallback to orders collection query limit 1
    if (!orderDocSnap) {
      try {
        const q = db.collection("orders").where("paymentId", "==", String(paymentId)).limit(1);
        const querySnapshot = await q.get();
        if (!querySnapshot.empty) {
          orderDocSnap = querySnapshot.docs[0];
          orderId = orderDocSnap.id;
        }
      } catch (qErr: any) {
        console.error(`❌ [WEBHOOK_PAYMENT_FLOW] Firestore query error for paymentId=${paymentId}:`, qErr?.message || qErr);
        return res.status(500).json({ error: "Firestore query failed" });
      }
    }

    if (!orderDocSnap || !orderDocSnap.exists) {
      console.warn(`⚠️ [WEBHOOK_PAYMENT_FLOW] No order found matching paymentId=${paymentId}`);
      return res.status(200).json({ status: "ignored", message: "Order not found." });
    }

    console.log(`[WEBHOOK_PAYMENT_FLOW] Order located: orderId=${orderId} for paymentId=${paymentId}`);

    const currentNow = Date.now();
    let transactionSuccess = false;
    let paymentConfirmedEvent = false;
    let needsPromoAllocation = false;
    let orderDataSnapshot: any = orderDocSnap.data();

    try {
      await db.runTransaction(async (transaction: any) => {
        const orderRef = db.collection("orders").doc(orderId);
        const reservationRef = db.collection("reservations").doc(orderId);
        const paymentRef = db.collection("payments").doc(String(paymentId));

        const currentOrderSnap = await transaction.get(orderRef);
        if (!currentOrderSnap.exists) {
          throw new Error("ORDER_NOT_FOUND");
        }

        const order = currentOrderSnap.data();
        orderDataSnapshot = order;
        const statusClean = (order.status || "").toLowerCase();

        console.log(`[WEBHOOK_PAYMENT_FLOW] Processing stage: transaction start for orderId=${orderId}, status=${statusClean}`);

        // IDEMPOTENCY GUARD: If order is already PAID, skip gracefully
        if (statusClean === "pago" || statusClean === "paid" || statusClean === "approved") {
          console.log(`ℹ️ [WEBHOOK_PAYMENT_FLOW] [WEBHOOK_IDEMPOTENCY] Order ${orderId} is already PAID. Skipping duplicate processing.`);
          throw new Error("ALREADY_PROCESSED");
        }

        // GUARD AGAINST OVERWRITING CANCELLED / EXPIRED ORDERS
        if (statusClean === "cancelado" || statusClean === "canceled" || statusClean === "expired" || statusClean === "payment_after_expiration") {
          console.warn(`⚠️ [WEBHOOK_PAYMENT_FLOW] Late payment received for order ${orderId} (status=${order.status}). Updating late payment status.`);
          transaction.update(orderRef, {
            receivedLatePayment: true,
            latePaymentStatus: "approved_after_cancellation",
            approvedAt: new Date().toISOString(),
          });
          transaction.set(paymentRef, {
            id: String(paymentId),
            orderId: orderId,
            status: "approved_after_cancellation",
            amount: Number(order.val || 0),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          throw new Error("CANCELLED_OR_EXPIRED");
        }

        const orderNums: string[] = order.nums || [];
        const orderRaffleId = order.raffleId || "current";

        // Collision check inside transaction
        let hasCollision = false;
        const conflictingDocs: string[] = [];
        const numRefs = orderNums.map((num: string) => db.collection("raffles").doc(orderRaffleId).collection("numbers").doc(num));
        const numSnaps = await Promise.all(numRefs.map((ref: any) => transaction.get(ref)));

        for (let i = 0; i < orderNums.length; i++) {
          const numSnap = numSnaps[i];
          if (numSnap.exists) {
            const numData = numSnap.data();
            if (numData && numData.orderId !== orderId) {
              const st = (numData.status || "").toLowerCase().trim();
              const isPaidStatus = st === "paid" || st === "pago" || st === "approved";
              const isReservedStatus = st === "reserved" || st === "pending_payment" || st === "aguardando";
              if (isPaidStatus || (isReservedStatus && (!numData.expiresAt || numData.expiresAt > currentNow))) {
                hasCollision = true;
                conflictingDocs.push(`Número ${orderNums[i]} (Pedido ${numData.orderId})`);
              }
            }
          }
        }

        if (hasCollision) {
          console.warn(`⚠️ [WEBHOOK_PAYMENT_FLOW] Collision detected for order ${orderId}: ${conflictingDocs.join("; ")}`);
          transaction.update(orderRef, {
            status: "Cancelado",
            paymentCollisionError: true,
            paymentCollisionReason: `Pagamento recebido com conflito: ${conflictingDocs.join("; ")}`,
            receivedLatePayment: true,
          });
          throw new Error("COLLISION");
        }

        // SUCCESSFUL PAYMENT: Mark order & cotas as PAID
        transaction.update(orderRef, { status: "Pago", approvedAt: new Date().toISOString() });
        transaction.set(reservationRef, { status: "Pago", approvedAt: new Date().toISOString() }, { merge: true });
        transaction.set(paymentRef, {
          id: String(paymentId),
          orderId: orderId,
          status: "approved",
          amount: Number(order.val || 0),
          createdAt: order.createdAt || new Date().toISOString(),
          approvedAt: new Date().toISOString(),
        }, { merge: true });

        const bonusNumsSet = new Set<string>(order.bonusNums || []);
        if (bonusNumsSet.size > 0) {
          console.log(`[WEBHOOK_PAYMENT_FLOW] Cotas update: orderId=${orderId}, bonusNums=${Array.from(bonusNumsSet).join(", ")}`);
        }
        let mainPaidCount = 0;

        for (let i = 0; i < orderNums.length; i++) {
          const isBonus = bonusNumsSet.has(orderNums[i]);
          transaction.set(numRefs[i], {
            id: orderNums[i],
            status: "paid",
            orderId: orderId,
            name: order.name,
            phone: order.phone,
            isBonus: isBonus,
            updatedAt: new Date().toISOString(),
          });
          if (!isBonus) {
            mainPaidCount++;
          }
        }

        // Atomically increment soldCount on raffle
        const raffleRef = db.collection("raffles").doc(orderRaffleId);
        transaction.update(raffleRef, {
          soldCount: admin.firestore.FieldValue.increment(mainPaidCount),
        });

        paymentConfirmedEvent = true;
        needsPromoAllocation = true;
      });

      transactionSuccess = true;
      console.log(`[WEBHOOK_PAYMENT_FLOW] Transaction update result: orderId=${orderId}, status updated to Pago`);
    } catch (error: any) {
      if (error.message === "ALREADY_PROCESSED") {
        console.log(`[WEBHOOK_PAYMENT_FLOW] [WEBHOOK_IDEMPOTENCY] Order ${orderId} already processed as PAID. Returning HTTP 200.`);
        return res.status(200).json({ status: "already_processed", orderId, paymentId });
      } else if (
        error.message === "CANCELLED_OR_EXPIRED" ||
        error.message === "COLLISION" ||
        error.message === "ORDER_NOT_FOUND"
      ) {
        console.log(`[WEBHOOK_PAYMENT_FLOW] Processing completed with status: ${error.message} for orderId=${orderId}`);
        return res.status(200).json({ status: "acknowledged", reason: error.message, orderId });
      } else {
        console.error(`❌ [WEBHOOK_PAYMENT_FLOW] Firestore transaction error for order ${orderId}:`, error?.message || error);
        return res.status(500).json({ error: "Firestore transaction failed" });
      }
    }

    if (transactionSuccess && needsPromoAllocation) {
      try {
        const batch = db.batch();
        await allocatePromotionalBonus(db, orderId, orderDataSnapshot, batch, orderDataSnapshot.raffleId || "current");
        await batch.commit();
        console.log(`[WEBHOOK_PAYMENT_FLOW] Promotional bonus result: checked and allocated for order ${orderId}`);
      } catch (bonusErr: any) {
        console.error(`❌ [WEBHOOK_PAYMENT_FLOW] Bonus allocation error for order ${orderId}:`, bonusErr?.message || bonusErr);
      }
    }

    if (paymentConfirmedEvent && orderDataSnapshot) {
      console.log(`[WEBHOOK_PAYMENT_FLOW] Payment confirmed event triggered for orderId=${orderId}, paymentId=${paymentId}`);
      console.log(`[PAYMENT_APPROVED] orderId: ${orderId}, paymentId: ${paymentId}`);
      console.log(`[ORDER_PAID] orderId: ${orderId}`);

      serverSupabaseSync.syncConfirmedPayment({
        orderId,
        raffleId: orderDataSnapshot.raffleId || "current",
        customerName: orderDataSnapshot.name || "",
        customerPhone: orderDataSnapshot.phone || "",
        amount: Number(orderDataSnapshot.val || 0),
        paymentId: String(paymentId),
        numsCount: (orderDataSnapshot.nums || []).length,
      }).catch(() => {});
    }

    console.log(`[WEBHOOK_PAYMENT_FLOW] Completed processing paymentId=${paymentId} for orderId=${orderId}. Returning HTTP 200.`);
    return res.status(200).json({ status: "success", orderId, paymentId });
  } catch (err: any) {
    console.error("❌ [WEBHOOK_PAYMENT_FLOW] Unhandled exception in webhook handler:", err?.message || err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
