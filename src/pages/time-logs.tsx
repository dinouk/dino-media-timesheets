import { useEffect, useState, useRef } from "react";
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
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
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
  const [clients, setClients] = useState([] as Client[]);
  const [timeEntries, setTimeEntries] = useState([] as TimeEntry[]);
  const [fileAttachments, setFileAttachments] = useState([] as FileAttachment[]);
  const [monthlyAllocations, setMonthlyAllocations] = useState([] as MonthlyAllocation[]);
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
    files: [] as FileUpload[]
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
    files: [] as FileUpload[]
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

      if (router.query.add === "true") {
        handleOpenAddDialog(router.query.clientId);
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

  useEffect(() => {
    if (router.query.add === "true" && !router.query.clientId && clients.length > 0) {
      handleOpenAddDialog();
      router.replace({
        pathname: router.pathname,
        query: router.query.period ? { period: router.query.period } : {}
      }, undefined, { shallow: true });
    }
  }, [router.query.add, router.query.clientId, clients.length]);

  useEffect(() => {
    if (!selectedClientId || !selectedPeriod) {
      setStats(null);
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) {
      setStats(null);
      return;
    }

    const allocation = monthlyAllocations.find(
      (a) => a.client_id === selectedClientId && a.month === selectedPeriod
    );

    const monthEntries = timeEntries.filter(
      (entry) => entry.client_id === selectedClientId && entry.month === selectedPeriod
    );
    const usedHours = monthEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

    const allocatedHours = Number(allocation?.allocated_hours ?? client.allocated_hours_per_month);
    const rolloverHours = Number(allocation?.rollover_hours ?? 0);
    const remainingHours = allocatedHours + rolloverHours - usedHours;

    setStats({
      allocatedHours,
      rolloverHours,
      usedHours,
      remainingHours
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
        userSettingsService.getUserSettings(user.id)
      ]);

      setClients(clientsData);
      setTimeEntries(entriesData);
      setMonthlyAllocations(allocationsData);

      if (settingsData?.company_logo_url) {
        setCompanyLogo(settingsData.company_logo_url);
      }

      const allFilePromises = entriesData.map((entry) =>
        fileAttachmentService.getFileAttachments(entry.id)
      );
      const allFiles = await Promise.all(allFilePromises);
      setFileAttachments(allFiles.flat());
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load time logs data",
        variant: "destructive"
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleEditEntry = async (entry: TimeEntry) => {
    setEditingEntry(entry);
    const entryFiles = await fileAttachmentService.getFileAttachments(entry.id);
    const filesForForm: FileUpload[] = entryFiles.map((f) => ({
      id: f.id,
      name: f.file_name,
      displayName: f.display_name,
      url: f.file_url,
      path: f.file_path,
      type: f.file_type || "",
      size: f.file_size || 0
    }));

    setEditForm({
      date: entry.date,
      hours: entry.hours.toString(),
      description: entry.description,
      tags: [...(entry.tags as string[])],
      files: filesForForm
    });
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editForm.date || !editForm.hours || editForm.tags.length === 0 || !editForm.description.trim() || !user) {
      toast({ title: "Validation Error", description: "Please fill in all fields including description and select at least one tag", variant: "destructive" });
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
        year: date.getFullYear()
      });
      const currentFiles = editForm.files.filter((f) => !f.file);
      const existingFileAttachments = await fileAttachmentService.getFileAttachments(editingEntry.id);
      for (const existingFile of existingFileAttachments) {
        if (!currentFiles.find((f) => f.id === existingFile.id)) {
          if (existingFile.file_path) {
            await storageService.deleteFile("time-entry-files", existingFile.file_path);
          }
          await fileAttachmentService.deleteFileAttachment(existingFile.id);
        }
      }
      const newFiles = editForm.files.filter((f) => f.file);
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
            file_size: fileUpload.file.size
          });
        } else if (fileUpload.id && fileUpload.displayName !== fileUpload.name) {
          await fileAttachmentService.updateFileAttachment(fileUpload.id, { display_name: fileUpload.displayName });
        }
      }
      toast({ title: "Time Entry Updated", description: "Your time entry has been successfully updated" });
      closeEditDialog(() => {
        loadData();
      });
    } catch (error: any) {
      console.error("Error updating time entry:", error);
      toast({ title: "Error", description: error.message || "Failed to update time entry", variant: "destructive" });
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
      toast({ title: "Time Entry Deleted", description: "Your time entry has been successfully deleted" });
      setDeletingEntry(null);
      await loadData();
    } catch (error: any) {
      console.error("Error deleting time entry:", error);
      toast({ title: "Error", description: error.message || "Failed to delete time entry", variant: "destructive" });
    }
  };

  const toggleEditTag = (tag: string) => setEditForm((prev) => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag] }));

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File Too Large", description: `${file.name} exceeds 5MB limit`, variant: "destructive" });
        return;
      }
      const fileData: FileUpload = { id: Date.now().toString() + Math.random(), name: file.name, displayName: file.name, file: file, type: file.type, size: file.size };
      setEditForm((prev) => ({ ...prev, files: [...prev.files, fileData] }));
    });
    e.target.value = "";
  };

  const handleRemoveEditFile = (fileId: string) => setEditForm((prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== fileId) }));
  const handleUpdateFileDisplayName = (fileId: string, newDisplayName: string) => setEditForm((prev) => ({ ...prev, files: prev.files.map((f) => f.id === fileId ? { ...f, displayName: newDisplayName } : f) }));

  const handleOpenAddDialog = (preselectedClientId?: string) => {
    const setupAddDialog = () => {
      setAddForm({ clientId: preselectedClientId || selectedClientId || "", date: new Date().toISOString().split("T")[0], hours: "", description: "", tags: [], files: [] });
      setIsAddingTimeLog(true);
    };
    if (editingEntry) {
      closeEditDialog(setupAddDialog);
    } else {
      setupAddDialog();
    }
  };

  const handleAddFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File Too Large", description: `${file.name} exceeds 5MB limit`, variant: "destructive" });
        return;
      }
      const fileData: FileUpload = { id: Date.now().toString() + Math.random(), name: file.name, displayName: file.name, file: file, type: file.type, size: file.size };
      setAddForm((prev) => ({ ...prev, files: [...prev.files, fileData] }));
    });
    e.target.value = "";
  };

  const handleRemoveAddFile = (fileId: string) => setAddForm((prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== fileId) }));
  const handleUpdateAddFileDisplayName = (fileId: string, newDisplayName: string) => setAddForm((prev) => ({ ...prev, files: prev.files.map((f) => f.id === fileId ? { ...f, displayName: newDisplayName } : f) }));
  const toggleAddTag = (tag: string) => setAddForm((prev) => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag] }));

  const closeEditDialog = (callback?: () => void) => {
    setEditingEntry(null);
    setEditForm({
      date: "",
      hours: "",
      description: "",
      tags: [],
      files: []
    });
    // Give Radix Dialog time to fully unmount before callback
    if (callback) {
      setTimeout(callback, 300);
    }
  };

  const closeAddDialog = (callback?: () => void) => {
    setIsAddingTimeLog(false);
    setAddForm({
      clientId: "",
      date: "",
      hours: "",
      description: "",
      tags: [],
      files: []
    });
    // Give Radix Dialog time to fully unmount before callback
    if (callback) {
      setTimeout(callback, 300);
    }
  };

  // Simple cleanup to ensure body styles are reset
  useEffect(() => {
    if (!editingEntry && !isAddingTimeLog && !deletingEntry) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [editingEntry, isAddingTimeLog, deletingEntry]);

  const handleSubmitTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const addClient = clients.find((c) => c.id === addForm.clientId);
    if (!addClient) return;
    const clientTags = addClient.tags as string[] || [];
    const finalTags = clientTags.length === 1 ? clientTags : addForm.tags;
    if (!addForm.clientId || !addForm.date || !addForm.hours || finalTags.length === 0 || !addForm.description.trim() || !user) {
      toast({ title: "Validation Error", description: "Please fill in all fields including description and select at least one tag", variant: "destructive" });
      return;
    }
    try {
      const date = new Date(addForm.date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
      const newEntry = await timeEntryService.createTimeEntry({
        user_id: user.id, client_id: addForm.clientId, date: addForm.date, hours: parseFloat(addForm.hours),
        tags: finalTags, description: addForm.description.trim(), month: monthKey, year: date.getFullYear()
      });
      if (addForm.files.length > 0) {
        for (const fileUpload of addForm.files) {
          if (fileUpload.file) {
            const filePath = `${user.id}/${newEntry.id}/${Date.now()}-${fileUpload.file.name}`;
            await storageService.uploadFile("time-entry-files", filePath, fileUpload.file);
            const fileUrl = await storageService.getPublicUrl("time-entry-files", filePath);
            await fileAttachmentService.createFileAttachment({
              user_id: user.id, time_entry_id: newEntry.id, file_name: fileUpload.name, display_name: fileUpload.displayName,
              file_url: fileUrl, file_path: filePath, file_type: fileUpload.file.type, file_size: fileUpload.file.size
            });
          }
        }
      }
      const targetClientId = addForm.clientId;
      const targetPeriod = monthKey;
      toast({ title: "Time Entry Created", description: "Your time entry has been successfully logged" });
      closeAddDialog(() => {
        setSelectedClientId(targetClientId);
        setSelectedPeriod(targetPeriod);
        router.push({ pathname: "/time-logs", query: { clientId: targetClientId, period: targetPeriod } }, undefined, { shallow: true });
        // Small additional delay after navigation before reloading
        setTimeout(() => loadData(), 100);
      });
    } catch (error: any) {
      console.error("Error creating time entry:", error);
      toast({ title: "Error", description: error.message || "Failed to create time entry", variant: "destructive" });
    }
  };

  const selectedAddClient = clients.find((c) => c.id === addForm.clientId);
  const addClientTags = selectedAddClient ? selectedAddClient.tags as string[] || [] : [];
  const shouldShowAddTags = addClientTags.length > 1;
  const filteredEntries = timeEntries.filter((entry) => entry.client_id === selectedClientId && entry.month === selectedPeriod).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const activeClients = clients.filter((c) => !c.archived);
  const archivedClients = clients.filter((c) => c.archived);

  const handleExportPDF = async () => {
    if (!selectedClient || !stats) return;
    const [year, month] = selectedPeriod.split("-");
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' });
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(selectedClient.name, 14, yPos);
    yPos += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`${monthName} ${year}`, 14, yPos);
    const logoYPos = 12;
    if (companyLogo) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = companyLogo;
        await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
        const aspectRatio = img.width / img.height;
        let logoWidth = 36, logoHeight = logoWidth / aspectRatio;
        if (logoHeight > 14.4) { logoHeight = 14.4; logoWidth = logoHeight * aspectRatio; }
        const logoX = pageWidth - logoWidth - 14;
        doc.addImage(companyLogo, "PNG", logoX, logoYPos, logoWidth, logoHeight);
        if (logoYPos + logoHeight > yPos) yPos = logoYPos + logoHeight;
      } catch (error) { console.error("Error adding logo to PDF:", error); }
    }
    yPos += 10;
    const boxWidth = (pageWidth - 28 - 9) / 4, boxHeight = 18, boxY = yPos, boxSpacing = 3;
    const statBoxes = [
      { label: "Rolled Over", value: stats.rolloverHours.toFixed(2) },
      { label: "Allocated", value: stats.allocatedHours.toFixed(2) },
      { label: "Used", value: stats.usedHours.toFixed(2) },
      { label: "Remaining", value: stats.remainingHours.toFixed(2) }
    ];
    statBoxes.forEach((box, index) => {
      const x = 14 + index * (boxWidth + boxSpacing);
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, boxY, boxWidth, boxHeight, 1.5, 1.5, "FD");
      doc.setFontSize(8); doc.setTextColor(100, 116, 139);
      doc.text(box.label, x + boxWidth / 2, boxY + boxHeight / 2 - 1.5, { align: "center" });
      doc.setFontSize(10); doc.setTextColor(51, 65, 85); doc.setFont("helvetica", "bold");
      doc.text(`${box.value}h`, x + boxWidth / 2, boxY + boxHeight / 2 + 3.5, { align: "center" });
      doc.setFont("helvetica", "normal");
    });
    yPos = boxY + boxHeight + 10;
    const entriesWithFiles = await Promise.all(filteredEntries.map(async (entry) => ({ entry, files: await fileAttachmentService.getFileAttachments(entry.id) })));
    const tableData = entriesWithFiles.map(({ entry, files }) => [new Date(entry.date).toLocaleDateString(), entry.hours.toString(), entry.description, (entry.tags as string[]).join(", "), files.length > 0 ? files.map((f) => f.display_name).join(", ") : "No files"]);
    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Hours", "Description", "Tags", "Attachments"]],
      body: tableData,
      theme: "striped",
      styles: { lineColor: [248, 250, 252], lineWidth: 0, cellPadding: 3, fontSize: 7.5, textColor: [51, 65, 85] },
      headStyles: { fillColor: [1, 136, 169], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, lineWidth: 0 },
      bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85], lineWidth: 0 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 18 }, 2: { cellWidth: 70 }, 3: { cellWidth: 35 }, 4: { cellWidth: 37 } },
      margin: { left: 14, right: 14 },
      tableWidth: "auto",
      didDrawCell: (data) => {
        if (data.column.index === 4 && data.section === "body" && data.row.index < entriesWithFiles.length) {
          const { files } = entriesWithFiles[data.row.index];
          if (files.length > 0) {
            files.forEach((file, fileIndex) => {
              doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(1, 136, 169);
              doc.textWithLink(file.display_name, data.cell.x + 2, data.cell.y + 5 + fileIndex * 6, { url: file.file_url });
            });
          }
        }
      }
    });
    const sanitizedClientName = selectedClient.name.replace(/[^a-zA-Z0-9]/g, "-");
    doc.save(`${sanitizedClientName}-${year}-${month}.pdf`);
  };

  const generatePeriodOptions = () => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear(), currentMonth = currentDate.getMonth() + 1;
    for (let year = 2025; year <= currentYear; year++) {
      const monthStart = year === 2025 ? 10 : 1;
      const monthEnd = year === currentYear ? currentMonth : 12;
      for (let month = monthStart; month <= monthEnd; month++) {
        const value = `${year}-${month.toString().padStart(2, "0")}`;
        const label = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        options.push({ value, label });
      }
    }
    return options.reverse();
  };
  const periodOptions = generatePeriodOptions();

  const handleClientFilterChange = (value: string) => {
    setSelectedClientId(value);
    router.push({ pathname: router.pathname, query: { ...router.query, clientId: value } }, undefined, { shallow: true });
  };
  const handlePeriodFilterChange = (value: string) => {
    setSelectedPeriod(value);
    router.push({ pathname: router.pathname, query: { ...router.query, period: value } }, undefined, { shallow: true });
  };

  const handleSaveRollover = async () => {
    if (!selectedClient || !selectedPeriod || !user || !stats) return;
    const newRollover = parseFloat(rolloverValue);
    if (isNaN(newRollover)) {
      toast({ title: "Invalid Input", description: "Please enter a valid number", variant: "destructive" });
      return;
    }
    try {
      await monthlyAllocationService.upsertMonthlyAllocation({
        user_id: user.id, client_id: selectedClientId, month: selectedPeriod, year: parseInt(selectedPeriod.split("-")[0]),
        allocated_hours: stats.allocatedHours, rollover_hours: newRollover
      });
      toast({ title: "Rollover Updated", description: "Rollover hours have been updated successfully" });
      setEditingRollover(false);
      await loadData();
    } catch (error: any) {
      console.error("Error updating rollover:", error);
      toast({ title: "Error", description: error.message || "Failed to update rollover", variant: "destructive" });
    }
  };

  const handleSaveAllocation = async () => {
    if (!selectedClient || !selectedPeriod || !user || !stats) return;
    const newAllocation = parseFloat(allocationValue);
    if (isNaN(newAllocation) || newAllocation < 0) {
      toast({ title: "Invalid Input", description: "Please enter a valid positive number", variant: "destructive" });
      return;
    }
    try {
      const currentDate = new Date();
      const currentPeriod = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}`;
      if (selectedPeriod === currentPeriod) {
        await clientService.updateClient(selectedClientId, { allocated_hours_per_month: newAllocation });
        toast({ title: "Allocation Updated", description: "Base allocated hours updated for this client (affects current and future months)" });
      } else {
        await monthlyAllocationService.upsertMonthlyAllocation({
          user_id: user.id, client_id: selectedClientId, month: selectedPeriod, year: parseInt(selectedPeriod.split("-")[0]),
          allocated_hours: newAllocation, rollover_hours: stats.rolloverHours
        });
        toast({ title: "Allocation Updated", description: "Allocated hours updated for this month only" });
      }
      setEditingAllocation(false);
      await loadData();
    } catch (error: any) {
      console.error("Error updating allocation:", error);
      toast({ title: "Error", description: error.message || "Failed to update allocation", variant: "destructive" });
    }
  };

  const handleStartEditRollover = () => { if (stats) { setRolloverValue(stats.rolloverHours.toString()); setEditingRollover(true); } };
  const handleStartEditAllocation = () => { if (stats) { setAllocationValue(stats.allocatedHours.toString()); setEditingAllocation(true); } };

  if (!mounted || loading || loadingData) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div><p className="mt-4 text-slate-600">Loading...</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={user?.email || ""} />
      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5 text-brand-primary" />Filter Time Logs</CardTitle></CardHeader>
          <CardContent><div className="grid md:grid-cols-2 gap-4">
            <div><Select value={selectedClientId} onValueChange={handleClientFilterChange}><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger><SelectContent>
              {activeClients.length > 0 && <SelectGroup><SelectLabel>Active Clients</SelectLabel>{activeClients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectGroup>}
              {archivedClients.length > 0 && <SelectGroup><SelectLabel>Archived Clients</SelectLabel>{archivedClients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectGroup>}
            </SelectContent></Select></div>
            <div><Select value={selectedPeriod} onValueChange={handlePeriodFilterChange}><SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger><SelectContent className="max-h-[300px]">
              {periodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent></Select></div>
          </div></CardContent>
        </Card>

        {stats && selectedClient && <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-black flex items-center gap-2"><ArrowUp className="w-4 h-4 text-black" /><span>Rolled Over</span></CardTitle></CardHeader>
              <CardContent>{editingRollover ? <div className="flex items-center gap-2"><Input type="number" step="0.25" value={rolloverValue} onChange={(e) => setRolloverValue(e.target.value)} className="h-8 text-sm" autoFocus /><Button variant="ghost" size="sm" onClick={handleSaveRollover} className="h-8 w-8 p-0 text-green-600"><Save className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => setEditingRollover(false)} className="h-8 w-8 p-0 text-red-600"><X className="w-4 h-4" /></Button></div> : <div className="flex items-center justify-between"><div className="text-2xl font-bold text-black">{stats.rolloverHours.toFixed(2)}h</div><Button variant="ghost" size="sm" onClick={handleStartEditRollover} className="h-8 w-8 p-0"><Edit2 className="w-4 h-4" /></Button></div>}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-black flex items-center gap-2"><Clock className="w-4 h-4 text-black" /><span>Allocated</span></CardTitle></CardHeader>
              <CardContent>{editingAllocation ? <div className="flex items-center gap-2"><Input type="number" step="0.25" value={allocationValue} onChange={(e) => setAllocationValue(e.target.value)} className="h-8 text-sm" autoFocus /><Button variant="ghost" size="sm" onClick={handleSaveAllocation} className="h-8 w-8 p-0 text-green-600"><Save className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => setEditingAllocation(false)} className="h-8 w-8 p-0 text-red-600"><X className="w-4 h-4" /></Button></div> : <div className="flex items-center justify-between"><div className="text-2xl font-bold text-black">{stats.allocatedHours.toFixed(2)}h</div><Button variant="ghost" size="sm" onClick={handleStartEditAllocation} className="h-8 w-8 p-0"><Edit2 className="w-4 h-4" /></Button></div>}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-black flex items-center gap-2"><AlertCircle className="w-4 h-4 text-black" /><span>Usage</span></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center text-sm"><div><span className="text-black font-semibold">Used: </span><span className="text-black">{stats.usedHours.toFixed(2)}h</span></div><div><span className="text-black font-semibold">Remaining: </span><span className={stats.remainingHours >= 0 ? "text-green-600" : "text-red-600"}>{stats.remainingHours.toFixed(2)}h</span></div></div>
                {(() => {
                  const totalAvailable = stats.allocatedHours + stats.rolloverHours;
                  let progressValue = 0, isOverBudget = false;
                  if (totalAvailable > 0) { progressValue = Math.min(stats.usedHours / totalAvailable * 100, 100); isOverBudget = stats.usedHours > totalAvailable; }
                  else if (totalAvailable === 0) { progressValue = stats.usedHours > 0 ? 100 : 0; isOverBudget = stats.usedHours > 0; }
                  else { progressValue = 100; isOverBudget = true; }
                  return <Progress value={progressValue} className="h-3 bg-slate-100" indicatorClassName={isOverBudget ? "bg-red-600" : "bg-green-600"} />;
                })()}
              </CardContent>
            </Card>
          </div>
          <Card><CardContent className="pt-6">
            {filteredEntries.length === 0 ? <div className="text-center py-12"><Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h3 className="text-xl font-semibold mb-2">No Time Entries</h3><p className="text-slate-600 mb-6">No time entries found for this period</p><Button size="lg" className="gap-2 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800" onClick={() => handleOpenAddDialog()} style={{ backgroundColor: "#0188a9", backgroundImage: "none" }}><Plus className="w-5 h-5" />Add New Log</Button></div> : <>
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Hours</TableHead><TableHead style={{ width: "50vw", minWidth: "200px", maxWidth: "500px" }}>Description</TableHead><TableHead>Tags</TableHead><TableHead>Files</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{filteredEntries.map((entry) => {
                  const entryFiles = fileAttachments.filter((f) => f.time_entry_id === entry.id);
                  return <TableRow key={entry.id}><TableCell className="font-medium">{new Date(entry.date).toLocaleDateString()}</TableCell><TableCell><span className="font-semibold text-brand-primary">{entry.hours}</span></TableCell><TableCell style={{ width: "50vw", minWidth: "200px", maxWidth: "500px" }}><p className="text-sm text-slate-700 break-words whitespace-pre-wrap">{entry.description}</p></TableCell><TableCell><div className="flex flex-wrap gap-1">{(entry.tags as string[]).map((tag, index) => <Badge key={index} variant="secondary" className="text-xs whitespace-nowrap">{tag}</Badge>)}</div></TableCell><TableCell>{entryFiles.length > 0 ? <div className="flex flex-wrap gap-1">{entryFiles.map((file) => <a key={file.id} href={file.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 transition-colors" onClick={(e) => e.stopPropagation()}><Download className="w-3 h-3" />{file.display_name}</a>)}</div> : <span className="text-xs text-slate-400">No files</span>}</TableCell><TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleEditEntry(entry)}>Edit</DropdownMenuItem><DropdownMenuItem onClick={() => setDeletingEntry(entry)} className="text-red-600 focus:text-red-600">Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>;
                })}</TableBody>
              </Table></div>
              <div className="flex justify-center gap-4 pt-6 border-t mt-6"><Button size="lg" className="gap-2 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800" onClick={() => handleOpenAddDialog()} style={{ backgroundColor: "#0188a9", backgroundImage: "none" }}><Plus className="w-5 h-5" />Add New Log</Button><Button size="lg" onClick={handleExportPDF} className="gap-2" variant="outline" style={{ backgroundImage: "none", backgroundColor: "rgb(248, 248, 248)" }}><FileDown className="w-4 h-4" />Export PDF</Button></div>
            </>}
          </CardContent></Card>
        </>}
        {!selectedClientId && clients.length > 0 && <Card className="text-center py-12"><CardContent><Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h3 className="text-xl font-semibold mb-2">Select Filters</h3><p className="text-slate-600">Choose a client and period to view time logs</p></CardContent></Card>}
        {clients.length === 0 && <Card className="text-center py-12"><CardContent><p className="text-slate-600 mb-4">You need to add clients first</p><Link href="/clients"><Button>Go to Clients</Button></Link></CardContent></Card>}

        <Dialog open={!!editingEntry} onOpenChange={(open) => !open && closeEditDialog()}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Time Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateEntry} className="space-y-6">
            <div className="space-y-2"><Label htmlFor="edit-date">Date *</Label><Input id="edit-date" type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} min={minDate} max={maxDate} className="h-10" /></div>
            <div className="space-y-2"><Label htmlFor="edit-hours">Hours *</Label><Select value={editForm.hours} onValueChange={(value) => setEditForm({ ...editForm, hours: value })}><SelectTrigger id="edit-hours"><SelectValue placeholder="Select hours" /></SelectTrigger><SelectContent>{Array.from({ length: 33 }, (_, i) => i * 0.25).map((value) => <SelectItem key={value} value={value.toString()}>{value} hours</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="edit-description">Task Description *</Label><Textarea id="edit-description" placeholder="Describe the work performed..." value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4} className="resize-none" /></div>
            <div className="space-y-2"><Label htmlFor="edit-files">Attachments</Label><div className="flex items-center gap-2"><Input id="edit-files" type="file" onChange={handleEditFileUpload} multiple className="cursor-pointer" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.xls,.xlsx" /><Button type="button" variant="outline" size="icon" onClick={() => document.getElementById("edit-files")?.click()} title="Upload files"><Upload className="w-4 h-4" /></Button></div><p className="text-xs text-slate-500">Max 5MB per file. Supports PDF, images, documents, and spreadsheets.</p>{editForm.files.length > 0 && <div className="space-y-2 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200"><p className="text-sm font-medium text-slate-700">Attached Files ({editForm.files.length})</p><div className="space-y-2">{editForm.files.map((file) => <div key={file.id} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200"><Download className="w-4 h-4 text-blue-600 flex-shrink-0" /><Input type="text" value={file.displayName} onChange={(e) => handleUpdateFileDisplayName(file.id, e.target.value)} className="h-8 text-sm flex-1" placeholder="Display name..." /><Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveEditFile(file.id)} className="flex-shrink-0 h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"><X className="w-4 h-4" /></Button></div>)}</div></div>}</div>
            {selectedClient && (selectedClient.tags as string[]).length > 0 && <div className="space-y-2"><Label>Tags *</Label><div className="flex flex-wrap gap-2 p-4 border rounded-md bg-slate-50">{(selectedClient.tags as string[]).map((tag) => <Badge key={tag} variant={editForm.tags.includes(tag) ? "default" : "outline"} className={`cursor-pointer transition-all ${editForm.tags.includes(tag) ? "bg-brand-primary hover:bg-brand-primary-hover" : "hover:bg-slate-200"}`} onClick={() => toggleEditTag(tag)}>{tag}</Badge>)}</div></div>}
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => closeEditDialog()} className="flex-1">Cancel</Button><Button type="submit" className="flex-1 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800">Update Entry</Button></div>
          </form>
        </DialogContent></Dialog>
        {deletingEntry && <AlertDialog open={!!deletingEntry} onOpenChange={() => setDeletingEntry(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Time Entry</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this time entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteEntry} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
        <Dialog open={isAddingTimeLog} onOpenChange={(open) => !open && closeAddDialog()}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Log Time Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitTimeEntry} className="space-y-6">
            <div className="space-y-2"><Label htmlFor="add-client">Client *</Label><Select value={addForm.clientId} onValueChange={(value) => setAddForm({ ...addForm, clientId: value, tags: [] })}><SelectTrigger id="add-client"><SelectValue placeholder="Select a client" /></SelectTrigger><SelectContent>{activeClients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="add-date">Date *</Label><Input id="add-date" type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} min={minDate} max={maxDate} className="h-10" /></div>
            <div className="space-y-2"><Label htmlFor="add-hours">Hours *</Label><Select value={addForm.hours} onValueChange={(value) => setAddForm({ ...addForm, hours: value })}><SelectTrigger id="add-hours"><SelectValue placeholder="Select hours" /></SelectTrigger><SelectContent>{Array.from({ length: 33 }, (_, i) => i * 0.25).map((value) => <SelectItem key={value} value={value.toString()}>{value} hours</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="add-description">Task Description *</Label><Textarea id="add-description" placeholder="Describe the work performed..." value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} rows={4} className="resize-none" /></div>
            <div className="space-y-2"><Label htmlFor="add-files">Attachments (Optional)</Label><div className="flex items-center gap-2"><Input id="add-files" type="file" onChange={handleAddFileUpload} multiple className="cursor-pointer" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.xls,.xlsx" /><Button type="button" variant="outline" size="icon" onClick={() => document.getElementById("add-files")?.click()} title="Upload files"><Upload className="w-4 h-4" /></Button></div><p className="text-xs text-slate-500">Max 5MB per file. Supports PDF, images, documents, and spreadsheets.</p>{addForm.files.length > 0 && <div className="space-y-2 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200"><p className="text-sm font-medium text-slate-700">Attached Files ({addForm.files.length})</p><div className="space-y-2">{addForm.files.map((file) => <div key={file.id} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200"><FileIcon className="w-4 h-4 text-blue-600 flex-shrink-0" /><Input type="text" value={file.displayName} onChange={(e) => handleUpdateAddFileDisplayName(file.id, e.target.value)} className="h-8 text-sm flex-1" placeholder="Display name..." /><Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveAddFile(file.id)} className="flex-shrink-0 h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"><X className="w-4 h-4" /></Button></div>)}</div></div>}</div>
            {shouldShowAddTags && selectedAddClient && <div className="space-y-2"><Label>Tags *</Label><div className="flex flex-wrap gap-2 p-4 border rounded-md bg-slate-50">{addClientTags.map((tag) => <Badge key={tag} variant={addForm.tags.includes(tag) ? "default" : "outline"} className={`cursor-pointer transition-all ${addForm.tags.includes(tag) ? "bg-brand-primary hover:bg-brand-primary-hover" : "hover:bg-slate-200"}`} onClick={() => toggleAddTag(tag)}>{tag}</Badge>)}</div></div>}
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => closeAddDialog()} className="flex-1">Cancel</Button><Button type="submit" className="flex-1 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800">Log Time Entry</Button></div>
          </form>
        </DialogContent></Dialog>
      </main>
    </div>
  );
}
