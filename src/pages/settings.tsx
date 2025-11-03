import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { Upload, Image as ImageIcon, X, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { storageService } from "@/services/storageService";
import { userSettingsService } from "@/services/userSettingsService";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const [currentLogoPath, setCurrentLogoPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!loading && !user) {
      router.push("/");
      return;
    }
    if (user) {
      loadUserSettings();
    }
  }, [user, loading, router]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    try {
      const settings = await userSettingsService.getUserSettings(user.id);
      if (settings?.company_logo_url) {
        setLogoPreview(settings.company_logo_url);
        setCurrentLogoPath(settings.company_logo_path || "");
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 2MB",
          variant: "destructive",
        });
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an image file",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLogo = async () => {
    if (!selectedFile || !user) {
      toast({
        title: "No File Selected",
        description: "Please select a logo to upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Delete old logo if exists
      if (currentLogoPath) {
        try {
          await storageService.deleteFile("company-logos", currentLogoPath);
        } catch (error) {
          console.error("Error deleting old logo:", error);
        }
      }

      // Upload new logo
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/logo.${fileExt}`;
      
      await storageService.uploadFile("company-logos", fileName, selectedFile);
      const publicUrl = await storageService.getPublicUrl("company-logos", fileName);

      // Save to user settings
      await userSettingsService.upsertUserSettings({
        user_id: user.id,
        company_logo_url: publicUrl,
        company_logo_path: fileName,
      });

      setCurrentLogoPath(fileName);
      setSelectedFile(null);

      toast({
        title: "Logo Saved",
        description: "Your company logo has been successfully uploaded",
      });
    } catch (error: any) {
      console.error("Error saving logo:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!user || !currentLogoPath) return;

    setUploading(true);

    try {
      await storageService.deleteFile("company-logos", currentLogoPath);
      
      await userSettingsService.updateUserSettings(user.id, {
        company_logo_url: null,
        company_logo_path: null,
      });

      setLogoPreview("");
      setCurrentLogoPath("");
      setSelectedFile(null);

      toast({
        title: "Logo Removed",
        description: "Your company logo has been successfully removed",
      });
    } catch (error: any) {
      console.error("Error removing logo:", error);
      toast({
        title: "Remove Failed",
        description: error.message || "Failed to remove logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!mounted || loading) {
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
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Settings</h2>
            <p className="text-slate-600">Customize your timesheet preferences</p>
          </div>

          <Card className="border-2 border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-brand-primary" />
                Company Logo
              </CardTitle>
              <CardDescription>Upload a logo to include in PDF exports (max 2MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {logoPreview ? (
                <div className="space-y-4">
                  <div className="relative w-full max-w-md mx-auto p-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                    <img 
                      src={logoPreview} 
                      alt="Company logo preview" 
                      className="max-h-32 mx-auto object-contain"
                    />
                    {!selectedFile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 bg-white hover:bg-red-50 hover:text-red-600"
                        onClick={() => setLogoPreview("")}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-3 justify-center">
                    {selectedFile && (
                      <Button 
                        onClick={handleSaveLogo} 
                        className="gap-2"
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Save Logo
                          </>
                        )}
                      </Button>
                    )}
                    {currentLogoPath && !selectedFile && (
                      <Button 
                        variant="destructive" 
                        onClick={handleRemoveLogo} 
                        className="gap-2"
                        disabled={uploading}
                      >
                        <X className="w-4 h-4" />
                        Remove Logo
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-brand-primary hover:bg-brand-lighter transition-colors">
                      <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Click to upload logo
                      </p>
                      <p className="text-xs text-slate-500">
                        PNG, JPG or SVG (max 2MB)
                      </p>
                    </div>
                  </Label>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}