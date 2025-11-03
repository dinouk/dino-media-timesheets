import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
type TimeEntryInsert = Database["public"]["Tables"]["time_entries"]["Insert"];
type TimeEntryUpdate = Database["public"]["Tables"]["time_entries"]["Update"];

export const timeEntryService = {
  async getTimeEntries(userId: string) {
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) throw error;
    return data as TimeEntry[];
  },

  async getTimeEntriesByClient(clientId: string) {
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false });

    if (error) throw error;
    return data as TimeEntry[];
  },

  async getTimeEntriesByMonth(clientId: string, month: string) {
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("client_id", clientId)
      .eq("month", month)
      .order("date", { ascending: false });

    if (error) throw error;
    return data as TimeEntry[];
  },

  async createTimeEntry(entry: Omit<TimeEntryInsert, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("time_entries")
      .insert([entry])
      .select()
      .single();

    if (error) throw error;
    return data as TimeEntry;
  },

  async updateTimeEntry(id: string, updates: TimeEntryUpdate) {
    const { data, error } = await supabase
      .from("time_entries")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as TimeEntry;
  },

  async deleteTimeEntry(id: string) {
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  }
};