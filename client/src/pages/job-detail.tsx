import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, MapPin, DollarSign, Clock, ExternalLink, Building2, ArrowLeft, Send, Heart } from "lucide-react";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import type { Job } from "@shared/schema";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { useCity } from "@/hooks/use-city";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useSmartBack } from "@/hooks/use-smart-back";

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
  return (d: Date | string | null | undefined) => {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
}

export default function JobDetail({ params }: { params: { citySlug: string; jobId: string } }) {
  const { citySlug, jobId } = params;
  const { city } = useCity(citySlug);
  const formatPay = useFormatPay();
  const formatDate = useFormatDate();
  const goBack = useSmartBack(`/${citySlug}/jobs/browse`);
  const { t } = useI18n();

  const { data: job, isLoading, error } = useQuery<Job>({
    queryKey: ["/api/cities", citySlug, "jobs", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/jobs/${jobId}`);
      if (!res.ok) throw new Error("Job not found");
      return res.json();
    },
    enabled: !!citySlug && !!jobId,
  });

  useRegisterAdminEdit("jobs-moderation", job?.id, "Edit Job");

  usePageMeta({
    title: job ? `${job.title}${job.employer ? ` at ${job.employer}` : ""} | ${city?.name || citySlug} Jobs` : "Job Details",
    description: job?.description?.slice(0, 160) || "Job listing details",
  });

  if (isLoading) {
    return (
      <DarkPageShell citySlug={citySlug}>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-64 bg-white/10" />
          <Skeleton className="h-6 w-40 bg-white/10" />
          <Skeleton className="h-40 w-full bg-white/10" />
        </div>
      </DarkPageShell>
    );
  }

  if (error || !job) {
    return (
      <DarkPageShell citySlug={citySlug}>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <Briefcase className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2" data-testid="text-job-not-found">Job Not Found</h1>
          <p className="text-white/50 mb-6">This job listing may have been removed or is no longer active.</p>
          <Link href={`/${citySlug}/jobs/browse`}>
            <Button variant="outline" className="border-white/10 text-white" data-testid="button-back-to-jobs">
              <ArrowLeft className="h-4 w-4 mr-2" /> Browse Jobs
            </Button>
          </Link>
        </div>
      </DarkPageShell>
    );
  }

  const pay = formatPay(job);
  const posted = formatDate(job.postedAt);
  const isVolunteer = job.employmentType === "VOLUNTEER";
  const closesAt = job.closesAt ? new Date(job.closesAt) : null;
  const isClosingSoon = closesAt && closesAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && closesAt.getTime() > Date.now();

  return (
    <DarkPageShell citySlug={citySlug}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-6 transition-colors" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" /> Back to Jobs
        </button>

        <div className="rounded-xl bg-white/[0.06] border border-white/10 p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-job-title">{job.title}</h1>
            {job.employer && (
              <div className="flex items-center gap-2 text-white/60 text-lg">
                <Building2 className="h-5 w-5 shrink-0" />
                <span data-testid="text-job-employer">{job.employer}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap text-sm text-white/50 mb-5">
            {job.locationText && (
              <span className="flex items-center gap-1.5" data-testid="text-job-location">
                <MapPin className="h-4 w-4 shrink-0" /> {job.locationText}
              </span>
            )}
            {!isVolunteer && pay && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium" data-testid="text-job-pay">
                <DollarSign className="h-4 w-4 shrink-0" /> {pay}
              </span>
            )}
            {isVolunteer && job.scheduleCommitment && (
              <span className="flex items-center gap-1.5 text-purple-400 font-medium" data-testid="text-job-schedule">
                <Clock className="h-4 w-4 shrink-0" /> {job.scheduleCommitment}
              </span>
            )}
            {posted && (
              <span className="flex items-center gap-1.5" data-testid="text-job-posted">
                <Clock className="h-4 w-4 shrink-0" /> Posted {posted}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-6">
            {isVolunteer ? (
              <Badge variant="secondary" className="bg-purple-500/15 text-purple-300 border-0" data-testid="badge-volunteer">
                <Heart className="h-3 w-3 mr-1" /> Volunteer
              </Badge>
            ) : (
              job.employmentType && (
                <Badge variant="secondary" className="bg-blue-500/15 text-blue-300 border-0" data-testid="badge-employment-type">
                  {job.employmentType}
                </Badge>
              )
            )}
            {job.remoteType && (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-300 border-0" data-testid="badge-remote-type">
                {job.remoteType}
              </Badge>
            )}
            {job.department && (
              <Badge variant="outline" className="border-white/10 text-white/50" data-testid="badge-department">
                {job.department}
              </Badge>
            )}
            {isClosingSoon && (
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-300 border-0" data-testid="badge-closing-soon">
                Closing soon
              </Badge>
            )}
          </div>

          {job.description && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3">Description</h2>
              <div className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-job-description">
                {job.description}
              </div>
            </div>
          )}

          {isVolunteer && job.skillsHelpful && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-2">Skills Helpful</h2>
              <p className="text-white/50 text-sm" data-testid="text-job-skills">{job.skillsHelpful}</p>
            </div>
          )}

          {closesAt && (
            <p className="text-sm text-white/40 mb-6" data-testid="text-job-closes">
              Applications close: {closesAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-white/10">
            {isVolunteer ? (
              job.contactUrl ? (
                <a href={job.contactUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-volunteer-apply">
                    <Heart className="h-4 w-4 mr-2" /> Apply / Contact
                  </Button>
                </a>
              ) : (
                <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-volunteer-apply">
                  <Heart className="h-4 w-4 mr-2" /> Volunteer
                </Button>
              )
            ) : (
              <>
                {job.applyUrl && (
                  <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                    <Button data-testid="button-apply">
                      <Send className="h-4 w-4 mr-2" /> Apply Now <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </a>
                )}
                {job.detailsUrl && (
                  <a href={job.detailsUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="border-white/10 text-white" data-testid="button-details">
                      View Full Details <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DarkPageShell>
  );
}
