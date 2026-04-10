import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, Crosshair, LogOut, Shield, Users, Loader2, AlertCircle } from "lucide-react";
import { useFieldAuth } from "@/hooks/use-field-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function FieldToolbar() {
  const [location, navigate] = useLocation();
  const { fieldUser, isAuthenticated, logout, isLoggingOut, dashboardUrl } = useFieldAuth();

  if (!isAuthenticated || !fieldUser) return null;

  const isOnFieldPage = location === "/face" || location === "/capture";
  const roleBadgeLabel = fieldUser.role === "admin"
    ? (fieldUser.adminRole || "Admin")
    : (fieldUser.operatorType || "Operator");

  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 bg-black/40 backdrop-blur-md border-b border-white/10"
      data-testid="field-toolbar"
    >
      <div className="flex items-center gap-2 min-w-0">
        {fieldUser.role === "admin" ? (
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Users className="w-4 h-4 text-purple-300 shrink-0" />
        )}
        <span className="text-white/90 text-sm font-medium truncate" data-testid="text-field-user-name">
          {fieldUser.name}
        </span>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 border-amber-400/50 text-amber-300 uppercase tracking-wider shrink-0"
          data-testid="badge-field-role"
        >
          {roleBadgeLabel}
        </Badge>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 text-xs gap-1 ${!isOnFieldPage ? "text-amber-300" : "text-white/60 hover:text-white"}`}
          onClick={() => navigate(dashboardUrl)}
          data-testid="button-goto-dashboard"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 text-xs gap-1 ${isOnFieldPage ? "text-amber-300" : "text-white/60 hover:text-white"}`}
          onClick={() => navigate("/face")}
          data-testid="button-goto-field"
        >
          <Crosshair className="w-3.5 h-3.5" />
          Field Tools
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-white/40 hover:text-red-400 gap-1"
          onClick={logout}
          disabled={isLoggingOut}
          data-testid="button-field-logout"
        >
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function FieldAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useFieldAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white/60 text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <FieldLoginForm />;
  }

  return <>{children}</>;
}

function FieldLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"operator" | "admin">("operator");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const url = loginMode === "operator" ? "/api/operator/login" : "/api/admin/login";

    try {
      await apiRequest("POST", url, { email, password, rememberMe });
      queryClient.invalidateQueries({ queryKey: ["/api/field/auth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operator/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: any) {
      const msg = err?.message || "Login failed. Check your credentials and try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white" data-testid="text-login-title">Sign In</h2>
          <p className="text-white/60 text-sm">
            Access your field tools — Capture Wizard, Trip Tracker, and more.
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 bg-white/5 rounded-lg p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            className={`flex-1 text-sm font-medium rounded-md ${
              loginMode === "operator"
                ? "bg-purple-600 text-white"
                : "text-white/50"
            }`}
            onClick={() => { setLoginMode("operator"); setError(null); }}
            data-testid="button-mode-operator"
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Operator
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            className={`flex-1 text-sm font-medium rounded-md ${
              loginMode === "admin"
                ? "bg-purple-600 text-white"
                : "text-white/50"
            }`}
            onClick={() => { setLoginMode("admin"); setError(null); }}
            data-testid="button-mode-admin"
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Admin
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-email" className="text-white/70 text-sm">Email</Label>
            <Input
              id="field-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400 focus:ring-purple-400/30"
              data-testid="input-field-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="field-password" className="text-white/70 text-sm">Password</Label>
            <Input
              id="field-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-400 focus:ring-purple-400/30"
              data-testid="input-field-password"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-400/30 accent-purple-500"
            />
            <span className="text-white/60 text-sm select-none">Keep me logged in for 30 days</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg p-3" data-testid="text-login-error">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-purple-600 text-white font-medium"
            disabled={isSubmitting}
            data-testid="button-field-login-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <p className="text-center text-white/30 text-xs">
          Secure access for licensed operators and administrators.
        </p>
      </div>
    </div>
  );
}
