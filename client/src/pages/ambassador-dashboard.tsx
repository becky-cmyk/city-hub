import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, MousePointerClick, DollarSign, Copy, ArrowRight, Loader2, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { useParams } from "wouter";
import { DarkPageShell } from "@/components/dark-page-shell";

interface DashboardData {
  ambassador: {
    id: string;
    name: string;
    email: string;
    referralCode: string;
    status: string;
    featureFlags: Record<string, boolean>;
    totalReferrals: number;
    totalEarningsCents: number;
    createdAt: string;
  };
  stats: {
    totalClicks: number;
    totalConversions: number;
    totalCommissionCents: number;
  };
  recentReferrals: {
    id: string;
    status: string;
    visitorEmail: string | null;
    conversionAmountCents: number | null;
    commissionCents: number | null;
    createdAt: string;
    convertedAt: string | null;
  }[];
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusColor(status: string) {
  switch (status) {
    case "CLICKED": return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    case "SIGNED_UP": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "CONVERTED": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "PAID": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

export default function AmbassadorDashboard() {
  const { toast } = useToast();
  const params = useParams<{ citySlug: string }>();
  const [referralCode, setReferralCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ambassador_code");
    if (saved) {
      setReferralCode(saved);
      setEnteredCode(saved);
    }
  }, []);

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/ambassador/dashboard", referralCode],
    queryFn: async () => {
      const res = await fetch(`/api/ambassador/dashboard/${referralCode}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    enabled: !!referralCode,
  });

  const handleLogin = () => {
    if (!enteredCode.trim()) return;
    localStorage.setItem("ambassador_code", enteredCode.trim());
    setReferralCode(enteredCode.trim());
  };

  const copyLink = () => {
    const link = `${window.location.origin}/${params.citySlug || "charlotte"}?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Referral link copied" });
  };

  if (!referralCode) {
    return (
      <DarkPageShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-xl text-center" data-testid="text-ambassador-login-title">Ambassador Portal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Enter your referral code to access your dashboard.
              </p>
              <Input
                placeholder="Your referral code"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                data-testid="input-ambassador-code"
              />
              <Button className="w-full" onClick={handleLogin} disabled={!enteredCode.trim()} data-testid="button-ambassador-login">
                Access Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </DarkPageShell>
    );
  }

  if (isLoading) {
    return (
      <DarkPageShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DarkPageShell>
    );
  }

  if (isError || !data) {
    return (
      <DarkPageShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardContent className="py-8 text-center space-y-4">
              <p className="text-muted-foreground" data-testid="text-ambassador-error">Invalid referral code or ambassador not found.</p>
              <Button variant="outline" onClick={() => { setReferralCode(""); localStorage.removeItem("ambassador_code"); }} data-testid="button-ambassador-retry">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </DarkPageShell>
    );
  }

  const { ambassador, stats, recentReferrals } = data;
  const referralLink = `${window.location.origin}/${params.citySlug || "charlotte"}?ref=${ambassador.referralCode}`;

  return (
    <DarkPageShell maxWidth="wide">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-ambassador-name">{ambassador.name}</h1>
            <p className="text-sm text-muted-foreground">{ambassador.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={ambassador.status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-700"} data-testid="badge-ambassador-status">
              {ambassador.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => { setReferralCode(""); localStorage.removeItem("ambassador_code"); }} data-testid="button-ambassador-logout">
              Sign Out
            </Button>
          </div>
        </div>

        <Card data-testid="card-referral-link">
          <CardContent className="py-4">
            <p className="text-sm font-medium mb-2">Your Referral Link</p>
            <div className="flex items-center gap-2">
              <Input value={referralLink} readOnly className="text-sm font-mono" data-testid="input-referral-link" />
              <Button variant="outline" size="sm" onClick={copyLink} data-testid="button-copy-referral">
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card data-testid="card-stat-clicks">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MousePointerClick className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-clicks">{stats.totalClicks}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-conversions">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Conversions</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-conversions">{stats.totalConversions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-earnings">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-earnings">{formatCents(stats.totalCommissionCents)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-recent-referrals">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentReferrals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-referrals">
                No referral activity yet. Share your link to get started.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="hidden md:grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground px-3 py-1 uppercase tracking-wider">
                  <span>Date</span>
                  <span>Status</span>
                  <span>Visitor</span>
                  <span>Amount</span>
                  <span>Commission</span>
                </div>
                {recentReferrals.map((ref) => (
                  <div key={ref.id} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-center text-sm border rounded-lg px-3 py-2" data-testid={`row-referral-${ref.id}`}>
                    <span className="text-muted-foreground text-xs">
                      {new Date(ref.createdAt).toLocaleDateString()}
                    </span>
                    <div>
                      <Badge className={statusColor(ref.status)} data-testid={`badge-referral-status-${ref.id}`}>
                        {ref.status === "CLICKED" && <Clock className="h-3 w-3 mr-1" />}
                        {ref.status === "CONVERTED" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {ref.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground truncate hidden md:block">
                      {ref.visitorEmail || "Anonymous"}
                    </span>
                    <span className="text-xs hidden md:block">
                      {ref.conversionAmountCents ? formatCents(ref.conversionAmountCents) : "-"}
                    </span>
                    <span className="text-xs font-medium hidden md:block">
                      {ref.commissionCents ? formatCents(ref.commissionCents) : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DarkPageShell>
  );
}
