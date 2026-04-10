import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Building2, Calendar, FileText, TrendingUp, DollarSign,
  ClipboardList, Download, Users, UserCheck, Megaphone,
  Search, MapPin, LogOut, PenTool, Crown, MessageSquare, Bot, Landmark, ExternalLink,
  Shield, BookOpen, Layers, Library, Image, Tag, Mail, Send, ShieldOff, Store, CalendarCheck, Inbox, Sparkles, Globe, Plus, BarChart3,
  Contact, Heart, Bell, Navigation, CreditCard, Smartphone, Target, ChevronRight, Database, ShieldCheck, Video, Radio, MessageCircle, Wrench, Repeat, Monitor,
  Clipboard, Headphones, Music, QrCode, Newspaper, Scissors, Vote, Briefcase, ArrowLeft, Brain, Languages, Activity, Gift, Zap, ListChecks,
} from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { City } from "@shared/schema";
import type { AdminMode } from "@/hooks/use-city";

interface AdminSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  user: { email: string; role: string; name: string | null; cityId?: string | null } | undefined;
  onLogout: () => void;
  pendingCount?: number;
  inboxCount?: number;
  adminCities?: City[];
  selectedCityId?: string;
  onCityChange?: (city: City) => void;
  userCityCode?: string | null;
  adminMode?: AdminMode;
  onModeChange?: (mode: AdminMode) => void;
}

const isSuperAdminRole = (role: string | undefined) => {
  return ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"].includes(role || "");
};


type SidebarScope = "platform" | "metro" | "both";

interface SidebarGroup {
  label: string;
  scope: SidebarScope;
  items: { id: string; label: string; icon: any; isLink?: boolean; href?: string; subItems?: { id: string; label: string }[] }[];
}

export const operatorGroup: SidebarGroup = {
  label: "Operator",
  scope: "metro",
  items: [
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "charlotte-report", label: "City Report", icon: Clipboard },
    { id: "charlotte-insights", label: "Public Intelligence", icon: BarChart3 },
    { id: "opportunity-radar", label: "Opportunity Radar", icon: Target },
    { id: "story-studio", label: "Story Studio", icon: BookOpen },
  ],
};

export const menuGroups: SidebarGroup[] = [
  {
    label: "Command Center",
    scope: "metro",
    items: [
      { id: "face-app", label: "Catch", icon: Smartphone, isLink: true, href: "/face" },
      { id: "dashboard", label: "Command Center", icon: LayoutDashboard },
      { id: "submissions", label: "Submissions", icon: ClipboardList },
    ],
  },
  {
    label: "CRM",
    scope: "metro",
    items: [
      { id: "crm-contacts", label: "Contacts", icon: Contact },
      { id: "crm-referrals", label: "Your Referrals", icon: Heart },
      { id: "message-center", label: "Message Center", icon: Inbox },
      { id: "comms-log", label: "Comms Log", icon: Send },
    ],
  },
  {
    label: "Events",
    scope: "metro",
    items: [
      { id: "events", label: "Events Manager", icon: Calendar },
      { id: "crm-events", label: "Event Operations", icon: CalendarCheck },
      { id: "event-rsvps", label: "RSVPs & Guests", icon: Users },
    ],
  },
  {
    label: "Content & Listings",
    scope: "metro",
    items: [
      { id: "businesses", label: "Businesses", icon: Building2 },
      { id: "categories", label: "Categories", icon: Layers },
      { id: "cms-dashboard", label: "CMS Overview", icon: Layers },
      { id: "cms-library", label: "Content Library", icon: Library },
      { id: "cms-media", label: "Media Library", icon: Image },
      { id: "authors", label: "Authors", icon: PenTool },
      { id: "provider-management", label: "Providers", icon: Scissors },
      { id: "articles", label: "Pulse", icon: FileText },
      { id: "shop-management", label: "Shop & Deals", icon: Store },
      { id: "marketplace-management", label: "Marketplace", icon: Store },
      { id: "curated-lists", label: "Curated Lists", icon: TrendingUp },
      { id: "event-collections", label: "Event Collections", icon: CalendarCheck },
      { id: "content-pages", label: "Content Pages", icon: FileText },
      { id: "translation-dashboard", label: "Translations", icon: Languages },
      { id: "pulse-issues", label: "Hub Pulse Issues", icon: Newspaper },
      { id: "micro-publications", label: "Micro Publications", icon: Newspaper },
    ],
  },
  {
    label: "Media Network",
    scope: "metro",
    items: [
      { id: "music-library", label: "Music Library", icon: Music },
      { id: "podcast-directory", label: "Podcast Directory", icon: Headphones },
      { id: "radio-management", label: "Hub Radio", icon: Radio },
      { id: "radio-ads", label: "Radio Advertising", icon: Megaphone },
      { id: "live-broadcasts", label: "Live Broadcasts", icon: Video },
    ],
  },
  {
    label: "Jobs & Workforce",
    scope: "metro",
    items: [
      { id: "workforce-overview", label: "Workforce Overview", icon: Briefcase },
      { id: "jobs-moderation", label: "Job Board", icon: Briefcase },
      { id: "job-categories", label: "Job Categories", icon: Tag },
    ],
  },
  {
    label: "Marketing & Content",
    scope: "metro",
    items: [
      { id: "content-studio", label: "Content Studio", icon: Sparkles },
      { id: "social-publishing", label: "Social Publishing", icon: Send },
      { id: "pulse-posts", label: "Pulse Posts", icon: Video },
      { id: "pulse-videos", label: "Pulse Videos", icon: Video },
      { id: "ads", label: "Banner Ads", icon: Megaphone },
      { id: "map-placements", label: "Map Placements", icon: MapPin },
      { id: "ad-management", label: "Ad Management", icon: BarChart3 },
      { id: "revenue-controls", label: "Revenue Controls", icon: DollarSign },
      { id: "messaging-library", label: "Messaging Library", icon: MessageSquare },
      { id: "web-tv", label: "Web TV", icon: Monitor },
      { id: "venue-channels", label: "Venue Channels", icon: Video },
    ],
  },
  {
    label: "Hub Operations",
    scope: "metro",
    items: [
      { id: "live-feeds", label: "Live Feeds", icon: Radio },
      { id: "cms-tags", label: "Tags", icon: Tag },
      { id: "feed-debug", label: "Feed Debug", icon: Layers },
      { id: "crown-program", label: "Crown Program", icon: Crown, subItems: [
        { id: "crown-hub-readiness", label: "Hub Readiness" },
        { id: "crown-overview", label: "Overview" },
        { id: "crown-categories", label: "Categories" },
        { id: "crown-participants", label: "Participants" },
        { id: "crown-votes", label: "Votes" },
        { id: "crown-winners", label: "Winners" },
      ] },
      { id: "engagement-hub", label: "Engagement Hub", icon: Vote, subItems: [
        { id: "engagement-overview", label: "Overview" },
        { id: "engagement-polls", label: "Polls" },
        { id: "engagement-surveys", label: "Surveys" },
        { id: "engagement-quizzes", label: "Quizzes" },
        { id: "engagement-voting", label: "Voting" },
        { id: "engagement-reviews", label: "Reviews" },
        { id: "engagement-reactions", label: "Reactions" },
      ] },
      { id: "giveaway-admin", label: "Enter to Win", icon: Gift, subItems: [
        { id: "giveaway-dashboard", label: "Dashboard" },
        { id: "giveaway-list", label: "Giveaways" },
        { id: "giveaway-entries", label: "All Entries" },
        { id: "giveaway-draws", label: "Draw Center" },
        { id: "giveaway-winners", label: "Winners" },
        { id: "giveaway-reports", label: "Reports" },
        { id: "giveaway-settings", label: "Settings" },
      ] },
      { id: "moderation-hub", label: "Moderation", icon: ShieldCheck },
      { id: "field-captures", label: "Field Captures", icon: Clipboard },
      { id: "intake", label: "Content Intake", icon: Download },
      { id: "places-import", label: "Places Import", icon: Download },
      { id: "listings-to-claim", label: "Listings to Claim", icon: ClipboardList },
      { id: "cms-calendar", label: "Editorial Calendar", icon: Calendar },
      { id: "source-requests", label: "Source Requests", icon: Newspaper },
      { id: "ambassador-management", label: "Ambassador Program", icon: Users },
    ],
  },
  {
    label: "Automation",
    scope: "metro",
    items: [
      { id: "automation-rules", label: "Automation Engine", icon: Zap },
    ],
  },
  {
    label: "Tools & Settings",
    scope: "both",
    items: [
      { id: "entitlement-management", label: "Entitlements", icon: ShieldCheck },
      { id: "package-management", label: "Package Matrix", icon: Layers },
      { id: "mileage-log", label: "Mileage Log", icon: Navigation },
      { id: "digital-cards", label: "Digital Cards", icon: CreditCard },
      { id: "listing-tiers", label: "Listing Tiers", icon: Crown },
      { id: "listing-addons", label: "Listing Add-Ons", icon: Layers },
      { id: "tier-inquiry", label: "Tiers & Inquiries", icon: Users },
      { id: "coverage-audit", label: "Coverage Audit", icon: MapPin },
      { id: "seo", label: "SEO Diagnostic", icon: Search },
      { id: "feature-audit", label: "Feature Audit", icon: ClipboardList },
      { id: "content-journal", label: "Content Journal", icon: BookOpen },
      { id: "affiliates", label: "Affiliates", icon: ExternalLink },
      { id: "qr-generator", label: "QR Generator", icon: QrCode },
      { id: "sample-listing-link", label: "Sample Listing", icon: Store },
    ],
  },
];

export const intelligenceGroup: SidebarGroup = {
  label: "Metro Intelligence",
  scope: "metro",
  items: [
    { id: "intelligence-dashboard", label: "Intelligence Dashboard", icon: BarChart3 },
    { id: "intelligence", label: "Intelligence Engine", icon: Database },
    { id: "pulse-intelligence", label: "Pulse Intelligence", icon: Radio },
    { id: "outreach-queue", label: "Outreach Queue", icon: Send },
    { id: "capture-outreach", label: "Capture Outreach", icon: UserCheck },
    { id: "content-drafts", label: "Content Drafts", icon: FileText },
    { id: "micro-prospects", label: "Micro Prospects", icon: Target },
    { id: "report-requests", label: "Report Requests", icon: FileText },
    { id: "flow-sessions", label: "Flow Sessions", icon: MessageSquare },
    { id: "workflow-sessions", label: "Workflow Engine", icon: Activity },
    { id: "conversation-pipeline", label: "Conversation Pipeline", icon: Sparkles },
  ],
};

export const charlotteAIGroup: SidebarGroup = {
  label: "Charlotte AI",
  scope: "metro",
  items: [
    { id: "teach-charlotte", label: "Charlotte AI", icon: Bot },
    { id: "site-builder", label: "AI Site Builder", icon: Globe },
  ],
};

export const coraGroup: SidebarGroup = {
  label: "Cora",
  scope: "both",
  items: [
    { id: "cora", label: "Cora Console", icon: Brain },
    { id: "cora-voice", label: "Voice & Agent Prep", icon: Headphones },
    { id: "operator-hq", label: "Operator HQ", icon: Shield },
  ],
};

export const platformOverviewGroup: SidebarGroup = {
  label: "Overview",
  scope: "platform",
  items: [
    { id: "platform-hq", label: "Platform HQ", icon: LayoutDashboard },
    { id: "platform-intelligence", label: "Platform Intelligence", icon: BarChart3 },
  ],
};

export const platformSalesGroup: SidebarGroup = {
  label: "Sales",
  scope: "platform",
  items: [
    { id: "territory-sales", label: "Territory Sales", icon: Store },
    { id: "license-crm", label: "License CRM", icon: UserCheck },
  ],
};

export const platformOperationsGroup: SidebarGroup = {
  label: "Operations",
  scope: "platform",
  items: [
    { id: "metro-management", label: "Metro Management", icon: Globe },
    { id: "hub-management", label: "Hub Management", icon: Globe },
    { id: "licensing", label: "Territories & Operators", icon: MapPin },
    { id: "ambassador-management", label: "Ambassador Program", icon: Users },
    { id: "verified-contributors", label: "Verified Contributors", icon: Shield },
    { id: "platform-site", label: "Marketing Site", icon: Globe, isLink: true, href: "/citymetrohub" },
  ],
};

export const platformFinanceGroup: SidebarGroup = {
  label: "Finance",
  scope: "platform",
  items: [
    { id: "revenue", label: "Revenue & Payouts", icon: TrendingUp },
    { id: "platform-pricing", label: "Platform Pricing", icon: DollarSign },
    { id: "itex-trades", label: "ITEX Barter Trades", icon: Repeat },
    { id: "payout-management", label: "Payout Management", icon: Landmark },
  ],
};

export const platformGovernanceGroup: SidebarGroup = {
  label: "Governance",
  scope: "platform",
  items: [
    { id: "audit-log", label: "Audit Log", icon: Shield },
  ],
};

export const superAdminGroup: SidebarGroup = {
  label: "Platform (Master)",
  scope: "platform",
  items: [
    { id: "hub-management", label: "Hub Management", icon: Globe },
    { id: "territory-sales", label: "Territory Sales", icon: Store },
    { id: "license-crm", label: "License CRM", icon: UserCheck },
    { id: "licensing", label: "Territories & Operators", icon: MapPin },
    { id: "ambassador-management", label: "Ambassador Program", icon: Users },
    { id: "verified-contributors", label: "Verified Contributors", icon: Shield },
    { id: "revenue", label: "Revenue & Payouts", icon: TrendingUp },
    { id: "platform-pricing", label: "Platform Pricing", icon: DollarSign },
    { id: "itex-trades", label: "ITEX Barter Trades", icon: Repeat },
    { id: "payout-management", label: "Payout Management", icon: Landmark },
    { id: "audit-log", label: "Audit Log", icon: Shield },
    { id: "platform-site", label: "Marketing Site", icon: Globe, isLink: true, href: "/citymetrohub" },
  ],
};

const platformGroups = [platformOverviewGroup, platformSalesGroup, platformOperationsGroup, platformFinanceGroup, platformGovernanceGroup];

export function AdminSidebar({ activeSection, onNavigate, user, onLogout, pendingCount, inboxCount, adminCities, selectedCityId, onCityChange, userCityCode, adminMode = "metro", onModeChange }: AdminSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const selectedCity = adminCities?.find(c => c.id === selectedCityId);
  const isPlatformMode = adminMode === "platform" && isSuperAdmin;

  const handleNavigate = (section: string) => {
    if (section === "sample-listing-link") {
      window.open("/sample-listing", "_blank");
      return;
    }
    onNavigate(section);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleModeSwitch = (mode: AdminMode) => {
    if (onModeChange) {
      onModeChange(mode);
      if (mode === "platform") {
        onNavigate("platform-hq");
      } else {
        onNavigate("my-hub");
      }
    }
  };

  const allCandidateGroups = isPlatformMode
    ? [...platformGroups, coraGroup, ...menuGroups.filter(g => g.scope === "both")]
    : [operatorGroup, ...menuGroups, charlotteAIGroup, intelligenceGroup, coraGroup];

  const allGroups = allCandidateGroups;

  const isGroupActive = (group: { items: { id: string; subItems?: { id: string }[] }[] }) => {
    return group.items.some((item) =>
      activeSection === item.id || (item.subItems && item.subItems.some((si) => activeSection === si.id))
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${isPlatformMode ? "bg-violet-600" : "bg-primary"}`}>
              {isPlatformMode ? (
                <Landmark className="h-4 w-4 text-white" />
              ) : (
                <MapPin className="h-4 w-4 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm block truncate" data-testid="text-admin-context-title">
                {isPlatformMode ? "Platform HQ" : (selectedCity?.name || "Metro Hub")}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {isPlatformMode ? "CityMetroHub" : "Metro Admin"}
              </span>
            </div>
          </div>
          {!isPlatformMode && selectedCity && (
            <Link href={`/${selectedCity.slug}`}>
              <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0" data-testid="button-view-site">
                <ExternalLink className="h-3.5 w-3.5" />
                View Site
              </Button>
            </Link>
          )}
        </div>

        {isSuperAdmin && adminCities && adminCities.length > 0 && (
          <div className="mt-3" data-testid="admin-context-switcher">
            <Select
              value={isPlatformMode ? "__platform__" : (selectedCityId || "")}
              onValueChange={(val) => {
                if (val === "__platform__") {
                  handleModeSwitch("platform");
                } else {
                  const city = adminCities.find(c => c.id === val);
                  if (city) {
                    if (onCityChange) onCityChange(city);
                    if (isPlatformMode) {
                      handleModeSwitch("metro");
                    }
                  }
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-admin-context">
                {isPlatformMode ? (
                  <div className="flex items-center gap-1.5">
                    <Landmark className="h-3 w-3 text-violet-600" />
                    <span>Platform HQ</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: selectedCity?.primaryColor || "#2563eb" }} />
                    <span>{selectedCity?.name || "Select..."}</span>
                  </div>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__platform__" data-testid="option-platform-hq">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5 text-violet-600" />
                    <span className="font-medium">Platform HQ</span>
                  </div>
                </SelectItem>
                {adminCities.map(city => (
                  <SelectItem key={city.id} value={city.id} data-testid={`option-city-${city.slug || city.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: city.primaryColor || "#2563eb" }} />
                      <span>{city.name}</span>
                      {!city.isActive && <Badge variant="outline" className="text-[8px] ml-1">Inactive</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!isSuperAdmin && selectedCity && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedCity.primaryColor || "#2563eb" }} />
            <span className="text-xs text-muted-foreground">{selectedCity.name}</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {!isPlatformMode && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeSection === "my-hub"}
                    onClick={() => handleNavigate("my-hub")}
                    data-testid="nav-admin-my-hub"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="font-semibold">My {userCityCode || "Hub"} Hub</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {allGroups.map((group) => (
          <Collapsible key={group.label} defaultOpen={isGroupActive(group)} className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between" data-testid={`group-toggle-${group.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                  {group.label}
                  <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item: any) => (
                      <SidebarMenuItem key={item.id}>
                        {item.isLink ? (
                          <SidebarMenuButton asChild data-testid={`nav-admin-${item.id}`}>
                            <a href={item.href} target={item.id === "face-app" ? "_self" : "_blank"} rel="noopener noreferrer">
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                              {item.id !== "face-app" && <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />}
                            </a>
                          </SidebarMenuButton>
                        ) : (
                          <>
                            <SidebarMenuButton
                              isActive={activeSection === item.id || (item.subItems && item.subItems.some((si: { id: string }) => activeSection === si.id))}
                              onClick={() => handleNavigate(item.id)}
                              data-testid={`nav-admin-${item.id}`}
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                              {item.id === "submissions" && pendingCount && pendingCount > 0 ? (
                                <Badge variant="destructive" className="ml-auto text-[10px] h-5 min-w-[20px] justify-center" data-testid="badge-submissions-count">
                                  {pendingCount}
                                </Badge>
                              ) : null}
                              {item.id === "inbox" && inboxCount && inboxCount > 0 ? (
                                <Badge variant="destructive" className="ml-auto text-[10px] h-5 min-w-[20px] justify-center" data-testid="badge-inbox-count">
                                  {inboxCount}
                                </Badge>
                              ) : null}
                              {item.subItems && <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />}
                            </SidebarMenuButton>
                            {item.subItems && (activeSection === item.id || item.subItems.some((si: { id: string }) => activeSection === si.id)) && (
                              <SidebarMenu className="ml-4 border-l pl-2 mt-0.5">
                                {item.subItems.map((sub: { id: string; label: string }) => (
                                  <SidebarMenuItem key={sub.id}>
                                    <SidebarMenuButton
                                      isActive={activeSection === sub.id}
                                      onClick={() => handleNavigate(sub.id)}
                                      className="text-xs"
                                      data-testid={`nav-admin-${sub.id}`}
                                    >
                                      <span>{sub.label}</span>
                                    </SidebarMenuButton>
                                  </SidebarMenuItem>
                                ))}
                              </SidebarMenu>
                            )}
                          </>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t px-4 py-3">
        {user && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{user.email}</p>
              <Badge variant="outline" className="text-[9px] mt-0.5">
                {isSuperAdmin ? "Master Admin" : user.role}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-admin-logout" className="shrink-0">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
