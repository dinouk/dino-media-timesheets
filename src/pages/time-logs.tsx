import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, Calendar, TrendingUp, TrendingDown, AlertCircle, Plus, MoreVertical, Edit2, Save, X } from "lucide-react";
import Link from "next/link";
import { Client, TimeEntry, MonthlyAllocation, ClientStats, ManualRollover } from "@/types";
import { calculateClientStats, processMonthlyRollover, getMonthKey } from "@/lib/timeCalculations";
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

export default function TimeLogsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [monthlyAllocations, setMonthlyAllocations] = useState<MonthlyAllocation[]>([]);
  const [manualRollovers, setManualRollovers] = useState<ManualRollover[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [currentUser, setCurrentUser] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState({
    date: "",
    hours: "",
    description: "",
    tags: [] as string[],
  });
  const [editingRollover, setEditingRollover] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState(false);
  const [rolloverValue, setRolloverValue] = useState("");
  const [allocationValue, setAllocationValue] = useState("");

  useEffect(() => {
    setMounted(true);
    const user = localStorage.getItem("currentUser");
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);
    loadData();
    
    if (!router.query.period) {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
      setSelectedPeriod(currentPeriod);
    }
  }, [router]);

  useEffect(() => {
    if (clients.length > 0 && router.query.clientId && typeof router.query.clientId === "string") {
      setSelectedClientId(router.query.clientId);
    }
    if (router.query.period && typeof router.query.period === "string") {
      setSelectedPeriod(router.query.period);
    }
  }, [router.query.clientId, router.query.period, clients]);

  const loadData = () => {
    const savedClients = localStorage.getItem("clients");
    const savedEntries = localStorage.getItem("timeEntries");
    const savedAllocations = localStorage.getItem("monthlyAllocations");
    const savedManualRollovers = localStorage.getItem("manualRollovers");

    if (savedClients) setClients(JSON.parse(savedClients));
    if (savedEntries) setTimeEntries(JSON.parse(savedEntries));
    if (savedAllocations) setMonthlyAllocations(JSON.parse(savedAllocations));
    if (savedManualRollovers) setManualRollovers(JSON.parse(savedManualRollovers));
  };

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      date: entry.date,
      hours: entry.hours.toString(),
      description: entry.description,
      tags: [...entry.tags],
    });
  };

  const handleUpdateEntry = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingEntry || !editForm.date || !editForm.hours || editForm.tags.length === 0 || !editForm.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields including description and select at least one tag",
        variant: "destructive",
      });
      return;
    }

    const date = new Date(editForm.date);
    const monthKey = getMonthKey(date);

    const updatedEntry: TimeEntry = {
      ...editingEntry,
      date: editForm.date,
      hours: parseFloat(editForm.hours),
      tags: editForm.tags,
      description: editForm.description.trim(),
      month: monthKey,
      year: date.getFullYear(),
    };

    const updatedEntries = timeEntries.map(entry =>
      entry.id === editingEntry.id ? updatedEntry : entry
    );

    setTimeEntries(updatedEntries);
    localStorage.setItem("timeEntries", JSON.stringify(updatedEntries));

    const updatedAllocations = processMonthlyRollover(
      clients,
      updatedEntries,
      monthlyAllocations,
      (date.getMonth() + 1).toString(),
      date.getFullYear(),
      manualRollovers
    );
    setMonthlyAllocations(updatedAllocations);
    localStorage.setItem("monthlyAllocations", JSON.stringify(updatedAllocations));

    toast({
      title: "Time Entry Updated",
      description: "Your time entry has been successfully updated",
    });

    setEditingEntry(null);
    loadData();
  };

  const handleDeleteEntry = () => {
    if (!deletingEntry) return;

    const updatedEntries = timeEntries.filter(entry => entry.id !== deletingEntry.id);
    setTimeEntries(updatedEntries);
    localStorage.setItem("timeEntries", JSON.stringify(updatedEntries));

    const date = new Date(deletingEntry.date);
    const updatedAllocations = processMonthlyRollover(
      clients,
      updatedEntries,
      monthlyAllocations,
      (date.getMonth() + 1).toString(),
      date.getFullYear(),
      manualRollovers
    );
    setMonthlyAllocations(updatedAllocations);
    localStorage.setItem("monthlyAllocations", JSON.stringify(updatedAllocations));

    toast({
      title: "Time Entry Deleted",
      description: "Your time entry has been successfully deleted",
    });

    setDeletingEntry(null);
    loadData();
  };

  const toggleEditTag = (tag: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const minDate = "2025-10-01";
  const maxDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (selectedClientId && selectedPeriod && clients.length > 0) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        const [year, month] = selectedPeriod.split("-");
        const updatedAllocations = processMonthlyRollover(
          clients,
          timeEntries,
          monthlyAllocations,
          month,
          parseInt(year),
          manualRollovers
        );
        setMonthlyAllocations(updatedAllocations);
        localStorage.setItem("monthlyAllocations", JSON.stringify(updatedAllocations));

        const clientStats = calculateClientStats(
          client,
          month,
          parseInt(year),
          timeEntries,
          updatedAllocations
        );
        setStats(clientStats);
      }
    }
  }, [selectedClientId, selectedPeriod, clients, timeEntries, manualRollovers]);

  const filteredEntries = timeEntries
    .filter(entry => 
      entry.clientId === selectedClientId &&
      entry.month === selectedPeriod
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const activeClients = clients.filter(c => !c.archived);
  const archivedClients = clients.filter(c => c.archived);

  const handleExportPDF = () => {
    if (!selectedClient || !stats) return;

    const [year, month] = selectedPeriod.split("-");
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' });
    const companyLogo = localStorage.getItem("companyLogo");
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    if (companyLogo) {
      try {
        doc.addImage(companyLogo, "PNG", pageWidth / 2 - 25, yPos, 50, 20);
        yPos += 30;
      } catch (error) {
        console.error("Error adding logo to PDF:", error);
        yPos += 10;
      }
    }

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("TIMESHEET REPORT", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(`${monthName} ${year}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    const entriesSortedAsc = [...filteredEntries].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const tableData = entriesSortedAsc.map(entry => [
      new Date(entry.date).toLocaleDateString(),
      entry.hours.toString(),
      entry.description,
      entry.tags.join(", ")
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Hours", "Description", "Tags"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 11
      },
      bodyStyles: {
        fontSize: 10,
        textColor: [51, 65, 85]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 80 },
        3: { cellWidth: 50 }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Hours: ${stats.usedHours.toFixed(2)}`, 14, finalY);

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

  const handleSaveRollover = () => {
    if (!selectedClient || !selectedPeriod) return;

    const newRollover = parseFloat(rolloverValue);
    if (isNaN(newRollover)) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    const existingIndex = manualRollovers.findIndex(
      r => r.clientId === selectedClientId && r.month === selectedPeriod
    );

    let updatedRollovers: ManualRollover[];

    if (existingIndex !== -1) {
      updatedRollovers = [...manualRollovers];
      updatedRollovers[existingIndex] = {
        ...updatedRollovers[existingIndex],
        rolloverHours: newRollover,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const newRolloverEntry: ManualRollover = {
        id: Date.now().toString(),
        clientId: selectedClientId,
        month: selectedPeriod,
        year: parseInt(selectedPeriod.split("-")[0]),
        rolloverHours: newRollover,
        note: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedRollovers = [...manualRollovers, newRolloverEntry];
    }

    setManualRollovers(updatedRollovers);
    localStorage.setItem("manualRollovers", JSON.stringify(updatedRollovers));

    const [year, month] = selectedPeriod.split("-");
    const updatedAllocations = processMonthlyRollover(
      clients,
      timeEntries,
      monthlyAllocations,
      month,
      parseInt(year),
      updatedRollovers
    );
    setMonthlyAllocations(updatedAllocations);
    localStorage.setItem("monthlyAllocations", JSON.stringify(updatedAllocations));

    toast({
      title: "Rollover Updated",
      description: "Rollover hours have been updated successfully",
    });

    setEditingRollover(false);
    loadData();
  };

  const handleSaveAllocation = () => {
    if (!selectedClient || !selectedPeriod) return;

    const newAllocation = parseFloat(allocationValue);
    if (isNaN(newAllocation) || newAllocation < 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    const [year, month] = selectedPeriod.split("-");
    const currentDate = new Date();
    const currentPeriod = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}`;
    const isCurrentMonth = selectedPeriod === currentPeriod;

    if (isCurrentMonth) {
      // Update the client's base allocated hours (affects future months)
      const updatedClients = clients.map(c =>
        c.id === selectedClientId ? { ...c, allocatedHoursPerMonth: newAllocation } : c
      );
      setClients(updatedClients);
      localStorage.setItem("clients", JSON.stringify(updatedClients));

      toast({
        title: "Allocation Updated",
        description: "Base allocated hours updated for this client (affects current and future months)",
      });
    } else {
      // Update only this specific month's allocation
      const existingIndex = monthlyAllocations.findIndex(
        a => a.clientId === selectedClientId && a.month === selectedPeriod
      );

      let updatedAllocations: MonthlyAllocation[];

      if (existingIndex !== -1) {
        updatedAllocations = [...monthlyAllocations];
        updatedAllocations[existingIndex] = {
          ...updatedAllocations[existingIndex],
          allocatedHours: newAllocation,
        };
      } else {
        // Create new monthly allocation entry
        const newEntry: MonthlyAllocation = {
          clientId: selectedClientId,
          month: selectedPeriod,
          year: parseInt(year),
          allocatedHours: newAllocation,
          rolloverHours: 0,
        };
        updatedAllocations = [...monthlyAllocations, newEntry];
      }

      setMonthlyAllocations(updatedAllocations);
      localStorage.setItem("monthlyAllocations", JSON.stringify(updatedAllocations));

      toast({
        title: "Allocation Updated",
        description: "Allocated hours updated for this month only",
      });
    }

    setEditingAllocation(false);
    loadData();
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

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={currentUser} />

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-primary" />
              Filter Time Logs
            </CardTitle>
            <CardDescription>Select a client and period to view time entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Period</label>
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
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="border-2 border-brand-light">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
                    Allocated Hours
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
                    <div className="text-2xl font-bold text-brand-primary">{stats.allocatedHours.toFixed(2)}</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
                    Rollover Hours
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
                    <div className="flex items-center gap-2">
                      <div className={`text-2xl font-bold ${stats.rolloverHours >= 0 ? "text-purple-600" : "text-red-600"}`}>
                        {stats.rolloverHours.toFixed(2)}
                      </div>
                      {stats.rolloverHours >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={`border-2 ${stats.remainingHours >= 0 ? "border-green-100" : "border-red-100"}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Time Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-semibold">Used: {stats.usedHours.toFixed(2)}h</span>
                      <span className={`font-semibold ${stats.remainingHours >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        Remaining: {stats.remainingHours.toFixed(2)}h
                      </span>
                    </div>
                    <Progress 
                      value={stats.usedHours / (stats.allocatedHours + stats.rolloverHours) * 100} 
                      className={`h-3 ${stats.remainingHours < 0 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`}
                    />
                  </div>
                  {stats.remainingHours < 0 && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                      <AlertCircle className="w-4 h-4" />
                      <span>Over budget by {Math.abs(stats.remainingHours).toFixed(2)} hours</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Time Entries</CardTitle>
                    <CardDescription>
                      {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"} for{" "}
                      {getSelectedPeriodLabel()}
                    </CardDescription>
                  </div>
                  {filteredEntries.length > 0 && (
                    <Button onClick={handleExportPDF} className="gap-2">
                      <FileDown className="w-4 h-4" />
                      Export PDF
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-12 text-slate-600">
                    No time entries found for this period
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
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">
                              {new Date(entry.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-brand-primary">{entry.hours} hours</span>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="text-sm text-slate-700 truncate">{entry.description}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {entry.tags.map((tag, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-center pt-8 pb-8">
              <Link href={`/log-time${selectedClientId ? `?clientId=${selectedClientId}` : ""}`}>
                <Button size="lg" className="gap-2 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800">
                  <Plus className="w-5 h-5" />
                  Add New Log
                </Button>
              </Link>
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

                {selectedClient && selectedClient.tags.length > 0 && (
                  <div className="space-y-2">
                    <Label>Tags * (select at least one)</Label>
                    <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-slate-50">
                      {selectedClient.tags.map((tag) => (
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
      </main>
    </div>
  );
}
