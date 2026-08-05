import "dotenv/config";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  runTransaction,
  query,
  where,
  setLogLevel
} from "firebase/firestore";
import { allocatePromotionalBonus } from "./promo-helper.js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getAdminFirestore } from "./_firebaseAdmin.js";

setLogLevel("silent");

// Initialize Firebase
let db: any = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let firebaseConfig: any = {};
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    db = getFirestore(firebaseApp, dbId);
    console.log(`🔒 [Admin Backend] Firebase Client Initialized for project "${firebaseConfig.projectId}" (db: "${dbId}").`);
  } else {
    console.warn("⚠️ [Admin Backend] firebase-applet-config.json not found. Attempting env initialization.");
    if (process.env.FIREBASE_PROJECT_ID) {
      const fallbackConfig = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        apiKey: process.env.FIREBASE_API_KEY || "",
        authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
      };
      const firebaseApp = getApps().length === 0 ? initializeApp(fallbackConfig) : getApp();
      db = getFirestore(firebaseApp, (process.env.FIREBASE_DATABASE_ID && !process.env.FIREBASE_DATABASE_ID.startsWith("ai-studio-")) ? process.env.FIREBASE_DATABASE_ID : "(default)");
      console.log(`🔒 [Admin Backend] Firebase Client Initialized from ENV for project "${process.env.FIREBASE_PROJECT_ID}".`);
    }
  }
} catch (err: any) {
  console.error("❌ [Admin Backend] Firebase init error:", err);
}

// Initialize Mercado Pago Client
let mpPayment: any = null;
if (process.env.MP_ACCESS_TOKEN) {
  try {
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    mpPayment = new Payment(mpClient);
    console.log("💼 [Admin Backend] MercadoPago Initialized for Admin Actions.");
  } catch (err) {
    console.error("❌ [Admin Backend Mercado Pago] Init error:", err);
  }
}

// Helper function to audit, log, compare, and sanitize payloads against firestore.rules expected fields
function auditAndSanitizeDrawPayload(drawId: string, record: any): any {
  return {
    id: String(record.id || drawId).trim().substring(0, 100),
    timestamp: String(record.timestamp || new Date().toISOString()).trim().substring(0, 50),
    prize: String(record.prize || "Prêmio da Rifa").trim().substring(0, 300),
    winnerNumber: String(record.winnerNumber || "").trim().substring(0, 10),
    winnerName: String(record.winnerName || "").trim().substring(0, 200),
    totalParticipants: Number(record.totalParticipants) || 0
  };
}

// Server-side robust bootstrap
async function ensureDefaultConfig() {
  if (!db) return;
  try {
    // Perform safe deduplication of winners_history to clean existing duplicates
    try {
      console.log("🧹 [Server Bootstrap] Running deduplication audit on 'winners_history'...");
      const winnersSnap = await getDocs(collection(db, "winners_history"));
      
      const seenKeys = new Map<string, string>(); // key -> canonical docId
      const docsToDelete: string[] = [];

      winnersSnap.forEach((wDoc) => {
        const data = wDoc.data();
        const raffleId = String(data.raffleId || wDoc.id.replace(/^WIN_/, "").replace(/^WIN_MIGRATED_/, ""));
        const winnerNum = String(data.winnerNumber || "").trim();
        const key = `${raffleId}_${winnerNum}`;

        if (!seenKeys.has(key)) {
          seenKeys.set(key, wDoc.id);
        } else {
          const existingDocId = seenKeys.get(key)!;
          if (wDoc.id.startsWith("WIN_") && !wDoc.id.startsWith("WIN_MIGRATED_") && existingDocId.startsWith("WIN_MIGRATED_")) {
            docsToDelete.push(existingDocId);
            seenKeys.set(key, wDoc.id);
          } else {
            docsToDelete.push(wDoc.id);
          }
        }
      });

      if (docsToDelete.length > 0) {
        console.log(`🧹 [Server Bootstrap] Found ${docsToDelete.length} duplicate winner record(s). Cleaning up...`);
        for (const delId of docsToDelete) {
          await deleteDoc(doc(db, "winners_history", delId));
          try {
            await deleteDoc(doc(db, "draws", delId));
            if (delId.startsWith("WIN_MIGRATED_")) {
              await deleteDoc(doc(db, "draws", delId.replace("WIN_MIGRATED_", "")));
            }
          } catch (_) {}
        }
        console.log(`🧹 [Server Bootstrap] Successfully cleaned up ${docsToDelete.length} duplicate winner document(s).`);
      } else {
        console.log("🧹 [Server Bootstrap] Hall of Fame deduplication audit complete: 0 duplicates found.");
      }
    } catch (migrErr) {
      console.error("❌ [Server Bootstrap] Error during winners_history deduplication:", migrErr);
    }
  } catch (err) {
    console.error("❌ Failed to perform deduplication on Server:", err);
  }
}

if (db) {
  setTimeout(ensureDefaultConfig, 500);
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
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { action } = req.body;
  if (!action) {
    return res.status(400).json({ error: "Missing action in request body" });
  }

  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown IP";
  const userAgent = req.headers["user-agent"] || "Unknown User-Agent";

  // Dynamic initialization safeguard: ensure we call ensureDefaultConfig before handling any requests
  if (db) {
    await ensureDefaultConfig();
  }

  // 1. Handle Login action (does not need Bearer Authorization)
  if (action === "login") {
    const loginStartTime = Date.now();
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "Password is required for login" });
      }

      console.log(`🔒 [Admin Login Route] Received connection attempt from ${clientIp} (${userAgent})`);

      const getDbStart = Date.now();
      let adminDb: any;
      try {
        adminDb = getAdminFirestore();
        console.log(`⏱️ [Login Perf] getAdminFirestore took ${Date.now() - getDbStart}ms`);
      } catch (dbErr: any) {
        console.error(`❌ [Admin Auth Error] Failed to connect to Admin Firestore (${Date.now() - getDbStart}ms):`, dbErr);
        return res.status(500).json({ error: "Erro de configuração no servidor de autenticação." });
      }

      const ipDocId = String(clientIp).replace(/[^a-zA-Z0-9_\-]/g, "_");
      const securityRef = adminDb.collection("admin_security").doc(ipDocId);

      const readSecStart = Date.now();
      const secSnap = await securityRef.get();
      console.log(`⏱️ [Login Perf] readSecurityDoc took ${Date.now() - readSecStart}ms`);

      if (secSnap.exists) {
        const secData = secSnap.data();
        if (secData && secData.lockedUntil && secData.lockedUntil > Date.now()) {
          const remainingMinutes = Math.ceil((secData.lockedUntil - Date.now()) / 60000);
          console.warn(`🚨 [Admin Auth Lock] IP ${clientIp} is currently locked out for ${remainingMinutes} more minute(s).`);
          return res.status(429).json({
            error: `Acesso bloqueado por muitas tentativas incorretas. Tente novamente em ${remainingMinutes} minuto(s).`
          });
        }
      }

      const configuredPassword = (process.env.ADMIN_PASSWORD || "").trim() || "admin";
      const isPasswordValid = String(password).trim() === configuredPassword;

      if (!isPasswordValid) {
        const currentAttempts = (secSnap.exists ? (secSnap.data()?.attempts || 0) : 0) + 1;
        let lockedUntil = 0;
        if (currentAttempts >= 5) {
          lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lockout
          console.warn(`🚨 [Admin Auth Lock Triggered] IP ${clientIp} reached 5 failed attempts! Locking for 15 minutes.`);
        }

        const writeFailStart = Date.now();
        await securityRef.set({
          attempts: currentAttempts,
          lockedUntil,
          lastAttempt: new Date().toISOString()
        }, { merge: true });
        console.log(`⏱️ [Login Perf] writeFailedAttempt took ${Date.now() - writeFailStart}ms`);

        console.warn(`⚠️ [Admin Auth Failure] Password did not match configured secret. Attempt ${currentAttempts}/5. IP: ${clientIp}`);
        return res.status(401).json({ error: "Senha incorreta!" });
      }

      // Reset attempts on successful login (non-blocking fire-and-forget)
      securityRef.set({
        attempts: 0,
        lockedUntil: 0,
        lastLogin: new Date().toISOString()
      }, { merge: true }).catch((err: any) => {
        console.error("⚠️ [Admin Auth Warning] Failed to reset rate-limit attempts in background:", err);
      });

      const computedLegacyToken = crypto.createHash("sha256").update((process.env.ADMIN_PASSWORD || "admin").trim() + "RifaMasterSaltSecureAudit").digest("hex");
      try {
        await setDoc(doc(db, "admins", "config"), { token: computedLegacyToken }, { merge: true });
        console.log("[ADMIN_TOKEN_SYNC] admins/config.token sincronizado com sucesso.");
      } catch (syncErr) {
        console.error("[ADMIN_TOKEN_SYNC_ERROR] Falha ao sincronizar admins/config.token:", syncErr);
      }

      const token = "SES_" + crypto.randomBytes(32).toString("hex");
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      const writeSessStart = Date.now();
      await adminDb.collection("admin_sessions").doc(token).set({
        token,
        createdAt: new Date().toISOString(),
        expiresAt,
        clientIp
      });
      console.log(`⏱️ [Login Perf] writeSessionDoc took ${Date.now() - writeSessStart}ms`);

      res.setHeader(
        "Set-Cookie",
        `admin_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400;`
      );

      const totalDuration = Date.now() - loginStartTime;
      console.log(`👮 [Admin Auth Success] Admin logged in successfully in ${totalDuration}ms! Generated session token for IP: ${clientIp}`);
      return res.status(200).json({ success: true, token });
    } catch (err: any) {
      console.error("❌ [LOGIN_ACTION_EXCEPTION] Captured unhandled exception during admin login:", err);
      return res.status(500).json({ error: "LOGIN_INTERNAL_ERROR: " + (err?.message || String(err)), stack: err?.stack });
    }
  }

  // 2. Authenticate all other critical administrative actions
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split(" ")[1];

  if (!token || token === "undefined" || token === "null" || token === "") {
    token = undefined;
  }

  // Fallback to cookie-based session token if authorization header is empty
  if (!token && req.headers.cookie) {
    const rawCookies = req.headers.cookie;
    const adminSession = rawCookies
      .split(";")
      .map(c => c.trim().split("="))
      .find(parts => parts[0] === "admin_session");
    if (adminSession) {
      token = adminSession[1];
    }
  }

  if (!token) {
    console.warn(`🚨 [Admin Auth Blocked] Unauthorized action attempt: missing token! Action: '${action}', IP: ${clientIp}`);
    return res.status(401).json({ error: "Não autorizado! Token administrativo ausente." });
  }

  let adminDb: any;
  try {
    adminDb = getAdminFirestore();
  } catch (dbErr: any) {
    console.error("❌ [Admin Auth Error] Failed to connect to Admin Firestore:", dbErr);
    return res.status(500).json({ error: "Erro de configuração no servidor de autenticação." });
  }

  const sessionSnap = await adminDb.collection("admin_sessions").doc(token).get();
  if (!sessionSnap.exists) {
    console.warn(`🚨 [ADMIN_SESSION_INVALID] Session document not found in rifamaster-prod. Action: '${action}', IP: ${clientIp}`);
    return res.status(401).json({ error: "Não autorizado! Sessão administrativa inválida ou expirada." });
  }

  const sessionData = sessionSnap.data();
  if (!sessionData || !sessionData.expiresAt || sessionData.expiresAt <= Date.now()) {
    console.warn(`🚨 [ADMIN_SESSION_EXPIRED] Session document expired in rifamaster-prod. Action: '${action}', IP: ${clientIp}`);
    return res.status(401).json({ error: "Não autorizado! Sessão administrativa expirada." });
  }

  console.log(`🟢 [ADMIN_SESSION_VALID] Action: '${action}' successfully authenticated via Admin SDK. clientIp: ${clientIp}`);

  // Verify token action (simply checks if token is valid)
  if (action === "verify") {
    console.log(`🔑 [Admin Session Verify] Token verified successfully for IP: ${clientIp}`);
    return res.status(200).json({ success: true });
  }

  if (!db) {
    return res.status(500).json({ error: "Database not initialized on server." });
  }

  const computedLegacyToken = crypto.createHash("sha256").update((process.env.ADMIN_PASSWORD || "admin").trim() + "RifaMasterSaltSecureAudit").digest("hex");

  try {
    switch (action) {
      case "save-config": {
        const { config } = req.body;
        if (!config) {
          console.error("[CONFIG_VALIDATION_ERROR] Request payload missing 'config' object");
          return res.status(400).json({ error: "Config body is required" });
        }
        
        console.log("[CONFIG_SAVE_ATTEMPT] Processing save-config action with payload:", JSON.stringify(config));

        // Let's validate, clean and coerce fields
        const cleanedConfig = { ...config };

        // Helper to validate and convert numeric properties in the backend
        const validateAndCoerceNumeric = (fieldName: string, value: any, options: { required?: boolean; min?: number; max?: number; integerOnly?: boolean } = {}) => {
          if (value === undefined || value === null || String(value).trim() === "") {
            if (options.required) {
              const msg = `O campo '${fieldName}' é obrigatório e não pode ficar vazio.`;
              console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Value: ${value}, Expected: Number, Error: ${msg}`);
              throw new Error(msg);
            }
            return null;
          }

          let cleanedVal = String(value).trim().replace(",", ".");
          const parsed = options.integerOnly ? parseInt(cleanedVal, 10) : parseFloat(cleanedVal);

          if (isNaN(parsed) || !/^-?\d+(\.\d+)?$/.test(cleanedVal)) {
            const msg = `O campo '${fieldName}' recebeu um valor inválido: "${value}". Esperava-se um número válido.`;
            console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Value: ${value}, Expected: Number, Error: ${msg}`);
            throw new Error(msg);
          }

          if (options.min !== undefined && parsed < options.min) {
            const msg = `O campo '${fieldName}' deve ser maior ou igual a ${options.min}. Recebeu: ${parsed}`;
            console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Value: ${parsed}, Error: ${msg}`);
            throw new Error(msg);
          }

          if (options.max !== undefined && parsed > options.max) {
            const msg = `O campo '${fieldName}' deve ser menor ou igual a ${options.max}. Recebeu: ${parsed}`;
            console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Value: ${parsed}, Error: ${msg}`);
            throw new Error(msg);
          }

          return parsed;
        };

        try {
          // Mandatory system fields
          cleanedConfig.price = validateAndCoerceNumeric("Preço por cota", config.price, { required: true, min: 0.01 });
          cleanedConfig.totalNumbers = validateAndCoerceNumeric("Total de cotas da rifa", config.totalNumbers, { required: true, min: 1, max: 1000000, integerOnly: true });

          // Optional promotions fields
          if (config.promotionEnabled) {
            cleanedConfig.promotionBuy = validateAndCoerceNumeric("Compre (Quant. X)", config.promotionBuy, { required: true, min: 1, integerOnly: true });
            cleanedConfig.promotionBonus = validateAndCoerceNumeric("Ganhe Bônus (Quant. Y)", config.promotionBonus, { required: true, min: 1, integerOnly: true });
          } else {
            // Ensure they are null or deleted if promotions not enabled to keep schema pristine
            if ('promotionBuy' in cleanedConfig) delete cleanedConfig.promotionBuy;
            if ('promotionBonus' in cleanedConfig) delete cleanedConfig.promotionBonus;
          }

          // Clean up and completely strip planning / calculator simulator fields from config payload
          const calculatorFields = [
            "taxaMP", "custoPremio", "lucroDesejado", 
            "profitGoal", "prizeCost", "feePercentage", 
            "planningData", "simulationResults", "promotionSimulation"
          ];
          calculatorFields.forEach(field => {
            if (field in cleanedConfig) {
              delete cleanedConfig[field];
            }
          });

          // Check for empty string strings in required text config
          if (!config.title || String(config.title).trim() === "") {
            throw new Error("O campo 'Título do Prêmio' é obrigatório.");
          }
          cleanedConfig.title = String(config.title).trim();
          cleanedConfig.description = String(config.description || "").trim();
          cleanedConfig.pixKey = String(config.pixKey || "").trim();
          cleanedConfig.pixReceiver = String(config.pixReceiver || "").trim();
          cleanedConfig.pixBank = String(config.pixBank || "").trim();
          cleanedConfig.pixPhone = String(config.pixPhone || "").trim();
          cleanedConfig.pixKeyType = String(config.pixKeyType || "").trim();
          cleanedConfig.pixBankLogo = String(config.pixBankLogo || "").trim();
          cleanedConfig.winnerNumber = String(config.winnerNumber || "").trim();
          cleanedConfig.winnerName = String(config.winnerName || "").trim();

        } catch (validationErr: any) {
          console.error("[CONFIG_VALIDATION_ERROR] Validation failure details:", validationErr.message || validationErr);
          return res.status(400).json({
            error: validationErr.message || "Erro de validação de dados.",
            validationError: true
          });
        }

        const targetRaffleId = req.body.raffleId || config.id || "current";
        cleanedConfig.id = targetRaffleId;

        // Fetch existing doc to preserve status and active flags if not explicitly provided
        let existingStatus = "ativa";
        let existingIsActive = true;
        let existingIsRaffleActive = true;
        try {
          const existingSnap = await getDoc(doc(db, "raffles", targetRaffleId));
          if (existingSnap.exists()) {
            const ed = existingSnap.data();
            if (ed.status) existingStatus = ed.status;
            if (ed.isActive !== undefined) existingIsActive = ed.isActive;
            if (ed.isRaffleActive !== undefined) existingIsRaffleActive = ed.isRaffleActive;
          }
        } catch (e) {}

        cleanedConfig.status = cleanedConfig.status || existingStatus;
        cleanedConfig.isActive = cleanedConfig.isActive !== undefined ? cleanedConfig.isActive : existingIsActive;
        cleanedConfig.isRaffleActive = cleanedConfig.isRaffleActive !== undefined ? cleanedConfig.isRaffleActive : existingIsRaffleActive;

        console.log("[CONFIG_SAVE_START] Began processing save-config action.");
        const payload = {
          ...cleanedConfig,
          adminToken: computedLegacyToken
        };
        try {
          console.log(`[FIRESTORE_WRITE_START] Saving raffle configurations to path '/raffles/${targetRaffleId}'...`);
          await setDoc(doc(db, "raffles", targetRaffleId), payload, { merge: true });
          console.log(`[FIRESTORE_WRITE_SUCCESS] Saved via Client SDK to '/raffles/${targetRaffleId}'`);

          console.log("[CONFIG_SAVE_SUCCESS] Saved configuration successfully to Firestore.");
          console.log(`[SETTINGS_SAVED] Settings updated successfully! keys: ${Object.keys(cleanedConfig).join(", ")}`);
          if (cleanedConfig.imageUrl) {
            console.log(`[IMAGE_UPDATED] Image URL updated or configured: ${cleanedConfig.imageUrl}`);
          }
          console.log(`⚙️ [Admin Action] Configuration updated successfully on /raffles/${targetRaffleId} config layout.`);
          return res.status(200).json({ success: true, raffleId: targetRaffleId });
        } catch (err: any) {
          console.error("[FIRESTORE_WRITE_ERROR] Failed writing config payload to Firestore:", err);
          if (err?.code === "permission-denied" || err?.message?.includes("permission-denied")) {
            console.error("[FIRESTORE_PERMISSION_DENIED] Permission Denied: Security rules blocked saving config. Ensure admin token is matching.");
          }
          console.error("[CONFIG_SAVE_ERROR] Failed during configuration persistence setup:", err);
          throw err;
        }
      }

      case "toggle-raffle-status": {
        const { isRaffleActive, raffleId } = req.body;
        const targetRaffleId = raffleId || "current";
        if (typeof isRaffleActive !== "boolean") {
          return res.status(400).json({ error: "isRaffleActive boolean parameter is required" });
        }

        console.log(`[TOGGLE_STATUS_START] Request to toggle raffle status to: ${isRaffleActive} for raffle ${targetRaffleId}`);

        const snap = await getDoc(doc(db, "raffles", targetRaffleId));
        if (!snap.exists()) {
          return res.status(404).json({ error: "Configuração da rifa não encontrada." });
        }

        const currentConfig = snap.data();
        const updatedConfig = {
          ...currentConfig,
          isRaffleActive,
          isActive: isRaffleActive,
          status: isRaffleActive ? "ativa" : "pausada",
          updatedAt: new Date().toISOString(),
          adminToken: computedLegacyToken
        };

        try {
          console.log(`[FIRESTORE_WRITE_START] Updating raffle status to ${isRaffleActive} (${updatedConfig.status}) in '/raffles/${targetRaffleId}'...`);
          await setDoc(doc(db, "raffles", targetRaffleId), updatedConfig, { merge: true });
          console.log(`[FIRESTORE_WRITE_SUCCESS] Raffle active status successfully persists as ${isRaffleActive} (status: ${updatedConfig.status}) on Firestore.`);

          if (isRaffleActive) {
            console.log(`[RAFFLE_ACTIVATED] Raffle ${targetRaffleId} has been activated by administrator.`);
          } else {
            console.log(`[RAFFLE_DEACTIVATED] Raffle ${targetRaffleId} has been paused by administrator.`);
          }

          return res.status(200).json({ success: true, isRaffleActive, status: updatedConfig.status, raffleId: targetRaffleId });
        } catch (err: any) {
          console.error("[FIRESTORE_WRITE_ERROR] Failed updating status field on Firestore:", err);
          throw err;
        }
      }

      case "reset": {
        const targetRaffleId = req.body.raffleId || "current";
        console.log(`[RAFFLE_RESET_START] Starting raffle reset of operational campaign for raffle ${targetRaffleId}...`);
        
        // 1. Delete numbers subcollection (/raffles/{targetRaffleId}/numbers) in chunks
        const countNumbersSnap = await getDocs(collection(db, "raffles", targetRaffleId, "numbers"));
        if (!countNumbersSnap.empty) {
          const docsArray = countNumbersSnap.docs;
          for (let i = 0; i < docsArray.length; i += 100) {
            const chunk = docsArray.slice(i, i + 100);
            const batch = writeBatch(db);
            chunk.forEach((docRef) => {
              batch.delete(docRef.ref);
            });
            await batch.commit();
          }
        }

        // 2. Delete orders, reservations, and payments linked ONLY to targetRaffleId
        const ordersSnap = await getDocs(collection(db, "orders"));
        const ordersToDelete: string[] = [];
        const paymentsToDelete: string[] = [];

        ordersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const orderRaffleId = data.raffleId || "current";
          if (orderRaffleId === targetRaffleId) {
            ordersToDelete.push(docSnap.id);
            if (data.paymentId) {
              paymentsToDelete.push(data.paymentId);
            }
            paymentsToDelete.push("SIM_" + docSnap.id);
          }
        });

        if (ordersToDelete.length > 0) {
          for (let i = 0; i < ordersToDelete.length; i += 100) {
            const chunk = ordersToDelete.slice(i, i + 100);
            const batch = writeBatch(db);
            chunk.forEach((orderId) => {
              batch.delete(doc(db, "orders", orderId));
              batch.delete(doc(db, "reservations", orderId));
            });
            await batch.commit();
          }
        }

        if (paymentsToDelete.length > 0) {
          const uniquePayments = Array.from(new Set(paymentsToDelete));
          for (let i = 0; i < uniquePayments.length; i += 100) {
            const chunk = uniquePayments.slice(i, i + 100);
            const batch = writeBatch(db);
            chunk.forEach((payId) => {
              batch.delete(doc(db, "payments", payId));
            });
            await batch.commit();
          }
        }

        // 3. Keep raffle settings intact (title, prize, image, price, total numbers, pix info, etc.)
        const configDocSnap = await getDoc(doc(db, "raffles", targetRaffleId));
        let currentConfig: any = {};
        if (configDocSnap.exists()) {
          currentConfig = configDocSnap.data();
        }

        const resetConfig = {
          ...currentConfig,
          id: targetRaffleId,
          winnerNumber: "",
          winnerName: "",
          videoLink: "",
          drawTimestamp: null,
          updatedAt: new Date().toISOString(),
          adminToken: computedLegacyToken,
        };

        await setDoc(doc(db, "raffles", targetRaffleId), resetConfig, { merge: true });
        console.log(`[RAFFLE_RESET_COMPLETE] Raffle reset completed for ${targetRaffleId}. Quotas & orders removed, settings & Hall of Fame preserved.`);
        return res.status(200).json({ success: true, resetConfig });
      }

      case "draw": {
        const targetRaffleId = req.body.raffleId || "current";
        console.log(`🎲 [Admin Action] Processing server-side draw of winner for raffle ${targetRaffleId}...`);
        
        // Fetch current orders to calculate candidates
        const ordersSnap = await getDocs(collection(db, "orders"));
        const orders: any[] = [];
        ordersSnap.forEach((docSnap) => {
          orders.push(docSnap.data());
        });

        // Fetch config for totalNumbers bounds
        const configDocSnap = await getDoc(doc(db, "raffles", targetRaffleId));
        let raffleConfig: any = { id: targetRaffleId, totalNumbers: 100, title: "iPhone Rifa" };
        if (configDocSnap.exists()) {
          raffleConfig = configDocSnap.data();
        }

        // Filter eligible candidates: strictly paid quotas ("Pago" or "paid") for THIS raffle
        // and ensure duplicates are removed to avoid uneven probabilities.
        const paidNumsUnique = Array.from(new Set(orders
          .filter((o) => (o.raffleId || "current") === targetRaffleId && (o.status === "Pago" || o.status === "paid"))
          .flatMap((o) => o.nums || [])
        ));

        // Check if a specific winner number was manually provided (e.g. for Loteria Federal)
        const customWinnerNumber = req.body.winnerNumber !== undefined && req.body.winnerNumber !== null && String(req.body.winnerNumber).trim() !== "" 
          ? String(req.body.winnerNumber).trim() 
          : null;

        let winnerNum = "";
        let winnerName = "";
        let isNotSold = false;
        let drawMethod = req.body.drawMethod || "CSPRNG_FISHER_YATES_DOUBLE_SHUFFLE";
        const drawAudit = req.body.drawAudit || null;

        if (customWinnerNumber !== null) {
          // Administrator manually specified the winning number (e.g. from Loteria Federal results)
          winnerNum = customWinnerNumber;
          if (!req.body.drawMethod) {
            drawMethod = "LOTERIA_FEDERAL_MANUAL_INPUT";
          }
          
          const normalizeQuota = (q: string): string => {
            const cleaned = String(q).replace(/^0+/, "");
            return cleaned === "" ? "0" : cleaned;
          };
          const normalizedWinner = normalizeQuota(winnerNum);

          // Find the matching paid order for this number (normalizing quotas to compare only numeric values)
          const matchingOrder = orders.find((o) => 
            (o.raffleId || "current") === targetRaffleId &&
            (o.status === "Pago" || o.status === "paid" || o.status === "approved") && 
            (o.nums || []).map(normalizeQuota).includes(normalizedWinner)
          );

          if (matchingOrder) {
            winnerName = matchingOrder.name;
            // Let's use the actual matching cota from the buyer's order so it is fully correct (e.g. padded "007")
            const actualCota = (matchingOrder.nums || []).find(n => normalizeQuota(n) === normalizedWinner);
            if (actualCota) {
              winnerNum = actualCota;
            }
          } else {
            // Cota was not sold or not paid
            winnerName = "Cota Livre / Não Vendida";
            isNotSold = true;
          }
        } else {
          // Automated selection (RifaMaster Automático)
          if (paidNumsUnique.length < (raffleConfig.totalNumbers || 0)) {
            return res.status(400).json({ 
              error: `Sorteio bloqueado: Apenas ${paidNumsUnique.length} de ${raffleConfig.totalNumbers || 0} cotas foram vendidas. O sorteio só pode ser realizado com todas as cotas vendidas.` 
            });
          }

          if (paidNumsUnique.length === 0) {
            return res.status(400).json({ 
              error: "Não existem cotas com status 'Pago' ou 'paid' elegíveis para o sorteio. Exclua pendentes, reservadas ou expiradas da seleção de ganhador." 
            });
          }

          // Fisher-Yates Shuffle using Node cryptographically secure generator (CSPRNG randomInt)
          const shuffledCandidates = [...paidNumsUnique];
          for (let i = shuffledCandidates.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [shuffledCandidates[i], shuffledCandidates[j]] = [shuffledCandidates[j], shuffledCandidates[i]];
          }

          // Clear predictability further with a second shuffle pass
          for (let i = shuffledCandidates.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [shuffledCandidates[i], shuffledCandidates[j]] = [shuffledCandidates[j], shuffledCandidates[i]];
          }

          winnerNum = shuffledCandidates[0];
          const normalizeQuota = (q: string): string => {
            const cleaned = String(q).replace(/^0+/, "");
            return cleaned === "" ? "0" : cleaned;
          };
          const normalizedWinner = normalizeQuota(winnerNum);
          const matchingOrder = orders.find((o) => 
            (o.status === "Pago" || o.status === "paid" || o.status === "approved") && 
            (o.nums || []).map(normalizeQuota).includes(normalizedWinner)
          );
          winnerName = matchingOrder ? matchingOrder.name : "Vencedor Elegível";
        }

        const pendingConfig = {
          ...raffleConfig,
          winnerNumber: winnerNum,
          winnerName: winnerName,
          drawTimestamp: new Date().toISOString(),
          drawTotalParticipants: paidNumsUnique.length,
          drawMethod: drawMethod,
          drawAudit: drawAudit,
          adminToken: computedLegacyToken,
        };

        // Record a physical drawing history event in draws for internal tracking but do not publish to the public config yet
        const drawId = "PENDING_DRAW_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6).toUpperCase();
        const drawRecord = {
          id: drawId,
          timestamp: new Date().toISOString(),
          prize: raffleConfig.title || "Prêmio da Rifa",
          winnerNumber: winnerNum,
          winnerName: winnerName,
          totalParticipants: paidNumsUnique.length,
          method: drawMethod,
          status: "pending",
          drawAudit: drawAudit,
          
          // New requested fields:
          raffleTitle: raffleConfig.title || "Prêmio da Rifa",
          winningNumber: winnerNum,
          drawDate: new Date().toLocaleDateString("pt-BR"),
          drawTimestamp: new Date().toISOString(),
          videoLink: ""
        };
        try {
          console.log(`[FIRESTORE_WRITE_START] Saving pending draw event record under '/draws/${drawId}'...`);
          await setDoc(doc(db, "draws", drawId), drawRecord);
          console.log(`[FIRESTORE_WRITE_SUCCESS] Pending draw event successfully persisted in Firestore.`);
        } catch (drawErr: any) {
          console.error(`[FIRESTORE_WRITE_ERROR] Failed saving pending draw history to Firestore:`, drawErr);
          if (drawErr?.code === "permission-denied" || drawErr?.message?.includes("permission-denied")) {
            console.error(`[FIRESTORE_PERMISSION_DENIED] Permission Denied: Could not write pending draw history document.`);
          }
          throw drawErr;
        }

        console.log(`🏆 [Admin Action] Winner drawn/registered: '${raffleConfig.title}', Winner Number: ${winnerNum} (${winnerName}). Saved as pending.`);
        
        return res.status(200).json({ 
          success: true, 
          drawId: drawId,
          winnerNumber: winnerNum, 
          winnerName: winnerName,
          isNotSold: isNotSold,
          updatedConfig: pendingConfig
        });
      }

      case "publish-draw": {
        const { configToPublish, drawId } = req.body;
        if (!configToPublish) return res.status(400).json({ error: "Missing configToPublish" });

        const targetRaffleId = req.body.raffleId || configToPublish.id || "current";
        configToPublish.id = targetRaffleId;

        console.log(`[CONFIG_SAVE_START] Began processing atomic publish-draw config save for raffle ${targetRaffleId}.`);

        const winnerHistoryId = "WIN_" + targetRaffleId;

        const nowObj = new Date();
        const rafflePayload = {
          ...configToPublish,
          status: "encerrada",
          isRaffleActive: false,
          isActive: false,
          winnerNumber: String(configToPublish.winnerNumber || "").trim(),
          winnerName: String(configToPublish.winnerName || "").trim(),
          winnerPhone: String(configToPublish.winnerPhone || "").trim(),
          drawDate: configToPublish.drawDate || nowObj.toLocaleDateString("pt-BR"),
          drawTime: configToPublish.drawTime || nowObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          updatedAt: nowObj.toISOString(),
          adminToken: computedLegacyToken
        };

        const drawMethodLabel = configToPublish.drawAudit?.drawMethod || configToPublish.drawMethod || "Loteria Federal";

        const winnerHistoryRecord = {
          id: winnerHistoryId,
          winnerName: String(configToPublish.winnerName || "Ganhador").trim(),
          winnerPhone: String(configToPublish.winnerPhone || configToPublish.phone || "").trim(),
          winnerNumber: String(configToPublish.winnerNumber || "000").trim(),
          prizeTitle: String(configToPublish.title || "Prêmio da Rifa").trim(),
          prizeImageUrl: String(configToPublish.imageUrl || configToPublish.prizeImageUrl || "").trim(),
          prizeDescription: String(configToPublish.description || "Sorteio realizado com sucesso!").trim(),
          prizeValue: configToPublish.prizeValue || "",
          drawDate: rafflePayload.drawDate,
          drawTime: rafflePayload.drawTime,
          city: configToPublish.city || "",
          state: configToPublish.state || "",
          status: configToPublish.status || "Normal", // "Destaque" ou "Normal"
          raffleId: targetRaffleId,
          videoLink: configToPublish.videoLink || "",
          instagram: configToPublish.instagram || "",
          winnerImageUrl: String(configToPublish.winnerImageUrl || "").trim(),
          raffleTitle: String(configToPublish.raffleTitle || configToPublish.title || "Prêmio da Rifa").trim(),
          drawMethod: drawMethodLabel,
          createdAt: nowObj.toISOString()
        };

        const drawPayload = drawId ? {
          id: drawId,
          timestamp: nowObj.toISOString(),
          prize: String(configToPublish.title || "Prêmio da Rifa").substring(0, 300),
          winnerNumber: String(configToPublish.winnerNumber || "000").substring(0, 10),
          winnerName: String(configToPublish.winnerName || "Ganhador").substring(0, 200),
          totalParticipants: Number(configToPublish.totalNumbers || 100),
          status: "published",
          videoLink: configToPublish.videoLink || "",
          raffleTitle: String(configToPublish.title || "Prêmio da Rifa").substring(0, 300),
          winningNumber: String(configToPublish.winnerNumber || "000").substring(0, 10),
          drawDate: rafflePayload.drawDate,
          drawTimestamp: nowObj.toISOString()
        } : null;

        try {
          console.log(`[DRAW_PUBLISH_FLOW] Executando transação atômica do sorteio via runTransaction para a Rifa: ${targetRaffleId}...`);
          const raffleRef = doc(db, "raffles", targetRaffleId);
          const winnerHistoryRef = doc(db, "winners_history", winnerHistoryId);
          const drawRef = drawId ? doc(db, "draws", winnerHistoryId) : null;

          await runTransaction(db, async (transaction) => {
            const raffleSnap = await transaction.get(raffleRef);
            if (raffleSnap.exists()) {
              const raffleData = raffleSnap.data();
              if (raffleData && raffleData.status === "encerrada" && raffleData.winnerNumber) {
                console.log(`[DRAW_PUBLISH_FLOW] [IDEMPOTENCY] Raffle ${targetRaffleId} is already closed/drawn with winner #${raffleData.winnerNumber}. Aborting duplicate transaction commit.`);
                throw new Error("ALREADY_PROCESSED");
              }
            }

            // Perform atomic writes within transaction
            transaction.set(raffleRef, rafflePayload);
            transaction.set(winnerHistoryRef, winnerHistoryRecord);
            if (drawRef && drawPayload) {
              transaction.set(drawRef, drawPayload, { merge: true });
            }
          });

          console.log(`[FIRESTORE_TRANSACTION_SUCCESS] runTransaction atomic commit succeeded! Raffle is closed, and winner is published in winners_history.`);
          return res.status(200).json({ success: true });
        } catch (txnErr: any) {
          if (txnErr.message === "ALREADY_PROCESSED") {
            return res.status(200).json({ success: true, alreadyProcessed: true });
          }
          console.error(`[FIRESTORE_TRANSACTION_ERROR] runTransaction failed. Error:`, txnErr);
          return res.status(500).json({ 
            error: `Erro ao processar transação atômica do sorteio via runTransaction: ${txnErr.message}`,
            stack: txnErr.stack || ""
          });
        }
      }

      case "add-winner-history": {
        const { winnerData } = req.body;
        if (!winnerData) return res.status(400).json({ error: "Missing winnerData" });
        const winnerHistoryId = winnerData.id || ("WIN_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6).toUpperCase());
        const nowObj = new Date();
        const record = {
          id: winnerHistoryId,
          winnerName: String(winnerData.winnerName || "Ganhador").trim(),
          winnerNumber: String(winnerData.winnerNumber || "000").trim(),
          prizeTitle: String(winnerData.prizeTitle || "Prêmio da Rifa").trim(),
          prizeImageUrl: String(winnerData.prizeImageUrl || "").trim(),
          prizeDescription: String(winnerData.prizeDescription || "").trim(),
          prizeValue: String(winnerData.prizeValue || "").trim(),
          drawDate: winnerData.drawDate || nowObj.toLocaleDateString("pt-BR"),
          drawTime: winnerData.drawTime || nowObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          city: String(winnerData.city || "").trim(),
          state: String(winnerData.state || "").trim(),
          status: String(winnerData.status || "Normal").trim(), // "Destaque" ou "Normal"
          raffleId: winnerData.raffleId || "manual",
          videoLink: String(winnerData.videoLink || "").trim(),
          instagram: String(winnerData.instagram || "").trim(),
          winnerImageUrl: String(winnerData.winnerImageUrl || "").trim(),
          raffleTitle: String(winnerData.raffleTitle || winnerData.prizeTitle || "Rifa").trim(),
          createdAt: winnerData.createdAt || nowObj.toISOString()
        };
        await setDoc(doc(db, "winners_history", winnerHistoryId), record);
        return res.status(200).json({ success: true, record });
      }

      case "delete-winner-history": {
        const { winnerId } = req.body;
        if (!winnerId) return res.status(400).json({ error: "Missing winnerId" });
        
        console.log(`[DELETE_WINNER_START] Request to delete winnerId: ${winnerId}`);
        
        // 1. Fetch document from winners_history to extract raffleId
        const winnerRef = doc(db, "winners_history", winnerId);
        const winnerSnap = await getDoc(winnerRef);
        let raffleIdToDelete = "";
        if (winnerSnap.exists()) {
          raffleIdToDelete = winnerSnap.data()?.raffleId || "";
        }

        // 2. Delete main document from winners_history
        await deleteDoc(winnerRef);
        console.log(`[DELETE_WINNER_FIRESTORE] Deleted winners_history/${winnerId}`);

        // 3. Perform exhaustive cleanup of matching draw documents to prevent resurrection
        try {
          await deleteDoc(doc(db, "draws", winnerId));
          if (winnerId.startsWith("WIN_MIGRATED_")) {
            await deleteDoc(doc(db, "draws", winnerId.replace("WIN_MIGRATED_", "")));
          }
          if (winnerId.startsWith("WIN_")) {
            await deleteDoc(doc(db, "draws", winnerId.replace("WIN_", "")));
          }
          if (raffleIdToDelete) {
            const drawsQuery = query(collection(db, "draws"), where("raffleId", "==", raffleIdToDelete));
            const drawsSnap = await getDocs(drawsQuery);
            for (const dDoc of drawsSnap.docs) {
              await deleteDoc(dDoc.ref);
              console.log(`[DELETE_WINNER_CLEANUP] Deleted draws/${dDoc.id}`);
            }
          }
        } catch (cleanErr) {
          console.warn("[DELETE_WINNER_CLEANUP_WARN] Non-fatal error cleaning draws collection:", cleanErr);
        }

        return res.status(200).json({ success: true });
      }

      case "reallocate-expired": {
        const { orderId, newNumbers } = req.body;
        if (!orderId || !newNumbers || !Array.isArray(newNumbers)) {
          return res.status(400).json({ error: "Parâmetros orderId e newNumbers são obrigatórios." });
        }

        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          return res.status(404).json({ error: "Ordem correspondente não encontrada." });
        }
        const orderData = orderSnap.data();
        const targetRaffleId = req.body.raffleId || orderData.raffleId || "current";
        const originalCount = (orderData.nums || []).length;

        if (newNumbers.length !== originalCount) {
          return res.status(400).json({ error: `Você deve selecionar exatamente ${originalCount} cotas para realocação.` });
        }

        // Validate details: each number in newNumbers must be available (not paid, reserved or actively locked)
        const currentNow = Date.now();
        for (const num of newNumbers) {
          // 1. Check if number is assigned in raffles subcollection
          const numRef = doc(db, "raffles", targetRaffleId, "numbers", num);
          const numSnap = await getDoc(numRef);
          if (numSnap.exists()) {
            const numData = numSnap.data();
            const numStatusLower = (numData?.status || "").toLowerCase();
            const isNumExpired = numData?.expiresAt ? numData.expiresAt <= currentNow : true;
            if (numStatusLower === "paid" || numStatusLower === "pago" || (numStatusLower === "reserved" && !isNumExpired)) {
              return res.status(400).json({ error: `A cota ${num} já está reservada ou paga por outra pessoa.` });
            }
          }

          // 2. Check if locked dynamically
          const lockRef = doc(db, "locks", num);
          const lockSnap = await getDoc(lockRef);
          if (lockSnap.exists()) {
            const lockData = lockSnap.data();
            if (lockData && lockData.expiresAt > currentNow) {
              return res.status(400).json({ error: `A cota ${num} está temporariamente em posse de outro usuário.` });
            }
          }
        }

        // Perform atomic batch update
        const batch = writeBatch(db);

        // Update order status to Pago
        batch.update(orderRef, {
          nums: newNumbers,
          status: "Pago",
          paymentCollisionError: false,
          paymentCollisionReason: null,
          receivedLatePayment: false,
          approvedAt: new Date().toISOString(),
          reallocatedFromNums: orderData.nums || []
        });

        // Update reservation status to Pago
        const reservationRef = doc(db, "reservations", orderId);
        batch.update(reservationRef, {
          nums: newNumbers,
          status: "Pago",
          approvedAt: new Date().toISOString()
        });

        // Assign new numbers to numbers subcollection as paid
        newNumbers.forEach((num) => {
          const numRef = doc(db, "raffles", targetRaffleId, "numbers", num);
          batch.set(numRef, {
            id: num,
            status: "paid",
            orderId: orderId,
            name: orderData.name,
            phone: orderData.phone,
            updatedAt: new Date().toISOString()
          });

          // Clear locks if any
          const lockRef = doc(db, "locks", num);
          batch.delete(lockRef);
        });

        // Update payments collection status to approved
        const paymentId = orderData.paymentId || ("SIM_" + orderId);
        batch.set(doc(db, "payments", paymentId), {
          id: paymentId,
          orderId: orderId,
          status: "approved",
          amount: Number(orderData.val || 0),
          createdAt: orderData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: `Realocaçao concluída com sucesso! Cotas anteriores: ${(orderData.nums || []).join(", ")}. Novas cotas: ${newNumbers.join(", ")}`
        }, { merge: true });

        try {
          await batch.commit();
          console.log(`[LATE_PAYMENT_REALLOCATED] Order ${orderId} reallocated to new cotas: ${newNumbers.join(", ")}. Old cotas were: ${(orderData.nums || []).join(", ")}`);
          console.log(`[REALLOCATION_CONFIRMED] Reallocated reconfirmation validated successfully for order ${orderId}`);
          return res.status(200).json({ success: true, newNumbers });
        } catch (batchErr: any) {
          console.error("[FIRESTORE_WRITE_ERROR] Failed committing reallocate batch:", batchErr);
          return res.status(500).json({ error: "Erro ao atualizar banco de dados para realocação de cotas." });
        }
      }

      case "refund-expired": {
        const { orderId } = req.body;
        if (!orderId) {
          return res.status(400).json({ error: "Id da ordem é obrigatório." });
        }

        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          return res.status(404).json({ error: "Ordem correspondente não encontrada." });
        }
        const orderData = orderSnap.data();

        const batch = writeBatch(db);

        batch.update(orderRef, {
          status: "Reembolsado",
          refundedAt: new Date().toISOString(),
          paymentCollisionError: true,
          paymentCollisionReason: "Pagamento atrasado reembolsado administrativamente."
        });

        const reservationRef = doc(db, "reservations", orderId);
        batch.update(reservationRef, {
          status: "Reembolsado",
          refundedAt: new Date().toISOString()
        });

        const paymentId = orderData.paymentId || ("SIM_" + orderId);
        batch.set(doc(db, "payments", paymentId), {
          id: paymentId,
          orderId: orderId,
          status: "refunded",
          amount: Number(orderData.val || 0),
          createdAt: orderData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        try {
          await batch.commit();
          console.log(`[PAYMENT_REFUNDED_AFTER_EXPIRATION] Refund processed successfully on payment after expiration for order ${orderId}`);
          return res.status(200).json({ success: true });
        } catch (err: any) {
          console.error("[FIRESTORE_WRITE_ERROR] Refund write failed:", err);
          return res.status(500).json({ error: "Falha ao registrar reembolso." });
        }
      }

      case "order-action": {
        const { orderId, statusAction } = req.body;
        if (!orderId || !statusAction) {
          return res.status(400).json({ error: "orderId and statusAction are required" });
        }

        // Fetch direct order details
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        if (!orderSnap.exists()) {
          return res.status(404).json({ error: "Ordem correspondente não encontrada." });
        }
        const orderData = orderSnap.data();
        const targetRaffleId = req.body.raffleId || orderData.raffleId || "current";
        const orderNums = orderData.nums || [];

        const isApprove = statusAction === "approve" || statusAction === "confirm";
        const isCancel = statusAction === "cancel" || statusAction === "reject";
        const isRefund = statusAction === "refund";

        let dbStatus = "Pago";
        let resStatus = "Pago";
        let payStatus = "approved";

        if (isCancel) {
          dbStatus = "Cancelado";
          resStatus = "Cancelado";
          payStatus = "canceled";
        } else if (isRefund) {
          dbStatus = "Cancelado";
          resStatus = "Reembolsado";
          payStatus = "refunded";
        }

        // If the admin cancels/rejects or refunds, cancel on MercadoPago synchronously (or async with graceful error capture) to make the pix key/expiration invalid
        if (isCancel || isRefund) {
          const realPayId = orderData.paymentId;
          if (realPayId && !String(realPayId).startsWith("SIM_") && process.env.MP_ACCESS_TOKEN && mpPayment) {
            try {
              console.log(`⏳ [Admin Action MP Cancel] Attempting to invalidate/cancel payment ${realPayId} on Mercado Pago...`);
              await mpPayment.cancel({ id: Number(realPayId) });
              console.log(`| [Admin Action MP Cancel] Successfully cancelled payment ${realPayId} on Mercado Pago.`);
            } catch (mpErr: any) {
              console.error(`❌ [Admin Action MP Cancel] Failed to cancel payment ${realPayId} on MP:`, mpErr?.message || mpErr);
            }
          }
        }

        const batch = writeBatch(db);

        // 1. Update legacy Order
        batch.update(doc(db, "orders", orderId), {
          status: dbStatus,
          approvedAt: isApprove ? new Date().toISOString() : null,
          canceledAt: !isApprove ? new Date().toISOString() : null,
        });

        // 2. Update Reservations replicated document
        batch.update(doc(db, "reservations", orderId), {
          status: resStatus,
          approvedAt: isApprove ? new Date().toISOString() : null,
          canceledAt: !isApprove ? new Date().toISOString() : null,
        });

        // 3. Update Payment record
        const paymentId = orderData.paymentId || ("SIM_" + orderId);
        batch.set(doc(db, "payments", paymentId), {
          id: paymentId,
          orderId: orderId,
          status: payStatus,
          amount: Number(orderData.val || 0),
          createdAt: orderData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // 4. Update individual raffle number tracking states
        if (isApprove) {
          const bonusNumsSet = new Set<string>(orderData.bonusNums || []);
          orderNums.forEach((num: string) => {
            const numDocRef = doc(db, "raffles", targetRaffleId, "numbers", num);
            batch.set(numDocRef, {
              id: num,
              status: "paid",
              orderId: orderId,
              name: orderData.name,
              phone: orderData.phone,
              isBonus: bonusNumsSet.has(num),
              updatedAt: new Date().toISOString()
            });
          });
        } else {
          // If cancelling or refunding, release cotas entirely from the numbers layout
          orderNums.forEach((num: string) => {
            const numDocRef = doc(db, "raffles", targetRaffleId, "numbers", num);
            batch.delete(numDocRef);
          });
        }

        if (isApprove) {
          await allocatePromotionalBonus(db, orderId, orderData, batch, targetRaffleId);
        }

        try {
          console.log(`[FIRESTORE_WRITE_START] Committing batch status update for order: ${orderId} (Action: ${statusAction})...`);
          await batch.commit();
          console.log(`[FIRESTORE_WRITE_SUCCESS] Successfully committed order status update batch in Firestore.`);
        } catch (batchErr: any) {
          console.error(`[FIRESTORE_WRITE_ERROR] Failed during order status update batch commit:`, batchErr);
          if (batchErr?.code === "permission-denied" || batchErr?.message?.includes("permission-denied")) {
            console.error(`[FIRESTORE_PERMISSION_DENIED] Permission Denied: Blocked batch updates for order ${orderId}`);
          }
          throw batchErr;
        }

        console.log(`📦 [Admin Action] Order status change batch committed. ID: ${orderId}, Action: ${statusAction}`);
        return res.status(200).json({ success: true });
      }

      case "import-backup": {
        const { backup } = req.body;
        if (!backup || backup.version !== "RifaMaster_Backup_v1") {
          return res.status(400).json({ error: "Formato de backup inválido ou incompatível." });
        }

        console.log("[FIRESTORE_WRITE_START] Starting massive backup restore batch operation...");
        let count = 0;
        let batch = writeBatch(db);
        const batchLimit = 400; // max 500 but leaving a margin

        const commitBatch = async (force = false) => {
          if (count > 0 && (force || count >= batchLimit)) {
            await batch.commit();
            console.log(`[FIRESTORE_WRITE_SUCCESS] Committed chunk of ${count} documents during backup restore`);
            batch = writeBatch(db);
            count = 0;
          }
        };

        if (backup.config) {
          const configRef = doc(db, "raffles", "current");
          const payload = {
            ...backup.config,
            adminToken: computedLegacyToken,
          };
          batch.set(configRef, payload, { merge: true });
          count++;
          await commitBatch();
        }

        const collections = ["orders", "reservations", "payments", "draws"];
        for (const coll of collections) {
          if (Array.isArray(backup[coll])) {
            for (const item of backup[coll]) {
              if (item.id) {
                batch.set(doc(db, coll, item.id), item, { merge: true });
                count++;
                await commitBatch();
              }
            }
          }
        }

        if (Array.isArray(backup.numbers)) {
          for (const item of backup.numbers) {
            if (item.id) {
              batch.set(doc(db, "raffles", "current", "numbers", item.id), item, { merge: true });
              count++;
              await commitBatch();
            }
          }
        }

        await commitBatch(true); // flush final

        console.log("[FIRESTORE_WRITE_SUCCESS] Completed massive backup restore operation.");
        return res.status(200).json({ success: true, message: "Backup successfully imported and processed on the backend." });
      }

      case "release-cota": {
        const { orderId, numberToRelease } = req.body;
        if (!orderId || !numberToRelease) {
          return res.status(400).json({ error: "orderId and numberToRelease are required" });
        }

        // Fetch direct order doc
        const orderDocSnap = await getDoc(doc(db, "orders", orderId));
        if (!orderDocSnap.exists()) {
          return res.status(404).json({ error: "Order not found." });
        }
        const targetOrder = orderDocSnap.data();
        const targetRaffleId = req.body.raffleId || targetOrder.raffleId || "current";

        // 1. Guard against PAID status to prevent integrity issues
        const oStatus = (targetOrder.status || "").toLowerCase();
        if (
          oStatus === "pago" || 
          oStatus === "paid" || 
          oStatus === "confirmed" || 
          oStatus === "approved"
        ) {
          console.warn(`[RESERVATION_RELEASE_BLOCKED] [PAID_QUOTA_PROTECTED] Release blocked for cota ${numberToRelease} under order ${orderId} because order is PAID.`);
          return res.status(400).json({ error: "Pagamento confirmado. Esta reserva não pode ser liberada." });
        }

        // 2. Also check if the specific number status in DB is "paid"
        const numDocRefToCheck = doc(db, "raffles", targetRaffleId, "numbers", numberToRelease);
        const numDocSnap = await getDoc(numDocRefToCheck);
        if (numDocSnap.exists()) {
          const numData = numDocSnap.data();
          const numStatusLower = (numData?.status || "").toLowerCase();
          if (numStatusLower === "paid" || numStatusLower === "pago") {
            console.warn(`[RESERVATION_RELEASE_BLOCKED] [PAID_QUOTA_PROTECTED] Release blocked for cota ${numberToRelease} because the slot is already marked as PAID.`);
            return res.status(400).json({ error: "Número já pago. Esta cota não pode ser liberada." });
          }
        }

        const updatedNums = (targetOrder.nums || []).filter((n: string) => n !== numberToRelease);

        // Fetch direct config to get current unit price
        const configDocSnap = await getDoc(doc(db, "raffles", targetRaffleId));
        let itemPrice = 10;
        if (configDocSnap.exists()) {
          itemPrice = configDocSnap.data().price || 10;
        }

        const batch = writeBatch(db);

        if (updatedNums.length === 0) {
          batch.update(doc(db, "orders", orderId), {
            nums: [],
            val: 0,
            status: "Cancelado",
          });
          batch.update(doc(db, "reservations", orderId), {
            nums: [],
            val: 0,
            status: "Cancelado",
          });
        } else {
          batch.update(doc(db, "orders", orderId), {
            nums: updatedNums,
            val: updatedNums.length * itemPrice,
          });
          batch.update(doc(db, "reservations", orderId), {
            nums: updatedNums,
            val: updatedNums.length * itemPrice,
          });
        }

        // Delete nested scalable Raffle Number
        const numDocRef = doc(db, "raffles", targetRaffleId, "numbers", numberToRelease);
        batch.delete(numDocRef);

        // Delete temporary lock doc if any
        const lockRef = doc(db, "locks", numberToRelease);
        batch.delete(lockRef);

        try {
          console.log(`[FIRESTORE_WRITE_START] Committing release-cota batch writes for cota: ${numberToRelease} under order: ${orderId}...`);
          await batch.commit();
          console.log(`[FIRESTORE_WRITE_SUCCESS] Successfully committed release-cota batch writes in Firestore.`);
        } catch (batchErr: any) {
          console.error(`[FIRESTORE_WRITE_ERROR] Failed during release-cota batch commit:`, batchErr);
          if (batchErr?.code === "permission-denied" || batchErr?.message?.includes("permission-denied")) {
            console.error(`[FIRESTORE_PERMISSION_DENIED] Permission Denied: Blocked batch updates during cota release.`);
          }
          throw batchErr;
        }

        console.log(`🎟️ [Admin Action] Cota ${numberToRelease} released entirely for order ID: ${orderId}`);
        return res.status(200).json({ success: true, updatedNumsLength: updatedNums.length });
      }

      case "create-manual-draw": {
        console.log("[DRAW_MANUAL_CREATE] Initiating manual draw creation endpoint handler.");
        try {
          const { prize, winnerName, winnerNumber, drawDate, drawTime, videoLink, imageUrl } = req.body;
          console.log("[DRAW_MANUAL_PAYLOAD] Received request payload in backend:", JSON.stringify(req.body));
          
          console.log("[DRAW_MANUAL_CREATE] Executing input validations...");
          if (!prize || !winnerName || !winnerNumber || !drawDate || !drawTime) {
            const errMsg = "Nome da Rifa, Nome do Ganhador, Número Sorteado, Data e Hora do Sorteio são obrigatórios!";
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Validation failure: ${errMsg}`);
            console.log(`[DRAW_MANUAL_API_RESPONSE] Returning 400 Bad Request: ${errMsg}`);
            return res.status(400).json({ success: false, error: errMsg });
          }

          let isoTimestamp: string;
          try {
            isoTimestamp = new Date(`${drawDate}T${drawTime}:00`).toISOString();
          } catch (e) {
            isoTimestamp = new Date().toISOString();
          }

          const dateParts = drawDate.split("-"); // YYYY-MM-DD
          const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : drawDate;

          const drawId = "MANUAL_DRAW_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6).toUpperCase();

          const rawRecord = {
            id: drawId,
            timestamp: isoTimestamp,
            prize: String(prize).trim(),
            winnerNumber: String(winnerNumber).trim(),
            winnerName: String(winnerName).trim(),
            totalParticipants: 0,
            method: "MANUAL_ENTRY",
            status: "published",
            
            raffleTitle: String(prize).trim(),
            winningNumber: String(winnerNumber).trim(),
            drawDate: formattedDate,
            drawTimestamp: isoTimestamp,
            videoLink: String(videoLink || "").trim(),
            imageUrl: String(imageUrl || "").trim()
          };

          // Compare, log, and obtain the 100% compliant sanitized record
          const manualRecord = auditAndSanitizeDrawPayload(drawId, rawRecord);

          try {
            console.log(`[DRAW_MANUAL_COLLECTION] Target Firestore Collection: draws`);
            console.log(`[DRAW_MANUAL_DOCUMENT] Target Document Path: draws/${drawId}`);
            
            // Logging requested payloads and database instances
            console.log("[DRAW_FINAL_PAYLOAD]", JSON.stringify(manualRecord, null, 2));
            console.log("[DRAW_FIRESTORE_INSTANCE] Client SDK:", db?.constructor?.name);

            console.log(`[DRAW_MANUAL_SDK] Firebase Client Web SDK used (firebase/firestore).`);
            console.log(`[DRAW_MANUAL_WRITE_START] Saving manual draw record under '/draws/${drawId}' with payload via Web SDK.`);
            await setDoc(doc(db, "draws", drawId), manualRecord);
            console.log(`[FIRESTORE_WRITE_SUCCESS] Manual draw record successfully persisted via Web SDK.`);

            console.log(`[DRAW_MANUAL_CREATE_SUCCESS] Manual draw created successfully in Firestore. Id: ${drawId}, Prize: ${prize}, Winner: ${winnerName}, Number: ${winnerNumber}`);
            console.log(`[DRAW_MANUAL_API_RESPONSE] Returning 200 Success: { success: true, drawId: ${drawId} }`);
            return res.status(200).json({ success: true, drawId });
          } catch (err: any) {
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Failed saving manual draw record to Firestore under draws/${drawId}:`);
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Error code: ${err?.code || 'No error code'}`);
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Error message: ${err?.message || err}`);
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Error stack trace:`, err?.stack || "No stack trace available");
            const detailedError = `Erro ao salvar no banco de dados. Code: ${err?.code || 'unknown'} - Message: ${err?.message || err}`;
            console.log(`[DRAW_MANUAL_API_RESPONSE] Returning 500 Server Error: ${detailedError}`);
            return res.status(500).json({ success: false, error: detailedError });
          }
        } catch (exception: any) {
          console.error(`[DRAW_MANUAL_EXCEPTION] Unexpected exception inside create-manual-draw routine:`, exception);
          console.error(`[DRAW_MANUAL_EXCEPTION] Stack trace:`, exception?.stack || "No stack trace available");
          return res.status(500).json({ success: false, error: exception.message || "DRAW_MANUAL_EXCEPTION encountered." });
        }
      }

      case "update-manual-draw": {
        console.log("[DRAW_MANUAL_CREATE] Initiating manual draw update endpoint handler.");
        try {
          const { drawId, prize, winnerName, winnerNumber, drawDate, drawTime, videoLink, imageUrl } = req.body;
          console.log("[DRAW_MANUAL_PAYLOAD] Received update payload in backend:", JSON.stringify(req.body));
          
          console.log("[DRAW_MANUAL_CREATE] Executing update input validations...");
          if (!drawId || !prize || !winnerName || !winnerNumber || !drawDate || !drawTime) {
            const errMsg = "Id, Nome da Rifa, Nome do Ganhador, Número Sorteado, Data e Hora do Sorteio são obrigatórios!";
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Update validation failure: ${errMsg}`);
            console.log(`[DRAW_MANUAL_API_RESPONSE] Returning 400 Bad Request: ${errMsg}`);
            return res.status(400).json({ success: false, error: errMsg });
          }

          let isoTimestamp: string;
          try {
            isoTimestamp = new Date(`${drawDate}T${drawTime}:00`).toISOString();
          } catch (e) {
            isoTimestamp = new Date().toISOString();
          }

          const dateParts = drawDate.split("-"); // YYYY-MM-DD
          const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : drawDate;

          const rawRecord = {
            id: drawId,
            timestamp: isoTimestamp,
            prize: String(prize).trim(),
            winnerNumber: String(winnerNumber).trim(),
            winnerName: String(winnerName).trim(),
            totalParticipants: 0,
            method: "MANUAL_ENTRY",
            status: "published",
            
            raffleTitle: String(prize).trim(),
            winningNumber: String(winnerNumber).trim(),
            drawDate: formattedDate,
            drawTimestamp: isoTimestamp,
            videoLink: String(videoLink || "").trim(),
            imageUrl: String(imageUrl || "").trim()
          };

          // Compare, log, and obtain the 100% compliant sanitized record
          const manualRecord = auditAndSanitizeDrawPayload(drawId, rawRecord);

          try {
            console.log(`[DRAW_MANUAL_COLLECTION] Target Firestore Collection: draws`);
            console.log(`[DRAW_MANUAL_DOCUMENT] Target Document Path: draws/${drawId}`);
            
            // Logging requested payloads and database instances
            console.log("[DRAW_FINAL_PAYLOAD]", JSON.stringify(manualRecord, null, 2));
            console.log("[DRAW_FIRESTORE_INSTANCE] Client SDK:", db?.constructor?.name);

            console.log(`[DRAW_MANUAL_SDK] Firebase Client Web SDK used (firebase/firestore).`);
            console.log(`[DRAW_MANUAL_WRITE_START] Updating manual draw record under '/draws/${drawId}' with payload via Web SDK.`);
            await setDoc(doc(db, "draws", drawId), manualRecord);
            console.log(`[FIRESTORE_WRITE_SUCCESS] Manual draw record successfully updated via Web SDK.`);

            console.log(`[DRAW_MANUAL_CREATE_SUCCESS] Manual draw updated successfully in Firestore. Id: ${drawId}, Prize: ${prize}, Winner: ${winnerName}, Number: ${winnerNumber}`);
            console.log(`[DRAW_MANUAL_API_RESPONSE] Returning 200 Success: { success: true }`);
            return res.status(200).json({ success: true });
          } catch (err: any) {
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Failed updating manual draw record in Firestore under draws/${drawId}:`);
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Error code: ${err?.code || 'No error code'}`);
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Error message: ${err?.message || err}`);
            console.error(`[DRAW_MANUAL_CREATE_ERROR] Error stack trace:`, err?.stack || "No stack trace available");
            const detailedError = `Erro ao atualizar no banco de dados. Code: ${err?.code || 'unknown'} - Message: ${err?.message || err}`;
            console.log(`[DRAW_MANUAL_API_RESPONSE] Returning 500 Server Error: ${detailedError}`);
            return res.status(500).json({ success: false, error: detailedError });
          }
        } catch (exception: any) {
          console.error(`[DRAW_MANUAL_EXCEPTION] Unexpected exception inside update-manual-draw routine:`, exception);
          console.error(`[DRAW_MANUAL_EXCEPTION] Stack trace:`, exception?.stack || "No stack trace available");
          return res.status(500).json({ success: false, error: exception.message || "DRAW_MANUAL_EXCEPTION encountered during update." });
        }
      }

      case "delete-manual-draw": {
        const { drawId } = req.body;
        if (!drawId) {
          return res.status(400).json({ error: "ID do sorteio é obrigatório!" });
        }

        try {
          console.log(`[FIRESTORE_WRITE_START] Deleting manual draw record under '/draws/${drawId}'...`);
          await deleteDoc(doc(db, "draws", drawId));
          console.log(`[FIRESTORE_WRITE_SUCCESS] Manual draw record successfully deleted from Firestore.`);
          console.log(`[DRAW_MANUAL_DELETE] Manual draw deleted successfully: Id: ${drawId}`);
          return res.status(200).json({ success: true });
        } catch (err: any) {
          console.error(`[FIRESTORE_WRITE_ERROR] Failed deleting manual draw record:`, err);
          return res.status(500).json({ error: "Erro ao excluir no banco de dados." });
        }
      }

      case "update-global-pix": {
        const { pixKey, pixReceiver, pixBank, pixPhone, pixKeyType, pixBankLogo } = req.body;
        
        console.log("💳 [Admin Action] Updating Global PIX account and propagating to all active raffles...");
        
        const globalPixPayload = {
          id: "global_pix",
          pixKey: String(pixKey || "").trim(),
          pixReceiver: String(pixReceiver || "").trim(),
          pixBank: String(pixBank || "").trim(),
          pixPhone: String(pixPhone || "").trim(),
          pixKeyType: String(pixKeyType || "").trim(),
          pixBankLogo: String(pixBankLogo || "").trim(),
          updatedAt: new Date().toISOString(),
          adminToken: computedLegacyToken
        };
        
        try {
          await setDoc(doc(db, "raffles", "global_pix"), globalPixPayload, { merge: true });
          console.log("✅ Global PIX details saved successfully in '/raffles/global_pix'");
        } catch (err) {
          console.error("❌ Error saving global PIX config doc:", err);
        }

        const rafflesSnap = await getDocs(collection(db, "raffles"));
        let updatedCount = 0;
        
        if (!rafflesSnap.empty) {
          const batch = writeBatch(db);
          
          rafflesSnap.forEach((docSnap) => {
            const raffleId = docSnap.id;
            if (raffleId === "global_pix") return;
            
            const data = docSnap.data();
            const isRaffleActive = data.isRaffleActive !== false;
            const isActive = data.isActive !== false;
            const isStatusActive = data.status === "ativa";
            
            if (isStatusActive || isRaffleActive || isActive) {
              const raffleRef = doc(db, "raffles", raffleId);
              batch.update(raffleRef, {
                pixKey: globalPixPayload.pixKey,
                pixReceiver: globalPixPayload.pixReceiver,
                pixBank: globalPixPayload.pixBank,
                pixPhone: globalPixPayload.pixPhone,
                updatedAt: new Date().toISOString()
              });
              updatedCount++;
            }
          });
          
          if (updatedCount > 0) {
            await batch.commit();
            console.log(`✅ Propagated new PIX account details to ${updatedCount} active raffles.`);
          }
        }
        
        return res.status(200).json({ 
          success: true, 
          updatedCount,
          globalPix: globalPixPayload
        });
      }

      case "list-raffles": {
        console.log("📋 [Admin Action] Listing all raffles...");
        const rafflesSnap = await getDocs(collection(db, "raffles"));
        if (rafflesSnap.empty) {
          console.log("[MULTI_RIFA] No raffles found in collection. Returning empty list.");
          return res.status(200).json({ success: true, raffles: [] });
        }

        const rafflesList: any[] = [];
        rafflesSnap.forEach((docSnap) => {
          if (docSnap.id === "global_pix") return;
          const data = docSnap.data();
          rafflesList.push({
            id: docSnap.id,
            status: data.status || (data.isRaffleActive !== false ? "ativa" : "encerrada"),
            title: data.title || "Rifa Sem Título",
            description: data.description || "",
            imageUrl: data.imageUrl || "",
            price: data.price || 10,
            totalNumbers: data.totalNumbers || 100,
            isRaffleActive: data.isRaffleActive !== false,
            createdAt: data.createdAt || new Date().toISOString(),
            ...data,
          });
        });

        // Sort: active first, current first, then created date descending
        rafflesList.sort((a, b) => {
          if (a.id === "current") return -1;
          if (b.id === "current") return 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        return res.status(200).json({ success: true, raffles: rafflesList });
      }

      case "create-raffle": {
        const { config: newRaffleConfig } = req.body;
        const newRaffleId = "rf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
        console.log(`✨ [Admin Action] Creating new raffle with ID: ${newRaffleId}`);

        const baseConfig = newRaffleConfig || {};
        const rafflePayload = {
          id: newRaffleId,
          title: String(baseConfig.title || "Nova Rifa Master").trim(),
          description: String(baseConfig.description || "Descrição da nova rifa").trim(),
          imageUrl: String(baseConfig.imageUrl || "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80").trim(),
          price: Number(baseConfig.price) || 10,
          totalNumbers: Number(baseConfig.totalNumbers) || 100,
          status: "ativa",
          isRaffleActive: true,
          isActive: true,
          promotionEnabled: Boolean(baseConfig.promotionEnabled),
          promotionBuy: baseConfig.promotionBuy || null,
          promotionBonus: baseConfig.promotionBonus || null,
          pixKey: String(baseConfig.pixKey || "").trim(),
          pixReceiver: String(baseConfig.pixReceiver || "").trim(),
          pixBank: String(baseConfig.pixBank || "").trim(),
          pixPhone: String(baseConfig.pixPhone || "").trim(),
          winnerNumber: "",
          winnerName: "",
          videoLink: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          adminToken: computedLegacyToken,
        };

        await setDoc(doc(db, "raffles", newRaffleId), rafflePayload);
        console.log(`[MULTI_RIFA] Successfully created new raffle document at raffles/${newRaffleId}`);
        return res.status(200).json({ success: true, raffleId: newRaffleId, config: rafflePayload });
      }

      case "duplicate-raffle": {
        const { sourceRaffleId } = req.body;
        if (!sourceRaffleId) {
          return res.status(400).json({ error: "ID da rifa de origem (sourceRaffleId) é obrigatório." });
        }

        console.log(`👯 [Admin Action] Duplicating raffle from source ID: ${sourceRaffleId}`);
        const sourceSnap = await getDoc(doc(db, "raffles", sourceRaffleId));
        if (!sourceSnap.exists()) {
          return res.status(404).json({ error: "Rifa de origem não encontrada." });
        }

        const sourceData = sourceSnap.data();
        const newRaffleId = "rf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

        const duplicatePayload = {
          ...sourceData,
          id: newRaffleId,
          title: `${sourceData.title || "Nova Rifa"} (Cópia)`,
          winnerNumber: "",
          winnerName: "",
          videoLink: "",
          status: "ativa",
          isRaffleActive: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          adminToken: computedLegacyToken,
        };

        await setDoc(doc(db, "raffles", newRaffleId), duplicatePayload);
        console.log(`[MULTI_RIFA] Successfully duplicated raffle to raffles/${newRaffleId}`);
        return res.status(200).json({ success: true, raffleId: newRaffleId, config: duplicatePayload });
      }

      case "archive-raffle": {
        const targetId = req.body.raffleId;
        if (!targetId) return res.status(400).json({ error: "ID da rifa é obrigatório." });

        console.log(`📦 [Admin Action] Archiving raffle ID: ${targetId}`);
        await updateDoc(doc(db, "raffles", targetId), {
          status: "arquivada",
          isRaffleActive: false,
          isActive: false,
          updatedAt: new Date().toISOString(),
          adminToken: computedLegacyToken,
        });
        return res.status(200).json({ success: true });
      }

      case "end-raffle": {
        const targetId = req.body.raffleId;
        if (!targetId) return res.status(400).json({ error: "ID da rifa é obrigatório." });

        console.log(`🏁 [Admin Action] Ending raffle ID: ${targetId}`);
        await updateDoc(doc(db, "raffles", targetId), {
          status: "encerrada",
          isRaffleActive: false,
          isActive: false,
          updatedAt: new Date().toISOString(),
          adminToken: computedLegacyToken,
        });
        return res.status(200).json({ success: true });
      }

      case "delete-raffle": {
        const targetId = req.body.raffleId;
        if (!targetId) return res.status(400).json({ error: "ID da rifa é obrigatório." });

        console.log(`🗑️ [Admin Action] Deleting raffle ID: ${targetId}`);

        // 1. Delete numbers subcollection
        const numbersSnap = await getDocs(collection(db, "raffles", targetId, "numbers"));
        if (!numbersSnap.empty) {
          const docsArray = numbersSnap.docs;
          for (let i = 0; i < docsArray.length; i += 100) {
            const chunk = docsArray.slice(i, i + 100);
            const batch = writeBatch(db);
            chunk.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }

        // 2. Delete linked orders, reservations, and payments
        const ordersSnap = await getDocs(collection(db, "orders"));
        const ordersToDelete: string[] = [];
        const paymentsToDelete: string[] = [];

        ordersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const orderRaffleId = data.raffleId || "current";
          if (orderRaffleId === targetId) {
            ordersToDelete.push(docSnap.id);
            if (data.paymentId) paymentsToDelete.push(data.paymentId);
            paymentsToDelete.push("SIM_" + docSnap.id);
          }
        });

        if (ordersToDelete.length > 0) {
          for (let i = 0; i < ordersToDelete.length; i += 100) {
            const chunk = ordersToDelete.slice(i, i + 100);
            const batch = writeBatch(db);
            chunk.forEach((orderId) => {
              batch.delete(doc(db, "orders", orderId));
              batch.delete(doc(db, "reservations", orderId));
            });
            await batch.commit();
          }
        }

        if (paymentsToDelete.length > 0) {
          const uniquePayments = Array.from(new Set(paymentsToDelete));
          for (let i = 0; i < uniquePayments.length; i += 100) {
            const chunk = uniquePayments.slice(i, i + 100);
            const batch = writeBatch(db);
            chunk.forEach((payId) => batch.delete(doc(db, "payments", payId)));
            await batch.commit();
          }
        }

        // 3. Delete raffle document
        await deleteDoc(doc(db, "raffles", targetId));

        console.log(`[MULTI_RIFA] Successfully deleted raffle document at raffles/${targetId} and all associated data.`);
        return res.status(200).json({ success: true });
      }

      case "update-winner": {
        const { winnerId, data } = req.body;
        if (!winnerId || !data) return res.status(400).json({ error: "ID e dados do ganhador são obrigatórios." });

        console.log(`✏️ [Admin Action] Updating winner ID: ${winnerId}`);
        await updateDoc(doc(db, "winners_history", winnerId), {
          ...data,
          updatedAt: new Date().toISOString(),
        });
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`❌ [Admin Action] Error processing action '${action}':`, err);
    return res.status(500).json({ error: err.message || "Failed to process administrative action." });
  }
}
