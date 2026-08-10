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

  // Route test-supabase request
  if (req.query?.action === "test-supabase" || (req.url && req.url.includes("test-supabase"))) {
    const testOrderId = `test_${Date.now()}`;
    const results = {
      timestamp: new Date().toISOString(),
      env: {
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL ? "Configured" : "Missing",
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      tests: {
        auditLog: false,
        purchaseHistory: false,
        draws: false,
        adminNotifications: false,
        activityLog: false,
      },
      errors: {} as Record<string, string>,
    };

    try {
      results.tests.auditLog = await auditService.logEvent({
        raffle_id: "test_raffle",
        event_type: "connection_test",
        actor_name: "Diagnostic Endpoint",
        metadata: { testId: testOrderId },
      });
    } catch (err: any) {
      results.errors.auditLog = err?.message || String(err);
    }

    try {
      results.tests.purchaseHistory = await purchaseHistoryService.recordPurchase({
        firestore_order_id: testOrderId,
        raffle_id: "test_raffle",
        customer_name: "Cliente Teste RifaMaster",
        customer_phone: "11999999999",
        amount: 15.00,
        payment_status: "approved",
      });
    } catch (err: any) {
      results.errors.purchaseHistory = err?.message || String(err);
    }

    try {
      results.tests.draws = await drawService.recordDraw({
        firestore_draw_id: `draw_${testOrderId}`,
        raffle_id: "test_raffle",
        status: "completed",
        winner_number: "00042",
        seed: "test_sha256_seed_123",
      });
    } catch (err: any) {
      results.errors.draws = err?.message || String(err);
    }

    try {
      results.tests.adminNotifications = await notificationService.recordNotification({
        firestore_event_id: `event_${testOrderId}`,
        type: "test_notification",
        title: "Notificação de Teste",
        customer_name: "Cliente Teste RifaMaster",
        amount: 15.00,
        raffle_id: "test_raffle",
      });
    } catch (err: any) {
      results.errors.adminNotifications = err?.message || String(err);
    }

    try {
      results.tests.activityLog = await activityService.logActivity({
        raffle_id: "test_raffle",
        activity_type: "test_activity",
        description: "Teste de gravação no Supabase via RifaMaster",
      });
    } catch (err: any) {
      results.errors.activityLog = err?.message || String(err);
    }

    const allPassed = Object.values(results.tests).every(Boolean);

    return res.status(200).json({
      status: allPassed ? "success" : "schema_missing_or_error",
      allPassed,
      details: results,
      instructions: allPassed
        ? "Supabase está gravando com sucesso!"
        : "As credenciais do Supabase foram encontradas e a conexão funciona, porém as tabelas ainda não foram criadas no Supabase. Execute o script 'supabase/migrations/001_initial_schema.sql' no SQL Editor do Supabase.",
    });
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
