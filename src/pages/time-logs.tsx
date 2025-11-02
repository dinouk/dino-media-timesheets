
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileDown, Calendar, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Client, TimeEntry, MonthlyAllocation, ClientStats } from "@/types";
import { calculateClientStats, processMonthlyRollover } from "@/lib/timeCalculations";

export default function TimeLogsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [monthlyAllocations, setMonthlyAllocations] = useState<MonthlyAllocation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [stats, setStats] = useState<ClientStats | null>(null);

  useEffect(() => {
    setMounted(true);
    const user = localStorage.getItem("currentUser");
    if (!user) {
      router.push("/");
      return;
    }
    loadData();
    const now = new Date();
    setSelectedMonth((now.getMonth() + 1).toString());
    setSelectedYear(now.getFullYear().toString());
  }, [router]);

  const loadData = () => {
    const savedClients = localStorage.getItem("clients");
    const savedEntries = localStorage.getItem("timeEntries");
    const savedAllocations = localStorage.getItem("monthlyAllocations");

    if (savedClients) setClients(JSON.parse(savedClients));
    if (savedEntries) setTimeEntries(JSON.parse(savedEntries));
    if (savedAllocations) setMonthlyAllocations(JSON.parse(savedAllocations));
  };

  useEffect(() => {
    if (selectedClientId && selectedMonth && selectedYear && clients.length > 0) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        const updatedAllocations = processMonthlyRollover(
          clients,
          timeEntries,
          monthlyAllocations,
          selectedMonth,
          parseInt(selectedYear)
        );
        setMonthlyAllocations(updatedAllocations);
        localStorage.setItem("monthlyAllocations", JSON.stringify(updatedAllocations));

        const clientStats = calculateClientStats(
          client,
          selectedMonth,
          parseInt(selectedYear),
          timeEntries,
          updatedAllocations
        );
        setStats(clientStats);
      }
    }
  }, [selectedClientId, selectedMonth, selectedYear, clients, timeEntries]);

  const filteredEntries = timeEntries
    .filter(entry => 
      entry.clientId === selectedClientId &&
      entry.month === `${selectedYear}-${selectedMonth.padStart(2, "0")}`
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleExportPDF = () => {
    if (!selectedClient || !stats) return;

    const monthName = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const content = `
TIMESHEET REPORT
================

Client: ${selectedClient.name}
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
    link.download = `timesheet-${selectedClient.name}-${selectedYear}-${selectedMonth.padStart(2, "0")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!mounted) return null;

  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-slate-700 bg-clip-text text-transparent">
            Time Logs
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Filter Time Logs
            </CardTitle>
            <CardDescription>Select a client and month to view time entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
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
                      {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
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
              <p className="text-slate-600">Choose a client and month to view time logs</p>
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
