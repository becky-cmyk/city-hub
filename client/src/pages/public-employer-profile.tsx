import { useQuery } from "@tanstack/react-query";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Building2, Briefcase, MapPin, Globe, Mail, Phone, Users, Calendar, Award, Sparkles, Shield } from "lucide-react";
import { Link } from "wouter";

interface PublicEmployerData {
  profile: {
    id: string;
    businessId: string;
    businessName: string;
    businessSlug: string;
    hiringStatus: string;
    companyDescription: string | null;
    typicalRoles: string[];
    industries: string[];
    benefitsOffered: string[];
    applicationUrl: string | null;
    workplaceSummary: string | null;
    cultureDescription: string | null;
    hiringContactMethod: string | null;
    verificationBadges: string[];
  };
  activeJobs: {
    id: string;
    title: string;
    employmentType: string;
    location: string | null;
    isRemote: boolean;
  }[];
}

export default function PublicEmployerProfile({ citySlug, businessId }: { citySlug: string; businessId: string }) {
  const { data, isLoading, error } = useQuery<PublicEmployerData>({
    queryKey: ["/api/workforce/public/employer", businessId],
    queryFn: async () => {
      const r = await fetch(`/api/workforce/public/employer/${businessId}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
  });

  useRegisterAdminEdit("businesses", businessId, "Edit Employer");

  usePageMeta({
    title: data ? `${data.profile.businessName} — Hiring Profile` : "Employer Hiring Profile — CLT Metro Hub",
    description: data?.profile.companyDescription || "View this employer's hiring profile on CLT Metro Hub.",
  });

  if (isLoading) {
    return (
      <DarkPageShell fillHeight>
        <div className="space-y-4">
          <Skeleton className="h-24 bg-white/10 rounded-xl" />
          <Skeleton className="h-40 bg-white/10 rounded-xl" />
        </div>
      </DarkPageShell>
    );
  }

  if (error || !data) {
    return (
      <DarkPageShell fillHeight>
        <div className="text-center py-16">
          <Building2 className="mx-auto h-12 w-12 text-white/20 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Hiring Profile Not Found</h2>
          <p className="text-white/50 text-sm">This employer doesn't have a hiring profile yet.</p>
        </div>
      </DarkPageShell>
    );
  }

  const { profile, activeJobs } = data;

  const hiringStatusColors: Record<string, string> = {
    ACTIVELY_HIRING: "bg-green-500/20 text-green-300",
    OPEN_TO_CANDIDATES: "bg-yellow-500/20 text-yellow-300",
    NOT_HIRING: "bg-red-500/20 text-red-300",
  };

  const contactMethodLabels: Record<string, string> = {
    EMAIL: "Email",
    PHONE: "Phone",
    WEBSITE: "Website",
    IN_PERSON: "In Person",
    PLATFORM: "Through Platform",
  };

  return (
    <DarkPageShell fillHeight>
      <div className="space-y-6">
        <div className="rounded-xl bg-white/10 border border-white/10 p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              <Building2 className="h-7 w-7 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white" data-testid="text-employer-name">{profile.businessName}</h1>
                <Badge className={`border-0 text-xs ${hiringStatusColors[profile.hiringStatus] || "bg-white/10 text-white/60"}`} data-testid="badge-hiring-status">
                  {profile.hiringStatus.replace(/_/g, " ")}
                </Badge>
              </div>
              {profile.industries && profile.industries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.industries.map((ind: string) => (
                    <Badge key={ind} variant="outline" className="text-xs border-white/10 text-white/60">{ind}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {profile.companyDescription && (
            <p className="text-white/60 text-sm mt-4 leading-relaxed" data-testid="text-company-description">{profile.companyDescription}</p>
          )}
        </div>

        {profile.workplaceSummary && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2">Workplace Overview</h2>
            <p className="text-white/60 text-sm leading-relaxed rounded-lg bg-white/5 border border-white/10 p-4" data-testid="text-workplace-summary">{profile.workplaceSummary}</p>
          </div>
        )}

        {profile.cultureDescription && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2">Culture & Values</h2>
            <p className="text-white/60 text-sm leading-relaxed rounded-lg bg-white/5 border border-white/10 p-4" data-testid="text-culture">{profile.cultureDescription}</p>
          </div>
        )}

        {profile.typicalRoles && profile.typicalRoles.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" /> Commonly Hired Roles
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {profile.typicalRoles.map((role: string) => (
                <Badge key={role} className="bg-purple-500/20 text-purple-300 border-0 text-xs" data-testid={`badge-typical-role-${role}`}>{role}</Badge>
              ))}
            </div>
          </div>
        )}

        {profile.benefitsOffered && profile.benefitsOffered.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-1.5">
              <Award className="h-4 w-4" /> Benefits
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {profile.benefitsOffered.map((b: string) => (
                <Badge key={b} className="bg-green-500/20 text-green-300 border-0 text-xs">{b}</Badge>
              ))}
            </div>
          </div>
        )}

        {profile.hiringContactMethod && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2">How to Apply</h2>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
              <p className="text-sm text-white/60">
                Preferred method: <span className="text-white">{contactMethodLabels[profile.hiringContactMethod] || profile.hiringContactMethod}</span>
              </p>
              {profile.applicationUrl && (
                <a href={profile.applicationUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-purple-300" data-testid="link-application-url">
                  <Globe className="h-3.5 w-3.5" /> Apply Online
                </a>
              )}
            </div>
          </div>
        )}

        {activeJobs.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" /> Active Job Openings
            </h2>
            <div className="space-y-2">
              {activeJobs.map((job) => (
                <div key={job.id} className="rounded-lg bg-white/5 border border-white/10 p-3 flex items-center justify-between" data-testid={`card-active-job-${job.id}`}>
                  <div>
                    <p className="text-sm text-white font-medium">{job.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className="bg-white/10 text-white/60 border-0 text-[10px]">{job.employmentType?.replace("_", " ")}</Badge>
                      {job.location && <span className="text-xs text-white/40">{job.location}</span>}
                      {job.isRemote && <Badge className="bg-blue-500/20 text-blue-300 border-0 text-[10px]">Remote</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-xs text-white/40 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Hiring events — coming soon
            </p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-xs text-white/40 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Employer trust badges — coming soon
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
          <span className="text-xs text-purple-300">Charlotte AI employer hiring guidance — coming soon</span>
        </div>
      </div>
    </DarkPageShell>
  );
}
