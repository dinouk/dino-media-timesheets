import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Plus, Users, Clock, Settings, User, LogOut } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileIcon } from "lucide-react";
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
  file?: File;
  url?: string;
  path?: string;
  type: string;
  size: number;
}

interface AppHeaderProps {
  currentUser?: string;
}

export function AppHeader({ currentUser }: AppHeaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isAddingTimeLog, setIsAddingTimeLog] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [addForm, setAddForm] = useState({
    clientId: "",
    date: "",
    hours: "",
    description: "",
    tags: [] as string[],
    files: [] as FileUpload[],
  });
  const [submitting, setSubmitting] = useState(false);

  const minDate = "2025-10-01";
  const maxDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setMounted(true);
    if (user) {
      loadClients();
    }
  }, [user]);

  const loadClients = async () => {
    if (!user) return;
    
    try {
      const clientsData = await clientService.getClients(user.id);
      setClients(clientsData.filter(client => !client.archived));
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const handleOpenAddDialog = () => {
    setAddForm({
      clientId: "",
      date: new Date().toISOString().split("T")[0],
      hours: "",
      description: "",
      tags: [],
      files: [],
    });
    setIsAddingTimeLog(true);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
    } catch (error: any) {
      console.error("Error logging out:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to log out",
        variant: "destructive",
      });
    }
  };

  const handleAddFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
        return;
      }

      const fileData: FileUpload = {
        id: Date.now().toString() + Math.random(),
        name: file.name,
        displayName: file.name,
        file: file,
        type: file.type,
        size: file.size,
      };
      
      setAddForm(prev => ({
        ...prev,
        files: [...prev.files, fileData],
      }));
    });

    e.target.value = "";
  };

  const handleRemoveAddFile = (fileId: string) => {
    setAddForm(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId),
    }));
  };

  const handleUpdateAddFileDisplayName = (fileId: string, newDisplayName: string) => {
    setAddForm(prev => ({
      ...prev,
      files: prev.files.map(f => 
        f.id === fileId ? { ...f, displayName: newDisplayName } : f
      ),
    }));
  };

  const toggleAddTag = (tag: string) => {
    setAddForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleSubmitTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    const addClient = clients.find(c => c.id === addForm.clientId);
    if (!addClient) return;

    const clientTags = addClient.tags as string[] || [];
    const finalTags = clientTags.length === 1 ? clientTags : addForm.tags;

    if (!addForm.clientId || !addForm.date || !addForm.hours || finalTags.length === 0 || !addForm.description.trim() || !user) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields including description and select at least one tag",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const date = new Date(addForm.date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

      const newEntry = await timeEntryService.createTimeEntry({
        user_id: user.id,
        client_id: addForm.clientId,
        date: addForm.date,
        hours: parseFloat(addForm.hours),
        tags: finalTags,
        description: addForm.description.trim(),
        month: monthKey,
        year: date.getFullYear(),
      });

      if (addForm.files.length > 0) {
        for (const fileUpload of addForm.files) {
          if (fileUpload.file) {
            const filePath = `${user.id}/${newEntry.id}/${Date.now()}-${fileUpload.file.name}`;
            
            await storageService.uploadFile("time-entry-files", filePath, fileUpload.file);
            
            const fileUrl = await storageService.getPublicUrl("time-entry-files", filePath);

            await fileAttachmentService.createFileAttachment({
              user_id: user.id,
              time_entry_id: newEntry.id,
              file_name: fileUpload.name,
              display_name: fileUpload.displayName,
              file_url: fileUrl,
              file_path: filePath,
              file_type: fileUpload.file.type,
              file_size: fileUpload.file.size,
            });
          }
        }
      }

      toast({
        title: "Time Entry Created",
        description: "Your time entry has been successfully logged",
      });

      setIsAddingTimeLog(false);
      
      router.push({
        pathname: "/time-logs",
        query: { clientId: addForm.clientId, period: monthKey }
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

  const selectedAddClient = clients.find(c => c.id === addForm.clientId);
  const addClientTags = selectedAddClient ? (selectedAddClient.tags as string[] || []) : [];
  const shouldShowAddTags = addClientTags.length > 1;

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/time-logs", label: "Time Logs" },
    { href: "/rollover-management", label: "Rollover Management" },
    { href: "/settings", label: "Settings" },
    { href: "/my-account", label: "My Account" },
  ];

  if (!mounted) return null;

  return (
    <>
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <div className="cursor-pointer">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-primary to-slate-700 bg-clip-text text-transparent">
                Timesheets
              </h1>
              {currentUser && (
                <p className="text-sm text-slate-600 mt-0.5">{currentUser}</p>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {/* Desktop navigation links */}
            <div className="hidden md:flex items-center gap-2">
              <Link href="/clients">
                <Button variant="ghost" className="gap-2">
                  <Users className="w-4 h-4" />
                  Clients
                </Button>
              </Link>
              <Link href="/time-logs">
                <Button variant="ghost" className="gap-2">
                  <Clock className="w-4 h-4" />
                  Time Logs
                </Button>
              </Link>
            </div>

            <Button 
              variant="default"
              className="bg-brand-primary hover:bg-brand-primary-hover h-10 gap-2"
              title="Log Time"
              onClick={handleOpenAddDialog}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden md:inline">Log Time</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-10 w-10">
                  <Menu className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/clients" className="flex items-center gap-2 cursor-pointer">
                    <Users className="w-4 h-4" />
                    Clients
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/time-logs" className="flex items-center gap-2 cursor-pointer">
                    <Clock className="w-4 h-4" />
                    Time Logs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/my-account" className="flex items-center gap-2 cursor-pointer">
                    <User className="w-4 h-4" />
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {isAddingTimeLog && (
        <Dialog open={isAddingTimeLog} onOpenChange={setIsAddingTimeLog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Time Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitTimeEntry} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="add-client">Client *</Label>
                <Select value={addForm.clientId} onValueChange={(value) => setAddForm({ ...addForm, clientId: value, tags: [] })}>
                  <SelectTrigger id="add-client">
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
                <Label htmlFor="add-date">Date *</Label>
                <Input
                  id="add-date"
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                  min={minDate}
                  max={maxDate}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-hours">Hours (15-minute intervals) *</Label>
                <Select
                  value={addForm.hours}
                  onValueChange={(value) => setAddForm({ ...addForm, hours: value })}
                >
                  <SelectTrigger id="add-hours">
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
                <Label htmlFor="add-description">Task Description *</Label>
                <Textarea
                  id="add-description"
                  placeholder="Describe the work performed..."
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-files">File Attachments (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="add-files"
                    type="file"
                    onChange={handleAddFileUpload}
                    multiple
                    className="cursor-pointer"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => document.getElementById("add-files")?.click()}
                    title="Upload files"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Max 5MB per file. Supports PDF, images, documents, and spreadsheets.</p>
                
                {addForm.files.length > 0 && (
                  <div className="space-y-2 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm font-medium text-slate-700">Attached Files ({addForm.files.length})</p>
                    <div className="space-y-2">
                      {addForm.files.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                          <FileIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <Input
                            type="text"
                            value={file.displayName}
                            onChange={(e) => handleUpdateAddFileDisplayName(file.id, e.target.value)}
                            className="h-8 text-sm flex-1"
                            placeholder="Display name..."
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAddFile(file.id)}
                            className="flex-shrink-0 h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {shouldShowAddTags && selectedAddClient && (
                <div className="space-y-2">
                  <Label>Tags *</Label>
                  <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-slate-50">
                    {addClientTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={addForm.tags.includes(tag) ? "default" : "outline"}
                        className={`cursor-pointer transition-all ${
                          addForm.tags.includes(tag)
                            ? "bg-brand-primary hover:bg-brand-primary-hover"
                            : "hover:bg-slate-200"
                        }`}
                        onClick={() => toggleAddTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingTimeLog(false)}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800"
                  disabled={submitting}
                >
                  {submitting ? "Logging..." : "Log Time Entry"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
