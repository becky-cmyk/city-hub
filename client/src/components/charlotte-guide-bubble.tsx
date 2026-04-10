import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, X, Coffee, Calendar, UtensilsCrossed, Music, Landmark, Send, PenLine } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCity } from "@/hooks/use-city";

const STORAGE_KEY = "cch_guide_state";
const REAPPEAR_DELAY = 120000;
const INTRO_DELAY = 3000;
const DEFAULT_STATE: GuideState = { dismissed: false, dismissedAt: null, introIndex: 0 };

interface GuideState {
  dismissed: boolean;
  dismissedAt: number | null;
  introIndex: number;
}

function getStoredState(): GuideState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_STATE;
}

function saveState(state: GuideState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function CharlotteGuideBubble({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();
  const { data: city } = useCity(citySlug);
  const [, navigate] = useLocation();
  const guideName = city?.aiGuideName || "Charlotte";

  const [state, setState] = useState<GuideState>(DEFAULT_STATE);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const stored = getStoredState();
    setState(stored);

    if (stored.dismissed && stored.dismissedAt) {
      const elapsed = Date.now() - stored.dismissedAt;
      if (elapsed >= REAPPEAR_DELAY) {
        const nextIndex = (stored.introIndex + 1) % 3;
        const newState = { dismissed: false, dismissedAt: null, introIndex: nextIndex };
        setState(newState);
        saveState(newState);
      } else {
        const remaining = REAPPEAR_DELAY - elapsed;
        const timer = setTimeout(() => {
          const nextIndex = (stored.introIndex + 1) % 3;
          const newState = { dismissed: false, dismissedAt: null, introIndex: nextIndex };
          setState(newState);
          saveState(newState);
        }, remaining);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    if (state.dismissed) return;

    const timer = setTimeout(() => {
      setVisible(true);
      setTimeout(() => setAnimateIn(true), 50);
    }, INTRO_DELAY);

    return () => clearTimeout(timer);
  }, [state.dismissed]);

  const dismiss = useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => {
      setVisible(false);
      setExpanded(false);
      const newState = { ...state, dismissed: true, dismissedAt: Date.now() };
      setState(newState);
      saveState(newState);
    }, 300);
  }, [state]);

  const handleChipClick = useCallback((path: string) => {
    dismiss();
    navigate(path);
  }, [dismiss, navigate]);

  if (!visible) return null;

  const introKey = `guide.intro${state.introIndex + 1}` as "guide.intro1" | "guide.intro2" | "guide.intro3";
  const introText = t(introKey, { name: guideName });

  const chips = [
    { label: t("guide.coffee"), icon: Coffee, path: `/${citySlug}/directory?category=coffee-tea`, color: "hsl(var(--brand-gold))" },
    { label: t("guide.weekend"), icon: Calendar, path: `/${citySlug}/events?filter=weekend`, color: "hsl(var(--brand-coral))" },
    { label: t("guide.restaurants"), icon: UtensilsCrossed, path: `/${citySlug}/directory?category=casual-dining`, color: "hsl(var(--brand-teal))" },
    { label: t("guide.music"), icon: Music, path: `/${citySlug}/directory?category=music-nightlife`, color: "hsl(var(--brand-sky))" },
    { label: t("guide.kidsEatFree"), icon: UtensilsCrossed, path: `/${citySlug}/directory?kidsEatFree=true`, color: "hsl(var(--brand-coral))" },
    { label: t("guide.attractions"), icon: Landmark, path: `/${citySlug}/attractions`, color: "hsl(var(--brand-sand))" },
  ];

  const contributeChips = [
    { label: t("guide.nominateBiz"), icon: Send, path: `/${citySlug}/activate` },
    { label: t("guide.suggestEvent"), icon: Calendar, path: `/${citySlug}/submit/event` },
    { label: t("guide.pitchArticle"), icon: PenLine, path: `/${citySlug}/submit/article` },
  ];

  return (
    <div
      className={`fixed top-[72px] right-4 z-40 md:top-[72px] md:right-6 transition-all duration-300 ${animateIn ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
      data-testid="charlotte-guide-bubble"
    >
      {expanded ? (
        <Card className="w-[320px] max-h-[70vh] overflow-y-auto shadow-xl border-2" style={{ borderColor: "hsl(273 66% 34% / 0.3)" }}>
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full shrink-0" style={{ background: "hsl(273 66% 34%)" }}>
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-sm">{guideName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={dismiss} data-testid="button-guide-close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{introText}</p>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("guide.discoverLabel")}</p>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <Button
                    key={chip.path}
                    variant="outline"
                    size="sm"
                    onClick={() => handleChipClick(chip.path)}
                    className="rounded-full gap-1.5 text-xs"
                    data-testid={`guide-chip-${chip.label.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <chip.icon className="h-3 w-3 shrink-0" style={{ color: chip.color }} />
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("guide.contributeLabel")}</p>
              <div className="flex flex-wrap gap-1.5">
                {contributeChips.map((chip) => (
                  <Button
                    key={chip.path}
                    variant="outline"
                    size="sm"
                    onClick={() => handleChipClick(chip.path)}
                    className="rounded-full gap-1.5 text-xs border-dashed"
                    data-testid={`guide-chip-${chip.label.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <chip.icon className="h-3 w-3 shrink-0" style={{ color: "hsl(var(--brand-primary))" }} />
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={dismiss}
              className="w-full text-xs text-muted-foreground"
              data-testid="button-guide-dismiss"
            >
              {t("guide.dismiss")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex items-end gap-3">
          <Card
            className="px-3 py-2 shadow-lg cursor-pointer max-w-[220px]"
            onClick={() => setExpanded(true)}
            data-testid="guide-intro-card"
          >
            <p className="text-xs text-muted-foreground leading-relaxed">{introText}</p>
          </Card>
          <Button
            size="icon"
            onClick={() => setExpanded(true)}
            className="rounded-full shadow-lg shrink-0"
            style={{ background: "hsl(273 66% 34%)" }}
            data-testid="button-guide-open"
          >
            <Sparkles className="h-5 w-5 text-white" />
          </Button>
        </div>
      )}
    </div>
  );
}
