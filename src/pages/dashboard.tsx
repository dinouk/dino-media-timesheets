
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Clock, LogOut, TrendingUp, FileText, Calendar } from "lucide-react";
import Link from "next/link";
import { Client, TimeEntry } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
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
  }, [router]);

  const loadData = () => {
    const savedClients = localStorage.getItem("clients");
    const savedEntries = localStorage.getItem("timeEntries");
    
    if (savedClients) setClients(JSON.parse(savedClients));
    if (savedEntries) setTimeEntries(JSON.parse(savedEntries));
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  if (!mounted) return null;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthEntries = timeEntries.filter(entry => entry.month === currentMonth);
  const totalHoursThisMonth = thisMonthEntries.reduce((sum, entry) => sum + entry.hours, 0);
  
  const recentEntries = [...timeEntries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-slate-700 bg-clip-text text-transparent">
              Timesheets
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">{currentUser}</p>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="gap-2 hover:bg-slate-100">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h2>
          <p className="text-slate-600">Welcome back! Here's an overview of your time tracking.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">Total Clients</CardTitle>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{clients.length}</div>
              <p className="text-xs text-slate-500 mt-1">Active clients</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">This Month</CardTitle>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{totalHoursThisMonth.toFixed(1)}h</div>
              <p className="text-xs text-slate-500 mt-1">Hours logged</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">Total Entries</CardTitle>
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{timeEntries.length}</div>
              <p className="text-xs text-slate-500 mt-1">Time entries</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Recent Activity
              </CardTitle>
              <CardDescription>Your latest time entries</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No time entries yet</p>
                  <Link href="/log-time">
                    <Button variant="link" className="mt-2">Log your first entry</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEntries.map(entry => {
                    const client = clients.find(c => c.id === entry.clientId);
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{client?.name || "Unknown Client"}</p>
                          <p className="text-sm text-slate-600">{new Date(entry.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-blue-600">{entry.hours}h</p>
                          <div className="flex gap-1 mt-1 justify-end">
                            {entry.tags.slice(0, 2).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs px-1.5 py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-lg cursor-pointer group">
              <Link href="/clients">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">Manage Clients</CardTitle>
                      <CardDescription>Add, edit, and view your clients</CardDescription>
                    </div>
                    <Users className="w-10 h-10 text-blue-600 group-hover:scale-110 transition-transform" />
                  </div>
                </CardHeader>
              </Link>
            </Card>

            <Card className="border-2 border-green-100 hover:border-green-300 transition-all hover:shadow-lg cursor-pointer group">
              <Link href="/log-time">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg group-hover:text-green-600 transition-colors">Log Time</CardTitle>
                      <CardDescription>Record time spent on client work</CardDescription>
                    </div>
                    <Plus className="w-10 h-10 text-green-600 group-hover:scale-110 transition-transform" />
                  </div>
                </CardHeader>
              </Link>
            </Card>

            <Card className="border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-lg cursor-pointer group">
              <Link href="/time-logs">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg group-hover:text-purple-600 transition-colors">View Time Logs</CardTitle>
                      <CardDescription>Review and export time entries</CardDescription>
                    </div>
                    <Clock className="w-10 h-10 text-purple-600 group-hover:scale-110 transition-transform" />
                  </div>
                </CardHeader>
              </Link>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
