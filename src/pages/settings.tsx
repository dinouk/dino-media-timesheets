
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { Upload, Image as ImageIcon, X, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = localStorage.getItem("currentUser");
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);
    
    const savedLogo = localStorage.getItem("companyLogo");
    if (savedLogo) {
      setLogoUrl(savedLogo);
      setLogoPreview(savedLogo);
    }
  }, [router]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLogo = () => {
    if (logoPreview) {
      localStorage.setItem("companyLogo", logoPreview);
      setLogoUrl(logoPreview);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handleRemoveLogo = () => {
    localStorage.removeItem("companyLogo");
    setLogoUrl("");
    setLogoPreview("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <AppHeader currentUser={currentUser} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Settings</h2>
            <p className="text-slate-600">Customize your timesheet preferences</p>
          </div>

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-800">
              <CheckCircle className="w-5 h-5" />
              <p className="font-medium">Settings saved successfully!</p>
            </div>
          )}

          <Card>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 bg-white hover:bg-red-50 hover:text-red-600"
                      onClick={() => setLogoPreview("")}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleSaveLogo} className="gap-2">
                      <Upload className="w-4 h-4" />
                      Save Logo
                    </Button>
                    {logoUrl && (
                      <Button variant="destructive" onClick={handleRemoveLogo} className="gap-2">
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
