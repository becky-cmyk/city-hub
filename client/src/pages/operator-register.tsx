import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, MapPin, AlertCircle, CheckCircle } from "lucide-react";

export default function OperatorRegister() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";

  const [inviteData, setInviteData] = useState<any>(null);
  const [inviteError, setInviteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteError("No invite token provided");
      setLoading(false);
      return;
    }
    fetch(`/api/operator/invite/${token}`)
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.message); });
        return res.json();
      })
      .then(data => { setInviteData(data); setLoading(false); })
      .catch(err => { setInviteError(err.message); setLoading(false); });
  }, [token]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/operator/register", { token, password });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/operator/me"] });
      toast({ title: `Welcome, ${data.displayName}! Your account is ready.` });
      navigate("/operator/dashboard");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2" data-testid="text-invite-error">Invalid Invite</h2>
            <p className="text-muted-foreground mb-4">{inviteError}</p>
            <Button variant="outline" onClick={() => navigate("/operator/login")} data-testid="button-go-to-login">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <MapPin className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-register-title">Set Up Your Account</CardTitle>
          <CardDescription>Complete your operator account setup</CardDescription>
        </CardHeader>
        <CardContent>
          {inviteData && (
            <div className="mb-6 p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="font-medium text-sm" data-testid="text-invite-name">{inviteData.displayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium text-sm" data-testid="text-invite-email">{inviteData.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge variant="outline" data-testid="badge-invite-type">{inviteData.operatorType}</Badge>
              </div>
            </div>
          )}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                data-testid="input-register-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="input-register-confirm"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting} data-testid="button-register-submit">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Activate Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
