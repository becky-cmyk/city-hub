import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Globe, Layout, Paintbrush, ExternalLink, Sparkles, Eye,
  AlignCenter, AlignLeft, Layers, Split, Crown, Zap
} from "lucide-react";
import { TEMPLATE_STYLES } from "@/components/microsite/templates";
import type { Business } from "@shared/schema";

const TEMPLATE_PREVIEWS = [
  {
    id: "modern" as const,
    icon: AlignCenter,
    heroStyle: "bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-900 dark:to-blue-950",
    accent: "bg-blue-500",
    layout: "centered",
  },
  {
    id: "classic" as const,
    icon: AlignLeft,
    heroStyle: "bg-gradient-to-br from-amber-50 to-stone-100 dark:from-amber-950 dark:to-stone-900",
    accent: "bg-amber-600",
    layout: "left-aligned",
  },
  {
    id: "bold" as const,
    icon: Layers,
    heroStyle: "bg-gradient-to-br from-gray-900 to-black text-white",
    accent: "bg-red-500",
    layout: "overlay",
  },
  {
    id: "elegant" as const,
    icon: Split,
    heroStyle: "bg-gradient-to-br from-rose-50 to-purple-50 dark:from-rose-950 dark:to-purple-950",
    accent: "bg-rose-400",
    layout: "split",
  },
];

function TemplateCard({ templateId }: { templateId: typeof TEMPLATE_PREVIEWS[number] }) {
  const style = TEMPLATE_STYLES[templateId.id];

  return (
    <Card className="overflow-hidden" data-testid={`card-template-${templateId.id}`}>
      <div className={`${templateId.heroStyle} p-4 min-h-[120px] flex flex-col`}>
        <div className="flex items-center justify-between mb-2">
          <Badge className={`${templateId.accent} text-white text-[9px]`}>{style.name}</Badge>
          <templateId.icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {templateId.layout === "centered" && (
            <div className="text-center space-y-1">
              <div className="h-8 w-8 rounded-full bg-white/20 border border-white/30 mx-auto" />
              <div className="h-2.5 w-24 bg-foreground/20 rounded mx-auto" />
              <div className="h-1.5 w-32 bg-foreground/10 rounded mx-auto" />
            </div>
          )}
          {templateId.layout === "left-aligned" && (
            <div className="space-y-1">
              <div className="h-2.5 w-28 bg-foreground/20 rounded" />
              <div className="h-1.5 w-36 bg-foreground/10 rounded" />
              <div className="h-5 w-16 rounded bg-foreground/15 mt-1.5" />
            </div>
          )}
          {templateId.layout === "overlay" && (
            <div className="text-center space-y-1">
              <div className="h-3 w-32 bg-white/30 rounded mx-auto" style={{ fontWeight: 800 }} />
              <div className="h-1.5 w-24 bg-white/15 rounded mx-auto" />
              <div className="h-5 w-20 rounded bg-red-500/60 mx-auto mt-1.5" />
            </div>
          )}
          {templateId.layout === "split" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="h-2 w-16 bg-foreground/15 rounded" />
                <div className="h-1.5 w-20 bg-foreground/10 rounded" />
              </div>
              <div className="h-12 rounded bg-foreground/5 border border-foreground/10" />
            </div>
          )}
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <h4 className="font-semibold text-sm">{style.name}</h4>
          <p className="text-[11px] text-muted-foreground">{style.description}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[8px]">{style.heroLayout}</Badge>
          <Badge variant="outline" className="text-[8px]">{style.sectionDivider !== "none" ? style.sectionDivider + " dividers" : "clean"}</Badge>
          <Badge variant="outline" className="text-[8px]">{style.headingCase}</Badge>
        </div>
      </div>
    </Card>
  );
}

export default function SiteBuilderDemoPanel({ cityId }: { cityId?: string }) {
  const [, navigate] = useLocation();

  const { data: businesses } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses"],
  });

  const eligibleBusinesses = (businesses || []).filter(
    (b) => b.listingTier === "ENHANCED"
  );

  return (
    <div className="space-y-6" data-testid="site-builder-demo-panel">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          AI Site Builder
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Preview microsite templates and build AI-powered websites for Enhanced businesses.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Paintbrush className="h-4 w-4" />
          Microsite Templates
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPLATE_PREVIEWS.map((t) => (
            <TemplateCard key={t.id} templateId={t} />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Each template can be customized with the business's brand colors, logo, and content. AI generates all copy from the business data.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Globe className="h-4 w-4" />
          Sample Microsites
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { name: "Queen City Roasters", slug: "queen-city-roasters", tier: "ENHANCED", color: "#C45D1A", desc: "Artisanal coffee in South End" },
            { name: "NoDa Brewing Company", slug: "noda-brewing-company", tier: "ENHANCED", color: "#B8860B", desc: "Craft brewery in NoDa arts district" },
            { name: "Charlotte Arts Foundation", slug: "charlotte-arts-foundation", tier: "ENHANCED", color: "#6B21A8", desc: "Supporting local arts & culture" },
          ].map((sample) => (
            <Card key={sample.slug} className="p-3 space-y-2" data-testid={`card-sample-${sample.slug}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{sample.name}</h4>
                <Badge
                  className={`text-[9px] ${sample.tier === "ENHANCED" ? "bg-[#5B1D8F] text-white" : "bg-amber-500 text-white"}`}
                >
                  <><Crown className="h-2 w-2 mr-0.5" />Enhanced</>
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{sample.desc}</p>
              <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: sample.color + "30" }}>
                <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: sample.color }} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => navigate(`/charlotte/presence/${sample.slug}`)}
                data-testid={`button-view-sample-${sample.slug}`}
              >
                <Eye className="h-3 w-3 mr-1" />
                View Live Microsite
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {eligibleBusinesses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Layout className="h-4 w-4" />
            Build for a Business
          </h3>
          <p className="text-[11px] text-muted-foreground mb-2">
            Open the AI Site Builder for any Enhanced business to customize their microsite.
          </p>
          <div className="grid md:grid-cols-2 gap-2">
            {eligibleBusinesses.slice(0, 10).map((biz) => (
              <Card key={biz.id} className="p-2.5 flex items-center gap-2" data-testid={`card-eligible-${biz.slug}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{biz.name}</div>
                  <Badge
                    variant="outline"
                    className={`text-[8px] mt-0.5 ${biz.listingTier === "ENHANCED" ? "border-[#5B1D8F] text-[#5B1D8F]" : "border-amber-500 text-amber-600"}`}
                  >
                    {biz.listingTier}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] shrink-0"
                  onClick={() => navigate(`/charlotte/owner/${biz.slug}/site-builder`)}
                  data-testid={`button-build-${biz.slug}`}
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Site Builder
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
