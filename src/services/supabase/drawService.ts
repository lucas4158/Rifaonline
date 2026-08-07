import { getSupabaseAdmin, getSupabaseClient } from "./supabaseClient.js";

export interface DrawItem {
  firestore_draw_id?: string;
  raffle_id: string;
  status: string; // e.g., 'completed', 'legacy'
  method?: string; // e.g., 'deterministic_seed', 'federal_lottery'
  seed?: string | null;
  winner_number?: string;
  winner_name?: string;
  participants_count?: number;
  participants_hash?: string;
  algorithm_version?: string;
  seed_version?: string;
  executed_by?: string;
  executed_at?: string;
}

export const drawService = {
  /**
   * Idempotently saves or updates a draw record in Supabase.
   */
  async recordDraw(item: DrawItem): Promise<boolean> {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) {
      console.log("[SUPABASE_SYNC] Draw record skipped (Supabase unconfigured)");
      return false;
    }

    try {
      const payload = {
        firestore_draw_id: item.firestore_draw_id || `draw_${item.raffle_id}_${Date.now()}`,
        raffle_id: item.raffle_id || "current",
        status: item.status || "completed",
        method: item.method || "deterministic_seed",
        seed: item.seed !== undefined ? item.seed : null, // Legacy draws keep seed = null
        winner_number: item.winner_number || null,
        winner_name: item.winner_name || null,
        participants_count: item.participants_count || 0,
        participants_hash: item.participants_hash || null,
        algorithm_version: item.algorithm_version || "SHA-256",
        seed_version: item.seed_version || "v1",
        executed_by: item.executed_by || "Admin",
        executed_at: item.executed_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("draws")
        .upsert(payload, { onConflict: "firestore_draw_id" });

      if (error) {
        console.error("[SUPABASE_SYNC] draws failed:", error.message);
        return false;
      }

      console.log(`[SUPABASE_SYNC] draws: success (raffleId: ${item.raffle_id}, winner: ${item.winner_number})`);
      return true;
    } catch (err: any) {
      console.error("[SUPABASE_SYNC] draws exception:", err?.message || err);
      return false;
    }
  },

  /**
   * Fetches recorded draws for a raffle.
   */
  async getDraws(raffleId: string) {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("draws")
        .select("*")
        .eq("raffle_id", raffleId)
        .order("created_at", { ascending: false });

      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  }
};
