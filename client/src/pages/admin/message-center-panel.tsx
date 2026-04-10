import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Inbox, FileText, Send, MessageCircle, Bell, ShieldOff,
  Search, Plus, Loader2, Trash2, Edit, Mail, Tv, Megaphone, Filter, CalendarDays,
} from "lucide-react";
import EmailTemplatesPanel from "./email-templates-panel";
import EmailCampaignsPanel from "./email-campaigns-panel";
import SmsConversationsPanel from "./sms-conversations-panel";
import WeeklyDigestPanel from "./weekly-digest-panel";
import EmailSuppressionPanel from "./email-suppression-panel";

interface PlatformMessage {
  id: string;
  city_id: string | null;
  source_engine: string;
  channel: string;
  status: string;
  recipient_address: string | null;
  recipient_name: string | null;
  subject: string | null;
  body_preview: string | null;
  template_id: string | null;
  campaign_id: string | null;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
}

interface PlatformTemplate {
  id: string;
  city_id: string | null;
  name: string;
  engine_tag: string;
  channel: string;
  subject_template: string | null;
  body_template: string | null;
  variables: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

interface MessageStats {
  total: number;
  byEngine: { source_engine: string; count: string }[];
  byChannel: { channel: string; count: string }[];
  byStatus: { status: string; count: string }[];
}

const ENGINE_LABELS: Record<string, string> = {
  crown: "Crown",
  outreach: "Outreach",
  events: "Events",
  digest: "Digest",
  crm: "CRM",
  general: "General",
  sms: "SMS",
  venue_tv: "Venue TV",
  pulse: "Pulse",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  pulse_draft: "Pulse Draft",
  venue_tv: "Venue TV",
  print: "Print",
  in_app: "In-App",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  bounced: "Bounced",
  canceled: "Canceled",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "sent" || status === "delivered") return "default";
  if (status === "failed" || status === "bounced") return "destructive";
  if (status === "draft" || status === "queued") return "secondary";
  return "outline";
}

function channelIcon(channel: string) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5" />;
  if (channel === "sms") return <MessageCircle className="h-3.5 w-3.5" />;
  if (channel === "venue_tv") return <Tv className="h-3.5 w-3.5" />;
  if (channel === "pulse_draft") return <Megaphone className="h-3.5 w-3.5" />;
  return <Send className="h-3.5 w-3.5" />;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

interface MessageCenterProps {
  cityId?: string;
}

function AllMessagesTab({ cityId }: { cityId?: string }) {
  const [engineFilter, setEngineFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;

  const queryParams = new URLSearchParams();
  if (cityId) queryParams.set("cityId", cityId);
  if (engineFilter !== "all") queryParams.set("engine", engineFilter);
  if (channelFilter !== "all") queryParams.set("channel", channelFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (searchQuery) queryParams.set("search", searchQuery);
  if (fromDate) queryParams.set("fromDate", new Date(fromDate).toISOString());
  if (toDate) queryParams.set("toDate", new Date(toDate + "T23:59:59").toISOString());
  queryParams.set("limit", String(limit));
  queryParams.set("offset", String(page * limit));

  const { data, isLoading } = useQuery<{ messages: PlatformMessage[]; total: number }>({
    queryKey: ["/api/admin/message-center/messages", cityId, engineFilter, channelFilter, statusFilter, searchQuery, fromDate, toDate, page],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/message-center/messages?${queryParams}`);
      if (!resp.ok) throw new Error("Failed to load messages");
      return resp.json();
    },
  });

  const { data: stats } = useQuery<MessageStats>({
    queryKey: ["/api/admin/message-center/stats", cityId],
    queryFn: async () => {
      const params = cityId ? `?cityId=${cityId}` : "";
      const resp = await fetch(`/api/admin/message-center/stats${params}`);
      if (!resp.ok) throw new Error("Failed to load stats");
      return resp.json();
    },
  });

  const messages = data?.messages || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3" data-testid="stat-total-messages">
          <p className="text-xs text-muted-foreground">Total Messages</p>
          <p className="text-xl font-bold">{stats?.total ?? 0}</p>
        </Card>
        {stats?.byChannel?.slice(0, 3).map(ch => (
          <Card key={ch.channel} className="p-3" data-testid={`stat-channel-${ch.channel}`}>
            <div className="flex items-center gap-1.5">
              {channelIcon(ch.channel)}
              <p className="text-xs text-muted-foreground">{CHANNEL_LABELS[ch.channel] || ch.channel}</p>
            </div>
            <p className="text-xl font-bold">{ch.count}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="pl-9"
            data-testid="input-search-messages"
          />
        </div>
        <Select value={engineFilter} onValueChange={(v) => { setEngineFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36" data-testid="select-engine-filter">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Engine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engines</SelectItem>
            {Object.entries(ENGINE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36" data-testid="select-channel-filter">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
            className="w-36"
            data-testid="input-from-date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(0); }}
            className="w-36"
            data-testid="input-to-date"
          />
          {(fromDate || toDate) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setFromDate(""); setToDate(""); setPage(0); }}
              data-testid="button-clear-dates"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : messages.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-messages">
          <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">No messages found</p>
          <p className="text-xs text-muted-foreground mt-1">Messages from all engines will appear here once sent</p>
        </Card>
      ) : (
        <div className="border rounded-md divide-y">
          {messages.map(msg => (
            <div key={msg.id} className="p-3 flex items-center gap-3" data-testid={`row-message-${msg.id}`}>
              <div className="flex-shrink-0 h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                {channelIcon(msg.channel)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{msg.subject || "(No subject)"}</p>
                  <Badge variant="outline" className="text-[10px]">{ENGINE_LABELS[msg.source_engine] || msg.source_engine}</Badge>
                  <Badge variant={statusVariant(msg.status)} className="text-[10px]">{STATUS_LABELS[msg.status] || msg.status}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {msg.recipient_name || msg.recipient_address || "No recipient"}
                  </p>
                  <span className="text-xs text-muted-foreground">{formatDate(msg.sent_at || msg.created_at)}</span>
                </div>
                {msg.body_preview && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{msg.body_preview}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">{total} messages total</p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <span className="text-xs px-2">{page + 1} / {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplatesTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<PlatformTemplate | null>(null);
  const [engineFilter, setEngineFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const queryParams = new URLSearchParams();
  if (cityId) queryParams.set("cityId", cityId);
  if (engineFilter !== "all") queryParams.set("engine", engineFilter);
  if (channelFilter !== "all") queryParams.set("channel", channelFilter);

  const { data: templates = [], isLoading } = useQuery<PlatformTemplate[]>({
    queryKey: ["/api/admin/message-center/templates", cityId, engineFilter, channelFilter],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/message-center/templates?${queryParams}`);
      if (!resp.ok) throw new Error("Failed to load templates");
      return resp.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/message-center/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/message-center/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={engineFilter} onValueChange={setEngineFilter}>
            <SelectTrigger className="w-36" data-testid="select-tpl-engine">
              <SelectValue placeholder="Engine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Engines</SelectItem>
              {Object.entries(ENGINE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-36" data-testid="select-tpl-channel">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-template">
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-templates">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">No templates yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create reusable message templates for any engine and channel</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(tpl => (
            <Card key={tpl.id} className="p-4" data-testid={`card-template-${tpl.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tpl.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[10px]">{ENGINE_LABELS[tpl.engine_tag] || tpl.engine_tag}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{CHANNEL_LABELS[tpl.channel] || tpl.channel}</Badge>
                    <Badge
                      variant={tpl.status === "active" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {tpl.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditTemplate(tpl)}
                    data-testid={`button-edit-template-${tpl.id}`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(tpl.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-template-${tpl.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {tpl.subject_template && (
                <p className="text-xs text-muted-foreground mt-2 truncate">Subject: {tpl.subject_template}</p>
              )}
              {tpl.variables && tpl.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tpl.variables.map((v: string) => (
                    <Badge key={v} variant="outline" className="text-[9px] font-mono">{`{{${v}}}`}</Badge>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">{formatDate(tpl.updated_at)}</p>
            </Card>
          ))}
        </div>
      )}

      {(showCreate || editTemplate) && (
        <TemplateDialog
          template={editTemplate}
          cityId={cityId}
          onClose={() => { setShowCreate(false); setEditTemplate(null); }}
        />
      )}
    </div>
  );
}

function TemplateDialog({ template, cityId, onClose }: { template: PlatformTemplate | null; cityId?: string; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!template;
  const [name, setName] = useState(template?.name || "");
  const [engineTag, setEngineTag] = useState(template?.engine_tag || "general");
  const [channel, setChannel] = useState(template?.channel || "email");
  const [subjectTemplate, setSubjectTemplate] = useState(template?.subject_template || "");
  const [bodyTemplate, setBodyTemplate] = useState(template?.body_template || "");
  const [variablesText, setVariablesText] = useState((template?.variables || []).join(", "));
  const [status, setStatus] = useState(template?.status || "draft");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const vars = variablesText.split(",").map(v => v.trim()).filter(Boolean);
      const payload = { cityId, name, engineTag, channel, subjectTemplate, bodyTemplate, variables: vars, status };
      if (isEdit) {
        await apiRequest("PATCH", `/api/admin/message-center/templates/${template!.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/message-center/templates", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/message-center/templates"] });
      toast({ title: isEdit ? "Template updated" : "Template created" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-template">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-template-name"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={engineTag} onValueChange={setEngineTag}>
              <SelectTrigger data-testid="select-template-engine">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ENGINE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger data-testid="select-template-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Subject template"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            data-testid="input-template-subject"
          />
          <Textarea
            placeholder="Body template (supports {{variables}})"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={6}
            data-testid="input-template-body"
          />
          <Input
            placeholder="Variables (comma-separated, e.g. hub_name, business_name)"
            value={variablesText}
            onChange={(e) => setVariablesText(e.target.value)}
            data-testid="input-template-variables"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-template-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-template">Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name || saveMutation.isPending}
            data-testid="button-save-template"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {isEdit ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MessageCenterPanel({ cityId }: MessageCenterProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-message-center-title">
          Message Center
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="text-message-center-subtitle">
          Unified view of all messages, templates, and communications across every engine
        </p>
      </div>

      <Tabs defaultValue="all-messages" data-testid="tabs-message-center">
        <TabsList className="flex-wrap h-auto gap-1" data-testid="tabs-list-message-center">
          <TabsTrigger value="all-messages" data-testid="tab-trigger-all-messages">
            <Inbox className="h-4 w-4 mr-1.5" />
            All Messages
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-trigger-msg-templates">
            <FileText className="h-4 w-4 mr-1.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="email-templates" data-testid="tab-trigger-email-templates">
            <Mail className="h-4 w-4 mr-1.5" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-trigger-msg-campaigns">
            <Send className="h-4 w-4 mr-1.5" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="sms" data-testid="tab-trigger-msg-sms">
            <MessageCircle className="h-4 w-4 mr-1.5" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="digest" data-testid="tab-trigger-msg-digest">
            <Bell className="h-4 w-4 mr-1.5" />
            Digest
          </TabsTrigger>
          <TabsTrigger value="suppression" data-testid="tab-trigger-msg-suppression">
            <ShieldOff className="h-4 w-4 mr-1.5" />
            Suppression
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-messages" data-testid="tab-content-all-messages">
          <AllMessagesTab cityId={cityId} />
        </TabsContent>
        <TabsContent value="templates" data-testid="tab-content-msg-templates">
          <TemplatesTab cityId={cityId} />
        </TabsContent>
        <TabsContent value="email-templates" data-testid="tab-content-email-templates">
          <EmailTemplatesPanel />
        </TabsContent>
        <TabsContent value="campaigns" data-testid="tab-content-msg-campaigns">
          <EmailCampaignsPanel />
        </TabsContent>
        <TabsContent value="sms" data-testid="tab-content-msg-sms">
          <SmsConversationsPanel cityId={cityId} />
        </TabsContent>
        <TabsContent value="digest" data-testid="tab-content-msg-digest">
          <WeeklyDigestPanel />
        </TabsContent>
        <TabsContent value="suppression" data-testid="tab-content-msg-suppression">
          <EmailSuppressionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
