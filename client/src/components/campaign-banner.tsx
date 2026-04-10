import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Megaphone, Send, Star } from "lucide-react";

function getSessionHash(): string {
  const raw = (navigator.userAgent || "") + new Date().toDateString();
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return "s" + Math.abs(h).toString(36);
}

interface CampaignQuestion {
  id: string;
  questionText: string;
  questionType: "MULTIPLE_CHOICE" | "FREE_TEXT" | "SCALE";
  optionsJson: string | null;
  sortOrder: number;
}

export function CampaignBanner({ citySlug }: { citySlug: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [responses, setResponses] = useState<Record<string, any>>({});

  useEffect(() => {
    const stored = localStorage.getItem("cch_campaign_done");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (Date.now() - data.ts < 7 * 24 * 60 * 60 * 1000) {
          setDismissed(true);
        }
      } catch {}
    }
  }, []);

  const { data } = useQuery<{ campaign: any; questions: CampaignQuestion[] } | null>({
    queryKey: ["/api/community/active-campaign", citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/community/active-campaign?citySlug=${citySlug}`);
      if (!res.ok) return null;
      const d = await res.json();
      return d;
    },
    enabled: !dismissed && !submitted,
  });

  if (dismissed || submitted || !data?.campaign || !data?.questions?.length) return null;

  const campaign = data.campaign;
  const questions = data.questions;

  const allAnswered = questions.every((q) => {
    const r = responses[q.id];
    if (q.questionType === "MULTIPLE_CHOICE") return !!r;
    if (q.questionType === "FREE_TEXT") return !!r?.trim();
    if (q.questionType === "SCALE") return r !== undefined;
    return false;
  });

  const handleSubmit = () => {
    const sessionHash = getSessionHash();
    const payload = {
      campaignId: campaign.id,
      citySlug,
      responses: questions.map((q) => ({
        questionId: q.id,
        selectedOption: q.questionType === "MULTIPLE_CHOICE" ? responses[q.id] : null,
        freeTextResponse: q.questionType === "FREE_TEXT" ? responses[q.id] : null,
        scaleValue: q.questionType === "SCALE" ? responses[q.id] : null,
      })),
      language: "en",
      sessionHash,
    };
    fetch("/api/human/campaign-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
    setSubmitted(true);
    localStorage.setItem("cch_campaign_done", JSON.stringify({ id: campaign.id, ts: Date.now() }));
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("cch_campaign_done", JSON.stringify({ id: campaign.id, ts: Date.now() }));
  };

  return (
    <section className="my-4" data-testid="section-campaign-banner">
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-base" data-testid="text-campaign-title">{campaign.title}</h3>
              <Badge variant="secondary" className="text-xs">Community Check-In</Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleDismiss} data-testid="button-dismiss-campaign">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-campaign-desc">{campaign.description}</p>
          )}

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium" data-testid={`text-question-${idx}`}>{q.questionText}</p>

                {q.questionType === "MULTIPLE_CHOICE" && q.optionsJson && (
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(q.optionsJson).map((opt: string) => (
                      <Button
                        key={opt}
                        variant={responses[q.id] === opt ? "default" : "outline"}
                        size="sm"
                        onClick={() => setResponses((p) => ({ ...p, [q.id]: opt }))}
                        data-testid={`button-option-${idx}-${opt}`}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                )}

                {q.questionType === "FREE_TEXT" && (
                  <Input
                    placeholder="Share your thoughts..."
                    maxLength={200}
                    value={responses[q.id] || ""}
                    onChange={(e) => setResponses((p) => ({ ...p, [q.id]: e.target.value }))}
                    data-testid={`input-freetext-${idx}`}
                  />
                )}

                {q.questionType === "SCALE" && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <Button
                        key={v}
                        variant={responses[q.id] === v ? "default" : "outline"}
                        size="sm"
                        className="w-9 h-9"
                        onClick={() => setResponses((p) => ({ ...p, [q.id]: v }))}
                        data-testid={`button-scale-${idx}-${v}`}
                      >
                        {v}
                      </Button>
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">
                      <Star className="h-3 w-3 inline" /> 1-5
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="gap-1"
              data-testid="button-submit-campaign"
            >
              <Send className="h-4 w-4" /> Submit
            </Button>
          </div>
        </CardContent>
      </Card>

      {submitted && (
        <div className="text-center py-3 text-sm text-primary font-medium" data-testid="text-campaign-thanks">
          Thank you for your input!
        </div>
      )}
    </section>
  );
}
