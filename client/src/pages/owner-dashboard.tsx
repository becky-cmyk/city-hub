import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Building2, MapPin, Phone, Globe, CheckCircle, ArrowLeft, Star, TrendingUp, Lock, Loader2, MousePointerClick, Navigation, PhoneCall, CalendarCheck, MessageSquare, Store, X, Plus, List, Shield, Wifi, Clock, ExternalLink, AlertTriangle, Tv, Receipt, CreditCard, DollarSign, Calendar, Users, Copy, UserCheck, Heart, Gift, Trash2, Edit, Eye, BarChart3, Ticket } from "lucide-react";
import { BizImage } from "@/components/biz-image";
import { LockedFeatureCard } from "@/components/locked-feature-card";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import type { Business } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import type { ProfileType, User } from "@/hooks/use-auth";
import { isModuleVisibleForActiveType } from "@shared/profile-types";
import OwnerReviews from "@/components/owner-reviews";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventSponsorsTab, EventVendorsTab } from "@/components/event-sponsors-vendors-panel";

import type { EntitlementTier } from "@/hooks/use-business-access";
import { tierAtLeast, useBusinessAccess } from "@/hooks/use-business-access";
import { GatedSection } from "@/components/gated-section";
import { CreditConfirmDialog } from "@/components/credit-confirm-dialog";

interface BusinessCapabilities {
  tier: EntitlementTier;
  capabilities: {
    canUseGallery: boolean;
    canUseMediaBlocks: boolean;
    canShowBadges: boolean;
    canPriorityRank: boolean;
  };
  visibleModules?: string[];
}

export default function OwnerDashboard({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const activeType: ProfileType = (user as User)?.activeProfileType || "resident";
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [pollingForUpgrade, setPollingForUpgrade] = useState(false);
  const pollStartRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCheckoutSuccess = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("checkout") === "success";

  const { data: business, isLoading } = useQuery<Business>({
    queryKey: ["/api/cities", citySlug, "owner", slug],
  });

  const { data: caps } = useQuery<BusinessCapabilities>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "entitlements"],
    enabled: !!business,
  });

  const { checkModule, creditBalance } = useBusinessAccess(citySlug, slug, !!business);

  const [creditDialogState, setCreditDialogState] = useState<{
    open: boolean;
    actionLabel: string;
    creditCost: number;
    onConfirm: () => void;
  }>({ open: false, actionLabel: "", creditCost: 0, onConfirm: () => {} });

  useEffect(() => {
    if (isCheckoutSuccess && !pollingForUpgrade && caps && !tierAtLeast(caps.tier, "ENHANCED")) {
      setPollingForUpgrade(true);
      pollStartRef.current = Date.now();
    }
  }, [isCheckoutSuccess, caps?.tier]);

  useEffect(() => {
    if (!pollingForUpgrade) return;

    const poll = () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > 60000) {
        setPollingForUpgrade(false);
        toast({ title: t("toast.stillProcessing"), description: t("toast.stillProcessingDesc"), variant: "default" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug, "entitlements"] });
      pollTimerRef.current = setTimeout(poll, 4000);
    };

    pollTimerRef.current = setTimeout(poll, 3000);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [pollingForUpgrade, citySlug, slug]);

  useEffect(() => {
    if (pollingForUpgrade && caps && tierAtLeast(caps.tier, "ENHANCED")) {
      setPollingForUpgrade(false);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      toast({ title: t("toast.upgradeComplete"), description: t("toast.upgradeCompleteDesc") });
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout");
        window.history.replaceState({}, "", url.pathname);
      }
    }
  }, [caps, pollingForUpgrade]);

  const [editForm, setEditForm] = useState({
    description: "",
    websiteUrl: "",
    phone: "",
    ownerName: "",
  });
  const [editing, setEditing] = useState(false);

  const editMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/cities/${citySlug}/owner/${slug}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!resp.ok) throw new Error("Failed to submit edit");
      return resp.json();
    },
    onSuccess: () => {
      setEditSubmitted(true);
      setEditing(false);
      toast({ title: t("toast.editSubmitted") });
    },
    onError: () => {
      toast({ title: t("toast.error"), description: t("toast.editError"), variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (args: { tier: string; billingInterval?: string }) => {
      const ref = typeof window !== "undefined" ? localStorage.getItem("ambassador_ref") : null;
      const body = ref ? { ...args, ref } : args;
      const resp = await apiRequest("POST", `/api/cities/${citySlug}/owner/${slug}/checkout`, body);
      return resp.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({ title: t("toast.error"), description: t("toast.checkoutError"), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">{t("owner.notFound")}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t("owner.notFoundMessage")}</p>
          <Link href={`/${citySlug}`}>
            <Button variant="outline" data-testid="button-go-home">{t("owner.goHome")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const startEditing = () => {
    setEditForm({
      description: business.description || "",
      websiteUrl: business.websiteUrl || "",
      phone: business.phone || "",
      ownerName: "",
    });
    setEditing(true);
    setEditSubmitted(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/${citySlug}/directory/${slug}`}>
          <Button variant="ghost" size="sm" className="gap-1" data-testid="link-back-listing">
            <ArrowLeft className="h-4 w-4" /> {t("owner.viewPublicListing")}
          </Button>
        </Link>
        <Link href={`/${citySlug}/presence/${slug}`}>
          <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-microsite">
            <Globe className="h-4 w-4" /> {t("owner.viewMicrosite")}
          </Button>
        </Link>
        <Link href={`/${citySlug}/owner/${slug}/site-builder`}>
          <Button variant="ghost" size="sm" className="gap-1" data-testid="link-site-builder">
            <Store className="h-4 w-4" /> {t("owner.buildYourSite")}
          </Button>
        </Link>
        <Link href={`/${citySlug}/presence/${slug}/pricing`}>
          <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-pricing">
            <TrendingUp className="h-4 w-4" /> {t("owner.plansPricing")}
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-owner-title">
          <Building2 className="h-6 w-6 text-primary" />
          {t("owner.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("owner.subtitle")}
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <BizImage src={business.imageUrl} alt="" className="h-16 w-16 rounded-md object-cover shrink-0" />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h2 className="font-semibold text-lg" data-testid="text-owner-business-name">{business.name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />{t("badge.claimed")}</Badge>
                  <Badge variant="outline">{business.listingTier}</Badge>
                  {business.isVerified && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />{t("badge.verified")}</Badge>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("owner.contactInfo")}</h3>
          {business.address && (
            <p className="text-sm flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              {[business.address, business.city, business.state, business.zip].filter(Boolean).join(", ")}
            </p>
          )}
          {business.phone && (
            <p className="text-sm flex items-center gap-1">
              <Phone className="h-3 w-3 text-muted-foreground" />
              {business.phone}
            </p>
          )}
          {business.websiteUrl && (
            <p className="text-sm flex items-center gap-1">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <a href={business.websiteUrl} target="_blank" rel="noopener" className="truncate hover:underline">
                {business.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            </p>
          )}
        </Card>

        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("owner.listingStats")}</h3>
          <p className="text-sm">{t("owner.tier")}: <span className="font-medium">{caps?.tier || business.listingTier}</span></p>
          {business.googleRating && (
            <p className="text-sm">{t("owner.googleRating")}: <span className="font-medium">{business.googleRating}</span> ({business.googleReviewCount} {t("owner.reviews")})</p>
          )}
        </Card>
      </div>

      {pollingForUpgrade && (
        <Card className="p-5 text-center" data-testid="card-processing-payment">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3" />
          <h3 className="font-semibold mb-1">{t("owner.processingPayment")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("owner.processingMessage")}
          </p>
        </Card>
      )}

      {!editing && !editSubmitted && !pollingForUpgrade && (
        !caps ? (
          <Skeleton className="h-9 w-48" />
        ) : !tierAtLeast(caps.tier, "ENHANCED") ? (
          <GatedSection
            resolution={checkModule("microsite")}
            featureLabel={t("owner.editListing")}
            onUpgrade={(tier) => checkoutMutation.mutate({ tier })}
            isPending={checkoutMutation.isPending}
          >
            <Button onClick={startEditing} className="gap-2" data-testid="button-start-edit">
              {t("owner.editListing")}
            </Button>
          </GatedSection>
        ) : (
          <Button onClick={startEditing} className="gap-2" data-testid="button-start-edit">
            {t("owner.editListing")}
          </Button>
        )
      )}

      {editSubmitted && (
        <Card className="p-5 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-green-500 mb-3" />
          <h3 className="font-semibold mb-1">{t("owner.editSubmitted")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("owner.editSubmittedMessage")}
          </p>
          <Button variant="outline" className="mt-3" onClick={startEditing} data-testid="button-edit-again">
            {t("owner.submitAnotherEdit")}
          </Button>
        </Card>
      )}

      {editing && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">{t("owner.editDetails")}</h3>
          <form
            onSubmit={(e) => { e.preventDefault(); editMutation.mutate(); }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium mb-1 block">{t("owner.description")}</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("owner.descriptionPlaceholder")}
                data-testid="input-owner-description"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">{t("claim.phone")}</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder={t("owner.phonePlaceholder")}
                  data-testid="input-owner-phone"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t("owner.website")}</label>
                <Input
                  value={editForm.websiteUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder={t("owner.websitePlaceholder")}
                  data-testid="input-owner-website"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={editMutation.isPending} data-testid="button-submit-edit">
                {editMutation.isPending ? t("owner.submitting") : t("owner.submitForReview")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                {t("owner.cancel")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isCheckoutSuccess && caps && tierAtLeast(caps.tier, "ENHANCED") && !pollingForUpgrade && (
        <PostPurchaseSection citySlug={citySlug} slug={slug} tier={caps.tier} />
      )}

      {isModuleVisibleForActiveType(activeType, "directory_listing") && (
        <ShoppingCenterSection citySlug={citySlug} slug={slug} business={business} />
      )}

      {business.isNonprofit && (
        <NonprofitSection citySlug={citySlug} slug={slug} business={business} />
      )}

      {isModuleVisibleForActiveType(activeType, "directory_listing") && (
        <TransitStopSection citySlug={citySlug} slug={slug} business={business} />
      )}

      {isModuleVisibleForActiveType(activeType, "microsite") && (
        <GatedSection
          resolution={checkModule("microsite")}
          featureLabel="Microsite & Services"
          onUpgrade={(tier) => checkoutMutation.mutate({ tier })}
          isPending={checkoutMutation.isPending}
        >
          <MicroServicesSection citySlug={citySlug} slug={slug} />
        </GatedSection>
      )}

      {isModuleVisibleForActiveType(activeType, "directory_listing") && (
        <LocationsAndAddonsSection businessId={business.id} />
      )}
      {isModuleVisibleForActiveType(activeType, "directory_listing") && (
        <CoverageSection citySlug={citySlug} slug={slug} business={business} tier={caps?.tier || business.listingTier} />
      )}
      {isModuleVisibleForActiveType(activeType, "custom_domain") && (
        <DomainConnectSection citySlug={citySlug} slug={slug} tier={caps?.tier || business.listingTier} />
      )}

      {caps && tierAtLeast(caps.tier, "ENHANCED") && (
        <DiscoveryMetricsSection citySlug={citySlug} slug={slug} />
      )}

      <GraceStatusSection citySlug={citySlug} slug={slug} />

      <OwnerEntitlementSection />

      <OwnerCreditWalletSection />

      {isModuleVisibleForActiveType(activeType, "events") && (
        <OwnerEventsSection citySlug={citySlug} slug={slug} />
      )}

      <BillingSection citySlug={citySlug} slug={slug} />

      {isModuleVisibleForActiveType(activeType, "directory_listing") && (
        <LeadsPanel citySlug={citySlug} slug={slug} />
      )}

      {isModuleVisibleForActiveType(activeType, "internal_reviews") && (
        <ReviewLinkSection citySlug={citySlug} slug={slug} />
      )}

      {isModuleVisibleForActiveType(activeType, "internal_reviews") && (
        <OwnerReviews citySlug={citySlug} businessSlug={slug} />
      )}

      {isModuleVisibleForActiveType(activeType, "expert_qa") && (
        <ExpertShowRequestSection />
      )}

      {caps && !tierAtLeast(caps.tier, "ENTERPRISE") && !pollingForUpgrade && (
        <TierComparisonSection
          currentTier={caps.tier}
          onUpgrade={(tier) => checkoutMutation.mutate({ tier })}
          isPending={checkoutMutation.isPending}
        />
      )}

      <CreditConfirmDialog
        open={creditDialogState.open}
        onClose={() => setCreditDialogState(s => ({ ...s, open: false }))}
        onConfirm={creditDialogState.onConfirm}
        actionLabel={creditDialogState.actionLabel}
        creditCost={creditDialogState.creditCost}
        currentBalance={creditBalance}
      />
    </div>
  );
}

function ReviewLinkSection({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showQr, setShowQr] = useState(false);

  const { data: qrData } = useQuery<{ reviewUrl: string; qrDataUrl: string }>({
    queryKey: ["/api/cities", citySlug, "businesses", slug, "review-qr"],
    enabled: showQr,
  });

  const reviewUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${citySlug}/review/${slug}`
    : `/${citySlug}/review/${slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(reviewUrl).then(() => {
      toast({ title: t("review.linkCopied") });
    });
  };

  const downloadQr = () => {
    if (!qrData?.qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `review-qr-${slug}.svg`;
    link.href = qrData.qrDataUrl;
    link.click();
  };

  return (
    <Card className="p-5 space-y-4" data-testid="section-review-link">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{t("review.getReviewLink")}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{t("review.shareLink")}</p>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-0 bg-muted rounded-md px-3 py-2 text-sm truncate" data-testid="text-review-url">
          {reviewUrl}
        </div>
        <Button variant="outline" size="sm" onClick={copyLink} data-testid="button-copy-review-link">
          {t("review.copyLink")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowQr(!showQr)}
          data-testid="button-toggle-qr"
        >
          {t("review.qrCode")}
        </Button>
      </div>

      {showQr && (
        <div className="space-y-3">
          {qrData?.qrDataUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={qrData.qrDataUrl}
                alt="Review QR Code"
                className="h-48 w-48"
                data-testid="img-review-qr"
              />
              <Button variant="outline" size="sm" onClick={downloadQr} data-testid="button-download-qr">
                {t("review.downloadQr")}
              </Button>
              <p className="text-xs text-muted-foreground text-center">{t("review.printOnReceipts")}</p>
            </div>
          ) : (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface TierFeature {
  id: string;
  tier: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  maxPhotos: number;
  allowVideo: boolean;
  allowSocialLinks: boolean;
  badgeText: string | null;
}

function TierComparisonSection({ currentTier, onUpgrade, isPending }: { currentTier: string; onUpgrade: (tier: string) => void; isPending: boolean }) {
  const { t } = useI18n();
  const { data: tiers } = useQuery<TierFeature[]>({
    queryKey: ["/api/listing-tiers"],
  });

  if (!tiers || tiers.length === 0) return null;

  const tierOrder = ["FREE", "VERIFIED", "ENHANCED", "ENTERPRISE"];
  const currentIdx = tierOrder.indexOf(currentTier);
  const upgradeTiers = tiers.filter((t) => tierOrder.indexOf(t.tier) > currentIdx);

  if (upgradeTiers.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="tier-comparison">
      <h3 className="font-semibold flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" /> {t("owner.upgradeVisibility")}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {upgradeTiers.map((tier) => (
          <Card key={tier.id} className="p-5 space-y-3 border-primary/20" data-testid={`tier-card-${tier.tier.toLowerCase()}`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{tier.displayName}</h4>
                {tier.badgeText && <Badge variant="secondary" className="mt-1">{tier.badgeText}</Badge>}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">${(tier.monthlyPrice / 100).toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">{t("owner.perMonth")}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{tier.description}</p>
            <ul className="space-y-1.5">
              {tier.features.map((f, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full gap-2"
              onClick={() => onUpgrade(tier.tier)}
              disabled={isPending}
              data-testid={`button-upgrade-${tier.tier.toLowerCase()}`}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t("owner.startingCheckout")}</>
              ) : (
                <><TrendingUp className="h-4 w-4" /> {t("owner.upgradeTo")} {tier.displayName}</>
              )}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface LeadSummary {
  days: number;
  summary: Record<string, number>;
}

interface LeadSubmissionItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  occurredAt: string;
}

const eventIcons: Record<string, any> = {
  CLICK_WEBSITE: MousePointerClick,
  CLICK_DIRECTIONS: Navigation,
  CLICK_CALL: PhoneCall,
  CLICK_BOOKING: CalendarCheck,
  FORM_SUBMIT: MessageSquare,
};

function LeadsPanel({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { t } = useI18n();
  const { data: summary, isLoading: summaryLoading } = useQuery<LeadSummary>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "leads", "summary?days=7"],
  });

  const { data: submissions, isLoading: subsLoading } = useQuery<LeadSubmissionItem[]>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "leads", "submissions?limit=10"],
  });

  if (summaryLoading) return <Skeleton className="h-40 w-full" />;

  const eventLabels: Record<string, string> = {
    CLICK_WEBSITE: t("owner.websiteClicks"),
    CLICK_DIRECTIONS: t("owner.directions"),
    CLICK_CALL: t("owner.calls"),
    CLICK_BOOKING: t("owner.bookings"),
    FORM_SUBMIT: t("owner.messages"),
  };

  const stats = summary?.summary || {};
  const totalClicks = (stats.CLICK_WEBSITE || 0) + (stats.CLICK_DIRECTIONS || 0) + (stats.CLICK_CALL || 0) + (stats.CLICK_BOOKING || 0);

  return (
    <Card className="p-5 space-y-4" data-testid="leads-panel">
      <div className="flex items-center gap-2">
        <MousePointerClick className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{t("owner.leadActivity")}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(eventLabels).map(([key, label]) => {
          const Icon = eventIcons[key];
          const count = stats[key] || 0;
          return (
            <div key={key} className="rounded-lg border p-3 text-center" data-testid={`stat-${key.toLowerCase()}`}>
              <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          );
        })}
      </div>

      {totalClicks === 0 && (stats.FORM_SUBMIT || 0) === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          {t("owner.noLeads")}
        </p>
      )}

      {submissions && submissions.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">{t("owner.recentMessages")}</h4>
          {submissions.map((sub) => (
            <div key={sub.id} className="rounded-lg border p-3 text-sm space-y-1" data-testid={`submission-${sub.id}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{sub.name}</span>
                <span className="text-xs text-muted-foreground">{new Date(sub.occurredAt).toLocaleDateString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">{sub.email}{sub.phone ? ` · ${sub.phone}` : ""}</div>
              <p className="text-muted-foreground line-clamp-2">{sub.message}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const CENTER_TYPE_LABELS: Record<string, string> = {
  SHOPPING_CENTER: "Shopping Center",
  BUSINESS_CENTER: "Business Center",
  TECH_PARK: "Tech Park",
  OFFICE_COMPLEX: "Office Complex",
  MIXED_USE: "Mixed-Use Development",
  PLAZA: "Plaza",
  MALL: "Mall",
  OTHER: "Other",
};

interface ShoppingCenterResult {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  centerType?: string;
}

function ShoppingCenterSection({ citySlug, slug, business }: { citySlug: string; slug: string; business: Business }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCenterType, setNewCenterType] = useState("SHOPPING_CENTER");

  const { data: searchResults } = useQuery<ShoppingCenterResult[]>({
    queryKey: ["/api/cities", citySlug, "shopping-centers", "search", { q: searchQuery }],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const resp = await fetch(`/api/cities/${citySlug}/shopping-centers/search?q=${encodeURIComponent(searchQuery)}`);
      return resp.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const { data: currentCenter } = useQuery<ShoppingCenterResult | null>({
    queryKey: ["shopping-center-current", business.shoppingCenterId],
    queryFn: async () => {
      if (!business.shoppingCenterId) return null;
      const resp = await fetch(`/api/cities/${citySlug}/shopping-centers`);
      const all: ShoppingCenterResult[] = await resp.json();
      return all.find(sc => sc.id === business.shoppingCenterId) || null;
    },
    enabled: !!business.shoppingCenterId,
  });

  const linkMutation = useMutation({
    mutationFn: async (shoppingCenterId: string | null) => {
      await apiRequest("PUT", `/api/cities/${citySlug}/owner/${slug}/shopping-center`, { shoppingCenterId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug] });
      setSearchQuery("");
      toast({ title: "Shopping center updated" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/cities/${citySlug}/owner/${slug}/shopping-center/create`, { name: newName, address: newAddress, centerType: newCenterType });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug] });
      setShowCreate(false);
      setNewName("");
      setNewAddress("");
      setNewCenterType("SHOPPING_CENTER");
      toast({ title: "Commercial center created and linked" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not create commercial center", variant: "destructive" });
    },
  });

  return (
    <Card className="p-5 space-y-4" data-testid="section-shopping-center">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Commercial Center</h3>
      </div>

      {business.shoppingCenterId && currentCenter ? (
        <div className="flex items-center gap-2 justify-between">
          <div>
            <p className="text-sm font-medium">{currentCenter.name}</p>
            {currentCenter.address && <p className="text-xs text-muted-foreground">{currentCenter.address}</p>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => linkMutation.mutate(null)}
            disabled={linkMutation.isPending}
            data-testid="button-remove-center"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Search existing centers</Label>
            <Input
              placeholder="Shopping center, business park, plaza..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-center"
            />
          </div>

          {searchResults && searchResults.length > 0 && (
            <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
              {searchResults.map(sc => (
                <button
                  key={sc.id}
                  onClick={() => linkMutation.mutate(sc.id)}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  data-testid={`select-center-${sc.id}`}
                >
                  <span className="font-medium">{sc.name}</span>
                  {sc.address && <span className="text-xs text-muted-foreground ml-2">{sc.address}</span>}
                </button>
              ))}
            </div>
          )}

          {!showCreate ? (
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1" data-testid="button-create-center">
              <Plus className="h-3 w-3" /> Create New
            </Button>
          ) : (
            <div className="space-y-2 border rounded-md p-3">
              <Select value={newCenterType} onValueChange={setNewCenterType}>
                <SelectTrigger data-testid="select-center-type">
                  <SelectValue placeholder="Center type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CENTER_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Center name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-testid="input-new-center-name"
              />
              <Input
                placeholder="Address (optional)"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                data-testid="input-new-center-address"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate()}
                  disabled={!newName.trim() || createMutation.isPending}
                  data-testid="button-save-new-center"
                >
                  {createMutation.isPending ? "Creating..." : "Create & Link"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)} data-testid="button-cancel-create-center">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface TransitLine {
  id: string;
  name: string;
  lineType: string;
  color: string;
  cityId: string;
}

interface TransitStop {
  id: string;
  transitLineId: string;
  name: string;
  address: string | null;
  sortOrder: number;
  cityId: string;
}

function TransitStopSection({ citySlug, slug, business }: { citySlug: string; slug: string; business: Business }) {
  const { toast } = useToast();
  const [selectedStopId, setSelectedStopId] = useState(business.nearestTransitStopId || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedStopId(business.nearestTransitStopId || "");
  }, [business.nearestTransitStopId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: transitLines } = useQuery<TransitLine[]>({
    queryKey: ["/api/cities", citySlug, "transit-lines"],
  });

  const { data: transitStops } = useQuery<TransitStop[]>({
    queryKey: ["/api/cities", citySlug, "transit-stops"],
  });

  const saveMutation = useMutation({
    mutationFn: async (stopId: string | null) => {
      await apiRequest("PUT", `/api/cities/${citySlug}/owner/${slug}/transit-stop`, { nearestTransitStopId: stopId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug] });
      toast({ title: "Transit stop updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update transit stop", variant: "destructive" });
    },
  });

  const groups = (transitLines || []).map((line) => ({
    label: line.name,
    color: line.color,
    items: (transitStops || [])
      .filter((stop) => stop.transitLineId === line.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((g) => g.items.length > 0);

  if (!transitLines || !transitStops || groups.length === 0) return null;

  const selectedStop = transitStops.find((s) => s.id === selectedStopId);
  const selectedLine = selectedStop ? transitLines.find((l) => l.id === selectedStop.transitLineId) : null;
  const lowerSearch = searchQuery.toLowerCase();
  const filteredGroups = groups.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.name.toLowerCase().includes(lowerSearch)),
  })).filter((g) => g.items.length > 0);

  return (
    <Card className="p-5 space-y-4" data-testid="section-transit-stop">
      <div className="flex items-center gap-2">
        <Navigation className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Nearest Transit Stop</h3>
      </div>

      {selectedStopId && selectedStop ? (
        <div className="flex items-center gap-2 justify-between">
          <div>
            <p className="text-sm font-medium">{selectedStop.name}</p>
            {selectedLine && (
              <p className="text-xs text-muted-foreground">{selectedLine.name}</p>
            )}
            {selectedStop.address && <p className="text-xs text-muted-foreground">{selectedStop.address}</p>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedStopId(""); saveMutation.mutate(null); }}
            disabled={saveMutation.isPending}
            data-testid="button-remove-transit-stop"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="relative" ref={dropdownRef}>
          <div
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer items-center justify-between"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            data-testid="owner-transit-stop-select"
          >
            <span className="text-muted-foreground">Select nearest transit stop...</span>
          </div>
          {dropdownOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
              <div className="p-2 border-b">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stops..."
                  className="h-8 text-sm"
                  autoFocus
                  data-testid="owner-transit-stop-search"
                />
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {filteredGroups.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>}
                {filteredGroups.map((g, gi) => (
                  <div key={g.label}>
                    {gi > 0 && <div className="mx-2 my-1 border-t" />}
                    <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#5B1D8F] bg-muted/50 sticky top-0">{g.label}</div>
                    {g.items.map((stop) => (
                      <button
                        key={stop.id}
                        type="button"
                        className="w-full text-left pl-6 pr-3 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedStopId(stop.id);
                          setDropdownOpen(false);
                          setSearchQuery("");
                          saveMutation.mutate(stop.id);
                        }}
                        data-testid={`owner-transit-stop-option-${stop.id}`}
                      >
                        {stop.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface PresenceServiceItem {
  id: string;
  presenceId: string;
  serviceName: string;
  isPrimary: boolean;
  parentServiceId: string | null;
  sortOrder: number;
}

function MicroServicesSection({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const [primaryService, setPrimaryService] = useState("");
  const [subServiceInput, setSubServiceInput] = useState("");
  const [subServices, setSubServices] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  const { data: services, isLoading } = useQuery<PresenceServiceItem[]>({
    queryKey: ["/api/cities", citySlug, "presence", slug, "services"],
  });

  useEffect(() => {
    if (services && !editing) {
      const primary = services.find(s => s.isPrimary);
      setPrimaryService(primary?.serviceName || "");
      setSubServices(services.filter(s => !s.isPrimary).map(s => s.serviceName));
    }
  }, [services, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const servicesList: { serviceName: string; isPrimary: boolean; sortOrder: number }[] = [];
      if (primaryService.trim()) {
        servicesList.push({ serviceName: primaryService.trim(), isPrimary: true, sortOrder: 0 });
      }
      subServices.forEach((name, i) => {
        if (name.trim()) {
          servicesList.push({ serviceName: name.trim(), isPrimary: false, sortOrder: i + 1 });
        }
      });
      await apiRequest("PUT", `/api/cities/${citySlug}/owner/${slug}/services`, { services: servicesList });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "presence", slug, "services"] });
      setEditing(false);
      toast({ title: "Services updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save services", variant: "destructive" });
    },
  });

  const addSubService = () => {
    if (subServiceInput.trim()) {
      setSubServices(prev => [...prev, subServiceInput.trim()]);
      setSubServiceInput("");
    }
  };

  const removeSubService = (index: number) => {
    setSubServices(prev => prev.filter((_, i) => i !== index));
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const hasServices = services && services.length > 0;

  return (
    <Card className="p-5 space-y-4" data-testid="section-micro-services">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Micro-Services</h3>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-services">
            {hasServices ? "Edit" : "Add Services"}
          </Button>
        )}
      </div>

      {!editing && hasServices && (
        <div className="space-y-2">
          {services.filter(s => s.isPrimary).map(s => (
            <div key={s.id} className="flex items-center gap-2">
              <Badge variant="default" data-testid={`badge-primary-${s.id}`}>{s.serviceName}</Badge>
              <span className="text-xs text-muted-foreground">Primary</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {services.filter(s => !s.isPrimary).map(s => (
              <Badge key={s.id} variant="outline" data-testid={`badge-sub-${s.id}`}>{s.serviceName}</Badge>
            ))}
          </div>
        </div>
      )}

      {!editing && !hasServices && (
        <p className="text-sm text-muted-foreground">No services listed yet. Add your primary service and sub-services to help customers find you.</p>
      )}

      {editing && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Primary Service</Label>
            <Input
              placeholder="e.g. Pressure Washing"
              value={primaryService}
              onChange={(e) => setPrimaryService(e.target.value)}
              data-testid="input-primary-service"
            />
          </div>
          <div>
            <Label className="text-sm">Sub-Services (Micro-Services)</Label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="e.g. Roof Washing, Driveway Cleaning"
                value={subServiceInput}
                onChange={(e) => setSubServiceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubService(); } }}
                data-testid="input-sub-service"
              />
              <Button type="button" variant="outline" size="sm" onClick={addSubService} data-testid="button-add-sub-service">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {subServices.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {subServices.map((name, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1" data-testid={`sub-service-tag-${i}`}>
                    {name}
                    <button onClick={() => removeSubService(i)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-services"
            >
              {saveMutation.isPending ? "Saving..." : "Save Services"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} data-testid="button-cancel-services">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function PostPurchaseSection({ citySlug, slug, tier }: { citySlug: string; slug: string; tier: string }) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  const { data: enterpriseCheck } = useQuery<{ presenceCount: number; limit: number; needsReview: boolean }>({
    queryKey: ["/api/enterprise/check/self"],
  });

  if (dismissed) return null;

  const tierName = tier === "ENHANCED" ? "Expanded Hub Presence" : "Hub Presence";

  const opportunities = [
    {
      icon: Shield,
      title: t("owner.expandReach"),
      description: t("owner.expandReachDesc"),
      cta: t("owner.manageCoverage"),
      section: "section-coverage",
    },
    {
      icon: Globe,
      title: t("owner.connectYourDomain"),
      description: tier === "ENHANCED" ? t("owner.domainIncludedDesc") : t("owner.domainFeeDesc"),
      cta: t("owner.setupDomain"),
      section: "section-domain",
    },
    {
      icon: List,
      title: t("owner.addServices"),
      description: t("owner.addServicesDesc"),
      cta: t("owner.manageServices"),
      section: "micro-services-section",
    },
  ];

  if (enterpriseCheck && enterpriseCheck.presenceCount >= 3) {
    opportunities.push({
      icon: Building2,
      title: t("owner.enterpriseOpps"),
      description: t("owner.enterpriseDesc", { count: String(enterpriseCheck.presenceCount) }),
      cta: t("owner.learnMore"),
      section: "enterprise-info",
    });
  }

  return (
    <Card className="p-5 space-y-4 border-primary/30 bg-primary/5" data-testid="section-post-purchase">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-lg">{t("owner.welcomeTo", { tier: tierName })}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setDismissed(true)} data-testid="button-dismiss-post-purchase">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("owner.upgradeActiveDesc")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {opportunities.map((opp) => (
          <div
            key={opp.title}
            className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => {
              const el = document.querySelector(`[data-testid="${opp.section}"]`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            data-testid={`card-opportunity-${opp.section}`}
          >
            <opp.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-sm">{opp.title}</p>
              <p className="text-xs text-muted-foreground">{opp.description}</p>
              <span className="text-xs text-primary font-medium">{opp.cta} →</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface CoverageSummary {
  locations: { id: string; label: string | null; street: string | null; city: string | null; state: string | null; zip: string | null; hubId: string | null; isPrimary: boolean }[];
  locationsCount: number;
  maxLocations: number;
  hubVisibility: { id: string; hubId: string; hubName: string }[];
  serviceAreaHubs: { id: string; hubId: string; hubName: string }[];
  hasMetroWide: boolean;
  activeSubscriptions: { id: string; addonType: string; unitPriceCents: number; status: string }[];
  pricing: { PHYSICAL_LOCATION: number; EXTRA_HUB_VISIBILITY: number; SERVICE_AREA_HUB: number; METRO_WIDE: number };
}

function LocationsAndAddonsSection({ businessId }: { businessId: string }) {
  const { toast } = useToast();
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [locLabel, setLocLabel] = useState("");
  const [locStreet, setLocStreet] = useState("");
  const [locCity, setLocCity] = useState("");
  const [locState, setLocState] = useState("");
  const [locZip, setLocZip] = useState("");

  const { data, isLoading } = useQuery<CoverageSummary>({
    queryKey: ["/api/businesses", businessId, "coverage-summary"],
    queryFn: async () => {
      const resp = await fetch(`/api/businesses/${businessId}/coverage-summary`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load coverage");
      return resp.json();
    },
  });

  const requestAddon = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      return apiRequest("POST", `/api/businesses/${businessId}/request-addon`, body);
    },
    onSuccess: async (resp: any) => {
      const result = await resp.json();
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId, "coverage-summary"] });
      if (result.requiresEnterprise) {
        toast({ title: "Enterprise pricing required", description: "We'll contact you about franchise/enterprise options." });
      } else {
        toast({ title: "Add-on requested", description: "Payment pending — our team will follow up." });
      }
      setShowAddLocation(false);
      setLocLabel(""); setLocStreet(""); setLocCity(""); setLocState(""); setLocZip("");
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return null;

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <Card className="p-5 space-y-4" data-testid="section-locations-addons">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Locations & Coverage Add-Ons</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Physical Locations</span>
          <Badge variant="outline" data-testid="text-location-count">{data.locationsCount} of {data.maxLocations}</Badge>
        </div>

        {data.locations.length > 0 && (
          <div className="space-y-1">
            {data.locations.map(loc => (
              <div key={loc.id} className="flex items-center gap-2 text-sm rounded-lg border p-2" data-testid={`location-row-${loc.id}`}>
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{loc.label || [loc.street, loc.city].filter(Boolean).join(", ") || "Location"}</span>
                {loc.isPrimary && <Badge variant="default" className="text-xs">Primary</Badge>}
              </div>
            ))}
          </div>
        )}

        {data.locationsCount < data.maxLocations ? (
          <>
            {!showAddLocation ? (
              <Button size="sm" variant="outline" onClick={() => setShowAddLocation(true)} data-testid="button-add-location">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Location ({formatPrice(data.pricing.PHYSICAL_LOCATION)}/yr)
              </Button>
            ) : (
              <div className="space-y-2 border rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input value={locLabel} onChange={e => setLocLabel(e.target.value)} placeholder="e.g. South End" data-testid="input-loc-label" />
                  </div>
                  <div>
                    <Label className="text-xs">Street</Label>
                    <Input value={locStreet} onChange={e => setLocStreet(e.target.value)} data-testid="input-loc-street" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input value={locCity} onChange={e => setLocCity(e.target.value)} data-testid="input-loc-city" />
                  </div>
                  <div>
                    <Label className="text-xs">State</Label>
                    <Input value={locState} onChange={e => setLocState(e.target.value)} data-testid="input-loc-state" />
                  </div>
                  <div>
                    <Label className="text-xs">ZIP</Label>
                    <Input value={locZip} onChange={e => setLocZip(e.target.value)} data-testid="input-loc-zip" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => requestAddon.mutate({
                    addonType: "PHYSICAL_LOCATION",
                    locationData: { label: locLabel, street: locStreet, city: locCity, state: locState, zip: locZip },
                  })} disabled={requestAddon.isPending} data-testid="button-submit-location">
                    {requestAddon.isPending ? "Submitting..." : `Add Location (${formatPrice(data.pricing.PHYSICAL_LOCATION)}/yr)`}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddLocation(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Maximum {data.maxLocations} self-serve locations reached.
            <Button size="sm" variant="link" className="h-auto p-0" onClick={() => requestAddon.mutate({ addonType: "PHYSICAL_LOCATION" })} data-testid="button-enterprise-inquiry">
              Contact us for franchise pricing
            </Button>
          </div>
        )}
      </div>

      <div className="border-t pt-3 space-y-2">
        <p className="text-sm font-medium">Hub Visibility</p>
        {data.hubVisibility.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.hubVisibility.map(h => (
              <Badge key={h.id} variant="secondary" data-testid={`hub-vis-${h.id}`}>{h.hubName}</Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Appear in additional hubs without a physical location — {formatPrice(data.pricing.EXTRA_HUB_VISIBILITY)}/yr per hub
        </p>
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Metro-Wide Coverage</p>
          {data.hasMetroWide ? (
            <Badge variant="default" data-testid="badge-metro-active">Active</Badge>
          ) : (
            <Badge variant="outline" data-testid="badge-metro-inactive">Not Active</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Be visible across the entire metro — {formatPrice(data.pricing.METRO_WIDE)}/yr
        </p>
        {!data.hasMetroWide && (
          <Button size="sm" variant="outline" onClick={() => requestAddon.mutate({ addonType: "METRO_WIDE" })} disabled={requestAddon.isPending} data-testid="button-request-metro">
            Request Metro-Wide Coverage
          </Button>
        )}
      </div>

      {data.activeSubscriptions.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Active Add-On Subscriptions</p>
          {data.activeSubscriptions.map(sub => (
            <div key={sub.id} className="flex items-center justify-between text-sm" data-testid={`addon-sub-${sub.id}`}>
              <span>{sub.addonType.replace(/_/g, " ")}</span>
              <Badge variant={sub.status === "ACTIVE" ? "default" : "outline"}>{sub.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface CoverageZone {
  id: string;
  name: string;
  slug: string;
}

interface CoverageRecord {
  id: string;
  coverageType: string;
  targetId: string;
  targetName: string;
}

interface CoverageData {
  coverage: CoverageRecord[];
  zones: CoverageZone[];
  primaryZoneId: string | null;
}

function CoverageSection({ citySlug, slug, business, tier }: { citySlug: string; slug: string; business: Business; tier: string }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [selectedZone, setSelectedZone] = useState("");
  const hasAccess = tierAtLeast(tier as EntitlementTier, "ENHANCED");

  const { data, isLoading } = useQuery<CoverageData>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "coverage"],
    enabled: hasAccess,
  });

  const addMutation = useMutation({
    mutationFn: async (targetId: string) => {
      await apiRequest("POST", `/api/cities/${citySlug}/owner/${slug}/coverage`, { coverageType: "HUB", targetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug, "coverage"] });
      setSelectedZone("");
      toast({ title: t("owner.coverageAdded") });
    },
    onError: () => {
      toast({ title: t("toast.error"), description: t("owner.couldNotAddCoverage"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (coverageId: string) => {
      await apiRequest("DELETE", `/api/cities/${citySlug}/owner/${slug}/coverage/${coverageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug, "coverage"] });
      toast({ title: t("owner.coverageRemoved") });
    },
    onError: () => {
      toast({ title: t("toast.error"), description: t("owner.couldNotRemoveCoverage"), variant: "destructive" });
    },
  });

  if (!hasAccess) return null;
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return null;

  const primaryZone = data.zones.find(z => z.id === data.primaryZoneId);
  const existingTargetIds = new Set([data.primaryZoneId, ...data.coverage.map(c => c.targetId)].filter(Boolean));
  const availableZones = data.zones.filter(z => !existingTargetIds.has(z.id));

  return (
    <Card className="p-5 space-y-4" data-testid="section-coverage">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{t("owner.coverageZones")}</h3>
      </div>

      {primaryZone && (
        <div className="flex items-center gap-2" data-testid="coverage-primary-hub">
          <Badge variant="default">{t("owner.primaryHub")}</Badge>
          <span className="text-sm font-medium">{primaryZone.name}</span>
        </div>
      )}

      {data.coverage.length > 0 && (
        <div className="space-y-2">
          {data.coverage.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border p-3" data-testid={`coverage-row-${c.id}`}>
              <div className="text-sm">
                <span className="font-medium">{c.targetName}</span>
                <Badge variant="outline" className="ml-2">{c.coverageType}</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(c.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-coverage-${c.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {availableZones.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-48" data-testid="select-coverage-zone">
              <SelectValue placeholder={t("owner.selectZone")} />
            </SelectTrigger>
            <SelectContent>
              {availableZones.map(z => (
                <SelectItem key={z.id} value={z.id} data-testid={`option-zone-${z.id}`}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => { if (selectedZone) addMutation.mutate(selectedZone); }}
            disabled={!selectedZone || addMutation.isPending}
            data-testid="button-add-coverage"
          >
            {addMutation.isPending ? t("owner.adding") : t("owner.addCoverage")}
          </Button>
        </div>
      )}
    </Card>
  );
}

interface DomainData {
  domain: string | null;
  domainIncluded: boolean;
  setupFee: number;
  tier: string;
  status?: string;
}

function DomainConnectSection({ citySlug, slug, tier }: { citySlug: string; slug: string; tier: string }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [domainInput, setDomainInput] = useState("");
  const hasAccess = tierAtLeast(tier as EntitlementTier, "ENHANCED");

  const { data, isLoading } = useQuery<DomainData>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "domain"],
    enabled: hasAccess,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/cities/${citySlug}/owner/${slug}/domain`, { domain: domainInput });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug, "domain"] });
      setDomainInput("");
      toast({ title: t("owner.domainConnected") });
    },
    onError: () => {
      toast({ title: t("toast.error"), description: t("owner.couldNotConnectDomain"), variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/cities/${citySlug}/owner/${slug}/domain/verify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug, "domain"] });
      toast({ title: t("owner.dnsVerificationInitiated") });
    },
    onError: () => {
      toast({ title: t("toast.error"), description: t("owner.dnsVerificationFailed"), variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/cities/${citySlug}/owner/${slug}/domain`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "owner", slug, "domain"] });
      toast({ title: t("owner.domainRemoved") });
    },
    onError: () => {
      toast({ title: t("toast.error"), description: t("owner.couldNotRemoveDomain"), variant: "destructive" });
    },
  });

  if (!hasAccess) return null;
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return null;

  return (
    <Card className="p-5 space-y-4" data-testid="section-domain">
      <div className="flex items-center gap-2">
        <Wifi className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{t("owner.customDomain")}</h3>
      </div>

      {!data.domain ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder={t("owner.domainPlaceholder")}
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="flex-1 min-w-[200px]"
              data-testid="input-domain"
            />
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={!domainInput.trim() || connectMutation.isPending}
              data-testid="button-connect-domain"
            >
              {connectMutation.isPending ? t("owner.connecting") : t("owner.connectDomain")}
            </Button>
          </div>
          {!data.domainIncluded && (
            <p className="text-xs text-muted-foreground" data-testid="text-domain-fee">{t("owner.domainSetupFee")}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium" data-testid="text-domain-name">{data.domain}</span>
            <Badge variant={data.status === "VERIFIED" ? "default" : "secondary"} data-testid="badge-domain-status">
              {data.status || t("owner.pendingVerification")}
            </Badge>
          </div>

          <div className="rounded-lg border p-3 text-sm space-y-1" data-testid="dns-instructions">
            <p className="font-medium">{t("owner.dnsConfig")}</p>
            <p className="text-muted-foreground">{t("owner.dnsInstruction")} <span className="font-mono text-xs">proxy.citycityhub.com</span></p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
              data-testid="button-verify-dns"
            >
              {verifyMutation.isPending ? t("owner.verifying") : t("owner.verifyDns")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              data-testid="button-remove-domain"
            >
              {removeMutation.isPending ? t("owner.removing") : t("owner.removeDomain")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

interface EntitlementStatus {
  tier: string;
  status: string;
  founderRateLocked: boolean;
  founderPrice: number | null;
  inGracePeriod: boolean;
  graceDaysRemaining: number | null;
  endAt: string | null;
  graceExpiresAt: string | null;
}

function GraceStatusSection({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery<EntitlementStatus>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "entitlement-status"],
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data || data.status === "NONE") return null;

  return (
    <Card className="p-5 space-y-3" data-testid="section-grace-status">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{t("owner.subscriptionStatus")}</h3>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {data.founderRateLocked && (
          <Badge variant="default" className="bg-green-600" data-testid="badge-founder-rate">{t("owner.founderRateLocked")}</Badge>
        )}

        {data.status === "ACTIVE" && (
          <>
            <Badge variant="default" data-testid="badge-status-active">{t("owner.statusActive")}</Badge>
            {data.endAt && (
              <span className="text-sm text-muted-foreground" data-testid="text-renewal-date">
                {t("owner.renews")} {new Date(data.endAt).toLocaleDateString()}
              </span>
            )}
          </>
        )}

        {data.status === "EXPIRED" && !data.inGracePeriod && (
          <Badge variant="destructive" data-testid="badge-status-expired">{t("owner.statusExpired")}</Badge>
        )}
      </div>

      {data.inGracePeriod && data.graceDaysRemaining != null && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 flex items-start gap-2" data-testid="card-grace-warning">
          <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-medium">{t("owner.gracePeriod", { days: String(data.graceDaysRemaining) })}</span>{" "}
            <span className="text-muted-foreground">{t("owner.renewFounderRate")}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

interface OwnerExpertShow {
  id: string;
  showTitle: string;
  expertName: string;
  segmentType: string;
  status: string;
  dayOfWeek: string[];
  startTime: string;
  durationMinutes: number;
  createdAt: string;
}

const OWNER_SEGMENT_TYPES = [
  { value: "general", label: "General" },
  { value: "real_estate_update", label: "Real Estate Update" },
  { value: "health_tips", label: "Health Tips" },
  { value: "small_business_strategy", label: "Small Business Strategy" },
  { value: "restaurant_highlights", label: "Restaurant Highlights" },
];

const OWNER_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function ExpertShowRequestSection() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [expertName, setExpertName] = useState("");
  const [showTitle, setShowTitle] = useState("");
  const [showDescription, setShowDescription] = useState("");
  const [segmentType, setSegmentType] = useState("general");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("12:00");
  const [durationMinutes, setDurationMinutes] = useState("15");

  const { data: existingShows } = useQuery<OwnerExpertShow[]>({
    queryKey: ["/api/owner/expert-shows"],
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/owner/expert-shows/request", {
        expertName,
        showTitle,
        showDescription: showDescription || null,
        segmentType,
        dayOfWeek: selectedDays,
        startTime,
        durationMinutes: parseInt(durationMinutes) || 15,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/expert-shows"] });
      toast({ title: "Expert show request submitted" });
      setShowForm(false);
      setExpertName("");
      setShowTitle("");
      setShowDescription("");
      setSegmentType("general");
      setSelectedDays([]);
      setStartTime("12:00");
      setDurationMinutes("15");
    },
    onError: () => {
      toast({ title: "Error submitting request", variant: "destructive" });
    },
  });

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <Card className="p-5 space-y-4" data-testid="section-expert-shows">
      <div className="flex items-center gap-2">
        <Tv className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Hub TV Expert Shows</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Request a recurring expert show segment on Hub TV. Share your expertise with the community through scheduled broadcasts.
      </p>

      {existingShows && existingShows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your Show Requests</p>
          {existingShows.map(show => (
            <div key={show.id} className="flex items-center justify-between gap-2 border rounded-md p-3" data-testid={`card-expert-show-${show.id}`}>
              <div>
                <p className="text-sm font-medium">{show.showTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {show.expertName} &middot; {show.segmentType.replace(/_/g, " ")} &middot;{" "}
                  {show.dayOfWeek?.length > 0 ? show.dayOfWeek.map(d => d.slice(0, 3)).join(", ") : "All days"}{" "}
                  at {show.startTime}
                </p>
              </div>
              <Badge
                variant={show.status === "active" ? "default" : show.status === "cancelled" ? "destructive" : "secondary"}
                data-testid={`badge-owner-show-status-${show.id}`}
              >
                {show.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2" data-testid="button-request-expert-show">
          <Plus className="h-4 w-4" /> Request Expert Show
        </Button>
      ) : (
        <div className="space-y-4 border rounded-md p-4">
          <div className="space-y-2">
            <Label className="text-sm">Show Title</Label>
            <Input value={showTitle} onChange={e => setShowTitle(e.target.value)} placeholder="Weekly Market Update" data-testid="input-owner-show-title" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Your Name / Expert Name</Label>
            <Input value={expertName} onChange={e => setExpertName(e.target.value)} placeholder="John Smith" data-testid="input-owner-expert-name" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Description</Label>
            <Textarea value={showDescription} onChange={e => setShowDescription(e.target.value)} placeholder="Brief description of your show..." className="resize-none" rows={2} data-testid="input-owner-show-description" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Segment Type</Label>
            <Select value={segmentType} onValueChange={setSegmentType}>
              <SelectTrigger data-testid="select-owner-segment-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OWNER_SEGMENT_TYPES.map(st => (
                  <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Preferred Days</Label>
            <div className="flex flex-wrap gap-2">
              {OWNER_DAYS.map(day => (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={selectedDays.includes(day) ? "default" : "outline"}
                  onClick={() => toggleDay(day)}
                  data-testid={`button-owner-day-${day}`}
                >
                  {day.slice(0, 3).toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Preferred Start Time</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} data-testid="input-owner-start-time" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Duration (minutes)</Label>
              <Input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} data-testid="input-owner-duration" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !showTitle || !expertName}
              data-testid="button-submit-expert-show"
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Submit Request
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} data-testid="button-cancel-expert-show">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

interface BillingData {
  currentTier: string;
  entitlementStatus: string;
  founderRateLocked: boolean;
  founderPrice: number | null;
  graceExpiresAt: string | null;
  transactions: { id: string; date: string; amount: number; type: string; method: string; notes: string | null }[];
  entitlementHistory: { id: string; productType: string; status: string; startAt: string | null; endAt: string | null; metadata: Record<string, string> | null; founderRateLocked: boolean; founderPrice: number | null }[];
  crownPayments: { amount: number; paidAt: string; sessionId: string }[];
}

function formatCentsOwner(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateOwner(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function BillingSection({ citySlug, slug }: { citySlug: string; slug: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: billing, isLoading } = useQuery<BillingData>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "billing"],
    enabled: expanded,
  });

  const statusLabels: Record<string, string> = {
    ACTIVE: "Active",
    EXPIRED: "Expired",
    CANCELED: "Canceled",
    GRACE: "Grace Period",
    NONE: "No Subscription",
  };

  const productLabels: Record<string, string> = {
    LISTING_TIER: "Listing Tier",
    FEATURED_PLACEMENT: "Featured Placement",
    SPONSORSHIP: "Sponsorship",
    SPOTLIGHT: "Spotlight",
    CONTRIBUTOR_PACKAGE: "Contributor Package",
  };

  return (
    <Card className="p-5 space-y-4" data-testid="section-billing">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-billing"
      >
        <Receipt className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold flex-1">Billing & Transactions</h3>
        <Badge variant="outline" className="text-xs">{expanded ? "Hide" : "Show"}</Badge>
      </button>

      {expanded && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : billing ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Current Tier</p>
                    <p className="font-semibold text-sm" data-testid="text-billing-tier">{billing.currentTier}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-semibold text-sm" data-testid="text-billing-status">
                      {statusLabels[billing.entitlementStatus] || billing.entitlementStatus}
                    </p>
                  </div>
                </div>
                {billing.founderRateLocked && billing.founderPrice && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Founder Rate</p>
                      <p className="font-semibold text-sm" data-testid="text-founder-rate">{formatCentsOwner(billing.founderPrice)}/mo</p>
                    </div>
                  </div>
                )}
              </div>

              {billing.transactions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <DollarSign className="h-4 w-4" /> Payment History
                  </h4>
                  <div className="space-y-2">
                    {billing.transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm" data-testid={`row-billing-tx-${tx.id}`}>
                        <div>
                          <p className="font-medium">{tx.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDateOwner(tx.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold" data-testid={`text-billing-amount-${tx.id}`}>{formatCentsOwner(tx.amount)}</p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-billing-method-${tx.id}`}>{tx.method}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {billing.crownPayments.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Crown Program Payments</h4>
                  <div className="space-y-2">
                    {billing.crownPayments.map((cp, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm" data-testid={`row-crown-payment-${i}`}>
                        <div>
                          <p className="font-medium">Crown Verification Fee</p>
                          <p className="text-xs text-muted-foreground">{formatDateOwner(cp.paidAt)}</p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <p className="font-semibold" data-testid={`text-crown-amount-${i}`}>{formatCentsOwner(cp.amount)}</p>
                          <Badge variant="default">Verified</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {billing.entitlementHistory.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Subscription History</h4>
                  <div className="space-y-2">
                    {billing.entitlementHistory.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm" data-testid={`row-entitlement-${e.id}`}>
                        <div>
                          <p className="font-medium">{productLabels[e.productType] || e.productType}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateOwner(e.startAt)} - {e.endAt ? formatDateOwner(e.endAt) : "Ongoing"}
                          </p>
                        </div>
                        <Badge variant={e.status === "ACTIVE" ? "default" : "secondary"} data-testid={`badge-entitlement-status-${e.id}`}>
                          {statusLabels[e.status] || e.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {billing.transactions.length === 0 && billing.crownPayments.length === 0 && billing.entitlementHistory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-billing-empty">No billing history yet.</p>
              )}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function OwnerEntitlementSection() {
  const [expanded, setExpanded] = useState(false);

  const { data: summary, isLoading } = useQuery<{
    hubs: Array<{
      id: string; hubId: string; status: string; isBaseHub: boolean; billingInterval: string;
      categories: Array<{
        id: string; categoryId: string; status: string; isBaseCategory: boolean;
        micros: Array<{ id: string; microId: string; status: string; isBaseMicro: boolean }>;
      }>;
      capabilities: Array<{ id: string; capabilityType: string; status: string }>;
    }>;
    creditWallet: { monthlyBalance: number; bankedBalance: number } | null;
  }>({
    queryKey: ["/api/owner/entitlement-summary"],
  });

  if (isLoading) return <Skeleton className="h-12 w-full" />;

  if (!summary || summary.hubs.length === 0) {
    return (
      <LockedFeatureCard
        title="Presence Plan"
        description="You don't have an active presence plan yet. Subscribe to unlock hub placement, category listings, and monthly credits for your business."
        actionLabel="View Plans"
        onAction={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />
    );
  }

  const allCapTypes = ["JOBS", "MARKETPLACE", "CREATOR", "EXPERT", "EVENTS", "PROVIDER", "COMMUNITY"];

  const capLabels: Record<string, string> = {
    JOBS: "Employer Tools",
    MARKETPLACE: "Social Selling",
    CREATOR: "Creator & Media",
    EXPERT: "Ask-an-Expert",
    EVENTS: "Event Posting",
    PROVIDER: "Provider Tools",
    COMMUNITY: "Community",
  };

  return (
    <Card className="p-5 space-y-3" data-testid="section-owner-entitlements">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-entitlements"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">My Presence Plan</h3>
        </div>
        <Button variant="ghost" size="sm">
          {expanded ? "Hide" : "Show Details"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {summary.hubs.map((hub) => (
          <Badge key={hub.id} variant={hub.status === "ACTIVE" ? "default" : "secondary"} data-testid={`badge-hub-${hub.id}`}>
            Hub {hub.isBaseHub ? "(Base)" : "(Add-on)"} - {hub.billingInterval}
          </Badge>
        ))}
        {summary.hubs.flatMap(h => h.capabilities).map((cap) => (
          <Badge key={cap.id} variant="outline" data-testid={`badge-cap-${cap.capabilityType}`}>
            {capLabels[cap.capabilityType] || cap.capabilityType}
          </Badge>
        ))}
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t">
          {summary.hubs.map((hub) => (
            <div key={hub.id} className="space-y-2" data-testid={`detail-hub-${hub.id}`}>
              <div className="flex items-center gap-2">
                <Badge variant={hub.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                  {hub.status}
                </Badge>
                <span className="text-sm font-medium">
                  Hub Entitlement {hub.isBaseHub ? "(Included)" : "(Add-on)"}
                </span>
              </div>

              {hub.categories.length > 0 && (
                <div className="ml-4 space-y-1">
                  {hub.categories.map((cat) => (
                    <div key={cat.id} className="border-l-2 pl-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">
                          Category {cat.isBaseCategory ? "(Included)" : "(Add-on)"}
                        </span>
                        <Badge variant={cat.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                          {cat.status}
                        </Badge>
                      </div>
                      {cat.micros.length > 0 && (
                        <div className="ml-3 mt-1 flex flex-wrap gap-1">
                          {cat.micros.map((micro) => (
                            <Badge key={micro.id} variant="outline" className="text-[10px]">
                              Micro {micro.isBaseMicro ? "(Incl)" : "(Add-on)"}: {micro.status}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="ml-4 flex flex-wrap gap-1">
                {hub.capabilities.map((cap) => (
                  <Badge key={cap.id} variant="outline" className="text-[10px]">
                    {capLabels[cap.capabilityType] || cap.capabilityType}
                  </Badge>
                ))}
                {allCapTypes.filter(ct => !hub.capabilities.some(c => c.capabilityType === ct)).map((ct) => (
                  <Badge key={ct} variant="secondary" className="text-[10px] opacity-50">
                    <Lock className="h-3 w-3 mr-1" />
                    {capLabels[ct] || ct}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function OwnerCreditWalletSection() {
  const [showTransactions, setShowTransactions] = useState(false);

  const { data: balance, isLoading: balanceLoading } = useQuery<{ monthly: number; banked: number; total: number }>({
    queryKey: ["/api/owner/credit-balance"],
  });

  const { data: transactions } = useQuery<Array<{
    id: string; txType: string; amount: number;
    balanceAfterMonthly: number; balanceAfterBanked: number;
    actionType: string | null; note: string | null; createdAt: string;
  }>>({
    queryKey: ["/api/owner/credit-transactions"],
    enabled: showTransactions,
  });

  if (balanceLoading) return <Skeleton className="h-12 w-full" />;
  if (!balance) return null;

  const txTypeLabels: Record<string, string> = {
    MONTHLY_GRANT: "Monthly Grant",
    PURCHASED: "Purchased",
    SPEND: "Spent",
    EXPIRATION: "Expired",
    ADMIN_GRANT: "Admin Grant",
    REFUND: "Refund",
  };

  return (
    <Card className="p-5 space-y-3" data-testid="section-owner-credit-wallet">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Credit Wallet</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xl font-bold" data-testid="text-owner-monthly-credits">{balance.monthly}</p>
          <p className="text-xs text-muted-foreground">Monthly</p>
        </div>
        <div>
          <p className="text-xl font-bold" data-testid="text-owner-banked-credits">{balance.banked}</p>
          <p className="text-xs text-muted-foreground">Banked</p>
        </div>
        <div>
          <p className="text-xl font-bold" data-testid="text-owner-total-credits">{balance.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowTransactions(!showTransactions)}
        data-testid="button-toggle-credit-history"
      >
        {showTransactions ? "Hide History" : "View History"}
      </Button>

      {showTransactions && transactions && transactions.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Date</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-right p-2 font-medium">Amount</th>
                <th className="text-left p-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t" data-testid={`row-owner-tx-${tx.id}`}>
                  <td className="p-2">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="p-2">
                    <Badge variant={tx.amount > 0 ? "default" : "secondary"} className="text-[10px]">
                      {txTypeLabels[tx.txType] || tx.txType}
                    </Badge>
                  </td>
                  <td className="p-2 text-right font-mono">
                    <span className={tx.amount > 0 ? "text-green-600" : "text-red-500"}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground truncate max-w-[150px]">{tx.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTransactions && transactions && transactions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3" data-testid="text-no-transactions">No transaction history yet.</p>
      )}
    </Card>
  );
}

interface OwnerEvent {
  id: string;
  title: string;
  slug: string;
  start_date_time: string | null;
  end_date_time: string | null;
  visibility: string;
  rsvp_enabled: boolean;
  attending_count: string;
  maybe_count: string;
  invitation_count: string;
}

function OwnerCreateEventForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [costText, setCostText] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [maxCapacity, setMaxCapacity] = useState("");
  const [ticketTypes, setTicketTypes] = useState<{ name: string; priceDisplay: string; externalCheckoutUrl: string; quantity: number | null; saleStartAt: string; saleEndAt: string }[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketName, setTicketName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [ticketCheckoutUrl, setTicketCheckoutUrl] = useState("");
  const [ticketQuantity, setTicketQuantity] = useState("");
  const [ticketSaleStart, setTicketSaleStart] = useState("");
  const [ticketSaleEnd, setTicketSaleEnd] = useState("");

  const addTicketType = () => {
    if (!ticketName) return;
    setTicketTypes(prev => [...prev, {
      name: ticketName,
      priceDisplay: ticketPrice || "Free",
      externalCheckoutUrl: ticketCheckoutUrl,
      quantity: ticketQuantity ? parseInt(ticketQuantity) : null,
      saleStartAt: ticketSaleStart || "",
      saleEndAt: ticketSaleEnd || "",
    }]);
    setTicketName("");
    setTicketPrice("");
    setTicketCheckoutUrl("");
    setTicketQuantity("");
    setTicketSaleStart("");
    setTicketSaleEnd("");
    setShowTicketForm(false);
  };

  const removeTicketType = (idx: number) => {
    setTicketTypes(prev => prev.filter((_, i) => i !== idx));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/owner/events", {
        title,
        description: description || null,
        startDateTime: startDateTime ? new Date(startDateTime).toISOString() : null,
        endDateTime: endDateTime ? new Date(endDateTime).toISOString() : null,
        locationName: locationName || null,
        address: address || null,
        costText: costText || null,
        visibility,
        rsvpEnabled,
        maxCapacity: maxCapacity ? parseInt(maxCapacity) : null,
        ticketTypes: ticketTypes.length > 0 ? ticketTypes : undefined,
      });
      return resp;
    },
    onSuccess: () => {
      toast({ title: "Event created as draft. It will be reviewed before publishing." });
      onSuccess();
    },
    onError: (e: Error) => {
      toast({ title: "Cannot create event", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card className="p-4 border-primary/20 bg-primary/5 space-y-3" data-testid="form-create-event">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create New Event
        </h4>
        <Button size="sm" variant="ghost" onClick={onClose} data-testid="button-cancel-create">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Event Title *</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Summer Music Festival" data-testid="input-create-title" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What is your event about?" data-testid="input-create-description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Start Date/Time *</Label>
          <Input type="datetime-local" value={startDateTime} onChange={e => setStartDateTime(e.target.value)} data-testid="input-create-start" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End Date/Time</Label>
          <Input type="datetime-local" value={endDateTime} onChange={e => setEndDateTime(e.target.value)} data-testid="input-create-end" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Location Name</Label>
          <Input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Venue name" data-testid="input-create-location" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Address</Label>
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address" data-testid="input-create-address" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Cost</Label>
          <Input value={costText} onChange={e => setCostText(e.target.value)} placeholder="Free, $10, etc." data-testid="input-create-cost" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger data-testid="select-create-visibility"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Max Capacity</Label>
          <Input type="number" value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)} placeholder="Unlimited" data-testid="input-create-capacity" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={rsvpEnabled} onChange={e => setRsvpEnabled(e.target.checked)} className="rounded" data-testid="checkbox-create-rsvp" />
          Enable RSVPs
        </label>
      </div>
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Ticket Types</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowTicketForm(true)} data-testid="button-add-ticket-type">
            <Plus className="h-3 w-3 mr-1" /> Add Ticket Type
          </Button>
        </div>
        {ticketTypes.length > 0 && (
          <div className="space-y-1.5">
            {ticketTypes.map((tt, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 border rounded text-sm bg-background" data-testid={`ticket-type-preview-${idx}`}>
                <div>
                  <span className="font-medium">{tt.name}</span>
                  <span className="text-muted-foreground ml-2">{tt.priceDisplay}</span>
                  {tt.quantity && <span className="text-xs text-muted-foreground ml-1">({tt.quantity} available)</span>}
                  {tt.externalCheckoutUrl && <span className="text-xs text-blue-500 ml-2">(external link)</span>}
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeTicketType(idx)} data-testid={`button-remove-ticket-${idx}`}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {showTicketForm && (
          <div className="p-3 border rounded space-y-2 bg-background">
            <div className="space-y-1">
              <Label className="text-xs">Ticket Name *</Label>
              <Input value={ticketName} onChange={e => setTicketName(e.target.value)} placeholder="e.g., General Admission" className="h-8 text-sm" data-testid="input-ticket-name" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Price Display</Label>
                <Input value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} placeholder="Free, $10, $25-$50" className="h-8 text-sm" data-testid="input-ticket-price" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quantity (Cap)</Label>
                <Input type="number" value={ticketQuantity} onChange={e => setTicketQuantity(e.target.value)} placeholder="Unlimited" className="h-8 text-sm" data-testid="input-ticket-quantity" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Checkout URL</Label>
                <Input value={ticketCheckoutUrl} onChange={e => setTicketCheckoutUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm" data-testid="input-ticket-url" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Sale Start</Label>
                <Input type="datetime-local" value={ticketSaleStart} onChange={e => setTicketSaleStart(e.target.value)} className="h-8 text-sm" data-testid="input-ticket-sale-start" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sale End</Label>
                <Input type="datetime-local" value={ticketSaleEnd} onChange={e => setTicketSaleEnd(e.target.value)} className="h-8 text-sm" data-testid="input-ticket-sale-end" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowTicketForm(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={addTicketType} disabled={!ticketName} data-testid="button-save-ticket-type">Add</Button>
            </div>
          </div>
        )}
        {ticketTypes.length === 0 && !showTicketForm && (
          <p className="text-xs text-muted-foreground">No ticket types added. Event will be free/RSVP only.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Your event will be created as a draft and submitted for review before publishing.</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} data-testid="button-cancel-create-event">Cancel</Button>
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={!title || !startDateTime || createMutation.isPending} data-testid="button-submit-create-event">
          {createMutation.isPending ? "Creating..." : "Create Event"}
        </Button>
      </div>
    </Card>
  );
}

interface OwnerRsvp {
  id: string;
  name: string | null;
  email: string | null;
  response: string;
  created_at: string;
}

interface OwnerInvitation {
  id: string;
  email: string;
  name: string | null;
  invite_token: string;
  status: string;
  created_at: string;
}

function OwnerEventsSection({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: events, isLoading } = useQuery<OwnerEvent[]>({
    queryKey: ["/api/owner/events"],
  });

  const { data: rsvps } = useQuery<OwnerRsvp[]>({
    queryKey: ["/api/owner/events", expandedEvent, "rsvps"],
    queryFn: async () => {
      if (!expandedEvent) return [];
      const resp = await fetch(`/api/owner/events/${expandedEvent}/rsvps`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!expandedEvent,
  });

  const { data: invitations } = useQuery<OwnerInvitation[]>({
    queryKey: ["/api/owner/events", expandedEvent, "invitations"],
    queryFn: async () => {
      if (!expandedEvent) return [];
      const resp = await fetch(`/api/owner/events/${expandedEvent}/invitations`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!expandedEvent,
  });

  const sendInvitesMutation = useMutation({
    mutationFn: async () => {
      if (!expandedEvent || !inviteEmails.trim()) return;
      const parsed = inviteEmails.split(/[\n,;]+/).map(line => {
        const parts = line.trim().split(/,\s*/);
        return { email: parts[0]?.trim(), name: parts[1]?.trim() || null };
      }).filter(inv => inv.email);
      const resp = await apiRequest("POST", `/api/owner/events/${expandedEvent}/invitations`, { invitations: parsed });
      return resp.json();
    },
    onSuccess: (data: Record<string, unknown> | undefined) => {
      setInviteEmails("");
      queryClient.invalidateQueries({ queryKey: ["/api/owner/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/events", expandedEvent, "invitations"] });
      toast({ title: `${data?.created || 0} invitation(s) sent` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send invitations", description: err.message, variant: "destructive" });
    },
  });

  const copyEventLink = (eventSlug: string) => {
    const url = `${window.location.origin}/${citySlug}/events/${eventSlug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Event link copied" });
  };

  const copyInviteLink = (eventSlug: string, token: string) => {
    const url = `${window.location.origin}/${citySlug}/events/${eventSlug}?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Invite link copied" });
  };

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  return (
    <Card className="p-5 space-y-3" data-testid="section-owner-events">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">My Events</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{(events || []).length} events</Badge>
          <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-create-event">
            <Plus className="h-3.5 w-3.5 mr-1" /> Create Event
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <OwnerCreateEventForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/owner/events"] });
          }}
        />
      )}

      {(!events || events.length === 0) && !showCreateForm ? (
        <div className="text-center py-6 space-y-3" data-testid="text-no-owner-events">
          <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No events yet. Create your first event to get started.</p>
          <Button size="sm" variant="outline" onClick={() => setShowCreateForm(true)} data-testid="button-create-first-event">
            <Plus className="h-3.5 w-3.5 mr-1" /> Create Your First Event
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(evt => {
            const isPast = evt.start_date_time ? new Date(evt.start_date_time) < new Date() : false;
            const isExpanded = expandedEvent === evt.id;
            return (
              <div key={evt.id} className="rounded-md border" data-testid={`owner-event-${evt.id}`}>
                <div
                  className="flex items-center justify-between gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedEvent(isExpanded ? null : evt.id)}
                  data-testid={`button-expand-event-${evt.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{evt.title}</span>
                      {isPast && <Badge variant="secondary" className="text-[10px]">Past</Badge>}
                      {evt.visibility !== "public" && (
                        <Badge variant="outline" className="text-[10px] capitalize">{evt.visibility}</Badge>
                      )}
                    </div>
                    {evt.start_date_time && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(evt.start_date_time).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-green-500" />
                        {evt.attending_count} attending
                      </span>
                      {parseInt(evt.maybe_count) > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-yellow-500" />
                          {evt.maybe_count} maybe
                        </span>
                      )}
                      {parseInt(evt.invitation_count) > 0 && (
                        <span className="flex items-center gap-1">
                          {evt.invitation_count} invited
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); copyEventLink(evt.slug); }} data-testid={`button-copy-event-link-${evt.id}`}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-2 space-y-3">
                    {evt.rsvp_enabled && rsvps && rsvps.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">RSVPs ({rsvps.length})</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {rsvps.map(r => (
                            <div key={r.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30" data-testid={`rsvp-row-${r.id}`}>
                              <span>{r.name || r.email || "Guest"}</span>
                              <Badge variant={r.response === "attending" ? "default" : "secondary"} className="text-[10px]">
                                {r.response}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {evt.visibility === "private" && (
                      <div>
                        <p className="text-xs font-medium mb-1">Send Invitations</p>
                        <textarea
                          className="w-full min-h-[60px] rounded-md border px-2 py-1.5 text-xs bg-background"
                          value={inviteEmails}
                          onChange={e => setInviteEmails(e.target.value)}
                          placeholder={"email@example.com, Name\nemail2@example.com"}
                          data-testid="input-owner-invite-emails"
                        />
                        <p className="text-[10px] text-muted-foreground mb-1">1 credit per batch of 25</p>
                        <Button
                          size="sm"
                          onClick={() => sendInvitesMutation.mutate()}
                          disabled={sendInvitesMutation.isPending || !inviteEmails.trim()}
                          data-testid="button-owner-send-invites"
                        >
                          {sendInvitesMutation.isPending ? "Sending..." : "Send Invitations"}
                        </Button>
                      </div>
                    )}

                    {invitations && invitations.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Invitations ({invitations.length})</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {invitations.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30" data-testid={`inv-row-${inv.id}`}>
                              <span className="truncate">{inv.name ? `${inv.name} (${inv.email})` : inv.email}</span>
                              <div className="flex items-center gap-1">
                                <Badge variant={inv.status === "accepted" ? "default" : "secondary"} className="text-[10px]">
                                  {inv.status}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyInviteLink(evt.slug, inv.invite_token)} data-testid={`button-copy-inv-${inv.id}`}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {evt.rsvp_enabled && rsvps && rsvps.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No RSVPs yet</p>
                    )}

                    <Tabs defaultValue="sponsors" className="mt-2">
                      <TabsList className="h-8">
                        <TabsTrigger value="sponsors" className="text-xs" data-testid={`tab-owner-sponsors-${evt.id}`}>
                          <Star className="h-3 w-3 mr-1" /> Sponsors
                        </TabsTrigger>
                        <TabsTrigger value="vendors" className="text-xs" data-testid={`tab-owner-vendors-${evt.id}`}>
                          <Store className="h-3 w-3 mr-1" /> Vendors
                        </TabsTrigger>
                        <TabsTrigger value="earnings" className="text-xs" data-testid={`tab-owner-earnings-${evt.id}`}>
                          <Ticket className="h-3 w-3 mr-1" /> Earnings
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="sponsors" className="mt-2">
                        <EventSponsorsTab eventId={evt.id} apiPrefix="/api/owner" />
                      </TabsContent>
                      <TabsContent value="vendors" className="mt-2">
                        <EventVendorsTab eventId={evt.id} apiPrefix="/api/owner" />
                      </TabsContent>
                      <TabsContent value="earnings" className="mt-2">
                        <OwnerEventEarnings eventId={evt.id} />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function OwnerEventEarnings({ eventId }: { eventId: string }) {
  const { data: earnings, isLoading } = useQuery<any>({
    queryKey: ["/api/owner/events", eventId, "earnings"],
    queryFn: async () => {
      const resp = await fetch(`/api/owner/events/${eventId}/earnings`);
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: !!eventId,
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!earnings) return <p className="text-xs text-muted-foreground">No ticket sales data</p>;

  return (
    <div className="space-y-2" data-testid={`earnings-${eventId}`}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded border">
          <p className="text-[10px] text-muted-foreground">Tickets Sold</p>
          <p className="text-sm font-semibold" data-testid="text-owner-tickets">{earnings.totalTickets || 0}</p>
        </div>
        <div className="p-2 rounded border">
          <p className="text-[10px] text-muted-foreground">Gross</p>
          <p className="text-sm font-semibold">${((earnings.grossRevenue || 0) / 100).toFixed(2)}</p>
        </div>
        <div className="p-2 rounded border border-green-500/30">
          <p className="text-[10px] text-muted-foreground">Your Earnings</p>
          <p className="text-sm font-semibold text-green-400" data-testid="text-owner-share">${((earnings.organizerShare || 0) / 100).toFixed(2)}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Revenue split: Platform 40% · Operator 30% · You 30%
      </p>
    </div>
  );
}

interface VolunteerOpp {
  id: string;
  title: string;
  employer: string;
  employment_type: string;
  description: string;
  location_text: string;
  schedule_commitment: string;
  skills_helpful: string;
  contact_url: string;
  status: string;
  created_at: string;
}

interface WishlistItem {
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  quantityNeeded: number | null;
  urgency: string | null;
  externalUrl: string | null;
  status: string;
  createdAt: string;
}

function NonprofitSection({ citySlug, slug, business }: { citySlug: string; slug: string; business: Business }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"volunteer" | "wishlist">("volunteer");

  const [showVolunteerForm, setShowVolunteerForm] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<VolunteerOpp | null>(null);
  const [volForm, setVolForm] = useState({ title: "", description: "", locationText: "", scheduleCommitment: "", skillsHelpful: "", contactUrl: "" });

  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [editingWishlist, setEditingWishlist] = useState<WishlistItem | null>(null);
  const [wishForm, setWishForm] = useState({ title: "", description: "", quantityNeeded: "", urgency: "medium", externalUrl: "" });

  const { data: volunteers, isLoading: volLoading } = useQuery<VolunteerOpp[]>({
    queryKey: ["/api/owner/volunteer-opportunities"],
    queryFn: async () => {
      const resp = await fetch(`/api/owner/volunteer-opportunities?citySlug=${citySlug}&slug=${slug}`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const { data: wishlistItems, isLoading: wishLoading } = useQuery<WishlistItem[]>({
    queryKey: ["/api/owner/wishlist-items"],
    queryFn: async () => {
      const resp = await fetch(`/api/owner/wishlist-items?citySlug=${citySlug}&slug=${slug}`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const createVolunteerMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/owner/volunteer-opportunities?citySlug=${citySlug}&slug=${slug}`, volForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/volunteer-opportunities"] });
      setShowVolunteerForm(false);
      setVolForm({ title: "", description: "", locationText: "", scheduleCommitment: "", skillsHelpful: "", contactUrl: "" });
      toast({ title: "Volunteer opportunity created" });
    },
    onError: () => toast({ title: "Error creating volunteer opportunity", variant: "destructive" }),
  });

  const updateVolunteerMutation = useMutation({
    mutationFn: async () => {
      if (!editingVolunteer) return;
      await apiRequest("PATCH", `/api/owner/volunteer-opportunities/${editingVolunteer.id}?citySlug=${citySlug}&slug=${slug}`, volForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/volunteer-opportunities"] });
      setEditingVolunteer(null);
      setVolForm({ title: "", description: "", locationText: "", scheduleCommitment: "", skillsHelpful: "", contactUrl: "" });
      toast({ title: "Volunteer opportunity updated" });
    },
    onError: () => toast({ title: "Error updating", variant: "destructive" }),
  });

  const deleteVolunteerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/owner/volunteer-opportunities/${id}?citySlug=${citySlug}&slug=${slug}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/volunteer-opportunities"] });
      toast({ title: "Volunteer opportunity removed" });
    },
  });

  const createWishlistMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/owner/wishlist-items?citySlug=${citySlug}&slug=${slug}`, {
        ...wishForm,
        quantityNeeded: wishForm.quantityNeeded ? parseInt(wishForm.quantityNeeded) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/wishlist-items"] });
      setShowWishlistForm(false);
      setWishForm({ title: "", description: "", quantityNeeded: "", urgency: "medium", externalUrl: "" });
      toast({ title: "Wishlist item created" });
    },
    onError: () => toast({ title: "Error creating wishlist item", variant: "destructive" }),
  });

  const updateWishlistMutation = useMutation({
    mutationFn: async () => {
      if (!editingWishlist) return;
      await apiRequest("PATCH", `/api/owner/wishlist-items/${editingWishlist.id}?citySlug=${citySlug}&slug=${slug}`, {
        ...wishForm,
        quantityNeeded: wishForm.quantityNeeded ? parseInt(wishForm.quantityNeeded) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/wishlist-items"] });
      setEditingWishlist(null);
      setWishForm({ title: "", description: "", quantityNeeded: "", urgency: "medium", externalUrl: "" });
      toast({ title: "Wishlist item updated" });
    },
    onError: () => toast({ title: "Error updating", variant: "destructive" }),
  });

  const deleteWishlistMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/owner/wishlist-items/${id}?citySlug=${citySlug}&slug=${slug}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/wishlist-items"] });
      toast({ title: "Wishlist item removed" });
    },
  });

  const startEditVolunteer = (v: VolunteerOpp) => {
    setEditingVolunteer(v);
    setVolForm({
      title: v.title,
      description: v.description || "",
      locationText: v.location_text || "",
      scheduleCommitment: v.schedule_commitment || "",
      skillsHelpful: v.skills_helpful || "",
      contactUrl: v.contact_url || "",
    });
  };

  const startEditWishlist = (w: WishlistItem) => {
    setEditingWishlist(w);
    setWishForm({
      title: w.title,
      description: w.description || "",
      quantityNeeded: w.quantityNeeded ? String(w.quantityNeeded) : "",
      urgency: w.urgency || "medium",
      externalUrl: w.externalUrl || "",
    });
  };

  const urgencyColors: Record<string, string> = {
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Card className="p-5 space-y-4" data-testid="section-nonprofit">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-purple-600" />
        <h3 className="font-semibold">Nonprofit Tools</h3>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "volunteer" | "wishlist")}>
        <TabsList className="w-full">
          <TabsTrigger value="volunteer" className="flex-1" data-testid="tab-nonprofit-volunteer">
            <Users className="h-4 w-4 mr-1" /> Volunteer Opportunities
          </TabsTrigger>
          <TabsTrigger value="wishlist" className="flex-1" data-testid="tab-nonprofit-wishlist">
            <Gift className="h-4 w-4 mr-1" /> Wishlist / Needs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="volunteer" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Post volunteer opportunities for your community.</p>
            <Button size="sm" onClick={() => { setShowVolunteerForm(true); setEditingVolunteer(null); setVolForm({ title: "", description: "", locationText: "", scheduleCommitment: "", skillsHelpful: "", contactUrl: "" }); }} data-testid="button-add-volunteer">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {(showVolunteerForm || editingVolunteer) && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <Input placeholder="Role title *" value={volForm.title} onChange={(e) => setVolForm(f => ({ ...f, title: e.target.value }))} data-testid="input-volunteer-title" />
              <Textarea placeholder="Description" value={volForm.description} onChange={(e) => setVolForm(f => ({ ...f, description: e.target.value }))} data-testid="input-volunteer-description" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Location" value={volForm.locationText} onChange={(e) => setVolForm(f => ({ ...f, locationText: e.target.value }))} data-testid="input-volunteer-location" />
                <Input placeholder="Time commitment (e.g. 4 hrs/week)" value={volForm.scheduleCommitment} onChange={(e) => setVolForm(f => ({ ...f, scheduleCommitment: e.target.value }))} data-testid="input-volunteer-commitment" />
              </div>
              <Input placeholder="Helpful skills" value={volForm.skillsHelpful} onChange={(e) => setVolForm(f => ({ ...f, skillsHelpful: e.target.value }))} data-testid="input-volunteer-skills" />
              <Input placeholder="Contact / Apply URL" value={volForm.contactUrl} onChange={(e) => setVolForm(f => ({ ...f, contactUrl: e.target.value }))} data-testid="input-volunteer-contact" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => editingVolunteer ? updateVolunteerMutation.mutate() : createVolunteerMutation.mutate()} disabled={!volForm.title || createVolunteerMutation.isPending || updateVolunteerMutation.isPending} data-testid="button-save-volunteer">
                  {(createVolunteerMutation.isPending || updateVolunteerMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editingVolunteer ? "Update" : "Create"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowVolunteerForm(false); setEditingVolunteer(null); }} data-testid="button-cancel-volunteer">Cancel</Button>
              </div>
            </div>
          )}

          {volLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : volunteers && volunteers.length > 0 ? (
            <div className="space-y-2">
              {volunteers.map(v => (
                <div key={v.id} className="border rounded-lg p-3 flex items-start justify-between" data-testid={`card-volunteer-${v.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{v.title}</p>
                    {v.schedule_commitment && <p className="text-xs text-muted-foreground mt-0.5"><Clock className="h-3 w-3 inline mr-1" />{v.schedule_commitment}</p>}
                    {v.location_text && <p className="text-xs text-muted-foreground"><MapPin className="h-3 w-3 inline mr-1" />{v.location_text}</p>}
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditVolunteer(v)} data-testid={`button-edit-volunteer-${v.id}`}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteVolunteerMutation.mutate(v.id)} data-testid={`button-delete-volunteer-${v.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No volunteer opportunities yet. Click "Add" to post one.</p>
          )}
        </TabsContent>

        <TabsContent value="wishlist" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Share items or services your nonprofit needs.</p>
            <Button size="sm" onClick={() => { setShowWishlistForm(true); setEditingWishlist(null); setWishForm({ title: "", description: "", quantityNeeded: "", urgency: "medium", externalUrl: "" }); }} data-testid="button-add-wishlist">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {(showWishlistForm || editingWishlist) && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <Input placeholder="Item name *" value={wishForm.title} onChange={(e) => setWishForm(f => ({ ...f, title: e.target.value }))} data-testid="input-wishlist-title" />
              <Textarea placeholder="Description" value={wishForm.description} onChange={(e) => setWishForm(f => ({ ...f, description: e.target.value }))} data-testid="input-wishlist-description" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Quantity needed" type="number" value={wishForm.quantityNeeded} onChange={(e) => setWishForm(f => ({ ...f, quantityNeeded: e.target.value }))} data-testid="input-wishlist-quantity" />
                <Select value={wishForm.urgency} onValueChange={(v) => setWishForm(f => ({ ...f, urgency: v }))}>
                  <SelectTrigger data-testid="select-wishlist-urgency"><SelectValue placeholder="Urgency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low priority</SelectItem>
                    <SelectItem value="medium">Medium priority</SelectItem>
                    <SelectItem value="high">High priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Donate / purchase URL (optional)" value={wishForm.externalUrl} onChange={(e) => setWishForm(f => ({ ...f, externalUrl: e.target.value }))} data-testid="input-wishlist-url" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => editingWishlist ? updateWishlistMutation.mutate() : createWishlistMutation.mutate()} disabled={!wishForm.title || createWishlistMutation.isPending || updateWishlistMutation.isPending} data-testid="button-save-wishlist">
                  {(createWishlistMutation.isPending || updateWishlistMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editingWishlist ? "Update" : "Create"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowWishlistForm(false); setEditingWishlist(null); }} data-testid="button-cancel-wishlist">Cancel</Button>
              </div>
            </div>
          )}

          {wishLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : wishlistItems && wishlistItems.length > 0 ? (
            <div className="space-y-2">
              {wishlistItems.map(w => (
                <div key={w.id} className="border rounded-lg p-3 flex items-start justify-between" data-testid={`card-wishlist-${w.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{w.title}</p>
                      {w.urgency && <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${urgencyColors[w.urgency] || ""}`}>{w.urgency}</Badge>}
                    </div>
                    {w.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{w.description}</p>}
                    {w.quantityNeeded && <p className="text-xs text-muted-foreground">Qty needed: {w.quantityNeeded}</p>}
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditWishlist(w)} data-testid={`button-edit-wishlist-${w.id}`}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteWishlistMutation.mutate(w.id)} data-testid={`button-delete-wishlist-${w.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No wishlist items yet. Click "Add" to share a need.</p>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function DiscoveryMetricsSection({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { data, isLoading } = useQuery<{
    engagement30d: { views: number; callClicks: number; websiteClicks: number; directionsClicks: number; leadsStarted: number; leadsSubmitted: number } | null;
    weeklyTotal: number;
    channelBreakdown: Record<string, number>;
    neighborhoodRank: number | null;
    neighborhoodName: string | null;
    categoryName: string | null;
    topKeywords: { keyword: string; count: number }[];
    topReferrers: { referrer: string; count: number }[];
  }>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "discovery"],
  });

  if (isLoading) return <Card className="p-4"><Skeleton className="h-32 w-full" /></Card>;
  if (!data) return null;

  const eng = data.engagement30d;

  return (
    <Card className="p-4 space-y-4" data-testid="section-discovery-metrics">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Discovery Performance</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1" data-testid="metric-views">
          <p className="text-xs text-white/50">30d Views</p>
          <p className="text-xl font-bold text-white">{eng?.views ?? 0}</p>
        </div>
        <div className="space-y-1" data-testid="metric-calls">
          <p className="text-xs text-white/50">Call Clicks</p>
          <p className="text-xl font-bold text-white">{eng?.callClicks ?? 0}</p>
        </div>
        <div className="space-y-1" data-testid="metric-website">
          <p className="text-xs text-white/50">Website Clicks</p>
          <p className="text-xl font-bold text-white">{eng?.websiteClicks ?? 0}</p>
        </div>
        <div className="space-y-1" data-testid="metric-directions">
          <p className="text-xs text-white/50">Directions</p>
          <p className="text-xl font-bold text-white">{eng?.directionsClicks ?? 0}</p>
        </div>
      </div>

      <div className="border-t border-white/10 pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1" data-testid="metric-weekly-events">
            <p className="text-xs text-white/50">Weekly Activity</p>
            <p className="text-lg font-semibold text-white">{data.weeklyTotal} events</p>
          </div>
          {data.neighborhoodRank !== null && (
            <div className="text-right space-y-1" data-testid="metric-neighborhood-rank">
              <p className="text-xs text-white/50">
                {data.neighborhoodName && data.categoryName
                  ? `#${data.neighborhoodRank} in ${data.neighborhoodName} for ${data.categoryName}`
                  : `Neighborhood Rank`}
              </p>
              <div className="flex items-center gap-1 justify-end">
                <Star className="h-4 w-4 text-amber-400" />
                <p className="text-lg font-bold text-amber-300">#{data.neighborhoodRank}</p>
              </div>
            </div>
          )}
        </div>

        {Object.keys(data.channelBreakdown).length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="metric-channel-breakdown">
            {Object.entries(data.channelBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([channel, count]) => (
                <div key={channel} className="rounded-lg bg-white/5 p-2 text-center space-y-0.5">
                  <p className="text-xs text-white/50">{channel}</p>
                  <p className="text-sm font-semibold text-white">{count}</p>
                </div>
              ))}
          </div>
        )}
      </div>

      {eng && (eng.leadsStarted > 0 || eng.leadsSubmitted > 0) && (
        <div className="border-t border-white/10 pt-3 flex gap-6" data-testid="metric-leads">
          <div className="space-y-1">
            <p className="text-xs text-white/50">Leads Started</p>
            <p className="text-lg font-semibold text-white">{eng.leadsStarted}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-white/50">Leads Submitted</p>
            <p className="text-lg font-semibold text-green-400">{eng.leadsSubmitted}</p>
          </div>
        </div>
      )}

      {data.topKeywords.length > 0 && (
        <div className="border-t border-white/10 pt-3 space-y-2" data-testid="metric-top-keywords">
          <p className="text-xs text-white/50 font-medium">Top Discovery Keywords (7d)</p>
          <div className="flex flex-wrap gap-1.5">
            {data.topKeywords.map((kw) => (
              <Badge key={kw.keyword} variant="outline" className="border-white/20 text-white/70 text-xs" data-testid={`keyword-${kw.keyword}`}>
                {kw.keyword} <span className="ml-1 text-white/40">{kw.count}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {data.topReferrers.length > 0 && (
        <div className="border-t border-white/10 pt-3 space-y-2" data-testid="metric-top-referrers">
          <p className="text-xs text-white/50 font-medium">Top Referrers (7d)</p>
          <div className="space-y-1">
            {data.topReferrers.map((ref) => (
              <div key={ref.referrer} className="flex items-center justify-between text-xs" data-testid={`referrer-${ref.referrer}`}>
                <span className="text-white/70 truncate max-w-[200px]">{ref.referrer}</span>
                <span className="text-white/40 ml-2">{ref.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
