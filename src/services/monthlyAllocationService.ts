import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MonthlyAllocation = Database["public"]["Tables"]["monthly_allocations"]["Row"];
type MonthlyAllocationInsert = Database["public"]["Tables"]["monthly_allocations"]["Insert"];
type MonthlyAllocationUpdate = Database["public"]["Tables"]["monthly_allocations"]["Update"];

export const monthlyAllocationService = {
  async getMonthlyAllocations(userId: string) {
    const { data, error } = await supabase
      .from("monthly_allocations")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return data as MonthlyAllocation[];
  },

  async getMonthlyAllocation(clientId: string, month: string) {
    const { data, error } = await supabase
      .from("monthly_allocations")
      .select("*")
      .eq("client_id", clientId)
      .eq("month", month)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data as MonthlyAllocation | null;
  },

  async upsertMonthlyAllocation(allocation: Omit<MonthlyAllocationInsert, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("monthly_allocations")
      .upsert([allocation], { onConflict: "client_id,month" })
      .select()
      .single();

    if (error) throw error;
    return data as MonthlyAllocation;
  },

  async updateMonthlyAllocation(clientId: string, month: string, updates: MonthlyAllocationUpdate) {
    const { data, error } = await supabase
      .from("monthly_allocations")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("month", month)
      .select()
      .single();

    if (error) throw error;
    return data as MonthlyAllocation;
  }
};