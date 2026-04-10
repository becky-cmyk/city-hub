import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Users, CheckCircle, XCircle, Clock, BarChart3 } from "lucide-react";

interface AdminJob {
  id: string;
  title: string;
  employer: string;
  employment_type: string | null;
  remote_type: string | null;
  location_text: string | null;
  job_status: string;
  created_at: string;
  posted_by_user_id: string;
  application_count: string;
}

interface JobStats {
  employer_posts: string;
  active_posts: string;
  total_applications: string;
  total_saves: string;
  active_alerts: string;
}

export default function JobsModerationPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: stats, isLoading: statsLoading } = useQuery<JobStats>({
    queryKey: ["/api/admin/jobs/stats", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const r = await fetch(`/api/admin/jobs/stats?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: adminJobs, isLoading } = useQuery<AdminJob[]>({
    queryKey: ["/api/admin/jobs", statusFilter, cityId],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter });
      if (cityId) params.set("cityId", cityId);
      const r = await fetch(`/api/admin/jobs?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ jobId, jobStatus }: { jobId: string; jobStatus: string }) => {
      return apiRequest("PATCH", `/api/admin/jobs/${jobId}`, { jobStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs/stats"] });
      toast({ title: "Job status updated" });
    },
    onError: (e: Error) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
    pending_review: "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Briefcase className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold" data-testid="stat-employer-posts">{stats.employer_posts}</p>
              <p className="text-xs text-muted-foreground">Employer Posts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold" data-testid="stat-active-posts">{stats.active_posts}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold" data-testid="stat-total-applications">{stats.total_applications}</p>
              <p className="text-xs text-muted-foreground">Applications</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <p className="text-2xl font-bold" data-testid="stat-total-saves">{stats.total_saves}</p>
              <p className="text-xs text-muted-foreground">Saves</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-orange-500 mb-1" />
              <p className="text-2xl font-bold" data-testid="stat-active-alerts">{stats.active_alerts}</p>
              <p className="text-xs text-muted-foreground">Active Alerts</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg" data-testid="text-admin-jobs-title">Employer-Posted Jobs</h3>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-admin-job-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : adminJobs && adminJobs.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-3 font-medium">Job Title</th>
                <th className="p-3 font-medium">Employer</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Apps</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminJobs.map((job) => (
                <tr key={job.id} className="border-b" data-testid={`row-admin-job-${job.id}`}>
                  <td className="p-3">
                    <p className="font-medium" data-testid={`text-admin-job-title-${job.id}`}>{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </td>
                  <td className="p-3 text-muted-foreground">{job.employer}</td>
                  <td className="p-3">{job.employment_type || "-"}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className="text-xs">{job.application_count}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge className={`text-[10px] border-0 ${statusColors[job.job_status] || ""}`}>
                      {job.job_status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Select value={job.job_status}
                      onValueChange={(s) => statusMutation.mutate({ jobId: job.id, jobStatus: s })}>
                      <SelectTrigger className="h-8 w-[130px] text-xs" data-testid={`select-admin-status-${job.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="pending_review">Pending Review</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground" data-testid="text-no-admin-jobs">No employer-posted jobs found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
