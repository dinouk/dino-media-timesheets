import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, Upload, X, FileIcon } from "lucide-react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { clientService } from "@/services/clientService";
import { timeEntryService } from "@/services/timeEntryService";
import { storageService } from "@/services/storageService";
import { fileAttachmentService } from "@/services/fileAttachmentService";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];

interface FileUpload {
  id: string;
  name: string;
  displayName: string;
  file: File;
  preview?: string;
}

export default function LogTimePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [hours, setHours] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const minDate = "2025-10-01";
  const maxDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setMounted(true);
    if (!loading && !user) {
      router.push("/");
      return;
    }
    if (user) {
      loadClients();
    }
    setSelectedDate(new Date().toISOString().split("T")[0]);
  }, [user, loading, router]);

  useEffect(() => {
    if (clients.length > 0 && router.query.clientId && typeof router.query.clientId === "string") {
      setSelectedClientId(router.query.clientId);
    }
  }, [router.query.clientId, clients]);

  const loadClients = async () => {
    if (!user) return;
    
    try {
      setLoadingData(true);
      const clientsData = await clientService.getClients(user.id);
      setClients(clientsData.filter(client => !client.archived));
    } catch (error) {
      console.error("Error loading clients:", error);
      toast({
        title: "Error Loading Clients",
        description: "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    Array.from(uploadedFiles).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
        return;
      }

      const newFile: FileUpload = {
        id: Date.now().toString() + Math.random().toString(),
        name: file.name,
        displayName: file.name,
        file: file,
      };

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          newFile.preview = event.target?.result as string;
          setFiles((prev) => [...prev, newFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setFiles((prev) => [...prev, newFile]);
      }
    });

    e.target.value = "";
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const updateFileDisplayName = (fileId: string, newDisplayName: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, displayName: newDisplayName } : f))
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId || !selectedDate || !hours || selectedTags.length === 0 || !description.trim() || !user) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields including description and select at least one tag",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const date = new Date(selectedDate);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

      const newEntry = await timeEntryService.createTimeEntry({
        user_id: user.id,
        client_id: selectedClientId,
        date: selectedDate,
        hours: parseFloat(hours),
        tags: selectedTags,
        description: description.trim(),
        month: monthKey,
        year: date.getFullYear(),
      });

      if (files.length > 0) {
        for (const fileUpload of files) {
          try {
            const filePath = `${user.id}/${newEntry.id}/${Date.now()}-${fileUpload.file.name}`;
            
            await storageService.uploadFile("time-entry-files", filePath, fileUpload.file);
            
            const fileUrl = await storageService.getPublicUrl("time-entry-files", filePath);

            await fileAttachmentService.createFileAttachment({
              time_entry_id: newEntry.id,
              file_name: fileUpload.name,
              display_name: fileUpload.displayName,
              file_url: fileUrl,
              file_path: filePath,
              file_type: fileUpload.file.type,
              file_size: fileUpload.file.size,
            });
          } catch (fileError) {
            console.error("Error uploading file:", fileError);
            toast({
              title: "File Upload Warning",
              description: `Failed to upload ${fileUpload.name}`,
              variant: "destructive",
            });
          }
        }
      }

      toast({
        title: "Time Entry Created",
        description: "Your time entry has been successfully logged",
      });

      router.push({
        pathname: "/time-logs",
        query: {
          clientId: selectedClientId,
          period: monthKey,
        },
      });
    } catch (error: any) {
      console.error("Error creating time entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create time entry",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={user?.email || ""} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Log Time</h2>
          <p className="text-slate-600">Record time spent on client projects</p>
        </div>

        <Card className="max-w-2xl mx-auto shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-brand-primary" />
              Record Time Entry
            </CardTitle>
            <CardDescription>Log time spent working on client projects</CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 mb-4">You need to add clients first</p>
                <Link href="/clients">
                  <Button>Go to Clients</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={minDate}
                    max={maxDate}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hours">Hours (15-minute intervals) *</Label>
                  <Select value={hours} onValueChange={setHours}>
                    <SelectTrigger id="hours">
                      <SelectValue placeholder="Select hours" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 33 }, (_, i) => i * 0.25).map((value) => (
                        <SelectItem key={value} value={value.toString()}>
                          {value} hours
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Task Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the work performed..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {selectedClient && (selectedClient.tags as string[]).length > 0 && (
                  <div className="space-y-2">
                    <Label>Tags * (select at least one)</Label>
                    <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-slate-50">
                      {(selectedClient.tags as string[]).map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${
                            selectedTags.includes(tag)
                              ? "bg-brand-primary hover:bg-brand-primary-hover"
                              : "hover:bg-slate-200"
                          }`}
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedClient && (selectedClient.tags as string[]).length === 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      This client has no tags. Add tags to the client first.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="files">Attachments (Optional)</Label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-brand-primary transition-colors">
                    <input
                      id="files"
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                    />
                    <label
                      htmlFor="files"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm font-medium text-slate-600">Click to upload files</span>
                      <span className="text-xs text-slate-500 mt-1">PDF, DOC, XLS, Images, TXT (Max 5MB)</span>
                    </label>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-sm font-medium text-slate-700">Attached Files ({files.length})</p>
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <FileIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <Input
                              type="text"
                              value={file.displayName}
                              onChange={(e) => updateFileDisplayName(file.id, e.target.value)}
                              placeholder="Display name..."
                              className="h-9 text-sm mb-1"
                            />
                            <p className="text-xs text-slate-500">
                              Original: {file.name} ({formatFileSize(file.file.size)})
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(file.id)}
                            className="flex-shrink-0 h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800"
                  disabled={!selectedClient || (selectedClient.tags as string[]).length === 0 || submitting}
                >
                  {submitting ? "Logging..." : "Log Time Entry"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}