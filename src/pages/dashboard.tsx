import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { clientService } from "@/services/clientService";
import { timeEntryService } from "@/services/timeEntryService";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
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
  }, [user, loading, router]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoadingData(true);
      const [clientsData, entriesData] = await Promise.all([
        clientService.getClients(user.id),
        timeEntryService.getTimeEntries(user.id)
      ]);
      
      setClients(clientsData);
      setTimeEntries(entriesData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoadingData(false);
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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthEntries = timeEntries.filter(entry => entry.month === currentMonth);
  const totalHoursThisMonth = thisMonthEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  
  const recentEntries = [...timeEntries]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={user?.email || ""} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h2>
          <p className="text-slate-600">Welcome back! Here's an overview of your time tracking.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{totalHoursThisMonth.toFixed(1)}h</div>
              <p className="text-xs text-slate-500 mt-1">Hours logged</p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-2 border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Your latest time entries</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No time entries yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEntries.map(entry => {
                    const client = clients.find(c => c.id === entry.client_id);
                    const tags = entry.tags as string[] || [];
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{client?.name || "Unknown Client"}</p>
                          <p className="text-sm text-slate-600">{new Date(entry.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-brand-primary">{entry.hours}h</p>
                          <div className="flex gap-1 mt-1 justify-end">
                            {tags.slice(0, 2).map((tag, i) => (
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
        </div>
      </main>
    </div>
  );
}