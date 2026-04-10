import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import {
  Monitor, ArrowLeft, ArrowRight, Check, Languages,
  Building2, MapPin, User, Mail, Phone,
  Globe2, MessageSquare, Calendar, Newspaper,
  UtensilsCrossed, Palette, Trophy, Users, Radio,
  ShieldCheck, Store, CheckCircle2,
} from "lucide-react";

const CHARLOTTE_HUBS = [
  { value: "south-end", label: "South End" },
  { value: "noda", label: "NoDa" },
  { value: "plaza-midwood", label: "Plaza Midwood" },
  { value: "dilworth", label: "Dilworth" },
  { value: "uptown", label: "Uptown" },
  { value: "university-city", label: "University City" },
  { value: "ballantyne", label: "Ballantyne" },
  { value: "myers-park", label: "Myers Park" },
  { value: "elizabeth", label: "Elizabeth" },
  { value: "camp-north-end", label: "Camp North End" },
  { value: "optimist-park", label: "Optimist Park" },
  { value: "westside", label: "Westside" },
  { value: "steele-creek", label: "Steele Creek" },
  { value: "matthews", label: "Matthews" },
  { value: "huntersville", label: "Huntersville" },
  { value: "concord", label: "Concord" },
  { value: "mooresville", label: "Mooresville" },
  { value: "gastonia", label: "Gastonia" },
  { value: "rock-hill", label: "Rock Hill" },
  { value: "mint-hill", label: "Mint Hill" },
];

const CONTENT_INTERESTS = [
  { value: "events", icon: Calendar, labelKey: "onboard.interestEvents" as const },
  { value: "news", icon: Newspaper, labelKey: "onboard.interestNews" as const },
  { value: "food", icon: UtensilsCrossed, labelKey: "onboard.interestFood" as const },
  { value: "arts", icon: Palette, labelKey: "onboard.interestArts" as const },
  { value: "sports", icon: Trophy, labelKey: "onboard.interestSports" as const },
  { value: "community", icon: Users, labelKey: "onboard.interestCommunity" as const },
  { value: "live", icon: Radio, labelKey: "onboard.interestLive" as const },
] as const;

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant / Bar" },
  { value: "retail", label: "Retail / Shopping" },
  { value: "fitness", label: "Fitness / Gym" },
  { value: "salon", label: "Salon / Spa" },
  { value: "office", label: "Office / Coworking" },
  { value: "hotel", label: "Hotel / Hospitality" },
  { value: "auto", label: "Automotive" },
  { value: "medical", label: "Medical / Dental" },
  { value: "other", label: "Other" },
];

const formSchema = z.object({
  venueName: z.string().min(1, "Venue name is required"),
  venueAddress: z.string().optional(),
  city: z.string().default("Charlotte"),
  hubSlug: z.string().optional(),
  contactName: z.string().min(1, "Contact name is required"),
  contactEmail: z.string().email("Please enter a valid email"),
  contactPhone: z.string().optional(),
  languageMode: z.enum(["en", "es", "bilingual"]).default("en"),
  contentInterests: z.array(z.string()).default([]),
  businessType: z.string().optional(),
  competitorCategories: z.array(z.string()).default([]),
  agreeTerms: z.boolean().refine((val) => val === true, "You must agree to the terms"),
});

type FormValues = z.infer<typeof formSchema>;

export default function HubScreenOnboard() {
  const { t, locale, setLocale } = useI18n();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [screenKey, setScreenKey] = useState<string | null>(null);

  usePageMeta({
    title: "Get Started with Hub Screens | CityMetroHub",
    description: "Sign up to bring hyper-local community content to your venue screens. Free setup, bilingual EN/ES, powered by CityMetroHub.",
    canonical: `${window.location.origin}/tv/get-started`,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      venueName: "",
      venueAddress: "",
      city: "Charlotte",
      hubSlug: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      languageMode: "en",
      contentInterests: [],
      businessType: "",
      competitorCategories: [],
      agreeTerms: false,
    },
  });

  const onboardMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/tv/onboard", {
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        hubSlug: data.hubSlug || undefined,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone || undefined,
        languageMode: data.languageMode,
        contentInterests: data.contentInterests,
        competitorCategories: data.competitorCategories,
        citySlug: "charlotte",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.screenKey) setScreenKey(data.screenKey);
      setSubmitted(true);
    },
    onError: (err: Error) => {
      toast({
        title: t("onboard.errorTitle"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const goNext = async () => {
    if (step === 1) {
      const valid = await form.trigger(["venueName", "contactName", "contactEmail"]);
      if (!valid) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const onSubmit = (data: FormValues) => {
    onboardMutation.mutate(data);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4" data-testid="page-onboard-success">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-[hsl(174,62%,44%)]/20 flex items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle2 className="h-10 w-10 text-[hsl(174,62%,44%)]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold" data-testid="text-success-title">
            {t("onboard.successTitle")}
          </h1>
          <p className="text-white/70 text-lg leading-relaxed" data-testid="text-success-message">
            {t("onboard.successMessage")}
          </p>
          <Card className="bg-white/5 border-white/10 p-6 text-left space-y-4">
            <h3 className="font-semibold text-white">{t("onboard.whatsNextTitle")}</h3>
            <div className="space-y-3">
              {[
                { num: "1", text: t("onboard.nextStep1") },
                { num: "2", text: t("onboard.nextStep2") },
                { num: "3", text: t("onboard.nextStep3") },
              ].map((s) => (
                <div key={s.num} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[hsl(174,62%,44%)]/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[hsl(174,62%,44%)]">{s.num}</span>
                  </div>
                  <span className="text-sm text-white/70">{s.text}</span>
                </div>
              ))}
            </div>
          </Card>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
            {screenKey && (
              <Link href={`/tv/venue/${screenKey}`}>
                <Button data-testid="button-manage-screen">
                  <Monitor className="h-4 w-4 mr-2" />
                  Manage your screen
                </Button>
              </Link>
            )}
            <Link href="/tv">
              <Button variant="outline" className="border-white/20 text-white" data-testid="button-back-to-promo">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("onboard.backToHubScreens")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const LANG_OPTIONS = [
    { value: "en" as const, icon: Globe2, label: t("onboard.langEnglish"), desc: t("onboard.langEnglishDesc") },
    { value: "es" as const, icon: MessageSquare, label: t("onboard.langSpanish"), desc: t("onboard.langSpanishDesc") },
    { value: "bilingual" as const, icon: Languages, label: t("onboard.langBilingual"), desc: t("onboard.langBilingualDesc") },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white" data-testid="page-hub-screen-onboard">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
          <Link href="/tv" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <Monitor className="h-5 w-5 text-[hsl(174,62%,44%)]" />
            <span className="font-bold text-lg tracking-tight text-white">Hub Screens</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale(locale === "en" ? "es" : "en")}
              className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1"
              data-testid="button-lang-toggle"
            >
              <Languages className="h-3.5 w-3.5" />
              {locale === "en" ? "ES" : "EN"}
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-20 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" data-testid="text-onboard-title">
              {t("onboard.pageTitle")}
            </h1>
            <p className="text-white/60 text-sm">{t("onboard.pageSubtitle")}</p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-8" data-testid="progress-steps">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    s < step
                      ? "bg-[hsl(174,62%,44%)] text-black"
                      : s === step
                      ? "bg-[hsl(174,62%,44%)]/20 text-[hsl(174,62%,44%)] ring-2 ring-[hsl(174,62%,44%)]/40"
                      : "bg-white/10 text-white/40"
                  }`}
                  data-testid={`step-indicator-${s}`}
                >
                  {s < step ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-12 sm:w-20 h-0.5 ${s < step ? "bg-[hsl(174,62%,44%)]" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {step === 1 && (
                <Card className="bg-white/5 border-white/10 p-6 space-y-5" data-testid="step-1-venue">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-5 w-5 text-[hsl(174,62%,44%)]" />
                    <h2 className="text-lg font-semibold text-white">{t("onboard.step1Title")}</h2>
                  </div>

                  <FormField
                    control={form.control}
                    name="venueName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80">{t("onboard.venueName")} *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={t("onboard.venueNamePlaceholder")}
                            className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
                            data-testid="input-venue-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="venueAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80">{t("onboard.venueAddress")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={t("onboard.venueAddressPlaceholder")}
                            className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
                            data-testid="input-venue-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80">{t("onboard.city")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="bg-white/5 border-white/15 text-white"
                              data-testid="input-city"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hubSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80">{t("onboard.neighborhood")}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="bg-white/5 border-white/15 text-white" data-testid="select-hub">
                                <SelectValue placeholder={t("onboard.selectNeighborhood")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CHARLOTTE_HUBS.map((hub) => (
                                <SelectItem key={hub.value} value={hub.value}>{hub.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t border-white/10 pt-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[hsl(174,62%,44%)]" />
                      <span className="text-sm font-medium text-white/80">{t("onboard.contactInfo")}</span>
                    </div>

                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80">{t("onboard.contactName")} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t("onboard.contactNamePlaceholder")}
                              className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
                              data-testid="input-contact-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/80">{t("onboard.contactEmail")} *</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder={t("onboard.contactEmailPlaceholder")}
                                className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
                                data-testid="input-contact-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/80">{t("onboard.contactPhone")}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="tel"
                                placeholder="(555) 123-4567"
                                className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
                                data-testid="input-contact-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card className="bg-white/5 border-white/10 p-6 space-y-6" data-testid="step-2-preferences">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Languages className="h-5 w-5 text-[hsl(174,62%,44%)]" />
                      <h2 className="text-lg font-semibold text-white">{t("onboard.step2Title")}</h2>
                    </div>

                    <p className="text-sm text-white/60 mb-4">{t("onboard.languageModeLabel")}</p>

                    <FormField
                      control={form.control}
                      name="languageMode"
                      render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {LANG_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => field.onChange(opt.value)}
                                className={`p-4 rounded-md border text-left transition-all ${
                                  field.value === opt.value
                                    ? "border-[hsl(174,62%,44%)] bg-[hsl(174,62%,44%)]/10"
                                    : "border-white/10 bg-white/5 hover:border-white/20"
                                }`}
                                data-testid={`radio-lang-${opt.value}`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <opt.icon className={`h-4 w-4 ${field.value === opt.value ? "text-[hsl(174,62%,44%)]" : "text-white/50"}`} />
                                  <span className={`text-sm font-medium ${field.value === opt.value ? "text-white" : "text-white/70"}`}>
                                    {opt.label}
                                  </span>
                                </div>
                                <p className="text-xs text-white/50 mt-1">{opt.desc}</p>
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t border-white/10 pt-5">
                    <p className="text-sm text-white/60 mb-4">{t("onboard.contentInterestsLabel")}</p>
                    <FormField
                      control={form.control}
                      name="contentInterests"
                      render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {CONTENT_INTERESTS.map((item) => {
                              const checked = field.value?.includes(item.value);
                              return (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={() => {
                                    const next = checked
                                      ? field.value.filter((v: string) => v !== item.value)
                                      : [...(field.value || []), item.value];
                                    field.onChange(next);
                                  }}
                                  className={`flex flex-col items-center gap-2 p-3 rounded-md border transition-all ${
                                    checked
                                      ? "border-[hsl(174,62%,44%)] bg-[hsl(174,62%,44%)]/10"
                                      : "border-white/10 bg-white/5 hover:border-white/20"
                                  }`}
                                  data-testid={`checkbox-interest-${item.value}`}
                                >
                                  <item.icon className={`h-5 w-5 ${checked ? "text-[hsl(174,62%,44%)]" : "text-white/50"}`} />
                                  <span className={`text-xs font-medium ${checked ? "text-white" : "text-white/60"}`}>
                                    {t(item.labelKey)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t border-white/10 pt-5">
                    <p className="text-sm text-white/60 mb-3">{t("onboard.competitorLabel")}</p>
                    <FormField
                      control={form.control}
                      name="businessType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80">{t("onboard.businessTypeLabel")}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="bg-white/5 border-white/15 text-white" data-testid="select-business-type">
                                <SelectValue placeholder={t("onboard.selectBusinessType")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BUSINESS_TYPES.map((bt) => (
                                <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <p className="text-xs text-white/40 mt-2">{t("onboard.competitorHint")}</p>
                  </div>
                </Card>
              )}

              {step === 3 && (
                <Card className="bg-white/5 border-white/10 p-6 space-y-5" data-testid="step-3-review">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-5 w-5 text-[hsl(174,62%,44%)]" />
                    <h2 className="text-lg font-semibold text-white">{t("onboard.step3Title")}</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t("onboard.reviewVenue")}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <SummaryItem icon={Store} label={t("onboard.venueName")} value={form.watch("venueName")} testId="summary-venue-name" />
                        <SummaryItem icon={MapPin} label={t("onboard.venueAddress")} value={form.watch("venueAddress") || "—"} testId="summary-venue-address" />
                        <SummaryItem icon={MapPin} label={t("onboard.city")} value={form.watch("city")} testId="summary-city" />
                        <SummaryItem
                          icon={MapPin}
                          label={t("onboard.neighborhood")}
                          value={CHARLOTTE_HUBS.find((h) => h.value === form.watch("hubSlug"))?.label || "—"}
                          testId="summary-hub"
                        />
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t("onboard.reviewContact")}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <SummaryItem icon={User} label={t("onboard.contactName")} value={form.watch("contactName")} testId="summary-contact-name" />
                        <SummaryItem icon={Mail} label={t("onboard.contactEmail")} value={form.watch("contactEmail")} testId="summary-contact-email" />
                        <SummaryItem icon={Phone} label={t("onboard.contactPhone")} value={form.watch("contactPhone") || "—"} testId="summary-contact-phone" />
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t("onboard.reviewPreferences")}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <SummaryItem
                          icon={Languages}
                          label={t("onboard.languageModeLabel")}
                          value={LANG_OPTIONS.find((l) => l.value === form.watch("languageMode"))?.label || "English"}
                          testId="summary-language"
                        />
                        <div className="flex items-start gap-2 p-2">
                          <Calendar className="h-4 w-4 text-white/40 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs text-white/40 block">{t("onboard.contentInterestsLabel")}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(form.watch("contentInterests") || []).length > 0 ? (
                                form.watch("contentInterests").map((ci: string) => (
                                  <Badge key={ci} variant="outline" className="text-xs text-white/70 border-white/20 no-default-active-elevate">
                                    {ci}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-white/60">—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-5">
                    <FormField
                      control={form.control}
                      name="agreeTerms"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5 border-white/30 data-[state=checked]:bg-[hsl(174,62%,44%)] data-[state=checked]:border-[hsl(174,62%,44%)]"
                              data-testid="checkbox-terms"
                            />
                          </FormControl>
                          <FormLabel className="text-sm text-white/70 leading-relaxed cursor-pointer">
                            {t("onboard.agreeTerms")}
                          </FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Card>
              )}

              <div className="flex items-center justify-between gap-3 mt-6 flex-wrap">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    className="border-white/20 text-white"
                    data-testid="button-back"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t("onboard.back")}
                  </Button>
                ) : (
                  <Link href="/tv">
                    <Button type="button" variant="outline" className="border-white/20 text-white" data-testid="button-back-to-promo">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {t("onboard.backToHubScreens")}
                    </Button>
                  </Link>
                )}

                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    className="bg-[hsl(174,62%,44%)] hover:bg-[hsl(174,62%,38%)] text-black font-semibold border-[hsl(174,62%,38%)]"
                    data-testid="button-next"
                  >
                    {t("onboard.next")}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={onboardMutation.isPending}
                    className="bg-[hsl(174,62%,44%)] hover:bg-[hsl(174,62%,38%)] text-black font-bold border-[hsl(174,62%,38%)]"
                    data-testid="button-submit"
                  >
                    {onboardMutation.isPending ? t("onboard.submitting") : t("onboard.submit")}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>

      <footer className="border-t border-white/10 py-6 px-4 text-center">
        <p className="text-xs text-white/30">
          Powered by CityMetroHub &middot; CityMetroHub.tv
        </p>
      </footer>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, testId }: { icon: any; label: string; value: string; testId: string }) {
  return (
    <div className="flex items-start gap-2 p-2">
      <Icon className="h-4 w-4 text-white/40 mt-0.5 shrink-0" />
      <div>
        <span className="text-xs text-white/40 block">{label}</span>
        <span className="text-sm text-white/80" data-testid={testId}>{value}</span>
      </div>
    </div>
  );
}
