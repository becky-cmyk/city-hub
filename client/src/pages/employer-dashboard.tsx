import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useCity } from "@/hooks/use-city";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Briefcase, Plus, Users, Eye, Pencil, Trash2, ChevronDown, ChevronUp, Loader2, FileText, Mail, Phone, Building2, Calendar, Shield, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface EmployerJob {
  id: string;
  title: string;
  employer: string;
  employment_type: string | null;
  remote_type: string | null;
  location_text: string | null;
  pay_min: string | null;
  pay_max: string | null;
  pay_unit: string | null;
  job_status: string;
  created_at: string;
  application_count: string;
  description: string | null;
  department: string | null;
  closes_at: string | null;
}

interface JobApplication {
  id: string;
  job_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  resume_url: string | null;
  cover_message: string | null;
  status: string;
  created_at: string;
}

function PostJobForm({ cityId, onClose }: { cityId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [payUnit, setPayUnit] = useState("year");
  const [locationText, setLocationText] = useState("");
  const [remoteType, setRemoteType] = useState("");
  const [closesAt, setClosesAt] = useState("");

  const postMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/jobs/employer", {
        title, description, department, employmentType: employmentType || null,
        payMin: payMin || null, payMax: payMax || null, payUnit: payUnit || null,
        locationText: locationText || null, remoteType: remoteType || null,
        closesAt: closesAt || null, cityId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/employer/my-jobs"] });
      toast({ title: "Job posted", description: "Your job listing is now live." });
      onClose();
    },
    onError: (e: Error) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-white/70 mb-1 block">Job Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Marketing Manager"
          className="bg-white/5 border-white/10 text-white" data-testid="input-job-title" />
      </div>
      <div>
        <label className="text-sm font-medium text-white/70 mb-1 block">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the role, responsibilities, and requirements..."
          className="bg-white/5 border-white/10 text-white min-h-[120px]" data-testid="input-job-description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Department</label>
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Marketing"
            className="bg-white/5 border-white/10 text-white" data-testid="input-job-department" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Employment Type</label>
          <Select value={employmentType} onValueChange={setEmploymentType}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-job-employment-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Full-time">Full-time</SelectItem>
              <SelectItem value="Part-time">Part-time</SelectItem>
              <SelectItem value="Contract">Contract</SelectItem>
              <SelectItem value="Internship">Internship</SelectItem>
              <SelectItem value="Temporary">Temporary</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Pay Min</label>
          <Input type="number" value={payMin} onChange={(e) => setPayMin(e.target.value)} placeholder="40000"
            className="bg-white/5 border-white/10 text-white" data-testid="input-job-pay-min" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Pay Max</label>
          <Input type="number" value={payMax} onChange={(e) => setPayMax(e.target.value)} placeholder="60000"
            className="bg-white/5 border-white/10 text-white" data-testid="input-job-pay-max" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Pay Unit</label>
          <Select value={payUnit} onValueChange={setPayUnit}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-job-pay-unit">
              <SelectValue placeholder="Per" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Per Year</SelectItem>
              <SelectItem value="hour">Per Hour</SelectItem>
              <SelectItem value="month">Per Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Location</label>
          <Input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="Charlotte, NC"
            className="bg-white/5 border-white/10 text-white" data-testid="input-job-location" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Work Type</label>
          <Select value={remoteType} onValueChange={setRemoteType}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-job-remote-type">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ONSITE">On-site</SelectItem>
              <SelectItem value="REMOTE">Remote</SelectItem>
              <SelectItem value="HYBRID">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-white/70 mb-1 block">Application Deadline (optional)</label>
        <Input type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)}
          className="bg-white/5 border-white/10 text-white" data-testid="input-job-closes" />
      </div>
      <Button onClick={() => postMutation.mutate()} disabled={!title || postMutation.isPending}
        className="w-full" data-testid="button-submit-job">
        {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
        Post Job
      </Button>
    </div>
  );
}

function ApplicationsList({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const { data: applications, isLoading } = useQuery<JobApplication[]>({
    queryKey: ["/api/jobs/employer", jobId, "applications"],
    queryFn: async () => {
      const r = await fetch(`/api/jobs/employer/${jobId}/applications`);
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: string }) => {
      return apiRequest("PATCH", `/api/jobs/employer/applications/${appId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/employer", jobId, "applications"] });
    },
    onError: (e: Error) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  if (isLoading) return <Skeleton className="h-20 bg-white/10" />;
  if (!applications || applications.length === 0) {
    return <p className="text-white/40 text-sm py-4 text-center">No applications yet</p>;
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-300",
    reviewed: "bg-blue-500/20 text-blue-300",
    shortlisted: "bg-green-500/20 text-green-300",
    rejected: "bg-red-500/20 text-red-300",
  };

  return (
    <div className="space-y-2">
      {applications.map((app) => (
        <div key={app.id} className="rounded-lg bg-white/5 border border-white/10 p-3" data-testid={`card-application-${app.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-medium text-sm text-white" data-testid={`text-applicant-name-${app.id}`}>{app.applicant_name}</p>
              <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{app.applicant_email}</span>
                {app.applicant_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{app.applicant_phone}</span>}
              </div>
              {app.cover_message && (
                <p className="text-xs text-white/60 mt-1 line-clamp-2">{app.cover_message}</p>
              )}
              {app.resume_url && (
                <a href={app.resume_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-purple-300 mt-1" data-testid={`link-resume-${app.id}`}>
                  <FileText className="h-3 w-3" /> View Resume
                </a>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge className={`text-[10px] border-0 ${statusColors[app.status] || "bg-white/10 text-white/60"}`}>
                {app.status}
              </Badge>
              <Select value={app.status} onValueChange={(s) => statusMutation.mutate({ appId: app.id, status: s })}>
                <SelectTrigger className="h-8 w-[110px] text-xs bg-white/5 border-white/10 text-white" data-testid={`select-app-status-${app.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="shortlisted">Shortlisted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[10px] text-white/30 mt-1">
            Applied {new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      ))}
    </div>
  );
}

function JobCard({ job }: { job: EmployerJob }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/jobs/employer/${job.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/employer/my-jobs"] });
      toast({ title: "Job deleted" });
    },
    onError: (e: Error) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = job.job_status === "active" ? "closed" : "active";
      return apiRequest("PATCH", `/api/jobs/employer/${job.id}`, { jobStatus: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/employer/my-jobs"] });
    },
  });

  const statusColors: Record<string, string> = {
    active: "bg-green-500/20 text-green-300",
    closed: "bg-red-500/20 text-red-300",
    pending_review: "bg-yellow-500/20 text-yellow-300",
    rejected: "bg-red-500/20 text-red-300",
  };

  return (
    <div className="rounded-xl bg-white/10 border border-white/10" data-testid={`card-employer-job-${job.id}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base text-white" data-testid={`text-employer-job-title-${job.id}`}>{job.title}</h3>
              <Badge className={`text-[10px] border-0 ${statusColors[job.job_status] || "bg-white/10 text-white/60"}`}>
                {job.job_status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/50 flex-wrap">
              {job.employment_type && <span>{job.employment_type}</span>}
              {job.location_text && <span>{job.location_text}</span>}
              {job.remote_type && <span>{job.remote_type}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => toggleStatusMutation.mutate()}
              className="text-white/60 text-xs" data-testid={`button-toggle-status-${job.id}`}>
              {job.job_status === "active" ? "Close" : "Reopen"}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate()}
              className="text-red-400 h-8 w-8" data-testid={`button-delete-job-${job.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
          <span>Posted {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <button className="flex items-center gap-1 text-purple-300" onClick={() => setExpanded(!expanded)}
            data-testid={`button-view-apps-${job.id}`}>
            <Users className="h-3.5 w-3.5" />
            {job.application_count} application{job.application_count !== "1" ? "s" : ""}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-white/10 p-4">
          <ApplicationsList jobId={job.id} />
        </div>
      )}
    </div>
  );
}

interface MyBusiness {
  id: string;
  name: string;
  slug: string;
}

interface HiringProfileData {
  id: string;
  businessId: string;
  hiringStatus: string;
  companyDescription: string | null;
  typicalRoles: string[];
  industries: string[];
  benefitsOffered: string[];
  applicationUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  workplaceSummary: string | null;
  cultureDescription: string | null;
  hiringContactMethod: string | null;
  verificationBadges: string[];
}

function HiringProfileTab() {
  const { toast } = useToast();

  const { data: myBusiness, isLoading: bizLoading } = useQuery<MyBusiness | null>({
    queryKey: ["/api/workforce/my-business"],
    queryFn: async () => {
      const r = await fetch("/api/workforce/my-business");
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: hiringProfile, isLoading: profileLoading } = useQuery<HiringProfileData | null>({
    queryKey: ["/api/workforce/employer-hiring-profile", myBusiness?.id],
    queryFn: async () => {
      if (!myBusiness) return null;
      const r = await fetch(`/api/workforce/employer-hiring-profile?businessId=${myBusiness.id}`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!myBusiness,
  });

  const isLoading = bizLoading || profileLoading;

  const [companyDescription, setCompanyDescription] = useState("");
  const [typicalRoles, setTypicalRoles] = useState("");
  const [industries, setIndustries] = useState("");
  const [benefits, setBenefits] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [hiringStatus, setHiringStatus] = useState("ACTIVELY_HIRING");
  const [workplaceSummary, setWorkplaceSummary] = useState("");
  const [cultureDescription, setCultureDescription] = useState("");
  const [hiringContactMethod, setHiringContactMethod] = useState("");

  useEffect(() => {
    if (hiringProfile) {
      setCompanyDescription(hiringProfile.companyDescription || "");
      setTypicalRoles((hiringProfile.typicalRoles || []).join(", "));
      setIndustries((hiringProfile.industries || []).join(", "));
      setBenefits((hiringProfile.benefitsOffered || []).join(", "));
      setApplicationUrl(hiringProfile.applicationUrl || "");
      setContactEmail(hiringProfile.contactEmail || "");
      setContactPhone(hiringProfile.contactPhone || "");
      setHiringStatus(hiringProfile.hiringStatus || "ACTIVELY_HIRING");
      setWorkplaceSummary(hiringProfile.workplaceSummary || "");
      setCultureDescription(hiringProfile.cultureDescription || "");
      setHiringContactMethod(hiringProfile.hiringContactMethod || "");
    }
  }, [hiringProfile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!myBusiness) throw new Error("No business found");
      const body = {
        businessId: myBusiness.id,
        companyDescription,
        typicalRoles: typicalRoles.split(",").map(s => s.trim()).filter(Boolean),
        industries: industries.split(",").map(s => s.trim()).filter(Boolean),
        benefitsOffered: benefits.split(",").map(s => s.trim()).filter(Boolean),
        applicationUrl: applicationUrl || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        hiringStatus,
        workplaceSummary: workplaceSummary || null,
        cultureDescription: cultureDescription || null,
        hiringContactMethod: hiringContactMethod || null,
      };
      if (hiringProfile) {
        return apiRequest("PATCH", "/api/workforce/employer-hiring-profile", body);
      } else {
        return apiRequest("POST", "/api/workforce/employer-hiring-profile", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/employer-hiring-profile", myBusiness?.id] });
      toast({ title: hiringProfile ? "Hiring profile updated" : "Hiring profile created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40 bg-white/10 rounded-xl" />;

  if (!myBusiness) {
    return (
      <Card className="bg-white/10 border-white/10">
        <CardContent className="p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-white/20 mb-3" />
          <h3 className="text-white font-semibold mb-1" data-testid="text-no-claimed-business">No Business Claimed</h3>
          <p className="text-white/50 text-sm">Claim or activate a business listing first to manage your hiring profile.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <Sparkles className="h-4 w-4 text-purple-400" />
        <span className="text-xs text-purple-300">Charlotte AI can help optimize your hiring profile</span>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Hiring Status</label>
            <Select value={hiringStatus} onValueChange={setHiringStatus}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-hiring-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVELY_HIRING">Actively Hiring</SelectItem>
                <SelectItem value="OPEN_TO_CANDIDATES">Open to Candidates</SelectItem>
                <SelectItem value="NOT_HIRING">Not Hiring</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Preferred Contact Method</label>
            <Select value={hiringContactMethod} onValueChange={setHiringContactMethod}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-contact-method">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="PHONE">Phone</SelectItem>
                <SelectItem value="WEBSITE">Website</SelectItem>
                <SelectItem value="IN_PERSON">In Person</SelectItem>
                <SelectItem value="PLATFORM">Through Platform</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Company Description</label>
          <Textarea value={companyDescription} onChange={(e) => setCompanyDescription(e.target.value)}
            placeholder="Tell candidates about your company..." className="bg-white/5 border-white/10 text-white min-h-[80px]"
            data-testid="input-company-description" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Workplace Summary</label>
          <Textarea value={workplaceSummary} onChange={(e) => setWorkplaceSummary(e.target.value)}
            placeholder="Describe the work environment..." className="bg-white/5 border-white/10 text-white min-h-[60px]"
            data-testid="input-workplace-summary" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Culture & Values</label>
          <Textarea value={cultureDescription} onChange={(e) => setCultureDescription(e.target.value)}
            placeholder="What makes your workplace unique?" className="bg-white/5 border-white/10 text-white min-h-[60px]"
            data-testid="input-culture-description" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Typical Roles (comma-separated)</label>
          <Input value={typicalRoles} onChange={(e) => setTypicalRoles(e.target.value)} placeholder="Server, Host, Line Cook"
            className="bg-white/5 border-white/10 text-white" data-testid="input-typical-roles" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Industries (comma-separated)</label>
          <Input value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="Restaurant, Hospitality"
            className="bg-white/5 border-white/10 text-white" data-testid="input-industries" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Benefits (comma-separated)</label>
          <Input value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="Health Insurance, PTO, 401k"
            className="bg-white/5 border-white/10 text-white" data-testid="input-benefits" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Application URL</label>
            <Input value={applicationUrl} onChange={(e) => setApplicationUrl(e.target.value)} placeholder="https://..."
              className="bg-white/5 border-white/10 text-white" data-testid="input-application-url" />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Contact Email</label>
            <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hiring@..."
              className="bg-white/5 border-white/10 text-white" data-testid="input-contact-email" />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Contact Phone</label>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(704) ..."
              className="bg-white/5 border-white/10 text-white" data-testid="input-contact-phone" />
          </div>
        </div>

        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-xs text-white/40 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Verification badges — coming soon (CLT Verified Employer, Fair Wage, etc.)
          </p>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full" data-testid="button-save-hiring-profile">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {hiringProfile ? "Update Hiring Profile" : "Create Hiring Profile"}
        </Button>
      </div>
    </div>
  );
}

type EmployerTabKey = "jobs" | "hiring-profile";

export default function EmployerDashboard({ citySlug }: { citySlug: string }) {
  usePageMeta({
    title: "Employer Dashboard — CLT Metro Hub",
    description: "Manage your job listings, hiring profile, and review applications.",
  });

  const { isLoggedIn } = useAuth();
  const { data: city } = useCity(citySlug);
  const [showPostForm, setShowPostForm] = useState(false);
  const [activeTab, setActiveTab] = useState<EmployerTabKey>("jobs");

  const { data: myJobs, isLoading } = useQuery<EmployerJob[]>({
    queryKey: ["/api/jobs/employer/my-jobs"],
    queryFn: async () => {
      const r = await fetch("/api/jobs/employer/my-jobs");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: isLoggedIn,
  });

  if (!isLoggedIn) {
    return (
      <DarkPageShell fillHeight>
        <div className="text-center py-16">
          <Briefcase className="mx-auto h-12 w-12 text-white/20 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Employer Dashboard</h2>
          <p className="text-white/50 text-sm mb-4">Sign in to post jobs and manage applications</p>
        </div>
      </DarkPageShell>
    );
  }

  return (
    <DarkPageShell fillHeight>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-white" data-testid="text-employer-dashboard-title">
              <Briefcase className="h-6 w-6 text-purple-400" />
              Employer Dashboard
            </h1>
            <p className="text-white/50 text-sm mt-1">Post jobs, manage your hiring profile, and review applications</p>
          </div>
          {activeTab === "jobs" && (
            <Button onClick={() => setShowPostForm(true)} data-testid="button-post-new-job">
              <Plus className="h-4 w-4 mr-2" /> Post a Job
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("jobs")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "jobs" ? "bg-purple-500/20 text-purple-300" : "text-white/50 hover:text-white/70 hover:bg-white/5"
            }`}
            data-testid="tab-jobs"
          >
            <Briefcase className="h-4 w-4" /> Job Listings
          </button>
          <button
            onClick={() => setActiveTab("hiring-profile")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "hiring-profile" ? "bg-purple-500/20 text-purple-300" : "text-white/50 hover:text-white/70 hover:bg-white/5"
            }`}
            data-testid="tab-hiring-profile"
          >
            <Building2 className="h-4 w-4" /> Hiring Profile
          </button>
        </div>

        {activeTab === "hiring-profile" ? (
          <HiringProfileTab />
        ) : (
          <>
            <Dialog open={showPostForm} onOpenChange={setShowPostForm}>
              <DialogContent className="max-w-lg bg-[#1a1a2e] border-white/10 text-white max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white">Post a New Job</DialogTitle>
                </DialogHeader>
                {city && <PostJobForm cityId={city.id} onClose={() => setShowPostForm(false)} />}
              </DialogContent>
            </Dialog>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 bg-white/10 rounded-xl" />)}
              </div>
            ) : myJobs && myJobs.length > 0 ? (
              <div className="space-y-3">
                {myJobs.map((job) => <JobCard key={job.id} job={job} />)}
              </div>
            ) : (
              <Card className="bg-white/10 border-white/10">
                <CardContent className="p-12 text-center">
                  <Briefcase className="mx-auto h-12 w-12 text-white/20 mb-4" />
                  <h3 className="font-semibold text-lg text-white mb-1" data-testid="text-no-employer-jobs">No jobs posted yet</h3>
                  <p className="text-white/50 text-sm mb-4">Click "Post a Job" to create your first listing</p>
                  <Button onClick={() => setShowPostForm(true)} data-testid="button-post-first-job">
                    <Plus className="h-4 w-4 mr-2" /> Post Your First Job
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DarkPageShell>
  );
}
