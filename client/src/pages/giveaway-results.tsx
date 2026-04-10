import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Gift, Users, Loader2 } from "lucide-react";
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

export default function GiveawayResults({ citySlug, slug }: { citySlug: string; slug?: string }) {
  const { data: giveaway, isLoading: gwLoading } = useQuery<{
    id: string; title: string; slug: string; description: string | null;
    heroImageUrl: string | null; status: string; entryCount: number;
    prizes: Array<{ id: string; name: string; value: string | null }>;
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
    title: giveaway ? `Results - ${giveaway.title} | CLT Metro Hub` : "Giveaway Results | CLT Metro Hub",
    description: giveaway ? `See the winners of ${giveaway.title}` : "Giveaway results",
    ogImage: giveaway?.heroImageUrl || undefined,
  });

  const isLoading = gwLoading || winnersLoading;

  if (isLoading) {
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
      {giveaway.heroImageUrl && (
        <div className="relative rounded-xl overflow-hidden mb-8 aspect-[3/1]">
          <img src={giveaway.heroImageUrl} alt={giveaway.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-results-title">{giveaway.title}</h1>
            <p className="text-neutral-300 mt-1">Drawing Results</p>
          </div>
        </div>
      )}

      {!giveaway.heroImageUrl && (
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-results-title">{giveaway.title}</h1>
          <p className="text-neutral-400 mt-1">Drawing Results</p>
        </div>
      )}

      <div className="flex gap-4 mb-8">
        <Card className="bg-[#1e1e3a] border-[#2a2a4a] flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-[#F2C230]" />
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Total Entries</p>
              <p className="text-lg font-semibold text-white" data-testid="text-total-entries">{giveaway.entryCount.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1e1e3a] border-[#2a2a4a] flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-[#F2C230]" />
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Winners</p>
              <p className="text-lg font-semibold text-white" data-testid="text-winner-count">{winners?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {winners && winners.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-white mb-4">Winners</h2>
          {winners.map((w, i) => (
            <Card key={i} className="bg-[#1e1e3a] border-[#2a2a4a]" data-testid={`card-winner-${i}`}>
              <CardContent className="p-4 flex items-start gap-4">
                {w.photoUrl ? (
                  <img src={w.photoUrl} alt={maskName(w.name, w.showFullName)} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5B1D8F] to-[#7B2FBF] flex items-center justify-center text-white font-bold shrink-0">
                    {i + 1}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold">{maskName(w.name, w.showFullName)}</p>
                    {w.claimedAt && <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Claimed</Badge>}
                  </div>
                  {w.prize && <p className="text-sm text-[#F2C230]">{w.prize}</p>}
                  {w.businessMention && <p className="text-xs text-neutral-400 mt-0.5" data-testid={`text-winner-business-${i}`}>{w.businessMention}</p>}
                  {w.quote && <p className="text-sm text-neutral-300 mt-1 italic" data-testid={`text-winner-quote-${i}`}>"{w.quote}"</p>}
                  {w.reviewText && <p className="text-sm text-neutral-400 mt-1" data-testid={`text-winner-review-${i}`}>{w.reviewText}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-[#1e1e3a] border-[#2a2a4a]">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-neutral-500" />
            <h2 className="text-xl font-bold text-white mb-2">
              {giveaway.status === "completed" || giveaway.status === "drawing" ? "Winners Coming Soon" : "Drawing Not Yet Complete"}
            </h2>
            <p className="text-neutral-400">Check back after the drawing for results.</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 text-center">
        <Link href={`/${citySlug}/enter-to-win/${giveaway.slug}`}>
          <span className="text-[#F2C230] text-sm font-medium cursor-pointer" data-testid="link-back-to-giveaway">Back to Giveaway</span>
        </Link>
      </div>
    </div>
  );
}
