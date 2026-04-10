import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { VerifiedBadge } from "@/components/verified-badge";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  MapPin,
  Building2,
  Calendar,
  ExternalLink,
  Share2,
  ShoppingBag,
  Link as LinkIcon,
  Copy,
  Check,
  FileText,
  Globe,
} from "lucide-react";
import { useState } from "react";

interface LinkHubData {
  user: {
    id: string;
    displayName: string;
    handle: string | null;
    avatarUrl: string | null;
    profileTypes: string[];
    activeProfileType: string;
    isVerifiedContributor: boolean;
    verificationTier: string | null;
    neighborhood: string | null;
    memberSince: string;
  };
  settings: {
    bio: string | null;
    themeColor: string | null;
  };
  autoLinks: Array<{
    id: string;
    title: string;
    url: string;
    icon: string | null;
    type: string;
  }>;
  customLinks: Array<{
    id: string;
    title: string;
    url: string;
    icon: string | null;
    sortOrder: number;
    type: string;
  }>;
  linkOrder: string[] | null;
}

const PROFILE_TYPE_LABELS: Record<string, string> = {
  resident: "Resident",
  business: "Business Owner",
  creator: "Creator",
  expert: "Expert",
  employer: "Employer",
  organization: "Organization",
};

const LINK_TYPE_ICONS: Record<string, typeof Building2> = {
  business: Building2,
  event: Calendar,
  marketplace: ShoppingBag,
  post: FileText,
  social: Globe,
  custom: LinkIcon,
};

const AUTO_LINK_PREFIXES = ["biz-", "evt-", "mkt-", "post-", "social-"];

function trackClick(linkId: string) {
  if (!AUTO_LINK_PREFIXES.some(prefix => linkId.startsWith(prefix))) {
    fetch(`/api/link-hub/click/${linkId}`, { method: "POST" }).catch(() => {});
  }
}

export default function LinkHub({ citySlug }: { citySlug: string }) {
  const [location] = useLocation();
  const pathParts = location.split("/");
  const atHandle = pathParts.find(p => p.startsWith("@")) || "";
  const handle = atHandle.replace(/^@/, "");
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<LinkHubData>({
    queryKey: ["/api/cities", citySlug, "link-hub", handle],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/link-hub/${handle}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!handle,
  });

  const pageUrl = `${window.location.origin}/${citySlug}/@${handle}`;

  usePageMeta({
    title: data
      ? `@${data.user.handle} | ${data.user.displayName} — CLT Metro Hub`
      : "Link Page | CLT Metro Hub",
    description: data
      ? `${data.user.displayName}${data.settings.bio ? ` — ${data.settings.bio.slice(0, 120)}` : ""} on CLT Metro Hub`
      : "Personal link page on CLT Metro Hub",
    canonical: pageUrl,
    ogType: "profile",
  });

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${handle} on CLT Metro Hub`, url: pageUrl });
      } else {
        await navigator.clipboard.writeText(pageUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Link copied!" });
      }
    } catch {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="link-hub-loading">
        <div className="w-full max-w-md mx-auto px-4 space-y-4">
          <div className="flex flex-col items-center space-y-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="link-hub-not-found">
        <Card className="p-12 text-center max-w-md mx-auto">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">Page not found</h3>
          <p className="text-sm text-muted-foreground">
            This link page doesn't exist or the user hasn't set up their handle yet.
          </p>
        </Card>
      </div>
    );
  }

  const { user, settings, autoLinks, customLinks, linkOrder } = data;
  const allLinksUnsorted = [...autoLinks, ...customLinks];
  const allLinks = linkOrder && linkOrder.length > 0
    ? (() => {
        const linkMap = new Map(allLinksUnsorted.map(l => [l.id, l]));
        const ordered: typeof allLinksUnsorted = [];
        for (const id of linkOrder) {
          const link = linkMap.get(id);
          if (link) {
            ordered.push(link);
            linkMap.delete(id);
          }
        }
        for (const link of linkMap.values()) {
          ordered.push(link);
        }
        return ordered;
      })()
    : allLinksUnsorted;

  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const themeColor = settings.themeColor || "273 66% 34%";
  const themeBg = `hsl(${themeColor} / 0.08)`;
  const themeAccent = `hsl(${themeColor})`;

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-12">
      {user && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Person",
            name: user.displayName,
            ...(user.handle && { alternateName: `@${user.handle}` }),
            ...(user.avatarUrl && { image: user.avatarUrl }),
            url: pageUrl,
            ...(user.neighborhood && {
              address: {
                "@type": "PostalAddress",
                addressLocality: user.neighborhood,
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

      <div className="flex flex-col items-center text-center pt-8 pb-6" data-testid="link-hub-header">
        <Avatar className="h-20 w-20 mb-3" style={{ border: `3px solid ${themeAccent}` }}>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
          <AvatarFallback
            className="text-xl font-bold"
            style={{ background: themeBg, color: themeAccent }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>

        <h1 className="text-xl font-bold flex items-center gap-1.5" data-testid="text-link-hub-name">
          {user.displayName}
          {user.isVerifiedContributor && <VerifiedBadge tier={user.verificationTier} />}
        </h1>

        {user.handle && (
          <p className="text-sm text-muted-foreground" data-testid="text-link-hub-handle">
            @{user.handle}
          </p>
        )}

        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {user.profileTypes.map((pt) => (
            <Badge key={pt} variant="secondary" className="text-xs" data-testid={`badge-profile-type-${pt}`}>
              {PROFILE_TYPE_LABELS[pt] || pt}
            </Badge>
          ))}
          {user.neighborhood && (
            <Badge variant="outline" className="text-xs" data-testid="badge-link-hub-neighborhood">
              <MapPin className="h-3 w-3 mr-0.5" />
              {user.neighborhood}
            </Badge>
          )}
        </div>

        {settings.bio && (
          <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed" data-testid="text-link-hub-bio">
            {settings.bio}
          </p>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 gap-1.5 text-xs"
          onClick={handleShare}
          data-testid="button-share-link-hub"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Share"}
        </Button>
      </div>

      <div className="space-y-3" data-testid="link-hub-links">
        {allLinks.length === 0 ? (
          <Card className="p-8 text-center" data-testid="link-hub-empty">
            <LinkIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No links yet</p>
          </Card>
        ) : (
          allLinks.map((link) => {
            const Icon = LINK_TYPE_ICONS[link.type] || ExternalLink;
            const isExternal = link.url.startsWith("http");

            return (
              <a
                key={link.id}
                href={link.url}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                onClick={() => trackClick(link.id)}
                className="block"
                data-testid={`link-hub-card-${link.id}`}
              >
                <Card
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer border"
                  style={{ borderColor: `hsl(${themeColor} / 0.15)` }}
                >
                  <div className="flex items-center gap-3">
                    {link.icon ? (
                      <img
                        src={link.icon}
                        alt=""
                        className="h-9 w-9 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: themeBg }}
                      >
                        <Icon className="h-4.5 w-4.5" style={{ color: themeAccent }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{link.title}</p>
                      {link.type !== "custom" && (
                        <p className="text-xs text-muted-foreground capitalize">{link.type}</p>
                      )}
                    </div>
                    {isExternal && (
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </Card>
              </a>
            );
          })
        )}
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <a href={`/${citySlug}`} className="font-medium hover:underline" style={{ color: themeAccent }}>
            CLT Metro Hub
          </a>
        </p>
      </div>
    </div>
  );
}
