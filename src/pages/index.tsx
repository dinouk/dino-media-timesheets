import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      if (isRegistering) {
        await signUp(email, password);
        setError("Account created! Please check your email to verify your account.");
      } else {
        await signIn(email, password);
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
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
            {isRegistering ? "Create your account" : "Sign in to track your time"}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            {error && (
              <div className={`text-sm ${error.includes("check your email") ? "text-green-600 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"} border rounded-md p-3`}>
                {error}
              </div>
            )}
            <Button type="submit" className="w-full bg-gradient-to-r from-brand-primary to-slate-700 hover:from-brand-primary-hover hover:to-slate-800 transition-all shadow-md">
              {isRegistering ? "Create Account" : "Sign In"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError("");
                }}
                className="text-sm text-brand-primary hover:text-brand-primary-hover underline-offset-4 hover:underline transition-colors"
              >
                {isRegistering ? "Already have an account? Sign in" : "Need an account? Register"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}