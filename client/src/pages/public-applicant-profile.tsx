import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { User, Award, Shield, MapPin, Star, Briefcase, Sparkles } from "lucide-react";

interface PublicApplicantData {
  profile: {
    id: string;
    headline: string | null;
    summary: string | null;
    availabilityType: string;
    desiredRoles: string[];
    desiredIndustries: string[];
    yearsExperience: number | null;
    highestEducation: string | null;
    remotePreference: string | null;
    visibilityLevel: string;
  };
  user: { displayName: string; avatarUrl: string | null };
  zone: { name: string; slug: string } | null;
  skills: {
    skillName: string;
    subcategoryName: string;
    categoryName: string;
    level: string;
    yearsUsed: number | null;
    isTopSkill: boolean;
  }[];
  credentials: {
    credentialName: string;
    verificationStatus: string;
    expirationDate: string | null;
    isCustom: boolean;
  }[];
}

export default function PublicApplicantProfile({ citySlug, id }: { citySlug: string; id: string }) {
  const { data, isLoading, error } = useQuery<PublicApplicantData>({
    queryKey: ["/api/workforce/public/applicant", id],
    queryFn: async () => {
      const r = await fetch(`/api/workforce/public/applicant/${id}`);
      if (!r.ok) throw new Error("Profile not found or private");
      return r.json();
    },
  });

  usePageMeta({
    title: data ? `${data.user.displayName} — Workforce Profile` : "Workforce Profile — CLT Metro Hub",
    description: data?.profile.headline || "View this applicant's workforce profile on CLT Metro Hub.",
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
          <User className="mx-auto h-12 w-12 text-white/20 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Profile Not Available</h2>
          <p className="text-white/50 text-sm">This profile is either private or doesn't exist.</p>
        </div>
      </DarkPageShell>
    );
  }

  const { profile, user, zone, skills, credentials } = data;
  const topSkills = skills.filter(s => s.isTopSkill);
  const otherSkills = skills.filter(s => !s.isTopSkill);

  const levelColors: Record<string, string> = {
    BEGINNER: "bg-blue-500/20 text-blue-300",
    INTERMEDIATE: "bg-green-500/20 text-green-300",
    ADVANCED: "bg-purple-500/20 text-purple-300",
    EXPERT: "bg-yellow-500/20 text-yellow-300",
  };

  return (
    <DarkPageShell fillHeight>
      <div className="space-y-6">
        <div className="rounded-xl bg-white/10 border border-white/10 p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-purple-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-white" data-testid="text-applicant-name">{user.displayName}</h1>
              {profile.headline && (
                <p className="text-white/70 text-sm mt-1" data-testid="text-applicant-headline">{profile.headline}</p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {zone && (
                  <span className="flex items-center gap-1 text-xs text-white/50">
                    <MapPin className="h-3 w-3" /> {zone.name}
                  </span>
                )}
                <Badge className="bg-white/10 text-white/60 border-0 text-xs">{profile.availabilityType.replace("_", " ")}</Badge>
                {profile.remotePreference && profile.remotePreference !== "NO_PREFERENCE" && (
                  <Badge className="bg-purple-500/20 text-purple-300 border-0 text-xs">{profile.remotePreference}</Badge>
                )}
              </div>
            </div>
          </div>
          {profile.summary && (
            <p className="text-white/60 text-sm mt-4 leading-relaxed" data-testid="text-applicant-summary">{profile.summary}</p>
          )}
        </div>

        {profile.desiredRoles && profile.desiredRoles.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" /> Desired Roles
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {profile.desiredRoles.map((role: string) => (
                <Badge key={role} className="bg-purple-500/20 text-purple-300 border-0 text-xs" data-testid={`badge-role-${role}`}>{role}</Badge>
              ))}
            </div>
          </div>
        )}

        {topSkills.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-400" /> Key Strengths
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topSkills.map((s) => (
                <div key={s.skillName} className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-2.5 flex items-center justify-between" data-testid={`card-top-skill-${s.skillName}`}>
                  <div>
                    <span className="text-sm text-white font-medium">{s.skillName}</span>
                    <span className="text-xs text-white/40 ml-2">{s.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`border-0 text-[10px] ${levelColors[s.level] || "bg-white/10 text-white/60"}`}>{s.level}</Badge>
                    {s.yearsUsed && <span className="text-xs text-white/40">{s.yearsUsed}yr</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {otherSkills.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-1.5">
              <Award className="h-4 w-4" /> Skills
            </h2>
            <div className="space-y-1.5">
              {otherSkills.map((s) => (
                <div key={s.skillName} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-2.5" data-testid={`card-skill-${s.skillName}`}>
                  <div>
                    <span className="text-sm text-white">{s.skillName}</span>
                    <span className="text-xs text-white/40 ml-2">{s.categoryName} → {s.subcategoryName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`border-0 text-[10px] ${levelColors[s.level] || "bg-white/10 text-white/60"}`}>{s.level}</Badge>
                    {s.yearsUsed && <span className="text-xs text-white/40">{s.yearsUsed}yr</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {credentials.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> Credentials & Licenses
            </h2>
            <div className="space-y-1.5">
              {credentials.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-2.5" data-testid={`card-pub-cred-${i}`}>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-white">{c.credentialName}</span>
                  </div>
                  <Badge className={`border-0 text-[10px] ${
                    c.verificationStatus === "VERIFIED" ? "bg-green-500/20 text-green-300" :
                    c.verificationStatus === "EXPIRED" ? "bg-red-500/20 text-red-300" :
                    "bg-yellow-500/20 text-yellow-300"
                  }`}>{c.verificationStatus}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
          <span className="text-xs text-purple-300">Charlotte AI skill gap analysis — coming soon</span>
        </div>
      </div>
    </DarkPageShell>
  );
}
