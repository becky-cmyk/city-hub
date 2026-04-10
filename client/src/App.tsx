import { useEffect, useRef, useState } from "react";
import { Switch, Route, useParams, useRoute, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { PublicLayout } from "@/components/public-layout";
import NotFound from "@/pages/not-found";
import CityHome from "@/pages/city-home";
import Directory from "@/pages/directory";
import BusinessDetail from "@/pages/business-detail";
import EventsList from "@/pages/events-list";
import EventDetail from "@/pages/event-detail";
import EventsCategory from "@/pages/events-category";
import EventsMap from "@/pages/events-map";
import UnifiedMap from "@/pages/unified-map";
import EventSeriesDetail from "@/pages/event-series-detail";
import EventCheckin from "@/pages/event-checkin";
import EventConfirmation from "@/pages/event-confirmation";
import VenueEventsDashboard from "@/pages/venue-events-dashboard";
import ArticlesList from "@/pages/articles-list";
import ArticleDetail from "@/pages/article-detail";
import ZonesIndex from "@/pages/zones-index";
import NeighborhoodsIndex from "@/pages/neighborhoods-index";
import NeighborhoodHub from "@/pages/neighborhood-hub";
import CuratedListsIndex from "@/pages/curated-lists";
import CuratedListDetail from "@/pages/curated-list-detail";
import SubmitLanding from "@/pages/submit-landing";
import ComingSoon from "@/pages/coming-soon";
import AmbassadorDashboard from "@/pages/ambassador-dashboard";
import CityOverview from "@/pages/city-overview";
import Marketplace from "@/pages/marketplace";
import MarketplaceDetail from "@/pages/marketplace-detail";
import MarketplacePost from "@/pages/marketplace-post";
import MyMarketplace from "@/pages/my-marketplace";
import SubmitBusiness from "@/pages/submit-business";
import SubmitEvent from "@/pages/submit-event";
import SubmitArticle from "@/pages/submit-article";
import SubmitOrganization from "@/pages/submit-organization";
import SubmitPressRelease from "@/pages/submit-press-release";
import SubmitShoutOut from "@/pages/submit-shout-out";
import SubmitMediaMention from "@/pages/submit-media-mention";
import SavedItems from "@/pages/saved-items";
import SubscriberProfile from "@/pages/subscriber-profile";
import DigestsList from "@/pages/digests-list";
import DigestDetail from "@/pages/digest-detail";
import CategoryHub from "@/pages/category-hub";
import Advertise from "@/pages/advertise";
import AttractionsPage from "@/pages/attractions";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import ClaimBusiness from "@/pages/claim-business";
import ClaimEvent from "@/pages/claim-event";
import OutreachRespond, { OutreachDecline } from "@/pages/outreach-respond";
import OwnerDashboard from "@/pages/owner-dashboard";
import MyListings from "@/pages/my-listings";
import ResetPassword from "@/pages/reset-password";
import ProfileSecurity from "@/pages/profile-security";
import ConfirmPresence from "@/pages/confirm-presence";
import PresenceDashboard from "@/pages/presence-dashboard";
import PresencePricing from "@/pages/presence-pricing";
import ShoppingCenterPage from "@/pages/shopping-center";
import AuthorProfilePage from "@/pages/author-profile";
import VerticalHub from "@/pages/vertical-hub";
import VerticalLanding from "@/pages/vertical-landing";
import EventsLanding from "@/pages/events-landing";
import JobsLanding from "@/pages/jobs-landing";
import MarketplaceLanding from "@/pages/marketplace-landing";
import MapLanding from "@/pages/map-landing";
import NeighborhoodVertical from "@/pages/neighborhood-vertical";
import { LandingPageShell } from "@/components/landing-page-shell";
import ActivatePage from "@/pages/activate";
import WorkflowForm from "@/pages/workflow-form";
import OwnerAuth from "@/pages/owner-auth";
import LegalPage from "@/pages/legal";
import LiveFeeds from "@/pages/live-feeds";
import ContentPage from "@/pages/content-page";
import CityMetrohubPage from "@/pages/citymetrohub";
import MicroHubPage from "@/pages/micro-hub-page";
import PulseIssuePage from "@/pages/pulse-issue-page";
import MicroPubLanding from "@/pages/micro-pub-landing";
import OperatorLogin from "@/pages/operator-login";
import OperatorRegister from "@/pages/operator-register";
import OperatorDashboard from "@/pages/operator-dashboard";
import SiteBuilder from "@/pages/site-builder";
import FaceApp from "@/pages/face-app";
import CapturePage from "@/pages/capture-page";
import CaptureSessionsPage from "@/pages/capture-sessions-page";
import FieldCapturePage from "@/pages/field-capture";
import ReviewPage from "@/pages/review-page";
import LocalUpdates from "@/pages/local-updates";
import RssArticleDetail from "@/pages/rss-article-detail";
import IntelligenceReportPage from "@/pages/intelligence-report";
import JobsList from "@/pages/jobs-list";
import JobDetail from "@/pages/job-detail";
import EmployerDashboard from "@/pages/employer-dashboard";
import ApplicantDashboard from "@/pages/applicant-dashboard";
import PublicApplicantProfile from "@/pages/public-applicant-profile";
import PublicEmployerProfile from "@/pages/public-employer-profile";
import RelocationPage from "@/pages/relocation";
import HousingPage from "@/pages/housing";
import MovingToCharlotte from "@/pages/moving-to-charlotte";
import { RelocatingToCharlotte, CostOfLivingInCharlotte, BestNeighborhoodsInCharlotte, LivingInCharlotteNC, CharlotteNeighborhoodGuide } from "@/pages/relocation-articles";
import { LivingInSouthEnd, LivingInNoDa, LivingInPlazaMidwood, LivingInDilworth, LivingInBallantyne, LivingInMatthews, LivingInHuntersville, LivingInCornelius } from "@/pages/relocation-neighborhoods";
import FeedHome from "@/pages/feed-home";
import TagPage from "@/pages/tag-page";
import CardView from "@/pages/card-view";
import ListsIndex from "@/pages/lists-index";
import AttributeList from "@/pages/attribute-list";
import HubScreensPromo from "@/pages/hub-screens-promo";
import HubScreenOnboard from "@/pages/hub-screen-onboard";
import TvPlayer from "@/pages/tv-player";
import TvVenuePortal from "@/pages/tv-venue-portal";
import TvTrivia from "@/pages/tv-trivia";
import VenueChannelPage from "@/pages/venue-channel";
import TellYourStory from "@/pages/tell-your-story";
import VerificationSuccess from "@/pages/verification-success";
import UserProfile from "@/pages/user-profile";
import LinkHub from "@/pages/link-hub";
import LinkHubSettingsPage from "@/pages/link-hub-settings";
import PulsePostDetail from "@/pages/pulse-post-detail";
import RadioPlayer from "@/pages/radio-player";
import MusicShowcase from "@/pages/music-showcase";
import PodcastDirectory from "@/pages/podcast-directory";
import GalleryPage from "@/pages/gallery";
import StockPhotosLanding from "@/pages/stock-photos-landing";
import SampleListing from "@/pages/sample-listing";
import ExpertDirectory from "@/pages/expert-directory";
import SourceRequestsPage from "@/pages/source-requests";
import SpeakersBureau from "@/pages/speakers-bureau";
import CreatorDirectory from "@/pages/creator-directory";
import CommunityHub from "@/pages/community-hub";
import ProviderProfile from "@/pages/provider-profile";
import ProviderDirectory from "@/pages/provider-directory";
import SuiteLocationPage from "@/pages/suite-location";
import PressDirectory from "@/pages/press-directory";
import { CrownOverview, CrownVoting, CrownWinnersPage, CrownRules, CrownInvitation, CrownOnboarding } from "@/pages/crown-program";
import GiveawayEntry from "@/pages/giveaway-entry";
import GiveawayResults from "@/pages/giveaway-results";
import GiveawaySpotlight from "@/pages/giveaway-spotlight";
import GiveawayClaim from "@/pages/giveaway-claim";
import GiveawayVerify from "@/pages/giveaway-verify";
import StoryIntakePage from "@/pages/story-intake";
import ArticleApprovalPage from "@/pages/article-approval";
import { useCity } from "@/hooks/use-city";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";

function DevPreviewExitButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      data-testid="button-exit-preview"
      onClick={onExit}
      className="fixed bottom-20 md:bottom-4 right-4 z-[9999] bg-amber-500 text-black text-xs font-semibold px-4 py-2 rounded-lg shadow-lg"
    >
      Exit Preview
    </button>
  );
}

function ComingSoonGuard({ citySlug, children }: { citySlug: string; children: any }) {
  const { isAdmin, isLoading, user } = useAuth();
  const { data: city, isLoading: cityLoading } = useCity(citySlug);
  const isSuperAdmin = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"].includes(user?.adminRole || "");
  const storageKey = "cch_dev_preview";
  const [devPreview, setDevPreview] = useState(() => {
    try { return sessionStorage.getItem(storageKey) === "1"; } catch { return false; }
  });

  const togglePreview = (on: boolean) => {
    setDevPreview(on);
    try { if (on) sessionStorage.setItem(storageKey, "1"); else sessionStorage.removeItem(storageKey); } catch {}
  };

  if (isLoading || cityLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAdmin || devPreview || city?.isLive) {
    return (
      <>
        {devPreview && !isAdmin && !city?.isLive && <DevPreviewExitButton onExit={() => togglePreview(false)} />}
        {children}
      </>
    );
  }

  return (
    <PublicLayout citySlug={citySlug}>
      <ComingSoon citySlug={citySlug} onEnterPreview={isSuperAdmin ? () => togglePreview(true) : undefined} />
    </PublicLayout>
  );
}

function CityRoute({ component: Component, ...rest }: { component: any; path?: string }) {
  const params = useParams<{ citySlug: string; slug?: string }>();
  return (
    <ComingSoonGuard citySlug={params.citySlug}>
      <PublicLayout citySlug={params.citySlug}>
        <Component citySlug={params.citySlug} slug={params.slug} {...rest} />
      </PublicLayout>
    </ComingSoonGuard>
  );
}

function OpenCityRoute({ component: Component, ...rest }: { component: any; path?: string }) {
  const params = useParams<{ citySlug: string; slug?: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <Component citySlug={params.citySlug} slug={params.slug} {...rest} />
    </PublicLayout>
  );
}

function CategoryRoute() {
  const params = useParams<{ citySlug: string; categorySlug: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <CategoryHub citySlug={params.citySlug} categorySlug={params.categorySlug} />
    </PublicLayout>
  );
}

function EventsCategoryRoute() {
  const params = useParams<{ citySlug: string; categorySlug: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <EventsCategory citySlug={params.citySlug} categorySlug={params.categorySlug} />
    </PublicLayout>
  );
}

function CategoryBusinessRoute() {
  const params = useParams<{ citySlug: string; categorySlug: string; businessSlug: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <BusinessDetail citySlug={params.citySlug} slug={params.businessSlug} categorySlug={params.categorySlug} />
    </PublicLayout>
  );
}

function NeighborhoodRoute() {
  const params = useParams<{ citySlug: string; code: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <NeighborhoodHub citySlug={params.citySlug} code={params.code} />
    </PublicLayout>
  );
}

function NeighborhoodCategoryRoute() {
  const params = useParams<{ citySlug: string; code: string; categorySlug: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <NeighborhoodHub citySlug={params.citySlug} code={params.code} categorySlug={params.categorySlug} />
    </PublicLayout>
  );
}

function MicroHubRoute() {
  const params = useParams<{ citySlug: string; hubSlug: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <MicroHubPage citySlug={params.citySlug} hubSlug={params.hubSlug} />
    </PublicLayout>
  );
}

function FeedRoute() {
  const params = useParams<{ citySlug: string }>();
  const { data: city } = useCity(params.citySlug);
  return (
    <PublicLayout citySlug={params.citySlug}>
      <FeedHome citySlug={params.citySlug} cityId={city?.id || ""} />
    </PublicLayout>
  );
}

function TagRoute() {
  const params = useParams<{ citySlug: string; tagSlug: string; topicSlug?: string }>();
  const { data: city } = useCity(params.citySlug);
  return (
    <PublicLayout citySlug={params.citySlug}>
      <TagPage citySlug={params.citySlug} cityId={city?.id || ""} tagSlug={params.tagSlug} topicSlug={params.topicSlug} />
    </PublicLayout>
  );
}

function VerticalRoute() {
  const params = useParams<{ citySlug: string; verticalKey: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <VerticalHub citySlug={params.citySlug} verticalKey={params.verticalKey} />
    </PublicLayout>
  );
}


function NeighborhoodVerticalRoute() {
  const params = useParams<{ citySlug: string; code: string; verticalKey: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <NeighborhoodVertical citySlug={params.citySlug} code={params.code} verticalKey={params.verticalKey} />
    </PublicLayout>
  );
}

function VenueChannelRoute() {
  const params = useParams<{ citySlug: string; channelSlug: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <VenueChannelPage citySlug={params.citySlug} channelSlug={params.channelSlug} />
    </PublicLayout>
  );
}

function ContentPageRoute() {
  const params = useParams<{ citySlug: string; slug: string }>();
  return (
    <PublicLayout citySlug={params.citySlug}>
      <ContentPage citySlug={params.citySlug} slug={params.slug} />
    </PublicLayout>
  );
}

function ComingSoonOrHome() {
  const params = useParams<{ citySlug: string }>();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { data: city } = useCity(params.citySlug);
  const { user, isLoading: authLoading } = useAuth();

  const homeHub = user?.hubs?.find(h => h.hubType === "HOME");
  const wantsHub = user?.defaultLanding === "hub" && !!homeHub?.zip;
  const { data: hubSlugData } = useQuery<{ hubSlug: string | null }>({
    queryKey: ["/api/resolve-hub-by-zip", homeHub?.zip],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${params.citySlug}/resolve-hub-by-zip?zip=${homeHub!.zip}`);
      if (!res.ok) return { hubSlug: null };
      return res.json();
    },
    enabled: wantsHub && isMobile && !!city,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!isMobile || !city) return;
    if (authLoading) return;
    if (wantsHub && hubSlugData === undefined) return;

    if (wantsHub && hubSlugData?.hubSlug) {
      setLocation(`/${params.citySlug}/neighborhoods/${hubSlugData.hubSlug}`, { replace: true });
      return;
    }
    setLocation(`/${params.citySlug}/pulse`, { replace: true });
  }, [isMobile, city, params.citySlug, setLocation, user, authLoading, wantsHub, hubSlugData]);

  if (isMobile && city) return null;

  return (
    <ComingSoonGuard citySlug={params.citySlug}>
      <PublicLayout citySlug={params.citySlug}>
        <CityOverview />
      </PublicLayout>
    </ComingSoonGuard>
  );
}

function CityAboutRoute() {
  const params = useParams<{ citySlug: string }>();
  return (
    <ComingSoonGuard citySlug={params.citySlug}>
      <PublicLayout citySlug={params.citySlug}>
        <CityOverview />
      </PublicLayout>
    </ComingSoonGuard>
  );
}

function PulseRoute() {
  const params = useParams<{ citySlug: string }>();
  const { data: city } = useCity(params.citySlug);
  return (
    <ComingSoonGuard citySlug={params.citySlug}>
      <PublicLayout citySlug={params.citySlug}>
        <FeedHome citySlug={params.citySlug} cityId={city?.id || ""} />
      </PublicLayout>
    </ComingSoonGuard>
  );
}

function PreviewGate({ children }: { children: any }) {
  const params = useParams<{ accessKey: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/preview/validate", params.accessKey],
    queryFn: async () => {
      const res = await fetch(`/api/preview/validate/${params.accessKey}`);
      if (!res.ok) throw new Error("Invalid key");
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.name = "robots";
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = "noindex, nofollow";
    return () => {
      if (robotsMeta) robotsMeta.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !data?.valid) {
    return <NotFound />;
  }

  return children;
}

function PreviewCityRoute({ component: Component, ...rest }: { component: any }) {
  const params = useParams<{ accessKey: string; citySlug: string; slug?: string; code?: string; categorySlug?: string; hubSlug?: string; verticalKey?: string }>();
  return (
    <PreviewGate>
      <PublicLayout citySlug={params.citySlug}>
        <Component citySlug={params.citySlug} slug={params.slug} code={params.code} categorySlug={params.categorySlug} hubSlug={params.hubSlug} verticalKey={params.verticalKey} {...rest} />
      </PublicLayout>
    </PreviewGate>
  );
}

function PreviewHome() {
  const params = useParams<{ accessKey: string; citySlug: string }>();
  const { data: city } = useCity(params.citySlug);
  return (
    <PreviewGate>
      <PublicLayout citySlug={params.citySlug}>
        <FeedHome citySlug={params.citySlug} cityId={city?.id || ""} />
      </PublicLayout>
    </PreviewGate>
  );
}

function PreviewFeedRoute() {
  const params = useParams<{ accessKey: string; citySlug: string }>();
  const { data: city } = useCity(params.citySlug);
  return (
    <PreviewGate>
      <PublicLayout citySlug={params.citySlug}>
        <FeedHome citySlug={params.citySlug} cityId={city?.id || ""} />
      </PublicLayout>
    </PreviewGate>
  );
}

function PresenceRedirect() {
  const params = useParams<{ citySlug: string; slug: string }>();
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(`/${params.citySlug}/directory/${params.slug}`, { replace: true });
  }, [params.citySlug, params.slug, setLocation]);
  return null;
}



function ScrollToTop() {
  const [location] = useLocation();
  const isFirstRender = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!sessionStorage.getItem("_nav_depth")) {
        sessionStorage.setItem("_nav_depth", "1");
      }
    } else {
      const depth = parseInt(sessionStorage.getItem("_nav_depth") || "1", 10);
      sessionStorage.setItem("_nav_depth", String(depth + 1));
    }
  }, [location]);
  return null;
}

function RootRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const hostname = window.location.hostname.replace(/^www\./, "");
    if (hostname === "citymetrohub.com") {
      setLocation("/citymetrohub");
      return;
    }
    fetch("/api/domain-config")
      .then(r => r.json())
      .then(config => {
        if (config.redirectPath) {
          setLocation(config.redirectPath);
        } else if (config.isMarketingSite) {
          setLocation("/citymetrohub");
        } else if (config.citySlug) {
          setLocation(`/${config.citySlug}`);
        } else {
          setLocation("/charlotte");
        }
      })
      .catch(() => {
        setLocation("/charlotte");
      });
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/citymetrohub" component={CityMetrohubPage} />
      <Route path="/face" component={FaceApp} />
      <Route path="/story-intake/:token" component={StoryIntakePage} />
      <Route path="/article-approval/:token" component={ArticleApprovalPage} />
      <Route path="/capture" component={CapturePage} />
      <Route path="/capture/sessions" component={CaptureSessionsPage} />
      <Route path="/:citySlug/capture/field" component={FieldCapturePage} />

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/:rest*">
        <AdminDashboard />
      </Route>
      <Route path="/admin">
        <AdminDashboard />
      </Route>

      <Route path="/tv/get-started" component={HubScreenOnboard} />
      <Route path="/tv/trivia/:questionId" component={TvTrivia} />
      <Route path="/tv/venue/:screenKey" component={TvVenuePortal} />
      <Route path="/tv/demo" component={TvPlayer} />
      <Route path="/tv/:citySlug/:hubSlug/:locationSlug" component={TvPlayer} />
      <Route path="/tv/:citySlug/:hubSlug" component={TvPlayer} />
      <Route path="/tv/:citySlug" component={TvPlayer} />
      <Route path="/tv" component={HubScreensPromo} />

      <Route path="/preview/:accessKey/:citySlug/directory/:slug">
        <PreviewCityRoute component={BusinessDetail} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/directory">
        <PreviewCityRoute component={Directory} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/events/tonight">
        {(params: Record<string, string>) => {
          window.location.replace(`/preview/${params.accessKey}/${params.citySlug}/events/browse?view=tonight`);
          return null;
        }}
      </Route>
      <Route path="/preview/:accessKey/:citySlug/events/weekend">
        {(params: Record<string, string>) => {
          window.location.replace(`/preview/${params.accessKey}/${params.citySlug}/events/browse?view=weekend`);
          return null;
        }}
      </Route>
      <Route path="/preview/:accessKey/:citySlug/events/map">
        <PreviewCityRoute component={EventsMap} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/events/series/:slug">
        <PreviewCityRoute component={EventSeriesDetail} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/events/:slug">
        <PreviewCityRoute component={EventDetail} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/events">
        <PreviewCityRoute component={EventsList} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/articles/:slug">
        <PreviewCityRoute component={ArticleDetail} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/articles">
        <PreviewCityRoute component={ArticlesList} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/neighborhoods/:code/:categorySlug">
        <PreviewCityRoute component={NeighborhoodHub} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/neighborhoods/:code">
        <PreviewCityRoute component={NeighborhoodHub} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/neighborhoods">
        <PreviewCityRoute component={NeighborhoodsIndex} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/marketplace">
        <PreviewCityRoute component={Marketplace} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/jobs">
        <PreviewCityRoute component={JobsList} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/relocation">
        <PreviewCityRoute component={RelocationPage} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/zones">
        <PreviewCityRoute component={ZonesIndex} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/top/:slug">
        <PreviewCityRoute component={CuratedListDetail} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/top">
        <PreviewCityRoute component={CuratedListsIndex} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/lists/:slug">
        <PreviewCityRoute component={AttributeList} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/lists">
        <PreviewCityRoute component={ListsIndex} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/attractions">
        <PreviewCityRoute component={AttractionsPage} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/live">
        <PreviewCityRoute component={LiveFeeds} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/advertise">
        <PreviewCityRoute component={Advertise} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/explore/:verticalKey">
        <PreviewCityRoute component={VerticalHub} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/hub/:hubSlug/pulse/:issueSlug">
        <PreviewCityRoute component={PulseIssuePage} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/hub/:hubSlug">
        <PreviewCityRoute component={MicroHubPage} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/submit">
        <PreviewCityRoute component={SubmitLanding} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/pages/:slug">
        <PreviewCityRoute component={ContentPage} />
      </Route>
      <Route path="/preview/:accessKey/:citySlug/pulse">
        <PreviewFeedRoute />
      </Route>
      <Route path="/preview/:accessKey/:citySlug">
        <PreviewHome />
      </Route>

      <Route path="/card/:slug" component={CardView} />
      <Route path="/intelligence/report/:token" component={IntelligenceReportPage} />

      <Route path="/operator/login" component={OperatorLogin} />
      <Route path="/operator/register" component={OperatorRegister} />
      <Route path="/operator/dashboard" component={OperatorDashboard} />

      <Route path="/reset-password" component={ResetPassword} />

      <Route path="/coming-soon">
        {() => {
          window.location.replace("/charlotte/coming-soon");
          return null;
        }}
      </Route>

      <Route path="/:citySlug/provider/:slug">
        <OpenCityRoute component={ProviderProfile} />
      </Route>
      <Route path="/:citySlug/providers">
        <OpenCityRoute component={ProviderDirectory} />
      </Route>
      <Route path="/:citySlug/suite/:slug">
        <OpenCityRoute component={SuiteLocationPage} />
      </Route>
      <Route path="/:citySlug/directory/:slug">
        <OpenCityRoute component={BusinessDetail} />
      </Route>
      <Route path="/:citySlug/directory">
        <OpenCityRoute component={Directory} />
      </Route>
      <Route path="/:citySlug/map/landing">
        {(params: { citySlug: string }) => <MapLanding citySlug={params.citySlug} />}
      </Route>
      <Route path="/:citySlug/map/explore">
        {(params: Record<string, string>) => {
          window.location.replace(`/${params.citySlug}/map`);
          return null;
        }}
      </Route>
      <Route path="/:citySlug/map">
        <OpenCityRoute component={UnifiedMap} />
      </Route>
      <Route path="/:citySlug/events/browse">
        <OpenCityRoute component={EventsList} />
      </Route>
      <Route path="/:citySlug/events/tonight">
        {(params: Record<string, string>) => {
          window.location.replace(`/${params.citySlug}/events/browse?view=tonight`);
          return null;
        }}
      </Route>
      <Route path="/:citySlug/events/weekend">
        {(params: Record<string, string>) => {
          window.location.replace(`/${params.citySlug}/events/browse?view=weekend`);
          return null;
        }}
      </Route>
      <Route path="/:citySlug/events/map">
        <OpenCityRoute component={EventsMap} />
      </Route>
      <Route path="/:citySlug/events/category/:categorySlug">
        <EventsCategoryRoute />
      </Route>
      <Route path="/:citySlug/events/series/:slug">
        <OpenCityRoute component={EventSeriesDetail} />
      </Route>
      <Route path="/:citySlug/events/:slug/checkin/:token">
        {(params: { citySlug: string; slug: string; token: string }) => (
          <EventCheckin citySlug={params.citySlug} slug={params.slug} initialToken={params.token} />
        )}
      </Route>
      <Route path="/:citySlug/events/:slug/checkin">
        {(params: { citySlug: string; slug: string }) => (
          <EventCheckin citySlug={params.citySlug} slug={params.slug} />
        )}
      </Route>
      <Route path="/:citySlug/events/:slug/confirmation">
        {(params: { citySlug: string; slug: string }) => (
          <EventConfirmation citySlug={params.citySlug} slug={params.slug} />
        )}
      </Route>
      <Route path="/:citySlug/events/:slug">
        <OpenCityRoute component={EventDetail} />
      </Route>
      <Route path="/:citySlug/events">
        {(params: { citySlug: string }) => <EventsLanding citySlug={params.citySlug} />}
      </Route>
      <Route path="/:citySlug/owner/:slug/events">
        <OpenCityRoute component={VenueEventsDashboard} />
      </Route>
      <Route path="/:citySlug/jobs/browse">
        <OpenCityRoute component={JobsList} />
      </Route>
      <Route path="/:citySlug/jobs/:jobId">
        <OpenCityRoute component={JobDetail} />
      </Route>
      <Route path="/:citySlug/jobs">
        {(params: { citySlug: string }) => <JobsLanding citySlug={params.citySlug} />}
      </Route>
      <Route path="/:citySlug/employer/jobs">
        <OpenCityRoute component={EmployerDashboard} />
      </Route>
      <Route path="/:citySlug/workforce/profile">
        <OpenCityRoute component={ApplicantDashboard} />
      </Route>
      <Route path="/:citySlug/workforce/applicant/:id">
        {(params: { citySlug: string; id: string }) => <PublicApplicantProfile citySlug={params.citySlug} id={params.id} />}
      </Route>
      <Route path="/:citySlug/workforce/employer/:businessId">
        {(params: { citySlug: string; businessId: string }) => <PublicEmployerProfile citySlug={params.citySlug} businessId={params.businessId} />}
      </Route>
      <Route path="/:citySlug/relocation/housing">
        <CityRoute component={HousingPage} />
      </Route>
      <Route path="/:citySlug/relocation">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="relocation" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/moving-to-charlotte">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <MovingToCharlotte />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/relocating-to-charlotte">
        <OpenCityRoute component={RelocatingToCharlotte} />
      </Route>
      <Route path="/:citySlug/cost-of-living-in-charlotte">
        <OpenCityRoute component={CostOfLivingInCharlotte} />
      </Route>
      <Route path="/:citySlug/best-neighborhoods-in-charlotte">
        <OpenCityRoute component={BestNeighborhoodsInCharlotte} />
      </Route>
      <Route path="/:citySlug/living-in-charlotte-nc">
        <OpenCityRoute component={LivingInCharlotteNC} />
      </Route>
      <Route path="/:citySlug/charlotte-nc-neighborhood-guide">
        <OpenCityRoute component={CharlotteNeighborhoodGuide} />
      </Route>
      <Route path="/:citySlug/living-in-south-end-charlotte">
        <OpenCityRoute component={LivingInSouthEnd} />
      </Route>
      <Route path="/:citySlug/living-in-noda-charlotte">
        <OpenCityRoute component={LivingInNoDa} />
      </Route>
      <Route path="/:citySlug/living-in-plaza-midwood">
        <OpenCityRoute component={LivingInPlazaMidwood} />
      </Route>
      <Route path="/:citySlug/living-in-dilworth-charlotte">
        <OpenCityRoute component={LivingInDilworth} />
      </Route>
      <Route path="/:citySlug/living-in-ballantyne">
        <OpenCityRoute component={LivingInBallantyne} />
      </Route>
      <Route path="/:citySlug/living-in-matthews-nc">
        <OpenCityRoute component={LivingInMatthews} />
      </Route>
      <Route path="/:citySlug/living-in-huntersville-nc">
        <OpenCityRoute component={LivingInHuntersville} />
      </Route>
      <Route path="/:citySlug/living-in-cornelius-nc">
        <OpenCityRoute component={LivingInCornelius} />
      </Route>
      <Route path="/:citySlug/news/:itemId">
        <OpenCityRoute component={RssArticleDetail} />
      </Route>
      <Route path="/:citySlug/articles/:slug">
        <OpenCityRoute component={ArticleDetail} />
      </Route>
      <Route path="/:citySlug/articles">
        <OpenCityRoute component={ArticlesList} />
      </Route>
      <Route path="/:citySlug/local-updates">
        <OpenCityRoute component={ArticlesList} />
      </Route>
      <Route path="/:citySlug/authors/:slug">
        <OpenCityRoute component={AuthorProfilePage} />
      </Route>
      <Route path="/:citySlug/pub/:pubSlug" component={MicroPubLanding} />
      <Route path="/:citySlug/hub/:hubSlug/pulse/:issueSlug">
        <OpenCityRoute component={PulseIssuePage} />
      </Route>
      <Route path="/:citySlug/hub/:hubSlug">
        <MicroHubRoute />
      </Route>
      <Route path="/:citySlug/neighborhoods/:code/events">
        {(params: { citySlug: string; code: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <NeighborhoodVertical citySlug={params.citySlug} code={params.code} verticalKey="events" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/neighborhoods/:code/jobs">
        {(params: { citySlug: string; code: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <NeighborhoodVertical citySlug={params.citySlug} code={params.code} verticalKey="jobs" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/neighborhoods/:code/food">
        {(params: { citySlug: string; code: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <NeighborhoodVertical citySlug={params.citySlug} code={params.code} verticalKey="food" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/neighborhoods/:code/family">
        {(params: { citySlug: string; code: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <NeighborhoodVertical citySlug={params.citySlug} code={params.code} verticalKey="family" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/neighborhoods/:code/marketplace">
        {(params: { citySlug: string; code: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <NeighborhoodVertical citySlug={params.citySlug} code={params.code} verticalKey="marketplace" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/neighborhoods/:code/:categorySlug">
        <NeighborhoodCategoryRoute />
      </Route>
      <Route path="/:citySlug/neighborhoods/:code">
        <NeighborhoodRoute />
      </Route>
      <Route path="/:citySlug/neighborhoods">
        <OpenCityRoute component={NeighborhoodsIndex} />
      </Route>
      <Route path="/:citySlug/zones">
        <OpenCityRoute component={ZonesIndex} />
      </Route>
      <Route path="/:citySlug/top/:slug">
        <OpenCityRoute component={CuratedListDetail} />
      </Route>
      <Route path="/:citySlug/top">
        <OpenCityRoute component={CuratedListsIndex} />
      </Route>
      <Route path="/:citySlug/lists/:slug">
        <OpenCityRoute component={AttributeList} />
      </Route>
      <Route path="/:citySlug/lists">
        <OpenCityRoute component={ListsIndex} />
      </Route>
      <Route path="/:citySlug/attractions">
        <OpenCityRoute component={AttractionsPage} />
      </Route>
      <Route path="/:citySlug/explore/:verticalKey">
        <VerticalRoute />
      </Route>
      <Route path="/:citySlug/food">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="food" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/arts-entertainment">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="arts-entertainment" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/senior">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="senior" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/seniors">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="senior" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/family">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="family" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/families">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="family" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/pets">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="pets" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/commerce">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="commerce" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/coming-soon">
        <OpenCityRoute component={ComingSoon} />
      </Route>
      <Route path="/:citySlug/ambassador">
        {(params: any) => <AmbassadorDashboard />}
      </Route>
      <Route path="/:citySlug/submit/business">
        <OpenCityRoute component={SubmitBusiness} />
      </Route>
      <Route path="/:citySlug/submit/event">
        <OpenCityRoute component={SubmitEvent} />
      </Route>
      <Route path="/:citySlug/submit/article">
        <OpenCityRoute component={SubmitArticle} />
      </Route>
      <Route path="/:citySlug/submit/organization">
        <OpenCityRoute component={SubmitOrganization} />
      </Route>
      <Route path="/:citySlug/submit/press-release">
        <OpenCityRoute component={SubmitPressRelease} />
      </Route>
      <Route path="/:citySlug/submit/shout-out">
        <OpenCityRoute component={SubmitShoutOut} />
      </Route>
      <Route path="/:citySlug/submit/media-mention">
        <OpenCityRoute component={SubmitMediaMention} />
      </Route>
      <Route path="/:citySlug/submit">
        <OpenCityRoute component={SubmitLanding} />
      </Route>
      <Route path="/verification-success">
        {() => <VerificationSuccess citySlug="charlotte" />}
      </Route>
      <Route path="/:citySlug/claim/:token">
        {(params: any) => (
          <PublicLayout citySlug={params.citySlug}>
            <ClaimBusiness citySlug={params.citySlug} token={params.token} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/respond/:token/decline">
        {(params: any) => (
          <PublicLayout citySlug={params.citySlug}>
            <OutreachDecline citySlug={params.citySlug} token={params.token} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/respond/:token">
        {(params: any) => (
          <PublicLayout citySlug={params.citySlug}>
            <OutreachRespond citySlug={params.citySlug} token={params.token} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/claim-event/:token">
        {(params: any) => (
          <PublicLayout citySlug={params.citySlug}>
            <ClaimEvent citySlug={params.citySlug} token={params.token} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/shopping-centers/:slug">
        <OpenCityRoute component={ShoppingCenterPage} />
      </Route>
      <Route path="/:citySlug/channel/:channelSlug">
        <VenueChannelRoute />
      </Route>
      <Route path="/:citySlug/review/:slug">
        <OpenCityRoute component={ReviewPage} />
      </Route>
      <Route path="/:citySlug/confirm">
        <OpenCityRoute component={ConfirmPresence} />
      </Route>
      <Route path="/:citySlug/tell-your-story">
        {() => {
          const params = useParams<{ citySlug: string }>();
          return <TellYourStory citySlug={params.citySlug} />;
        }}
      </Route>
      <Route path="/:citySlug/get-started">
        <OpenCityRoute component={WorkflowForm} />
      </Route>
      <Route path="/:citySlug/activate">
        <OpenCityRoute component={ActivatePage} />
      </Route>
      <Route path="/:citySlug/presence/:slug/pricing">
        <OpenCityRoute component={PresencePricing} />
      </Route>
      <Route path="/:citySlug/presence/:slug/manage">
        {(params: any) => (
          <PublicLayout citySlug={params.citySlug}>
            <PresenceDashboard citySlug={params.citySlug} businessId={params.slug} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/presence/:slug">
        <PresenceRedirect />
      </Route>
      <Route path="/:citySlug/my-listings">
        <OpenCityRoute component={MyListings} />
      </Route>
      <Route path="/:citySlug/account/security">
        <OpenCityRoute component={ProfileSecurity} />
      </Route>
      <Route path="/:citySlug/owner/login">
        <OpenCityRoute component={OwnerAuth} />
      </Route>
      <Route path="/:citySlug/owner/:slug/site-builder">
        <OpenCityRoute component={SiteBuilder} />
      </Route>
      <Route path="/:citySlug/owner/:slug">
        <OpenCityRoute component={OwnerDashboard} />
      </Route>
      <Route path="/:citySlug/saved">
        <OpenCityRoute component={SubscriberProfile} />
      </Route>
      <Route path="/:citySlug/profile">
        <OpenCityRoute component={SubscriberProfile} />
      </Route>
      <Route path="/:citySlug/digests/:slug">
        <OpenCityRoute component={DigestDetail} />
      </Route>
      <Route path="/:citySlug/digests">
        <OpenCityRoute component={DigestsList} />
      </Route>
      <Route path="/:citySlug/pulse/post/:postId">
        {() => {
          const params = useParams<{ citySlug: string; postId: string }>();
          return (
            <PublicLayout citySlug={params.citySlug}>
              <PulsePostDetail citySlug={params.citySlug} postId={params.postId} />
            </PublicLayout>
          );
        }}
      </Route>
      <Route path="/:citySlug/pulse/reels">
        <PulseRoute />
      </Route>
      <Route path="/:citySlug/pulse">
        <PulseRoute />
      </Route>
      <Route path="/:citySlug/feed/reels">
        {() => {
          const params = window.location.pathname.match(/^\/([^/]+)\//);
          const slug = params?.[1] || "charlotte";
          window.location.replace(`/${slug}/pulse${window.location.search}`);
          return null;
        }}
      </Route>
      <Route path="/:citySlug/feed">
        {() => {
          const params = window.location.pathname.match(/^\/([^/]+)\//);
          const slug = params?.[1] || "charlotte";
          window.location.replace(`/${slug}/pulse${window.location.search}`);
          return null;
        }}
      </Route>
      <Route path="/:citySlug/t/:tagSlug/:topicSlug">
        <TagRoute />
      </Route>
      <Route path="/:citySlug/t/:tagSlug">
        <TagRoute />
      </Route>
      <Route path="/:citySlug/link-hub/settings">
        <OpenCityRoute component={LinkHubSettingsPage} />
      </Route>
      <Route path="/:citySlug/u/id/:userId">
        <OpenCityRoute component={UserProfile} />
      </Route>
      <Route path="/:citySlug/u/:handle">
        <OpenCityRoute component={UserProfile} />
      </Route>
      <Route path="/:citySlug/marketplace/browse">
        <CityRoute component={Marketplace} />
      </Route>
      <Route path="/:citySlug/marketplace/post">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <MarketplacePost citySlug={params.citySlug} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/marketplace/my">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <MyMarketplace citySlug={params.citySlug} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/marketplace/:listingId">
        {(params: { citySlug: string; listingId: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <MarketplaceDetail citySlug={params.citySlug} listingId={params.listingId} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/marketplace">
        <CityRoute component={MarketplaceLanding} />
      </Route>
      <Route path="/:citySlug/legal">
        <OpenCityRoute component={LegalPage} />
      </Route>
      <Route path="/:citySlug/terms">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <LegalPage citySlug={params.citySlug} section="terms" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/privacy">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <LegalPage citySlug={params.citySlug} section="privacy" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/content-policy">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <LegalPage citySlug={params.citySlug} section="content-policy" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/acceptable-use">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <LegalPage citySlug={params.citySlug} section="acceptable-use" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/disclaimer">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <LegalPage citySlug={params.citySlug} section="disclaimer" />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/stock-photos">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <StockPhotosLanding />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/gallery">
        <OpenCityRoute component={GalleryPage} />
      </Route>
      <Route path="/:citySlug/experts">
        <OpenCityRoute component={ExpertDirectory} />
      </Route>
      <Route path="/:citySlug/sources">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="sources" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/source-requests">
        <OpenCityRoute component={SourceRequestsPage} />
      </Route>
      <Route path="/:citySlug/speakers">
        {(params: { citySlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="speakers" bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/speakers/directory">
        <OpenCityRoute component={SpeakersBureau} />
      </Route>
      <Route path="/:citySlug/creators">
        <OpenCityRoute component={CreatorDirectory} />
      </Route>
      <Route path="/:citySlug/community">
        <OpenCityRoute component={CommunityHub} />
      </Route>
      <Route path="/:citySlug/press">
        <OpenCityRoute component={PressDirectory} />
      </Route>
      <Route path="/giveaway/claim/:token">
        {(params: { token: string }) => (
          <PublicLayout citySlug="charlotte">
            <GiveawayClaim token={params.token} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/giveaway/verify">
        {() => (
          <PublicLayout citySlug="charlotte">
            <GiveawayVerify />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/enter-to-win/verify">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <GiveawayVerify citySlug={params.citySlug} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/enter-to-win/verify/:token">
        {(params: { citySlug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <GiveawayVerify citySlug={params.citySlug} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/enter-to-win/:slug/results">
        {(params: { citySlug: string; slug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <GiveawayResults citySlug={params.citySlug} slug={params.slug} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/enter-to-win/:slug/spotlight">
        {(params: { citySlug: string; slug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <GiveawaySpotlight citySlug={params.citySlug} slug={params.slug} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/enter-to-win/:slug">
        {(params: { citySlug: string; slug: string }) => (
          <PublicLayout citySlug={params.citySlug}>
            <GiveawayEntry citySlug={params.citySlug} slug={params.slug} />
          </PublicLayout>
        )}
      </Route>
      <Route path="/:citySlug/crown/invitation/:token">
        <OpenCityRoute component={CrownInvitation} />
      </Route>
      <Route path="/:citySlug/crown/onboarding">
        <OpenCityRoute component={CrownOnboarding} />
      </Route>
      <Route path="/:citySlug/crown/vote">
        <CityRoute component={CrownVoting} />
      </Route>
      <Route path="/:citySlug/crown/winners">
        <OpenCityRoute component={CrownWinnersPage} />
      </Route>
      <Route path="/:citySlug/crown/rules">
        <OpenCityRoute component={CrownRules} />
      </Route>
      <Route path="/:citySlug/crown">
        <OpenCityRoute component={CrownOverview} />
      </Route>
      <Route path="/:citySlug/survey/:slug">
        <OpenCityRoute component={ComingSoon} />
      </Route>
      <Route path="/:citySlug/quiz/:slug">
        <OpenCityRoute component={ComingSoon} />
      </Route>
      <Route path="/:citySlug/vote/:slug">
        <OpenCityRoute component={ComingSoon} />
      </Route>
      <Route path="/:citySlug/vote">
        <OpenCityRoute component={ComingSoon} />
      </Route>
      <Route path="/:citySlug/podcasts">
        <OpenCityRoute component={PodcastDirectory} />
      </Route>
      <Route path="/:citySlug/radio">
        <OpenCityRoute component={RadioPlayer} />
      </Route>
      <Route path="/:citySlug/music">
        <OpenCityRoute component={MusicShowcase} />
      </Route>
      <Route path="/:citySlug/live">
        <CityRoute component={LiveFeeds} />
      </Route>
      <Route path="/:citySlug/advertise">
        <OpenCityRoute component={Advertise} />
      </Route>
      <Route path="/:citySlug/pages/:slug">
        <ContentPageRoute />
      </Route>
      <Route path="/:citySlug/home">
        <CityRoute component={CityHome} />
      </Route>
      <Route path="/:citySlug/about">
        <CityAboutRoute />
      </Route>
      <Route path="/:citySlug/:hubSlug/food">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="food" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/:hubSlug/arts-entertainment">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="arts-entertainment" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/:hubSlug/senior">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="senior" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/:hubSlug/family">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="family" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/:hubSlug/pets">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="pets" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/:hubSlug/commerce">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="commerce" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/:hubSlug/relocation">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="relocation" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/:hubSlug/speakers">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="speakers" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/:citySlug/:hubSlug/sources">
        {(params: { citySlug: string; hubSlug: string }) => (
          <LandingPageShell citySlug={params.citySlug}>
            <VerticalLanding citySlug={params.citySlug} verticalKey="sources" hubSlug={params.hubSlug} bare />
          </LandingPageShell>
        )}
      </Route>
      <Route path="/sample-listing">
        <PublicLayout citySlug="charlotte">
          <SampleListing />
        </PublicLayout>
      </Route>
      <Route path="/:citySlug/:categorySlug">
        {(params: { citySlug: string; categorySlug: string }) => {
          if (params.categorySlug && params.categorySlug.startsWith("@")) {
            return (
              <PublicLayout citySlug={params.citySlug}>
                <LinkHub citySlug={params.citySlug} />
              </PublicLayout>
            );
          }
          return <CategoryRoute />;
        }}
      </Route>
      <Route path="/:citySlug/:categorySlug/:businessSlug">
        <CategoryBusinessRoute />
      </Route>
      <Route path="/:citySlug">
        <ComingSoonOrHome />
      </Route>
      <Route path="/">
        <RootRedirect />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AmbassadorRefCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && ref.trim()) {
      localStorage.setItem("ambassador_ref", ref.trim());
      fetch("/api/ambassador/track-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: ref.trim() }),
      }).catch(() => {});
    }
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <TooltipProvider>
            <ScrollToTop />
            <AmbassadorRefCapture />
            <Toaster />
            <Router />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
