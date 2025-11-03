import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showManualSignup, setShowManualSignup] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState("");
  const [manualSignupForm, setManualSignupForm] = useState({
    name: "",
    email: "",
  });
  const [signupSubmitted, setSignupSubmitted] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email");
      return;
    }

    if (isForgotPassword) {
      try {
        const { error: resetError } = await authService.resetPassword(email);
        if (resetError) {
          setError(resetError.message);
        } else {
          setError("Password reset email sent! Please check your inbox.");
          setTimeout(() => {
            setIsForgotPassword(false);
            setError("");
          }, 3000);
        }
      } catch (err: any) {
        setError(err.message || "Failed to send reset email");
      }
      return;
    }

    if (!password) {
      setError("Please enter your password");
      return;
    }

    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
  };

  const handleManualSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!manualSignupForm.name.trim() || !manualSignupForm.email.trim()) {
      setError("Please provide both name and email");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manualSignupForm.email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      const response = await fetch("/api/signup-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: manualSignupForm.name.trim(),
          email: manualSignupForm.email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit signup request");
      }

      setSignupSubmitted(true);
      setManualSignupForm({ name: "", email: "" });
    } catch (err: any) {
      console.error("Error submitting signup request:", err);
      setError(err.message || "Failed to submit request. Please try again.");
    }
  };

  if (loading) {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-slate-700 bg-clip-text text-transparent">
            Timesheets
          </CardTitle>
          <CardDescription className="text-base">
            {showManualSignup ? "Request access to Timesheets" : "Sign in to track your time"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showManualSignup ? (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="transition-all focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              {!isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="transition-all focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              )}
              {error && (
                <div className={`text-sm ${error.includes("check your email") || error.includes("reset email sent") ? "text-green-600 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"} border rounded-md p-3`}>
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800 transition-all shadow-md">
                {isForgotPassword ? "Send Reset Link" : "Sign In"}
              </Button>
              <div className="text-center space-y-2">
                {!isForgotPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualSignup(true);
                      setError("");
                    }}
                    className="text-sm text-brand-primary hover:text-brand-primary-hover underline-offset-4 hover:underline transition-colors block w-full"
                  >
                    Need an account? Request access
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(!isForgotPassword);
                    setError("");
                    setPassword("");
                  }}
                  className="text-sm text-slate-600 hover:text-brand-primary underline-offset-4 hover:underline transition-colors block w-full"
                >
                  {isForgotPassword ? "Back to sign in" : "Forgot password?"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {signupSubmitted ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Thank you! Your request has been received. A member of our team will be in touch shortly.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-slate-700">
                    Sign ups are currently manual - please enter your details below and a member of our team will be in touch
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleManualSignupSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name *</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Smith"
                    value={manualSignupForm.name}
                    onChange={(e) => setManualSignupForm({ ...manualSignupForm, name: e.target.value })}
                    className="transition-all focus:ring-2 focus:ring-brand-primary"
                    disabled={signupSubmitted}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email Address *</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={manualSignupForm.email}
                    onChange={(e) => setManualSignupForm({ ...manualSignupForm, email: e.target.value })}
                    className="transition-all focus:ring-2 focus:ring-brand-primary"
                    disabled={signupSubmitted}
                  />
                </div>
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border-red-200 border rounded-md p-3">
                    {error}
                  </div>
                )}
                {!signupSubmitted && (
                  <Button type="submit" className="w-full bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800 transition-all shadow-md">
                    Request Access
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowManualSignup(false);
                    setSignupSubmitted(false);
                    setManualSignupForm({ name: "", email: "" });
                    setError("");
                  }}
                  className="text-sm text-slate-600 hover:text-brand-primary underline-offset-4 hover:underline transition-colors block w-full text-center"
                >
                  Back to sign in
                </button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
