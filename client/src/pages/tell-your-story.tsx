import { useState, useCallback, useEffect, useRef } from "react";
import { useCity } from "@/hooks/use-city";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, CheckCircle2, Clock, Loader2, ImagePlus, X, FileText, Sparkles, LogIn, Upload, FileUp, Heart } from "lucide-react";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import { mainLogo } from "@/lib/logos";
import { VerificationCTA } from "@/components/verification-cta";
import StoryFormFallback from "./story-form-fallback";

interface StoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface Suggestion {
  id: string;
  label: string;
}

interface GeneratedStory {
  title: string;
  content: string;
  wordCount?: number;
}

interface TopicProgress {
  id: string;
  label: string;
  completed: boolean;
}

interface Completeness {
  ready: boolean;
  suggestion: string;
}

function useQueryParam(key: string): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  } catch {
    return null;
  }
}

export default function TellYourStory({ citySlug }: { citySlug: string }) {
  const { data: city, refetch: refetchCity } = useCity(citySlug);
  const { toast } = useToast();
  const { user, isLoggedIn, isLoading: authLoading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const cityName = city?.name || "Charlotte";
  const cityId = city?.id;
  const mode = useQueryParam("mode") === "recognition" ? "recognition" : "standard";
  const intentParam = useQueryParam("intent");

  const intentTitle = intentParam === "event" ? "Submit an Event"
    : intentParam === "shout-out" ? "Give a Shout-Out"
    : intentParam === "nominate" ? "Nominate a Story"
    : intentParam === "activate" ? "Activate Your Presence"
    : intentParam === "venue" ? "Join the Venue Network"
    : "Share Your Story";

  usePageMeta({
    title: `${intentTitle} | ${cityName} Metro Hub`,
    description: `${intentTitle} with ${cityName} Metro Hub. A short conversation to spotlight the people and businesses that make this community special.`,
  });

  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [flowSessionId, setFlowSessionId] = useState<string | null>(null);
  const [chatSessionId] = useState(() => `story-${crypto.randomUUID()}`);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(null);
  const [flowComplete, setFlowComplete] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([]);
  const [storyDepthScore, setStoryDepthScore] = useState(0);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<{ thumb: string; original: string; variants?: Record<string, string> }[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{ url: string; filename: string; mimetype: string; type: "pdf" | "image" }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [verificationOffer, setVerificationOffer] = useState<{ businessId: string; businessName: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [premiumRequired, setPremiumRequired] = useState<{ tier: string | null; businessId: string | null } | null>(null);
  const consecutiveFailures = useRef(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const completedCount = topicProgress.filter((t) => t.completed).length;
  const hasBasics = completedCount >= 3;

  const handleFallback = useCallback(() => {
    toast({
      title: "Switching to form mode",
      description: "We'll use a step-by-step form instead.",
    });

    const intentFallbackMap: Record<string, string> = {
      event: `/${citySlug}/submit/event`,
      "shout-out": `/${citySlug}/submit/shout-out`,
      nominate: `/${citySlug}/submit/article`,
      activate: `/${citySlug}/activate`,
      venue: `/${citySlug}/tell-your-story`,
    };

    const redirectUrl = intentParam ? intentFallbackMap[intentParam] : null;
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      setFallbackMode(true);
    }
  }, [citySlug, intentParam, toast]);

  useEffect(() => {
    if (isLoggedIn && !rateLimitMessage && !conversationStarted) {
      const flowType = intentParam === "event" ? "event-submission" : "story-interview";
      fetch(`/api/charlotte-public/flow/rate-limit?flowType=${flowType}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.allowed === false && data.reason === "rate_limited") {
            setRateLimitMessage(data.message || "You've reached your submission limit this week. Come back next week or upgrade for more.");
          }
        })
        .catch(() => {});
    }
  }, [isLoggedIn, intentParam, rateLimitMessage, conversationStarted]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, suggestions]);

  const resolveCityId = useCallback(async (): Promise<string | null> => {
    if (cityId) return cityId;
    try {
      const result = await refetchCity();
      if (result.data?.id) return result.data.id;
    } catch {}
    try {
      const res = await fetch(`/api/cities/${citySlug || "charlotte"}`);
      if (res.ok) {
        const data = await res.json();
        if (data.id) return data.id;
      }
    } catch {}
    return null;
  }, [cityId, citySlug, refetchCity]);

  const resolvedFlowType = intentParam === "event" ? "event-submission" : "story-interview";

  const initSession = useCallback(async () => {
    if (flowSessionId) return flowSessionId;

    const resolvedCityId = await resolveCityId();
    if (!resolvedCityId) return null;

    try {
      const res = await fetch("/api/charlotte-public/flow/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowType: resolvedFlowType,
          cityId: resolvedCityId,
          chatSessionId,
        }),
      });
      if (res.status === 429) {
        const data = await res.json();
        setRateLimitMessage(data.message || "You've reached your submission limit this week. Come back next week or upgrade for more.");
        setConversationStarted(false);
        return null;
      }
      if (!res.ok) {
        console.error("[TellYourStory] flow/start failed:", res.status);
        return null;
      }
      const data = await res.json();
      if (data.sessionId) {
        setFlowSessionId(data.sessionId);
        consecutiveFailures.current = 0;
        return data.sessionId;
      }
    } catch (err) {
      console.error("[TellYourStory] initSession error:", err);
    }
    return null;
  }, [chatSessionId, flowSessionId, resolveCityId, resolvedFlowType]);

  const sendInitialGreeting = useCallback(
    async (fsId: string) => {
      const resolvedCityId = await resolveCityId();
      if (!resolvedCityId) return;
      setIsStreaming(true);
      setMessages([{ role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/charlotte-public/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: intentParam === "activate" ? "Hi! I'd like to activate my business."
              : intentParam === "event" ? "Hi! I'd like to submit an event."
              : intentParam === "shout-out" ? "Hi! I'd like to give a shout-out."
              : intentParam === "nominate" ? "Hi! I'd like to nominate someone for a story."
              : intentParam === "venue" ? "Hi! I'd like to join the venue network."
              : "Hi! I'd like to tell my story.",
            sessionId: chatSessionId,
            cityId: resolvedCityId,
            pageContext: {
              page: "tell-your-story",
              flowType: resolvedFlowType,
              flowSessionId: fsId,
              cityName,
              mode,
              intent: intentParam || undefined,
            },
          }),
        });

        if (!res.ok) {
          console.error("[TellYourStory] chat failed:", res.status);
          throw new Error("Failed");
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
          await processStream(res);
        } else {
          const data = await res.json();
          if (data.content) {
            setMessages([{ role: "assistant", content: data.content }]);
          } else {
            throw new Error("Unexpected response format");
          }
        }
        consecutiveFailures.current = 0;
      } catch (err) {
        console.error("[TellYourStory] sendInitialGreeting error:", err);
        consecutiveFailures.current += 1;
        if (consecutiveFailures.current >= 2) {
          handleFallback();
          return;
        }
        setMessages([
          {
            role: "assistant",
            content:
              "Hi there! I'm Charlotte, the Neighborhood Story Editor for City Metro Hub. I'd love to hear your story and share it with the community.\n\nLet's start with something simple \u2014 what's your name?",
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [resolveCityId, chatSessionId, cityName, mode, handleFallback]
  );

  const startConversation = useCallback(async () => {
    setConversationStarted(true);
    const resolvedCityId = await resolveCityId();
    if (!resolvedCityId) {
      setConversationStarted(false);
      toast({
        title: "Unable to connect",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }
    let fsId = flowSessionId;
    if (!fsId) {
      fsId = await initSession();
    }
    if (fsId) {
      sendInitialGreeting(fsId);
    } else {
      consecutiveFailures.current += 1;
      if (consecutiveFailures.current >= 2) {
        handleFallback();
        return;
      }
      setMessages([
        {
          role: "assistant",
          content:
            "Hi there! I'm Charlotte, the Neighborhood Story Editor for City Metro Hub. I'd love to hear your story and share it with the community.\n\nLet's start with something simple \u2014 what's your name?",
        },
      ]);
    }
  }, [flowSessionId, initSession, sendInitialGreeting, resolveCityId, toast, handleFallback]);

  const processStream = async (res: Response) => {
    const reader = res.body?.getReader();
    if (!reader) {
      console.error("[TellYourStory] No reader available on response body");
      return;
    }

    const decoder = new TextDecoder();
    let assistantContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));

          if (parsed.content) {
            assistantContent += parsed.content;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                updated[lastIdx] = { role: "assistant", content: assistantContent };
              }
              return updated;
            });
          }

          if (parsed.done) {
            if (parsed.suggestions) {
              setSuggestions(parsed.suggestions);
            } else {
              setSuggestions([]);
            }
            if (parsed.flowComplete) {
              setFlowComplete(true);
            }
            if (parsed.generatedStory) {
              setGeneratedStory(parsed.generatedStory);
            }
            if (parsed.topicProgress) {
              setTopicProgress(parsed.topicProgress);
            }
            if (parsed.storyDepthScore !== undefined) {
              setStoryDepthScore(parsed.storyDepthScore);
            }
            if (parsed.completeness) {
              setCompleteness(parsed.completeness);
            }
            if (parsed.verificationOffer) {
              setVerificationOffer(parsed.verificationOffer);
            }
            if (parsed.premiumRequired) {
              setPremiumRequired({
                tier: parsed.premiumTier || null,
                businessId: parsed.premiumBusinessId || null,
              });
            }
          }
        } catch (parseErr) {
          console.error("[TellYourStory] SSE parse error:", parseErr, line);
        }
      }
    }
  };

  const handlePhotoUpload = useCallback(async (files: FileList) => {
    if (!files.length) return;
    setIsUploading(true);
    const newPhotos: { thumb: string; original: string; variants?: Record<string, string> }[] = [];

    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          newPhotos.push({
            thumb: data.variants?.thumb || data.url,
            original: data.variants?.original || data.url,
            variants: data.variants,
          });
        }
      } catch (err) {
        console.error("[TellYourStory] photo upload error:", err);
      }
    }

    if (newPhotos.length > 0) {
      setUploadedPhotos((prev) => [...prev, ...newPhotos]);
      if (flowSessionId) {
        const photoData = newPhotos.map((p) => ({
          original: p.original,
          ...(p.variants || {}),
        }));
        try {
          await fetch("/api/charlotte-public/flow/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: flowSessionId, photoUrls: photoData }),
          });
        } catch (err) {
          console.error("[TellYourStory] save photos error:", err);
        }
      }
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `[Shared ${newPhotos.length} photo${newPhotos.length > 1 ? "s" : ""}]` },
      ]);
    }
    setIsUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, [flowSessionId]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!files.length) return;
    setIsUploadingFile(true);
    const newFiles: { url: string; filename: string; mimetype: string; type: "pdf" | "image" }[] = [];

    const totalExisting = uploadedFiles.length;
    const maxFiles = 6;
    const remaining = maxFiles - totalExisting;

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) continue;

      if (isPdf && uploadedFiles.some(f => f.type === "pdf")) {
        toast({ title: "Only one PDF allowed", description: "You can upload one PDF document per submission.", variant: "destructive" });
        continue;
      }

      if (isImage && uploadedFiles.filter(f => f.type === "image").length + newFiles.filter(f => f.type === "image").length >= 5) {
        toast({ title: "Image limit reached", description: "You can upload up to 5 images per submission.", variant: "destructive" });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          newFiles.push({
            url: data.variants?.original || data.url,
            filename: data.filename || file.name,
            mimetype: file.type,
            type: isPdf ? "pdf" : "image",
          });
        }
      } catch (err) {
        console.error("[TellYourStory] file upload error:", err);
      }
    }

    if (newFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      if (flowSessionId) {
        try {
          await fetch("/api/charlotte-public/flow/upload-files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: flowSessionId, files: newFiles }),
          });
        } catch (err) {
          console.error("[TellYourStory] save files error:", err);
        }
      }
      const pdfCount = newFiles.filter(f => f.type === "pdf").length;
      const imgCount = newFiles.filter(f => f.type === "image").length;
      const parts: string[] = [];
      if (pdfCount > 0) parts.push(`${pdfCount} PDF`);
      if (imgCount > 0) parts.push(`${imgCount} image${imgCount > 1 ? "s" : ""}`);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `[Uploaded ${parts.join(" and ")}]` },
      ]);
      toast({ title: "Files uploaded", description: `${parts.join(" and ")} uploaded successfully. These will be reviewed by our team.` });
    }
    setIsUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [flowSessionId, uploadedFiles, toast]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = text || input.trim();
      if (!msg || isStreaming) return;

      const resolvedCityId = await resolveCityId();
      if (!resolvedCityId) return;

      let currentFlowSessionId = flowSessionId;
      if (!currentFlowSessionId) {
        currentFlowSessionId = await initSession();
      }

      setInput("");
      setSuggestions([]);
      const isForceGenerate = msg === "[GENERATE_MY_STORY]";
      if (!isForceGenerate) {
        setMessages((prev) => [...prev, { role: "user", content: msg }]);
      }
      setIsStreaming(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/charlotte-public/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            sessionId: chatSessionId,
            cityId: resolvedCityId,
            pageContext: {
              page: "tell-your-story",
              flowType: resolvedFlowType,
              flowSessionId: currentFlowSessionId || flowSessionId,
              cityName,
              mode,
              intent: intentParam || undefined,
            },
          }),
        });

        if (!res.ok) {
          console.error("[TellYourStory] sendMessage failed:", res.status);
          throw new Error("Failed");
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
          await processStream(res);
        } else {
          const data = await res.json();
          if (data.content) {
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                updated[lastIdx] = { role: "assistant", content: data.content };
              }
              return updated;
            });
          }
        }
        consecutiveFailures.current = 0;
      } catch (err) {
        console.error("[TellYourStory] sendMessage error:", err);
        consecutiveFailures.current += 1;
        if (consecutiveFailures.current >= 2) {
          handleFallback();
          return;
        }
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
            updated[lastIdx] = {
              role: "assistant",
              content: "Sorry, something went wrong. Could you try that again?",
            };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [input, isStreaming, resolveCityId, flowSessionId, chatSessionId, cityName, mode, initSession, handleFallback]
  );

  if (fallbackMode) {
    return <StoryFormFallback citySlug={citySlug} cityName={cityName} cityId={cityId || ""} onBackToChat={() => setFallbackMode(false)} />;
  }

  if (generatedStory) {
    return (
      <div
        className="dark flex flex-col items-center justify-start p-4 pt-8 bg-gray-950 text-gray-100"
        style={{
          minHeight: "100dvh",
        }}
      >
        <div className="w-full max-w-lg space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <img
                src={charlotteAvatar}
                alt="Charlotte"
                className="h-16 w-16 rounded-full object-cover ring-4 ring-muted/40"
                data-testid="img-charlotte-avatar-success"
              />
              <CheckCircle2
                className="absolute -bottom-1 -right-1 h-6 w-6 text-green-500 bg-white rounded-full"
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-story-complete-title">
              Thank you for sharing your story.
            </h1>
            <p className="text-muted-foreground text-sm max-w-sm" data-testid="text-story-complete-desc">
              We'll use what you shared to help shape a community spotlight for the Metro Hub. If anything needs to be clarified, someone from our side may follow up.
            </p>
          </div>

          <Card className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-foreground" data-testid="text-story-title">
              {generatedStory.title}
            </h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-story-content">
              {generatedStory.content}
            </div>
          </Card>

          {verificationOffer && (
            <Card className="p-5 space-y-3 border-primary/20">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <img
                    src={charlotteAvatar}
                    alt="Charlotte"
                    className="h-10 w-10 rounded-full object-cover"
                    data-testid="img-charlotte-verification"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm text-foreground leading-relaxed" data-testid="text-verification-message">
                    I found your listing for <span className="font-semibold">{verificationOffer.businessName}</span>! To verify it, we just ask for a $1 donation to our community fund — it goes right back into supporting local hubs and neighborhoods.
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-verification-details">
                    Verified listings get a badge and appear higher in search results and feeds.
                  </p>
                </div>
              </div>
              <Button
                className="w-full gap-2"
                disabled={isVerifying}
                onClick={async () => {
                  setIsVerifying(true);
                  try {
                    const res = await fetch("/api/activate/verification-checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        entityId: verificationOffer.businessId,
                        citySlug,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.url) {
                        window.location.href = data.url;
                        return;
                      }
                    }
                    toast({
                      title: "Unable to start donation",
                      description: "Please try again or visit your listing page to verify.",
                      variant: "destructive",
                    });
                  } catch {
                    toast({
                      title: "Unable to start donation",
                      description: "Please try again or visit your listing page to verify.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsVerifying(false);
                  }
                }}
                data-testid="button-community-fund-donation"
              >
                {isVerifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
                Donate $1 to the Community Fund
              </Button>
            </Card>
          )}

          <div className="text-center space-y-3">
            <p className="text-xs text-muted-foreground" data-testid="text-notification-message">
              Your story is being reviewed. We'll let you know when it goes live.
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.href = `/${citySlug}`}
              data-testid="button-back-to-hub"
            >
              Explore {cityName} Metro Hub
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (flowComplete && premiumRequired && !generatedStory) {
    return (
      <div
        className="dark flex flex-col items-center justify-start p-4 pt-8 bg-gray-950 text-gray-100"
        style={{
          minHeight: "100dvh",
        }}
      >
        <div className="w-full max-w-lg space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <img
                src={charlotteAvatar}
                alt="Charlotte"
                className="h-16 w-16 rounded-full object-cover ring-4 ring-muted/40"
                data-testid="img-charlotte-avatar-premium"
              />
              <CheckCircle2
                className="absolute -bottom-1 -right-1 h-6 w-6 text-green-500 bg-white rounded-full"
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-story-saved-title">
              Your story has been saved.
            </h1>
            <p className="text-muted-foreground text-sm max-w-sm" data-testid="text-story-saved-desc">
              Everything you shared has been saved and will be reviewed by our editorial team. Thank you for telling your story!
            </p>
          </div>

          <Card className="p-5 space-y-3 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <img
                  src={charlotteAvatar}
                  alt="Charlotte"
                  className="h-10 w-10 rounded-full object-cover"
                  data-testid="img-charlotte-premium-cta"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm text-foreground leading-relaxed" data-testid="text-premium-message">
                  Want Charlotte to write your spotlight article? Upgrade your presence to Enhanced and get a full AI-crafted profile — plus featured placement in the community feed and search results.
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-premium-details">
                  Enhanced members get Charlotte AI writing, priority visibility, and more.
                </p>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => {
                const target = premiumRequired.businessId
                  ? `/${citySlug}/presence/pricing?businessId=${premiumRequired.businessId}`
                  : `/${citySlug}/presence/pricing`;
                window.location.href = target;
              }}
              data-testid="button-upgrade-presence"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade Your Presence
            </Button>
          </Card>

          {verificationOffer && (
            <Card className="p-5 space-y-3 border-primary/20">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <img
                    src={charlotteAvatar}
                    alt="Charlotte"
                    className="h-10 w-10 rounded-full object-cover"
                    data-testid="img-charlotte-verification-premium"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm text-foreground leading-relaxed" data-testid="text-verification-message-premium">
                    I found your listing for <span className="font-semibold">{verificationOffer.businessName}</span>! To verify it, we just ask for a $1 donation to our community fund — it goes right back into supporting local hubs and neighborhoods.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                disabled={isVerifying}
                onClick={async () => {
                  setIsVerifying(true);
                  try {
                    const res = await fetch("/api/activate/verification-checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        entityId: verificationOffer.businessId,
                        citySlug,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.url) {
                        window.location.href = data.url;
                        return;
                      }
                    }
                    toast({
                      title: "Unable to start donation",
                      description: "Please try again or visit your listing page to verify.",
                      variant: "destructive",
                    });
                  } catch {
                    toast({
                      title: "Unable to start donation",
                      description: "Please try again or visit your listing page to verify.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsVerifying(false);
                  }
                }}
                data-testid="button-community-fund-donation-premium"
              >
                {isVerifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
                Donate $1 to the Community Fund
              </Button>
            </Card>
          )}

          <div className="text-center space-y-3">
            <p className="text-xs text-muted-foreground" data-testid="text-review-message">
              Your story is being reviewed. We'll let you know when it goes live.
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.href = `/${citySlug}`}
              data-testid="button-back-to-hub-premium"
            >
              Explore {cityName} Metro Hub
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!conversationStarted) {
    return (
      <div
        className="dark flex flex-col items-center justify-center p-6 bg-gray-950 text-gray-100"
        style={{
          minHeight: "100dvh",
        }}
      >
        <div className="w-full max-w-md text-center space-y-6">
          <img
            src={mainLogo}
            alt="CLT Metro Hub"
            className="h-16 mx-auto object-contain"
            data-testid="img-clt-logo"
          />

          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-story-headline">
              {mode === "recognition"
                ? "We'd Love to Spotlight Your Story"
                : intentParam === "activate"
                ? "Activate Your Hub Presence"
                : intentParam === "event"
                ? "Submit a Community Event"
                : intentParam === "shout-out"
                ? "Give Someone a Shout-Out"
                : intentParam === "nominate"
                ? "Nominate Someone's Story"
                : "Share Your Story With Charlotte"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto" data-testid="text-story-subheadline">
              {mode === "recognition"
                ? "We recently came across your business and would love to learn more about what you bring to the community."
                : intentParam === "activate"
                ? "Charlotte will walk you through confirming your listing and getting your presence activated on the Metro Hub."
                : intentParam === "event"
                ? "Charlotte will walk you through submitting your event so it gets listed on the Metro Hub for the community to discover."
                : intentParam === "shout-out"
                ? "Know someone who deserves recognition? Charlotte will help you share what makes them special with the community."
                : intentParam === "nominate"
                ? "Know someone whose story should be told? Charlotte will gather the details and help connect us to them."
                : "Charlotte is gathering short conversations with local businesses, organizations, and community voices to help spotlight the people who make this community special."}
            </p>
            <p className="text-sm text-muted-foreground" data-testid="text-story-support">
              This only takes a few minutes.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span data-testid="text-estimated-time">Estimated time: 4-5 minutes</span>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
            <Upload className="h-3.5 w-3.5" />
            <span data-testid="text-upload-option">You can also upload a PDF or images with your submission</span>
          </div>

          {authLoading ? (
            <Button disabled data-testid="button-start-story">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </Button>
          ) : !isLoggedIn ? (
            <>
              <Button
                onClick={() => setShowAuthDialog(true)}
                data-testid="button-sign-in-to-start"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In to Get Started
              </Button>
              <p className="text-xs text-muted-foreground" data-testid="text-auth-required">
                Create a free account or sign in to share your story with the community.
              </p>
              <AuthDialog
                open={showAuthDialog}
                onOpenChange={setShowAuthDialog}
                defaultTab="register"
              />
            </>
          ) : rateLimitMessage ? (
            <div className="space-y-4">
              <Card className="p-5 space-y-3 text-center">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-foreground font-medium" data-testid="text-rate-limit-message">
                  {rateLimitMessage}
                </p>
              </Card>
              <Button
                variant="outline"
                onClick={() => window.location.href = `/${citySlug}`}
                data-testid="button-back-to-hub-rate-limit"
              >
                Explore {cityName} Metro Hub
              </Button>
            </div>
          ) : (
            <Button
              onClick={startConversation}
              disabled={conversationStarted}
              data-testid="button-start-story"
            >
              {conversationStarted ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                "Start the Conversation"
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="dark flex flex-col bg-gray-950 text-gray-100"
      style={{
        height: "100dvh",
      }}
    >
      <div className="shrink-0 flex flex-col items-center pt-4 pb-2 px-4 text-center border-b border-border/40">
        <img
          src={mainLogo}
          alt="CLT Metro Hub"
          className="h-10 object-contain mb-2"
          data-testid="img-clt-logo-chat"
        />
        {completedCount > 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="text-step-progress">
            {!hasBasics
              ? "Getting Started"
              : storyDepthScore >= 70
                ? "Almost There"
                : "Story Interview"}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="text-step-progress">
            Story Interview
          </p>
        )}
        {user && <div className="mt-1"><VerificationCTA compact /></div>}
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-3 pb-0 min-h-0">
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-3 py-3 min-h-0"
        >
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "assistant" && (
                <img
                  src={charlotteAvatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5"
                />
              )}
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-md bg-primary text-primary-foreground max-w-[80%]"
                    : "rounded-tl-md bg-muted/60 border border-border/30 text-foreground max-w-[85%]"
                }`}
                data-testid={`chat-message-${msg.role}-${i}`}
              >
                {msg.content ||
                  (isStreaming && i === messages.length - 1 ? (
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  ) : (
                    ""
                  ))}
              </div>
            </div>
          ))}

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-9" data-testid="story-suggestions">
              {suggestions.map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(s.label)}
                  disabled={isStreaming}
                  className="rounded-full text-xs min-h-9"
                  data-testid={`button-suggestion-${s.id}`}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 pt-2 pb-4">
          {(uploadedPhotos.length > 0 || uploadedFiles.length > 0) && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2" data-testid="story-uploaded-files">
              {uploadedPhotos.map((photo, i) => (
                <div key={`photo-${i}`} className="relative shrink-0">
                  <img
                    src={photo.thumb}
                    alt={`Photo ${i + 1}`}
                    className="h-14 w-14 rounded-lg object-cover border border-border/40"
                    data-testid={`img-uploaded-photo-${i}`}
                  />
                  <button
                    type="button"
                    onClick={() => setUploadedPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5"
                    data-testid={`button-remove-photo-${i}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
              {uploadedFiles.map((file, i) => (
                <div key={`file-${i}`} className="relative shrink-0">
                  {file.type === "image" ? (
                    <img
                      src={file.url}
                      alt={file.filename}
                      className="h-14 w-14 rounded-lg object-cover border border-border/40"
                      data-testid={`img-uploaded-file-${i}`}
                    />
                  ) : (
                    <div
                      className="h-14 w-14 rounded-lg border border-border/40 bg-muted/40 flex flex-col items-center justify-center gap-0.5"
                      data-testid={`file-uploaded-pdf-${i}`}
                    >
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground truncate w-12 text-center">PDF</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5"
                    data-testid={`button-remove-file-${i}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(completeness?.ready || messages.filter(m => m.role === "user").length >= 5) && !flowComplete && !generatedStory && (
            <div className="pb-2">
              <Button
                variant="outline"
                className="w-full gap-2 border-amber-500/40 text-amber-700 dark:text-amber-400"
                onClick={() => sendMessage("[GENERATE_MY_STORY]")}
                disabled={isStreaming}
                data-testid="button-generate-my-story"
              >
                <Sparkles className="h-4 w-4" />
                Generate My Story
              </Button>
            </div>
          )}

          {flowComplete && !generatedStory ? (
            <div className="flex items-center gap-2 justify-center py-3">
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              <span className="text-sm text-muted-foreground" data-testid="text-generating-story">
                Putting your story together...
              </span>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handlePhotoUpload(e.target.files);
                }}
                data-testid="input-photo-upload"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files);
                }}
                data-testid="input-file-upload"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => photoInputRef.current?.click()}
                disabled={isStreaming || isUploading}
                className="shrink-0"
                data-testid="button-add-photos"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || isUploadingFile}
                className="shrink-0"
                data-testid="button-upload-pdf"
              >
                {isUploadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Share your thoughts here"
                className="text-sm"
                disabled={isStreaming}
                data-testid="input-story-chat"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isStreaming}
                className="shrink-0"
                data-testid="button-story-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
          {conversationStarted && !flowComplete && uploadedPhotos.length === 0 && uploadedFiles.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 text-center mt-1.5" data-testid="text-upload-hint">
              Upload a PDF (article or press release) or images (up to 5) alongside your story. Tap the upload icons to get started.
            </p>
          )}
          {conversationStarted && !flowComplete && (
            <button
              type="button"
              onClick={() => handleFallback()}
              className="w-full text-center text-[11px] text-muted-foreground/50 py-1 mt-1 flex items-center justify-center gap-1"
              data-testid="button-switch-to-form"
            >
              <FileText className="h-3 w-3" />
              Prefer to type your answers? Switch to form
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
