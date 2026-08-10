import "dotenv/config";
import { getAdminFirestore } from "./_firebaseAdmin.js";
import { getSupabaseAdmin, getSupabaseClient } from "../src/services/supabase/supabaseClient.js";

function setCorsHeaders(req: any, res: any) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function maskPhoneNumber(phoneDigits: string): string {
  if (!phoneDigits) return "";
  if (phoneDigits.length >= 10) {
    const ddd = phoneDigits.slice(0, 2);
    const firstDigit = phoneDigits.length === 11 ? phoneDigits.slice(2, 3) : "";
    const lastFour = phoneDigits.slice(-4);
    return `(${ddd}) ${firstDigit}****-${lastFour}`;
  }
  return phoneDigits.slice(0, 2) + "****" + phoneDigits.slice(-2);
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawPhone = req.method === "POST" ? req.body?.phone : req.query?.phone;
  const canonicalPhone = String(rawPhone || "").replace(/\D/g, "");

  if (!canonicalPhone || canonicalPhone.length < 8) {
    return res.status(200).json({
      success: true,
      phone: canonicalPhone,
      maskedPhone: maskPhoneNumber(canonicalPhone),
      orders: [],
    });
  }

  try {
    const orderMap = new Map<string, any>();
    const raffleTitleMap = new Map<string, string>();

    // 1. Load raffle titles cache from Firestore
    try {
      const adminDb = getAdminFirestore();
      if (adminDb) {
        const rafflesSnap = await adminDb.collection("raffles").get();
        rafflesSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.title) {
            raffleTitleMap.set(docSnap.id, data.title);
          }
        });
      }
    } catch (rErr) {
      console.warn("⚠️ [Customer History] Could not load raffle titles:", rErr);
    }

    // 2. Fetch Operational Orders from Firestore (using Admin SDK)
    try {
      const adminDb = getAdminFirestore();
      if (adminDb) {
        const fsOrdersSnap = await adminDb
          .collection("orders")
          .where("phone", "==", canonicalPhone)
          .get();

        fsOrdersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const orderId = docSnap.id;
          const status = String(data.status || "").toLowerCase();

          // Standardize status
          let cleanStatus = data.status || "Aguardando";
          if (status === "paid" || status === "approved" || status === "pago") {
            cleanStatus = "Pago";
          } else if (status === "canceled" || status === "cancelado" || status === "expired") {
            cleanStatus = "Cancelado";
          } else if (status === "pending_payment" || status === "aguardando") {
            cleanStatus = "Aguardando";
          }

          const raffleId = data.raffleId || "current";
          const raffleTitle = raffleTitleMap.get(raffleId) || data.raffleTitle || "Rifa";

          orderMap.set(orderId, {
            id: orderId,
            raffleId,
            raffleTitle,
            name: data.name || "Cliente",
            phone: maskPhoneNumber(canonicalPhone),
            nums: Array.isArray(data.nums) ? data.nums : [],
            val: Number(data.val || 0),
            status: cleanStatus,
            paymentId: data.paymentId || null,
            createdAt: data.createdAt || new Date().toISOString(),
            source: "firestore",
          });
        });
      }
    } catch (fsErr) {
      console.warn("⚠️ [Customer History] Firestore query warning:", fsErr);
    }

    // 3. Fetch Permanent History from Supabase
    try {
      const supabase = getSupabaseAdmin() || getSupabaseClient();
      if (supabase) {
        const { data: supabasePurchases, error } = await supabase
          .from("purchase_history")
          .select("*")
          .eq("customer_phone", canonicalPhone)
          .order("created_at", { ascending: false })
          .limit(100);

        if (!error && Array.isArray(supabasePurchases)) {
          supabasePurchases.forEach((p: any) => {
            const orderId = p.firestore_order_id;
            if (!orderId) return;

            // Only treat approved/completed purchases as completed in historical records
            const payStatus = String(p.payment_status || "").toLowerCase();
            const purStatus = String(p.purchase_status || "").toLowerCase();
            const isApproved = payStatus === "approved" || purStatus === "completed" || payStatus === "paid" || payStatus === "pago";

            // If existing in Firestore map, update or enrich
            const existing = orderMap.get(orderId);

            if (isApproved) {
              const raffleId = p.raffle_id || existing?.raffleId || "current";
              const raffleTitle = raffleTitleMap.get(raffleId) || existing?.raffleTitle || "Rifa";

              orderMap.set(orderId, {
                id: orderId,
                raffleId,
                raffleTitle,
                name: p.customer_name || existing?.name || "Cliente",
                phone: maskPhoneNumber(canonicalPhone),
                nums: existing?.nums || [],
                val: Number(p.amount || existing?.val || 0),
                status: "Pago",
                paymentId: p.payment_id || existing?.paymentId || null,
                createdAt: p.created_at || existing?.createdAt || new Date().toISOString(),
                source: "supabase",
              });
            }
          });
        }
      }
    } catch (spErr) {
      console.warn("⚠️ [Customer History] Supabase query warning:", spErr);
    }

    // 4. Combine and Sort by createdAt Descending
    const finalOrders = Array.from(orderMap.values());
    finalOrders.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return res.status(200).json({
      success: true,
      phone: canonicalPhone,
      maskedPhone: maskPhoneNumber(canonicalPhone),
      orders: finalOrders.slice(0, 50),
    });
  } catch (err: any) {
    console.error("❌ [Customer History API Error]:", err);
    return res.status(500).json({ error: "Erro interno ao buscar histórico do cliente." });
  }
}
