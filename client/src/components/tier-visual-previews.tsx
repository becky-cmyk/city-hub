import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Check, Star, Globe, Crown, Zap, Users, Play,
  MapPin, Phone, ChevronDown, ChevronUp, Loader2, Sparkles,
  Languages, Search, Layout, Camera, Share2, Shield, Image
} from "lucide-react";
import { SiFacebook, SiInstagram, SiLinkedin, SiYoutube, SiTiktok } from "react-icons/si";
import { useState } from "react";

interface TierVisualPreviewsProps {
  businessName?: string;
  selectedTier?: "ENHANCED" | "";
  currentTier?: string;
  onSelect?: (tier: "ENHANCED") => void;
  onCheckout?: (tier: "ENHANCED") => void;
  checkoutLoading?: string | null;
  mode?: "select" | "checkout";
  showVerified?: boolean;
}

const VERIFIED_BENEFITS = [
  { icon: Star, text: "Verified badge on your listing" },
  { icon: Search, text: "Searchable in the hub directory" },
  { icon: MapPin, text: "Address & contact info displayed" },
  { icon: Camera, text: "1 photo upload" },
];

const ENHANCED_ALL_FEATURES = [
  { icon: Layout, text: "Full premium microsite built by AI" },
  { icon: Globe, text: "Custom domain INCLUDED (no extra fee)" },
  { icon: Image, text: "Up to 50 gallery photos + video embed" },
  { icon: Languages, text: "Bilingual EN/ES auto-translated pages" },
  { icon: Search, text: "Maximum SEO boost & priority placement" },
  { icon: Share2, text: "Unlimited social media links" },
  { icon: Users, text: "Team section & Expert Q&A" },
  { icon: Crown, text: "Custom theme colors & branding" },
  { icon: Shield, text: "Featured eligibility in directory" },
  { icon: MapPin, text: "Multi-zone coverage" },
  { icon: Star, text: "Customer reviews section" },
  { icon: Sparkles, text: "Higher visibility boost in feed rotation" },
  { icon: Camera, text: "Priority customer support" },
];

function VerifiedPreview({ businessName }: { businessName: string }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden shadow-sm" data-testid="preview-verified">
      <div className="bg-muted/40 px-3 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <img
            src="/images/seed/coffee-shop.png"
            alt=""
            className="h-10 w-10 rounded-md object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{businessName}</div>
            <div className="text-[10px] text-muted-foreground">Charlotte, NC</div>
          </div>
          <Badge variant="secondary" className="text-[9px] gap-0.5 shrink-0 px-1.5 py-0.5">
            <Star className="h-2 w-2" /> Verified
          </Badge>
        </div>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" /> (704) 555-0123
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /> 123 Main St, Charlotte NC
        </div>
        <div className="relative h-20 rounded overflow-hidden">
          <img
            src="/images/seed/south-end.png"
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
            <span className="text-[9px] text-muted-foreground font-medium bg-background/80 px-2 py-0.5 rounded">1 photo — no website</span>
          </div>
        </div>
        <div className="text-center pt-0.5">
          <span className="text-[9px] text-muted-foreground/60 italic">Basic directory card only</span>
        </div>
      </div>
    </div>
  );
}

function EnhancedPreview({ businessName }: { businessName: string }) {
  const galleryImages = [
    "/images/seed/arts-foundation.jpg",
    "/images/seed/noda-art.png",
    "/images/seed/art-walk.png",
    "/images/seed/south-end.png",
    "/images/seed/coffee-shop.png",
    "/images/seed/brewery.png",
  ];

  return (
    <div className="rounded-lg border border-[#5B1D8F]/50 overflow-hidden shadow-sm" data-testid="preview-enhanced">
      <div className="relative overflow-hidden">
        <img
          src="/images/seed/arts-foundation.jpg"
          alt=""
          className="w-full h-28 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#5B1D8F]/90 via-[#5B1D8F]/50 to-transparent" />
        <Badge className="absolute top-1.5 right-1.5 bg-white/20 text-white text-[8px] gap-0.5 px-1.5 py-0 backdrop-blur-sm">
          <Zap className="h-2 w-2" /> Premium
        </Badge>
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 text-center text-white">
          <div className="h-10 w-10 rounded-full mx-auto mb-1 overflow-hidden ring-2 ring-white/40 ring-offset-1 ring-offset-[#5B1D8F]/50">
            <img src="/images/seed/noda-art.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="font-bold text-sm drop-shadow-md">{businessName}</div>
          <div className="text-[9px] text-white/80 italic">"Your custom tagline here"</div>
          <div className="mt-1 flex items-center justify-center gap-1 bg-white/15 rounded-full px-2 py-0.5 w-fit mx-auto backdrop-blur-sm">
            <Play className="h-2 w-2 fill-white" />
            <span className="text-[8px]">Video tour</span>
          </div>
        </div>
      </div>

      <div className="bg-card">
        <div className="flex gap-0.5 px-2 py-1.5 overflow-hidden border-b">
          {["About", "Services", "Gallery", "Team", "FAQ", "Events"].map((pill, i) => (
            <div key={pill} className={`text-[7px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${i === 0 ? "bg-[#5B1D8F] text-white" : "bg-muted/50 text-muted-foreground"}`}>
              {pill}
            </div>
          ))}
        </div>

        <div className="px-3 py-2 space-y-2">
          <div className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
            A premier Charlotte business with a fully customized premium microsite, built by AI and tailored to your brand...
          </div>

          <div className="grid grid-cols-3 gap-0.5">
            {galleryImages.map((src, i) => (
              <div key={src} className="aspect-square rounded-sm overflow-hidden">
                <img src={src} alt="" className={`w-full h-full object-cover ${i >= 4 ? "opacity-70" : ""}`} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <div className="h-3.5 w-3.5 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
                <SiFacebook className="h-1.5 w-1.5 text-[#1877F2]" />
              </div>
              <div className="h-3.5 w-3.5 rounded-full bg-[#E4405F]/10 flex items-center justify-center">
                <SiInstagram className="h-1.5 w-1.5 text-[#E4405F]" />
              </div>
              <div className="h-3.5 w-3.5 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                <SiLinkedin className="h-1.5 w-1.5 text-[#0A66C2]" />
              </div>
              <div className="h-3.5 w-3.5 rounded-full bg-[#FF0000]/10 flex items-center justify-center">
                <SiYoutube className="h-1.5 w-1.5 text-[#FF0000]" />
              </div>
              <div className="h-3.5 w-3.5 rounded-full bg-foreground/5 flex items-center justify-center">
                <SiTiktok className="h-1.5 w-1.5 text-foreground/60" />
              </div>
              <div className="h-3.5 w-3.5 rounded-full bg-foreground/5 flex items-center justify-center">
                <Globe className="h-1.5 w-1.5 text-foreground/40" />
              </div>
            </div>
            <div className="flex -space-x-1">
              {["/images/seed/coffee-shop.png", "/images/seed/brewery.png", "/images/seed/coworking.png"].map((src) => (
                <div key={src} className="h-5 w-5 rounded-full overflow-hidden border-2 border-card">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              <div className="h-5 w-5 rounded-full bg-[#5B1D8F]/10 border-2 border-card flex items-center justify-center">
                <span className="text-[6px] text-[#5B1D8F] font-bold">+5</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TierVisualPreviews({
  businessName = "",
  selectedTier = "",
  currentTier,
  onSelect,
  onCheckout,
  checkoutLoading,
  mode = "select",
  showVerified = true,
}: TierVisualPreviewsProps) {
  const [expandedFeatures, setExpandedFeatures] = useState<string | null>(null);
  const name = businessName || "Your Business";

  const isCurrentTier = (tier: string) => currentTier === tier;

  return (
    <div className={`grid gap-5 ${showVerified ? "md:grid-cols-2" : "md:grid-cols-1 max-w-lg mx-auto"}`} data-testid="tier-visual-previews">
      {showVerified && (
        <Card
          className={`p-4 flex flex-col ${isCurrentTier("VERIFIED") ? "border-primary/40 ring-1 ring-primary/20" : ""}`}
          data-testid="card-tier-verified"
        >
          <div className="flex-1 space-y-3">
            {isCurrentTier("VERIFIED") && (
              <Badge variant="outline" className="text-[10px]">Current Plan</Badge>
            )}
            <VerifiedPreview businessName={name} />
            <div className="pt-2">
              <h3 className="font-bold text-base">Verified</h3>
              <div className="mt-1">
                <span className="text-2xl font-bold">$1</span>
                <span className="text-xs text-muted-foreground ml-1">one-time</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              {VERIFIED_BENEFITS.map(b => (
                <div key={b.text} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <b.icon className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card
        className={`p-4 flex flex-col relative cursor-pointer transition-all ${
          selectedTier === "ENHANCED"
            ? "border-[#5B1D8F] ring-2 ring-[#5B1D8F]/30 shadow-lg shadow-[#5B1D8F]/5"
            : isCurrentTier("ENHANCED")
            ? "border-[#5B1D8F]/40 ring-1 ring-[#5B1D8F]/20"
            : "hover:border-[#5B1D8F]/30"
        }`}
        onClick={() => onSelect?.("ENHANCED")}
        data-testid="card-tier-enhanced"
      >
        <Badge
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#5B1D8F] text-white text-[10px] no-default-hover-elevate no-default-active-elevate"
        >
          <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Most Popular
        </Badge>
        <div className="flex-1 space-y-3 pt-2">
          {isCurrentTier("ENHANCED") && (
            <Badge variant="outline" className="text-[10px]">Current Plan</Badge>
          )}
          <EnhancedPreview businessName={name} />
          <div className="pt-2">
            <h3 className="font-bold text-base">Enhanced</h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#5B1D8F] dark:text-purple-400">$99</span>
              <span className="text-xs text-muted-foreground">/ year</span>
              <span className="text-sm text-muted-foreground/60 line-through">$699/yr</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[9px] border-[#5B1D8F] text-[#5B1D8F]">Intro Rate</Badge>
              <span className="text-[10px] text-green-600 font-semibold">Save $600</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1" data-testid="enhanced-all-features">
            <div className="text-[10px] font-semibold text-[#5B1D8F] dark:text-purple-400 uppercase tracking-wide">Everything included:</div>
            {ENHANCED_ALL_FEATURES.map(b => (
              <div key={b.text} className="flex items-start gap-1.5 text-[11px]">
                <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
        {mode === "checkout" && !isCurrentTier("ENHANCED") && (
          <Button
            className="mt-3 w-full bg-[#5B1D8F] text-white"
            onClick={(e) => { e.stopPropagation(); onCheckout?.("ENHANCED"); }}
            disabled={!!checkoutLoading}
            data-testid="button-checkout-enhanced"
          >
            {checkoutLoading === "ENHANCED" ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Starting checkout...</>
            ) : (
              "Upgrade to Enhanced"
            )}
          </Button>
        )}
        {isCurrentTier("ENHANCED") && mode === "checkout" && (
          <Badge variant="outline" className="mt-3 w-full justify-center">Current Plan</Badge>
        )}
      </Card>
    </div>
  );
}
