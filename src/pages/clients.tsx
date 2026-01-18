import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, X, Tag as TagIcon, Archive, ArchiveRestore, MoreVertical } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { clientService } from "@/services/clientService";
import { timeEntryService } from "@/services/timeEntryService";
import { monthlyAllocationService } from "@/services/monthlyAllocationService";
import { brandService } from "@/services/brandService";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"] & {
  brands: { name: string; logo_url: string; brand_color: string } | null;
};
type Brand = Database["public"]["Tables"]["brands"]["Row"];
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
type MonthlyAllocation = Database["public"]["Tables"]["monthly_allocations"]["Row"];
type StatusFilter = "active" | "archived";
type BudgetFilter = "all" | "remaining" | "over";
type RecordingTypeFilter = "all" | "open" | "time_allocation";

interface ClientStats {
  allocatedHours: number;
  rolloverHours: number;
  usedHours: number;
  remainingHours: number;
}

export default function ClientsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("all");
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [monthlyAllocations, setMonthlyAllocations] = useState<MonthlyAllocation[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("all");
  const [recordingTypeFilter, setRecordingTypeFilter] = useState<RecordingTypeFilter>("all");
  const [formData, setFormData] = useState({
    name: "",
    allocatedHours: "",
    brandId: "",
    recordingType: "time_allocation"
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setMounted(true);
    if (!loading && !user) {
      router.push("/");
      return;
    }
    if (user) {
      fetchClients();
      fetchBrands();
    }
  }, [user, loading, router]);

  // Sync filters with URL query params on mount
  useEffect(() => {
    if (router.isReady) {
      const { status, budgetStatus, recordingType } = router.query;

      if (status && typeof status === "string") {
        if (["active", "archived"].includes(status)) {
          setStatusFilter(status as StatusFilter);
        }
      }

      if (budgetStatus && typeof budgetStatus === "string") {
        if (["all", "remaining", "over"].includes(budgetStatus)) {
          setBudgetFilter(budgetStatus as BudgetFilter);
        }
      }

      if (recordingType && typeof recordingType === "string") {
        if (["all", "open", "time_allocation"].includes(recordingType)) {
          setRecordingTypeFilter(recordingType as RecordingTypeFilter);
        }
      }
    }
  }, [router.isReady]);

  // Update URL when filters change
  const handleStatusFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    const newQuery: Record<string, string> = {};
    if (value !== "active") {
      newQuery.status = value;
    }
    if (budgetFilter !== "all") {
      newQuery.budgetStatus = budgetFilter;
    }
    if (recordingTypeFilter !== "all") {
      newQuery.recordingType = recordingTypeFilter;
    }
    router.push({
      pathname: router.pathname,
      query: newQuery
    }, undefined, { shallow: true });
  };

  const handleBudgetFilterChange = (value: BudgetFilter) => {
    setBudgetFilter(value);
    const newQuery: Record<string, string> = {};
    if (statusFilter !== "active") {
      newQuery.status = statusFilter;
    }
    if (value !== "all") {
      newQuery.budgetStatus = value;
    }
    if (recordingTypeFilter !== "all") {
      newQuery.recordingType = recordingTypeFilter;
    }
    router.push({
      pathname: router.pathname,
      query: newQuery
    }, undefined, { shallow: true });
  };

  const handleRecordingTypeFilterChange = (value: RecordingTypeFilter) => {
    setRecordingTypeFilter(value);
    const newQuery: Record<string, string> = {};
    if (statusFilter !== "active") {
      newQuery.status = statusFilter;
    }
    if (budgetFilter !== "all") {
      newQuery.budgetStatus = budgetFilter;
    }
    if (value !== "all") {
      newQuery.recordingType = value;
    }
    router.push({
      pathname: router.pathname,
      query: newQuery
    }, undefined, { shallow: true });
  };

  const fetchBrands = async () => {
    if (!user) return;
    
    try {
      const data = await brandService.getBrands(user.id);
      setBrands(data || []);
    } catch (error) {
      console.error("Error fetching brands:", error);
      toast({
        title: "Error",
        description: "Failed to load brands",
        variant: "destructive",
      });
    }
  };

  const fetchClients = async () => {
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
        description: "Failed to load clients and time entries",
        variant: "destructive"
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isOpenRecording = formData.recordingType === "open";
    
    if (!formData.name || (!isOpenRecording && !formData.allocatedHours) || !formData.brandId || !user) {
      toast({
        title: "Validation Error",
        description: isOpenRecording 
          ? "Please fill in all required fields including Brand"
          : "Please fill in all required fields including Brand and Allocated Hours",
        variant: "destructive"
      });
      return;
    }

    if (tags.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one tag",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingClient) {
        await clientService.updateClient(editingClient.id, {
          name: formData.name,
          allocated_hours_per_month: isOpenRecording ? 0 : parseFloat(formData.allocatedHours),
          brand_id: formData.brandId,
          tags: tags,
          recording_type: formData.recordingType
        });

        toast({
          title: "Client Updated",
          description: `${formData.name} has been successfully updated`
        });
      } else {
        await clientService.createClient({
          user_id: user.id,
          name: formData.name,
          allocated_hours_per_month: isOpenRecording ? 0 : parseFloat(formData.allocatedHours),
          brand_id: formData.brandId,
          tags: tags,
          archived: false,
          recording_type: formData.recordingType
        });

        toast({
          title: "Client Created",
          description: `${formData.name} has been successfully added`
        });
      }

      setIsDialogOpen(false);
      resetForm();
      await fetchClients();
    } catch (error: any) {
      console.error("Error saving client:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save client",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    setFormData({
      name: client.name,
      allocatedHours: client.allocated_hours_per_month.toString(),
      brandId: client.brand_id || "",
      recordingType: client.recording_type || "time_allocation"
    });
    setTags(client.tags as string[] || []);
    setIsDialogOpen(true);
  };

  const handleDelete = async (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clientToDelete = clients.find((c) => c.id === clientId);
    if (!confirm("Are you sure you want to delete this client?")) return;

    try {
      await clientService.deleteClient(clientId);

      toast({
        title: "Client Deleted",
        description: `${clientToDelete?.name || "Client"} has been successfully deleted`
      });

      await fetchClients();
    } catch (error: any) {
      console.error("Error deleting client:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive"
      });
    }
  };

  const handleToggleArchive = async (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    try {
      await clientService.archiveClient(clientId, !client.archived);

      toast({
        title: client.archived ? "Client Unarchived" : "Client Archived",
        description: `${client.name} has been ${client.archived ? "unarchived" : "archived"}`
      });

      await fetchClients();
    } catch (error: any) {
      console.error("Error toggling archive:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update client",
        variant: "destructive"
      });
    }
  };

  const handleClientClick = (clientId: string) => {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    router.push(`/time-logs?clientId=${clientId}&period=${currentPeriod}`);
  };

  const handleAddTimeLog = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/time-logs?clientId=${clientId}&add=true`);
  };

  const resetForm = () => {
    setFormData({ name: "", allocatedHours: "", brandId: "", recordingType: "allocation" });
    setTags([]);
    setTagInput("");
    setEditingClient(null);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const getCurrentMonthStats = (client: Client): ClientStats => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;

    const allocation = monthlyAllocations.find(
      (a) => a.client_id === client.id && a.month === currentMonth
    );

    const monthEntries = timeEntries.filter(
      (entry) => entry.client_id === client.id && entry.month === currentMonth
    );

    const usedHours = monthEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const allocatedHours = allocation?.allocated_hours ?? client.allocated_hours_per_month;
    const rolloverHours = allocation?.rollover_hours ?? 0;
    const remainingHours = allocatedHours + rolloverHours - usedHours;

    return {
      allocatedHours,
      rolloverHours,
      usedHours,
      remainingHours
    };
  };

  const filteredClients = clients.filter((client) => {
    // Filter by brand
    if (selectedBrandFilter && selectedBrandFilter !== "all") {
      if (client.brand_id !== selectedBrandFilter) {
        return false;
      }
    }
    
    // Filter by recording type
    if (recordingTypeFilter !== "all") {
      const clientRecordingType = client.recording_type || "time_allocation";
      if (clientRecordingType !== recordingTypeFilter) {
        return false;
      }
    }
    
    // Filter by status
    if (statusFilter === "active") return !client.archived;
    if (statusFilter === "archived") return client.archived;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

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
        {/* Filter Clients */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 min-h-[60px]">
            <CardTitle>Filter Clients</CardTitle>
            {(statusFilter !== "active" || budgetFilter !== "all" || selectedBrandFilter !== "all" || recordingTypeFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter("active");
                  setBudgetFilter("all");
                  setSelectedBrandFilter("all");
                  setRecordingTypeFilter("all");
                  router.push({
                    pathname: router.pathname,
                    query: {}
                  }, undefined, { shallow: true });
                }}
                className="h-7 px-2 text-xs"
              >
                Reset
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={budgetFilter} onValueChange={handleBudgetFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Budgets</SelectItem>
                    <SelectItem value="remaining">Time Remaining</SelectItem>
                    <SelectItem value="over">Over Budget</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select
                  value={recordingTypeFilter}
                  onValueChange={(value) => handleRecordingTypeFilterChange(value as RecordingTypeFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="allocation">Time Allocation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {brands.length > 1 && (
                <div>
                  <Select value={selectedBrandFilter} onValueChange={(value) => setSelectedBrandFilter(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {clients.length === 0 ? (
          <Card className="text-center py-12 border-2 border-slate-200">
            <CardContent>
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-brand-lighter flex items-center justify-center">
                  <TagIcon className="w-8 h-8 text-brand-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">No clients yet</h3>
              <p className="text-slate-600 mb-6">Get started by adding your first client</p>
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Client
              </Button>
            </CardContent>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card className="text-center py-12 border-2 border-slate-200">
            <CardContent>
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <Archive className="w-8 h-8 text-slate-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">No matching clients</h3>
              <p className="text-slate-600">Try changing the filters to see more clients</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Clients Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client) => {
                const stats = getCurrentMonthStats(client);
                const clientTags = client.tags as string[] || [];

                return (
                  <Card
                    key={client.id}
                    className={`hover:shadow-lg transition-all border-2 border-slate-200 hover:border-brand-primary cursor-pointer ${client.archived ? "opacity-75" : ""}`}
                    onClick={() => handleClientClick(client.id)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">{client.name}</h3>
                            <Badge variant={client.recording_type === "open" ? "secondary" : "default"}>
                              {client.recording_type === "open" ? "Open" : "Time Allocation"}
                            </Badge>
                          </div>
                          {client.archived && (
                            <Badge variant="secondary" className="bg-slate-200 text-slate-600">
                              Archived
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => handleEdit(client, e)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleToggleArchive(client.id, e)}>
                                {client.archived ? (
                                  <>
                                    <ArchiveRestore className="w-4 h-4 mr-2" />
                                    Unarchive
                                  </>
                                ) : (
                                  <>
                                    <Archive className="w-4 h-4 mr-2" />
                                    Archive
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleDelete(client.id, e)} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="default"
                            size="icon"
                            onClick={(e) => handleAddTimeLog(client.id, e)}
                            title="Add time log"
                            className="bg-brand-primary hover:bg-brand-primary-hover text-white shadow-md hover:shadow-lg transition-all rounded-sm h-9 w-9"
                          >
                            <Plus className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                      {client.brands && (
                        <div className="text-sm text-slate-500 mt-0.5">
                          {client.brands.name}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-sm font-medium text-muted-foreground mb-3">
                          Current Month
                        </div>
                        <div className="space-y-2">
                          {client.recording_type === "open" ? (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-900 font-semibold">Total Used:</span>
                                <span className="text-brand-primary font-bold">{stats.usedHours.toFixed(2)}h</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-900 font-semibold">Used: {stats.usedHours.toFixed(2)}h</span>
                                <span className={`font-semibold ${stats.remainingHours >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  Remaining: {stats.remainingHours.toFixed(2)}h
                                </span>
                              </div>
                              {(() => {
                                const totalAvailable = stats.allocatedHours + stats.rolloverHours;
                                let progressValue = 0;
                                let isOverBudget = false;

                                if (totalAvailable > 0) {
                                  progressValue = Math.min(stats.usedHours / totalAvailable * 100, 100);
                                  isOverBudget = stats.usedHours > totalAvailable;
                                } else if (totalAvailable === 0) {
                                  progressValue = stats.usedHours > 0 ? 100 : 0;
                                  isOverBudget = stats.usedHours > 0;
                                } else {
                                  progressValue = 100;
                                  isOverBudget = true;
                                }

                                return (
                                  <Progress
                                    value={progressValue}
                                    className="h-2 bg-slate-100"
                                    indicatorClassName={isOverBudget ? "bg-red-600" : "bg-green-600"}
                                  />
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-center pb-8 mt-8">
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800"
                onClick={() => setIsDialogOpen(true)}
                style={{ backgroundColor: "#0188a9", backgroundImage: "none" }}
              >
                <Plus className="w-5 h-5" />
                Add New Client
              </Button>
            </div>
          </>
        )}

        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
              <DialogDescription>
                {editingClient ? "Update client information" : "Create a new client with allocated hours, brand, and tags"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand *</Label>
                  <Select 
                    value={formData.brandId} 
                    onValueChange={(value) => setFormData({ ...formData, brandId: value })}
                  >
                    <SelectTrigger id="brand">
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: brand.brand_color }} 
                            />
                            {brand.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {brands.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No brands found. Please create a brand first.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Client Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Acme Corporation"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recordingType">Time Recording Type *</Label>
                  <Select 
                    value={formData.recordingType} 
                    onValueChange={(value) => setFormData({ ...formData, recordingType: value })}
                  >
                    <SelectTrigger id="recordingType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="allocation">Time Allocation</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    {formData.recordingType === "open" 
                      ? "Open: Track total hours used without monthly allocations"
                      : "Time Allocation: Track hours with monthly allocations and rollovers"}
                  </p>
                </div>

                {formData.recordingType === "time_allocation" && (
                  <div className="space-y-2">
                    <Label htmlFor="allocatedHours">Allocated Hours per Month *</Label>
                    <Input
                      id="allocatedHours"
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.allocatedHours}
                      onChange={(e) => setFormData({ ...formData, allocatedHours: e.target.value })}
                      placeholder="40"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder="Enter a tag and press Enter"
                    />
                    <Button type="button" onClick={handleAddTag} variant="outline" size="icon">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      {tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="gap-1 pl-3 pr-2 py-1 bg-brand-lighter text-brand-primary hover:bg-brand-light">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:bg-brand-light rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {tags.length === 0 && (
                    <p className="text-sm text-slate-500 mt-1">Add at least one tag for this client</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingClient ? "Update Client" : "Add Client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}