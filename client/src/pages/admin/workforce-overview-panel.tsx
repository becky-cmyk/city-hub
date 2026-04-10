import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Briefcase, Award, Building2, FileText, AlertTriangle, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface WorkforceStats {
  applicantProfiles: number;
  activeHiringBusinesses: number;
  totalSkills: number;
  pendingCredentials: number;
  jobListings: number;
}

interface WorkforceOverview {
  stats: WorkforceStats;
  topSkills: { category_name: string; usage_count: number }[];
  credentialPipeline: { verification_status: string; count: number }[];
  activeHiringBusinesses: { business_name: string; business_slug: string; hiring_status: string; typical_roles: string[] }[];
  jobListingsByStatus: { status: string; count: number }[];
}

export default function WorkforceOverviewPanel({ cityId }: { cityId?: string }) {
  const { data, isLoading, isError, error } = useQuery<WorkforceOverview>({
    queryKey: ["/api/admin/workforce/overview", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/workforce/overview?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load workforce data");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6" data-testid="workforce-overview-loading">
        <h2 className="text-2xl font-bold mb-6">Jobs & Workforce Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse h-12 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6" data-testid="workforce-overview-error">
        <h2 className="text-2xl font-bold mb-6">Jobs & Workforce Overview</h2>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
            <p className="font-medium">Failed to load workforce data</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "The data could not be retrieved. Please try again."}
            </p>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/workforce/overview"] })}
              data-testid="button-retry-workforce"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: "Applicant Profiles", value: data.stats.applicantProfiles, icon: Users, color: "text-blue-600" },
    { label: "Actively Hiring", value: data.stats.activeHiringBusinesses, icon: Building2, color: "text-green-600" },
    { label: "Skills in Taxonomy", value: data.stats.totalSkills, icon: Award, color: "text-purple-600" },
    { label: "Pending Credentials", value: data.stats.pendingCredentials, icon: FileText, color: "text-amber-600" },
    { label: "Job Listings", value: data.stats.jobListings, icon: Briefcase, color: "text-indigo-600" },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="workforce-overview-panel">
      <h2 className="text-2xl font-bold">Jobs & Workforce Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="top-skills-card">
          <CardHeader><CardTitle className="text-lg">Top Skills by Category</CardTitle></CardHeader>
          <CardContent>
            {data.topSkills.length === 0 ? (
              <p className="text-muted-foreground text-sm">No skill usage data yet.</p>
            ) : (
              <div className="space-y-2">
                {data.topSkills.map((skill) => (
                  <div key={skill.category_name} className="flex justify-between items-center" data-testid={`skill-row-${skill.category_name}`}>
                    <span className="text-sm">{skill.category_name}</span>
                    <Badge variant="secondary">{skill.usage_count} applicants</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="credential-pipeline-card">
          <CardHeader><CardTitle className="text-lg">Credential Pipeline</CardTitle></CardHeader>
          <CardContent>
            {data.credentialPipeline.length === 0 ? (
              <p className="text-muted-foreground text-sm">No credential submissions yet.</p>
            ) : (
              <div className="space-y-2">
                {data.credentialPipeline.map((entry) => (
                  <div key={entry.verification_status} className="flex justify-between items-center" data-testid={`credential-row-${entry.verification_status}`}>
                    <span className="text-sm capitalize">{entry.verification_status.toLowerCase().replace('_', ' ')}</span>
                    <Badge variant={entry.verification_status === "VERIFIED" ? "default" : "secondary"}>{entry.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="hiring-businesses-card">
          <CardHeader><CardTitle className="text-lg">Actively Hiring Businesses</CardTitle></CardHeader>
          <CardContent>
            {data.activeHiringBusinesses.length === 0 ? (
              <p className="text-muted-foreground text-sm">No businesses actively hiring yet.</p>
            ) : (
              <div className="space-y-3">
                {data.activeHiringBusinesses.map((biz) => (
                  <div key={biz.business_slug} className="border-b last:border-0 pb-2 last:pb-0" data-testid={`hiring-biz-${biz.business_slug}`}>
                    <p className="font-medium text-sm">{biz.business_name}</p>
                    {biz.typical_roles && biz.typical_roles.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {biz.typical_roles.slice(0, 3).map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="job-listings-status-card">
          <CardHeader><CardTitle className="text-lg">Job Listings by Status</CardTitle></CardHeader>
          <CardContent>
            {data.jobListingsByStatus.length === 0 ? (
              <p className="text-muted-foreground text-sm">No job listings yet.</p>
            ) : (
              <div className="space-y-2">
                {data.jobListingsByStatus.map((entry) => (
                  <div key={entry.status} className="flex justify-between items-center" data-testid={`listing-status-${entry.status}`}>
                    <span className="text-sm capitalize">{entry.status.toLowerCase()}</span>
                    <Badge variant="secondary">{entry.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
