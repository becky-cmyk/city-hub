import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Inbox, ArrowLeft, UserCheck, Clock, AlertTriangle, MessageSquare,
  History, ExternalLink, ChevronUp, ChevronDown, Search, Filter, Mail,
  Eye, Send, Loader2, Crown, Shield, Star, CheckCircle, CheckCircle2,
  AlertCircle, FileQuestion, Bell, ClipboardCheck, X, RotateCcw, Merge,
  Building2, FileText, Calendar, Megaphone, DollarSign, Zap, Play,
  XCircle, Activity, Target, ListChecks, ThumbsUp, ThumbsDown, RefreshCw,
  Flag, Bookmark, Phone, Archive, ArchiveRestore, Camera, Mic, QrCode,
  PenLine, FileUp, Smartphone, User, CalendarClock, ImageIcon, Tag, Library, MapPin
} from "lucide-react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";

type TaskTriageMetadata = {
  taskId: string;
  taskStatus: string;
};

type OpsApproveResult = {
  message?: string;
};

type UnifiedInboxItem = {
  id: string;
  source: "inbox" | "charlotte_ops" | "charlotte_tasks";
  category: "all" | "needs_review" | "charlotte_updates" | "tasks" | "exceptions" | "notifications";
  itemType: string;
  title: string;
  summary: string | null;
  priority: string;
  status: string;
  createdAt: string;
  readAt: string | null;
  isUnread: boolean;
  relatedTable: string | null;
  relatedId: string | null;
  tags: string[] | null;
  confidence: string | null;
  triageReason: string | null;
  suggestedAction: string | null;
  triageMetadata: Record<string, unknown> | null;
  triageCategory: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  visibility: string;
  assignedToUserId: string | null;
  createdByUserId: string | null;
  opsMetadata?: Record<string, unknown>;
  taskProgress?: number;
  taskProposedPlan?: { steps: { description: string; engine?: string }[] } | null;
  taskResult?: Record<string, unknown> | null;
  taskError?: string | null;
  opsEntityId?: string | null;
  opsEntityName?: string | null;
  opsSource?: string;
  opsQueueSection?: string;
  opsActionId?: string;
  hubId?: string | null;
  hubName?: string | null;
};

type UnifiedResponse = {
  items: UnifiedInboxItem[];
  counts: {
    all: number;
    needs_review: number;
    charlotte_updates: number;
    tasks: number;
    exceptions: number;
    notifications: number;
    archived: number;
  };
};

type InboxComment = {
  id: string;
  inboxItemId: string;
  actorUserId: string | null;
  commentText: string;
  createdAt: string;
};

type InboxHistoryEntry = {
  id: string;
  inboxItemId: string;
  actorType: string;
  actorUserId: string | null;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
};

type InboxLink = {
  id: string;
  inboxItemId: string;
  label: string;
  urlOrRoute: string;
  createdAt: string;
};

type InboxDetail = {
  item: {
    id: string;
    itemType: string;
    relatedTable: string | null;
    relatedId: string | null;
    title: string;
    summary: string | null;
    priority: string;
    status: string;
    assignedToUserId: string | null;
    createdByUserId: string | null;
    createdAt: string;
    dueAt: string | null;
    resolvedAt: string | null;
    readAt: string | null;
    tags: string[] | null;
    visibility: string;
    triageCategory: string | null;
    confidence: string | null;
    triageReason: string | null;
    suggestedAction: string | null;
    triageMetadata: Record<string, unknown> | null;
  };
  comments: InboxComment[];
  history: InboxHistoryEntry[];
  links: InboxLink[];
};

type MatchCandidate = {
  id: string;
  name: string;
  confidence: number;
  matchFields: Record<string, string>;
};

const STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
const PRIORITIES = ["low", "med", "high", "urgent"] as const;

const CATEGORY_TABS = [
  { key: "all", label: "All", icon: Inbox },
  { key: "needs_review", label: "Needs Review", icon: FileQuestion },
  { key: "charlotte_updates", label: "Charlotte Updates", icon: Zap },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "exceptions", label: "Exceptions", icon: AlertCircle },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "archived", label: "Archive", icon: Archive },
] as const;

const SOURCE_ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox,
  charlotte_ops: Zap,
  charlotte_tasks: ListChecks,
};

const TYPE_ICONS: Record<string, typeof Building2> = {
  submission_business: Building2,
  submission_organization: Building2,
  submission_event: Calendar,
  submission_article_pitch: FileText,
  submission_press_release: Megaphone,
  submission_shoutout: Megaphone,
  submission_media_mention: Megaphone,
  presence_claim_confirm: Shield,
  presence_transfer_request: Shield,
  cms_content_review: FileText,
  capture_listing_review: ClipboardCheck,
  pipeline_needs_review: ClipboardCheck,
  billing_past_due: DollarSign,
  billing_founder_grace_expiring: DollarSign,
  email_bounce_attention: Mail,
  email_complaint_attention: Mail,
  new_activation: Star,
  new_review: Star,
  new_lead: Star,
  new_vote: Crown,
  proposal: Zap,
  workflow_step: Play,
  capture_action: ClipboardCheck,
  inbox_item: Inbox,
  low_confidence_decision: AlertTriangle,
  incomplete_flow: Clock,
  pending_story_approval: Eye,
  paused_workflow: Clock,
  overdue_inbox: AlertTriangle,
  high_score_entity: Target,
  crown_candidate: Crown,
  tv_venue_candidate: Target,
  orchestrator_decision: Activity,
  batch_session: RefreshCw,
  proposal_execution: CheckCircle,
  onboarding_completion: Star,
  capture_processing: Loader2,
  followup_generation: Send,
  proposal_generation: Zap,
  story_generation: FileText,
  outreach_drafting: Mail,
  general: ListChecks,
  failed_capture_session: AlertTriangle,
  stock_photo_capture: ImageIcon,
};

const CAPTURE_ICONS: Record<string, typeof Camera> = {
  photo: Camera,
  voice: Mic,
  qr_scan: QrCode,
  handwrite: PenLine,
  file_upload: FileUp,
  phone_import: Smartphone,
  manual: User,
  charlotte_ai: Zap,
  google_places: Target,
  osm: Target,
  speaker_request: Megaphone,
  source_request: FileText,
};

const TIER_OPTIONS = [
  { value: "FREE", label: "Free", icon: Shield, desc: "Basic listing — no charge" },
  { value: "VERIFIED", label: "Verified", icon: CheckCircle, desc: "Verified listing — entry level" },
  { value: "ENHANCED", label: "Enhanced", icon: Star, desc: "Premium listing with full microsite & priority ranking" },
];

function priorityColor(p: string): "default" | "secondary" | "outline" | "destructive" {
  if (p === "urgent") return "destructive";
  if (p === "high") return "default";
  if (p === "low") return "outline";
  return "secondary";
}

function statusColor(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "open") return "default";
  if (s === "in_progress") return "secondary";
  if (s === "waiting") return "outline";
  if (s === "resolved") return "outline";
  return "destructive";
}

function confidenceBadge(conf: string | null) {
  if (!conf) return null;
  const num = parseFloat(conf);
  if (isNaN(num)) return null;
  const pct = Math.round(num * 100);
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  if (pct >= 80) variant = "default";
  else if (pct < 40) variant = "destructive";
  return (
    <Badge variant={variant} className="text-[10px]" data-testid="badge-confidence">
      {pct}% match
    </Badge>
  );
}

function formatType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAction(action: string | null) {
  if (!action) return null;
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function sourceLabel(source: string) {
  if (source === "inbox") return "Inbox";
  if (source === "charlotte_ops") return "Charlotte Ops";
  if (source === "charlotte_tasks") return "Charlotte Task";
  return source;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden" data-testid="progress-bar">
      <div
        className="h-full rounded-full bg-violet-500 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function parseNavRoute(urlOrRoute: string): { section: string; params?: Record<string, string> } | null {
  if (urlOrRoute.startsWith("http")) return null;

  const sectionMap: Record<string, string> = {
    "/admin/submissions": "submissions",
    "/admin/transfers": "transfers",
    "/admin/listing-tiers": "listing-tiers",
    "/admin/email-suppression": "email-suppression",
  };

  for (const [path, section] of Object.entries(sectionMap)) {
    if (urlOrRoute.startsWith(path)) return { section };
  }

  const cmsMatch = urlOrRoute.match(/\/admin\/cms\/edit\/(.+)/);
  if (cmsMatch) return { section: "cms-editor", params: { id: cmsMatch[1] } };

  const sectionMatch = urlOrRoute.match(/[?&]section=([^&]+)/);
  if (sectionMatch) return { section: sectionMatch[1] };

  if (urlOrRoute.startsWith("/admin")) {
    const parts = urlOrRoute.replace("/admin/", "").split("?")[0];
    return { section: parts || "dashboard" };
  }

  return null;
}

function getExtractedData(item: UnifiedInboxItem): { name?: string; email?: string; phone?: string; company?: string; captureMethod?: string } {
  const meta = item.triageMetadata as Record<string, unknown> | null;
  if (!meta) return {};
  const ext = (meta.extractedData || {}) as Record<string, string>;
  return {
    name: ext.name || undefined,
    email: ext.email || undefined,
    phone: ext.phone || undefined,
    company: ext.company || undefined,
    captureMethod: (ext.captureMethod || meta.captureMethod || undefined) as string | undefined,
  };
}

function getEntityDisplay(item: UnifiedInboxItem): { name: string; initials: string } {
  if (item.opsEntityName) {
    const words = item.opsEntityName.split(/\s+/);
    return { name: item.opsEntityName, initials: words.map(w => w[0]).join("").slice(0, 2).toUpperCase() };
  }
  const ext = getExtractedData(item);
  if (ext.company) {
    const words = ext.company.split(/\s+/);
    return { name: ext.company, initials: words.map(w => w[0]).join("").slice(0, 2).toUpperCase() };
  }
  if (ext.name) {
    const words = ext.name.split(/\s+/);
    return { name: ext.name, initials: words.map(w => w[0]).join("").slice(0, 2).toUpperCase() };
  }
  const titleWords = item.title.split(/\s+/);
  const titleInitials = titleWords.map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return { name: item.title, initials: titleInitials || "?" };
}

function SendMessageDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UnifiedInboxItem;
}) {
  const { toast } = useToast();
  const [channel, setChannel] = useState("email");
  const [messageText, setMessageText] = useState("");
  const [template, setTemplate] = useState("custom");

  const ext = getExtractedData(item);
  const entityName = item.opsEntityName || ext.company || ext.name || item.title;

  useEffect(() => {
    if (!open) {
      setChannel("email");
      setMessageText("");
      setTemplate("custom");
    }
  }, [open]);

  useEffect(() => {
    if (template === "intro") {
      setMessageText(`Hi${ext.name ? ` ${ext.name}` : ""},\n\nI wanted to reach out regarding ${entityName}. We'd love to connect and discuss how CityMetroHub can help showcase your business to the local community.\n\nLooking forward to hearing from you!`);
    } else if (template === "followup") {
      setMessageText(`Hi${ext.name ? ` ${ext.name}` : ""},\n\nJust following up on our previous conversation about ${entityName}. Please let me know if you have any questions or if there's anything else I can help with.\n\nBest regards`);
    } else if (template === "verification") {
      setMessageText(`Hi${ext.name ? ` ${ext.name}` : ""},\n\nWe'd like to verify the listing for ${entityName} on CityMetroHub. Could you please confirm the details we have on file?\n\nThank you!`);
    } else if (template === "custom") {
      setMessageText("");
    }
  }, [template, ext.name, entityName]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const inboxId = item.source === "inbox" ? item.id.replace("inbox:", "") : null;
      if (inboxId) {
        await apiRequest("POST", `/api/admin/inbox/${inboxId}/comments`, {
          commentText: `[Outreach via ${channel}] ${messageText}`,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Message logged", description: `Outreach recorded for ${entityName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-send-message">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-violet-500" />
            Send Message
          </DialogTitle>
          <DialogDescription>
            Reach out to {entityName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="font-medium text-sm" data-testid="text-message-entity">{entityName}</p>
            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
              {ext.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{ext.email}</span>}
              {ext.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{ext.phone}</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger data-testid="select-message-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone Call</SelectItem>
                <SelectItem value="sms">SMS / Text</SelectItem>
                <SelectItem value="in_person">In Person</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger data-testid="select-message-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Message</SelectItem>
                <SelectItem value="intro">Introduction</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
                <SelectItem value="verification">Verification Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Message</Label>
            <Textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[120px]"
              data-testid="textarea-message-body"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-message">
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!messageText.trim() || sendMutation.isPending}
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...</>
            ) : (
              <><Send className="h-4 w-4 mr-1" /> Log Outreach</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UnifiedInboxItem;
}) {
  const { toast } = useToast();
  const [scheduleType, setScheduleType] = useState("follow_up");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleNote, setScheduleNote] = useState("");

  const entityName = item.opsEntityName || getExtractedData(item).company || getExtractedData(item).name || item.title;

  useEffect(() => {
    if (!open) {
      setScheduleType("follow_up");
      setScheduleDate("");
      setScheduleTime("09:00");
      setScheduleNote("");
    }
  }, [open]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const inboxId = item.source === "inbox" ? item.id.replace("inbox:", "") : null;
      const dueAt = scheduleDate ? `${scheduleDate}T${scheduleTime}:00` : undefined;

      if (inboxId) {
        await apiRequest("PATCH", `/api/admin/inbox/${inboxId}`, {
          status: "waiting",
          dueAt,
        });
        if (scheduleNote.trim()) {
          await apiRequest("POST", `/api/admin/inbox/${inboxId}/comments`, {
            commentText: `[Scheduled: ${formatType(scheduleType)}] ${scheduleNote}`,
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Scheduled", description: `${formatType(scheduleType)} set for ${entityName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-schedule">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-blue-500" />
            Schedule Action
          </DialogTitle>
          <DialogDescription>
            Set a reminder or follow-up for {entityName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Type</Label>
            <Select value={scheduleType} onValueChange={setScheduleType}>
              <SelectTrigger data-testid="select-schedule-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="follow_up">Follow-up Call</SelectItem>
                <SelectItem value="site_visit">Site Visit</SelectItem>
                <SelectItem value="send_proposal">Send Proposal</SelectItem>
                <SelectItem value="check_status">Check Status</SelectItem>
                <SelectItem value="reminder">General Reminder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Date</Label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                data-testid="input-schedule-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Time</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                data-testid="input-schedule-time"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Note</Label>
            <Textarea
              value={scheduleNote}
              onChange={e => setScheduleNote(e.target.value)}
              placeholder="Add context for this scheduled action..."
              className="min-h-[80px]"
              data-testid="textarea-schedule-note"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-schedule">
            Cancel
          </Button>
          <Button
            onClick={() => scheduleMutation.mutate()}
            disabled={!scheduleDate || scheduleMutation.isPending}
            data-testid="button-confirm-schedule"
          >
            {scheduleMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
            ) : (
              <><CalendarClock className="h-4 w-4 mr-1" /> Schedule</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnifiedInboxList({
  onSelect,
  cityId,
  onNavigate,
}: {
  onSelect: (item: UnifiedInboxItem) => void;
  cityId?: string;
  onNavigate?: (section: string, params?: Record<string, string>) => void;
}) {
  const [categoryTab, setCategoryTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [hubFilter, setHubFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messageItem, setMessageItem] = useState<UnifiedInboxItem | null>(null);
  const [scheduleItem, setScheduleItem] = useState<UnifiedInboxItem | null>(null);
  const { toast } = useToast();

  const isArchiveTab = categoryTab === "archived";

  useEffect(() => {
    if (isArchiveTab) {
      setStatusFilter("all");
    } else if (statusFilter === "all" && categoryTab !== "archived") {
      setStatusFilter("open");
    }
  }, [categoryTab]);

  const { data: hubsList } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["/api/admin/hubs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/hubs", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 300000,
  });

  const params = new URLSearchParams();
  if (isArchiveTab) {
    params.set("status", "archived");
  } else {
    if (categoryTab && categoryTab !== "all") params.set("category", categoryTab);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
  }
  if (!isArchiveTab) {
    if (priorityFilter && priorityFilter !== "all") params.set("priority", priorityFilter);
    if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
    if (hubFilter && hubFilter !== "all") params.set("hubId", hubFilter);
  }
  if (cityId) params.set("cityId", cityId);
  if (searchQ) params.set("q", searchQ);

  const { data, isLoading, refetch } = useQuery<UnifiedResponse>({
    queryKey: ["/api/admin/inbox/unified", categoryTab, statusFilter, priorityFilter, sourceFilter, hubFilter, cityId, searchQ],
    queryFn: async () => {
      const res = await fetch(`/api/admin/inbox/unified?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load inbox");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const items = data?.items || [];
  const counts = data?.counts || { all: 0, needs_review: 0, charlotte_updates: 0, tasks: 0, exceptions: 0, notifications: 0, archived: 0 };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/admin/inbox/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Approved" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/admin/inbox/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Dismissed" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/admin/inbox/${id}`, { status: "open" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Restored to inbox" });
    },
  });

  const opsApproveMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", "/api/admin/charlotte/ops-center/approve", { actionId });
      return res.json();
    },
    onSuccess: (result: OpsApproveResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: result.message || "Action completed" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const opsRejectMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", "/api/admin/charlotte/ops-center/reject", { actionId });
      return res.json();
    },
    onSuccess: (result: OpsApproveResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: result.message || "Rejected" });
    },
    onError: () => toast({ title: "Reject failed", variant: "destructive" }),
  });

  const opsRunNowMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", "/api/admin/charlotte/ops-center/run-now", { actionId });
      return res.json();
    },
    onSuccess: (result: OpsApproveResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: result.message || "Running" });
    },
    onError: () => toast({ title: "Run failed", variant: "destructive" }),
  });

  const taskApproveMutation = useMutation({
    mutationFn: async (taskId: string) => apiRequest("POST", `/api/admin/charlotte/tasks/${taskId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Task approved" });
    },
  });

  const taskRejectMutation = useMutation({
    mutationFn: async (taskId: string) => apiRequest("POST", `/api/admin/charlotte/tasks/${taskId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Task rejected" });
    },
  });

  function getInboxIdFromUnified(item: UnifiedInboxItem): string | null {
    if (item.source === "inbox") return item.id.replace("inbox:", "");
    return null;
  }

  function renderQuickActions(item: UnifiedInboxItem) {
    if (isArchiveTab && item.source === "inbox") {
      const inboxId = getInboxIdFromUnified(item)!;
      return (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => restoreMutation.mutate(inboxId)}
            disabled={restoreMutation.isPending}
            data-testid={`button-restore-${item.id}`}
          >
            <ArchiveRestore className="h-3.5 w-3.5" /> Restore
          </Button>
        </div>
      );
    }

    if (item.source === "inbox") {
      const inboxId = getInboxIdFromUnified(item)!;
      if (item.status === "open" && item.category !== "notifications") {
        const isCaptureItem = item.itemType === "capture_listing_review";
        const isCmsItem = item.itemType === "cms_content_review";
        const isExceptionItem = item.category === "exceptions";

        if (isExceptionItem) {
          return (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Resolve"
                onClick={() => approveMutation.mutate(inboxId)}
                disabled={approveMutation.isPending}
                data-testid={`button-resolve-${item.id}`}
              >
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Escalate"
                onClick={() => setMessageItem(item)}
                data-testid={`button-escalate-${item.id}`}
              >
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Dismiss"
                onClick={() => dismissMutation.mutate(inboxId)}
                disabled={dismissMutation.isPending}
                data-testid={`button-dismiss-${item.id}`}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          );
        }

        if (isCaptureItem) {
          return (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Create Listing"
                onClick={() => approveMutation.mutate(inboxId)}
                disabled={approveMutation.isPending}
                data-testid={`button-create-listing-${item.id}`}
              >
                <Building2 className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Message"
                onClick={() => setMessageItem(item)}
                data-testid={`button-message-${item.id}`}
              >
                <Send className="h-3.5 w-3.5 text-violet-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Dismiss"
                onClick={() => dismissMutation.mutate(inboxId)}
                disabled={dismissMutation.isPending}
                data-testid={`button-dismiss-${item.id}`}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          );
        }

        if (isCmsItem) {
          return (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Approve"
                onClick={() => approveMutation.mutate(inboxId)}
                disabled={approveMutation.isPending}
                data-testid={`button-approve-${item.id}`}
              >
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Edit"
                onClick={() => onSelect(item)}
                data-testid={`button-edit-${item.id}`}
              >
                <FileText className="h-3.5 w-3.5 text-blue-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Dismiss"
                onClick={() => dismissMutation.mutate(inboxId)}
                disabled={dismissMutation.isPending}
                data-testid={`button-dismiss-${item.id}`}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          );
        }

        return (
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Approve"
              onClick={() => approveMutation.mutate(inboxId)}
              disabled={approveMutation.isPending}
              data-testid={`button-approve-${item.id}`}
            >
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Dismiss"
              onClick={() => dismissMutation.mutate(inboxId)}
              disabled={dismissMutation.isPending}
              data-testid={`button-dismiss-${item.id}`}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        );
      }
    }

    if (item.source === "charlotte_ops" && item.opsActionId) {
      return (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Approve"
            onClick={() => opsApproveMutation.mutate(item.opsActionId!)}
            disabled={opsApproveMutation.isPending}
            data-testid={`button-approve-${item.id}`}
          >
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Run Now"
            onClick={() => opsRunNowMutation.mutate(item.opsActionId!)}
            disabled={opsRunNowMutation.isPending}
            data-testid={`button-run-${item.id}`}
          >
            <Play className="h-3.5 w-3.5 text-emerald-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Reject"
            onClick={() => opsRejectMutation.mutate(item.opsActionId!)}
            disabled={opsRejectMutation.isPending}
            data-testid={`button-reject-${item.id}`}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      );
    }

    if (item.source === "charlotte_tasks") {
      const taskId = item.id.replace("task:", "");
      const taskMeta = item.triageMetadata as TaskTriageMetadata | null;
      const taskStatus = taskMeta?.taskStatus;
      if (taskStatus === "awaiting_approval") {
        return (
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Approve Task"
              onClick={() => taskApproveMutation.mutate(taskId)}
              disabled={taskApproveMutation.isPending}
              data-testid={`button-approve-task-${item.id}`}
            >
              <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Reject Task"
              onClick={() => taskRejectMutation.mutate(taskId)}
              disabled={taskRejectMutation.isPending}
              data-testid={`button-reject-task-${item.id}`}
            >
              <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        );
      }
    }

    return null;
  }

  function renderInlineActions(item: UnifiedInboxItem) {
    const hasContactData = item.source === "inbox" && (getExtractedData(item).email || getExtractedData(item).phone || item.opsEntityName);
    const isInboxSource = item.source === "inbox";
    const isStockPhoto = item.itemType === "stock_photo_capture";
    if (isArchiveTab) return null;

    return (
      <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
        {isStockPhoto && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={async () => {
              try {
                const res = await apiRequest("POST", `/api/inbox/${item.id}/add-to-media-library`);
                const data = await res.json();
                toast({ title: "Added to Media Library", description: data.message || "Photos saved as media assets" });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
              } catch (err) {
                toast({ title: "Failed", description: String(err), variant: "destructive" });
              }
            }}
            data-testid={`button-add-media-${item.id}`}
          >
            <Library className="h-3 w-3" /> Add to Media Library
          </Button>
        )}
        {hasContactData && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setMessageItem(item)}
            data-testid={`button-message-${item.id}`}
          >
            <Send className="h-3 w-3" /> Message
          </Button>
        )}
        {isInboxSource && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setScheduleItem(item)}
            data-testid={`button-schedule-${item.id}`}
          >
            <CalendarClock className="h-3 w-3" /> Schedule
          </Button>
        )}
      </div>
    );
  }

  function renderExpandedPreview(item: UnifiedInboxItem) {
    const ext = getExtractedData(item);
    const meta = item.triageMetadata as Record<string, unknown> | null;
    const extractedEntries = meta?.extractedData ? Object.entries(meta.extractedData as Record<string, string>).filter(([, v]) => v) : [];
    const stockPhotoUrls = item.itemType === "stock_photo_capture" && meta?.photoUrls ? (meta.photoUrls as string[]) : [];
    const stockHubSlug = item.itemType === "stock_photo_capture" && meta?.hubSlug ? String(meta.hubSlug) : "";
    const stockNotes = item.itemType === "stock_photo_capture" && meta?.notes ? String(meta.notes) : "";

    return (
      <div className="mt-3 pt-3 border-t space-y-2" onClick={e => e.stopPropagation()}>
        {stockPhotoUrls.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              {stockPhotoUrls.slice(0, 6).map((url, i) => (
                <img key={i} src={url} className="h-16 w-16 rounded object-cover border" alt={`Stock photo ${i + 1}`} />
              ))}
              {stockPhotoUrls.length > 6 && (
                <div className="h-16 w-16 rounded border flex items-center justify-center text-xs text-muted-foreground">
                  +{stockPhotoUrls.length - 6}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {stockHubSlug && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <MapPin className="h-2.5 w-2.5" /> {stockHubSlug}
                </Badge>
              )}
              {stockNotes && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{stockNotes}</span>}
            </div>
          </div>
        )}

        {extractedEntries.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {extractedEntries.slice(0, 8).map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-muted-foreground">{formatType(k)}:</span>{" "}
                <span className="font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {item.triageReason && (
          <div className="text-xs rounded-md bg-amber-500/10 border border-amber-500/20 p-2">
            <span className="font-medium text-amber-700 dark:text-amber-400">Why here: </span>
            {item.triageReason}
          </div>
        )}

        {item.suggestedAction && (
          <div className="text-xs rounded-md bg-blue-500/10 border border-blue-500/20 p-2">
            <span className="font-medium text-blue-700 dark:text-blue-400">Suggested: </span>
            {formatAction(item.suggestedAction)}
          </div>
        )}

        {item.summary && !item.triageReason && (
          <p className="text-xs text-muted-foreground">{item.summary}</p>
        )}

        {renderInlineActions(item)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-inbox-title">
          <Inbox className="h-6 w-6" /> Inbox
        </h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()} data-testid="button-refresh-inbox">
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <Tabs value={categoryTab} onValueChange={setCategoryTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1" data-testid="tabs-inbox-categories">
          {CATEGORY_TABS.map(tab => {
            const Icon = tab.icon;
            const count = tab.key === "archived"
              ? (counts.archived ?? 0)
              : (counts[tab.key as keyof typeof counts] ?? 0);
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5" data-testid={`tab-category-${tab.key}`}>
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <Badge
                    variant={tab.key === "all" ? "secondary" : tab.key === "archived" ? "outline" : "default"}
                    className="ml-1 text-[10px] px-1.5 min-w-[1.25rem] justify-center"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search inbox..."
              className="pl-9"
              data-testid="input-inbox-search"
            />
          </div>
        </div>
        {!isArchiveTab && (
          <>
            <div>
              <Label className="text-xs">Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-auto min-w-[120px]" data-testid="select-source-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="inbox">Inbox</SelectItem>
                  <SelectItem value="charlotte_ops">Charlotte Ops</SelectItem>
                  <SelectItem value="charlotte_tasks">Charlotte Tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-auto min-w-[90px]" data-testid="select-priority-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-auto min-w-[100px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{formatType(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {hubsList && hubsList.length > 0 && (
          <div>
            <Label className="text-xs">Hub</Label>
            <Select value={hubFilter} onValueChange={setHubFilter}>
              <SelectTrigger className="w-auto min-w-[120px]" data-testid="select-hub-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Hubs</SelectItem>
                {hubsList.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground" data-testid="empty-inbox">
          {isArchiveTab ? (
            <>
              <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No archived items.</p>
            </>
          ) : (
            <>
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No inbox items match your filters.</p>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-2" data-testid="inbox-item-list">
          {items.map(item => {
            const isOverdue = item.dueAt && new Date(item.dueAt) < new Date() && !["resolved", "closed"].includes(item.status);
            const TypeIcon = TYPE_ICONS[item.itemType] || Inbox;
            const SourceIcon = SOURCE_ICONS[item.source] || Inbox;
            const isTask = item.source === "charlotte_tasks";
            const taskMeta = item.triageMetadata as TaskTriageMetadata | null;
            const taskStatus = taskMeta?.taskStatus;
            const isExpanded = expandedId === item.id;
            const entity = getEntityDisplay(item);
            const ext = getExtractedData(item);
            const CaptureIcon = ext.captureMethod ? CAPTURE_ICONS[ext.captureMethod] || null : null;

            return (
              <Card
                key={item.id}
                className={`transition-colors cursor-pointer ${item.isUnread ? "border-l-2 border-l-violet-500" : ""}`}
                onClick={() => onSelect(item)}
                data-testid={`row-inbox-item-${item.id}`}
              >
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.isUnread ? "bg-violet-100 dark:bg-violet-950" : "bg-muted"}`}>
                        {entity.initials ? (
                          <span className={`font-bold text-sm ${item.isUnread ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground"}`}>
                            {entity.initials}
                          </span>
                        ) : (
                          <TypeIcon className={`h-4 w-4 ${item.isUnread ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"} ${isTask && taskStatus === "running" ? "animate-spin" : ""}`} />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm truncate ${item.isUnread ? "font-semibold" : "font-normal"}`}>
                          {item.title}
                        </span>
                        <Badge variant={priorityColor(item.priority)} className="text-[10px]" data-testid={`badge-priority-${item.id}`}>
                          {item.priority.toUpperCase()}
                        </Badge>
                        {isArchiveTab && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {formatType(item.status)}
                          </Badge>
                        )}
                        {confidenceBadge(item.confidence)}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {entity.name && (
                          <span className="flex items-center gap-1 font-medium text-foreground/80">
                            <Building2 className="h-3 w-3" />{entity.name}
                          </span>
                        )}
                        {ext.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" />{ext.email}
                          </span>
                        )}
                        {ext.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />{ext.phone}
                          </span>
                        )}
                      </div>

                      {!ext.email && !ext.phone && !entity.name && (item.triageReason || item.summary) && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {item.triageReason || item.summary}
                        </p>
                      )}

                      {isTask && item.taskProgress != null && item.taskProgress > 0 && (
                        <div className="mt-1.5 max-w-[200px]">
                          <ProgressBar value={item.taskProgress} />
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <SourceIcon className="h-2.5 w-2.5" />
                          {sourceLabel(item.source)}
                        </Badge>
                        {CaptureIcon && (
                          <Badge variant="secondary" className="text-[10px] gap-0.5">
                            <CaptureIcon className="h-2.5 w-2.5" />
                            {(ext.captureMethod || "").replace(/_/g, " ")}
                          </Badge>
                        )}
                        {item.opsEntityName && !entity.name && (
                          <span className="text-[10px] text-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                            {item.opsEntityName}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-[10px] text-destructive font-medium flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> Overdue
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-1">
                      {renderQuickActions(item)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : item.id);
                        }}
                        data-testid={`button-expand-${item.id}`}
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && renderExpandedPreview(item)}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="text-sm text-muted-foreground" data-testid="text-items-count">
        {items.length} items shown
      </div>

      {messageItem && (
        <SendMessageDialog
          open={!!messageItem}
          onOpenChange={open => { if (!open) setMessageItem(null); }}
          item={messageItem}
        />
      )}

      {scheduleItem && (
        <ScheduleDialog
          open={!!scheduleItem}
          onOpenChange={open => { if (!open) setScheduleItem(null); }}
          item={scheduleItem}
        />
      )}
    </div>
  );
}

function SendVerificationDialog({
  open,
  onOpenChange,
  businessId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("FREE");
  const [step, setStep] = useState<"form" | "preview">("form");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const { data: biz, isLoading: bizLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/businesses", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}`);
      if (!res.ok) throw new Error("Failed to load business");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (biz) {
      setEmail(biz.ownerEmail || biz.email || "");
      setTier(biz.listingTier || "FREE");
    }
  }, [biz]);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setPreviewHtml("");
      setPreviewSubject("");
    }
  }, [open]);

  const sendMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/admin/businesses/${businessId}/send-claim`, {
        ownerEmail: email,
        listingTier: tier,
      }),
    onSuccess: () => {
      toast({ title: "Verification email sent", description: `Sent to ${email}` });
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/claim-preview`);
      if (!res.ok) throw new Error("Failed to load preview");
      const data = await res.json();
      setPreviewSubject(data.subject);
      setPreviewHtml(data.html);
      setStep("preview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Preview failed", description: message, variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const isValid = email.includes("@") && email.includes(".");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-send-verification">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-purple-400" />
            {step === "form" ? "Send Verification Email" : "Preview Email"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Set the recipient email and listing tier, then preview before sending."
              : "Review the email below before sending."}
          </DialogDescription>
        </DialogHeader>

        {bizLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : step === "form" ? (
          <div className="space-y-4">
            {biz && (
              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm" data-testid="text-biz-name">{biz.name}</p>
                  {biz.preferredLanguage === "es" && (
                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30" data-testid="badge-lang-es">
                      ES
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {biz.address && `${biz.address}, `}{biz.city || ""} {biz.state || ""}
                </p>
                {biz.presenceType === "organization" && (
                  <Badge variant="outline" className="mt-1 text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                    Non-Profit / Organization
                  </Badge>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="claim-email" className="text-sm font-medium">Recipient Email</Label>
              <Input
                id="claim-email"
                type="email"
                placeholder="owner@business.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid="input-claim-email"
              />
              {!isValid && email.length > 0 && (
                <p className="text-xs text-destructive">Enter a valid email address</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Listing Tier</Label>
              <div className="grid gap-2">
                {TIER_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTier(opt.value)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        tier === opt.value
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-border"
                      }`}
                      data-testid={`tier-option-${opt.value}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${tier === opt.value ? "text-purple-400" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${tier === opt.value ? "text-purple-400" : ""}`}>{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/30">
              <Label className="text-xs text-muted-foreground">To</Label>
              <p className="text-sm font-medium">{email}</p>
              <Label className="text-xs text-muted-foreground mt-2">Subject</Label>
              <p className="text-sm font-medium">{previewSubject}</p>
              <Label className="text-xs text-muted-foreground mt-2">Tier</Label>
              <p className="text-sm font-medium">{TIER_OPTIONS.find(t => t.value === tier)?.label || tier}</p>
            </div>
            <div className="rounded-lg border overflow-hidden bg-white">
              <iframe
                ref={previewRef}
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ minHeight: "400px" }}
                title="Email Preview"
                data-testid="iframe-email-preview"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("form")} className="w-full sm:w-auto" data-testid="button-back-to-form">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {step === "form" ? (
            <Button
              onClick={handlePreview}
              disabled={!isValid || loadingPreview}
              className="w-full sm:w-auto"
              data-testid="button-preview-email"
            >
              {loadingPreview ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Loading...</>
              ) : (
                <><Eye className="h-4 w-4 mr-1" /> Preview Email</>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> Send Email</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntityResolutionPanel({ item, onResolved }: { item: InboxDetail["item"]; onResolved: () => void }) {
  const { toast } = useToast();
  const meta = (item.triageMetadata || {}) as Record<string, unknown>;
  const candidates = (meta.matchCandidates || []) as MatchCandidate[];
  const extractedData = (meta.extractedData || {}) as Record<string, string>;

  const resolveMutation = useMutation({
    mutationFn: async (body: Record<string, string>) =>
      apiRequest("POST", `/api/admin/inbox/${item.id}/resolve-entity`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Entity resolved" });
      onResolved();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (candidates.length === 0 && !extractedData.name) return null;

  return (
    <Card className="p-4 space-y-3" data-testid="entity-resolution-panel">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Merge className="h-4 w-4" /> Entity Resolution
      </h3>

      {Object.keys(extractedData).length > 0 && (
        <div className="rounded-lg border p-3 bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground mb-1">Captured Data</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(extractedData).slice(0, 8).map(([k, v]) => (
              <div key={k}>
                <span className="text-muted-foreground text-xs">{formatType(k)}:</span>{" "}
                <span className="font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Possible Matches</p>
          {candidates.map(c => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border p-3"
              data-testid={`match-candidate-${c.id}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{c.name}</p>
                <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                  {Object.entries(c.matchFields).slice(0, 3).map(([k, v]) => (
                    <span key={k}>{formatType(k)}: {v}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={c.confidence >= 0.7 ? "default" : c.confidence >= 0.4 ? "secondary" : "destructive"} className="text-[10px]">
                  {Math.round(c.confidence * 100)}%
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolveMutation.mutate({ action: "select_match", selectedEntityId: c.id, selectedEntityName: c.name })}
                  disabled={resolveMutation.isPending}
                  data-testid={`button-select-match-${c.id}`}
                >
                  Select
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolveMutation.mutate({ action: "merge", selectedEntityId: c.id, selectedEntityName: c.name })}
                  disabled={resolveMutation.isPending}
                  data-testid={`button-merge-${c.id}`}
                >
                  <Merge className="h-3 w-3 mr-1" /> Merge
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => resolveMutation.mutate({ action: "create_new" })}
        disabled={resolveMutation.isPending}
        data-testid="button-create-new-entity"
      >
        Create New Entity
      </Button>
    </Card>
  );
}

type ContextualAction = {
  label: string;
  icon: typeof Send;
  key: string;
  variant?: "default" | "outline" | "destructive";
};

function getContextualActions(itemType: string): ContextualAction[] {
  const actions: ContextualAction[] = [];

  if (itemType === "capture_listing_review") {
    actions.push({ label: "Send to Charlotte", icon: Send, key: "send_charlotte" });
    actions.push({ label: "Create Listing", icon: Building2, key: "create_listing" });
    actions.push({ label: "Start Claim Process", icon: Shield, key: "start_claim" });
  }
  if (itemType === "pipeline_needs_review") {
    actions.push({ label: "Send to Charlotte", icon: Send, key: "send_charlotte" });
    actions.push({ label: "Approve & Publish", icon: CheckCircle, key: "approve_publish" });
  }
  if (itemType === "cms_content_review") {
    actions.push({ label: "Approve & Publish", icon: CheckCircle, key: "approve_publish" });
    actions.push({ label: "Edit in CMS", icon: FileText, key: "edit_cms" });
  }
  if (["submission_business", "submission_organization", "submission_event"].includes(itemType)) {
    actions.push({ label: "Approve & Publish", icon: CheckCircle, key: "approve_publish" });
    actions.push({ label: "Send to Charlotte", icon: Send, key: "send_charlotte" });
  }
  if (itemType === "story_interview_scheduled") {
    actions.push({ label: "Approve & Publish", icon: CheckCircle, key: "approve_publish" });
  }
  if (itemType === "stock_photo_capture") {
    actions.push({ label: "Add to Media Library", icon: Library, key: "add_to_media_library" });
  }

  actions.push({ label: "Manual Follow-up", icon: Flag, key: "manual_followup" });
  actions.push({ label: "Dismiss", icon: X, key: "dismiss", variant: "outline" });

  return actions;
}

function UnifiedDetailView({
  unifiedItem,
  onBack,
  onNavigate,
}: {
  unifiedItem: UnifiedInboxItem;
  onBack: () => void;
  onNavigate?: (section: string, params?: Record<string, string>) => void;
}) {
  if (unifiedItem.source === "inbox") {
    const inboxId = unifiedItem.id.replace("inbox:", "");
    return <InboxItemDetailView itemId={inboxId} onBack={onBack} onNavigate={onNavigate} />;
  }

  if (unifiedItem.source === "charlotte_tasks") {
    return <TaskDetailView item={unifiedItem} onBack={onBack} />;
  }

  if (unifiedItem.source === "charlotte_ops") {
    return <OpsDetailView item={unifiedItem} onBack={onBack} onNavigate={onNavigate} />;
  }

  return <div>Unknown item source</div>;
}

function TaskDetailView({ item, onBack }: { item: UnifiedInboxItem; onBack: () => void }) {
  const { toast } = useToast();
  const taskId = item.id.replace("task:", "");
  const taskMeta = item.triageMetadata as TaskTriageMetadata | null;
  const taskStatus = taskMeta?.taskStatus || "unknown";
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/charlotte/tasks/${taskId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Task approved" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/charlotte/tasks/${taskId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Task rejected" });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/charlotte/tasks/${taskId}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Task queued for retry" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (feedback: string) =>
      apiRequest("POST", `/api/admin/charlotte/tasks/${taskId}/feedback`, { feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Feedback recorded" });
      setFeedbackText("");
      setShowFeedback(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/charlotte/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Task removed" });
      onBack();
    },
  });

  const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    awaiting_approval: { label: "Awaiting Approval", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
    pending: { label: "Pending", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Play },
    running: { label: "Running", color: "bg-violet-100 text-violet-800 border-violet-200", icon: Loader2 },
    completed: { label: "Completed", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    failed: { label: "Failed", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
    cancelled: { label: "Rejected", color: "bg-gray-100 text-gray-600 border-gray-200", icon: ThumbsDown },
  };

  const config = statusConfig[taskStatus] || { label: taskStatus, color: "bg-gray-100 text-gray-700", icon: AlertTriangle };
  const StatusIcon = config.icon;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-inbox">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Inbox
      </Button>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold" data-testid="text-task-detail-title">{item.title}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="outline" className={`${config.color} border gap-1`}>
                <StatusIcon className={`h-3 w-3 ${taskStatus === "running" ? "animate-spin" : ""}`} />
                {config.label}
              </Badge>
              <Badge variant="outline">{formatType(item.itemType)}</Badge>
              <Badge variant="secondary" className="text-[10px]">Charlotte Task</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {taskStatus === "awaiting_approval" && (
              <>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve-task-detail"
                >
                  <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  data-testid="button-reject-task-detail"
                >
                  <ThumbsDown className="h-4 w-4 mr-1" /> Reject
                </Button>
              </>
            )}
            {taskStatus === "failed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
                data-testid="button-retry-task"
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Retry
              </Button>
            )}
            {["completed", "failed", "cancelled"].includes(taskStatus) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-task"
              >
                <X className="h-4 w-4 mr-1" /> Remove
              </Button>
            )}
          </div>
        </div>

        {item.summary && (
          <p className="text-muted-foreground" data-testid="text-task-summary">{item.summary}</p>
        )}

        {(taskStatus === "running" || (item.taskProgress && item.taskProgress > 0)) && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{item.taskProgress}%</span>
            </div>
            <ProgressBar value={item.taskProgress || 0} />
          </div>
        )}

        {item.taskProposedPlan && item.taskProposedPlan.steps && item.taskProposedPlan.steps.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5">Plan</p>
            <ol className="space-y-1">
              {item.taskProposedPlan.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                  <span>{step.description}</span>
                  {step.engine && (
                    <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{step.engine}</Badge>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {item.taskResult && (
          <div>
            <p className="text-xs font-medium mb-1">Result</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32" data-testid="text-task-result">
              {JSON.stringify(item.taskResult, null, 2)}
            </pre>
          </div>
        )}

        {item.taskError && (
          <div>
            <p className="text-xs font-medium text-red-600 mb-1">Error</p>
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded" data-testid="text-task-error">{item.taskError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Created</Label>
            <p>{new Date(item.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <p>{config.label}</p>
          </div>
        </div>

        {(taskStatus === "completed" || taskStatus === "failed") && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFeedback(!showFeedback)}
              data-testid="button-feedback-toggle"
            >
              <MessageSquare className="h-4 w-4 mr-1" /> Feedback
            </Button>
          </div>
        )}

        {showFeedback && (
          <div className="flex gap-2">
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell Charlotte what to adjust next time..."
              className="text-xs min-h-[60px]"
              data-testid="input-task-feedback"
            />
            <Button
              size="sm"
              className="h-8 self-end"
              disabled={!feedbackText.trim() || feedbackMutation.isPending}
              onClick={() => feedbackMutation.mutate(feedbackText.trim())}
              data-testid="button-submit-task-feedback"
            >
              Send
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function OpsDetailView({
  item,
  onBack,
  onNavigate,
}: {
  item: UnifiedInboxItem;
  onBack: () => void;
  onNavigate?: (section: string, params?: Record<string, string>) => void;
}) {
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/charlotte/ops-center/approve", { actionId: item.opsActionId });
      return res.json() as Promise<OpsApproveResult>;
    },
    onSuccess: (result: OpsApproveResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: result.message || "Approved" });
      onBack();
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/charlotte/ops-center/reject", { actionId: item.opsActionId });
      return res.json() as Promise<OpsApproveResult>;
    },
    onSuccess: (result: OpsApproveResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: result.message || "Rejected" });
      onBack();
    },
    onError: () => toast({ title: "Reject failed", variant: "destructive" }),
  });

  const runNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/charlotte/ops-center/run-now", { actionId: item.opsActionId });
      return res.json() as Promise<OpsApproveResult>;
    },
    onSuccess: (result: OpsApproveResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: result.message || "Running" });
    },
    onError: () => toast({ title: "Run failed", variant: "destructive" }),
  });

  const sendToInboxMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/charlotte/ops-center/send-to-inbox", { itemId: item.opsActionId, title: item.title });
      return res.json() as Promise<OpsApproveResult>;
    },
    onSuccess: (result: OpsApproveResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: result.message || "Sent to inbox" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const meta = item.opsMetadata || {};
  const metaDetails: string[] = [];
  if (meta.confidence !== undefined) metaDetails.push(`Confidence: ${(Number(meta.confidence) * 100).toFixed(0)}%`);
  if (meta.prospectFit !== undefined) metaDetails.push(`Prospect fit: ${meta.prospectFit}`);
  if (meta.contactReady !== undefined) metaDetails.push(`Contact ready: ${meta.contactReady}`);
  if (meta.trustLevel) metaDetails.push(`Trust: ${meta.trustLevel}`);
  if (meta.step) metaDetails.push(`Step: ${meta.step}`);
  if (meta.stage) metaDetails.push(`Stage: ${meta.stage}`);
  if (meta.flowType) metaDetails.push(`Flow: ${meta.flowType}`);
  if (meta.status) metaDetails.push(`Status: ${meta.status}`);
  if (meta.bucket) metaDetails.push(`Bucket: ${meta.bucket}`);
  if (meta.mode) metaDetails.push(`Mode: ${meta.mode}`);
  if (meta.listingTier) metaDetails.push(`Tier: ${meta.listingTier}`);

  const anyPending = approveMutation.isPending || rejectMutation.isPending || runNowMutation.isPending;

  const ITEM_TYPE_NAV: Record<string, string> = {
    proposal: "charlotte-proposals",
    workflow_step: "workflows",
    inbox_item: "inbox",
    low_confidence_decision: "inbox",
    incomplete_flow: "workflows",
    pending_story_approval: "workflows",
    paused_workflow: "workflows",
    overdue_inbox: "inbox",
    high_score_entity: "businesses",
    crown_candidate: "businesses",
    tv_venue_candidate: "businesses",
    orchestrator_decision: "inbox",
    batch_session: "inbox",
    proposal_execution: "charlotte-proposals",
    onboarding_completion: "businesses",
    capture_action: "field-captures",
    failed_capture_session: "field-captures",
    stock_photo_capture: "inbox",
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-inbox">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Inbox
      </Button>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold" data-testid="text-ops-detail-title">{item.title}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant={priorityColor(item.priority)}>{item.priority.toUpperCase()}</Badge>
              <Badge variant="outline">{formatType(item.itemType)}</Badge>
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Zap className="h-2.5 w-2.5" /> Charlotte Ops
              </Badge>
              {item.opsSource && (
                <Badge variant="outline" className="text-[10px]">{item.opsSource}</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => approveMutation.mutate()}
              disabled={anyPending}
              data-testid="button-approve-ops-detail"
            >
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-600"
              onClick={() => runNowMutation.mutate()}
              disabled={anyPending}
              data-testid="button-run-ops-detail"
            >
              <Play className="h-4 w-4 mr-1" /> Run Now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600"
              onClick={() => rejectMutation.mutate()}
              disabled={anyPending}
              data-testid="button-reject-ops-detail"
            >
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendToInboxMutation.mutate()}
              disabled={sendToInboxMutation.isPending}
              data-testid="button-send-to-inbox-ops"
            >
              <Inbox className="h-4 w-4 mr-1" /> Send to Inbox
            </Button>
          </div>
        </div>

        {item.summary && (
          <p className="text-muted-foreground" data-testid="text-ops-summary">{item.summary}</p>
        )}

        {item.opsEntityName && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" /> {item.opsEntityName}
            </Badge>
            {onNavigate && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const section = ITEM_TYPE_NAV[item.itemType] || "businesses";
                  const navParams: Record<string, string> = {};
                  if (item.opsEntityId) navParams.entityId = item.opsEntityId;
                  onNavigate(section, Object.keys(navParams).length ? navParams : undefined);
                }}
                data-testid="button-view-entity-ops"
              >
                <ExternalLink className="h-3 w-3 mr-1" /> View Record
              </Button>
            )}
          </div>
        )}

        {metaDetails.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metaDetails.map((d, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Created</Label>
            <p>{new Date(item.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Queue Section</Label>
            <p>{formatType(item.opsQueueSection || "unknown")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InboxItemDetailView({
  itemId,
  onBack,
  onNavigate,
}: {
  itemId: string;
  onBack: () => void;
  onNavigate?: (section: string, params?: Record<string, string>) => void;
}) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [editPriority, setEditPriority] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editDueAt, setEditDueAt] = useState<string>("");
  const [showSendDialog, setShowSendDialog] = useState(false);

  const { data, isLoading } = useQuery<InboxDetail>({
    queryKey: ["/api/admin/inbox", itemId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/inbox/${itemId}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  useEffect(() => {
    apiRequest("POST", `/api/admin/inbox/${itemId}/read`).catch(() => {});
  }, [itemId]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) =>
      apiRequest("PATCH", `/api/admin/inbox/${itemId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/admin/inbox/${itemId}/comments`, { commentText: newComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox", itemId] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignMeMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/inbox/${itemId}/assign-me`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Assigned to you" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/inbox/${itemId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Approved and routed" });
      onBack();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/inbox/${itemId}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Dismissed" });
      onBack();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reprocessMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/inbox/${itemId}/reprocess`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
      toast({ title: "Reprocessing started" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!data) return <div>Item not found</div>;

  const { item, comments, history, links } = data;
  const triageMeta = (item.triageMetadata || {}) as Record<string, unknown>;
  const hasCaptureData = !!triageMeta.captureItemId;
  const matchCandidates = triageMeta.matchCandidates as MatchCandidate[] | undefined;
  const hasMatchCandidates = !!matchCandidates?.length;
  const isTriageItem = item.triageCategory !== "notification";
  const isOpen = !["resolved", "closed"].includes(item.status);
  const extractedData = (triageMeta.extractedData || {}) as Record<string, string>;

  function handleContextualAction(actionKey: string) {
    switch (actionKey) {
      case "approve_publish":
        approveMutation.mutate();
        break;
      case "dismiss":
        dismissMutation.mutate();
        break;
      case "send_charlotte":
        reprocessMutation.mutate();
        break;
      case "create_listing":
        approveMutation.mutate();
        if (item.relatedId && onNavigate) {
          onNavigate("businesses", { entityId: item.relatedId });
        }
        break;
      case "edit_cms":
        if (item.relatedId && onNavigate) {
          onNavigate("cms-editor", { id: item.relatedId });
        } else {
          toast({ title: "No CMS content linked to edit" });
        }
        break;
      case "start_claim":
        if (item.relatedId && item.relatedTable === "businesses") {
          setShowSendDialog(true);
        } else {
          toast({ title: "No business linked to start claim process" });
        }
        break;
      case "add_to_media_library":
        (async () => {
          try {
            const res = await apiRequest("POST", `/api/inbox/${item.id}/add-to-media-library`);
            const data = await res.json();
            toast({ title: "Added to Media Library", description: data.message || "Photo saved as a media asset" });
            updateMutation.mutate({ status: "resolved", reason: "Added to media library" });
            queryClient.invalidateQueries({ queryKey: ["/api/cms/assets"] });
          } catch (err: any) {
            toast({ title: "Failed", description: err.message || "Could not add to media library", variant: "destructive" });
          }
        })();
        break;
      case "manual_followup":
        updateMutation.mutate({ status: "in_progress", reason: "Manual follow-up" });
        break;
      default:
        toast({ title: `Action: ${actionKey}` });
    }
  }

  function handleLinkClick(link: InboxLink) {
    const navRoute = parseNavRoute(link.urlOrRoute);
    if (navRoute && onNavigate) {
      onNavigate(navRoute.section, navRoute.params);
    } else if (link.urlOrRoute.startsWith("http")) {
      window.open(link.urlOrRoute, "_blank");
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-inbox">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Inbox
      </Button>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold" data-testid="text-inbox-item-title">{item.title}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant={priorityColor(item.priority)}>{item.priority.toUpperCase()}</Badge>
              <Badge variant={statusColor(item.status)}>{formatType(item.status)}</Badge>
              <Badge variant="outline">{formatType(item.itemType)}</Badge>
              {item.triageCategory && item.triageCategory !== "notification" && (
                <Badge variant="secondary" className="text-[10px]">
                  {formatType(item.triageCategory)}
                </Badge>
              )}
              {confidenceBadge(item.confidence)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOpen && isTriageItem && (
              <>
                {getContextualActions(item.itemType).map(action => {
                  const ActionIcon = action.icon;
                  return (
                    <Button
                      key={action.key}
                      size="sm"
                      variant={action.variant || "default"}
                      disabled={approveMutation.isPending || dismissMutation.isPending || reprocessMutation.isPending}
                      onClick={() => handleContextualAction(action.key)}
                      data-testid={`button-action-${action.key}`}
                    >
                      <ActionIcon className="h-4 w-4 mr-1" /> {action.label}
                    </Button>
                  );
                })}
                {hasCaptureData && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reprocessMutation.mutate()}
                      disabled={reprocessMutation.isPending}
                      data-testid="button-reprocess-item"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Re-run
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ status: "in_progress", reason: "Editing item data" })}
                      data-testid="button-edit-item"
                    >
                      <FileText className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  </>
                )}
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => assignMeMutation.mutate()} data-testid="button-assign-me-detail">
              <UserCheck className="h-4 w-4 mr-1" /> Assign to me
            </Button>
            {isOpen && !isTriageItem && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateMutation.mutate({ status: "resolved" })}
                data-testid="button-resolve-item"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve
              </Button>
            )}
          </div>
        </div>

        {Object.keys(extractedData).length > 0 && (
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">Business / Contact Details</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
              {Object.entries(extractedData).slice(0, 9).map(([k, v]) => (
                <div key={k} className="text-sm">
                  <span className="text-muted-foreground text-xs">{formatType(k)}</span>
                  <p className="font-medium truncate">{String(v)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {item.itemType === "stock_photo_capture" && (() => {
          const meta = (item.triageMetadata || {}) as Record<string, unknown>;
          const photoUrls = Array.isArray(meta.photoUrls) ? (meta.photoUrls as string[]) : (typeof meta.photoUrl === "string" ? [meta.photoUrl] : []);
          if (photoUrls.length === 0) return null;
          const hubLabel = typeof meta.hubSlug === "string" ? meta.hubSlug : (typeof meta.hubId === "string" ? String(meta.hubId).substring(0, 8) : "");
          const notes = typeof meta.notes === "string" ? meta.notes : "";
          return (
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> {photoUrls.length} Captured Photo{photoUrls.length > 1 ? "s" : ""}
              </p>
              <div className="flex gap-2 flex-wrap">
                {photoUrls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`${item.title || "Stock photo"} ${idx + 1}`}
                    className="h-40 rounded-lg border object-cover"
                    data-testid={`img-stock-photo-inbox-${idx}`}
                  />
                ))}
              </div>
              {notes && (
                <p className="text-sm text-muted-foreground mt-2">{notes}</p>
              )}
              {hubLabel && (
                <Badge variant="outline" className="mt-2">
                  <MapPin className="h-3 w-3 mr-1" /> Hub: {hubLabel}
                </Badge>
              )}
            </div>
          );
        })()}

        {item.triageReason && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3" data-testid="triage-reason-box">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">Why this is here</p>
            <p className="text-sm">{item.triageReason}</p>
          </div>
        )}

        {item.suggestedAction && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3" data-testid="suggested-action-box">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-0.5">Charlotte suggests</p>
            <p className="text-sm">{formatAction(item.suggestedAction)}</p>
          </div>
        )}

        {item.summary && (
          <p className="text-muted-foreground" data-testid="text-inbox-summary">{item.summary}</p>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1">
            {item.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Created</Label>
            <p>{new Date(item.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Due</Label>
            <p className={item.dueAt && new Date(item.dueAt) < new Date() ? "text-destructive font-bold" : ""}>
              {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "Not set"}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Resolved</Label>
            <p>{item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : "--"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Visibility</Label>
            <p>{item.visibility.replace("_", " ")}</p>
          </div>
        </div>

        {links.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Related Links</Label>
            <div className="flex flex-wrap gap-2">
              {links.map(link => {
                const navRoute = parseNavRoute(link.urlOrRoute);
                if (navRoute && onNavigate) {
                  return (
                    <Button
                      key={link.id}
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleLinkClick(link)}
                      data-testid={`link-inbox-related-${link.id}`}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> {link.label}
                    </Button>
                  );
                }
                return (
                  <a
                    key={link.id}
                    href={link.urlOrRoute}
                    target={link.urlOrRoute.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="text-sm hover:underline flex items-center gap-1"
                    data-testid={`link-inbox-related-${link.id}`}
                  >
                    <ExternalLink className="h-3 w-3" /> {link.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end border-t pt-4">
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={editStatus || item.status}
              onValueChange={v => {
                setEditStatus(v);
                updateMutation.mutate({ status: v });
              }}
            >
              <SelectTrigger className="w-auto min-w-[110px]" data-testid="select-edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{formatType(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select
              value={editPriority || item.priority}
              onValueChange={v => {
                setEditPriority(v);
                updateMutation.mutate({ priority: v });
              }}
            >
              <SelectTrigger className="w-auto min-w-[90px]" data-testid="select-edit-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Due Date</Label>
            <div className="flex gap-1">
              <Input
                type="date"
                value={editDueAt || (item.dueAt ? item.dueAt.slice(0, 10) : "")}
                onChange={e => setEditDueAt(e.target.value)}
                className="w-auto min-w-[140px]"
                data-testid="input-edit-due-date"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (editDueAt) updateMutation.mutate({ dueAt: editDueAt });
                }}
                data-testid="button-save-due-date"
              >
                Set
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {hasMatchCandidates && isOpen && (
        <EntityResolutionPanel item={item} onResolved={onBack} />
      )}

      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments" data-testid="tab-comments">
            <MessageSquare className="h-4 w-4 mr-1" /> Comments ({comments.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-1" /> History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="space-y-3">
          <div className="space-y-2">
            {comments.length === 0 && (
              <p className="text-muted-foreground text-sm py-4">No comments yet.</p>
            )}
            {comments.map(c => (
              <Card key={c.id} className="p-3" data-testid={`card-comment-${c.id}`}>
                <div className="flex justify-between items-start">
                  <p className="text-sm whitespace-pre-wrap">{c.commentText}</p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[60px]"
              data-testid="textarea-new-comment"
            />
            <Button
              onClick={() => commentMutation.mutate()}
              disabled={!newComment.trim() || commentMutation.isPending}
              className="self-end"
              data-testid="button-add-comment"
            >
              <MessageSquare className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {history.length === 0 && (
            <p className="text-muted-foreground text-sm py-4">No history entries.</p>
          )}
          {history.map(h => (
            <Card key={h.id} className="p-3" data-testid={`card-history-${h.id}`}>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-[10px]">{h.actorType}</Badge>
                <span className="font-medium">{h.fieldName}</span>
                {h.oldValue && (
                  <>
                    <span className="text-muted-foreground line-through">{h.oldValue}</span>
                    <span className="text-muted-foreground">&rarr;</span>
                  </>
                )}
                <span className="font-medium">{h.newValue}</span>
                <span className="ml-auto text-xs text-muted-foreground">{timeAgo(h.createdAt)}</span>
              </div>
              {h.reason && <p className="text-xs text-muted-foreground mt-1">{h.reason}</p>}
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {item.relatedId && (
        <SendVerificationDialog
          open={showSendDialog}
          onOpenChange={setShowSendDialog}
          businessId={item.relatedId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
            updateMutation.mutate({ status: "waiting" });
          }}
        />
      )}
    </div>
  );
}

export default function InboxPanel({
  cityId,
  onNavigate,
  returnToItem,
  onClearReturnContext,
}: {
  cityId?: string;
  onNavigate?: (section: string, returnContext?: { itemId: string }, routeParams?: Record<string, string>) => void;
  returnToItem?: string;
  onClearReturnContext?: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState<UnifiedInboxItem | null>(null);
  const [returnItemId, setReturnItemId] = useState<string | null>(returnToItem || null);

  useEffect(() => {
    if (returnToItem) {
      setReturnItemId(returnToItem);
      onClearReturnContext?.();
    }
  }, [returnToItem, onClearReturnContext]);

  const { data: returnData } = useQuery<UnifiedResponse>({
    queryKey: ["/api/admin/inbox/unified", "__return__", returnItemId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/inbox/unified`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!returnItemId && !selectedItem,
  });

  useEffect(() => {
    if (returnItemId && returnData && !selectedItem) {
      const found = returnData.items.find(i => i.id === returnItemId);
      if (found) {
        setSelectedItem(found);
        setReturnItemId(null);
      } else {
        setReturnItemId(null);
      }
    }
  }, [returnItemId, returnData, selectedItem]);

  const handleNavigateWithContext = useCallback((section: string, routeParams?: Record<string, string>) => {
    if (onNavigate && selectedItem) {
      onNavigate(section, { itemId: selectedItem.id }, routeParams);
    } else if (onNavigate) {
      onNavigate(section, undefined, routeParams);
    }
  }, [onNavigate, selectedItem]);

  if (selectedItem) {
    return (
      <UnifiedDetailView
        unifiedItem={selectedItem}
        onBack={() => {
          setSelectedItem(null);
          queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/unified"] });
        }}
        onNavigate={handleNavigateWithContext}
      />
    );
  }

  return (
    <UnifiedInboxList
      onSelect={setSelectedItem}
      cityId={cityId}
      onNavigate={onNavigate ? (section: string, params?: Record<string, string>) => onNavigate(section, undefined, params) : undefined}
    />
  );
}
