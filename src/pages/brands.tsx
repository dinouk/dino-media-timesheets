import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Palette, Upload } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { brandService } from "@/services/brandService";
import { storageService } from "@/services/storageService";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type Brand = Database["public"]["Tables"]["brands"]["Row"];

const brandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  brand_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color"),
  logo_url: z.string().optional().or(z.literal(""))
});

export default function BrandsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    brand_color: "#0188a9",
    logoFile: null as File | null,
    logoPreview: ""
  });

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
      const brandsData = await brandService.getBrands(user.id);
      setBrands(brandsData);
    } catch (error) {
      console.error("Error loading brands:", error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load brands",
        variant: "destructive"
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Logo must be under 5MB",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({
          ...formData,
          logoFile: file,
          logoPreview: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !user) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      let logoUrl = editingBrand?.logo_url || "";

      if (formData.logoFile) {
        const filePath = `${user.id}/${Date.now()}-${formData.logoFile.name}`;
        await storageService.uploadFile("brand-logos", filePath, formData.logoFile);
        logoUrl = await storageService.getPublicUrl("brand-logos", filePath);

        if (editingBrand?.logo_path) {
          await storageService.deleteFile("brand-logos", editingBrand.logo_path);
        }
      }

      if (editingBrand) {
        await brandService.updateBrand(editingBrand.id, {
          name: formData.name,
          brand_color: formData.brand_color,
          logo_url: logoUrl,
          logo_path: formData.logoFile ? `${user.id}/${Date.now()}-${formData.logoFile.name}` : editingBrand.logo_path
        });

        toast({
          title: "Brand Updated",
          description: `${formData.name} has been successfully updated`
        });
      } else {
        await brandService.createBrand({
          user_id: user.id,
          name: formData.name,
          brand_color: formData.brand_color,
          logo_url: logoUrl,
          logo_path: `${user.id}/${Date.now()}-${formData.logoFile!.name}`
        });

        toast({
          title: "Brand Created",
          description: `${formData.name} has been successfully added`
        });
      }

      setIsDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error("Error saving brand:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save brand",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      brand_color: brand.brand_color,
      logoFile: null,
      logoPreview: brand.logo_url
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (brandId: string) => {
    const brandToDelete = brands.find((b) => b.id === brandId);
    if (!confirm("Are you sure you want to delete this brand? This will affect all associated clients.")) return;

    try {
      if (brandToDelete?.logo_path) {
        await storageService.deleteFile("brand-logos", brandToDelete.logo_path);
      }
      
      await brandService.deleteBrand(brandId);

      toast({
        title: "Brand Deleted",
        description: `${brandToDelete?.name || "Brand"} has been successfully deleted`
      });

      await loadData();
    } catch (error: any) {
      console.error("Error deleting brand:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete brand",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      brand_color: "#0188a9",
      logoFile: null,
      logoPreview: ""
    });
    setEditingBrand(null);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={user?.email || ""} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Brand Management</h1>
          <p className="text-slate-600">Manage your brands with custom logos and colors for timesheet PDFs</p>
        </div>

        {brands.length === 0 ? (
          <Card className="text-center py-12 border-2 border-slate-200">
            <CardContent>
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-brand-lighter flex items-center justify-center">
                  <Palette className="w-8 h-8 text-brand-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">No brands yet</h3>
              <p className="text-slate-600 mb-6">Get started by adding your first brand</p>
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Brand
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {brands.map((brand) => (
                <Card
                  key={brand.id}
                  className="hover:shadow-lg transition-all border-2 border-slate-200 hover:border-brand-primary"
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{brand.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border border-slate-300"
                            style={{ backgroundColor: brand.brand_color }}
                          />
                          <span className="text-sm text-slate-600 font-mono">{brand.brand_color}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(brand)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(brand.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <img
                        src={brand.logo_url}
                        alt={brand.name}
                        className="max-h-24 max-w-full object-contain"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-center pb-8">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setIsDialogOpen(true)}
                style={{ backgroundColor: "#0188a9", backgroundImage: "none" }}
              >
                <Plus className="w-5 h-5" />
                Add New Brand
              </Button>
            </div>
          </>
        )}

        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingBrand ? "Edit Brand" : "Add New Brand"}</DialogTitle>
              <DialogDescription>
                {editingBrand ? "Update brand information" : "Create a new brand with logo and color"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Brand Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Company Name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color">Brand Color *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.brand_color}
                      onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.brand_color}
                      onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                      placeholder="#0188a9"
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Brand Logo {!editingBrand && "*"}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="logo"
                      type="file"
                      onChange={handleLogoChange}
                      accept="image/*"
                      className="cursor-pointer"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => document.getElementById("logo")?.click()}
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Max 5MB. PNG, JPG, or SVG recommended.</p>
                  
                  {formData.logoPreview && (
                    <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-sm font-medium text-slate-700 mb-2">Logo Preview</p>
                      <div className="flex items-center justify-center p-4 bg-white rounded border border-slate-200">
                        <img
                          src={formData.logoPreview}
                          alt="Logo preview"
                          className="max-h-24 max-w-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingBrand ? "Update Brand" : "Add Brand"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}