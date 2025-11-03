import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { Calendar, TrendingUp, TrendingDown, Edit2, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { clientService } from "@/services/clientService";
import { timeEntryService } from "@/services/timeEntryService";
import { monthlyAllocationService } from "@/services/monthlyAllocationService";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
type MonthlyAllocation = Database["public"]["Tables"]["monthly_allocations"]["Row"];

export default function RolloverManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [monthlyAllocations, setMonthlyAllocations] = useState<MonthlyAllocation[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [editingRollover, setEditingRollover] = useState<{ clientId: string; month: string } | null>(null);
  const [editForm, setEditForm] = useState({
    rolloverHours: "",
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
      const [clientsData, entriesData, allocationsData] = await Promise.all([
        clientService.getClients(user.id),
        timeEntryService.getTimeEntries(user.id),
        monthlyAllocationService.getMonthlyAllocations(user.id),
      ]);
      
      setClients(clientsData);
      setTimeEntries(entriesData);
      setMonthlyAllocations(allocationsData);
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

      // Calculate auto rollover based on previous month's data
      const [year, month] = selectedPeriod.split("-");
      const prevDate = new Date(parseInt(year), parseInt(month) - 2);
      const prevMonth = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, "0")}`;
      
      const prevAllocation = monthlyAllocations.find(
        a => a.client_id === client.id && a.month === prevMonth
      );
      
      const prevEntries = timeEntries.filter(
        e => e.client_id === client.id && e.month === prevMonth
      );
      
      const prevUsedHours = prevEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
      const prevAllocatedHours = Number(prevAllocation?.allocated_hours ?? client.allocated_hours_per_month);
      const prevRolloverHours = Number(prevAllocation?.rollover_hours ?? 0);
      
      const autoCalculated = prevAllocatedHours + prevRolloverHours - prevUsedHours;
      const currentRollover = existingAllocation ? Number(existingAllocation.rollover_hours) : autoCalculated;

      return {
        client,
        autoCalculated,
        currentRollover,
        hasAllocation: !!existingAllocation,
      };
    });
  };

  const handleEditRollover = (clientId: string) => {
    const data = getRolloverData().find(d => d.client.id === clientId);
    if (!data) return;

    setEditingRollover({ clientId, month: selectedPeriod });
    setEditForm({
      rolloverHours: data.currentRollover.toString(),
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
        allocated_hours: Number(existingAllocation?.allocated_hours ?? client.allocated_hours_per_month),
        rollover_hours: rolloverHours,
      });

      toast({
        title: "Rollover Updated",
        description: "Rollover hours have been saved successfully",
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
              View and manage rollover hours for each client. The system automatically calculates rollover from the previous month's remaining balance on the 1st of each month.
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

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How Rollover Works:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Rollover is automatically calculated: Allocated + Previous Rollover - Used Hours</li>
                    <li>Positive values = unused time carried forward</li>
                    <li>Negative values = overage carried forward</li>
                    <li>You can manually adjust any month's rollover if needed</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedPeriod && (
          <Card>
            <CardHeader>
              <CardTitle>Rollover Hours for {periodOptions.find(p => p.value === selectedPeriod)?.label}</CardTitle>
              <CardDescription>
                View and edit rollover hours for all clients
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
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rolloverData.map(({ client, autoCalculated, currentRollover, hasAllocation }) => {
                        const isDifferent = hasAllocation && Math.abs(autoCalculated - currentRollover) > 0.01;
                        
                        return (
                          <TableRow key={client.id}>
                            <TableCell className="font-medium">{client.name}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <span className={`font-semibold ${autoCalculated >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {autoCalculated.toFixed(2)}h
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
                                  {currentRollover.toFixed(2)}h
                                </span>
                                {currentRollover >= 0 ? (
                                  <TrendingUp className="w-4 h-4 text-brand-primary" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {isDifferent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                  <Edit2 className="w-3 h-3" />
                                  Manually Adjusted
                                </span>
                              ) : hasAllocation ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  <TrendingUp className="w-3 h-3" />
                                  Auto
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                                  Not Set
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRollover(client.id)}
                                className="gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                {hasAllocation ? "Edit" : "Set"}
                              </Button>
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
