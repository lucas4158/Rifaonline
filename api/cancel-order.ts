import "dotenv/config";
import path from "path";
import fs from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  updateDoc,
  getDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import { MercadoPagoConfig, Payment } from "mercadopago";

let db: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("👮 [CancelOrder API] Firebase initialized successfully.");
  }
} catch (err) {
  console.error("❌ [CancelOrder API] Firebase init error:", err);
}

// Initialize Mercado Pago Client
let mpPayment: any = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    mpPayment = new Payment(mpClient);
    console.log("💼 [CancelOrder API] MercadoPago Initialized successfully.");
  } catch (err) {
    console.error("❌ [CancelOrder API Mercado Pago] Init error:", err);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!db) {
    return res.status(500).json({ error: "Banco de dados não configurado." });
  }

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId" });
  }

  try {
    console.log(`[BACKEND_FIRESTORE_WRITE] Cancelling order ${orderId}...`);

    const orderRef = doc(db, "orders", orderId);
    const reservationRef = doc(db, "reservations", orderId);

    // 1. Fetch order details to protect paid quotas
    const orderSnap = await getDoc(orderRef);
    let orderNums: string[] = [];
    const orderExists = orderSnap.exists();

    if (orderExists) {
      const orderData = orderSnap.data();
      const statusLower = (orderData?.status || "").toLowerCase();
      if (
        statusLower === "pago" || 
        statusLower === "paid" || 
        statusLower === "confirmed" || 
        statusLower === "approved"
      ) {
        console.warn(`[RESERVATION_RELEASE_BLOCKED] [PAID_QUOTA_PROTECTED] Blocked cancellation request for paid order ${orderId}.`);
        return res.status(400).json({ error: "Este pedido já está pago e confirmado. Não pode ser cancelado." });
      }
      orderNums = orderData?.nums || [];

      // Cancel on Mercado Pago synchronously or background with logs to make Pix key invalid
      const realPayId = orderData?.paymentId;
      if (realPayId && !String(realPayId).startsWith("SIM_") && process.env.MP_ACCESS_TOKEN && mpPayment) {
        try {
          console.log(`⏳ [CancelOrder API MP Cancel] Attempting to invalidate/cancel payment ${realPayId} on Mercado Pago...`);
          await mpPayment.cancel({ id: Number(realPayId) });
          console.log(`✅ [CancelOrder API MP Cancel] Successfully cancelled payment ${realPayId} on Mercado Pago.`);
        } catch (mpErr: any) {
          console.error(`❌ [CancelOrder API MP Cancel] Failed to cancel payment ${realPayId} on MP:`, mpErr?.message || mpErr);
        }
      }
    }

    // 2. Fetch reservation details as well
    const reservationSnap = await getDoc(reservationRef);
    const reservationExists = reservationSnap.exists();

    if (!orderExists && !reservationExists) {
      console.warn(`[RESERVATION_RELEASE_BLOCKED] Neither Order nor Reservation found for ${orderId}. Aborting cancellation.`);
      return res.status(200).json({ success: true, message: "Order already cancelled or not found" });
    }

    const now = new Date().toISOString();
    const promises: Promise<any>[] = [];

    // 3. Resiliently update order document if it exists
    if (orderExists) {
      promises.push(
        updateDoc(orderRef, {
          status: "Cancelado",
          canceledAt: now,
        }).then(() => {
          console.log(`✅ [CancelOrder API] Success updating order status to Cancelado for ${orderId}`);
        }).catch(err => {
          console.error(`❌ [CancelOrder API] Failed to update order status for ${orderId}:`, err);
          throw err;
        })
      );
    }

    // 4. Resiliently update reservation document if it exists
    if (reservationExists) {
      promises.push(
        updateDoc(reservationRef, {
          status: "Cancelado",
          canceledAt: now,
        }).then(() => {
          console.log(`✅ [CancelOrder API] Success updating reservation status to Cancelado for ${orderId}`);
        }).catch(err => {
          console.error(`❌ [CancelOrder API] Failed to update reservation status for ${orderId}:`, err);
          throw err;
        })
      );
    }

    const targetRaffleId = orderSnap.exists() ? (orderSnap.data()?.raffleId || "current") : "current";

    // 5. Only delete assigned numbers if they still belong to this orderId
    orderNums.forEach((num: string) => {
      const numDocRef = doc(db, "raffles", targetRaffleId, "numbers", num);
      promises.push(
        getDoc(numDocRef).then((numSnap) => {
          if (numSnap.exists()) {
            const data = numSnap.data();
            if (data?.orderId === orderId) {
              return deleteDoc(numDocRef).then(() => {
                console.log(`✅ [CancelOrder API] Success deleting number allocation doc for ${num}`);
              });
            } else {
              console.log(`ℹ️ [CancelOrder API] Skipping delete of number ${num} because it belongs to a newer order: ${data?.orderId}`);
            }
          }
        }).catch(err => {
          console.error(`❌ [CancelOrder API] Failed to process status check/delete for number ${num}:`, err);
          // Let it degrade gracefully
        })
      );
    });

    await Promise.all(promises);

    console.log(`[BACKEND_FIRESTORE_SUCCESS] Successfully cancelled order, reservation and released ${orderNums.length} numbers for: ${orderId}`);

    return res.status(200).json({ success: true, message: "Order cancelled successfully and numbers released" });
  } catch (error: any) {
    console.error(`[BACKEND_FIRESTORE_ERROR] Failed to cancel order ${orderId}:`, error);
    return res.status(500).json({ error: "Failed to cancel order" });
  }
}

