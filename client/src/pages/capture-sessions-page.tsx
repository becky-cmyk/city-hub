import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Upload, Loader2, Play, Check, X,
  CheckCircle2, XCircle, AlertCircle, Clock, Building2,
  User, FileText, Camera, MapPin, Calendar, Sparkles, Eye,
  Trash2, ChevronDown, ChevronUp, Pencil, Mic, MicOff,
  ClipboardPaste, SkipForward,
} from "lucide-react";
import { createRecorderWithFallback } from "@/lib/audio-mime";
import type { City } from "@shared/schema";

type SessionStatus = "open" | "uploading" | "processing" | "ready_for_review" | "partially_executed" | "complete" | "failed";

interface CaptureSessionItem {
  id: string;
  sessionId: string;
  itemType: string;
  status: string;
  imageUrl: string | null;
  rawInput: Record<string, any> | null;
  extractedData: Record<string, any> | null;
  matchedEntityId: string | null;
  matchedEntityType: string | null;
  matchedEntityName: string | null;
  matchConfidence: string | null;
  isExistingEntity: boolean;
  crmContactId: string | null;
  businessId: string | null;
  proposedActions: string[] | null;
  processingError: string | null;
  createdAt: string;
}

interface CaptureSession {
  id: string;
  eventName: string;
  eventDate: string | null;
  location: string | null;
  operatorName: string | null;
  hubId: string | null;
  status: SessionStatus;
  totalItems: number;
  processedItems: number;
  matchedExisting: number;
  matchedNew: number;
  proposalId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProposalItem {
  id: string;
  templateKey: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  status: string;
  params: Record<string, any>;
  result: Record<string, any> | null;
  errorMessage: string | null;
}

interface Proposal {
  id: string;
  status: string;
  items: ProposalItem[];
}

const ITEM_TYPE_OPTIONS = [
  { value: "business_card", label: "Business Card", icon: FileText },
  { value: "handwritten_note", label: "Handwritten Note", icon: FileText },
  { value: "booth_photo", label: "Booth Photo", icon: Camera },
  { value: "ad_photo", label: "Ad Photo", icon: Camera },
  { value: "document", label: "Document", icon: FileText },
  { value: "contact_data", label: "Contact Data", icon: User },
  { value: "qr_data", label: "QR Data", icon: FileText },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "bg-blue-500/10 text-blue-700", icon: Clock },
  uploading: { label: "Uploading", color: "bg-yellow-500/10 text-yellow-700", icon: Upload },
  processing: { label: "Processing", color: "bg-purple-500/10 text-purple-700", icon: Loader2 },
  ready_for_review: { label: "Ready for Review", color: "bg-orange-500/10 text-orange-700", icon: Eye },
  partially_executed: { label: "Partially Done", color: "bg-amber-500/10 text-amber-700", icon: AlertCircle },
  complete: { label: "Complete", color: "bg-green-500/10 text-green-700", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-700", icon: XCircle },
};

const TEMPLATE_LABELS: Record<string, string> = {
  CLAIM_LISTING: "Claim Listing Outreach",
  STORY_DRAFT: "Generate Story Draft",
  BECKY_OUTREACH: "Becky Intro Email",
  CROWN_CANDIDATE: "Crown Nomination",
  FOLLOWUP_EMAIL: "Follow-up Email",
  LISTING_UPGRADE: "Listing Upgrade",
  TV_VENUE_SCREEN: "TV Venue Screen",
  CONTENT_ARTICLE: "Content Article",
  EVENT_PROMOTION: "Event Promotion",
  SEARCH_RECOMMENDATION: "Search Boost",
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`} data-testid={`status-badge-${status}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function CaptureSessionsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showAddItemsDialog, setShowAddItemsDialog] = useState(false);
  const [addItemsTab, setAddItemsTab] = useState<string>("manual");
  const [newItems, setNewItems] = useState<Array<{ itemType: string; rawInput: Record<string, any> }>>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedProposalItems, setSelectedProposalItems] = useState<Set<string>>(new Set());
  const [editingProposalItem, setEditingProposalItem] = useState<ProposalItem | null>(null);
  const [editEntityName, setEditEntityName] = useState("");
  const [editEntityType, setEditEntityType] = useState("");
  const [editTemplateKey, setEditTemplateKey] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const [formEventName, setFormEventName] = useState("");
  const [formEventDate, setFormEventDate] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formHubId, setFormHubId] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: citiesData } = useQuery<City[]>({ queryKey: ["/api/admin/cities"] });
  const { data: sessions, isLoading: sessionsLoading } = useQuery<CaptureSession[]>({ queryKey: ["/api/capture-sessions"] });
  const { data: activeSessionData, isLoading: sessionLoading } = useQuery<{
    session: CaptureSession;
    items: CaptureSessionItem[];
    proposal: Proposal | null;
  }>({
    queryKey: ["/api/capture-sessions", activeSessionId],
    enabled: !!activeSessionId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/capture-sessions", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions"] });
      setActiveSessionId(data.id);
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Session created" });
    },
    onError: () => toast({ title: "Failed to create session", variant: "destructive" }),
  });

  const addItemsMutation = useMutation({
    mutationFn: async ({ sessionId, items }: { sessionId: string; items: any[] }) => {
      const res = await apiRequest("POST", `/api/capture-sessions/${sessionId}/items`, { items });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions", activeSessionId] });
      setShowAddItemsDialog(false);
      setNewItems([]);
      toast({ title: "Items added to session" });
    },
    onError: () => toast({ title: "Failed to add items", variant: "destructive" }),
  });

  const processMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/capture-sessions/${sessionId}/process`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions"] });
      toast({ title: "Processing complete — review Charlotte's proposals" });
    },
    onError: () => toast({ title: "Processing failed", variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ sessionId, itemIds, action, confirmAll }: { sessionId: string; itemIds?: string[]; action?: string; confirmAll?: boolean }) => {
      const res = await apiRequest("POST", `/api/capture-sessions/${sessionId}/proposal/confirm`, { itemIds, action, confirmAll });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions", activeSessionId] });
      setSelectedProposalItems(new Set());
      toast({ title: "Proposal items updated" });
    },
    onError: () => toast({ title: "Confirmation failed", variant: "destructive" }),
  });

  const executeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/capture-sessions/${sessionId}/proposal/execute`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions"] });
      toast({ title: `Executed: ${data.executed} succeeded, ${data.failed} failed` });
    },
    onError: () => toast({ title: "Execution failed", variant: "destructive" }),
  });

  const modifyProposalItemMutation = useMutation({
    mutationFn: async ({ sessionId, itemId, updates }: { sessionId: string; itemId: string; updates: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/capture-sessions/${sessionId}/proposal/items/${itemId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions", activeSessionId] });
      setEditingProposalItem(null);
      toast({ title: "Proposal item updated" });
    },
    onError: () => toast({ title: "Failed to modify proposal item", variant: "destructive" }),
  });

  function openEditProposalItem(pItem: ProposalItem) {
    setEditingProposalItem(pItem);
    setEditEntityName(pItem.entityName || "");
    setEditEntityType(pItem.entityType || "business");
    setEditTemplateKey(pItem.templateKey);
  }

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("DELETE", `/api/capture-sessions/${sessionId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions"] });
      setActiveSessionId(null);
      toast({ title: "Session deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  function resetForm() {
    setFormEventName("");
    setFormEventDate("");
    setFormLocation("");
    setFormHubId("");
    setFormNotes("");
  }

  const voiceMutation = useMutation({
    mutationFn: async ({ sessionId, audioBase64 }: { sessionId: string; audioBase64: string }) => {
      const res = await apiRequest("POST", `/api/capture-sessions/${sessionId}/items/voice`, { audioBase64 });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions", activeSessionId] });
      setLastTranscript(data.transcript);
      setSavedCount(prev => prev + 1);
      toast({ title: "Voice note captured" });
    },
    onError: () => toast({ title: "Voice transcription failed", variant: "destructive" }),
  });

  const bulkTextMutation = useMutation({
    mutationFn: async ({ sessionId, text }: { sessionId: string; text: string }) => {
      const res = await apiRequest("POST", `/api/capture-sessions/${sessionId}/items/bulk-text`, { text });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/capture-sessions", activeSessionId] });
      setBulkText("");
      toast({ title: `${data.parsed} entries added${data.skipped > 0 ? `, ${data.skipped} skipped` : ""}` });
      setShowAddItemsDialog(false);
    },
    onError: () => toast({ title: "Bulk import failed", variant: "destructive" }),
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { recorder } = createRecorderWithFallback(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        const reader = new FileReader();
        reader.onloadend = () => {
          if (activeSessionId && reader.result) {
            voiceMutation.mutate({ sessionId: activeSessionId, audioBase64: reader.result as string });
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setLastTranscript(null);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  }, [activeSessionId, voiceMutation, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  function clearAndFocusForm() {
    setNewItems([{ itemType: "business_card", rawInput: {} }]);
    setSavedCount(prev => prev + 1);
    setTimeout(() => firstFieldRef.current?.focus(), 100);
  }

  function toggleExpanded(id: string) {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleProposalItem(id: string) {
    setSelectedProposalItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addNewItemRow() {
    setNewItems(prev => [...prev, { itemType: "business_card", rawInput: {} }]);
  }

  function updateNewItem(index: number, field: string, value: any) {
    setNewItems(prev => {
      const next = [...prev];
      if (field === "itemType") next[index] = { ...next[index], itemType: value };
      else next[index] = { ...next[index], rawInput: { ...next[index].rawInput, [field]: value } };
      return next;
    });
  }

  function removeNewItem(index: number) {
    setNewItems(prev => prev.filter((_, i) => i !== index));
  }

  const session = activeSessionData?.session;
  const items = activeSessionData?.items || [];
  const proposal = activeSessionData?.proposal;

  if (activeSessionId && session) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setActiveSessionId(null)} data-testid="button-back-sessions">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" data-testid="text-session-name">{session.eventName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {session.eventDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{session.eventDate}</span>}
              {session.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.location}</span>}
            </div>
          </div>
          <StatusBadge status={session.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold" data-testid="text-total-items">{session.totalItems}</div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold" data-testid="text-processed-items">{session.processedItems}</div>
              <div className="text-xs text-muted-foreground">Processed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600" data-testid="text-matched-existing">{session.matchedExisting}</div>
              <div className="text-xs text-muted-foreground">Existing Matches</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-600" data-testid="text-matched-new">{session.matchedNew}</div>
              <div className="text-xs text-muted-foreground">New Entities</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {(session.status === "open" || session.status === "uploading") && (
            <>
              <Button onClick={() => { setNewItems([{ itemType: "business_card", rawInput: {} }]); setShowAddItemsDialog(true); }} data-testid="button-add-items">
                <Plus className="h-4 w-4 mr-1" /> Add Captures
              </Button>
              {session.totalItems > 0 && (
                <Button variant="default" onClick={() => processMutation.mutate(session.id)} disabled={processMutation.isPending} data-testid="button-process">
                  {processMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Process with Charlotte
                </Button>
              )}
            </>
          )}
          {session.status === "ready_for_review" && proposal && (
            <>
              <Button onClick={() => confirmMutation.mutate({ sessionId: session.id, confirmAll: true })} disabled={confirmMutation.isPending} data-testid="button-approve-all">
                <Check className="h-4 w-4 mr-1" /> Approve All
              </Button>
              {selectedProposalItems.size > 0 && (
                <>
                  <Button variant="outline" onClick={() => confirmMutation.mutate({ sessionId: session.id, itemIds: Array.from(selectedProposalItems), action: "confirm" })} disabled={confirmMutation.isPending} data-testid="button-approve-selected">
                    Approve Selected ({selectedProposalItems.size})
                  </Button>
                  <Button variant="outline" onClick={() => confirmMutation.mutate({ sessionId: session.id, itemIds: Array.from(selectedProposalItems), action: "skip" })} disabled={confirmMutation.isPending} data-testid="button-skip-selected">
                    Skip Selected
                  </Button>
                </>
              )}
            </>
          )}
          {proposal && (proposal.status === "confirmed" || proposal.items.some(i => i.status === "confirmed")) && session.status !== "complete" && (
            <Button variant="default" onClick={() => executeMutation.mutate(session.id)} disabled={executeMutation.isPending} data-testid="button-execute">
              {executeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Execute Actions
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Delete this session?")) deleteMutation.mutate(session.id); }} data-testid="button-delete-session">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {items.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Captured Items ({items.length})</h2>
            <div className="space-y-2">
              {items.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpanded(item.id)}
                    data-testid={`card-item-${item.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm capitalize">{item.itemType.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.status}
                        </Badge>
                        {item.isExistingEntity && <Badge className="bg-green-100 text-green-800 text-xs">Existing</Badge>}
                        {item.matchedEntityName && !item.isExistingEntity && <Badge className="bg-blue-100 text-blue-800 text-xs">New</Badge>}
                      </div>
                      {item.matchedEntityName && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          {item.matchedEntityType === "business" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {item.matchedEntityName}
                          {item.matchConfidence && <span className="text-xs">({item.matchConfidence})</span>}
                        </div>
                      )}
                    </div>
                    {expandedItems.has(item.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                  {expandedItems.has(item.id) && item.extractedData && (
                    <CardContent className="pt-0 pb-3 px-3 border-t">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(item.extractedData as Record<string, any>).map(([key, value]) => (
                          value && typeof value !== "object" && (
                            <div key={key}>
                              <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>{" "}
                              <span className="font-medium">{String(value)}</span>
                            </div>
                          )
                        ))}
                      </div>
                      {item.processingError && (
                        <div className="text-sm text-destructive mt-2 flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {item.processingError}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {proposal && proposal.items.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Charlotte's Proposal ({proposal.items.length} actions)
            </h2>
            <div className="space-y-2">
              {proposal.items.map((pItem) => (
                <Card key={pItem.id} className={`overflow-hidden ${pItem.status === "completed" ? "border-green-200 bg-green-50/30" : pItem.status === "failed" ? "border-red-200 bg-red-50/30" : pItem.status === "skipped" ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3 p-3">
                    {session.status === "ready_for_review" && pItem.status === "proposed" && (
                      <Checkbox
                        checked={selectedProposalItems.has(pItem.id)}
                        onCheckedChange={() => toggleProposalItem(pItem.id)}
                        data-testid={`checkbox-proposal-${pItem.id}`}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{TEMPLATE_LABELS[pItem.templateKey] || pItem.templateKey}</span>
                        <Badge variant="outline" className="text-xs">{pItem.status}</Badge>
                        {pItem.params?.isNewEntity && <Badge className="bg-blue-100 text-blue-800 text-xs">New Entity</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {pItem.entityType === "business" ? <Building2 className="h-3 w-3 inline mr-1" /> : <User className="h-3 w-3 inline mr-1" />}
                        {pItem.entityName || "Unknown"}
                        {pItem.params?.reason && <span className="ml-2 text-xs">— {pItem.params.reason}</span>}
                      </div>
                      {pItem.errorMessage && <div className="text-xs text-destructive mt-1">{pItem.errorMessage}</div>}
                      {pItem.result && pItem.status === "completed" && (
                        <div className="text-xs text-green-700 mt-1">
                          {pItem.result.articleId && `Story created`}
                          {pItem.result.queued && `Queued for outreach`}
                          {pItem.result.flagged && `Flagged for review`}
                          {pItem.result.featured && `Featured`}
                          {pItem.result.success === true && !pItem.result.articleId && !pItem.result.queued && !pItem.result.flagged && !pItem.result.featured && `Done`}
                        </div>
                      )}
                    </div>
                    {session.status === "ready_for_review" && pItem.status === "proposed" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditProposalItem(pItem)} data-testid={`button-edit-proposal-${pItem.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {pItem.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {pItem.status === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Dialog open={!!editingProposalItem} onOpenChange={(open) => { if (!open) setEditingProposalItem(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modify Proposal Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Action Template</Label>
                <Select value={editTemplateKey} onValueChange={setEditTemplateKey}>
                  <SelectTrigger data-testid="select-edit-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Entity Type</Label>
                <Select value={editEntityType} onValueChange={setEditEntityType}>
                  <SelectTrigger data-testid="select-edit-entity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Entity Name</Label>
                <Input value={editEntityName} onChange={(e) => setEditEntityName(e.target.value)} placeholder="Business or contact name" data-testid="input-edit-entity-name" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProposalItem(null)} data-testid="button-cancel-edit">Cancel</Button>
              <Button
                onClick={() => {
                  if (editingProposalItem && activeSessionId) {
                    modifyProposalItemMutation.mutate({
                      sessionId: activeSessionId,
                      itemId: editingProposalItem.id,
                      updates: {
                        templateKey: editTemplateKey,
                        entityType: editEntityType,
                        entityName: editEntityName,
                      },
                    });
                  }
                }}
                disabled={modifyProposalItemMutation.isPending}
                data-testid="button-save-edit"
              >
                {modifyProposalItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {session.notes && (
          <div className="text-sm text-muted-foreground mb-6">
            <strong>Notes:</strong> {session.notes}
          </div>
        )}

        <Dialog open={showAddItemsDialog} onOpenChange={(open) => { setShowAddItemsDialog(open); if (!open) { setSavedCount(0); setLastTranscript(null); setBulkText(""); } }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Captures to Session</DialogTitle>
            </DialogHeader>
            <Tabs value={addItemsTab} onValueChange={setAddItemsTab}>
              <TabsList className="w-full">
                <TabsTrigger value="manual" className="flex-1" data-testid="tab-manual">Manual</TabsTrigger>
                <TabsTrigger value="voice" className="flex-1" data-testid="tab-voice">
                  <Mic className="h-3.5 w-3.5 mr-1" /> Voice
                </TabsTrigger>
                <TabsTrigger value="bulk" className="flex-1" data-testid="tab-bulk">
                  <ClipboardPaste className="h-3.5 w-3.5 mr-1" /> Bulk Paste
                </TabsTrigger>
              </TabsList>
              <TabsContent value="manual">
                <div className="space-y-4">
                  {savedCount > 0 && (
                    <div className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2" data-testid="text-saved-count">
                      {savedCount} item{savedCount !== 1 ? "s" : ""} saved this session
                    </div>
                  )}
                  {newItems.map((item, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">Item {idx + 1}</span>
                        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => removeNewItem(idx)} data-testid={`button-remove-item-${idx}`}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select value={item.itemType} onValueChange={(v) => updateNewItem(idx, "itemType", v)}>
                            <SelectTrigger data-testid={`select-item-type-${idx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {(item.itemType === "contact_data" || item.itemType === "qr_data") ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Name</Label>
                              <Input ref={idx === 0 ? firstFieldRef : undefined} placeholder="Contact name" value={item.rawInput.name || ""} onChange={(e) => updateNewItem(idx, "name", e.target.value)} data-testid={`input-name-${idx}`} />
                            </div>
                            <div>
                              <Label className="text-xs">Company</Label>
                              <Input placeholder="Company" value={item.rawInput.company || ""} onChange={(e) => updateNewItem(idx, "company", e.target.value)} data-testid={`input-company-${idx}`} />
                            </div>
                            <div>
                              <Label className="text-xs">Email</Label>
                              <Input placeholder="Email" value={item.rawInput.email || ""} onChange={(e) => updateNewItem(idx, "email", e.target.value)} data-testid={`input-email-${idx}`} />
                            </div>
                            <div>
                              <Label className="text-xs">Phone</Label>
                              <Input placeholder="Phone" value={item.rawInput.phone || ""} onChange={(e) => updateNewItem(idx, "phone", e.target.value)} data-testid={`input-phone-${idx}`} />
                            </div>
                            <div>
                              <Label className="text-xs">Website</Label>
                              <Input placeholder="Website" value={item.rawInput.website || ""} onChange={(e) => updateNewItem(idx, "website", e.target.value)} data-testid={`input-website-${idx}`} />
                            </div>
                            <div>
                              <Label className="text-xs">Job Title</Label>
                              <Input placeholder="Job title" value={item.rawInput.jobTitle || ""} onChange={(e) => updateNewItem(idx, "jobTitle", e.target.value)} data-testid={`input-jobtitle-${idx}`} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Address</Label>
                              <Input placeholder="Address" value={item.rawInput.address || ""} onChange={(e) => updateNewItem(idx, "address", e.target.value)} data-testid={`input-address-${idx}`} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Notes</Label>
                              <Textarea placeholder="Notes" rows={2} value={item.rawInput.notes || ""} onChange={(e) => updateNewItem(idx, "notes", e.target.value)} data-testid={`input-notes-${idx}`} />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <Label className="text-xs">Image URL or Notes</Label>
                            <Input ref={idx === 0 ? firstFieldRef : undefined} placeholder="Paste image URL or enter notes" value={item.rawInput.imageUrl || item.rawInput.notes || ""} onChange={(e) => {
                              const val = e.target.value;
                              if (val.startsWith("http") || val.startsWith("/uploads")) {
                                updateNewItem(idx, "imageUrl", val);
                              } else {
                                updateNewItem(idx, "notes", val);
                              }
                            }} data-testid={`input-image-${idx}`} />
                            <p className="text-xs text-muted-foreground mt-1">Use existing photo upload to capture images, then paste the URL here</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                  <Button variant="outline" className="w-full" onClick={addNewItemRow} data-testid="button-add-item-row">
                    <Plus className="h-4 w-4 mr-1" /> Add Another Item
                  </Button>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowAddItemsDialog(false)}>Cancel</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const validItems = newItems.filter(i => Object.values(i.rawInput).some(v => v));
                      if (validItems.length === 0) {
                        toast({ title: "Add at least one item with data", variant: "destructive" });
                        return;
                      }
                      addItemsMutation.mutate({ sessionId: session.id, items: validItems }, {
                        onSuccess: () => { clearAndFocusForm(); setShowAddItemsDialog(true); },
                      });
                    }}
                    disabled={addItemsMutation.isPending}
                    data-testid="button-save-next"
                  >
                    {addItemsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <SkipForward className="h-4 w-4 mr-1" />}
                    Save & Next
                  </Button>
                  <Button
                    onClick={() => {
                      const validItems = newItems.filter(i => Object.values(i.rawInput).some(v => v));
                      if (validItems.length === 0) {
                        toast({ title: "Add at least one item with data", variant: "destructive" });
                        return;
                      }
                      addItemsMutation.mutate({ sessionId: session.id, items: validItems });
                    }}
                    disabled={addItemsMutation.isPending}
                    data-testid="button-submit-items"
                  >
                    {addItemsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Add {newItems.length} Item{newItems.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="voice">
                <div className="space-y-4 py-4">
                  <div className="flex flex-col items-center gap-4">
                    <Button
                      size="lg"
                      variant={isRecording ? "destructive" : "default"}
                      className="rounded-full w-14 min-w-14"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={voiceMutation.isPending}
                      data-testid="button-record-voice"
                    >
                      {voiceMutation.isPending ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : isRecording ? (
                        <MicOff className="h-6 w-6" />
                      ) : (
                        <Mic className="h-6 w-6" />
                      )}
                    </Button>
                    <p className="text-sm text-muted-foreground" data-testid="text-recording-status">
                      {voiceMutation.isPending ? "Transcribing..." : isRecording ? "Recording... tap to stop" : "Tap to record a voice note"}
                    </p>
                  </div>
                  {lastTranscript && (
                    <Card className="p-3">
                      <Label className="text-xs text-muted-foreground">Last Transcript</Label>
                      <p className="text-sm mt-1" data-testid="text-last-transcript">{lastTranscript}</p>
                    </Card>
                  )}
                  {savedCount > 0 && (
                    <div className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 text-center" data-testid="text-voice-saved-count">
                      {savedCount} voice note{savedCount !== 1 ? "s" : ""} captured
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setShowAddItemsDialog(false)}>Done</Button>
                </div>
              </TabsContent>
              <TabsContent value="bulk">
                <div className="space-y-4 py-2">
                  <div>
                    <Label className="text-sm">Paste contacts (one per line)</Label>
                    <Textarea
                      rows={8}
                      placeholder={"John Smith, Acme Corp, john@acme.com, 555-123-4567\nJane Doe - Widget Co, jane@widget.co\nBob Johnson, bob@example.com"}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      data-testid="textarea-bulk-paste"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Each line is one contact. Separate fields with commas, dashes, or tabs. Emails and phone numbers are auto-detected.
                    </p>
                  </div>
                  {bulkText.trim() && (
                    <div className="text-sm text-muted-foreground" data-testid="text-bulk-preview">
                      {bulkText.split(/\r?\n/).filter(l => l.trim().length > 0).length} line{bulkText.split(/\r?\n/).filter(l => l.trim().length > 0).length !== 1 ? "s" : ""} detected
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowAddItemsDialog(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!bulkText.trim()) {
                        toast({ title: "Paste some text first", variant: "destructive" });
                        return;
                      }
                      bulkTextMutation.mutate({ sessionId: session.id, text: bulkText });
                    }}
                    disabled={bulkTextMutation.isPending || !bulkText.trim()}
                    data-testid="button-submit-bulk"
                  >
                    {bulkTextMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ClipboardPaste className="h-4 w-4 mr-1" />}
                    Import All
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Capture Sessions</h1>
          <p className="text-sm text-muted-foreground">Process expo and field visit captures in batches with Charlotte</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-new-session">
          <Plus className="h-4 w-4 mr-1" /> New Session
        </Button>
      </div>

      {sessionsLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">No Capture Sessions Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create a session to batch-process captures from expos, events, and field visits.</p>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-new-session-empty">
            <Plus className="h-4 w-4 mr-1" /> Create Your First Session
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setActiveSessionId(s.id)}
              data-testid={`card-session-${s.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{s.eventName}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {s.eventDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{s.eventDate}</span>}
                      {s.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.location}</span>}
                      <span>{s.totalItems} item{s.totalItems !== 1 ? "s" : ""}</span>
                      {s.matchedExisting > 0 && <span className="text-green-600">{s.matchedExisting} existing</span>}
                      {s.matchedNew > 0 && <span className="text-blue-600">{s.matchedNew} new</span>}
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Capture Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Event / Visit Name *</Label>
              <Input placeholder="e.g. Charlotte Business Expo 2026" value={formEventName} onChange={(e) => setFormEventName(e.target.value)} data-testid="input-event-name" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={formEventDate} onChange={(e) => setFormEventDate(e.target.value)} data-testid="input-event-date" />
            </div>
            <div>
              <Label>Location</Label>
              <Input placeholder="e.g. Charlotte Convention Center" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} data-testid="input-event-location" />
            </div>
            {citiesData && citiesData.length > 1 && (
              <div>
                <Label>Hub</Label>
                <Select value={formHubId} onValueChange={setFormHubId}>
                  <SelectTrigger data-testid="select-hub">
                    <SelectValue placeholder="Select hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {citiesData.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Additional context about this session..." rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} data-testid="input-session-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!formEventName.trim()) {
                  toast({ title: "Event name is required", variant: "destructive" });
                  return;
                }
                createMutation.mutate({
                  eventName: formEventName.trim(),
                  eventDate: formEventDate || undefined,
                  location: formLocation || undefined,
                  hubId: formHubId || undefined,
                  notes: formNotes || undefined,
                });
              }}
              disabled={createMutation.isPending}
              data-testid="button-create-session"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
