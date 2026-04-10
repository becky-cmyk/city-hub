import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Eye, MapPin, Languages, Clock, Mail } from "lucide-react";

function IntelligenceReportPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data, isLoading, error } = useQuery<{
    request: {
      entityType: string;
      entityId: string;
      requesterName: string;
      status: string;
      createdAt: string;
    };
    teaserStats: {
      profileViews30d: number;
      topZipOrigin: string | null;
      languageSplit: { en: number; es: number } | null;
    };
    status: string;
  }>({
    queryKey: ["/api/intelligence/report", token],
    queryFn: async () => {
      const res = await fetch(`/api/intelligence/report/${token}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/20 dark:to-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/20 dark:to-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center" data-testid="report-not-found">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Report Not Found</h2>
          <p className="text-sm text-muted-foreground">This report link may have expired or is invalid.</p>
        </Card>
      </div>
    );
  }

  const { request, teaserStats } = data;
  const statusLabels: Record<string, string> = {
    NEW: "Preparing",
    IN_REVIEW: "Under Review",
    SENT: "Report Ready",
    DECLINED: "Unavailable",
    NEEDS_INFO: "Needs Information",
  };
  const statusColors: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    IN_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    SENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    DECLINED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    NEEDS_INFO: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };

  const hasTeaserData = teaserStats.profileViews30d > 0 || teaserStats.topZipOrigin || teaserStats.languageSplit;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-xl bg-purple-600 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-report-heading">Your Intelligence Report</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-report-name">
            for {request.requesterName}
          </p>
        </div>

        <Card className="p-6 mb-6" data-testid="card-report-status">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Report Status</h2>
            <Badge className={`${statusColors[request.status] || statusColors.NEW} border-0`} data-testid="badge-report-status">
              {statusLabels[request.status] || request.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Requested {new Date(request.createdAt).toLocaleDateString()}</span>
          </div>
          {request.status === "NEW" || request.status === "IN_REVIEW" ? (
            <div className="mt-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Your report is being prepared</p>
                  <p className="text-xs text-muted-foreground mt-1">We'll email you when your full Intelligence Report is ready. This typically takes 1-2 business days.</p>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        {hasTeaserData && (
          <div className="space-y-4" data-testid="section-teaser-stats">
            <h2 className="font-semibold text-lg">Quick Insights (Last 30 Days)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4 text-center" data-testid="stat-profile-views">
                <Eye className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{teaserStats.profileViews30d}</p>
                <p className="text-xs text-muted-foreground">Profile Views</p>
              </Card>

              {teaserStats.topZipOrigin && (
                <Card className="p-4 text-center" data-testid="stat-top-zip">
                  <MapPin className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{teaserStats.topZipOrigin}</p>
                  <p className="text-xs text-muted-foreground">Top ZIP Origin</p>
                </Card>
              )}

              {teaserStats.languageSplit && (
                <Card className="p-4 text-center" data-testid="stat-language-split">
                  <Languages className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                  <div className="flex justify-center gap-3 mt-1">
                    <span className="text-sm font-semibold">EN {teaserStats.languageSplit.en}%</span>
                    <span className="text-sm font-semibold text-purple-600">ES {teaserStats.languageSplit.es}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Language Split</p>
                </Card>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>Powered by CityMetroHub Intelligence</p>
        </div>
      </div>
    </div>
  );
}

export default IntelligenceReportPage;
