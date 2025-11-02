import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, Calendar, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Client, TimeEntry, MonthlyAllocation, ClientStats } from "@/types";
import { calculateClientStats, processMonthlyRollover } from "@/lib/timeCalculations";
import { AppHeader } from "@/components/AppHeader";

export default function TimeLogsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [monthlyAllocations, setMonthlyAllocations] = useState<MonthlyAllocation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [currentUser, setCurrentUser] = useState("");

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

    if (savedClients) setClients(JSON.parse(savedClients));
    if (savedEntries) setTimeEntries(JSON.parse(savedEntries));
    if (savedAllocations) setMonthlyAllocations(JSON.parse(savedAllocations));
  };

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
          parseInt(year)
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
  }, [selectedClientId, selectedPeriod, clients, timeEntries]);

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
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const companyLogo = localStorage.getItem("companyLogo");
    
    let content = `TIMESHEET REPORT\n================\n\n`;
    
    if (companyLogo) {
      content += `[Company Logo Included]\n\n`;
    }
    
    content += `Client: ${selectedClient.name}
Period: ${monthName}

STATISTICS
----------
Allocated Hours: ${stats.allocatedHours.toFixed(2)}
Rollover Hours: ${stats.rolloverHours.toFixed(2)}
Used Hours: ${stats.usedHours.toFixed(2)}
Remaining Hours: ${stats.remainingHours.toFixed(2)}

TIME ENTRIES
------------
${filteredEntries.map(entry => `
Date: ${new Date(entry.date).toLocaleDateString()}
Hours: ${entry.hours}
Description: ${entry.description}
Tags: ${entry.tags.join(", ")}
`).join("\n")}

Total Entries: ${filteredEntries.length}
Total Hours: ${stats.usedHours.toFixed(2)}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet-${selectedClient.name}-${selectedPeriod}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={currentUser} />

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
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
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card className="border-2 border-blue-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Allocated Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.allocatedHours.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Rollover Hours</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              <Card className="border-2 border-green-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Used Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.usedHours.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card className={`border-2 ${stats.remainingHours >= 0 ? "border-emerald-100" : "border-red-100"}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Remaining Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className={`text-2xl font-bold ${stats.remainingHours >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {stats.remainingHours.toFixed(2)}
                    </div>
                    {stats.remainingHours < 0 && <AlertCircle className="w-5 h-5 text-red-600" />}
                  </div>
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
                      Export as Text
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">
                              {new Date(entry.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-blue-600">{entry.hours} hours</span>
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
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
      </main>
    </div>
  );
}
