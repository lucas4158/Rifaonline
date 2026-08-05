import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  clearIndexedDbPersistence,
  setLogLevel
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Set Silent Log Level
setLogLevel("silent");

// Active blocker for legacy Firebase Storage to prevent any direct or indirect invocation
export const getStorage = () => {
  console.error("❌ [LEGACY_FIREBASE_BLOCKED] Firebase Storage is deprecated and blocked in this application.");
  throw new Error("LEGACY FIREBASE STORAGE BLOCKED");
};
(window as any).getStorage = getStorage;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

let dbInstance;
try {
  dbInstance = dbId
    ? initializeFirestore(
        app,
        {
          experimentalForceLongPolling: true,
          localCache: memoryLocalCache(),
        },
        dbId,
      )
    : initializeFirestore(app, {
        experimentalForceLongPolling: true,
        localCache: memoryLocalCache(),
      });
} catch (e) {
  // Fallback if already initialized
  try {
    dbInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (err) {
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache(),
    });
  }
}

// Clear any corrupted local persistent disk caches from prior browser sessions
try {
  clearIndexedDbPersistence(dbInstance).catch((err) => {
    console.warn("Firestore cache cleanup non-fatal warning:", err);
  });
} catch (err) {
  console.warn("Firestore cache cleanup try-catch warning:", err);
}

export const db = dbInstance;
export const auth = getAuth(app);
