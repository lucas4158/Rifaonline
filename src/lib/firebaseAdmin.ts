import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let adminDb: admin.firestore.Firestore | null = null;

export function isAdminInitialized(): boolean {
  return adminDb !== null;
}

export function getAdminFirestore(): admin.firestore.Firestore {
  if (adminDb) {
    return adminDb;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("❌ [Firebase Admin] Variável de ambiente FIREBASE_SERVICE_ACCOUNT não definida!");
  }

  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (err: any) {
    throw new Error("❌ [Firebase Admin] Falha ao fazer parse do JSON em FIREBASE_SERVICE_ACCOUNT: " + err.message);
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  console.log(`🔒 [Firebase Admin] Initialized Admin SDK successfully for project_id: "${serviceAccount.project_id}", client_email: "${serviceAccount.client_email}"`);

  let app: admin.app.App;
  if (!admin.apps.length) {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    app = admin.app();
  }

  let databaseId = "(default)";

  // If explicit FIREBASE_DATABASE_ID env var is provided and not the AI Studio default
  if (process.env.FIREBASE_DATABASE_ID && !process.env.FIREBASE_DATABASE_ID.startsWith("ai-studio-")) {
    databaseId = process.env.FIREBASE_DATABASE_ID;
  } else if (serviceAccount.project_id === "coastal-ceiling-sw1xt") {
    // Only use AI Studio applet database ID if we are running in the AI Studio sandbox project
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config.firestoreDatabaseId) {
          databaseId = config.firestoreDatabaseId;
        }
      }
    } catch (e) {
      console.warn("⚠️ [Firebase Admin] Failed to read firebase-applet-config.json:", e);
    }
  }

  console.log(`🔒 [Firebase Admin] Connecting Admin Firestore for project "${serviceAccount.project_id}" (database: "${databaseId}")`);

  adminDb = getFirestore(app, databaseId) as unknown as admin.firestore.Firestore;
  return adminDb;
}
