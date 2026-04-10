import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Vote, Trophy, Check, ArrowLeft, Calendar } from "lucide-react";

interface Nominee {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  voteCount: number;
}

interface VotingCategory {
  id: string;
  name: string;
  description: string | null;
  nominees: Nominee[];
  userBallotNomineeId: string | null;
}

interface CampaignDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl: string | null;
  categories: VotingCategory[];
}

export default function VotingCampaign({ citySlug }: { citySlug: string }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAuth, setShowAuth] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: campaign, isLoading } = useQuery<CampaignDetail>({
    queryKey: ["/api/community/voting-campaigns", slug],
    queryFn: async () => {
      const res = await fetch(`/api/community/voting-campaigns/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  usePageMeta({
    title: campaign ? `${campaign.title} | Vote` : "Voting Campaign",
    description: campaign?.description || "Cast your vote in this community campaign",
  });

  const voteMutation = useMutation({
    mutationFn: async ({ categoryId, nomineeId }: { categoryId: string; nomineeId: string }) => {
      await apiRequest("POST", `/api/community/voting-campaigns/${campaign!.id}/vote`, { categoryId, nomineeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/voting-campaigns", slug] });
      toast({ title: "Vote recorded", description: "Your vote has been submitted." });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("Already voted")) {
        toast({ title: "Already voted", description: "You have already voted in this category." });
      } else {
        toast({ title: "Error", description: "Could not submit vote. Please try again." });
      }
    },
  });

  const handleVote = (categoryId: string, nomineeId: string) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    voteMutation.mutate({ categoryId, nomineeId });
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 text-center">
        <Vote className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Campaign not found</h2>
        <p className="text-sm text-muted-foreground mb-4">This voting campaign may have been removed.</p>
        <Link href={`/${citySlug}/vote`}>
          <Button variant="outline" className="gap-2" data-testid="link-back-voting">
            <ArrowLeft className="h-4 w-4" /> All Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const isActive = campaign.status === "active";
  const now = new Date();
  const hasStarted = !campaign.startsAt || new Date(campaign.startsAt) <= now;
  const hasEnded = campaign.endsAt ? new Date(campaign.endsAt) < now : false;
  const canVote = isActive && hasStarted && !hasEnded;
  const showResults = !canVote || hasEnded;
  const totalCategories = campaign.categories.length;
  const votedCategories = campaign.categories.filter(c => c.userBallotNomineeId).length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <Link href={`/${citySlug}/vote`}>
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-4" data-testid="link-back-voting">
          <ArrowLeft className="h-3.5 w-3.5" /> All Campaigns
        </Button>
      </Link>

      <div className="mb-6">
        {campaign.imageUrl && (
          <div className="aspect-[3/1] rounded-xl overflow-hidden bg-muted mb-4">
            <img src={campaign.imageUrl} alt={campaign.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold mb-1" data-testid="text-campaign-title">{campaign.title}</h1>
            {campaign.description && (
              <p className="text-muted-foreground text-sm">{campaign.description}</p>
            )}
          </div>
          <Badge variant="outline" className={`shrink-0 ${canVote ? "border-green-300 text-green-600" : ""}`}>
            {canVote ? "Active" : hasEnded ? "Ended" : campaign.status}
          </Badge>
        </div>

        {campaign.endsAt && canVote && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Calendar className="h-3 w-3" />
            Voting ends {new Date(campaign.endsAt).toLocaleDateString()}
          </div>
        )}

        {user && canVote && totalCategories > 0 && (
          <div className="mt-3 text-sm text-muted-foreground">
            Voted in {votedCategories} of {totalCategories} categories
          </div>
        )}
      </div>

      <div className="space-y-6">
        {campaign.categories.map(cat => {
          const isExpanded = expandedCategory === cat.id || campaign.categories.length <= 3;
          const userVoted = !!cat.userBallotNomineeId;
          const sortedNominees = showResults
            ? [...cat.nominees].sort((a, b) => b.voteCount - a.voteCount)
            : cat.nominees;
          const totalVotesInCat = cat.nominees.reduce((s, n) => s + n.voteCount, 0);
          const winner = showResults && sortedNominees.length > 0 ? sortedNominees[0] : null;

          return (
            <Card key={cat.id} className="overflow-hidden" data-testid={`voting-category-${cat.id}`}>
              <button
                className="w-full text-left p-4 flex items-center justify-between gap-2"
                onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                data-testid={`toggle-category-${cat.id}`}
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{cat.name}</h3>
                  {cat.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {userVoted && (
                    <Badge variant="outline" className="text-[10px] border-green-300 text-green-600 gap-1">
                      <Check className="h-3 w-3" /> Voted
                    </Badge>
                  )}
                  {showResults && winner && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Trophy className="h-3 w-3 text-amber-500" /> {winner.name}
                    </Badge>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {sortedNominees.map((nominee, ni) => {
                    const isUserVote = cat.userBallotNomineeId === nominee.id;
                    const pct = totalVotesInCat > 0 ? Math.round((nominee.voteCount / totalVotesInCat) * 100) : 0;
                    const isTopNominee = showResults && ni === 0 && nominee.voteCount > 0;

                    return (
                      <div
                        key={nominee.id}
                        className={`relative rounded-lg border p-3 transition-all ${
                          isUserVote
                            ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30"
                            : isTopNominee
                              ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                              : "border-border"
                        }`}
                        data-testid={`nominee-${nominee.id}`}
                      >
                        {showResults && (
                          <div
                            className="absolute inset-0 rounded-lg bg-violet-100 dark:bg-violet-900/10 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        )}
                        <div className="relative flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {nominee.imageUrl && (
                              <img
                                src={nominee.imageUrl}
                                alt={nominee.name}
                                className="h-10 w-10 rounded-lg object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {isTopNominee && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                <span className={`text-sm truncate ${isTopNominee ? "font-semibold" : ""}`}>{nominee.name}</span>
                              </div>
                              {nominee.description && (
                                <p className="text-xs text-muted-foreground truncate">{nominee.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {showResults && (
                              <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                            )}
                            {canVote && !userVoted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleVote(cat.id, nominee.id)}
                                disabled={voteMutation.isPending}
                                className="text-xs"
                                data-testid={`button-vote-${nominee.id}`}
                              >
                                Vote
                              </Button>
                            )}
                            {isUserVote && (
                              <Check className="h-4 w-4 text-violet-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {showResults && (
                    <p className="text-xs text-muted-foreground mt-1">{totalVotesInCat} total votes</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        title="Sign in to vote"
        description="Create an account or sign in to cast your vote."
      />
    </div>
  );
}
