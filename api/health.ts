import "dotenv/config";
import path from "path";
import fs from "fs";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, setLogLevel } from "firebase/firestore";

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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    try {
      const bodyData = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const { action, details } = bodyData;
      if (action === "client-log") {
        console.error(`📱 [MOBILE_CLIENT_ERROR] Client-side error telemetry captured:`, JSON.stringify(details, null, 2));
      }
    } catch (parseErr) {
      console.warn("⚠️ [Health Log Parser] Failed parsing telemetry payload:", parseErr);
    }
    return res.status(200).json({ logged: true });
  }

  return res.status(200).json({
    status: "healthy",
    db: !!db,
    mp: !!process.env.MP_ACCESS_TOKEN
  });
}
