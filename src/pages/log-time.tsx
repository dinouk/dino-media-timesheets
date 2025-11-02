import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle2, Upload, X, FileIcon } from "lucide-react";
import Link from "next/link";
import { Client, TimeEntry, MonthlyAllocation } from "@/types";
import { getMonthKey, processMonthlyRollover, calculateClientStats } from "@/lib/timeCalculations";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";

export default function LogTimePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [hours, setHours] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<Array<{ id: string; name: string; displayName: string; data: string; type: string; size: number }>>([]);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    Array.from(uploadedFiles).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newFile = {
          id: Date.now().toString() + Math.random().toString(),
          name: file.name,
          displayName: file.name,
          data: event.target?.result as string,
          type: file.type,
          size: file.size,
        };
        setFiles((prev) => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = "";
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId || !selectedDate || !hours || selectedTags.length === 0 || !description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields including description and select at least one tag",
        variant: "destructive",
      });
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
      files: files.length > 0 ? files : undefined,
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

    toast({
      title: "Time Entry Created",
      description: "Your time entry has been successfully logged",
    });

    // Redirect to time-logs page with client and month pre-selected
    router.push({
      pathname: "/time-logs",
      query: {
        clientId: selectedClientId,
        period: monthKey,
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

                <div className="space-y-2">
                  <Label htmlFor="files">Attachments (Optional)</Label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-brand-primary transition-colors">
                    <input
                      id="files"
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                    />
                    <label
                      htmlFor="files"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm font-medium text-slate-600">Click to upload files</span>
                      <span className="text-xs text-slate-500 mt-1">PDF, DOC, XLS, Images, TXT</span>
                    </label>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-sm font-medium text-slate-700">Attached Files ({files.length})</p>
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <FileIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <Input
                              type="text"
                              value={file.displayName}
                              onChange={(e) => {
                                setFiles(prev => 
                                  prev.map(f => 
                                    f.id === file.id ? { ...f, displayName: e.target.value } : f
                                  )
                                );
                              }}
                              placeholder="Display name..."
                              className="h-9 text-sm mb-1"
                            />
                            <p className="text-xs text-slate-500">Original: {file.name} ({formatFileSize(file.size)})</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(file.id)}
                            className="flex-shrink-0 h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
