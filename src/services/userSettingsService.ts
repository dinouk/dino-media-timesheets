import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
type UserSettingsInsert = Database["public"]["Tables"]["user_settings"]["Insert"];
type UserSettingsUpdate = Database["public"]["Tables"]["user_settings"]["Update"];

export const userSettingsService = {
  async getUserSettings(userId: string) {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    
    // maybeSingle() returns null if no row found, or the single row if found
    return data as UserSettings | null;
  },

  async upsertUserSettings(settings: Omit<UserSettingsInsert, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("user_settings")
      .upsert([settings], { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    return data as UserSettings;
  },

  async updateUserSettings(userId: string, updates: UserSettingsUpdate) {
    const { data, error } = await supabase
      .from("user_settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data as UserSettings;
  }
};