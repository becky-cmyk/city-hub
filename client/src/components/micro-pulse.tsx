import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, MessageCircle } from "lucide-react";
import { trackIntelligenceEvent } from "@/lib/intelligence-tracker";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type EventContext = "listing_view" | "lead_submit" | "direction_click" | "save" | "search";

interface MicroPulseProps {
  citySlug: string;
  zoneId?: string;
  categoryId?: string;
  listingId?: string;
  eventContext: EventContext;
}

const TRIGGER_RATES: Record<EventContext, number> = {
  listing_view: 0.1,
  lead_submit: 0.2,
  direction_click: 0.15,
  save: 0.15,
  search: 0.05,
};

const DECISION_FACTORS = [
  "PRICE", "LOCATION", "TRUST", "REVIEWS", "WORD_OF_MOUTH",
  "LANGUAGE_SUPPORT", "SPEED", "AVAILABILITY", "QUALITY",
  "LOCAL_OWNERSHIP", "CONVENIENCE", "BRAND", "COMMUNITY_REPUTATION", "OTHER",
] as const;

const FACTOR_LABEL_KEYS: Record<string, TranslationKey> = {
  PRICE: "microPulse.price",
  LOCATION: "microPulse.location",
  TRUST: "microPulse.trust",
  REVIEWS: "microPulse.reviews",
  WORD_OF_MOUTH: "microPulse.wordOfMouth",
  LANGUAGE_SUPPORT: "microPulse.languageSupport",
  SPEED: "microPulse.speed",
  AVAILABILITY: "microPulse.availability",
  QUALITY: "microPulse.quality",
  LOCAL_OWNERSHIP: "microPulse.localOwnership",
  CONVENIENCE: "microPulse.convenience",
  BRAND: "microPulse.brand",
  COMMUNITY_REPUTATION: "microPulse.communityReputation",
  OTHER: "microPulse.other",
};

function generateSessionHash(): string {
  const raw = (navigator.userAgent || "") + new Date().toDateString();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export default function MicroPulse({ citySlug, zoneId, categoryId, listingId, eventContext }: MicroPulseProps) {
  const { t, locale } = useI18n();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const sessionGuard = sessionStorage.getItem("cch_pulse_session");
    if (sessionGuard) return;

    const lastShown = localStorage.getItem("cch_pulse_shown");
    if (lastShown) {
      const elapsed = Date.now() - parseInt(lastShown, 10);
      if (elapsed < 24 * 60 * 60 * 1000) return;
    }

    const rate = TRIGGER_RATES[eventContext] || 0;
    if (Math.random() > rate) return;

    const timer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem("cch_pulse_shown", Date.now().toString());
      sessionStorage.setItem("cch_pulse_session", "1");
    }, 2000);

    return () => clearTimeout(timer);
  }, [eventContext]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selected) return;

    const sessionHash = generateSessionHash();

    fetch("/api/human/micro-pulse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ citySlug, zoneId, categoryId, listingId, eventContext, decisionFactor: selected, language: locale, sessionHash }),
    }).catch(() => {});

    if (listingId) {
      trackIntelligenceEvent({
        citySlug,
        entityType: "BUSINESS",
        entityId: listingId,
        eventType: "DECISION_FACTOR",
        metadata: { factor: selected, freeText: freeText.trim() || undefined },
      });
    }

    if (freeText.trim()) {
      fetch("/api/human/micro-pulse/free-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citySlug, zoneId, listingId, shortReasonText: freeText.trim(), language: locale, sessionHash }),
      }).catch(() => {});
    }

    setSubmitted(true);
    setTimeout(() => setVisible(false), 1500);
  }, [selected, freeText, citySlug, zoneId, categoryId, listingId, eventContext, locale]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none"
      data-testid="micro-pulse-container"
      style={{ animation: "slideUp 0.3s ease-out" }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <Card className="pointer-events-auto w-full max-w-md p-4 shadow-lg relative" data-testid="micro-pulse-card">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={handleDismiss}
          data-testid="button-micro-pulse-dismiss"
        >
          <X className="h-4 w-4" />
        </Button>

        {submitted ? (
          <div className="text-center py-4" data-testid="micro-pulse-thanks">
            <MessageCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">{t("microPulse.thanks")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pr-8">
              <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="text-sm font-semibold" data-testid="text-micro-pulse-question">
                {t("microPulse.question")}
              </h3>
            </div>

            <div className="flex flex-wrap gap-1.5" data-testid="micro-pulse-factors">
              {DECISION_FACTORS.map((factor) => (
                <Button
                  key={factor}
                  variant={selected === factor ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelected(factor)}
                  data-testid={`button-factor-${factor.toLowerCase()}`}
                  className="text-xs"
                >
                  {t(FACTOR_LABEL_KEYS[factor])}
                </Button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground" data-testid="label-free-text">
                {t("microPulse.anythingElse")}
              </label>
              <Input
                value={freeText}
                onChange={(e) => setFreeText(e.target.value.slice(0, 200))}
                placeholder={t("microPulse.tellUsMore")}
                maxLength={200}
                data-testid="input-micro-pulse-freetext"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!selected}
              className="w-full"
              data-testid="button-micro-pulse-submit"
            >
              {t("microPulse.submit")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
