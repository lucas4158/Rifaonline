import { getSupabaseAdmin, getSupabaseClient } from "./supabaseClient";

export interface PurchaseHistoryItem {
  firestore_order_id: string;
  raffle_id: string;
  customer_name?: string;
  customer_phone?: string;
  amount?: number;
  payment_id?: string;
  payment_status?: string;
  purchase_status?: string;
}

export const purchaseHistoryService = {
  /**
   * Idempotently saves or updates a purchase history entry in Supabase using firestore_order_id as unique constraint.
   */
  async recordPurchase(item: PurchaseHistoryItem): Promise<boolean> {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) {
      console.log("[SUPABASE_SYNC] Purchase history skipped (Supabase unconfigured)");
      return false;
    }

    try {
      const payload = {
        firestore_order_id: item.firestore_order_id,
        raffle_id: item.raffle_id || "current",
        customer_name: item.customer_name || "Cliente",
        customer_phone: item.customer_phone || "",
        amount: Number(item.amount || 0),
        payment_id: item.payment_id || null,
        payment_status: item.payment_status || "approved",
        purchase_status: item.purchase_status || "completed",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("purchase_history")
        .upsert(payload, { onConflict: "firestore_order_id" });

      if (error) {
        console.error("[SUPABASE_SYNC] purchase_history failed:", error.message);
        return false;
      }

      console.log(`[SUPABASE_SYNC] purchase_history: success (orderId: ${item.firestore_order_id})`);
      return true;
    } catch (err: any) {
      console.error("[SUPABASE_SYNC] purchase_history exception:", err?.message || err);
      return false;
    }
  },

  /**
   * Fetches purchase history for a given raffle with optional limit.
   */
  async getPurchasesByRaffle(raffleId: string, limitCount = 50) {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("purchase_history")
        .select("*")
        .eq("raffle_id", raffleId)
        .order("created_at", { ascending: false })
        .limit(limitCount);

      if (error) {
        console.error("Failed to query purchase_history:", error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      return [];
    }
  }
};
