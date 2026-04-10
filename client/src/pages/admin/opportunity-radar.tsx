import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2, Mail, Phone, Zap, Search, ArrowUpDown, Filter,
  Check, ExternalLink, Target, Radio, Download, Users, Sparkles,
  FileText, X, Send, BookOpen, PhoneCall, MapPin, Monitor,
  Plus, ClipboardCheck, Navigation, Activity, Loader2, Globe,
  ChevronDown, ChevronUp, ChevronRight, ChevronsUpDown, LayoutGrid, Briefcase, Newspaper,
  AlertTriangle, TrendingDown, BarChart3, ShieldAlert, MoreHorizontal,
  Eye, Star, MessageSquare, ArrowRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function LinkifiedBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed">
      {lines.map((line, li) => {
        const labelMatch = line.match(/^(.+?):\s*(https?:\/\/[^\s]+)\s*$/);
        if (labelMatch) {
          return (
            <span key={li}>
              <a href={labelMatch[2]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium underline">{labelMatch[1]}</a>
              {"\n"}
            </span>
          );
        }
        const urlOnly = line.match(/^(https?:\/\/[^\s]+)$/);
        if (urlOnly) {
          return (
            <span key={li}>
              <a href={urlOnly[1]} target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 underline break-all">{urlOnly[1]}</a>
              {"\n"}
            </span>
          );
        }
        return <span key={li}>{line}{li < lines.length - 1 ? "\n" : ""}</span>;
      })}
    </div>
  );
}

interface EmailPipelineStatus {
  readyToReach: number;
  target: number;
  pendingCrawls: number;
  recentEmailsFound: number;
  lastCrawlAt: string | null;
  deficit: number;
}

type OpportunityCategory = "ready_to_reach" | "phone_outreach" | "venue_prospect" | "walk_in_needed";

interface OpportunityScores {
  hubTv?: number;
  listingUpgrade?: number;
  adBuyer?: number;
  eventPartner?: number;
  overall?: number;
}

interface Opportunity {
  id: string;
  entityType: string;
  name: string;
  hub: string;
  zoneId: string | null;
  slug: string | null;
  source: string;
  sourceDetail: string;
  contactAvailable: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  activationStatus: string;
  whySurfaced: string;
  recommendedNextStep: string;
  priorityScore: number;
  createdAt: string | null;
  captureOrigin: string | null;
  businessId: string | null;
  signalId?: string;
  tags: string[];
  venueScreenLikely: boolean;
  address: string | null;
  opportunityCategory: OpportunityCategory;
  opportunityScores?: OpportunityScores | null;
}

interface OutreachDraft {
  id: string;
  subject: string;
  body: string;
  recipientEmail: string | null;
  recipientName: string | null;
  templateType: string;
  status: string;
}

interface ActivateResult {
  ok: boolean;
  businessId: string;
  draftId: string | null;
  draft: OutreachDraft | null;
  message: string;
}

interface RadarResponse {
  opportunities: Opportunity[];
  total: number;
  sources: string[];
  hubs: string[];
  categoryCounts: {
    ready_to_reach: number;
    phone_outreach: number;
    venue_prospect: number;
    walk_in_needed: number;
  };
}

interface ZoneItem {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface ZoneGroup {
  district: string;
  districtId: string;
  neighborhoods: ZoneItem[];
}

interface ZonesResponse {
  grouped: ZoneGroup[];
  ungrouped: ZoneItem[];
  districts: { id: string; name: string; type: string }[];
  zips: { id: string; name: string; slug: string; zipCodes: string[] }[];
  all: ZoneItem[];
}

interface EmailTemplateOption {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  templateKey: string;
  status: string;
}

const SOURCE_LABELS: Record<string, string> = {
  capture: "Field Capture",
  google_places: "Google Places",
  osm: "OpenStreetMap",
  ai_discovery: "AI Discovery",
  scoring: "Prospect Scoring",
  claim_queue: "Claim Queue",
  import: "Import",
  press: "Press/RSS",
  pipeline_review: "Pipeline Review",
  charlotte: "Charlotte Activated",
  form_activated: "Form Activated",
  ad_spot: "Ad Spot Capture",
};

const SOURCE_COLORS: Record<string, string> = {
  capture: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  google_places: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  osm: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  ai_discovery: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  scoring: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
  claim_queue: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20",
  import: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20",
  pipeline_review: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  charlotte: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20",
  form_activated: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  ad_spot: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

const SCORE_COLORS: Record<string, { label: string; color: string }> = {
  hubTv: { label: "Hub TV", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25" },
  adBuyer: { label: "Ad Buyer", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25" },
  listingUpgrade: { label: "Listing", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25" },
  eventPartner: { label: "Events", color: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25" },
};

const CATEGORY_CONFIG: Record<OpportunityCategory, { label: string; icon: typeof Mail; color: string; description: string }> = {
  ready_to_reach: {
    label: "Ready to Reach",
    icon: Mail,
    color: "text-green-600 dark:text-green-400",
    description: "Has email on file — can send verification outreach",
  },
  phone_outreach: {
    label: "Phone Outreach",
    icon: PhoneCall,
    color: "text-blue-600 dark:text-blue-400",
    description: "Has phone number — call to connect and collect email",
  },
  venue_prospect: {
    label: "Venue Prospects",
    icon: Monitor,
    color: "text-purple-600 dark:text-purple-400",
    description: "Likely Hub TV venue — high-value screen placement opportunity",
  },
  walk_in_needed: {
    label: "Walk-in Needed",
    icon: MapPin,
    color: "text-amber-600 dark:text-amber-400",
    description: "No contact info — requires a field visit",
  },
};

const TAB_ORDER: OpportunityCategory[] = ["ready_to_reach", "phone_outreach", "venue_prospect", "walk_in_needed"];

function getPriorityTier(score: number): { label: string; color: string; barColor: string } {
  if (score >= 80) return { label: "Hot", color: "text-red-600 dark:text-red-400", barColor: "bg-red-500" };
  if (score >= 60) return { label: "Warm", color: "text-orange-600 dark:text-orange-400", barColor: "bg-orange-500" };
  if (score >= 40) return { label: "Cool", color: "text-blue-600 dark:text-blue-400", barColor: "bg-blue-500" };
  return { label: "New", color: "text-gray-600 dark:text-gray-400", barColor: "bg-gray-400" };
}

function computeCompositeScore(opp: Opportunity): number {
  let score = opp.priorityScore || 0;
  if (opp.contactEmail) score += 20;
  if (opp.contactPhone) score += 10;
  if (opp.venueScreenLikely) score += 5;
  if (opp.opportunityScores) {
    const os = opp.opportunityScores;
    score += ((os.hubTv || 0) + (os.adBuyer || 0) + (os.listingUpgrade || 0) + (os.eventPartner || 0)) / 10;
  }
  if (opp.source === "capture" || opp.source === "ad_spot") score += 10;
  return Math.round(score);
}

function DraftPreview({ draft, onClose }: { draft: OutreachDraft; onClose: () => void }) {
  return (
    <Card className="bg-card border-purple-500/20 mt-2" data-testid="draft-preview">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium">Outreach Draft</span>
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20">
              {draft.status === "draft" ? "Pending Review" : draft.status}
            </Badge>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="close-draft-preview">
            <X className="w-4 h-4" />
          </button>
        </div>

        {draft.recipientEmail && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid="draft-recipient">
            <Send className="w-3 h-3" />
            To: {draft.recipientEmail}
          </div>
        )}
        {!draft.recipientEmail && (
          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5" data-testid="draft-no-recipient">
            <Mail className="w-3 h-3" />
            No email on file — draft saved for manual delivery
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-muted/30 p-3 space-y-2">
          <div className="text-xs text-muted-foreground">Subject:</div>
          <div className="text-sm font-medium" data-testid="draft-subject">{draft.subject}</div>
        </div>

        <div className="rounded-lg border border-white/10 bg-muted/30 p-3 space-y-2">
          <div className="text-xs text-muted-foreground">Body:</div>
          <LinkifiedBody text={draft.body} />
        </div>

        <p className="text-xs text-muted-foreground">
          This draft needs admin approval before sending. Review it in the Outreach Queue.
        </p>
      </CardContent>
    </Card>
  );
}

function AddEmailDialog({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!email.includes("@")) return;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/admin/opportunity-radar/${businessId}/add-email`, { email });
      toast({ title: "Email Added", description: "Business upgraded to Ready to Reach" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-radar"] });
      onDone();
    } catch {
      toast({ title: "Failed to add email", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2 mt-2" data-testid="add-email-form">
      <Input
        type="email"
        placeholder="owner@business.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-8 text-sm flex-1"
        data-testid="input-add-email"
      />
      <Button size="sm" onClick={handleSave} disabled={saving || !email.includes("@")} data-testid="button-save-email">
        Save
      </Button>
      <Button size="sm" variant="outline" onClick={onDone} data-testid="button-cancel-email">
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function EmailComposer({ opp, onClose, mode }: { opp: Opportunity; onClose: () => void; mode: "template" | "custom" }) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toEmail, setToEmail] = useState(opp.contactEmail || "");

  const { data: templates } = useQuery<EmailTemplateOption[]>({
    queryKey: ["/api/admin/opportunity-radar/email-templates"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/opportunity-radar/email-templates", { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
    enabled: mode === "template",
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates?.find(t => t.id === templateId);
    if (tpl) {
      let s = tpl.subject.replace(/\{\{businessName\}\}/g, opp.name).replace(/\{\{name\}\}/g, opp.name);
      let b = tpl.htmlBody.replace(/<[^>]*>/g, "").replace(/\{\{businessName\}\}/g, opp.name).replace(/\{\{name\}\}/g, opp.name);
      setSubject(s);
      setBody(b);
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!opp.businessId) throw new Error("No business ID");
      const resp = await apiRequest("POST", `/api/admin/opportunity-radar/${opp.businessId}/send-email`, {
        to: toEmail,
        subject,
        body,
        templateId: selectedTemplateId || undefined,
      });
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Email Sent", description: `Sent to ${toEmail}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-radar"] });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{mode === "template" ? "Send Email from Template" : "Compose Custom Email"} — {opp.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {mode === "template" && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Select Template</label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger data-testid="select-email-template">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {(templates || []).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} — {t.subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">To</label>
          <Input
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="recipient@example.com"
            data-testid="input-email-to"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject..."
            data-testid="input-email-subject"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Body</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Email body..."
            rows={8}
            data-testid="input-email-body"
          />
        </div>

        {subject && body && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Preview</div>
            <div className="text-sm font-medium">{subject}</div>
            <div className="text-sm whitespace-pre-wrap text-muted-foreground">{body.substring(0, 300)}{body.length > 300 ? "..." : ""}</div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !toEmail.includes("@") || !subject || !body}
            data-testid="button-send-email"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
            {sendMutation.isPending ? "Sending..." : "Send Email"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </DialogContent>
  );
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-600 dark:text-red-400", label: "Critical" },
  high: { bg: "bg-orange-500/10 border-orange-500/20", text: "text-orange-600 dark:text-orange-400", label: "High" },
  moderate: { bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400", label: "Moderate" },
  low: { bg: "bg-green-500/10 border-green-500/20", text: "text-green-600 dark:text-green-400", label: "Low" },
};

type IntelligenceTab = "coverage_gaps" | "category_supply" | "content_opportunities" | "workforce_gaps" | "claim_signals";

const INTELLIGENCE_TABS: { id: IntelligenceTab; label: string; icon: typeof MapPin; description: string }[] = [
  { id: "coverage_gaps", label: "Coverage Gaps", icon: MapPin, description: "Neighborhoods with low or missing business coverage in specific categories" },
  { id: "category_supply", label: "Category Supply", icon: LayoutGrid, description: "Categories with business activity but missing content channels" },
  { id: "content_opportunities", label: "Content Opportunities", icon: Newspaper, description: "Zones with business activity but weak editorial/Pulse presence" },
  { id: "workforce_gaps", label: "Workforce Gaps", icon: Briefcase, description: "Job/hiring gaps across zones and categories" },
  { id: "claim_signals", label: "Claim Signals", icon: ShieldAlert, description: "Unclaimed businesses with profile completeness issues" },
];

function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
  return (
    <Badge variant="outline" className={`text-xs ${style.bg} ${style.text}`} data-testid={`badge-severity-${severity}`}>
      {style.label}
    </Badge>
  );
}

function IntelligenceCardActions({ onViewBusinesses, onNavigateOutreach, label }: { onViewBusinesses?: () => void; onNavigateOutreach?: () => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
      {onViewBusinesses && (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onViewBusinesses(); }} className="text-xs h-7" data-testid={`button-view-biz-${label}`}>
          <Eye className="w-3 h-3 mr-1" />
          View Businesses
        </Button>
      )}
      {onNavigateOutreach && (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onNavigateOutreach(); }} className="text-xs h-7" data-testid={`button-go-outreach-${label}`}>
          <ArrowRight className="w-3 h-3 mr-1" />
          Go to Outreach
        </Button>
      )}
    </div>
  );
}

function GapBusinessesList({ zoneId, categoryId }: { zoneId?: string; categoryId?: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/opportunity-radar/gap-businesses", zoneId, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (zoneId) params.set("zoneId", zoneId);
      if (categoryId) params.set("categoryId", categoryId);
      const resp = await fetch(`/api/admin/opportunity-radar/gap-businesses?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  if (isLoading) return <Skeleton className="h-20 w-full mt-2" />;
  const bizList = data?.businesses || [];

  if (bizList.length === 0) {
    return <p className="text-xs text-muted-foreground mt-2 py-2">No businesses found for this gap</p>;
  }

  return (
    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto" data-testid="gap-businesses-list">
      {bizList.map((biz: any) => (
        <div key={biz.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted/30">
          <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{biz.name}</span>
          {biz.email && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20 shrink-0">email</Badge>}
          {biz.phone && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 shrink-0">phone</Badge>}
          {biz.slug && (
            <a href={`/charlotte/directory/${biz.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0">
              <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function CoverageGapsPanel({ cityId, onSwitchToOutreach }: { cityId?: string; onSwitchToOutreach: (zoneId?: string) => void }) {
  const [zoneType, setZoneType] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedGap, setExpandedGap] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/opportunity-radar/coverage-gaps", zoneType, categoryFilter, cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (zoneType !== "all") params.set("zoneType", zoneType);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      params.set("limit", "50");
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/opportunity-radar/coverage-gaps?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const gaps = data?.gaps || [];
  const filters = data?.filters || { zones: [], categories: [] };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-3" data-testid="coverage-gaps-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={zoneType} onValueChange={setZoneType}>
          <SelectTrigger className="w-[160px]" data-testid="filter-gap-zone-type">
            <SelectValue placeholder="Zone Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zone Types</SelectItem>
            <SelectItem value="DISTRICT">Districts</SelectItem>
            <SelectItem value="NEIGHBORHOOD">Neighborhoods</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]" data-testid="filter-gap-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(filters.categories || []).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{gaps.length} gaps found</span>
      </div>

      {gaps.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No coverage gaps found with current filters</p>
        </div>
      )}

      {gaps.map((gap: any, i: number) => {
        const gapKey = `${gap.zoneId}-${gap.categoryId}`;
        const isExpanded = expandedGap === gapKey;
        return (
          <Card
            key={gapKey}
            className="bg-card cursor-pointer hover:border-foreground/20 transition-colors"
            data-testid={`gap-${i}`}
            onClick={() => setExpandedGap(isExpanded ? null : gapKey)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-medium text-sm">{gap.zoneName}</span>
                    <Badge variant="outline" className="text-xs">{gap.categoryName}</Badge>
                    <SeverityBadge severity={gap.severity} />
                    <Badge variant="outline" className="text-xs bg-muted">
                      {gap.zoneType === "DISTRICT" ? "District" : "Neighborhood"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1" data-testid={`gap-why-${i}`}>
                    {gap.whyItMatters}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span>Current: <strong className="text-foreground">{gap.businessCount}</strong></span>
                    <span>Metro avg: <strong className="text-foreground">{gap.metroAverage}</strong></span>
                    <span>Deficit: <strong className="text-red-500">{gap.deficit}</strong></span>
                    <span>Claimed: <strong className="text-foreground">{gap.claimedCount}</strong></span>
                  </div>
                  <IntelligenceCardActions
                    onViewBusinesses={() => setExpandedGap(isExpanded ? null : gapKey)}
                    onNavigateOutreach={() => onSwitchToOutreach(gap.zoneId)}
                    label={`gap-${i}`}
                  />
                  {isExpanded && (
                    <GapBusinessesList zoneId={gap.zoneId} categoryId={gap.categoryId} />
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground mt-1">{gap.suggestedAction}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CategorySupplyPanel({ cityId, onSwitchToOutreach }: { cityId?: string; onSwitchToOutreach: (zoneId?: string) => void }) {
  const [expandedSig, setExpandedSig] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/opportunity-radar/category-supply", cityId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/opportunity-radar/category-supply?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const signals = data?.signals || [];

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-3" data-testid="category-supply-panel">
      <span className="text-xs text-muted-foreground">{signals.length} categories analyzed</span>

      {signals.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No category supply signals found</p>
        </div>
      )}

      {signals.map((sig: any, i: number) => {
        const isExpanded = expandedSig === sig.categoryId;
        return (
          <Card
            key={sig.categoryId}
            className="bg-card cursor-pointer hover:border-foreground/20 transition-colors"
            data-testid={`supply-${i}`}
            onClick={() => setExpandedSig(isExpanded ? null : sig.categoryId)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-medium text-sm">{sig.categoryName}</span>
                    <SeverityBadge severity={sig.severity} />
                    <Badge variant="outline" className="text-xs bg-muted">
                      {sig.coveragePercent}% zone coverage
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1" data-testid={`supply-why-${i}`}>
                    {sig.whyItMatters}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span>Businesses: <strong className="text-foreground">{sig.totalBusinesses}</strong></span>
                    <span>Events: <strong className={sig.totalEvents === 0 ? "text-red-500" : "text-foreground"}>{sig.totalEvents}</strong></span>
                    <span>Articles: <strong className={sig.totalArticles === 0 ? "text-red-500" : "text-foreground"}>{sig.totalArticles}</strong></span>
                    <span>Posts: <strong className={sig.totalPosts === 0 ? "text-red-500" : "text-foreground"}>{sig.totalPosts}</strong></span>
                    <span>Marketplace: <strong className={sig.totalMarketplace === 0 ? "text-red-500" : "text-foreground"}>{sig.totalMarketplace}</strong></span>
                  </div>
                  {sig.missingChannels.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Missing: {sig.missingChannels.join(", ")}
                      </span>
                    </div>
                  )}
                  <IntelligenceCardActions
                    onViewBusinesses={() => setExpandedSig(isExpanded ? null : sig.categoryId)}
                    onNavigateOutreach={() => onSwitchToOutreach()}
                    label={`supply-${i}`}
                  />
                  {isExpanded && <GapBusinessesList categoryId={sig.categoryId} />}
                </div>
                <div className="text-right shrink-0 max-w-[200px]">
                  <p className="text-xs text-muted-foreground">{sig.suggestedAction}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ContentOpportunitiesPanel({ cityId, onSwitchToOutreach }: { cityId?: string; onSwitchToOutreach: (zoneId?: string) => void }) {
  const [zoneType, setZoneType] = useState("all");
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/opportunity-radar/content-opportunities", zoneType, cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (zoneType !== "all") params.set("zoneType", zoneType);
      params.set("limit", "50");
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/opportunity-radar/content-opportunities?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const opportunities = data?.opportunities || [];

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  const SIGNAL_TYPE_LABELS: Record<string, string> = {
    business_cluster_no_story: "Business Cluster",
    event_rich_no_pulse: "Event-Rich Area",
    active_businesses_no_content: "Active Businesses",
    content_gap: "Content Gap",
  };

  return (
    <div className="space-y-3" data-testid="content-opportunities-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={zoneType} onValueChange={setZoneType}>
          <SelectTrigger className="w-[160px]" data-testid="filter-content-zone-type">
            <SelectValue placeholder="Zone Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zone Types</SelectItem>
            <SelectItem value="DISTRICT">Districts</SelectItem>
            <SelectItem value="NEIGHBORHOOD">Neighborhoods</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{opportunities.length} opportunities found</span>
      </div>

      {opportunities.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No content opportunities found</p>
        </div>
      )}

      {opportunities.map((opp: any, i: number) => {
        const isExpanded = expandedZone === opp.zoneId;
        return (
          <Card
            key={opp.zoneId}
            className="bg-card cursor-pointer hover:border-foreground/20 transition-colors"
            data-testid={`content-opp-${i}`}
            onClick={() => setExpandedZone(isExpanded ? null : opp.zoneId)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-medium text-sm">{opp.zoneName}</span>
                    <SeverityBadge severity={opp.severity} />
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                      {SIGNAL_TYPE_LABELS[opp.signalType] || opp.signalType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1" data-testid={`content-opp-why-${i}`}>
                    {opp.whyItMatters}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span>Businesses: <strong className="text-foreground">{opp.businessCount}</strong></span>
                    <span>Claimed: <strong className="text-foreground">{opp.claimedCount}</strong></span>
                    <span>Events: <strong className={opp.eventCount === 0 ? "text-red-500" : "text-foreground"}>{opp.eventCount}</strong></span>
                    <span>Articles: <strong className={opp.articleCount === 0 ? "text-red-500" : "text-foreground"}>{opp.articleCount}</strong></span>
                    <span>Posts: <strong className={opp.postCount === 0 ? "text-red-500" : "text-foreground"}>{opp.postCount}</strong></span>
                  </div>
                  {opp.contentGaps.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Gaps: {opp.contentGaps.join(", ")}
                      </span>
                    </div>
                  )}
                  <IntelligenceCardActions
                    onViewBusinesses={() => setExpandedZone(isExpanded ? null : opp.zoneId)}
                    onNavigateOutreach={() => onSwitchToOutreach(opp.zoneId)}
                    label={`content-${i}`}
                  />
                  {isExpanded && <GapBusinessesList zoneId={opp.zoneId} />}
                </div>
                <div className="text-right shrink-0 max-w-[200px]">
                  <p className="text-xs text-muted-foreground">{opp.suggestedAction}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function WorkforceGapsPanel({ cityId, onSwitchToOutreach }: { cityId?: string; onSwitchToOutreach: (zoneId?: string) => void }) {
  const [zoneType, setZoneType] = useState("all");
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/opportunity-radar/workforce-gaps", zoneType, cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (zoneType !== "all") params.set("zoneType", zoneType);
      params.set("limit", "50");
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/opportunity-radar/workforce-gaps?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const zoneSignals = data?.zoneSignals || [];
  const categorySignals = data?.categorySignals || [];

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4" data-testid="workforce-gaps-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={zoneType} onValueChange={setZoneType}>
          <SelectTrigger className="w-[160px]" data-testid="filter-workforce-zone-type">
            <SelectValue placeholder="Zone Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zone Types</SelectItem>
            <SelectItem value="DISTRICT">Districts</SelectItem>
            <SelectItem value="NEIGHBORHOOD">Neighborhoods</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {zoneSignals.length} zone signals, {categorySignals.length} category signals
        </span>
      </div>

      {zoneSignals.length === 0 && categorySignals.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No workforce gaps found</p>
        </div>
      )}

      {zoneSignals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zone-Level Signals</h4>
          {zoneSignals.map((sig: any, i: number) => {
            const isExpanded = expandedZone === sig.zoneId;
            return (
              <Card
                key={sig.zoneId}
                className="bg-card cursor-pointer hover:border-foreground/20 transition-colors"
                data-testid={`workforce-zone-${i}`}
                onClick={() => setExpandedZone(isExpanded ? null : sig.zoneId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-medium text-sm">{sig.zoneName}</span>
                        <SeverityBadge severity={sig.severity} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{sig.whyItMatters}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span>Businesses: <strong className="text-foreground">{sig.businessCount}</strong></span>
                        <span>Jobs: <strong className={sig.jobCount === 0 ? "text-red-500" : "text-foreground"}>{sig.jobCount}</strong></span>
                        <span>Active: <strong className="text-foreground">{sig.activeJobs}</strong></span>
                        <span>Applicants: <strong className="text-foreground">{sig.totalApplicants}</strong></span>
                      </div>
                      <IntelligenceCardActions
                        onViewBusinesses={() => setExpandedZone(isExpanded ? null : sig.zoneId)}
                        onNavigateOutreach={() => onSwitchToOutreach(sig.zoneId)}
                        label={`wf-zone-${i}`}
                      />
                      {isExpanded && <GapBusinessesList zoneId={sig.zoneId} />}
                    </div>
                    <div className="text-right shrink-0 max-w-[200px]">
                      <p className="text-xs text-muted-foreground">{sig.suggestedAction}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {categorySignals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories with No Hiring</h4>
          {categorySignals.map((sig: any, i: number) => {
            const isCatExpanded = expandedCat === sig.categoryId;
            return (
            <Card
              key={sig.categoryId}
              className="bg-card cursor-pointer hover:border-foreground/20 transition-colors"
              data-testid={`workforce-cat-${i}`}
              onClick={() => setExpandedCat(isCatExpanded ? null : sig.categoryId)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-medium text-sm">{sig.categoryName}</span>
                      <SeverityBadge severity={sig.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground">{sig.whyItMatters}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                      <span>Businesses: <strong className="text-foreground">{sig.businessCount}</strong></span>
                      <span>Job listings: <strong className="text-red-500">0</strong></span>
                    </div>
                    <IntelligenceCardActions
                      onViewBusinesses={() => setExpandedCat(isCatExpanded ? null : sig.categoryId)}
                      onNavigateOutreach={() => onSwitchToOutreach()}
                      label={`wf-cat-${i}`}
                    />
                    {isCatExpanded && <GapBusinessesList categoryId={sig.categoryId} />}
                  </div>
                  <div className="text-right shrink-0 max-w-[200px]">
                    <p className="text-xs text-muted-foreground">{sig.suggestedAction}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClaimSignalsPanel({ cityId, onSwitchToOutreach }: { cityId?: string; onSwitchToOutreach: (zoneId?: string) => void }) {
  const [zoneFilter, setZoneFilter] = useState("all");
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/opportunity-radar/claim-signals", zoneFilter, cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (zoneFilter !== "all") params.set("zoneId", zoneFilter);
      params.set("limit", "50");
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/opportunity-radar/claim-signals?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const signals = data?.signals || [];

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-3" data-testid="claim-signals-panel">
      <span className="text-xs text-muted-foreground">{signals.length} businesses with profile gaps</span>

      {signals.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No claim signal issues found</p>
        </div>
      )}

      {signals.map((sig: any, i: number) => {
        const isExpanded = expandedClaim === sig.businessId;
        return (
        <Card
          key={sig.businessId}
          className="bg-card cursor-pointer hover:border-foreground/20 transition-colors"
          data-testid={`claim-signal-${i}`}
          onClick={() => setExpandedClaim(isExpanded ? null : sig.businessId)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-medium text-sm">{sig.businessName}</span>
                  <SeverityBadge severity={sig.severity} />
                  <Badge variant="outline" className="text-xs bg-muted">
                    {sig.completenessScore}% complete
                  </Badge>
                  {sig.zoneName && (
                    <span className="text-xs text-muted-foreground">{sig.zoneName}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">{sig.whyItMatters}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {sig.issues.map((issue: string, j: number) => (
                    <Badge key={j} variant="outline" className="text-[10px] bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/15">
                      {issue}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                  <span>Events: {sig.eventCount}</span>
                  <span>Jobs: {sig.jobCount}</span>
                  <span>Posts: {sig.postCount}</span>
                  {sig.hasEmail && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">has email</Badge>}
                  {sig.hasPhone && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">has phone</Badge>}
                </div>
                <IntelligenceCardActions
                  onViewBusinesses={() => setExpandedClaim(isExpanded ? null : sig.businessId)}
                  onNavigateOutreach={() => onSwitchToOutreach(sig.zoneId)}
                  label={`claim-${i}`}
                />
                {isExpanded && sig.zoneId && <GapBusinessesList zoneId={sig.zoneId} />}
              </div>
              <div className="text-right shrink-0 max-w-[200px]">
                <p className="text-xs text-muted-foreground">{sig.suggestedAction}</p>
                {sig.businessSlug && (
                  <a
                    href={`/charlotte/directory/${sig.businessSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" /> View Listing
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}

function LocationSelector({ cityId, value, onChange }: { cityId?: string; value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data } = useQuery<ZonesResponse>({
    queryKey: ["/api/admin/opportunity-radar/zones", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/opportunity-radar/zones?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load zones");
      return resp.json();
    },
  });

  const allZones = data?.all || [];
  const grouped = data?.grouped || [];
  const zips = data?.zips || [];

  const currentZone = allZones.find(z => z.id === value);
  const displayLabel = currentZone ? currentZone.name : "All Locations";

  const filteredZones = search
    ? allZones.filter(z => z.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors min-w-[160px]"
        data-testid="location-selector-btn"
      >
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setSearch(""); }} />
          <div className="absolute left-0 top-full mt-1 z-50 w-72 max-h-[60vh] overflow-hidden rounded-lg border border-border bg-popover shadow-lg" data-testid="location-selector-dropdown">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search neighborhoods, districts, zips..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md bg-muted/50 border border-border px-8 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                  data-testid="location-search-input"
                />
                {search && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-80 p-1">
              <button
                className={`w-full text-left rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  value === "all" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
                onClick={() => { onChange("all"); setIsOpen(false); setSearch(""); }}
                data-testid="location-option-all"
              >
                <span className="flex items-center gap-2">
                  <Globe className="h-3 w-3" />
                  All Locations
                </span>
              </button>

              {search ? (
                <>
                  {filteredZones.map((z) => (
                    <button
                      key={z.id}
                      className={`w-full text-left rounded-md px-3 py-1.5 text-xs transition-colors ${
                        value === z.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      }`}
                      onClick={() => { onChange(z.id); setIsOpen(false); setSearch(""); }}
                      data-testid={`location-option-${z.id}`}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {z.name}
                        <span className="text-[10px] text-muted-foreground ml-auto">{z.type}</span>
                      </span>
                    </button>
                  ))}
                  {filteredZones.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">No locations found</div>
                  )}
                </>
              ) : (
                <>
                  {grouped.map((group) => (
                    <div key={group.districtId} className="mt-1">
                      <button
                        className={`w-full text-left rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          value === group.districtId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={() => { onChange(group.districtId); setIsOpen(false); setSearch(""); }}
                        data-testid={`location-district-${group.districtId}`}
                      >
                        {group.district}
                      </button>
                      {group.neighborhoods.map((n) => (
                        <button
                          key={n.id}
                          className={`w-full text-left rounded-md px-6 py-1 text-xs transition-colors ${
                            value === n.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                          }`}
                          onClick={() => { onChange(n.id); setIsOpen(false); setSearch(""); }}
                          data-testid={`location-option-${n.id}`}
                        >
                          {n.name}
                        </button>
                      ))}
                    </div>
                  ))}
                  {data?.ungrouped && data.ungrouped.length > 0 && (
                    <div className="mt-1">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Other Zones
                      </div>
                      {data.ungrouped.map((z) => (
                        <button
                          key={z.id}
                          className={`w-full text-left rounded-md px-6 py-1 text-xs transition-colors ${
                            value === z.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                          }`}
                          onClick={() => { onChange(z.id); setIsOpen(false); setSearch(""); }}
                          data-testid={`location-option-${z.id}`}
                        >
                          {z.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {zips.length > 0 && (
                    <div className="mt-1">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Zip Codes
                      </div>
                      {zips.map((z) => (
                        <button
                          key={z.id}
                          className={`w-full text-left rounded-md px-6 py-1 text-xs transition-colors ${
                            value === z.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                          }`}
                          onClick={() => { onChange(z.id); setIsOpen(false); setSearch(""); }}
                          data-testid={`location-zip-${z.id}`}
                        >
                          {z.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type RadarMode = "outreach" | "intelligence";

export default function OpportunityRadar({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [radarMode, setRadarMode] = useState<RadarMode>("outreach");
  const [activeIntelTab, setActiveIntelTab] = useState<IntelligenceTab>("coverage_gaps");
  const [activeTab, setActiveTab] = useState<OpportunityCategory>("phone_outreach");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("composite");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDraft, setActiveDraft] = useState<{ oppId: string; draft: OutreachDraft } | null>(null);
  const [askForStory, setAskForStory] = useState<Record<string, boolean>>({});
  const [previewData, setPreviewData] = useState<{ oppId: string; subject: string; body: string; recipientEmail: string | null; templateType: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [addingEmailFor, setAddingEmailFor] = useState<string | null>(null);
  const [emailComposerOpp, setEmailComposerOpp] = useState<{ opp: Opportunity; mode: "template" | "custom" } | null>(null);

  const { data: pipelineStatus } = useQuery<EmailPipelineStatus>({
    queryKey: ["/api/admin/email-lead-pipeline/status"],
    refetchInterval: 60_000,
  });

  const boostMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/email-lead-pipeline/boost");
      return resp.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Pipeline Boosted",
        description: `${result.crawlsProcessed || 0} crawled, ${result.emailsDiscovered || 0} emails found. Ready: ${result.readyToReachCount}/${result.target}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-lead-pipeline/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-radar"] });
    },
    onError: () => {
      toast({ title: "Boost Failed", description: "Could not run the email pipeline", variant: "destructive" });
    },
  });

  const [pullOpen, setPullOpen] = useState(false);
  const [pullCategory, setPullCategory] = useState("Restaurants");
  const [pullHub, setPullHub] = useState("all");
  const [pullCount, setPullCount] = useState("20");

  const PULL_CATEGORIES = [
    "Restaurants", "Salons & Barbershops", "Auto Repair", "Fitness & Gyms",
    "Retail Shops", "Professional Services", "Home Services",
    "Medical & Dental", "Pet Services", "Coffee & Cafes",
    "Bars & Nightlife", "Real Estate", "Financial Services",
  ];

  const pullMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/opportunity-radar/pull-listings", {
        category: pullCategory,
        hub: pullHub,
        maxResults: pullCount,
      });
      return resp.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Listings Pulled",
        description: `${result.imported} new businesses imported, ${result.withEmail} with emails, ${result.withPhone} with phone numbers. ${result.skipped} duplicates skipped.`,
      });
      setPullOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-radar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-lead-pipeline/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Pull Failed", description: err.message || "Could not pull listings", variant: "destructive" });
    },
  });

  const crawlMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/opportunity-radar/crawl-for-emails");
      return resp.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Email Crawl Complete",
        description: `Crawled ${result.crawled} websites, found ${result.emailsFound} new emails`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-radar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-lead-pipeline/status"] });
    },
    onError: () => {
      toast({ title: "Crawl Failed", description: "Could not crawl for emails", variant: "destructive" });
    },
  });

  const queryParams = new URLSearchParams();
  if (sourceFilter !== "all") queryParams.set("source", sourceFilter);
  if (locationFilter !== "all") queryParams.set("zoneId", locationFilter);
  if (sortBy) queryParams.set("sortBy", sortBy === "composite" ? "priority" : sortBy);
  queryParams.set("limit", "500");
  if (cityId) queryParams.set("cityId", cityId);

  const { data, isLoading } = useQuery<RadarResponse>({
    queryKey: ["/api/admin/opportunity-radar", sourceFilter, locationFilter, sortBy, cityId],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/opportunity-radar?${queryParams.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({ id, oppId, includeStoryAsk }: { id: string; oppId: string; includeStoryAsk: boolean }) => {
      const resp = await apiRequest("POST", `/api/admin/opportunity-radar/${id}/activate`, {
        includeStoryAsk,
      });
      const result = await resp.json() as ActivateResult;
      return { ...result, _oppId: oppId };
    },
    onSuccess: (result: ActivateResult & { _oppId: string }) => {
      toast({
        title: "Listing Activated",
        description: result.draft ? "Outreach draft created — see preview below" : (result.message || "Outreach draft created"),
      });
      if (result.draft) {
        setActiveDraft({ oppId: result._oppId, draft: result.draft });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-radar"] });
    },
    onError: (err: any) => {
      toast({
        title: "Activation Failed",
        description: err.message || "Could not activate listing",
        variant: "destructive",
      });
    },
  });

  const logCallMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type?: string }) => {
      const resp = await apiRequest("POST", `/api/admin/opportunity-radar/${id}/log-call`, { type });
      return resp.json();
    },
    onSuccess: (_data: any, variables: { id: string; type?: string }) => {
      const label = variables.type === "visit" ? "Visit" : variables.type === "venue_pitch" ? "Venue Pitch" : "Call";
      toast({ title: `${label} Logged`, description: "Outreach recorded for this business" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-radar"] });
    },
    onError: () => {
      toast({ title: "Failed to log", variant: "destructive" });
    },
  });

  const markContactedMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await apiRequest("POST", `/api/admin/opportunity-radar/${id}/mark-contacted`);
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Marked as Contacted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/opportunity-radar"] });
    },
    onError: () => {
      toast({ title: "Failed to mark", variant: "destructive" });
    },
  });

  const allOpportunities = data?.opportunities || [];
  const categoryCounts = data?.categoryCounts || { ready_to_reach: 0, phone_outreach: 0, venue_prospect: 0, walk_in_needed: 0 };

  const hasSetDefault = useRef(false);
  useEffect(() => {
    if (data && !hasSetDefault.current) {
      hasSetDefault.current = true;
      const bestTab = TAB_ORDER.find(cat => (data.categoryCounts?.[cat] || 0) > 0);
      if (bestTab && bestTab !== activeTab) {
        setActiveTab(bestTab);
      }
    }
  }, [data]);

  const tabOpportunities = allOpportunities.filter(o => o.opportunityCategory === activeTab);

  const filtered = searchQuery
    ? tabOpportunities.filter(o =>
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.hub.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.address || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabOpportunities;

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === "composite") {
      list.sort((a, b) => computeCompositeScore(b) - computeCompositeScore(a));
    } else if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "date") {
      list.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db2 - da;
      });
    } else {
      list.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    }
    return list;
  }, [filtered, sortBy]);

  const handleSwitchToOutreach = useCallback((zoneId?: string) => {
    setRadarMode("outreach");
    if (zoneId) {
      setLocationFilter(zoneId);
    }
  }, []);

  return (
    <div className="space-y-4" data-testid="opportunity-radar-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="panel-title">Opportunity Radar</h2>
          <p className="text-sm text-muted-foreground">
            {radarMode === "outreach"
              ? `${data?.total || 0} businesses discovered across all categories`
              : "Local intelligence — coverage, content, and workforce gap analysis"
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-border p-0.5 gap-0.5" data-testid="radar-mode-switcher">
            <button
              onClick={() => setRadarMode("outreach")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                radarMode === "outreach"
                  ? "bg-foreground/10 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="mode-outreach"
            >
              <Target className="w-3.5 h-3.5 inline mr-1.5" />
              Outreach
            </button>
            <button
              onClick={() => setRadarMode("intelligence")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                radarMode === "intelligence"
                  ? "bg-foreground/10 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="mode-intelligence"
            >
              <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" />
              Intelligence
            </button>
          </div>
          {radarMode === "outreach" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {TAB_ORDER.map(cat => {
                const count = categoryCounts[cat] || 0;
                if (count === 0) return null;
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <Badge key={cat} variant="outline" className="text-xs" data-testid={`badge-${cat}`}>
                    {count} {cfg.label.toLowerCase()}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {radarMode === "intelligence" && (
        <>
          <div className="flex gap-1 border-b border-border overflow-x-auto" data-testid="intelligence-tabs">
            {INTELLIGENCE_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeIntelTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveIntelTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`intel-tab-${tab.id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2" data-testid="intel-tab-description">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 shrink-0" />
              {INTELLIGENCE_TABS.find(t => t.id === activeIntelTab)?.description}
            </p>
          </div>

          {activeIntelTab === "coverage_gaps" && <CoverageGapsPanel cityId={cityId} onSwitchToOutreach={handleSwitchToOutreach} />}
          {activeIntelTab === "category_supply" && <CategorySupplyPanel cityId={cityId} onSwitchToOutreach={handleSwitchToOutreach} />}
          {activeIntelTab === "content_opportunities" && <ContentOpportunitiesPanel cityId={cityId} onSwitchToOutreach={handleSwitchToOutreach} />}
          {activeIntelTab === "workforce_gaps" && <WorkforceGapsPanel cityId={cityId} onSwitchToOutreach={handleSwitchToOutreach} />}
          {activeIntelTab === "claim_signals" && <ClaimSignalsPanel cityId={cityId} onSwitchToOutreach={handleSwitchToOutreach} />}
        </>
      )}

      {radarMode === "outreach" && (<>
      <Card className="border-border" data-testid="card-email-pipeline-bar">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            {pipelineStatus && (
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium shrink-0">Email Pipeline</span>
                <div className="flex-1 max-w-[140px] sm:max-w-[200px] bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      pipelineStatus.readyToReach >= pipelineStatus.target
                        ? "bg-green-500"
                        : pipelineStatus.readyToReach >= 5
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, (pipelineStatus.readyToReach / pipelineStatus.target) * 100)}%` }}
                  />
                </div>
                <span className={`text-sm font-bold shrink-0 ${
                  pipelineStatus.readyToReach >= pipelineStatus.target
                    ? "text-green-600 dark:text-green-400"
                    : pipelineStatus.readyToReach >= 5
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                }`} data-testid="text-pipeline-count">
                  {pipelineStatus.readyToReach}/{pipelineStatus.target} ready
                </span>
              </div>
            )}
            {!pipelineStatus && (
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Listing Tools</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              {pipelineStatus && pipelineStatus.deficit > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => boostMutation.mutate()}
                  disabled={boostMutation.isPending}
                  data-testid="button-boost-pipeline"
                >
                  {boostMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Boost
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => crawlMutation.mutate()}
                disabled={crawlMutation.isPending}
                data-testid="button-find-emails"
              >
                {crawlMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Globe className="h-3.5 w-3.5 mr-1.5" />
                )}
                Find Emails
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPullOpen(!pullOpen)}
                data-testid="button-pull-listings"
              >
                {pullOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                Pull Listings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {pullOpen && (
        <Card className="border-border border-blue-500/20" data-testid="card-pull-listings">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Pull New Listings from Google</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Search Google Places for businesses, import them, and automatically crawl their websites for email addresses.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <Select value={pullCategory} onValueChange={setPullCategory}>
                  <SelectTrigger data-testid="select-pull-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PULL_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-muted-foreground mb-1 block">Area</label>
                <Select value={pullHub} onValueChange={setPullHub}>
                  <SelectTrigger data-testid="select-pull-hub">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Charlotte</SelectItem>
                    {(data?.hubs || []).map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[80px]">
                <label className="text-xs text-muted-foreground mb-1 block">Count</label>
                <Select value={pullCount} onValueChange={setPullCount}>
                  <SelectTrigger data-testid="select-pull-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="40">40</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => pullMutation.mutate()}
                disabled={pullMutation.isPending}
                data-testid="button-execute-pull"
              >
                {pullMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Pulling...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1.5" />
                    Pull
                  </>
                )}
              </Button>
            </div>
            {pullMutation.isPending && (
              <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching Google Places, importing businesses, and crawling websites for emails... This may take 30-60 seconds.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-1 border-b border-border overflow-x-auto" data-testid="category-tabs">
        {TAB_ORDER.map(cat => {
          const count = categoryCounts[cat] || 0;
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg.icon;
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? `border-foreground ${cfg.color} font-medium`
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${cat}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                isActive ? "bg-foreground/10" : "bg-muted"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2" data-testid="tab-description">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 shrink-0" />
          {CATEGORY_CONFIG[activeTab].description}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, hub, or address..."
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px]" data-testid="filter-source">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="activated">Activated</SelectItem>
            <SelectItem value="capture">Field Capture</SelectItem>
            {(data?.sources || []).filter(s => s !== "capture").map(s => (
              <SelectItem key={s} value={s}>{SOURCE_LABELS[s] || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <LocationSelector cityId={cityId} value={locationFilter} onChange={setLocationFilter} />

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]" data-testid="sort-by">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="composite">Best Leads First</SelectItem>
            <SelectItem value="priority">Priority Score</SelectItem>
            <SelectItem value="date">Newest First</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground" data-testid="no-opportunities">
            {(categoryCounts[activeTab] || 0) === 0
              ? `No ${CATEGORY_CONFIG[activeTab].label.toLowerCase()} opportunities right now`
              : "No results match your search"
            }
          </p>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((opp) => {
          const compositeScore = computeCompositeScore(opp);
          const tier = getPriorityTier(compositeScore);
          return (
            <div key={`${opp.id}-${opp.source}`}>
              <Card className="bg-card overflow-hidden" data-testid={`opportunity-${opp.id}`}>
                <div className="flex">
                  <div className={`w-1.5 shrink-0 ${tier.barColor}`} />
                  <CardContent className="p-4 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-semibold text-sm truncate" data-testid={`opp-name-${opp.id}`}>
                            {opp.name}
                          </span>
                          <Badge variant="outline" className={`text-xs font-bold ${tier.color}`} data-testid={`opp-tier-${opp.id}`}>
                            {tier.label} · {compositeScore}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={SOURCE_COLORS[opp.source] || SOURCE_COLORS.import}
                          >
                            {SOURCE_LABELS[opp.source] || opp.source}
                          </Badge>
                          {opp.venueScreenLikely && activeTab !== "venue_prospect" && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                              <Monitor className="w-3 h-3 mr-0.5" />
                              Venue
                            </Badge>
                          )}
                          {opp.activationStatus === "activation_sent" && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20">
                              <Check className="w-3 h-3 mr-0.5" />
                              Contacted
                            </Badge>
                          )}
                          {opp.activationStatus === "claimed" && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                              Claimed
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mb-1 text-xs text-muted-foreground flex-wrap">
                          {opp.contactEmail && (
                            <span className="text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
                              <Mail className="w-3 h-3" />
                              {opp.contactEmail}
                            </span>
                          )}
                          {opp.contactPhone && (
                            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                              <Phone className="w-3 h-3" />
                              {opp.contactPhone}
                            </span>
                          )}
                          {!opp.contactEmail && !opp.contactPhone && (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              No contact info
                            </span>
                          )}
                          {opp.hub && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {opp.hub}
                            </span>
                          )}
                          {opp.address && (
                            <span className="truncate max-w-[200px]">{opp.address}</span>
                          )}
                        </div>

                        {opp.opportunityScores && (
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {Object.entries(opp.opportunityScores).map(([key, value]) => {
                              const cfg = SCORE_COLORS[key];
                              if (!cfg || typeof value !== "number" || value <= 0) return null;
                              return (
                                <Badge key={key} variant="outline" className={`text-xs ${cfg.color}`} data-testid={`score-${key}-${opp.id}`}>
                                  {cfg.label}: {value}
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground" data-testid={`opp-reason-${opp.id}`}>
                            {opp.whySurfaced}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                          <span className="text-xs font-medium text-primary">{opp.recommendedNextStep}</span>
                          {opp.createdAt && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(opp.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {opp.businessId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" data-testid={`action-menu-${opp.id}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {opp.contactEmail && (
                                <>
                                  <DropdownMenuItem onClick={() => setEmailComposerOpp({ opp, mode: "template" })} data-testid={`action-send-template-${opp.id}`}>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Send from Template
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEmailComposerOpp({ opp, mode: "custom" })} data-testid={`action-compose-${opp.id}`}>
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Compose Custom Email
                                  </DropdownMenuItem>
                                </>
                              )}
                              {opp.contactPhone && (
                                <DropdownMenuItem asChild data-testid={`action-call-${opp.id}`}>
                                  <a href={`tel:${opp.contactPhone}`} className="flex items-center">
                                    <PhoneCall className="w-4 h-4 mr-2" />
                                    Call
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => logCallMutation.mutate({ id: opp.businessId!, type: "call" })} data-testid={`action-log-call-${opp.id}`}>
                                <ClipboardCheck className="w-4 h-4 mr-2" />
                                Log Call
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => logCallMutation.mutate({ id: opp.businessId!, type: "visit" })} data-testid={`action-log-visit-${opp.id}`}>
                                <Navigation className="w-4 h-4 mr-2" />
                                Log Visit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAddingEmailFor(addingEmailFor === opp.id ? null : opp.id)} data-testid={`action-add-email-${opp.id}`}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {opp.activationStatus === "pending" && (
                                <DropdownMenuItem
                                  onClick={() => activateMutation.mutate({
                                    id: opp.businessId!,
                                    oppId: opp.id,
                                    includeStoryAsk: askForStory[opp.id] || false,
                                  })}
                                  data-testid={`action-activate-${opp.id}`}
                                >
                                  <Zap className="w-4 h-4 mr-2" />
                                  Activate & Draft Outreach
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={async () => {
                                  if (previewData?.oppId === opp.id) {
                                    setPreviewData(null);
                                    return;
                                  }
                                  setPreviewLoading(opp.id);
                                  try {
                                    const params = new URLSearchParams();
                                    if (askForStory[opp.id]) params.set("includeStoryAsk", "true");
                                    const resp = await fetch(`/api/admin/opportunity-radar/${opp.businessId}/preview?${params}`, { credentials: "include" });
                                    if (resp.ok) {
                                      const pData = await resp.json();
                                      setPreviewData({ oppId: opp.id, ...pData });
                                    }
                                  } catch {}
                                  setPreviewLoading(null);
                                }}
                                data-testid={`action-preview-${opp.id}`}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                {previewLoading === opp.id ? "Loading..." : "Preview Draft"}
                              </DropdownMenuItem>
                              {opp.activationStatus !== "activation_sent" && opp.activationStatus !== "claimed" && (
                                <DropdownMenuItem
                                  onClick={() => markContactedMutation.mutate(opp.businessId!)}
                                  data-testid={`action-mark-contacted-${opp.id}`}
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Mark as Contacted
                                </DropdownMenuItem>
                              )}
                              {opp.slug && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem asChild data-testid={`action-view-${opp.id}`}>
                                    <a href={`/charlotte/directory/${opp.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      View Listing
                                    </a>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {opp.activationStatus === "pending" && opp.businessId && activeTab === "ready_to_reach" && (
                          <Button
                            size="sm"
                            onClick={() => activateMutation.mutate({
                              id: opp.businessId!,
                              oppId: opp.id,
                              includeStoryAsk: askForStory[opp.id] || false,
                            })}
                            disabled={activateMutation.isPending}
                            data-testid={`activate-${opp.id}`}
                          >
                            <Zap className="w-3.5 h-3.5 mr-1" />
                            Activate
                          </Button>
                        )}

                        {opp.contactPhone && (activeTab === "phone_outreach" || activeTab === "venue_prospect") && (
                          <Button size="sm" variant="outline" asChild data-testid={`call-${opp.id}`}>
                            <a href={`tel:${opp.contactPhone}`}>
                              <PhoneCall className="w-3.5 h-3.5 mr-1" />
                              Call
                            </a>
                          </Button>
                        )}

                        {activeTab === "walk_in_needed" && opp.businessId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => logCallMutation.mutate({ id: opp.businessId!, type: "visit" })}
                            disabled={logCallMutation.isPending}
                            data-testid={`log-visit-${opp.id}`}
                          >
                            <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                            Log Visit
                          </Button>
                        )}
                      </div>
                    </div>

                    {addingEmailFor === opp.id && opp.businessId && (
                      <AddEmailDialog
                        businessId={opp.businessId}
                        onDone={() => setAddingEmailFor(null)}
                      />
                    )}
                  </CardContent>
                </div>
              </Card>
              {previewData && previewData.oppId === opp.id && (
                <Card className="bg-card border-blue-500/20 mt-2" data-testid="email-preview">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Email Preview</span>
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20">
                          {previewData.templateType.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <button onClick={() => setPreviewData(null)} className="text-muted-foreground hover:text-foreground" data-testid="close-email-preview">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {previewData.recipientEmail && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid="preview-recipient">
                        <Send className="w-3 h-3" />
                        To: {previewData.recipientEmail}
                      </div>
                    )}
                    {!previewData.recipientEmail && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        No email on file — will need manual delivery
                      </div>
                    )}
                    <div className="rounded-lg border border-white/10 bg-muted/30 p-3 space-y-2">
                      <div className="text-xs text-muted-foreground">Subject:</div>
                      <div className="text-sm font-medium" data-testid="preview-subject">{previewData.subject}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-muted/30 p-3 space-y-2">
                      <div className="text-xs text-muted-foreground">Body:</div>
                      <LinkifiedBody text={previewData.body} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is a preview. Click Activate to create the draft and queue it for sending.
                    </p>
                  </CardContent>
                </Card>
              )}
              {activeDraft && activeDraft.oppId === opp.id && (
                <DraftPreview
                  draft={activeDraft.draft}
                  onClose={() => setActiveDraft(null)}
                />
              )}
            </div>
          );
        })}
      </div>
      </>)}

      <Dialog open={!!emailComposerOpp} onOpenChange={(open) => !open && setEmailComposerOpp(null)}>
        {emailComposerOpp && (
          <EmailComposer
            opp={emailComposerOpp.opp}
            mode={emailComposerOpp.mode}
            onClose={() => setEmailComposerOpp(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
