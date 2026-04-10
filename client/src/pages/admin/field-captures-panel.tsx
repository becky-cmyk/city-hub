import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2, CalendarDays, Briefcase, Sparkles, ShoppingBag, FileText,
  Users, PenLine, Camera, StickyNote, MoreHorizontal, ArrowRight,
  MapPin, User, Phone, Mail, Link2, Clock, CheckCircle2, XCircle, Eye,
  Megaphone, Globe, Image, Upload, Loader2, AlertTriangle, Wand2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FieldCapture {
  id: string;
  city_id: string;
  zone_id: string | null;
  capture_type: string;
  title: string;
  notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  business_name: string | null;
  event_name: string | null;
  location_text: string | null;
  source_url: string | null;
  photo_urls: string[] | null;
  file_urls: string[] | null;
  raw_data: Record<string, unknown>;
  status: string;
  target_type: string | null;
  converted_entity_id: string | null;
  converted_entity_table: string | null;
  review_notes: string | null;
  captured_by_user_id: string | null;
  captured_by_name: string | null;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof Building2 }> = {
  business: { label: "Business Lead", icon: Building2 },
  event: { label: "Event Info", icon: CalendarDays },
  job_lead: { label: "Job Lead", icon: Briefcase },
  creator_lead: { label: "Creator Lead", icon: Sparkles },
  marketplace: { label: "Marketplace", icon: ShoppingBag },
  flyer: { label: "Flyer / Promo", icon: FileText },
  community_update: { label: "Community Update", icon: Users },
  correction: { label: "Correction", icon: PenLine },
  story_lead: { label: "Story Lead", icon: FileText },
  photo: { label: "Photo", icon: Camera },
  voice_note: { label: "Voice Note", icon: FileText },
  document: { label: "Document", icon: FileText },
  quick_note: { label: "Quick Note", icon: StickyNote },
  ad_spot: { label: "Ad Spot", icon: Megaphone },
  other: { label: "Other", icon: MoreHorizontal },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "New", variant: "default" },
  reviewing: { label: "Reviewing", variant: "secondary" },
  ready_to_convert: { label: "Ready", variant: "outline" },
  converted: { label: "Converted", variant: "secondary" },
  discarded: { label: "Discarded", variant: "destructive" },
  needs_followup: { label: "Follow Up", variant: "outline" },
};

const CONVERT_TARGETS = [
  { value: "business", label: "Create Business" },
  { value: "event", label: "Create Event" },
  { value: "article", label: "Create Article" },
  { value: "submission", label: "Create Submission" },
] as const;

export default function FieldCapturesPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedCapture, setSelectedCapture] = useState<FieldCapture | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: captures, isLoading } = useQuery<FieldCapture[]>({
    queryKey: ["/api/admin/field-captures", cityId, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("captureType", typeFilter);
      const res = await fetch(`/api/admin/field-captures?${params}`);
      if (!res.ok) throw new Error("Failed to load captures");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      return apiRequest("PATCH", `/api/admin/field-captures/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/field-captures"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, targetType }: { id: string; targetType: string }) => {
      return apiRequest("POST", `/api/admin/field-captures/${id}/convert`, { targetType });
    },
    onSuccess: (_data, vars) => {
      toast({ title: "Converted", description: `Capture converted to ${vars.targetType}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/field-captures"] });
      setSelectedCapture(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const counts = {
    total: captures?.length || 0,
    new: captures?.filter((c) => c.status === "new").length || 0,
    reviewing: captures?.filter((c) => c.status === "reviewing").length || 0,
    followup: captures?.filter((c) => c.status === "needs_followup").length || 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100" data-testid="text-field-captures-title">
          Field Captures
        </h2>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span data-testid="text-captures-count">{counts.total} total</span>
          {counts.new > 0 && (
            <Badge variant="default" data-testid="badge-new-count">{counts.new} new</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="ready_to_convert">Ready to Convert</SelectItem>
            <SelectItem value="needs_followup">Needs Follow Up</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="discarded">Discarded</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, cfg]) => (
              <SelectItem key={value} value={value}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-neutral-400">Loading captures...</div>
      )}

      {!isLoading && (!captures || captures.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-neutral-500">
            <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No field captures found</p>
            <p className="text-sm mt-1">Captures from field operators will appear here for review.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {captures?.map((capture) => {
          const typeCfg = TYPE_LABELS[capture.capture_type] || TYPE_LABELS.other;
          const statusCfg = STATUS_CONFIG[capture.status] || STATUS_CONFIG.new;
          const TypeIcon = typeCfg.icon;

          return (
            <Card
              key={capture.id}
              className="cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
              onClick={() => {
                setSelectedCapture(capture);
                setReviewNotes(capture.review_notes || "");
              }}
              data-testid={`card-capture-${capture.id}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0">
                      <TypeIcon className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate text-neutral-900 dark:text-neutral-100" data-testid={`text-capture-title-${capture.id}`}>
                        {capture.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                        <span>{typeCfg.label}</span>
                        {capture.captured_by_name && (
                          <>
                            <span className="text-neutral-300 dark:text-neutral-600">|</span>
                            <span>{capture.captured_by_name}</span>
                          </>
                        )}
                        {capture.location_text && (
                          <>
                            <span className="text-neutral-300 dark:text-neutral-600">|</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {capture.location_text}
                            </span>
                          </>
                        )}
                      </div>
                      {capture.notes && (
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-1">{capture.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusCfg.variant} data-testid={`badge-status-${capture.id}`}>
                      {statusCfg.label}
                    </Badge>
                    <span className="text-xs text-neutral-400">
                      {new Date(capture.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedCapture} onOpenChange={(open) => !open && setSelectedCapture(null)}>
        {selectedCapture && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" data-testid="text-capture-detail-title">
                <Eye className="h-4 w-4" />
                Review Capture
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Type</p>
                  <p className="text-sm font-medium mt-0.5">
                    {TYPE_LABELS[selectedCapture.capture_type]?.label || selectedCapture.capture_type}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Status</p>
                  <Badge variant={STATUS_CONFIG[selectedCapture.status]?.variant || "default"}>
                    {STATUS_CONFIG[selectedCapture.status]?.label || selectedCapture.status}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide">Title</p>
                <p className="text-sm font-medium mt-0.5">{selectedCapture.title}</p>
              </div>

              {selectedCapture.notes && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Notes</p>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{selectedCapture.notes}</p>
                </div>
              )}

              {selectedCapture.business_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{selectedCapture.business_name}</span>
                </div>
              )}

              {selectedCapture.event_name && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{selectedCapture.event_name}</span>
                </div>
              )}

              {selectedCapture.contact_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{selectedCapture.contact_name}</span>
                </div>
              )}

              {selectedCapture.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{selectedCapture.contact_phone}</span>
                </div>
              )}

              {selectedCapture.contact_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{selectedCapture.contact_email}</span>
                </div>
              )}

              {selectedCapture.location_text && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                  <span>{selectedCapture.location_text}</span>
                </div>
              )}

              {selectedCapture.source_url && (
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-3.5 w-3.5 text-neutral-400" />
                  <a
                    href={selectedCapture.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-600 dark:text-blue-400 truncate"
                    data-testid="link-capture-source"
                  >
                    {(() => { try { return new URL(selectedCapture.source_url!).hostname; } catch { return selectedCapture.source_url; } })()}
                  </a>
                </div>
              )}

              {selectedCapture.photo_urls && selectedCapture.photo_urls.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Photos</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedCapture.photo_urls.map((url, i) => (
                      <img key={i} src={url} alt={`Capture photo ${i + 1}`} className="h-24 rounded-lg border object-cover" data-testid={`img-capture-photo-${i}`} />
                    ))}
                  </div>
                </div>
              )}

              {selectedCapture.capture_type === "ad_spot" && selectedCapture.raw_data && (() => {
                const rd = selectedCapture.raw_data as Record<string, unknown>;
                const str = (k: string): string => typeof rd[k] === "string" ? rd[k] as string : "";
                const num = (k: string): number | null => typeof rd[k] === "number" ? rd[k] as number : null;
                const safeHref = (url: string): string => {
                  try { const u = new URL(url); return ["http:", "https:"].includes(u.protocol) ? u.toString() : "#"; } catch { return "#"; }
                };
                const adMedium = str("adMedium");
                const adDescription = str("adDescription");
                const tagline = str("tagline");
                const website = str("website");
                const seedSourceType = str("seedSourceType");
                const radarScore = num("radarScore");
                const dataQualityScore = num("dataQualityScore");
                const contactReadyScore = num("contactReadyScore");
                const scoringBucket = str("scoringBucket");
                const crawlEmails = Array.isArray(rd.crawlEmails) ? (rd.crawlEmails as string[]) : [];
                const crawlPhones = Array.isArray(rd.crawlPhones) ? (rd.crawlPhones as string[]) : [];
                const crawlSocials = Array.isArray(rd.crawlSocials) ? (rd.crawlSocials as string[]) : [];
                const crawlContactForm = str("crawlContactForm");

                return (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wide font-semibold flex items-center gap-1">
                      <Megaphone className="h-3 w-3" /> Ad Capture Details
                    </p>
                    {adMedium && (
                      <div className="flex items-center gap-2 text-sm">
                        <Image className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Medium: <strong>{adMedium}</strong></span>
                      </div>
                    )}
                    {adDescription && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-300">{adDescription}</p>
                    )}
                    {tagline && (
                      <p className="text-sm italic text-neutral-500">"{tagline}"</p>
                    )}
                    {website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-3.5 w-3.5 text-neutral-400" />
                        <a href={safeHref(website)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400" data-testid="link-ad-website">
                          {website}
                        </a>
                      </div>
                    )}
                    {(radarScore !== null || dataQualityScore !== null || contactReadyScore !== null) && (
                      <div className="space-y-1" data-testid="text-radar-score">
                        <p className="text-xs text-rose-500 uppercase tracking-wide font-medium">Scoring</p>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {radarScore !== null && (
                            <span className="text-neutral-500">Prospect Fit: <strong className="text-rose-600 dark:text-rose-400">{radarScore}</strong></span>
                          )}
                          {dataQualityScore !== null && (
                            <span className="text-neutral-500">Data Quality: <strong className="text-amber-600 dark:text-amber-400">{dataQualityScore}</strong></span>
                          )}
                          {contactReadyScore !== null && (
                            <span className="text-neutral-500">Contact Ready: <strong className="text-emerald-600 dark:text-emerald-400">{contactReadyScore}</strong></span>
                          )}
                        </div>
                        {scoringBucket && (
                          <p className="text-xs text-neutral-500">Bucket: <strong>{scoringBucket}</strong></p>
                        )}
                      </div>
                    )}
                    {(crawlEmails.length > 0 || crawlPhones.length > 0 || crawlSocials.length > 0 || crawlContactForm) && (
                      <div className="border-t border-rose-200 dark:border-rose-800/30 pt-2 mt-1 space-y-1">
                        <p className="text-xs text-rose-500 uppercase tracking-wide font-medium">Crawl Results</p>
                        {crawlEmails.length > 0 && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-300" data-testid="text-crawl-emails">Emails: {crawlEmails.join(", ")}</p>
                        )}
                        {crawlPhones.length > 0 && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-300" data-testid="text-crawl-phones">Phones: {crawlPhones.join(", ")}</p>
                        )}
                        {crawlSocials.length > 0 && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-300" data-testid="text-crawl-socials">Socials: {crawlSocials.join(", ")}</p>
                        )}
                        {crawlContactForm && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-300" data-testid="text-crawl-contact-form">Contact Form: {crawlContactForm}</p>
                        )}
                      </div>
                    )}
                    {seedSourceType === "AD_SPOT" && (
                      <Badge variant="outline" className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700">
                        Pushed to Opportunity Radar
                      </Badge>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Clock className="h-3 w-3" />
                <span>Captured {new Date(selectedCapture.created_at).toLocaleString()}</span>
                {selectedCapture.captured_by_name && (
                  <>
                    <span>by</span>
                    <span>{selectedCapture.captured_by_name}</span>
                  </>
                )}
              </div>

              {selectedCapture.converted_entity_id && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Converted to {selectedCapture.converted_entity_table} ({selectedCapture.converted_entity_id.slice(0, 8)}...)</span>
                </div>
              )}

              <hr className="border-neutral-200 dark:border-neutral-700" />

              {selectedCapture.status !== "converted" && selectedCapture.status !== "discarded" && (
                <>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Review Notes</p>
                    <Textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add review notes..."
                      rows={2}
                      data-testid="input-review-notes"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      onValueChange={(status) => {
                        updateMutation.mutate({
                          id: selectedCapture.id,
                          data: { status, reviewNotes: reviewNotes || "" },
                        });
                        setSelectedCapture({ ...selectedCapture, status, review_notes: reviewNotes });
                      }}
                    >
                      <SelectTrigger className="w-[160px]" data-testid="select-update-status">
                        <SelectValue placeholder="Update Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reviewing">Reviewing</SelectItem>
                        <SelectItem value="ready_to_convert">Ready to Convert</SelectItem>
                        <SelectItem value="needs_followup">Needs Follow Up</SelectItem>
                        <SelectItem value="discarded">Discard</SelectItem>
                      </SelectContent>
                    </Select>

                    {reviewNotes && reviewNotes !== (selectedCapture.review_notes || "") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateMutation.mutate({
                            id: selectedCapture.id,
                            data: { reviewNotes },
                          });
                        }}
                        disabled={updateMutation.isPending}
                        data-testid="button-save-notes"
                      >
                        Save Notes
                      </Button>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Convert To</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CONVERT_TARGETS.map((target) => (
                        <Button
                          key={target.value}
                          variant="outline"
                          size="sm"
                          onClick={() => convertMutation.mutate({ id: selectedCapture.id, targetType: target.value })}
                          disabled={convertMutation.isPending}
                          data-testid={`button-convert-${target.value}`}
                        >
                          <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                          {target.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

interface AIExtractedEvent {
  title?: string;
  description?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  locationName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  organizerName?: string;
  organizerEmail?: string;
  organizerPhone?: string;
  costText?: string;
  category?: string;
  tags?: string[];
  websiteUrl?: string;
  rsvpUrl?: string;
  sponsors?: string[];
  confidenceScores?: Record<string, number>;
  gapFlags?: string[];
}

export function EventCaptureSection({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [captureMode, setCaptureMode] = useState<"photo" | "url">("photo");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [extractedData, setExtractedData] = useState<AIExtractedEvent | null>(null);
  const [overrides, setOverrides] = useState<Partial<AIExtractedEvent>>({});

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  const extractPhotoMutation = useMutation({
    mutationFn: async () => {
      if (!photoFile) throw new Error("No photo selected");
      const formData = new FormData();
      formData.append("photo", photoFile);
      const res = await fetch("/api/admin/intake/event-photo-extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Extraction failed");
      const json = await res.json();
      return json.extracted as AIExtractedEvent;
    },
    onSuccess: (data: AIExtractedEvent) => {
      setExtractedData(data);
      setOverrides({});
      toast({ title: "Event data extracted from photo" });
    },
    onError: (e: Error) => toast({ title: "Extraction failed", description: e.message, variant: "destructive" }),
  });

  const extractUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intake/event-url-extract", { url: sourceUrl });
      const json = await res.json();
      return json.extracted as AIExtractedEvent;
    },
    onSuccess: (data: AIExtractedEvent) => {
      setExtractedData(data);
      setOverrides({});
      toast({ title: "Event data extracted from URL" });
    },
    onError: (e: Error) => toast({ title: "Extraction failed", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const merged = { ...extractedData, ...overrides };
      return apiRequest("POST", "/api/admin/intake/event-capture-publish", {
        title: merged.title || "Untitled Event",
        description: merged.description || "",
        startDateTime: merged.startDate && merged.startTime ? `${merged.startDate}T${merged.startTime}` : merged.startDate || "",
        endDateTime: merged.endDate && merged.endTime ? `${merged.endDate}T${merged.endTime}` : undefined,
        locationName: merged.locationName || "",
        address: merged.address || "",
        city: merged.city || "",
        state: merged.state || "",
        zip: merged.zip || "",
        costText: merged.costText || "",
        organizerName: merged.organizerName || "",
        organizerEmail: merged.organizerEmail || "",
        organizerPhone: merged.organizerPhone || "",
        capturePhotoUrl: captureMode === "photo" && photoFile ? photoFile.name : undefined,
        sourceUrl: captureMode === "url" ? sourceUrl : undefined,
        aiExtractedData: extractedData,
        aiConfidenceScores: extractedData?.confidenceScores || {},
        aiGapFlags: extractedData?.gapFlags || [],
        cityId: cityId || "",
        zoneId: "",
      });
    },
    onSuccess: () => {
      toast({ title: "Event created from capture" });
      setExtractedData(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      setSourceUrl("");
      setOverrides({});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const merged = extractedData ? { ...extractedData, ...overrides } : null;
  const isExtracting = extractPhotoMutation.isPending || extractUrlMutation.isPending;

  const getConfidence = (field: string) => {
    const score = extractedData?.confidenceScores?.[field];
    if (score === undefined) return null;
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4" />
          AI Event Capture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={captureMode} onValueChange={(v) => setCaptureMode(v as "photo" | "url")}>
          <TabsList className="h-8">
            <TabsTrigger value="photo" className="text-xs" data-testid="tab-capture-photo">
              <Camera className="h-3 w-3 mr-1" /> Photo / Flyer
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs" data-testid="tab-capture-url">
              <Globe className="h-3 w-3 mr-1" /> URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photo" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Upload flyer, poster, or event screenshot</Label>
              <div className="flex items-center gap-2">
                <label
                  className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground w-full justify-center"
                  data-testid="label-capture-photo-upload"
                >
                  <Camera className="h-4 w-4" />
                  {photoFile ? photoFile.name : "Choose photo or take picture"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChange}
                    data-testid="input-capture-photo-file"
                  />
                </label>
              </div>
              {photoPreview && (
                <div className="relative w-full max-h-48 overflow-hidden rounded-lg border">
                  <img src={photoPreview} alt="Captured photo" className="w-full h-auto object-contain max-h-48" />
                </div>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => extractPhotoMutation.mutate()}
              disabled={!photoFile || isExtracting}
              data-testid="button-extract-photo"
            >
              {isExtracting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Extract Event Details
            </Button>
          </TabsContent>

          <TabsContent value="url" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Event page URL</Label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://eventbrite.com/e/..."
                data-testid="input-capture-source-url"
              />
            </div>
            <Button
              size="sm"
              onClick={() => extractUrlMutation.mutate()}
              disabled={!sourceUrl || isExtracting}
              data-testid="button-extract-url"
            >
              {isExtracting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1" />}
              Extract from URL
            </Button>
          </TabsContent>
        </Tabs>

        {merged && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Extracted Data
              </h4>
              {extractedData?.gapFlags && extractedData.gapFlags.length > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300" data-testid="badge-gap-flags">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {extractedData.gapFlags.length} gap{extractedData.gapFlags.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {extractedData?.gapFlags && extractedData.gapFlags.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Missing or low-confidence fields:</p>
                <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5">
                  {extractedData.gapFlags.map((gap, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className={`text-xs flex items-center gap-1 ${getConfidence("title") || ""}`}>Title</Label>
                <Input
                  value={overrides.title ?? merged.title ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, title: e.target.value }))}
                  data-testid="input-extracted-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs flex items-center gap-1 ${getConfidence("startDate") || ""}`}>Start Date</Label>
                <Input
                  type="date"
                  value={overrides.startDate ?? merged.startDate ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, startDate: e.target.value }))}
                  data-testid="input-extracted-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("startTime") || ""}`}>Start Time</Label>
                <Input
                  type="time"
                  value={overrides.startTime ?? merged.startTime ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, startTime: e.target.value }))}
                  data-testid="input-extracted-start-time"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("endDate") || ""}`}>End Date</Label>
                <Input
                  type="date"
                  value={overrides.endDate ?? merged.endDate ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, endDate: e.target.value }))}
                  data-testid="input-extracted-end-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("endTime") || ""}`}>End Time</Label>
                <Input
                  type="time"
                  value={overrides.endTime ?? merged.endTime ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, endTime: e.target.value }))}
                  data-testid="input-extracted-end-time"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("locationName") || ""}`}>Venue</Label>
                <Input
                  value={overrides.locationName ?? merged.locationName ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, locationName: e.target.value }))}
                  data-testid="input-extracted-location"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("address") || ""}`}>Address</Label>
                <Input
                  value={overrides.address ?? merged.address ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, address: e.target.value }))}
                  data-testid="input-extracted-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("organizerName") || ""}`}>Organizer</Label>
                <Input
                  value={overrides.organizerName ?? merged.organizerName ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, organizerName: e.target.value }))}
                  data-testid="input-extracted-organizer"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("costText") || ""}`}>Cost</Label>
                <Input
                  value={overrides.costText ?? merged.costText ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, costText: e.target.value }))}
                  data-testid="input-extracted-cost"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("organizerEmail") || ""}`}>Organizer Email</Label>
                <Input
                  value={overrides.organizerEmail ?? merged.organizerEmail ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, organizerEmail: e.target.value }))}
                  data-testid="input-extracted-org-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${getConfidence("organizerPhone") || ""}`}>Organizer Phone</Label>
                <Input
                  value={overrides.organizerPhone ?? merged.organizerPhone ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, organizerPhone: e.target.value }))}
                  data-testid="input-extracted-org-phone"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className={`text-xs ${getConfidence("description") || ""}`}>Description</Label>
                <Textarea
                  value={overrides.description ?? merged.description ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, description: e.target.value }))}
                  rows={3}
                  data-testid="input-extracted-description"
                />
              </div>
            </div>

            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || !merged.title}
              className="w-full"
              data-testid="button-publish-captured-event"
            >
              {publishMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Publishing...</>
              ) : (
                <><CalendarDays className="h-3.5 w-3.5 mr-1" /> Publish as Event</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
