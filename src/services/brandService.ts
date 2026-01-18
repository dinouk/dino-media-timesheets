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

  async createBrand(brand: Omit<BrandInsert, "id" | "created_at" | "updated_at">): Promise<Brand> {
    const { data, error } = await supabase
      .from("brands")
      .insert(brand)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateBrand(id: string, updates: BrandUpdate): Promise<Brand> {
    const { data, error } = await supabase
      .from("brands")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteBrand(id: string): Promise<void> {
    const { error } = await supabase
      .from("brands")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async uploadBrandLogo(userId: string, brandId: string, file: File): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${brandId}/logo.${fileExt}`;
    const filePath = `brand-logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("user-files")
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("user-files")
      .getPublicUrl(filePath);

    return publicUrl;
  },
};