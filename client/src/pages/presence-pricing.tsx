import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, X, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useState } from "react";
import { MICROSITE_TIER_CONFIG } from "@shared/schema";
import type { Business } from "@shared/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TierVisualPreviews } from "@/components/tier-visual-previews";
import { InspirationQuoteBlock } from "@/components/inspiration-quote-block";

type TierKey = keyof typeof MICROSITE_TIER_CONFIG;


const VERIFIED_FEATURES = [
  { label: "Basic directory listing", included: true },
  { label: "Public presence URL", included: true },
  { label: "1 photo", included: true },
  { label: "AI Microsite", included: false },
  { label: "Gallery", included: false },
  { label: "Social links", included: false },
  { label: "Boosted visibility", included: false },
  { label: "Custom domain", included: false },
];

const ENHANCED_FEATURES = [
  { label: "Everything in Verified", included: true },
  { label: "AI Microsite (mini website)", included: true },
  { label: "Up to 50 gallery photos", included: true },
  { label: "Unlimited social links", included: true },
  { label: "Boosted visibility in rotation", included: true },
  { label: "Custom theme colors", included: true },
  { label: "Custom domain INCLUDED", included: true },
  { label: "Featured eligibility", included: true },
];

const FAQ_ITEMS = [
  {
    question: "What happens if I cancel?",
    answer:
      "Your listing stays live forever. You just go back to the Verified tier. All your content and history is preserved.",
  },
  {
    question: "Can I switch plans?",
    answer: "Absolutely. Upgrade or downgrade anytime.",
  },
  {
    question: "What about custom domains?",
    answer:
      "Enhanced members get a custom domain included at no extra cost.",
  },
];

function tierKeyFromListingTier(tier?: string): TierKey {
  if (tier === "ENHANCED") return "ENHANCED";
  return "VERIFIED";
}

export default function PresencePricing({
  citySlug,
  slug,
}: {
  citySlug: string;
  slug: string;
}) {
  const { toast } = useToast();
  const smartBack = useSmartBack(`/${citySlug}/presence/${slug}/dashboard`);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const refOperatorId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null;

  const { data: business, isLoading: bizLoading } = useQuery<Business>({
    queryKey: ["/api/cities", citySlug, "businesses", slug],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (args: { tier: string; billingInterval: string }) => {
      setLoadingTier(args.tier);
      const resp = await apiRequest(
        "POST",
        `/api/cities/${citySlug}/owner/${slug}/checkout`,
        { ...args, ...(refOperatorId ? { operatorId: refOperatorId } : {}) },
      );
      return resp.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      setLoadingTier(null);
      const msg = error.message || "";
      let description = "Something went wrong starting checkout. Please try again.";
      if (msg.includes("logged in") || msg.includes("401")) {
        description = "Please log in first to upgrade your listing.";
      } else if (msg.includes("do not own") || msg.includes("Not claimed") || msg.includes("403")) {
        description = "You need to claim this listing before you can upgrade. Visit the listing page to claim it.";
      } else if (msg.includes("No Stripe price")) {
        description = "Stripe pricing is not yet configured for this tier. Please contact support.";
      } else if (msg.includes("no owner email")) {
        description = "This listing needs an owner email before checkout. Please claim the listing first.";
      }
      toast({
        title: "Checkout error",
        description,
        variant: "destructive",
      });
    },
  });

  if (bizLoading) {
    return (
      <div className="mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-6 w-96 mx-auto" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const currentTierKey = tierKeyFromListingTier(business?.listingTier);
  const currentDisplayName = MICROSITE_TIER_CONFIG[currentTierKey].displayName;

  return (
    <div className="mx-auto px-4 py-10 space-y-10">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={smartBack}
          data-testid="link-back-dashboard"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
      </div>

      <div className="text-center space-y-3">
        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          data-testid="text-pricing-heading"
        >
          Choose Your Presence Plan
        </h1>
        <p
          className="text-muted-foreground max-w-2xl mx-auto"
          data-testid="text-pricing-subtext"
        >
          Your listing is live. Upgrade to unlock your AI Microsite — a mini
          website that grows with your business.
        </p>
        <Badge variant="secondary" data-testid="badge-current-plan">
          Your current plan: {currentDisplayName}
        </Badge>
      </div>

      <InspirationQuoteBlock pageContext="pricing" inspirationName={(business as any)?.businessInspiration} />

      <TierVisualPreviews
        businessName={business?.name}
        currentTier={currentTierKey}
        mode="checkout"
        onCheckout={(tier) => checkoutMutation.mutate({ tier, billingInterval: "annual" })}
        checkoutLoading={checkoutMutation.isPending ? loadingTier : null}
        showVerified={true}
      />

      <InspirationQuoteBlock pageContext="pricing" variant="subtle" inspirationName={(business as any)?.businessInspiration} />

      <div className="max-w-2xl mx-auto" data-testid="section-faq">
        <h2 className="text-xl font-bold text-center mb-4">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger
                className="text-left"
                data-testid={`faq-trigger-${i}`}
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent data-testid={`faq-content-${i}`}>
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
