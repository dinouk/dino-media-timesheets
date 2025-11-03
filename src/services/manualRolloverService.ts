import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ManualRollover = Database["public"]["Tables"]["manual_rollovers"]["Row"];
type ManualRolloverInsert = Database["public"]["Tables"]["manual_rollovers"]["Insert"];
type ManualRolloverUpdate = Database["public"]["Tables"]["manual_rollovers"]["Update"];

export const manualRolloverService = {
  async getManualRollovers(userId: string) {
    const { data, error } = await supabase
      .from("manual_rollovers")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return data as ManualRollover[];
  },

  async getManualRollover(clientId: string, month: string) {
    const { data, error } = await supabase
      .from("manual_rollovers")
      .select("*")
      .eq("client_id", clientId)
      .eq("month", month)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data as ManualRollover | null;
  },

  async upsertManualRollover(rollover: Omit<ManualRolloverInsert, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("manual_rollovers")
      .upsert([rollover], { onConflict: "client_id,month" })
      .select()
      .single();

    if (error) throw error;
    return data as ManualRollover;
  }
};