import "dotenv/config";
import { getAdminFirestore } from "./_firebaseAdmin.js";
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

    // 1. Process order cancellation inside an ATOMIC TRANSACTION
    if (orderId) {
      let cancelError: string | null = null;

      try {
        await db.runTransaction(async (transaction: any) => {
          const orderRef = db.collection("orders").doc(orderId);
          const reservationRef = db.collection("reservations").doc(orderId);

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

          // Cancel order & reservation
          transaction.update(orderRef, { status: "Cancelado", canceledAt: nowIso });
          transaction.update(reservationRef, { status: "Cancelado", canceledAt: nowIso });

          const orderNums: string[] = orderData?.nums || [];
          const orderRaffleId = orderData?.raffleId || targetRaffleId;

          // Delete numbers associated with this order IF NOT PAID
          for (const num of orderNums) {
            const numRef = db.collection("raffles").doc(orderRaffleId).collection("numbers").doc(num);
            const numSnap = await transaction.get(numRef);
            if (numSnap.exists) {
              const numData = numSnap.data();
              const nStatus = (numData?.status || "").toLowerCase();
              if (
                nStatus !== "paid" &&
                nStatus !== "pago" &&
                (numData?.orderId === orderId || (sessionId && numData?.sessionId === sessionId))
              ) {
                transaction.delete(numRef);
              }
            }

            const lockRef = db.collection("locks").doc(num);
            const lockSnap = await transaction.get(lockRef);
            if (lockSnap.exists) {
              const lockData = lockSnap.data();
              if (lockData?.sessionId === sessionId || lockData?.orderId === orderId) {
                transaction.delete(lockRef);
              }
            }
          }
        });

        console.log(`[ORDER_CANCELLED] orderId: ${orderId}, sessionId: ${sessionId || "N/A"}`);
        console.log(`[LOCK_RELEASED] Locks released for order ${orderId}`);
      } catch (txErr: any) {
        if (cancelError) {
          return res.status(400).json({ error: cancelError });
        }
        console.error(`❌ [CancelOrder Transaction] Error processing order ${orderId}:`, txErr);
      }
    }

    // 2. Process additional sessionId locks cleanup if provided
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
