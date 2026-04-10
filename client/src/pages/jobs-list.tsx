import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, MapPin, DollarSign, Clock, ExternalLink, Search, X, Building2, Bookmark, BookmarkCheck, Bell, Send, Loader2, TrendingUp, Sparkles, ArrowRight, Users, Heart } from "lucide-react";
import { useState, useMemo } from "react";
import type { Job } from "@shared/schema";
import { usePageMeta } from "@/hooks/use-page-meta";
import { InlineAd } from "@/components/ad-banner";
import { DarkPageShell } from "@/components/dark-page-shell";
import { useAuth } from "@/hooks/use-auth";
import { useCity } from "@/hooks/use-city";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";

function useFormatPay() {
  const { t } = useI18n();
  return (job: Job) => {
    if (!job.payMin && !job.payMax) return null;
    const unit = job.payUnit || "year";
    const fmt = (v: string | null) => {
      if (!v) return null;
      const n = Number(v);
      if (isNaN(n)) return null;
      return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`;
    };
    const min = fmt(job.payMin);
    const max = fmt(job.payMax);
    if (min && max) return `${min} – ${max} / ${unit}`;
    if (min) return t("jobs.from", { amount: `${min} / ${unit}` });
    if (max) return t("jobs.upTo", { amount: `${max} / ${unit}` });
    return null;
  };
}

function useFormatDate() {
  const { locale } = useI18n();
  const dateLocale = locale === "es" ? "es-US" : "en-US";
  return (d: string | Date | null | undefined) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" });
  };
}

interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
}

interface CuratedJobsData {
  featured: Job[];
  newThisWeek: Job[];
  employers: { employer: string; job_count: number; business_id?: string; business_slug?: string; listing_tier?: string; logo_url?: string; cover_image_url?: string }[];
  industries: { name: string; count: number }[];
  totalActive: number;
}

function EasyApplyModal({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [name, setName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [coverMessage, setCoverMessage] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState("");

  const { data: savedResumes } = useQuery<{ id: string; file_name: string; file_url: string }[]>({
    queryKey: ["/api/jobs/resume"],
    queryFn: async () => {
      const r = await fetch("/api/jobs/resume");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: isLoggedIn,
  });

  const defaultResume = savedResumes?.[0];

  const applyMutation = useMutation({
    mutationFn: async () => {
      let finalResumeUrl = resumeUrl || defaultResume?.file_url || null;

      if (resumeFile) {
        const formData = new FormData();
        formData.append("file", resumeFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalResumeUrl = uploadData.url || uploadData.path || null;
        }
      }

      return apiRequest("POST", `/api/jobs/${job.id}/apply`, {
        applicantName: name,
        applicantEmail: email,
        applicantPhone: phone || null,
        resumeUrl: finalResumeUrl,
        coverMessage: coverMessage || null,
      });
    },
    onSuccess: () => {
      toast({ title: t("jobs.applicationSubmitted"), description: t("jobs.applicationSentFor", { title: job.title }) });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/saved-ids"] });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#1a1a2e] border-white/10 text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{t("jobs.applyFor", { title: job.title })}</DialogTitle>
        </DialogHeader>
        {job.employer && <p className="text-sm text-white/50">{job.employer}</p>}
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">{t("jobs.fullName")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-white/10 text-white" data-testid="input-apply-name" />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">{t("jobs.email")}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white" data-testid="input-apply-email" />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">{t("jobs.phoneOptional")}</label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="bg-white/5 border-white/10 text-white" data-testid="input-apply-phone" />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">{t("jobs.resumeOptional")}</label>
            {defaultResume && !resumeFile && (
              <p className="text-xs text-purple-300 mb-1">{t("jobs.savedResume", { name: defaultResume.file_name })}</p>
            )}
            <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              className="bg-white/5 border-white/10 text-white text-sm file:text-white/60 file:bg-white/10 file:border-0 file:rounded file:px-2 file:py-1 file:text-xs file:mr-2"
              data-testid="input-apply-resume" />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">{t("jobs.coverMessageOptional")}</label>
            <Textarea value={coverMessage} onChange={(e) => setCoverMessage(e.target.value)}
              placeholder={t("jobs.coverPlaceholder")}
              className="bg-white/5 border-white/10 text-white min-h-[80px]" data-testid="input-apply-cover" />
          </div>
          <Button onClick={() => applyMutation.mutate()} disabled={!name || !email || applyMutation.isPending}
            className="w-full" data-testid="button-submit-application">
            {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {t("jobs.submitApplication")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AlertSetupModal({ cityId, open, onClose, currentFilters }: {
  cityId: string; open: boolean; onClose: () => void;
  currentFilters: { q: string; employmentType: string; remoteType: string };
}) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [frequency, setFrequency] = useState("weekly");

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/jobs/alerts", {
        cityId,
        searchQuery: currentFilters.q || null,
        employmentType: currentFilters.employmentType && currentFilters.employmentType !== "all" ? currentFilters.employmentType : null,
        remoteType: currentFilters.remoteType && currentFilters.remoteType !== "all" ? currentFilters.remoteType : null,
        frequency,
      });
    },
    onSuccess: () => {
      toast({ title: t("jobs.alertCreated"), description: t("jobs.alertCreatedDesc") });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/alerts"] });
      onClose();
    },
    onError: (e: Error) => { toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[#1a1a2e] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{t("jobs.setupAlert")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-sm text-white/60">{t("jobs.alertDescription")}</p>
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1 text-xs text-white/60">
            {currentFilters.q && <p>{t("jobs.searchLabel")}: "{currentFilters.q}"</p>}
            {currentFilters.employmentType && currentFilters.employmentType !== "all" && <p>{t("jobs.typeLabel")}: {currentFilters.employmentType}</p>}
            {currentFilters.remoteType && currentFilters.remoteType !== "all" && <p>{t("jobs.locationLabel")}: {currentFilters.remoteType}</p>}
            {!currentFilters.q && (!currentFilters.employmentType || currentFilters.employmentType === "all") && (!currentFilters.remoteType || currentFilters.remoteType === "all") && (
              <p>{t("jobs.allNewPostings")}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">{t("jobs.frequency")}</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-alert-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("jobs.daily")}</SelectItem>
                <SelectItem value="weekly">{t("jobs.weekly")}</SelectItem>
                <SelectItem value="instant">{t("jobs.instant")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
            className="w-full" data-testid="button-create-alert">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
            {t("jobs.createAlert")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const JOB_GRADIENTS = [
  "from-blue-900 via-indigo-900 to-purple-900",
  "from-emerald-900 via-teal-900 to-cyan-900",
  "from-amber-900 via-orange-900 to-red-900",
  "from-violet-900 via-purple-900 to-fuchsia-900",
  "from-sky-900 via-blue-900 to-indigo-900",
  "from-rose-900 via-pink-900 to-purple-900",
];

function JobCard({ job, citySlug, onApply, isSaved, onToggleSave, isLoggedIn }: {
  job: Job; citySlug: string; onApply: (job: Job) => void;
  isSaved: boolean; onToggleSave: (jobId: string, save: boolean) => void; isLoggedIn: boolean;
}) {
  const formatPay = useFormatPay();
  const formatDate = useFormatDate();
  const pay = formatPay(job);
  const posted = formatDate(job.postedAt);
  const { t } = useI18n();
  const isVolunteer = job.employmentType === "VOLUNTEER";

  return (
    <div className="rounded-xl bg-white/[0.06] border border-white/10 p-5 hover:border-white/20 transition-colors group" data-testid={`card-job-${job.id}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base leading-tight text-white mb-1" data-testid={`text-job-title-${job.id}`}>
            {job.title}
          </h3>
          {job.employer && (
            <div className="flex items-center gap-1.5 text-sm text-white/60">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span data-testid={`text-job-employer-${job.id}`}>{job.employer}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLoggedIn && (
            <button
              onClick={() => onToggleSave(job.id, !isSaved)}
              className="text-white/40 transition-colors"
              data-testid={`button-save-job-${job.id}`}
            >
              {isSaved ? <BookmarkCheck className="h-5 w-5 text-purple-400" /> : <Bookmark className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-sm text-white/50 mb-3">
        {job.locationText && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {job.locationText}
          </span>
        )}
        {isVolunteer && job.scheduleCommitment && (
          <span className="flex items-center gap-1 text-purple-400 font-medium">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {job.scheduleCommitment}
          </span>
        )}
        {!isVolunteer && pay && (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            {pay}
          </span>
        )}
        {posted && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {posted}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {isVolunteer ? (
          <Badge variant="secondary" className="text-xs bg-purple-500/15 text-purple-300 border-0" data-testid={`badge-volunteer-${job.id}`}>
            <Heart className="h-3 w-3 mr-0.5" /> Volunteer
          </Badge>
        ) : (
          job.employmentType && <Badge variant="secondary" className="text-xs bg-blue-500/15 text-blue-300 border-0">{job.employmentType}</Badge>
        )}
        {job.remoteType && <Badge variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-300 border-0">{job.remoteType}</Badge>}
        {job.department && <Badge variant="outline" className="text-xs border-white/10 text-white/50">{job.department}</Badge>}
      </div>

      {job.description && (
        <p className="text-sm text-white/40 line-clamp-2 mb-4">{job.description}</p>
      )}

      {isVolunteer && job.skillsHelpful && (
        <p className="text-xs text-white/40 mb-3">
          <span className="font-medium text-white/60">Skills helpful:</span> {job.skillsHelpful}
        </p>
      )}

      <div className="flex items-center gap-2">
        {isVolunteer ? (
          job.contactUrl ? (
            <a href={job.contactUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700" data-testid={`button-volunteer-apply-${job.id}`}>
                <Heart className="h-3.5 w-3.5 mr-1" /> Apply / Contact
              </Button>
            </a>
          ) : (
            <Button size="sm" onClick={() => onApply(job)} className="bg-purple-600 hover:bg-purple-700" data-testid={`button-volunteer-apply-${job.id}`}>
              <Heart className="h-3.5 w-3.5 mr-1" /> Volunteer
            </Button>
          )
        ) : (
          <>
            <Button size="sm" onClick={() => onApply(job)} data-testid={`button-easy-apply-${job.id}`}>
              <Send className="h-3.5 w-3.5 mr-1" /> {t("jobs.easyApply")}
            </Button>
            {job.applyUrl && (
              <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-white/10 text-white" data-testid={`button-apply-external-${job.id}`}>
                  {t("jobs.apply")} <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmployerSpotlight({ employer, citySlug }: {
  employer: { employer: string; job_count: number; business_slug?: string; logo_url?: string; cover_image_url?: string; listing_tier?: string };
  citySlug: string;
}) {
  const gradientIdx = Math.abs((employer.employer || "").charCodeAt(0) || 0) % JOB_GRADIENTS.length;
  const isPremium = employer.listing_tier === "ENHANCED" || employer.listing_tier === "ENTERPRISE";

  const content = (
    <div className="rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-colors cursor-pointer group" data-testid={`employer-card-${employer.employer}`}>
      <div className={`relative h-24 bg-gradient-to-br ${JOB_GRADIENTS[gradientIdx]}`}>
        {employer.cover_image_url && (
          <img src={employer.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" loading="lazy" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        {isPremium && (
          <Badge className="absolute top-2 right-2 bg-amber-500/90 text-white border-0 text-[10px]">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Premium
          </Badge>
        )}
      </div>
      <div className="p-4 -mt-8 relative">
        {employer.logo_url ? (
          <img src={employer.logo_url} alt={employer.employer} className="w-14 h-14 rounded-xl bg-gray-900 border-2 border-white/10 object-cover mb-2" loading="lazy" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gray-800 border-2 border-white/10 flex items-center justify-center mb-2">
            <Building2 className="h-5 w-5 text-white/30" />
          </div>
        )}
        <h3 className="font-semibold text-sm text-white truncate">{employer.employer}</h3>
        <p className="text-xs text-white/50 mt-0.5">{employer.job_count} open {employer.job_count === 1 ? "position" : "positions"}</p>
      </div>
    </div>
  );

  if (employer.business_slug) {
    return <Link href={`/${citySlug}/presence/${employer.business_slug}`}>{content}</Link>;
  }
  return content;
}

function IndustryPill({ industry, isActive, onClick }: {
  industry: { name: string; count: number }; isActive: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all border ${
        isActive
          ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
          : "bg-white/[0.04] border-white/10 text-white/60 hover:border-white/20 hover:text-white/80"
      }`}
      data-testid={`pill-industry-${industry.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {industry.name}
      <span className={`text-xs ${isActive ? "text-purple-400" : "text-white/30"}`}>{industry.count}</span>
    </button>
  );
}

export default function JobsList({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();

  usePageMeta({
    title: `${t("jobs.title")} — CLT Metro Hub`,
    description: t("jobs.subtitle"),
    canonical: `${window.location.origin}/${citySlug}/jobs`,
  });

  const { isLoggedIn } = useAuth();
  const { data: city } = useCity(citySlug);
  const { toast } = useToast();
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initialZip = urlParams.get("zip") || "";
  const initialQ = urlParams.get("q") || "";
  const hasPrefilter = !!(initialZip || initialQ);
  const [activeSection, setActiveSection] = useState<"discover" | "search">(hasPrefilter ? "search" : "discover");
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [employmentType, setEmploymentType] = useState("");
  const [remoteType, setRemoteType] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [zipFilter, setZipFilter] = useState(initialZip);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [showAlertSetup, setShowAlertSetup] = useState(false);

  const { data: curated, isLoading: curatedLoading } = useQuery<CuratedJobsData>({
    queryKey: ["/api/cities", citySlug, "jobs", "curated"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/jobs/curated`);
      if (!res.ok) throw new Error("Failed to load curated jobs");
      return res.json();
    },
  });

  const queryParams = useMemo(() => {
    const qp = new URLSearchParams();
    if (searchQuery) qp.set("q", searchQuery);
    if (employmentType && employmentType !== "all") qp.set("employmentType", employmentType);
    if (remoteType && remoteType !== "all") qp.set("remoteType", remoteType);
    if (selectedIndustry) qp.set("department", selectedIndustry);
    if (zipFilter) qp.set("zip", zipFilter);
    qp.set("page", String(page));
    qp.set("pageSize", String(pageSize));
    return qp.toString();
  }, [searchQuery, employmentType, remoteType, selectedIndustry, zipFilter, page]);

  const { data: searchData, isLoading: searchLoading } = useQuery<JobsResponse>({
    queryKey: ["/api/cities", citySlug, "jobs", "search", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/jobs?${queryParams}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: activeSection === "search",
  });

  const { data: savedIds } = useQuery<string[]>({
    queryKey: ["/api/jobs/saved-ids"],
    queryFn: async () => {
      const r = await fetch("/api/jobs/saved-ids");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const savedSet = new Set(savedIds || []);

  const saveMutation = useMutation({
    mutationFn: async ({ jobId, save }: { jobId: string; save: boolean }) => {
      if (save) return apiRequest("POST", `/api/jobs/${jobId}/save`);
      return apiRequest("DELETE", `/api/jobs/${jobId}/save`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/saved-ids"] });
    },
    onError: (e: Error) => { toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }); },
  });

  const hasFilters = searchQuery || (employmentType && employmentType !== "all") || (remoteType && remoteType !== "all") || selectedIndustry;
  const totalPages = searchData ? Math.ceil((searchData.total || 0) / pageSize) : 1;

  const switchToSearch = (industry?: string) => {
    if (industry) setSelectedIndustry(industry);
    setActiveSection("search");
    setPage(1);
  };

  return (
    <DarkPageShell fillHeight>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1" data-testid="text-jobs-title">
              {t("jobs.title")}
            </h1>
            <p className="text-white/50 text-sm">
              {curated?.totalActive ? `${curated.totalActive} active positions across the metro` : t("jobs.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLoggedIn && (
              <Button variant="outline" size="sm"
                className="border-white/10 text-white"
                onClick={() => setShowAlertSetup(true)}
                data-testid="button-set-alert">
                <Bell className="h-3.5 w-3.5 mr-1.5" /> {t("jobs.setAlert")}
              </Button>
            )}
            <Link href={`/${citySlug}/employer/jobs`}>
              <Button variant="outline" size="sm" className="border-white/10 text-white" data-testid="button-employer-dashboard">
                <Building2 className="h-3.5 w-3.5 mr-1.5" /> {t("jobs.postJob")}
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-white/10 pb-px">
          <button
            onClick={() => { setActiveSection("discover"); setSelectedIndustry(""); }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeSection === "discover" ? "text-white" : "text-white/50 hover:text-white/70"
            }`}
            data-testid="tab-discover"
          >
            <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />
            Discover
            {activeSection === "discover" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveSection("search")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeSection === "search" ? "text-white" : "text-white/50 hover:text-white/70"
            }`}
            data-testid="tab-search"
          >
            <Search className="h-3.5 w-3.5 inline mr-1.5" />
            Search All
            {activeSection === "search" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />}
          </button>
        </div>

        {activeSection === "discover" ? (
          curatedLoading ? (
            <div className="space-y-8">
              <div>
                <Skeleton className="h-5 w-40 bg-white/10 mb-4" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="rounded-xl bg-white/[0.04] border border-white/10">
                      <Skeleton className="h-24 rounded-t-xl bg-white/10" />
                      <div className="p-4 space-y-2"><Skeleton className="h-4 w-3/4 bg-white/10" /><Skeleton className="h-3 w-1/2 bg-white/10" /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Skeleton className="h-5 w-32 bg-white/10 mb-4" />
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl bg-white/10" />)}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {curated?.employers && curated.employers.length > 0 && (
                <section data-testid="section-employer-spotlights">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                      <Building2 className="h-4 w-4 text-blue-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Hiring Now</h2>
                    <span className="text-xs text-white/40 ml-1">{curated.employers.length} employers</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {curated.employers.slice(0, 10).map(emp => (
                      <EmployerSpotlight key={emp.employer} employer={emp} citySlug={citySlug} />
                    ))}
                  </div>
                </section>
              )}

              {curated?.industries && curated.industries.length > 0 && (
                <section data-testid="section-industries">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                      <Users className="h-4 w-4 text-purple-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white">By Industry</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {curated.industries.map(ind => (
                      <IndustryPill
                        key={ind.name}
                        industry={ind}
                        isActive={false}
                        onClick={() => switchToSearch(ind.name)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {curated?.newThisWeek && curated.newThisWeek.length > 0 && (
                <section data-testid="section-new-this-week">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      </div>
                      <h2 className="text-lg font-bold text-white">New This Week</h2>
                      <span className="text-xs text-white/40 ml-1">{curated.newThisWeek.length} jobs</span>
                    </div>
                    <button
                      onClick={() => switchToSearch()}
                      className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300 transition-colors"
                      data-testid="link-view-all-new"
                    >
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {curated.newThisWeek.slice(0, 8).map((job, idx) => (
                      <div key={job.id}>
                        {idx === 4 && <InlineAd citySlug={citySlug} page="jobs" />}
                        <JobCard
                          job={job}
                          citySlug={citySlug}
                          onApply={setApplyJob}
                          isSaved={savedSet.has(job.id)}
                          onToggleSave={(id, save) => saveMutation.mutate({ jobId: id, save })}
                          isLoggedIn={isLoggedIn}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {curated?.featured && curated.featured.length > 0 && (
                <section data-testid="section-featured-jobs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                      </div>
                      <h2 className="text-lg font-bold text-white">Featured Positions</h2>
                    </div>
                    <button
                      onClick={() => switchToSearch()}
                      className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300 transition-colors"
                      data-testid="link-view-all-featured"
                    >
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {curated.featured.slice(0, 6).map(job => (
                      <JobCard
                        key={job.id}
                        job={job}
                        citySlug={citySlug}
                        onApply={setApplyJob}
                        isSaved={savedSet.has(job.id)}
                        onToggleSave={(id, save) => saveMutation.mutate({ jobId: id, save })}
                        isLoggedIn={isLoggedIn}
                      />
                    ))}
                  </div>
                </section>
              )}

              {(!curated?.featured?.length && !curated?.newThisWeek?.length) && (
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-12 text-center">
                  <Briefcase className="mx-auto h-12 w-12 text-white/20 mb-4" />
                  <h3 className="font-semibold text-lg mb-1 text-white" data-testid="text-no-jobs">{t("jobs.noJobsFound")}</h3>
                  <p className="text-white/50 text-sm mb-4">{t("jobs.noJobsHint")}</p>
                  <Link href={`/${citySlug}/employer/jobs`}>
                    <Button variant="outline" className="border-white/10 text-white" data-testid="button-post-job-cta">
                      <Building2 className="h-4 w-4 mr-2" /> {t("jobs.postJob")}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => { setEmploymentType("all"); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!employmentType || employmentType === "all" ? "bg-white/15 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"}`}
                data-testid="tab-jobs-all"
              >
                All Jobs
              </button>
              <button
                onClick={() => { setEmploymentType("VOLUNTEER"); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${employmentType === "VOLUNTEER" ? "bg-purple-500/20 text-purple-300" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"}`}
                data-testid="tab-jobs-volunteer"
              >
                <Heart className="h-3 w-3" /> Volunteer
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder={t("jobs.searchPlaceholder")}
                  className="h-9 pl-9 pr-10 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  data-testid="input-jobs-search"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" data-testid="button-clear-job-search">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={employmentType} onValueChange={(v) => { setEmploymentType(v); setPage(1); }}>
                  <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white" data-testid="select-employment-type">
                    <SelectValue placeholder={t("jobs.employment")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("jobs.allTypes")}</SelectItem>
                    <SelectItem value="Full-time">{t("jobs.fullTime")}</SelectItem>
                    <SelectItem value="Part-time">{t("jobs.partTime")}</SelectItem>
                    <SelectItem value="Internship">{t("jobs.internship")}</SelectItem>
                    <SelectItem value="Contract">{t("jobs.contract")}</SelectItem>
                    <SelectItem value="Temporary">{t("jobs.temporary")}</SelectItem>
                    <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={remoteType} onValueChange={(v) => { setRemoteType(v); setPage(1); }}>
                  <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white" data-testid="select-remote-type">
                    <SelectValue placeholder={t("jobs.location")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("jobs.anyLocation")}</SelectItem>
                    <SelectItem value="ONSITE">{t("jobs.onSite")}</SelectItem>
                    <SelectItem value="REMOTE">{t("jobs.remote")}</SelectItem>
                    <SelectItem value="HYBRID">{t("jobs.hybrid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(hasFilters) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-white/40">{t("jobs.activeFilters")}</span>
                {searchQuery && <Badge variant="secondary" className="text-xs bg-white/10 text-white border-0">"{searchQuery}"</Badge>}
                {employmentType && employmentType !== "all" && <Badge variant="secondary" className="text-xs bg-white/10 text-white border-0">{employmentType}</Badge>}
                {remoteType && remoteType !== "all" && <Badge variant="secondary" className="text-xs bg-white/10 text-white border-0">{remoteType}</Badge>}
                {selectedIndustry && <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-300 border-0">{selectedIndustry}</Badge>}
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearchQuery(""); setEmploymentType(""); setRemoteType(""); setSelectedIndustry(""); setPage(1);
                }} className="text-white/60" data-testid="button-clear-filters">
                  <X className="h-3 w-3 mr-1" /> {t("jobs.clear")}
                </Button>
              </div>
            )}

            {searchLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl bg-white/[0.04]" />
                ))}
              </div>
            ) : (searchData?.jobs && searchData.jobs.length > 0) ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {searchData.jobs.map((job, idx) => (
                    <div key={job.id}>
                      {idx === 6 && <InlineAd citySlug={citySlug} page="jobs" />}
                      <JobCard
                        job={job}
                        citySlug={citySlug}
                        onApply={setApplyJob}
                        isSaved={savedSet.has(job.id)}
                        onToggleSave={(id, save) => saveMutation.mutate({ jobId: id, save })}
                        isLoggedIn={isLoggedIn}
                      />
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button variant="outline" size="sm" disabled={page <= 1}
                      onClick={() => setPage(page - 1)} className="border-white/10 text-white" data-testid="button-prev-page">
                      {t("jobs.previous")}
                    </Button>
                    <span className="text-sm text-white/50" data-testid="text-page-info">
                      {t("jobs.pageInfo", { page: String(page), totalPages: String(totalPages), total: String(searchData.total) })}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)} className="border-white/10 text-white" data-testid="button-next-page">
                      {t("jobs.next")}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-12 text-center">
                <Briefcase className="mx-auto h-12 w-12 text-white/20 mb-4" />
                <h3 className="font-semibold text-lg mb-1 text-white" data-testid="text-no-jobs">{t("jobs.noJobsFound")}</h3>
                <p className="text-white/50 text-sm mb-4">
                  {hasFilters ? t("jobs.noJobsFilterHint") : t("jobs.noJobsHint")}
                </p>
                <Link href={`/${citySlug}/employer/jobs`}>
                  <Button variant="outline" className="border-white/10 text-white" data-testid="button-post-job-cta">
                    <Building2 className="h-4 w-4 mr-2" /> {t("jobs.postJob")}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {applyJob && <EasyApplyModal job={applyJob} open={!!applyJob} onClose={() => setApplyJob(null)} />}
      {showAlertSetup && city && (
        <AlertSetupModal
          cityId={city.id}
          open={showAlertSetup}
          onClose={() => setShowAlertSetup(false)}
          currentFilters={{ q: searchQuery, employmentType, remoteType }}
        />
      )}
    </DarkPageShell>
  );
}