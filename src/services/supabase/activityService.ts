import { getSupabaseAdmin, getSupabaseClient } from "./supabaseClient.js";

export interface ActivityLogItem {
  raffle_id: string;
  activity_type: string;
  description: string;
  metadata?: Record<string, any>;
}

export const activityService = {
  async logActivity(item: ActivityLogItem): Promise<boolean> {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) {
      console.log("[SUPABASE_SYNC] Activity log skipped (Supabase unconfigured)");
      return false;
    }

    try {
      const payload = {
        raffle_id: item.raffle_id || "current",
        activity_type: item.activity_type,
        description: item.description,
        metadata: item.metadata || {},
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("activity_logs").insert(payload);

      if (error) {
        console.error("[SUPABASE_SYNC] activity_logs failed:", error.message);
        return false;
      }

      console.log(`[SUPABASE_SYNC] activity_logs: success (${item.activity_type})`);
      return true;
    } catch (err: any) {
      console.error("[SUPABASE_SYNC] activity_logs exception:", err?.message || err);
      return false;
    }
  }
};
