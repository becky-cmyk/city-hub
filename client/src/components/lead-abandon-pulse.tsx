import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, AlertCircle } from "lucide-react";

interface LeadAbandonPulseProps {
  citySlug: string;
  zoneId?: string;
  categoryId?: string;
  formStarted: boolean;
}

const ABANDONMENT_REASONS = [
  { key: "PRICE_UNCLEAR", label: "Price unclear" },
  { key: "NO_AVAILABILITY", label: "Not available" },
  { key: "DISTANCE", label: "Too far" },
  { key: "TRUST_CONCERN", label: "Trust concern" },
  { key: "LANGUAGE_BARRIER", label: "Language barrier" },
  { key: "FOUND_ALTERNATIVE", label: "Found alternative" },
  { key: "JUST_BROWSING", label: "Just browsing" },
  { key: "WEBSITE_CONFUSING", label: "Website confusing" },
  { key: "OTHER", label: "Other" },
] as const;

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

export default function LeadAbandonPulse({ citySlug, zoneId, categoryId, formStarted }: LeadAbandonPulseProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!formStarted) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const sessionGuard = sessionStorage.getItem("cch_abandon_shown");
    if (sessionGuard) return;

    timerRef.current = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem("cch_abandon_shown", "1");
    }, 15000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [formStarted]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleSelect = useCallback((reason: string) => {
    const sessionHash = generateSessionHash();

    fetch("/api/human/lead-abandon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ citySlug, zoneId, categoryId, abandonmentReason: reason, language: "en", sessionHash }),
    }).catch(() => {});

    setVisible(false);
  }, [citySlug, zoneId, categoryId]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none"
      data-testid="lead-abandon-container"
      style={{ animation: "slideUpAbandon 0.3s ease-out" }}
    >
      <style>{`
        @keyframes slideUpAbandon {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <Card className="pointer-events-auto w-full max-w-sm p-4 shadow-lg relative" data-testid="lead-abandon-card">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={handleDismiss}
          data-testid="button-lead-abandon-dismiss"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="space-y-3">
          <div className="flex items-center gap-2 pr-8">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-semibold" data-testid="text-lead-abandon-question">
              What stopped you?
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5" data-testid="lead-abandon-reasons">
            {ABANDONMENT_REASONS.map(({ key, label }) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => handleSelect(key)}
                data-testid={`button-abandon-${key.toLowerCase()}`}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
