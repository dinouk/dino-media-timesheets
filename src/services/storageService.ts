import { supabase } from "@/integrations/supabase/client";

export const storageService = {
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (error) throw error;
    return data;
  },

  async getPublicUrl(bucketName: string, filePath: string): Promise<string> {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
    return true;
  },

  async downloadFile(bucket: string, path: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;
    return data;
  },

  // Helper method for uploading brand logos
  async uploadBrandLogo(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;
    
    await this.uploadFile("brand-logos", filePath, file);
    return await this.getPublicUrl("brand-logos", filePath);
  },

  // Helper method for deleting brand logos
  async deleteBrandLogo(logoUrl: string): Promise<void> {
    // Extract the file path from the URL
    const urlParts = logoUrl.split("/brand-logos/");
    if (urlParts.length === 2) {
      const filePath = urlParts[1];
      await this.deleteFile("brand-logos", filePath);
    }
  }
};