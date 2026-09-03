import "dotenv/config";
import { isAdminInitialized } from "./_firebaseAdmin.js";
import path from "path";
import fs from "fs";
import { auditService } from "../src/services/supabase/auditService.js";
import { purchaseHistoryService } from "../src/services/supabase/purchaseHistoryService.js";
import { drawService } from "../src/services/supabase/drawService.js";
import { notificationService } from "../src/services/supabase/notificationService.js";
import { activityService } from "../src/services/supabase/activityService.js";

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
    db: isAdminInitialized(),
    mp: !!process.env.MP_ACCESS_TOKEN
  });
}
