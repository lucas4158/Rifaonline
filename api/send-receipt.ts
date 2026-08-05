import "dotenv/config";
import path from "path";
import fs from "fs";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, setLogLevel } from "firebase/firestore";

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
  console.error("❌ [Firebase Receipt] Init error:", err);
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

  const { orderId, name, phone, nums, totalAmount, status } = req.body;

  if (!orderId || !name || !phone || !nums || !Array.isArray(nums)) {
    return res.status(400).json({ error: "Dados incompletos para envio do comprovante." });
  }

  console.log(`📠 [Receipt API] Received receipt for Order ID: ${orderId} (Client: ${name})`);

  // Write receipt details to a central Firestore receipts collection for tracking
  if (db) {
    try {
      await setDoc(doc(db, "receipts", orderId), {
        orderId,
        name,
        phone,
        nums,
        totalAmount: Number(totalAmount || 0),
        status: status || "Pago",
        submittedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`✅ [Receipt API] Successfully logged receipt ${orderId} in Firestore.`);
    } catch (dbErr: any) {
      console.error(`❌ [Receipt API] Failed to log receipt ${orderId} in Firestore:`, dbErr.message || dbErr);
    }
  }

  // If a generic receipt webhook is defined in the environment, trigger a notification
  const extWebhookUrl = process.env.RECEIPT_WEBHOOK_URL;
  if (extWebhookUrl && extWebhookUrl.startsWith("http")) {
    try {
      console.log(`📤 [Receipt API] Sending webhook notification to: ${extWebhookUrl}`);
      const webRes = await fetch(extWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "receipt_submitted",
          orderId,
          name,
          phone,
          nums,
          totalAmount: Number(totalAmount || 0),
          status: status || "Pago",
          timestamp: new Date().toISOString()
        })
      });
      console.log(`📤 [Receipt API] Webhook returned status: ${webRes.status}`);
    } catch (webErr: any) {
      console.error(`❌ [Receipt API] Failed to forward webhook:`, webErr.message || webErr);
    }
  }

  return res.status(200).json({
    success: true,
    message: "Comprovante enviado com sucesso para o administrador!"
  });
}
