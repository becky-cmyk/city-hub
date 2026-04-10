import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, Save, Bot, MessageSquare, Sparkles, Info,
  Brain, Globe, DollarSign, AtSign, Shield, Radar,
  Quote, Languages, BookOpen, Clock, ExternalLink,
  ChevronDown, ChevronUp,
} from "lucide-react";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";

interface KnowledgeDomain {
  name: string;
  description: string;
}

interface CapabilitySummary {
  knowledgeDomains: KnowledgeDomain[];
  lastScanTimestamp: string | null;
  quotesCount: number;
  taglinesCount: number;
}

const DOMAIN_ICONS: Record<string, typeof Brain> = {
  "Platform Features": Brain,
  "Coverage Area": Globe,
  "Pricing & Tiers": DollarSign,
  "Handles & Identity": AtSign,
  "Tiered Permissions": Shield,
  "Pulse Intelligence": Radar,
  "Inspirational Quotes": Quote,
  "Platform Taglines": Sparkles,
  "Bilingual Support": Languages,
  "Community Storytelling": BookOpen,
};

export default function TeachCharlottePanel({ cityId: propCityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [showTestChat, setShowTestChat] = useState(false);
  const [domainsExpanded, setDomainsExpanded] = useState(false);

  const { data: city } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/cities/charlotte"],
  });

  const cityId = propCityId || city?.id;

  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/admin/charlotte-public/config", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/charlotte-public/config/${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
    enabled: !!cityId,
  });

  const { data: capabilitySummary, isLoading: capLoading } = useQuery<CapabilitySummary>({
    queryKey: ["/api/admin/charlotte/capability-summary"],
  });

  const [greeting, setGreeting] = useState("");
  const [instructions, setInstructions] = useState("");
  const [talkingPoints, setTalkingPoints] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (config) {
      setGreeting(config.greetingMessage || "");
      setInstructions(config.systemInstructions || "");
      setTalkingPoints(config.talkingPoints || "");
      setIsActive(config.isActive ?? true);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/admin/charlotte-public/config/${cityId}`, {
        greetingMessage: greeting,
        systemInstructions: instructions,
        talkingPoints: talkingPoints,
        isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-public/config", cityId] });
      toast({ title: "Saved", description: "Charlotte's public chat config has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save config. Please try again.", variant: "destructive" });
    },
  });

  if (isLoading || !cityId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <img src={charlotteAvatar} alt="Charlotte" className="h-12 w-12 rounded-full object-cover ring-2 ring-purple-500/30" />
        <div>
          <h1 className="text-xl font-bold" data-testid="text-teach-charlotte-title">Teach Charlotte</h1>
          <p className="text-sm text-muted-foreground">Configure what Charlotte says to public visitors in the chat</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTestChat(!showTestChat)}
            data-testid="button-test-charlotte"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            {showTestChat ? "Hide Preview" : "Test Charlotte"}
          </Button>
          <Label htmlFor="charlotte-active" className="text-sm">Active</Label>
          <Switch
            id="charlotte-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            data-testid="switch-charlotte-active"
          />
        </div>
      </div>

      {showTestChat && (
        <Card data-testid="card-test-charlotte-preview">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              Charlotte Chat Preview
            </CardTitle>
            <CardDescription>
              This opens the public chat so you can test how Charlotte responds with the current configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden" style={{ height: "500px" }}>
              <iframe
                src="/?charlotte=open"
                className="w-full h-full border-0"
                title="Charlotte Chat Preview"
                data-testid="iframe-charlotte-preview"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-charlotte-knowledge">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            What Charlotte Knows
          </CardTitle>
          <CardDescription>
            Charlotte's core knowledge is built-in and always current. Use the fields below to add seasonal announcements, event-specific talking points, or temporary instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {capLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : capabilitySummary ? (
            <>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Quote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground" data-testid="text-quotes-count">{capabilitySummary.quotesCount}</span> quotes
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground" data-testid="text-taglines-count">{capabilitySummary.taglinesCount}</span> taglines
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Last scan:{" "}
                    <span className="font-medium text-foreground" data-testid="text-last-scan">
                      {capabilitySummary.lastScanTimestamp
                        ? new Date(capabilitySummary.lastScanTimestamp).toLocaleString()
                        : "No scans yet"}
                    </span>
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <button
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover-elevate rounded-md px-2 py-1 w-full text-left"
                  onClick={() => setDomainsExpanded(!domainsExpanded)}
                  data-testid="button-toggle-domains"
                >
                  {domainsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {capabilitySummary.knowledgeDomains.length} Knowledge Domains
                </button>

                {domainsExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {capabilitySummary.knowledgeDomains.map((domain) => {
                      const IconComponent = DOMAIN_ICONS[domain.name] || Brain;
                      return (
                        <div
                          key={domain.name}
                          className="flex items-start gap-3 p-3 rounded-md bg-muted/40"
                          data-testid={`domain-${domain.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                        >
                          <IconComponent className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">{domain.name}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{domain.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load capability summary.</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Custom Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Add temporary overrides, seasonal messaging, or event-specific instructions below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Greeting Message
          </CardTitle>
          <CardDescription>
            This is what Charlotte says when someone first opens the chat. Make it welcoming and informative.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="Hey there! I'm Charlotte, your friendly AI guide to CLT Metro Hub..."
            className="min-h-[100px]"
            data-testid="input-charlotte-greeting"
          />
          <p className="text-xs text-muted-foreground mt-2">{greeting.length} characters</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Additional Instructions
          </CardTitle>
          <CardDescription>
            These instructions are layered on top of Charlotte's built-in knowledge. Use them for temporary behavioral changes, seasonal context, or specific rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Be warm and friendly. Always mention that we're launching soon. Encourage people to claim their business presence..."
            className="min-h-[200px] font-mono text-sm"
            data-testid="input-charlotte-instructions"
          />
          <div className="flex items-start gap-2 mt-3 p-3 rounded-md bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Charlotte already knows about platform features, pricing, coverage, handles, tiered permissions, and inspirational quotes. 
              Use this field for things like: "Always mention our launch event on March 15th" or "When asked about pricing, explain the $1 verification tier first."
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Key Talking Points
          </CardTitle>
          <CardDescription>
            Specific facts, announcements, or temporary details you want Charlotte to know and share. Put each point on a new line.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={talkingPoints}
            onChange={(e) => setTalkingPoints(e.target.value)}
            placeholder={"- We're launching in Spring 2026\n- Early adopters get the intro rate at $99/yr (normally $699)\n- We cover 14 Charlotte neighborhoods + 4 metro towns\n- Bilingual support in English and Spanish"}
            className="min-h-[160px] font-mono text-sm"
            data-testid="input-charlotte-talking-points"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Chat is Live" : "Chat is Off"}
          </Badge>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-2"
          data-testid="button-save-charlotte-config"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
