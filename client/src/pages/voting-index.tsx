import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { useCity } from "@/hooks/use-city";
import { Vote, Calendar, ArrowRight, Trophy } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl: string | null;
  slug: string | null;
}

export default function VotingIndex({ citySlug }: { citySlug: string }) {
  const { data: city } = useCity(citySlug);
  const cityName = citySlug === "charlotte" ? "Charlotte" : citySlug.charAt(0).toUpperCase() + citySlug.slice(1);

  const vBranding = getCityBranding(citySlug);
  const vBrand = vBranding ? getBrandForContext(vBranding, "default") : null;
  usePageMeta({
    title: `Community Voting | ${vBrand?.ogSiteName || "CLT Hub"}`,
    description: `Vote in active campaigns and see results from past community voting in ${cityName}.`,
    ogSiteName: vBrand?.ogSiteName,
  });

  const { data: activeCampaigns, isLoading: loadingActive } = useQuery<Campaign[]>({
    queryKey: ["/api/community/voting-campaigns", { cityId: city?.id, status: "active" }],
    queryFn: async () => {
      const res = await fetch(`/api/community/voting-campaigns?cityId=${city?.id}&status=active`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!city?.id,
  });

  const { data: completedCampaigns, isLoading: loadingCompleted } = useQuery<Campaign[]>({
    queryKey: ["/api/community/voting-campaigns", { cityId: city?.id, status: "completed" }],
    queryFn: async () => {
      const res = await fetch(`/api/community/voting-campaigns?cityId=${city?.id}&status=completed`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!city?.id,
  });

  const isLoading = loadingActive || loadingCompleted;

  if (isLoading) {
    return (
      <div className="mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const allActive = activeCampaigns || [];
  const allCompleted = completedCampaigns || [];
  const noContent = allActive.length === 0 && allCompleted.length === 0;

  return (
    <div className="mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Vote className="h-6 w-6 text-violet-500" />
          <h1 className="text-2xl font-bold" data-testid="text-voting-title">Community Voting</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Vote in community campaigns, awards, and polls. Your voice helps shape {cityName}.
        </p>
      </div>

      {noContent && (
        <Card className="p-12 text-center">
          <Vote className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground">Check back soon for community voting campaigns and awards.</p>
        </Card>
      )}

      {allActive.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Active Campaigns
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {allActive.map(c => (
              <CampaignCard key={c.id} campaign={c} citySlug={citySlug} active />
            ))}
          </div>
        </section>
      )}

      {allCompleted.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Past Campaigns
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {allCompleted.map(c => (
              <CampaignCard key={c.id} campaign={c} citySlug={citySlug} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CampaignCard({ campaign, citySlug, active }: { campaign: Campaign; citySlug: string; active?: boolean }) {
  const linkPath = `/${citySlug}/vote/${campaign.slug || campaign.id}`;
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;
  const hasEnded = endsAt && endsAt < new Date();

  return (
    <Link href={linkPath}>
      <Card className="overflow-hidden cursor-pointer transition-shadow hover:shadow-md" data-testid={`campaign-card-${campaign.id}`}>
        {campaign.imageUrl && (
          <div className="aspect-[2/1] bg-muted overflow-hidden">
            <img src={campaign.imageUrl} alt={campaign.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm leading-tight">{campaign.title}</h3>
            {active && (
              <Badge variant="outline" className="text-[10px] shrink-0 border-green-300 text-green-600">
                Active
              </Badge>
            )}
            {hasEnded && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                Ended
              </Badge>
            )}
          </div>
          {campaign.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{campaign.description}</p>
          )}
          {endsAt && !hasEnded && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              <Calendar className="h-3 w-3" />
              Ends {endsAt.toLocaleDateString()}
            </div>
          )}
          <Button variant="ghost" size="sm" className="gap-1 -ml-2 text-violet-600" data-testid={`link-campaign-${campaign.id}`}>
            {active ? "Vote Now" : "View Results"} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </Link>
  );
}
