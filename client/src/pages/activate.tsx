import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useSmartBack } from "@/hooks/use-smart-back";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  Building2, Users, MapPin, Phone, Mail, Globe, Search,
  CheckCircle, ArrowRight, ArrowLeft, Shield, Crown, Sparkles,
  Store, Heart, CreditCard, MessageSquare, Loader2, Send,
  Star, ChevronRight, Zap, Plus, Trash2, Check, Minus, Languages,
  SkipForward,
} from "lucide-react";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import { useCharlotteContext } from "@/components/public-layout";
import { useI18n } from "@/lib/i18n";
import { TierVisualPreviews } from "@/components/tier-visual-previews";
import { InspirationQuoteBlock } from "@/components/inspiration-quote-block";

type FlowStep = "entry" | "basics" | "confirm" | "profile" | "payment" | "success" | "regional" | "hub-level" | "locations" | "upgrade-success";

const STEPS_ORDER: FlowStep[] = ["entry", "basics", "confirm", "profile", "payment", "success"];

function StepBar({ current, presenceType }: { current: FlowStep; presenceType: string }) {
  const { t } = useI18n();
  const labels = [t("activate.typeStep"), presenceType === "organization" ? t("activate.organizationStep") : t("activate.commerceStep"), t("activate.confirmStep"), "Profile", t("activate.paymentStep"), t("activate.verifiedStep")];
  const icons = [Store, Building2, Search, MessageSquare, CreditCard, CheckCircle];
  const currentIdx = STEPS_ORDER.indexOf(current);

  if (current === "regional" || current === "hub-level" || current === "locations" || current === "upgrade-success") return null;

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6" data-testid="activate-step-bar">
      {STEPS_ORDER.map((step, i) => {
        const Icon = icons[i];
        return (
          <div key={step} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < currentIdx
                    ? "bg-[#5B1D8F] text-white"
                    : i === currentIdx
                    ? "bg-[#F2C230] text-[#5B1D8F]"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-indicator-${step}`}
              >
                {i < currentIdx ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:block">{labels[i]}</span>
            </div>
            {i < STEPS_ORDER.length - 1 && (
              <div className={`w-4 sm:w-8 h-0.5 mt-[-12px] sm:mt-0 ${i < currentIdx ? "bg-[#5B1D8F]" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function GradientBar() {
  return <div className="h-2 rounded-t-md bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />;
}

function SearchableSelect({ value, onSelect, groups, placeholder, testId, showSicCodes, zipSearchEnabled, citySlug, t }: {
  value: string;
  onSelect: (id: string) => void;
  groups: Array<{ label: string; items: Array<{ id: string; name: string; sicCode?: string }> }>;
  placeholder: string;
  testId: string;
  showSicCodes?: boolean;
  zipSearchEnabled?: boolean;
  citySlug?: string;
  t: (key: any, replacements?: Record<string, string>) => string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [zipSearch, setZipSearch] = useState("");
  const [zipMatches, setZipMatches] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!zipSearchEnabled || zipSearch.length !== 5 || !/^\d{5}$/.test(zipSearch)) {
      setZipMatches(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/activate/neighborhoods-by-zip?zip=${zipSearch}&citySlug=${citySlug || "charlotte"}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setZipMatches(data.zoneIds || []); })
      .catch(() => { if (!cancelled) setZipMatches([]); });
    return () => { cancelled = true; };
  }, [zipSearch, zipSearchEnabled, citySlug]);

  const toggleGroup = (label: string) => {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const selectedName = groups.flatMap((g) => g.items).find((i) => i.id === value)?.name || "";
  const lowerSearch = search.toLowerCase();
  const isSearching = lowerSearch.length > 0;
  const isZipFiltering = zipMatches !== null;

  const filtered = groups.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      const nameMatch = !isSearching || i.name.toLowerCase().includes(lowerSearch) || (showSicCodes && i.sicCode && i.sicCode.includes(lowerSearch));
      const zipMatch = !isZipFiltering || zipMatches!.includes(i.id);
      return nameMatch && zipMatch;
    }),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer items-center justify-between"
        onClick={() => setOpen(!open)}
        data-testid={testId}
      >
        <span className={selectedName ? "" : "text-muted-foreground"}>{selectedName || placeholder}</span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg" data-testid={`${testId}-dropdown`}>
          <div className="p-2 border-b space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={showSicCodes ? t("activate.searchByName") : t("activate.search")}
                className="h-8 pl-8 text-sm"
                autoFocus
                data-testid={`${testId}-search`}
              />
            </div>
            {zipSearchEnabled && (
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={zipSearch}
                  onChange={(e) => setZipSearch(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder={t("activate.searchByZip")}
                  className="h-8 pl-8 text-sm"
                  maxLength={5}
                  data-testid={`${testId}-zip-search`}
                />
              </div>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {isZipFiltering ? t("activate.noNeighborhoods") : t("activate.noResults")}
              </div>
            )}
            {filtered.map((g) => {
              const isExpanded = isSearching || isZipFiltering || expanded[g.label];
              return (
                <div key={g.label}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#5B1D8F] bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer"
                    onClick={() => toggleGroup(g.label)}
                    data-testid={`${testId}-group-${g.label}`}
                  >
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    {g.label}
                    <span className="text-[10px] font-normal text-muted-foreground ml-auto">{g.items.length}</span>
                  </button>
                  {isExpanded && g.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full text-left pl-8 pr-3 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors ${item.id === value ? "bg-accent font-medium" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); onSelect(item.id); setOpen(false); setSearch(""); setZipSearch(""); setZipMatches(null); }}
                      data-testid={`${testId}-option-${item.id}`}
                    >
                      {item.name}
                      {showSicCodes && item.sicCode && (
                        <span className="text-xs text-muted-foreground ml-2">· {item.sicCode}</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileStep({
  entityId,
  businessName,
  citySlug,
  flowSessionId,
  setFlowSessionId,
  flowMessages,
  setFlowMessages,
  flowSuggestions,
  setFlowSuggestions,
  flowComplete,
  setFlowComplete,
  flowProgress,
  setFlowProgress,
  flowInput,
  setFlowInput,
  flowStreaming,
  setFlowStreaming,
  flowSessionStarting,
  setFlowSessionStarting,
  flowMessagesEndRef,
  flowChatSessionId,
  onContinue,
  onBack,
}: {
  entityId: string;
  businessName: string;
  citySlug: string;
  flowSessionId: string | null;
  setFlowSessionId: (id: string | null) => void;
  flowMessages: { role: string; content: string }[];
  setFlowMessages: React.Dispatch<React.SetStateAction<{ role: string; content: string }[]>>;
  flowSuggestions: { id: string; label: string }[];
  setFlowSuggestions: React.Dispatch<React.SetStateAction<{ id: string; label: string }[]>>;
  flowComplete: boolean;
  setFlowComplete: (v: boolean) => void;
  flowProgress: { answered: number; total: number };
  setFlowProgress: React.Dispatch<React.SetStateAction<{ answered: number; total: number }>>;
  flowInput: string;
  setFlowInput: (v: string) => void;
  flowStreaming: boolean;
  setFlowStreaming: (v: boolean) => void;
  flowSessionStarting: boolean;
  setFlowSessionStarting: (v: boolean) => void;
  flowMessagesEndRef: (node: HTMLDivElement | null) => void;
  flowChatSessionId: React.MutableRefObject<string>;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();

  const { data: cityData } = useQuery<{ id: string }>({
    queryKey: ["/api/cities", citySlug],
    queryFn: async () => {
      const resp = await fetch(`/api/cities/${citySlug}`);
      if (!resp.ok) return null;
      return resp.json();
    },
  });
  const cityId = cityData?.id;

  useEffect(() => {
    if (flowSessionId || flowSessionStarting || !entityId || !cityId) return;
    setFlowSessionStarting(true);

    fetch("/api/charlotte-public/flow/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flowType: "opportunity-profile",
        cityId,
        businessId: entityId,
        chatSessionId: flowChatSessionId.current,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setFlowSessionId(data.sessionId);
        if (data.progress) {
          setFlowProgress({ answered: data.progress.answered, total: data.progress.total });
          if (data.progress.complete) setFlowComplete(true);
        }
        if (data.nextQuestion?.options) {
          setFlowSuggestions(data.nextQuestion.options.map((o: any) => ({ id: o.id, label: o.label })));
        }
        sendFlowMessage("Hi, I'm ready to answer some questions about my business!", data.sessionId);
      })
      .catch(() => {
        setFlowSessionStarting(false);
      });
  }, [entityId, cityId, flowSessionId, flowSessionStarting]);

  const sendFlowMessage = useCallback(async (userMsg: string, overrideSessionId?: string) => {
    if (!userMsg.trim() || flowStreaming || !cityId) return;
    const activeFlowSessionId = overrideSessionId || flowSessionId;
    if (!activeFlowSessionId) return;

    setFlowInput("");
    setFlowMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setFlowStreaming(true);
    setFlowSuggestions([]);

    try {
      const res = await fetch("/api/charlotte-public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          sessionId: flowChatSessionId.current,
          cityId,
          pageContext: {
            page: "activate",
            step: "profile",
            flowType: "opportunity-profile",
            flowSessionId: activeFlowSessionId,
            businessName,
          },
          locale: "en",
        }),
      });

      if (!res.ok) throw new Error("Failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantContent = "";
      setFlowMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              assistantContent += parsed.content;
              setFlowMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
            if (parsed.suggestions) {
              setFlowSuggestions(parsed.suggestions);
            }
            if (parsed.flowComplete) {
              setFlowComplete(true);
            }
            if (parsed.done && !parsed.content) {
              if (parsed.suggestions) setFlowSuggestions(parsed.suggestions);
              if (parsed.flowComplete) setFlowComplete(true);
            }
          } catch {}
        }
      }

      if (activeFlowSessionId) {
        try {
          const sessionRes = await fetch(`/api/charlotte-public/flow/${activeFlowSessionId}`);
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData.progress) {
              setFlowProgress({ answered: sessionData.progress.answered, total: sessionData.progress.total });
              if (sessionData.progress.complete) setFlowComplete(true);
            }
          }
        } catch {}
      }
    } catch {
      setFlowMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setFlowStreaming(false);
    }
  }, [flowStreaming, cityId, flowSessionId, businessName]);

  const handleSuggestionTap = useCallback((suggestion: { id: string; label: string }) => {
    sendFlowMessage(suggestion.label);
  }, [sendFlowMessage]);

  const progressDots = Array.from({ length: flowProgress.total || 9 }, (_, i) => i < flowProgress.answered);

  return (
    <Card>
      <GradientBar />
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex items-center gap-3" data-testid="profile-step-header">
          <img
            src={charlotteAvatar}
            alt="Charlotte"
            className="h-10 w-10 rounded-full object-cover ring-2 ring-[#5B1D8F]/30 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm" data-testid="text-profile-title">Quick Profile with Charlotte</h3>
            <p className="text-xs text-muted-foreground">Help us understand your business better</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onContinue}
            className="text-xs text-muted-foreground shrink-0"
            data-testid="button-profile-skip"
          >
            <SkipForward className="h-3.5 w-3.5 mr-1" />
            Skip for now
          </Button>
        </div>

        {flowProgress.total > 0 && (
          <div className="flex items-center justify-center gap-1.5" data-testid="profile-progress-dots">
            {progressDots.map((filled, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  filled ? "bg-[#5B1D8F]" : "bg-muted-foreground/20"
                }`}
                data-testid={`progress-dot-${i}`}
              />
            ))}
          </div>
        )}

        <div
          className="rounded-lg border bg-muted/20 overflow-y-auto space-y-3 p-3"
          style={{ maxHeight: "360px", minHeight: "200px" }}
          data-testid="profile-chat-area"
        >
          {flowMessages.length === 0 && !flowStreaming && flowSessionStarting && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#5B1D8F]" />
              <span className="text-sm text-muted-foreground ml-2">Charlotte is getting ready...</span>
            </div>
          )}

          {flowMessages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "assistant" && (
                <img
                  src={charlotteAvatar}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover shrink-0 mt-0.5"
                />
              )}
              <div
                className={`rounded-xl px-3 py-2 text-sm leading-relaxed max-w-[85%] ${
                  msg.role === "user"
                    ? "rounded-tr-sm text-white"
                    : "rounded-tl-sm"
                }`}
                style={
                  msg.role === "user"
                    ? { background: "hsl(273 66% 34%)" }
                    : { background: "hsl(273 66% 34% / 0.08)" }
                }
                data-testid={`profile-message-${i}`}
              >
                {msg.content || (flowStreaming && i === flowMessages.length - 1 ? "..." : "")}
              </div>
            </div>
          ))}
          <div ref={flowMessagesEndRef} />
        </div>

        {flowSuggestions.length > 0 && !flowStreaming && (
          <div className="flex flex-wrap gap-2" data-testid="profile-suggestions">
            {flowSuggestions.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionTap(s)}
                className="rounded-full text-xs border-[#5B1D8F]/30 text-[#5B1D8F] dark:text-[#c9a0e8]"
                data-testid={`suggestion-${s.id}`}
              >
                {s.label}
              </Button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendFlowMessage(flowInput);
          }}
          className="flex gap-1.5"
          data-testid="profile-chat-form"
        >
          <Input
            value={flowInput}
            onChange={(e) => setFlowInput(e.target.value)}
            placeholder="Type your answer..."
            className="text-sm"
            disabled={flowStreaming || !flowSessionId}
            data-testid="input-profile-chat"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!flowInput.trim() || flowStreaming || !flowSessionId}
            className="shrink-0"
            style={{ background: "hsl(273 66% 34%)" }}
            data-testid="button-profile-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {flowComplete && (
          <Button
            onClick={onContinue}
            className="w-full bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white font-semibold"
            data-testid="button-profile-continue"
          >
            Continue to Verification
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function ActivatePage({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const smartBack = useSmartBack(`/${citySlug}`);
  const { setContext: setCharlotteContext } = useCharlotteContext();
  const { t, locale } = useI18n();

  usePageMeta({
    title: t("meta.activateTitle"),
    description: t("meta.activateDesc"),
  });

  const urlParams = new URLSearchParams(window.location.search);
  const initialStep = (urlParams.get("step") as FlowStep) || "entry";
  const initialEntityId = urlParams.get("entityId") || "";

  const [step, setStep] = useState<FlowStep>(
    (initialStep === "success" || initialStep === "upgrade-success") && initialEntityId
      ? initialStep
      : initialStep === "locations" && initialEntityId
        ? "locations"
        : initialStep === "payment" && initialEntityId
          ? "payment"
          : "entry"
  );
  const [presenceType, setPresenceType] = useState<"commerce" | "organization">("commerce");
  const [locationCount, setLocationCount] = useState<"1" | "2-5" | "6+">("1");
  const [entityId, setEntityId] = useState(initialEntityId);
  const [foundPresence, setFoundPresence] = useState<{
    name: string;
    description: string;
    tagline: string;
    neighborhood: string;
    category: string;
    phone: string;
    websiteUrl: string | null;
    isClaim: boolean;
  } | null>(null);

  const [commerceForm, setCommerceForm] = useState({
    name: "", neighborhoodId: "", phone: "", email: "",
    websiteUrl: "", googleProfileUrl: "", primaryCategoryL2: "", shortDescription: "",
    commercialCenterName: "", nearestTransitStopId: "",
    languagesSpoken: ["English"] as string[],
  });

  const [orgForm, setOrgForm] = useState({
    name: "", neighborhoodId: "", phone: "", email: "",
    websiteUrl: "", missionStatement: "", primaryCategoryL2: "",
    executiveDirectorName: "", executiveDirectorTitle: "",
    executiveDirectorPhone: "", executiveDirectorEmail: "",
    boardChairName: "", boardChairPhone: "", boardChairEmail: "",
    nearestTransitStopId: "",
    isNonprofit: false, isCommunityServing: false,
    languagesSpoken: ["English"] as string[],
  });

  const [claimantRole, setClaimantRole] = useState<"owner" | "manager" | "team_member" | "authorized_rep" | "">("");


  const [regionalForm, setRegionalForm] = useState({
    name: "", phone: "", email: "", commerceName: "",
    locationCount: "6+", notes: "", preferredContactMethod: "email" as "email" | "phone" | "either",
  });

  const initialTier = (urlParams.get("tier") || "") === "ENHANCED" ? "ENHANCED" : "" as "ENHANCED" | "";
  const [selectedTier, setSelectedTier] = useState<"ENHANCED" | "">(initialTier);
  const [entitySlug, setEntitySlug] = useState("");
  const [keepVerified, setKeepVerified] = useState(false);
  const [locations, setLocations] = useState<Array<{ name: string; address: string; neighborhoodId: string; phone: string; email: string }>>([{ name: "", address: "", neighborhoodId: "", phone: "", email: "" }]);

  const [flowSessionId, setFlowSessionId] = useState<string | null>(null);
  const [flowMessages, setFlowMessages] = useState<{ role: string; content: string }[]>([]);
  const [flowSuggestions, setFlowSuggestions] = useState<{ id: string; label: string }[]>([]);
  const [flowComplete, setFlowComplete] = useState(false);
  const [flowProgress, setFlowProgress] = useState<{ answered: number; total: number }>({ answered: 0, total: 0 });
  const [flowInput, setFlowInput] = useState("");
  const [flowStreaming, setFlowStreaming] = useState(false);
  const [flowSessionStarting, setFlowSessionStarting] = useState(false);
  const flowMessagesEndRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: "smooth" });
  }, []);
  const flowChatSessionId = useRef<string>(crypto.randomUUID());

  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>>([]);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const placeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeDropdownRef = useRef<HTMLDivElement>(null);

  const searchGooglePlaces = useCallback((query: string) => {
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
    if (query.length < 3) { setPlaceSuggestions([]); setShowPlaceSuggestions(false); return; }
    placeDebounceRef.current = setTimeout(async () => {
      setPlaceSearchLoading(true);
      try {
        const res = await fetch(`/api/google/places/autocomplete?input=${encodeURIComponent(query + " Charlotte NC")}`);
        if (res.ok) {
          const data = await res.json();
          setPlaceSuggestions(data.predictions || []);
          setShowPlaceSuggestions(true);
        }
      } catch {}
      setPlaceSearchLoading(false);
    }, 350);
  }, []);

  const selectPlaceSuggestion = useCallback(async (placeId: string) => {
    setShowPlaceSuggestions(false);
    setPlaceSearchLoading(true);
    try {
      const res = await fetch(`/api/google/places/details?placeId=${placeId}`);
      if (res.ok) {
        const d = await res.json();
        setCommerceForm((prev) => ({
          ...prev,
          name: d.name || prev.name,
          phone: d.phone || prev.phone,
          websiteUrl: d.website || prev.websiteUrl,
          googleProfileUrl: d.mapsUrl || prev.googleProfileUrl,
        }));
      }
    } catch {}
    setPlaceSearchLoading(false);
  }, []);

  const [addressSuggestions, setAddressSuggestions] = useState<Record<number, Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>>>({});
  const [showAddressSuggestions, setShowAddressSuggestions] = useState<Record<number, boolean>>({});
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddresses = useCallback((query: string, idx: number) => {
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (query.length < 3) { setAddressSuggestions((p) => ({ ...p, [idx]: [] })); setShowAddressSuggestions((p) => ({ ...p, [idx]: false })); return; }
    addressDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/google/places/autocomplete?input=${encodeURIComponent(query + " Charlotte NC")}&types=address`);
        if (res.ok) {
          const data = await res.json();
          setAddressSuggestions((p) => ({ ...p, [idx]: data.predictions || [] }));
          setShowAddressSuggestions((p) => ({ ...p, [idx]: true }));
        }
      } catch {}
    }, 350);
  }, []);

  const selectAddressSuggestion = useCallback((description: string, idx: number) => {
    setShowAddressSuggestions((p) => ({ ...p, [idx]: false }));
    setLocations((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], address: description };
      return updated;
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (placeDropdownRef.current && !placeDropdownRef.current.contains(e.target as Node)) {
        setShowPlaceSuggestions(false);
      }
      setShowAddressSuggestions({});
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (initialStep === "success" && initialEntityId) {
      verifyPaymentMutation.mutate();
    }
    if ((initialStep === "upgrade-success" || initialStep === "success") && initialEntityId && !entitySlug) {
      fetch(`/api/businesses/${initialEntityId}/slug`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.slug) setEntitySlug(d.slug); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    setCharlotteContext({
      page: "activate",
      step,
      presenceType,
      selectedTier: selectedTier || undefined,
      businessName: commerceForm.name || orgForm.name || undefined,
      ...(step === "profile" && flowSessionId ? {
        flowType: "opportunity-profile",
        flowSessionId,
        businessId: entityId || undefined,
      } : {}),
    });
    return () => setCharlotteContext(undefined);
  }, [step, presenceType, selectedTier, commerceForm.name, orgForm.name, setCharlotteContext, flowSessionId, entityId]);

  const { data: neighborhoodData } = useQuery<{ groups: { label: string; items: { id: string; name: string; slug: string; type: string }[] }[] }>({
    queryKey: ["/api/activate/neighborhoods", citySlug],
    queryFn: async () => {
      const resp = await fetch(`/api/activate/neighborhoods/${citySlug}`);
      if (!resp.ok) return { groups: [] };
      return resp.json();
    },
  });
  const neighborhoodGroups = neighborhoodData?.groups || [];

  const { data: categoryData } = useQuery<{ groups: { label: string; children: { id: string; name: string; sicCode?: string }[] }[] }>({
    queryKey: ["/api/activate/categories-l2", presenceType],
    queryFn: async () => {
      const resp = await fetch(`/api/activate/categories-l2?type=${presenceType}`);
      if (!resp.ok) return { groups: [] };
      return resp.json();
    },
  });
  const categoryGroups = categoryData?.groups || [];

  const { data: transitLinesData } = useQuery<Array<{ id: string; name: string; lineType: string; color: string; cityId: string }>>({
    queryKey: ["/api/cities", citySlug, "transit-lines"],
  });

  const { data: transitStopsData } = useQuery<Array<{ id: string; transitLineId: string; name: string; address: string | null; sortOrder: number; cityId: string }>>({
    queryKey: ["/api/cities", citySlug, "transit-stops"],
  });

  const MOBILE_HOME_BASED_PARENT_LABELS = ["Mobile & Home-Based"];
  const isMobileHomeBased = categoryGroups.some((g) =>
    MOBILE_HOME_BASED_PARENT_LABELS.includes(g.label) &&
    g.children.some((c) => c.id === commerceForm.primaryCategoryL2)
  );

  const transitStopGroups = (transitLinesData || []).map((line) => ({
    label: line.name,
    items: (transitStopsData || [])
      .filter((stop) => stop.transitLineId === line.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((stop) => ({ id: stop.id, name: stop.name })),
  })).filter((g) => g.items.length > 0);

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const isOrg = presenceType === "organization";
      const body = isOrg
        ? { presenceType, claimantRole, ...orgForm }
        : { presenceType, claimantRole, ...commerceForm };
      const resp = await apiRequest("POST", "/api/activate/create-draft", body);
      return resp.json();
    },
    onSuccess: (data) => {
      setEntityId(data.entityId);
      if (data.foundPresence) {
        setFoundPresence(data.foundPresence);
        setStep("confirm");
      } else {
        setStep("profile");
      }
    },
    onError: (err: any) => {
      toast({ title: t("owner.couldNotSave"), description: err.message, variant: "destructive" });
    },
  });


  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const ref = typeof window !== "undefined" ? localStorage.getItem("ambassador_ref") : null;
      const resp = await apiRequest("POST", "/api/activate/verification-checkout", {
        entityId,
        citySlug,
        ...(ref ? { ref } : {}),
      });
      return resp.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast({ title: t("owner.checkoutError"), description: err.message, variant: "destructive" });
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/activate/verify-payment", { entityId: initialEntityId || entityId });
      return resp.json();
    },
    onSuccess: (data) => {
      if (data.paid) {
        setStep("success");
        setPresenceType(data.presenceType || "commerce");
        if (data.slug) setEntitySlug(data.slug);
        if (data.isNonprofit !== undefined) {
          setOrgForm(prev => ({ ...prev, isNonprofit: data.isNonprofit, isCommunityServing: data.isCommunityServing }));
        }
      }
    },
  });

  const upgradeCheckoutMutation = useMutation({
    mutationFn: async () => {
      const ref = typeof window !== "undefined" ? localStorage.getItem("ambassador_ref") : null;
      const resp = await apiRequest("POST", "/api/activate/upgrade-checkout", {
        entityId,
        tier: selectedTier,
        locations,
        citySlug,
        ...(ref ? { ref } : {}),
      });
      return resp.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: t("owner.comingSoonTitle"), description: t("owner.comingSoonDesc") });
      }
    },
    onError: (err: any) => {
      toast({ title: t("owner.checkoutError"), description: err.message, variant: "destructive" });
    },
  });

  const regionalMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/activate/regional-request", regionalForm);
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: t("owner.requestSubmitted"), description: t("owner.requestSubmittedDesc") });
    },
    onError: (err: any) => {
      toast({ title: t("toast.error"), description: err.message, variant: "destructive" });
    },
  });

  function handleEntryNext() {
    if (locationCount === "6+") {
      setStep("regional");
      return;
    }
    setStep("basics");
  }

  function handleBasicsSubmit(e: React.FormEvent) {
    e.preventDefault();
    createDraftMutation.mutate();
  }


  const activeEntityId = initialEntityId || entityId;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4 pb-32">
      <StepBar current={step} presenceType={presenceType} />

      {/* ── STEP 0: Entry ── */}
      {step === "entry" && (
        <Card>
          <GradientBar />
          <div className="px-6 pt-4">
            <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack} data-testid="link-back-entry">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-entry-title">
              <Sparkles className="h-6 w-6 text-[#F2C230]" />
              {t("activate.activateTitle")}
            </CardTitle>
            <CardDescription>
              {t("activate.activateDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-semibold mb-3 block">{t("activate.whatType")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPresenceType("commerce")}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    presenceType === "commerce" ? "border-[#5B1D8F] bg-[#5B1D8F]/5" : "border-border"
                  }`}
                  data-testid="button-type-commerce"
                >
                  <Store className={`h-6 w-6 mb-2 ${presenceType === "commerce" ? "text-[#5B1D8F]" : "text-muted-foreground"}`} />
                  <span className="font-semibold block">{t("activate.commercePresence")}</span>
                  <span className="text-xs text-muted-foreground">{t("activate.commercePresenceDesc")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPresenceType("organization")}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    presenceType === "organization" ? "border-[#5B1D8F] bg-[#5B1D8F]/5" : "border-border"
                  }`}
                  data-testid="button-type-organization"
                >
                  <Heart className={`h-6 w-6 mb-2 ${presenceType === "organization" ? "text-[#5B1D8F]" : "text-muted-foreground"}`} />
                  <span className="font-semibold block">{t("activate.communityOrg")}</span>
                  <span className="text-xs text-muted-foreground">{t("activate.communityOrgDesc")}</span>
                </button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">{t("activate.howManyLocations")}</Label>
              <div className="grid grid-cols-3 gap-3">
                {(["1", "2-5", "6+"] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setLocationCount(count)}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      locationCount === count ? "border-[#5B1D8F] bg-[#5B1D8F]/5" : "border-border"
                    }`}
                    data-testid={`button-locations-${count}`}
                  >
                    <span className="font-bold block text-lg">{count}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {count === "1" ? t("activate.locationSingular") : count === "2-5" ? t("activate.locationPlural") : t("activate.regionalLabel")}
                    </span>
                  </button>
                ))}
              </div>
              {locationCount === "6+" && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {t("activate.regionalNotice")}
                </p>
              )}
            </div>

            <InspirationQuoteBlock pageContext="activate" variant="subtle" />

            <Button
              onClick={handleEntryNext}
              className="w-full bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
              data-testid="button-entry-next"
            >
              {t("activate.continue")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 1A: Commerce Basics ── */}
      {step === "basics" && presenceType === "commerce" && (
        <Card>
          <GradientBar />
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-commerce-title">
              <Store className="h-5 w-5 text-[#5B1D8F]" />
              {t("activate.commerceBasics")}
            </CardTitle>
            <CardDescription>
              {t("activate.commerceBasicsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBasicsSubmit} className="space-y-4">
              <div className="relative" ref={placeDropdownRef}>
                <Label htmlFor="c-name">{t("activate.commerceName")} *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="c-name"
                    value={commerceForm.name}
                    onChange={(e) => {
                      setCommerceForm({ ...commerceForm, name: e.target.value });
                      searchGooglePlaces(e.target.value);
                    }}
                    onFocus={() => { if (placeSuggestions.length > 0) setShowPlaceSuggestions(true); }}
                    placeholder={t("activate.searchGooglePlaceholder")}
                    required
                    className="pl-10"
                    autoComplete="off"
                    data-testid="input-commerce-name"
                  />
                  {placeSearchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {showPlaceSuggestions && placeSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto" data-testid="places-suggestions">
                    {placeSuggestions.map((p) => (
                      <button
                        key={p.placeId}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-b-0 flex flex-col gap-0.5"
                        onMouseDown={(e) => { e.preventDefault(); selectPlaceSuggestion(p.placeId); }}
                        data-testid={`place-suggestion-${p.placeId}`}
                      >
                        <span className="font-medium text-sm">{p.mainText}</span>
                        <span className="text-xs text-muted-foreground">{p.secondaryText}</span>
                      </button>
                    ))}
                    <div className="px-3 py-1.5 text-[10px] text-muted-foreground/60 text-center">{t("activate.poweredByGoogle")}</div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{t("activate.searchGoogleHint")}</p>
              </div>
              <div>
                <Label htmlFor="c-neighborhood">{t("activate.primaryNeighborhood")} *</Label>
                <SearchableSelect
                  value={commerceForm.neighborhoodId}
                  onSelect={(v) => setCommerceForm({ ...commerceForm, neighborhoodId: v })}
                  groups={neighborhoodGroups}
                  placeholder={t("activate.searchNeighborhood")}
                  testId="select-commerce-neighborhood"
                  t={t}
                  zipSearchEnabled
                  citySlug={citySlug}
                />
              </div>
              <div>
                <Label htmlFor="c-center">{t("activate.shoppingCenter")} <span className="text-muted-foreground text-xs">({t("activate.optional")})</span></Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="c-center"
                    value={commerceForm.commercialCenterName}
                    onChange={(e) => setCommerceForm({ ...commerceForm, commercialCenterName: e.target.value })}
                    placeholder={t("activate.shoppingCenterPlaceholder")}
                    className="pl-10"
                    data-testid="input-commerce-center"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t("activate.shoppingCenterHint")}</p>
              </div>
              {transitStopGroups.length > 0 && (
                <div>
                  <Label htmlFor="c-transit">{t("activate.nearestTransitStop")} <span className="text-muted-foreground text-xs">({t("activate.optional")})</span></Label>
                  <SearchableSelect
                    value={commerceForm.nearestTransitStopId}
                    onSelect={(v) => setCommerceForm({ ...commerceForm, nearestTransitStopId: v })}
                    groups={transitStopGroups}
                    placeholder={t("activate.searchTransitStop")}
                    testId="select-transit-stop"
                    t={t}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("activate.transitHelpCustomers")}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="c-phone">{t("activate.publicPhone")} *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="c-phone"
                      value={commerceForm.phone}
                      onChange={(e) => setCommerceForm({ ...commerceForm, phone: e.target.value })}
                      placeholder="(704) 555-1234"
                      className="pl-10"
                      required
                      data-testid="input-commerce-phone"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="c-email">{t("activate.businessEmail")} *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="c-email"
                      type="email"
                      value={commerceForm.email}
                      onChange={(e) => setCommerceForm({ ...commerceForm, email: e.target.value })}
                      placeholder="hello@yourbusiness.com"
                      className="pl-10"
                      required
                      data-testid="input-commerce-email"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="c-website">{t("activate.websiteUrl")}</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="c-website"
                      value={commerceForm.websiteUrl}
                      onChange={(e) => setCommerceForm({ ...commerceForm, websiteUrl: e.target.value })}
                      placeholder="https://..."
                      className="pl-10"
                      data-testid="input-commerce-website"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="c-google">{t("activate.googleProfileUrl")}</Label>
                  <Input
                    id="c-google"
                    value={commerceForm.googleProfileUrl}
                    onChange={(e) => setCommerceForm({ ...commerceForm, googleProfileUrl: e.target.value })}
                    placeholder={t("activate.googleProfilePlaceholder")}
                    data-testid="input-commerce-google"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="c-category">{t("activate.primaryCategory")} *</Label>
                <SearchableSelect
                  value={commerceForm.primaryCategoryL2}
                  onSelect={(v) => setCommerceForm({ ...commerceForm, primaryCategoryL2: v })}
                  groups={categoryGroups.map((g) => ({ label: g.label, items: g.children }))}
                  placeholder={t("activate.searchCategorySic")}
                  testId="select-commerce-category"
                  t={t}
                  showSicCodes
                />
              </div>
              <div>
                <Label htmlFor="c-desc">{t("activate.shortDescription")} <span className="text-muted-foreground text-xs">({t("activate.shortDescChars")})</span></Label>
                <Textarea
                  id="c-desc"
                  value={commerceForm.shortDescription}
                  onChange={(e) => setCommerceForm({ ...commerceForm, shortDescription: e.target.value.slice(0, 280) })}
                  placeholder={t("activate.shortDescPlaceholder")}
                  rows={3}
                  data-testid="textarea-commerce-description"
                />
                <p className="text-xs text-muted-foreground mt-1">{commerceForm.shortDescription.length}/280</p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  {locale === "es" ? "Idiomas" : "Languages Spoken"}
                </Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {["English", "Spanish", "French", "Mandarin", "Vietnamese", "Hindi", "Arabic", "Korean", "Portuguese", "German", "Japanese", "Tagalog"].map((lang) => (
                    <label key={lang} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commerceForm.languagesSpoken.includes(lang)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...commerceForm.languagesSpoken, lang]
                            : commerceForm.languagesSpoken.filter((l) => l !== lang);
                          setCommerceForm({ ...commerceForm, languagesSpoken: next });
                        }}
                        data-testid={`checkbox-lang-${lang.toLowerCase()}`}
                      />
                      {lang}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{locale === "es" ? "Seleccione todos los idiomas que su equipo habla" : "Select all languages your team speaks"}</p>
              </div>
              <div>
                <Label htmlFor="c-role">{t("activate.yourRole")} *</Label>
                <Select value={claimantRole} onValueChange={(v) => setClaimantRole(v as typeof claimantRole)}>
                  <SelectTrigger data-testid="select-commerce-role">
                    <SelectValue placeholder={t("activate.selectRoleBusiness")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">{t("activate.roleOwner")}</SelectItem>
                    <SelectItem value="manager">{t("activate.roleManager")}</SelectItem>
                    <SelectItem value="team_member">{t("activate.roleTeamMember")}</SelectItem>
                    <SelectItem value="authorized_rep">{t("activate.roleAuthorizedRep")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep("entry")} data-testid="button-basics-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("activate.back")}
                </Button>
                <Button
                  type="submit"
                  disabled={createDraftMutation.isPending}
                  className="flex-1 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                  data-testid="button-basics-next"
                >
                  {createDraftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {t("activate.continueToVerification")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 1B: Organization Basics ── */}
      {step === "basics" && presenceType === "organization" && (
        <Card>
          <GradientBar />
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-org-title">
              <Heart className="h-5 w-5 text-[#F04FAF]" />
              {t("activate.orgBasics")}
            </CardTitle>
            <CardDescription>
              {t("activate.orgBasicsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBasicsSubmit} className="space-y-4">
              <div>
                <Label htmlFor="o-name">{t("activate.orgNameLabel")} *</Label>
                <Input
                  id="o-name"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder={t("activate.orgNamePlaceholder")}
                  required
                  data-testid="input-org-name"
                />
              </div>
              <div>
                <Label htmlFor="o-neighborhood">{t("activate.primaryNeighborhood")} *</Label>
                <SearchableSelect
                  value={orgForm.neighborhoodId}
                  onSelect={(v) => setOrgForm({ ...orgForm, neighborhoodId: v })}
                  groups={neighborhoodGroups}
                  placeholder={t("activate.searchNeighborhood")}
                  testId="select-org-neighborhood"
                  t={t}
                  zipSearchEnabled
                  citySlug={citySlug}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="o-phone">{t("activate.publicPhone")} *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="o-phone"
                      value={orgForm.phone}
                      onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                      className="pl-10"
                      required
                      data-testid="input-org-phone"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="o-email">{t("activate.businessEmail")} *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="o-email"
                      type="email"
                      value={orgForm.email}
                      onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                      className="pl-10"
                      required
                      data-testid="input-org-email"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="o-website">{t("activate.websiteUrl")}</Label>
                <Input
                  id="o-website"
                  value={orgForm.websiteUrl}
                  onChange={(e) => setOrgForm({ ...orgForm, websiteUrl: e.target.value })}
                  placeholder="https://..."
                  data-testid="input-org-website"
                />
              </div>
              <div>
                <Label htmlFor="o-mission">{t("activate.missionLabel")} *</Label>
                <Textarea
                  id="o-mission"
                  value={orgForm.missionStatement}
                  onChange={(e) => setOrgForm({ ...orgForm, missionStatement: e.target.value })}
                  placeholder={t("activate.missionPlaceholder")}
                  rows={3}
                  required
                  data-testid="textarea-org-mission"
                />
              </div>
              <div>
                <Label htmlFor="o-category">{t("activate.orgType")} *</Label>
                <SearchableSelect
                  value={orgForm.primaryCategoryL2}
                  onSelect={(v) => setOrgForm({ ...orgForm, primaryCategoryL2: v })}
                  groups={categoryGroups.map((g) => ({ label: g.label, items: g.children }))}
                  placeholder={t("activate.searchOrgTypeSic")}
                  testId="select-org-category"
                  t={t}
                  showSicCodes
                />
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#5B1D8F]" />
                  {t("activate.nonprofitStatus")}
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="o-nonprofit"
                    checked={orgForm.isNonprofit}
                    onChange={(e) => setOrgForm({ ...orgForm, isNonprofit: e.target.checked, isCommunityServing: e.target.checked ? orgForm.isCommunityServing : false })}
                    className="h-4 w-4 rounded border-gray-300 text-[#5B1D8F] focus:ring-[#5B1D8F]"
                    data-testid="checkbox-is-nonprofit"
                  />
                  <Label htmlFor="o-nonprofit" className="text-sm cursor-pointer">
                    {t("activate.isNonprofit")}
                  </Label>
                </div>
                {orgForm.isNonprofit && (
                  <div className="ml-7 space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="o-community"
                        checked={orgForm.isCommunityServing}
                        onChange={(e) => setOrgForm({ ...orgForm, isCommunityServing: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-[#5B1D8F] focus:ring-[#5B1D8F]"
                        data-testid="checkbox-is-community-serving"
                      />
                      <Label htmlFor="o-community" className="text-sm cursor-pointer">
                        {t("activate.isCommunityServing")}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("activate.communityServingExamples")}
                    </p>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#5B1D8F]" />
                  {t("activate.execDirector")} *
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ed-name">{t("activate.fullName")} *</Label>
                    <Input
                      id="ed-name"
                      value={orgForm.executiveDirectorName}
                      onChange={(e) => setOrgForm({ ...orgForm, executiveDirectorName: e.target.value })}
                      required
                      data-testid="input-ed-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ed-title">{t("activate.title")}</Label>
                    <Input
                      id="ed-title"
                      value={orgForm.executiveDirectorTitle}
                      onChange={(e) => setOrgForm({ ...orgForm, executiveDirectorTitle: e.target.value })}
                      data-testid="input-ed-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ed-phone">{t("activate.directPhone")} *</Label>
                    <Input
                      id="ed-phone"
                      value={orgForm.executiveDirectorPhone}
                      onChange={(e) => setOrgForm({ ...orgForm, executiveDirectorPhone: e.target.value })}
                      required
                      data-testid="input-ed-phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ed-email">{t("activate.directEmail")} *</Label>
                    <Input
                      id="ed-email"
                      type="email"
                      value={orgForm.executiveDirectorEmail}
                      onChange={(e) => setOrgForm({ ...orgForm, executiveDirectorEmail: e.target.value })}
                      required
                      data-testid="input-ed-email"
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  {t("activate.boardChair")} ({t("activate.optional")})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    placeholder="Full Name"
                    value={orgForm.boardChairName}
                    onChange={(e) => setOrgForm({ ...orgForm, boardChairName: e.target.value })}
                    data-testid="input-bc-name"
                  />
                  <Input
                    placeholder="Phone"
                    value={orgForm.boardChairPhone}
                    onChange={(e) => setOrgForm({ ...orgForm, boardChairPhone: e.target.value })}
                    data-testid="input-bc-phone"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={orgForm.boardChairEmail}
                    onChange={(e) => setOrgForm({ ...orgForm, boardChairEmail: e.target.value })}
                    data-testid="input-bc-email"
                  />
                </div>
              </div>

              {transitStopGroups.length > 0 && (
                <div>
                  <Label htmlFor="o-transit">{t("activate.nearestTransitStop")} <span className="text-muted-foreground text-xs">({t("activate.optional")})</span></Label>
                  <SearchableSelect
                    value={orgForm.nearestTransitStopId}
                    onSelect={(v) => setOrgForm({ ...orgForm, nearestTransitStopId: v })}
                    groups={transitStopGroups}
                    placeholder={t("activate.searchTransitStop")}
                    testId="select-transit-stop"
                    t={t}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("activate.transitHelpVisitors")}</p>
                </div>
              )}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  {locale === "es" ? "Idiomas" : "Languages Spoken"}
                </Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {["English", "Spanish", "French", "Mandarin", "Vietnamese", "Hindi", "Arabic", "Korean", "Portuguese", "German", "Japanese", "Tagalog"].map((lang) => (
                    <label key={lang} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgForm.languagesSpoken.includes(lang)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...orgForm.languagesSpoken, lang]
                            : orgForm.languagesSpoken.filter((l) => l !== lang);
                          setOrgForm({ ...orgForm, languagesSpoken: next });
                        }}
                        data-testid={`checkbox-org-lang-${lang.toLowerCase()}`}
                      />
                      {lang}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{locale === "es" ? "Seleccione todos los idiomas que su equipo habla" : "Select all languages your team speaks"}</p>
              </div>
              <div>
                <Label htmlFor="o-role">{t("activate.yourRole")} *</Label>
                <Select value={claimantRole} onValueChange={(v) => setClaimantRole(v as typeof claimantRole)}>
                  <SelectTrigger data-testid="select-org-role">
                    <SelectValue placeholder={t("activate.selectRoleOrg")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">{t("activate.roleExecDirector")}</SelectItem>
                    <SelectItem value="manager">{t("activate.roleProgramManager")}</SelectItem>
                    <SelectItem value="team_member">{t("activate.roleTeamVolunteer")}</SelectItem>
                    <SelectItem value="authorized_rep">{t("activate.roleAuthorizedRep")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep("entry")} data-testid="button-org-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("activate.back")}
                </Button>
                <Button
                  type="submit"
                  disabled={createDraftMutation.isPending}
                  className="flex-1 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                  data-testid="button-org-next"
                >
                  {createDraftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {t("activate.continueToVerification")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: Confirm Presence ── */}
      {step === "confirm" && foundPresence && (
        <Card>
          <GradientBar />
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-confirm-title">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {t("activate.foundIt")}
            </CardTitle>
            <CardDescription>
              {t("activate.isThisYours", { type: presenceType === "organization" ? t("activate.organizationStep").toLowerCase() : t("activate.commerceStep").toLowerCase() })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="bg-gradient-to-r from-[#5B1D8F]/10 to-[#F2C230]/10 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#5B1D8F]/10 flex items-center justify-center shrink-0">
                    {presenceType === "organization"
                      ? <Heart className="h-7 w-7 text-[#F04FAF]" />
                      : <Building2 className="h-7 w-7 text-[#5B1D8F]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold" data-testid="text-confirm-name">{foundPresence.name}</h3>
                    {foundPresence.tagline && (
                      <p className="text-sm text-[#5B1D8F] font-medium mt-0.5 italic" data-testid="text-confirm-tagline">"{foundPresence.tagline}"</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {foundPresence.neighborhood}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{foundPresence.category}</Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-sm leading-relaxed text-foreground" data-testid="text-confirm-description">
                  {foundPresence.description}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {foundPresence.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{foundPresence.phone}</span>
                    </div>
                  )}
                  {foundPresence.websiteUrl && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{foundPresence.websiteUrl}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {t("activate.canEditAfter")}
            </p>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("basics")} data-testid="button-confirm-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("activate.back")}
              </Button>
              <Button
                onClick={() => setStep("profile")}
                className="flex-1 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white font-bold"
                data-testid="button-confirm-proceed"
              >
                {t("activate.looksGoodContinue")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2.5: Profile — Charlotte Opportunity Interview ── */}
      {step === "profile" && (
        <ProfileStep
          entityId={entityId}
          businessName={commerceForm.name || orgForm.name}
          citySlug={citySlug}
          flowSessionId={flowSessionId}
          setFlowSessionId={setFlowSessionId}
          flowMessages={flowMessages}
          setFlowMessages={setFlowMessages}
          flowSuggestions={flowSuggestions}
          setFlowSuggestions={setFlowSuggestions}
          flowComplete={flowComplete}
          setFlowComplete={setFlowComplete}
          flowProgress={flowProgress}
          setFlowProgress={setFlowProgress}
          flowInput={flowInput}
          setFlowInput={setFlowInput}
          flowStreaming={flowStreaming}
          setFlowStreaming={setFlowStreaming}
          flowSessionStarting={flowSessionStarting}
          setFlowSessionStarting={setFlowSessionStarting}
          flowMessagesEndRef={flowMessagesEndRef}
          flowChatSessionId={flowChatSessionId}
          onContinue={() => setStep("payment")}
          onBack={() => foundPresence ? setStep("confirm") : setStep("basics")}
        />
      )}

      {/* ── STEP 3: $1 Verification Payment ── */}
      {step === "payment" && (
        <Card>
          <GradientBar />
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-payment-title">
              <CreditCard className="h-5 w-5 text-[#F2C230]" />
              {t("activate.verificationPayment")}
            </CardTitle>
            <CardDescription>
              {t("activate.verificationPaymentDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="bg-[#5B1D8F]/5 border border-[#5B1D8F]/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t("activate.presenceVerification")}</span>
                <span className="font-bold text-lg text-[#5B1D8F]">$1.00</span>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  {t("activate.verifiedBadge")}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  {t("activate.recognizedAcross")}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  {t("activate.eligibleUpgrades")}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  {t("activate.spamProtection")}
                </li>
              </ul>
            </div>

            <InspirationQuoteBlock pageContext="activate" variant="subtle" />

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("basics")} data-testid="button-payment-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("activate.back")}
              </Button>
              <Button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="flex-1 bg-[#F2C230] hover:bg-[#F2C230]/90 text-[#5B1D8F] font-bold"
                data-testid="button-pay-1-dollar"
              >
                {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                {t("activate.payAndVerify")}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              {t("activate.securePayment")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 4: Success / Post-Verification ── */}
      {step === "success" && (
        <div className="space-y-4">
          <Card>
            <GradientBar />
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold" data-testid="text-success-title">
                {presenceType === "organization"
                  ? t("activate.orgVerified")
                  : t("activate.commerceVerified")}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t("activate.congratsVerified")}
              </p>
              <Badge className="bg-[#5B1D8F] text-white text-sm px-4 py-1">
                <Star className="h-3.5 w-3.5 mr-1" />
                {t("activate.verifiedPresence")}
              </Badge>
            </CardContent>
          </Card>

          {presenceType === "organization" && orgForm.isNonprofit && orgForm.isCommunityServing ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="bg-[#F04FAF]/10 border border-[#F04FAF]/20 rounded-lg p-4 flex items-start gap-3">
                  <Heart className="h-5 w-5 text-[#F04FAF] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{t("activate.hubPresenceGift")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("activate.hubPresenceGiftDesc")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-[#F04FAF] hover:bg-[#F04FAF]/90 text-white"
                    onClick={() => navigate(entitySlug ? `/${citySlug}/owner/${entitySlug}` : `/${citySlug}`)}
                    data-testid="button-invite-supporters"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {t("activate.goToDashboard")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#5B1D8F]" />
                    <CardTitle className="text-lg" data-testid="text-upgrade-title">{t("activate.chooseLevel")}</CardTitle>
                  </div>
                  <CardDescription>
                    {t("activate.chooseLevelDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <TierVisualPreviews
                    businessName={presenceType === "commerce" ? commerceForm.name : orgForm.name}
                    selectedTier={selectedTier}
                    onSelect={(tier) => { setSelectedTier(tier); setKeepVerified(false); }}
                    mode="select"
                    showVerified={false}
                  />
                  <div className="px-0 py-3 mt-3 border-t">
                    <p className="text-[11px] text-muted-foreground text-center">
                      {t("activate.hubBuilderRatesNote")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {selectedTier && !keepVerified && (
                <Button
                  className="w-full bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white font-semibold h-12"
                  onClick={() => setStep("hub-level")}
                  data-testid="button-continue-upgrade"
                >
                  {t("activate.continueWith")} {t("activate.expandedHubPresence")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}

              <div className="flex items-center gap-3 px-1">
                <button
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${keepVerified ? "bg-[#5B1D8F] border-[#5B1D8F]" : "border-muted-foreground/30 hover:border-muted-foreground/60"}`}
                  onClick={() => { setKeepVerified(!keepVerified); if (!keepVerified) setSelectedTier(""); }}
                  data-testid="checkbox-keep-verified"
                >
                  {keepVerified && <Check className="h-3 w-3 text-white" />}
                </button>
                <span className="text-sm text-muted-foreground">{t("activate.noThanksVerified")}</span>
              </div>

              {keepVerified && (
                <Button
                  className="w-full bg-muted hover:bg-muted/80 text-foreground font-medium h-11"
                  onClick={() => navigate(entitySlug ? `/${citySlug}/owner/${entitySlug}` : `/${citySlug}`)}
                  data-testid="button-go-dashboard"
                >
                  {t("activate.goToDashboard")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── STEP 5A: Hub Level Selection ── */}
      {step === "hub-level" && (
        <div className="space-y-5">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 bg-[#5B1D8F]/10 text-[#5B1D8F] rounded-full px-4 py-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              {t("activate.upgradeYourPresence")}
            </div>
            <h2 className="text-2xl font-bold" data-testid="text-hub-level-title">{t("activate.chooseYourHubPresence")}</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {t("activate.bothTiersInclude")}
            </p>
          </div>

          <TierVisualPreviews
            businessName={presenceType === "commerce" ? commerceForm.name : orgForm.name}
            selectedTier={selectedTier}
            onSelect={(tier) => setSelectedTier(tier)}
            mode="select"
            showVerified={false}
          />

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={() => setStep("success")} data-testid="button-hub-level-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("activate.back")}
            </Button>
            <Button
              onClick={() => {
                const included = selectedTier === "ENHANCED" ? 2 : 1;
                const emptyLoc = { name: "", address: "", neighborhoodId: "", phone: "", email: "" };
                setLocations((prev) => {
                  if (prev.length < included) {
                    return [...prev, ...Array(included - prev.length).fill(null).map(() => ({ ...emptyLoc }))];
                  }
                  return prev;
                });
                setStep("locations");
              }}
              disabled={!selectedTier}
              className="flex-1 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white font-semibold"
              data-testid="button-hub-level-next"
            >
              {t("activate.continueToLocations")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 5B: Locations ── */}
      {step === "locations" && (
        <div className="space-y-5">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 bg-teal-600/10 text-teal-700 dark:text-teal-400 rounded-full px-4 py-1.5 text-sm font-medium">
              <MapPin className="h-4 w-4" />
              {t("activate.expandedHubPresence")}
            </div>
            <h2 className="text-2xl font-bold" data-testid="text-locations-title">{t("activate.addYourLocations")}</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {selectedTier === "ENHANCED"
                ? t("activate.twoLocationsIncludedDesc")
                : t("activate.oneLocationIncludedDesc")}
            </p>
            {isMobileHomeBased && (
              <p className="text-sm text-teal-600 dark:text-teal-400 font-medium" data-testid="text-mobile-address-hint">
                {locale === "es"
                  ? "Como negocio m\u00f3vil o basado en casa, la direcci\u00f3n f\u00edsica es opcional."
                  : "As a mobile or home-based business, a physical address is optional."}
              </p>
            )}
          </div>

          {locations.map((loc, idx) => {
            const included = selectedTier === "ENHANCED" ? 2 : 1;
            const isExtra = idx >= included;
            return (
              <Card key={idx} className={`overflow-hidden ${isExtra ? "ring-1 ring-amber-400/50" : ""}`}>
                <div className={`h-1 ${isExtra ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-teal-500 to-teal-600"}`} />
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${isExtra ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700" : "bg-teal-100 dark:bg-teal-900/30 text-teal-700"}`}>
                        {idx + 1}
                      </div>
                      {t("activate.locationLabel")} {idx + 1}
                      {isExtra && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-2 py-0">{t("activate.addOn")}</Badge>}
                      {!isExtra && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-[10px] px-2 py-0">{t("activate.included")}</Badge>}
                    </span>
                    {locations.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocations(locations.filter((_, i) => i !== idx))}
                        className="h-7 w-7 p-0 text-muted-foreground"
                        data-testid={`button-remove-location-${idx}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">{t("activate.locationNameLabel")} <span className="text-muted-foreground">({t("activate.optional")})</span></Label>
                      <Input
                        value={loc.name}
                        onChange={(e) => {
                          const updated = [...locations];
                          updated[idx] = { ...loc, name: e.target.value };
                          setLocations(updated);
                        }}
                        placeholder={commerceForm.name ? `${commerceForm.name}` : t("activate.locationNameLabel")}
                        data-testid={`input-location-name-${idx}`}
                      />
                    </div>
                    <div className="relative">
                      <Label className="text-xs font-medium">{t("activate.address")} {isMobileHomeBased ? <span className="text-muted-foreground">({t("activate.optional")})</span> : "*"}</Label>
                      <Input
                        value={loc.address}
                        onChange={(e) => {
                          const updated = [...locations];
                          updated[idx] = { ...loc, address: e.target.value };
                          setLocations(updated);
                          searchAddresses(e.target.value, idx);
                        }}
                        placeholder={t("activate.startTypingAddress")}
                        required
                        autoComplete="off"
                        data-testid={`input-location-address-${idx}`}
                      />
                      {showAddressSuggestions[idx] && (addressSuggestions[idx] || []).length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto" data-testid={`address-suggestions-${idx}`}>
                          {(addressSuggestions[idx] || []).map((s) => (
                            <button
                              key={s.placeId}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0 text-sm"
                              onMouseDown={(e) => { e.preventDefault(); selectAddressSuggestion(s.description, idx); }}
                              data-testid={`address-option-${idx}-${s.placeId}`}
                            >
                              {s.description}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-medium">{t("activate.neighborhood")} *</Label>
                      <SearchableSelect
                        value={loc.neighborhoodId}
                        onSelect={(v) => {
                          const updated = [...locations];
                          updated[idx] = { ...loc, neighborhoodId: v };
                          setLocations(updated);
                        }}
                        groups={neighborhoodGroups}
                        placeholder={t("activate.searchNeighborhood")}
                        testId={`select-location-neighborhood-${idx}`}
                        t={t}
                        zipSearchEnabled
                        citySlug={citySlug}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">{t("activate.phone")} *</Label>
                      <Input
                        value={loc.phone}
                        onChange={(e) => {
                          const updated = [...locations];
                          updated[idx] = { ...loc, phone: e.target.value };
                          setLocations(updated);
                        }}
                        placeholder="(704) 555-0100"
                        required
                        data-testid={`input-location-phone-${idx}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-medium">{t("activate.email")} <span className="text-muted-foreground">({t("activate.optional")})</span></Label>
                      <Input
                        type="email"
                        value={loc.email}
                        onChange={(e) => {
                          const updated = [...locations];
                          updated[idx] = { ...loc, email: e.target.value };
                          setLocations(updated);
                        }}
                        placeholder="location@example.com"
                        data-testid={`input-location-email-${idx}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {locations.length < 5 && (
            <button
              onClick={() => setLocations([...locations, { name: "", address: "", neighborhoodId: "", phone: "", email: "" }])}
              className="w-full p-3 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:border-[#5B1D8F]/30 hover:text-[#5B1D8F]"
              data-testid="button-add-location"
            >
              <Plus className="h-4 w-4" />
              {t("activate.addAnotherLocation")}
            </button>
          )}

          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#5B1D8F]/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-[#5B1D8F]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold block">{t("activate.expandedHubPresence")}</span>
                    <span className="text-xs text-muted-foreground">{locations.length} {locations.length > 1 ? t("activate.locationPlural") : t("activate.locationSingular")}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg">$99</span>
                  <span className="text-xs text-muted-foreground block">{t("activate.perYear")}</span>
                </div>
              </div>
              {locations.length > (selectedTier === "ENHANCED" ? 2 : 1) && (
                <div className="mt-3 pt-3 border-t text-xs text-amber-600 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  {t("activate.addOnLocations", { count: String(locations.length - (selectedTier === "ENHANCED" ? 2 : 1)) })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("hub-level")} data-testid="button-locations-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("activate.back")}
            </Button>
            <Button
              onClick={() => upgradeCheckoutMutation.mutate()}
              disabled={upgradeCheckoutMutation.isPending || (!isMobileHomeBased && !locations[0]?.address) || !locations[0]?.neighborhoodId || !locations[0]?.phone}
              className="flex-1 bg-[#F2C230] hover:bg-[#F2C230]/90 text-[#5B1D8F] font-bold"
              data-testid="button-checkout-upgrade"
            >
              {upgradeCheckoutMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              {t("activate.continueToCheckout")}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {t("activate.secureAnnualPayment")}
          </p>
        </div>
      )}

      {/* ── STEP 5C: Upgrade Success ── */}
      {step === "upgrade-success" && (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5B1D8F] via-[#5B1D8F] to-[#F04FAF] p-8 text-center text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(242,194,48,0.15),transparent_60%)]" />
            <div className="relative z-10 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center ring-4 ring-white/10">
                {selectedTier === "ENHANCED"
                  ? <Zap className="h-10 w-10 text-[#F2C230]" />
                  : <Crown className="h-10 w-10 text-[#F2C230]" />}
              </div>
              <h2 className="text-2xl font-bold" data-testid="text-upgrade-success-title">
                {selectedTier === "ENHANCED" ? t("activate.expandedHubPresence") : t("activate.hubPresence")} {t("activate.activated")}
              </h2>
              <p className="text-white/80 text-sm max-w-md mx-auto">
                {t("activate.upgradeConfirmed")}
              </p>
              <Badge className="bg-white/20 text-white border-0 text-sm px-4 py-1">
                <Star className="h-3.5 w-3.5 mr-1.5" />
                {t("activate.founderRateLockedIn")}
              </Badge>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6 pb-5 space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#F2C230]" />
                {t("activate.whatHappensNext")}
              </h3>
              <div className="space-y-3">
                {[
                  { icon: Globe, text: t("activate.micrositeBeingCreated"), color: "text-[#5B1D8F]" },
                  { icon: Search, text: t("activate.presenceBoosted"), color: "text-teal-600" },
                  { icon: Star, text: t("activate.reviewsEnabled"), color: "text-amber-600" },
                  ...(selectedTier === "ENHANCED" ? [{ icon: MapPin, text: t("activate.multiZoneAvailable"), color: "text-[#F04FAF]" }] : []),
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className={`w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 ${item.color}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-muted-foreground pt-1.5">{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white font-semibold h-12"
            onClick={() => navigate(entitySlug ? `/${citySlug}/owner/${entitySlug}` : `/${citySlug}`)}
            data-testid="button-explore-hub"
          >
            {t("activate.goToDashboard")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ── STEP R: Regional Handoff ── */}
      {step === "regional" && (
        <Card>
          <GradientBar />
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-regional-title">
              <MapPin className="h-5 w-5 text-amber-600" />
              {t("activate.regionalRequest")}
            </CardTitle>
            <CardDescription>
              {t("activate.regionalRequestDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                regionalMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="r-name">{t("activate.yourName")} *</Label>
                  <Input
                    id="r-name"
                    value={regionalForm.name}
                    onChange={(e) => setRegionalForm({ ...regionalForm, name: e.target.value })}
                    required
                    data-testid="input-regional-name"
                  />
                </div>
                <div>
                  <Label htmlFor="r-commerce">{t("activate.commerceOrgName")} *</Label>
                  <Input
                    id="r-commerce"
                    value={regionalForm.commerceName}
                    onChange={(e) => setRegionalForm({ ...regionalForm, commerceName: e.target.value })}
                    required
                    data-testid="input-regional-commerce"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="r-phone">{t("activate.phone")} *</Label>
                  <Input
                    id="r-phone"
                    value={regionalForm.phone}
                    onChange={(e) => setRegionalForm({ ...regionalForm, phone: e.target.value })}
                    required
                    data-testid="input-regional-phone"
                  />
                </div>
                <div>
                  <Label htmlFor="r-email">{t("activate.email")} *</Label>
                  <Input
                    id="r-email"
                    type="email"
                    value={regionalForm.email}
                    onChange={(e) => setRegionalForm({ ...regionalForm, email: e.target.value })}
                    required
                    data-testid="input-regional-email"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="r-locations">{t("activate.numberOfLocations")}</Label>
                <Input
                  id="r-locations"
                  value={regionalForm.locationCount}
                  onChange={(e) => setRegionalForm({ ...regionalForm, locationCount: e.target.value })}
                  placeholder="e.g., 8"
                  data-testid="input-regional-locations"
                />
              </div>
              <div>
                <Label>{t("activate.preferredContact")}</Label>
                <div className="flex gap-3 mt-1">
                  {(["email", "phone", "either"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRegionalForm({ ...regionalForm, preferredContactMethod: m })}
                      className={`px-4 py-2 rounded-lg border text-sm capitalize transition-colors ${
                        regionalForm.preferredContactMethod === m ? "border-[#5B1D8F] bg-[#5B1D8F]/5 font-medium" : "border-border"
                      }`}
                      data-testid={`button-contact-${m}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="r-notes">{t("activate.notes")}</Label>
                <Textarea
                  id="r-notes"
                  value={regionalForm.notes}
                  onChange={(e) => setRegionalForm({ ...regionalForm, notes: e.target.value })}
                  placeholder={t("activate.notesPlaceholder")}
                  rows={3}
                  data-testid="textarea-regional-notes"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep("entry")} data-testid="button-regional-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("activate.back")}
                </Button>
                <Button
                  type="submit"
                  disabled={regionalMutation.isPending || regionalMutation.isSuccess}
                  className="flex-1 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                  data-testid="button-regional-submit"
                >
                  {regionalMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {regionalMutation.isSuccess ? t("activate.submitted") : t("activate.submitRequest")}
                </Button>
              </div>
              {regionalMutation.isSuccess && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-green-800 dark:text-green-300">{t("activate.requestSubmitted")}</p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">{t("activate.teamWillReachOut")}</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
