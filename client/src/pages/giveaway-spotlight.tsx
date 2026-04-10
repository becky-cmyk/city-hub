import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Gift, Star, Loader2 } from "lucide-react";
import { Link } from "wouter";

interface PublicWinner {
  name: string;
  prize: string | null;
  claimedAt: string | null;
  quote?: string | null;
  photoUrl?: string | null;
  reviewText?: string | null;
  businessMention?: string | null;
  showFullName?: boolean;
}

function maskName(name: string, showFull?: boolean): string {
  if (showFull) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export default function GiveawaySpotlight({ citySlug, slug }: { citySlug: string; slug?: string }) {
  const { data: giveaway, isLoading: gwLoading } = useQuery<{
    id: string; title: string; slug: string; description: string | null;
    heroImageUrl: string | null; status: string;
    prizes: Array<{ id: string; name: string; description: string | null; imageUrl: string | null; value: string | null }>;
    sponsors: Array<{ id: string; name: string; logoUrl: string | null; websiteUrl: string | null }>;
  }>({
    queryKey: ["/api/giveaways", slug],
    queryFn: async () => {
      const res = await fetch(`/api/giveaways/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: winners, isLoading: winnersLoading } = useQuery<PublicWinner[]>({
    queryKey: ["/api/giveaways", slug, "winners"],
    queryFn: async () => {
      const res = await fetch(`/api/giveaways/${slug}/winners`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!slug,
  });

  usePageMeta({
    title: giveaway ? `Winner Spotlight - ${giveaway.title} | CLT Metro Hub` : "Winner Spotlight | CLT Metro Hub",
    description: giveaway ? `Celebrating the winners of ${giveaway.title}` : "Winner spotlight",
    ogImage: giveaway?.heroImageUrl || undefined,
  });

  if (gwLoading || winnersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F2C230]" />
      </div>
    );
  }

  if (!giveaway) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Gift className="h-16 w-16 mx-auto mb-4 text-neutral-400" />
        <h1 className="text-2xl font-bold text-white mb-2">Giveaway Not Found</h1>
        <p className="text-neutral-400">This giveaway may have been removed.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#F2C230] to-[#e5a820] mb-4">
          <Trophy className="h-10 w-10 text-[#1a1a2e]" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" data-testid="text-spotlight-title">Winner Spotlight</h1>
        <p className="text-lg text-neutral-300">{giveaway.title}</p>
      </div>

      {winners && winners.length > 0 ? (
        <div className="space-y-6 mb-10">
          {winners.map((w, i) => (
            <Card key={i} className="bg-gradient-to-r from-[#1e1e3a] to-[#252550] border-[#2a2a4a] overflow-hidden" data-testid={`card-spotlight-winner-${i}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  {w.photoUrl ? (
                    <img src={w.photoUrl} alt={maskName(w.name, w.showFullName)} className="w-16 h-16 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F2C230] to-[#e5a820] flex items-center justify-center shrink-0">
                      <span className="text-2xl font-bold text-[#1a1a2e]">{i + 1}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">{maskName(w.name, w.showFullName)}</h3>
                    {w.prize && (
                      <div className="flex items-center gap-2 mt-1">
                        <Star className="h-4 w-4 text-[#F2C230]" />
                        <span className="text-[#F2C230] font-medium">{w.prize}</span>
                      </div>
                    )}
                    {w.businessMention && <p className="text-sm text-neutral-400 mt-1" data-testid={`text-spotlight-business-${i}`}>{w.businessMention}</p>}
                  </div>
                  {w.claimedAt && <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Claimed</Badge>}
                </div>
                {w.quote && (
                  <blockquote className="mt-4 border-l-2 border-[#F2C230]/40 pl-4 text-neutral-300 italic" data-testid={`text-spotlight-quote-${i}`}>
                    "{w.quote}"
                  </blockquote>
                )}
                {w.reviewText && (
                  <p className="mt-3 text-sm text-neutral-400" data-testid={`text-spotlight-review-${i}`}>{w.reviewText}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-[#1e1e3a] border-[#2a2a4a] mb-10">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-neutral-500" />
            <p className="text-neutral-400">Winners will be spotlighted here after the drawing.</p>
          </CardContent>
        </Card>
      )}

      {giveaway.prizes.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Prizes Awarded</h2>
          <div className="grid gap-4">
            {giveaway.prizes.map(prize => (
              <Card key={prize.id} className="bg-[#1e1e3a] border-[#2a2a4a] overflow-hidden" data-testid={`card-spotlight-prize-${prize.id}`}>
                <CardContent className="p-0">
                  <div className="flex">
                    {prize.imageUrl && (
                      <div className="w-24 h-24 shrink-0">
                        <img src={prize.imageUrl} alt={prize.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 flex-1">
                      <h3 className="text-white font-semibold">{prize.name}</h3>
                      {prize.description && <p className="text-neutral-400 text-sm mt-1">{prize.description}</p>}
                      {prize.value && <p className="text-[#F2C230] text-sm font-semibold mt-1">Value: ${Number(prize.value).toLocaleString()}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {giveaway.sponsors.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Made Possible By</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {giveaway.sponsors.map(s => (
              <a
                key={s.id}
                href={s.websiteUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg px-4 py-3 hover:border-[#F2C230]/40 transition-colors"
                data-testid={`link-spotlight-sponsor-${s.id}`}
              >
                {s.logoUrl && <img src={s.logoUrl} alt={s.name} className="h-8 w-8 rounded object-contain" />}
                <span className="text-white text-sm font-medium">{s.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="text-center space-x-4">
        <Link href={`/${citySlug}/enter-to-win/${giveaway.slug}/results`}>
          <span className="text-neutral-400 text-sm font-medium cursor-pointer" data-testid="link-to-results">View Full Results</span>
        </Link>
        <Link href={`/${citySlug}/enter-to-win/${giveaway.slug}`}>
          <span className="text-[#F2C230] text-sm font-medium cursor-pointer" data-testid="link-back-to-giveaway">Back to Giveaway</span>
        </Link>
      </div>
    </div>
  );
}
