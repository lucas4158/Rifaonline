import { getSupabaseAdmin, getSupabaseClient } from "./supabaseClient.js";

export interface AdminNotificationItem {
  firestore_event_id: string;
  type: string; // e.g. 'new_paid_order'
  title: string;
  customer_name?: string;
  customer_phone?: string;
  amount?: number;
  raffle_id: string;
}

export const notificationService = {
  /**
   * Idempotently logs a paid purchase notification in Supabase using firestore_event_id as unique constraint.
   */
  async recordNotification(item: AdminNotificationItem): Promise<boolean> {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) {
      console.log("[SUPABASE_SYNC] Notification skipped (Supabase unconfigured)");
      return false;
    }

    try {
      const payload = {
        firestore_event_id: item.firestore_event_id,
        type: item.type || "new_paid_order",
        title: item.title || "Nova compra confirmada",
        customer_name: item.customer_name || "Cliente",
        customer_phone: item.customer_phone || "",
        amount: Number(item.amount || 0),
        raffle_id: item.raffle_id || "current",
        read: false,
      };

      const { error } = await supabase
        .from("admin_notifications")
        .upsert(payload, { onConflict: "firestore_event_id" });

      if (error) {
        console.error("[SUPABASE_SYNC] admin_notifications failed:", error.message);
        return false;
      }

      console.log(`[SUPABASE_SYNC] admin_notifications: success (eventId: ${item.firestore_event_id})`);
      return true;
    } catch (err: any) {
      console.error("[SUPABASE_SYNC] admin_notifications exception:", err?.message || err);
      return false;
    }
  },

  async getUnreadNotifications(raffleId?: string) {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) return [];

    try {
      let query = supabase
        .from("admin_notifications")
        .select("*")
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (raffleId && raffleId !== "all") {
        query = query.eq("raffle_id", raffleId);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  }
};
