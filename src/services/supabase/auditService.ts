import { getSupabaseAdmin, getSupabaseClient } from "./supabaseClient";

export interface AuditLogItem {
  raffle_id: string;
  event_type: string; // e.g. payment_confirmed, reservation_expired, raffle_created, draw_completed
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  actor_name?: string;
  metadata?: Record<string, any>;
}

export const auditService = {
  /**
   * Inserts an audit log entry into Supabase. Safe against failures.
   */
  async logEvent(item: AuditLogItem): Promise<boolean> {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) {
      console.log("[SUPABASE_SYNC] Audit log skipped (Supabase unconfigured)");
      return false;
    }

    try {
      const payload = {
        raffle_id: item.raffle_id || "current",
        event_type: item.event_type,
        entity_type: item.entity_type || null,
        entity_id: item.entity_id || null,
        actor_id: item.actor_id || "system",
        actor_name: item.actor_name || "Sistema",
        metadata: item.metadata || {},
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("audit_logs").insert(payload);

      if (error) {
        console.error("[SUPABASE_SYNC] audit_logs failed:", error.message);
        return false;
      }

      console.log(`[SUPABASE_SYNC] audit_logs: success (event: ${item.event_type})`);
      return true;
    } catch (err: any) {
      console.error("[SUPABASE_SYNC] audit_logs exception:", err?.message || err);
      return false;
    }
  },

  /**
   * Fetches audit logs for a raffle.
   */
  async getAuditLogs(raffleId: string, limitCount = 100) {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("raffle_id", raffleId)
        .order("created_at", { ascending: false })
        .limit(limitCount);

      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  }
};
