import { getSupabaseAdmin, getSupabaseClient } from "./supabaseClient.js";

export interface RaffleNumberRecord {
  raffle_id: string;
  number: string;
  status: string;
  order_id?: string | null;
  is_bonus?: boolean;
  reserved_until?: number | null;
  updated_at?: string;
}

export const raffleNumbersService = {
  /**
   * Fetches all numbers for a specific raffle from Supabase (public read).
   * Returns a record map keyed by number string.
   */
  async getRaffleNumbersMap(raffleId: string = "current"): Promise<Record<string, RaffleNumberRecord>> {
    const supabase = getSupabaseClient() || getSupabaseAdmin();
    if (!supabase) {
      console.warn("[SUPABASE_NUMBERS] Supabase client not available for getRaffleNumbersMap");
      return {};
    }

    try {
      const { data, error } = await supabase
        .from("raffle_numbers")
        .select("number, status, order_id, is_bonus, reserved_until, updated_at")
        .eq("raffle_id", raffleId);

      if (error) {
        console.warn("[SUPABASE_NUMBERS] Error fetching raffle numbers:", error.message);
        return {};
      }

      const map: Record<string, RaffleNumberRecord> = {};
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          map[item.number] = {
            raffle_id: raffleId,
            number: item.number,
            status: item.status,
            order_id: item.order_id,
            is_bonus: Boolean(item.is_bonus),
            reserved_until: item.reserved_until ? Number(item.reserved_until) : null,
            updated_at: item.updated_at,
          };
        });
      }
      return map;
    } catch (err) {
      console.warn("[SUPABASE_NUMBERS] Exception fetching raffle numbers:", err);
      return {};
    }
  },

  /**
   * Upserts a number status into Supabase (admin/server side).
   */
  async upsertNumber(record: RaffleNumberRecord): Promise<boolean> {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from("raffle_numbers").upsert(
        {
          raffle_id: record.raffle_id || "current",
          number: String(record.number),
          status: record.status,
          order_id: record.order_id || null,
          is_bonus: Boolean(record.is_bonus),
          reserved_until: record.reserved_until || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "raffle_id,number" }
      );

      if (error) {
        console.warn(`[SUPABASE_NUMBERS] Failed upserting number ${record.number}:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[SUPABASE_NUMBERS] Exception upserting number ${record.number}:`, err);
      return false;
    }
  },

  /**
   * Deletes or resets a number when released/cancelled.
   */
  async deleteNumber(raffleId: string, number: string): Promise<boolean> {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("raffle_numbers")
        .delete()
        .eq("raffle_id", raffleId)
        .eq("number", String(number));

      if (error) {
        console.warn(`[SUPABASE_NUMBERS] Failed deleting number ${number}:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[SUPABASE_NUMBERS] Exception deleting number ${number}:`, err);
      return false;
    }
  }
};
