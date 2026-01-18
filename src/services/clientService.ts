import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export const clientService = {
  async getClients(userId: string) {
    const { data, error } = await supabase
      .from("clients")
      .select(`
        *,
        brands (
          name,
          logo_url,
          brand_color
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as (Client & { brands: { name: string; logo_url: string; brand_color: string } | null })[];
  },

  async getClientById(id: string) {
    const { data, error } = await supabase
      .from("clients")
      .select(`
        *,
        brands (
          name,
          logo_url,
          brand_color
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as (Client & { brands: { name: string; logo_url: string; brand_color: string } | null });
  },

  async createClient(client: Omit<ClientInsert, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("clients")
      .insert([client])
      .select()
      .single();

    if (error) throw error;
    return data as Client;
  },

  async updateClient(id: string, updates: ClientUpdate) {
    const { data, error } = await supabase
      .from("clients")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Client;
  },

  async deleteClient(id: string) {
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  async archiveClient(id: string, archived: boolean) {
    return this.updateClient(id, { archived });
  }
};