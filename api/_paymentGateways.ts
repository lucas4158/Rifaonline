/**
 * Gateway Architecture
 * Defines available payment gateways and normalization helpers for RifaMaster.
 * Current active gateway: Mercado Pago
 */

import { MercadoPagoConfig, Payment } from "mercadopago";
import { getAdminFirestore } from "./_firebaseAdmin.js";

export type PaymentGateway = "mercadopago" | "manual";

/**
 * Normalizes payment gateway strings from database or requests.
 * Preserves 'mercadopago' and 'manual'.
 * Legacy gateways (e.g. asaas) or unknown values gracefully fallback to 'mercadopago'.
 */
export function normalizePaymentGateway(gateway?: string | null): PaymentGateway {
  const g = String(gateway || "").toLowerCase().trim();
  if (g === "manual") {
    return "manual";
  }
  return "mercadopago";
}

/**
 * Dynamically retrieves a Mercado Pago Payment client using the token configured in the
 * active raffle document (mpAccessToken) or from environment variables (MP_ACCESS_TOKEN) as a fallback.
 */
export async function getDynamicMercadoPagoClient(raffleId?: string): Promise<any> {
  let accessToken = (process.env.MP_ACCESS_TOKEN || "").trim();
  const targetId = raffleId || "current";

  if (targetId) {
    try {
      const snap = await getAdminFirestore().collection("raffles").doc(targetId).get();
      if (snap.exists) {
        const data = snap.data();
        if (data && data.mpAccessToken && String(data.mpAccessToken).trim() !== "") {
          accessToken = String(data.mpAccessToken).trim();
          console.log(`🔑 [Mercado Pago Dynamic Client] Loaded accessToken from raffle config: ${targetId}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️ [Mercado Pago Dynamic Client] Failed to read from firestore for raffle ${targetId}:`, err);
    }
  }

  // Fallback to "global_pix" document if accessToken is still not found
  if (!accessToken || accessToken === "") {
    try {
      const snap = await getAdminFirestore().collection("raffles").doc("global_pix").get();
      if (snap.exists) {
        const data = snap.data();
        if (data && data.mpAccessToken && String(data.mpAccessToken).trim() !== "") {
          accessToken = String(data.mpAccessToken).trim();
          console.log("🔑 [Mercado Pago Dynamic Client] Loaded accessToken from 'global_pix' config");
        }
      }
    } catch (err) {
      console.warn("⚠️ [Mercado Pago Dynamic Client] Failed to read from 'global_pix' config:", err);
    }
  }

  // Fallback to "current" raffle document if accessToken is still not found and specified raffle was not "current"
  if ((!accessToken || accessToken === "") && targetId !== "current") {
    try {
      const snap = await getAdminFirestore().collection("raffles").doc("current").get();
      if (snap.exists) {
        const data = snap.data();
        if (data && data.mpAccessToken && String(data.mpAccessToken).trim() !== "") {
          accessToken = String(data.mpAccessToken).trim();
          console.log("🔑 [Mercado Pago Dynamic Client] Loaded accessToken from default 'current' raffle config");
        }
      }
    } catch (err) {
      console.warn("⚠️ [Mercado Pago Dynamic Client] Failed to read from default 'current' config:", err);
    }
  }

  if (!accessToken) {
    console.warn("⚠️ [Mercado Pago Dynamic Client] No MP_ACCESS_TOKEN found in environment variables or Firestore raffle configs.");
    return null;
  }

  try {
    const mpClient = new MercadoPagoConfig({ accessToken });
    return new Payment(mpClient);
  } catch (err) {
    console.error("❌ [Mercado Pago Dynamic Client] Error initializing Mercado Pago Config / Payment client:", err);
    return null;
  }
}

