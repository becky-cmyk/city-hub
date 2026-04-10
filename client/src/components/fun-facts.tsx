import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import type { Attraction } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

export function FunFactsBanner({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();
  const { data: facts } = useQuery<Attraction[]>({
    queryKey: ["/api/cities", citySlug, "fun-facts", "?limit=1"],
    staleTime: 60000,
  });

  const fact = facts?.[0];
  if (!fact?.funFact) return null;

  return (
    <div className="my-4 p-4 rounded-lg border border-primary/15 bg-primary/5" data-testid="fun-fact-banner">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 p-1.5 rounded-full bg-primary/10">
          <Sparkles className="h-4 w-4" style={{ color: "hsl(var(--brand-primary))" }} />
        </div>
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "hsl(var(--brand-primary))" }}>
            {t("attractions.funFact")} — {fact.name}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">{fact.funFact}</p>
        </div>
      </div>
    </div>
  );
}
