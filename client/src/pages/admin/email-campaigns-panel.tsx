import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Plus, Send, Users, ArrowLeft, RefreshCw, Newspaper, Calendar, MapPin } from "lucide-react";
import { useAdminCitySelection } from "@/hooks/use-city";
import { useState } from "react";

type EmailCampaign = {
  id: string;
  templateId: string;
  classification: string;
  audienceType: string;
  audienceFilterJson: any;
  selectedContentJson: any;
  subjectOverride: string | null;
  preheaderOverride: string | null;
  htmlOverride: string | null;
  scheduledAt: Date | null;
  status: string;
  createdByUserId: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type EmailTemplate = {
  id: string;
  templateKey: string;
  classification: string;
  name: string;
  subject: string;
  status: string;
};

type RecipientStat = { status: string; count: number };
type Recipient = { id: string; email: string; status: string; sentAt: string | null };
type AutoPullData = {
  articles: { id: string; title: string; excerpt?: string; slug?: string }[];
  events: { id: string; title: string; date?: string; slug?: string }[];
  attractions: { id: string; name: string; description?: string; slug?: string }[];
};

const STATUSES = ["draft", "scheduled", "sending", "sent", "canceled"] as const;
const AUDIENCE_TYPES = ["subscribers", "presence_owners", "crm_prospects", "billing_customers", "event_attendees"] as const;
const CLASSIFICATIONS = ["marketing", "transactional"] as const;

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "sent" || status === "sending") return "default";
  if (status === "scheduled") return "secondary";
  if (status === "canceled") return "destructive";
  return "outline";
}

function CreateCampaignDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState("");
  const [classification, setClassification] = useState("marketing");
  const [audienceType, setAudienceType] = useState("subscribers");
  const [subjectOverride, setSubjectOverride] = useState("");
  const [status, setStatus] = useState("draft");

  const { data: templates } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/email-campaigns", {
        templateId,
        classification,
        audienceType,
        subjectOverride: subjectOverride || null,
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-campaigns"] });
      toast({ title: "Campaign created" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error creating campaign", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New Email Campaign</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Template *</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger data-testid="select-campaign-template">
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Classification *</Label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger data-testid="select-campaign-classification">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Audience Type *</Label>
            <Select value={audienceType} onValueChange={setAudienceType}>
              <SelectTrigger data-testid="select-campaign-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Subject Override (optional)</Label>
          <Input
            value={subjectOverride}
            onChange={(e) => setSubjectOverride(e.target.value)}
            placeholder="Leave blank to use template subject"
            data-testid="input-campaign-subject"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-campaign-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !templateId}
            data-testid="button-save-campaign"
          >
            {createMutation.isPending ? "Creating..." : "Create Campaign"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </DialogContent>
  );
}

function AutoPullSection({ campaign, onContentUpdate }: {
  campaign: EmailCampaign;
  onContentUpdate: (content: any) => void;
}) {
  const { toast } = useToast();
  const [autoPullType, setAutoPullType] = useState<"weekly" | "weekend">("weekly");

  const { selectedCityId } = useAdminCitySelection();
  const { data: cities } = useQuery<{ id: string; slug: string }[]>({
    queryKey: ["/api/cities"],
    enabled: !selectedCityId,
  });
  const cityId = selectedCityId || cities?.[0]?.id || "";

  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(() => {
    const existing = campaign.selectedContentJson || {};
    const selected: Record<string, boolean> = {};
    (existing.articles || []).forEach((id: string) => { selected[`article-${id}`] = true; });
    (existing.events || []).forEach((id: string) => { selected[`event-${id}`] = true; });
    (existing.attractions || []).forEach((id: string) => { selected[`attraction-${id}`] = true; });
    return selected;
  });

  const { data: autoPullData, isLoading: pulling, refetch } = useQuery<AutoPullData>({
    queryKey: ["/api/admin/email-auto-pull", autoPullType, cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email-auto-pull?type=${autoPullType}&cityId=${cityId}`);
      if (!res.ok) throw new Error("Failed to pull content");
      return res.json();
    },
    enabled: false,
  });

  const toggleItem = (key: string) => {
    setSelectedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveSelection = () => {
    const articles: string[] = [];
    const events: string[] = [];
    const attractions: string[] = [];
    Object.entries(selectedItems).forEach(([key, val]) => {
      if (!val) return;
      const [type, id] = key.split("-");
      if (type === "article") articles.push(id);
      if (type === "event") events.push(id);
      if (type === "attraction") attractions.push(id);
    });
    onContentUpdate({ articles, events, attractions });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold text-sm">Auto-Pull CMS Content</h4>
        <div className="flex gap-2 flex-wrap">
          <Select value={autoPullType} onValueChange={(v) => setAutoPullType(v as "weekly" | "weekend")}>
            <SelectTrigger className="w-[120px]" data-testid="select-auto-pull-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="weekend">Weekend</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={pulling}
            data-testid="button-auto-pull"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${pulling ? "animate-spin" : ""}`} />
            {pulling ? "Pulling..." : "Pull Content"}
          </Button>
        </div>
      </div>

      {autoPullData && (
        <Tabs defaultValue="articles" className="w-full">
          <TabsList>
            <TabsTrigger value="articles" data-testid="tab-articles">
              <Newspaper className="h-3.5 w-3.5 mr-1" /> Articles ({autoPullData.articles?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="events" data-testid="tab-events">
              <Calendar className="h-3.5 w-3.5 mr-1" /> Events ({autoPullData.events?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="attractions" data-testid="tab-attractions">
              <MapPin className="h-3.5 w-3.5 mr-1" /> Attractions ({autoPullData.attractions?.length || 0})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="articles" className="space-y-2 mt-2">
            {autoPullData.articles?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No articles found</p>
            )}
            {autoPullData.articles?.map((a) => (
              <Card key={a.id} className="p-3 flex items-start gap-3" data-testid={`card-pull-article-${a.id}`}>
                <Checkbox
                  checked={!!selectedItems[`article-${a.id}`]}
                  onCheckedChange={() => toggleItem(`article-${a.id}`)}
                  data-testid={`checkbox-article-${a.id}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {a.excerpt && <p className="text-xs text-muted-foreground line-clamp-1">{a.excerpt}</p>}
                </div>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="events" className="space-y-2 mt-2">
            {autoPullData.events?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No events found</p>
            )}
            {autoPullData.events?.map((e) => (
              <Card key={e.id} className="p-3 flex items-start gap-3" data-testid={`card-pull-event-${e.id}`}>
                <Checkbox
                  checked={!!selectedItems[`event-${e.id}`]}
                  onCheckedChange={() => toggleItem(`event-${e.id}`)}
                  data-testid={`checkbox-event-${e.id}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  {e.date && <p className="text-xs text-muted-foreground">{e.date}</p>}
                </div>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="attractions" className="space-y-2 mt-2">
            {autoPullData.attractions?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No attractions found</p>
            )}
            {autoPullData.attractions?.map((a) => (
              <Card key={a.id} className="p-3 flex items-start gap-3" data-testid={`card-pull-attraction-${a.id}`}>
                <Checkbox
                  checked={!!selectedItems[`attraction-${a.id}`]}
                  onCheckedChange={() => toggleItem(`attraction-${a.id}`)}
                  data-testid={`checkbox-attraction-${a.id}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  {a.description && <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>}
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}

      {autoPullData && (
        <div className="flex justify-end pt-1">
          <Button onClick={saveSelection} data-testid="button-save-content-selection">
            Save Content Selection
          </Button>
        </div>
      )}
    </Card>
  );
}

function CampaignDetail({ campaign, onBack }: { campaign: EmailCampaign; onBack: () => void }) {
  const { toast } = useToast();

  const { selectedCityId } = useAdminCitySelection();
  const { data: fallbackCities } = useQuery<{ id: string; slug: string }[]>({
    queryKey: ["/api/cities"],
    enabled: !selectedCityId,
  });
  const cityId = selectedCityId || fallbackCities?.[0]?.id || "";

  const { data: detail, isLoading: detailLoading } = useQuery<{ campaign: EmailCampaign; recipientStats: RecipientStat[] }>({
    queryKey: ["/api/admin/email-campaigns", campaign.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email-campaigns/${campaign.id}`);
      if (!res.ok) throw new Error("Failed to load campaign");
      return res.json();
    },
  });

  const { data: recipients, isLoading: recipientsLoading } = useQuery<Recipient[]>({
    queryKey: ["/api/admin/email-campaigns", campaign.id, "recipients"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email-campaigns/${campaign.id}/recipients`);
      if (!res.ok) throw new Error("Failed to load recipients");
      return res.json();
    },
  });

  const populateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/admin/email-campaigns/${campaign.id}/populate-audience?cityId=${cityId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-campaigns", campaign.id] });
      toast({ title: "Audience populated" });
    },
    onError: (err: any) => {
      toast({ title: "Error populating audience", description: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/admin/email-campaigns/${campaign.id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-campaigns", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-campaigns"] });
      toast({ title: "Campaign sending started" });
    },
    onError: (err: any) => {
      toast({ title: "Error sending campaign", description: err.message, variant: "destructive" });
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async (selectedContentJson: any) => {
      return apiRequest("PATCH", `/api/admin/email-campaigns/${campaign.id}`, { selectedContentJson });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-campaigns", campaign.id] });
      toast({ title: "Content selection saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error saving content", description: err.message, variant: "destructive" });
    },
  });

  const cam = detail?.campaign || campaign;
  const stats = detail?.recipientStats || [];
  const queuedCount = stats.find((s) => s.status === "queued")?.count || 0;
  const sentCount = stats.find((s) => s.status === "sent")?.count || 0;
  const deliveredCount = stats.find((s) => s.status === "delivered")?.count || 0;
  const bouncedCount = stats.find((s) => s.status === "bounced")?.count || 0;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} data-testid="button-back-to-list">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Campaigns
      </Button>

      {detailLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold" data-testid="text-campaign-id">Campaign {cam.id.slice(0, 8)}...</h3>
            <Badge variant={statusVariant(cam.status)} data-testid="badge-campaign-status">{cam.status}</Badge>
            <Badge variant="outline" data-testid="badge-campaign-audience">{cam.audienceType.replace(/_/g, " ")}</Badge>
            <Badge variant="outline" data-testid="badge-campaign-classification">{cam.classification}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <p data-testid="text-campaign-template">Template: {cam.templateId.slice(0, 8)}...</p>
            {cam.subjectOverride && <p data-testid="text-campaign-subject">Subject: {cam.subjectOverride}</p>}
            <p data-testid="text-campaign-created">Created: {new Date(cam.createdAt).toLocaleString()}</p>
            {cam.sentAt && <p data-testid="text-campaign-sent">Sent: {new Date(cam.sentAt).toLocaleString()}</p>}
          </div>

          <div className="flex gap-4 pt-2 flex-wrap">
            <div className="text-center">
              <p className="text-lg font-semibold" data-testid="text-stat-queued">{queuedCount}</p>
              <p className="text-xs text-muted-foreground">Queued</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold" data-testid="text-stat-sent">{sentCount}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold" data-testid="text-stat-delivered">{deliveredCount}</p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold" data-testid="text-stat-bounced">{bouncedCount}</p>
              <p className="text-xs text-muted-foreground">Bounced</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => populateMutation.mutate()}
              disabled={populateMutation.isPending}
              data-testid="button-populate-audience"
            >
              <Users className="h-4 w-4 mr-1" />
              {populateMutation.isPending ? "Populating..." : "Populate Audience"}
            </Button>
            {cam.status === "draft" && queuedCount > 0 && (
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                data-testid="button-send-campaign"
              >
                <Send className="h-4 w-4 mr-1" />
                {sendMutation.isPending ? "Sending..." : "Send Campaign"}
              </Button>
            )}
          </div>
        </Card>
      )}

      <AutoPullSection
        campaign={cam}
        onContentUpdate={(content) => updateContentMutation.mutate(content)}
      />

      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-3">Recipients</h4>
        {recipientsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : !recipients || recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recipients yet. Use "Populate Audience" to add them.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((r) => (
                <TableRow key={r.id} data-testid={`row-recipient-${r.id}`}>
                  <TableCell data-testid={`text-recipient-email-${r.id}`}>{r.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" data-testid={`badge-recipient-status-${r.id}`}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export default function EmailCampaignsPanel({ cityId }: { cityId?: string }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

  const queryParams = new URLSearchParams();
  if (filterStatus) queryParams.set("status", filterStatus);
  const qs = queryParams.toString();

  const { data: campaigns, isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ["/api/admin/email-campaigns", qs],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email-campaigns${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load campaigns");
      return res.json();
    },
  });

  if (selectedCampaign) {
    return <CampaignDetail campaign={selectedCampaign} onBack={() => setSelectedCampaign(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-email-campaigns-title">
            <Mail className="h-5 w-5" /> Email Campaigns
          </h2>
          <p className="text-sm text-muted-foreground">Manage email campaigns with auto-pull CMS content</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-campaign">
          <Plus className="h-4 w-4 mr-1" /> New Campaign
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No campaigns found</h3>
          <p className="text-sm text-muted-foreground">Create your first campaign to get started</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((cam) => (
            <Card
              key={cam.id}
              className="p-4 cursor-pointer hover-elevate"
              onClick={() => setSelectedCampaign(cam)}
              data-testid={`card-campaign-${cam.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold truncate" data-testid={`text-campaign-id-${cam.id}`}>
                      Campaign {cam.id.slice(0, 8)}...
                    </h3>
                    <Badge variant={statusVariant(cam.status)} data-testid={`badge-status-${cam.id}`}>
                      {cam.status}
                    </Badge>
                    <Badge variant="outline" data-testid={`badge-audience-${cam.id}`}>
                      {cam.audienceType.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" data-testid={`badge-classification-${cam.id}`}>
                      {cam.classification}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid={`text-campaign-date-${cam.id}`}>
                    Created: {new Date(cam.createdAt).toLocaleDateString()}
                    {cam.subjectOverride && ` | Subject: ${cam.subjectOverride}`}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        {isCreateOpen && <CreateCampaignDialog onClose={() => setIsCreateOpen(false)} />}
      </Dialog>
    </div>
  );
}
