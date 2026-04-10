import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BizImage } from "@/components/biz-image";
import {
  CheckCircle, AlertCircle, Building2, MapPin, Shield, Sparkles,
  Check, X, Crown, Calendar, Loader2, ArrowRight, Gift, Languages,
  Star, Image, MessageSquare, Video, Palette, Globe, Tag, PartyPopper
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { InspirationQuoteBlock } from "@/components/inspiration-quote-block";

interface ClaimBusiness {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  imageUrl: string | null;
  ownerEmail: string | null;
  isNonprofit: boolean;
  presenceType: string;
  listingTier: string;
}

type FlowStep = "claim" | "choose-tier" | "book-interview" | "complete";

const EXPANDED_FEATURE_KEYS = [
  { icon: Globe, key: "claim.featureExpBilingualPages" as const },
  { icon: Image, key: "claim.featureExpPhotoGallery" as const },
  { icon: MessageSquare, key: "claim.featureExpCustomerReviews" as const },
  { icon: Video, key: "claim.featureExpVideoShowcase" as const },
  { icon: Palette, key: "claim.featureExpCustomTheme" as const },
  { icon: Tag, key: "claim.featureExpServiceTags" as const },
  { icon: Star, key: "claim.featureExpVisibilityBoost" as const },
  { icon: MapPin, key: "claim.featureExpLocations" as const },
];

export default function ClaimBusiness({ citySlug, token }: { citySlug: string; token: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [govAccuracy, setGovAccuracy] = useState(false);
  const [govAuthorized, setGovAuthorized] = useState(false);
  const [govTerms, setGovTerms] = useState(false);
  const { t, locale, setLocale } = useI18n();

  const params = new URLSearchParams(window.location.search);
  const urlStep = params.get("step") as FlowStep | null;
  const urlTier = params.get("tier");
  const urlEntityId = params.get("entityId");
  const urlLang = params.get("lang");

  useEffect(() => {
    if (urlLang === "es" && locale !== "es") setLocale("es");
  }, []);

  const [step, setStep] = useState<FlowStep>(urlStep || "claim");
  const [selectedTier, setSelectedTier] = useState(urlTier || "");
  const [claimedSlug, setClaimedSlug] = useState("");
  const [businessId, setBusinessId] = useState(urlEntityId || "");

  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingName, setBookingName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");

  const { data, isLoading, error } = useQuery<{ business: ClaimBusiness; alreadyClaimed?: boolean }>({
    queryKey: ["/api/claim/verify", token],
    queryFn: async () => {
      const resp = await fetch(`/api/claim/verify?token=${token}`);
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || "Invalid claim link");
      }
      return resp.json();
    },
  });

  useEffect(() => {
    if (data?.business) {
      setBusinessId(data.business.id);
      if (data.business.ownerEmail) setOwnerEmail(data.business.ownerEmail);
      if (data.alreadyClaimed && step === "claim") {
        setStep(urlStep || "choose-tier");
      }
    }
  }, [data]);

  useEffect(() => {
    if (urlStep === "book-interview") {
      setStep("book-interview");
      if (urlTier) setSelectedTier(urlTier);
    } else if (urlStep === "choose-tier") {
      setStep("choose-tier");
    }
  }, [urlStep, urlTier]);

  const claimMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/claim/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ownerName, ownerEmail, phone, locale }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || "Claim failed");
      }
      return resp.json();
    },
    onSuccess: (result) => {
      setClaimedSlug(result.businessSlug);
      setBookingName(ownerName);
      setBookingEmail(ownerEmail);
      setBookingPhone(phone);
      toast({ title: t("claim.success") });
      setStep("choose-tier");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (tier: string) => {
      const resp = await apiRequest("POST", "/api/claim/upgrade-checkout", {
        token,
        tier,
        citySlug,
        locale,
      });
      return resp.json();
    },
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast({ title: "Notice", description: result.message || "Payment not configured yet" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const giftMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/claim/gift-nonprofit", {
        token,
        citySlug,
      });
      return resp.json();
    },
    onSuccess: () => {
      setSelectedTier("ENHANCED");
      toast({ title: t("claim.hubPresenceActivated") });
      setStep("book-interview");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const startDt = new Date(`${bookingDate}T${bookingTime}`);
      const resp = await apiRequest("POST", "/api/claim/book-story-interview", {
        token,
        guestName: bookingName || ownerName,
        guestEmail: bookingEmail || ownerEmail,
        guestPhone: bookingPhone || phone,
        startTime: startDt.toISOString(),
        tier: selectedTier || urlTier || "ENHANCED",
      });
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: t("claim.interviewBooked") });
      setStep("complete");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data?.business) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2" data-testid="text-claim-error">{t("claim.invalidLink")}</h2>
          <p className="text-muted-foreground mb-4">
            {(error as Error)?.message || t("claim.invalidMessage")}
          </p>
          <Button variant="outline" onClick={() => setLocation(`/${citySlug}`)} data-testid="button-go-home">
            {t("claim.goHome")}
          </Button>
        </Card>
      </div>
    );
  }

  const biz = data.business;
  const isNonprofit = biz.isNonprofit;

  const langToggle = (
    <div className="flex justify-end mb-2">
      <div className="inline-flex rounded-full border border-[#5B1D8F]/30 overflow-hidden text-xs">
        <button
          onClick={() => setLocale("en")}
          className={`px-3 py-1 font-medium transition-colors ${locale === "en" ? "bg-[#5B1D8F] text-white" : "text-[#5B1D8F] hover:bg-[#5B1D8F]/5"}`}
          data-testid="button-lang-en"
        >
          EN
        </button>
        <button
          onClick={() => setLocale("es")}
          className={`px-3 py-1 font-medium transition-colors ${locale === "es" ? "bg-[#5B1D8F] text-white" : "text-[#5B1D8F] hover:bg-[#5B1D8F]/5"}`}
          data-testid="button-lang-es"
        >
          ES
        </button>
      </div>
    </div>
  );

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[
        { key: "claim", label: t("claim.stepClaim") },
        { key: "choose-tier", label: t("claim.stepChoosePlan") },
        { key: "book-interview", label: t("claim.stepBookInterview") },
      ].map((s, i) => {
        const steps: FlowStep[] = ["claim", "choose-tier", "book-interview"];
        const currentIdx = steps.indexOf(step);
        const thisIdx = steps.indexOf(s.key as FlowStep);
        const isActive = thisIdx === currentIdx;
        const isDone = thisIdx < currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-0.5 ${isDone ? "bg-[#5B1D8F]" : "bg-gray-200"}`} />}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                isDone ? "bg-[#5B1D8F] text-white" : isActive ? "bg-[#5B1D8F]/10 text-[#5B1D8F] ring-2 ring-[#5B1D8F]" : "bg-gray-100 text-gray-400"
              }`}>
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1 ${isActive || isDone ? "text-[#5B1D8F] font-medium" : "text-gray-400"}`}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (step === "complete") {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6">
        {langToggle}
        <Card className="p-8 text-center bg-gradient-to-br from-[#5B1D8F]/5 to-[#F2C230]/5">
          <PartyPopper className="mx-auto h-16 w-16 text-[#F2C230] mb-4" />
          <h2 className="text-2xl font-bold mb-2" data-testid="text-claim-complete">{t("claim.completeTitle")}</h2>
          <p className="text-muted-foreground mb-4">
            {t("claim.completeMessage")}
          </p>
          <InspirationQuoteBlock pageContext="claim" variant="subtle" inspirationName={(biz as any)?.businessInspiration} />
          <div className="space-y-3 mt-2">
            <Button
              className="w-full bg-[#5B1D8F]"
              onClick={() => setLocation(`/${citySlug}/directory/${claimedSlug || biz.slug}`)}
              data-testid="button-view-listing-final"
            >
              {t("claim.viewListing")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation(`/${citySlug}`)}
              data-testid="button-explore-hub"
            >
              {t("claim.exploreHub")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step === "book-interview") {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);
    const minDateStr = today.toISOString().split("T")[0];
    const maxDateStr = maxDate.toISOString().split("T")[0];

    const timeSlots = [];
    for (let h = 9; h < 17; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hour = h > 12 ? h - 12 : h;
        const ampm = h >= 12 ? "PM" : "AM";
        const display = `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
        const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        timeSlots.push({ display, value });
      }
    }

    return (
      <div className="max-w-lg mx-auto p-4 space-y-6">
        {langToggle}
        {stepIndicator}

        <div className="text-center">
          <Calendar className="mx-auto h-10 w-10 text-[#5B1D8F] mb-3" />
          <h2 className="text-xl font-bold" data-testid="text-book-interview-title">{t("claim.bookTitle")}</h2>
          <p className="text-muted-foreground text-sm mt-2">
            {t("claim.bookSubtitle", { name: biz.name })}
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t("claim.bookYourName")}</label>
            <Input
              value={bookingName || ownerName}
              onChange={(e) => setBookingName(e.target.value)}
              placeholder={t("claim.bookNamePlaceholder")}
              data-testid="input-booking-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("claim.bookEmail")}</label>
            <Input
              type="email"
              value={bookingEmail || ownerEmail}
              onChange={(e) => setBookingEmail(e.target.value)}
              placeholder={t("claim.bookEmailPlaceholder")}
              data-testid="input-booking-email"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("claim.bookPhone")}</label>
            <Input
              value={bookingPhone || phone}
              onChange={(e) => setBookingPhone(e.target.value)}
              placeholder={t("claim.bookPhonePlaceholder")}
              data-testid="input-booking-phone"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("claim.bookDate")}</label>
            <Input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              min={minDateStr}
              max={maxDateStr}
              data-testid="input-booking-date"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("claim.bookTime")}</label>
            <div className="grid grid-cols-4 gap-2">
              {timeSlots.map((slot) => (
                <button
                  key={slot.value}
                  onClick={() => setBookingTime(slot.value)}
                  className={`py-2 px-1 text-xs rounded-md border transition-colors ${
                    bookingTime === slot.value
                      ? "bg-[#5B1D8F] text-white border-[#5B1D8F]"
                      : "border-gray-200 hover:border-[#5B1D8F]/30 hover:bg-[#5B1D8F]/5"
                  }`}
                  data-testid={`button-time-${slot.value}`}
                >
                  {slot.display}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="w-full bg-[#5B1D8F] mt-2"
            disabled={!bookingDate || !bookingTime || !(bookingName || ownerName) || !(bookingEmail || ownerEmail) || bookMutation.isPending}
            onClick={() => bookMutation.mutate()}
            data-testid="button-confirm-booking"
          >
            {bookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
            {bookMutation.isPending ? t("claim.scheduling") : t("claim.confirmInterview")}
          </Button>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {t("claim.rescheduleNote")}
        </p>
      </div>
    );
  }

  if (step === "choose-tier") {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {langToggle}
        {stepIndicator}

        <div className="text-center">
          <Sparkles className="mx-auto h-10 w-10 text-[#F2C230] mb-3" />
          <h2 className="text-xl font-bold" data-testid="text-choose-tier-title">
            {isNonprofit ? t("claim.chooseTierTitleNonprofit") : t("claim.chooseTierTitle")}
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            {isNonprofit
              ? t("claim.chooseTierSubtitleNonprofit", { name: biz.name })
              : t("claim.chooseTierSubtitle", { name: biz.name })
            }
          </p>
        </div>

        <InspirationQuoteBlock pageContext="claim" inspirationName={(biz as any)?.businessInspiration} />

        <div className="max-w-md mx-auto">
          <Card className="p-5 border-2 border-[#5B1D8F] relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#5B1D8F] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
              {t("claim.mostPopular")}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-full bg-[#5B1D8F]/10 flex items-center justify-center">
                <Crown className="h-4 w-4 text-[#5B1D8F]" />
              </div>
              <h3 className="font-bold text-lg" data-testid="text-enhanced-presence-title">Enhanced</h3>
            </div>

            {isNonprofit ? (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-5 w-5 text-[#5B1D8F]" />
                  <span className="text-2xl font-bold text-[#5B1D8F]">{t("claim.free")}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("claim.giftedToOrgs")}</p>
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm text-muted-foreground line-through">$699/yr</span>
                  <span className="text-2xl font-bold text-[#5B1D8F]">$99/yr</span>
                </div>
                <p className="text-xs text-[#5B1D8F] font-medium">Intro Rate</p>
              </div>
            )}

            <div className="space-y-2 mb-5">
              {EXPANDED_FEATURE_KEYS.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <f.icon className="h-3.5 w-3.5 text-[#5B1D8F] shrink-0" />
                  <span>{t(f.key)}</span>
                </div>
              ))}
            </div>

            {isNonprofit ? (
              <Button
                className="w-full bg-[#5B1D8F]"
                disabled={giftMutation.isPending}
                onClick={() => giftMutation.mutate()}
                data-testid="button-activate-gift"
              >
                {giftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
                {giftMutation.isPending ? t("claim.activating") : t("claim.activateGift")}
              </Button>
            ) : (
              <Button
                className="w-full bg-[#5B1D8F]"
                disabled={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate("ENHANCED")}
                data-testid="button-choose-enhanced"
              >
                {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                {checkoutMutation.isPending ? t("claim.loading") : "Upgrade to Enhanced"}
              </Button>
            )}
          </Card>
        </div>

        <div className="bg-[#5B1D8F]/5 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Languages className="h-5 w-5 text-[#5B1D8F]" />
            <span className="font-semibold text-sm">{t("claim.bilingualTitle")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("claim.bilingualDesc")}
          </p>
        </div>

        {!isNonprofit && (
          <p className="text-center text-xs text-muted-foreground">
            {t("claim.hubBuilderNote")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      {langToggle}
      {stepIndicator}

      <div className="text-center">
        <Building2 className="mx-auto h-10 w-10 text-[#5B1D8F] mb-3" />
        <h1 className="text-xl font-bold" data-testid="text-claim-title">
          {isNonprofit ? t("claim.nonprofitTitle") : t("claim.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isNonprofit
            ? t("claim.nonprofitSubtitle")
            : t("claim.subtitle")}
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <BizImage src={biz.imageUrl} alt="" className="h-16 w-16 rounded-md object-cover shrink-0" />
          <div>
            <h2 className="font-semibold text-lg" data-testid="text-claim-business-name">{biz.name}</h2>
            {biz.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {[biz.address, biz.city, biz.state].filter(Boolean).join(", ")}
              </p>
            )}
            {isNonprofit && (
              <div className="mt-2 inline-flex items-center gap-1 bg-[#5B1D8F]/10 text-[#5B1D8F] rounded-full px-2 py-0.5 text-xs font-medium">
                <Gift className="h-3 w-3" /> {t("claim.communityOrg")}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">{t("claim.confirmDetails")}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ownerEmail) {
              toast({ title: t("validation.pleaseEnterEmail"), variant: "destructive" });
              return;
            }
            claimMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium mb-1 block">{t("claim.yourName")}</label>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder={t("claim.namePlaceholder")}
              data-testid="input-claim-owner-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("claim.yourEmail")}</label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder={t("claim.emailPlaceholder")}
              required
              data-testid="input-claim-owner-email"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("claim.phone")}</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("claim.phonePlaceholder")}
              data-testid="input-claim-phone"
            />
          </div>
          <div className="space-y-3 border rounded-md p-4 bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("claim.govTitle")}
            </p>
            <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-claim-gov-accuracy">
              <input
                type="checkbox"
                checked={govAccuracy}
                onChange={(e) => setGovAccuracy(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">{t("claim.govAccuracy")}</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-claim-gov-authorized">
              <input
                type="checkbox"
                checked={govAuthorized}
                onChange={(e) => setGovAuthorized(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">{isNonprofit ? t("claim.govAuthorizedOrg") : t("claim.govAuthorizedBiz")}</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-claim-gov-terms">
              <input
                type="checkbox"
                checked={govTerms}
                onChange={(e) => setGovTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">{t("claim.govTerms")}</span>
            </label>
          </div>
          <Button
            type="submit"
            className="w-full bg-[#5B1D8F]"
            disabled={claimMutation.isPending || !govAccuracy || !govAuthorized || !govTerms}
            data-testid="button-complete-claim"
          >
            {claimMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("claim.claiming")}</>
            ) : (
              <><ArrowRight className="h-4 w-4 mr-2" /> {t("claim.confirmButton")}</>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
