import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Star, User, Building2, Phone, Mail, Pencil, Trash2,
  Camera, Mic, QrCode, PenLine, FileUp, Smartphone, Inbox, Users,
  Archive, ArrowUpCircle, ChevronDown, ChevronUp, Globe, MapPin,
  Image, FileText, Link2, Loader2, Sparkles, ExternalLink,
  Handshake, Eye, Target, UserCheck, Send, ArrowLeftRight, Menu, X,
  AlertCircle, GitMerge, Check
} from "lucide-react";
import type { CrmContact } from "@shared/schema";
import { ContactActivitySections } from "@/components/admin/contact-activity-sections";

const CATEGORY_LABELS: Record<string, string> = {
  personal: "Personal",
  business: "Business",
  trusted: "People Trusted to You",
  met: "Who I Met",
  partners: "Trusted Partners",
  referred_by: "Referred By",
  not_sure: "Needs Review",
  want_to_meet: "People I Want to Meet",
  potential_client: "Potential Client",
  current_client: "Current Client",
};

const EDIT_CATEGORIES = [
  { value: "want_to_meet", label: "People I Want to Meet" },
  { value: "potential_client", label: "Potential Client" },
  { value: "current_client", label: "Current Client" },
  { value: "trusted", label: "People Trusted to You" },
  { value: "met", label: "Who I Met" },
  { value: "partners", label: "Trusted Partners" },
  { value: "referred_by", label: "Referred By" },
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
  { value: "not_sure", label: "Needs Review" },
];

type MenuView =
  | "inbox"
  | "all"
  | "want_to_meet"
  | "potential_client"
  | "current_client"
  | "trusted"
  | "met"
  | "partners"
  | "your_referrals"
  | "referred_to_you";

interface SideMenuItem {
  key: MenuView;
  label: string;
  icon: typeof Inbox;
  countKey: string;
}

const LIVING_CLIENTS_ITEMS: SideMenuItem[] = [
  { key: "want_to_meet", label: "People I Want to Meet", icon: Sparkles, countKey: "want_to_meet" },
  { key: "potential_client", label: "Potential Clients", icon: Target, countKey: "potential_client" },
  { key: "current_client", label: "Current Clients", icon: UserCheck, countKey: "current_client" },
];

const REFERME_ITEMS: SideMenuItem[] = [
  { key: "trusted", label: "People Trusted to You", icon: Handshake, countKey: "trusted" },
  { key: "met", label: "Who I Met", icon: Users, countKey: "met" },
  { key: "partners", label: "Trusted Partners", icon: Handshake, countKey: "partners" },
  { key: "your_referrals", label: "Your Referrals", icon: Send, countKey: "your_referrals" },
  { key: "referred_to_you", label: "Who Referred You", icon: ArrowLeftRight, countKey: "referred_to_you" },
];

const CAPTURE_ICONS: Record<string, typeof Camera> = {
  photo: Camera,
  voice: Mic,
  qr_scan: QrCode,
  handwrite: PenLine,
  file_upload: FileUp,
  phone_import: Smartphone,
  manual: User,
};

function formatTimeAgo(date: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function CaptureDetailView({ contact }: { contact: CrmContact }) {
  const c = contact as any;
  const CaptureIcon = CAPTURE_ICONS[c.captureMethod || ""] || null;
  const [readingHandwriting, setReadingHandwriting] = useState(false);
  const [hwResult, setHwResult] = useState<Record<string, any> | null>(null);

  const readHandwriting = async () => {
    if (!c.handwritingImageUrl) return;
    setReadingHandwriting(true);
    try {
      const imageData = c.handwritingImageUrl.replace(/^data:[^;]+;base64,/, "");
      const res = await apiRequest("POST", "/api/capture/analyze-handwriting", {
        image: imageData,
        mimeType: "image/png",
      });
      const data = await res.json();
      setHwResult(data);
      if (data.name || data.email || data.phone || data.notes) {
        const updates: Record<string, any> = {};
        if (data.name && !contact.name?.trim()) updates.name = data.name;
        if (data.email && !contact.email) updates.email = data.email;
        if (data.phone && !contact.phone) updates.phone = data.phone;
        if (data.notes) updates.notes = (contact.notes ? contact.notes + "\n" : "") + data.notes;
        if (Object.keys(updates).length > 0) {
          await apiRequest("PATCH", `/api/crm/contacts/${contact.id}`, updates);
          queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm/contacts") });
        }
      }
    } catch (e) {
      console.error("Handwriting analysis failed:", e);
    } finally {
      setReadingHandwriting(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      {CaptureIcon && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <CaptureIcon className="h-3 w-3" />
            {(c.captureMethod || "").replace(/_/g, " ").toUpperCase()}
          </Badge>
          <span className="text-[10px] text-muted-foreground">Capture Evidence</span>
        </div>
      )}

      {c.businessCardImageUrl && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Image className="h-3 w-3" /> Business Card (Front)</p>
          <img src={c.businessCardImageUrl} alt="Business card front" className="h-32 rounded-lg border object-cover" />
        </div>
      )}
      {c.businessCardBackImageUrl && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Image className="h-3 w-3" /> Business Card (Back)</p>
          <img src={c.businessCardBackImageUrl} alt="Business card back" className="h-32 rounded-lg border object-cover" />
        </div>
      )}
      {c.documentImageUrl && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Image className="h-3 w-3" /> Document</p>
          <img src={c.documentImageUrl} alt="Document" className="h-32 rounded-lg border object-cover" />
        </div>
      )}
      {c.handwritingImageUrl && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><PenLine className="h-3 w-3" /> Handwriting</p>
          <img src={c.handwritingImageUrl} alt="Handwriting" className="h-32 rounded-lg border object-cover" />
          {!hwResult && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs gap-1"
              onClick={readHandwriting}
              disabled={readingHandwriting}
              data-testid={`button-read-handwriting-${contact.id}`}
            >
              {readingHandwriting ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Reading...</>
              ) : (
                <><Sparkles className="h-3 w-3" /> Read Handwriting</>
              )}
            </Button>
          )}
          {hwResult && (
            <div className="mt-2 bg-muted/50 rounded-lg p-2 text-xs space-y-1">
              <p className="font-medium text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> Smart Analysis</p>
              {hwResult.name && <p><strong>Name:</strong> {hwResult.name}</p>}
              {hwResult.email && <p><strong>Email:</strong> {hwResult.email}</p>}
              {hwResult.phone && <p><strong>Phone:</strong> {hwResult.phone}</p>}
              {hwResult.notes && <p><strong>Notes:</strong> {hwResult.notes}</p>}
            </div>
          )}
        </div>
      )}
      {c.audioRecordingUrl && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mic className="h-3 w-3" /> Voice Recording</p>
          <audio src={c.audioRecordingUrl} controls className="w-full h-8" data-testid={`audio-recording-${contact.id}`} />
        </div>
      )}
      {c.audioTranscription && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mic className="h-3 w-3" /> Voice Transcript</p>
          <div className="bg-muted/50 rounded-lg p-2 text-xs">{c.audioTranscription}</div>
        </div>
      )}
      {c.qrLinkUrl && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Link2 className="h-3 w-3" /> QR Link</p>
          <a
            href={c.qrLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 break-all"
            data-testid={`link-qr-${contact.id}`}
          >
            {c.qrLinkUrl} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      )}
      {c.qrRawText && !c.qrLinkUrl && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><QrCode className="h-3 w-3" /> QR Data</p>
          <div className="bg-muted/50 rounded-lg p-2 text-xs font-mono break-all">{c.qrRawText}</div>
        </div>
      )}
      {c.website && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Globe className="h-3 w-3" />
          <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {c.website}
          </a>
        </div>
      )}
      {c.address && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {c.address}
        </div>
      )}
      {c.aiExtracted && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> AI Extraction</p>
          <pre className="bg-muted/50 rounded-lg p-2 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">{JSON.stringify(c.aiExtracted, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function SendClaimInviteDialog({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: CrmContact;
}) {
  const { toast } = useToast();
  const c = contact as any;
  const businessId = c.linkedBusinessId;
  const [email, setEmail] = useState(c.email || "");
  const [variant, setVariant] = useState<"A" | "B">("A");

  const { data: biz } = useQuery<any>({
    queryKey: ["/api/admin/businesses", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load business");
      return res.json();
    },
    enabled: open && !!businessId,
  });

  useEffect(() => {
    if (biz && !email) {
      setEmail(biz.ownerEmail || c.email || "");
    }
  }, [biz]);

  useEffect(() => {
    if (!open) {
      setVariant("A");
    }
  }, [open]);

  const sendMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/outreach/send", {
        businessId,
        contactId: contact.id,
        variant,
        recipientEmail: email,
        recipientName: contact.name || "there",
        businessName: biz?.name || c.company || contact.name,
      }),
    onSuccess: () => {
      toast({ title: "Outreach sent", description: `Version ${variant} sent to ${email}` });
      onOpenChange(false);
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm/contacts") });
    },
    onError: (err: Error) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const isValid = email.includes("@") && email.includes(".");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-send-outreach">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-500" />
            Send Story Outreach
          </DialogTitle>
          <DialogDescription>
            Send an A/B story outreach email inviting them to confirm their details and participate in a community spotlight.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {biz && (
            <div className="rounded-lg border p-3 bg-accent/30">
              <p className="font-semibold text-sm" data-testid="text-outreach-biz-name">{biz.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {biz.address && `${biz.address}, `}{biz.city || ""} {biz.state || ""}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Recipient Email</Label>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="owner@business.com"
              data-testid="input-outreach-email"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Email Version</Label>
            <Select value={variant} onValueChange={(v: string) => setVariant(v as "A" | "B")}>
              <SelectTrigger data-testid="select-outreach-variant">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Version A — Personal Spotlight</SelectItem>
                <SelectItem value="B">Version B — Community Impact</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {variant === "A" ? "Focused on their story and what they've built" : "Focused on community, causes, and local impact"}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !isValid}
              data-testid="button-send-outreach"
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Outreach
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactCard({
  contact,
  expandedId,
  setExpandedId,
  openEdit,
  deleteMutation,
  onPromoteReview,
  archiveMutation,
  onSendClaimInvite,
  onNavigateToBusiness,
}: {
  contact: CrmContact;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  openEdit: (c: CrmContact) => void;
  deleteMutation: any;
  onPromoteReview: (contact: CrmContact) => void;
  archiveMutation: any;
  onSendClaimInvite?: (contact: CrmContact) => void;
  onNavigateToBusiness?: (businessId: string) => void;
}) {
  const CaptureIcon = CAPTURE_ICONS[(contact as any).captureMethod || ""] || null;
  const isExpanded = expandedId === contact.id;
  const c = contact as any;

  return (
    <Card className="transition" data-testid={`card-contact-${contact.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 relative">
            {c.businessCardImageUrl ? (
              <img src={c.businessCardImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="text-primary font-bold text-sm">
                {contact.name?.[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{contact.name}</span>
              {contact.isFavorite && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
              <Badge variant="outline" className="text-[9px] shrink-0">
                {CATEGORY_LABELS[contact.category || ""] || contact.category}
              </Badge>
              {CaptureIcon && (
                <Badge variant="secondary" className="text-[9px] shrink-0 gap-0.5">
                  <CaptureIcon className="h-2.5 w-2.5" />
                  {(c.captureMethod || "").replace("_", " ")}
                </Badge>
              )}
              {c.status === "inbox" && (
                <Badge className="text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/30 shrink-0">
                  inbox
                </Badge>
              )}
              {c.status === "archived" && (
                <Badge variant="outline" className="text-[9px] text-muted-foreground shrink-0">
                  archived
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {contact.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{contact.company}</span>}
              {contact.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{contact.email}</span>}
              {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
            </div>
            {c.connectionSource && (
              <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                via {c.connectionSource.replace(/_/g, " ")} · {formatTimeAgo(c.createdAt)}
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0 items-center">
            {c.status === "inbox" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => onPromoteReview(contact)}
                data-testid={`button-promote-${contact.id}`}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" /> Promote
              </Button>
            )}
            {c.status === "inbox" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => archiveMutation.mutate(contact.id)}
                data-testid={`button-archive-${contact.id}`}
              >
                <Archive className="h-3 w-3" />
              </Button>
            )}
            {c.linkedBusinessId && onSendClaimInvite && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => onSendClaimInvite(contact)}
                data-testid={`button-send-outreach-${contact.id}`}
              >
                <Send className="h-3.5 w-3.5" /> Send Outreach
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpandedId(isExpanded ? null : contact.id)}
              data-testid={`button-expand-${contact.id}`}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(contact)} data-testid={`button-edit-contact-${contact.id}`}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Delete this contact?")) deleteMutation.mutate(contact.id); }} data-testid={`button-delete-contact-${contact.id}`}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <>
            <CaptureDetailView contact={contact} />
            <ContactActivitySections contact={contact} onNavigateToBusiness={onNavigateToBusiness} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReferralCard({ referral }: { referral: any }) {
  return (
    <Card className="transition" data-testid={`card-referral-${referral.referralId}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
            <Send className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{referral.personA?.name || "Unknown"}</span>
              <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-sm">{referral.personB?.name || "Unknown"}</span>
              <Badge variant="outline" className="text-[9px]">{referral.status}</Badge>
              <Badge variant="secondary" className="text-[9px]">{referral.referralType}</Badge>
            </div>
            {referral.sharedMessage && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{referral.sharedMessage}</p>
            )}
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">
              {formatTimeAgo(referral.createdAt)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const REVIEW_ROLES = [
  { value: "want_to_meet", label: "People I Want to Meet", description: "Someone whose info you picked up — a general lead" },
  { value: "potential_client", label: "Potential Client", description: "Potential future client" },
  { value: "partners", label: "Your Trusted Partners", description: "People you trust and recommend" },
];

export default function ContactsPanel({ initialFilter, cityId, autoOpenContactId, onAutoOpenConsumed, adminMode, onNavigateToBusiness }: { initialFilter?: string; cityId?: string; autoOpenContactId?: string | null; onAutoOpenConsumed?: () => void; adminMode?: string; onNavigateToBusiness?: (businessId: string) => void }) {
  const [search, setSearch] = useState("");
  const [contactType, setContactType] = useState("all");
  const [activeView, setActiveView] = useState<MenuView>(initialFilter as MenuView || "inbox");
  const [editOpen, setEditOpen] = useState(false);
  const [editContact, setEditContact] = useState<Partial<CrmContact> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewContact, setReviewContact] = useState<CrmContact | null>(null);
  const [reviewDuplicates, setReviewDuplicates] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewCategory, setReviewCategory] = useState("business");
  const [reviewRoles, setReviewRoles] = useState<string[]>([]);

  const [claimInviteOpen, setClaimInviteOpen] = useState(false);
  const [claimInviteContact, setClaimInviteContact] = useState<CrmContact | null>(null);

  useEffect(() => {
    if (initialFilter) {
      setActiveView(initialFilter as MenuView);
    }
  }, [initialFilter]);

  useEffect(() => {
    if (autoOpenContactId) {
      setExpandedId(autoOpenContactId);
      setActiveView("all");
      onAutoOpenConsumed?.();
    }
  }, [autoOpenContactId]);

  const isReferralView = activeView === "your_referrals" || activeView === "referred_to_you";
  const isCategoryView = !isReferralView && activeView !== "inbox" && activeView !== "all";

  const scopeParam = adminMode === "platform" ? "platform" : adminMode === "metro" ? "metro" : "";
  const queryParams: Record<string, string> = {};
  if (!isReferralView) {
    if (search) queryParams.search = search;
    if (activeView === "inbox") queryParams.status = "inbox";
    if (isCategoryView) queryParams.category = activeView;
    if (contactType && contactType !== "all") queryParams.contact_type = contactType;
    if (scopeParam) queryParams.scope = scopeParam;
  }

  const contactsUrl = (() => {
    const params = new URLSearchParams(queryParams).toString();
    return params ? `/api/crm/contacts?${params}` : "/api/crm/contacts";
  })();

  const { data, isLoading } = useQuery<{ data: CrmContact[]; meta: { total: number } }>({
    queryKey: [contactsUrl],
    enabled: !isReferralView,
  });

  const yourReferrals = useQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/crm/contacts/your-referrals"],
    enabled: activeView === "your_referrals",
  });

  const referredToYou = useQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/crm/contacts/referred-to-you"],
    enabled: activeView === "referred_to_you",
  });

  const countsParams = new URLSearchParams();
  if (contactType && contactType !== "all") countsParams.set("contact_type", contactType);
  if (scopeParam) countsParams.set("scope", scopeParam);
  const countsUrl = countsParams.toString() ? `/api/crm/contacts/counts?${countsParams.toString()}` : "/api/crm/contacts/counts";

  const counts = useQuery<Record<string, number>>({
    queryKey: [countsUrl],
  });

  const saveMutation = useMutation({
    mutationFn: async (contact: Partial<CrmContact>) => {
      if (isNew) {
        return apiRequest("POST", "/api/crm/contacts", contact);
      }
      return apiRequest("PATCH", `/api/crm/contacts/${contact.id}`, contact);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm/contacts") });
      setEditOpen(false);
      setEditContact(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/crm/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm/contacts") });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/crm/contacts/${id}`, { status: "active" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm/contacts") });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/crm/contacts/${id}`, { status: "archived" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm/contacts") });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ survivorId, duplicateId, category }: { survivorId: string; duplicateId: string; category: string }) => {
      await apiRequest("POST", "/api/crm/contacts/merge", { survivorId, duplicateId });
      if (category) {
        await apiRequest("PATCH", `/api/crm/contacts/${survivorId}`, { category });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm/contacts") });
      setReviewOpen(false);
      setReviewContact(null);
      setReviewDuplicates([]);
    },
  });

  const onPromoteReview = async (contact: CrmContact) => {
    setReviewContact(contact);
    setReviewCategory(contact.category || "business");
    setReviewRoles([]);
    setReviewDuplicates([]);
    setReviewOpen(true);
    setReviewLoading(true);
    try {
      const params = new URLSearchParams();
      if (contact.name) params.set("name", contact.name);
      if (contact.email) params.set("email", contact.email);
      if (contact.phone) params.set("phone", contact.phone);
      params.set("excludeId", contact.id);
      const resp = await fetch(`/api/crm/contacts/check-duplicates?${params.toString()}`, { credentials: "include" });
      const data = await resp.json();
      setReviewDuplicates(data.duplicates || []);
    } catch {
      setReviewDuplicates([]);
    } finally {
      setReviewLoading(false);
    }
  };

  const getEffectiveCategory = () => {
    if (reviewRoles.length > 0) return reviewRoles[0];
    return reviewCategory;
  };

  const handlePromoteConfirm = async () => {
    if (!reviewContact) return;
    const updateData: any = { status: "active", category: getEffectiveCategory() };
    await apiRequest("PATCH", `/api/crm/contacts/${reviewContact.id}`, updateData);
    queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/crm/contacts") });
    setReviewOpen(false);
    setReviewContact(null);
    setReviewDuplicates([]);
  };

  const handleMerge = (duplicate: any) => {
    if (!reviewContact) return;
    mergeMutation.mutate({
      survivorId: duplicate.id,
      duplicateId: reviewContact.id,
      category: getEffectiveCategory(),
    });
  };

  const openNew = () => {
    setEditContact({ name: "", email: "", phone: "", company: "", jobTitle: "", category: "not_sure", notes: "", nudgeWindowDays: 30 });
    setIsNew(true);
    setEditOpen(true);
  };

  const openEdit = (contact: CrmContact) => {
    setEditContact({ ...contact });
    setIsNew(false);
    setEditOpen(true);
  };

  const contacts = data?.data || [];
  const countData = counts.data || {};

  const handleMenuClick = (view: MenuView) => {
    setActiveView(view);
    setSearch("");
    setContactType("all");
    setExpandedId(null);
    setMobileMenuOpen(false);
  };

  const getViewTitle = (): string => {
    if (activeView === "inbox") return "Inbox";
    if (activeView === "all") return "All Contacts";
    if (activeView === "your_referrals") return "Your Referrals";
    if (activeView === "referred_to_you") return "Who Referred You";
    const item = [...LIVING_CLIENTS_ITEMS, ...REFERME_ITEMS].find(i => i.key === activeView);
    return item?.label || "Contacts";
  };

  const showSideMenu = !initialFilter;

  const sideMenuContent = (
    <nav className="space-y-1" data-testid="nav-contacts-menu">
      <button
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          activeView === "inbox"
            ? "bg-[hsl(273,66%,34%)] text-white"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        onClick={() => handleMenuClick("inbox")}
        data-testid="menu-inbox"
      >
        <Inbox className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Inbox</span>
        {(countData.inbox || 0) > 0 && (
          <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]" data-testid="badge-inbox-count">
            {countData.inbox}
          </Badge>
        )}
      </button>

      <button
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          activeView === "all"
            ? "bg-[hsl(273,66%,34%)] text-white"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        onClick={() => handleMenuClick("all")}
        data-testid="menu-all"
      >
        <Users className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">All Contacts</span>
        <span className="text-xs opacity-60">{countData.all || 0}</span>
      </button>

      <div className="pt-3 pb-1">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-amber-500" data-testid="section-living-clients">
          Living Clients
        </p>
      </div>
      {LIVING_CLIENTS_ITEMS.map(item => (
        <button
          key={item.key}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            activeView === item.key
              ? "bg-[hsl(273,66%,34%)] text-white font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
          onClick={() => handleMenuClick(item.key)}
          data-testid={`menu-${item.key}`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <span className="text-xs opacity-60">{countData[item.countKey] || 0}</span>
        </button>
      ))}

      <div className="pt-3 pb-1">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-amber-500" data-testid="section-referme">
          ReferMe
        </p>
      </div>
      {REFERME_ITEMS.map(item => (
        <button
          key={item.key}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            activeView === item.key
              ? "bg-[hsl(273,66%,34%)] text-white font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
          onClick={() => handleMenuClick(item.key)}
          data-testid={`menu-${item.key}`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <span className="text-xs opacity-60">{countData[item.countKey] || 0}</span>
        </button>
      ))}
    </nav>
  );

  const mainContent = (
    <div className="flex-1 min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {showSideMenu && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-xl font-bold" data-testid="text-contacts-title">{getViewTitle()}</h2>
        </div>
        {!isReferralView && (
          <Button onClick={openNew} size="sm" data-testid="button-add-contact">
            <Plus className="h-4 w-4 mr-1" /> Add Contact
          </Button>
        )}
      </div>

      {!isReferralView && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-contacts"
            />
          </div>
          <Select value={contactType} onValueChange={setContactType}>
            <SelectTrigger className="w-[160px]" data-testid="select-contact-type">
              <Building2 className="h-4 w-4 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="people">People</SelectItem>
              <SelectItem value="organizations">Organizations</SelectItem>
              <SelectItem value="nonprofits">Nonprofits</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isReferralView ? (
        <>
          {(activeView === "your_referrals" ? yourReferrals : referredToYou).isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading referrals...</div>
          ) : (
            <>
              {((activeView === "your_referrals" ? yourReferrals : referredToYou).data?.data || []).length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">
                    {activeView === "your_referrals"
                      ? "No referrals yet. Start connecting people from Catch."
                      : "No one has referred contacts to you yet."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {((activeView === "your_referrals" ? yourReferrals : referredToYou).data?.data || []).map((ref: any) => (
                    <ReferralCard key={ref.referralId} referral={ref} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12">
          {activeView === "inbox" ? (
            <>
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Inbox is empty. Capture contacts from Catch to see them here.</p>
            </>
          ) : (
            <>
              <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No contacts in this category yet.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {contacts.map(contact => (
            <ContactCard
              key={contact.id}
              contact={contact}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              openEdit={openEdit}
              deleteMutation={deleteMutation}
              onPromoteReview={onPromoteReview}
              archiveMutation={archiveMutation}
              onSendClaimInvite={(c) => { setClaimInviteContact(c); setClaimInviteOpen(true); }}
              onNavigateToBusiness={onNavigateToBusiness}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-6 h-full">
      {showSideMenu && (
        <div className="hidden lg:block w-56 shrink-0">
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="pr-2">
              {sideMenuContent}
            </div>
          </ScrollArea>
        </div>
      )}

      {showSideMenu && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Contacts</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sideMenuContent}
          </div>
        </div>
      )}

      {mainContent}

      <Dialog open={reviewOpen} onOpenChange={(open) => { if (!open) { setReviewOpen(false); setReviewContact(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle data-testid="text-review-title">Complete Review</DialogTitle>
            {reviewContact && (
              <p className="text-sm text-muted-foreground">
                Assign category and roles for <strong>{reviewContact.name}</strong>
              </p>
            )}
          </DialogHeader>

          {reviewLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Checking for duplicates...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewDuplicates.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3" data-testid="review-duplicates-warning">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-amber-600 dark:text-amber-400 font-semibold text-sm">Possible Duplicates Found</p>
                      {reviewDuplicates.map((dup: any) => (
                        <div key={dup.id} className="mt-1.5 text-xs">
                          <p className="text-amber-600 dark:text-amber-400 font-medium">{dup.status === "inbox" ? "Pending Inbox Items" : "Existing Contact"}</p>
                          <p className="text-amber-600/80 dark:text-amber-400/80">
                            {dup.name}
                            {dup.email ? ` (${dup.email})` : ""}
                            {dup.phone ? ` — ${dup.phone}` : ""}
                            {dup.matchReason ? ` — matched by ${dup.matchReason}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-sm font-medium">Category</Label>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground" disabled data-testid="button-smart-suggest">
                    <Sparkles className="h-3 w-3" /> Smart Suggest
                  </button>
                </div>
                <Select value={reviewCategory} onValueChange={setReviewCategory}>
                  <SelectTrigger data-testid="select-review-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDIT_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Roles (select all that apply)</Label>
                <div className="space-y-2">
                  {REVIEW_ROLES.map(role => (
                    <label
                      key={role.value}
                      className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition"
                      data-testid={`role-${role.value}`}
                    >
                      <Checkbox
                        checked={reviewRoles.includes(role.value)}
                        onCheckedChange={(checked) => {
                          setReviewRoles(prev =>
                            checked ? [...prev, role.value] : prev.filter(r => r !== role.value)
                          );
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium leading-none">{role.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                {reviewDuplicates.length > 0 ? (
                  <>
                    {reviewDuplicates.map((dup: any) => (
                      <Button
                        key={dup.id}
                        className="w-full gap-2"
                        onClick={() => handleMerge(dup)}
                        disabled={mergeMutation.isPending}
                        data-testid={`button-merge-${dup.id}`}
                      >
                        {mergeMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <GitMerge className="h-4 w-4" />
                        )}
                        Merge with {dup.name}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={handlePromoteConfirm}
                      data-testid="button-add-anyway"
                    >
                      <Check className="h-4 w-4" /> Add Anyway
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={handlePromoteConfirm}
                    data-testid="button-promote-confirm"
                  >
                    <ArrowUpCircle className="h-4 w-4" /> Promote
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setReviewOpen(false); setReviewContact(null); }}
                  data-testid="button-review-cancel"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Contact" : "Edit Contact"}</DialogTitle>
          </DialogHeader>
          {editContact && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editContact.name || ""} onChange={e => setEditContact({ ...editContact, name: e.target.value })} data-testid="input-contact-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input value={editContact.email || ""} onChange={e => setEditContact({ ...editContact, email: e.target.value })} data-testid="input-contact-email" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={editContact.phone || ""} onChange={e => setEditContact({ ...editContact, phone: e.target.value })} data-testid="input-contact-phone" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Company</Label>
                  <Input value={editContact.company || ""} onChange={e => setEditContact({ ...editContact, company: e.target.value })} data-testid="input-contact-company" />
                </div>
                <div>
                  <Label>Job Title</Label>
                  <Input value={editContact.jobTitle || ""} onChange={e => setEditContact({ ...editContact, jobTitle: e.target.value })} data-testid="input-contact-title" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={editContact.category || "not_sure"} onValueChange={v => setEditContact({ ...editContact, category: v as any })}>
                    <SelectTrigger data-testid="select-edit-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDIT_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nudge Window (days)</Label>
                  <Input type="number" value={editContact.nudgeWindowDays || 30} onChange={e => setEditContact({ ...editContact, nudgeWindowDays: parseInt(e.target.value) || 30 })} data-testid="input-nudge-window" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Birthday (MM/DD)</Label>
                  <Input value={editContact.birthday || ""} onChange={e => setEditContact({ ...editContact, birthday: e.target.value })} placeholder="03/15" data-testid="input-birthday" />
                </div>
                <div>
                  <Label>Anniversary</Label>
                  <Input value={editContact.anniversary || ""} onChange={e => setEditContact({ ...editContact, anniversary: e.target.value })} placeholder="06/20" data-testid="input-anniversary" />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={editContact.notes || ""} onChange={e => setEditContact({ ...editContact, notes: e.target.value })} rows={3} data-testid="input-contact-notes" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editContact && saveMutation.mutate(editContact)}
              disabled={saveMutation.isPending || !editContact?.name}
              data-testid="button-save-contact"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {claimInviteContact && (
        <SendClaimInviteDialog
          open={claimInviteOpen}
          onOpenChange={setClaimInviteOpen}
          contact={claimInviteContact}
        />
      )}
    </div>
  );
}
