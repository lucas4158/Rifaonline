import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, collection, getDocs, deleteDoc, writeBatch, setLogLevel } from "firebase/firestore";
import { MercadoPagoConfig, Payment } from "mercadopago";

// Initialize Mercado Pago
let mpPayment: any = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    mpPayment = new Payment(mpClient);
  } catch (err) {
    console.error("❌ [Mercado Pago Server Cleanup] Init error:", err);
  }
}

setLogLevel("silent");

// Suppress benign Firestore BloomFilter errors/warnings in the backend
const originalConsoleError = console.error;
const suppressKeywords = ["BloomFilter", "BloomFilterError", "Invalid hash count"];
console.error = function (...args: any[]) {
  const message = args.map(arg => {
    try {
      return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
    } catch (e) {
      return String(arg);
    }
  }).join(" ");
  
  if (suppressKeywords.some(kw => message.includes(kw))) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args: any[]) {
  const message = args.map(arg => {
    try {
      return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
    } catch (e) {
      return String(arg);
    }
  }).join(" ");
  
  if (suppressKeywords.some(kw => message.includes(kw))) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Import API handlers directly to keep routing 100% unified and eliminate duplication!
import { getAdminFirestore } from "./api/_firebaseAdmin.js";
import createPixHandler from "./api/create-pix";
import webhookHandler from "./api/webhook";
import simulateWebhookHandler from "./api/simulate-webhook";
import adminActionHandler from "./api/admin-action";
import sendReceiptHandler from "./api/send-receipt";
import lockCotaHandler from "./api/lock-cota";
import cancelOrderHandler from "./api/cancel-order";
import adminLogoutHandler from "./api/admin-logout";
import adminSessionHandler from "./api/admin-session";

// Initialize Server App
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Expired Reservation & Lock Cleanup Routine (Server-side background worker using Admin SDK)
let backgroundCleanupPausedUntil = 0;

async function runBackgroundCleanup() {
  if (Date.now() < backgroundCleanupPausedUntil) {
    return;
  }

  let adminDb: any;
  try {
    adminDb = getAdminFirestore();
  } catch (err) {
    return;
  }

  const now = Date.now();
  try {
    // 1. Clean expired locks (pre-selections on landing page)
    const locksSnap = await adminDb.collection("locks").get();
    const locksToDelete: string[] = [];
    locksSnap.forEach((docSnap: any) => {
      const data = docSnap.data();
      if (data && data.expiresAt && data.expiresAt <= now) {
        locksToDelete.push(docSnap.id);
      }
    });

    if (locksToDelete.length > 0) {
      console.log(`🧹 [Server Worker] Cleaning up ${locksToDelete.length} expired locks:`, locksToDelete);
      for (const id of locksToDelete) {
        try {
          await adminDb.collection("locks").doc(id).delete();
        } catch (e) {
          console.error(`❌ [Server Worker] Failed to delete lock doc ${id}:`, e);
        }
      }
    }

    // 2. Clean expired reservations or orders (pending payment beyond 10 minute limit OR already cancelled in orders)
    const resSnap = await adminDb.collection("reservations").get();
    const expiredOrders: { id: string; nums: string[]; paymentId?: string }[] = [];

    for (const docSnap of resSnap.docs) {
      const data = docSnap.data();
      if (
        data &&
        (data.status === "pending_payment" || data.status === "Aguardando")
      ) {
        const isExpired = data.expiresAt && data.expiresAt <= now;
        let isCancelledInOrders = false;
        let paymentId = data.paymentId; // Sometimes it's in reservation
        
        // Absolute check: If status is paid/pago/confirmed on either reservation or order, NEVER expire/cancel it
        let isActuallyPaid = false;
        const resStatusLower = (data.status || "").toLowerCase();
        if (
          resStatusLower === "paid" || 
          resStatusLower === "pago" || 
          resStatusLower === "approved" || 
          resStatusLower === "confirmed"
        ) {
          isActuallyPaid = true;
        }

        // Check if the order has been cancelled on the client-side
        try {
          const orderSnap = await adminDb.collection("orders").doc(docSnap.id).get();
          if (orderSnap.exists) {
            const orderData = orderSnap.data();
            if (!paymentId && orderData?.paymentId) paymentId = orderData.paymentId;
            const orderStatusLower = (orderData?.status || "").toLowerCase();
            if (
              orderStatusLower === "paid" || 
              orderStatusLower === "pago" || 
              orderStatusLower === "approved" || 
              orderStatusLower === "confirmed"
            ) {
              isActuallyPaid = true;
            }
            if (
              orderData &&
              (orderData.status === "Cancelado" || orderData.status === "canceled")
            ) {
              isCancelledInOrders = true;
            }
          }
        } catch (err) {
          console.error(`❌ [Server Worker] Error looking up order for reservation ${docSnap.id}:`, err);
        }

        if (isActuallyPaid) {
          console.log(`[PAID_QUOTA_PROTECTED] [RESERVATION_RELEASE_BLOCKED] Skipping timeout/cancellation for order ${docSnap.id} because it is PAID/CONFIRMED.`);
          continue;
        }

        if (isExpired || isCancelledInOrders) {
          expiredOrders.push({ id: docSnap.id, nums: data.nums || [], paymentId });
        }
      }
    }

    if (expiredOrders.length > 0) {
      console.log(`🧹 [Server Worker - v2.4] Found ${expiredOrders.length} expired pending/canceled reservations. Releasing quotas:`, expiredOrders.map(o => o.id));
      for (const order of expiredOrders) {
        const orderId = order.id;
        const nums = order.nums;
        const batch = adminDb.batch();

        // Cancel Mercado Pago payment if exists and config is valid
        if (order.paymentId && mpPayment && !String(order.paymentId).startsWith("SIM_")) {
          try {
            await mpPayment.cancel({ id: Number(order.paymentId) });
            console.log(`[Mercado Pago Server Cleanup] Successfully cancelled MP payment ${order.paymentId} for order ${orderId}`);
          } catch (mpErr: any) {
            if (mpErr.status !== 400 && mpErr.status !== 404) {
               console.error(`❌ [Mercado Pago Server Cleanup] Error cancelling MP Payment ${order.paymentId}:`, mpErr);
            }
          }
        }

        // A) Delete numbers from /raffles/current/numbers ONLY if they belong to this order and are NOT paid
        for (const num of nums) {
          try {
            const numDocRef = adminDb.collection("raffles").doc("current").collection("numbers").doc(num);
            const numSnap = await numDocRef.get();
            if (numSnap.exists) {
              const numData = numSnap.data();
              if (
                numData &&
                numData.orderId === orderId &&
                numData.status !== "paid" &&
                numData.status !== "Pago"
              ) {
                batch.delete(numDocRef);
                console.log(`🔥 [Server Worker] Queueing deletion of number lock ${num} (orderId matches ${orderId} and is not paid)`);
              } else {
                console.log(`🛡️ [Server Worker] [PAID_QUOTA_PROTECTED] Protected number ${num}! It is paid or belongs to another order now:`, numData);
              }
            }
          } catch (e) {
            console.error(`❌ [Server Worker] Failed to assert/prepare number ${num} release:`, e);
          }
        }

        // B) Update status to Cancelado in orders & reservations
        batch.update(adminDb.collection("reservations").doc(orderId), {
          status: "Cancelado",
          canceledAt: new Date().toISOString()
        });

        batch.update(adminDb.collection("orders").doc(orderId), {
          status: "Cancelado",
          canceledAt: new Date().toISOString()
        });

        try {
          await batch.commit();
          console.log(`[PIX_EXPIRED] Order ${orderId} has expired automatically in background cleanup.`);
          console.log(`🔥 [Server Worker] Successfully processed expiration cleanup for reservation ${orderId} and released its authorized locks.`);
        } catch (e) {
          console.error(`❌ [Server Worker] Failed to atomic-cancel reservation ${orderId}:`, e);
        }
      }
    }
  } catch (err: any) {
    const errStr = String(err);
    if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded") || err?.code === 8) {
      console.warn("⚠️ [Server Worker] Firestore daily quota reached (RESOURCE_EXHAUSTED). Pausing background cleanup routine for 10 minutes.");
      backgroundCleanupPausedUntil = Date.now() + 10 * 60 * 1000;
    } else {
      console.error("❌ [Server Worker] Error during background cleanup routine execution:", err);
    }
  }
}

// Run cleanup immediately on boot, then every 30 seconds
runBackgroundCleanup();
setInterval(() => {
  runBackgroundCleanup().catch((e) => {
    const errStr = String(e);
    if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded")) {
      console.warn("⚠️ [Server Worker] Background cleanup paused due to quota limits.");
      backgroundCleanupPausedUntil = Date.now() + 10 * 60 * 1000;
    } else {
      console.error("Error running background cleanup:", e);
    }
  });
}, 30000);

// API ROUTES
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Map serverless handlers directly as standard Express middleware routes!
app.post("/api/create-pix", createPixHandler);
app.post("/api/webhook", webhookHandler);
app.post("/api/simulate-webhook", simulateWebhookHandler);
app.post("/api/admin-action", adminActionHandler);
app.post("/api/send-receipt", sendReceiptHandler);
app.post("/api/lock-cota", lockCotaHandler);
app.post("/api/cancel-order", cancelOrderHandler);
app.post("/api/admin-logout", adminLogoutHandler);
app.use("/api/admin-session", adminSessionHandler);

// VITE OR STATIC SERVING MIDDLEWARE (Only run if NOT on Vercel serverless)
if (process.env.VERCEL !== "1") {
  if (process.env.NODE_ENV !== "production") {
    console.log("⚙️  [Vite] Initializing development middleware mode...");
    const startVite = async () => {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
      
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`💻 [Vite Dev Server] Standing by on URL: http://localhost:${PORT}`);
      });
    };
    startVite();
  } else {
    console.log("🚀 [Production] Serving static distribution files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🌐 [Production App Server] Online on port ${PORT}`);
    });
  }
}

export default app;
