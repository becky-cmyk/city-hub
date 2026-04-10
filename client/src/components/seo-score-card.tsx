import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export interface SeoScoreInput {
  title?: string;
  metaDescription?: string;
  content?: string;
  slug?: string;
  cityKeyword?: string;
  categoryKeyword?: string;
  imageAltText?: string;
}

interface SeoCheck {
  label: string;
  status: "green" | "yellow" | "red";
  tip: string;
}

export function evaluateSeoChecks(input: SeoScoreInput): SeoCheck[] {
  const checks: SeoCheck[] = [];

  const titleLen = (input.title || "").length;
  checks.push({
    label: `Title length (${titleLen})`,
    status: titleLen >= 50 && titleLen <= 60 ? "green" : titleLen >= 40 && titleLen <= 70 ? "yellow" : "red",
    tip: "50\u201360 chars ideal",
  });

  const descLen = (input.metaDescription || "").length;
  checks.push({
    label: `Meta description (${descLen})`,
    status: descLen >= 120 && descLen <= 160 ? "green" : descLen >= 80 && descLen <= 200 ? "yellow" : "red",
    tip: "120\u2013160 chars ideal",
  });

  const titleLower = (input.title || "").toLowerCase();
  const cityLower = (input.cityKeyword || "").toLowerCase().trim();
  checks.push({
    label: "City keyword in title",
    status: cityLower && titleLower.includes(cityLower) ? "green" : !cityLower ? "yellow" : "red",
    tip: cityLower ? `Include "${input.cityKeyword}" in title` : "Set a city keyword",
  });

  const contentLower = (input.content || "").toLowerCase();
  const catLower = (input.categoryKeyword || "").toLowerCase().trim();
  checks.push({
    label: "Category keyword in content",
    status: catLower && contentLower.includes(catLower) ? "green" : !catLower ? "yellow" : "red",
    tip: catLower ? `Include "${input.categoryKeyword}" in content` : "Set a category keyword",
  });

  const wordCount = input.content ? input.content.split(/\s+/).filter(Boolean).length : 0;
  checks.push({
    label: `Content length (${wordCount} words)`,
    status: wordCount >= 300 ? "green" : wordCount >= 100 ? "yellow" : "red",
    tip: "300+ words recommended",
  });

  const hasH2 = /#{2}\s|<h2[\s>]/i.test(input.content || "");
  checks.push({
    label: "Has H2 subheading",
    status: hasH2 ? "green" : "yellow",
    tip: "Add at least one ## or <h2> subheading",
  });

  const slug = input.slug || "";
  const slugClean = slug.length > 0 && !/[A-Z]/.test(slug) && !/#/.test(slug) && !/[a-f0-9]{6,8}$/.test(slug);
  checks.push({
    label: "Slug is clean",
    status: slug.length === 0 ? "red" : slugClean ? "green" : "yellow",
    tip: "No hash suffixes, lowercase, includes keywords",
  });

  const hasAlt = (input.imageAltText || "").trim().length > 0;
  checks.push({
    label: "Image alt text",
    status: hasAlt ? "green" : "yellow",
    tip: "Add descriptive alt text for images",
  });

  return checks;
}

export function SeoScoreCard({ input }: { input: SeoScoreInput }) {
  const checks = evaluateSeoChecks(input);
  const greens = checks.filter((c) => c.status === "green").length;
  const reds = checks.filter((c) => c.status === "red").length;

  const overall = reds === 0 && greens === checks.length ? "green" : reds === 0 ? "yellow" : "red";
  const overallColor = overall === "green" ? "bg-green-500" : overall === "yellow" ? "bg-yellow-500" : "bg-red-500";
  const overallLabel = overall === "green" ? "Good" : overall === "yellow" ? "Needs Work" : "Poor";

  return (
    <Card className="p-4 space-y-3" data-testid="seo-score-card">
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full shrink-0 ${overallColor}`} data-testid="seo-score-indicator" />
        <span className="font-medium text-sm" data-testid="seo-score-summary">
          SEO: {greens}/{checks.length} passed
        </span>
        <Badge variant="secondary" className="ml-auto" data-testid="seo-score-label">
          {overallLabel}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {checks.map((c, i) => {
          const Icon = c.status === "green" ? CheckCircle : c.status === "yellow" ? AlertTriangle : XCircle;
          const iconColor = c.status === "green" ? "text-green-500" : c.status === "yellow" ? "text-yellow-500" : "text-red-500";
          return (
            <div key={i} className="flex items-center gap-2 text-xs" data-testid={`seo-check-item-${i}`}>
              <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
              <span className={c.status === "green" ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              <span className="text-muted-foreground/60 ml-auto hidden sm:inline">{c.tip}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
