import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageSquare, X, Send, Loader2, Sparkles } from "lucide-react";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PageContext {
  page: string;
  step?: string;
  presenceType?: string;
  selectedTier?: string;
  businessName?: string;
}

const STEP_GREETING_KEYS: Record<string, TranslationKey> = {
  entry: "charlotte.salesEntry",
  basics: "charlotte.salesBasics",
  confirm: "charlotte.salesConfirm",
  verify: "charlotte.salesVerify",
  payment: "charlotte.salesPayment",
  success: "charlotte.salesSuccess",
  "hub-level": "charlotte.salesHubLevel",
  "upgrade-success": "charlotte.salesUpgradeSuccess",
  locations: "charlotte.salesLocations",
  regional: "charlotte.salesRegional",
};

export function CharlotteSalesWidget({ citySlug, context }: { citySlug: string; context?: PageContext }) {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const getGreeting = (step?: string) => {
    if (step && STEP_GREETING_KEYS[step]) return t(STEP_GREETING_KEYS[step]);
    return t("charlotte.salesDefault");
  };
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: getGreeting(context?.step) },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef(`activate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const lastStepRef = useRef(context?.step);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    if (context?.step && context.step !== lastStepRef.current) {
      lastStepRef.current = context.step;
      const stepGreeting = getGreeting(context.step);
      if (stepGreeting) {
        setMessages((prev) => [...prev, { role: "assistant", content: stepGreeting }]);
      }
    }
  }, [context?.step, locale]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      const resp = await fetch("/api/charlotte-public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionIdRef.current,
          cityId: "charlotte-main",
          pageContext: contextRef.current,
          locale,
        }),
      });

      if (!resp.ok) throw new Error("Chat failed");

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.content) {
              assistantContent += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: t("charlotte.connectionError") },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming]);

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-[340px] sm:w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-200">
          <Card className="shadow-2xl border-2 overflow-hidden" style={{ borderColor: "hsl(273 66% 34% / 0.3)" }}>
            <div className="flex items-center gap-3 p-3 border-b" style={{ background: "linear-gradient(135deg, hsl(273 66% 34%), hsl(273 66% 40%))" }}>
              <img src={charlotteAvatar} alt="Charlotte" className="w-8 h-8 rounded-full border-2 border-white/30" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white">Charlotte</p>
                <p className="text-[10px] text-white/70">{t("charlotte.hubGuide")}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white/80"
                data-testid="button-close-charlotte-sales"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div ref={scrollRef} className="h-[320px] overflow-y-auto p-3 space-y-3 bg-muted/30">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <img src={charlotteAvatar} alt="" className="w-6 h-6 rounded-full shrink-0 mt-1" />
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#5B1D8F] text-white rounded-br-sm"
                        : "bg-background border rounded-bl-sm"
                    }`}
                  >
                    {msg.content.split("\n").map((line, j) => (
                      <p key={j} className={j > 0 ? "mt-1.5" : ""}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.content === "" && (
                <div className="flex gap-2">
                  <img src={charlotteAvatar} alt="" className="w-6 h-6 rounded-full shrink-0 mt-1" />
                  <div className="bg-background border rounded-xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-2 border-t flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={t("charlotte.askAnything")}
                className="text-sm"
                disabled={isStreaming}
                data-testid="input-charlotte-sales-message"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={isStreaming || !input.trim()}
                className="shrink-0 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90"
                data-testid="button-charlotte-sales-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 rounded-full px-4 py-3 shadow-xl bg-[#5B1D8F] text-white"
        data-testid="button-charlotte-sales-toggle"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <span className="flex items-center gap-2">
            <img src={charlotteAvatar} alt="" className="w-6 h-6 rounded-full" />
            <span className="text-sm font-semibold hidden sm:inline">{t("charlotte.askButton")}</span>
            <MessageSquare className="h-4 w-4 opacity-80" />
          </span>
        )}
      </Button>
    </>
  );
}
