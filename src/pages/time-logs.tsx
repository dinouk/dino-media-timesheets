import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, Filter, AlertCircle, Plus, MoreVertical, Edit2, Save, X, Download, Upload, Calendar, Clock, TrendingUp as ArrowUp, FileIcon } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { clientService } from "@/services/clientService";
import { timeEntryService } from "@/services/timeEntryService";
import { monthlyAllocationService } from "@/services/monthlyAllocationService";
import { storageService } from "@/services/storageService";
import { fileAttachmentService } from "@/services/fileAttachmentService";
import { userSettingsService } from "@/services/userSettingsService";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
type MonthlyAllocation = Database["public"]["Tables"]["monthly_allocations"]["Row"];
type FileAttachment = Database["public"]["Tables"]["file_attachments"]["Row"];

interface ClientStats {
  allocatedHours: number;
  rolloverHours: number;
  usedHours: number;
  remainingHours: number;
}

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

export default function TimeLogsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [monthlyAllocations, setMonthlyAllocations] = useState<MonthlyAllocation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState({
    date: "",
    hours: "",
    description: "",
    tags: [] as string[],
    files: [] as FileUpload[],
  });
  const [editingRollover, setEditingRollover] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState(false);
  const [rolloverValue, setRolloverValue] = useState("");
  const [allocationValue, setAllocationValue] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [isAddingTimeLog, setIsAddingTimeLog] = useState(false);
  const [addForm, setAddForm] = useState({
    clientId: "",
    date: "",
    hours: "",
    description: "",
    tags: [] as string[],
    files: [] as FileUpload[],
  });

  const minDate = "2025-10-01";
  const maxDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setMounted(true);
    if (!loading && !user) {
      router.push("/");
      return;
    }
    if (user) {
      loadData();
    }
    
    if (!router.query.period) {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
      setSelectedPeriod(currentPeriod);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (clients.length > 0 && router.query.clientId && typeof router.query.clientId === "string") {
      setSelectedClientId(router.query.clientId);
      
      // Check if we should open add dialog
      if (router.query.add === "true") {
        handleOpenAddDialog(router.query.clientId);
        // Clean up URL
        router.replace({
          pathname: router.pathname,
          query: { clientId: router.query.clientId, period: router.query.period }
        }, undefined, { shallow: true });
      }
    }
    if (router.query.period && typeof router.query.period === "string") {
      setSelectedPeriod(router.query.period);
    }
  }, [router.query.clientId, router.query.period, router.query.add, clients]);
  
  // Separate effect to handle add dialog without clientId
  useEffect(() => {
    if (router.query.add === "true" && !router.query.clientId && clients.length > 0) {
      handleOpenAddDialog();
      // Clean up URL
      router.replace({
        pathname: router.pathname,
        query: router.query.period ? { period: router.query.period } : {}
      }, undefined, { shallow: true });
    }
  }, [router.query.add, router.query.clientId, clients.length]);

  // Calculate stats when client, period, or data changes
  useEffect(() => {
    if (!selectedClientId || !selectedPeriod) {
      setStats(null);
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) {
      setStats(null);
      return;
    }

    // Get monthly allocation for this period
    const allocation = monthlyAllocations.find(
      a => a.client_id === selectedClientId && a.month === selectedPeriod
    );

    // Calculate used hours from time entries
    const monthEntries = timeEntries.filter(
      entry => entry.client_id === selectedClientId && entry.month === selectedPeriod
    );
    const usedHours = monthEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

    // Determine allocated hours (from monthly allocation or client default)
    const allocatedHours = Number(allocation?.allocated_hours ?? client.allocated_hours_per_month);

    // Determine rollover hours (from monthly allocation)
    const rolloverHours = Number(allocation?.rollover_hours ?? 0);

    // Calculate remaining hours
    const remainingHours = allocatedHours + rolloverHours - usedHours;

    setStats({
      allocatedHours,
      rolloverHours,
      usedHours,
      remainingHours,
    });
  }, [selectedClientId, selectedPeriod, clients, timeEntries, monthlyAllocations]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoadingData(true);
      const [clientsData, entriesData, allocationsData, settingsData] = await Promise.all([
        clientService.getClients(user.id),
        timeEntryService.getTimeEntries(user.id),
        monthlyAllocationService.getMonthlyAllocations(user.id),
        userSettingsService.getUserSettings(user.id),
      ]);
      
      setClients(clientsData);
      setTimeEntries(entriesData);
      setMonthlyAllocations(allocationsData);
      
      if (settingsData?.company_logo_url) {
        setCompanyLogo(settingsData.company_logo_url);
      }

      const allFilePromises = entriesData.map(entry => 
        fileAttachmentService.getFileAttachments(entry.id)
      );
      const allFiles = await Promise.all(allFilePromises);
      setFileAttachments(allFiles.flat());
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load time logs data",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleEditEntry = async (entry: TimeEntry) => {
    setEditingEntry(entry);
    
    const entryFiles = await fileAttachmentService.getFileAttachments(entry.id);
    const filesForForm: FileUpload[] = entryFiles.map(f => ({
      id: f.id,
      name: f.file_name,
      displayName: f.display_name,
      url: f.file_url,
      path: f.file_path,
      type: f.file_type || "",
      size: f.file_size || 0,
    }));

    setEditForm({
      date: entry.date,
      hours: entry.hours.toString(),
      description: entry.description,
      tags: [...(entry.tags as string[])],
      files: filesForForm,
    });
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingEntry || !editForm.date || !editForm.hours || editForm.tags.length === 0 || !editForm.description.trim() || !user) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields including description and select at least one tag",
        variant: "destructive",
      });
      return;
    }

    try {
      const date = new Date(editForm.date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

      await timeEntryService.updateTimeEntry(editingEntry.id, {
        date: editForm.date,
        hours: parseFloat(editForm.hours),
        tags: editForm.tags,
        description: editForm.description.trim(),
        month: monthKey,
        year: date.getFullYear(),
      });

      const currentFiles = editForm.files.filter(f => !f.file);
      const existingFileAttachments = await fileAttachmentService.getFileAttachments(editingEntry.id);
      
      for (const existingFile of existingFileAttachments) {
        if (!currentFiles.find(f => f.id === existingFile.id)) {
          if (existingFile.file_path) {
            await storageService.deleteFile("time-entry-files", existingFile.file_path);
          }
          await fileAttachmentService.deleteFileAttachment(existingFile.id);
        }
      }

      const newFiles = editForm.files.filter(f => f.file);
      for (const fileUpload of newFiles) {
        if (fileUpload.file) {
          const filePath = `${user.id}/${editingEntry.id}/${Date.now()}-${fileUpload.file.name}`;
          
          await storageService.uploadFile("time-entry-files", filePath, fileUpload.file);
          
          const fileUrl = await storageService.getPublicUrl("time-entry-files", filePath);

          await fileAttachmentService.createFileAttachment({
            user_id: user.id,
            time_entry_id: editingEntry.id,
            file_name: fileUpload.name,
            display_name: fileUpload.displayName,
            file_url: fileUrl,
            file_path: filePath,
            file_type: fileUpload.file.type,
            file_size: fileUpload.file.size,
          });
        } else if (fileUpload.id && fileUpload.displayName !== fileUpload.name) {
          await fileAttachmentService.updateFileAttachment(fileUpload.id, {
            display_name: fileUpload.displayName,
          });
        }
      }

      // Complete state cleanup
      setEditingEntry(null);
      setEditForm({
        date: "",
        hours: "",
        description: "",
        tags: [],
        files: [],
      });
      
      // Ensure add dialog state is also clean
      setIsAddingTimeLog(false);
      
      await loadData();
      
      toast({
        title: "Time Entry Updated",
        description: "Your time entry has been successfully updated",
      });
    } catch (error: any) {
      console.error("Error updating time entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update time entry",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;

    try {
      const entryFiles = await fileAttachmentService.getFileAttachments(deletingEntry.id);
      
      for (const file of entryFiles) {
        if (file.file_path) {
          await storageService.deleteFile("time-entry-files", file.file_path);
        }
        await fileAttachmentService.deleteFileAttachment(file.id);
      }

      await timeEntryService.deleteTimeEntry(deletingEntry.id);

      toast({
        title: "Time Entry Deleted",
        description: "Your time entry has been successfully deleted",
      });

      setDeletingEntry(null);
      await loadData();
    } catch (error: any) {
      console.error("Error deleting time entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete time entry",
        variant: "destructive",
      });
    }
  };

  const toggleEditTag = (tag: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      
      setEditForm(prev => ({
        ...prev,
        files: [...prev.files, fileData],
      }));
    });

    e.target.value = "";
  };

  const handleRemoveEditFile = (fileId: string) => {
    setEditForm(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId),
    }));
  };

  const handleUpdateFileDisplayName = (fileId: string, newDisplayName: string) => {
    setEditForm(prev => ({
      ...prev,
      files: prev.files.map(f => 
        f.id === fileId ? { ...f, displayName: newDisplayName } : f
      ),
    }));
  };

  const handleOpenAddDialog = (preselectedClientId?: string) => {
    // Ensure edit dialog is completely closed
    setEditingEntry(null);
    setEditForm({
      date: "",
      hours: "",
      description: "",
      tags: [],
      files: [],
    });
    
    // Small delay to ensure DOM cleanup
    setTimeout(() => {
      // Set up fresh add form
      setAddForm({
        clientId: preselectedClientId || selectedClientId || "",
        date: new Date().toISOString().split("T")[0],
        hours: "",
        description: "",
        tags: [],
        files: [],
      });
      setIsAddingTimeLog(true);
    }, 50);
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
      setSelectedClientId(addForm.clientId);
      setSelectedPeriod(monthKey);
      
      router.push({
        pathname: "/time-logs",
        query: { clientId: addForm.clientId, period: monthKey }
      }, undefined, { shallow: true });
      
      await loadData();
    } catch (error: any) {
      console.error("Error creating time entry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create time entry",
        variant: "destructive",
      });
    }
  };

  const selectedAddClient = clients.find(c => c.id === addForm.clientId);
  const addClientTags = selectedAddClient ? (selectedAddClient.tags as string[] || []) : [];
  const shouldShowAddTags = addClientTags.length > 1;

  const filteredEntries = timeEntries
    .filter(entry => 
      entry.client_id === selectedClientId &&
      entry.month === selectedPeriod
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const activeClients = clients.filter(c => !c.archived);
  const archivedClients = clients.filter(c => c.archived);

  const handleExportPDF = async () => {
    if (!selectedClient || !stats) return;

    const [year, month] = selectedPeriod.split("-");
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' });
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    if (companyLogo) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = companyLogo;
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const imgWidth = img.width;
        const imgHeight = img.height;
        const aspectRatio = imgWidth / imgHeight;
        
        const maxLogoWidth = 30;
        const maxLogoHeight = 12;
        
        let logoWidth = maxLogoWidth;
        let logoHeight = logoWidth / aspectRatio;
        
        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight * aspectRatio;
        }
        
        doc.addImage(companyLogo, "PNG", (pageWidth - logoWidth) / 2, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 10;
      } catch (error) {
        console.error("Error adding logo to PDF:", error);
        yPos += 10;
      }
    }

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(selectedClient.name, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`${monthName} ${year}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    const boxWidth = (pageWidth - 28) / 4;
    const boxHeight = 25;
    const boxY = yPos;
    const boxPadding = 0;

    const statBoxes = [
      { label: "Rolled Over", value: stats.rolloverHours.toFixed(2), color: [1, 136, 169], icon: "arrow-up" },
      { label: "Allocated", value: stats.allocatedHours.toFixed(2), color: [1, 136, 169], icon: "clock" },
      { label: "Used", value: stats.usedHours.toFixed(2), color: [34, 197, 94], icon: "alert-circle" },
      { label: "Remaining", value: stats.remainingHours.toFixed(2), color: stats.remainingHours >= 0 ? [16, 185, 129] : [239, 68, 68], icon: "trending-down" }
    ];

    statBoxes.forEach((box, index) => {
      const x = 14 + (index * boxWidth);
      
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, boxY, boxWidth, boxHeight, 3, 3, "FD");
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(box.label, x + boxWidth / 2, boxY + boxHeight / 2 - 2, { align: "center" });
      
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "bold");
      doc.text(`${box.value}h`, x + boxWidth / 2, boxY + boxHeight / 2 + 4, { align: "center" });
      doc.setFont("helvetica", "normal");
    });

    yPos = boxY + boxHeight + 15;

    const entriesSortedAsc = [...filteredEntries].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const entriesWithFiles = await Promise.all(
      entriesSortedAsc.map(async (entry) => {
        const files = await fileAttachmentService.getFileAttachments(entry.id);
        return { entry, files };
      })
    );

    const tableData = entriesWithFiles.map(({ entry, files }) => [
      new Date(entry.date).toLocaleDateString(),
      entry.hours.toString(),
      entry.description,
      (entry.tags as string[]).join(", "),
      files.length > 0 ? files.map(f => f.display_name).join(", ") : "No files"
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Hours", "Description", "Tags", "Attachments"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [1, 136, 169],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 15, halign: "left" },
        2: { cellWidth: "auto" },
        3: { cellWidth: 30 },
        4: { cellWidth: 35 }
      },
      margin: { left: 14, right: 14 },
      tableWidth: "auto",
      didDrawCell: (data) => {
        if (data.column.index === 4 && data.section === "body" && data.row.index < entriesWithFiles.length) {
          const { files } = entriesWithFiles[data.row.index];
          if (files.length > 0) {
            const cell = data.cell;
            
            files.forEach((file, fileIndex) => {
              const linkY = cell.y + 5 + (fileIndex * 6);
              
              doc.setFontSize(8);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(1, 136, 169);
              doc.textWithLink(file.display_name, cell.x + 2, linkY, {
                url: file.file_url
              });
            });
          }
        }
      }
    });

    const sanitizedClientName = selectedClient.name.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `${sanitizedClientName}-${year}-${month}.pdf`;
    doc.save(filename);
  };

  const generatePeriodOptions = () => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const startYear = 2025;
    const startMonth = 10;
    
    for (let year = startYear; year <= currentYear; year++) {
      const monthStart = year === startYear ? startMonth : 1;
      const monthEnd = year === currentYear ? currentMonth : 12;
      
      for (let month = monthStart; month <= monthEnd; month++) {
        const value = `${year}-${month.toString().padStart(2, "0")}`;
        const date = new Date(year, month - 1);
        const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        options.push({ value, label });
      }
    }
    
    return options.reverse();
  };

  const periodOptions = generatePeriodOptions();
  const getSelectedPeriodLabel = () => {
    if (!selectedPeriod) return "";
    const option = periodOptions.find(opt => opt.value === selectedPeriod);
    return option ? option.label : "";
  };

  const handleSaveRollover = async () => {
    if (!selectedClient || !selectedPeriod || !user || !stats) return;

    const newRollover = parseFloat(rolloverValue);
    if (isNaN(newRollover)) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    try {
      await monthlyAllocationService.upsertMonthlyAllocation({
        user_id: user.id,
        client_id: selectedClientId,
        month: selectedPeriod,
        year: parseInt(selectedPeriod.split("-")[0]),
        allocated_hours: stats.allocatedHours,
        rollover_hours: newRollover,
      });

      toast({
        title: "Rollover Updated",
        description: "Rollover hours have been updated successfully",
      });

      setEditingRollover(false);
      await loadData();
    } catch (error: any) {
      console.error("Error updating rollover:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update rollover",
        variant: "destructive",
      });
    }
  };

  const handleSaveAllocation = async () => {
    if (!selectedClient || !selectedPeriod || !user || !stats) return;

    const newAllocation = parseFloat(allocationValue);
    if (isNaN(newAllocation) || newAllocation < 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    try {
      const currentDate = new Date();
      const currentPeriod = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}`;
      const isCurrentMonth = selectedPeriod === currentPeriod;

      if (isCurrentMonth) {
        await clientService.updateClient(selectedClientId, {
          allocated_hours_per_month: newAllocation,
        });

        toast({
          title: "Allocation Updated",
          description: "Base allocated hours updated for this client (affects current and future months)",
        });
      } else {
        await monthlyAllocationService.upsertMonthlyAllocation({
          user_id: user.id,
          client_id: selectedClientId,
          month: selectedPeriod,
          year: parseInt(selectedPeriod.split("-")[0]),
          allocated_hours: newAllocation,
          rollover_hours: stats.rolloverHours,
        });

        toast({
          title: "Allocation Updated",
          description: "Allocated hours updated for this month only",
        });
      }

      setEditingAllocation(false);
      await loadData();
    } catch (error: any) {
      console.error("Error updating allocation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update allocation",
        variant: "destructive",
      });
    }
  };

  const handleStartEditRollover = () => {
    if (stats) {
      setRolloverValue(stats.rolloverHours.toString());
      setEditingRollover(true);
    }
  };

  const handleStartEditAllocation = () => {
    if (stats) {
      setAllocationValue(stats.allocatedHours.toString());
      setEditingAllocation(true);
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-brand-primary" />
              Filter Time Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClients.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Active Clients</SelectLabel>
                        {activeClients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {archivedClients.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Archived Clients</SelectLabel>
                        {archivedClients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {periodOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {stats && selectedClient && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="border-2 border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-black flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="w-4 h-4 text-black" />
                      <span>Rolled Over</span>
                    </div>
                    {!editingRollover ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStartEditRollover}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingRollover ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.25"
                        value={rolloverValue}
                        onChange={(e) => setRolloverValue(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveRollover}
                        className="h-8 w-8 p-0 text-green-600"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingRollover(false)}
                        className="h-8 w-8 p-0 text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-black">{stats.rolloverHours.toFixed(2)}h</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-black flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-black" />
                      <span>Allocated</span>
                    </div>
                    {!editingAllocation ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStartEditAllocation}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingAllocation ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.25"
                        value={allocationValue}
                        onChange={(e) => setAllocationValue(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveAllocation}
                        className="h-8 w-8 p-0 text-green-600"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAllocation(false)}
                        className="h-8 w-8 p-0 text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-black">{stats.allocatedHours.toFixed(2)}h</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-black flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-black" />
                    <span>Usage</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <span className="text-black font-semibold">Used: </span>
                      <span className="text-black">{stats.usedHours.toFixed(2)}h</span>
                    </div>
                    <div>
                      <span className="text-black font-semibold">Remaining: </span>
                      <span className={stats.remainingHours >= 0 ? "text-green-600" : "text-red-600"}>
                        {stats.remainingHours.toFixed(2)}h
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={Math.min((stats.usedHours / (stats.allocatedHours + stats.rolloverHours)) * 100, 100)} 
                    className="h-3 bg-slate-100"
                    indicatorClassName={stats.usedHours <= (stats.allocatedHours + stats.rolloverHours) ? "bg-green-600" : "bg-red-600"}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent>
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Time Entries</h3>
                    <p className="text-slate-600">No time entries found for this period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead>Files</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map(entry => {
                          const entryFiles = fileAttachments.filter(f => f.time_entry_id === entry.id);
                          
                          return (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">
                                {new Date(entry.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold text-brand-primary">{entry.hours} hours</span>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-slate-700 truncate">{entry.description}</p>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {(entry.tags as string[]).map((tag, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                {entryFiles.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {entryFiles.map((file) => (
                                      <a
                                        key={file.id}
                                        href={file.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download className="w-3 h-3" />
                                        {file.display_name}
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">No files</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditEntry(entry)}>
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => setDeletingEntry(entry)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-center gap-4 pt-8 pb-8">
              <Button 
                size="lg" 
                className="gap-2 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800"
                onClick={() => handleOpenAddDialog()}
              >
                <Plus className="w-5 h-5" />
                Add New Log
              </Button>
              {filteredEntries.length > 0 && (
                <Button 
                  size="lg"
                  onClick={handleExportPDF} 
                  className="gap-2"
                  variant="outline"
                >
                  <FileDown className="w-4 h-4" />
                  Export PDF
                </Button>
              )}
            </div>
          </>
        )}

        {!selectedClientId && clients.length > 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Select Filters</h3>
              <p className="text-slate-600">Choose a client and period to view time logs</p>
            </CardContent>
          </Card>
        )}

        {clients.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-slate-600 mb-4">You need to add clients first</p>
              <Link href="/clients">
                <Button>Go to Clients</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {editingEntry && selectedClient && (
          <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Time Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateEntry} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date *</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    min={minDate}
                    max={maxDate}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-hours">Hours (15-minute intervals) *</Label>
                  <Select
                    value={editForm.hours}
                    onValueChange={(value) => setEditForm({ ...editForm, hours: value })}
                  >
                    <SelectTrigger id="edit-hours">
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
                  <Label htmlFor="edit-description">Task Description *</Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Describe the work performed..."
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-files">File Attachments (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="edit-files"
                      type="file"
                      onChange={handleEditFileUpload}
                      multiple
                      className="cursor-pointer"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => document.getElementById("edit-files")?.click()}
                      title="Upload files"
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Max 5MB per file. Supports PDF, images, documents, and spreadsheets.</p>
                  
                  {editForm.files.length > 0 && (
                    <div className="space-y-2 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-sm font-medium text-slate-700">Attached Files ({editForm.files.length})</p>
                      <div className="space-y-2">
                        {editForm.files.map((file) => (
                          <div key={file.id} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                            <Download className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <Input
                              type="text"
                              value={file.displayName}
                              onChange={(e) => handleUpdateFileDisplayName(file.id, e.target.value)}
                              className="h-8 text-sm flex-1"
                              placeholder="Display name..."
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEditFile(file.id)}
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

                {selectedClient && (selectedClient.tags as string[]).length > 0 && (
                  <div className="space-y-2">
                    <Label>Tags * (select at least one)</Label>
                    <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-slate-50">
                      {(selectedClient.tags as string[]).map((tag) => (
                        <Badge
                          key={tag}
                          variant={editForm.tags.includes(tag) ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${
                            editForm.tags.includes(tag)
                              ? "bg-brand-primary hover:bg-brand-primary-hover"
                              : "hover:bg-slate-200"
                          }`}
                          onClick={() => toggleEditTag(tag)}
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
                    onClick={() => setEditingEntry(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800"
                  >
                    Update Entry
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {deletingEntry && (
          <AlertDialog open={!!deletingEntry} onOpenChange={() => setDeletingEntry(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this time entry? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteEntry}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

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
                      {activeClients.map((client) => (
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
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800"
                  >
                    Log Time Entry
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
}
