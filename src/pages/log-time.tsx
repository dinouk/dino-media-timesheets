import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Client, TimeEntry, MonthlyAllocation } from "@/types";
import { getMonthKey, processMonthlyRollover, calculateClientStats } from "@/lib/timeCalculations";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/AppHeader";

export default function LogTimePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [hours, setHours] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState("");

  const minDate = "2025-10-01";
  const maxDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setMounted(true);
    const user = localStorage.getItem("currentUser");
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);
    loadClients();
    setSelectedDate(new Date().toISOString().split("T")[0]);
  }, [router]);

  useEffect(() => {
    if (clients.length > 0 && router.query.clientId && typeof router.query.clientId === "string") {
      setSelectedClientId(router.query.clientId);
    }
  }, [router.query.clientId, clients]);

  const loadClients = () => {
    const savedClients = localStorage.getItem("clients");
    if (savedClients) {
      const allClients: Client[] = JSON.parse(savedClients);
      setClients(allClients.filter(client => !client.archived));
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId || !selectedDate || !hours || selectedTags.length === 0 || !description.trim()) {
      alert("Please fill in all fields including description and select at least one tag");
      return;
    }

    const date = new Date(selectedDate);
    const monthKey = getMonthKey(date);

    const newEntry: TimeEntry = {
      id: Date.now().toString(),
      clientId: selectedClientId,
      date: selectedDate,
      hours: parseFloat(hours),
      tags: selectedTags,
      description: description.trim(),
      month: monthKey,
      year: date.getFullYear(),
      createdAt: new Date().toISOString(),
    };

    const savedEntries = localStorage.getItem("timeEntries");
    const timeEntries: TimeEntry[] = savedEntries ? JSON.parse(savedEntries) : [];
    timeEntries.push(newEntry);
    localStorage.setItem("timeEntries", JSON.stringify(timeEntries));

    const savedAllocations = localStorage.getItem("monthlyAllocations");
    const monthlyAllocations: MonthlyAllocation[] = savedAllocations ? JSON.parse(savedAllocations) : [];
    
    const updatedAllocations = processMonthlyRollover(
      clients,
      timeEntries,
      monthlyAllocations,
      (date.getMonth() + 1).toString(),
      date.getFullYear()
    );
    localStorage.setItem("monthlyAllocations", JSON.stringify(updatedAllocations));

    // Redirect to time-logs page with client and month pre-selected
    router.push({
      pathname: "/time-logs",
      query: {
        clientId: selectedClientId,
        month: monthKey,
      },
    });
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={currentUser} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Log Time</h2>
          <p className="text-slate-600">Record time spent on client projects</p>
        </div>

        <Card className="max-w-2xl mx-auto shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-brand-primary" />
              Record Time Entry
            </CardTitle>
            <CardDescription>Log time spent working on client projects</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-12">
                <div className="mb-4 flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-green-600 mb-2">Time Logged Successfully!</h3>
                <p className="text-slate-600">Your time entry has been recorded</p>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 mb-4">You need to add clients first</p>
                <Link href="/clients">
                  <Button>Go to Clients</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={minDate}
                    max={maxDate}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hours">Hours (15-minute intervals) *</Label>
                  <Select value={hours} onValueChange={setHours}>
                    <SelectTrigger id="hours">
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
                  <Label htmlFor="description">Task Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the work performed..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${
                            selectedTags.includes(tag)
                              ? "bg-brand-primary hover:bg-brand-primary-hover"
                              : "hover:bg-slate-200"
                          }`}
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedClient && selectedClient.tags.length === 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      This client has no tags. Add tags to the client first.
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800"
                  disabled={!selectedClient || selectedClient.tags.length === 0}
                >
                  Log Time Entry
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
