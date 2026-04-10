import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { isLoggedIn, isAdmin } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoggedIn && isAdmin) {
      setLocation("/admin");
    }
  }, [isLoggedIn, isAdmin, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Invalid credentials.");
        return;
      }
      const adminRoles = ["admin", "ADMIN", "SUPER_ADMIN", "super_admin"];
      if (!adminRoles.includes(data.role)) {
        setError("This account does not have admin privileges.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Signed in as admin" });
      setLocation("/admin");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <MapPin className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-bold flex items-center justify-center gap-2" data-testid="text-admin-login-title">
            <Shield className="h-5 w-5" />
            Admin Sign In
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in with your admin credentials.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              data-testid="input-admin-email"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="input-admin-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                data-testid="button-toggle-admin-password"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" data-testid="text-admin-login-error">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            data-testid="button-admin-login-submit"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
