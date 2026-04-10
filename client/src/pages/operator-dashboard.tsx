import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useOperator } from "@/hooks/use-operator";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import {
  MapPin, Building2, Users, TrendingUp, LayoutDashboard, LogOut, Loader2,
  Globe, FileText, BarChart3, Menu, DollarSign, Clock, CheckCircle, Search,
  Download, MapPinned, AlertCircle, ChevronDown, ChevronUp, Phone, Mail,
  Eye, StickyNote, Plus, Send, MailPlus, History, Link2, Target, FileQuestion,
  Footprints, MessageSquare, Megaphone, MousePointer, Wrench, Factory, UtensilsCrossed,
  ShoppingBag, Briefcase, HardHat, Calendar, Radio, PieChart, Newspaper, ImageIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface HubInfo {
  territoryId: string;
  territoryName: string;
  territoryCode: string | null;
  regionId: string | null;
  regionName: string;
  businessCount: number;
}

const sidebarGroups = {
  dashboard: { label: "Dashboard", items: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "analytics", label: "Hub Analytics", icon: PieChart },
  ]},
  businesses: { label: "Businesses", items: [
    { id: "businesses", label: "My Businesses", icon: Building2 },
    { id: "biz-stats", label: "Business Stats", icon: BarChart3 },
    { id: "targeting", label: "Prospect Targeting", icon: BarChart3 },
    { id: "sales-pipeline", label: "Sales Pipeline", icon: Target },
  ]},
  content: { label: "Content", items: [
    { id: "hub-events", label: "Events", icon: Calendar },
    { id: "hub-articles", label: "Pulse Articles", icon: Newspaper },
  ]},
  adsRevenue: { label: "Ads & Revenue", items: [
    { id: "hub-ads", label: "Ad Overview", icon: Megaphone },
    { id: "revenue", label: "My Revenue", icon: TrendingUp },
  ]},
  fieldTools: { label: "Field Tools", items: [
    { id: "comms", label: "Communications", icon: Send },
  ]},
  settings: { label: "Settings", items: [
    { id: "territory", label: "Territory Overview", icon: MapPin },
  ]},
};

const metroOnlyItems = [
  { id: "micro-operators", label: "My Micro Operators", icon: Users, group: "dashboard" },
  { id: "places-import", label: "Places Import", icon: Download, group: "fieldTools" },
];

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function OperatorSidebar({ operator, activeSection, onNavigate, onLogout, hubs, selectedHub, onHubChange }: {
  operator: any; activeSection: string; onNavigate: (id: string) => void; onLogout: () => void;
  hubs: HubInfo[]; selectedHub: string; onHubChange: (val: string) => void;
}) {
  const isMetro = operator.operatorType === "METRO";
  const groupOrder = ["dashboard", "businesses", "content", "adsRevenue", "fieldTools", "settings"] as const;

  const buildGroups = () => {
    const groups = JSON.parse(JSON.stringify(sidebarGroups)) as typeof sidebarGroups;
    if (isMetro) {
      for (const item of metroOnlyItems) {
        const g = groups[item.group as keyof typeof groups];
        if (g) g.items.push({ id: item.id, label: item.label, icon: item.icon } as any);
      }
    }
    return groups;
  };
  const groups = buildGroups();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary shrink-0">
            <MapPin className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm block truncate">{operator.displayName}</span>
            <Badge variant="outline" className="text-[10px]">{isMetro ? "Metro" : "Micro"} Operator</Badge>
          </div>
        </div>
        {hubs.length > 1 ? (
          <div className="mt-2">
            <Select value={selectedHub} onValueChange={onHubChange}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-hub-switcher">
                <SelectValue placeholder="Select Hub" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All My Hubs ({hubs.reduce((s, h) => s + h.businessCount, 0)} businesses)</SelectItem>
                {hubs.map(h => (
                  <SelectItem key={h.territoryId} value={h.territoryId}>
                    {h.regionName} ({h.businessCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : hubs.length === 1 ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            <span className="font-medium">{hubs[0].regionName}</span>
            <Badge variant="outline" className="text-[9px] ml-auto">{hubs[0].businessCount} biz</Badge>
          </div>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        {groupOrder.map(key => {
          const group = groups[key];
          const iconMap: Record<string, any> = {};
          for (const item of [...sidebarGroups[key].items, ...(isMetro ? metroOnlyItems.filter(m => m.group === key) : [])]) {
            iconMap[item.id] = item.icon;
          }
          return (
            <SidebarGroup key={key}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item: any) => {
                    const Icon = iconMap[item.id] || Globe;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activeSection === item.id}
                          onClick={() => onNavigate(item.id)}
                          data-testid={`nav-operator-${item.id}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{operator.email}</p>
            <Badge variant={operator.status === "ACTIVE" ? "default" : "secondary"} className="text-[9px] mt-0.5">
              {operator.status}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-operator-logout" className="shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function OverviewSection({ operator }: { operator: any }) {
  const { data: businessesResponse } = useQuery<any>({ queryKey: ["/api/operator/businesses"] });
  const { data: revenueData } = useQuery<any>({ queryKey: ["/api/operator/revenue"] });

  const businessesData: any[] = Array.isArray(businessesResponse) ? businessesResponse : (businessesResponse?.data ?? []);
  const assignedCount: number = businessesResponse?.assignedCount ?? 0;
  const territoryNames = operator.territories?.map((t: any) => t.territory?.name).filter(Boolean).join(", ") || "None assigned";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-operator-welcome">Welcome, {operator.displayName}</h2>
        <p className="text-muted-foreground">
          {operator.operatorType === "METRO" ? "Metro" : "Micro"} operator dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Businesses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-business-count">
              {businessesResponse ? businessesData.length : <Skeleton className="h-8 w-12 inline-block" />}
            </p>
            <p className="text-xs text-muted-foreground mt-1">In your territories</p>
          </CardContent>
        </Card>
        {assignedCount > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" /> Sales Ready
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-sales-ready-count">{assignedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Leads ready to work</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-total-revenue">
              {revenueData ? formatCents(revenueData.totalEarned) : <Skeleton className="h-8 w-20 inline-block" />}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All time earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Territories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-territory-count">{operator.territories?.length || 0}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{territoryNames}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={operator.status === "ACTIVE" ? "default" : "secondary"} className="text-base" data-testid="badge-operator-status">
              {operator.status}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              <Badge variant="outline" className="text-[10px]">{operator.operatorType}</Badge>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {revenueData && (revenueData.pending > 0 || revenueData.payable > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Revenue Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>
                  <span className="font-medium">{formatCents(revenueData.pending)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Payable</span>
                  <span className="font-medium">{formatCents(revenueData.payable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Paid</span>
                  <span className="font-medium">{formatCents(revenueData.paid)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {operator.operatorType === "METRO" && (
              <div className="flex items-start gap-3 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80" data-testid="link-business-pipeline">
                <Building2 className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Business Pipeline</p>
                  <p className="text-xs text-muted-foreground">Manage businesses in your territory</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80" data-testid="link-revenue">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Revenue Tracking</p>
                <p className="text-xs text-muted-foreground">View your earnings and payout history</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const CRM_STAGES = [
  { value: "intake", label: "Intake" },
  { value: "assigned", label: "Assigned" },
  { value: "contacted", label: "Contacted" },
  { value: "engaged", label: "Engaged" },
  { value: "awaiting_info", label: "Awaiting Info" },
  { value: "claimed_confirmed", label: "Claim Confirmed" },
  { value: "charlotte_verified", label: "Charlotte Verified" },
  { value: "offer_presented", label: "Offer Presented" },
  { value: "active", label: "Active" },
  { value: "renewal_due", label: "Renewal Due" },
  { value: "closed_lost", label: "Closed/Lost" },
] as const;

const STAGE_COLORS: Record<string, string> = {
  intake: "outline",
  assigned: "outline",
  contacted: "secondary",
  engaged: "secondary",
  awaiting_info: "secondary",
  claimed_confirmed: "default",
  charlotte_verified: "default",
  offer_presented: "default",
  active: "default",
  renewal_due: "secondary",
  closed_lost: "outline",
};

const ACTIVITY_TYPE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  visit: Eye,
  note: StickyNote,
};

function StageBadge({ stage }: { stage: string | null }) {
  const stageLabel = CRM_STAGES.find(s => s.value === stage)?.label || stage || "No Stage";
  const variant = (stage ? STAGE_COLORS[stage] : "outline") || "outline";
  return (
    <Badge variant={variant as any} className="text-[10px]" data-testid={`badge-stage-${stage || "none"}`}>
      {stageLabel}
    </Badge>
  );
}

function DailySendIndicator() {
  const { data: dailyCount } = useQuery<any>({
    queryKey: ["/api/operator/outreach/daily-count"],
  });

  if (!dailyCount) return null;

  const { dailySent, dailyLimit, remaining } = dailyCount;
  return (
    <div className="flex items-center gap-2" data-testid="indicator-daily-sends">
      <MailPlus className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {dailySent}/{dailyLimit} emails today
      </span>
      <Badge variant={remaining > 0 ? "outline" : "destructive"} className="text-[10px]" data-testid="badge-daily-remaining">
        {remaining} remaining
      </Badge>
    </div>
  );
}

function OutreachDialog({ business, open, onOpenChange }: { business: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState("none");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState(business.ownerEmail || "");

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/operator/outreach/templates"],
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setRecipientEmail(business.ownerEmail || "");
      setSubject("");
      setBody("");
      setSelectedTemplateId("none");
    }
  }, [open, business.ownerEmail]);

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    if (templateId === "none") return;
    const tmpl = templates.find((t: any) => t.id === templateId);
    if (tmpl) {
      setSubject(tmpl.subject || "");
      setBody(tmpl.bodyHtml || tmpl.body || "");
    }
  }

  const mergeTags = [
    { tag: "{{businessName}}", label: "Business Name" },
    { tag: "{{businessAddress}}", label: "Address" },
    { tag: "{{businessPhone}}", label: "Phone" },
    { tag: "{{businessEmail}}", label: "Email" },
  ];

  function insertMergeTag(tag: string) {
    setBody(prev => prev + " " + tag);
  }

  const previewBody = body
    .replace(/\{\{businessName\}\}/g, business.name || "")
    .replace(/\{\{businessAddress\}\}/g, business.address || "")
    .replace(/\{\{businessPhone\}\}/g, business.phone || "")
    .replace(/\{\{businessEmail\}\}/g, business.ownerEmail || "");

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/operator/outreach/send", {
        businessId: business.id,
        templateId: selectedTemplateId !== "none" ? selectedTemplateId : undefined,
        subject,
        body,
        recipientEmail,
      });
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: `Outreach email sent to ${recipientEmail}` });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/operator/outreach/daily-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operator/comms-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operator/outreach/history", business.id] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Outreach Email</DialogTitle>
          <DialogDescription>
            Compose an email to {business.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <DailySendIndicator />

          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger data-testid="select-outreach-template">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template (blank)</SelectItem>
                {templates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name || t.templateKey}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Recipient Email</Label>
            <Input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
              type="email"
              data-testid="input-outreach-email"
            />
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              data-testid="input-outreach-subject"
            />
          </div>

          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email body..."
              className="min-h-[120px]"
              data-testid="input-outreach-body"
            />
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Merge tags:</span>
              {mergeTags.map((mt) => (
                <Badge
                  key={mt.tag}
                  variant="outline"
                  className="text-[10px] cursor-pointer"
                  onClick={() => insertMergeTag(mt.tag)}
                  data-testid={`badge-merge-tag-${mt.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {mt.label}
                </Badge>
              ))}
            </div>
          </div>

          {previewBody && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Preview</Label>
              <div className="text-sm p-3 border rounded-md bg-muted/50 whitespace-pre-wrap" data-testid="text-outreach-preview">
                {previewBody}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-outreach-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!subject.trim() || !body.trim() || !recipientEmail.trim() || sendMutation.isPending}
            data-testid="button-outreach-send"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {sendMutation.isPending ? "Sending..." : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutreachHistory({ businessId }: { businessId: string }) {
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/operator/outreach/history", businessId],
    queryFn: async () => {
      const params = new URLSearchParams({ channel: "EMAIL", limit: "20", offset: "0" });
      const res = await fetch(`/api/operator/comms-log?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch outreach history");
      const all = await res.json();
      return all.filter((entry: any) =>
        entry.metadata && typeof entry.metadata === "object" &&
        (entry.metadata as any).businessId === businessId &&
        (entry.metadata as any).type === "operator_outreach"
      );
    },
  });

  if (isLoading) return <Skeleton className="h-8 w-full" />;
  if (history.length === 0) return null;

  return (
    <div className="space-y-1 mt-3">
      <div className="flex items-center gap-1.5">
        <History className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Outreach History</span>
      </div>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {history.map((entry: any) => (
          <div key={entry.id} className="flex items-center justify-between py-1 text-xs border-b last:border-0" data-testid={`row-outreach-history-${entry.id}`}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">{entry.recipientEmail || "Unknown"}</span>
              {entry.subject && <span className="text-muted-foreground truncate">— {entry.subject}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={entry.status === "SENT" || entry.status === "DELIVERED" ? "default" : "secondary"} className="text-[9px]">
                {entry.status}
              </Badge>
              <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessDetailPanel({ business }: { business: any }) {
  const { toast } = useToast();
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [outreachOpen, setOutreachOpen] = useState(false);

  const { data: activityData, isLoading: activityLoading } = useQuery<any>({
    queryKey: ["/api/operator/businesses", business.id, "activity"],
  });

  const stageMutation = useMutation({
    mutationFn: async (stage: string) => {
      await apiRequest("PATCH", `/api/operator/businesses/${business.id}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator/businesses", business.id, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operator/businesses"] });
      toast({ title: "Stage updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update stage", description: err.message, variant: "destructive" });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/operator/businesses/${business.id}/notes`, {
        activityType: noteType,
        notes: noteText,
      });
    },
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["/api/operator/businesses", business.id, "activity"] });
      toast({ title: "Note added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add note", description: err.message, variant: "destructive" });
    },
  });

  const currentStage = activityData?.crm?.stage || null;
  const activities = activityData?.activities || [];
  const auditTrail = activityData?.auditTrail || [];

  const timeline = [
    ...activities.map((a: any) => ({ ...a, _type: "activity", _date: new Date(a.createdAt) })),
    ...auditTrail.map((a: any) => ({ ...a, _type: "audit", _date: new Date(a.changedAt) })),
  ].sort((a, b) => b._date.getTime() - a._date.getTime());

  return (
    <div className="mt-3 pt-3 border-t space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">CRM Stage:</span>
          <Select
            value={currentStage || "intake"}
            onValueChange={(val) => stageMutation.mutate(val)}
            disabled={stageMutation.isPending}
          >
            <SelectTrigger className="w-44" data-testid={`select-stage-${business.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRM_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {stageMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <StageBadge stage={currentStage} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOutreachOpen(true)}
          data-testid={`button-send-email-${business.id}`}
        >
          <MailPlus className="h-3.5 w-3.5 mr-1.5" />
          Send Email
        </Button>
      </div>

      <OutreachDialog business={business} open={outreachOpen} onOpenChange={setOutreachOpen} />

      <OutreachHistory businessId={business.id} />

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Add Note</span>
        <div className="flex items-start gap-2">
          <Select value={noteType} onValueChange={setNoteType}>
            <SelectTrigger className="w-28" data-testid={`select-note-type-${business.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="visit">Visit</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 min-h-[60px]"
            data-testid={`input-note-text-${business.id}`}
          />
          <Button
            size="icon"
            onClick={() => noteMutation.mutate()}
            disabled={!noteText.trim() || noteMutation.isPending}
            data-testid={`button-add-note-${business.id}`}
          >
            {noteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Activity Timeline</span>
        {activityLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No activity yet.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {timeline.map((item: any, idx: number) => {
              if (item._type === "activity") {
                const IconComp = ACTIVITY_TYPE_ICONS[item.activityType] || StickyNote;
                return (
                  <div key={`act-${item.id || idx}`} className="flex items-start gap-2 py-1.5 text-xs border-b last:border-0" data-testid={`row-timeline-activity-${item.id || idx}`}>
                    <IconComp className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">{item.activityType}</Badge>
                        <span className="text-muted-foreground">{item._date.toLocaleString()}</span>
                      </div>
                      <p className="mt-0.5 text-foreground">{item.notes}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={`aud-${item.id || idx}`} className="flex items-start gap-2 py-1.5 text-xs border-b last:border-0" data-testid={`row-timeline-audit-${item.id || idx}`}>
                  <Clock className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{item.fieldName}</span>
                      {item.oldValue && <span className="text-muted-foreground line-through">{item.oldValue}</span>}
                      {item.newValue && <span>{item.newValue}</span>}
                      <span className="text-muted-foreground">{item._date.toLocaleString()}</span>
                    </div>
                    {item.reason && <p className="mt-0.5 text-muted-foreground">{item.reason}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const BUCKET_LABELS: Record<string, string> = {
  TARGET: "Target",
  VERIFY_LATER: "Verify Later",
  CONTENT_SOURCE_ONLY: "Content Only",
  NEEDS_REVIEW: "Needs Review",
};

const BUCKET_VARIANTS: Record<string, string> = {
  TARGET: "default",
  VERIFY_LATER: "secondary",
  CONTENT_SOURCE_ONLY: "outline",
  NEEDS_REVIEW: "secondary",
};

const STRATEGY_CONFIG: Record<string, { label: string; icon: typeof Phone }> = {
  PHONE_FIRST: { label: "Phone First", icon: Phone },
  WALK_IN: { label: "Walk-In", icon: Footprints },
  MAILER: { label: "Mailer", icon: Mail },
  WEBSITE_FORM: { label: "Website Form", icon: MousePointer },
  SOCIAL_DM: { label: "Social DM", icon: MessageSquare },
  EMAIL: { label: "Email", icon: Mail },
  VERIFY_LATER: { label: "Verify Later", icon: FileQuestion },
  UNKNOWN: { label: "Unknown", icon: FileQuestion },
};

const LOCATION_TYPE_LABELS: Record<string, string> = {
  STOREFRONT: "Storefront",
  OFFICE: "Office",
  HOME_BASED: "Home-Based",
  VIRTUAL: "Virtual",
  UNKNOWN: "Unknown",
};

const LOCATION_TYPE_ICONS: Record<string, typeof Building2> = {
  STOREFRONT: Building2,
  OFFICE: Building2,
  HOME_BASED: MapPin,
  VIRTUAL: Globe,
  UNKNOWN: FileQuestion,
};

const INDUSTRY_TAG_LABELS: Record<string, string> = {
  MANUFACTURING: "Manufacturing",
  FABRICATION: "Fabrication",
  INDUSTRIAL_SUPPLY: "Industrial Supply",
  WHOLESALE_DISTRIBUTION: "Wholesale",
  WAREHOUSE_LOGISTICS: "Warehouse/Logistics",
  CONSTRUCTION_CONTRACTOR: "Construction",
  ROOFING_CONTRACTOR: "Roofing",
  HVAC_CONTRACTOR: "HVAC",
  PLUMBING_CONTRACTOR: "Plumbing",
  ELECTRICAL_CONTRACTOR: "Electrical",
  GENERAL_CONTRACTOR: "General Contractor",
  COMMERCIAL_BUILDOUT_SIGNAL: "Buildout Signal",
  INDUSTRIAL_CORRIDOR_LOCATION: "Industrial Corridor",
  FOOD_SERVICE: "Food Service",
  RETAIL_STOREFRONT: "Retail",
  PROFESSIONAL_SERVICES: "Professional",
  HEALTHCARE_MEDICAL: "Healthcare",
  AUTOMOTIVE_SERVICE: "Automotive",
  BEAUTY_PERSONAL_CARE: "Beauty/Personal Care",
  RELIGIOUS_NONPROFIT: "Religious/Nonprofit",
};

const INDUSTRY_FILTER_CATEGORIES: { value: string; label: string; tags: string[] }[] = [
  { value: "ALL", label: "All Industries", tags: [] },
  { value: "CONTRACTORS", label: "Contractors", tags: ["CONSTRUCTION_CONTRACTOR", "ROOFING_CONTRACTOR", "HVAC_CONTRACTOR", "PLUMBING_CONTRACTOR", "ELECTRICAL_CONTRACTOR", "GENERAL_CONTRACTOR"] },
  { value: "FOOD", label: "Food Service", tags: ["FOOD_SERVICE"] },
  { value: "RETAIL", label: "Retail", tags: ["RETAIL_STOREFRONT"] },
  { value: "PROFESSIONAL", label: "Professional Services", tags: ["PROFESSIONAL_SERVICES"] },
  { value: "HEALTHCARE", label: "Healthcare", tags: ["HEALTHCARE_MEDICAL"] },
  { value: "INDUSTRIAL", label: "Industrial/Wholesale", tags: ["MANUFACTURING", "FABRICATION", "INDUSTRIAL_SUPPLY", "WHOLESALE_DISTRIBUTION", "WAREHOUSE_LOGISTICS", "INDUSTRIAL_CORRIDOR_LOCATION", "COMMERCIAL_BUILDOUT_SIGNAL"] },
  { value: "AUTO", label: "Automotive", tags: ["AUTOMOTIVE_SERVICE"] },
  { value: "BEAUTY", label: "Beauty/Personal Care", tags: ["BEAUTY_PERSONAL_CARE"] },
  { value: "NONPROFIT", label: "Religious/Nonprofit", tags: ["RELIGIOUS_NONPROFIT"] },
];

const INDUSTRY_TAG_ICONS: Record<string, typeof Wrench> = {
  CONSTRUCTION_CONTRACTOR: HardHat,
  ROOFING_CONTRACTOR: HardHat,
  HVAC_CONTRACTOR: Wrench,
  PLUMBING_CONTRACTOR: Wrench,
  ELECTRICAL_CONTRACTOR: Wrench,
  GENERAL_CONTRACTOR: HardHat,
  MANUFACTURING: Factory,
  FABRICATION: Factory,
  INDUSTRIAL_SUPPLY: Factory,
  WHOLESALE_DISTRIBUTION: Factory,
  WAREHOUSE_LOGISTICS: Factory,
  FOOD_SERVICE: UtensilsCrossed,
  RETAIL_STOREFRONT: ShoppingBag,
  PROFESSIONAL_SERVICES: Briefcase,
  HEALTHCARE_MEDICAL: Briefcase,
  AUTOMOTIVE_SERVICE: Wrench,
  BEAUTY_PERSONAL_CARE: ShoppingBag,
  RELIGIOUS_NONPROFIT: Building2,
  COMMERCIAL_BUILDOUT_SIGNAL: Factory,
  INDUSTRIAL_CORRIDOR_LOCATION: Factory,
};

function IndustryTagBadge({ tag, confidence }: { tag: string; confidence: number }) {
  const Icon = INDUSTRY_TAG_ICONS[tag] || Wrench;
  const label = INDUSTRY_TAG_LABELS[tag] || tag;
  return (
    <Badge variant="outline" className="text-[10px]" data-testid={`badge-industry-${tag}`}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
      {confidence > 0 && <span className="ml-1 text-muted-foreground">({confidence})</span>}
    </Badge>
  );
}

function ScoreBar({ label, value, testId }: { label: string; value: number | null; testId: string }) {
  const score = value ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium" data-testid={testId}>{score}</span>
      </div>
      <Progress value={score} className="h-1.5" />
    </div>
  );
}

function TargetingSection() {
  const { data: rawResponse, isLoading } = useQuery<any>({
    queryKey: ["/api/operator/businesses/scored"],
  });
  const scoredBusinesses: any[] = Array.isArray(rawResponse) ? rawResponse : (rawResponse?.data ?? []);

  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState("TARGET");
  const [locationTypeFilter, setLocationTypeFilter] = useState("ALL");
  const [outreachMethodFilter, setOutreachMethodFilter] = useState("ALL");
  const [industryFilter, setIndustryFilter] = useState("ALL");
  const [excludeVirtual, setExcludeVirtual] = useState(false);
  const [hasPhoneFilter, setHasPhoneFilter] = useState(false);
  const [noWebsiteFilter, setNoWebsiteFilter] = useState(false);
  const [hasContactFormFilter, setHasContactFormFilter] = useState(false);
  const [contractorsNoWebsite, setContractorsNoWebsite] = useState(false);
  const [scoreThreshold, setScoreThreshold] = useState("0");

  const threshold = parseInt(scoreThreshold) || 0;

  const contractorTags = INDUSTRY_FILTER_CATEGORIES.find(c => c.value === "CONTRACTORS")?.tags || [];

  const filtered = scoredBusinesses.filter((b: any) => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (bucketFilter !== "ALL" && b.bucket !== bucketFilter) return false;
    if (locationTypeFilter !== "ALL" && b.locationType !== locationTypeFilter) return false;
    if (outreachMethodFilter !== "ALL" && b.outreachMethod !== outreachMethodFilter && b.recommendedContactStrategy !== outreachMethodFilter) return false;
    if (industryFilter !== "ALL") {
      const category = INDUSTRY_FILTER_CATEGORIES.find(c => c.value === industryFilter);
      if (category) {
        const bTags = (b.industryTags || []).map((t: any) => t.tag);
        if (!category.tags.some(ct => bTags.includes(ct))) return false;
      }
    }
    if (excludeVirtual && b.locationType === "VIRTUAL") return false;
    if (hasPhoneFilter && !b.hasPhone) return false;
    if (noWebsiteFilter && b.hasWebsite) return false;
    if (hasContactFormFilter && !b.hasContactForm) return false;
    if (contractorsNoWebsite) {
      const bTags = (b.industryTags || []).map((t: any) => t.tag);
      const isContractor = contractorTags.some(ct => bTags.includes(ct));
      if (!isContractor || b.hasWebsite) return false;
    }
    if (threshold > 0 && (b.prospectFitScore ?? 0) < threshold) return false;
    return true;
  });

  const bucketCounts = scoredBusinesses.reduce((acc: Record<string, number>, b: any) => {
    const bucket = b.bucket || "UNSCORED";
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-targeting-title">Prospect Targeting</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Scored business prospects in your territory. Read-only view.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total Scored</p>
            <p className="text-xl font-bold" data-testid="text-total-scored">{scoredBusinesses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Targets</p>
            <p className="text-xl font-bold" data-testid="text-target-count">{bucketCounts.TARGET || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Verify Later</p>
            <p className="text-xl font-bold" data-testid="text-verify-count">{bucketCounts.VERIFY_LATER || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Content Only</p>
            <p className="text-xl font-bold" data-testid="text-content-only-count">{bucketCounts.CONTENT_SOURCE_ONLY || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Needs Review</p>
            <p className="text-xl font-bold" data-testid="text-needs-review-count">{bucketCounts.NEEDS_REVIEW || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="pl-9"
            data-testid="input-search-scored"
          />
        </div>
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-bucket-filter">
            <SelectValue placeholder="Bucket" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Buckets</SelectItem>
            <SelectItem value="TARGET">Target</SelectItem>
            <SelectItem value="VERIFY_LATER">Verify Later</SelectItem>
            <SelectItem value="CONTENT_SOURCE_ONLY">Content Only</SelectItem>
            <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={locationTypeFilter} onValueChange={setLocationTypeFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-location-type-filter">
            <SelectValue placeholder="Location Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="STOREFRONT">Storefront</SelectItem>
            <SelectItem value="OFFICE">Office</SelectItem>
            <SelectItem value="HOME_BASED">Home-Based</SelectItem>
            <SelectItem value="VIRTUAL">Virtual</SelectItem>
            <SelectItem value="UNKNOWN">Unknown</SelectItem>
          </SelectContent>
        </Select>
        <Select value={outreachMethodFilter} onValueChange={setOutreachMethodFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-outreach-method-filter">
            <SelectValue placeholder="Outreach Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Methods</SelectItem>
            <SelectItem value="WALK_IN">Walk-In</SelectItem>
            <SelectItem value="MAILER">Mailer</SelectItem>
            <SelectItem value="PHONE_FIRST">Phone First</SelectItem>
            <SelectItem value="WEBSITE_FORM">Website Form</SelectItem>
            <SelectItem value="SOCIAL_DM">Social DM</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
          </SelectContent>
        </Select>
        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger className="w-[170px]" data-testid="select-industry-filter">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRY_FILTER_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scoreThreshold} onValueChange={setScoreThreshold}>
          <SelectTrigger className="w-[140px]" data-testid="select-score-threshold">
            <SelectValue placeholder="Min Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">No minimum</SelectItem>
            <SelectItem value="30">Score 30+</SelectItem>
            <SelectItem value="50">Score 50+</SelectItem>
            <SelectItem value="70">Score 70+</SelectItem>
            <SelectItem value="90">Score 90+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={contractorsNoWebsite ? "default" : "outline"}
          size="sm"
          onClick={() => setContractorsNoWebsite(!contractorsNoWebsite)}
          data-testid="button-filter-contractors-no-website"
          className="toggle-elevate"
        >
          <HardHat className="h-3 w-3 mr-1" />
          Contractors w/o Website
        </Button>
        <Button
          variant={excludeVirtual ? "default" : "outline"}
          size="sm"
          onClick={() => setExcludeVirtual(!excludeVirtual)}
          data-testid="button-filter-exclude-virtual"
          className="toggle-elevate"
        >
          <Globe className="h-3 w-3 mr-1" />
          Exclude Virtual
        </Button>
        <Button
          variant={hasPhoneFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setHasPhoneFilter(!hasPhoneFilter)}
          data-testid="button-filter-has-phone"
          className="toggle-elevate"
        >
          <Phone className="h-3 w-3 mr-1" />
          Has Phone
        </Button>
        <Button
          variant={noWebsiteFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setNoWebsiteFilter(!noWebsiteFilter)}
          data-testid="button-filter-no-website"
          className="toggle-elevate"
        >
          <Globe className="h-3 w-3 mr-1" />
          No Website
        </Button>
        <Button
          variant={hasContactFormFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setHasContactFormFilter(!hasContactFormFilter)}
          data-testid="button-filter-has-form"
          className="toggle-elevate"
        >
          <FileText className="h-3 w-3 mr-1" />
          Has Contact Form
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>{search || bucketFilter !== "ALL" || locationTypeFilter !== "ALL" || outreachMethodFilter !== "ALL" || industryFilter !== "ALL" || excludeVirtual || hasPhoneFilter || noWebsiteFilter || hasContactFormFilter || contractorsNoWebsite
              ? "No businesses match your filters."
              : "No scored businesses yet. Scoring runs after crawl jobs complete."
            }</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
          {filtered.map((b: any) => {
            const strategyInfo = STRATEGY_CONFIG[b.recommendedContactStrategy] || STRATEGY_CONFIG.VERIFY_LATER;
            const StrategyIcon = strategyInfo.icon;
            const LocationIcon = b.locationType ? (LOCATION_TYPE_ICONS[b.locationType] || FileQuestion) : null;
            return (
              <Card key={b.id} data-testid={`card-scored-business-${b.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm" data-testid={`text-scored-name-${b.id}`}>{b.name}</p>
                        {b.bucket && (
                          <Badge
                            variant={(BUCKET_VARIANTS[b.bucket] || "outline") as any}
                            className="text-[10px]"
                            data-testid={`badge-bucket-${b.id}`}
                          >
                            {BUCKET_LABELS[b.bucket] || b.bucket}
                          </Badge>
                        )}
                        {b.locationType && b.locationType !== "UNKNOWN" && LocationIcon && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            data-testid={`badge-location-type-${b.id}`}
                          >
                            <LocationIcon className="h-3 w-3 mr-1" />
                            {LOCATION_TYPE_LABELS[b.locationType] || b.locationType}
                          </Badge>
                        )}
                        {b.industryTags && b.industryTags.length > 0 && b.industryTags.map((t: any) => (
                          <IndustryTagBadge key={t.tag} tag={t.tag} confidence={t.confidence} />
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {b.territoryName && <span>{b.territoryName}</span>}
                        {b.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{b.address}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {b.hasPhone && (
                          <span className="flex items-center gap-1 text-xs" data-testid={`flag-phone-${b.id}`}>
                            <Phone className="h-3 w-3 text-green-600" />
                            <span className="text-muted-foreground">{b.phone || b.detectedPhone}</span>
                          </span>
                        )}
                        {b.hasEmail && (
                          <span className="flex items-center gap-1 text-xs" data-testid={`flag-email-${b.id}`}>
                            <Mail className="h-3 w-3 text-blue-600" />
                            <span className="text-muted-foreground">{b.ownerEmail || b.detectedEmail}</span>
                          </span>
                        )}
                        {b.hasContactForm && (
                          <span className="flex items-center gap-1 text-xs" data-testid={`flag-form-${b.id}`}>
                            <FileText className="h-3 w-3 text-purple-600" />
                            <span className="text-muted-foreground">Contact Form</span>
                          </span>
                        )}
                        {b.hasWebsite && (
                          <span className="flex items-center gap-1 text-xs" data-testid={`flag-website-${b.id}`}>
                            <Globe className="h-3 w-3 text-muted-foreground" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 w-[180px] space-y-2">
                      <ScoreBar label="Prospect Fit" value={b.prospectFitScore} testId={`score-prospect-${b.id}`} />
                      <ScoreBar label="Contact Ready" value={b.contactReadyScore} testId={`score-contact-${b.id}`} />
                      <div className="flex items-center gap-1.5 mt-1">
                        <StrategyIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground" data-testid={`text-strategy-${b.id}`}>
                          {strategyInfo.label}
                        </span>
                      </div>
                      {b.outreachMethod && b.outreachMethod !== "UNKNOWN" && b.outreachMethod !== b.recommendedContactStrategy && (
                        <div className="flex items-center gap-1.5">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground" data-testid={`text-outreach-${b.id}`}>
                            {STRATEGY_CONFIG[b.outreachMethod]?.label || b.outreachMethod}
                          </span>
                        </div>
                      )}
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

function BusinessesSection({ operator }: { operator: any }) {
  const [stageFilter, setStageFilter] = useState<string>("all");
  const queryKey = stageFilter !== "all"
    ? ["/api/operator/businesses", { stage: stageFilter }]
    : ["/api/operator/businesses"];
  const { data: rawResponse, isLoading } = useQuery<any>({
    queryKey,
    queryFn: async () => {
      const params = stageFilter !== "all" ? `?stage=${stageFilter}` : "";
      const res = await fetch(`/api/operator/businesses${params}`);
      if (!res.ok) throw new Error("Failed to fetch businesses");
      return res.json();
    },
  });
  const businesses: any[] = Array.isArray(rawResponse) ? rawResponse : (rawResponse?.data ?? []);
  const assignedCount: number = rawResponse?.assignedCount ?? 0;
  const [search, setSearch] = useState("");
  const [filterTerritory, setFilterTerritory] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [outreachTarget, setOutreachTarget] = useState<any | null>(null);
  const { toast } = useToast();

  const startWorkingMutation = useMutation({
    mutationFn: async (businessId: string) => {
      await apiRequest("PATCH", `/api/operator/businesses/${businessId}/stage`, { stage: "contacted" });
    },
    onSuccess: (_data, businessId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operator/businesses", { stage: "assigned" }] });
      queryClient.invalidateQueries({ queryKey: ["/api/operator/businesses", businessId, "activity"] });
      setExpandedId(businessId);
      toast({ title: "Lead moved to Contacted", description: "You can now work this lead." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update stage", description: err.message, variant: "destructive" });
    },
  });

  const territoryOptions = operator.territories?.map((t: any) => ({
    id: t.territoryId,
    name: t.territory?.name || t.territoryId,
  })) || [];

  const filtered = businesses.filter(b => {
    const matchesSearch = !search || b.name.toLowerCase().includes(search.toLowerCase());
    const matchesTerritory = filterTerritory === "all" || b.territoryCode === filterTerritory || b.territoryName === filterTerritory;
    return matchesSearch && matchesTerritory;
  });

  function tierBadge(tier: string) {
    const colors: Record<string, string> = { VERIFIED: "default", ENHANCED: "default", FREE: "outline" };
    return <Badge variant={(colors[tier] || "outline") as any} className="text-[10px]" data-testid={`badge-tier-${tier}`}>{tier}</Badge>;
  }

  function claimBadge(status: string) {
    if (status === "CLAIMED") return <Badge variant="default" className="text-[10px]">Claimed</Badge>;
    if (status === "CLAIM_SENT") return <Badge variant="secondary" className="text-[10px]">Claim Sent</Badge>;
    return <Badge variant="outline" className="text-[10px]">Unclaimed</Badge>;
  }

  const isSalesReady = stageFilter === "assigned";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold" data-testid="text-businesses-title">
            {operator.operatorType === "METRO" ? "Business Pipeline" : "My Businesses"}
          </h2>
          {assignedCount > 0 && (
            <Badge
              variant="default"
              className="cursor-pointer"
              onClick={() => setStageFilter(stageFilter === "assigned" ? "all" : "assigned")}
              data-testid="badge-sales-ready-count"
            >
              <Target className="h-3 w-3 mr-1" />
              {assignedCount} Sales Ready
            </Badge>
          )}
        </div>
        <DailySendIndicator />
      </div>

      {isSalesReady && filtered.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium" data-testid="text-new-leads-summary">
                {filtered.length} new lead{filtered.length !== 1 ? "s" : ""} ready to work
              </span>
              <span className="text-xs text-muted-foreground">— sorted by prospect fit score</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="pl-9"
            data-testid="input-search-businesses"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-stage-filter">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="assigned">Sales Ready</SelectItem>
            <SelectItem value="intake">Intake</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="engaged">Engaged</SelectItem>
            <SelectItem value="offer_presented">Offer Presented</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed_lost">Closed/Lost</SelectItem>
          </SelectContent>
        </Select>
        {territoryOptions.length > 1 && (
          <Select value={filterTerritory} onValueChange={setFilterTerritory}>
            <SelectTrigger className="w-48" data-testid="select-filter-territory">
              <SelectValue placeholder="All territories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Territories</SelectItem>
              {territoryOptions.map((t: any) => (
                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>{search || filterTerritory !== "all" || stageFilter !== "all"
              ? "No businesses match your filters."
              : "No businesses in your territories yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{filtered.length} business{filtered.length !== 1 ? "es" : ""}</p>
          {filtered.map((b: any) => {
            const isAssignedLead = isSalesReady || b.crmStage === "assigned";
            const strategyInfo = b.outreachMethod ? (STRATEGY_CONFIG[b.outreachMethod] || STRATEGY_CONFIG.UNKNOWN) : null;
            const StrategyIcon = strategyInfo?.icon;
            const LocationIcon = b.locationType ? (LOCATION_TYPE_ICONS[b.locationType] || FileQuestion) : null;

            return (
              <Card key={b.id} data-testid={`card-business-${b.id}`}>
                <CardContent className="py-3 px-4">
                  <div
                    className="flex items-start justify-between cursor-pointer gap-3"
                    onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                    data-testid={`button-expand-business-${b.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium text-sm" data-testid={`text-business-name-${b.id}`}>{b.name}</p>
                        {b.crmStage && <StageBadge stage={b.crmStage} />}
                        {isAssignedLead && b.locationType && b.locationType !== "UNKNOWN" && LocationIcon && (
                          <Badge variant="outline" className="text-[10px]" data-testid={`badge-location-type-${b.id}`}>
                            <LocationIcon className="h-3 w-3 mr-1" />
                            {LOCATION_TYPE_LABELS[b.locationType] || b.locationType}
                          </Badge>
                        )}
                        {b.industryTags && b.industryTags.length > 0 && b.industryTags.map((t: any) => (
                          <IndustryTagBadge key={t.tag} tag={t.tag} confidence={t.confidence} />
                        ))}
                      </div>
                      {isAssignedLead && (
                        <div className="mt-1.5 space-y-1">
                          {b.address && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span data-testid={`text-address-${b.id}`}>{b.address}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 flex-wrap">
                            {(b.phone || b.detectedPhone) && (
                              <span className="flex items-center gap-1 text-xs" data-testid={`text-phone-${b.id}`}>
                                <Phone className="h-3 w-3 text-green-600" />
                                <span className="text-muted-foreground">{b.phone || b.detectedPhone}</span>
                              </span>
                            )}
                            {(b.ownerEmail || b.detectedEmail) && (
                              <span className="flex items-center gap-1 text-xs" data-testid={`text-email-${b.id}`}>
                                <Mail className="h-3 w-3 text-blue-600" />
                                <span className="text-muted-foreground">{b.ownerEmail || b.detectedEmail}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {strategyInfo && StrategyIcon && b.outreachMethod !== "UNKNOWN" && (
                              <span className="flex items-center gap-1 text-xs" data-testid={`text-outreach-method-${b.id}`}>
                                <StrategyIcon className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{strategyInfo.label}</span>
                              </span>
                            )}
                            {b.prospectFitScore != null && (
                              <div className="w-[140px]">
                                <ScoreBar label="Prospect Fit" value={b.prospectFitScore} testId={`score-fit-${b.id}`} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {!isAssignedLead && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{b.territoryName}</span>
                          <Badge variant="outline" className="text-[9px]">{b.territoryType}</Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAssignedLead && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startWorkingMutation.mutate(b.id);
                          }}
                          disabled={startWorkingMutation.isPending}
                          data-testid={`button-start-working-${b.id}`}
                        >
                          {startWorkingMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Start Working
                        </Button>
                      )}
                      {!isAssignedLead && (
                        <>
                          {tierBadge(b.listingTier)}
                          {claimBadge(b.claimStatus)}
                          <Badge variant={b.presenceStatus === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                            {b.presenceStatus}
                          </Badge>
                        </>
                      )}
                      {b.slug && b.citySlug && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Copy upgrade link"
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/${b.citySlug}/presence/${b.slug}/pricing?ref=${operator.id}`;
                            navigator.clipboard.writeText(url).then(() => {
                              toast({ title: "Link copied!", description: "Share this upgrade link with the business owner." });
                            });
                          }}
                          data-testid={`button-copy-upgrade-link-${b.id}`}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setOutreachTarget(b); }}
                        data-testid={`button-row-email-${b.id}`}
                      >
                        <MailPlus className="h-4 w-4" />
                      </Button>
                      {expandedId === b.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  {expandedId === b.id && <BusinessDetailPanel business={b} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {outreachTarget && (
        <OutreachDialog
          business={outreachTarget}
          open={!!outreachTarget}
          onOpenChange={(v) => { if (!v) setOutreachTarget(null); }}
        />
      )}
    </div>
  );
}

function RevenueSection() {
  const { data: revenueSummary, isLoading: summaryLoading } = useQuery<any>({ queryKey: ["/api/operator/revenue"] });
  const { data: splits = [], isLoading: splitsLoading } = useQuery<any[]>({ queryKey: ["/api/operator/revenue/splits"] });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold" data-testid="text-revenue-title">My Revenue</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryLoading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Earned</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="text-revenue-total">{formatCents(revenueSummary?.totalEarned || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="text-revenue-pending">{formatCents(revenueSummary?.pending || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Payable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="text-revenue-payable">{formatCents(revenueSummary?.payable || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Paid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="text-revenue-paid">{formatCents(revenueSummary?.paid || 0)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Split History</CardTitle>
          <CardDescription>Your revenue split records</CardDescription>
        </CardHeader>
        <CardContent>
          {splitsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : splits.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>No revenue splits yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground pb-2 border-b">
                <span>Date</span>
                <span>Amount</span>
                <span>Type</span>
                <span>Status</span>
              </div>
              {splits.map((s: any) => (
                <div key={s.id} className="grid grid-cols-4 gap-4 py-2 text-sm border-b last:border-0" data-testid={`row-split-${s.id}`}>
                  <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                  <span className="font-medium">{formatCents(s.splitAmount)}</span>
                  <Badge variant="outline" className="w-fit text-[10px]">{s.splitType}</Badge>
                  <Badge
                    variant={s.status === "PAID" ? "default" : s.status === "PAYABLE" ? "secondary" : "outline"}
                    className="w-fit text-[10px]"
                  >
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MicroOperatorsSection() {
  const { data: microOps = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/operator/micro-operators"] });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" data-testid="text-micro-ops-title">My Micro Operators</h2>
      <p className="text-muted-foreground text-sm">Operators assigned to micro territories within your metro area.</p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : microOps.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>No micro operators assigned to your territory yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {microOps.map((op: any) => (
            <Card key={op.assignmentId} data-testid={`card-micro-op-${op.assignmentId}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm" data-testid={`text-micro-op-name-${op.assignmentId}`}>{op.operatorDisplayName}</p>
                      <p className="text-xs text-muted-foreground">{op.operatorEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{op.territoryName}</Badge>
                    <Badge variant="outline" className="text-[10px]">{op.territoryCode}</Badge>
                    <Badge
                      variant={op.operatorStatus === "ACTIVE" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {op.operatorStatus}
                    </Badge>
                    {op.exclusivity === "CONDITIONAL" && (
                      <Badge variant="secondary" className="text-[10px]">Exclusive</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TerritorySection({ operator }: { operator: any }) {
  const { data: bizResponse } = useQuery<any>({ queryKey: ["/api/operator/businesses"] });
  const businesses: any[] = Array.isArray(bizResponse) ? bizResponse : (bizResponse?.data ?? []);
  const { data: activity } = useQuery<any>({ queryKey: ["/api/operator/activity"] });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Territory Overview</h2>
      {operator.territories && operator.territories.length > 0 ? (
        <div className="grid gap-4">
          {operator.territories.map((t: any) => {
            const territoryBusinesses = businesses.filter((b: any) => b.territoryName === t.territory?.name);
            return (
              <Card key={t.id} data-testid={`card-territory-detail-${t.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{t.territory?.name || "Unknown"}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.territory?.type}</Badge>
                      <Badge variant={t.territory?.status === "ACTIVE" ? "default" : "secondary"}>{t.territory?.status}</Badge>
                    </div>
                  </div>
                  <CardDescription>Code: {t.territory?.code}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Businesses</span>
                      <p className="font-medium text-lg">{territoryBusinesses.length}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Exclusivity</span>
                      <p className="font-medium">{t.exclusivity}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Geo Type</span>
                      <p className="font-medium">{t.territory?.geoType || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Geo Codes</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {t.territory?.geoCodes && t.territory.geoCodes.length > 0 ? (
                          t.territory.geoCodes.map((code: string) => (
                            <Badge key={code} variant="outline" className="text-[10px]">{code}</Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {(t.territory?.siteUrl || t.territory?.emailDomain) && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                      {t.territory.siteUrl && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {t.territory.siteUrl}
                        </span>
                      )}
                      {t.territory.emailDomain && (
                        <span>Email: {t.territory.emailDomain}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No territories assigned yet. Contact your administrator.
          </CardContent>
        </Card>
      )}

      {activity && (activity.transactions?.length > 0 || activity.listings?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Latest events in your territories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activity.transactions?.slice(0, 10).map((tx: any) => (
                <div key={tx.transactionId} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0" data-testid={`row-activity-tx-${tx.transactionId}`}>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3 text-green-600" />
                    <span>Revenue: {tx.transactionType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCents(tx.grossAmount)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {activity.listings?.slice(0, 10).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0" data-testid={`row-activity-listing-${l.id}`}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-blue-600" />
                    <span>New listing added</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GooglePlacesImportSection({ operator }: { operator: any }) {
  const { toast } = useToast();
  const [queryText, setQueryText] = useState("");
  const [selectedZip, setSelectedZip] = useState("auto");
  const [requestedCount, setRequestedCount] = useState("20");

  const { data: geoData, isLoading: geoLoading } = useQuery<any>({
    queryKey: ["/api/operator/places/geo-codes"],
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery<any>({
    queryKey: ["/api/operator/places/jobs"],
  });

  const importMutation = useMutation({
    mutationFn: async (payload: { queryText: string; zipCode?: string; requestedCount: number }) => {
      const res = await apiRequest("POST", "/api/operator/places/import", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Import started", description: `Job queued. ${data.remainingImportsToday} imports remaining today.` });
      setQueryText("");
      queryClient.invalidateQueries({ queryKey: ["/api/operator/places/jobs"] });
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message || "Could not start import", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!queryText.trim()) return;
    const payload: any = {
      queryText: queryText.trim(),
      requestedCount: Math.min(60, Math.max(1, parseInt(requestedCount) || 20)),
    };
    if (selectedZip && selectedZip !== "auto") {
      payload.zipCode = selectedZip;
    }
    importMutation.mutate(payload);
  }

  const geoCodes: string[] = geoData?.geoCodes || [];
  const jobs: any[] = jobsData?.jobs || [];
  const remainingToday: number = jobsData?.remainingImportsToday ?? 5;

  function statusBadge(status: string) {
    const variants: Record<string, string> = {
      queued: "secondary",
      running: "default",
      completed: "default",
      failed: "destructive",
    };
    return (
      <Badge variant={(variants[status] || "outline") as any} className="text-[10px]" data-testid={`badge-job-status-${status}`}>
        {status}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-places-import-title">Google Places Import</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Import businesses from Google Places into your territory
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">New Import</CardTitle>
            <Badge variant={remainingToday > 0 ? "outline" : "destructive"} className="text-[10px]" data-testid="badge-remaining-imports">
              {remainingToday} import{remainingToday !== 1 ? "s" : ""} remaining today
            </Badge>
          </div>
          <CardDescription>Search for businesses by category or keyword scoped to your territory ZIP codes</CardDescription>
        </CardHeader>
        <CardContent>
          {geoLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : geoCodes.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              <span>Your territories have no ZIP codes configured. Contact your administrator.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Query</label>
                <Input
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="e.g. restaurants, coffee shops, dentists..."
                  data-testid="input-import-query"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">ZIP Code</label>
                  <Select value={selectedZip} onValueChange={setSelectedZip}>
                    <SelectTrigger data-testid="select-import-zip">
                      <SelectValue placeholder="Auto (first available)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (first available)</SelectItem>
                      {geoCodes.map((code) => (
                        <SelectItem key={code} value={code}>{code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Results</label>
                  <Select value={requestedCount} onValueChange={setRequestedCount}>
                    <SelectTrigger data-testid="select-import-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="40">40</SelectItem>
                      <SelectItem value="60">60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">Available ZIPs:</span>
                {geoCodes.map((code) => (
                  <Badge key={code} variant="outline" className="text-[10px] cursor-pointer" onClick={() => setSelectedZip(code)}>
                    {code}
                  </Badge>
                ))}
              </div>

              <Button
                type="submit"
                disabled={importMutation.isPending || !queryText.trim() || remainingToday <= 0}
                data-testid="button-start-import"
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {importMutation.isPending ? "Importing..." : "Start Import"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import History</CardTitle>
          <CardDescription>Recent Google Places import jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MapPinned className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>No imports yet. Run your first import above.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-4 text-xs font-medium text-muted-foreground pb-2 border-b">
                <span>Date</span>
                <span>Query</span>
                <span>ZIP</span>
                <span>Imported</span>
                <span>Status</span>
              </div>
              {jobs.map((job: any) => (
                <div
                  key={job.id}
                  className="grid grid-cols-5 gap-4 py-2 text-sm border-b last:border-0 items-center"
                  data-testid={`row-import-job-${job.id}`}
                >
                  <span className="text-muted-foreground text-xs">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <span className="truncate" title={job.queryText}>
                    {job.queryText}
                  </span>
                  <Badge variant="outline" className="w-fit text-[10px]">
                    {job.zipCode || "—"}
                  </Badge>
                  <span className="font-medium">
                    {job.importedCount ?? 0}{job.requestedCount ? `/${job.requestedCount}` : ""}
                  </span>
                  {statusBadge(job.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const SALES_BUCKET_CONFIG: Record<string, { label: string; description: string; color: string }> = {
  CONTACT_READY_NO_WEBSITE: { label: "No Website, Contact Ready", description: "Has phone/address but no website — sell them a web presence", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  STOREFRONT_WALKIN_READY: { label: "Walk-in Ready", description: "Physical storefront — visit in person for highest close rate", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  DEMAND_PRESENT_NOT_VERIFIED: { label: "Demand Already Here", description: "Getting views/clicks but not verified — show them the traffic they're missing", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  DATA_INCONSISTENT: { label: "Fix Your Public Info", description: "Website info doesn't match listing — offer data cleanup + verification", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  WEBSITE_DEGRADED: { label: "Broken Website", description: "Website returns errors — offer replacement or repair", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  DIGITAL_GAP_HIGH: { label: "Digital Gap", description: "No website + no social presence — biggest opportunity for full digital package", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  CONVERSION_GAP: { label: "Conversion Gap", description: "Has website but no contact form/email/phone on site — missing conversions", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  HIGH_ACTIVITY: { label: "High Activity", description: "Strong lead activity — hot prospects ready to convert", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
};

const BUCKET_ORDER = [
  "CONTACT_READY_NO_WEBSITE", "STOREFRONT_WALKIN_READY", "DEMAND_PRESENT_NOT_VERIFIED",
  "DATA_INCONSISTENT", "WEBSITE_DEGRADED", "DIGITAL_GAP_HIGH", "CONVERSION_GAP", "HIGH_ACTIVITY",
];

function SalesPipelineSection() {
  const { data: rawResponse, isLoading } = useQuery<any>({
    queryKey: ["/api/operator/sales-pipeline"],
  });

  const [activeBucket, setActiveBucket] = useState(BUCKET_ORDER[0]);
  const [search, setSearch] = useState("");

  const buckets: Record<string, any[]> = rawResponse?.buckets ?? {};
  const counts: Record<string, number> = rawResponse?.counts ?? {};
  const totalBucketed = Object.values(counts).reduce((sum: number, c: number) => sum + c, 0);

  const currentEntities = (buckets[activeBucket] || []).filter((e: any) =>
    !search || e.name?.toLowerCase().includes(search.toLowerCase())
  );

  const markContactedMutation = useMutation({
    mutationFn: async (entityId: string) => {
      await apiRequest("PATCH", `/api/operator/businesses/${entityId}/stage`, { stage: "contacted" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator/sales-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operator/businesses"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold" data-testid="text-sales-pipeline-title">Sales Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-sales-pipeline-title">Sales Pipeline</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Pre-computed sales targets grouped by what you can sell them. {totalBucketed} total opportunities.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {BUCKET_ORDER.map(bucket => {
          const cfg = SALES_BUCKET_CONFIG[bucket];
          const count = counts[bucket] || 0;
          return (
            <Button
              key={bucket}
              variant={activeBucket === bucket ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setActiveBucket(bucket)}
              data-testid={`btn-bucket-${bucket.toLowerCase()}`}
            >
              {cfg.label} {count > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{count}</Badge>}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base" data-testid="text-active-bucket-title">
                {SALES_BUCKET_CONFIG[activeBucket]?.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {SALES_BUCKET_CONFIG[activeBucket]?.description}
              </p>
            </div>
            <div className="relative min-w-[180px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-9 h-8 text-sm"
                data-testid="input-sales-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentEntities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-bucket">
              <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No entities in this bucket yet.</p>
              <p className="text-xs mt-1">Run the pipeline to compute sales buckets.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentEntities.map((entity: any) => (
                <div key={entity.entityId} className="border rounded-lg p-3 space-y-2" data-testid={`card-sales-entity-${entity.entityId}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" data-testid={`text-entity-name-${entity.entityId}`}>{entity.name}</p>
                      {entity.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" /> {entity.address}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary" data-testid={`text-priority-${entity.entityId}`}>
                        {entity.priorityScore}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {entity.phone && (
                      <Badge variant="outline" className="gap-1 text-[10px]"><Phone className="h-3 w-3" /> {entity.phone}</Badge>
                    )}
                    {entity.detectedEmail && (
                      <Badge variant="outline" className="gap-1 text-[10px]"><Mail className="h-3 w-3" /> {entity.detectedEmail}</Badge>
                    )}
                    {entity.websiteUrl ? (
                      <Badge variant="outline" className="gap-1 text-[10px]"><Globe className="h-3 w-3" /> Website</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">No Website</Badge>
                    )}
                    {entity.recommendedMethod && (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px]">
                        {entity.recommendedMethod.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {entity.prospectFitScore != null && (
                      <Badge variant="secondary" className="text-[10px]">Fit: {entity.prospectFitScore}</Badge>
                    )}
                    {entity.claimStatus === "UNCLAIMED" && (
                      <Badge variant="secondary" className="text-[10px]">Unclaimed</Badge>
                    )}
                  </div>

                  {entity.industryTags && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {entity.industryTags.split(", ").map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-[10px] bg-purple-50 dark:bg-purple-900/20">
                          {tag.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {entity.reasonsJson && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {(Array.isArray(entity.reasonsJson) ? entity.reasonsJson : []).map((reason: string, i: number) => (
                        <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => markContactedMutation.mutate(entity.entityId)}
                      disabled={markContactedMutation.isPending}
                      data-testid={`btn-mark-contacted-${entity.entityId}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Mark Contacted
                    </Button>
                    {entity.claimStatus === "UNCLAIMED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => window.open(`/claim/${entity.entityId}`, "_blank")}
                        data-testid={`btn-claim-link-${entity.entityId}`}
                      >
                        <Link2 className="h-3 w-3 mr-1" /> Claim Link
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CommsSection() {
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: commsData, isLoading } = useQuery<any[]>({
    queryKey: ["/api/operator/comms-log", channelFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channelFilter !== "ALL") params.set("channel", channelFilter);
      params.set("limit", pageSize.toString());
      params.set("offset", (page * pageSize).toString());
      const res = await fetch(`/api/operator/comms-log?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch comms log");
      return res.json();
    },
  });

  const logs = commsData || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-comms-title">Communications</h2>
        <p className="text-muted-foreground">Emails and SMS sent within your territories</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-comms-channel">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Channels</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="SMS">SMS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No communications logged yet</p>
            <p className="text-sm text-muted-foreground mt-1">Emails and SMS sent in your territories will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((entry: any) => (
            <Card key={entry.id} data-testid={`comms-entry-${entry.id}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {entry.channel === "EMAIL"
                      ? <Mail className="h-4 w-4 text-blue-600" />
                      : <Phone className="h-4 w-4 text-green-600" />
                    }
                    <div>
                      <span className="font-medium text-sm">{entry.recipientEmail || entry.recipientPhone || "Unknown"}</span>
                      {entry.subject && <span className="text-muted-foreground text-sm ml-2">— {entry.subject}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={entry.status === "SENT" || entry.status === "DELIVERED" ? "default" : "destructive"} data-testid={`badge-comms-status-${entry.id}`}>
                      {entry.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {entry.bodyPreview && (
                  <p className="text-sm text-muted-foreground mt-2 truncate">{entry.bodyPreview}</p>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-comms-prev">Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" disabled={logs.length < pageSize} onClick={() => setPage(p => p + 1)} data-testid="button-comms-next">Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BusinessStatsSection({ territoryId }: { territoryId?: string }) {
  const qk = territoryId ? `/api/operator/hub-business-stats?territoryId=${territoryId}` : "/api/operator/hub-business-stats";
  const { data, isLoading } = useQuery<{ total: number; byTier: Record<string, number>; health: { unclaimed: number; noPhoto: number; recentAdditions: number } }>({
    queryKey: ["/api/operator/hub-business-stats", territoryId],
    queryFn: async () => { const r = await fetch(qk, { credentials: "include" }); return r.json(); },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  const tierLabels: Record<string, string> = { FREE: "Free", VERIFIED: "Verified", ENHANCED: "Enhanced" };
  const tierColors: Record<string, string> = { FREE: "outline", VERIFIED: "secondary", ENHANCED: "default" };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-biz-stats-title">Business Stats</h2>
        <p className="text-muted-foreground">Overview of businesses in your hub</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Businesses</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="text-total-biz">{data.total}</p></CardContent>
        </Card>
        {Object.entries(data.byTier).map(([tier, count]) => (
          <Card key={tier}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{tierLabels[tier] || tier}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{count}</p>
              <Badge variant={(tierColors[tier] || "outline") as any} className="text-[10px] mt-1">{tier}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Health Indicators</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600" data-testid="text-unclaimed">{data.health.unclaimed}</p>
              <p className="text-xs text-muted-foreground">Unclaimed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600" data-testid="text-no-photo">{data.health.noPhoto}</p>
              <p className="text-xs text-muted-foreground">No Photo</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600" data-testid="text-recent">{data.health.recentAdditions}</p>
              <p className="text-xs text-muted-foreground">Added Last 30 Days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HubEventsSection({ territoryId }: { territoryId?: string }) {
  const { toast } = useToast();
  const qk = territoryId ? `/api/operator/events?territoryId=${territoryId}` : "/api/operator/events";
  const { data: eventsList = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/operator/events", territoryId],
    queryFn: async () => { const r = await fetch(qk, { credentials: "include" }); return r.json(); },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [location, setLocation] = useState("");
  const [zip, setZip] = useState("");

  const createEvent = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/operator/events", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator/events"] });
      toast({ title: "Event created" });
      setShowCreate(false); setTitle(""); setDescription(""); setStartDate(""); setLocation(""); setZip("");
    },
    onError: () => toast({ title: "Error creating event", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-events-title">Hub Events</h2>
          <p className="text-muted-foreground">Events in your hub area</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)} data-testid="button-create-event">
          <Plus className="h-4 w-4 mr-1" /> New Event
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} data-testid="input-event-title" />
            </div>
            <div>
              <Label className="text-xs">Date & Time</Label>
              <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-event-date" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-event-desc" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} data-testid="input-event-location" />
            </div>
            <div>
              <Label className="text-xs">ZIP</Label>
              <Input value={zip} onChange={e => setZip(e.target.value)} data-testid="input-event-zip" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createEvent.mutate({ title, description, startDate, location, zip })} disabled={!title || !startDate || createEvent.isPending} data-testid="button-submit-event">
              {createEvent.isPending ? "Creating..." : "Create Event"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : eventsList.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No upcoming events in your hub</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {eventsList.map((ev: any) => (
            <Card key={ev.id} data-testid={`event-card-${ev.id}`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{ev.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(ev.startDateTime).toLocaleDateString()} at {new Date(ev.startDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {ev.locationName && <p className="text-xs text-muted-foreground mt-1">{ev.locationName}</p>}
                  </div>
                  {ev.zip && <Badge variant="outline" className="text-[10px]">{ev.zip}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HubArticlesSection({ territoryId }: { territoryId?: string }) {
  const { toast } = useToast();
  const qk = territoryId ? `/api/operator/articles?territoryId=${territoryId}` : "/api/operator/articles";
  const { data: articlesList = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/operator/articles", territoryId],
    queryFn: async () => { const r = await fetch(qk, { credentials: "include" }); return r.json(); },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const createArticle = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/operator/articles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator/articles"] });
      toast({ title: "Article submitted for review" });
      setShowCreate(false); setTitle(""); setBody("");
    },
    onError: () => toast({ title: "Error submitting article", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-articles-title">Pulse Articles</h2>
          <p className="text-muted-foreground">Articles and content for your hub</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)} data-testid="button-submit-article">
          <Plus className="h-4 w-4 mr-1" /> Submit Article
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} data-testid="input-article-title" />
          </div>
          <div>
            <Label className="text-xs">Content</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} data-testid="input-article-body" />
          </div>
          <p className="text-xs text-muted-foreground">Articles are submitted as drafts and reviewed by the admin team before publishing.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createArticle.mutate({ title, body })} disabled={!title || !body || createArticle.isPending} data-testid="button-submit-article-form">
              {createArticle.isPending ? "Submitting..." : "Submit for Review"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : articlesList.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No articles for your hub yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {articlesList.map((art: any) => (
            <Card key={art.id} data-testid={`article-card-${art.id}`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{art.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{art.body?.substring(0, 150)}...</p>
                  </div>
                  <Badge variant={art.status === "PUBLISHED" ? "default" : "outline"} className="text-[10px] shrink-0">{art.status || "DRAFT"}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HubAdsSection({ territoryId }: { territoryId?: string }) {
  const qk = territoryId ? `/api/operator/ads?territoryId=${territoryId}` : "/api/operator/ads";
  const { data, isLoading } = useQuery<{ placements: any[]; slots: any[] }>({
    queryKey: ["/api/operator/ads", territoryId],
    queryFn: async () => { const r = await fetch(qk, { credentials: "include" }); return r.json(); },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const placements = data?.placements || [];
  const slots = data?.slots || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-ads-title">Ad Overview</h2>
        <p className="text-muted-foreground">Advertising activity in your hub</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ad Slots</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="text-ad-slots">{slots.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Placements</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="text-ad-placements">{placements.filter(p => p.status === "ACTIVE").length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Placements</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{placements.length}</p></CardContent>
        </Card>
      </div>

      {slots.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Inventory Slots</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {slots.map((slot: any) => (
              <div key={slot.id} className="flex items-center justify-between border rounded-lg p-2" data-testid={`ad-slot-${slot.id}`}>
                <div>
                  <p className="text-sm font-medium">{slot.label || slot.slotType}</p>
                  <p className="text-xs text-muted-foreground">{slot.slotType} — {slot.pricingModel}</p>
                </div>
                <Badge variant={slot.status === "ACTIVE" ? "default" : "outline"} className="text-[10px]">{slot.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {placements.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Placements</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {placements.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg p-2" data-testid={`ad-placement-${p.id}`}>
                <div>
                  <p className="text-sm font-medium">{p.headline || "Ad Placement"}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.startDate ? new Date(p.startDate).toLocaleDateString() : "No start"} — {p.endDate ? new Date(p.endDate).toLocaleDateString() : "Ongoing"}
                  </p>
                </div>
                <Badge variant={p.status === "ACTIVE" ? "default" : "outline"} className="text-[10px]">{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {placements.length === 0 && slots.length === 0 && (
        <Card><CardContent className="py-12 text-center">
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No ads configured for your hub yet</p>
        </CardContent></Card>
      )}
    </div>
  );
}

function HubAnalyticsSection({ territoryId }: { territoryId?: string }) {
  const qk = territoryId ? `/api/operator/analytics?territoryId=${territoryId}` : "/api/operator/analytics";
  const { data, isLoading } = useQuery<{
    businesses: { total: number; newThisMonth: number; paidTiers: number };
    revenue: { totalCents: number; thisMonthCents: number };
    pipeline: { intake: number; contacted: number; engaged: number; active: number; total: number };
    content: { events: number };
  }>({
    queryKey: ["/api/operator/analytics", territoryId],
    queryFn: async () => { const r = await fetch(qk, { credentials: "include" }); return r.json(); },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-analytics-title">Hub Analytics</h2>
        <p className="text-muted-foreground">Performance overview for your hub</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Businesses</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-analytics-total-biz">{data.businesses.total}</p>
            {data.businesses.newThisMonth > 0 && <p className="text-xs text-green-600 mt-1">+{data.businesses.newThisMonth} this month</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Paid Listings</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-analytics-paid">{data.businesses.paidTiers}</p>
            <p className="text-xs text-muted-foreground mt-1">Enhanced</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-analytics-revenue">{formatCents(data.revenue.totalCents)}</p>
            {data.revenue.thisMonthCents > 0 && <p className="text-xs text-green-600 mt-1">+{formatCents(data.revenue.thisMonthCents)} this month</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Events</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-analytics-events">{data.content.events}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Pipeline Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xl font-bold">{data.pipeline.intake}</p>
              <p className="text-xs text-muted-foreground">Intake</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{data.pipeline.contacted}</p>
              <p className="text-xs text-muted-foreground">Contacted</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{data.pipeline.engaged}</p>
              <p className="text-xs text-muted-foreground">Engaged</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{data.pipeline.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
          {data.pipeline.total > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Pipeline Progress</span>
                <span>{data.pipeline.active}/{data.pipeline.total} active</span>
              </div>
              <Progress value={data.pipeline.total > 0 ? (data.pipeline.active / data.pipeline.total) * 100 : 0} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OperatorDashboard() {
  const { operator, isLoading, isAuthenticated } = useOperator();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedHub, setSelectedHub] = useState("all");

  const { data: hubs = [] } = useQuery<HubInfo[]>({
    queryKey: ["/api/operator/hubs"],
    enabled: isAuthenticated,
  });

  const selectedTerritoryId = selectedHub === "all" ? undefined : selectedHub;

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !operator)) {
      navigate("/operator/login");
    }
  }, [isLoading, isAuthenticated, operator, navigate]);

  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/operator/logout");
      queryClient.invalidateQueries({ queryKey: ["/api/operator/me"] });
      navigate("/operator/login");
    } catch {
      navigate("/operator/login");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !operator) {
    return null;
  }

  function renderSection() {
    switch (activeSection) {
      case "overview":
        return <OverviewSection operator={operator} />;
      case "analytics":
        return <HubAnalyticsSection territoryId={selectedTerritoryId} />;
      case "territory":
        return <TerritorySection operator={operator} />;
      case "businesses":
        return <BusinessesSection operator={operator} />;
      case "biz-stats":
        return <BusinessStatsSection territoryId={selectedTerritoryId} />;
      case "targeting":
        return <TargetingSection />;
      case "sales-pipeline":
        return <SalesPipelineSection />;
      case "micro-operators":
        return <MicroOperatorsSection />;
      case "revenue":
        return <RevenueSection />;
      case "places-import":
        return <GooglePlacesImportSection operator={operator} />;
      case "comms":
        return <CommsSection />;
      case "hub-events":
        return <HubEventsSection territoryId={selectedTerritoryId} />;
      case "hub-articles":
        return <HubArticlesSection territoryId={selectedTerritoryId} />;
      case "hub-ads":
        return <HubAdsSection territoryId={selectedTerritoryId} />;
      default:
        return <OverviewSection operator={operator} />;
    }
  }

  const sidebarStyle = { "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <OperatorSidebar
          operator={operator}
          activeSection={activeSection}
          onNavigate={setActiveSection}
          onLogout={handleLogout}
          hubs={hubs}
          selectedHub={selectedHub}
          onHubChange={setSelectedHub}
        />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-2 p-4 border-b md:hidden">
            <SidebarTrigger>
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <span className="font-semibold text-sm">
              {hubs.length === 1 ? hubs[0].regionName : "Hub"} Dashboard
            </span>
          </div>
          <div className="p-6 max-w-6xl">
            {renderSection()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
