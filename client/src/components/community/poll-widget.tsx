import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Check, Clock } from "lucide-react";

interface PollOption {
  id: string;
  label: string;
  imageUrl: string | null;
  voteCount: number;
}

interface PollData {
  id: string;
  question: string;
  description: string | null;
  choiceMode: string;
  expiresAt: string | null;
  isActive: boolean;
  options: PollOption[];
  userVotedOptionIds: string[] | null;
  totalVotes: number;
}

interface PollWidgetProps {
  poll?: PollData;
  pollId?: string;
  cityId?: string;
  compact?: boolean;
}

export function PollWidget({ poll: propPoll, pollId, cityId, compact }: PollWidgetProps) {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());

  const { data: fetchedPoll } = useQuery<PollData>({
    queryKey: ["/api/community/polls", pollId],
    queryFn: async () => {
      const res = await fetch(`/api/community/polls/${pollId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!pollId && !propPoll,
  });

  const poll = propPoll || fetchedPoll;
  if (!poll) return null;

  const hasVoted = poll.userVotedOptionIds && poll.userVotedOptionIds.length > 0;
  const isExpired = poll.expiresAt && new Date(poll.expiresAt) < new Date();
  const showResults = hasVoted || isExpired;
  const totalVotes = poll.options.reduce((sum, o) => sum + o.voteCount, 0);
  const isMulti = poll.choiceMode === "multi";

  const voteMutation = useMutation({
    mutationFn: async (optionIds: string[]) => {
      await apiRequest("POST", `/api/community/polls/${poll.id}/vote`, { optionIds });
    },
    onSuccess: () => {
      if (pollId) {
        queryClient.invalidateQueries({ queryKey: ["/api/community/polls", pollId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/community/polls"] });
    },
  });

  const handleOptionClick = (optId: string) => {
    if (showResults) return;
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (isMulti) {
      setSelectedOptions(prev => {
        const next = new Set(prev);
        if (next.has(optId)) next.delete(optId);
        else next.add(optId);
        return next;
      });
    } else {
      voteMutation.mutate([optId]);
    }
  };

  const handleSubmitMulti = () => {
    if (selectedOptions.size === 0) return;
    voteMutation.mutate(Array.from(selectedOptions));
  };

  const timeLeft = poll.expiresAt ? getTimeLeft(poll.expiresAt) : null;

  return (
    <>
      <Card className={`overflow-hidden ${compact ? "p-3" : "p-4"}`} data-testid={`poll-widget-${poll.id}`}>
        <div className="flex items-start gap-2 mb-3">
          <BarChart3 className="h-4 w-4 mt-0.5 text-violet-500 shrink-0" />
          <div className="min-w-0">
            <h3 className={`font-semibold leading-tight ${compact ? "text-sm" : "text-base"}`} data-testid="text-poll-question">
              {poll.question}
            </h3>
            {poll.description && !compact && (
              <p className="text-xs text-muted-foreground mt-1">{poll.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {poll.options.map(opt => {
            const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
            const isSelected = selectedOptions.has(opt.id);
            const isUserVote = poll.userVotedOptionIds?.includes(opt.id);
            const isWinner = showResults && opt.voteCount === Math.max(...poll.options.map(o => o.voteCount)) && opt.voteCount > 0;

            return (
              <button
                key={opt.id}
                onClick={() => handleOptionClick(opt.id)}
                disabled={!!showResults || voteMutation.isPending}
                className={`relative w-full text-left rounded-lg border px-3 py-2 text-sm transition-all ${
                  showResults
                    ? isUserVote
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30"
                      : "border-border"
                    : isSelected
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30"
                      : "border-border hover:border-violet-300 cursor-pointer"
                }`}
                data-testid={`poll-option-${opt.id}`}
              >
                {showResults && (
                  <div
                    className="absolute inset-0 rounded-lg bg-violet-100 dark:bg-violet-900/20 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isUserVote && <Check className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
                    <span className={`truncate ${isWinner ? "font-semibold" : ""}`}>{opt.label}</span>
                  </div>
                  {showResults && (
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{pct}%</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {isMulti && !showResults && selectedOptions.size > 0 && (
          <Button
            size="sm"
            className="w-full mt-3"
            onClick={handleSubmitMulti}
            disabled={voteMutation.isPending}
            data-testid="button-poll-submit"
          >
            {voteMutation.isPending ? "Submitting..." : "Submit Vote"}
          </Button>
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span data-testid="text-poll-votes">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</span>
          {timeLeft && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeLeft}
            </span>
          )}
          {isExpired && <span>Closed</span>}
        </div>
      </Card>

      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        title="Sign in to vote"
        description="Create an account or sign in to participate in polls."
      />
    </>
  );
}

function getTimeLeft(expiresAt: string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins}m left`;
}
