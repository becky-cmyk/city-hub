import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Star, Activity, Award, Crown, Users, Mic, Calendar, Heart, Sparkles, TrendingUp, AlertTriangle, Tag } from "lucide-react";

export interface TrustSignals {
  isVerified: boolean;
  claimStatus: string;
  googleRating?: string | null;
  googleReviewCount?: number | null;
  hubAvgRating?: number;
  hubReviewCount?: number;
  presenceStatus?: string;
  authorityBadges?: string[];
  creatorType?: string | null;
  crownStatus?: string | null;
  crownCategoryName?: string | null;
  contextLabels?: string[];
  listingTier?: string;
  licensesAndCerts?: string[];
  awardsAndHonors?: string[];
}

const AUTHORITY_BADGE_CONFIG: Record<string, { icon: typeof Award; label: string; color: string }> = {
  LOCAL_EXPERT: { icon: Award, label: "Local Expert", color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  CREATOR: { icon: Sparkles, label: "Creator", color: "text-purple-400 bg-purple-500/15 border-purple-500/30" },
  SPEAKER: { icon: Mic, label: "Speaker", color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  EVENT_HOST: { icon: Calendar, label: "Event Organizer", color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30" },
  COMMUNITY_LEADER: { icon: Users, label: "Community Leader", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  NONPROFIT: { icon: Heart, label: "Nonprofit", color: "text-pink-400 bg-pink-500/15 border-pink-500/30" },
  ORGANIZATION: { icon: Users, label: "Organization", color: "text-indigo-400 bg-indigo-500/15 border-indigo-500/30" },
  PRESS_SOURCE: { icon: Award, label: "Press Source", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
};

const CROWN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  nominee: { label: "Crown Nominee", color: "text-amber-300 bg-amber-500/15 border-amber-500/30" },
  qualified_nominee: { label: "Crown Finalist", color: "text-amber-200 bg-amber-500/20 border-amber-400/40" },
  crown_winner: { label: "Crown Winner", color: "text-yellow-300 bg-yellow-500/20 border-yellow-400/50" },
};

function getActivityStatus(presenceStatus?: string): { label: string; color: string; icon: typeof Activity } | null {
  switch (presenceStatus) {
    case "ACTIVE":
      return { label: "Active", color: "text-green-400 bg-green-500/15 border-green-500/30", icon: Activity };
    case "INACTIVE":
      return { label: "Needs Attention", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: AlertTriangle };
    case "ARCHIVED":
      return null;
    default:
      return null;
  }
}

function computeRating(googleRating?: string | null, googleReviewCount?: number | null, hubAvg?: number, hubCount?: number) {
  const gRating = googleRating ? parseFloat(googleRating) : 0;
  const gCount = googleReviewCount || 0;
  const hAvg = hubAvg || 0;
  const hCount = hubCount || 0;
  const totalCount = gCount + hCount;
  const combinedAvg = totalCount > 0 ? (gRating * gCount + hAvg * hCount) / totalCount : 0;
  return { combinedAvg, totalCount };
}

interface TrustCardProps {
  signals: TrustSignals;
  showCredentials?: boolean;
}

export function TrustCard({ signals, showCredentials = true }: TrustCardProps) {
  const rating = computeRating(signals.googleRating, signals.googleReviewCount, signals.hubAvgRating, signals.hubReviewCount);
  const activityInfo = getActivityStatus(signals.presenceStatus);
  const authorityBadges = signals.authorityBadges || [];
  const contextLabels = signals.contextLabels || [];
  const crownConfig = signals.crownStatus ? CROWN_STATUS_CONFIG[signals.crownStatus] : null;
  const licensesAndCerts = signals.licensesAndCerts || [];
  const awardsAndHonors = signals.awardsAndHonors || [];

  const hasIdentity = signals.isVerified || signals.claimStatus === "CLAIMED";
  const hasExperience = rating.totalCount > 0;
  const isGrowing = signals.listingTier === "ENHANCED";
  const hasActivity = !!activityInfo || isGrowing;
  const hasAuthority = authorityBadges.length > 0 || !!signals.creatorType;
  const hasCrown = !!crownConfig;
  const hasContext = contextLabels.length > 0;
  const hasCredentials = showCredentials && (licensesAndCerts.length > 0 || awardsAndHonors.length > 0);

  const hasAnySignal = hasIdentity || hasExperience || hasActivity || hasAuthority || hasCrown || hasContext || hasCredentials;
  if (!hasAnySignal) return null;

  return (
    <Card className="p-5 space-y-4 border-white/10" data-testid="card-credentials">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-purple-400" />
        <h3 className="font-semibold text-white text-sm">Credentials</h3>
      </div>

      <div className="space-y-3">
        {hasIdentity && (
          <div className="space-y-1.5" data-testid="trust-layer-identity">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Identity</p>
            <div className="flex flex-wrap gap-1.5">
              {signals.isVerified && (
                <Badge className="text-[10px] gap-1 text-green-400 bg-green-500/15 border-green-500/30" data-testid="trust-badge-verified">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </Badge>
              )}
              {signals.claimStatus === "CLAIMED" && (
                <Badge className="text-[10px] gap-1 text-blue-400 bg-blue-500/15 border-blue-500/30" data-testid="trust-badge-claimed">
                  <ShieldCheck className="h-3 w-3" />
                  Owner Confirmed
                </Badge>
              )}
            </div>
          </div>
        )}

        {hasExperience && (
          <div className="space-y-1.5" data-testid="trust-layer-experience">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Experience</p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3.5 w-3.5 ${s <= Math.round(rating.combinedAvg) ? "fill-amber-400 text-amber-400" : "text-white/20"}`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-white" data-testid="trust-rating-value">
                {rating.combinedAvg.toFixed(1)}
              </span>
              <span className="text-xs text-white/50" data-testid="trust-review-count">
                ({rating.totalCount} {rating.totalCount === 1 ? "review" : "reviews"})
              </span>
            </div>
          </div>
        )}

        {hasActivity && (
          <div className="space-y-1.5" data-testid="trust-layer-activity">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Activity</p>
            <div className="flex flex-wrap gap-1.5">
              {activityInfo && (
                <Badge className={`text-[10px] gap-1 ${activityInfo.color}`} data-testid="trust-badge-activity">
                  <activityInfo.icon className="h-3 w-3" />
                  {activityInfo.label}
                </Badge>
              )}
              {isGrowing && (
                <Badge className="text-[10px] gap-1 text-purple-300 bg-purple-500/15 border-purple-500/30" data-testid="trust-badge-enhanced">
                  <TrendingUp className="h-3 w-3" />
                  Growing
                </Badge>
              )}
            </div>
          </div>
        )}

        {hasAuthority && (
          <div className="space-y-1.5" data-testid="trust-layer-authority">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Authority</p>
            <div className="flex flex-wrap gap-1.5">
              {authorityBadges.map((badgeType) => {
                const cfg = AUTHORITY_BADGE_CONFIG[badgeType];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <Badge key={badgeType} className={`text-[10px] gap-1 ${cfg.color}`} data-testid={`trust-badge-authority-${badgeType.toLowerCase()}`}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </Badge>
                );
              })}
              {signals.creatorType && !authorityBadges.includes("CREATOR") && (
                <Badge className="text-[10px] gap-1 text-purple-400 bg-purple-500/15 border-purple-500/30" data-testid="trust-badge-creator-type">
                  <Sparkles className="h-3 w-3" />
                  {signals.creatorType}
                </Badge>
              )}
            </div>
          </div>
        )}

        {hasCrown && (
          <div className="space-y-1.5" data-testid="trust-layer-recognition">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Recognition</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge className={`text-[10px] gap-1 ${crownConfig!.color}`} data-testid="trust-badge-crown">
                <Crown className="h-3 w-3" />
                {crownConfig!.label}
                {signals.crownCategoryName && (
                  <span className="opacity-70 ml-0.5">— {signals.crownCategoryName}</span>
                )}
              </Badge>
            </div>
          </div>
        )}

        {hasContext && (
          <div className="space-y-1.5" data-testid="trust-layer-context">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Community</p>
            <div className="flex flex-wrap gap-1.5">
              {contextLabels.map((label) => (
                <Badge key={label} className="text-[10px] gap-1 text-cyan-400 bg-cyan-500/15 border-cyan-500/30" data-testid={`trust-badge-context-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <Tag className="h-3 w-3" />
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {hasCredentials && licensesAndCerts.length > 0 && (
          <div className="space-y-1.5" data-testid="credentials-layer-licenses">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Licenses & Certifications</p>
            <ul className="space-y-1">
              {licensesAndCerts.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-white/80" data-testid={`credential-license-${item.toLowerCase().replace(/\s+/g, "-")}`}>
                  <ShieldCheck className="h-3 w-3 text-green-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasCredentials && awardsAndHonors.length > 0 && (
          <div className="space-y-1.5" data-testid="credentials-layer-awards">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Awards & Honors</p>
            <ul className="space-y-1">
              {awardsAndHonors.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-white/80" data-testid={`credential-award-${item.toLowerCase().replace(/\s+/g, "-")}`}>
                  <Award className="h-3 w-3 text-amber-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

interface TrustSummaryProps {
  signals: TrustSignals;
  compact?: boolean;
}

export function TrustSummary({ signals, compact = false }: TrustSummaryProps) {
  const rating = computeRating(signals.googleRating, signals.googleReviewCount, signals.hubAvgRating, signals.hubReviewCount);
  const crownConfig = signals.crownStatus ? CROWN_STATUS_CONFIG[signals.crownStatus] : null;
  const authorityBadges = signals.authorityBadges || [];
  const contextLabels = signals.contextLabels || [];

  const hasAnySignal = signals.isVerified || rating.totalCount > 0 || crownConfig || authorityBadges.length > 0 || contextLabels.length > 0;
  if (!hasAnySignal) return null;

  const iconSize = compact ? "h-2.5 w-2.5" : "h-3 w-3";
  const textSize = compact ? "text-[8px]" : "text-[9px]";

  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="trust-summary">
      {signals.isVerified && (
        <Badge className={`${textSize} gap-0.5 bg-green-600/30 border-green-500/40 text-green-300`} data-testid="trust-summary-verified">
          <ShieldCheck className={iconSize} />
          {!compact && "Verified"}
        </Badge>
      )}

      {rating.totalCount > 0 && (
        <span className={`flex items-center gap-0.5 ${compact ? "text-[9px]" : "text-[10px]"} text-white/60`} data-testid="trust-summary-rating">
          <Star className={`${iconSize} fill-amber-400 text-amber-400`} />
          <span className="font-medium text-white/80">{rating.combinedAvg.toFixed(1)}</span>
          {!compact && <span>({rating.totalCount})</span>}
        </span>
      )}

      {crownConfig && (
        <Badge className={`${textSize} gap-0.5 ${crownConfig.color}`} data-testid="trust-summary-crown">
          <Crown className={iconSize} />
          {compact ? "Crown" : crownConfig.label}
        </Badge>
      )}

      {authorityBadges.slice(0, compact ? 1 : 2).map((badgeType) => {
        const cfg = AUTHORITY_BADGE_CONFIG[badgeType];
        if (!cfg) return null;
        const Icon = cfg.icon;
        return (
          <Badge key={badgeType} className={`${textSize} gap-0.5 ${cfg.color}`} data-testid={`trust-summary-authority-${badgeType.toLowerCase()}`}>
            <Icon className={iconSize} />
            {!compact && cfg.label}
          </Badge>
        );
      })}

      {contextLabels.slice(0, 1).map((label) => (
        <Badge key={label} className={`${textSize} gap-0.5 text-cyan-400 bg-cyan-500/15 border-cyan-500/30`} data-testid="trust-summary-context">
          <Tag className={iconSize} />
          {label}
        </Badge>
      ))}
    </div>
  );
}

export function deriveTrustSignals(
  business: {
    isVerified: boolean;
    claimStatus: string;
    googleRating?: string | null;
    googleReviewCount?: number | null;
    presenceStatus?: string;
    creatorType?: string | null;
    listingTier?: string;
    featureAttributes?: string[] | null;
    isNonprofit?: boolean;
    isCommunityServing?: boolean;
    isFeatured?: boolean;
    licensesAndCerts?: string[] | null;
    awardsAndHonors?: string[] | null;
  },
  options?: {
    profileBadges?: string[];
    hubAvgRating?: number;
    hubReviewCount?: number;
    crownStatus?: string | null;
    crownCategoryName?: string | null;
  }
): TrustSignals {
  const contextLabels: string[] = [];

  if (business.isFeatured) contextLabels.push("Featured Locally");
  if (business.isNonprofit) contextLabels.push("Community Serving");
  if (business.isCommunityServing) contextLabels.push("Community Active");

  const attrs = business.featureAttributes || [];
  if (attrs.includes("family-friendly")) contextLabels.push("Family Favorite");

  return {
    isVerified: business.isVerified,
    claimStatus: business.claimStatus,
    googleRating: business.googleRating,
    googleReviewCount: business.googleReviewCount,
    hubAvgRating: options?.hubAvgRating,
    hubReviewCount: options?.hubReviewCount,
    presenceStatus: business.presenceStatus,
    authorityBadges: options?.profileBadges || [],
    creatorType: business.creatorType,
    crownStatus: options?.crownStatus,
    crownCategoryName: options?.crownCategoryName,
    contextLabels,
    listingTier: business.listingTier,
    licensesAndCerts: business.licensesAndCerts || [],
    awardsAndHonors: business.awardsAndHonors || [],
  };
}
