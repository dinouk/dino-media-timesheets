
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, Clock, LogOut } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = localStorage.getItem("currentUser");
    if (!user) {
      router.push("/");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-slate-700 bg-clip-text text-transparent">
            Timesheets
          </h1>
          <Button variant="ghost" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h2>
          <p className="text-slate-600">Manage your clients and track time efficiently</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-lg cursor-pointer group">
            <Link href="/clients">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">Manage Clients</CardTitle>
                  <Users className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm">Add, edit, and view your clients</p>
              </CardContent>
            </Link>
          </Card>

          <Card className="border-2 border-green-100 hover:border-green-300 transition-all hover:shadow-lg cursor-pointer group">
            <Link href="/log-time">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-green-600 transition-colors">Log Time</CardTitle>
                  <Plus className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm">Record time spent on client work</p>
              </CardContent>
            </Link>
          </Card>

          <Card className="border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-lg cursor-pointer group">
            <Link href="/time-logs">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-purple-600 transition-colors">View Time Logs</CardTitle>
                  <Clock className="w-8 h-8 text-purple-600 group-hover:scale-110 transition-transform" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm">Review and export time entries</p>
              </CardContent>
            </Link>
          </Card>
        </div>
      </main>
    </div>
  );
}
