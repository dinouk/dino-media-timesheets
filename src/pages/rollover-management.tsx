
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
import { Client, TimeEntry, MonthlyAllocation, ManualRollover } from "@/types";
import { calculateAutoRollover, processMonthlyRollover, getMonthKey } from "@/lib/timeCalculations";
import { useToast } from "@/hooks/use-toast";
import { Calendar, TrendingUp, TrendingDown, Edit2, RefreshCw } from "lucide-react";

export default function RolloverManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
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

  useEffect(() => {
    setMounted(true);
    const user = localStorage.getItem("currentUser");
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);
    loadData();

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    setSelectedPeriod(currentPeriod);
  }, [router]);

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
        a => a.clientId === client.id && a.month === selectedPeriod
      );

      const manualRollover = manualRollovers.find(
        r => r.clientId === client.id && r.month === selectedPeriod
      );

      const autoCalculated = calculateAutoRollover(
        client,
        selectedPeriod,
        timeEntries,
        monthlyAllocations
      );

      const currentRollover = existingAllocation?.rolloverHours ?? autoCalculated;
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
      r => r.clientId === clientId && r.month === selectedPeriod
    );

    setEditingRollover({ clientId, month: selectedPeriod });
    setEditForm({
      rolloverHours: data.currentRollover.toString(),
      note: manualRollover?.note || "",
    });
  };

  const handleSaveRollover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRollover) return;

    const rolloverHours = parseFloat(editForm.rolloverHours);
    if (isNaN(rolloverHours)) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid number for rollover hours",
        variant: "destructive",
      });
      return;
    }

    const existingIndex = manualRollovers.findIndex(
      r => r.clientId === editingRollover.clientId && r.month === editingRollover.month
    );

    let updatedRollovers: ManualRollover[];

    if (existingIndex !== -1) {
      updatedRollovers = [...manualRollovers];
      updatedRollovers[existingIndex] = {
        ...updatedRollovers[existingIndex],
        rolloverHours,
        note: editForm.note,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const newRollover: ManualRollover = {
        id: Date.now().toString(),
        clientId: editingRollover.clientId,
        month: editingRollover.month,
        year: parseInt(editingRollover.month.split("-")[0]),
        rolloverHours,
        note: editForm.note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedRollovers = [...manualRollovers, newRollover];
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
      description: "Manual rollover hours have been saved successfully",
    });

    setEditingRollover(null);
    loadData();
  };

  const handleResetToAuto = (clientId: string) => {
    if (!confirm("Reset to automatically calculated rollover? This will remove any manual adjustments.")) {
      return;
    }

    const updatedRollovers = manualRollovers.filter(
      r => !(r.clientId === clientId && r.month === selectedPeriod)
    );

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
      title: "Rollover Reset",
      description: "Rollover has been reset to automatic calculation",
    });

    loadData();
  };

  const rolloverData = getRolloverData();

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={currentUser} />

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
