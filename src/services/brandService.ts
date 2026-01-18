import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Brand = Database["public"]["Tables"]["brands"]["Row"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];

export const brandService = {
  async getBrands(userId: string): Promise<Brand[]> {
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getBrand(brandId: string): Promise<Brand | null> {
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .single();

    if (error) throw error;
    return data;
  },

  async createBrand(brand: BrandInsert): Promise<Brand> {
    const { data, error } = await supabase
      .from("brands")
      .insert(brand)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateBrand(brandId: string, updates: BrandUpdate): Promise<Brand> {
    const { data, error } = await supabase
      .from("brands")
      .update(updates)
      .eq("id", brandId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteBrand(brandId: string): Promise<void> {
    const { error } = await supabase
      .from("brands")
      .delete()
      .eq("id", brandId);

    if (error) throw error;
  }
};