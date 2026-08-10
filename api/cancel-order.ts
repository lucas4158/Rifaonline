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
    const now = new Date().toISOString();
    const promises: Promise<any>[] = [];

    // 1. Process orderId if provided
    if (orderId) {
      const orderRef = db.collection("orders").doc(orderId);
      const reservationRef = db.collection("reservations").doc(orderId);

      const orderSnap = await orderRef.get();
      if (orderSnap.exists) {
        const orderData = orderSnap.data();
        const statusLower = (orderData?.status || "").toLowerCase();
        
        // NEVER cancel paid orders
        if (
          statusLower === "pago" || 
          statusLower === "paid" || 
          statusLower === "confirmed" || 
          statusLower === "approved"
        ) {
          return res.status(400).json({ error: "Este pedido já está pago e confirmado. Não pode ser cancelado." });
        }

        const realPayId = orderData?.paymentId;
        if (realPayId && !String(realPayId).startsWith("SIM_") && process.env.MP_ACCESS_TOKEN && mpPayment) {
          try {
            await mpPayment.cancel({ id: Number(realPayId) });
          } catch (mpErr: any) {
            console.error(`❌ [CancelOrder MP Cancel] Failed payment cancel ${realPayId}:`, mpErr?.message || mpErr);
          }
        }

        promises.push(
          orderRef.update({ status: "Cancelado", canceledAt: now }).catch(() => {})
        );
        promises.push(
          reservationRef.update({ status: "Cancelado", canceledAt: now }).catch(() => {})
        );

        const orderNums: string[] = orderData?.nums || [];
        const orderRaffleId = orderData?.raffleId || targetRaffleId;

        orderNums.forEach((num: string) => {
          const numDocRef = db.collection("raffles").doc(orderRaffleId).collection("numbers").doc(num);
          promises.push(
            numDocRef.get().then((numSnap) => {
              if (numSnap.exists) {
                const data = numSnap.data();
                if (data?.orderId === orderId || (sessionId && data?.sessionId === sessionId)) {
                  const status = (data?.status || "").toLowerCase();
                  if (status !== "paid" && status !== "pago") {
                    return numDocRef.delete();
                  }
                }
              }
            }).catch(() => {})
          );

          const lockDocRef = db.collection("locks").doc(num);
          promises.push(
            lockDocRef.get().then((lockSnap) => {
              if (lockSnap.exists) {
                const lData = lockSnap.data();
                if (lData?.sessionId === sessionId || lData?.orderId === orderId) {
                  return lockDocRef.delete();
                }
              }
            }).catch(() => {})
          );
        });
      }
    }

    // 2. Process sessionId if provided (e.g., clearing locks without orderId or before order creation)
    if (sessionId) {
      try {
        const pendingOrdersSnap = await db
          .collection("orders")
          .where("sessionId", "==", sessionId)
          .get();

        pendingOrdersSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const st = (d.status || "").toLowerCase();
          if (st !== "pago" && st !== "paid" && st !== "confirmed" && st !== "approved") {
            promises.push(docSnap.ref.update({ status: "Cancelado", canceledAt: now }).catch(() => {}));
          }
        });
      } catch (e) {
        console.warn("⚠️ Failed to query orders by sessionId during cancel-order:", e);
      }

      try {
        const locksSnap = await db
          .collection("locks")
          .where("sessionId", "==", sessionId)
          .get();

        locksSnap.forEach((docSnap) => {
          const num = docSnap.id;
          promises.push(docSnap.ref.delete().catch(() => {}));

          const numRef = db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num);
          promises.push(
            numRef.get().then((numSnap) => {
              if (numSnap.exists) {
                const d = numSnap.data();
                const st = (d.status || "").toLowerCase();
                if (st !== "pago" && st !== "paid") {
                  return numRef.delete();
                }
              }
            }).catch(() => {})
          );
        });
      } catch (e) {
        console.warn("⚠️ Failed to query locks by sessionId during cancel-order:", e);
      }
    }

    await Promise.all(promises);
    return res.status(200).json({ success: true, message: "Cancelamento concluído e cotas liberadas com sucesso." });
  } catch (error: any) {
    console.error("❌ [CancelOrder API] Internal error:", error);
    return res.status(500).json({ error: "Falha ao cancelar pedido e liberar cotas." });
  }
}
