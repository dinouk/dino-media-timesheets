import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type FileAttachment = Database["public"]["Tables"]["file_attachments"]["Row"];
type FileAttachmentInsert = Database["public"]["Tables"]["file_attachments"]["Insert"];

export const fileAttachmentService = {
  async getFileAttachments(timeEntryId: string) {
    const { data, error } = await supabase
      .from("file_attachments")
      .select("*")
      .eq("time_entry_id", timeEntryId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data as FileAttachment[];
  },

  async createFileAttachment(attachment: Omit<FileAttachmentInsert, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("file_attachments")
      .insert([attachment])
      .select()
      .single();

    if (error) throw error;
    return data as FileAttachment;
  },

  async deleteFileAttachment(id: string) {
    const { error } = await supabase
      .from("file_attachments")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  async deleteFileAttachmentsByTimeEntry(timeEntryId: string) {
    const { error } = await supabase
      .from("file_attachments")
      .delete()
      .eq("time_entry_id", timeEntryId);

    if (error) throw error;
    return true;
  }
};