import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2, Calendar, FileText, MapPin,
  Check, X, Clock, LogOut, TrendingUp, Mail,
  Search, RefreshCw, Send, Star, ExternalLink, Edit, Megaphone, Menu, Copy, Eye,
  LayoutDashboard, ClipboardList, Download, Users, UserCheck, PenTool, ChevronDown,
  FileSpreadsheet, Crown, Landmark, Bot, ArrowRightLeft, Shield, BookOpen, MessageSquare,
  Merge, AlertTriangle, Smartphone, Inbox as InboxIcon, Contact, Tag, Rss,
  Monitor, Target, Zap, Sparkles, ShieldCheck, Languages, KeyRound, UserPlus, CheckCircle,
  Archive, ArchiveRestore, UserX, SquareCheckBig, CreditCard, ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Loader2, AlertCircle, Globe, Phone, Trash2, ListOrdered, ArrowUp, ArrowDown, EyeOff, ArrowLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useDefaultCityId, useAdminCitySelection } from "@/hooks/use-city";
import type { AdminMode } from "@/hooks/use-city";
import type { Business, City, ProfileBadge } from "@shared/schema";
import { BizImage } from "@/components/biz-image";
import { BUSINESS_ATTRIBUTES, VENUE_SCREEN_PROVIDERS } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { PhotoUpload } from "@/components/photo-upload";
import CustomerOps from "./customer-ops";
import ContentIntake from "./content-intake";
import FieldCapturesPanel from "./field-captures-panel";
import AdManager from "./ad-manager";
import MapPlacementsPanel from "./map-placements-panel";
import AdManagementPanel from "./ad-management-panel";
import RevenueControlsPanel from "./revenue-controls-panel";
import { AdminSidebar, menuGroups, intelligenceGroup, superAdminGroup, operatorGroup, platformOverviewGroup } from "./admin-sidebar";
import PlatformIntelligenceDashboard from "./platform-intelligence-dashboard";
import { EntityIntelligenceCard } from "@/components/admin/entity-intelligence-card";
import { TrustSection } from "@/components/admin/trust-section";
import AuthorsPanel from "./authors-panel";
import ArticlesPanel from "./articles-panel";
import CsvImport from "./csv-import";
import AffiliatesPanel from "./affiliates-panel";
import AmbassadorManagementPanel from "./ambassador-management-panel";
import VerifiedContributorsPanel from "./verified-contributors-panel";
import ListingTiers from "./listing-tiers";
import AiAssistant from "./ai-assistant";
import AttractionsPanel from "./attractions-panel";
import ReviewModeration from "./review-moderation";
import SubscribersPanel from "./subscribers-panel";
import TransferPanel from "./transfer-panel";
import EnterpriseReviewsPanel from "./enterprise-reviews";
import ContentJournalPanel from "./content-journal";
import SourceRequestsPanel from "./source-requests-panel";
import PulseVideosPanel from "./pulse-videos-panel";
import PulseIssuesPanel from "./pulse-issues-panel";
import MicroPubPanel from "./micro-pub-panel";
import MarketplacePanel from "./marketplace-panel";
import RegionsPanel from "./regions-panel";
import CmsDashboard from "./cms-dashboard";
import CmsContentLibrary from "./cms-content-library";
import CmsContentEditor from "./cms-content-editor";
import CmsMediaLibrary from "./cms-media-library";
import CmsTagsManager from "./cms-tags-manager";
import FeedDebugPanel from "./feed-debug";
import CmsEditorialCalendar from "./cms-editorial-calendar";
import WeeklyDigestPanel from "./weekly-digest-panel";
import EmailTemplatesPanel from "./email-templates-panel";
import EmailCampaignsPanel from "./email-campaigns-panel";
import EmailSuppressionPanel from "./email-suppression-panel";
import VendorsPanel from "./vendors-panel";
import CrmEventsPanel from "./crm-events-panel";
import EventRsvpsPanel from "./event-rsvps-panel";
import InboxPanel from "./inbox-panel";
import PlacesImportPanel from "./places-import-panel";
import QuickClaimPanel from "./quick-claim-panel";
import ListingsToClaimPanel from "./listings-to-claim-panel";
import CharlotteChatPanel from "./charlotte-chat-panel";
import ZipGeosPanel from "./zip-geos-panel";
import HubsCoveragePanel from "./hubs-coverage-panel";
import TeachCharlottePanel from "./teach-charlotte-panel";
import FeatureAuditPanel from "./feature-audit-panel";
import CommsLogPanel from "./comms-log-panel";
import LicensingPanel from "./licensing-panel";
import RevenuePanel from "./revenue-panel";
import LicenseCrmPanel from "./license-crm-panel";
import EventsPanel from "./events-panel";
import CategoriesPanel from "./categories-panel";
import ZoneEditPanel from "./zone-edit-panel";
import CoverageAuditPanel from "./coverage-audit-panel";
import LeadsPanel from "./leads-panel";
import { CrmContactCard } from "@/components/admin/crm-contact-card";
import { BusinessActivitySections } from "@/components/admin/business-activity-sections";
import ContactsPanel from "./contacts-panel";
import ReferralsPanel from "./referrals-panel";
import NudgesPanel from "./nudges-panel";
import MileagePanel from "./mileage-panel";
import DigitalCardsPanel from "./digital-cards-panel";
import IntelligencePanel from "./intelligence-panel";
import { PulseIntelligencePanel, OutreachQueuePanel, ContentDraftsPanel } from "./pulse-intelligence-panel";
import CaptureOutreachPanel from "./capture-outreach-panel";
import ReportRequestsPanel from "./report-requests-panel";
import PayoutManagementPanel from "./payout-management-panel";
import ItexTradesPanel from "./itex-trades-panel";
import AuditLogPanel from "./audit-log-panel";
import TierInquiryPanel from "./tier-inquiry-panel";
import ListingAddonsPanel from "./listing-addons-panel";
import SiteBuilderDemoPanel from "./site-builder-demo-panel";
import AdminSiteBuilder from "./admin-site-builder";
import { HubManagementPanel } from "./hub-management-panel";
import MetroManagementPanel from "./metro-management-panel";
import TerritorySalesPanel from "./territory-sales-panel";
import { MyHubPanel } from "./my-hub-panel";
import LiveBroadcastPanel from "./live-broadcast-panel";
import ModerationPanel from "./moderation-panel";
import RadioManagementPanel from "./radio-management-panel";
import ShopManagementPanel from "./shop-management";
import ProviderManagement from "./provider-management";
import PulsePostsPanel from "./pulse-posts-panel";
import CommunicationsHub from "./communications-hub";
import MessageCenterPanel from "./message-center-panel";
import ModerationHub from "./moderation-hub";
import JobsModerationPanel from "./jobs-moderation-panel";
import LiveFeedsPanel from "./live-feeds-panel";
import TvPanel from "./tv-panel";
import VenueChannelsPanel from "./venue-channels-panel";
import ContentPagesPanel from "./content-pages-panel";
import TranslationDashboard from "./translation-dashboard";
import MessagingLibraryPanel from "./messaging-library-panel";
import SocialPublishingPanel from "./social-publishing-panel";
import ContentStudioPanel from "./content-studio-panel";
import MusicLibraryPanel from "./music-library-panel";
import PodcastDirectoryPanel from "./podcast-directory-panel";
import RadioAdsPanel from "./radio-ads-panel";
import { AdminCharlotteSheet } from "./admin-charlotte-bubble";
import PlatformHqDashboard from "./platform-hq-dashboard";
import CharlotteReport from "./charlotte-report";
import CharlotteOpsPanel from "./charlotte-ops-panel";
import CharlotteTasksPanel from "./charlotte-tasks-panel";
import CharlotteInsightsPanel from "./charlotte-insights-panel";
import EngagementHub from "./engagement-hub";
import CrownAdmin from "./crown-admin";
import OpportunityRadar from "./opportunity-radar";
import QrGeneratorPanel from "./qr-generator-panel";
import WorkforceOverviewPanel from "./workforce-overview-panel";
import JobCategoriesPanel from "./job-categories-panel";
import EntitlementManagementPanel from "./entitlement-management-panel";
import PackageManagementPanel from "./package-management-panel";
import PricingPanel from "./pricing-panel";
import CoraPanel from "./cora-panel";
import CoraVoicePanel from "./cora-voice-panel";
import GiveawayAdmin from "./giveaway-admin";
import OperatorHqPanel from "./operator-hq-panel";
import WorkflowSessionsPanel from "./workflow-sessions-panel";
import AutomationPanel from "./automation-panel";
import StoryStudioPanel from "./story-studio-panel";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import { SeoScoreCard } from "@/components/seo-score-card";
import { AeoScoreCard } from "@/components/aeo-score-card";

interface AdminStats {
  businesses: number;
  events: number;
  articles: number;
  submissions: number;
  leads: number;
  zones: number;
}

interface AdminSubmission {
  id: string;
  type: string;
  status: string;
  submitterName: string;
  submitterEmail: string;
  createdAt: string;
  payload: any;
}

interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface PlaceDetails {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  mapsUrl: string;
}

function GooglePlacesSearch({ onSelect }: { onSelect: (details: PlaceDetails & { placeId: string }) => void }) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = useCallback(async (input: string) => {
    if (input.length < 3) { setPredictions([]); return; }
    setSearching(true);
    try {
      const resp = await fetch(`/api/google/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await resp.json();
      setPredictions(data.predictions || []);
    } catch { setPredictions([]); }
    setSearching(false);
  }, []);

  const selectPlace = async (placeId: string) => {
    try {
      const resp = await fetch(`/api/google/places/details?placeId=${placeId}`);
      const details = await resp.json();
      onSelect({ ...details, placeId });
      setPredictions([]);
      setQuery("");
    } catch {}
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); doSearch(e.target.value); }}
          placeholder="Search business on Google..."
          data-testid="input-google-search"
        />
        {searching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {predictions.length > 0 && (
        <Card className="divide-y">
          {predictions.map((p) => (
            <button
              key={p.placeId}
              className="w-full text-left px-3 py-2 text-sm hover-elevate"
              onClick={() => selectPlace(p.placeId)}
              data-testid={`button-place-${p.placeId}`}
            >
              <span className="font-medium">{p.mainText}</span>
              <span className="text-muted-foreground ml-1 text-xs">{p.secondaryText}</span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

const BADGE_TYPES = [
  { type: "BUSINESS", label: "Business", icon: "Building2" },
  { type: "ORGANIZATION", label: "Organization", icon: "Building" },
  { type: "NONPROFIT", label: "Nonprofit", icon: "Heart" },
  { type: "PODCAST", label: "Podcast", icon: "Headphones" },
  { type: "CREATOR", label: "Creator", icon: "Video" },
  { type: "CONTRIBUTOR", label: "Contributor", icon: "PenTool" },
  { type: "LOCAL_EXPERT", label: "Local Expert", icon: "Award" },
  { type: "SPEAKER", label: "Speaker", icon: "Mic" },
  { type: "VENUE", label: "Venue", icon: "MapPin" },
  { type: "ARTIST", label: "Artist", icon: "Palette" },
  { type: "PHOTOGRAPHER", label: "Photographer", icon: "Camera" },
  { type: "AUTHOR", label: "Author", icon: "BookOpen" },
  { type: "MUSICIAN", label: "Musician", icon: "Music" },
  { type: "MAKER", label: "Maker", icon: "Hammer" },
  { type: "INSTRUCTOR", label: "Instructor", icon: "GraduationCap" },
  { type: "COMMUNITY_LEADER", label: "Community Leader", icon: "Users" },
  { type: "EVENT_HOST", label: "Event Host", icon: "CalendarCheck" },
  { type: "PRESS_SOURCE", label: "Press Source", icon: "Newspaper" },
] as const;

function BadgeManager({ businessId }: { businessId: string }) {
  const { toast } = useToast();
  const { data: badges, isLoading } = useQuery<ProfileBadge[]>({
    queryKey: ["/api/admin/businesses", businessId, "badges"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ badgeType, enabled }: { badgeType: string; enabled: boolean }) => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/badges/bulk-toggle`, {
        badges: [{ badgeType, enabled }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "badges"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/businesses") });
      toast({ title: "Badge updated" });
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const badgeMap = new Map((badges || []).map(b => [b.badgeType, b]));

  return (
    <Card className="p-4 space-y-3" data-testid="section-badge-manager">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Profile Badges</p>
        <p className="text-xs text-muted-foreground">Toggle modules on/off</p>
      </div>
      <div className="space-y-2">
        {BADGE_TYPES.map((bt) => {
          const existing = badgeMap.get(bt.type);
          const isEnabled = existing?.enabled ?? false;
          return (
            <div key={bt.type} className="flex items-center justify-between py-1" data-testid={`toggle-badge-${bt.type.toLowerCase()}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{bt.label}</span>
              </div>
              <Switch
                checked={isEnabled}
                disabled={toggleMutation.isPending}
                onCheckedChange={(checked) => toggleMutation.mutate({ badgeType: bt.type, enabled: checked })}
                data-testid={`switch-badge-${bt.type.toLowerCase()}`}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FaqManagementSection({ businessId, businessName }: { businessId: string; businessName: string }) {
  const { toast } = useToast();
  const [addingFaq, setAddingFaq] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");

  const { data: existingFaqs, isLoading: faqsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "faqs"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/businesses/${businessId}/faqs`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/admin/businesses/${businessId}/generate-faqs`);
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "faqs"] });
      toast({ title: "SEO FAQs Generated", description: `${data.generated} FAQ${data.generated !== 1 ? "s" : ""} created for ${businessName}` });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message || "Could not generate FAQs", variant: "destructive" });
    },
  });

  const addFaqMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/admin/businesses/${businessId}/faqs`, {
        question: newQuestion,
        answer: newAnswer,
        sortOrder: (existingFaqs?.length || 0),
      });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "faqs"] });
      setNewQuestion("");
      setNewAnswer("");
      setAddingFaq(false);
      toast({ title: "FAQ added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add FAQ", description: err.message, variant: "destructive" });
    },
  });

  const updateFaqMutation = useMutation({
    mutationFn: async (faqId: string) => {
      await apiRequest("PATCH", `/api/admin/businesses/${businessId}/faqs/${faqId}`, {
        question: editQuestion,
        answer: editAnswer,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "faqs"] });
      setEditingFaqId(null);
      toast({ title: "FAQ updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update FAQ", description: err.message, variant: "destructive" });
    },
  });

  const deleteFaqMutation = useMutation({
    mutationFn: async (faqId: string) => {
      await apiRequest("DELETE", `/api/admin/businesses/${businessId}/faqs/${faqId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "faqs"] });
      toast({ title: "FAQ deleted" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (faqIds: string[]) => {
      await apiRequest("PUT", `/api/admin/businesses/${businessId}/faqs/reorder`, { faqIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "faqs"] });
    },
  });

  const moveFaq = (index: number, direction: "up" | "down") => {
    if (!existingFaqs) return;
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= existingFaqs.length) return;
    const ids = existingFaqs.map((f: any) => f.id);
    [ids[index], ids[newIdx]] = [ids[newIdx], ids[index]];
    reorderMutation.mutate(ids);
  };

  const faqCount = existingFaqs?.length || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-muted-foreground">{faqCount} FAQ{faqCount !== 1 ? "s" : ""} — feeds microsite FAQ display & SEO/AEO structured data</p>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddingFaq(true)}
            disabled={addingFaq}
            data-testid="button-add-faq"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Q&A
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-seo-faqs"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Bot className="h-3 w-3 mr-1" />
            )}
            AI Generate
          </Button>
        </div>
      </div>

      {addingFaq && (
        <div className="rounded-md border p-3 space-y-2 bg-muted/20">
          <Input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Question..."
            className="text-xs"
            data-testid="input-new-faq-question"
          />
          <Textarea
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            placeholder="Answer..."
            rows={2}
            className="text-xs"
            data-testid="input-new-faq-answer"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={() => addFaqMutation.mutate()}
              disabled={addFaqMutation.isPending || !newQuestion.trim() || !newAnswer.trim()}
              data-testid="button-save-new-faq"
            >
              {addFaqMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingFaq(false); setNewQuestion(""); setNewAnswer(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {faqsLoading && <Skeleton className="h-16 w-full" />}
      {existingFaqs && existingFaqs.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {existingFaqs.map((faq: any, idx: number) => (
            <div key={faq.id} className="rounded-md border p-2 space-y-0.5">
              {editingFaqId === faq.id ? (
                <div className="space-y-2">
                  <Input
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    className="text-xs"
                    data-testid={`input-edit-faq-question-${faq.id}`}
                  />
                  <Textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    rows={2}
                    className="text-xs"
                    data-testid={`input-edit-faq-answer-${faq.id}`}
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => updateFaqMutation.mutate(faq.id)}
                      disabled={updateFaqMutation.isPending}
                      data-testid={`button-update-faq-${faq.id}`}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingFaqId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-tight flex-1">{faq.question}</p>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => moveFaq(idx, "up")}
                        disabled={idx === 0 || reorderMutation.isPending}
                        data-testid={`button-faq-up-${faq.id}`}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => moveFaq(idx, "down")}
                        disabled={idx === existingFaqs.length - 1 || reorderMutation.isPending}
                        data-testid={`button-faq-down-${faq.id}`}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingFaqId(faq.id);
                          setEditQuestion(faq.question);
                          setEditAnswer(faq.answer);
                        }}
                        data-testid={`button-edit-faq-${faq.id}`}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => deleteFaqMutation.mutate(faq.id)}
                        disabled={deleteFaqMutation.isPending}
                        data-testid={`button-delete-faq-${faq.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">{faq.answer}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  hero: "Hero Banner",
  about: "About",
  services: "Services",
  gallery: "Gallery",
  testimonials: "Testimonials",
  cta: "Call to Action",
  faq: "FAQ",
  team: "Team",
  hours: "Hours & Location",
  contact: "Contact",
  reviews: "Reviews",
};

interface DraftBlock {
  id: string;
  type: string;
  enabled: boolean;
  sortOrder: number;
  content: Record<string, unknown>;
}

function MicrositeDraftReviewPanel({
  businessId,
  blocks: initialBlocks,
  onSaved,
  toast,
}: {
  businessId: string;
  blocks: DraftBlock[];
  onSaved: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [expanded, setExpanded] = useState(false);
  const [localBlocks, setLocalBlocks] = useState<DraftBlock[]>(() =>
    [...initialBlocks].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocalBlocks([...initialBlocks].sort((a, b) => a.sortOrder - b.sortOrder));
    setDirty(false);
  }, [initialBlocks]);

  const saveMutation = useMutation({
    mutationFn: async (updatedBlocks: DraftBlock[]) => {
      const resp = await fetch(`/api/admin/businesses/${businessId}/microsite/draft-blocks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ blocks: updatedBlocks }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Save failed" }));
        throw new Error(err.message);
      }
      return resp.json();
    },
    onSuccess: () => {
      setDirty(false);
      toast({ title: "Draft blocks saved" });
      onSaved();
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleBlock = (idx: number) => {
    setLocalBlocks(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
      return updated;
    });
    setDirty(true);
  };

  const moveBlock = (idx: number, direction: "up" | "down") => {
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= localBlocks.length) return;
    setLocalBlocks(prev => {
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[target];
      updated[target] = temp;
      return updated.map((b, i) => ({ ...b, sortOrder: i }));
    });
    setDirty(true);
  };

  const getBlockPreview = (block: DraftBlock): string => {
    const c = block.content;
    const headlineObj = c.headline as { en?: string } | undefined;
    if (headlineObj?.en) return headlineObj.en;
    const bodyObj = c.body as { en?: string } | undefined;
    if (bodyObj?.en) return bodyObj.en.substring(0, 80) + (bodyObj.en.length > 80 ? "..." : "");
    const items = c.items as unknown[] | undefined;
    if (Array.isArray(items) && items.length > 0) return `${items.length} item${items.length !== 1 ? "s" : ""}`;
    return "No content";
  };

  const enabledCount = localBlocks.filter(b => b.enabled).length;

  return (
    <div className="border rounded-md" data-testid="section-microsite-draft-review">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        onClick={() => setExpanded(prev => !prev)}
        data-testid="button-toggle-draft-review"
      >
        <span className="text-xs font-medium">
          Draft Blocks ({enabledCount}/{localBlocks.length} enabled)
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-1.5 space-y-1.5">
          {localBlocks.map((block, idx) => (
            <div
              key={block.id}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-[11px] border ${block.enabled ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-950 opacity-60"}`}
              data-testid={`draft-block-${block.id}`}
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="p-0"
                  onClick={() => moveBlock(idx, "up")}
                  disabled={idx === 0}
                  data-testid={`button-move-up-${block.id}`}
                >
                  <ArrowUp className={`h-3 w-3 ${idx === 0 ? "text-zinc-300 dark:text-zinc-700" : "text-muted-foreground"}`} />
                </button>
                <button
                  type="button"
                  className="p-0"
                  onClick={() => moveBlock(idx, "down")}
                  disabled={idx === localBlocks.length - 1}
                  data-testid={`button-move-down-${block.id}`}
                >
                  <ArrowDown className={`h-3 w-3 ${idx === localBlocks.length - 1 ? "text-zinc-300 dark:text-zinc-700" : "text-muted-foreground"}`} />
                </button>
              </div>

              <Switch
                checked={block.enabled}
                onCheckedChange={() => toggleBlock(idx)}
                className="scale-75"
                data-testid={`switch-block-${block.id}`}
              />

              <div className="flex-1 min-w-0">
                <div className="font-medium text-[11px]">{BLOCK_TYPE_LABELS[block.type] || block.type}</div>
                <div className="text-[10px] text-muted-foreground truncate">{getBlockPreview(block)}</div>
              </div>

              <Badge variant="outline" className="text-[9px] shrink-0" data-testid={`badge-block-type-${block.id}`}>
                {block.type}
              </Badge>
            </div>
          ))}

          {dirty && (
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="default"
                className="text-[11px] px-3 gap-1"
                onClick={() => saveMutation.mutate(localBlocks)}
                disabled={saveMutation.isPending}
                data-testid="button-save-draft-blocks"
              >
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MicrositeSection({ business, toast }: { business: Business; toast: ReturnType<typeof useToast>["toast"] }) {
  const isEnhanced = business.listingTier === "ENHANCED" || business.listingTier === "ENTERPRISE";

  const { data: statusData, refetch: refetchStatus } = useQuery<{
    websiteCrawlStatus: string | null;
    websiteLastCrawledAt: string | null;
    micrositeGenerationStatus: string;
    micrositeLastGeneratedAt: string | null;
    micrositePublishedAt: string | null;
    micrositeDraftBlocks: unknown[] | null;
    micrositeDraftMeta: Record<string, unknown> | null;
    micrositeEnabled: boolean;
    micrositeBlocks: unknown[] | null;
    activeJob: { status: string; error?: string } | null;
  }>({
    queryKey: ["/api/admin/businesses", business.id, "microsite-status"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/businesses/${business.id}/microsite/status`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to fetch status");
      return resp.json();
    },
    enabled: isEnhanced,
    refetchInterval: (query) => {
      const data = query.state.data;
      const activeStatus = data?.activeJob?.status;
      if (activeStatus === "crawling" || activeStatus === "generating") return 3000;
      return false;
    },
  });

  const refreshCrawlMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/admin/businesses/${business.id}/microsite/refresh-crawl`, {
        method: "POST",
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      toast({ title: "Website data refreshed" });
      refetchStatus();
    },
    onError: (err: Error) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/admin/businesses/${business.id}/microsite/generate`, {
        method: "POST",
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      toast({ title: "Microsite generation started", description: "Charlotte is crawling and generating draft blocks..." });
      refetchStatus();
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const refreshAndRegenerateMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/admin/businesses/${business.id}/microsite/refresh-and-regenerate`, {
        method: "POST",
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      toast({ title: "Refresh + regenerate started", description: "Re-crawling website and generating fresh draft..." });
      refetchStatus();
    },
    onError: (err: Error) => {
      toast({ title: "Refresh + regenerate failed", description: err.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/admin/businesses/${business.id}/microsite/publish-draft`, {
        method: "POST",
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      toast({ title: "Microsite published", description: "Draft blocks are now live on the listing" });
      refetchStatus();
    },
    onError: (err: Error) => {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    },
  });

  if (!isEnhanced) return null;

  const jobStatus = statusData?.activeJob?.status;
  const genStatus = statusData?.micrositeGenerationStatus || "none";
  const crawlStatus = statusData?.websiteCrawlStatus;
  const isWorking = jobStatus === "crawling" || jobStatus === "generating";
  const hasDraft = genStatus === "draft_ready" || genStatus === "needs_review" || (Array.isArray(statusData?.micrositeDraftBlocks) && statusData.micrositeDraftBlocks.length > 0);
  const isLive = statusData?.micrositeEnabled && statusData?.micrositePublishedAt;
  const draftMeta = statusData?.micrositeDraftMeta;
  const draftBlockCount = Array.isArray(statusData?.micrositeDraftBlocks) ? statusData.micrositeDraftBlocks.length : 0;
  const enabledBlockCount = Array.isArray(statusData?.micrositeDraftBlocks)
    ? (statusData.micrositeDraftBlocks as Array<{ enabled?: boolean }>).filter(b => b.enabled !== false).length
    : 0;
  const anyMutationPending = refreshCrawlMutation.isPending || generateMutation.isPending || refreshAndRegenerateMutation.isPending || publishMutation.isPending;

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="rounded-md border p-3 space-y-2.5" data-testid="section-microsite">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Microsite Draft Generator</h4>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="section-microsite-status-indicators">
        <div className="flex items-center gap-1">
          {crawlStatus === "crawled" ? (
            <Check className="h-3 w-3 text-emerald-600" />
          ) : crawlStatus === "crawling" || (isWorking && jobStatus === "crawling") ? (
            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
          ) : (
            <Globe className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-[11px] text-muted-foreground" data-testid="text-crawl-status">
            {crawlStatus === "crawled" ? "Website Crawled" : isWorking && jobStatus === "crawling" ? "Crawling..." : crawlStatus || "Not crawled"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {genStatus === "needs_review" ? (
            <AlertTriangle className="h-3 w-3 text-amber-600" />
          ) : genStatus === "draft_ready" ? (
            <Check className="h-3 w-3 text-emerald-600" />
          ) : isWorking && jobStatus === "generating" ? (
            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
          ) : genStatus === "error" ? (
            <AlertCircle className="h-3 w-3 text-red-600" />
          ) : (
            <FileText className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={`text-[11px] ${genStatus === "needs_review" ? "text-amber-600 font-medium" : genStatus === "error" ? "text-red-600" : "text-muted-foreground"}`} data-testid="text-generation-status">
            {genStatus === "needs_review" ? "Needs Review" : genStatus === "draft_ready" ? "Draft Ready" : isWorking && jobStatus === "generating" ? "Generating..." : genStatus === "error" ? "Error" : "No draft"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isLive ? (
            <CheckCircle className="h-3 w-3 text-emerald-600" />
          ) : (
            <Monitor className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={`text-[11px] ${isLive ? "text-emerald-600 font-medium" : "text-muted-foreground"}`} data-testid="text-live-status">
            {isLive ? "Microsite Live" : "Not published"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground" data-testid="section-microsite-timestamps">
        {statusData?.websiteLastCrawledAt && (
          <span data-testid="text-last-crawled">Crawled: {formatDate(statusData.websiteLastCrawledAt)}</span>
        )}
        {statusData?.micrositeLastGeneratedAt && (
          <span data-testid="text-last-generated">Generated: {formatDate(statusData.micrositeLastGeneratedAt)}</span>
        )}
        {statusData?.micrositePublishedAt && (
          <span data-testid="text-last-published">Published: {formatDate(statusData.micrositePublishedAt)}</span>
        )}
      </div>

      {genStatus === "error" && statusData?.activeJob?.error && (
        <div className="text-[11px] text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5" data-testid="text-microsite-error">
          {statusData.activeJob.error}
        </div>
      )}

      {hasDraft && !isWorking && draftMeta && (
        <div className="text-[11px] text-muted-foreground space-y-0.5" data-testid="section-microsite-draft-info">
          <div>{draftBlockCount} blocks ({enabledBlockCount} enabled)</div>
          {typeof draftMeta.pagesCrawled === "number" && (
            <div>{draftMeta.pagesCrawled} pages crawled from {String(draftMeta.sourceUrl || "website")}</div>
          )}
          {draftMeta.usedFallback && <div className="text-amber-600">Generated without AI (fallback mode)</div>}
          {draftMeta.aiNotes && <div className="italic">{String(draftMeta.aiNotes)}</div>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="section-microsite-actions">
        {!business.websiteUrl ? (
          <span className="text-[11px] text-muted-foreground">Add a website URL to enable microsite generation</span>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] px-2 gap-1"
              onClick={() => refreshCrawlMutation.mutate()}
              disabled={isWorking || anyMutationPending}
              data-testid="button-refresh-website-data"
            >
              {refreshCrawlMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh Website Data
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-[11px] px-2 gap-1"
              onClick={() => generateMutation.mutate()}
              disabled={isWorking || anyMutationPending}
              data-testid="button-generate-microsite"
            >
              {(generateMutation.isPending || isWorking) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {hasDraft ? "Regenerate Draft" : "Generate Microsite Draft"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-[11px] px-2 gap-1"
              onClick={() => refreshAndRegenerateMutation.mutate()}
              disabled={isWorking || anyMutationPending || !hasDraft}
              data-testid="button-refresh-and-regenerate"
            >
              {refreshAndRegenerateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Refresh + Regenerate
            </Button>

            {hasDraft && !isWorking && (
              <Button
                size="sm"
                variant="default"
                className="text-[11px] px-2 gap-1"
                onClick={() => publishMutation.mutate()}
                disabled={anyMutationPending}
                data-testid="button-publish-microsite-draft"
              >
                {publishMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                {isLive ? "Republish Draft" : "Publish to Listing"}
              </Button>
            )}
          </>
        )}
      </div>

      {hasDraft && !isWorking && Array.isArray(statusData?.micrositeDraftBlocks) && statusData.micrositeDraftBlocks.length > 0 && (
        <MicrositeDraftReviewPanel
          businessId={business.id}
          blocks={statusData.micrositeDraftBlocks as Array<{ id: string; type: string; enabled: boolean; sortOrder: number; content: Record<string, unknown> }>}
          onSaved={() => refetchStatus()}
          toast={toast}
        />
      )}
    </div>
  );
}

const FOOD_RESTAURANT_SLUGS = [
  "restaurants", "food", "restaurants-dining", "bars-nightlife", "bakeries",
  "cafes-coffee-shops", "food-trucks", "catering", "fast-food", "pizza",
  "brewery", "breweries-wineries", "ice-cream-desserts",
];
const FARM_SLUGS = ["local-farms-food-sources", "farms", "farm", "farmers-market"];
const HEALTHCARE_SLUGS = [
  "healthcare", "health-wellness", "medical", "dental", "chiropractic",
  "mental-health", "therapy", "wellness", "spa", "fitness", "yoga",
  "veterinary", "optometry", "pharmacy",
];

function isFoodCategory(slug: string): boolean {
  return FOOD_RESTAURANT_SLUGS.some(s => slug.toLowerCase().includes(s));
}
function isFarmCategory(slug: string): boolean {
  return FARM_SLUGS.some(s => slug.toLowerCase().includes(s));
}
function isHealthcareCategory(slug: string): boolean {
  return HEALTHCARE_SLUGS.some(s => slug.toLowerCase().includes(s));
}

function EditSection({ title, icon, defaultOpen, children, testId }: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border rounded-md overflow-hidden" data-testid={testId}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold hover:bg-muted/30 transition-colors bg-muted/10"
        onClick={() => setOpen(!open)}
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        {icon}
        {title}
        <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 py-3 space-y-2 border-t">{children}</div>}
    </div>
  );
}

function CrmContactSearch({ businessId, onAttach }: { businessId: string; onAttach: (contact: any) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const { adminMode: rawAdminMode } = useAdminCitySelection();
  const scopeParam = rawAdminMode === "platform" ? "platform" : rawAdminMode === "metro" ? "metro" : "";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: searchResult } = useQuery<{ data: any[]; meta: { total: number } }>({
    queryKey: ["/api/admin/crm-contacts/search", debouncedTerm, scopeParam],
    queryFn: async () => {
      if (debouncedTerm.length < 2) return { data: [], meta: { total: 0, limit: 50, offset: 0 } };
      const params = new URLSearchParams({ q: debouncedTerm });
      if (scopeParam) params.set("scope", scopeParam);
      const resp = await fetch(`/api/admin/crm-contacts/search?${params.toString()}`);
      if (!resp.ok) return { data: [], meta: { total: 0, limit: 50, offset: 0 } };
      return resp.json();
    },
    enabled: debouncedTerm.length >= 2,
  });
  const results = searchResult?.data;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Search CRM Contacts</Label>
      <Input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Type name, email, or phone..."
        className="text-xs h-8"
        data-testid="input-crm-contact-search"
      />
      {results && results.length > 0 && (
        <div className="border rounded-md max-h-32 overflow-y-auto">
          {results.map((c: any) => (
            <button
              key={c.id}
              type="button"
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs hover:bg-muted/30 transition-colors border-b last:border-b-0"
              onClick={() => { onAttach(c); setSearchTerm(""); }}
              data-testid={`button-attach-contact-${c.id}`}
            >
              <div className="text-left">
                <span className="font-medium">{c.name || "Unnamed"}</span>
                {c.company && <span className="text-muted-foreground ml-1">({c.company})</span>}
              </div>
              <span className="text-muted-foreground text-[10px]">{c.email || c.phone || ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessEditDialog({ business, onClose, onNavigateToContact }: { business: Business; onClose: () => void; onNavigateToContact?: (contactId: string) => void }) {
  const { toast } = useToast();
  const { selectedCitySlug: adminCitySlug } = useAdminCitySelection();
  const citySlugForLinks = adminCitySlug || "";
  const [claimEmail, setClaimEmail] = useState(business.ownerEmail || "");
  const [showClaimInput, setShowClaimInput] = useState(false);
  const [localFeatured, setLocalFeatured] = useState(business.isFeatured);
  const [localPriority, setLocalPriority] = useState(business.priorityRank || 0);
  const [localPriceRange, setLocalPriceRange] = useState(business.priceRange || 0);
  const [localReservationUrl, setLocalReservationUrl] = useState(business.reservationUrl || "");
  const [localMenuUrl, setLocalMenuUrl] = useState((business as any).menuUrl || "");
  const [localDoordash, setLocalDoordash] = useState(((business as any).orderingLinks as Record<string, string>)?.doordash || "");
  const [localUbereats, setLocalUbereats] = useState(((business as any).orderingLinks as Record<string, string>)?.ubereats || "");
  const [localPostmates, setLocalPostmates] = useState(((business as any).orderingLinks as Record<string, string>)?.postmates || "");
  const [localGrubhub, setLocalGrubhub] = useState(((business as any).orderingLinks as Record<string, string>)?.grubhub || "");
  const [localIsServiceArea, setLocalIsServiceArea] = useState(business.isServiceArea || false);
  const [localServiceAreaZoneIds, setLocalServiceAreaZoneIds] = useState<string[]>(business.serviceAreaZoneIds || []);
  const [localYoutubeUrl, setLocalYoutubeUrl] = useState((business as any).youtubeUrl || "");
  const [localMlsEmbedUrl, setLocalMlsEmbedUrl] = useState(business.mlsEmbedUrl || "");
  const [localSocialLinks, setLocalSocialLinks] = useState<Record<string, string>>((business as any).socialLinks || {});
  const [localLanguagesSpoken, setLocalLanguagesSpoken] = useState<string[]>(business.languagesSpoken || []);
  const [localAcceptedPayments, setLocalAcceptedPayments] = useState<string[]>((business as any).acceptedPayments || []);
  const [localBarterNetworks, setLocalBarterNetworks] = useState<string[]>((business as any).barterNetworks || []);
  const [localBarterMemberId, setLocalBarterMemberId] = useState((business as any).barterMemberId || "");
  const [localFeatureAttributes, setLocalFeatureAttributes] = useState<string[]>((business as any).featureAttributes || []);
  const [localFarmProductTypes, setLocalFarmProductTypes] = useState<string[]>(business.farmProductTypes || []);
  const [localCsaSubscriptionType, setLocalCsaSubscriptionType] = useState(business.csaSubscriptionType || "");
  const [localPickupSchedule, setLocalPickupSchedule] = useState(business.pickupSchedule || "");
  const [localMarketDays, setLocalMarketDays] = useState<string[]>(business.marketDays || []);
  const [localOrderingMethod, setLocalOrderingMethod] = useState<string[]>(business.orderingMethod || []);
  const [localAcceptsPreorders, setLocalAcceptsPreorders] = useState(business.acceptsPreorders || false);
  const [localSeasonalAvailability, setLocalSeasonalAvailability] = useState<Record<string, string>>(business.seasonalAvailability || {});
  const [localModuleOverrides, setLocalModuleOverrides] = useState<Record<string, boolean>>((business as any).moduleOverrides || {});
  const [localTier, setLocalTier] = useState(business.listingTier || "VERIFIED");
  const [localName, setLocalName] = useState(business.name || "");
  const [localParentBrand, setLocalParentBrand] = useState((business as any).parentBrand || "");
  const [localPreferredLanguage, setLocalPreferredLanguage] = useState((business as any).preferredLanguage || "");
  const [localAddress, setLocalAddress] = useState(business.address || "");
  const [localCity, setLocalCity] = useState(business.city || "");
  const [localState, setLocalState] = useState(business.state || "");
  const [localZip, setLocalZip] = useState(business.zip || "");
  const [localPhone, setLocalPhone] = useState(business.phone || "");
  const [localEmail, setLocalEmail] = useState(business.ownerEmail || "");
  const [localWebsite, setLocalWebsite] = useState(business.websiteUrl || "");
  const [localDescription, setLocalDescription] = useState((business as any).description || "");
  const [localZoneId, setLocalZoneId] = useState((business as any).zoneId || "");
  const [localCategoryL2, setLocalCategoryL2] = useState((business as any).primaryCategoryL2 || "");
  const [localSlug, setLocalSlug] = useState((business as any).slug || "");
  const [slugEditing, setSlugEditing] = useState(false);
  const [localTagIds, setLocalTagIds] = useState<string[]>(business.tagIds || []);
  const [suggestedTags, setSuggestedTags] = useState<{ l2: Array<{ id: string; name: string }>; l3: Array<{ id: string; name: string; parentL2Id?: string | null; parentL2Name?: string | null; parentL2Slug?: string | null }>; source: string } | null>(null);
  const [claimPreviewOpen, setClaimPreviewOpen] = useState(false);
  const [claimPreviewData, setClaimPreviewData] = useState<{ subject: string; html: string } | null>(null);

  const { data: allZones } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlugForLinks, "zones"],
  });

  const { data: neighborhoods } = useQuery<any[]>({
    queryKey: ["/api/activate/neighborhoods", citySlugForLinks],
  });

  const { data: categoriesL2 } = useQuery<any[]>({
    queryKey: ["/api/activate/categories-l2", { type: "commerce" }],
  });

  const { data: l3ForSelectedL2 } = useQuery<any[]>({
    queryKey: ["/api/admin/categories/l3-for-l2", localCategoryL2],
    queryFn: async () => {
      if (!localCategoryL2) return [];
      const resp = await fetch(`/api/admin/categories/l3-for-l2/${localCategoryL2}`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!localCategoryL2,
  });

  const suggestTagsMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/businesses/suggest-tags", {
        name: localName,
        description: localDescription,
        address: localAddress ? `${localAddress}, ${localCity || ""} ${localState || ""} ${localZip || ""}`.trim() : undefined,
      });
      return resp.json();
    },
    onSuccess: (data: any) => {
      setSuggestedTags({
        l2: data.l2Categories || [],
        l3: data.l3Categories || [],
        source: data.source || "none",
      });
      if (data.suggestedL2Ids?.length > 0 && !localCategoryL2) {
        setLocalCategoryL2(data.suggestedL2Ids[0]);
      }
      if (data.suggestedL3Ids?.length > 0) {
        setLocalTagIds(prev => {
          const merged = new Set([...prev, ...data.suggestedL3Ids]);
          return Array.from(merged);
        });
      }
      if (data.suggestedZoneId && !localZoneId) {
        setLocalZoneId(data.suggestedZoneId);
      }
      toast({ title: "Tags suggested", description: `Source: ${data.source}. ${data.suggestedL2Ids?.length || 0} L2, ${data.suggestedL3Ids?.length || 0} L3 tags.` });
    },
    onError: (err: any) => {
      toast({ title: "Could not suggest tags", description: err.message, variant: "destructive" });
    },
  });

  const tagIdsChanged = JSON.stringify(localTagIds.sort()) !== JSON.stringify((business.tagIds || []).sort());

  const { data: badgesData } = useQuery<ProfileBadge[]>({
    queryKey: ["/api/admin/businesses", business.id, "badges"],
  });
  const hasVenueBadge = (badgesData || []).some(b => b.badgeType === "VENUE" && b.enabled);

  const showFood = !!localCategoryL2 && isFoodCategory(localCategoryL2);
  const showFarm = !!localCategoryL2 && isFarmCategory(localCategoryL2);
  const showHealthcare = !!localCategoryL2 && isHealthcareCategory(localCategoryL2);
  const showReservation = showFood || showHealthcare;
  const showScreenProvider = hasVenueBadge;

  useEffect(() => {
    if (!localZip || !allZones || !localIsServiceArea) return;
    const matchingZone = allZones.find((z: any) =>
      z.zipCodes && Array.isArray(z.zipCodes) && z.zipCodes.includes(localZip)
    );
    if (matchingZone && !localServiceAreaZoneIds.includes(matchingZone.id)) {
      setLocalServiceAreaZoneIds(prev => [...prev, matchingZone.id]);
    }
  }, [localZip, allZones, localIsServiceArea]);

  const coreChanged =
    localName !== (business.name || "") ||
    localParentBrand !== ((business as any).parentBrand || "") ||
    localPreferredLanguage !== ((business as any).preferredLanguage || "") ||
    localAddress !== (business.address || "") ||
    localCity !== (business.city || "") ||
    localState !== (business.state || "") ||
    localZip !== (business.zip || "") ||
    localPhone !== (business.phone || "") ||
    localEmail !== (business.ownerEmail || "") ||
    localWebsite !== (business.websiteUrl || "") ||
    localDescription !== ((business as any).description || "") ||
    localZoneId !== ((business as any).zoneId || "") ||
    localCategoryL2 !== ((business as any).primaryCategoryL2 || "") ||
    tagIdsChanged;

  const detailsChanged =
    localPriceRange !== (business.priceRange || 0) ||
    localReservationUrl !== (business.reservationUrl || "") ||
    localMenuUrl !== ((business as any).menuUrl || "") ||
    localYoutubeUrl !== ((business as any).youtubeUrl || "") ||
    localMlsEmbedUrl !== (business.mlsEmbedUrl || "") ||
    JSON.stringify(localSocialLinks) !== JSON.stringify((business as any).socialLinks || {}) ||
    JSON.stringify(localLanguagesSpoken.sort()) !== JSON.stringify((business.languagesSpoken || []).sort()) ||
    JSON.stringify(localAcceptedPayments.sort()) !== JSON.stringify(((business as any).acceptedPayments || []).sort()) ||
    JSON.stringify(localBarterNetworks.sort()) !== JSON.stringify(((business as any).barterNetworks || []).sort()) ||
    localBarterMemberId !== ((business as any).barterMemberId || "") ||
    JSON.stringify(localFeatureAttributes.sort()) !== JSON.stringify(((business as any).featureAttributes || []).sort()) ||
    localIsServiceArea !== (business.isServiceArea || false) ||
    JSON.stringify(localServiceAreaZoneIds.sort()) !== JSON.stringify((business.serviceAreaZoneIds || []).sort());

  const orderingLinksChanged =
    localDoordash !== (((business as any).orderingLinks as Record<string, string>)?.doordash || "") ||
    localUbereats !== (((business as any).orderingLinks as Record<string, string>)?.ubereats || "") ||
    localPostmates !== (((business as any).orderingLinks as Record<string, string>)?.postmates || "") ||
    localGrubhub !== (((business as any).orderingLinks as Record<string, string>)?.grubhub || "");

  const farmChanged =
    JSON.stringify(localFarmProductTypes.sort()) !== JSON.stringify((business.farmProductTypes || []).sort()) ||
    JSON.stringify(localOrderingMethod.sort()) !== JSON.stringify((business.orderingMethod || []).sort()) ||
    localCsaSubscriptionType !== (business.csaSubscriptionType || "") ||
    localPickupSchedule !== (business.pickupSchedule || "") ||
    JSON.stringify(localMarketDays.sort()) !== JSON.stringify((business.marketDays || []).sort()) ||
    localAcceptsPreorders !== (business.acceptsPreorders || false) ||
    JSON.stringify(localSeasonalAvailability) !== JSON.stringify(business.seasonalAvailability || {});

  const anyChanged = coreChanged || detailsChanged || orderingLinksChanged || (showFarm && farmChanged);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Business>) => {
      await apiRequest("PATCH", `/api/admin/businesses/${business.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      toast({ title: "Business updated" });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const refreshGoogleMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${business.id}/refresh-google`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      toast({ title: "Google data refreshed" });
    },
    onError: () => {
      toast({ title: "Could not refresh", description: "No Google Places match found or API unavailable", variant: "destructive" });
    },
  });

  const sendClaimMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${business.id}/send-claim`, { ownerEmail: claimEmail });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      toast({ title: "Claim email sent" });
      setShowClaimInput(false);
    },
    onError: () => {
      toast({ title: "Failed to send claim email", variant: "destructive" });
    },
  });

  const claimPreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/businesses/${business.id}/claim-preview`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load preview");
      return res.json() as Promise<{ subject: string; html: string }>;
    },
    onSuccess: (data) => {
      setClaimPreviewData(data);
      setClaimPreviewOpen(true);
    },
    onError: () => {
      toast({ title: "Failed to load preview", variant: "destructive" });
    },
  });

  const claimTestSendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/businesses/${business.id}/send-claim-test`);
      return res as any;
    },
    onSuccess: (data: any) => {
      toast({ title: "Test email sent", description: data?.sentTo ? `Sent to ${data.sentTo}` : data?.message || "Check your inbox" });
    },
    onError: () => {
      toast({ title: "Failed to send test email", variant: "destructive" });
    },
  });

  const recrawlMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${business.id}/recrawl`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      toast({ title: "Website re-crawled", description: "Listing fields updated from website data" });
    },
    onError: (err: any) => {
      toast({ title: "Re-crawl failed", description: err.message, variant: "destructive" });
    },
  });

  const handleGoogleSelect = async (details: PlaceDetails & { placeId: string }) => {
    await updateMutation.mutateAsync({
      googlePlaceId: details.placeId,
      googleRating: details.rating?.toString(),
      googleReviewCount: details.reviewCount,
      googleMapsUrl: details.mapsUrl,
      googleLastSyncAt: new Date(),
      name: details.name || business.name,
      address: details.address || business.address,
      city: details.city || business.city,
      state: details.state || business.state,
      zip: details.zip || business.zip,
      phone: details.phone || business.phone,
      websiteUrl: details.website || business.websiteUrl,
    } as any);
  };

  const handleUnifiedSave = async () => {
    const payload: any = {
      name: localName,
      parentBrand: localParentBrand || null,
      preferredLanguage: localPreferredLanguage || null,
      address: localAddress,
      city: localCity,
      state: localState,
      zip: localZip,
      phone: localPhone,
      ownerEmail: localEmail,
      websiteUrl: localWebsite,
      description: localDescription,
      zoneId: localZoneId || null,
      categoryIds: localCategoryL2 ? [localCategoryL2] : [],
      tagIds: localTagIds,
      priceRange: localPriceRange || null,
      reservationUrl: localReservationUrl || null,
      menuUrl: localMenuUrl || null,
      youtubeUrl: localYoutubeUrl || null,
      mlsEmbedUrl: localMlsEmbedUrl || null,
      languagesSpoken: localLanguagesSpoken,
      acceptedPayments: localAcceptedPayments,
      barterNetworks: localBarterNetworks,
      barterMemberId: localBarterMemberId || null,
      featureAttributes: localFeatureAttributes,
      isServiceArea: localIsServiceArea,
      serviceAreaZoneIds: localServiceAreaZoneIds,
    };
    const cleanedSocial: Record<string, string> = {};
    for (const [k, v] of Object.entries(localSocialLinks)) {
      if (v) cleanedSocial[k] = v as string;
    }
    payload.socialLinks = Object.keys(cleanedSocial).length > 0 ? cleanedSocial : null;
    const links: Record<string, string> = {};
    if (localDoordash) links.doordash = localDoordash;
    if (localUbereats) links.ubereats = localUbereats;
    if (localPostmates) links.postmates = localPostmates;
    if (localGrubhub) links.grubhub = localGrubhub;
    payload.orderingLinks = Object.keys(links).length > 0 ? links : null;
    if (showFarm) {
      payload.farmProductTypes = localFarmProductTypes;
      payload.orderingMethod = localOrderingMethod;
      payload.csaSubscriptionType = localCsaSubscriptionType || null;
      payload.pickupSchedule = localPickupSchedule || null;
      payload.marketDays = localMarketDays;
      payload.acceptsPreorders = localAcceptsPreorders;
      payload.seasonalAvailability = Object.keys(localSeasonalAvailability).length > 0 ? localSeasonalAvailability : null;
    }
    await updateMutation.mutateAsync(payload);
  };

  const allL2Categories = categoriesL2 || [];

  return (
    <>
    <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
      <DialogHeader className="shrink-0">
        <DialogTitle>{business.name}</DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto pr-1">

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Select value={localTier} onValueChange={setLocalTier}>
              <SelectTrigger className="h-7 w-[130px] text-[11px]" data-testid="select-listing-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="ENHANCED">Enhanced</SelectItem>
              </SelectContent>
            </Select>
            {localTier !== business.listingTier && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-[11px] px-2"
                onClick={async () => {
                  const micrositeTierMap: Record<string, "none" | "enhanced" | "charter"> = { FREE: "none", VERIFIED: "none", ENHANCED: "enhanced", CHARTER: "charter", PREMIUM: "none", NONPROFIT: "none", ORGANIZATION: "none", HEALTHCARE_PROVIDER: "none" };
                  const isEnhanced = localTier === "ENHANCED" || localTier === "CHARTER";
                  await updateMutation.mutateAsync({ listingTier: localTier, micrositeTier: micrositeTierMap[localTier] || "none", micrositeEnabled: isEnhanced ? true : undefined } as Partial<Business>);
                }}
                disabled={updateMutation.isPending}
                data-testid="button-save-tier"
              >
                Save Tier
              </Button>
            )}
          </div>
          <Badge variant={business.claimStatus === "CLAIMED" ? "default" : "secondary"}>
            {business.claimStatus}
          </Badge>
          {business.isVerified && <Badge variant="secondary"><Star className="mr-1 h-3 w-3" />Verified</Badge>}
        </div>

        {business.websiteUrl && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2" data-testid="section-website-url">
            <Globe className="h-4 w-4 text-primary shrink-0" />
            <Button
              variant="ghost"
              className="text-sm text-primary p-0 h-auto truncate justify-start"
              onClick={() => window.open(business.websiteUrl!.startsWith("http") ? business.websiteUrl! : `https://${business.websiteUrl}`, "_blank")}
              data-testid="link-business-website"
            >
              Visit Website
              <ExternalLink className="h-3 w-3 ml-1.5 shrink-0" />
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2" data-testid="section-enrichment-actions">
          {business.websiteUrl && (
            <>
              {(business as any).description || (business as any).socialLinks ? (
                <Badge variant="secondary" className="text-[10px] gap-1" data-testid="badge-enriched">
                  <Check className="h-2.5 w-2.5" /> Enriched
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-400" data-testid="badge-enrichment-pending">
                  <Loader2 className="h-2.5 w-2.5" /> Enrichment pending
                </Badge>
              )}
              {business.listingTier !== "ENHANCED" && business.listingTier !== "ENTERPRISE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-2 gap-1"
                  onClick={() => recrawlMutation.mutate()}
                  disabled={recrawlMutation.isPending}
                  data-testid="button-recrawl"
                >
                  {recrawlMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Re-crawl Website
                </Button>
              )}
            </>
          )}
          {business.claimStatus !== "CLAIMED" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2 gap-1"
                onClick={() => claimPreviewMutation.mutate()}
                disabled={claimPreviewMutation.isPending}
                data-testid="button-preview-invite"
              >
                {claimPreviewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                Preview Invite
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2 gap-1"
                onClick={() => claimTestSendMutation.mutate()}
                disabled={claimTestSendMutation.isPending}
                data-testid="button-test-send-invite"
              >
                {claimTestSendMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Send Test to Me
              </Button>
            </>
          )}
        </div>

        <MicrositeSection business={business} toast={toast} />

        <EditSection title="Module Overrides" icon={<Shield className="h-3.5 w-3.5" />} testId="section-module-overrides">
          <p className="text-xs text-muted-foreground mb-2">Grant or revoke individual modules regardless of tier. Tier-included modules show as locked on.</p>
          {(() => {
            const GRANTABLE_MODULES = [
              { key: "faq", label: "FAQ / AEO" },
              { key: "expert_qa", label: "Expert Q&A" },
              { key: "gallery", label: "Gallery" },
              { key: "media_blocks", label: "Media Blocks" },
              { key: "video_embed", label: "Video Embed" },
              { key: "external_reviews", label: "External Reviews" },
              { key: "internal_reviews", label: "Internal Reviews" },
              { key: "microsite", label: "Microsite" },
              { key: "priority_ranking", label: "Priority Ranking" },
              { key: "custom_domain", label: "Custom Domain" },
              { key: "community_posting", label: "Community Posting" },
            ];
            const ENHANCED_MODULES = [
              "microsite", "gallery", "media_blocks", "priority_ranking", "custom_domain",
              "faq", "expert_qa", "video_embed", "external_reviews", "internal_reviews",
            ];
            const VERIFIED_MODULES = ["community_posting"];
            const tierIncluded = (moduleKey: string) => {
              if (localTier === "ENHANCED" || localTier === "ENTERPRISE") {
                return ENHANCED_MODULES.includes(moduleKey) || VERIFIED_MODULES.includes(moduleKey);
              }
              if (localTier === "VERIFIED") return VERIFIED_MODULES.includes(moduleKey);
              return false;
            };
            const overridesChanged = JSON.stringify(localModuleOverrides) !== JSON.stringify((business as any).moduleOverrides || {});
            return (
              <div className="space-y-1.5">
                {GRANTABLE_MODULES.map(mod => {
                  const includedByTier = tierIncluded(mod.key);
                  const overrideValue = localModuleOverrides[mod.key];
                  const isOverridden = overrideValue !== undefined;
                  const isOn = isOverridden ? overrideValue : includedByTier;
                  return (
                    <div key={mod.key} className="flex items-center justify-between py-1 px-1 rounded hover:bg-muted/30" data-testid={`module-toggle-row-${mod.key}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{mod.label}</span>
                        {includedByTier && !isOverridden && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded" data-testid={`module-tier-badge-${mod.key}`}>
                            {localTier} tier
                          </span>
                        )}
                        {isOverridden && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${overrideValue ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`} data-testid={`module-override-badge-${mod.key}`}>
                            {overrideValue ? "force on" : "force off"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isOverridden && (
                          <button
                            type="button"
                            className="text-[10px] text-muted-foreground hover:text-foreground underline"
                            onClick={() => {
                              setLocalModuleOverrides(prev => {
                                const next = { ...prev };
                                delete next[mod.key];
                                return next;
                              });
                            }}
                            data-testid={`module-reset-${mod.key}`}
                          >
                            reset
                          </button>
                        )}
                        <Switch
                          checked={isOn}
                          onCheckedChange={(checked) => {
                            setLocalModuleOverrides(prev => {
                              const next = { ...prev };
                              if ((!includedByTier && !checked) || (includedByTier && checked)) {
                                delete next[mod.key];
                              } else {
                                next[mod.key] = checked;
                              }
                              return next;
                            });
                          }}
                          data-testid={`module-toggle-${mod.key}`}
                        />
                      </div>
                    </div>
                  );
                })}
                {overridesChanged && (
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={async () => {
                      await updateMutation.mutateAsync({ moduleOverrides: localModuleOverrides } as any);
                    }}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-module-overrides"
                  >
                    {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Save Module Overrides
                  </Button>
                )}
              </div>
            );
          })()}
        </EditSection>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Listing Links</h4>
          <div className="flex flex-wrap gap-2">
            {localSlug && (
              <>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => window.open(`${window.location.origin}/${citySlugForLinks}/presence/${localSlug}`, "_blank")} data-testid="button-open-listing-url">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View Listing
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${citySlugForLinks}/presence/${localSlug}`); toast({ title: "Copied listing URL" }); }} data-testid="button-copy-listing-url">
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="text-xs" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${citySlugForLinks}/activate`); toast({ title: "Copied activate URL" }); }} data-testid="button-copy-activate-url">
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Activate Link
            </Button>
          </div>
          <div className="space-y-1.5">
            {slugEditing ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input value={localSlug} onChange={(e) => setLocalSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-"))} className="h-8 text-xs font-mono flex-1 min-w-[150px]" data-testid="input-slug-edit" />
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { const cleaned = localSlug.replace(/-[a-f0-9]{6,8}$/, "").replace(/-+$/, ""); setLocalSlug(cleaned); }} data-testid="button-slug-cleanup">Clean Up</Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { const fresh = localName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); setLocalSlug(fresh); }} data-testid="button-slug-regen">Regenerate</Button>
                {localSlug !== ((business as any).slug || "") && (
                  <Button size="sm" className="text-xs" onClick={async () => { await updateMutation.mutateAsync({ slug: localSlug } as any); setSlugEditing(false); toast({ title: "Slug updated" }); }} disabled={updateMutation.isPending} data-testid="button-slug-save">Save</Button>
                )}
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setLocalSlug((business as any).slug || ""); setSlugEditing(false); }}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSlugEditing(true)} data-testid="button-slug-edit-toggle">{localSlug ? "Edit slug" : "Create slug"}</Button>
            )}
          </div>
        </div>

        {business.listingTier === "ENHANCED" && localSlug ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Enhanced Microsite</p>
                <p className="text-xs text-muted-foreground">Full AI landing page with all block types</p>
              </div>
              <Button size="sm" onClick={() => window.open(`/${citySlugForLinks}/owner/${localSlug}/site-builder`, "_blank")} data-testid="button-edit-presence">
                <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Their Site
              </Button>
            </div>
          </div>
        ) : (business.listingTier === "FREE" || business.listingTier === "VERIFIED") ? (
          <div className="rounded-lg border border-muted bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Upgrade to <strong>Enhanced</strong> to unlock the microsite editor for this business.</p>
          </div>
        ) : null}

        <OwnerAccountManager businessId={business.id} businessName={business.name} ownerEmail={business.ownerEmail || ""} citySlug={citySlugForLinks} slug={localSlug} />

        <EditSection title="Core Info" icon={<Building2 className="h-3.5 w-3.5" />} defaultOpen={true} testId="section-core-info">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={localName} onChange={(e) => setLocalName(e.target.value)} data-testid="input-business-name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Parent Brand (optional)</Label>
            <Input value={localParentBrand} onChange={(e) => setLocalParentBrand(e.target.value)} placeholder="e.g., American Express, State Farm" data-testid="input-parent-brand" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preferred Language</Label>
            <div className="flex gap-1">
              {[{ value: "", label: "Not set" }, { value: "en", label: "English" }, { value: "es", label: "Español" }].map(opt => (
                <button key={opt.value} type="button" onClick={() => setLocalPreferredLanguage(opt.value)} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${localPreferredLanguage === opt.value ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground border"}`} data-testid={`button-pref-lang-${opt.value || "none"}`}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Address</Label>
            <Input value={localAddress} onChange={(e) => setLocalAddress(e.target.value)} data-testid="input-business-address" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">City</Label>
              <Input value={localCity} onChange={(e) => setLocalCity(e.target.value)} data-testid="input-business-city" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">State</Label>
              <Input value={localState} onChange={(e) => setLocalState(e.target.value)} data-testid="input-business-state" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Zip</Label>
              <Input value={localZip} onChange={(e) => setLocalZip(e.target.value)} data-testid="input-business-zip" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input value={localPhone} onChange={(e) => setLocalPhone(e.target.value)} data-testid="input-business-phone" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Owner Email</Label>
            <Input value={localEmail} onChange={(e) => setLocalEmail(e.target.value)} type="email" data-testid="input-business-email" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Website</Label>
            <Input value={localWebsite} onChange={(e) => setLocalWebsite(e.target.value)} data-testid="input-business-website" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea value={localDescription} onChange={(e) => setLocalDescription(e.target.value)} rows={3} data-testid="input-business-description" />
          </div>
          {neighborhoods && neighborhoods.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Neighborhood</Label>
              <AdminSearchableSelect value={localZoneId} onSelect={setLocalZoneId} groups={[{ label: "Neighborhoods", items: neighborhoods.map((n: any) => ({ id: n.id || n.slug, name: n.name })) }]} placeholder="Select neighborhood..." testId="select-business-neighborhood" />
            </div>
          )}
          {allL2Categories.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <AdminSearchableSelect value={localCategoryL2} onSelect={setLocalCategoryL2} groups={[{ label: "Categories", items: allL2Categories.map((c: any) => ({ id: c.slug || c.id, name: c.name })) }]} placeholder="Select category..." testId="select-business-category" />
            </div>
          )}
          {business.claimedAt && <p className="text-xs text-muted-foreground">Claimed: {new Date(business.claimedAt).toLocaleDateString()}</p>}
          <PhotoUpload currentUrl={business.imageUrl || ""} onUploaded={async (url) => { await updateMutation.mutateAsync({ imageUrl: url || null } as any); }} />
        </EditSection>

        <EditSection title="Auto-Tagging & Micro-Tags" icon={<Tag className="h-3.5 w-3.5" />} testId="section-auto-tagging">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] text-muted-foreground">AI-powered category & micro-tag suggestions</p>
            <Button size="sm" variant="outline" onClick={() => suggestTagsMutation.mutate()} disabled={suggestTagsMutation.isPending || !localName} data-testid="button-suggest-tags">
              {suggestTagsMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bot className="h-3 w-3 mr-1" />}
              Suggest Tags
            </Button>
          </div>
          {suggestedTags && (
            <div className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-medium text-muted-foreground">Source: {suggestedTags.source}</span>
                {suggestedTags.l2.length > 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground">L2:</span>
                    {suggestedTags.l2.map(c => (
                      <Badge key={c.id} variant="secondary" className="text-[10px]">{c.name}</Badge>
                    ))}
                  </>
                )}
              </div>
              {suggestedTags.l3.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">L3:</span>
                  {suggestedTags.l3.map(c => {
                    const belongsToSelected = l3ForSelectedL2?.some((t: any) => t.id === c.id);
                    const crossCategoryParent = !belongsToSelected && c.parentL2Name ? c.parentL2Name : null;
                    const crossCategorySlug = !belongsToSelected && c.parentL2Slug ? c.parentL2Slug : null;
                    return (
                      <Badge
                        key={c.id}
                        variant="outline"
                        className={`text-[10px] ${!belongsToSelected ? "border-amber-400 text-amber-600 cursor-pointer hover:bg-amber-50" : ""}`}
                        onClick={crossCategorySlug ? () => {
                          setLocalCategoryL2(crossCategorySlug);
                          toast({ title: "Switched category", description: `Now viewing L3 tags under "${crossCategoryParent}"` });
                        } : undefined}
                        data-testid={`badge-l3-suggestion-${c.id}`}
                      >
                        {c.name}
                        {crossCategoryParent && (
                          <span className="ml-1 text-[9px] text-amber-500" title={`Click to switch to ${crossCategoryParent}`}>({crossCategoryParent} ↗)</span>
                        )}
                        {!belongsToSelected && !crossCategoryParent && (
                          <span className="ml-1 text-[9px] text-amber-500">(different L2)</span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {l3ForSelectedL2 && l3ForSelectedL2.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">L3 Micro-Tags for selected category</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {l3ForSelectedL2.map((tag: any) => (
                  <label key={tag.id} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`checkbox-l3-tag-${tag.id}`}>
                    <input type="checkbox" checked={localTagIds.includes(tag.id)} onChange={(e) => { if (e.target.checked) { setLocalTagIds(prev => [...prev, tag.id]); } else { setLocalTagIds(prev => prev.filter(id => id !== tag.id)); } }} />
                    {tag.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </EditSection>

        <EditSection title="SEO & AEO Scores" icon={<Search className="h-3.5 w-3.5" />} testId="section-seo-scores">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SeoScoreCard input={{ title: localName, metaDescription: localDescription, content: localDescription, slug: localSlug, cityKeyword: localCity || "", categoryKeyword: localCategoryL2 }} />
            <AeoScoreCard input={{ title: localName, metaDescription: localDescription, content: localDescription, slug: localSlug }} />
          </div>
        </EditSection>

        <EditSection title="Placement Controls" icon={<Megaphone className="h-3.5 w-3.5" />} testId="section-placement">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Featured</span>
            <Button size="sm" variant={localFeatured ? "default" : "outline"} className="toggle-elevate" onClick={async () => { const next = !localFeatured; setLocalFeatured(next); await updateMutation.mutateAsync({ isFeatured: next } as any); }} disabled={updateMutation.isPending} data-testid="button-toggle-featured">
              <Star className="h-3 w-3 mr-1" /> {localFeatured ? "Featured" : "Not Featured"}
            </Button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Priority Rank</span>
              <span className="text-xs font-mono text-muted-foreground">{localPriority}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} step={5} value={localPriority} onChange={(e) => setLocalPriority(parseInt(e.target.value))} className="flex-1 h-2 cursor-pointer accent-primary" data-testid="input-priority-rank" />
              <Button size="sm" variant="outline" onClick={async () => { await updateMutation.mutateAsync({ priorityRank: localPriority } as any); }} disabled={updateMutation.isPending} data-testid="button-save-priority">Save</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Higher rank = higher visibility in sponsored/featured sections</p>
          </div>
        </EditSection>

        <EditSection title="Business Details" icon={<FileText className="h-3.5 w-3.5" />} testId="section-details">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Price Range</span>
              <span className="text-xs font-mono text-muted-foreground">{localPriceRange ? "$".repeat(localPriceRange) : "Not set"}</span>
            </div>
            <Select value={localPriceRange.toString()} onValueChange={(v) => setLocalPriceRange(parseInt(v))}>
              <SelectTrigger className="w-[120px]" data-testid="select-price-range"><SelectValue placeholder="Price" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">None</SelectItem>
                <SelectItem value="1">$</SelectItem>
                <SelectItem value="2">$$</SelectItem>
                <SelectItem value="3">$$$</SelectItem>
                <SelectItem value="4">$$$$</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showReservation && (
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">{showHealthcare ? "Booking / Reservation URL" : "Reservation URL (OpenTable, etc.)"}</span>
              <Input value={localReservationUrl} onChange={(e) => setLocalReservationUrl(e.target.value)} placeholder="https://www.opentable.com/..." data-testid="input-reservation-url" />
            </div>
          )}
          {showFood && (
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Menu URL</span>
              <Input value={localMenuUrl} onChange={(e) => setLocalMenuUrl(e.target.value)} placeholder="https://restaurant.com/menu" data-testid="input-menu-url" />
            </div>
          )}
        </EditSection>

        {showFood && (
          <EditSection title="Ordering / Delivery Links" icon={<ExternalLink className="h-3.5 w-3.5" />} testId="section-ordering">
            {[
              { key: "doordash", label: "DoorDash", value: localDoordash, setter: setLocalDoordash, placeholder: "https://www.doordash.com/store/..." },
              { key: "ubereats", label: "Uber Eats", value: localUbereats, setter: setLocalUbereats, placeholder: "https://www.ubereats.com/store/..." },
              { key: "postmates", label: "Postmates", value: localPostmates, setter: setLocalPostmates, placeholder: "https://postmates.com/store/..." },
              { key: "grubhub", label: "Grubhub", value: localGrubhub, setter: setLocalGrubhub, placeholder: "https://www.grubhub.com/restaurant/..." },
            ].map((p) => (
              <div key={p.key} className="space-y-1">
                <span className="text-xs text-muted-foreground">{p.label}</span>
                <Input value={p.value} onChange={(e) => p.setter(e.target.value)} placeholder={p.placeholder} data-testid={`input-ordering-${p.key}`} />
              </div>
            ))}
          </EditSection>
        )}

        <EditSection title="Service Area & Zones" icon={<MapPin className="h-3.5 w-3.5" />} testId="section-service-area">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Service Area Business</span>
            <Button size="sm" variant={localIsServiceArea ? "default" : "outline"} className="toggle-elevate" onClick={() => { setLocalIsServiceArea(prev => !prev); if (localIsServiceArea) setLocalServiceAreaZoneIds([]); }} disabled={updateMutation.isPending} data-testid="button-toggle-service-area">
              {localIsServiceArea ? "Yes" : "No"}
            </Button>
          </div>
          {localIsServiceArea && allZones && (
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Zones Served {localZip && <span className="text-[10px] text-primary">(home zip {localZip} auto-checked)</span>}</span>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {allZones.map((z: any) => (
                  <label key={z.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={localServiceAreaZoneIds.includes(z.id)} onChange={(e) => { const next = e.target.checked ? [...localServiceAreaZoneIds, z.id] : localServiceAreaZoneIds.filter((id) => id !== z.id); setLocalServiceAreaZoneIds(next); }} />
                    {z.name}
                    {z.zipCodes && Array.isArray(z.zipCodes) && z.zipCodes.includes(localZip) && (
                      <Badge variant="outline" className="text-[9px] ml-1">home zip</Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </EditSection>

        <EditSection title="Media & Social" icon={<Globe className="h-3.5 w-3.5" />} testId="section-media-social">
          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground">YouTube Video URL</span>
            <Input value={localYoutubeUrl} onChange={(e) => setLocalYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." data-testid="input-youtube-url" />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground">MLS Embed URL (Paid Add-on)</span>
            <Input value={localMlsEmbedUrl} onChange={(e) => setLocalMlsEmbedUrl(e.target.value)} placeholder="https://www.realtor.com/..." data-testid="input-mls-embed-url" />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground">Social Links</span>
            {["instagram", "facebook", "twitter", "linkedin", "tiktok", "yelp"].map((platform) => (
              <div key={platform} className="flex items-center gap-2">
                <span className="text-xs w-16 capitalize">{platform}</span>
                <Input value={localSocialLinks[platform] || ""} onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, [platform]: e.target.value })} placeholder={`https://${platform}.com/...`} className="text-xs h-8" data-testid={`input-social-${platform}`} />
              </div>
            ))}
          </div>
        </EditSection>

        <EditSection title="Languages Spoken" icon={<Languages className="h-3.5 w-3.5" />} testId="section-languages">
          <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
            {["English", "Spanish", "French", "Mandarin", "Vietnamese", "Hindi", "Arabic", "Korean", "Portuguese", "German", "Japanese", "Tagalog"].map((lang) => (
              <label key={lang} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={localLanguagesSpoken.includes(lang)} onChange={(e) => { const next = e.target.checked ? [...localLanguagesSpoken, lang] : localLanguagesSpoken.filter((l) => l !== lang); setLocalLanguagesSpoken(next); }} data-testid={`checkbox-admin-lang-${lang.toLowerCase()}`} />
                {lang}
              </label>
            ))}
          </div>
        </EditSection>

        <EditSection title="Payment Methods" icon={<CreditCard className="h-3.5 w-3.5" />} testId="section-payments">
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: "cash", label: "Cash" }, { value: "visa", label: "Visa" }, { value: "mastercard", label: "Mastercard" },
              { value: "amex", label: "Amex" }, { value: "discover", label: "Discover" }, { value: "apple_pay", label: "Apple Pay" },
              { value: "google_pay", label: "Google Pay" }, { value: "venmo", label: "Venmo" }, { value: "zelle", label: "Zelle" },
              { value: "cashapp", label: "CashApp" }, { value: "crypto", label: "Crypto" }, { value: "check", label: "Check" },
            ].map((pm) => (
              <Button key={pm.value} size="sm" variant={localAcceptedPayments.includes(pm.value) ? "default" : "outline"} className="toggle-elevate" onClick={() => { setLocalAcceptedPayments((prev) => prev.includes(pm.value) ? prev.filter((p) => p !== pm.value) : [...prev, pm.value]); }} data-testid={`button-payment-${pm.value}`}>{pm.label}</Button>
            ))}
          </div>
        </EditSection>

        <EditSection title="Barter / Trade Networks" icon={<ArrowRightLeft className="h-3.5 w-3.5" />} testId="section-barter">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">ITEX Member</span>
            <Button size="sm" variant={localBarterNetworks.includes("itex") ? "default" : "outline"} className="toggle-elevate" onClick={() => { setLocalBarterNetworks((prev) => prev.includes("itex") ? prev.filter((n) => n !== "itex") : [...prev, "itex"]); }} data-testid="button-toggle-itex">
              <ArrowRightLeft className="h-3 w-3 mr-1" /> {localBarterNetworks.includes("itex") ? "ITEX Enabled" : "Enable ITEX"}
            </Button>
          </div>
          {localBarterNetworks.includes("itex") && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">ITEX Member ID (admin-only)</Label>
              <Input value={localBarterMemberId} onChange={(e) => setLocalBarterMemberId(e.target.value)} placeholder="e.g., ITEX-12345" data-testid="input-itex-member-id" />
            </div>
          )}
        </EditSection>

        <EditSection title="Feature Attributes" icon={<Sparkles className="h-3.5 w-3.5" />} testId="section-feature-attributes">
          <p className="text-[10px] text-muted-foreground">Tag this business with cross-category features for filtering and discovery</p>
          <p className="text-[10px] font-medium text-muted-foreground mt-2">Identity & Ownership (shown in hero)</p>
          <div className="flex flex-wrap gap-1.5">
            {BUSINESS_ATTRIBUTES.filter(a => a.tier === "top").map((attr) => (
              <Button key={attr.slug} size="sm" variant={localFeatureAttributes.includes(attr.slug) ? "default" : "outline"} className="toggle-elevate" onClick={() => { setLocalFeatureAttributes((prev) => prev.includes(attr.slug) ? prev.filter((a) => a !== attr.slug) : [...prev, attr.slug]); }} data-testid={`button-attr-${attr.slug}`}>{attr.label}</Button>
            ))}
          </div>
          <p className="text-[10px] font-medium text-muted-foreground mt-2">Dietary, Amenities & Services (detail section)</p>
          <div className="flex flex-wrap gap-1.5">
            {BUSINESS_ATTRIBUTES.filter(a => a.tier === "detail").map((attr) => (
              <Button key={attr.slug} size="sm" variant={localFeatureAttributes.includes(attr.slug) ? "default" : "outline"} className="toggle-elevate" onClick={() => { setLocalFeatureAttributes((prev) => prev.includes(attr.slug) ? prev.filter((a) => a !== attr.slug) : [...prev, attr.slug]); }} data-testid={`button-attr-${attr.slug}`}>{attr.label}</Button>
            ))}
          </div>
        </EditSection>

        {showFarm && (
          <EditSection title="Farm & Local Food" icon={<span>🌱</span>} testId="section-farm">
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Product Types</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["meat","eggs","produce","dairy","honey","flowers","herbs","grains","baked-goods","preserves"].map((p) => (
                    <Badge key={p} variant={localFarmProductTypes.includes(p) ? "default" : "outline"} className="cursor-pointer text-xs" data-testid={`badge-admin-farm-product-${p}`} onClick={() => { setLocalFarmProductTypes(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]); }}>{p.replace(/-/g, " ")}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ordering Methods</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["online","on-farm","pickup","delivery","farmers-market"].map((m) => (
                    <Badge key={m} variant={localOrderingMethod.includes(m) ? "default" : "outline"} className="cursor-pointer text-xs" data-testid={`badge-admin-ordering-${m}`} onClick={() => { setLocalOrderingMethod(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]); }}>{m.replace(/-/g, " ")}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">CSA / Subscription Type</label>
                <Select value={localCsaSubscriptionType || "not-set"} onValueChange={(v) => setLocalCsaSubscriptionType(v === "not-set" ? "" : v)}>
                  <SelectTrigger data-testid="select-admin-csa-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-set">None</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Pickup Schedule</label>
                <Input value={localPickupSchedule} onChange={(e) => setLocalPickupSchedule(e.target.value)} placeholder="e.g. Saturdays 9am-12pm" data-testid="input-admin-pickup-schedule" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Market Days</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d) => (
                    <Badge key={d} variant={localMarketDays.includes(d) ? "default" : "outline"} className="cursor-pointer text-xs" data-testid={`badge-admin-market-day-${d}`} onClick={() => { setLocalMarketDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); }}>{d.slice(0, 3)}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={localAcceptsPreorders} onChange={(e) => setLocalAcceptsPreorders(e.target.checked)} data-testid="checkbox-admin-accepts-preorders" />
                <label className="text-xs text-muted-foreground">Accepts Pre-orders</label>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Seasonal Availability</label>
                <div className="space-y-1.5 mt-1">
                  {["Spring","Summer","Fall","Winter"].map((season) => (
                    <div key={season} className="flex items-center gap-2">
                      <Badge variant={localSeasonalAvailability[season] ? "default" : "outline"} className="cursor-pointer text-xs min-w-[60px] justify-center" data-testid={`badge-admin-season-${season}`} onClick={() => { setLocalSeasonalAvailability(prev => { const next = { ...prev }; if (next[season]) { delete next[season]; } else { next[season] = "Available"; } return next; }); }}>{season}</Badge>
                      {localSeasonalAvailability[season] && (
                        <Input value={localSeasonalAvailability[season]} onChange={(e) => setLocalSeasonalAvailability(prev => ({ ...prev, [season]: e.target.value }))} className="h-7 text-xs" placeholder="e.g. Peak harvest" data-testid={`input-admin-season-${season}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </EditSection>
        )}

        {showScreenProvider && (
          <EditSection title="Screen Provider" icon={<Monitor className="h-3.5 w-3.5" />} testId="section-screen-provider">
            <Select value={(business as any).venueScreenProvider || "not-set"} onValueChange={async (v) => { await updateMutation.mutateAsync({ venueScreenProvider: v === "not-set" ? null : v } as any); }}>
              <SelectTrigger data-testid="select-screen-provider"><SelectValue placeholder="Select provider..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not-set">Not Set</SelectItem>
                {VENUE_SCREEN_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(business as any).venueScreenProvider === "other" && (
              <Input defaultValue={(business as any).venueScreenProviderOther || ""} placeholder="Other provider name..." onBlur={async (e) => { await updateMutation.mutateAsync({ venueScreenProviderOther: e.target.value || null } as any); }} data-testid="input-screen-provider-other" />
            )}
            {(business as any).venueScreenLikely && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Monitor className="h-3 w-3 text-blue-500" /> Venue likely has screens (auto-detected)
              </p>
            )}
          </EditSection>
        )}

        {((business as any).opportunityScores || (business as any).opportunityProfile) && (
          <EditSection title="Opportunity Profile" icon={<Target className="h-3.5 w-3.5" />} testId="section-opportunity">
            {(business as any).opportunityScores && (() => {
              const scores = (business as any).opportunityScores as { hubTv: number; listingUpgrade: number; adBuyer: number; eventPartner: number; overall: number };
              const entries: [string, number][] = [["Hub TV", scores.hubTv], ["Enhanced Listing", scores.listingUpgrade], ["Pulse Advertising", scores.adBuyer], ["Event Sponsorship", scores.eventPartner]];
              const sorted = [...entries].sort((a, b) => b[1] - a[1]);
              const bestEntry = sorted[0][0];
              const barColor = (score: number) => score > 70 ? "bg-green-500" : score > 40 ? "bg-amber-500" : "bg-muted-foreground/30";
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]" data-testid="badge-overall-score">Overall: {scores.overall}</Badge>
                    <Badge variant="secondary" className="text-[10px]" data-testid="badge-best-entry"><Zap className="h-2.5 w-2.5 mr-0.5" /> {bestEntry}</Badge>
                  </div>
                  {entries.map(([label, score]) => (
                    <div key={label} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">{label}</span>
                        <span className="text-[11px] font-mono">{score}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted"><div className={`h-full rounded-full transition-all ${barColor(score)}`} style={{ width: `${score}%` }} /></div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {(business as any).opportunityProfile && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-medium text-muted-foreground">Answered Questions</p>
                {Object.entries((business as any).opportunityProfile as Record<string, { answer: string | string[]; answeredAt: string }>).map(([qId, entry]) => (
                  <div key={qId} className="flex items-start justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground">{qId.replace(/_/g, " ")}</span>
                    <span className="font-medium text-right">{Array.isArray(entry.answer) ? entry.answer.join(", ") : entry.answer}</span>
                  </div>
                ))}
              </div>
            )}
          </EditSection>
        )}

        <EditSection title="Claim Listing" icon={<Mail className="h-3.5 w-3.5" />} testId="section-claim">
          {business.claimStatus === "CLAIMED" ? (
            <p className="text-xs text-muted-foreground">This listing has been claimed by {business.ownerEmail}</p>
          ) : showClaimInput ? (
            <div className="flex items-center gap-2">
              <Input value={claimEmail} onChange={(e) => setClaimEmail(e.target.value)} placeholder="Owner email address" type="email" data-testid="input-claim-email" />
              <Button size="sm" onClick={() => sendClaimMutation.mutate()} disabled={sendClaimMutation.isPending || !claimEmail} data-testid="button-send-claim">
                <Send className="h-3 w-3 mr-1" /> Send
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowClaimInput(true)} data-testid="button-show-claim-input">
              <Mail className="h-3 w-3 mr-1" /> Send Claim Email
            </Button>
          )}
        </EditSection>

        <EditSection title="Google Places Data" icon={<Search className="h-3.5 w-3.5" />} testId="section-google">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs space-y-0.5 text-muted-foreground">
              {business.googlePlaceId ? (
                <>
                  {business.googleRating && <p>Rating: {business.googleRating} ({business.googleReviewCount} reviews)</p>}
                  {business.googleMapsUrl && <a href={business.googleMapsUrl} target="_blank" rel="noopener" className="flex items-center gap-1 hover:underline text-primary"><ExternalLink className="h-3 w-3" /> View on Google Maps</a>}
                  {business.googleLastSyncAt && <p>Last synced: {new Date(business.googleLastSyncAt).toLocaleString()}</p>}
                </>
              ) : <p>No Google Places data yet.</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => refreshGoogleMutation.mutate()} disabled={refreshGoogleMutation.isPending} data-testid="button-refresh-google">
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshGoogleMutation.isPending ? "animate-spin" : ""}`} />
              {business.googlePlaceId ? "Refresh" : "Pull from Google"}
            </Button>
          </div>
          <GooglePlacesSearch onSelect={handleGoogleSelect} />
        </EditSection>

        <EditSection title="Profile Badges" icon={<Shield className="h-3.5 w-3.5" />} testId="section-badges">
          <BadgeManager businessId={business.id} />
        </EditSection>

        <EditSection title="Trust & Verification" icon={<ShieldCheck className="h-3.5 w-3.5" />} testId="section-trust">
          <TrustSection businessId={business.id} />
        </EditSection>

        <EditSection title="FAQ / AEO Management" icon={<Bot className="h-3.5 w-3.5" />} testId="section-faq">
          <FaqManagementSection businessId={business.id} businessName={business.name} />
        </EditSection>

        <EditSection title="Intelligence" icon={<Zap className="h-3.5 w-3.5" />} testId="section-intelligence">
          <EntityIntelligenceCard entityId={business.id} />
        </EditSection>

        <EditSection title="CRM Contact Card" icon={<Contact className="h-3.5 w-3.5" />} testId="section-crm">
          <CrmContactSearch
            businessId={business.id}
            onAttach={async (contact: any) => {
              try {
                await apiRequest("POST", `/api/admin/businesses/${business.id}/contacts`, {
                  name: contact.name || "",
                  email: contact.email || "",
                  phone: contact.phone || "",
                  role: "primary",
                  ...(contact.id && { crmContactId: contact.id }),
                });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", business.id, "contacts"] });
                toast({ title: "Contact attached", description: `${contact.name || contact.email} linked to ${business.name}` });
              } catch {
                toast({ title: "Failed to attach contact", variant: "destructive" });
              }
            }}
          />
          <CrmContactCard
            businessId={business.id}
            businessName={business.name}
            ownerEmail={business.ownerEmail}
            claimStatus={business.claimStatus}
            listingTier={business.listingTier}
            preferredLanguage={(business as any).preferredLanguage}
          />
          <BusinessActivitySections
            businessId={business.id}
            onNavigateToContact={onNavigateToContact}
          />
        </EditSection>
      </div>
      </div>

      <div className="shrink-0 border-t pt-3 mt-3 flex items-center justify-between gap-2">
        <Button
          size="sm"
          onClick={handleUnifiedSave}
          disabled={!anyChanged || updateMutation.isPending}
          data-testid="button-save-footer"
        >
          {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          {anyChanged ? "Save All Changes" : "No Changes"}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} data-testid="button-close-dialog">
          Close
        </Button>
      </div>
    </DialogContent>

    <Dialog open={claimPreviewOpen} onOpenChange={setClaimPreviewOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-claim-preview-title">Claim Invite Preview</DialogTitle>
          <DialogDescription>This is what the business owner will receive when you send a claim invite.</DialogDescription>
        </DialogHeader>
        {claimPreviewData && (
          <div className="space-y-3">
            <div className="bg-muted rounded-md px-3 py-2">
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="text-sm font-medium" data-testid="text-claim-preview-subject">{claimPreviewData.subject}</p>
            </div>
            <div
              className="border rounded-md p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: claimPreviewData.html }}
              data-testid="claim-preview-body"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

function SeoDiagnosticPanel({ cityId }: { cityId?: string }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/seo-diagnostic?${params}`);
      if (!resp.ok) throw new Error("Failed to run diagnostic");
      const data = await resp.json();
      setResult(data);
    } catch {
      toast({ title: "Error", description: "Could not run SEO diagnostic.", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">SEO Diagnostic</h2>
          <p className="text-sm text-muted-foreground">Check crawlability, JSON-LD, canonicals, sitemap, and robots.txt</p>
        </div>
        <Button onClick={runDiagnostic} disabled={loading} className="gap-2" data-testid="button-run-seo-diagnostic">
          <Search className="h-4 w-4" />
          {loading ? "Running..." : "Run Diagnostic"}
        </Button>
      </div>
      {result && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">Generated: {result.generatedAt}</span>
            <Badge variant="outline" className="text-xs">{result.diagnostic?.length || 0} pages checked</Badge>
          </div>
          <div className="max-h-[500px] overflow-auto rounded-md bg-muted p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap" data-testid="text-seo-diagnostic-result">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}

function DashboardOverview({ stats, statsLoading, onNavigate }: { stats?: AdminStats; statsLoading: boolean; onNavigate: (section: string) => void }) {
  const statItems = [
    { icon: Building2, label: "Businesses", value: stats?.businesses || 0, section: "businesses" },
    { icon: Calendar, label: "Events", value: stats?.events || 0, section: "events" },
    { icon: FileText, label: "Pulse", value: stats?.articles || 0, section: "articles" },
    { icon: Clock, label: "Pending", value: stats?.submissions || 0, section: "submissions" },
    { icon: Mail, label: "Leads", value: stats?.leads || 0, section: "leads" },
    { icon: MapPin, label: "Neighborhoods", value: stats?.zones || 0, section: "zones" },
    { icon: ShieldCheck, label: "Entitlements", value: null, section: "entitlement-management" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-admin-dashboard-title">Command Center</h1>
        <p className="text-muted-foreground text-sm">Manage your city hub content</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statItems.map((item) => (
          <Card
            key={item.label}
            className="p-4 cursor-pointer transition-colors hover:bg-muted/50 hover:shadow-md"
            onClick={() => onNavigate(item.section)}
            data-testid={`card-stat-${item.label.toLowerCase()}`}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
            <div className="text-2xl font-bold">
              {item.value === null ? (
                <span className="text-sm font-medium text-muted-foreground">Manage</span>
              ) : statsLoading ? <Skeleton className="h-8 w-12" /> : item.value}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const SUBMISSION_TYPE_FILTERS = [
  { value: "all", label: "All Types" },
  { value: "ARTICLE_PITCH", label: "Article Pitch" },
  { value: "EVENT", label: "Event" },
  { value: "PRESS_RELEASE", label: "Press Release" },
  { value: "HUB_SHOUT_OUT", label: "Shout-Out" },
  { value: "MEDIA_MENTION", label: "Media Mention" },
  { value: "BUSINESS", label: "Business" },
  { value: "ORGANIZATION", label: "Organization" },
  { value: "OWNER_EDIT", label: "Owner Edit" },
  { value: "MARKETPLACE_INQUIRY", label: "Marketplace" },
];

const SUBMISSION_STATUS_FILTERS = [
  { value: "PENDING", label: "Pending" },
  { value: "all", label: "All" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function SubmissionsPanel({ submissions, reviewMutation, cityId }: { submissions?: AdminSubmission[]; reviewMutation: any; cityId?: string }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const filtered = (submissions || []).filter(sub => {
    if (typeFilter !== "all" && sub.type !== typeFilter) return false;
    if (statusFilter !== "all" && sub.status !== statusFilter) return false;
    return true;
  });

  const pendingByType = (submissions || []).filter(s => s.status === "PENDING").reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalPending = (submissions || []).filter(s => s.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-submissions-title">
          <ClipboardList className="h-5 w-5" />
          Community Submissions
          {totalPending > 0 && (
            <Badge variant="destructive" className="text-[10px]" data-testid="badge-total-pending">
              {totalPending} pending
            </Badge>
          )}
        </h2>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-auto min-w-[140px]" data-testid="select-submission-type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBMISSION_TYPE_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                  {f.value !== "all" && pendingByType[f.value] ? ` (${pendingByType[f.value]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[100px]" data-testid="select-submission-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBMISSION_STATUS_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <Card key={sub.id} className="p-4" data-testid={`card-submission-${sub.id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{sub.type}</Badge>
                    <Badge
                      variant={sub.status === "PENDING" ? "secondary" : sub.status === "APPROVED" ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {sub.status}
                    </Badge>
                  </div>
                  <h3 className="font-semibold">
                    {sub.payload?.name || sub.payload?.title || sub.payload?.businessName || "Submission"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    By {sub.submitterName} ({sub.submitterEmail})
                  </p>
                  {sub.type === "OWNER_EDIT" && sub.payload?.changes && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p className="font-medium">Requested changes:</p>
                      {Object.entries(sub.payload.changes).filter(([k]) => k !== "ownerName").map(([key, val]) => (
                        <p key={key}>{key}: {String(val)}</p>
                      ))}
                    </div>
                  )}
                  {sub.payload?.googlePlaceId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Search className="inline h-3 w-3 mr-1" />Google Place ID: {sub.payload.googlePlaceId}
                    </p>
                  )}
                </div>
                {sub.status === "PENDING" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => reviewMutation.mutate({ id: sub.id, status: "APPROVED" })}
                      disabled={reviewMutation.isPending}
                      data-testid={`button-approve-${sub.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewMutation.mutate({ id: sub.id, status: "REJECTED" })}
                      disabled={reviewMutation.isPending}
                      data-testid={`button-reject-${sub.id}`}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No submissions found</h3>
          <p className="text-sm text-muted-foreground">
            {statusFilter === "PENDING" ? "All submissions have been reviewed" : "No submissions match your filters"}
          </p>
        </Card>
      )}
    </div>
  );
}

function AdminSearchableSelect({ value, onSelect, groups, placeholder, testId }: {
  value: string;
  onSelect: (id: string) => void;
  groups: Array<{ label: string; items: Array<{ id: string; name: string }> }>;
  placeholder: string;
  testId: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedName = groups.flatMap((g) => g.items).find((i) => i.id === value)?.name || "";
  const lowerSearch = search.toLowerCase();
  const filtered = groups.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.name.toLowerCase().includes(lowerSearch)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer items-center justify-between"
        onClick={() => setOpen(!open)}
        data-testid={testId}
      >
        <span className={selectedName ? "" : "text-muted-foreground"}>{selectedName || placeholder}</span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg" data-testid={`${testId}-dropdown`}>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-8 pl-8 text-sm"
                autoFocus
                data-testid={`${testId}-search`}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>}
            {filtered.map((g, gi) => (
              <div key={g.label}>
                {gi > 0 && <div className="mx-2 my-1 border-t" />}
                <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-primary bg-muted/50 sticky top-0">{g.label}</div>
                {g.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full text-left pl-6 pr-3 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors ${item.id === value ? "bg-accent font-medium" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); onSelect(item.id); setOpen(false); setSearch(""); }}
                    data-testid={`${testId}-option-${item.id}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddListingDialog({ open, onClose, cityId }: { open: boolean; onClose: () => void; cityId: string }) {
  const { toast } = useToast();
  const { selectedCitySlug: adminCitySlug } = useAdminCitySelection();
  const citySlug = adminCitySlug || "";
  const [url, setUrl] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", address: "", city: "", state: "", zip: "",
    phone: "", email: "", websiteUrl: "", googleProfileUrl: "",
    neighborhoodId: "", primaryCategoryL2: "", nearestTransitStopId: "",
    commercialCenterName: "",
  });

  const placeDropdownRef = useRef<HTMLDivElement>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>>([]);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const placeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (placeDropdownRef.current && !placeDropdownRef.current.contains(e.target as Node)) setShowPlaceSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchGooglePlaces = useCallback((query: string) => {
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
    if (query.length < 3) { setPlaceSuggestions([]); setShowPlaceSuggestions(false); return; }
    placeDebounceRef.current = setTimeout(async () => {
      setPlaceSearchLoading(true);
      try {
        const res = await fetch(`/api/google/places/autocomplete?input=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setPlaceSuggestions(data.predictions || []);
          setShowPlaceSuggestions(true);
        }
      } catch {}
      setPlaceSearchLoading(false);
    }, 350);
  }, []);

  const selectPlaceSuggestion = useCallback(async (placeId: string) => {
    setShowPlaceSuggestions(false);
    setPlaceSearchLoading(true);
    try {
      const res = await fetch(`/api/google/places/details?placeId=${placeId}`);
      if (res.ok) {
        const d = await res.json();
        setForm((prev) => ({
          ...prev,
          name: d.name || prev.name,
          phone: d.phone || prev.phone,
          websiteUrl: d.website || prev.websiteUrl,
          googleProfileUrl: d.mapsUrl || prev.googleProfileUrl,
          address: d.address || prev.address,
        }));
      }
    } catch {}
    setPlaceSearchLoading(false);
  }, []);

  const { data: neighborhoodData } = useQuery<{ groups: { label: string; items: { id: string; name: string; slug: string; type: string }[] }[] }>({
    queryKey: ["/api/activate/neighborhoods", citySlug],
    queryFn: async () => {
      if (!citySlug) return { groups: [] };
      const resp = await fetch(`/api/activate/neighborhoods/${citySlug}`);
      if (!resp.ok) return { groups: [] };
      return resp.json();
    },
    enabled: open && !!citySlug,
  });
  const neighborhoodGroups = neighborhoodData?.groups || [];

  const { data: categoryData } = useQuery<{ groups: { label: string; children: { id: string; name: string }[] }[] }>({
    queryKey: ["/api/activate/categories-l2", "commerce"],
    queryFn: async () => {
      const resp = await fetch("/api/activate/categories-l2?type=commerce");
      if (!resp.ok) return { groups: [] };
      return resp.json();
    },
    enabled: open,
  });
  const categoryGroups = categoryData?.groups || [];

  const { data: transitLinesData } = useQuery<Array<{ id: string; name: string; lineType: string; color: string; cityId: string }>>({
    queryKey: ["/api/cities", citySlug, "transit-lines"],
    enabled: open && !!citySlug,
  });
  const { data: transitStopsData } = useQuery<Array<{ id: string; transitLineId: string; name: string; address: string | null; sortOrder: number; cityId: string }>>({
    queryKey: ["/api/cities", citySlug, "transit-stops"],
    enabled: open && !!citySlug,
  });
  const transitStopGroups = (transitLinesData || []).map((line) => ({
    label: line.name,
    items: (transitStopsData || [])
      .filter((stop) => stop.transitLineId === line.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((stop) => ({ id: stop.id, name: stop.name })),
  })).filter((g) => g.items.length > 0);

  const extractMutation = useMutation({
    mutationFn: async (websiteUrl: string) => {
      const resp = await apiRequest("POST", "/api/admin/intake/url-extract", {
        url: websiteUrl,
        cityId,
        draftType: "BUSINESS",
      });
      return resp.json();
    },
    onSuccess: (data) => {
      const ext = data?.draft?.extractedData || {};
      setForm((prev) => ({
        ...prev,
        name: ext.name || prev.name,
        description: ext.description || prev.description,
        address: ext.address || prev.address,
        city: ext.city || prev.city,
        state: ext.state || prev.state,
        zip: ext.zip || prev.zip,
        phone: ext.phone || prev.phone,
        email: ext.email || prev.email,
        websiteUrl: ext.websiteUrl || url,
      }));
      setShowForm(true);
      toast({ title: "Info extracted — review and complete the form" });
    },
    onError: () => {
      toast({ title: "Could not extract info from URL", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/businesses", {
        name: form.name,
        description: form.description,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        phone: form.phone,
        email: form.email,
        websiteUrl: form.websiteUrl,
        googleProfileUrl: form.googleProfileUrl,
        nearestTransitStopId: form.nearestTransitStopId || undefined,
        cityId,
        zoneId: form.neighborhoodId,
        slug: form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") + "-" + Math.random().toString(36).slice(2, 8),
        listingTier: "VERIFIED",
        claimStatus: "UNCLAIMED",
        categoryIds: form.primaryCategoryL2 ? [form.primaryCategoryL2] : [],
      });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      toast({ title: "Listing created" });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create listing", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setUrl("");
    setShowForm(false);
    setForm({
      name: "", description: "", address: "", city: "Charlotte", state: "NC", zip: "",
      phone: "", email: "", websiteUrl: "", googleProfileUrl: "",
      neighborhoodId: "", primaryCategoryL2: "", nearestTransitStopId: "",
      commercialCenterName: "",
    });
    onClose();
  };

  const canSubmit = form.name.trim() && form.neighborhoodId;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Listing</DialogTitle>
        </DialogHeader>

        {!showForm && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Paste a business website URL to auto-fill details, or enter info manually.</p>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                data-testid="input-add-listing-url"
              />
              <Button
                onClick={() => extractMutation.mutate(url)}
                disabled={!url.trim() || extractMutation.isPending}
                data-testid="button-extract-url"
              >
                {extractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              </Button>
            </div>
            <div className="text-center text-xs text-muted-foreground">or</div>
            <Button variant="outline" className="w-full" onClick={() => setShowForm(true)} data-testid="button-manual-entry">
              Enter Manually
            </Button>
          </div>
        )}

        {showForm && (
          <div className="space-y-4">
            <div className="relative" ref={placeDropdownRef}>
              <Label>Business Name *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); searchGooglePlaces(e.target.value); }}
                  onFocus={() => { if (placeSuggestions.length > 0) setShowPlaceSuggestions(true); }}
                  placeholder="Start typing to search Google..."
                  className="pl-10"
                  autoComplete="off"
                  data-testid="input-add-name"
                />
                {placeSearchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {showPlaceSuggestions && placeSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto" data-testid="places-suggestions">
                  {placeSuggestions.map((p) => (
                    <button
                      key={p.placeId}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-b-0 flex flex-col gap-0.5"
                      onMouseDown={(e) => { e.preventDefault(); selectPlaceSuggestion(p.placeId); }}
                      data-testid={`place-suggestion-${p.placeId}`}
                    >
                      <span className="font-medium text-sm">{p.mainText}</span>
                      <span className="text-xs text-muted-foreground">{p.secondaryText}</span>
                    </button>
                  ))}
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground/60 text-center">Powered by Google</div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Search Google to auto-fill details, or type manually</p>
            </div>

            <div>
              <Label>Primary Neighborhood *</Label>
              <AdminSearchableSelect
                value={form.neighborhoodId}
                onSelect={(v) => setForm({ ...form, neighborhoodId: v })}
                groups={neighborhoodGroups}
                placeholder="Search neighborhood..."
                testId="select-add-neighborhood"
              />
            </div>

            <div>
              <Label>Primary Category</Label>
              <AdminSearchableSelect
                value={form.primaryCategoryL2}
                onSelect={(v) => setForm({ ...form, primaryCategoryL2: v })}
                groups={categoryGroups.map((g) => ({ label: g.label, items: g.children }))}
                placeholder="Search category..."
                testId="select-add-category"
              />
            </div>

            <div>
              <Label>Shopping Center / Business Park <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={form.commercialCenterName}
                  onChange={(e) => setForm({ ...form, commercialCenterName: e.target.value })}
                  placeholder="e.g. SouthPark Mall, Ballantyne Corporate Park"
                  className="pl-10"
                  data-testid="input-add-center"
                />
              </div>
            </div>

            {transitStopGroups.length > 0 && (
              <div>
                <Label>Nearest Transit Stop <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <AdminSearchableSelect
                  value={form.nearestTransitStopId}
                  onSelect={(v) => setForm({ ...form, nearestTransitStopId: v })}
                  groups={transitStopGroups}
                  placeholder="Search transit stop..."
                  testId="select-add-transit"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(704) 555-1234" className="pl-10" data-testid="input-add-phone" />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hello@business.com" className="pl-10" data-testid="input-add-email" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://..." className="pl-10" data-testid="input-add-website" />
                </div>
              </div>
              <div>
                <Label>Google Profile URL</Label>
                <Input value={form.googleProfileUrl} onChange={(e) => setForm({ ...form, googleProfileUrl: e.target.value })} placeholder="Google Business link" data-testid="input-add-google" />
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" data-testid="input-add-address" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="input-add-city" />
              </div>
              <div>
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} data-testid="input-add-state" />
              </div>
              <div>
                <Label>ZIP</Label>
                <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} data-testid="input-add-zip" />
              </div>
            </div>

            <div>
              <Label>Short Description <span className="text-muted-foreground text-xs">(280 chars)</span></Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 280) })}
                placeholder="Brief description of the business..."
                rows={3}
                data-testid="input-add-description"
              />
              <p className="text-xs text-muted-foreground mt-1">{(form.description || "").length}/280</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} data-testid="button-add-cancel">Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                data-testid="button-add-save"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Create Listing
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MergeBusinessDialog({ selectedIds, businesses, onClose }: { selectedIds: string[]; businesses: Business[]; onClose: () => void }) {
  const { toast } = useToast();
  const [survivorId, setSurvivorId] = useState<string>(selectedIds[0]);
  const selectedBizs = businesses.filter((b) => selectedIds.includes(b.id));

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const duplicateIds = selectedIds.filter((id) => id !== survivorId);
      await apiRequest("POST", "/api/admin/businesses/merge", { survivorId, duplicateIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      toast({ title: "Businesses merged successfully" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Merge className="h-5 w-5" /> Merge Businesses
        </DialogTitle>
        <DialogDescription>
          Select the primary business to keep. All related data (reviews, leads, contacts) from the other{selectedIds.length > 2 ? ` ${selectedIds.length - 1} businesses` : " business"} will be transferred to it, and the duplicates will be deleted.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <p className="text-sm font-medium">Keep as primary:</p>
        <div className="space-y-2">
          {selectedBizs.map((biz) => (
            <button
              key={biz.id}
              type="button"
              className={`w-full text-left p-3 rounded-md border transition-colors ${survivorId === biz.id ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
              onClick={() => setSurvivorId(biz.id)}
              data-testid={`button-survivor-${biz.id}`}
            >
              <div className="flex items-center gap-2">
                {survivorId === biz.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{biz.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{[biz.address, biz.city].filter(Boolean).join(", ")}</p>
                </div>
                <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{biz.listingTier}</Badge>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">This action is irreversible. The {selectedIds.length - 1} non-primary business{selectedIds.length > 2 ? "es" : ""} will be permanently deleted.</p>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-merge-cancel">Cancel</Button>
        <Button
          variant="destructive"
          onClick={() => mergeMutation.mutate()}
          disabled={mergeMutation.isPending}
          data-testid="button-merge-confirm"
        >
          {mergeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Merge className="h-4 w-4 mr-1" />}
          Merge {selectedIds.length} Businesses
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function OwnerAccountManager({ businessId, businessName, ownerEmail, citySlug, slug }: { businessId: string; businessName: string; ownerEmail: string; citySlug: string; slug: string }) {
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState(ownerEmail);
  const [newPassword, setNewPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  const { data: ownerData, isLoading, isError } = useQuery<{ account: { id: string; email: string; displayName: string; lastLoginAt: string | null; createdAt: string } | null }>({
    queryKey: ["/api/admin/businesses", businessId, "owner-account"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/owner-account`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Failed to load owner account" }));
        throw new Error(body.message || "Failed to load owner account");
      }
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/businesses/${businessId}/owner-account/create`, { email: newEmail, password: newPassword });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Owner account created" });
      setShowCreateForm(false);
      setNewPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "owner-account"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/businesses/${businessId}/owner-account/reset-password`, { newPassword: resetPassword });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully" });
      setShowResetForm(false);
      setResetPassword("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/admin/businesses/${businessId}/owner-account`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Owner account removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "owner-account"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const loginUrl = `${window.location.origin}/owner/login`;
  const dashboardUrl = slug ? `${window.location.origin}/${citySlug}/owner/${slug}` : null;

  if (isLoading) return null;
  if (isError) return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" data-testid="section-owner-account-error">
      <p className="text-xs text-destructive">Unable to load owner account info</p>
    </div>
  );

  const account = ownerData?.account;

  return (
    <div className="rounded-lg border border-muted bg-muted/20 p-3 space-y-2" data-testid="section-owner-account">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Owner Portal</p>
        </div>
        {account && (
          <Badge variant="secondary" className="text-[10px]" data-testid="badge-owner-active">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )}
      </div>

      {account ? (
        <div className="space-y-2">
          <div className="text-xs space-y-0.5">
            <p><span className="text-muted-foreground">Email:</span> {account.email}</p>
            <p><span className="text-muted-foreground">Last login:</span> {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString() : "Never"}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2 gap-1" onClick={() => { navigator.clipboard.writeText(loginUrl); toast({ title: "Login URL copied" }); }} data-testid="button-copy-owner-login">
              <Copy className="h-3 w-3" />
              Copy Login URL
            </Button>
            {dashboardUrl && (
              <Button size="sm" variant="outline" className="text-[11px] h-7 px-2 gap-1" onClick={() => window.open(dashboardUrl, "_blank")} data-testid="button-open-owner-dashboard">
                <ExternalLink className="h-3 w-3" />
                View Dashboard
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2 gap-1" onClick={() => setShowResetForm(!showResetForm)} data-testid="button-reset-owner-password">
              <KeyRound className="h-3 w-3" />
              Reset Password
            </Button>
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2 gap-1 text-destructive" onClick={() => { if (confirm("Remove this owner account? They will need to re-register.")) deleteMutation.mutate(); }} data-testid="button-delete-owner-account">
              <Trash2 className="h-3 w-3" />
              Remove
            </Button>
          </div>
          {showResetForm && (
            <div className="flex items-center gap-2 pt-1">
              <Input type="password" placeholder="New password (8+ chars)" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="h-8 text-xs" data-testid="input-reset-password" />
              <Button size="sm" className="h-8 text-xs px-3" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending || resetPassword.length < 8} data-testid="button-confirm-reset">
                {resetMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reset"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">No owner account yet. Create one so the business owner can log in and manage their listing.</p>
          {!showCreateForm ? (
            <Button size="sm" variant="outline" className="text-[11px] h-7 px-2 gap-1" onClick={() => { setNewEmail(ownerEmail); setShowCreateForm(true); }} data-testid="button-create-owner-account">
              <UserPlus className="h-3 w-3" />
              Create Owner Account
            </Button>
          ) : (
            <div className="space-y-2 p-2 rounded-md border bg-background">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-8 text-xs" data-testid="input-owner-email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Password (8+ characters)</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-8 text-xs" data-testid="input-owner-password" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newEmail || newPassword.length < 8} data-testid="button-confirm-create-owner">
                  {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create Account"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowCreateForm(false)} data-testid="button-cancel-create-owner">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BusinessesPanel({ adminBusinesses, cityId: propCityId, autoSelectBiz, onAutoSelectConsumed, onNavigateToContact }: { adminBusinesses?: Business[]; cityId?: string; autoSelectBiz?: Business | null; onAutoSelectConsumed?: () => void; onNavigateToContact?: (contactId: string) => void }) {
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizSearch, setBizSearch] = useState("");

  useEffect(() => {
    if (autoSelectBiz) {
      setSelectedBiz(autoSelectBiz);
      onAutoSelectConsumed?.();
    }
  }, [autoSelectBiz]);
  const [bizTierFilter, setBizTierFilter] = useState("all");
  const [bizClaimFilter, setBizClaimFilter] = useState("all");
  const [bizOpportunityFilter, setBizOpportunityFilter] = useState("all");
  const [bizSourceFilter, setBizSourceFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<{ action: string; tier?: string; claimStatus?: string } | null>(null);
  const defaultCityId = useDefaultCityId();
  const cityId = propCityId || defaultCityId;
  const { toast } = useToast();

  const { data: pendingDrafts } = useQuery<any[]>({
    queryKey: ["/api/admin/intake/drafts"],
  });
  const pendingCount = (pendingDrafts || []).filter((d: any) => d.status === "PENDING").length;

  const bulkCleanSlugsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/businesses/bulk-clean-slugs");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Slugs Cleaned",
        description: `Cleaned ${data.cleaned} slug${data.cleaned !== 1 ? "s" : ""}, skipped ${data.skipped} (collisions). ${data.total} total businesses.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: async (body: { ids: string[]; action: string; tier?: string; claimStatus?: string }) => {
      const res = await apiRequest("POST", "/api/admin/businesses/bulk-action", body);
      return res.json();
    },
    onSuccess: (data: any, variables: { action: string; tier?: string; claimStatus?: string }) => {
      const actionLabels: Record<string, string> = {
        change_tier: `changed tier to ${variables.tier}`,
        toggle_claim: `marked as ${variables.claimStatus === "CLAIMED" ? "claimed" : "unclaimed"}`,
        archive: "archived",
        unarchive: "restored from archive",
        delete: "deleted",
      };
      const label = actionLabels[variables.action] || "updated";
      toast({
        title: "Bulk Action Complete",
        description: `${data.affected} of ${data.total} listing${data.total !== 1 ? "s" : ""} ${label}.`,
      });
      setCheckedIds(new Set());
      setBulkConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
    },
    onError: (err: any) => {
      toast({ title: "Bulk Action Failed", description: err.message, variant: "destructive" });
      setBulkConfirm(null);
    },
  });

  const executeBulkAction = () => {
    if (!bulkConfirm) return;
    const ids = Array.from(checkedIds);
    bulkActionMutation.mutate({
      ids,
      action: bulkConfirm.action,
      tier: bulkConfirm.tier,
      claimStatus: bulkConfirm.claimStatus,
    });
  };

  const getBulkConfirmMessage = () => {
    if (!bulkConfirm) return "";
    const count = checkedIds.size;
    switch (bulkConfirm.action) {
      case "change_tier":
        return `Change tier to ${bulkConfirm.tier} for ${count} listing${count !== 1 ? "s" : ""}?`;
      case "toggle_claim":
        return `Mark ${count} listing${count !== 1 ? "s" : ""} as ${bulkConfirm.claimStatus === "CLAIMED" ? "Claimed" : "Unclaimed"}?`;
      case "archive":
        return `Archive ${count} listing${count !== 1 ? "s" : ""}? They will be hidden from public view.`;
      case "unarchive":
        return `Restore ${count} listing${count !== 1 ? "s" : ""} from archive?`;
      case "delete":
        return `Permanently delete ${count} listing${count !== 1 ? "s" : ""}? This action cannot be undone.`;
      default:
        return "";
    }
  };

  const filteredBusinesses = (adminBusinesses || []).filter((biz) => {
    if (bizSearch) {
      const q = bizSearch.toLowerCase();
      if (!biz.name.toLowerCase().includes(q) && !(biz.address || "").toLowerCase().includes(q) && !(biz.city || "").toLowerCase().includes(q)) return false;
    }
    if (bizTierFilter !== "all" && biz.listingTier !== bizTierFilter) return false;
    if (bizClaimFilter !== "all" && biz.claimStatus !== bizClaimFilter) return false;
    if (bizSourceFilter !== "all") {
      const src = (biz as any).seedSourceType || "";
      if (bizSourceFilter === "capture" && src !== "CAPTURE") return false;
      if (bizSourceFilter === "places" && src !== "GOOGLE_PLACES") return false;
      if (bizSourceFilter === "manual" && src !== "") return false;
      if (bizSourceFilter === "seed" && src !== "SEED") return false;
    }
    if (bizOpportunityFilter !== "all") {
      const scores = (biz as any).opportunityScores as { hubTv: number; listingUpgrade: number; adBuyer: number; eventPartner: number; overall: number } | null;
      if (bizOpportunityFilter === "has-screen") {
        if (!(biz as any).venueScreenLikely) return false;
      } else if (bizOpportunityFilter === "hub-tv") {
        if (!scores || scores.hubTv < 60) return false;
      } else if (bizOpportunityFilter === "upgrade") {
        if (!scores || scores.listingUpgrade < 60) return false;
      } else if (bizOpportunityFilter === "ad-buyer") {
        if (!scores || scores.adBuyer < 60) return false;
      } else if (bizOpportunityFilter === "event-partner") {
        if (!scores || scores.eventPartner < 60) return false;
      }
    }
    return true;
  });

  const visibleIds = new Set(filteredBusinesses.map((biz) => biz.id));
  const allVisibleSelected = filteredBusinesses.length > 0 && filteredBusinesses.every((biz) => checkedIds.has(biz.id));
  const someVisibleSelected = filteredBusinesses.some((biz) => checkedIds.has(biz.id));
  const toggleSelectAll = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  const toggleChecked = (id: string, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMergeClose = () => {
    setShowMergeDialog(false);
    setCheckedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-lg">All Businesses</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {checkedIds.size > 0 && (
            <>
              {checkedIds.size >= 2 && (
                <Button size="sm" variant="destructive" onClick={() => setShowMergeDialog(true)} data-testid="button-merge-selected">
                  <Merge className="h-4 w-4 mr-1" /> Merge {checkedIds.size}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-bulk-change-tier">
                    <Crown className="h-4 w-4 mr-1" /> Change Tier <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Set tier for {checkedIds.size} listing{checkedIds.size !== 1 ? "s" : ""}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setBulkConfirm({ action: "change_tier", tier: "FREE" })} data-testid="menu-tier-free">Free</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBulkConfirm({ action: "change_tier", tier: "VERIFIED" })} data-testid="menu-tier-verified">Verified</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBulkConfirm({ action: "change_tier", tier: "PREMIUM" })} data-testid="menu-tier-premium">Premium</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBulkConfirm({ action: "change_tier", tier: "ENHANCED" })} data-testid="menu-tier-enhanced">Enhanced</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-bulk-claim">
                    <UserCheck className="h-4 w-4 mr-1" /> Claim Status <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setBulkConfirm({ action: "toggle_claim", claimStatus: "CLAIMED" })} data-testid="menu-claim-claimed">
                    <UserCheck className="h-4 w-4 mr-1" /> Mark as Claimed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBulkConfirm({ action: "toggle_claim", claimStatus: "UNCLAIMED" })} data-testid="menu-claim-unclaimed">
                    <UserX className="h-4 w-4 mr-1" /> Mark as Unclaimed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-bulk-archive">
                    <Archive className="h-4 w-4 mr-1" /> Archive <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setBulkConfirm({ action: "archive" })} data-testid="menu-archive">
                    <Archive className="h-4 w-4 mr-1" /> Archive Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBulkConfirm({ action: "unarchive" })} data-testid="menu-unarchive">
                    <ArchiveRestore className="h-4 w-4 mr-1" /> Unarchive Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="destructive" onClick={() => setBulkConfirm({ action: "delete" })} data-testid="button-bulk-delete">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCheckedIds(new Set())} data-testid="button-clear-selection">
                <X className="h-4 w-4 mr-1" /> Clear ({checkedIds.size})
              </Button>
            </>
          )}
          <span className="text-xs text-muted-foreground">{filteredBusinesses.length} of {(adminBusinesses || []).length}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkCleanSlugsMutation.mutate()}
            disabled={bulkCleanSlugsMutation.isPending}
            data-testid="button-bulk-clean-slugs"
          >
            {bulkCleanSlugsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Bulk Clean Slugs
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)} data-testid="button-add-listing">
            <Plus className="h-4 w-4 mr-1" /> Add Listing
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="banner-pending-drafts">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-300">
            {pendingCount} draft{pendingCount !== 1 ? "s" : ""} pending review in Content Intake
          </span>
        </div>
      )}

      {showAddDialog && cityId && (
        <AddListingDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} cityId={cityId} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name, address..."
          value={bizSearch}
          onChange={(e) => setBizSearch(e.target.value)}
          className="w-full sm:w-64"
          data-testid="input-biz-search"
        />
        <Select value={bizTierFilter} onValueChange={setBizTierFilter}>
          <SelectTrigger className="w-[120px]" data-testid="select-biz-tier">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="VERIFIED">Verified</SelectItem>
            <SelectItem value="PREMIUM">Premium</SelectItem>
            <SelectItem value="ENHANCED">Enhanced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bizClaimFilter} onValueChange={setBizClaimFilter}>
          <SelectTrigger className="w-[130px]" data-testid="select-biz-claim">
            <SelectValue placeholder="Claim Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Claims</SelectItem>
            <SelectItem value="UNCLAIMED">Unclaimed</SelectItem>
            <SelectItem value="CLAIM_SENT">Claim Sent</SelectItem>
            <SelectItem value="CLAIMED">Claimed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bizOpportunityFilter} onValueChange={setBizOpportunityFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-biz-opportunity">
            <SelectValue placeholder="Opportunity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Opportunity</SelectItem>
            <SelectItem value="hub-tv">Hub TV Ready (&gt;60)</SelectItem>
            <SelectItem value="upgrade">Upgrade Candidate (&gt;60)</SelectItem>
            <SelectItem value="ad-buyer">Ad Buyer (&gt;60)</SelectItem>
            <SelectItem value="event-partner">Event Partner (&gt;60)</SelectItem>
            <SelectItem value="has-screen">Likely Has Screen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bizSourceFilter} onValueChange={setBizSourceFilter}>
          <SelectTrigger className="w-[130px]" data-testid="select-biz-source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="capture">Field Capture</SelectItem>
            <SelectItem value="places">Google Places</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="seed">Seed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filteredBusinesses.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-md" data-testid="list-header-select-all">
            <div
              className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${allVisibleSelected ? "bg-primary border-primary" : someVisibleSelected ? "bg-primary/50 border-primary" : "border-muted-foreground/30"}`}
              onClick={toggleSelectAll}
              data-testid="checkbox-select-all"
            >
              {allVisibleSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              {someVisibleSelected && !allVisibleSelected && <span className="block h-0.5 w-2.5 bg-primary-foreground" />}
            </div>
            <span className="text-xs text-muted-foreground">Select all on this page ({filteredBusinesses.length})</span>
          </div>
          {filteredBusinesses.map((biz) => (
            <Dialog key={biz.id} open={selectedBiz?.id === biz.id} onOpenChange={(open) => setSelectedBiz(open ? biz : null)}>
              <Card className="p-4 hover-elevate cursor-pointer" onClick={() => setSelectedBiz(biz)} data-testid={`card-biz-${biz.id}`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${checkedIds.has(biz.id) ? "bg-primary border-primary" : "border-muted-foreground/30"}`}
                      onClick={(e) => toggleChecked(biz.id, e)}
                      data-testid={`checkbox-biz-${biz.id}`}
                    >
                      {checkedIds.has(biz.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <BizImage src={biz.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-sm">{biz.name}</h3>
                        {biz.preferredLanguage === "es" && (
                          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30" data-testid={`badge-lang-es-${biz.id}`}>ES</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[biz.address, biz.city].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        biz.listingTier === "ENHANCED" ? "border-purple-500 text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-300" :
                        biz.listingTier === "VERIFIED" ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300" :
                        "border-muted-foreground/30 text-muted-foreground"
                      }`}
                      data-testid={`badge-tier-${biz.id}`}
                    >
                      {biz.listingTier === "ENHANCED" ? "Enhanced" : biz.listingTier === "VERIFIED" ? "Verified" : "Free"}
                    </Badge>
                    <Badge
                      variant={biz.claimStatus === "CLAIMED" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {biz.claimStatus}
                    </Badge>
                    {(biz as any).venueScreenLikely && (
                      <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300" data-testid={`badge-screen-${biz.id}`}>
                        <Monitor className="h-2.5 w-2.5 mr-0.5" />TV
                      </Badge>
                    )}
                    {(biz as Business & { translationStatus?: string }).translationStatus && (
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          (biz as Business & { translationStatus?: string }).translationStatus === "completed" ? "border-green-400 text-green-600 bg-green-50 dark:bg-green-950" :
                          (biz as Business & { translationStatus?: string }).translationStatus === "failed" ? "border-red-400 text-red-600 bg-red-50 dark:bg-red-950" :
                          "border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950"
                        }`}
                        data-testid={`badge-translation-${biz.id}`}
                      >
                        <Languages className="h-2.5 w-2.5 mr-0.5" />
                        {(biz as Business & { translationStatus?: string }).translationStatus === "completed" ? "ES✓" : (biz as Business & { translationStatus?: string }).translationStatus === "failed" ? "ES✗" : "ES…"}
                      </Badge>
                    )}
                    {(() => {
                      const scores = (biz as any).opportunityScores as { hubTv: number; listingUpgrade: number; adBuyer: number; eventPartner: number; overall: number } | null;
                      if (!scores) return null;
                      const dotColor = scores.overall > 70 ? "bg-green-500" : scores.overall > 40 ? "bg-amber-500" : "bg-muted-foreground/40";
                      const sorted: [string, number][] = [
                        ["Hub TV", scores.hubTv],
                        ["Enhanced Listing", scores.listingUpgrade],
                        ["Pulse Advertising", scores.adBuyer],
                        ["Event Sponsorship", scores.eventPartner],
                      ];
                      sorted.sort((a, b) => b[1] - a[1]);
                      const bestLabel = sorted[0][1] > 40 ? sorted[0][0] : null;
                      return (
                        <>
                          <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} title={`Opportunity: ${scores.overall}`} data-testid={`dot-opportunity-${biz.id}`} />
                          {bestLabel && (
                            <Badge variant="outline" className="text-[9px] border-muted-foreground/30" data-testid={`badge-entry-${biz.id}`}>
                              {bestLabel}
                            </Badge>
                          )}
                        </>
                      );
                    })()}
                    {biz.googlePlaceId && (
                      <Badge variant="outline" className="text-[10px]">
                        <Search className="h-2.5 w-2.5 mr-0.5" />Google
                      </Badge>
                    )}
                    {(biz as any).seedSourceType === "CAPTURE" && (
                      <Badge variant="outline" className="text-[10px] border-purple-400 text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-300" data-testid={`badge-catch-${biz.id}`}>
                        <Smartphone className="h-2.5 w-2.5 mr-0.5" />Field Capture
                      </Badge>
                    )}
                    <Button size="icon" variant="ghost" data-testid={`button-edit-biz-${biz.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
              {selectedBiz?.id === biz.id && (
                <BusinessEditDialog business={biz} onClose={() => setSelectedBiz(null)} onNavigateToContact={onNavigateToContact} />
              )}
            </Dialog>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No businesses yet</h3>
        </Card>
      )}

      <Dialog open={showMergeDialog} onOpenChange={(v) => { if (!v) handleMergeClose(); }}>
        {showMergeDialog && (
          <MergeBusinessDialog
            selectedIds={Array.from(checkedIds)}
            businesses={adminBusinesses || []}
            onClose={handleMergeClose}
          />
        )}
      </Dialog>

      <Dialog open={!!bulkConfirm} onOpenChange={(v) => { if (!v) setBulkConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkConfirm?.action === "delete" ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <AlertCircle className="h-5 w-5 text-amber-500" />}
              Confirm Bulk Action
            </DialogTitle>
            <DialogDescription>{getBulkConfirmMessage()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirm(null)} disabled={bulkActionMutation.isPending} data-testid="button-bulk-cancel">
              Cancel
            </Button>
            <Button
              variant={bulkConfirm?.action === "delete" ? "destructive" : "default"}
              onClick={executeBulkAction}
              disabled={bulkActionMutation.isPending}
              data-testid="button-bulk-confirm"
            >
              {bulkActionMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {bulkConfirm?.action === "delete" ? "Delete" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlowSessionsPanel({ cityId }: { cityId?: string }) {
  const { data: sessions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/flow-sessions"],
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  const personaLabels: Record<string, string> = {
    business_owner: "Business Owner",
    long_time_resident: "Long-Time Resident",
    newcomer: "Newcomer",
    event_host: "Event Host",
    shop_venue_owner: "Shop/Venue Owner",
    entrepreneur_side_hustle: "Entrepreneur",
    hiring_business: "Hiring Business",
  };

  const getSignalCount = (session: any) => {
    if (!session.extractedSignals) return 0;
    return Object.values(session.extractedSignals as Record<string, any>).reduce(
      (sum: number, cat: any) => sum + (cat?.signals?.length || 0), 0
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg" data-testid="text-flow-sessions-title">Charlotte Flow Sessions</h2>
        <p className="text-sm text-muted-foreground">Recent profiling and story interview conversations</p>
      </div>
      {(!sessions || sessions.length === 0) ? (
        <Card className="p-8 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No flow sessions yet</h3>
          <p className="text-sm text-muted-foreground">Sessions will appear here when users complete Charlotte's guided flows.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session: any) => {
            const signalCount = getSignalCount(session);
            const modulesCount = session.modulesCompleted?.length || 0;
            const isExpanded = expandedId === session.id;

            return (
              <Card
                key={session.id}
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                data-testid={`card-flow-session-${session.id}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={session.flowType === "opportunity-profile" ? "default" : "secondary"} className="text-[10px]">
                        {session.flowType === "opportunity-profile" ? "Opportunity Profile" : session.flowType === "story-interview" ? "Story Interview" : session.flowType}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${session.status === "completed" ? "border-green-500 text-green-700" : session.status === "abandoned" ? "border-red-500 text-red-600" : "border-amber-500 text-amber-700"}`}>
                        {session.status}
                      </Badge>
                      {session.detectedPersona && (
                        <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600">
                          {personaLabels[session.detectedPersona] || session.detectedPersona}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate" data-testid={`text-session-name-${session.id}`}>
                      {session.businessName || session.contactName || "Anonymous"}
                    </p>
                    {session.contactEmail && (
                      <p className="text-xs text-muted-foreground">{session.contactEmail}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{session.responses ? `${Object.keys(session.responses).length} answers` : "0 answers"}</span>
                      {modulesCount > 0 && <span>{modulesCount} topics</span>}
                      {signalCount > 0 && <span>{signalCount} signals</span>}
                      {session.createdAt && <span>{new Date(session.createdAt).toLocaleDateString()}</span>}
                    </div>
                    {session.storyDepthScore != null && session.storyDepthScore > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 flex-1 bg-muted rounded-full max-w-[120px]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${session.storyDepthScore}%`,
                              background: session.storyDepthScore >= 60 ? "hsl(142 71% 45%)" : session.storyDepthScore >= 30 ? "hsl(38 92% 50%)" : "hsl(0 0% 60%)",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{session.storyDepthScore}/100</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {session.generatedContent && (
                      <Badge variant="outline" className="text-[10px] border-purple-500 text-purple-700 shrink-0">
                        Content Generated
                      </Badge>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
                    {session.modulesCompleted && session.modulesCompleted.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Topics Covered</p>
                        <div className="flex flex-wrap gap-1">
                          {session.modulesCompleted.map((m: string) => (
                            <Badge key={m} variant="secondary" className="text-[10px]">{m.replace(/_/g, " ")}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {session.extractedSignals && Object.keys(session.extractedSignals).length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Extracted Signals</p>
                        {Object.entries(session.extractedSignals as Record<string, any>).map(([cat, data]: [string, any]) => {
                          if (!data?.signals?.length) return null;
                          return (
                            <div key={cat} className="mb-2">
                              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{cat.replace(/_/g, " ")}</p>
                              {data.signals.map((s: any, i: number) => (
                                <div key={i} className="text-xs ml-2 py-0.5">
                                  <span className="font-medium">{s.value}</span>
                                  {s.context && <span className="text-muted-foreground"> - {s.context}</span>}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {session.responses && Object.keys(session.responses).length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Conversation Responses</p>
                        {Object.entries(session.responses as Record<string, any>).map(([key, resp]: [string, any]) => (
                          <div key={key} className="text-xs ml-2 py-0.5">
                            <span className="font-medium text-muted-foreground">{key.replace(/_/g, " ")}:</span>{" "}
                            <span>{Array.isArray(resp.answer) ? resp.answer.join(", ") : typeof resp.answer === "string" && resp.answer.length > 200 ? resp.answer.substring(0, 200) + "..." : resp.answer}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConversationPipelinePanel({ cityId }: { cityId?: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/conversation-pipeline"],
  });
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("all");

  const categoryLabels: Record<string, { label: string; icon: string; action: string }> = {
    story_material: { label: "Story Material", icon: "BookOpen", action: "Generate Article" },
    lead_generation: { label: "Lead Generation", icon: "Users", action: "Add to CRM" },
    community_intelligence: { label: "Community Intelligence", icon: "MapPin", action: "Add to Content" },
    job_board: { label: "Job Board", icon: "Briefcase", action: "Create Job Listing" },
    marketplace: { label: "Marketplace", icon: "ShoppingBag", action: "Create Listing" },
    venue_tv: { label: "Venue TV Prospects", icon: "Monitor", action: "Flag as TV Prospect" },
    media_sources: { label: "Media Sources", icon: "Radio", action: "Add to Sources" },
    entrepreneur_ecosystem: { label: "Entrepreneur Ecosystem", icon: "Rocket", action: "Add to Directory" },
  };

  const handleAction = async (category: string, signal: any) => {
    try {
      let endpoint = "";
      let body: any = { value: signal.value, context: signal.context, sessionId: signal.sessionId };

      if (category === "lead_generation" || category === "story_material" || category === "community_intelligence" || category === "media_sources" || category === "entrepreneur_ecosystem") {
        endpoint = "/api/admin/signals/create-contact";
      } else if (category === "venue_tv") {
        endpoint = "/api/admin/signals/flag-tv-prospect";
      } else if (category === "job_board") {
        endpoint = "/api/admin/signals/create-marketplace";
        body.listingType = "JOB";
      } else if (category === "marketplace") {
        endpoint = "/api/admin/signals/create-marketplace";
        body.listingType = "CLASSIFIED";
      }

      if (!endpoint) return;

      await apiRequest("POST", endpoint, body);
      toast({ title: "Action completed", description: `${signal.value} has been processed` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversation-pipeline"] });
    } catch {
      toast({ title: "Action failed", description: "Network error", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  const pipeline = data?.pipeline || {};
  const storyReady = data?.storyReadySessions || [];

  const allCategories = Object.entries(pipeline).filter(([_, signals]: [string, any]) => signals.length > 0);
  const totalSignals = allCategories.reduce((sum, [_, signals]: [string, any]) => sum + signals.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg" data-testid="text-pipeline-title">Conversation Pipeline</h2>
        <p className="text-sm text-muted-foreground">Intelligence extracted from Charlotte interviews - {totalSignals} total signals</p>
      </div>

      {storyReady.length > 0 && (
        <Card className="p-4 border-green-200 bg-green-50/50" data-testid="card-story-ready">
          <p className="text-sm font-medium text-green-800 mb-2">Stories Ready for Generation ({storyReady.length})</p>
          <div className="space-y-1">
            {storyReady.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="font-medium">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Score: {s.score}/100</span>
                  {s.persona && <Badge variant="outline" className="text-[9px]">{s.persona.replace(/_/g, " ")}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={activeCategory === "all" ? "default" : "outline"}
          size="sm"
          className="text-xs"
          onClick={() => setActiveCategory("all")}
          data-testid="button-filter-all"
        >
          All ({totalSignals})
        </Button>
        {allCategories.map(([cat, signals]: [string, any]) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setActiveCategory(cat)}
            data-testid={`button-filter-${cat}`}
          >
            {categoryLabels[cat]?.label || cat} ({signals.length})
          </Button>
        ))}
      </div>

      {totalSignals === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No signals extracted yet</h3>
          <p className="text-sm text-muted-foreground">Signals will appear here as Charlotte conducts story interviews and discovers leads, opportunities, and community intelligence.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(activeCategory === "all" ? allCategories : allCategories.filter(([cat]) => cat === activeCategory)).map(([cat, signals]: [string, any]) => (
            <Card key={cat} className="p-4" data-testid={`card-pipeline-${cat}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {categoryLabels[cat]?.label || cat.replace(/_/g, " ")}
              </p>
              <div className="space-y-2">
                {signals.map((signal: any, idx: number) => (
                  <div key={idx} className="flex items-start justify-between gap-2 py-1.5 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{signal.value}</p>
                      {signal.context && <p className="text-xs text-muted-foreground">{signal.context}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        From: {signal.sessionName}
                        {signal.sessionDate && ` - ${new Date(signal.sessionDate).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] shrink-0"
                      onClick={() => handleAction(cat, signal)}
                      data-testid={`button-action-${cat}-${idx}`}
                    >
                      {categoryLabels[cat]?.action || "Process"}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CuratedListsPanel({ cityId }: { cityId?: string }) {
  const CITY_ID = cityId || useDefaultCityId();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [editingList, setEditingList] = useState<any>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formType, setFormType] = useState("TOP10");
  const [formDescription, setFormDescription] = useState("");

  const { data: lists, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/curated-lists", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/curated-lists?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const { data: listDetail } = useQuery<any>({
    queryKey: ["/api/admin/curated-lists", selectedListId],
    enabled: !!selectedListId,
  });

  const { data: allBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/businesses?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/curated-lists", {
        title: formTitle,
        slug: formSlug || formTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        type: formType,
        description: formDescription || null,
        cityId: CITY_ID,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists"] });
      setShowCreateDialog(false);
      setFormTitle(""); setFormSlug(""); setFormType("TOP10"); setFormDescription("");
      toast({ title: "List created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/admin/curated-lists/${editingList.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists"] });
      if (selectedListId) queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists", selectedListId] });
      setEditingList(null);
      toast({ title: "List updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/curated-lists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists"] });
      if (selectedListId) setSelectedListId(null);
      toast({ title: "List deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ listId, businessId, rank }: { listId: string; businessId: string; rank: number }) => {
      await apiRequest("POST", `/api/admin/curated-lists/${listId}/items`, {
        itemType: "BUSINESS",
        businessId,
        rank,
      });
    },
    onSuccess: () => {
      if (selectedListId) queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists", selectedListId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists"] });
      toast({ title: "Business added to list" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, rank }: { id: string; rank: number }) => {
      await apiRequest("PATCH", `/api/admin/curated-list-items/${id}`, { rank });
    },
    onSuccess: () => {
      if (selectedListId) queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists", selectedListId] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/curated-list-items/${id}`);
    },
    onSuccess: () => {
      if (selectedListId) queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists", selectedListId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated-lists"] });
      toast({ title: "Item removed" });
    },
  });

  const [businessSearch, setBusinessSearch] = useState("");
  const filteredBusinesses = allBusinesses?.filter(b =>
    b.name.toLowerCase().includes(businessSearch.toLowerCase()) &&
    !listDetail?.items?.some((item: any) => item.businessId === b.id)
  ).slice(0, 10) || [];

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (selectedListId && listDetail) {
    const items = (listDetail.items || []).sort((a: any, b: any) => a.rank - b.rank);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedListId(null)} data-testid="button-back-to-lists">
              <ChevronRight className="h-4 w-4 rotate-180 mr-1" /> Back
            </Button>
            <h2 className="text-lg font-semibold" data-testid="text-list-title">{listDetail.title}</h2>
            <Badge variant="secondary">{listDetail.type}</Badge>
          </div>
          <span className="text-sm text-muted-foreground">{items.length} item(s)</span>
        </div>

        {listDetail.description && (
          <p className="text-sm text-muted-foreground" data-testid="text-list-description">{listDetail.description}</p>
        )}

        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Add Business</h3>
          <Input
            value={businessSearch}
            onChange={(e) => setBusinessSearch(e.target.value)}
            placeholder="Search businesses to add..."
            data-testid="input-search-business-to-add"
          />
          {businessSearch && filteredBusinesses.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredBusinesses.map((biz) => (
                <div key={biz.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover-elevate">
                  <span className="text-sm truncate" data-testid={`text-biz-search-${biz.id}`}>{biz.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      addItemMutation.mutate({ listId: selectedListId!, businessId: biz.id, rank: items.length + 1 });
                      setBusinessSearch("");
                    }}
                    disabled={addItemMutation.isPending}
                    data-testid={`button-add-biz-${biz.id}`}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              ))}
            </div>
          )}
          {businessSearch && filteredBusinesses.length === 0 && (
            <p className="text-xs text-muted-foreground">No matching businesses found</p>
          )}
        </Card>

        <div className="space-y-2">
          {items.length === 0 ? (
            <Card className="p-6 text-center">
              <ListOrdered className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No items in this list yet. Search and add businesses above.</p>
            </Card>
          ) : (
            items.map((item: any, idx: number) => (
              <Card key={item.id} className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-mono text-muted-foreground w-6 text-center shrink-0" data-testid={`text-rank-${item.id}`}>
                    #{item.rank}
                  </span>
                  <span className="text-sm font-medium truncate" data-testid={`text-item-name-${item.id}`}>
                    {item.business?.name || item.businessId || "Unknown"}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === 0 || updateItemMutation.isPending}
                    onClick={() => {
                      const prevItem = items[idx - 1];
                      updateItemMutation.mutate({ id: item.id, rank: prevItem.rank });
                      updateItemMutation.mutate({ id: prevItem.id, rank: item.rank });
                    }}
                    data-testid={`button-move-up-${item.id}`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === items.length - 1 || updateItemMutation.isPending}
                    onClick={() => {
                      const nextItem = items[idx + 1];
                      updateItemMutation.mutate({ id: item.id, rank: nextItem.rank });
                      updateItemMutation.mutate({ id: nextItem.id, rank: item.rank });
                    }}
                    data-testid={`button-move-down-${item.id}`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItemMutation.mutate(item.id)}
                    disabled={removeItemMutation.isPending}
                    data-testid={`button-remove-item-${item.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Curated Lists</h2>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-list">
          <Plus className="h-4 w-4 mr-1" /> New List
        </Button>
      </div>

      {(!lists || lists.length === 0) ? (
        <Card className="p-8 text-center">
          <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No Curated Lists</h3>
          <p className="text-sm text-muted-foreground">Create your first curated list to feature top businesses.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {lists.map((list: any) => (
            <Card key={list.id} className="p-4 flex items-center justify-between gap-3 hover-elevate cursor-pointer" onClick={() => setSelectedListId(list.id)} data-testid={`card-list-${list.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm" data-testid={`text-list-name-${list.id}`}>{list.title}</span>
                  <Badge variant="secondary">{list.type}</Badge>
                  <Badge variant="outline">{list.itemCount ?? 0} items</Badge>
                </div>
                {list.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{list.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">/{list.slug}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingList(list);
                    setFormTitle(list.title);
                    setFormSlug(list.slug);
                    setFormType(list.type);
                    setFormDescription(list.description || "");
                  }}
                  data-testid={`button-edit-list-${list.id}`}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Delete this list and all its items?")) {
                      deleteMutation.mutate(list.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-list-${list.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Curated List</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (!formSlug) setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                }}
                placeholder="Top 10 Brunch Spots"
                data-testid="input-list-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slug</Label>
              <Input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="top-10-brunch-spots" data-testid="input-list-slug" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger data-testid="select-list-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOP10">Top 10</SelectItem>
                  <SelectItem value="TOP25">Top 25</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} placeholder="A curated list of..." data-testid="input-list-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!formTitle || createMutation.isPending} data-testid="button-save-list">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingList} onOpenChange={(open) => { if (!open) setEditingList(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} data-testid="input-edit-list-title" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slug</Label>
              <Input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} data-testid="input-edit-list-slug" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger data-testid="select-edit-list-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOP10">Top 10</SelectItem>
                  <SelectItem value="TOP25">Top 25</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} data-testid="input-edit-list-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingList(null)} data-testid="button-cancel-edit">Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate({ title: formTitle, slug: formSlug, type: formType, description: formDescription || null })}
              disabled={!formTitle || updateMutation.isPending}
              data-testid="button-update-list"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EventCollectionRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  item_count: number;
  city_id: string;
  created_at: string;
}

interface EventCollectionItemRow {
  id: string;
  collection_id: string;
  event_id: string;
  sort_order: number;
  event_title: string;
  event_slug: string;
  start_date_time: string;
  image_url: string | null;
}

interface DiscoverEventsResponse {
  events: Array<{ id: string; title: string; slug: string; start_date_time: string; }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function EventCollectionsPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const CITY_ID = useDefaultCityId();
  const { selectedCitySlug: adminCitySlug } = useAdminCitySelection();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [eventSearch, setEventSearch] = useState("");

  const { data: collections, isLoading } = useQuery<EventCollectionRow[]>({
    queryKey: ["/api/admin/event-collections", `?cityId=${CITY_ID}`],
  });

  const { data: collectionItems } = useQuery<EventCollectionItemRow[]>({
    queryKey: ["/api/admin/event-collections", selectedCollectionId, "items"],
    enabled: !!selectedCollectionId,
  });

  const { data: allEvents } = useQuery<DiscoverEventsResponse>({
    queryKey: ["/api/cities", adminCitySlug || "", "events", "discover", "?pageSize=50"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/event-collections", {
        cityId: CITY_ID,
        title: formTitle,
        slug: formSlug || formTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        description: formDescription || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-collections"] });
      setShowCreateDialog(false);
      setFormTitle(""); setFormSlug(""); setFormDescription("");
      toast({ title: "Collection created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/event-collections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-collections"] });
      if (selectedCollectionId) setSelectedCollectionId(null);
      toast({ title: "Collection deleted" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/event-collections/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-collections"] });
      toast({ title: "Collection updated" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ collectionId, eventId, sortOrder }: { collectionId: string; eventId: string; sortOrder: number }) => {
      await apiRequest("POST", `/api/admin/event-collections/${collectionId}/items`, { eventId, sortOrder });
    },
    onSuccess: () => {
      if (selectedCollectionId) queryClient.invalidateQueries({ queryKey: ["/api/admin/event-collections", selectedCollectionId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-collections"] });
      toast({ title: "Event added to collection" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/event-collection-items/${id}`);
    },
    onSuccess: () => {
      if (selectedCollectionId) queryClient.invalidateQueries({ queryKey: ["/api/admin/event-collections", selectedCollectionId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-collections"] });
      toast({ title: "Event removed" });
    },
  });

  const availableEvents = (allEvents?.events || []).filter((e) =>
    e.title.toLowerCase().includes(eventSearch.toLowerCase()) &&
    !(collectionItems || []).some((item) => item.event_id === e.id)
  ).slice(0, 10);

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (selectedCollectionId && collectionItems) {
    const col = collections?.find((c: any) => c.id === selectedCollectionId);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedCollectionId(null)} data-testid="button-back-collections">
              <ChevronRight className="h-4 w-4 rotate-180 mr-1" /> Back
            </Button>
            <h2 className="text-lg font-semibold" data-testid="text-collection-title">{col?.title}</h2>
          </div>
          <span className="text-sm text-muted-foreground">{collectionItems.length} event(s)</span>
        </div>

        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Add Event</h3>
          <Input
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Search events to add..."
            data-testid="input-search-event-to-add"
          />
          {eventSearch && availableEvents.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {availableEvents.map((evt: any) => (
                <div key={evt.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm truncate" data-testid={`text-evt-search-${evt.id}`}>{evt.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      addItemMutation.mutate({ collectionId: selectedCollectionId!, eventId: evt.id, sortOrder: collectionItems.length });
                      setEventSearch("");
                    }}
                    disabled={addItemMutation.isPending}
                    data-testid={`button-add-evt-${evt.id}`}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-2">
          {collectionItems.length === 0 ? (
            <Card className="p-6 text-center">
              <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No events in this collection yet. Search and add events above.</p>
            </Card>
          ) : (
            collectionItems.map((item) => (
              <Card key={item.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block" data-testid={`text-collection-event-${item.id}`}>
                    {item.event_title || "Unknown Event"}
                  </span>
                  {item.start_date_time && (
                    <span className="text-xs text-muted-foreground">{new Date(item.start_date_time).toLocaleDateString()}</span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeItemMutation.mutate(item.id)}
                  disabled={removeItemMutation.isPending}
                  data-testid={`button-remove-collection-item-${item.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Event Collections</h2>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-collection">
          <Plus className="h-4 w-4 mr-1" /> New Collection
        </Button>
      </div>

      {(!collections || collections.length === 0) ? (
        <Card className="p-8 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No Event Collections</h3>
          <p className="text-sm text-muted-foreground">Create curated event collections to feature on the events page.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {collections.map((col) => (
            <Card key={col.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedCollectionId(col.id)} data-testid={`card-collection-${col.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm" data-testid={`text-collection-name-${col.id}`}>{col.title}</span>
                  <Badge variant={col.is_active ? "default" : "secondary"}>{col.is_active ? "Active" : "Inactive"}</Badge>
                  <Badge variant="outline">{col.item_count ?? 0} events</Badge>
                </div>
                {col.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{col.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => toggleActiveMutation.mutate({ id: col.id, isActive: !col.is_active })}
                  data-testid={`button-toggle-collection-${col.id}`}
                >
                  {col.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Delete this collection and all its items?")) {
                      deleteMutation.mutate(col.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-collection-${col.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (!formSlug) setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                }}
                placeholder="Weekend Picks"
                data-testid="input-collection-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slug</Label>
              <Input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="weekend-picks" data-testid="input-collection-slug" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} placeholder="A curated collection of..." data-testid="input-collection-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create-collection">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!formTitle || createMutation.isPending} data-testid="button-save-collection">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlaceholderSection({ title, description, icon: Icon }: { title: string; description: string; icon: any }) {
  return (
    <Card className="p-8 text-center">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}

function CitiesPanel({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editCity, setEditCity] = useState<City | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", brandName: "", primaryColor: "#2563eb", aiGuideName: "", siteUrl: "", emailDomain: "" });

  const { data: allCities, isLoading } = useQuery<City[]>({
    queryKey: ["/api/admin/cities"],
  });

  const { data: hubData } = useQuery<{ totalMetros: number; totalMicros: number; hubs: any[] }>({
    queryKey: ["/api/admin/hub-management"],
    queryFn: () => fetch("/api/admin/hub-management", { credentials: "include" }).then(r => r.json()),
  });

  const getCityCounts = (cityId: string) => {
    if (!hubData?.hubs) return { metros: 0, micros: 0 };
    let metros = 0, micros = 0;
    hubData.hubs.forEach((h: any) => {
      if (h.cityId === cityId) {
        metros++;
        micros += (h.microHubs || []).length;
      }
    });
    return { metros, micros };
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/cities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cities"] });
      setShowAddDialog(false);
      setForm({ name: "", slug: "", brandName: "", primaryColor: "#2563eb", aiGuideName: "", siteUrl: "", emailDomain: "" });
      toast({ title: "City created" });
    },
    onError: (err: any) => {
      toast({ title: "Error creating city", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      await apiRequest("PATCH", `/api/admin/cities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cities"] });
      setEditCity(null);
      toast({ title: "City updated" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-cities-title">Cities</h2>
          <p className="text-muted-foreground text-sm">Manage all city hubs across the platform</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2" data-testid="button-add-city">
          <Plus className="h-4 w-4" /> Add City
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="grid gap-4">
          {(allCities || []).map((city) => (
            <Card key={city.id} className="p-4" data-testid={`card-city-${city.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: city.primaryColor || "#2563eb" }}>
                    {city.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{city.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>/{city.slug}</span>
                      <span>|</span>
                      <span>{city.brandName}</span>
                      {city.aiGuideName && (
                        <>
                          <span>|</span>
                          <span>AI: {city.aiGuideName}</span>
                        </>
                      )}
                      {city.siteUrl && (
                        <>
                          <span>|</span>
                          <span>{city.siteUrl}</span>
                        </>
                      )}
                      {city.emailDomain && (
                        <>
                          <span>|</span>
                          <span>Email: {city.emailDomain}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const counts = getCityCounts(city.id);
                    return (
                      <>
                        <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                          {counts.metros} metro{counts.metros !== 1 ? "s" : ""}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                          {counts.micros} micro{counts.micros !== 1 ? "s" : ""}
                        </Badge>
                      </>
                    );
                  })()}
                  <Badge variant={city.isActive ? "default" : "outline"}>
                    {city.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {city.isLive && (
                    <Badge variant="default" className="bg-emerald-600" data-testid={`badge-city-live-${city.id}`}>
                      Live
                    </Badge>
                  )}
                  {onNavigate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => onNavigate("hub-management")}
                      data-testid={`button-manage-hubs-${city.id}`}
                    >
                      <Building2 className="h-3 w-3 mr-1" /> Manage Hubs
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditCity(city);
                      setForm({
                        name: city.name,
                        slug: city.slug,
                        brandName: city.brandName || "",
                        primaryColor: city.primaryColor || "#2563eb",
                        aiGuideName: city.aiGuideName || "",
                        siteUrl: city.siteUrl || "",
                        emailDomain: city.emailDomain || "",
                      });
                    }}
                    data-testid={`button-edit-city-${city.id}`}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New City</DialogTitle>
            <DialogDescription>Create a new city hub on the platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>City Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""), aiGuideName: e.target.value }))} placeholder="e.g. Austin" data-testid="input-city-name" />
            </div>
            <div>
              <Label>URL Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="e.g. austin" data-testid="input-city-slug" />
            </div>
            <div>
              <Label>Brand Name</Label>
              <Input value={form.brandName} onChange={(e) => setForm(f => ({ ...f, brandName: e.target.value }))} placeholder="e.g. Austin City Hub" data-testid="input-city-brand" />
            </div>
            <div>
              <Label>AI Guide Name</Label>
              <Input value={form.aiGuideName} onChange={(e) => setForm(f => ({ ...f, aiGuideName: e.target.value }))} placeholder="e.g. Austin" data-testid="input-city-ai-name" />
            </div>
            <div>
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primaryColor} onChange={(e) => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="h-8 w-16 rounded cursor-pointer" data-testid="input-city-color" />
                <Input value={form.primaryColor} onChange={(e) => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-28" />
              </div>
            </div>
            <div>
              <Label>Site URL</Label>
              <Input value={form.siteUrl} onChange={(e) => setForm(f => ({ ...f, siteUrl: e.target.value }))} placeholder="e.g. https://cltmetrohub.com" data-testid="input-city-site-url" />
            </div>
            <div>
              <Label>Email Domain</Label>
              <Input value={form.emailDomain} onChange={(e) => setForm(f => ({ ...f, emailDomain: e.target.value }))} placeholder="e.g. cltmetrohub.com" data-testid="input-city-email-domain" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.slug || createMutation.isPending} data-testid="button-create-city">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create City
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCity} onOpenChange={(open) => !open && setEditCity(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editCity?.name}</DialogTitle>
            <DialogDescription>Update city settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>City Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-edit-city-name" />
            </div>
            <div>
              <Label>URL Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} data-testid="input-edit-city-slug" />
            </div>
            <div>
              <Label>Brand Name</Label>
              <Input value={form.brandName} onChange={(e) => setForm(f => ({ ...f, brandName: e.target.value }))} data-testid="input-edit-city-brand" />
            </div>
            <div>
              <Label>AI Guide Name</Label>
              <Input value={form.aiGuideName} onChange={(e) => setForm(f => ({ ...f, aiGuideName: e.target.value }))} data-testid="input-edit-city-ai-name" />
            </div>
            <div>
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primaryColor} onChange={(e) => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="h-8 w-16 rounded cursor-pointer" />
                <Input value={form.primaryColor} onChange={(e) => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-28" />
              </div>
            </div>
            <div>
              <Label>Site URL</Label>
              <Input value={form.siteUrl} onChange={(e) => setForm(f => ({ ...f, siteUrl: e.target.value }))} placeholder="e.g. https://cltmetrohub.com" data-testid="input-edit-city-site-url" />
            </div>
            <div>
              <Label>Email Domain</Label>
              <Input value={form.emailDomain} onChange={(e) => setForm(f => ({ ...f, emailDomain: e.target.value }))} placeholder="e.g. cltmetrohub.com" data-testid="input-edit-city-email-domain" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCity(null)}>Cancel</Button>
            {editCity && (
              <>
                <Button
                  variant={editCity.isLive ? "destructive" : "default"}
                  onClick={() => updateMutation.mutate({ id: editCity.id, isLive: !editCity.isLive })}
                  data-testid="button-toggle-city-live"
                >
                  {editCity.isLive ? "Take Offline" : "Go Live"}
                </Button>
                <Button
                  variant={editCity.isActive ? "outline" : "default"}
                  onClick={() => updateMutation.mutate({ id: editCity.id, isActive: !editCity.isActive })}
                  data-testid="button-toggle-city-active"
                >
                  {editCity.isActive ? "Deactivate" : "Activate"}
                </Button>
              </>
            )}
            <Button onClick={() => editCity && updateMutation.mutate({ id: editCity.id, ...form })} disabled={updateMutation.isPending} data-testid="button-save-city">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const getInitialSection = () => {
    const path = window.location.pathname.replace(/^\/admin\/?/, "");
    if (path) return path;
    const savedMode = localStorage.getItem("adminMode");
    return savedMode === "platform" ? "platform-hq" : "my-hub";
  };
  const [activeSection, setActiveSection] = useState(getInitialSection);
  const [charlotteOpen, setCharlotteOpen] = useState(false);
  const [cmsEditItemId, setCmsEditItemId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [inboxReturnItemId, setInboxReturnItemId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: user } = useQuery<{ id: string; email: string; role: string; name: string | null; cityId: string | null }>({
    queryKey: ["/api/admin/me"],
  });

  const { selectedCityId, selectedCitySlug, setSelectedCity, adminCities, adminMode: rawAdminMode, setAdminMode } = useAdminCitySelection();

  const isSuperAdmin = ["SUPER_ADMIN", "super_admin"].includes(user?.role || "");
  const adminMode: AdminMode = isSuperAdmin ? rawAdminMode : "metro";

  useEffect(() => {
    if (!isSuperAdmin && rawAdminMode === "platform") {
      setAdminMode("metro");
      if (activeSection === "platform-hq") {
        setActiveSection("my-hub");
      }
    }
  }, [isSuperAdmin, rawAdminMode, activeSection, setAdminMode]);

  const { data: myHubData } = useQuery<{ cityCode: string | null; name: string } | null>({
    queryKey: ["/api/admin/my-hub", selectedCityId],
    queryFn: () => {
      const url = selectedCityId ? `/api/admin/my-hub?cityId=${selectedCityId}` : "/api/admin/my-hub";
      return fetch(url, { credentials: "include" }).then(r => r.json());
    },
  });
  const userCityCode = myHubData?.cityCode || null;

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats", selectedCityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCityId) params.set("cityId", selectedCityId);
      const resp = await fetch(`/api/admin/stats?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const { data: submissions } = useQuery<AdminSubmission[]>({
    queryKey: ["/api/admin/submissions", selectedCityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCityId) params.set("cityId", selectedCityId);
      const resp = await fetch(`/api/admin/submissions?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const { data: adminBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses", selectedCityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCityId) params.set("cityId", selectedCityId);
      const resp = await fetch(`/api/admin/businesses?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/submissions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Submission updated" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/field/auth"] });
      setLocation("/charlotte");
    },
  });

  const pendingCount = submissions?.filter((s) => s.status === "PENDING").length || 0;

  const { data: inboxCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/inbox/unified/count"],
    queryFn: async () => {
      const res = await fetch("/api/admin/inbox/unified/count");
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });
  const inboxCount = inboxCountData?.count || 0;

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setDebouncedSearchQuery("");
      return;
    }
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const debouncedSearch = debouncedSearchQuery;
  const { data: searchResults } = useQuery<{
    businesses: { id: string; name: string; address: string | null; slug: string | null }[];
    contacts: { id: string; name: string | null; company: string | null; email: string | null }[];
    events: { id: string; title: string; slug: string | null }[];
    content: { id: string; title: string; slug: string | null }[];
    rss?: { id: string; title: string; sourceName: string | null; reviewStatus: string | null }[];
  }>({
    queryKey: ["/api/admin/search", debouncedSearch],
    queryFn: () => fetch(`/api/admin/search?q=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" }).then(r => r.json()),
    enabled: debouncedSearch.length >= 2,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    if (!searchOpen) {
      setSearchQuery("");
    }
  }, [searchOpen]);

  const [pendingSearchBiz, setPendingSearchBiz] = useState<Business | null>(null);
  const [pendingOpenContactId, setPendingOpenContactId] = useState<string | null>(null);
  const [pendingEntityId, setPendingEntityId] = useState<string | null>(null);
  const openBizHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openBizId = params.get("openBiz");
    const openContactId = params.get("openContact");
    const entityId = params.get("entityId");

    if (entityId) {
      setPendingEntityId(entityId);
      const url = new URL(window.location.href);
      url.searchParams.delete("entityId");
      window.history.replaceState({}, "", url.pathname + url.search);
    }

    if (openContactId) {
      setPendingOpenContactId(openContactId);
      setActiveSection("crm-contacts");
      const url = new URL(window.location.href);
      url.searchParams.delete("openContact");
      window.history.replaceState({}, "", url.pathname + url.search);
    }

    if (!openBizId) return;
    if (openBizHandledRef.current === openBizId) return;
    if (!adminBusinesses) return;
    const biz = adminBusinesses.find(b => b.id === openBizId);
    if (biz) {
      setPendingSearchBiz(biz);
      setActiveSection("businesses");
      openBizHandledRef.current = openBizId;
      const url = new URL(window.location.href);
      url.searchParams.delete("openBiz");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [adminBusinesses]);

  useEffect(() => {
    if (pendingEntityId && activeSection === "cms-library") {
      setCmsEditItemId(pendingEntityId);
      setPendingEntityId(null);
      setActiveSection("cms-editor");
    }
  }, [pendingEntityId, activeSection]);

  const handleInboxNavigate = useCallback((section: string, returnContext?: { itemId: string }, routeParams?: Record<string, string>) => {
    if (returnContext?.itemId) {
      setInboxReturnItemId(returnContext.itemId);
    }
    if (section === "cms-editor" && routeParams?.id) {
      setCmsEditItemId(routeParams.id);
    }
    setActiveSection(section);
  }, []);

  const handleSearchNavigate = (section: string, selectedBiz?: Business) => {
    if (section === "businesses" && selectedBiz) {
      setPendingSearchBiz(selectedBiz);
    }
    setActiveSection(section);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const totalResults = searchResults
    ? searchResults.businesses.length + searchResults.contacts.length + searchResults.events.length + searchResults.content.length + (searchResults.rss?.length || 0)
    : 0;

  const renderSection = () => {
    switch (activeSection) {
      case "platform-hq":
        return <PlatformHqDashboard onNavigate={setActiveSection} />;
      case "charlotte-report":
        return <CharlotteReport onNavigate={setActiveSection} cityId={selectedCityId} />;
      case "charlotte-ops":
      case "charlotte-tasks":
        return <InboxPanel cityId={selectedCityId} onNavigate={handleInboxNavigate} returnToItem={inboxReturnItemId || undefined} onClearReturnContext={() => setInboxReturnItemId(null)} />;
      case "charlotte-insights":
        return <CharlotteInsightsPanel cityId={selectedCityId} />;
      case "opportunity-radar":
        return <OpportunityRadar cityId={selectedCityId} />;
      case "dashboard":
        return <DashboardOverview stats={stats} statsLoading={statsLoading} onNavigate={setActiveSection} />;
      case "businesses":
        return <BusinessesPanel adminBusinesses={adminBusinesses} cityId={selectedCityId} autoSelectBiz={pendingSearchBiz || (pendingEntityId && adminBusinesses ? adminBusinesses.find(b => b.id === pendingEntityId) || null : null)} onAutoSelectConsumed={() => { setPendingSearchBiz(null); setPendingEntityId(null); }} onNavigateToContact={(contactId: string) => { setPendingOpenContactId(contactId); setActiveSection("crm-contacts"); }} />;
      case "events":
        return <EventsPanel cityId={selectedCityId} autoOpenEntityId={pendingEntityId} onAutoOpenConsumed={() => setPendingEntityId(null)} />;
      case "categories":
        return <CategoriesPanel cityId={selectedCityId} />;
      case "articles":
        return <ArticlesPanel cityId={selectedCityId} autoOpenEntityId={pendingEntityId} onAutoOpenConsumed={() => setPendingEntityId(null)} />;
      case "curated-lists":
        return <CuratedListsPanel cityId={selectedCityId} />;
      case "event-collections":
        return <EventCollectionsPanel cityId={selectedCityId} />;
      case "attractions":
        return <AttractionsPanel cityId={selectedCityId} />;
      case "authors":
        return <AuthorsPanel cityId={selectedCityId} />;
      case "moderation":
        return <ModerationPanel cityId={selectedCityId} />;
      case "moderation-hub":
        return <ModerationHub cityId={selectedCityId} />;
      case "jobs-moderation":
        return <JobsModerationPanel cityId={selectedCityId} />;
      case "submissions":
        return <SubmissionsPanel submissions={submissions} reviewMutation={reviewMutation} cityId={selectedCityId} />;
      case "field-captures":
        return <FieldCapturesPanel cityId={selectedCityId} />;
      case "intake":
        return <ContentIntake cityId={selectedCityId} />;
      case "reviews":
        return <ReviewModeration cityId={selectedCityId} />;
      case "subscribers":
        return <SubscribersPanel cityId={selectedCityId} />;
      case "leads":
        return <LeadsPanel cityId={selectedCityId} />;
      case "ads":
        return <AdManager cityId={selectedCityId} />;
      case "map-placements":
        return <MapPlacementsPanel cityId={activeCityId} />;
      case "ad-management":
        return <AdManagementPanel cityId={selectedCityId} />;
      case "revenue-controls":
        return <RevenueControlsPanel cityId={selectedCityId} />;
      case "csv-import":
        return <CsvImport cityId={selectedCityId} />;
      case "listing-tiers":
        return <ListingTiers cityId={selectedCityId} />;
      case "listing-addons":
        return <ListingAddonsPanel cityId={selectedCityId} />;
      case "transfers":
        return <TransferPanel cityId={selectedCityId} />;
      case "enterprise-reviews":
        return <EnterpriseReviewsPanel cityId={selectedCityId} />;
      case "content-journal":
        return <ContentJournalPanel cityId={selectedCityId} />;
      case "source-requests":
        return <SourceRequestsPanel cityId={selectedCityId} />;
      case "pulse-videos":
        return <PulseVideosPanel cityId={selectedCityId} />;
      case "pulse-issues":
        return <PulseIssuesPanel selectedCityId={selectedCityId} />;
      case "micro-publications":
        return <MicroPubPanel selectedCityId={selectedCityId} />;
      case "ai-assistant":
        return <AiAssistant />;
      case "seo":
        return <SeoDiagnosticPanel cityId={selectedCityId} />;
      case "zones":
        return <RegionsPanel cityId={selectedCityId} />;
      case "zone-edit":
        return <ZoneEditPanel cityId={selectedCityId} />;
      case "cms-dashboard":
        return <CmsDashboard cityId={selectedCityId} />;
      case "cms-library":
        return <CmsContentLibrary
          onSelectItem={(id) => { setCmsEditItemId(id); setActiveSection("cms-editor"); }}
          onCreateNew={() => { setCmsEditItemId(null); setActiveSection("cms-editor"); }}
          cityId={selectedCityId}
        />;
      case "content-pages":
        return <ContentPagesPanel
          onEditPage={(id) => { setCmsEditItemId(id); setActiveSection("cms-editor"); }}
          onCreateNew={() => { setCmsEditItemId(null); setActiveSection("cms-editor"); }}
          cityId={selectedCityId}
        />;
      case "translation-dashboard":
        return <TranslationDashboard cityId={selectedCityId} />;
      case "cms-editor":
        return <CmsContentEditor
          itemId={pendingEntityId || cmsEditItemId}
          onBack={() => { setPendingEntityId(null); setActiveSection("cms-library"); }}
          cityId={selectedCityId}
        />;
      case "cms-media":
        return <CmsMediaLibrary cityId={selectedCityId} />;
      case "cms-tags":
        return <CmsTagsManager cityId={selectedCityId} />;
      case "feed-debug":
        return <FeedDebugPanel cityId={selectedCityId} />;
      case "pulse-posts":
        return <PulsePostsPanel cityId={selectedCityId} />;
      case "cms-calendar":
        return <CmsEditorialCalendar cityId={selectedCityId} />;
      case "weekly-digest":
        return <WeeklyDigestPanel cityId={selectedCityId} />;
      case "email-templates":
        return <EmailTemplatesPanel cityId={selectedCityId} />;
      case "email-campaigns":
        return <EmailCampaignsPanel cityId={selectedCityId} />;
      case "email-suppression":
        return <EmailSuppressionPanel cityId={selectedCityId} />;
      case "communications-hub":
      case "message-center":
        return <MessageCenterPanel cityId={selectedCityId} />;
      case "live-feeds":
        return <LiveFeedsPanel cityId={selectedCityId} />;
      case "web-tv":
        return <TvPanel cityId={selectedCityId} />;
      case "venue-channels":
        return <VenueChannelsPanel cityId={selectedCityId} />;
      case "vendors":
        return <VendorsPanel cityId={selectedCityId} />;
      case "crm-events":
        return <CrmEventsPanel cityId={selectedCityId} />;
      case "event-rsvps":
        return <EventRsvpsPanel cityId={selectedCityId} />;
      case "inbox":
        return <InboxPanel cityId={selectedCityId} onNavigate={handleInboxNavigate} returnToItem={inboxReturnItemId || undefined} onClearReturnContext={() => setInboxReturnItemId(null)} />;
      case "quick-claim":
        return <QuickClaimPanel cityId={selectedCityId} />;
      case "places-import":
        return <PlacesImportPanel cityId={selectedCityId} />;
      case "listings-to-claim":
        return <ListingsToClaimPanel cityId={selectedCityId} />;
      case "charlotte-chat":
        return <CharlotteChatPanel cityId={selectedCityId} />;
      case "zip-geos":
        return <ZipGeosPanel cityId={selectedCityId} />;
      case "hubs-coverage":
        return <HubsCoveragePanel cityId={selectedCityId} />;
      case "teach-charlotte":
        return <TeachCharlottePanel cityId={selectedCityId} />;
      case "feature-audit":
        return <FeatureAuditPanel cityId={selectedCityId} />;
      case "coverage-audit":
        return <CoverageAuditPanel cityId={selectedCityId} />;
      case "comms-log":
        return <CommsLogPanel cityId={selectedCityId} />;
      case "license-crm":
        return <LicenseCrmPanel cityId={selectedCityId} />;
      case "licensing":
        return <LicensingPanel cityId={selectedCityId} />;
      case "revenue":
        return <RevenuePanel cityId={selectedCityId} />;
      case "itex-trades":
        return <ItexTradesPanel cityId={selectedCityId} />;
      case "my-hub":
        return <MyHubPanel selectedCityId={selectedCityId} />;
      case "metro-management":
        return <MetroManagementPanel />;
      case "hub-management":
        return <HubManagementPanel selectedCityId={selectedCityId} onNavigate={setActiveSection} />;
      case "territory-sales":
        return <TerritorySalesPanel />;
      case "cities":
        return <CitiesPanel onNavigate={setActiveSection} />;
      case "crm-contacts":
        return <ContactsPanel cityId={selectedCityId} autoOpenContactId={pendingOpenContactId} onAutoOpenConsumed={() => setPendingOpenContactId(null)} adminMode={adminMode} onNavigateToBusiness={async (bizId: string) => { let biz = adminBusinesses?.find(b => b.id === bizId); if (!biz) { try { const res = await fetch(`/api/admin/businesses/${bizId}`); if (res.ok) biz = await res.json(); } catch {} } if (biz) { setPendingSearchBiz(biz); setActiveSection("businesses"); } }} />;
      case "crm-referrals":
        return <ReferralsPanel cityId={selectedCityId} />;
      case "crm-nudges":
        return <NudgesPanel cityId={selectedCityId} />;
      case "mileage-log":
        return <MileagePanel cityId={selectedCityId} />;
      case "digital-cards":
        return <DigitalCardsPanel cityId={selectedCityId} />;
      case "platform-intelligence":
        return <PlatformIntelligenceDashboard scope="platform" />;
      case "intelligence-dashboard":
        return <PlatformIntelligenceDashboard selectedCityId={selectedCityId} scope="metro" />;
      case "intelligence":
        return <IntelligencePanel cityId={selectedCityId} />;
      case "pulse-intelligence":
        return <PulseIntelligencePanel cityId={selectedCityId} />;
      case "outreach-queue":
        return <OutreachQueuePanel cityId={selectedCityId} />;
      case "capture-outreach":
        return <CaptureOutreachPanel cityId={selectedCityId} />;
      case "content-drafts":
        return <ContentDraftsPanel cityId={selectedCityId} />;
      case "micro-prospects":
        return <IntelligencePanel defaultTab="micro-prospects" cityId={selectedCityId} />;
      case "report-requests":
        return <ReportRequestsPanel cityId={selectedCityId} />;
      case "payout-management":
        return <PayoutManagementPanel cityId={selectedCityId} />;
      case "audit-log":
        return <AuditLogPanel cityId={selectedCityId} />;
      case "tier-inquiry":
        return <TierInquiryPanel cityId={selectedCityId} />;
      case "site-builder-demo":
        return <SiteBuilderDemoPanel />;
      case "site-builder":
        return <AdminSiteBuilder />;
      case "provider-management":
        return <ProviderManagement cityId={selectedCityId} />;
      case "marketplace-management":
        return <MarketplacePanel />;
      case "shop-management":
        return <ShopManagementPanel selectedCityId={selectedCityId} />;
      case "affiliates":
        return <AffiliatesPanel cityId={selectedCityId} />;
      case "ambassador-management":
        return <AmbassadorManagementPanel selectedCityId={selectedCityId} selectedCitySlug={selectedCitySlug} adminMode={adminMode} />;
      case "verified-contributors":
        return <VerifiedContributorsPanel cityId={selectedCityId} />;
      case "flow-sessions":
        return <FlowSessionsPanel cityId={selectedCityId} />;
      case "conversation-pipeline":
        return <ConversationPipelinePanel cityId={selectedCityId} />;
      case "messaging-library":
        return <MessagingLibraryPanel cityId={selectedCityId} />;
      case "content-studio":
        return <ContentStudioPanel cityId={selectedCityId} />;
      case "social-publishing":
        return <SocialPublishingPanel selectedCityId={selectedCityId} />;
      case "podcast-directory":
        return <PodcastDirectoryPanel cityId={selectedCityId} />;
      case "radio-ads":
        return <RadioAdsPanel cityId={selectedCityId} />;
      case "radio-management":
        return <RadioManagementPanel cityId={selectedCityId} />;
      case "live-broadcasts":
        return <LiveBroadcastPanel cityId={selectedCityId} />;
      case "music-library":
        return <MusicLibraryPanel cityId={selectedCityId} />;
      case "qr-generator":
        return <QrGeneratorPanel />;
      case "crown-program":
        return <CrownAdmin key="crown-overview" selectedCityId={selectedCityId} initialTab="overview" />;
      case "crown-hub-readiness":
        return <CrownAdmin key="crown-hub-readiness" selectedCityId={selectedCityId} initialTab="hub-readiness" />;
      case "crown-overview":
        return <CrownAdmin key="crown-overview" selectedCityId={selectedCityId} initialTab="overview" />;
      case "crown-categories":
        return <CrownAdmin key="crown-categories" selectedCityId={selectedCityId} initialTab="categories" />;
      case "crown-participants":
        return <CrownAdmin key="crown-participants" selectedCityId={selectedCityId} initialTab="participants" />;
      case "crown-votes":
        return <CrownAdmin key="crown-votes" selectedCityId={selectedCityId} initialTab="votes" />;
      case "crown-winners":
        return <CrownAdmin key="crown-winners" selectedCityId={selectedCityId} initialTab="winners" />;
      case "engagement-hub":
        return <EngagementHub key="engagement-overview" selectedCityId={selectedCityId} initialTab="overview" />;
      case "engagement-overview":
        return <EngagementHub key="engagement-overview" selectedCityId={selectedCityId} initialTab="overview" />;
      case "engagement-polls":
        return <EngagementHub key="engagement-polls" selectedCityId={selectedCityId} initialTab="polls" />;
      case "engagement-surveys":
        return <EngagementHub key="engagement-surveys" selectedCityId={selectedCityId} initialTab="surveys" />;
      case "engagement-quizzes":
        return <EngagementHub key="engagement-quizzes" selectedCityId={selectedCityId} initialTab="quizzes" />;
      case "engagement-voting":
        return <EngagementHub key="engagement-voting" selectedCityId={selectedCityId} initialTab="voting" />;
      case "engagement-reviews":
        return <EngagementHub key="engagement-reviews" selectedCityId={selectedCityId} initialTab="reviews" />;
      case "engagement-reactions":
        return <EngagementHub key="engagement-reactions" selectedCityId={selectedCityId} initialTab="reactions" />;
      case "giveaway-admin":
      case "giveaway-dashboard":
        return <GiveawayAdmin key="giveaway-dashboard" selectedCityId={selectedCityId} initialTab="dashboard" />;
      case "giveaway-list":
        return <GiveawayAdmin key="giveaway-list" selectedCityId={selectedCityId} initialTab="list" />;
      case "giveaway-entries":
        return <GiveawayAdmin key="giveaway-entries" selectedCityId={selectedCityId} initialTab="entries" />;
      case "giveaway-draws":
        return <GiveawayAdmin key="giveaway-draws" selectedCityId={selectedCityId} initialTab="draws" />;
      case "giveaway-winners":
        return <GiveawayAdmin key="giveaway-winners" selectedCityId={selectedCityId} initialTab="winners" />;
      case "giveaway-reports":
        return <GiveawayAdmin key="giveaway-reports" selectedCityId={selectedCityId} initialTab="reports" />;
      case "giveaway-settings":
        return <GiveawayAdmin key="giveaway-settings" selectedCityId={selectedCityId} initialTab="settings" />;
      case "workforce-overview":
        return <WorkforceOverviewPanel cityId={selectedCityId} />;
      case "job-categories":
        return <JobCategoriesPanel cityId={selectedCityId} />;
      case "entitlement-management":
        return <EntitlementManagementPanel cityId={selectedCityId} />;
      case "platform-pricing":
        return <PricingPanel />;
      case "package-management":
        return <PackageManagementPanel />;
      case "cora":
        return <CoraPanel cityId={selectedCityId} />;
      case "cora-voice":
        return <CoraVoicePanel />;
      case "operator-hq":
        return <OperatorHqPanel />;
      case "workflow-sessions":
        return <WorkflowSessionsPanel cityId={selectedCityId} />;
      case "automation-rules":
        return <AutomationPanel cityId={selectedCityId} />;
      case "story-studio":
        return <StoryStudioPanel cityId={selectedCityId} />;
      default:
        return <MyHubPanel selectedCityId={selectedCityId} />;
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar
          activeSection={activeSection}
          onNavigate={setActiveSection}
          user={user}
          onLogout={() => logoutMutation.mutate()}
          pendingCount={pendingCount}
          inboxCount={inboxCount}
          adminCities={adminCities}
          selectedCityId={selectedCityId}
          onCityChange={setSelectedCity}
          userCityCode={userCityCode}
          adminMode={adminMode}
          onModeChange={setAdminMode}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-1.5 border-b px-3 py-2 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
            <SidebarTrigger data-testid="button-sidebar-toggle" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all hover:opacity-90 border border-border/50 text-muted-foreground"
                  data-testid="button-header-quick-nav"
                >
                  <Menu className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Menu</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto w-56">
                <DropdownMenuItem
                  onClick={() => setActiveSection("my-hub")}
                  data-testid="quicknav-my-hub"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  My Hub
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {[operatorGroup, ...menuGroups, intelligenceGroup, ...(["SUPER_ADMIN", "super_admin", "admin", "ADMIN"].includes(user?.role || "") ? [superAdminGroup] : [])].map((group, gi) => (
                  <DropdownMenuGroup key={group.label}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{group.label}</DropdownMenuLabel>
                    {group.items.map((item: any) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => {
                          if (item.isLink && item.href) {
                            window.open(item.href, "_self");
                          } else {
                            setActiveSection(item.id);
                          }
                        }}
                        data-testid={`quicknav-${item.id}`}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => setActiveSection("inbox")}
              className="relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all hover:opacity-90"
              style={{ background: "hsl(273 66% 34%)", color: "white" }}
              data-testid="button-header-inbox"
            >
              <span className="text-sm leading-none">{inboxCount > 0 ? "👋" : "👍"}</span>
              <span className="hidden sm:inline">Inbox</span>
              {inboxCount > 0 && (
                <Badge className="h-4 min-w-[16px] px-1 text-[9px] bg-amber-400 text-black hover:bg-amber-400 rounded-full">
                  {inboxCount}
                </Badge>
              )}
            </button>

            <a
              href="/face"
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all hover:opacity-90"
              style={{ background: "hsl(273 66% 50%)", color: "white" }}
              data-testid="button-header-catch"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Catch</span>
            </a>

            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 border border-border/50 text-xs text-muted-foreground transition-all hover:bg-muted/50"
              data-testid="button-header-search"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden md:inline-flex h-4 items-center gap-0.5 rounded border bg-muted px-1 text-[9px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </button>

            <div className="ml-auto">
              <button
                onClick={() => setCharlotteOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-all hover:opacity-90"
                style={{ background: "hsl(273 66% 34%)" }}
                data-testid="button-admin-charlotte-open"
              >
                <img src={charlotteAvatar} alt="Charlotte" className="h-5 w-5 rounded-full object-cover ring-1 ring-white/30" />
                <span className="text-white text-xs font-medium hidden sm:inline">Charlotte</span>
              </button>
            </div>
          </header>

          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogContent className="sm:max-w-[520px] p-0 gap-0">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search businesses, contacts, events, content..."
                  className="border-0 shadow-none focus-visible:ring-0 px-0 h-8"
                  data-testid="input-global-search"
                />
                {searchQuery && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSearchQuery("")}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {debouncedSearch.length < 2 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search...
                  </div>
                ) : totalResults === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No results found for "{debouncedSearch}"
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults?.businesses && searchResults.businesses.length > 0 && (
                      <div>
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Businesses</p>
                        {searchResults.businesses.map((biz) => (
                          <button
                            key={biz.id}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                            onClick={() => handleSearchNavigate("businesses", biz as Business)}
                            data-testid={`search-result-biz-${biz.id}`}
                          >
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{biz.name}</p>
                              {biz.address && <p className="text-xs text-muted-foreground truncate">{biz.address}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults?.contacts && searchResults.contacts.length > 0 && (
                      <div>
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contacts</p>
                        {searchResults.contacts.map((contact) => (
                          <button
                            key={contact.id}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                            onClick={() => handleSearchNavigate("crm-contacts")}
                            data-testid={`search-result-contact-${contact.id}`}
                          >
                            <Contact className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{contact.name || "Unnamed"}</p>
                              <p className="text-xs text-muted-foreground truncate">{contact.company || contact.email || ""}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults?.events && searchResults.events.length > 0 && (
                      <div>
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Events</p>
                        {searchResults.events.map((event) => (
                          <button
                            key={event.id}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                            onClick={() => handleSearchNavigate("events")}
                            data-testid={`search-result-event-${event.id}`}
                          >
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{event.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults?.content && searchResults.content.length > 0 && (
                      <div>
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Content</p>
                        {searchResults.content.map((article) => (
                          <button
                            key={article.id}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                            onClick={() => handleSearchNavigate("articles")}
                            data-testid={`search-result-article-${article.id}`}
                          >
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{article.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults?.rss && searchResults.rss.length > 0 && (
                      <div>
                        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">RSS Feed Items</p>
                        {searchResults.rss.map((item) => (
                          <button
                            key={item.id}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                            onClick={() => handleSearchNavigate("moderation")}
                            data-testid={`search-result-rss-${item.id}`}
                          >
                            <Rss className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.sourceName}{item.reviewStatus ? ` \u00b7 ${item.reviewStatus}` : ""}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <main className="flex-1 overflow-y-auto p-3 sm:p-6">
            {inboxReturnItemId && activeSection !== "inbox" && activeSection !== "charlotte-ops" && activeSection !== "charlotte-tasks" && (
              <button
                className="flex items-center gap-1.5 text-sm text-primary hover:underline mb-3"
                onClick={() => setActiveSection("inbox")}
                data-testid="button-back-to-inbox"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Inbox
              </button>
            )}
            {renderSection()}
          </main>
        </div>
      </div>
      <AdminCharlotteSheet open={charlotteOpen} onOpenChange={setCharlotteOpen} />
    </SidebarProvider>
  );
}
