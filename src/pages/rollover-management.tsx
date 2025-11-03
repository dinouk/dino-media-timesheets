
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppHeader } from "@/components/AppHeader";
import { calculateAutoRollover, processMonthlyRollover } from "@/lib/timeCalculations";
import { useToast } from "@/hooks/use-toast";
import { Calendar, TrendingUp, TrendingDown, Edit2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { clientService } from "@/services/clientService";
import { timeEntryService } from "@/services/timeEntryService";
import { monthlyAllocationService } from "@/services/monthlyAllocationService";
import { manualRolloverService } from "@/services/manualRolloverService";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
type MonthlyAllocation = Database["public"]["Tables"]["monthly_allocations"]["Row"];
type ManualRollover = Database["public"]["Tables"]["manual_rollovers"]["Row"];

export default function RolloverManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [monthlyAllocations, setMonthlyAllocations] = useState<MonthlyAllocation[]>([]);
  const [manualRollovers, setManualRollovers] = useState<ManualRollover[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [editingRollover, setEditingRollover] = useState<{ clientId: string; month: string } | null>(null);
  const [editForm, setEditForm] = useState({
    rolloverHours: "",
    note: "",
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (!loading && !user) {
      router.push("/");
      return;
    }
    if (user) {
      loadData();
    }

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    setSelectedPeriod(currentPeriod);
  }, [user, loading, router]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoadingData(true);
      const [clientsData, entriesData, allocationsData, rolloversData] = await Promise.all([
        clientService.getClients(user.id),
        timeEntryService.getTimeEntries(user.id),
        monthlyAllocationService.getMonthlyAllocations(user.id),
        manualRolloverService.getManualRollovers(user.id),
      ]);
      
      setClients(clientsData);
      setTimeEntries(entriesData);
      setMonthlyAllocations(allocationsData);
      setManualRollovers(rolloversData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load rollover management data",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
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
        const label = date.toLocaleString("default", { month: "long", year: "numeric" });
        options.push({ value, label });
      }
    }
    
    return options.reverse();
  };

  const periodOptions = generatePeriodOptions();

  const getRolloverData = () => {
    if (!selectedPeriod) return [];

    return clients.map(client => {
      const existingAllocation = monthlyAllocations.find(
        a => a.client_id === client.id && a.month === selectedPeriod
      );

      const manualRollover = manualRollovers.find(
        r => r.client_id === client.id && r.month === selectedPeriod
      );

      // Calculate auto rollover based on previous month's data
      const [year, month] = selectedPeriod.split("-");
      const prevDate = new Date(parseInt(year), parseInt(month) - 2); // -2 because month is 1-indexed and we want previous month
      const prevMonth = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, "0")}`;
      
      const prevAllocation = monthlyAllocations.find(
        a => a.client_id === client.id && a.month === prevMonth
      );
      
      const prevEntries = timeEntries.filter(
        e => e.client_id === client.id && e.month === prevMonth
      );
      
      const prevUsedHours = prevEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const prevAllocatedHours = prevAllocation?.allocated_hours ?? client.allocated_hours_per_month;
      const prevRolloverHours = prevAllocation?.rollover_hours ?? 0;
      
      const autoCalculated = prevAllocatedHours + prevRolloverHours - prevUsedHours;

      const currentRollover = existingAllocation?.rollover_hours ?? autoCalculated;
      const isManual = !!manualRollover;

      return {
        client,
        autoCalculated,
        currentRollover,
        isManual,
        note: manualRollover?.note,
      };
    });
  };

  const handleEditRollover = (clientId: string) => {
    const data = getRolloverData().find(d => d.client.id === clientId);
    if (!data) return;

    const manualRollover = manualRollovers.find(
      r => r.client_id === clientId && r.month === selectedPeriod
    );

    setEditingRollover({ clientId, month: selectedPeriod });
    setEditForm({
      rolloverHours: data.currentRollover.toString(),
      note: manualRollover?.note || "",
    });
  };

  const handleSaveRollover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRollover || !user) return;

    const rolloverHours = parseFloat(editForm.rolloverHours);
    if (isNaN(rolloverHours)) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid number for rollover hours",
        variant: "destructive",
      });
      return;
    }

    try {
      const [year] = editingRollover.month.split("-");

      await manualRolloverService.upsertManualRollover({
        user_id: user.id,
        client_id: editingRollover.clientId,
        month: editingRollover.month,
        year: parseInt(year),
        rollover_hours: rolloverHours,
        note: editForm.note || "",
      });

      const existingAllocation = monthlyAllocations.find(
        a => a.client_id === editingRollover.clientId && a.month === editingRollover.month
      );

      const client = clients.find(c => c.id === editingRollover.clientId);
      if (!client) return;

      await monthlyAllocationService.upsertMonthlyAllocation({
        user_id: user.id,
        client_id: editingRollover.clientId,
        month: editingRollover.month,
        year: parseInt(year),
        allocated_hours: existingAllocation?.allocated_hours ?? client.allocated_hours_per_month,
        rollover_hours: rolloverHours,
      });

      toast({
        title: "Rollover Updated",
        description: "Manual rollover hours have been saved successfully",
      });

      setEditingRollover(null);
      await loadData();
    } catch (error: any) {
      console.error("Error saving rollover:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save rollover",
        variant: "destructive",
      });
    }
  };

  const handleResetToAuto = async (clientId: string) => {
    if (!confirm("Reset to automatically calculated rollover? This will remove any manual adjustments.")) {
      return;
    }

    try {
      const manualRollover = manualRollovers.find(
        r => r.client_id === clientId && r.month === selectedPeriod
      );

      if (!manualRollover) return;

      const data = getRolloverData().find(d => d.client.id === clientId);
      if (!data) return;

      const [year] = selectedPeriod.split("-");
      const client = clients.find(c => c.id === clientId);
      if (!client) return;

      const existingAllocation = monthlyAllocations.find(
        a => a.client_id === clientId && a.month === selectedPeriod
      );

      await monthlyAllocationService.upsertMonthlyAllocation({
        user_id: user!.id,
        client_id: clientId,
        month: selectedPeriod,
        year: parseInt(year),
        allocated_hours: existingAllocation?.allocated_hours ?? client.allocated_hours_per_month,
        rollover_hours: data.autoCalculated,
      });

      toast({
        title: "Rollover Reset",
        description: "Rollover has been reset to automatic calculation",
      });

      await loadData();
    } catch (error: any) {
      console.error("Error resetting rollover:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset rollover",
        variant: "destructive",
      });
    }
  };

  const rolloverData = getRolloverData();

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
              <Calendar className="w-5 h-5 text-brand-primary" />
              Rollover Management
            </CardTitle>
            <CardDescription>
              Manage rollover hours for each client per month. The system automatically calculates rollover from the previous month, but you can manually adjust as needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-md">
              <Label>Select Month</Label>
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
          </CardContent>
        </Card>

        {selectedPeriod && (
          <Card>
            <CardHeader>
              <CardTitle>Rollover Hours</CardTitle>
              <CardDescription>
                View and edit rollover hours for all clients for the selected month
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rolloverData.length === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  No clients found. Add clients first to manage rollover hours.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-center">Auto Calculated</TableHead>
                        <TableHead className="text-center">Current Rollover</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rolloverData.map(({ client, autoCalculated, currentRollover, isManual, note }) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`font-semibold ${autoCalculated >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {autoCalculated.toFixed(2)}
                              </span>
                              {autoCalculated >= 0 ? (
                                <TrendingUp className="w-4 h-4 text-green-600" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`font-bold ${currentRollover >= 0 ? "text-brand-primary" : "text-red-600"}`}>
                                {currentRollover.toFixed(2)}
                              </span>
                              {currentRollover >= 0 ? (
                                <TrendingUp className="w-4 h-4 text-brand-primary" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {isManual ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                <Edit2 className="w-3 h-3" />
                                Manual
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                                <RefreshCw className="w-3 h-3" />
                                Auto
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="text-sm text-slate-600 truncate">{note || "-"}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRollover(client.id)}
                                className="gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </Button>
                              {isManual && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResetToAuto(client.id)}
                                  className="gap-2 text-slate-600 hover:text-slate-700"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Reset
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {editingRollover && (
          <Dialog open={!!editingRollover} onOpenChange={() => setEditingRollover(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Rollover Hours</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveRollover} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="rollover-hours">Rollover Hours *</Label>
                  <Input
                    id="rollover-hours"
                    type="number"
                    step="0.01"
                    value={editForm.rolloverHours}
                    onChange={(e) => setEditForm({ ...editForm, rolloverHours: e.target.value })}
                    placeholder="Enter rollover hours"
                  />
                  <p className="text-xs text-slate-500">
                    Enter positive numbers for unused hours, negative for overages
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rollover-note">Note (Optional)</Label>
                  <Textarea
                    id="rollover-note"
                    placeholder="Add a note explaining the adjustment..."
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingRollover(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800"
                  >
                    Save Rollover
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
