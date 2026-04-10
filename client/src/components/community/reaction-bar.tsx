import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { ThumbsUp, Heart, Lightbulb, Laugh, HandHelping } from "lucide-react";

const REACTION_CONFIG: Record<string, { icon: typeof ThumbsUp; label: string; activeColor: string }> = {
  like: { icon: ThumbsUp, label: "Like", activeColor: "text-blue-400" },
  love: { icon: Heart, label: "Love", activeColor: "text-red-400" },
  insightful: { icon: Lightbulb, label: "Insightful", activeColor: "text-yellow-400" },
  funny: { icon: Laugh, label: "Funny", activeColor: "text-orange-400" },
  helpful: { icon: HandHelping, label: "Helpful", activeColor: "text-green-400" },
};

interface ReactionBarProps {
  entityType: "article" | "event" | "pulse_post" | "business";
  entityId: string;
  cityId?: string;
}

interface ReactionData {
  counts: Record<string, number>;
  userReaction: string | null;
  totalReactions: number;
}

export function ReactionBar({ entityType, entityId, cityId }: ReactionBarProps) {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [optimisticReaction, setOptimisticReaction] = useState<string | null | undefined>(undefined);
  const [optimisticCounts, setOptimisticCounts] = useState<Record<string, number> | null>(null);

  const { data } = useQuery<ReactionData>({
    queryKey: ["/api/community/reactions", { entityType, entityId }],
    queryFn: async () => {
      const res = await fetch(`/api/community/reactions?entityType=${entityType}&entityId=${entityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reactions");
      return res.json();
    },
    enabled: !!entityId,
  });

  const toggleMutation = useMutation({
    mutationFn: async (reactionType: string) => {
      const res = await apiRequest("POST", "/api/community/reactions/toggle", {
        entityType,
        entityId,
        reactionType,
        cityId: cityId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setOptimisticReaction(undefined);
      setOptimisticCounts(null);
      queryClient.invalidateQueries({ queryKey: ["/api/community/reactions", { entityType, entityId }] });
    },
    onError: () => {
      setOptimisticReaction(undefined);
      setOptimisticCounts(null);
    },
  });

  const handleReaction = useCallback((reactionType: string) => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    const currentReaction = optimisticReaction !== undefined ? optimisticReaction : data?.userReaction;
    const currentCounts = optimisticCounts || data?.counts || {};

    const newCounts = { ...currentCounts };
    if (currentReaction === reactionType) {
      newCounts[reactionType] = Math.max(0, (newCounts[reactionType] || 0) - 1);
      setOptimisticReaction(null);
    } else {
      if (currentReaction) {
        newCounts[currentReaction] = Math.max(0, (newCounts[currentReaction] || 0) - 1);
      }
      newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
      setOptimisticReaction(reactionType);
    }
    setOptimisticCounts(newCounts);

    toggleMutation.mutate(reactionType);
  }, [user, data, optimisticReaction, optimisticCounts, toggleMutation]);

  const counts = optimisticCounts || data?.counts || {};
  const activeReaction = optimisticReaction !== undefined ? optimisticReaction : data?.userReaction;

  return (
    <>
      <div className="flex items-center gap-1 flex-wrap" data-testid="reaction-bar">
        {Object.entries(REACTION_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const count = counts[key] || 0;
          const isActive = activeReaction === key;

          return (
            <button
              key={key}
              onClick={() => handleReaction(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                isActive
                  ? `${config.activeColor} border-current bg-current/10`
                  : "text-muted-foreground border-white/10 hover:border-white/25 hover:text-white/80"
              }`}
              data-testid={`button-reaction-${key}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {count > 0 && <span data-testid={`text-reaction-count-${key}`}>{count}</span>}
            </button>
          );
        })}
      </div>
      <AuthDialog open={showAuth} onOpenChange={setShowAuth} defaultTab="register" />
    </>
  );
}
