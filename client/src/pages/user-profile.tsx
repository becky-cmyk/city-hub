import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { BizImage } from "@/components/biz-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { useAuth } from "@/hooks/use-auth";
import { VerifiedBadge } from "@/components/verified-badge";
import { useI18n } from "@/lib/i18n";
import {
  User,
  ShieldCheck,
  Star,
  PenLine,
  Building2,
  MapPin,
  Calendar,
  Share2,
  FileText,
  MessageSquare,
  Bookmark,
  ChevronRight,
  Home,
  Lock,
} from "lucide-react";

interface UserProfileData {
  id: string;
  displayName: string;
  handle: string | null;
  roleTier: string;
  accountType: string;
  memberSince: string;
  neighborhood: string | null;
  isVerifiedContributor?: boolean;
  verificationTier?: string | null;
  contributorStatus?: string;
  businesses: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    listingTier: string;
    handle: string | null;
  }>;
  shares: Array<{
    id: string;
    title: string;
    coverImageUrl: string | null;
    createdAt: string;
    originalAuthor?: string;
  }>;
  submissions: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    title?: string;
  }>;
  reviews: Array<{
    id: string;
    businessName: string;
    businessSlug: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  }>;
}

const ROLE_BADGE_CONFIG: Record<string, { label: string; icon: typeof User; variant: "default" | "secondary" | "outline" }> = {
  author: { label: "Author", icon: PenLine, variant: "default" },
  verified: { label: "Verified", icon: ShieldCheck, variant: "default" },
  contributor: { label: "Contributor", icon: Star, variant: "secondary" },
  user: { label: "Member", icon: User, variant: "outline" },
};

function RoleBadge({ roleTier }: { roleTier: string }) {
  const config = ROLE_BADGE_CONFIG[roleTier] || ROLE_BADGE_CONFIG.user;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} data-testid="badge-role-tier">
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export default function UserProfile({ citySlug }: { citySlug: string }) {
  const params = useParams<{ handle?: string; userId?: string }>();
  const { t } = useI18n();
  const { user: currentUser } = useAuth();

  const identifier = params.handle || params.userId || "";
  const isById = !!params.userId;
  const apiUrl = isById
    ? `/api/cities/${citySlug}/u/id/${identifier}`
    : `/api/cities/${citySlug}/u/${identifier}`;

  const { data: profile, isLoading, error } = useQuery<UserProfileData>({
    queryKey: ["/api/cities", citySlug, "u", identifier],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!identifier,
  });

  const isOwner = currentUser?.id === profile?.id;

  const canonicalUrl = profile?.handle
    ? `${window.location.origin}/${citySlug}/u/${profile.handle}`
    : `${window.location.origin}/${citySlug}/u/id/${profile?.id || identifier}`;

  usePageMeta({
    title: profile
      ? `${profile.handle ? `@${profile.handle}` : profile.displayName} | CLT Metro Hub`
      : "Profile | CLT Metro Hub",
    description: profile
      ? `${profile.displayName}${profile.handle ? ` (@${profile.handle})` : ""} on CLT Metro Hub${profile.neighborhood ? ` — ${profile.neighborhood}` : ""}`
      : "User profile on CLT Metro Hub",
    canonical: canonicalUrl,
    ogType: "profile",
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto" data-testid="user-profile-loading">
        <Skeleton className="h-32 w-full rounded-md" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <Card className="p-12 text-center max-w-3xl mx-auto" data-testid="user-profile-not-found">
        <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-lg mb-1">Profile not found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This user profile doesn't exist or has been removed.
        </p>
        <Link href={`/${citySlug}`}>
          <Button variant="ghost">Back to Home</Button>
        </Link>
      </Card>
    );
  }

  const initials = profile.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const memberSinceFormatted = new Date(profile.memberSince).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {profile && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Person",
            name: profile.displayName,
            ...(profile.handle && { alternateName: `@${profile.handle}` }),
            url: canonicalUrl,
            ...(profile.neighborhood && {
              address: {
                "@type": "PostalAddress",
                addressLocality: profile.neighborhood,
              },
            }),
            memberOf: {
              "@type": "Organization",
              name: "CLT Metro Hub",
              url: window.location.origin,
            },
          }}
        />
      )}

      <nav
        className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap"
        data-testid="nav-breadcrumb"
        aria-label="Breadcrumb"
      >
        <Link href={`/${citySlug}`}>
          <span className="hover:text-foreground cursor-pointer flex items-center gap-1">
            <Home className="h-3.5 w-3.5" />
            Home
          </span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {profile.handle ? `@${profile.handle}` : profile.displayName}
        </span>
      </nav>

      <Card className="p-6" data-testid="card-user-profile-header">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg font-bold" style={{ background: "hsl(273 66% 34% / 0.15)", color: "hsl(273 66% 34%)" }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold md:text-2xl flex items-center gap-2" data-testid="text-display-name">
              {profile.displayName}
              {profile.isVerifiedContributor && <VerifiedBadge tier={profile.verificationTier} />}
            </h1>
            {profile.handle && (
              <p className="text-sm text-muted-foreground" data-testid="text-handle">
                @{profile.handle}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RoleBadge roleTier={profile.roleTier} />
              {profile.neighborhood && (
                <Badge variant="outline" data-testid="badge-neighborhood">
                  <MapPin className="h-3 w-3 mr-1" />
                  {profile.neighborhood}
                </Badge>
              )}
              <Badge variant="outline" data-testid="badge-member-since">
                <Calendar className="h-3 w-3 mr-1" />
                Member since {memberSinceFormatted}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {profile.businesses.length > 0 && (
        <div className="space-y-3" data-testid="section-businesses">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business{profile.businesses.length > 1 ? "es" : ""}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.businesses.map((biz) => (
              <Link key={biz.id} href={`/${citySlug}/directory/${biz.slug}`}>
                <Card className="p-4 hover-elevate cursor-pointer" data-testid={`card-business-${biz.id}`}>
                  <div className="flex items-center gap-3">
                    <BizImage src={biz.imageUrl} alt={biz.name} className="h-10 w-10 rounded-md object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{biz.name}</p>
                      {biz.handle && (
                        <p className="text-xs text-muted-foreground">@{biz.handle}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="reviews" data-testid="tabs-user-activity">
        <TabsList className="w-full justify-start flex-wrap gap-1">
          <TabsTrigger value="reviews" className="gap-1" data-testid="tab-reviews">
            <MessageSquare className="h-3.5 w-3.5" />
            Reviews ({profile.reviews.length})
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-1" data-testid="tab-submissions">
            <FileText className="h-3.5 w-3.5" />
            Submissions ({profile.submissions.length})
          </TabsTrigger>
          <TabsTrigger value="shares" className="gap-1" data-testid="tab-shares">
            <Share2 className="h-3.5 w-3.5" />
            Shares ({profile.shares.length})
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="saved" className="gap-1" data-testid="tab-saved">
              <Bookmark className="h-3.5 w-3.5" />
              Saved
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="reviews" className="mt-4 space-y-3" data-testid="section-reviews">
          {profile.reviews.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No reviews yet</p>
            </Card>
          ) : (
            profile.reviews.map((review) => (
              <Card key={review.id} className="p-4" data-testid={`card-review-${review.id}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <Link href={`/${citySlug}/directory/${review.businessSlug}`}>
                      <span className="font-medium text-sm hover:underline cursor-pointer" data-testid={`link-review-business-${review.id}`}>
                        {review.businessName}
                      </span>
                    </Link>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-4 space-y-3" data-testid="section-submissions">
          {profile.submissions.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No submissions yet</p>
            </Card>
          ) : (
            profile.submissions.map((sub) => (
              <Card key={sub.id} className="p-4" data-testid={`card-submission-${sub.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {sub.type.replace(/_/g, " ")}
                    </Badge>
                    {sub.title && (
                      <span className="text-sm font-medium truncate">{sub.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        sub.status === "APPROVED"
                          ? "default"
                          : sub.status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {sub.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="shares" className="mt-4 space-y-3" data-testid="section-shares">
          {profile.shares.length === 0 ? (
            <Card className="p-8 text-center">
              <Share2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No shares yet</p>
            </Card>
          ) : (
            profile.shares.map((share) => (
              <Card key={share.id} className="p-4" data-testid={`card-share-${share.id}`}>
                <div className="flex items-center gap-3">
                  {share.coverImageUrl && (
                    <img
                      src={share.coverImageUrl}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{share.title}</p>
                    {share.originalAuthor && (
                      <p className="text-xs text-muted-foreground">
                        Shared from @{share.originalAuthor}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(share.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {isOwner && (
          <TabsContent value="saved" className="mt-4" data-testid="section-saved">
            <Card className="p-6 text-center">
              <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Your saved items are private
              </p>
              <Link href={`/${citySlug}/saved`}>
                <Button variant="outline" size="sm" data-testid="link-view-saved">
                  <Bookmark className="h-4 w-4 mr-1" />
                  View Saved Items
                </Button>
              </Link>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
