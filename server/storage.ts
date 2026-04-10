import { db } from "./db";
import { eq, and, or, desc, asc, ilike, sql, inArray, gte, gt, lte, isNotNull, type SQL } from "drizzle-orm";
import {
  cities, zones, users, categories, tags, businesses, events, articles,
  curatedLists, curatedListItems, submissions, leads, digests, deviceSaved,
  subscribers, entitlements, stripeCustomers, liveFeeds, smsMessages,
  opsAccounts, opsPeople, opsTasks, crmContacts,
  leadEvents, leadSubmissions,
  contentFeeds, importDrafts, ads, authors, attractions,
  businessContacts, communicationLog, listingTierFeatures,
  publicUsers, reviews,
  type City, type InsertCity, type Zone, type InsertZone,
  type User, type InsertUser, type Category, type InsertCategory,
  type Business, type InsertBusiness, type Event, type InsertEvent,
  type Article, type InsertArticle, type CuratedList, type InsertCuratedList,
  type CuratedListItem, type InsertCuratedListItem,
  type Submission, type InsertSubmission, type Lead, type InsertLead,
  type Digest, type InsertDigest, type DeviceSaved, type InsertDeviceSaved,
  type Entitlement, type InsertEntitlement,
  type StripeCustomer, type InsertStripeCustomer,
  type OpsAccount, type InsertOpsAccount,
  type OpsPerson, type InsertOpsPerson,
  type OpsTask, type InsertOpsTask,
  type LeadEvent, type InsertLeadEvent,
  type LeadSubmission, type InsertLeadSubmission,
  type ContentFeed, type InsertContentFeed,
  type ImportDraft, type InsertImportDraft,
  type Ad, type InsertAd,
  type Author, type InsertAuthor,
  type BusinessContact, type InsertBusinessContact,
  type CommunicationLogEntry, type InsertCommunicationLog,
  type ListingTierFeature, type InsertListingTierFeature,
  type PublicUser, type InsertPublicUser,
  type Review, type InsertReview,
  type Attraction, type InsertAttraction,
  userHubs, type UserHub, type InsertUserHub,
  presenceRevisions, presenceUsers, ownershipTransferRequests,
  presenceExternalLinks, presenceContentLinks,
  shoppingCenters, presenceServices,
  presenceCoverage, enterpriseReviewRequests, contentAttachments, presenceDomains, founderBatches,
  hubUnderwriters, hubEventPartners, weeklyHubSelections,
  type PresenceRevision, type InsertPresenceRevision,
  type PresenceUser, type InsertPresenceUser,
  type OwnershipTransferRequest, type InsertOwnershipTransferRequest,
  type PresenceExternalLink, type InsertPresenceExternalLink,
  type PresenceContentLink, type InsertPresenceContentLink,
  type ShoppingCenter, type InsertShoppingCenter,
  type PresenceService, type InsertPresenceService,
  type PresenceCoverage, type InsertPresenceCoverage,
  type EnterpriseReviewRequest, type InsertEnterpriseReviewRequest,
  type ContentAttachment, type InsertContentAttachment,
  type PresenceDomain, type InsertPresenceDomain,
  type FounderBatch, type InsertFounderBatch,
  type HubUnderwriter, type InsertHubUnderwriter,
  type HubEventPartner, type InsertHubEventPartner,
  type WeeklyHubSelection, type InsertWeeklyHubSelection,
  HUB_UNDERWRITER_MAX,
  cmsContentItems, cmsContentRelations, cmsTags, cmsContentTags, cmsAssets, cmsRevisions, cmsWorkflowEvents, cmsBridgeArticles,
  type CmsContentItem, type InsertCmsContentItem,
  type CmsContentRelation, type InsertCmsContentRelation,
  type CmsTag, type InsertCmsTag,
  type CmsAsset, type InsertCmsAsset,
  type CmsRevision, type InsertCmsRevision,
  type CmsWorkflowEvent, type InsertCmsWorkflowEvent,
  emailTemplates, emailTemplateRevisions, emailCampaigns, emailCampaignRecipients, emailSuppression, emailUnsubscribes, emailEvents,
  type EmailTemplate, type InsertEmailTemplate,
  type EmailTemplateRevision,
  type EmailCampaign, type InsertEmailCampaign,
  type EmailCampaignRecipient,
  type EmailSuppressionRecord,
  type EmailUnsubscribe,
  type EmailEvent,
  vendors, vendorContacts, crmEvents, eventVendors,
  type Vendor, type InsertVendor,
  type VendorContact, type InsertVendorContact,
  type CrmEvent, type InsertCrmEvent,
  type EventVendor, type InsertEventVendor,
  adminInboxItems, adminInboxComments, adminInboxHistory, adminInboxLinks,
  transitLines, transitStops, marketplaceListings, marketplaceCategories, marketplaceInquiries,
  marketplaceTransactions, marketplaceAnalyticsEvents,
  type TransitLine, type InsertTransitLine,
  type TransitStop, type InsertTransitStop,
  type MarketplaceListing, type InsertMarketplaceListing,
  type MarketplaceCategory, type InsertMarketplaceCategory,
  type MarketplaceInquiry, type InsertMarketplaceInquiry,
  type MarketplaceTransaction, type InsertMarketplaceTransaction,
  type MarketplaceAnalyticsEvent, type InsertMarketplaceAnalyticsEvent,
  type AdminInboxItem, type InsertAdminInboxItem,
  type AdminInboxComment, type InsertAdminInboxComment,
  type AdminInboxHistory, type InsertAdminInboxHistory,
  type AdminInboxLink, type InsertAdminInboxLink,
  placeImportJobs, placeImportResults, presencePlacesSource, listingsToClaimQueue,
  charlotteChatThreads, charlotteChatMessages,
  zipGeos,
  hubZipCoverage, regions,
  type PlaceImportJob, type InsertPlaceImportJob,
  type PlaceImportResult, type InsertPlaceImportResult,
  type PresencePlacesSource, type InsertPresencePlacesSource,
  type ListingsToClaimQueue, type InsertListingsToClaimQueue,
  type CharlotteChatThread, type InsertCharlotteChatThread,
  type CharlotteChatMessage, type InsertCharlotteChatMessage,
  type ZipGeo, type InsertZipGeo,
  type HubZipCoverage, type InsertHubZipCoverage,
  type Region,
  campaigns, nominations, votes, entityCategoryMap, entityMicroMap,
  type Campaign, type InsertCampaign,
  type Nomination, type InsertNomination,
  type Vote, type InsertVote,
  type EntityCategoryMap, type InsertEntityCategoryMap,
  type EntityMicroMap, type InsertEntityMicroMap,
  presenceFeaturedIn,
  type PresenceFeaturedIn, type InsertPresenceFeaturedIn,
  territories, operators, operatorTerritories, territoryListings, revenueTransactions, revenueSplits,
  type Territory, type InsertTerritory,
  type Operator, type InsertOperator,
  type OperatorTerritory, type InsertOperatorTerritory,
  type TerritoryListing, type InsertTerritoryListing,
  type RevenueTransaction, type InsertRevenueTransaction,
  type RevenueSplit, type InsertRevenueSplit,
  type LiveFeed, type InsertLiveFeed,
  type SmsMessage, type InsertSmsMessage,
  tvScreens, tvItems, tvPlacements, tvQrScans, tvPlayLogs,
  tvLoops, tvLoopItems, tvSchedules, tvHostPhrases,
  type TvScreen, type InsertTvScreen,
  type TvItem, type InsertTvItem,
  type TvPlacement, type InsertTvPlacement,
  type TvQrScan, type InsertTvQrScan,
  type TvPlayLog, type InsertTvPlayLog,
  type TvLoop, type InsertTvLoop,
  type TvLoopItem, type InsertTvLoopItem,
  type TvSchedule, type InsertTvSchedule,
  type TvHostPhrase, type InsertTvHostPhrase,
  venueChannels, videoContent, liveSessions, offers, transactions,
  type VenueChannel, type InsertVenueChannel,
  type VideoContent, type InsertVideoContent,
  type LiveSession, type InsertLiveSession,
  type Offer, type InsertOffer,
  type Transaction, type InsertTransaction,
  digitalCards, cardBookings,
  type DigitalCard, type InsertDigitalCard,
  type CardBooking, type InsertCardBooking,
  liveBroadcasts,
  type LiveBroadcast, type InsertLiveBroadcast,
  localPodcasts, localPodcastEpisodes,
  type LocalPodcast, type InsertLocalPodcast,
  type LocalPodcastEpisode, type InsertLocalPodcastEpisode,
  radioStations, radioSegments,
  type RadioStation, type InsertRadioStation,
  type RadioSegment, type InsertRadioSegment,
  musicArtists, musicTracks, musicMoodPresets, venueAudioProfiles,
  type MusicArtist, type InsertMusicArtist,
  type MusicTrack, type InsertMusicTrack,
  type MusicMoodPreset, type InsertMusicMoodPreset,
  type VenueAudioProfile, type InsertVenueAudioProfile,
  ambassadors, ambassadorReferrals, ambassadorInquiries,
  type Ambassador, type InsertAmbassador,
  type AmbassadorReferral, type InsertAmbassadorReferral,
  type AmbassadorInquiry, type InsertAmbassadorInquiry,
  communityFundLedger, contributorSubmissionStats,
  type CommunityFundLedger, type InsertCommunityFundLedger,
  type ContributorSubmissionStats, type InsertContributorSubmissionStats,
  platformSettings, type PlatformSetting,
  suiteLocations, providers, providerServices, providerOpenings, providerContactActions, bookingPlatformConfigs,
  type SuiteLocation, type InsertSuiteLocation,
  type Provider, type InsertProvider,
  type ProviderService, type InsertProviderService,
  type ProviderOpening, type InsertProviderOpening,
  type ProviderContactAction, type InsertProviderContactAction,
  type BookingPlatformConfig, type InsertBookingPlatformConfig,
  applicantProfiles, applicantSkills, applicantCredentials, applicantResumes,
  applicantCredentialJurisdictions,
  skillCategories, skillSubcategories, skills as skillsTable,
  credentialDirectory, businessHiringProfiles, jobListings, jobApplications, employerHiringMetrics,
  type ApplicantProfile, type InsertApplicantProfile,
  type ApplicantSkill, type InsertApplicantSkill,
  type ApplicantCredential, type InsertApplicantCredential,
  type ApplicantResume, type InsertApplicantResume,
  type ApplicantCredentialJurisdiction, type InsertApplicantCredentialJurisdiction,
  type SkillCategory, type InsertSkillCategory,
  type SkillSubcategory, type InsertSkillSubcategory,
  type Skill, type InsertSkill,
  type CredentialDirectoryEntry, type InsertCredentialDirectoryEntry,
  type BusinessHiringProfile, type InsertBusinessHiringProfile,
  type JobListing, type InsertJobListing,
  type JobApplication, type InsertJobApplication,
  type EmployerHiringMetrics, type InsertEmployerHiringMetrics,
  type HubEntitlement, type CategoryEntitlement, type MicroEntitlement,
  type CapabilityEntitlement, type CreditWallet, type CreditTransaction,
  type CreditActionCost, type PlanVersion,
  type CapabilityType,
  type PulseIssue, type InsertPulseIssue,
  type PulsePickupLocation, type InsertPulsePickupLocation,
  pulseIssues, pulsePickupLocations,
  workflowSessions, workflowEvents,
  type WorkflowSession, type InsertWorkflowSession,
  type WorkflowEvent, type InsertWorkflowEvent,
  workflowFollowUps, workflowActionRecommendations,
  type WorkflowFollowUp, type InsertWorkflowFollowUp,
  type WorkflowActionRecommendation, type InsertWorkflowActionRecommendation,
  automationRules, automationQueue, automationLog,
  type AutomationRule, type InsertAutomationRule,
  type AutomationQueueItem, type InsertAutomationQueueItem,
  type AutomationLogEntry, type InsertAutomationLogEntry,
  storyInvitations, interviewQuestionTemplates, intakeResponses,
  type StoryInvitation, type InsertStoryInvitation,
  type InterviewQuestionTemplate, type InsertInterviewQuestion,
  type IntakeResponse, type InsertIntakeResponse,
  linkHubSettings, linkHubLinks,
  type LinkHubSettings, type InsertLinkHubSettings,
  type LinkHubLink, type InsertLinkHubLink,
} from "@shared/schema";

export interface MarketplaceListingFilters {
  cityId?: string;
  type?: string;
  subtype?: string;
  status?: string;
  category?: string;
  subcategory?: string;
  ownerType?: string;
  hubPresenceId?: string;
  postedByBusinessId?: string;
  leaseOrSale?: string;
  hubId?: string;
  q?: string;
  priceMin?: number;
  priceMax?: number;
  neighborhood?: string;
  sort?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

export interface IStorage {
  // Cities
  getCityBySlug(slug: string): Promise<City | undefined>;
  getCityById(id: string): Promise<City | undefined>;
  getAllCities(): Promise<City[]>;
  createCity(data: InsertCity): Promise<City>;

  // Zones
  getZonesByCityId(cityId: string): Promise<Zone[]>;
  getAllZones(): Promise<Zone[]>;
  getZoneBySlug(cityId: string, slug: string): Promise<Zone | undefined>;
  getZoneById(id: string): Promise<Zone | undefined>;
  createZone(data: InsertZone): Promise<Zone>;
  updateZone(id: string, data: Partial<InsertZone>): Promise<Zone>;

  // Users
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;

  // Categories
  getAllCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getCategoryById(id: string): Promise<Category | undefined>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
  getCategoryUsageCount(id: string): Promise<number>;

  // Businesses
  getBusinessesByCityId(cityId: string, filters?: { zoneSlug?: string; hubSlug?: string; categorySlug?: string; q?: string; subcategorySlug?: string; subtypeSlug?: string; priceRange?: number; verifiedOnly?: boolean; kidsEatFree?: boolean; barterNetwork?: string; paymentMethod?: string; attribute?: string; _locationMatch?: import("./location-detection").LocationMatch | null; _topicTerms?: string }): Promise<Business[]>;
  getBusinessBySlug(cityId: string, slug: string): Promise<Business | undefined>;
  getBusinessById(id: string): Promise<Business | undefined>;
  getFeaturedBusinesses(cityId: string, limit?: number): Promise<Business[]>;
  getBusinessesByCategory(cityId: string, categoryId: string): Promise<Business[]>;
  createBusiness(data: InsertBusiness): Promise<Business>;
  updateBusiness(id: string, data: Partial<InsertBusiness>): Promise<Business | undefined>;
  getBusinessByClaimTokenHash(hash: string): Promise<Business | undefined>;
  getAllBusinesses(cityId?: string): Promise<Business[]>;

  // Events
  getEventsByCityId(cityId: string, filters?: { zoneSlug?: string; weekend?: boolean; q?: string; categorySlug?: string; _locationMatch?: import("./location-detection").LocationMatch | null }): Promise<Event[]>;
  getEventBySlug(cityId: string, slug: string): Promise<Event | undefined>;
  getEventById(id: string): Promise<Event | undefined>;
  getFeaturedEvents(cityId: string, limit?: number): Promise<Event[]>;
  getEventsByCategory(cityId: string, categoryId: string): Promise<Event[]>;
  createEvent(data: InsertEvent): Promise<Event>;
  updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<void>;
  getAllEvents(filters?: { q?: string; zoneId?: string; cityId?: string }): Promise<Event[]>;

  // Articles
  getArticlesByCityId(cityId: string, filters?: { q?: string; categorySlug?: string; categorySlugs?: string[]; zoneSlug?: string; _locationMatch?: import("./location-detection").LocationMatch | null }): Promise<Article[]>;
  getArticleBySlug(cityId: string, slug: string): Promise<Article | undefined>;
  getFeaturedArticles(cityId: string, limit?: number): Promise<Article[]>;
  createArticle(data: InsertArticle): Promise<Article>;
  updateArticle(id: string, data: Partial<InsertArticle>): Promise<Article | undefined>;
  deleteArticle(id: string): Promise<void>;
  getAllArticles(): Promise<Article[]>;

  // Attractions
  getAttractionsByCityId(cityId: string, filters?: { type?: string; zoneSlug?: string }): Promise<Attraction[]>;
  getAttractionBySlug(cityId: string, slug: string): Promise<Attraction | undefined>;
  getRandomFunFacts(cityId: string, limit?: number): Promise<Attraction[]>;
  createAttraction(data: InsertAttraction): Promise<Attraction>;
  updateAttraction(id: string, data: Partial<InsertAttraction>): Promise<Attraction | undefined>;
  deleteAttraction(id: string): Promise<void>;
  getAllAttractions(): Promise<Attraction[]>;

  // Curated Lists
  getCuratedListsByCityId(cityId: string): Promise<CuratedList[]>;
  getCuratedListBySlug(cityId: string, slug: string): Promise<CuratedList | undefined>;
  getCuratedListById(id: string): Promise<CuratedList | undefined>;
  getCuratedListItems(listId: string): Promise<CuratedListItem[]>;
  createCuratedList(data: InsertCuratedList): Promise<CuratedList>;
  updateCuratedList(id: string, data: Partial<InsertCuratedList>): Promise<CuratedList | undefined>;
  deleteCuratedList(id: string): Promise<void>;
  createCuratedListItem(data: InsertCuratedListItem): Promise<CuratedListItem>;
  updateCuratedListItem(id: string, data: Partial<InsertCuratedListItem>): Promise<CuratedListItem | undefined>;
  deleteCuratedListItem(id: string): Promise<void>;
  getAllCuratedLists(): Promise<CuratedList[]>;

  // Submissions
  createSubmission(data: InsertSubmission): Promise<Submission>;
  getSubmissions(cityId?: string): Promise<Submission[]>;
  getSubmissionById(id: string): Promise<Submission | undefined>;
  updateSubmissionStatus(id: string, status: string): Promise<Submission | undefined>;

  // Leads
  createLead(data: InsertLead): Promise<Lead>;
  getLeadsByCityId(cityId: string): Promise<Lead[]>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  getLeadsWithBusinessNames(cityId: string): Promise<(Lead & { businessName?: string })[]>;

  // Digests
  getDigestsByCityId(cityId: string): Promise<Digest[]>;
  getDigestBySlug(cityId: string, slug: string): Promise<Digest | undefined>;
  getDigestById(id: string): Promise<Digest | undefined>;
  createDigest(data: InsertDigest): Promise<Digest>;
  updateDigest(id: string, data: Partial<InsertDigest>): Promise<Digest | undefined>;
  getLatestDigest(cityId: string): Promise<Digest | undefined>;

  // Device Saved
  getDeviceSaved(cityId: string, deviceId: string): Promise<DeviceSaved[]>;
  getSavedByUserId(cityId: string, userId: string): Promise<DeviceSaved[]>;
  createDeviceSaved(data: InsertDeviceSaved): Promise<DeviceSaved>;
  deleteDeviceSaved(id: string): Promise<void>;

  // Entitlements
  getEntitlementsBySubject(subjectType: string, subjectId: string): Promise<Entitlement[]>;
  getActiveEntitlements(cityId: string, subjectType: string, subjectId: string): Promise<Entitlement[]>;
  upsertEntitlement(data: InsertEntitlement): Promise<Entitlement>;
  cancelEntitlementBySubscription(stripeSubscriptionId: string): Promise<void>;
  startGracePeriod(stripeSubscriptionId: string, graceExpiresAt: Date): Promise<void>;
  processExpiredGracePeriods(): Promise<number>;

  // Stripe Customers
  getStripeCustomerByEmail(email: string, cityId: string): Promise<StripeCustomer | undefined>;
  createStripeCustomer(data: InsertStripeCustomer): Promise<StripeCustomer>;

  // Ops Accounts
  getOpsAccounts(cityId: string, filters?: { status?: string; tag?: string; hasBusinessId?: boolean }): Promise<OpsAccount[]>;
  getOpsAccountById(id: string): Promise<OpsAccount | undefined>;
  createOpsAccount(data: InsertOpsAccount): Promise<OpsAccount>;
  updateOpsAccount(id: string, data: Partial<InsertOpsAccount>): Promise<OpsAccount | undefined>;

  // Ops People
  getOpsPeopleByAccount(accountId: string): Promise<OpsPerson[]>;
  getOpsPersonById(id: string): Promise<OpsPerson | undefined>;
  createOpsPerson(data: InsertOpsPerson): Promise<OpsPerson>;
  updateOpsPerson(id: string, data: Partial<InsertOpsPerson>): Promise<OpsPerson | undefined>;
  deleteOpsPerson(id: string): Promise<void>;

  // Ops Tasks
  getOpsTasksByAccount(accountId: string): Promise<OpsTask[]>;
  getOpsTaskById(id: string): Promise<OpsTask | undefined>;
  createOpsTask(data: InsertOpsTask): Promise<OpsTask>;
  updateOpsTask(id: string, data: Partial<InsertOpsTask>): Promise<OpsTask | undefined>;

  // Lead Events (Attribution)
  createLeadEvent(data: InsertLeadEvent): Promise<LeadEvent>;
  getLeadEventSummary(businessId: string, days: number): Promise<{ eventType: string; count: number }[]>;
  getRecentLeadEvents(limit: number, cityId?: string): Promise<(LeadEvent & { businessName?: string; cityName?: string })[]>;

  // Lead Submissions (Attribution)
  createLeadSubmission(data: InsertLeadSubmission): Promise<LeadSubmission>;
  getLeadSubmissionsByBusiness(businessId: string, limit: number): Promise<LeadSubmission[]>;
  getLeadSubmissionCount(businessId: string, days: number): Promise<number>;
  getRecentLeadSubmissions(limit: number, cityId?: string): Promise<(LeadSubmission & { businessName?: string; cityName?: string })[]>;

  // Lead Event Dedup
  checkLeadEventDedup(businessId: string, eventType: string, sessionId: string, windowSeconds: number): Promise<boolean>;

  // Content Feeds
  getContentFeeds(cityId: string): Promise<ContentFeed[]>;
  getContentFeedById(id: string): Promise<ContentFeed | undefined>;
  getActiveContentFeeds(): Promise<ContentFeed[]>;
  createContentFeed(data: InsertContentFeed): Promise<ContentFeed>;
  updateContentFeed(id: string, data: Partial<InsertContentFeed>): Promise<ContentFeed | undefined>;
  deleteContentFeed(id: string): Promise<void>;

  // Import Drafts
  getImportDrafts(cityId: string, filters?: { status?: string; draftType?: string; source?: string }): Promise<ImportDraft[]>;
  getImportDraftById(id: string): Promise<ImportDraft | undefined>;
  createImportDraft(data: InsertImportDraft): Promise<ImportDraft>;
  createImportDraftsBatch(data: InsertImportDraft[]): Promise<ImportDraft[]>;
  updateImportDraft(id: string, data: Partial<InsertImportDraft>): Promise<ImportDraft | undefined>;
  deleteImportDraft(id: string): Promise<void>;
  getImportDraftCounts(cityId: string): Promise<{ status: string; count: number }[]>;

  // Authors
  getAuthorsByCityId(cityId: string): Promise<Author[]>;
  getAuthorById(id: string): Promise<Author | undefined>;
  getAuthorBySlug(cityId: string, slug: string): Promise<Author | undefined>;
  getArticlesByAuthorId(authorId: string): Promise<Article[]>;
  createAuthor(data: InsertAuthor): Promise<Author>;
  updateAuthor(id: string, data: Partial<InsertAuthor>): Promise<Author | undefined>;
  deleteAuthor(id: string): Promise<void>;

  // Ads
  getAdsByCity(cityId: string): Promise<Ad[]>;
  getAdsBySlot(cityId: string, slot: string): Promise<Ad[]>;
  getActiveAdsBySlot(cityId: string, slot: string, filters?: { tags?: string[]; page?: string }): Promise<Ad[]>;
  getAdById(id: string): Promise<Ad | undefined>;
  createAd(data: InsertAd): Promise<Ad>;
  updateAd(id: string, data: Partial<InsertAd>): Promise<Ad | undefined>;
  deleteAd(id: string): Promise<void>;
  incrementAdImpressions(id: string): Promise<void>;
  incrementAdClicks(id: string): Promise<void>;

  // Business Contacts (CRM)
  getContactsByBusinessId(businessId: string): Promise<BusinessContact[]>;
  getContactById(id: string): Promise<BusinessContact | undefined>;
  createContact(data: InsertBusinessContact): Promise<BusinessContact>;
  updateContact(id: string, data: Partial<InsertBusinessContact>): Promise<BusinessContact | undefined>;
  deleteContact(id: string): Promise<void>;

  // Communication Log (CRM)
  getCommLogByBusinessId(businessId: string): Promise<CommunicationLogEntry[]>;
  createCommLogEntry(data: InsertCommunicationLog): Promise<CommunicationLogEntry>;
  deleteCommLogEntry(id: string): Promise<void>;

  // Listing Tier Features
  getListingTierFeatures(): Promise<ListingTierFeature[]>;
  updateListingTierFeature(id: string, data: Partial<InsertListingTierFeature>): Promise<ListingTierFeature>;

  // Public Users
  getPublicUserByEmail(email: string): Promise<PublicUser | undefined>;
  getPublicUserById(id: string): Promise<PublicUser | undefined>;
  createPublicUser(data: InsertPublicUser): Promise<PublicUser>;
  updatePublicUser(id: string, data: Partial<InsertPublicUser>): Promise<PublicUser | undefined>;
  getAllPublicUsers(filters?: { accountType?: string; q?: string }): Promise<PublicUser[]>;
  getBusinessesClaimedByUser(userId: string): Promise<Business[]>;

  // User Hubs
  getUserHubs(userId: string): Promise<UserHub[]>;
  getUserHubByType(userId: string, hubType: string): Promise<UserHub | undefined>;
  createUserHub(data: InsertUserHub): Promise<UserHub>;
  updateUserHub(id: string, data: Partial<InsertUserHub>): Promise<UserHub | undefined>;
  deleteUserHub(id: string): Promise<void>;

  // Reviews
  getReviewsByBusinessId(businessId: string, status?: string): Promise<(Review & { displayName: string })[]>;
  getReviewById(id: string): Promise<Review | undefined>;
  createReview(data: InsertReview): Promise<Review>;
  updateReview(id: string, data: Partial<InsertReview>): Promise<Review | undefined>;
  getAllReviews(status?: string): Promise<(Review & { displayName: string; businessName: string })[]>;
  getReviewStats(businessId: string): Promise<{ avgRating: number; count: number }>;

  // Presence Revisions (Audit Trail)
  createPresenceRevision(data: InsertPresenceRevision): Promise<PresenceRevision>;
  getPresenceRevisions(businessId: string, limit?: number): Promise<PresenceRevision[]>;
  getLatestRevisionNumber(businessId: string): Promise<number>;

  // Presence Users (Team/Ownership)
  getPresenceUsersByBusiness(businessId: string): Promise<(PresenceUser & { displayName: string; email: string })[]>;
  getPresenceUserByBusinessAndUser(businessId: string, userId: string): Promise<PresenceUser | undefined>;
  getPresenceOwner(businessId: string): Promise<PresenceUser | undefined>;
  getPresencesByUser(userId: string): Promise<(PresenceUser & { businessName: string; businessSlug: string; citySlug: string })[]>;
  createPresenceUser(data: InsertPresenceUser): Promise<PresenceUser>;
  updatePresenceUser(id: string, data: Partial<InsertPresenceUser>): Promise<PresenceUser | undefined>;
  deletePresenceUser(id: string): Promise<void>;

  // Ownership Transfer Requests
  createOwnershipTransferRequest(data: InsertOwnershipTransferRequest): Promise<OwnershipTransferRequest>;
  getOwnershipTransferRequests(filters?: { status?: string; businessId?: string }): Promise<(OwnershipTransferRequest & { businessName: string; requestedByName: string })[]>;
  getOwnershipTransferRequestById(id: string): Promise<OwnershipTransferRequest | undefined>;
  updateOwnershipTransferRequest(id: string, data: Partial<InsertOwnershipTransferRequest>): Promise<OwnershipTransferRequest | undefined>;

  // External Links (Presence Microsite)
  getExternalLinksByBusinessId(businessId: string): Promise<PresenceExternalLink[]>;
  createExternalLink(data: InsertPresenceExternalLink): Promise<PresenceExternalLink>;
  updateExternalLinkStatus(id: string, status: string, adminId?: string): Promise<void>;

  // Content Links (Presence Microsite)
  getContentLinksByBusinessId(businessId: string): Promise<PresenceContentLink[]>;
  createContentLink(data: InsertPresenceContentLink): Promise<PresenceContentLink>;
  deleteContentLink(id: string): Promise<void>;

  // Microsite Data (aggregate)
  getMicrositeData(businessId: string, cityId: string): Promise<{
    externalLinks: PresenceExternalLink[];
    contentLinks: PresenceContentLink[];
    events: any[];
    reviews: any[];
    services: PresenceService[];
    shoppingCenter: ShoppingCenter | null;
    contentJournal: ContentAttachment[];
    domain: PresenceDomain | undefined;
    coverage: PresenceCoverage[];
  }>;

  // Shopping Centers
  getShoppingCenters(cityId?: string): Promise<ShoppingCenter[]>;
  getShoppingCenterById(id: string): Promise<ShoppingCenter | undefined>;
  getShoppingCenterBySlug(slug: string): Promise<ShoppingCenter | undefined>;
  createShoppingCenter(data: InsertShoppingCenter): Promise<ShoppingCenter>;
  searchShoppingCenters(query: string, cityId?: string): Promise<ShoppingCenter[]>;
  getBusinessesByShoppingCenter(shoppingCenterId: string): Promise<Business[]>;

  // Presence Services (micro-services)
  getPresenceServices(presenceId: string): Promise<PresenceService[]>;
  setPresenceServices(presenceId: string, services: { serviceName: string; isPrimary: boolean; parentServiceId?: string | null; sortOrder: number }[]): Promise<PresenceService[]>;

  // Presence Coverage
  getPresenceCoverage(presenceId: string): Promise<PresenceCoverage[]>;
  addPresenceCoverage(data: InsertPresenceCoverage): Promise<PresenceCoverage>;
  removePresenceCoverage(id: string): Promise<void>;
  getPresencesWithCoverage(targetId: string, coverageType: string): Promise<string[]>;

  // Enterprise Review Requests
  createEnterpriseReview(data: InsertEnterpriseReviewRequest): Promise<EnterpriseReviewRequest>;
  getEnterpriseReviews(filters?: { status?: string; cityId?: string }): Promise<EnterpriseReviewRequest[]>;
  getEnterpriseReviewById(id: string): Promise<EnterpriseReviewRequest | undefined>;
  updateEnterpriseReview(id: string, data: Partial<EnterpriseReviewRequest>): Promise<EnterpriseReviewRequest | undefined>;
  countPresencesByOwner(userId: string): Promise<number>;

  // Content Attachments
  getContentAttachments(presenceId: string, status?: string): Promise<ContentAttachment[]>;
  createContentAttachment(data: InsertContentAttachment): Promise<ContentAttachment>;
  updateContentAttachment(id: string, data: Partial<ContentAttachment>): Promise<ContentAttachment | undefined>;
  getAllContentAttachments(filters?: { status?: string; batchTag?: string }): Promise<(ContentAttachment & { presenceName: string })[]>;

  // Presence Domains
  getPresenceDomain(presenceId: string): Promise<PresenceDomain | undefined>;
  getPresenceDomainByDomain(domain: string): Promise<PresenceDomain | undefined>;
  upsertPresenceDomain(data: InsertPresenceDomain): Promise<PresenceDomain>;
  updatePresenceDomain(id: string, data: Partial<PresenceDomain>): Promise<PresenceDomain | undefined>;
  deletePresenceDomain(id: string): Promise<void>;

  // Founder Batches
  getFounderBatches(cityId: string): Promise<FounderBatch[]>;
  createFounderBatch(data: InsertFounderBatch): Promise<FounderBatch>;
  updateFounderBatch(id: string, data: Partial<FounderBatch>): Promise<FounderBatch | undefined>;
  publishFounderBatch(batchId: string): Promise<{ batch: FounderBatch; publishedCount: number }>;

  // Entitlement extensions (grace/founder)
  getEntitlementWithGrace(subjectId: string): Promise<Entitlement | undefined>;
  updateEntitlementGrace(id: string, graceExpiresAt: Date | null, founderRateLocked: boolean, founderPrice: number | null): Promise<void>;

  // Fuzzy search for presence confirmation
  searchBusinessesFuzzy(name: string, city: string, websiteOrSocial?: string): Promise<Business[]>;

  // Hub Underwriters
  getUnderwritersByOrg(organizationId: string): Promise<(HubUnderwriter & { businessName: string; businessSlug: string })[]>;
  getUnderwritersByBusiness(businessId: string): Promise<(HubUnderwriter & { orgName: string; orgSlug: string })[]>;
  createUnderwriter(data: InsertHubUnderwriter): Promise<HubUnderwriter>;
  deleteUnderwriter(id: string): Promise<void>;

  // Hub Event Partners
  getEventPartners(eventId: string): Promise<(HubEventPartner & { businessName: string; businessSlug: string })[]>;
  createEventPartner(data: InsertHubEventPartner): Promise<HubEventPartner>;

  // Wildcard feed
  getWildcardFeed(cityId: string, limit: number, offset: number, seed: string): Promise<{ type: string; item: any }[]>;

  // Live events (excludes expired)
  getLiveEventsByCityId(cityId: string, filters?: { zoneSlug?: string; startDate?: string; endDate?: string }): Promise<Event[]>;

  // Weekly Hub Selections
  getWeeklySelections(cityId: string, selectionType: string): Promise<WeeklyHubSelection[]>;
  generateWeeklySelections(cityId: string, selectionType: string): Promise<number>;

  // Stats
  getAdminStats(cityId?: string): Promise<{
    businesses: number;
    events: number;
    articles: number;
    submissions: number;
    leads: number;
    zones: number;
  }>;

  // CMS Content Items
  getCmsContentItems(filters?: { contentType?: string; status?: string; assignedTo?: string; cityId?: string; search?: string; limit?: number; offset?: number }): Promise<{ items: CmsContentItem[]; total: number }>;
  getCmsContentItemById(id: string): Promise<CmsContentItem | undefined>;
  getCmsContentItemBySlug(contentType: string, slug: string): Promise<CmsContentItem | undefined>;
  createCmsContentItem(data: InsertCmsContentItem): Promise<CmsContentItem>;
  updateCmsContentItem(id: string, data: Partial<InsertCmsContentItem>): Promise<CmsContentItem | undefined>;
  getCmsStatusCounts(cityId?: string): Promise<{ status: string; count: number }[]>;

  // CMS Revisions
  getCmsRevisions(contentItemId: string): Promise<CmsRevision[]>;
  createCmsRevision(data: InsertCmsRevision): Promise<CmsRevision>;

  // CMS Workflow Events
  getCmsWorkflowEvents(contentItemId: string): Promise<CmsWorkflowEvent[]>;
  createCmsWorkflowEvent(data: InsertCmsWorkflowEvent): Promise<CmsWorkflowEvent>;

  // CMS Tags
  getAllCmsTags(): Promise<CmsTag[]>;
  createCmsTag(data: InsertCmsTag): Promise<CmsTag>;
  updateCmsTag(id: string, data: Partial<InsertCmsTag>): Promise<CmsTag | undefined>;
  deleteCmsTag(id: string): Promise<boolean>;
  getCmsContentTagIds(contentItemId: string): Promise<string[]>;
  setCmsContentTags(contentItemId: string, tagIds: string[]): Promise<void>;

  // CMS Calendar
  getCmsCalendarItems(start: Date, end: Date): Promise<{ id: string; titleEn: string; status: string; contentType: string; publishAt: string | null; publishedAt: string | null; unpublishAt: string | null }[]>;

  // CMS Assets
  getCmsAssets(filters?: { fileType?: string; search?: string; linkedBusinessId?: string; linkedCreatorId?: string; hubSlug?: string; licenseType?: string; status?: string; tag?: string; categoryId?: string }): Promise<CmsAsset[]>;
  getCmsAssetById(id: string): Promise<CmsAsset | undefined>;
  createCmsAsset(data: InsertCmsAsset): Promise<CmsAsset>;
  updateCmsAsset(id: string, data: Partial<InsertCmsAsset>): Promise<CmsAsset | undefined>;

  // CMS Content Relations
  getCmsContentRelations(contentItemId: string): Promise<CmsContentRelation[]>;
  createCmsContentRelation(data: InsertCmsContentRelation): Promise<CmsContentRelation>;
  deleteCmsContentItem(id: string): Promise<void>;
  deleteCmsContentRelation(id: string): Promise<void>;

  // CMS Bridge (Articles)
  getCmsBridgeArticle(contentItemId: string): Promise<string | undefined>;
  getCmsBridgeByLegacyId(legacyArticleId: string): Promise<string | undefined>;
  createCmsBridgeArticle(contentItemId: string, legacyArticleId: string): Promise<void>;

  // CMS Scheduling
  getScheduledForPublish(): Promise<CmsContentItem[]>;
  getScheduledForUnpublish(): Promise<CmsContentItem[]>;

  // Email Templates
  getEmailTemplates(filters?: { status?: string; templateKey?: string }): Promise<EmailTemplate[]>;
  getEmailTemplateById(id: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: string): Promise<void>;
  getEmailTemplateRevisions(templateId: string): Promise<EmailTemplateRevision[]>;
  createEmailTemplateRevision(data: { templateId: string; actorUserId?: string; fieldName: string; oldValue?: string; newValue?: string; reason?: string }): Promise<EmailTemplateRevision>;

  // Email Campaigns
  getEmailCampaigns(filters?: { status?: string; classification?: string }): Promise<EmailCampaign[]>;
  getEmailCampaignById(id: string): Promise<EmailCampaign | undefined>;
  createEmailCampaign(data: InsertEmailCampaign): Promise<EmailCampaign>;
  updateEmailCampaign(id: string, data: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined>;

  // Email Campaign Recipients
  getCampaignRecipients(campaignId: string): Promise<EmailCampaignRecipient[]>;
  createCampaignRecipient(data: { campaignId: string; email: string; userId?: string; presenceId?: string; vendorId?: string; mergeData?: any }): Promise<EmailCampaignRecipient>;
  createCampaignRecipientsBatch(data: { campaignId: string; email: string; userId?: string; presenceId?: string; vendorId?: string; mergeData?: any }[]): Promise<EmailCampaignRecipient[]>;
  updateCampaignRecipientStatus(id: string, status: string, providerMessageId?: string): Promise<void>;
  getCampaignRecipientStats(campaignId: string): Promise<{ status: string; count: number }[]>;

  // Email Suppression & Unsubscribes
  isEmailSuppressed(email: string): Promise<boolean>;
  addEmailSuppression(data: { email: string; suppressionType: string; reason?: string }): Promise<EmailSuppressionRecord>;
  getEmailSuppressions(): Promise<EmailSuppressionRecord[]>;
  removeEmailSuppression(id: string): Promise<void>;
  isEmailUnsubscribed(email: string): Promise<boolean>;
  addEmailUnsubscribe(data: { email: string; source?: string }): Promise<EmailUnsubscribe>;
  getEmailUnsubscribes(): Promise<EmailUnsubscribe[]>;
  removeEmailUnsubscribe(id: string): Promise<void>;

  // Email Events (webhook tracking)
  createEmailEvent(data: { provider?: string; providerMessageId?: string; eventType: string; email?: string; payloadJson?: any }): Promise<EmailEvent>;
  getEmailEventsByMessageId(providerMessageId: string): Promise<EmailEvent[]>;

  // Vendors
  getVendors(filters?: { status?: string; vendorType?: string; q?: string }): Promise<Vendor[]>;
  getVendorById(id: string): Promise<Vendor | undefined>;
  createVendor(data: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, data: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<void>;

  // Vendor Contacts
  getVendorContacts(vendorId: string): Promise<VendorContact[]>;
  createVendorContact(data: InsertVendorContact): Promise<VendorContact>;
  updateVendorContact(id: string, data: Partial<InsertVendorContact>): Promise<VendorContact | undefined>;
  deleteVendorContact(id: string): Promise<void>;

  // CRM Events
  getCrmEvents(filters?: { status?: string; q?: string }): Promise<CrmEvent[]>;
  getCrmEventById(id: string): Promise<CrmEvent | undefined>;
  createCrmEvent(data: InsertCrmEvent): Promise<CrmEvent>;
  updateCrmEvent(id: string, data: Partial<InsertCrmEvent>): Promise<CrmEvent | undefined>;
  deleteCrmEvent(id: string): Promise<void>;

  // Event Vendors
  getEventVendors(crmEventId: string): Promise<(EventVendor & { vendor: Vendor })[]>;
  getVendorEvents(vendorId: string): Promise<(EventVendor & { event: CrmEvent })[]>;
  createEventVendor(data: InsertEventVendor): Promise<EventVendor>;
  updateEventVendor(id: string, data: Partial<InsertEventVendor>): Promise<EventVendor | undefined>;
  deleteEventVendor(id: string): Promise<void>;

  // Admin Inbox
  getInboxItems(filters?: { status?: string; statuses?: string[]; priority?: string; itemType?: string; assignedToUserId?: string; overdue?: boolean; tag?: string; q?: string; triageCategory?: string }): Promise<AdminInboxItem[]>;
  getInboxItemById(id: string): Promise<AdminInboxItem | undefined>;
  createInboxItem(data: InsertAdminInboxItem): Promise<AdminInboxItem>;
  updateInboxItem(id: string, data: Partial<InsertAdminInboxItem>): Promise<AdminInboxItem | undefined>;
  findOpenInboxItem(relatedTable: string, relatedId: string, itemType: string): Promise<AdminInboxItem | undefined>;
  getInboxComments(inboxItemId: string): Promise<AdminInboxComment[]>;
  createInboxComment(data: InsertAdminInboxComment): Promise<AdminInboxComment>;
  getInboxHistory(inboxItemId: string): Promise<AdminInboxHistory[]>;
  createInboxHistory(data: InsertAdminInboxHistory): Promise<AdminInboxHistory>;
  getInboxLinks(inboxItemId: string): Promise<AdminInboxLink[]>;
  createInboxLink(data: InsertAdminInboxLink): Promise<AdminInboxLink>;
  markInboxItemRead(id: string): Promise<AdminInboxItem | undefined>;
  getInboxOpenCount(): Promise<number>;

  // Place Import Jobs
  createPlaceImportJob(data: InsertPlaceImportJob): Promise<PlaceImportJob>;
  getPlaceImportJob(id: string): Promise<PlaceImportJob | undefined>;
  updatePlaceImportJob(id: string, data: Partial<InsertPlaceImportJob>): Promise<PlaceImportJob | undefined>;
  listPlaceImportJobs(): Promise<PlaceImportJob[]>;
  
  // Place Import Results
  createPlaceImportResult(data: InsertPlaceImportResult): Promise<PlaceImportResult>;
  getPlaceImportResults(jobId: string): Promise<PlaceImportResult[]>;
  updatePlaceImportResult(id: string, data: Partial<InsertPlaceImportResult>): Promise<PlaceImportResult | undefined>;
  
  // Presence Places Source
  createPresencePlacesSource(data: InsertPresencePlacesSource): Promise<PresencePlacesSource>;
  getPresencePlacesSource(placeId: string): Promise<PresencePlacesSource | undefined>;
  
  // Listings to Claim Queue
  createListingsToClaimQueue(data: InsertListingsToClaimQueue): Promise<ListingsToClaimQueue>;
  listListingsToClaimQueue(filters?: { status?: string; source?: string }): Promise<(ListingsToClaimQueue & { presence?: Business })[]>;
  updateListingsToClaimQueue(id: string, data: Partial<InsertListingsToClaimQueue>): Promise<ListingsToClaimQueue | undefined>;
  getListingsToClaimQueueById(id: string): Promise<ListingsToClaimQueue | undefined>;
  
  // Charlotte Chat
  createCharlotteChatThread(data: InsertCharlotteChatThread): Promise<CharlotteChatThread>;
  updateCharlotteChatThread(id: string, data: Partial<InsertCharlotteChatThread>): Promise<CharlotteChatThread | undefined>;
  getCharlotteChatThreads(userId?: string): Promise<CharlotteChatThread[]>;
  getCharlotteChatThread(id: string): Promise<CharlotteChatThread | undefined>;
  createCharlotteChatMessage(data: InsertCharlotteChatMessage): Promise<CharlotteChatMessage>;
  getCharlotteChatMessages(threadId: string): Promise<CharlotteChatMessage[]>;
  deleteCharlotteChatThread(id: string): Promise<void>;

  // ZIP Geos
  getZipGeo(zip: string): Promise<ZipGeo | undefined>;
  listZipGeos(search?: string): Promise<ZipGeo[]>;
  upsertZipGeo(data: InsertZipGeo): Promise<ZipGeo>;
  getZipGeoCount(): Promise<number>;

  // Hub ZIP Coverage
  listHubRegions(countyId?: string): Promise<Region[]>;
  getHubCoverage(hubRegionId: string): Promise<HubZipCoverage[]>;
  upsertHubZipCoverage(data: InsertHubZipCoverage): Promise<HubZipCoverage>;
  deleteHubZipCoverage(id: string): Promise<void>;
  getHubZipList(hubRegionId: string): Promise<string[]>;

  // Reviews (extended)
  getReviewsByEntity(entityId: string): Promise<Review[]>;
  getReviewsByStatus(status: string): Promise<Review[]>;
  createReview(data: InsertReview): Promise<Review>;
  updateReviewStatus(id: string, status: string): Promise<Review | undefined>;

  // Campaigns
  getCampaigns(filters?: { year?: number; campaignType?: string }): Promise<Campaign[]>;
  getCampaignById(id: string): Promise<Campaign | undefined>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;

  // Nominations
  getNominationsByCampaign(campaignId: string): Promise<Nomination[]>;
  createNomination(data: InsertNomination): Promise<Nomination>;
  updateNominationStatus(id: string, status: string): Promise<Nomination | undefined>;

  // Votes
  getVotesByCampaign(campaignId: string): Promise<Vote[]>;
  getVoteCountByNomination(nominationId: string): Promise<number>;
  createVote(data: InsertVote): Promise<Vote>;
  hasVoted(campaignId: string, voterFingerprint: string): Promise<boolean>;

  // Entity Category Mappings (L2)
  getEntityCategories(entityId: string): Promise<EntityCategoryMap[]>;
  setEntityCategories(entityId: string, categoryIds: string[]): Promise<EntityCategoryMap[]>;

  // Entity Micro Mappings (L3)
  getEntityMicroCategories(entityId: string): Promise<EntityMicroMap[]>;
  setEntityMicroCategories(entityId: string, categoryIds: string[]): Promise<EntityMicroMap[]>;

  // Presence Featured In (Press Mentions)
  getFeaturedInByEntity(entityId: string): Promise<PresenceFeaturedIn[]>;
  createFeaturedIn(data: InsertPresenceFeaturedIn): Promise<PresenceFeaturedIn>;
  updateFeaturedIn(id: string, data: Partial<InsertPresenceFeaturedIn>): Promise<PresenceFeaturedIn | undefined>;
  deleteFeaturedIn(id: string): Promise<void>;

  // Transit Lines & Stops
  getTransitLines(cityId?: string): Promise<TransitLine[]>;
  getTransitStops(lineId: string): Promise<TransitStop[]>;
  getAllTransitStops(cityId?: string): Promise<TransitStop[]>;
  getTransitStopById(id: string): Promise<TransitStop | undefined>;
  createTransitLine(data: InsertTransitLine): Promise<TransitLine>;
  createTransitStop(data: InsertTransitStop): Promise<TransitStop>;

  // Marketplace
  getMarketplaceListings(filters?: MarketplaceListingFilters): Promise<MarketplaceListing[]>;
  countMarketplaceListingsByUser(userId: string, status?: string): Promise<number>;
  getMarketplaceListingById(id: string): Promise<MarketplaceListing | undefined>;
  getMarketplaceListingsByUser(userId: string): Promise<MarketplaceListing[]>;
  createMarketplaceListing(data: InsertMarketplaceListing): Promise<MarketplaceListing>;
  updateMarketplaceListing(id: string, data: Partial<InsertMarketplaceListing>): Promise<MarketplaceListing | undefined>;
  deleteMarketplaceListing(id: string): Promise<void>;
  getMarketplaceCategories(listingType?: string): Promise<MarketplaceCategory[]>;
  createMarketplaceCategory(data: InsertMarketplaceCategory): Promise<MarketplaceCategory>;
  updateMarketplaceCategory(id: string, data: Partial<InsertMarketplaceCategory>): Promise<MarketplaceCategory | undefined>;
  deleteMarketplaceCategory(id: string): Promise<void>;
  createMarketplaceInquiry(data: InsertMarketplaceInquiry): Promise<MarketplaceInquiry>;
  getMarketplaceInquiriesByListing(listingId: string): Promise<MarketplaceInquiry[]>;
  getMarketplaceInquiryCount(listingId: string): Promise<number>;

  getReviewsByMarketplaceListingId(listingId: string, status?: string): Promise<(Review & { displayName: string })[]>;
  getMarketplaceReviewStats(listingId: string): Promise<{ avgRating: number; count: number }>;

  createMarketplaceTransaction(data: InsertMarketplaceTransaction): Promise<MarketplaceTransaction>;
  getMarketplaceTransactionById(id: string): Promise<MarketplaceTransaction | undefined>;
  getMarketplaceTransactionsByListing(listingId: string): Promise<MarketplaceTransaction[]>;
  getMarketplaceTransactionsByBuyer(userId: string): Promise<MarketplaceTransaction[]>;
  getMarketplaceTransactionsBySeller(userId: string): Promise<MarketplaceTransaction[]>;
  updateMarketplaceTransaction(id: string, data: Partial<InsertMarketplaceTransaction>): Promise<MarketplaceTransaction | undefined>;
  getMarketplaceTransactionByClaimCode(claimCode: string): Promise<MarketplaceTransaction | undefined>;

  createMarketplaceAnalyticsEvent(data: InsertMarketplaceAnalyticsEvent): Promise<MarketplaceAnalyticsEvent>;

  // Territories
  createTerritory(data: InsertTerritory): Promise<Territory>;
  updateTerritory(id: string, data: Partial<InsertTerritory>): Promise<Territory | undefined>;
  getTerritory(id: string): Promise<Territory | undefined>;
  getTerritoryByCode(code: string): Promise<Territory | undefined>;
  listTerritories(filters?: { type?: string; status?: string; parentTerritoryId?: string }): Promise<Territory[]>;
  getTerritoryChildren(parentId: string): Promise<Territory[]>;

  // Operators
  createOperator(data: InsertOperator): Promise<Operator>;
  updateOperator(id: string, data: Partial<InsertOperator> & Record<string, any>): Promise<Operator | undefined>;
  getOperator(id: string): Promise<Operator | undefined>;
  getOperatorByEmail(email: string): Promise<Operator | undefined>;
  listOperators(filters?: { operatorType?: string; status?: string }): Promise<Operator[]>;
  getActiveOperatorsForTerritory(territoryId: string): Promise<(OperatorTerritory & { operator: Operator })[]>;

  // Operator Territories
  assignOperatorToTerritory(data: InsertOperatorTerritory): Promise<OperatorTerritory>;
  removeOperatorFromTerritory(id: string): Promise<void>;
  getOperatorTerritories(operatorId: string): Promise<OperatorTerritory[]>;

  // Territory Listings
  createTerritoryListing(data: InsertTerritoryListing): Promise<TerritoryListing>;
  getTerritoryListing(id: string): Promise<TerritoryListing | undefined>;
  listTerritoryListings(territoryId?: string): Promise<TerritoryListing[]>;

  // Revenue Transactions
  createRevenueTransaction(data: InsertRevenueTransaction): Promise<RevenueTransaction>;
  getRevenueTransaction(id: string): Promise<RevenueTransaction | undefined>;
  listRevenueTransactions(filters?: { territoryListingId?: string }): Promise<RevenueTransaction[]>;

  // Revenue Splits
  createRevenueSplit(data: InsertRevenueSplit): Promise<RevenueSplit>;
  listSplitsByTransaction(transactionId: string): Promise<RevenueSplit[]>;
  listSplitsByOperator(operatorId: string): Promise<RevenueSplit[]>;
  updateSplitStatus(id: string, status: string): Promise<RevenueSplit | undefined>;
  listAllSplits(filters?: { status?: string; operatorId?: string }): Promise<RevenueSplit[]>;
  updateRevenueSplit(id: string, data: Partial<InsertRevenueSplit>): Promise<RevenueSplit | undefined>;

  // Live Feeds
  getLiveFeedsByCityId(cityId: string, activeOnly?: boolean): Promise<LiveFeed[]>;
  getLiveFeedById(id: string): Promise<LiveFeed | undefined>;
  createLiveFeed(data: InsertLiveFeed): Promise<LiveFeed>;
  updateLiveFeed(id: string, data: Partial<InsertLiveFeed>): Promise<LiveFeed | undefined>;
  deleteLiveFeed(id: string): Promise<void>;
  getAllLiveFeeds(): Promise<LiveFeed[]>;

  // SMS Messages
  getSmsMessagesByContact(contactId: string): Promise<SmsMessage[]>;
  createSmsMessage(data: InsertSmsMessage): Promise<SmsMessage>;
  getSmsConversations(cityId?: string): Promise<{ contactId: string; lastMessage: string; lastAt: string; contactName?: string; contactPhone?: string; unreadCount: number }[]>;
  getRecentSmsMessages(limit?: number): Promise<SmsMessage[]>;

  // TV Screens
  createTvScreen(data: InsertTvScreen): Promise<TvScreen>;
  getTvScreens(filters?: { cityId?: string; hubSlug?: string; status?: string }): Promise<TvScreen[]>;
  getTvScreen(id: string): Promise<TvScreen | undefined>;
  getTvScreenByKey(screenKey: string): Promise<TvScreen | undefined>;
  updateTvScreen(id: string, data: Partial<InsertTvScreen>): Promise<TvScreen | undefined>;
  deleteTvScreen(id: string): Promise<void>;
  updateScreenHeartbeat(screenKey: string): Promise<void>;

  // TV Items
  createTvItem(data: InsertTvItem): Promise<TvItem>;
  getTvItems(filters?: { sourceScope?: string; hubSlug?: string; type?: string; enabled?: boolean; cityId?: string; contentFamily?: string }): Promise<TvItem[]>;
  getTvItem(id: string): Promise<TvItem | undefined>;
  updateTvItem(id: string, data: Partial<InsertTvItem>): Promise<TvItem | undefined>;
  deleteTvItem(id: string): Promise<void>;

  // TV Placements
  createTvPlacement(data: InsertTvPlacement): Promise<TvPlacement>;
  getTvPlacements(filters?: { cityId?: string; hubSlug?: string; enabled?: boolean }): Promise<TvPlacement[]>;
  getTvPlacement(id: string): Promise<TvPlacement | undefined>;
  updateTvPlacement(id: string, data: Partial<InsertTvPlacement>): Promise<TvPlacement | undefined>;
  deleteTvPlacement(id: string): Promise<void>;

  createTvQrScan(data: InsertTvQrScan): Promise<TvQrScan>;
  getTvQrScans(filters?: { hubSlug?: string; screenId?: string; templateKey?: string; since?: Date }): Promise<TvQrScan[]>;

  createTvPlayLog(data: InsertTvPlayLog): Promise<TvPlayLog>;
  getTvPlayLogs(filters?: { screenKey?: string; hubSlug?: string; since?: Date; limit?: number }): Promise<TvPlayLog[]>;
  getTvPlayLogStats(filters?: { hubSlug?: string; screenKey?: string; since?: Date }): Promise<{ total: number; byTemplate: Record<string, number> }>;

  getScreensByGroup(groupId: string): Promise<TvScreen[]>;

  // TV Loops
  createTvLoop(data: InsertTvLoop): Promise<TvLoop>;
  getTvLoop(id: string): Promise<TvLoop | undefined>;
  getTvLoops(filters?: { enabled?: boolean; theme?: string; daytimeTags?: string[] }): Promise<TvLoop[]>;
  updateTvLoop(id: string, data: Partial<InsertTvLoop>): Promise<TvLoop | undefined>;
  deleteTvLoop(id: string): Promise<void>;

  // TV Loop Items
  createTvLoopItem(data: InsertTvLoopItem): Promise<TvLoopItem>;
  getTvLoopItems(loopId: string): Promise<TvLoopItem[]>;
  updateTvLoopItem(id: string, data: Partial<InsertTvLoopItem>): Promise<TvLoopItem | undefined>;
  deleteTvLoopItem(id: string): Promise<void>;
  bulkReplaceTvLoopItems(loopId: string, items: InsertTvLoopItem[]): Promise<TvLoopItem[]>;

  // TV Schedules
  createTvSchedule(data: InsertTvSchedule): Promise<TvSchedule>;
  getTvSchedule(id: string): Promise<TvSchedule | undefined>;
  getTvSchedules(filters?: { screenId?: string; hubSlug?: string }): Promise<TvSchedule[]>;
  updateTvSchedule(id: string, data: Partial<InsertTvSchedule>): Promise<TvSchedule | undefined>;
  deleteTvSchedule(id: string): Promise<void>;

  // TV Host Phrases
  createTvHostPhrase(data: InsertTvHostPhrase): Promise<TvHostPhrase>;
  getTvHostPhrases(filters?: { category?: string; theme?: string }): Promise<TvHostPhrase[]>;
  updateTvHostPhrase(id: string, data: Partial<InsertTvHostPhrase>): Promise<TvHostPhrase | undefined>;
  deleteTvHostPhrase(id: string): Promise<void>;
  getRandomTvHostPhrase(category: string): Promise<TvHostPhrase | undefined>;

  // Venue Channels
  getVenueChannel(id: string): Promise<VenueChannel | undefined>;
  getVenueChannelByBusinessId(businessId: string): Promise<VenueChannel | undefined>;
  getVenueChannelBySlug(slug: string): Promise<VenueChannel | undefined>;
  listVenueChannels(cityId?: string, filters?: { status?: string }): Promise<VenueChannel[]>;
  createVenueChannel(data: InsertVenueChannel): Promise<VenueChannel>;
  updateVenueChannel(id: string, data: Partial<InsertVenueChannel>): Promise<VenueChannel | undefined>;
  deleteVenueChannel(id: string): Promise<void>;

  // Video Content
  getVideoContent(id: string): Promise<VideoContent | undefined>;
  listVideosByChannel(channelId: string): Promise<VideoContent[]>;
  listVideosByCity(cityId: string, filters?: { screenEligible?: boolean; pulseEligible?: boolean; businessId?: string }): Promise<VideoContent[]>;
  createVideoContent(data: InsertVideoContent): Promise<VideoContent>;
  updateVideoContent(id: string, data: Partial<InsertVideoContent>): Promise<VideoContent | undefined>;
  deleteVideoContent(id: string): Promise<void>;

  // Live Sessions
  getLiveSession(id: string): Promise<LiveSession | undefined>;
  getActiveLiveSessions(cityId: string): Promise<LiveSession[]>;
  getLiveSessionByBusiness(businessId: string): Promise<LiveSession | undefined>;
  createLiveSession(data: InsertLiveSession): Promise<LiveSession>;
  updateLiveSession(id: string, data: Partial<InsertLiveSession>): Promise<LiveSession | undefined>;

  // Offers
  getOffer(id: string): Promise<Offer | undefined>;
  listOffersByBusiness(businessId: string): Promise<Offer[]>;
  listActiveOffers(cityId: string): Promise<Offer[]>;
  createOffer(data: InsertOffer): Promise<Offer>;
  updateOffer(id: string, data: Partial<InsertOffer>): Promise<Offer | undefined>;
  deleteOffer(id: string): Promise<void>;

  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>;
  listTransactionsByOffer(offerId: string): Promise<Transaction[]>;
  listTransactionsByBusiness(businessId: string, filters?: { startDate?: Date; endDate?: Date }): Promise<Transaction[]>;
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, data: Partial<InsertTransaction>): Promise<Transaction | undefined>;

  // Digital Cards
  getDigitalCardBySlug(slug: string): Promise<DigitalCard | undefined>;
  createCardBooking(data: InsertCardBooking): Promise<CardBooking>;

  // Live Broadcasts
  getLiveBroadcast(id: string): Promise<LiveBroadcast | undefined>;
  getActiveBroadcasts(): Promise<LiveBroadcast[]>;
  getAllBroadcasts(): Promise<LiveBroadcast[]>;
  createLiveBroadcast(data: InsertLiveBroadcast): Promise<LiveBroadcast>;
  updateLiveBroadcast(id: string, data: Partial<InsertLiveBroadcast>): Promise<LiveBroadcast | undefined>;
  deleteLiveBroadcast(id: string): Promise<void>;

  // Local Podcasts
  getLocalPodcasts(filters?: { status?: string; category?: string; cityId?: string; featured?: boolean; q?: string }): Promise<LocalPodcast[]>;
  getLocalPodcastById(id: string): Promise<LocalPodcast | undefined>;
  getLocalPodcastBySlug(slug: string): Promise<LocalPodcast | undefined>;
  createLocalPodcast(data: InsertLocalPodcast): Promise<LocalPodcast>;
  updateLocalPodcast(id: string, data: Partial<InsertLocalPodcast>): Promise<LocalPodcast | undefined>;
  deleteLocalPodcast(id: string): Promise<void>;

  // Local Podcast Episodes
  getLocalPodcastEpisodes(podcastId: string, limit?: number, offset?: number): Promise<LocalPodcastEpisode[]>;
  getLocalPodcastEpisodeById(id: string): Promise<LocalPodcastEpisode | undefined>;
  createLocalPodcastEpisode(data: InsertLocalPodcastEpisode): Promise<LocalPodcastEpisode>;
  deleteLocalPodcastEpisode(id: string): Promise<void>;

  // Radio Stations
  getRadioStationById(id: string): Promise<RadioStation | undefined>;
  getRadioStationBySlug(slug: string): Promise<RadioStation | undefined>;
  listRadioStations(filters?: { status?: string; stationType?: string; cityId?: string }): Promise<RadioStation[]>;
  createRadioStation(data: InsertRadioStation): Promise<RadioStation>;
  updateRadioStation(id: string, data: Partial<InsertRadioStation>): Promise<RadioStation | undefined>;
  deleteRadioStation(id: string): Promise<void>;

  // Radio Segments
  getRadioSegmentById(id: string): Promise<RadioSegment | undefined>;
  listRadioSegments(stationId: string, filters?: { status?: string }): Promise<RadioSegment[]>;
  createRadioSegment(data: InsertRadioSegment): Promise<RadioSegment>;
  updateRadioSegment(id: string, data: Partial<InsertRadioSegment>): Promise<RadioSegment | undefined>;
  deleteRadioSegment(id: string): Promise<void>;

  // Music Artists
  getMusicArtists(filters?: { status?: string; genre?: string; cityId?: string; q?: string }): Promise<MusicArtist[]>;
  getMusicArtistById(id: string): Promise<MusicArtist | undefined>;
  getMusicArtistBySlug(slug: string): Promise<MusicArtist | undefined>;
  createMusicArtist(data: InsertMusicArtist): Promise<MusicArtist>;
  updateMusicArtist(id: string, data: Partial<InsertMusicArtist>): Promise<MusicArtist | undefined>;
  deleteMusicArtist(id: string): Promise<void>;

  // Music Tracks
  getMusicTracks(filters?: { status?: string; genre?: string; artistId?: string; cityId?: string }): Promise<MusicTrack[]>;
  getMusicTrackById(id: string): Promise<MusicTrack | undefined>;
  createMusicTrack(data: InsertMusicTrack): Promise<MusicTrack>;
  updateMusicTrack(id: string, data: Partial<InsertMusicTrack>): Promise<MusicTrack | undefined>;
  deleteMusicTrack(id: string): Promise<void>;

  // Music Mood Presets
  getMusicMoodPresets(cityId?: string): Promise<MusicMoodPreset[]>;
  getMusicMoodPresetById(id: string): Promise<MusicMoodPreset | undefined>;
  createMusicMoodPreset(data: InsertMusicMoodPreset): Promise<MusicMoodPreset>;
  updateMusicMoodPreset(id: string, data: Partial<InsertMusicMoodPreset>): Promise<MusicMoodPreset | undefined>;
  deleteMusicMoodPreset(id: string): Promise<void>;

  // Venue Audio Profiles
  getVenueAudioProfiles(): Promise<VenueAudioProfile[]>;
  getVenueAudioProfileByScreenId(screenId: string): Promise<VenueAudioProfile | undefined>;
  getVenueAudioProfileById(id: string): Promise<VenueAudioProfile | undefined>;
  createVenueAudioProfile(data: InsertVenueAudioProfile): Promise<VenueAudioProfile>;
  updateVenueAudioProfile(id: string, data: Partial<InsertVenueAudioProfile>): Promise<VenueAudioProfile | undefined>;

  getAmbassadorsByCityId(cityId: string): Promise<Ambassador[]>;
  getAmbassadorById(id: string): Promise<Ambassador | undefined>;
  getAmbassadorByReferralCode(code: string): Promise<Ambassador | undefined>;
  getAmbassadorByEmail(email: string, cityId: string): Promise<Ambassador | undefined>;
  createAmbassador(data: InsertAmbassador): Promise<Ambassador>;
  updateAmbassador(id: string, data: Partial<InsertAmbassador>): Promise<Ambassador | undefined>;

  getAmbassadorReferrals(ambassadorId: string): Promise<AmbassadorReferral[]>;
  createAmbassadorReferral(data: InsertAmbassadorReferral): Promise<AmbassadorReferral>;
  updateAmbassadorReferral(id: string, data: Partial<InsertAmbassadorReferral>): Promise<AmbassadorReferral | undefined>;

  getAmbassadorInquiries(cityId: string, status?: string): Promise<AmbassadorInquiry[]>;
  createAmbassadorInquiry(data: InsertAmbassadorInquiry): Promise<AmbassadorInquiry>;
  updateAmbassadorInquiry(id: string, data: Partial<InsertAmbassadorInquiry>): Promise<AmbassadorInquiry | undefined>;

  getVerifiedContributors(filters?: { status?: string; tier?: string }): Promise<PublicUser[]>;
  updateContributorVerification(userId: string, data: {
    isVerifiedContributor: boolean;
    contributorStatus: string;
    verificationTier?: string | null;
    verificationAmountCents?: number | null;
    verificationPaymentId?: string | null;
    verificationCompletedAt?: Date | null;
    moderationTrustScore?: number;
  }): Promise<PublicUser | undefined>;

  createCommunityFundEntry(data: InsertCommunityFundLedger): Promise<CommunityFundLedger>;
  getCommunityFundEntries(filters?: { userId?: string; status?: string }): Promise<CommunityFundLedger[]>;
  getCommunityFundSummary(): Promise<{ totalRaisedCents: number; totalContributors: number; byTier: Record<string, { count: number; totalCents: number }> }>;
  updateCommunityFundEntry(id: string, data: Partial<InsertCommunityFundLedger>): Promise<CommunityFundLedger | undefined>;

  getContributorSubmissionStats(userId: string): Promise<ContributorSubmissionStats | undefined>;
  upsertContributorSubmissionStats(userId: string, updates: Partial<InsertContributorSubmissionStats>): Promise<ContributorSubmissionStats>;

  getCommunityFundEntryByPaymentId(paymentId: string): Promise<CommunityFundLedger | undefined>;

  getPlatformSetting(key: string): Promise<unknown | undefined>;
  setPlatformSetting(key: string, value: unknown): Promise<void>;

  getSuiteLocationBySlug(slug: string): Promise<SuiteLocation | undefined>;
  getSuiteLocationById(id: string): Promise<SuiteLocation | undefined>;
  getSuiteLocationsByCityId(cityId: string): Promise<SuiteLocation[]>;
  createSuiteLocation(data: InsertSuiteLocation): Promise<SuiteLocation>;
  updateSuiteLocation(id: string, data: Partial<InsertSuiteLocation>): Promise<SuiteLocation | undefined>;
  deleteSuiteLocation(id: string): Promise<void>;

  getProviderBySlug(cityId: string, slug: string): Promise<Provider | undefined>;
  getProviderById(id: string): Promise<Provider | undefined>;
  getProvidersByCityId(cityId: string, filters?: { category?: string; zoneId?: string; suiteLocationId?: string; verified?: boolean; acceptsWalkIns?: boolean; hasBooking?: boolean; q?: string; availability?: string; hubId?: string }): Promise<Provider[]>;
  getProvidersBySuiteLocationId(suiteLocationId: string): Promise<Provider[]>;
  createProvider(data: InsertProvider): Promise<Provider>;
  updateProvider(id: string, data: Partial<InsertProvider>): Promise<Provider | undefined>;
  deleteProvider(id: string): Promise<void>;
  getAllProviders(cityId?: string): Promise<Provider[]>;

  getProviderServicesByProviderId(providerId: string): Promise<ProviderService[]>;
  createProviderService(data: InsertProviderService): Promise<ProviderService>;
  updateProviderService(id: string, data: Partial<InsertProviderService>): Promise<ProviderService | undefined>;
  deleteProviderService(id: string): Promise<void>;

  getProviderOpeningsByProviderId(providerId: string, filters?: { status?: string }): Promise<ProviderOpening[]>;
  getActiveOpeningsByCityId(cityId: string, filters?: { urgencyLabel?: string; category?: string; limit?: number }): Promise<(ProviderOpening & { providerName: string; providerSlug: string; providerCategory: string; providerImageUrl: string | null })[]>;
  createProviderOpening(data: InsertProviderOpening): Promise<ProviderOpening>;
  updateProviderOpening(id: string, data: Partial<InsertProviderOpening>): Promise<ProviderOpening | undefined>;
  deleteProviderOpening(id: string): Promise<void>;
  expireOldOpenings(): Promise<number>;

  logProviderContactAction(data: InsertProviderContactAction): Promise<ProviderContactAction>;
  getProviderContactActionStats(providerId: string, since?: Date): Promise<Record<string, number>>;
  getTopProvidersByActions(cityId: string, limit?: number, since?: Date): Promise<{ providerId: string; providerName: string; totalActions: number }[]>;
  getTopOpeningsByClicks(cityId: string, limit?: number, since?: Date): Promise<{ openingId: string; title: string; providerName: string; clicks: number }[]>;
  getActionsByType(cityId: string, since?: Date): Promise<{ actionType: string; count: number }[]>;
  getProviderStatsByZone(cityId: string): Promise<{ zoneId: string | null; zoneName: string | null; providerCount: number; actionCount: number }[]>;

  getBookingPlatformConfigs(category?: string): Promise<BookingPlatformConfig[]>;

  // Workforce — Applicant Profiles
  createApplicantProfile(data: InsertApplicantProfile): Promise<ApplicantProfile>;
  getApplicantProfileByUserId(userId: string): Promise<ApplicantProfile | undefined>;
  updateApplicantProfile(id: string, data: Partial<InsertApplicantProfile>): Promise<ApplicantProfile | undefined>;
  listApplicantProfilesByZone(zoneId: string): Promise<ApplicantProfile[]>;

  // Workforce — Applicant Skills
  addApplicantSkill(data: InsertApplicantSkill): Promise<ApplicantSkill>;
  removeApplicantSkill(id: string): Promise<void>;
  listApplicantSkills(applicantId: string): Promise<(ApplicantSkill & { skillName: string; subcategoryName: string; categoryName: string })[]>;

  // Workforce — Applicant Credentials
  addApplicantCredential(data: InsertApplicantCredential): Promise<ApplicantCredential>;
  updateApplicantCredential(id: string, data: Partial<InsertApplicantCredential>): Promise<ApplicantCredential | undefined>;
  listApplicantCredentials(applicantId: string): Promise<(ApplicantCredential & { credentialName: string })[]>;

  // Workforce — Credential Jurisdictions
  addCredentialJurisdiction(data: InsertApplicantCredentialJurisdiction): Promise<ApplicantCredentialJurisdiction>;
  listCredentialJurisdictions(credentialRecordId: string): Promise<ApplicantCredentialJurisdiction[]>;
  deleteCredentialJurisdiction(id: string): Promise<void>;

  // Workforce — Public Profile Access
  getApplicantProfileById(id: string): Promise<ApplicantProfile | undefined>;
  getBusinessHiringProfileById(profileId: string): Promise<BusinessHiringProfile | undefined>;
  getPublicBusinessHiringProfile(businessId: string): Promise<(BusinessHiringProfile & { businessName: string; businessSlug: string; businessCityId: string }) | undefined>;

  // Workforce — Applicant Skill Toggle
  updateApplicantSkill(id: string, data: Partial<InsertApplicantSkill>): Promise<ApplicantSkill | undefined>;

  // Workforce — Applicant Resumes
  addApplicantResume(data: InsertApplicantResume): Promise<ApplicantResume>;
  setPrimaryResume(applicantId: string, resumeId: string): Promise<void>;
  listApplicantResumes(applicantId: string): Promise<ApplicantResume[]>;
  deleteApplicantResume(id: string): Promise<void>;

  // Workforce — Skill Taxonomy
  listSkillCategories(): Promise<SkillCategory[]>;
  listSkillSubcategories(categoryId: string): Promise<SkillSubcategory[]>;
  listSkillsBySubcategory(subcategoryId: string): Promise<Skill[]>;
  getFullSkillTaxonomy(): Promise<(SkillCategory & { subcategories: (SkillSubcategory & { skills: Skill[] })[] })[]>;

  // Workforce — Credential Directory
  listCredentialDirectory(): Promise<CredentialDirectoryEntry[]>;
  searchCredentialDirectory(q: string): Promise<CredentialDirectoryEntry[]>;

  // Workforce — Business Hiring Profiles
  createBusinessHiringProfile(data: InsertBusinessHiringProfile): Promise<BusinessHiringProfile>;
  getBusinessHiringProfile(businessId: string): Promise<BusinessHiringProfile | undefined>;
  updateBusinessHiringProfile(id: string, data: Partial<InsertBusinessHiringProfile>): Promise<BusinessHiringProfile | undefined>;
  listActivelyHiringBusinesses(zoneId?: string): Promise<(BusinessHiringProfile & { businessName: string; businessSlug: string })[]>;

  // Workforce — Job Listings
  createJobListing(data: InsertJobListing): Promise<JobListing>;
  getJobListingById(id: string): Promise<JobListing | undefined>;
  updateJobListing(id: string, data: Partial<InsertJobListing>): Promise<JobListing | undefined>;
  listJobListingsByBusiness(businessId: string): Promise<JobListing[]>;

  // Workforce — Job Applications
  createJobApplication(data: InsertJobApplication): Promise<JobApplication>;
  getJobApplicationById(id: string): Promise<JobApplication | undefined>;
  updateJobApplication(id: string, data: Partial<InsertJobApplication>): Promise<JobApplication | undefined>;
  listJobApplicationsByApplicant(applicantId: string): Promise<JobApplication[]>;
  listJobApplicationsByListing(listingId: string): Promise<JobApplication[]>;

  // Workforce — Employer Hiring Metrics
  getEmployerHiringMetrics(businessId: string, month: string): Promise<EmployerHiringMetrics | undefined>;
  listEmployerHiringMetrics(businessId: string): Promise<EmployerHiringMetrics[]>;
  upsertEmployerHiringMetrics(data: InsertEmployerHiringMetrics): Promise<EmployerHiringMetrics>;

  // Workforce — Admin Stats
  getWorkforceStats(): Promise<{ applicantProfiles: number; activeHiringBusinesses: number; totalSkills: number; pendingCredentials: number; jobListings: number }>;

  // Hub Entitlements
  getActiveHubEntitlements(presenceId: string): Promise<HubEntitlement[]>;
  getHubEntitlement(presenceId: string, hubId: string): Promise<HubEntitlement | null>;
  createHubEntitlement(data: { presenceId: string; hubId: string; cityId: string; isBaseHub?: boolean; billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date }): Promise<HubEntitlement>;
  getActiveCategoryEntitlements(presenceId: string, hubEntitlementId?: string): Promise<CategoryEntitlement[]>;
  getCategoryEntitlement(presenceId: string, hubEntitlementId: string, categoryId: string): Promise<CategoryEntitlement | null>;
  createCategoryEntitlement(data: { presenceId: string; hubEntitlementId: string; categoryId: string; isBaseCategory?: boolean; billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date }): Promise<CategoryEntitlement>;
  getActiveMicroEntitlements(presenceId: string, categoryEntitlementId?: string): Promise<MicroEntitlement[]>;
  getMicroEntitlement(presenceId: string, categoryEntitlementId: string, microId: string): Promise<MicroEntitlement | null>;
  createMicroEntitlement(data: { presenceId: string; categoryEntitlementId: string; microId: string; isBaseMicro?: boolean; billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date }): Promise<MicroEntitlement>;
  getActiveCapabilities(presenceId: string, hubEntitlementId?: string): Promise<CapabilityEntitlement[]>;
  hasCapability(presenceId: string, hubEntitlementId: string, capabilityType: CapabilityType): Promise<boolean>;
  createCapabilityEntitlement(data: { presenceId: string; hubEntitlementId: string; capabilityType: CapabilityType; billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date }): Promise<CapabilityEntitlement>;
  getPresenceEntitlementSummary(presenceId: string): Promise<{
    hubs: (HubEntitlement & { categories: (CategoryEntitlement & { micros: MicroEntitlement[] })[]; capabilities: CapabilityEntitlement[] })[];
    creditWallet: CreditWallet | null;
  }>;

  // Credit Wallet
  getCreditWallet(presenceId: string): Promise<CreditWallet | null>;
  getOrCreateCreditWallet(presenceId: string): Promise<CreditWallet>;
  getCreditBalance(presenceId: string): Promise<{ monthly: number; banked: number; total: number }>;
  grantMonthlyCredits(presenceId: string, amount: number): Promise<CreditWallet>;
  purchaseCredits(presenceId: string, amount: number, referenceId?: string): Promise<CreditWallet>;
  adminGrantCredits(presenceId: string, amount: number, note?: string): Promise<CreditWallet>;
  spendCredits(presenceId: string, amount: number, actionType: string, referenceId?: string): Promise<{ success: boolean; wallet?: CreditWallet; shortfall?: number }>;
  expireMonthlyCredits(presenceId: string): Promise<number>;
  getCreditTransactions(presenceId: string, limit?: number): Promise<CreditTransaction[]>;
  getCreditActionCost(actionType: string): Promise<number | null>;
  getAllCreditActionCosts(): Promise<CreditActionCost[]>;
  upsertCreditActionCost(actionType: string, label: string, costCredits: number, canSubstituteAddon?: string | null): Promise<CreditActionCost>;

  // Plan Versions
  getCurrentPlanVersion(): Promise<PlanVersion | null>;
  getFounderPlanVersion(): Promise<PlanVersion | null>;
  getAllPlanVersions(): Promise<PlanVersion[]>;
  upsertPlanVersion(data: { versionKey: string; label: string; presenceMonthly: number; presenceAnnual: number; hubAddonMonthly: number; hubAddonAnnual: number; categoryAddonMonthly: number; categoryAddonAnnual: number; microAddonMonthly: number; microAddonAnnual: number; monthlyCreditsIncluded: number; isCurrentOffering: boolean; isFounderPlan: boolean }): Promise<PlanVersion>;

  // Pulse Issues
  getPulseIssuesByHub(cityId: string, hubSlug: string, statusFilter?: string): Promise<PulseIssue[]>;
  getPulseIssueBySlug(cityId: string, hubSlug: string, slug: string, statusFilter?: string): Promise<PulseIssue | undefined>;
  getPulseIssueById(id: string): Promise<PulseIssue | undefined>;
  createPulseIssue(data: InsertPulseIssue): Promise<PulseIssue>;
  updatePulseIssue(id: string, data: Partial<InsertPulseIssue>): Promise<PulseIssue | undefined>;
  deletePulseIssue(id: string): Promise<void>;
  getAllPulseIssues(cityId?: string, hubSlug?: string): Promise<PulseIssue[]>;

  // Pulse Pickup Locations
  getPulsePickupLocations(cityId: string, hubSlug: string, activeOnly?: boolean): Promise<PulsePickupLocation[]>;
  getAllPulsePickupLocations(cityId?: string, hubSlug?: string): Promise<PulsePickupLocation[]>;
  createPulsePickupLocation(data: InsertPulsePickupLocation): Promise<PulsePickupLocation>;
  updatePulsePickupLocation(id: string, data: Partial<InsertPulsePickupLocation>): Promise<PulsePickupLocation | undefined>;
  deletePulsePickupLocation(id: string): Promise<void>;

  createWorkflowSession(data: InsertWorkflowSession): Promise<WorkflowSession>;
  getWorkflowSession(id: string): Promise<WorkflowSession | undefined>;
  updateWorkflowSession(id: string, data: Partial<InsertWorkflowSession>): Promise<WorkflowSession | undefined>;
  addWorkflowEvent(data: InsertWorkflowEvent): Promise<WorkflowEvent>;
  getWorkflowEvents(sessionId: string): Promise<WorkflowEvent[]>;
  getWorkflowSessionsByCity(cityId: string, filters?: { source?: string; status?: string; presenceType?: string; limit?: number; offset?: number }): Promise<{ sessions: WorkflowSession[]; total: number }>;
  findResumableWorkflowSession(cityId: string, source: string, context: { entityId?: string; contactEmail?: string; businessName?: string }): Promise<WorkflowSession | undefined>;
  findWorkflowSessionByChat(chatSessionId: string): Promise<WorkflowSession | undefined>;
  createWorkflowFollowUp(data: InsertWorkflowFollowUp): Promise<WorkflowFollowUp>;
  getWorkflowFollowUps(sessionId: string): Promise<WorkflowFollowUp[]>;
  updateWorkflowFollowUp(id: string, data: Partial<InsertWorkflowFollowUp>): Promise<WorkflowFollowUp | undefined>;
  createWorkflowActionRecommendation(data: InsertWorkflowActionRecommendation): Promise<WorkflowActionRecommendation>;
  getWorkflowActionRecommendations(sessionId: string): Promise<WorkflowActionRecommendation[]>;
  dismissWorkflowActionRecommendation(id: string): Promise<void>;

  // Automation Engine
  getAutomationRules(filters?: { cityId?: string; triggerEvent?: string; isActive?: boolean }): Promise<AutomationRule[]>;
  getAutomationRuleById(id: string): Promise<AutomationRule | undefined>;
  createAutomationRule(data: InsertAutomationRule): Promise<AutomationRule>;
  updateAutomationRule(id: string, data: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined>;
  deleteAutomationRule(id: string): Promise<void>;
  enqueueAutomationItem(data: InsertAutomationQueueItem): Promise<AutomationQueueItem>;
  getDueAutomationItems(): Promise<AutomationQueueItem[]>;
  markAutomationItemProcessed(id: string): Promise<void>;
  createAutomationLog(data: InsertAutomationLogEntry): Promise<AutomationLogEntry>;
  getAutomationLogs(filters?: { ruleId?: string; limit?: number }): Promise<AutomationLogEntry[]>;
  getAutomationQueueItems(filters?: { ruleId?: string; processed?: boolean; limit?: number }): Promise<AutomationQueueItem[]>;
  getActiveRulesForTrigger(triggerEvent: string, cityId?: string): Promise<AutomationRule[]>;

  // Story Studio
  createStoryInvitation(data: InsertStoryInvitation): Promise<StoryInvitation>;
  getStoryInvitationById(id: string): Promise<StoryInvitation | undefined>;
  getStoryInvitationByToken(token: string): Promise<StoryInvitation | undefined>;
  listStoryInvitations(): Promise<StoryInvitation[]>;
  updateStoryInvitation(id: string, data: Partial<InsertStoryInvitation>): Promise<StoryInvitation | undefined>;
  getInterviewQuestions(templateSetName?: string): Promise<InterviewQuestionTemplate[]>;
  createInterviewQuestion(data: InsertInterviewQuestion): Promise<InterviewQuestionTemplate>;
  updateInterviewQuestion(id: string, data: Partial<InsertInterviewQuestion>): Promise<InterviewQuestionTemplate | undefined>;
  deleteInterviewQuestion(id: string): Promise<void>;
  getIntakeResponses(invitationId: string): Promise<IntakeResponse[]>;
  upsertIntakeResponse(data: InsertIntakeResponse): Promise<IntakeResponse>;

  // Link Hub
  getLinkHubSettings(userId: string): Promise<LinkHubSettings | undefined>;
  upsertLinkHubSettings(data: InsertLinkHubSettings): Promise<LinkHubSettings>;
  getLinkHubLinks(userId: string): Promise<LinkHubLink[]>;
  createLinkHubLink(data: InsertLinkHubLink): Promise<LinkHubLink>;
  updateLinkHubLink(id: string, data: Partial<InsertLinkHubLink>): Promise<LinkHubLink | undefined>;
  deleteLinkHubLink(id: string): Promise<void>;
  incrementLinkHubLinkClick(id: string): Promise<void>;
  reorderLinkHubLinks(userId: string, linkIds: string[]): Promise<void>;
}

function getEventLocationScore(
  event: { zoneId: string; zip: string | null; address: string | null; city: string | null },
  location: { type: string; id: string; hubZips?: string[] }
): number {
  if (location.type === "zone" && event.zoneId === location.id) return 0;
  if (location.type === "zip" && event.zip === location.id) return 0;
  if (location.type === "hub" && location.hubZips && event.zip && location.hubZips.includes(event.zip)) return 0;
  return 1;
}

export class DatabaseStorage implements IStorage {
  // Cities
  async getCityBySlug(slug: string): Promise<City | undefined> {
    const [city] = await db.select().from(cities).where(eq(cities.slug, slug)).limit(1);
    return city;
  }

  async getCityById(id: string): Promise<City | undefined> {
    const [city] = await db.select().from(cities).where(eq(cities.id, id)).limit(1);
    return city;
  }

  async getAllCities(): Promise<City[]> {
    return db.select().from(cities).where(eq(cities.isActive, true));
  }

  async createCity(data: InsertCity): Promise<City> {
    const [city] = await db.insert(cities).values(data).returning();
    return city;
  }

  // Zones
  async getZonesByCityId(cityId: string): Promise<Zone[]> {
    return db.select().from(zones).where(and(eq(zones.cityId, cityId), eq(zones.isActive, true))).orderBy(asc(zones.name));
  }

  async getAllZones(): Promise<Zone[]> {
    return db.select().from(zones).orderBy(asc(zones.name));
  }

  async getZoneBySlug(cityId: string, slug: string): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(and(eq(zones.cityId, cityId), eq(zones.slug, slug))).limit(1);
    return zone;
  }

  async getZoneById(id: string): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.id, id)).limit(1);
    return zone;
  }

  async createZone(data: InsertZone): Promise<Zone> {
    const [zone] = await db.insert(zones).values(data).returning();
    return zone;
  }

  async updateZone(id: string, data: Partial<InsertZone>): Promise<Zone> {
    const [zone] = await db.update(zones).set({ ...data, updatedAt: new Date() }).where(eq(zones.id, id)).returning();
    return zone;
  }

  // Users
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  // Categories
  async getAllCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return cat;
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(data).returning();
    return cat;
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return cat;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [cat] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return cat;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getCategoryUsageCount(id: string): Promise<number> {
    const result = await db.select({ id: businesses.id }).from(businesses).where(
      sql`${id} = ANY(${businesses.categoryIds})`
    );
    return result.length;
  }

  // Businesses
  async getBusinessesByCityId(cityId: string, filters?: { zoneSlug?: string; hubSlug?: string; categorySlug?: string; q?: string; subcategorySlug?: string; subtypeSlug?: string; priceRange?: number; verifiedOnly?: boolean; kidsEatFree?: boolean; barterNetwork?: string; paymentMethod?: string; attribute?: string; _locationMatch?: import("./location-detection").LocationMatch | null; _topicTerms?: string }): Promise<Business[]> {
    const conditions = [eq(businesses.cityId, cityId)];

    let filterZoneId: string | null = null;
    if (filters?.zoneSlug) {
      const zone = await this.getZoneBySlug(cityId, filters.zoneSlug);
      if (zone) {
        filterZoneId = zone.id;
        conditions.push(
          sql`(${businesses.zoneId} = ${zone.id} OR ${businesses.id} IN (
            SELECT presence_id FROM presence_coverage WHERE target_id = ${zone.id}
          ))`
        );
      }
    } else if (filters?.hubSlug) {
      let resolvedHub = (await db.select().from(regions)
        .where(and(eq(regions.code, filters.hubSlug.toUpperCase()), eq(regions.regionType, "hub"))))[0];
      if (!resolvedHub) {
        resolvedHub = (await db.select().from(regions)
          .where(and(eq(regions.slug, filters.hubSlug), eq(regions.regionType, "hub"))))[0];
      }
      if (resolvedHub) {
        const coverageRows = await db.select().from(hubZipCoverage).where(eq(hubZipCoverage.hubRegionId, resolvedHub.id));
        const hubZips = coverageRows.map(r => r.zip);
        if (hubZips.length > 0) {
          conditions.push(sql`${businesses.zip} IN (${sql.join(hubZips.map(z => sql`${z}`), sql`, `)})`);
        } else {
          conditions.push(sql`1 = 0`);
        }
      } else {
        conditions.push(sql`1 = 0`);
      }
    }

    const locationDetected: import("./location-detection").LocationMatch | null = filters?._locationMatch || null;
    const searchTerm = filters?._topicTerms || filters?.q;
    if (searchTerm) {
      conditions.push(
        sql`(${ilike(businesses.name, `%${searchTerm}%`)}
          OR ${ilike(businesses.descriptionEs, `%${searchTerm}%`)}
          OR ${businesses.id} IN (
            SELECT presence_id FROM presence_services WHERE LOWER(service_name) LIKE LOWER(${`%${searchTerm}%`})
          )
          OR ${businesses.shoppingCenterId} IN (
            SELECT id FROM shopping_centers WHERE LOWER(name) LIKE LOWER(${`%${searchTerm}%`})
          )
          OR ${businesses.categoryIds} && (
            SELECT COALESCE(array_agg(c.id), '{}')
            FROM (
              SELECT id FROM categories WHERE LOWER(name) LIKE LOWER(${`%${searchTerm}%`})
              UNION
              SELECT id FROM categories WHERE parent_category_id IN (
                SELECT id FROM categories WHERE LOWER(name) LIKE LOWER(${`%${searchTerm}%`})
              )
            ) c
          )::text[])`
      );
    }

    if (locationDetected && !filters?.zoneSlug && !filters?.hubSlug) {
      if (locationDetected.type === "zone") {
        conditions.push(
          sql`(${businesses.zoneId} = ${locationDetected.id} OR ${businesses.id} IN (
            SELECT presence_id FROM presence_coverage WHERE target_id = ${locationDetected.id}
          ))`
        );
        filterZoneId = locationDetected.id;
      } else if (locationDetected.type === "hub" && locationDetected.hubZips && locationDetected.hubZips.length > 0) {
        conditions.push(sql`${businesses.zip} IN (${sql.join(locationDetected.hubZips.map(z => sql`${z}`), sql`, `)})`);
      } else if (locationDetected.type === "county") {
        const coverageRows = await db.select({ zip: hubZipCoverage.zip })
          .from(hubZipCoverage)
          .where(eq(hubZipCoverage.hubRegionId, locationDetected.id));
        const countyZips = coverageRows.map(r => r.zip);
        if (countyZips.length > 0) {
          conditions.push(sql`${businesses.zip} IN (${sql.join(countyZips.map(z => sql`${z}`), sql`, `)})`);
        }
      } else if (locationDetected.type === "zip") {
        conditions.push(eq(businesses.zip, locationDetected.id));
      }
    }

    if (filters?.subtypeSlug) {
      const subtype = await this.getCategoryBySlug(filters.subtypeSlug);
      if (subtype) conditions.push(sql`${subtype.id} = ANY(${businesses.categoryIds})`);
    } else if (filters?.subcategorySlug) {
      const subCat = await this.getCategoryBySlug(filters.subcategorySlug);
      if (subCat) {
        const l3s = await db.select().from(categories).where(eq(categories.parentCategoryId, subCat.id));
        const allIds = [subCat.id, ...l3s.map(s => s.id)];
        conditions.push(sql`${businesses.categoryIds} && ARRAY[${sql.join(allIds.map(id => sql`${id}`), sql`, `)}]::text[]`);
      }
    } else if (filters?.categorySlug) {
      const cat = await this.getCategoryBySlug(filters.categorySlug);
      if (cat) {
        const l2Cats = await db.select().from(categories).where(eq(categories.parentCategoryId, cat.id));
        const l2Ids = l2Cats.map(s => s.id);
        let l3Ids: string[] = [];
        if (l2Ids.length > 0) {
          const l3Cats = await db.select().from(categories).where(sql`${categories.parentCategoryId} IN (${sql.join(l2Ids.map(id => sql`${id}`), sql`, `)})`);
          l3Ids = l3Cats.map(s => s.id);
        }
        const allIds = [cat.id, ...l2Ids, ...l3Ids];
        conditions.push(sql`${businesses.categoryIds} && ARRAY[${sql.join(allIds.map(id => sql`${id}`), sql`, `)}]::text[]`);
      }
    }

    if (filters?.priceRange) {
      conditions.push(eq(businesses.priceRange, filters.priceRange));
    }

    if (filters?.verifiedOnly) {
      conditions.push(eq(businesses.isVerified, true));
    }

    if (filters?.kidsEatFree) {
      conditions.push(eq(businesses.kidsEatFree, true));
    }

    if (filters?.barterNetwork) {
      conditions.push(sql`COALESCE(${businesses.barterNetworks}, '{}') @> ARRAY[${filters.barterNetwork}]::text[]`);
    }

    if (filters?.paymentMethod) {
      conditions.push(sql`COALESCE(${businesses.acceptedPayments}, '{}') @> ARRAY[${filters.paymentMethod}]::text[]`);
    }

    if (filters?.attribute) {
      conditions.push(sql`COALESCE(${businesses.featureAttributes}, '{}') @> ARRAY[${filters.attribute}]::text[]`);
    }

    if (filterZoneId) {
      const rotationHour = Math.floor(Date.now() / (1000 * 60 * 60));
      return db.select().from(businesses)
        .where(and(...conditions))
        .orderBy(
          sql`CASE WHEN ${businesses.zoneId} = ${filterZoneId} THEN 0
               WHEN ${businesses.id} IN (SELECT presence_id FROM presence_coverage WHERE target_id = ${filterZoneId}) THEN 1
               ELSE 2 END`,
          sql`CASE WHEN ${businesses.zoneId} != ${filterZoneId} THEN
            (${rotationHour} + abs(hashtext(${businesses.id}::text))) % 5
          ELSE 0 END`,
          desc(businesses.priorityRank),
          desc(businesses.isFeatured),
          asc(businesses.name)
        );
    }

    return db.select().from(businesses)
      .where(and(...conditions))
      .orderBy(desc(businesses.priorityRank), desc(businesses.isFeatured), asc(businesses.name));
  }

  async getBusinessBySlug(cityId: string, slug: string): Promise<Business | undefined> {
    const [biz] = await db.select().from(businesses).where(and(eq(businesses.cityId, cityId), eq(businesses.slug, slug))).limit(1);
    return biz;
  }

  async getBusinessById(id: string): Promise<Business | undefined> {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    return biz;
  }

  async getFeaturedBusinesses(cityId: string, limit = 6): Promise<Business[]> {
    return db.select().from(businesses).where(and(eq(businesses.cityId, cityId), eq(businesses.isFeatured, true))).orderBy(desc(businesses.priorityRank)).limit(limit);
  }

  async getBusinessesByCategory(cityId: string, categoryId: string): Promise<Business[]> {
    return db.select().from(businesses).where(and(eq(businesses.cityId, cityId), sql`${categoryId} = ANY(${businesses.categoryIds})`)).orderBy(desc(businesses.priorityRank));
  }

  async createBusiness(data: InsertBusiness): Promise<Business> {
    const [biz] = await db.insert(businesses).values(data).returning();
    return biz;
  }

  async updateBusiness(id: string, data: Partial<InsertBusiness>): Promise<Business | undefined> {
    const [biz] = await db.update(businesses).set({ ...data, updatedAt: new Date() } as any).where(eq(businesses.id, id)).returning();
    return biz;
  }

  async getBusinessByClaimTokenHash(hash: string): Promise<Business | undefined> {
    const [biz] = await db.select().from(businesses).where(eq(businesses.claimTokenHash, hash)).limit(1);
    return biz;
  }

  async getAllBusinesses(cityId?: string): Promise<Business[]> {
    if (cityId) {
      return db.select().from(businesses).where(eq(businesses.cityId, cityId)).orderBy(desc(businesses.createdAt));
    }
    return db.select().from(businesses).orderBy(desc(businesses.createdAt));
  }

  // Events
  async getEventsByCityId(cityId: string, filters?: { zoneSlug?: string; weekend?: boolean; q?: string; categorySlug?: string; _locationMatch?: import("./location-detection").LocationMatch | null }): Promise<Event[]> {
    const now = new Date();
    let conditions = [
      eq(events.cityId, cityId),
      sql`COALESCE(${events.endDateTime}, ${events.startDateTime} + interval '3 hours') > ${now}`,
    ];

    if (filters?.zoneSlug) {
      const zone = await this.getZoneBySlug(cityId, filters.zoneSlug);
      if (zone) conditions.push(eq(events.zoneId, zone.id));
    }

    if (filters?.weekend) {
      const dayOfWeek = now.getDay();
      const daysToFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 0;
      const friday = new Date(now);
      friday.setDate(now.getDate() + daysToFriday);
      friday.setHours(0, 0, 0, 0);
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      sunday.setHours(23, 59, 59, 999);
      conditions.push(gte(events.startDateTime, friday));
      conditions.push(lte(events.startDateTime, sunday));
    }

    const eventLocationDetected: import("./location-detection").LocationMatch | null = filters?._locationMatch || null;
    if (filters?.q) {
      const textMatchers = [
        ilike(events.title, `%${filters.q}%`),
        ilike(events.titleEs, `%${filters.q}%`),
        ilike(events.description, `%${filters.q}%`),
        ilike(events.descriptionEs, `%${filters.q}%`),
        ilike(events.locationName, `%${filters.q}%`),
      ];
      if (eventLocationDetected) {
        textMatchers.push(
          ilike(events.address, `%${filters.q}%`),
          ilike(events.city, `%${filters.q}%`),
        );
      }
      conditions.push(or(...textMatchers)!);
    }

    if (eventLocationDetected && !filters?.zoneSlug) {
      if (eventLocationDetected.type === "zone") {
        conditions.push(eq(events.zoneId, eventLocationDetected.id));
      } else if (eventLocationDetected.type === "zip") {
        conditions.push(eq(events.zip, eventLocationDetected.id));
      } else if (eventLocationDetected.type === "hub" && eventLocationDetected.hubZips && eventLocationDetected.hubZips.length > 0) {
        conditions.push(sql`${events.zip} IN (${sql.join(eventLocationDetected.hubZips.map(z => sql`${z}`), sql`, `)})`);
      } else if (eventLocationDetected.type === "county") {
        const coverageRows = await db.select({ zip: hubZipCoverage.zip })
          .from(hubZipCoverage)
          .where(eq(hubZipCoverage.hubRegionId, eventLocationDetected.id));
        const countyZips = coverageRows.map(r => r.zip);
        if (countyZips.length > 0) {
          conditions.push(sql`${events.zip} IN (${sql.join(countyZips.map(z => sql`${z}`), sql`, `)})`);
        }
      }
    }

    if (filters?.categorySlug) {
      const cat = await this.getCategoryBySlug(filters.categorySlug);
      if (cat) conditions.push(sql`${cat.id} = ANY(${events.categoryIds})`);
    }

    conditions.push(sql`COALESCE(${events.locationName}, '') != ''`);

    const sportsSlugs = ["sports", "sports-athletics"];
    for (const sSlug of sportsSlugs) {
      const sportsCat = await this.getCategoryBySlug(sSlug);
      if (sportsCat) {
        conditions.push(sql`NOT (${sportsCat.id} = ANY(${events.categoryIds}))`);
      }
    }

    conditions.push(sql`COALESCE(${events.seedSourceType}, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')`);

    const eventResults = await db.select().from(events).where(and(...conditions)).orderBy(asc(events.startDateTime));

    if (eventLocationDetected) {
      return eventResults.sort((a, b) => {
        const aScore = getEventLocationScore(a, eventLocationDetected!);
        const bScore = getEventLocationScore(b, eventLocationDetected!);
        return aScore - bScore;
      });
    }

    return eventResults;
  }

  async getEventBySlug(cityId: string, slug: string): Promise<Event | undefined> {
    const [evt] = await db.select().from(events).where(and(eq(events.cityId, cityId), eq(events.slug, slug))).limit(1);
    return evt;
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const [evt] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return evt;
  }

  async getFeaturedEvents(cityId: string, limit = 3): Promise<Event[]> {
    const now = new Date();
    return db.select().from(events).where(and(
      eq(events.cityId, cityId),
      eq(events.isFeatured, true),
      sql`COALESCE(${events.endDateTime}, ${events.startDateTime} + interval '3 hours') > ${now}`
    )).orderBy(asc(events.startDateTime)).limit(limit);
  }

  async getEventsByCategory(cityId: string, categoryId: string): Promise<Event[]> {
    const now = new Date();
    return db.select().from(events).where(and(
      eq(events.cityId, cityId),
      sql`${categoryId} = ANY(${events.categoryIds})`,
      sql`COALESCE(${events.endDateTime}, ${events.startDateTime} + interval '3 hours') > ${now}`
    )).orderBy(asc(events.startDateTime));
  }

  async createEvent(data: InsertEvent): Promise<Event> {
    const [evt] = await db.insert(events).values(data).returning();
    return evt;
  }

  async updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event | undefined> {
    const [evt] = await db.update(events).set({ ...data, updatedAt: new Date() }).where(eq(events.id, id)).returning();
    return evt;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async getAllEvents(filters?: { q?: string; zoneId?: string; cityId?: string }): Promise<Event[]> {
    let conditions: any[] = [];
    if (filters?.cityId) conditions.push(eq(events.cityId, filters.cityId));
    if (filters?.zoneId) conditions.push(eq(events.zoneId, filters.zoneId));
    if (filters?.q) conditions.push(ilike(events.title, `%${filters.q}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(events).where(where).orderBy(desc(events.startDateTime));
  }

  // Articles
  async getArticlesByCityId(cityId: string, filters?: { q?: string; categorySlug?: string; categorySlugs?: string[]; zoneSlug?: string; _locationMatch?: import("./location-detection").LocationMatch | null }): Promise<Article[]> {
    let conditions = [eq(articles.cityId, cityId)];

    const articleLocationDetected: import("./location-detection").LocationMatch | null = filters?._locationMatch || null;
    if (filters?.q) {
      conditions.push(or(
        ilike(articles.title, `%${filters.q}%`),
        ilike(articles.titleEs, `%${filters.q}%`),
        ilike(articles.excerpt, `%${filters.q}%`),
        ilike(articles.excerptEs, `%${filters.q}%`),
      )!);
    }

    if (articleLocationDetected && !filters?.zoneSlug) {
      if (articleLocationDetected.type === "zone") {
        conditions.push(eq(articles.zoneId, articleLocationDetected.id));
      } else if (articleLocationDetected.type === "hub" && articleLocationDetected.hubZips && articleLocationDetected.hubZips.length > 0) {
        const hubZoneRows = await db.select({ id: zones.id })
          .from(zones)
          .where(and(
            eq(zones.cityId, cityId),
            eq(zones.isActive, true),
            sql`${zones.zipCodes} && ARRAY[${sql.join(articleLocationDetected.hubZips.map(z => sql`${z}`), sql`, `)}]::text[]`
          ));
        if (hubZoneRows.length > 0) {
          conditions.push(inArray(articles.zoneId, hubZoneRows.map(z => z.id)));
        }
      } else if (articleLocationDetected.type === "county") {
        const coverageRows = await db.select({ zip: hubZipCoverage.zip })
          .from(hubZipCoverage)
          .where(eq(hubZipCoverage.hubRegionId, articleLocationDetected.id));
        const countyZips = coverageRows.map(r => r.zip);
        if (countyZips.length > 0) {
          const countyZoneRows = await db.select({ id: zones.id })
            .from(zones)
            .where(and(
              eq(zones.cityId, cityId),
              eq(zones.isActive, true),
              sql`${zones.zipCodes} && ARRAY[${sql.join(countyZips.map(z => sql`${z}`), sql`, `)}]::text[]`
            ));
          if (countyZoneRows.length > 0) {
            conditions.push(inArray(articles.zoneId, countyZoneRows.map(z => z.id)));
          }
        }
      } else if (articleLocationDetected.type === "zip") {
        const zipZoneRows = await db.select({ id: zones.id })
          .from(zones)
          .where(and(
            eq(zones.cityId, cityId),
            eq(zones.isActive, true),
            sql`${articleLocationDetected.id} = ANY(${zones.zipCodes})`
          ));
        if (zipZoneRows.length > 0) {
          conditions.push(inArray(articles.zoneId, zipZoneRows.map(z => z.id)));
        }
      }
    }

    if (filters?.zoneSlug) {
      const zone = await this.getZoneBySlug(cityId, filters.zoneSlug);
      if (zone) conditions.push(eq(articles.zoneId, zone.id));
    }

    if (filters?.categorySlugs && filters.categorySlugs.length > 0) {
      const allCats = await db.select().from(categories).where(inArray(categories.slug, filters.categorySlugs));
      if (allCats.length > 0) {
        const catIds = allCats.map((c) => c.id);
        conditions.push(inArray(articles.primaryCategoryId, catIds));
      }
    } else if (filters?.categorySlug) {
      const cat = await this.getCategoryBySlug(filters.categorySlug);
      if (cat) conditions.push(eq(articles.primaryCategoryId, cat.id));
    }

    return db.select().from(articles).where(and(...conditions)).orderBy(desc(articles.publishedAt));
  }

  async getArticleBySlug(cityId: string, slug: string): Promise<Article | undefined> {
    const [art] = await db.select().from(articles).where(and(eq(articles.cityId, cityId), eq(articles.slug, slug))).limit(1);
    return art;
  }

  async getFeaturedArticles(cityId: string, limit = 3): Promise<Article[]> {
    return db.select().from(articles).where(and(eq(articles.cityId, cityId), eq(articles.isFeatured, true))).orderBy(desc(articles.publishedAt)).limit(limit);
  }

  async createArticle(data: InsertArticle): Promise<Article> {
    const [art] = await db.insert(articles).values(data).returning();
    return art;
  }

  async updateArticle(id: string, data: Partial<InsertArticle>): Promise<Article | undefined> {
    const [art] = await db.update(articles).set({ ...data, updatedAt: new Date() }).where(eq(articles.id, id)).returning();
    return art;
  }

  async deleteArticle(id: string): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  }

  async getAllArticles(): Promise<Article[]> {
    return db.select().from(articles).orderBy(desc(articles.createdAt));
  }

  // Curated Lists
  async getCuratedListsByCityId(cityId: string): Promise<CuratedList[]> {
    return db.select().from(curatedLists).where(eq(curatedLists.cityId, cityId)).orderBy(desc(curatedLists.createdAt));
  }

  async getCuratedListBySlug(cityId: string, slug: string): Promise<CuratedList | undefined> {
    const [list] = await db.select().from(curatedLists).where(and(eq(curatedLists.cityId, cityId), eq(curatedLists.slug, slug))).limit(1);
    return list;
  }

  async getCuratedListItems(listId: string): Promise<CuratedListItem[]> {
    return db.select().from(curatedListItems).where(eq(curatedListItems.curatedListId, listId)).orderBy(asc(curatedListItems.rank));
  }

  async createCuratedList(data: InsertCuratedList): Promise<CuratedList> {
    const [list] = await db.insert(curatedLists).values(data).returning();
    return list;
  }

  async getCuratedListById(id: string): Promise<CuratedList | undefined> {
    const [list] = await db.select().from(curatedLists).where(eq(curatedLists.id, id)).limit(1);
    return list;
  }

  async updateCuratedList(id: string, data: Partial<InsertCuratedList>): Promise<CuratedList | undefined> {
    const [list] = await db.update(curatedLists).set({ ...data, updatedAt: new Date() }).where(eq(curatedLists.id, id)).returning();
    return list;
  }

  async deleteCuratedList(id: string): Promise<void> {
    await db.delete(curatedListItems).where(eq(curatedListItems.curatedListId, id));
    await db.delete(curatedLists).where(eq(curatedLists.id, id));
  }

  async createCuratedListItem(data: InsertCuratedListItem): Promise<CuratedListItem> {
    const [item] = await db.insert(curatedListItems).values(data).returning();
    return item;
  }

  async updateCuratedListItem(id: string, data: Partial<InsertCuratedListItem>): Promise<CuratedListItem | undefined> {
    const [item] = await db.update(curatedListItems).set({ ...data, updatedAt: new Date() }).where(eq(curatedListItems.id, id)).returning();
    return item;
  }

  async deleteCuratedListItem(id: string): Promise<void> {
    await db.delete(curatedListItems).where(eq(curatedListItems.id, id));
  }

  async getAllCuratedLists(): Promise<CuratedList[]> {
    return db.select().from(curatedLists).orderBy(desc(curatedLists.createdAt));
  }

  // Submissions
  async createSubmission(data: InsertSubmission): Promise<Submission> {
    const [sub] = await db.insert(submissions).values(data).returning();
    return sub;
  }

  async getSubmissions(cityId?: string): Promise<Submission[]> {
    if (cityId) {
      return db.select().from(submissions).where(eq(submissions.cityId, cityId)).orderBy(desc(submissions.createdAt));
    }
    return db.select().from(submissions).orderBy(desc(submissions.createdAt));
  }

  async getSubmissionById(id: string): Promise<Submission | undefined> {
    const [sub] = await db.select().from(submissions).where(eq(submissions.id, id));
    return sub;
  }

  async updateSubmissionStatus(id: string, status: string): Promise<Submission | undefined> {
    const [sub] = await db.update(submissions).set({ status: status as any, updatedAt: new Date() }).where(eq(submissions.id, id)).returning();
    return sub;
  }

  // Leads
  async createLead(data: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(data).returning();
    return lead;
  }

  async getLeadsByCityId(cityId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.cityId, cityId)).orderBy(desc(leads.createdAt));
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead | undefined> {
    const [updated] = await db.update(leads).set({ status: status as any, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
    return updated;
  }

  async getLeadsWithBusinessNames(cityId: string): Promise<(Lead & { businessName?: string })[]> {
    const rows = await db
      .select({
        id: leads.id,
        cityId: leads.cityId,
        businessId: leads.businessId,
        zoneId: leads.zoneId,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        message: leads.message,
        budgetRange: leads.budgetRange,
        timeframe: leads.timeframe,
        status: leads.status,
        score: leads.score,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        businessName: businesses.name,
      })
      .from(leads)
      .leftJoin(businesses, eq(leads.businessId, businesses.id))
      .where(eq(leads.cityId, cityId))
      .orderBy(desc(leads.createdAt));
    return rows as any;
  }

  // Digests
  async getDigestsByCityId(cityId: string): Promise<Digest[]> {
    return db.select().from(digests).where(eq(digests.cityId, cityId)).orderBy(desc(digests.publishedAt));
  }

  async getDigestBySlug(cityId: string, slug: string): Promise<Digest | undefined> {
    const [d] = await db.select().from(digests).where(and(eq(digests.cityId, cityId), eq(digests.slug, slug))).limit(1);
    return d;
  }

  async getDigestById(id: string): Promise<Digest | undefined> {
    const [d] = await db.select().from(digests).where(eq(digests.id, id)).limit(1);
    return d;
  }

  async createDigest(data: InsertDigest): Promise<Digest> {
    const [d] = await db.insert(digests).values(data).returning();
    return d;
  }

  async updateDigest(id: string, data: Partial<InsertDigest>): Promise<Digest | undefined> {
    const [d] = await db.update(digests).set({ ...data, updatedAt: new Date() } as any).where(eq(digests.id, id)).returning();
    return d;
  }

  async getLatestDigest(cityId: string): Promise<Digest | undefined> {
    const [d] = await db.select().from(digests).where(and(eq(digests.cityId, cityId), eq(digests.digestStatus, "sent"))).orderBy(desc(digests.sentAt)).limit(1);
    return d;
  }

  // Device Saved
  async getDeviceSaved(cityId: string, deviceId: string): Promise<DeviceSaved[]> {
    return db.select().from(deviceSaved).where(and(eq(deviceSaved.cityId, cityId), eq(deviceSaved.deviceId, deviceId))).orderBy(desc(deviceSaved.createdAt));
  }

  async getSavedByUserId(cityId: string, userId: string): Promise<DeviceSaved[]> {
    return db.select().from(deviceSaved).where(and(eq(deviceSaved.cityId, cityId), eq(deviceSaved.userId, userId))).orderBy(desc(deviceSaved.createdAt));
  }

  async createDeviceSaved(data: InsertDeviceSaved): Promise<DeviceSaved> {
    const [saved] = await db.insert(deviceSaved).values(data).returning();
    return saved;
  }

  async deleteDeviceSaved(id: string): Promise<void> {
    await db.delete(deviceSaved).where(eq(deviceSaved.id, id));
  }

  // Stats
  async getAdminStats(cityId?: string) {
    const bizCount = cityId
      ? await db.select({ count: sql<number>`count(*)` }).from(businesses).where(eq(businesses.cityId, cityId))
      : await db.select({ count: sql<number>`count(*)` }).from(businesses);
    const evtCount = cityId
      ? await db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.cityId, cityId))
      : await db.select({ count: sql<number>`count(*)` }).from(events);
    const artCount = cityId
      ? await db.select({ count: sql<number>`count(*)` }).from(articles).where(eq(articles.cityId, cityId))
      : await db.select({ count: sql<number>`count(*)` }).from(articles);
    const subCount = cityId
      ? await db.select({ count: sql<number>`count(*)` }).from(submissions).where(and(eq(submissions.cityId, cityId), eq(submissions.status, "PENDING")))
      : await db.select({ count: sql<number>`count(*)` }).from(submissions).where(eq(submissions.status, "PENDING"));
    const leadCount = cityId
      ? await db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.cityId, cityId))
      : await db.select({ count: sql<number>`count(*)` }).from(leads);
    const zoneCount = cityId
      ? await db.select({ count: sql<number>`count(*)` }).from(zones).where(eq(zones.cityId, cityId))
      : await db.select({ count: sql<number>`count(*)` }).from(zones);

    return {
      businesses: Number(bizCount[0]?.count || 0),
      events: Number(evtCount[0]?.count || 0),
      articles: Number(artCount[0]?.count || 0),
      submissions: Number(subCount[0]?.count || 0),
      leads: Number(leadCount[0]?.count || 0),
      zones: Number(zoneCount[0]?.count || 0),
    };
  }

  // Entitlements
  async getEntitlementsBySubject(subjectType: string, subjectId: string): Promise<Entitlement[]> {
    return db.select().from(entitlements).where(
      and(eq(entitlements.subjectType, subjectType as any), eq(entitlements.subjectId, subjectId))
    ).orderBy(desc(entitlements.createdAt));
  }

  async getActiveEntitlements(cityId: string, subjectType: string, subjectId: string): Promise<Entitlement[]> {
    const now = new Date();
    const rows = await db.select().from(entitlements).where(
      and(
        eq(entitlements.cityId, cityId),
        eq(entitlements.subjectType, subjectType as any),
        eq(entitlements.subjectId, subjectId),
        inArray(entitlements.status, ["ACTIVE"] as any),
      )
    ).orderBy(desc(entitlements.createdAt));
    return rows.filter(r => r.endAt === null || r.endAt > now);
  }

  async upsertEntitlement(data: InsertEntitlement): Promise<Entitlement> {
    const [existing] = await db.select().from(entitlements).where(
      and(
        eq(entitlements.cityId, data.cityId),
        eq(entitlements.subjectType, data.subjectType as any),
        eq(entitlements.subjectId, data.subjectId),
        eq(entitlements.productType, data.productType as any),
      )
    ).limit(1);
    if (existing) {
      const [updated] = await db.update(entitlements)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(entitlements.id, existing.id)).returning();
      return updated;
    }
    const [ent] = await db.insert(entitlements).values(data).returning();
    return ent;
  }

  async cancelEntitlementBySubscription(stripeSubscriptionId: string): Promise<void> {
    await db.update(entitlements)
      .set({ status: "CANCELED", endAt: new Date(), updatedAt: new Date() } as any)
      .where(eq(entitlements.stripeSubscriptionId, stripeSubscriptionId));
  }

  async startGracePeriod(stripeSubscriptionId: string, graceExpiresAt: Date): Promise<void> {
    await db.update(entitlements)
      .set({
        status: "GRACE",
        graceExpiresAt,
        updatedAt: new Date(),
      } as any)
      .where(eq(entitlements.stripeSubscriptionId, stripeSubscriptionId));
  }

  async processExpiredGracePeriods(): Promise<number> {
    const now = new Date();
    const expired = await db.select().from(entitlements)
      .where(and(
        sql`${entitlements.status} = 'GRACE'`,
        sql`${entitlements.graceExpiresAt} IS NOT NULL`,
        sql`${entitlements.graceExpiresAt} < ${now}`
      ));

    for (const ent of expired) {
      await db.update(entitlements)
        .set({
          status: "EXPIRED",
          founderRateLocked: false,
          updatedAt: now,
        } as any)
        .where(eq(entitlements.id, ent.id));

      if (ent.productType === "LISTING_TIER" && ent.subjectType === "BUSINESS") {
        await this.updateBusiness(ent.subjectId, { listingTier: "VERIFIED" as any, isVerified: false });
        console.log(`[GRACE] Expired grace period for business ${ent.subjectId}, reverted to VERIFIED`);
      }
    }

    return expired.length;
  }

  // Stripe Customers
  async getStripeCustomerByEmail(email: string, cityId: string): Promise<StripeCustomer | undefined> {
    const [cust] = await db.select().from(stripeCustomers)
      .where(and(eq(stripeCustomers.email, email), eq(stripeCustomers.cityId, cityId))).limit(1);
    return cust;
  }

  async createStripeCustomer(data: InsertStripeCustomer): Promise<StripeCustomer> {
    const [cust] = await db.insert(stripeCustomers).values(data).returning();
    return cust;
  }

  // Ops Accounts
  async getOpsAccounts(cityId: string, filters?: { status?: string; tag?: string; hasBusinessId?: boolean }): Promise<OpsAccount[]> {
    let conditions: any[] = [eq(opsAccounts.cityId, cityId)];
    if (filters?.status) {
      conditions.push(eq(opsAccounts.status, filters.status as any));
    }
    if (filters?.hasBusinessId === true) {
      conditions.push(sql`${opsAccounts.businessId} IS NOT NULL`);
    } else if (filters?.hasBusinessId === false) {
      conditions.push(sql`${opsAccounts.businessId} IS NULL`);
    }
    let rows = await db.select().from(opsAccounts).where(and(...conditions)).orderBy(desc(opsAccounts.updatedAt));
    if (filters?.tag) {
      rows = rows.filter(r => r.tags.includes(filters.tag!));
    }
    return rows;
  }

  async getOpsAccountById(id: string): Promise<OpsAccount | undefined> {
    const [acc] = await db.select().from(opsAccounts).where(eq(opsAccounts.id, id)).limit(1);
    return acc;
  }

  async createOpsAccount(data: InsertOpsAccount): Promise<OpsAccount> {
    const [acc] = await db.insert(opsAccounts).values(data).returning();
    return acc;
  }

  async updateOpsAccount(id: string, data: Partial<InsertOpsAccount>): Promise<OpsAccount | undefined> {
    const [acc] = await db.update(opsAccounts).set({ ...data, updatedAt: new Date() } as any).where(eq(opsAccounts.id, id)).returning();
    return acc;
  }

  // Ops People
  async getOpsPeopleByAccount(accountId: string): Promise<OpsPerson[]> {
    return db.select().from(opsPeople).where(eq(opsPeople.accountId, accountId)).orderBy(desc(opsPeople.isPrimary), asc(opsPeople.name));
  }

  async getOpsPersonById(id: string): Promise<OpsPerson | undefined> {
    const [person] = await db.select().from(opsPeople).where(eq(opsPeople.id, id));
    return person;
  }

  async createOpsPerson(data: InsertOpsPerson): Promise<OpsPerson> {
    const [person] = await db.insert(opsPeople).values(data).returning();
    return person;
  }

  async updateOpsPerson(id: string, data: Partial<InsertOpsPerson>): Promise<OpsPerson | undefined> {
    const [person] = await db.update(opsPeople).set({ ...data, updatedAt: new Date() } as any).where(eq(opsPeople.id, id)).returning();
    return person;
  }

  async deleteOpsPerson(id: string): Promise<void> {
    await db.delete(opsPeople).where(eq(opsPeople.id, id));
  }

  // Ops Tasks
  async getOpsTasksByAccount(accountId: string): Promise<OpsTask[]> {
    return db.select().from(opsTasks).where(eq(opsTasks.accountId, accountId)).orderBy(asc(opsTasks.status), asc(opsTasks.dueAt));
  }

  async getOpsTaskById(id: string): Promise<OpsTask | undefined> {
    const [task] = await db.select().from(opsTasks).where(eq(opsTasks.id, id));
    return task;
  }

  async createOpsTask(data: InsertOpsTask): Promise<OpsTask> {
    const [task] = await db.insert(opsTasks).values(data).returning();
    return task;
  }

  async updateOpsTask(id: string, data: Partial<InsertOpsTask>): Promise<OpsTask | undefined> {
    const [task] = await db.update(opsTasks).set({ ...data, updatedAt: new Date() } as any).where(eq(opsTasks.id, id)).returning();
    return task;
  }

  // Lead Events (Attribution)
  async createLeadEvent(data: InsertLeadEvent): Promise<LeadEvent> {
    const [ev] = await db.insert(leadEvents).values(data).returning();
    return ev;
  }

  async getLeadEventSummary(businessId: string, days: number): Promise<{ eventType: string; count: number }[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ eventType: leadEvents.eventType, count: sql<number>`count(*)::int` })
      .from(leadEvents)
      .where(and(eq(leadEvents.businessId, businessId), gte(leadEvents.occurredAt, cutoff)))
      .groupBy(leadEvents.eventType);
    return rows;
  }

  async getRecentLeadEvents(limit: number, cityId?: string): Promise<(LeadEvent & { businessName?: string; cityName?: string })[]> {
    const conditions = cityId ? [eq(leadEvents.cityId, cityId)] : [];
    const rows = await db
      .select({
        id: leadEvents.id,
        cityId: leadEvents.cityId,
        businessId: leadEvents.businessId,
        eventType: leadEvents.eventType,
        occurredAt: leadEvents.occurredAt,
        pagePath: leadEvents.pagePath,
        referrerPath: leadEvents.referrerPath,
        userAgent: leadEvents.userAgent,
        ipHash: leadEvents.ipHash,
        sessionId: leadEvents.sessionId,
        businessName: businesses.name,
        cityName: cities.brandName,
      })
      .from(leadEvents)
      .leftJoin(businesses, eq(leadEvents.businessId, businesses.id))
      .leftJoin(cities, eq(leadEvents.cityId, cities.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(leadEvents.occurredAt))
      .limit(limit);
    return rows as any;
  }

  async checkLeadEventDedup(businessId: string, eventType: string, sessionId: string, windowSeconds: number): Promise<boolean> {
    const cutoff = new Date(Date.now() - windowSeconds * 1000);
    const [existing] = await db
      .select({ id: leadEvents.id })
      .from(leadEvents)
      .where(and(
        eq(leadEvents.businessId, businessId),
        eq(leadEvents.eventType, eventType),
        eq(leadEvents.sessionId, sessionId),
        gte(leadEvents.occurredAt, cutoff),
      ))
      .limit(1);
    return !!existing;
  }

  // Lead Submissions (Attribution)
  async createLeadSubmission(data: InsertLeadSubmission): Promise<LeadSubmission> {
    const [sub] = await db.insert(leadSubmissions).values(data).returning();
    return sub;
  }

  async getLeadSubmissionsByBusiness(businessId: string, limit: number): Promise<LeadSubmission[]> {
    return db
      .select()
      .from(leadSubmissions)
      .where(eq(leadSubmissions.businessId, businessId))
      .orderBy(desc(leadSubmissions.occurredAt))
      .limit(limit);
  }

  async getLeadSubmissionCount(businessId: string, days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leadSubmissions)
      .where(and(eq(leadSubmissions.businessId, businessId), gte(leadSubmissions.occurredAt, cutoff)));
    return row?.count ?? 0;
  }

  async getRecentLeadSubmissions(limit: number, cityId?: string): Promise<(LeadSubmission & { businessName?: string; cityName?: string })[]> {
    const conditions = cityId ? [eq(leadSubmissions.cityId, cityId)] : [];
    const rows = await db
      .select({
        id: leadSubmissions.id,
        cityId: leadSubmissions.cityId,
        businessId: leadSubmissions.businessId,
        name: leadSubmissions.name,
        email: leadSubmissions.email,
        phone: leadSubmissions.phone,
        message: leadSubmissions.message,
        occurredAt: leadSubmissions.occurredAt,
        source: leadSubmissions.source,
        pagePath: leadSubmissions.pagePath,
        sessionId: leadSubmissions.sessionId,
        userAgent: leadSubmissions.userAgent,
        ipHash: leadSubmissions.ipHash,
        businessName: businesses.name,
        cityName: cities.brandName,
      })
      .from(leadSubmissions)
      .leftJoin(businesses, eq(leadSubmissions.businessId, businesses.id))
      .leftJoin(cities, eq(leadSubmissions.cityId, cities.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(leadSubmissions.occurredAt))
      .limit(limit);
    return rows as any;
  }

  // Content Feeds
  async getContentFeeds(cityId: string): Promise<ContentFeed[]> {
    return db.select().from(contentFeeds).where(eq(contentFeeds.cityId, cityId)).orderBy(desc(contentFeeds.createdAt));
  }

  async getContentFeedById(id: string): Promise<ContentFeed | undefined> {
    const [feed] = await db.select().from(contentFeeds).where(eq(contentFeeds.id, id)).limit(1);
    return feed;
  }

  async getActiveContentFeeds(): Promise<ContentFeed[]> {
    return db.select().from(contentFeeds).where(eq(contentFeeds.isActive, true));
  }

  async createContentFeed(data: InsertContentFeed): Promise<ContentFeed> {
    const [feed] = await db.insert(contentFeeds).values(data).returning();
    return feed;
  }

  async updateContentFeed(id: string, data: Partial<InsertContentFeed>): Promise<ContentFeed | undefined> {
    const [feed] = await db.update(contentFeeds).set({ ...data, updatedAt: new Date() } as any).where(eq(contentFeeds.id, id)).returning();
    return feed;
  }

  async deleteContentFeed(id: string): Promise<void> {
    await db.delete(contentFeeds).where(eq(contentFeeds.id, id));
  }

  // Import Drafts
  async getImportDrafts(cityId: string, filters?: { status?: string; draftType?: string; source?: string }): Promise<ImportDraft[]> {
    const conditions: any[] = [eq(importDrafts.cityId, cityId)];
    if (filters?.status) conditions.push(eq(importDrafts.status, filters.status as any));
    if (filters?.draftType) conditions.push(eq(importDrafts.draftType, filters.draftType as any));
    if (filters?.source) conditions.push(eq(importDrafts.source, filters.source as any));
    return db.select().from(importDrafts).where(and(...conditions)).orderBy(desc(importDrafts.createdAt));
  }

  async getImportDraftById(id: string): Promise<ImportDraft | undefined> {
    const [draft] = await db.select().from(importDrafts).where(eq(importDrafts.id, id)).limit(1);
    return draft;
  }

  async createImportDraft(data: InsertImportDraft): Promise<ImportDraft> {
    const [draft] = await db.insert(importDrafts).values(data).returning();
    return draft;
  }

  async createImportDraftsBatch(data: InsertImportDraft[]): Promise<ImportDraft[]> {
    if (data.length === 0) return [];
    return db.insert(importDrafts).values(data).returning();
  }

  async updateImportDraft(id: string, data: Partial<InsertImportDraft>): Promise<ImportDraft | undefined> {
    const [draft] = await db.update(importDrafts).set({ ...data, updatedAt: new Date() } as any).where(eq(importDrafts.id, id)).returning();
    return draft;
  }

  async deleteImportDraft(id: string): Promise<void> {
    await db.delete(importDrafts).where(eq(importDrafts.id, id));
  }

  async getImportDraftCounts(cityId: string): Promise<{ status: string; count: number }[]> {
    const rows = await db
      .select({ status: importDrafts.status, count: sql<number>`count(*)::int` })
      .from(importDrafts)
      .where(eq(importDrafts.cityId, cityId))
      .groupBy(importDrafts.status);
    return rows;
  }

  // Ads
  // Authors
  async getAuthorsByCityId(cityId: string): Promise<Author[]> {
    return db.select().from(authors).where(eq(authors.cityId, cityId)).orderBy(asc(authors.name));
  }

  async getAuthorById(id: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.id, id)).limit(1);
    return author;
  }

  async getAuthorBySlug(cityId: string, slug: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(and(eq(authors.cityId, cityId), eq(authors.slug, slug))).limit(1);
    return author;
  }

  async getArticlesByAuthorId(authorId: string): Promise<Article[]> {
    return db.select().from(articles).where(and(eq(articles.authorId, authorId), isNotNull(articles.publishedAt))).orderBy(desc(articles.publishedAt));
  }

  async createAuthor(data: InsertAuthor): Promise<Author> {
    const [author] = await db.insert(authors).values(data).returning();
    return author;
  }

  async updateAuthor(id: string, data: Partial<InsertAuthor>): Promise<Author | undefined> {
    const [author] = await db.update(authors).set({ ...data, updatedAt: new Date() } as any).where(eq(authors.id, id)).returning();
    return author;
  }

  async deleteAuthor(id: string): Promise<void> {
    await db.delete(authors).where(eq(authors.id, id));
  }

  async getAdsByCity(cityId: string): Promise<Ad[]> {
    return db.select().from(ads).where(eq(ads.cityId, cityId)).orderBy(desc(ads.createdAt));
  }

  async getAdsBySlot(cityId: string, slot: string): Promise<Ad[]> {
    return db.select().from(ads).where(and(eq(ads.cityId, cityId), eq(ads.slot, slot as any)));
  }

  async getActiveAdsBySlot(cityId: string, slot: string, filters?: { tags?: string[]; page?: string }): Promise<Ad[]> {
    const now = new Date();
    const rows = await db.select().from(ads).where(
      and(
        eq(ads.cityId, cityId),
        eq(ads.slot, slot as any),
        eq(ads.isActive, true),
      )
    );
    return rows.filter(r => {
      if (r.startDate !== null && r.startDate > now) return false;
      if (r.endDate !== null && r.endDate < now) return false;

      if (filters?.page && r.targetPages && r.targetPages.length > 0) {
        if (!r.targetPages.includes(filters.page)) return false;
      }

      if (filters?.tags && filters.tags.length > 0 && r.tags && r.tags.length > 0) {
        const hasOverlap = filters.tags.some(t => r.tags!.includes(t));
        if (!hasOverlap) return false;
      }

      return true;
    });
  }

  async getAdById(id: string): Promise<Ad | undefined> {
    const [ad] = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
    return ad;
  }

  async createAd(data: InsertAd): Promise<Ad> {
    const [ad] = await db.insert(ads).values(data).returning();
    return ad;
  }

  async updateAd(id: string, data: Partial<InsertAd>): Promise<Ad | undefined> {
    const [ad] = await db.update(ads).set(data as any).where(eq(ads.id, id)).returning();
    return ad;
  }

  async deleteAd(id: string): Promise<void> {
    await db.delete(ads).where(eq(ads.id, id));
  }

  async incrementAdImpressions(id: string): Promise<void> {
    await db.update(ads).set({ impressions: sql`${ads.impressions} + 1` } as any).where(eq(ads.id, id));
  }

  async incrementAdClicks(id: string): Promise<void> {
    await db.update(ads).set({ clicks: sql`${ads.clicks} + 1` } as any).where(eq(ads.id, id));
  }

  // Business Contacts (CRM)
  async getContactsByBusinessId(businessId: string): Promise<BusinessContact[]> {
    const rows = await db
      .select({
        bc: businessContacts,
        crmName: crmContacts.name,
        crmEmail: crmContacts.email,
        crmPhone: crmContacts.phone,
      })
      .from(businessContacts)
      .leftJoin(crmContacts, eq(businessContacts.crmContactId, crmContacts.id))
      .where(eq(businessContacts.businessId, businessId))
      .orderBy(desc(businessContacts.isPrimary), asc(businessContacts.createdAt));
    return rows.map(({ bc, crmName, crmEmail, crmPhone }) => ({
      ...bc,
      name: crmName || bc.name,
      email: crmEmail || bc.email,
      phone: crmPhone || bc.phone,
    }));
  }

  async getContactById(id: string): Promise<BusinessContact | undefined> {
    const rows = await db
      .select({
        bc: businessContacts,
        crmName: crmContacts.name,
        crmEmail: crmContacts.email,
        crmPhone: crmContacts.phone,
      })
      .from(businessContacts)
      .leftJoin(crmContacts, eq(businessContacts.crmContactId, crmContacts.id))
      .where(eq(businessContacts.id, id))
      .limit(1);
    if (!rows.length) return undefined;
    const { bc, crmName, crmEmail, crmPhone } = rows[0];
    return {
      ...bc,
      name: crmName || bc.name,
      email: crmEmail || bc.email,
      phone: crmPhone || bc.phone,
    };
  }

  async createContact(data: InsertBusinessContact): Promise<BusinessContact> {
    const [contact] = await db.insert(businessContacts).values(data).returning();
    return contact;
  }

  async updateContact(id: string, data: Partial<InsertBusinessContact>): Promise<BusinessContact | undefined> {
    const [contact] = await db.update(businessContacts).set({ ...data, updatedAt: new Date() } as any).where(eq(businessContacts.id, id)).returning();
    return contact;
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(businessContacts).where(eq(businessContacts.id, id));
  }

  // Communication Log (CRM)
  async getCommLogByBusinessId(businessId: string): Promise<(CommunicationLogEntry & { crmContactName?: string | null; crmContactEmail?: string | null })[]> {
    const rows = await db
      .select({
        cl: communicationLog,
        crmContactName: crmContacts.name,
        crmContactEmail: crmContacts.email,
      })
      .from(communicationLog)
      .leftJoin(crmContacts, eq(communicationLog.crmContactId, crmContacts.id))
      .where(eq(communicationLog.businessId, businessId))
      .orderBy(desc(communicationLog.createdAt));
    return rows.map(({ cl, crmContactName, crmContactEmail }) => ({
      ...cl,
      crmContactName,
      crmContactEmail,
    }));
  }

  async createCommLogEntry(data: InsertCommunicationLog): Promise<CommunicationLogEntry> {
    if (!data.crmContactId && data.contactId) {
      const [bc] = await db.select({ crmContactId: businessContacts.crmContactId })
        .from(businessContacts)
        .where(eq(businessContacts.id, data.contactId))
        .limit(1);
      if (bc?.crmContactId) {
        data = { ...data, crmContactId: bc.crmContactId };
      }
    }
    const [entry] = await db.insert(communicationLog).values(data).returning();
    return entry;
  }

  async deleteCommLogEntry(id: string): Promise<void> {
    await db.delete(communicationLog).where(eq(communicationLog.id, id));
  }

  // Listing Tier Features
  async getListingTierFeatures(): Promise<ListingTierFeature[]> {
    return db.select().from(listingTierFeatures).orderBy(asc(listingTierFeatures.sortOrder));
  }

  async updateListingTierFeature(id: string, data: Partial<InsertListingTierFeature>): Promise<ListingTierFeature> {
    const [feature] = await db.update(listingTierFeatures).set({ ...data, updatedAt: new Date() } as any).where(eq(listingTierFeatures.id, id)).returning();
    return feature;
  }

  // Public Users
  async getPublicUserByEmail(email: string): Promise<PublicUser | undefined> {
    const [user] = await db.select().from(publicUsers).where(eq(publicUsers.email, email)).limit(1);
    return user;
  }

  async getPublicUserById(id: string): Promise<PublicUser | undefined> {
    const [user] = await db.select().from(publicUsers).where(eq(publicUsers.id, id)).limit(1);
    return user;
  }

  async createPublicUser(data: InsertPublicUser): Promise<PublicUser> {
    const [user] = await db.insert(publicUsers).values(data).returning();
    return user;
  }

  async updatePublicUser(id: string, data: Partial<InsertPublicUser>): Promise<PublicUser | undefined> {
    const [user] = await db.update(publicUsers).set({ ...data, updatedAt: new Date() }).where(eq(publicUsers.id, id)).returning();
    return user;
  }

  async getAllPublicUsers(filters?: { accountType?: string; q?: string }): Promise<PublicUser[]> {
    const conditions: any[] = [];
    if (filters?.accountType) conditions.push(eq(publicUsers.accountType, filters.accountType as any));
    if (filters?.q) conditions.push(or(ilike(publicUsers.displayName, `%${filters.q}%`), ilike(publicUsers.email, `%${filters.q}%`)));
    return db.select().from(publicUsers).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(publicUsers.createdAt));
  }

  async getBusinessesClaimedByUser(userId: string): Promise<Business[]> {
    return db.select().from(businesses).where(eq(businesses.claimedByUserId, userId));
  }

  // User Hubs
  async getUserHubs(userId: string): Promise<UserHub[]> {
    return db.select().from(userHubs).where(eq(userHubs.userId, userId));
  }

  async getUserHubByType(userId: string, hubType: string): Promise<UserHub | undefined> {
    const [hub] = await db.select().from(userHubs).where(and(eq(userHubs.userId, userId), eq(userHubs.hubType, hubType as any))).limit(1);
    return hub;
  }

  async createUserHub(data: InsertUserHub): Promise<UserHub> {
    const [hub] = await db.insert(userHubs).values(data).returning();
    return hub;
  }

  async updateUserHub(id: string, data: Partial<InsertUserHub>): Promise<UserHub | undefined> {
    const [hub] = await db.update(userHubs).set({ ...data, updatedAt: new Date() }).where(eq(userHubs.id, id)).returning();
    return hub;
  }

  async deleteUserHub(id: string): Promise<void> {
    await db.delete(userHubs).where(eq(userHubs.id, id));
  }

  // Reviews
  async getReviewsByBusinessId(businessId: string, status?: string): Promise<(Review & { displayName: string })[]> {
    const conditions: any[] = [eq(reviews.businessId, businessId)];
    if (status) conditions.push(eq(reviews.status, status as any));
    const rows = await db
      .select({
        id: reviews.id,
        businessId: reviews.businessId,
        userId: reviews.userId,
        neighborhoodId: reviews.neighborhoodId,
        categoryL2Id: reviews.categoryL2Id,
        rating: reviews.rating,
        comment: reviews.comment,
        reviewerContact: reviews.reviewerContact,
        status: reviews.status,
        sourceType: reviews.sourceType,
        sourceUrl: reviews.sourceUrl,
        ownerResponse: reviews.ownerResponse,
        ownerRespondedAt: reviews.ownerRespondedAt,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        displayName: publicUsers.displayName,
      })
      .from(reviews)
      .leftJoin(publicUsers, eq(reviews.userId, publicUsers.id))
      .where(and(...conditions))
      .orderBy(desc(reviews.createdAt));
    return rows.map(r => ({ ...r, displayName: r.displayName || "Anonymous" }));
  }

  async getReviewById(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    return review;
  }

  async createReview(data: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(data).returning();
    return review;
  }

  async updateReview(id: string, data: Partial<InsertReview>): Promise<Review | undefined> {
    const [review] = await db.update(reviews).set({ ...data, updatedAt: new Date() } as any).where(eq(reviews.id, id)).returning();
    return review;
  }

  async getAllReviews(status?: string): Promise<(Review & { displayName: string; businessName: string })[]> {
    const conditions: any[] = [];
    if (status) conditions.push(eq(reviews.status, status as any));
    const rows = await db
      .select({
        id: reviews.id,
        businessId: reviews.businessId,
        userId: reviews.userId,
        neighborhoodId: reviews.neighborhoodId,
        categoryL2Id: reviews.categoryL2Id,
        rating: reviews.rating,
        comment: reviews.comment,
        reviewerContact: reviews.reviewerContact,
        status: reviews.status,
        sourceType: reviews.sourceType,
        sourceUrl: reviews.sourceUrl,
        ownerResponse: reviews.ownerResponse,
        ownerRespondedAt: reviews.ownerRespondedAt,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        displayName: publicUsers.displayName,
        businessName: businesses.name,
      })
      .from(reviews)
      .leftJoin(publicUsers, eq(reviews.userId, publicUsers.id))
      .leftJoin(businesses, eq(reviews.businessId, businesses.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(reviews.createdAt));
    return rows.map(r => ({ ...r, displayName: r.displayName || "Anonymous", businessName: r.businessName || "Unknown" }));
  }

  async getReviewStats(businessId: string): Promise<{ avgRating: number; count: number }> {
    const [row] = await db
      .select({
        avgRating: sql<number>`COALESCE(AVG(${reviews.rating})::numeric(3,2), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(and(eq(reviews.businessId, businessId), eq(reviews.status, "APPROVED")));
    return { avgRating: Number(row?.avgRating || 0), count: Number(row?.count || 0) };
  }

  async getAttractionsByCityId(cityId: string, filters?: { type?: string; zoneSlug?: string }): Promise<Attraction[]> {
    const conditions = [eq(attractions.cityId, cityId)];
    if (filters?.type) {
      conditions.push(eq(attractions.attractionType, filters.type as any));
    }
    if (filters?.zoneSlug) {
      const zone = await this.getZoneBySlug(cityId, filters.zoneSlug);
      if (zone) conditions.push(eq(attractions.zoneId, zone.id));
    }
    return db.select().from(attractions).where(and(...conditions)).orderBy(desc(attractions.isFeatured), asc(attractions.name));
  }

  async getAttractionBySlug(cityId: string, slug: string): Promise<Attraction | undefined> {
    const [a] = await db.select().from(attractions).where(and(eq(attractions.cityId, cityId), eq(attractions.slug, slug))).limit(1);
    return a;
  }

  async getRandomFunFacts(cityId: string, limit = 3): Promise<Attraction[]> {
    return db.select().from(attractions)
      .where(and(eq(attractions.cityId, cityId), sql`${attractions.funFact} IS NOT NULL AND ${attractions.funFact} != ''`))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  }

  async createAttraction(data: InsertAttraction): Promise<Attraction> {
    const [a] = await db.insert(attractions).values(data).returning();
    return a;
  }

  async updateAttraction(id: string, data: Partial<InsertAttraction>): Promise<Attraction | undefined> {
    const [a] = await db.update(attractions).set({ ...data, updatedAt: new Date() }).where(eq(attractions.id, id)).returning();
    return a;
  }

  async deleteAttraction(id: string): Promise<void> {
    await db.delete(attractions).where(eq(attractions.id, id));
  }

  async getAllAttractions(): Promise<Attraction[]> {
    return db.select().from(attractions).orderBy(asc(attractions.name));
  }

  // Presence Revisions
  async createPresenceRevision(data: InsertPresenceRevision): Promise<PresenceRevision> {
    const [rev] = await db.insert(presenceRevisions).values(data).returning();
    return rev;
  }

  async getPresenceRevisions(businessId: string, limit = 50): Promise<PresenceRevision[]> {
    return db.select().from(presenceRevisions)
      .where(eq(presenceRevisions.businessId, businessId))
      .orderBy(desc(presenceRevisions.createdAt))
      .limit(limit);
  }

  async getLatestRevisionNumber(businessId: string): Promise<number> {
    const [row] = await db
      .select({ maxRev: sql<number>`COALESCE(MAX(${presenceRevisions.revisionNumber}), 0)` })
      .from(presenceRevisions)
      .where(eq(presenceRevisions.businessId, businessId));
    return Number(row?.maxRev || 0);
  }

  // Presence Users
  async getPresenceUsersByBusiness(businessId: string): Promise<(PresenceUser & { displayName: string; email: string })[]> {
    const rows = await db
      .select({
        id: presenceUsers.id,
        businessId: presenceUsers.businessId,
        userId: presenceUsers.userId,
        role: presenceUsers.role,
        status: presenceUsers.status,
        permissions: presenceUsers.permissions,
        invitedByUserId: presenceUsers.invitedByUserId,
        ownerName: presenceUsers.ownerName,
        ownerEmail: presenceUsers.ownerEmail,
        approvedAt: presenceUsers.approvedAt,
        createdAt: presenceUsers.createdAt,
        updatedAt: presenceUsers.updatedAt,
        displayName: sql<string>`COALESCE(${publicUsers.displayName}, 'Unknown')`,
        email: sql<string>`COALESCE(${publicUsers.email}, '')`,
      })
      .from(presenceUsers)
      .leftJoin(publicUsers, eq(presenceUsers.userId, publicUsers.id))
      .where(eq(presenceUsers.businessId, businessId))
      .orderBy(asc(presenceUsers.role), asc(presenceUsers.createdAt));
    return rows as any;
  }

  async getPresenceUserByBusinessAndUser(businessId: string, userId: string): Promise<PresenceUser | undefined> {
    const [row] = await db.select().from(presenceUsers)
      .where(and(eq(presenceUsers.businessId, businessId), eq(presenceUsers.userId, userId)))
      .limit(1);
    return row;
  }

  async getPresenceOwner(businessId: string): Promise<PresenceUser | undefined> {
    const [row] = await db.select().from(presenceUsers)
      .where(and(eq(presenceUsers.businessId, businessId), eq(presenceUsers.role, "OWNER"), eq(presenceUsers.status, "ACTIVE")))
      .limit(1);
    return row;
  }

  async getPresencesByUser(userId: string): Promise<(PresenceUser & { businessName: string; businessSlug: string; citySlug: string })[]> {
    const rows = await db
      .select({
        id: presenceUsers.id,
        businessId: presenceUsers.businessId,
        userId: presenceUsers.userId,
        role: presenceUsers.role,
        status: presenceUsers.status,
        permissions: presenceUsers.permissions,
        invitedByUserId: presenceUsers.invitedByUserId,
        ownerName: presenceUsers.ownerName,
        ownerEmail: presenceUsers.ownerEmail,
        approvedAt: presenceUsers.approvedAt,
        createdAt: presenceUsers.createdAt,
        updatedAt: presenceUsers.updatedAt,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        citySlug: sql<string>`(SELECT slug FROM cities WHERE id = ${businesses.cityId})`,
      })
      .from(presenceUsers)
      .innerJoin(businesses, eq(presenceUsers.businessId, businesses.id))
      .where(eq(presenceUsers.userId, userId))
      .orderBy(desc(presenceUsers.createdAt));
    return rows as any;
  }

  async createPresenceUser(data: InsertPresenceUser): Promise<PresenceUser> {
    const [row] = await db.insert(presenceUsers).values(data).returning();
    return row;
  }

  async updatePresenceUser(id: string, data: Partial<InsertPresenceUser>): Promise<PresenceUser | undefined> {
    const [row] = await db.update(presenceUsers).set({ ...data, updatedAt: new Date() }).where(eq(presenceUsers.id, id)).returning();
    return row;
  }

  async deletePresenceUser(id: string): Promise<void> {
    await db.delete(presenceUsers).where(eq(presenceUsers.id, id));
  }

  // Ownership Transfer Requests
  async createOwnershipTransferRequest(data: InsertOwnershipTransferRequest): Promise<OwnershipTransferRequest> {
    const [row] = await db.insert(ownershipTransferRequests).values(data).returning();
    return row;
  }

  async getOwnershipTransferRequests(filters?: { status?: string; businessId?: string }): Promise<(OwnershipTransferRequest & { businessName: string; requestedByName: string })[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(ownershipTransferRequests.status, filters.status as any));
    if (filters?.businessId) conditions.push(eq(ownershipTransferRequests.businessId, filters.businessId));
    const rows = await db
      .select({
        id: ownershipTransferRequests.id,
        businessId: ownershipTransferRequests.businessId,
        requestedByUserId: ownershipTransferRequests.requestedByUserId,
        newOwnerName: ownershipTransferRequests.newOwnerName,
        newOwnerEmail: ownershipTransferRequests.newOwnerEmail,
        reason: ownershipTransferRequests.reason,
        status: ownershipTransferRequests.status,
        reviewedByAdminId: ownershipTransferRequests.reviewedByAdminId,
        reviewedAt: ownershipTransferRequests.reviewedAt,
        adminNotes: ownershipTransferRequests.adminNotes,
        invitationToken: ownershipTransferRequests.invitationToken,
        invitationExpiresAt: ownershipTransferRequests.invitationExpiresAt,
        acceptedByUserId: ownershipTransferRequests.acceptedByUserId,
        acceptedAt: ownershipTransferRequests.acceptedAt,
        createdAt: ownershipTransferRequests.createdAt,
        updatedAt: ownershipTransferRequests.updatedAt,
        businessName: sql<string>`(SELECT name FROM businesses WHERE id = ${ownershipTransferRequests.businessId})`,
        requestedByName: sql<string>`(SELECT display_name FROM public_users WHERE id = ${ownershipTransferRequests.requestedByUserId})`,
      })
      .from(ownershipTransferRequests)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(ownershipTransferRequests.createdAt));
    return rows as any;
  }

  async getOwnershipTransferRequestById(id: string): Promise<OwnershipTransferRequest | undefined> {
    const [row] = await db.select().from(ownershipTransferRequests).where(eq(ownershipTransferRequests.id, id)).limit(1);
    return row;
  }

  async updateOwnershipTransferRequest(id: string, data: Partial<InsertOwnershipTransferRequest>): Promise<OwnershipTransferRequest | undefined> {
    const [row] = await db.update(ownershipTransferRequests).set({ ...data, updatedAt: new Date() }).where(eq(ownershipTransferRequests.id, id)).returning();
    return row;
  }

  // External Links (Presence Microsite)
  async getExternalLinksByBusinessId(businessId: string): Promise<PresenceExternalLink[]> {
    return db.select().from(presenceExternalLinks)
      .where(eq(presenceExternalLinks.businessId, businessId))
      .orderBy(desc(presenceExternalLinks.createdAt));
  }

  async createExternalLink(data: InsertPresenceExternalLink): Promise<PresenceExternalLink> {
    const [link] = await db.insert(presenceExternalLinks).values(data).returning();
    return link;
  }

  async updateExternalLinkStatus(id: string, status: string, adminId?: string): Promise<void> {
    await db.update(presenceExternalLinks).set({
      approvalStatus: status,
      approvedByAdminId: adminId || null,
      approvedAt: status === "APPROVED" ? new Date() : null,
    } as any).where(eq(presenceExternalLinks.id, id));
  }

  // Content Links (Presence Microsite)
  async getContentLinksByBusinessId(businessId: string): Promise<PresenceContentLink[]> {
    return db.select().from(presenceContentLinks)
      .where(eq(presenceContentLinks.businessId, businessId))
      .orderBy(desc(presenceContentLinks.createdAt));
  }

  async createContentLink(data: InsertPresenceContentLink): Promise<PresenceContentLink> {
    const [link] = await db.insert(presenceContentLinks).values(data).returning();
    return link;
  }

  async deleteContentLink(id: string): Promise<void> {
    await db.delete(presenceContentLinks).where(eq(presenceContentLinks.id, id));
  }

  // Microsite Data (aggregate)
  async getMicrositeData(businessId: string, cityId: string): Promise<{
    externalLinks: PresenceExternalLink[];
    contentLinks: PresenceContentLink[];
    events: any[];
    reviews: any[];
    services: PresenceService[];
    shoppingCenter: ShoppingCenter | null;
    contentJournal: ContentAttachment[];
    domain: PresenceDomain | undefined;
    coverage: PresenceCoverage[];
  }> {
    const business = await this.getBusinessById(businessId);
    const businessName = business?.name || "";
    const [externalLinks, contentLinks, bizEvents, bizReviews, services, contentJournal, domain, coverage] = await Promise.all([
      this.getExternalLinksByBusinessId(businessId),
      this.getContentLinksByBusinessId(businessId),
      (async () => {
        const conditions = [eq(events.cityId, cityId)];
        const matchConditions: any[] = [];
        if (businessName) matchConditions.push(ilike(events.locationName, `%${businessName}%`));
        matchConditions.push(eq(events.hostBusinessId, businessId));
        conditions.push(or(...matchConditions)!);
        return db.select().from(events).where(and(...conditions)).orderBy(asc(events.startDateTime)).limit(20).catch(() => [] as any[]);
      })(),
      this.getReviewsByBusinessId(businessId, "APPROVED"),
      this.getPresenceServices(businessId),
      this.getContentAttachments(businessId, "APPROVED"),
      this.getPresenceDomain(businessId),
      this.getPresenceCoverage(businessId),
    ]);
    let shoppingCenter: ShoppingCenter | null = null;
    if (business?.shoppingCenterId) {
      shoppingCenter = (await this.getShoppingCenterById(business.shoppingCenterId)) || null;
    }
    return { externalLinks, contentLinks, events: bizEvents, reviews: bizReviews, services, shoppingCenter, contentJournal, domain, coverage };
  }

  // Fuzzy search for presence confirmation
  async searchBusinessesFuzzy(name: string, city: string, websiteOrSocial?: string): Promise<Business[]> {
    const conditions: any[] = [];
    const nameWords = name.trim().split(/\s+/).filter(w => w.length > 2);
    if (nameWords.length > 0) {
      const nameConditions = nameWords.map(word => ilike(businesses.name, `%${word}%`));
      conditions.push(or(...nameConditions));
    } else {
      conditions.push(ilike(businesses.name, `%${name.trim()}%`));
    }
    if (city.trim()) {
      conditions.push(ilike(businesses.city, `%${city.trim()}%`));
    }
    conditions.push(sql`${businesses.presenceStatus} IN ('ACTIVE', 'DRAFT', 'PENDING')`);
    conditions.push(sql`(${businesses.presenceStatus2} IS NULL OR ${businesses.presenceStatus2} IN ('ACTIVE', 'DRAFT', 'PENDING'))`);
    
    let results = await db.select().from(businesses)
      .where(and(...conditions))
      .orderBy(asc(businesses.name))
      .limit(5);
    
    if (websiteOrSocial && results.length > 1) {
      const urlLower = websiteOrSocial.toLowerCase();
      const urlMatch = results.find(b => 
        b.websiteUrl?.toLowerCase().includes(urlLower) ||
        urlLower.includes(b.websiteUrl?.toLowerCase() || "___none___")
      );
      if (urlMatch) return [urlMatch];
    }
    
    return results;
  }

  // Shopping Centers
  async getShoppingCenters(cityId?: string): Promise<ShoppingCenter[]> {
    if (cityId) {
      return db.select().from(shoppingCenters).where(eq(shoppingCenters.cityId, cityId)).orderBy(asc(shoppingCenters.name));
    }
    return db.select().from(shoppingCenters).orderBy(asc(shoppingCenters.name));
  }

  async getShoppingCenterById(id: string): Promise<ShoppingCenter | undefined> {
    const [sc] = await db.select().from(shoppingCenters).where(eq(shoppingCenters.id, id));
    return sc;
  }

  async getShoppingCenterBySlug(slug: string): Promise<ShoppingCenter | undefined> {
    const [sc] = await db.select().from(shoppingCenters).where(eq(shoppingCenters.slug, slug));
    return sc;
  }

  async createShoppingCenter(data: InsertShoppingCenter): Promise<ShoppingCenter> {
    const [sc] = await db.insert(shoppingCenters).values(data).returning();
    return sc;
  }

  async searchShoppingCenters(query: string, cityId?: string): Promise<ShoppingCenter[]> {
    const nameMatch = or(
      ilike(shoppingCenters.name, `%${query}%`),
      ilike(shoppingCenters.alsoKnownAs, `%${query}%`),
      ilike(shoppingCenters.residentialName, `%${query}%`)
    );
    const conditions: any[] = [nameMatch];
    if (cityId) conditions.push(eq(shoppingCenters.cityId, cityId));
    return db.select().from(shoppingCenters).where(and(...conditions)).orderBy(asc(shoppingCenters.name)).limit(20);
  }

  async getBusinessesByShoppingCenter(shoppingCenterId: string): Promise<Business[]> {
    return db.select().from(businesses)
      .where(and(eq(businesses.shoppingCenterId, shoppingCenterId), sql`${businesses.presenceStatus} = 'ACTIVE'`))
      .orderBy(asc(businesses.name));
  }

  // Presence Services (micro-services)
  async getPresenceServices(presenceId: string): Promise<PresenceService[]> {
    return db.select().from(presenceServices)
      .where(eq(presenceServices.presenceId, presenceId))
      .orderBy(desc(presenceServices.isPrimary), asc(presenceServices.sortOrder));
  }

  async setPresenceServices(presenceId: string, services: { serviceName: string; isPrimary: boolean; parentServiceId?: string | null; sortOrder: number }[]): Promise<PresenceService[]> {
    await db.delete(presenceServices).where(eq(presenceServices.presenceId, presenceId));
    if (services.length === 0) return [];
    const rows = services.map(s => ({
      presenceId,
      serviceName: s.serviceName,
      isPrimary: s.isPrimary,
      parentServiceId: s.parentServiceId || null,
      sortOrder: s.sortOrder,
    }));
    return db.insert(presenceServices).values(rows).returning();
  }

  // Presence Coverage
  async getPresenceCoverage(presenceId: string): Promise<PresenceCoverage[]> {
    return db.select().from(presenceCoverage)
      .where(eq(presenceCoverage.presenceId, presenceId))
      .orderBy(asc(presenceCoverage.coverageType));
  }

  async addPresenceCoverage(data: InsertPresenceCoverage): Promise<PresenceCoverage> {
    const [row] = await db.insert(presenceCoverage).values(data).returning();
    return row;
  }

  async removePresenceCoverage(id: string): Promise<void> {
    await db.delete(presenceCoverage).where(eq(presenceCoverage.id, id));
  }

  async getPresencesWithCoverage(targetId: string, coverageType: string): Promise<string[]> {
    const rows = await db.select({ presenceId: presenceCoverage.presenceId })
      .from(presenceCoverage)
      .where(and(eq(presenceCoverage.targetId, targetId), sql`${presenceCoverage.coverageType} = ${coverageType}`));
    return rows.map(r => r.presenceId);
  }

  // Enterprise Review Requests
  async createEnterpriseReview(data: InsertEnterpriseReviewRequest): Promise<EnterpriseReviewRequest> {
    const [row] = await db.insert(enterpriseReviewRequests).values(data).returning();
    return row;
  }

  async getEnterpriseReviews(filters?: { status?: string; cityId?: string }): Promise<EnterpriseReviewRequest[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(sql`${enterpriseReviewRequests.status} = ${filters.status}`);
    if (filters?.cityId) conditions.push(eq(enterpriseReviewRequests.cityId, filters.cityId));
    return db.select().from(enterpriseReviewRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(enterpriseReviewRequests.createdAt));
  }

  async getEnterpriseReviewById(id: string): Promise<EnterpriseReviewRequest | undefined> {
    const [row] = await db.select().from(enterpriseReviewRequests).where(eq(enterpriseReviewRequests.id, id));
    return row;
  }

  async updateEnterpriseReview(id: string, data: Partial<EnterpriseReviewRequest>): Promise<EnterpriseReviewRequest | undefined> {
    const [row] = await db.update(enterpriseReviewRequests).set(data).where(eq(enterpriseReviewRequests.id, id)).returning();
    return row;
  }

  async countPresencesByOwner(userId: string): Promise<number> {
    const rows = await db.select({ id: presenceUsers.id })
      .from(presenceUsers)
      .where(and(eq(presenceUsers.userId, userId), sql`${presenceUsers.role} = 'OWNER'`, sql`${presenceUsers.status} = 'ACTIVE'`));
    return rows.length;
  }

  // Content Attachments
  async getContentAttachments(presenceId: string, status?: string): Promise<ContentAttachment[]> {
    const conditions: any[] = [eq(contentAttachments.presenceId, presenceId)];
    if (status) conditions.push(sql`${contentAttachments.approvalStatus} = ${status}`);
    return db.select().from(contentAttachments)
      .where(and(...conditions))
      .orderBy(desc(contentAttachments.createdAt));
  }

  async createContentAttachment(data: InsertContentAttachment): Promise<ContentAttachment> {
    const [row] = await db.insert(contentAttachments).values(data).returning();
    return row;
  }

  async updateContentAttachment(id: string, data: Partial<ContentAttachment>): Promise<ContentAttachment | undefined> {
    const [row] = await db.update(contentAttachments).set(data).where(eq(contentAttachments.id, id)).returning();
    return row;
  }

  async getAllContentAttachments(filters?: { status?: string; batchTag?: string }): Promise<(ContentAttachment & { presenceName: string })[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(sql`${contentAttachments.approvalStatus} = ${filters.status}`);
    if (filters?.batchTag) conditions.push(eq(contentAttachments.batchTag, filters.batchTag));
    const rows = await db.select({
      id: contentAttachments.id,
      presenceId: contentAttachments.presenceId,
      contentType: contentAttachments.contentType,
      contentId: contentAttachments.contentId,
      title: contentAttachments.title,
      snippet: contentAttachments.snippet,
      externalUrl: contentAttachments.externalUrl,
      sourceLabel: contentAttachments.sourceLabel,
      hubLabel: contentAttachments.hubLabel,
      nicheLabel: contentAttachments.nicheLabel,
      batchTag: contentAttachments.batchTag,
      approvalStatus: contentAttachments.approvalStatus,
      approvedBy: contentAttachments.approvedBy,
      approvedAt: contentAttachments.approvedAt,
      publishedAt: contentAttachments.publishedAt,
      createdAt: contentAttachments.createdAt,
      presenceName: businesses.name,
    })
      .from(contentAttachments)
      .leftJoin(businesses, eq(contentAttachments.presenceId, businesses.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contentAttachments.createdAt));
    return rows as any;
  }

  // Presence Domains
  async getPresenceDomain(presenceId: string): Promise<PresenceDomain | undefined> {
    const [row] = await db.select().from(presenceDomains).where(eq(presenceDomains.presenceId, presenceId));
    return row;
  }

  async getPresenceDomainByDomain(domain: string): Promise<PresenceDomain | undefined> {
    const [row] = await db.select().from(presenceDomains).where(eq(presenceDomains.domain, domain));
    return row;
  }

  async upsertPresenceDomain(data: InsertPresenceDomain): Promise<PresenceDomain> {
    const existing = await this.getPresenceDomain(data.presenceId);
    if (existing) {
      const [row] = await db.update(presenceDomains).set({ ...data, updatedAt: new Date() }).where(eq(presenceDomains.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(presenceDomains).values(data).returning();
    return row;
  }

  async updatePresenceDomain(id: string, data: Partial<PresenceDomain>): Promise<PresenceDomain | undefined> {
    const [row] = await db.update(presenceDomains).set({ ...data, updatedAt: new Date() }).where(eq(presenceDomains.id, id)).returning();
    return row;
  }

  async deletePresenceDomain(id: string): Promise<void> {
    await db.delete(presenceDomains).where(eq(presenceDomains.id, id));
  }

  // Founder Batches
  async getFounderBatches(cityId: string): Promise<FounderBatch[]> {
    return db.select().from(founderBatches)
      .where(eq(founderBatches.cityId, cityId))
      .orderBy(desc(founderBatches.createdAt));
  }

  async createFounderBatch(data: InsertFounderBatch): Promise<FounderBatch> {
    const [row] = await db.insert(founderBatches).values(data).returning();
    return row;
  }

  async updateFounderBatch(id: string, data: Partial<FounderBatch>): Promise<FounderBatch | undefined> {
    const [row] = await db.update(founderBatches).set(data).where(eq(founderBatches.id, id)).returning();
    return row;
  }

  async publishFounderBatch(batchId: string): Promise<{ batch: FounderBatch; publishedCount: number }> {
    const [batch] = await db.select().from(founderBatches).where(eq(founderBatches.id, batchId));
    if (!batch) throw new Error("Batch not found");
    if (batch.isPublished) throw new Error("Batch already published");

    const now = new Date();

    return await db.transaction(async (tx) => {
      const result = await tx.update(contentAttachments)
        .set({ publishedAt: now, approvalStatus: "APPROVED" as any })
        .where(and(
          eq(contentAttachments.batchTag, batch.batchTag),
          sql`${contentAttachments.approvalStatus} != 'REJECTED'`
        ))
        .returning();

      const [updatedBatch] = await tx.update(founderBatches)
        .set({ isPublished: true, publishDate: now })
        .where(eq(founderBatches.id, batchId))
        .returning();

      return { batch: updatedBatch, publishedCount: result.length };
    });
  }

  // Entitlement extensions (grace/founder)
  async getEntitlementWithGrace(subjectId: string): Promise<Entitlement | undefined> {
    const [row] = await db.select().from(entitlements)
      .where(and(eq(entitlements.subjectId, subjectId), sql`${entitlements.productType} = 'LISTING_TIER'`))
      .orderBy(desc(entitlements.createdAt))
      .limit(1);
    return row;
  }

  async updateEntitlementGrace(id: string, graceExpiresAt: Date | null, founderRateLocked: boolean, founderPrice: number | null): Promise<void> {
    await db.update(entitlements).set({
      graceExpiresAt,
      founderRateLocked,
      founderPrice,
      updatedAt: new Date(),
    }).where(eq(entitlements.id, id));
  }

  // Hub Underwriters
  async getUnderwritersByOrg(organizationId: string): Promise<(HubUnderwriter & { businessName: string; businessSlug: string })[]> {
    const rows = await db.select({
      id: hubUnderwriters.id,
      organizationId: hubUnderwriters.organizationId,
      businessId: hubUnderwriters.businessId,
      startAt: hubUnderwriters.startAt,
      endAt: hubUnderwriters.endAt,
      stripeSubscriptionId: hubUnderwriters.stripeSubscriptionId,
      isActive: hubUnderwriters.isActive,
      createdAt: hubUnderwriters.createdAt,
      businessName: businesses.name,
      businessSlug: businesses.slug,
    }).from(hubUnderwriters)
      .innerJoin(businesses, eq(hubUnderwriters.businessId, businesses.id))
      .where(and(eq(hubUnderwriters.organizationId, organizationId), eq(hubUnderwriters.isActive, true)));
    return rows as any;
  }

  async getUnderwritersByBusiness(businessId: string): Promise<(HubUnderwriter & { orgName: string; orgSlug: string })[]> {
    const orgs = db.$with("orgs").as(
      db.select({ id: businesses.id, name: businesses.name, slug: businesses.slug }).from(businesses)
    );
    const rows = await db.select({
      id: hubUnderwriters.id,
      organizationId: hubUnderwriters.organizationId,
      businessId: hubUnderwriters.businessId,
      startAt: hubUnderwriters.startAt,
      endAt: hubUnderwriters.endAt,
      stripeSubscriptionId: hubUnderwriters.stripeSubscriptionId,
      isActive: hubUnderwriters.isActive,
      createdAt: hubUnderwriters.createdAt,
      orgName: businesses.name,
      orgSlug: businesses.slug,
    }).from(hubUnderwriters)
      .innerJoin(businesses, eq(hubUnderwriters.organizationId, businesses.id))
      .where(and(eq(hubUnderwriters.businessId, businessId), eq(hubUnderwriters.isActive, true)));
    return rows as any;
  }

  async createUnderwriter(data: InsertHubUnderwriter): Promise<HubUnderwriter> {
    const existing = await db.select().from(hubUnderwriters)
      .where(and(eq(hubUnderwriters.organizationId, data.organizationId), eq(hubUnderwriters.isActive, true)));
    if (existing.length >= HUB_UNDERWRITER_MAX) {
      throw new Error(`Maximum of ${HUB_UNDERWRITER_MAX} underwriters per organization`);
    }
    const sponsor = await db.select().from(businesses).where(eq(businesses.id, data.businessId)).limit(1);
    if (!sponsor.length || !sponsor[0].isVerified || sponsor[0].presenceType !== "commerce") {
      throw new Error("Underwriter must be a verified paid commerce presence");
    }
    if (sponsor[0].listingTier === "VERIFIED") {
      throw new Error("Underwriter must have an active paid plan (Charter or Enhanced)");
    }
    const [row] = await db.insert(hubUnderwriters).values(data).returning();
    return row;
  }

  async deleteUnderwriter(id: string): Promise<void> {
    await db.update(hubUnderwriters).set({ isActive: false }).where(eq(hubUnderwriters.id, id));
  }

  // Hub Event Partners
  async getEventPartners(eventId: string): Promise<(HubEventPartner & { businessName: string; businessSlug: string })[]> {
    const rows = await db.select({
      id: hubEventPartners.id,
      eventId: hubEventPartners.eventId,
      businessId: hubEventPartners.businessId,
      partnerType: hubEventPartners.partnerType,
      amountPaid: hubEventPartners.amountPaid,
      stripePaymentIntentId: hubEventPartners.stripePaymentIntentId,
      createdAt: hubEventPartners.createdAt,
      businessName: businesses.name,
      businessSlug: businesses.slug,
    }).from(hubEventPartners)
      .innerJoin(businesses, eq(hubEventPartners.businessId, businesses.id))
      .where(eq(hubEventPartners.eventId, eventId));
    return rows as any;
  }

  async createEventPartner(data: InsertHubEventPartner): Promise<HubEventPartner> {
    const sponsor = await db.select().from(businesses).where(eq(businesses.id, data.businessId)).limit(1);
    if (!sponsor.length || !sponsor[0].isVerified || sponsor[0].presenceType !== "commerce") {
      throw new Error("Event partner must be a verified paid commerce presence");
    }
    const [row] = await db.insert(hubEventPartners).values(data).returning();
    return row;
  }

  // Wildcard feed - random mix per page load, stable via seed
  async getWildcardFeed(cityId: string, limit: number, offset: number, seed: string): Promise<{ type: string; item: any }[]> {
    const now = new Date();
    const seedHash = seed.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);

    const [liveEvents, activePresences] = await Promise.all([
      db.select().from(events).where(and(
        eq(events.cityId, cityId),
        sql`COALESCE(${events.endDateTime}, ${events.startDateTime} + interval '3 hours') > ${now}`
      )),
      db.select().from(businesses).where(and(
        eq(businesses.cityId, cityId),
        sql`${businesses.presenceStatus} = 'ACTIVE'`
      )),
    ]);

    const items: { type: string; item: any }[] = [
      ...liveEvents.map(e => ({ type: "event", item: e })),
      ...activePresences.map(b => ({ type: b.presenceType === "organization" ? "organization" : "presence", item: b })),
    ];

    const seededRandom = (i: number) => {
      const x = Math.sin(seedHash + i) * 10000;
      return x - Math.floor(x);
    };
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(i) * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items.slice(offset, offset + limit);
  }

  // Live events - only events that haven't ended
  async getLiveEventsByCityId(cityId: string, filters?: { zoneSlug?: string; startDate?: string; endDate?: string }): Promise<Event[]> {
    const now = new Date();
    const conditions = [
      eq(events.cityId, cityId),
      sql`COALESCE(${events.endDateTime}, ${events.startDateTime} + interval '3 hours') > ${now}`,
    ];
    if (filters?.zoneSlug) {
      const zone = await this.getZoneBySlug(cityId, filters.zoneSlug);
      if (zone) conditions.push(eq(events.zoneId, zone.id));
    }
    if (filters?.startDate) {
      conditions.push(gte(events.startDateTime, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      conditions.push(lte(events.startDateTime, new Date(filters.endDate)));
    }
    return db.select().from(events).where(and(...conditions)).orderBy(asc(events.startDateTime));
  }

  // Weekly Hub Selections
  async getWeeklySelections(cityId: string, selectionType: string): Promise<WeeklyHubSelection[]> {
    const now = new Date();
    return db.select().from(weeklyHubSelections)
      .where(and(
        eq(weeklyHubSelections.cityId, cityId),
        sql`${weeklyHubSelections.selectionType} = ${selectionType}`,
        lte(weeklyHubSelections.weekStart, now),
        gte(weeklyHubSelections.weekEnd, now),
      ))
      .orderBy(asc(weeklyHubSelections.sortOrder));
  }

  async generateWeeklySelections(cityId: string, selectionType: string): Promise<number> {
    const now = new Date();
    let weekStart: Date, weekEnd: Date;

    if (selectionType === "THIS_WEEK") {
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
      weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() + daysToMonday);
      weekStart.setHours(0, 0, 0, 0);
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
    } else {
      const dayOfWeek = now.getDay();
      const daysToFriday = dayOfWeek <= 4 ? (5 - dayOfWeek) : (12 - dayOfWeek);
      weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() + daysToFriday);
      weekStart.setHours(0, 0, 0, 0);
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 2);
      weekEnd.setHours(23, 59, 59, 999);
    }

    const liveEvents = await db.select().from(events).where(and(
      eq(events.cityId, cityId),
      gte(events.startDateTime, weekStart),
      lte(events.startDateTime, weekEnd),
    ));

    const activePresences = await db.select().from(businesses).where(and(
      eq(businesses.cityId, cityId),
      sql`${businesses.presenceStatus} = 'ACTIVE'`,
    ));

    const allItems: { type: string; id: string }[] = [
      ...liveEvents.map(e => ({ type: "event", id: e.id })),
      ...activePresences.map(b => ({ type: b.presenceType === "organization" ? "organization" : "presence", id: b.id })),
    ];

    for (let i = allItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
    }

    const selected = allItems.slice(0, 20);

    await db.delete(weeklyHubSelections).where(and(
      eq(weeklyHubSelections.cityId, cityId),
      sql`${weeklyHubSelections.selectionType} = ${selectionType}`,
      eq(weeklyHubSelections.weekStart, weekStart),
    ));

    for (let i = 0; i < selected.length; i++) {
      await db.insert(weeklyHubSelections).values({
        cityId,
        selectionType: selectionType as any,
        weekStart,
        weekEnd,
        itemType: selected[i].type,
        itemId: selected[i].id,
        sortOrder: i,
      });
    }

    return selected.length;
  }

  // =============================
  // CMS IMPLEMENTATIONS
  // =============================

  async getCmsContentItems(filters?: { contentType?: string; status?: string; assignedTo?: string; cityId?: string; search?: string; limit?: number; offset?: number }): Promise<{ items: CmsContentItem[]; total: number }> {
    const conditions: any[] = [];
    if (filters?.contentType) conditions.push(eq(cmsContentItems.contentType, filters.contentType as any));
    if (filters?.status) conditions.push(eq(cmsContentItems.status, filters.status as any));
    if (filters?.cityId) conditions.push(eq(cmsContentItems.cityId, filters.cityId));
    if (filters?.search) conditions.push(ilike(cmsContentItems.titleEn, `%${filters.search}%`));
    if (filters?.assignedTo) {
      conditions.push(or(
        eq(cmsContentItems.assignedEditorUserId, filters.assignedTo),
        eq(cmsContentItems.assignedReviewerUserId, filters.assignedTo),
      ));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(cmsContentItems).where(where);
    const items = await db.select().from(cmsContentItems).where(where).orderBy(desc(cmsContentItems.updatedAt)).limit(limit).offset(offset);

    return { items, total: countResult?.count || 0 };
  }

  async getCmsContentItemById(id: string): Promise<CmsContentItem | undefined> {
    const [item] = await db.select().from(cmsContentItems).where(eq(cmsContentItems.id, id)).limit(1);
    return item;
  }

  async getCmsContentItemBySlug(contentType: string, slug: string): Promise<CmsContentItem | undefined> {
    const [item] = await db.select().from(cmsContentItems).where(and(
      eq(cmsContentItems.contentType, contentType as any),
      eq(cmsContentItems.slug, slug),
    )).limit(1);
    return item;
  }

  async createCmsContentItem(data: InsertCmsContentItem): Promise<CmsContentItem> {
    const [item] = await db.insert(cmsContentItems).values({ ...data, updatedAt: new Date() }).returning();
    return item;
  }

  async updateCmsContentItem(id: string, data: Partial<InsertCmsContentItem>): Promise<CmsContentItem | undefined> {
    const [item] = await db.update(cmsContentItems).set({ ...data, updatedAt: new Date() }).where(eq(cmsContentItems.id, id)).returning();
    return item;
  }

  async getCmsStatusCounts(cityId?: string): Promise<{ status: string; count: number }[]> {
    const where = cityId ? eq(cmsContentItems.cityId, cityId) : undefined;
    const result = await db.select({
      status: cmsContentItems.status,
      count: sql<number>`count(*)::int`,
    }).from(cmsContentItems).where(where).groupBy(cmsContentItems.status);
    return result;
  }

  async getCmsRevisions(contentItemId: string): Promise<CmsRevision[]> {
    return db.select().from(cmsRevisions).where(eq(cmsRevisions.contentItemId, contentItemId)).orderBy(desc(cmsRevisions.createdAt));
  }

  async createCmsRevision(data: InsertCmsRevision): Promise<CmsRevision> {
    const [rev] = await db.insert(cmsRevisions).values(data).returning();
    return rev;
  }

  async getCmsWorkflowEvents(contentItemId: string): Promise<CmsWorkflowEvent[]> {
    return db.select().from(cmsWorkflowEvents).where(eq(cmsWorkflowEvents.contentItemId, contentItemId)).orderBy(desc(cmsWorkflowEvents.createdAt));
  }

  async createCmsWorkflowEvent(data: InsertCmsWorkflowEvent): Promise<CmsWorkflowEvent> {
    const [evt] = await db.insert(cmsWorkflowEvents).values(data).returning();
    return evt;
  }

  async getAllCmsTags(): Promise<CmsTag[]> {
    return db.select().from(cmsTags).orderBy(asc(cmsTags.name));
  }

  async createCmsTag(data: InsertCmsTag): Promise<CmsTag> {
    const [tag] = await db.insert(cmsTags).values(data).returning();
    return tag;
  }

  async updateCmsTag(id: string, data: Partial<InsertCmsTag>): Promise<CmsTag | undefined> {
    const [tag] = await db.update(cmsTags).set(data).where(eq(cmsTags.id, id)).returning();
    return tag;
  }

  async getCmsCalendarItems(start: Date, end: Date): Promise<{ id: string; titleEn: string; status: string; contentType: string; publishAt: string | null; publishedAt: string | null; unpublishAt: string | null }[]> {
    const items = await db.select({
      id: cmsContentItems.id,
      titleEn: cmsContentItems.titleEn,
      status: cmsContentItems.status,
      contentType: cmsContentItems.contentType,
      publishAt: cmsContentItems.publishAt,
      publishedAt: cmsContentItems.publishedAt,
      unpublishAt: cmsContentItems.unpublishAt,
    }).from(cmsContentItems).where(
      or(
        and(gte(cmsContentItems.publishAt, start), lte(cmsContentItems.publishAt, end)),
        and(gte(cmsContentItems.publishedAt, start), lte(cmsContentItems.publishedAt, end)),
        and(gte(cmsContentItems.unpublishAt, start), lte(cmsContentItems.unpublishAt, end)),
      )
    );
    return items.map(i => ({
      ...i,
      publishAt: i.publishAt?.toISOString() || null,
      publishedAt: i.publishedAt?.toISOString() || null,
      unpublishAt: i.unpublishAt?.toISOString() || null,
    }));
  }

  async deleteCmsTag(id: string): Promise<boolean> {
    await db.delete(cmsContentTags).where(eq(cmsContentTags.tagId, id));
    const result = await db.delete(cmsTags).where(eq(cmsTags.id, id)).returning();
    return result.length > 0;
  }

  async getCmsContentTagIds(contentItemId: string): Promise<string[]> {
    const rows = await db.select({ tagId: cmsContentTags.tagId }).from(cmsContentTags).where(eq(cmsContentTags.contentItemId, contentItemId));
    return rows.map(r => r.tagId);
  }

  async setCmsContentTags(contentItemId: string, tagIds: string[]): Promise<void> {
    await db.delete(cmsContentTags).where(eq(cmsContentTags.contentItemId, contentItemId));
    if (tagIds.length > 0) {
      await db.insert(cmsContentTags).values(tagIds.map(tagId => ({ contentItemId, tagId })));
    }
  }

  async getCmsAssets(filters?: { fileType?: string; search?: string; linkedBusinessId?: string; linkedCreatorId?: string; hubSlug?: string; licenseType?: string; status?: string; tag?: string; categoryId?: string }): Promise<CmsAsset[]> {
    const conditions: any[] = [];
    if (filters?.fileType) conditions.push(eq(cmsAssets.fileType, filters.fileType as any));
    if (filters?.search) conditions.push(or(ilike(cmsAssets.altTextEn, `%${filters.search}%`), ilike(cmsAssets.fileUrl, `%${filters.search}%`), ilike(cmsAssets.creditName, `%${filters.search}%`)));
    if (filters?.linkedBusinessId) conditions.push(eq(cmsAssets.linkedBusinessId, filters.linkedBusinessId));
    if (filters?.linkedCreatorId) conditions.push(eq(cmsAssets.linkedCreatorId, filters.linkedCreatorId));
    if (filters?.hubSlug) conditions.push(eq(cmsAssets.hubSlug, filters.hubSlug));
    if (filters?.licenseType) conditions.push(eq(cmsAssets.licenseType, filters.licenseType));
    if (filters?.status) conditions.push(eq(cmsAssets.status, filters.status));
    if (filters?.tag) conditions.push(sql`${filters.tag} = ANY(${cmsAssets.tags})`);
    if (filters?.categoryId) conditions.push(sql`${filters.categoryId} = ANY(${cmsAssets.categoryIds})`);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(cmsAssets).where(where).orderBy(desc(cmsAssets.createdAt));
  }

  async getCmsAssetById(id: string): Promise<CmsAsset | undefined> {
    const [asset] = await db.select().from(cmsAssets).where(eq(cmsAssets.id, id)).limit(1);
    return asset;
  }

  async createCmsAsset(data: InsertCmsAsset): Promise<CmsAsset> {
    const [asset] = await db.insert(cmsAssets).values(data).returning();
    return asset;
  }

  async updateCmsAsset(id: string, data: Partial<InsertCmsAsset>): Promise<CmsAsset | undefined> {
    const [asset] = await db.update(cmsAssets).set(data).where(eq(cmsAssets.id, id)).returning();
    return asset;
  }

  async getCmsContentRelations(contentItemId: string): Promise<CmsContentRelation[]> {
    return db.select().from(cmsContentRelations).where(eq(cmsContentRelations.contentItemId, contentItemId));
  }

  async createCmsContentRelation(data: InsertCmsContentRelation): Promise<CmsContentRelation> {
    const [rel] = await db.insert(cmsContentRelations).values(data).returning();
    return rel;
  }

  async deleteCmsContentItem(id: string): Promise<void> {
    await db.delete(cmsContentTags).where(eq(cmsContentTags.contentItemId, id));
    await db.delete(cmsContentRelations).where(eq(cmsContentRelations.contentItemId, id));
    await db.delete(cmsContentItems).where(eq(cmsContentItems.id, id));
  }

  async deleteCmsContentRelation(id: string): Promise<void> {
    await db.delete(cmsContentRelations).where(eq(cmsContentRelations.id, id));
  }

  async getCmsBridgeArticle(contentItemId: string): Promise<string | undefined> {
    const [row] = await db.select({ legacyArticleId: cmsBridgeArticles.legacyArticleId }).from(cmsBridgeArticles).where(eq(cmsBridgeArticles.contentItemId, contentItemId)).limit(1);
    return row?.legacyArticleId;
  }

  async getCmsBridgeByLegacyId(legacyArticleId: string): Promise<string | undefined> {
    const [row] = await db.select({ contentItemId: cmsBridgeArticles.contentItemId }).from(cmsBridgeArticles).where(eq(cmsBridgeArticles.legacyArticleId, legacyArticleId)).limit(1);
    return row?.contentItemId;
  }

  async createCmsBridgeArticle(contentItemId: string, legacyArticleId: string): Promise<void> {
    await db.insert(cmsBridgeArticles).values({ contentItemId, legacyArticleId });
  }

  async getScheduledForPublish(): Promise<CmsContentItem[]> {
    return db.select().from(cmsContentItems).where(and(
      eq(cmsContentItems.status, "scheduled"),
      lte(cmsContentItems.publishAt, new Date()),
    ));
  }

  async getScheduledForUnpublish(): Promise<CmsContentItem[]> {
    return db.select().from(cmsContentItems).where(and(
      eq(cmsContentItems.status, "published"),
      lte(cmsContentItems.unpublishAt, new Date()),
    ));
  }

  // ===== EMAIL TEMPLATES =====
  async getEmailTemplates(filters?: { status?: string; templateKey?: string }): Promise<EmailTemplate[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(emailTemplates.status, filters.status as any));
    if (filters?.templateKey) conditions.push(eq(emailTemplates.templateKey, filters.templateKey as any));
    return db.select().from(emailTemplates).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(emailTemplates.updatedAt));
  }

  async getEmailTemplateById(id: string): Promise<EmailTemplate | undefined> {
    const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
    return t;
  }

  async createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate> {
    const [t] = await db.insert(emailTemplates).values(data).returning();
    return t;
  }

  async updateEmailTemplate(id: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const [t] = await db.update(emailTemplates).set({ ...data, updatedAt: new Date() }).where(eq(emailTemplates.id, id)).returning();
    return t;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  }

  async getEmailTemplateRevisions(templateId: string): Promise<EmailTemplateRevision[]> {
    return db.select().from(emailTemplateRevisions).where(eq(emailTemplateRevisions.templateId, templateId)).orderBy(desc(emailTemplateRevisions.createdAt));
  }

  async createEmailTemplateRevision(data: { templateId: string; actorUserId?: string; fieldName: string; oldValue?: string; newValue?: string; reason?: string }): Promise<EmailTemplateRevision> {
    const [rev] = await db.insert(emailTemplateRevisions).values(data).returning();
    return rev;
  }

  // ===== EMAIL CAMPAIGNS =====
  async getEmailCampaigns(filters?: { status?: string; classification?: string }): Promise<EmailCampaign[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(emailCampaigns.status, filters.status as any));
    if (filters?.classification) conditions.push(eq(emailCampaigns.classification, filters.classification as any));
    return db.select().from(emailCampaigns).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(emailCampaigns.createdAt));
  }

  async getEmailCampaignById(id: string): Promise<EmailCampaign | undefined> {
    const [c] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id)).limit(1);
    return c;
  }

  async createEmailCampaign(data: InsertEmailCampaign): Promise<EmailCampaign> {
    const [c] = await db.insert(emailCampaigns).values(data).returning();
    return c;
  }

  async updateEmailCampaign(id: string, data: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined> {
    const [c] = await db.update(emailCampaigns).set({ ...data, updatedAt: new Date() }).where(eq(emailCampaigns.id, id)).returning();
    return c;
  }

  // ===== EMAIL CAMPAIGN RECIPIENTS =====
  async getCampaignRecipients(campaignId: string): Promise<EmailCampaignRecipient[]> {
    return db.select().from(emailCampaignRecipients).where(eq(emailCampaignRecipients.campaignId, campaignId));
  }

  async createCampaignRecipient(data: { campaignId: string; email: string; userId?: string; presenceId?: string; vendorId?: string; mergeData?: any }): Promise<EmailCampaignRecipient> {
    const [r] = await db.insert(emailCampaignRecipients).values(data).returning();
    return r;
  }

  async createCampaignRecipientsBatch(data: { campaignId: string; email: string; userId?: string; presenceId?: string; vendorId?: string; mergeData?: any }[]): Promise<EmailCampaignRecipient[]> {
    if (data.length === 0) return [];
    return db.insert(emailCampaignRecipients).values(data).returning();
  }

  async updateCampaignRecipientStatus(id: string, status: string, providerMessageId?: string): Promise<void> {
    const updateData: any = { status, updatedAt: new Date() };
    if (providerMessageId) updateData.providerMessageId = providerMessageId;
    await db.update(emailCampaignRecipients).set(updateData).where(eq(emailCampaignRecipients.id, id));
  }

  async getCampaignRecipientStats(campaignId: string): Promise<{ status: string; count: number }[]> {
    const rows = await db.select({
      status: emailCampaignRecipients.status,
      count: sql<number>`count(*)::int`,
    }).from(emailCampaignRecipients).where(eq(emailCampaignRecipients.campaignId, campaignId)).groupBy(emailCampaignRecipients.status);
    return rows;
  }

  // ===== EMAIL SUPPRESSION & UNSUBSCRIBES =====
  async isEmailSuppressed(email: string): Promise<boolean> {
    const [row] = await db.select({ id: emailSuppression.id }).from(emailSuppression).where(eq(emailSuppression.email, email.toLowerCase())).limit(1);
    return !!row;
  }

  async addEmailSuppression(data: { email: string; suppressionType: string; reason?: string }): Promise<EmailSuppressionRecord> {
    const [s] = await db.insert(emailSuppression).values({ ...data, email: data.email.toLowerCase(), suppressionType: data.suppressionType as any }).returning();
    return s;
  }

  async getEmailSuppressions(): Promise<EmailSuppressionRecord[]> {
    return db.select().from(emailSuppression).orderBy(desc(emailSuppression.createdAt));
  }

  async removeEmailSuppression(id: string): Promise<void> {
    await db.delete(emailSuppression).where(eq(emailSuppression.id, id));
  }

  async isEmailUnsubscribed(email: string): Promise<boolean> {
    const [row] = await db.select({ id: emailUnsubscribes.id }).from(emailUnsubscribes).where(eq(emailUnsubscribes.email, email.toLowerCase())).limit(1);
    return !!row;
  }

  async addEmailUnsubscribe(data: { email: string; source?: string }): Promise<EmailUnsubscribe> {
    const [u] = await db.insert(emailUnsubscribes).values({ ...data, email: data.email.toLowerCase() }).returning();
    return u;
  }

  async getEmailUnsubscribes(): Promise<EmailUnsubscribe[]> {
    return db.select().from(emailUnsubscribes).orderBy(desc(emailUnsubscribes.unsubscribedAt));
  }

  async removeEmailUnsubscribe(id: string): Promise<void> {
    await db.delete(emailUnsubscribes).where(eq(emailUnsubscribes.id, id));
  }

  // ===== EMAIL EVENTS =====
  async createEmailEvent(data: { provider?: string; providerMessageId?: string; eventType: string; email?: string; payloadJson?: any }): Promise<EmailEvent> {
    const [ev] = await db.insert(emailEvents).values(data).returning();
    return ev;
  }

  async getEmailEventsByMessageId(providerMessageId: string): Promise<EmailEvent[]> {
    return db.select().from(emailEvents).where(eq(emailEvents.providerMessageId, providerMessageId)).orderBy(desc(emailEvents.createdAt));
  }

  // ===== VENDORS =====
  async getVendors(filters?: { status?: string; vendorType?: string; q?: string }): Promise<Vendor[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(vendors.status, filters.status as any));
    if (filters?.vendorType) conditions.push(eq(vendors.vendorType, filters.vendorType as any));
    if (filters?.q) conditions.push(ilike(vendors.name, `%${filters.q}%`));
    return db.select().from(vendors).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(vendors.name));
  }

  async getVendorById(id: string): Promise<Vendor | undefined> {
    const [v] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    return v;
  }

  async createVendor(data: InsertVendor): Promise<Vendor> {
    const [v] = await db.insert(vendors).values(data).returning();
    return v;
  }

  async updateVendor(id: string, data: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [v] = await db.update(vendors).set({ ...data, updatedAt: new Date() }).where(eq(vendors.id, id)).returning();
    return v;
  }

  async deleteVendor(id: string): Promise<void> {
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  // ===== VENDOR CONTACTS =====
  async getVendorContacts(vendorId: string): Promise<VendorContact[]> {
    return db.select().from(vendorContacts).where(eq(vendorContacts.vendorId, vendorId));
  }

  async createVendorContact(data: InsertVendorContact): Promise<VendorContact> {
    const [c] = await db.insert(vendorContacts).values(data).returning();
    return c;
  }

  async updateVendorContact(id: string, data: Partial<InsertVendorContact>): Promise<VendorContact | undefined> {
    const [c] = await db.update(vendorContacts).set({ ...data, updatedAt: new Date() }).where(eq(vendorContacts.id, id)).returning();
    return c;
  }

  async deleteVendorContact(id: string): Promise<void> {
    await db.delete(vendorContacts).where(eq(vendorContacts.id, id));
  }

  // ===== CRM EVENTS =====
  async getCrmEvents(filters?: { status?: string; q?: string }): Promise<CrmEvent[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(crmEvents.status, filters.status as any));
    if (filters?.q) conditions.push(ilike(crmEvents.name, `%${filters.q}%`));
    return db.select().from(crmEvents).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(crmEvents.startAt));
  }

  async getCrmEventById(id: string): Promise<CrmEvent | undefined> {
    const [e] = await db.select().from(crmEvents).where(eq(crmEvents.id, id)).limit(1);
    return e;
  }

  async createCrmEvent(data: InsertCrmEvent): Promise<CrmEvent> {
    const [e] = await db.insert(crmEvents).values(data).returning();
    return e;
  }

  async updateCrmEvent(id: string, data: Partial<InsertCrmEvent>): Promise<CrmEvent | undefined> {
    const [e] = await db.update(crmEvents).set({ ...data, updatedAt: new Date() }).where(eq(crmEvents.id, id)).returning();
    return e;
  }

  async deleteCrmEvent(id: string): Promise<void> {
    await db.delete(crmEvents).where(eq(crmEvents.id, id));
  }

  // ===== EVENT VENDORS =====
  async getEventVendors(crmEventId: string): Promise<(EventVendor & { vendor: Vendor })[]> {
    const rows = await db.select().from(eventVendors).innerJoin(vendors, eq(eventVendors.vendorId, vendors.id)).where(eq(eventVendors.crmEventId, crmEventId));
    return rows.map(r => ({ ...r.event_vendors, vendor: r.vendors }));
  }

  async getVendorEvents(vendorId: string): Promise<(EventVendor & { event: CrmEvent })[]> {
    const rows = await db.select().from(eventVendors).innerJoin(crmEvents, eq(eventVendors.crmEventId, crmEvents.id)).where(eq(eventVendors.vendorId, vendorId));
    return rows.map(r => ({ ...r.event_vendors, event: r.crm_events }));
  }

  async createEventVendor(data: InsertEventVendor): Promise<EventVendor> {
    const [ev] = await db.insert(eventVendors).values(data).returning();
    return ev;
  }

  async updateEventVendor(id: string, data: Partial<InsertEventVendor>): Promise<EventVendor | undefined> {
    const [ev] = await db.update(eventVendors).set({ ...data, updatedAt: new Date() }).where(eq(eventVendors.id, id)).returning();
    return ev;
  }

  async deleteEventVendor(id: string): Promise<void> {
    await db.delete(eventVendors).where(eq(eventVendors.id, id));
  }

  // ===== ADMIN INBOX =====
  async getInboxItems(filters?: { status?: string; statuses?: string[]; priority?: string; itemType?: string; assignedToUserId?: string; overdue?: boolean; tag?: string; q?: string; triageCategory?: string }): Promise<AdminInboxItem[]> {
    const conditions: any[] = [];
    if (filters?.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(adminInboxItems.status, filters.statuses as any));
    } else if (filters?.status) {
      conditions.push(eq(adminInboxItems.status, filters.status as any));
    }
    if (filters?.priority) conditions.push(eq(adminInboxItems.priority, filters.priority as any));
    if (filters?.itemType) conditions.push(eq(adminInboxItems.itemType, filters.itemType as any));
    if (filters?.assignedToUserId) conditions.push(eq(adminInboxItems.assignedToUserId, filters.assignedToUserId));
    if (filters?.overdue) conditions.push(and(isNotNull(adminInboxItems.dueAt), lte(adminInboxItems.dueAt, new Date())));
    if (filters?.tag) conditions.push(sql`${filters.tag} = ANY(${adminInboxItems.tags})`);
    if (filters?.q) conditions.push(ilike(adminInboxItems.title, `%${filters.q}%`));
    if (filters?.triageCategory) conditions.push(eq(adminInboxItems.triageCategory, filters.triageCategory));
    return db.select().from(adminInboxItems).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(adminInboxItems.createdAt)).limit(500);
  }

  async getInboxItemById(id: string): Promise<AdminInboxItem | undefined> {
    const [item] = await db.select().from(adminInboxItems).where(eq(adminInboxItems.id, id)).limit(1);
    return item;
  }

  async createInboxItem(data: InsertAdminInboxItem): Promise<AdminInboxItem> {
    const [item] = await db.insert(adminInboxItems).values(data).returning();
    return item;
  }

  async updateInboxItem(id: string, data: Partial<InsertAdminInboxItem>): Promise<AdminInboxItem | undefined> {
    const updateData: any = { ...data };
    if (data.status === "resolved" || data.status === "closed") {
      updateData.resolvedAt = new Date();
    }
    const [item] = await db.update(adminInboxItems).set(updateData).where(eq(adminInboxItems.id, id)).returning();
    return item;
  }

  async findOpenInboxItem(relatedTable: string, relatedId: string, itemType: string): Promise<AdminInboxItem | undefined> {
    const [item] = await db.select().from(adminInboxItems).where(
      and(
        eq(adminInboxItems.relatedTable, relatedTable),
        eq(adminInboxItems.relatedId, relatedId),
        eq(adminInboxItems.itemType, itemType as any),
        inArray(adminInboxItems.status, ["open", "in_progress", "waiting"] as any)
      )
    ).limit(1);
    return item;
  }

  async getInboxComments(inboxItemId: string): Promise<AdminInboxComment[]> {
    return db.select().from(adminInboxComments).where(eq(adminInboxComments.inboxItemId, inboxItemId)).orderBy(asc(adminInboxComments.createdAt));
  }

  async createInboxComment(data: InsertAdminInboxComment): Promise<AdminInboxComment> {
    const [c] = await db.insert(adminInboxComments).values(data).returning();
    return c;
  }

  async getInboxHistory(inboxItemId: string): Promise<AdminInboxHistory[]> {
    return db.select().from(adminInboxHistory).where(eq(adminInboxHistory.inboxItemId, inboxItemId)).orderBy(desc(adminInboxHistory.createdAt));
  }

  async createInboxHistory(data: InsertAdminInboxHistory): Promise<AdminInboxHistory> {
    const [h] = await db.insert(adminInboxHistory).values(data).returning();
    return h;
  }

  async getInboxLinks(inboxItemId: string): Promise<AdminInboxLink[]> {
    return db.select().from(adminInboxLinks).where(eq(adminInboxLinks.inboxItemId, inboxItemId)).orderBy(asc(adminInboxLinks.createdAt));
  }

  async createInboxLink(data: InsertAdminInboxLink): Promise<AdminInboxLink> {
    const [l] = await db.insert(adminInboxLinks).values(data).returning();
    return l;
  }

  async markInboxItemRead(id: string): Promise<AdminInboxItem | undefined> {
    const [item] = await db.update(adminInboxItems).set({ readAt: new Date() }).where(and(eq(adminInboxItems.id, id), sql`${adminInboxItems.readAt} IS NULL`)).returning();
    return item;
  }

  async getInboxOpenCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(adminInboxItems).where(
      inArray(adminInboxItems.status, ["open", "in_progress", "waiting"] as any)
    );
    return result?.count || 0;
  }

  // Place Import Jobs
  async createPlaceImportJob(data: InsertPlaceImportJob): Promise<PlaceImportJob> {
    const [j] = await db.insert(placeImportJobs).values(data).returning();
    return j;
  }
  async getPlaceImportJob(id: string): Promise<PlaceImportJob | undefined> {
    const [j] = await db.select().from(placeImportJobs).where(eq(placeImportJobs.id, id)).limit(1);
    return j;
  }
  async updatePlaceImportJob(id: string, data: Partial<InsertPlaceImportJob>): Promise<PlaceImportJob | undefined> {
    const [j] = await db.update(placeImportJobs).set({ ...data, updatedAt: new Date() }).where(eq(placeImportJobs.id, id)).returning();
    return j;
  }
  async listPlaceImportJobs(): Promise<PlaceImportJob[]> {
    return db.select().from(placeImportJobs).orderBy(desc(placeImportJobs.createdAt));
  }

  // Place Import Results
  async createPlaceImportResult(data: InsertPlaceImportResult): Promise<PlaceImportResult> {
    const [r] = await db.insert(placeImportResults).values(data).returning();
    return r;
  }
  async getPlaceImportResults(jobId: string): Promise<PlaceImportResult[]> {
    return db.select().from(placeImportResults).where(eq(placeImportResults.jobId, jobId)).orderBy(asc(placeImportResults.createdAt));
  }
  async updatePlaceImportResult(id: string, data: Partial<InsertPlaceImportResult>): Promise<PlaceImportResult | undefined> {
    const [r] = await db.update(placeImportResults).set({ ...data, updatedAt: new Date() }).where(eq(placeImportResults.id, id)).returning();
    return r;
  }

  // Presence Places Source
  async createPresencePlacesSource(data: InsertPresencePlacesSource): Promise<PresencePlacesSource> {
    const [s] = await db.insert(presencePlacesSource).values(data).returning();
    return s;
  }
  async getPresencePlacesSource(placeId: string): Promise<PresencePlacesSource | undefined> {
    const [s] = await db.select().from(presencePlacesSource).where(eq(presencePlacesSource.placeId, placeId)).limit(1);
    return s;
  }

  // Listings to Claim Queue
  async createListingsToClaimQueue(data: InsertListingsToClaimQueue): Promise<ListingsToClaimQueue> {
    const [q] = await db.insert(listingsToClaimQueue).values(data).returning();
    return q;
  }
  async listListingsToClaimQueue(filters?: { status?: string; source?: string }): Promise<(ListingsToClaimQueue & { presence?: Business })[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(listingsToClaimQueue.status, filters.status as any));
    if (filters?.source) conditions.push(eq(listingsToClaimQueue.source, filters.source as any));

    const items = conditions.length > 0
      ? await db.select().from(listingsToClaimQueue).where(and(...conditions)).orderBy(desc(listingsToClaimQueue.createdAt))
      : await db.select().from(listingsToClaimQueue).orderBy(desc(listingsToClaimQueue.createdAt));

    const result: (ListingsToClaimQueue & { presence?: Business })[] = [];
    for (const item of items) {
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, item.presenceId)).limit(1);
      result.push({ ...item, presence: biz || undefined });
    }
    return result;
  }
  async updateListingsToClaimQueue(id: string, data: Partial<InsertListingsToClaimQueue>): Promise<ListingsToClaimQueue | undefined> {
    const [q] = await db.update(listingsToClaimQueue).set({ ...data, updatedAt: new Date() }).where(eq(listingsToClaimQueue.id, id)).returning();
    return q;
  }
  async getListingsToClaimQueueById(id: string): Promise<ListingsToClaimQueue | undefined> {
    const [q] = await db.select().from(listingsToClaimQueue).where(eq(listingsToClaimQueue.id, id)).limit(1);
    return q;
  }

  // Charlotte Chat
  async createCharlotteChatThread(data: InsertCharlotteChatThread): Promise<CharlotteChatThread> {
    const [t] = await db.insert(charlotteChatThreads).values(data).returning();
    return t;
  }
  async updateCharlotteChatThread(id: string, data: Partial<InsertCharlotteChatThread>): Promise<CharlotteChatThread | undefined> {
    const [t] = await db.update(charlotteChatThreads).set({ ...data, updatedAt: new Date() }).where(eq(charlotteChatThreads.id, id)).returning();
    return t;
  }
  async getCharlotteChatThreads(userId?: string): Promise<CharlotteChatThread[]> {
    if (userId) {
      return db.select().from(charlotteChatThreads).where(eq(charlotteChatThreads.userId, userId)).orderBy(desc(charlotteChatThreads.updatedAt));
    }
    return db.select().from(charlotteChatThreads).orderBy(desc(charlotteChatThreads.updatedAt));
  }
  async getCharlotteChatThread(id: string): Promise<CharlotteChatThread | undefined> {
    const [t] = await db.select().from(charlotteChatThreads).where(eq(charlotteChatThreads.id, id)).limit(1);
    return t;
  }
  async createCharlotteChatMessage(data: InsertCharlotteChatMessage): Promise<CharlotteChatMessage> {
    const [m] = await db.insert(charlotteChatMessages).values(data).returning();
    await db.update(charlotteChatThreads).set({ updatedAt: new Date() }).where(eq(charlotteChatThreads.id, data.threadId));
    return m;
  }
  async getCharlotteChatMessages(threadId: string): Promise<CharlotteChatMessage[]> {
    return db.select().from(charlotteChatMessages).where(eq(charlotteChatMessages.threadId, threadId)).orderBy(asc(charlotteChatMessages.createdAt));
  }
  async deleteCharlotteChatThread(id: string): Promise<void> {
    await db.delete(charlotteChatMessages).where(eq(charlotteChatMessages.threadId, id));
    await db.delete(charlotteChatThreads).where(eq(charlotteChatThreads.id, id));
  }

  // ZIP Geos
  async getZipGeo(zip: string): Promise<ZipGeo | undefined> {
    const [z] = await db.select().from(zipGeos).where(eq(zipGeos.zip, zip)).limit(1);
    return z;
  }
  async listZipGeos(search?: string): Promise<ZipGeo[]> {
    if (search) {
      return db.select().from(zipGeos).where(
        or(ilike(zipGeos.zip, `%${search}%`), ilike(zipGeos.city, `%${search}%`))
      ).orderBy(asc(zipGeos.zip)).limit(200);
    }
    return db.select().from(zipGeos).orderBy(asc(zipGeos.zip)).limit(200);
  }
  async upsertZipGeo(data: InsertZipGeo): Promise<ZipGeo> {
    const [z] = await db.insert(zipGeos).values(data)
      .onConflictDoUpdate({
        target: zipGeos.zip,
        set: { city: data.city, state: data.state, lat: data.lat, lng: data.lng, radiusMeters: data.radiusMeters },
      })
      .returning();
    return z;
  }
  async getZipGeoCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(zipGeos);
    return result?.count || 0;
  }

  async listHubRegions(countyId?: string): Promise<Region[]> {
    if (countyId) {
      return db.select().from(regions)
        .where(and(eq(regions.regionType, "hub"), eq(regions.parentRegionId, countyId)))
        .orderBy(asc(regions.name));
    }
    return db.select().from(regions)
      .where(eq(regions.regionType, "hub"))
      .orderBy(asc(regions.name));
  }

  async getHubCoverage(hubRegionId: string): Promise<HubZipCoverage[]> {
    return db.select().from(hubZipCoverage)
      .where(eq(hubZipCoverage.hubRegionId, hubRegionId))
      .orderBy(asc(hubZipCoverage.zip));
  }

  async upsertHubZipCoverage(data: InsertHubZipCoverage): Promise<HubZipCoverage> {
    const [row] = await db.insert(hubZipCoverage).values(data)
      .onConflictDoUpdate({
        target: [hubZipCoverage.hubRegionId, hubZipCoverage.zip],
        set: { confidence: data.confidence, notes: data.notes },
      })
      .returning();
    return row;
  }

  async deleteHubZipCoverage(id: string): Promise<void> {
    await db.delete(hubZipCoverage).where(eq(hubZipCoverage.id, id));
  }

  async getHubZipList(hubRegionId: string): Promise<string[]> {
    const rows = await db.select({ zip: hubZipCoverage.zip })
      .from(hubZipCoverage)
      .where(eq(hubZipCoverage.hubRegionId, hubRegionId))
      .orderBy(asc(hubZipCoverage.zip));
    return rows.map((r) => r.zip);
  }

  // Reviews (extended)
  async getReviewsByEntity(entityId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.businessId, entityId)).orderBy(desc(reviews.createdAt));
  }

  async getReviewsByStatus(status: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.status, status as any)).orderBy(desc(reviews.createdAt));
  }

  async createReview(data: InsertReview): Promise<Review> {
    const [row] = await db.insert(reviews).values(data).returning();
    return row;
  }

  async updateReviewStatus(id: string, status: string): Promise<Review | undefined> {
    const [row] = await db.update(reviews).set({ status: status as any }).where(eq(reviews.id, id)).returning();
    return row;
  }

  // Campaigns
  async getCampaigns(filters?: { year?: number; campaignType?: string }): Promise<Campaign[]> {
    const conditions = [];
    if (filters?.year) conditions.push(eq(campaigns.year, filters.year));
    if (filters?.campaignType) conditions.push(eq(campaigns.campaignType, filters.campaignType as any));
    return db.select().from(campaigns)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(campaigns.createdAt));
  }

  async getCampaignById(id: string): Promise<Campaign | undefined> {
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return row;
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [row] = await db.insert(campaigns).values(data).returning();
    return row;
  }

  async updateCampaign(id: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [row] = await db.update(campaigns).set(data).where(eq(campaigns.id, id)).returning();
    return row;
  }

  // Nominations
  async getNominationsByCampaign(campaignId: string): Promise<Nomination[]> {
    return db.select().from(nominations).where(eq(nominations.campaignId, campaignId)).orderBy(desc(nominations.createdAt));
  }

  async createNomination(data: InsertNomination): Promise<Nomination> {
    const [row] = await db.insert(nominations).values(data).returning();
    return row;
  }

  async updateNominationStatus(id: string, status: string): Promise<Nomination | undefined> {
    const [row] = await db.update(nominations).set({ status: status as any }).where(eq(nominations.id, id)).returning();
    return row;
  }

  // Votes
  async getVotesByCampaign(campaignId: string): Promise<Vote[]> {
    return db.select().from(votes).where(eq(votes.campaignId, campaignId)).orderBy(desc(votes.createdAt));
  }

  async getVoteCountByNomination(nominationId: string): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(votes).where(eq(votes.nominationId, nominationId));
    return row?.count ?? 0;
  }

  async createVote(data: InsertVote): Promise<Vote> {
    const [row] = await db.insert(votes).values(data).returning();
    return row;
  }

  async hasVoted(campaignId: string, voterFingerprint: string): Promise<boolean> {
    const [row] = await db.select({ id: votes.id }).from(votes)
      .where(and(eq(votes.campaignId, campaignId), eq(votes.voterFingerprint, voterFingerprint)))
      .limit(1);
    return !!row;
  }

  // Entity Category Mappings (L2)
  async getEntityCategories(entityId: string): Promise<EntityCategoryMap[]> {
    return db.select().from(entityCategoryMap).where(eq(entityCategoryMap.entityId, entityId));
  }

  async setEntityCategories(entityId: string, categoryIds: string[]): Promise<EntityCategoryMap[]> {
    await db.delete(entityCategoryMap).where(eq(entityCategoryMap.entityId, entityId));
    if (categoryIds.length === 0) return [];
    const rows = await db.insert(entityCategoryMap)
      .values(categoryIds.map(cid => ({ entityId, categoryId: cid })))
      .returning();
    return rows;
  }

  // Entity Micro Mappings (L3)
  async getEntityMicroCategories(entityId: string): Promise<EntityMicroMap[]> {
    return db.select().from(entityMicroMap).where(eq(entityMicroMap.entityId, entityId));
  }

  async setEntityMicroCategories(entityId: string, categoryIds: string[]): Promise<EntityMicroMap[]> {
    await db.delete(entityMicroMap).where(eq(entityMicroMap.entityId, entityId));
    if (categoryIds.length === 0) return [];
    const rows = await db.insert(entityMicroMap)
      .values(categoryIds.map(cid => ({ entityId, categoryId: cid })))
      .returning();
    return rows;
  }

  // Presence Featured In (Press Mentions)
  async getFeaturedInByEntity(entityId: string): Promise<PresenceFeaturedIn[]> {
    return db.select().from(presenceFeaturedIn)
      .where(eq(presenceFeaturedIn.entityId, entityId))
      .orderBy(asc(presenceFeaturedIn.sortOrder));
  }

  async createFeaturedIn(data: InsertPresenceFeaturedIn): Promise<PresenceFeaturedIn> {
    const [row] = await db.insert(presenceFeaturedIn).values(data).returning();
    return row;
  }

  async updateFeaturedIn(id: string, data: Partial<InsertPresenceFeaturedIn>): Promise<PresenceFeaturedIn | undefined> {
    const [row] = await db.update(presenceFeaturedIn).set(data).where(eq(presenceFeaturedIn.id, id)).returning();
    return row;
  }

  async deleteFeaturedIn(id: string): Promise<void> {
    await db.delete(presenceFeaturedIn).where(eq(presenceFeaturedIn.id, id));
  }

  // Transit Lines & Stops
  async getTransitLines(cityId?: string): Promise<TransitLine[]> {
    if (cityId) {
      return db.select().from(transitLines).where(eq(transitLines.cityId, cityId)).orderBy(asc(transitLines.name));
    }
    return db.select().from(transitLines).orderBy(asc(transitLines.name));
  }

  async getTransitStops(lineId: string): Promise<TransitStop[]> {
    return db.select().from(transitStops).where(eq(transitStops.transitLineId, lineId)).orderBy(asc(transitStops.sortOrder));
  }

  async getAllTransitStops(cityId?: string): Promise<TransitStop[]> {
    if (cityId) {
      return db.select().from(transitStops).where(eq(transitStops.cityId, cityId)).orderBy(asc(transitStops.name));
    }
    return db.select().from(transitStops).orderBy(asc(transitStops.name));
  }

  async getTransitStopById(id: string): Promise<TransitStop | undefined> {
    const [stop] = await db.select().from(transitStops).where(eq(transitStops.id, id));
    return stop;
  }

  async createTransitLine(data: InsertTransitLine): Promise<TransitLine> {
    const [line] = await db.insert(transitLines).values(data).returning();
    return line;
  }

  async createTransitStop(data: InsertTransitStop): Promise<TransitStop> {
    const [stop] = await db.insert(transitStops).values(data).returning();
    return stop;
  }

  // Marketplace
  async getMarketplaceListings(filters?: MarketplaceListingFilters): Promise<MarketplaceListing[]> {
    const conditions: SQL[] = [];
    if (filters?.cityId) conditions.push(eq(marketplaceListings.cityId, filters.cityId));
    if (filters?.type) conditions.push(sql`${marketplaceListings.type} = ${filters.type}`);
    if (filters?.subtype) conditions.push(sql`${marketplaceListings.subtype} = ${filters.subtype}`);
    if (filters?.status) conditions.push(sql`${marketplaceListings.status} = ${filters.status}`);
    if (filters?.status === "ACTIVE") {
      conditions.push(or(
        sql`${marketplaceListings.expiresAt} IS NULL`,
        gt(marketplaceListings.expiresAt, new Date())
      )!);
    }
    if (filters?.ownerType) conditions.push(sql`${marketplaceListings.ownerType} = ${filters.ownerType}`);
    if (filters?.hubPresenceId) conditions.push(eq(marketplaceListings.hubPresenceId, filters.hubPresenceId));
    if (filters?.postedByBusinessId) conditions.push(eq(marketplaceListings.postedByBusinessId, filters.postedByBusinessId));
    if (filters?.leaseOrSale) conditions.push(sql`${marketplaceListings.leaseOrSale} = ${filters.leaseOrSale}`);
    if (filters?.hubId) conditions.push(eq(marketplaceListings.hubId, filters.hubId));
    if (filters?.category) conditions.push(eq(marketplaceListings.category, filters.category));
    if (filters?.subcategory) conditions.push(eq(marketplaceListings.subcategory, filters.subcategory));
    if (filters?.featured) conditions.push(eq(marketplaceListings.featuredFlag, true));
    if (filters?.q) conditions.push(or(ilike(marketplaceListings.title, `%${filters.q}%`), ilike(marketplaceListings.description, `%${filters.q}%`))!);
    if (filters?.priceMin !== undefined) conditions.push(gte(marketplaceListings.price, filters.priceMin));
    if (filters?.priceMax !== undefined) conditions.push(lte(marketplaceListings.price, filters.priceMax));
    if (filters?.neighborhood) conditions.push(ilike(marketplaceListings.neighborhood, `%${filters.neighborhood}%`));

    let orderClauses: SQL[] = [];
    switch (filters?.sort) {
      case "price_asc": orderClauses = [asc(marketplaceListings.price)]; break;
      case "price_desc": orderClauses = [desc(marketplaceListings.price)]; break;
      case "featured": orderClauses = [desc(marketplaceListings.featuredFlag), desc(marketplaceListings.createdAt)]; break;
      default: orderClauses = [desc(marketplaceListings.featuredFlag), desc(marketplaceListings.createdAt)]; break;
    }

    return db.select().from(marketplaceListings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(...orderClauses)
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
  }

  async countMarketplaceListingsByUser(userId: string, status?: string): Promise<number> {
    const conditions: SQL[] = [eq(marketplaceListings.postedByUserId, userId)];
    if (status) conditions.push(sql`${marketplaceListings.status} = ${status}`);
    conditions.push(or(
      sql`${marketplaceListings.expiresAt} IS NULL`,
      gt(marketplaceListings.expiresAt, new Date())
    )!);
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(marketplaceListings)
      .where(and(...conditions));
    return result?.count || 0;
  }

  async getMarketplaceListingById(id: string): Promise<MarketplaceListing | undefined> {
    const [listing] = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, id));
    return listing;
  }

  async getMarketplaceListingsByUser(userId: string): Promise<MarketplaceListing[]> {
    return db.select().from(marketplaceListings)
      .where(eq(marketplaceListings.postedByUserId, userId))
      .orderBy(desc(marketplaceListings.createdAt));
  }

  async createMarketplaceListing(data: InsertMarketplaceListing): Promise<MarketplaceListing> {
    const [listing] = await db.insert(marketplaceListings).values(data).returning();
    return listing;
  }

  async updateMarketplaceListing(id: string, data: Partial<InsertMarketplaceListing>): Promise<MarketplaceListing | undefined> {
    const [listing] = await db.update(marketplaceListings).set({ ...data, updatedAt: new Date() }).where(eq(marketplaceListings.id, id)).returning();
    return listing;
  }

  async deleteMarketplaceListing(id: string): Promise<void> {
    await db.delete(marketplaceListings).where(eq(marketplaceListings.id, id));
  }

  async getMarketplaceCategories(listingType?: string): Promise<MarketplaceCategory[]> {
    if (listingType) {
      return db.select().from(marketplaceCategories).where(eq(marketplaceCategories.listingType, listingType as any)).orderBy(asc(marketplaceCategories.sortOrder));
    }
    return db.select().from(marketplaceCategories).orderBy(asc(marketplaceCategories.sortOrder));
  }

  async createMarketplaceCategory(data: InsertMarketplaceCategory): Promise<MarketplaceCategory> {
    const [cat] = await db.insert(marketplaceCategories).values(data).returning();
    return cat;
  }

  async updateMarketplaceCategory(id: string, data: Partial<InsertMarketplaceCategory>): Promise<MarketplaceCategory | undefined> {
    const [cat] = await db.update(marketplaceCategories).set(data).where(eq(marketplaceCategories.id, id)).returning();
    return cat;
  }

  async deleteMarketplaceCategory(id: string): Promise<void> {
    await db.delete(marketplaceCategories).where(eq(marketplaceCategories.id, id));
  }

  async createMarketplaceInquiry(data: InsertMarketplaceInquiry): Promise<MarketplaceInquiry> {
    const [inquiry] = await db.insert(marketplaceInquiries).values(data).returning();
    await db.update(marketplaceListings)
      .set({ inquiryCount: sql`${marketplaceListings.inquiryCount} + 1` })
      .where(eq(marketplaceListings.id, data.listingId));
    return inquiry;
  }

  async getMarketplaceInquiriesByListing(listingId: string): Promise<MarketplaceInquiry[]> {
    return db.select().from(marketplaceInquiries)
      .where(eq(marketplaceInquiries.listingId, listingId))
      .orderBy(desc(marketplaceInquiries.createdAt));
  }

  async getMarketplaceInquiryCount(listingId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(marketplaceInquiries)
      .where(eq(marketplaceInquiries.listingId, listingId));
    return Number(result[0]?.count || 0);
  }

  async getReviewsByMarketplaceListingId(listingId: string, status?: string): Promise<(Review & { displayName: string })[]> {
    const conditions: SQL[] = [eq(reviews.marketplaceListingId, listingId)];
    if (status) conditions.push(eq(reviews.status, status as "PENDING" | "APPROVED" | "REJECTED"));
    const rows = await db.select({
      review: reviews,
      displayName: sql<string>`COALESCE(${publicUsers.displayName}, 'Anonymous')`,
    }).from(reviews)
      .leftJoin(publicUsers, eq(reviews.userId, publicUsers.id))
      .where(and(...conditions))
      .orderBy(desc(reviews.createdAt));
    return rows.map(r => ({ ...r.review, displayName: r.displayName }));
  }

  async getMarketplaceReviewStats(listingId: string): Promise<{ avgRating: number; count: number }> {
    const result = await db.select({
      avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
      count: sql<number>`count(*)`,
    }).from(reviews)
      .where(and(eq(reviews.marketplaceListingId, listingId), eq(reviews.status, "APPROVED")));
    return { avgRating: Number(result[0]?.avg || 0), count: Number(result[0]?.count || 0) };
  }

  async createMarketplaceTransaction(data: InsertMarketplaceTransaction): Promise<MarketplaceTransaction> {
    const [txn] = await db.insert(marketplaceTransactions).values(data).returning();
    return txn;
  }

  async getMarketplaceTransactionById(id: string): Promise<MarketplaceTransaction | undefined> {
    const [txn] = await db.select().from(marketplaceTransactions).where(eq(marketplaceTransactions.id, id));
    return txn;
  }

  async getMarketplaceTransactionsByListing(listingId: string): Promise<MarketplaceTransaction[]> {
    return db.select().from(marketplaceTransactions)
      .where(eq(marketplaceTransactions.listingId, listingId))
      .orderBy(desc(marketplaceTransactions.createdAt));
  }

  async getMarketplaceTransactionsByBuyer(userId: string): Promise<MarketplaceTransaction[]> {
    return db.select().from(marketplaceTransactions)
      .where(eq(marketplaceTransactions.buyerUserId, userId))
      .orderBy(desc(marketplaceTransactions.createdAt));
  }

  async getMarketplaceTransactionsBySeller(userId: string): Promise<MarketplaceTransaction[]> {
    return db.select().from(marketplaceTransactions)
      .where(eq(marketplaceTransactions.sellerUserId, userId))
      .orderBy(desc(marketplaceTransactions.createdAt));
  }

  async updateMarketplaceTransaction(id: string, data: Partial<InsertMarketplaceTransaction>): Promise<MarketplaceTransaction | undefined> {
    const [txn] = await db.update(marketplaceTransactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(marketplaceTransactions.id, id))
      .returning();
    return txn;
  }

  async getMarketplaceTransactionByClaimCode(claimCode: string): Promise<MarketplaceTransaction | undefined> {
    const [txn] = await db.select().from(marketplaceTransactions)
      .where(eq(marketplaceTransactions.claimCode, claimCode));
    return txn;
  }

  async createMarketplaceAnalyticsEvent(data: InsertMarketplaceAnalyticsEvent): Promise<MarketplaceAnalyticsEvent> {
    const [evt] = await db.insert(marketplaceAnalyticsEvents).values(data).returning();
    return evt;
  }

  async createTerritory(data: InsertTerritory): Promise<Territory> {
    const [territory] = await db.insert(territories).values(data).returning();
    return territory;
  }

  async updateTerritory(id: string, data: Partial<InsertTerritory>): Promise<Territory | undefined> {
    const [territory] = await db.update(territories).set({ ...data, updatedAt: new Date() }).where(eq(territories.id, id)).returning();
    return territory;
  }

  async getTerritory(id: string): Promise<Territory | undefined> {
    const [territory] = await db.select().from(territories).where(eq(territories.id, id));
    return territory;
  }

  async getTerritoryByCode(code: string): Promise<Territory | undefined> {
    const [territory] = await db.select().from(territories).where(eq(territories.code, code));
    return territory;
  }

  async listTerritories(filters?: { type?: string; status?: string; parentTerritoryId?: string }): Promise<Territory[]> {
    const conditions = [];
    if (filters?.type) conditions.push(eq(territories.type, filters.type as any));
    if (filters?.status) conditions.push(eq(territories.status, filters.status as any));
    if (filters?.parentTerritoryId) conditions.push(eq(territories.parentTerritoryId, filters.parentTerritoryId));
    if (conditions.length > 0) {
      return db.select().from(territories).where(and(...conditions)).orderBy(asc(territories.name));
    }
    return db.select().from(territories).orderBy(asc(territories.name));
  }

  async getTerritoryChildren(parentId: string): Promise<Territory[]> {
    return db.select().from(territories).where(eq(territories.parentTerritoryId, parentId)).orderBy(asc(territories.name));
  }

  async createOperator(data: InsertOperator): Promise<Operator> {
    const [operator] = await db.insert(operators).values(data).returning();
    return operator;
  }

  async updateOperator(id: string, data: Partial<InsertOperator> & Record<string, any>): Promise<Operator | undefined> {
    const [operator] = await db.update(operators).set({ ...data, updatedAt: new Date() }).where(eq(operators.id, id)).returning();
    return operator;
  }

  async getOperator(id: string): Promise<Operator | undefined> {
    const [operator] = await db.select().from(operators).where(eq(operators.id, id));
    return operator;
  }

  async getOperatorByEmail(email: string): Promise<Operator | undefined> {
    const [operator] = await db.select().from(operators).where(eq(operators.email, email.toLowerCase().trim()));
    return operator;
  }

  async listOperators(filters?: { operatorType?: string; status?: string }): Promise<Operator[]> {
    const conditions = [];
    if (filters?.operatorType) conditions.push(eq(operators.operatorType, filters.operatorType as any));
    if (filters?.status) conditions.push(eq(operators.status, filters.status as any));
    if (conditions.length > 0) {
      return db.select().from(operators).where(and(...conditions)).orderBy(asc(operators.displayName));
    }
    return db.select().from(operators).orderBy(asc(operators.displayName));
  }

  async getActiveOperatorsForTerritory(territoryId: string): Promise<(OperatorTerritory & { operator: Operator })[]> {
    const results = await db
      .select()
      .from(operatorTerritories)
      .innerJoin(operators, eq(operatorTerritories.operatorId, operators.id))
      .where(and(
        eq(operatorTerritories.territoryId, territoryId),
        eq(operators.status, "ACTIVE")
      ));
    return results.map(r => ({ ...r.operator_territories, operator: r.operators }));
  }

  async assignOperatorToTerritory(data: InsertOperatorTerritory): Promise<OperatorTerritory> {
    const [assignment] = await db.insert(operatorTerritories).values(data).returning();
    return assignment;
  }

  async removeOperatorFromTerritory(id: string): Promise<void> {
    await db.delete(operatorTerritories).where(eq(operatorTerritories.id, id));
  }

  async getOperatorTerritories(operatorId: string): Promise<OperatorTerritory[]> {
    return db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
  }

  async createTerritoryListing(data: InsertTerritoryListing): Promise<TerritoryListing> {
    const [listing] = await db.insert(territoryListings).values(data).returning();
    return listing;
  }

  async getTerritoryListing(id: string): Promise<TerritoryListing | undefined> {
    const [listing] = await db.select().from(territoryListings).where(eq(territoryListings.id, id));
    return listing;
  }

  async listTerritoryListings(territoryId?: string): Promise<TerritoryListing[]> {
    if (territoryId) {
      return db.select().from(territoryListings).where(eq(territoryListings.territoryId, territoryId)).orderBy(desc(territoryListings.createdAt));
    }
    return db.select().from(territoryListings).orderBy(desc(territoryListings.createdAt));
  }

  async createRevenueTransaction(data: InsertRevenueTransaction): Promise<RevenueTransaction> {
    const [txn] = await db.insert(revenueTransactions).values(data).returning();
    return txn;
  }

  async getRevenueTransaction(id: string): Promise<RevenueTransaction | undefined> {
    const [txn] = await db.select().from(revenueTransactions).where(eq(revenueTransactions.id, id));
    return txn;
  }

  async listRevenueTransactions(filters?: { territoryListingId?: string }): Promise<RevenueTransaction[]> {
    if (filters?.territoryListingId) {
      return db.select().from(revenueTransactions).where(eq(revenueTransactions.territoryListingId, filters.territoryListingId)).orderBy(desc(revenueTransactions.createdAt));
    }
    return db.select().from(revenueTransactions).orderBy(desc(revenueTransactions.createdAt));
  }

  async createRevenueSplit(data: InsertRevenueSplit): Promise<RevenueSplit> {
    const [split] = await db.insert(revenueSplits).values(data).returning();
    return split;
  }

  async listSplitsByTransaction(transactionId: string): Promise<RevenueSplit[]> {
    return db.select().from(revenueSplits).where(eq(revenueSplits.transactionId, transactionId));
  }

  async listSplitsByOperator(operatorId: string): Promise<RevenueSplit[]> {
    return db.select().from(revenueSplits).where(eq(revenueSplits.operatorId, operatorId)).orderBy(desc(revenueSplits.createdAt));
  }

  async updateSplitStatus(id: string, status: string): Promise<RevenueSplit | undefined> {
    const [split] = await db.update(revenueSplits).set({ status: status as any }).where(eq(revenueSplits.id, id)).returning();
    return split;
  }

  async listAllSplits(filters?: { status?: string; operatorId?: string }): Promise<RevenueSplit[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(revenueSplits.status, filters.status as any));
    if (filters?.operatorId) conditions.push(eq(revenueSplits.operatorId, filters.operatorId));
    if (conditions.length > 0) {
      return db.select().from(revenueSplits).where(and(...conditions)).orderBy(desc(revenueSplits.createdAt));
    }
    return db.select().from(revenueSplits).orderBy(desc(revenueSplits.createdAt));
  }

  async updateRevenueSplit(id: string, data: Partial<InsertRevenueSplit>): Promise<RevenueSplit | undefined> {
    const [split] = await db.update(revenueSplits).set(data).where(eq(revenueSplits.id, id)).returning();
    return split;
  }

  async getLiveFeedsByCityId(cityId: string, activeOnly = true): Promise<LiveFeed[]> {
    const conditions = [eq(liveFeeds.cityId, cityId)];
    if (activeOnly) conditions.push(eq(liveFeeds.isActive, true));
    return db.select().from(liveFeeds).where(and(...conditions)).orderBy(asc(liveFeeds.sortOrder), asc(liveFeeds.createdAt));
  }

  async getLiveFeedById(id: string): Promise<LiveFeed | undefined> {
    const [feed] = await db.select().from(liveFeeds).where(eq(liveFeeds.id, id)).limit(1);
    return feed;
  }

  async createLiveFeed(data: InsertLiveFeed): Promise<LiveFeed> {
    const [feed] = await db.insert(liveFeeds).values(data).returning();
    return feed;
  }

  async updateLiveFeed(id: string, data: Partial<InsertLiveFeed>): Promise<LiveFeed | undefined> {
    const [feed] = await db.update(liveFeeds).set(data).where(eq(liveFeeds.id, id)).returning();
    return feed;
  }

  async deleteLiveFeed(id: string): Promise<void> {
    await db.delete(liveFeeds).where(eq(liveFeeds.id, id));
  }

  async getAllLiveFeeds(): Promise<LiveFeed[]> {
    return db.select().from(liveFeeds).orderBy(asc(liveFeeds.sortOrder), asc(liveFeeds.createdAt));
  }

  async getSmsMessagesByContact(contactId: string): Promise<SmsMessage[]> {
    return db.select().from(smsMessages).where(eq(smsMessages.contactId, contactId)).orderBy(asc(smsMessages.createdAt));
  }

  async createSmsMessage(data: InsertSmsMessage): Promise<SmsMessage> {
    const [msg] = await db.insert(smsMessages).values(data).returning();
    return msg;
  }

  async getSmsConversations(cityId?: string): Promise<{ contactId: string; lastMessage: string; lastAt: string; contactName?: string; contactPhone?: string; unreadCount: number }[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (sm.contact_id)
        sm.contact_id as "contactId",
        sm.body as "lastMessage",
        sm.created_at as "lastAt",
        sm.to_number as "contactPhone",
        cc.name as "contactName",
        0 as "unreadCount"
      FROM sms_messages sm
      LEFT JOIN crm_contacts cc ON cc.id = sm.contact_id
      ${cityId ? sql`WHERE sm.city_id = ${cityId}` : sql``}
      ORDER BY sm.contact_id, sm.created_at DESC
    `);
    return (result.rows || []) as any;
  }

  async getRecentSmsMessages(limit = 50): Promise<SmsMessage[]> {
    return db.select().from(smsMessages).orderBy(desc(smsMessages.createdAt)).limit(limit);
  }

  // TV Screens
  async createTvScreen(data: InsertTvScreen): Promise<TvScreen> {
    const [screen] = await db.insert(tvScreens).values(data).returning();
    return screen;
  }

  async getTvScreens(filters?: { cityId?: string; hubSlug?: string; status?: string }): Promise<TvScreen[]> {
    const conditions: any[] = [];
    if (filters?.cityId) conditions.push(eq(tvScreens.cityId, filters.cityId));
    if (filters?.hubSlug) conditions.push(eq(tvScreens.hubSlug, filters.hubSlug));
    if (filters?.status) conditions.push(eq(tvScreens.status, filters.status as any));
    return db.select().from(tvScreens)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tvScreens.createdAt));
  }

  async getTvScreen(id: string): Promise<TvScreen | undefined> {
    const [screen] = await db.select().from(tvScreens).where(eq(tvScreens.id, id)).limit(1);
    return screen;
  }

  async getTvScreenByKey(screenKey: string): Promise<TvScreen | undefined> {
    const [screen] = await db.select().from(tvScreens).where(eq(tvScreens.screenKey, screenKey)).limit(1);
    return screen;
  }

  async updateTvScreen(id: string, data: Partial<InsertTvScreen>): Promise<TvScreen | undefined> {
    const [screen] = await db.update(tvScreens).set({ ...data, updatedAt: new Date() }).where(eq(tvScreens.id, id)).returning();
    return screen;
  }

  async deleteTvScreen(id: string): Promise<void> {
    await db.delete(tvScreens).where(eq(tvScreens.id, id));
  }

  async updateScreenHeartbeat(screenKey: string): Promise<void> {
    await db.update(tvScreens).set({ lastHeartbeatAt: new Date() }).where(eq(tvScreens.screenKey, screenKey));
  }

  // TV Items
  async createTvItem(data: InsertTvItem): Promise<TvItem> {
    const [item] = await db.insert(tvItems).values(data).returning();
    return item;
  }

  async getTvItems(filters?: { sourceScope?: string; hubSlug?: string; type?: string; enabled?: boolean; cityId?: string; contentFamily?: string }): Promise<TvItem[]> {
    const conditions: any[] = [];
    if (filters?.sourceScope) conditions.push(eq(tvItems.sourceScope, filters.sourceScope as any));
    if (filters?.hubSlug) conditions.push(eq(tvItems.hubSlug, filters.hubSlug));
    if (filters?.type) conditions.push(eq(tvItems.type, filters.type as any));
    if (filters?.enabled !== undefined) conditions.push(eq(tvItems.enabled, filters.enabled));
    if (filters?.cityId) conditions.push(eq(tvItems.cityId, filters.cityId));
    if (filters?.contentFamily) conditions.push(eq(tvItems.contentFamily, filters.contentFamily));
    return db.select().from(tvItems)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tvItems.priority), desc(tvItems.createdAt));
  }

  async getTvItem(id: string): Promise<TvItem | undefined> {
    const [item] = await db.select().from(tvItems).where(eq(tvItems.id, id)).limit(1);
    return item;
  }

  async updateTvItem(id: string, data: Partial<InsertTvItem>): Promise<TvItem | undefined> {
    const [item] = await db.update(tvItems).set({ ...data, updatedAt: new Date() }).where(eq(tvItems.id, id)).returning();
    return item;
  }

  async deleteTvItem(id: string): Promise<void> {
    await db.delete(tvItems).where(eq(tvItems.id, id));
  }

  // TV Placements
  async createTvPlacement(data: InsertTvPlacement): Promise<TvPlacement> {
    const [placement] = await db.insert(tvPlacements).values(data).returning();
    return placement;
  }

  async getTvPlacements(filters?: { cityId?: string; hubSlug?: string; enabled?: boolean }): Promise<TvPlacement[]> {
    const conditions: any[] = [];
    if (filters?.cityId) conditions.push(eq(tvPlacements.cityId, filters.cityId));
    if (filters?.hubSlug) conditions.push(eq(tvPlacements.hubSlug, filters.hubSlug));
    if (filters?.enabled !== undefined) conditions.push(eq(tvPlacements.enabled, filters.enabled));
    return db.select().from(tvPlacements)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tvPlacements.createdAt));
  }

  async getTvPlacement(id: string): Promise<TvPlacement | undefined> {
    const [placement] = await db.select().from(tvPlacements).where(eq(tvPlacements.id, id)).limit(1);
    return placement;
  }

  async updateTvPlacement(id: string, data: Partial<InsertTvPlacement>): Promise<TvPlacement | undefined> {
    const [placement] = await db.update(tvPlacements).set({ ...data, updatedAt: new Date() }).where(eq(tvPlacements.id, id)).returning();
    return placement;
  }

  async deleteTvPlacement(id: string): Promise<void> {
    await db.delete(tvPlacements).where(eq(tvPlacements.id, id));
  }

  async createTvQrScan(data: InsertTvQrScan): Promise<TvQrScan> {
    const [scan] = await db.insert(tvQrScans).values(data).returning();
    return scan;
  }

  async getTvQrScans(filters?: { hubSlug?: string; screenId?: string; templateKey?: string; since?: Date }): Promise<TvQrScan[]> {
    const conditions: SQL[] = [];
    if (filters?.hubSlug) conditions.push(eq(tvQrScans.hubSlug, filters.hubSlug));
    if (filters?.screenId) conditions.push(eq(tvQrScans.screenId, filters.screenId));
    if (filters?.templateKey) conditions.push(eq(tvQrScans.templateKey, filters.templateKey));
    if (filters?.since) conditions.push(gte(tvQrScans.scannedAt, filters.since));
    return db.select().from(tvQrScans).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(tvQrScans.scannedAt)).limit(1000);
  }

  async createTvPlayLog(data: InsertTvPlayLog): Promise<TvPlayLog> {
    const [log] = await db.insert(tvPlayLogs).values(data).returning();
    return log;
  }

  async getTvPlayLogs(filters?: { screenKey?: string; hubSlug?: string; since?: Date; limit?: number }): Promise<TvPlayLog[]> {
    const conditions: SQL[] = [];
    if (filters?.screenKey) conditions.push(eq(tvPlayLogs.screenKey, filters.screenKey));
    if (filters?.hubSlug) conditions.push(eq(tvPlayLogs.hubSlug, filters.hubSlug));
    if (filters?.since) conditions.push(gte(tvPlayLogs.playedAt, filters.since));
    return db.select().from(tvPlayLogs).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(tvPlayLogs.playedAt)).limit(filters?.limit || 200);
  }

  async getTvPlayLogStats(filters?: { hubSlug?: string; screenKey?: string; since?: Date }): Promise<{ total: number; byTemplate: Record<string, number> }> {
    const conditions: SQL[] = [];
    if (filters?.hubSlug) conditions.push(eq(tvPlayLogs.hubSlug, filters.hubSlug));
    if (filters?.screenKey) conditions.push(eq(tvPlayLogs.screenKey, filters.screenKey));
    if (filters?.since) conditions.push(gte(tvPlayLogs.playedAt, filters.since));
    const rows = await db.select().from(tvPlayLogs).where(conditions.length ? and(...conditions) : undefined);
    const byTemplate: Record<string, number> = {};
    for (const r of rows) {
      const key = r.templateKey || "unknown";
      byTemplate[key] = (byTemplate[key] || 0) + 1;
    }
    return { total: rows.length, byTemplate };
  }

  async getScreensByGroup(groupId: string): Promise<TvScreen[]> {
    return db.select().from(tvScreens).where(eq(tvScreens.screenGroupId, groupId));
  }

  // TV Loops
  async createTvLoop(data: InsertTvLoop): Promise<TvLoop> {
    const [loop] = await db.insert(tvLoops).values(data).returning();
    return loop;
  }

  async getTvLoop(id: string): Promise<TvLoop | undefined> {
    const [loop] = await db.select().from(tvLoops).where(eq(tvLoops.id, id)).limit(1);
    return loop;
  }

  async getTvLoops(filters?: { enabled?: boolean; theme?: string; daytimeTags?: string[] }): Promise<TvLoop[]> {
    const conditions: SQL[] = [];
    if (filters?.enabled !== undefined) conditions.push(eq(tvLoops.enabled, filters.enabled));
    if (filters?.theme) conditions.push(eq(tvLoops.theme, filters.theme));
    if (filters?.daytimeTags && filters.daytimeTags.length > 0) {
      for (const tag of filters.daytimeTags) {
        conditions.push(sql`${tvLoops.daytimeTags} @> ARRAY[${tag}]::text[]`);
      }
    }
    return db.select().from(tvLoops)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tvLoops.createdAt));
  }

  async updateTvLoop(id: string, data: Partial<InsertTvLoop>): Promise<TvLoop | undefined> {
    const [loop] = await db.update(tvLoops).set({ ...data, updatedAt: new Date() }).where(eq(tvLoops.id, id)).returning();
    return loop;
  }

  async deleteTvLoop(id: string): Promise<void> {
    await db.delete(tvLoopItems).where(eq(tvLoopItems.loopId, id));
    await db.delete(tvLoops).where(eq(tvLoops.id, id));
  }

  // TV Loop Items
  async createTvLoopItem(data: InsertTvLoopItem): Promise<TvLoopItem> {
    const [item] = await db.insert(tvLoopItems).values(data).returning();
    return item;
  }

  async getTvLoopItems(loopId: string): Promise<TvLoopItem[]> {
    return db.select().from(tvLoopItems)
      .where(eq(tvLoopItems.loopId, loopId))
      .orderBy(asc(tvLoopItems.position));
  }

  async updateTvLoopItem(id: string, data: Partial<InsertTvLoopItem>): Promise<TvLoopItem | undefined> {
    const [item] = await db.update(tvLoopItems).set(data).where(eq(tvLoopItems.id, id)).returning();
    return item;
  }

  async deleteTvLoopItem(id: string): Promise<void> {
    await db.delete(tvLoopItems).where(eq(tvLoopItems.id, id));
  }

  async bulkReplaceTvLoopItems(loopId: string, items: InsertTvLoopItem[]): Promise<TvLoopItem[]> {
    await db.delete(tvLoopItems).where(eq(tvLoopItems.loopId, loopId));
    if (items.length === 0) return [];
    const inserted = await db.insert(tvLoopItems).values(items.map((item, idx) => ({ ...item, loopId, position: item.position ?? idx }))).returning();
    return inserted;
  }

  // TV Schedules
  async createTvSchedule(data: InsertTvSchedule): Promise<TvSchedule> {
    const [schedule] = await db.insert(tvSchedules).values(data).returning();
    return schedule;
  }

  async getTvSchedule(id: string): Promise<TvSchedule | undefined> {
    const [schedule] = await db.select().from(tvSchedules).where(eq(tvSchedules.id, id)).limit(1);
    return schedule;
  }

  async getTvSchedules(filters?: { screenId?: string; hubSlug?: string }): Promise<TvSchedule[]> {
    const conditions: SQL[] = [];
    if (filters?.screenId) conditions.push(eq(tvSchedules.screenId, filters.screenId));
    if (filters?.hubSlug) conditions.push(eq(tvSchedules.hubSlug, filters.hubSlug));
    return db.select().from(tvSchedules)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tvSchedules.createdAt));
  }

  async updateTvSchedule(id: string, data: Partial<InsertTvSchedule>): Promise<TvSchedule | undefined> {
    const [schedule] = await db.update(tvSchedules).set({ ...data, updatedAt: new Date() }).where(eq(tvSchedules.id, id)).returning();
    return schedule;
  }

  async deleteTvSchedule(id: string): Promise<void> {
    await db.delete(tvSchedules).where(eq(tvSchedules.id, id));
  }

  // TV Host Phrases
  async createTvHostPhrase(data: InsertTvHostPhrase): Promise<TvHostPhrase> {
    const [phrase] = await db.insert(tvHostPhrases).values(data).returning();
    return phrase;
  }

  async getTvHostPhrases(filters?: { category?: string; theme?: string }): Promise<TvHostPhrase[]> {
    const conditions: SQL[] = [];
    if (filters?.category) conditions.push(eq(tvHostPhrases.category, filters.category));
    if (filters?.theme) conditions.push(eq(tvHostPhrases.theme, filters.theme));
    return db.select().from(tvHostPhrases)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tvHostPhrases.createdAt));
  }

  async updateTvHostPhrase(id: string, data: Partial<InsertTvHostPhrase>): Promise<TvHostPhrase | undefined> {
    const [phrase] = await db.update(tvHostPhrases).set(data).where(eq(tvHostPhrases.id, id)).returning();
    return phrase;
  }

  async deleteTvHostPhrase(id: string): Promise<void> {
    await db.delete(tvHostPhrases).where(eq(tvHostPhrases.id, id));
  }

  async getRandomTvHostPhrase(category: string): Promise<TvHostPhrase | undefined> {
    const [phrase] = await db.select().from(tvHostPhrases)
      .where(and(eq(tvHostPhrases.category, category), eq(tvHostPhrases.enabled, true)))
      .orderBy(sql`RANDOM()`)
      .limit(1);
    return phrase;
  }

  // Venue Channels
  async getVenueChannel(id: string): Promise<VenueChannel | undefined> {
    const [channel] = await db.select().from(venueChannels).where(eq(venueChannels.id, id)).limit(1);
    return channel;
  }

  async getVenueChannelByBusinessId(businessId: string): Promise<VenueChannel | undefined> {
    const [channel] = await db.select().from(venueChannels).where(eq(venueChannels.businessId, businessId)).limit(1);
    return channel;
  }

  async getVenueChannelBySlug(slug: string): Promise<VenueChannel | undefined> {
    const [channel] = await db.select().from(venueChannels).where(eq(venueChannels.channelSlug, slug)).limit(1);
    return channel;
  }

  async listVenueChannels(cityId?: string, filters?: { status?: string }): Promise<VenueChannel[]> {
    const conditions: SQL[] = [];
    if (cityId) conditions.push(eq(venueChannels.cityId, cityId));
    if (filters?.status) conditions.push(eq(venueChannels.channelStatus, filters.status as any));
    return db.select().from(venueChannels)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(venueChannels.createdAt));
  }

  async createVenueChannel(data: InsertVenueChannel): Promise<VenueChannel> {
    const [channel] = await db.insert(venueChannels).values(data).returning();
    return channel;
  }

  async updateVenueChannel(id: string, data: Partial<InsertVenueChannel>): Promise<VenueChannel | undefined> {
    const [channel] = await db.update(venueChannels).set({ ...data, updatedAt: new Date() }).where(eq(venueChannels.id, id)).returning();
    return channel;
  }

  async deleteVenueChannel(id: string): Promise<void> {
    await db.delete(venueChannels).where(eq(venueChannels.id, id));
  }

  // Video Content
  async getVideoContent(id: string): Promise<VideoContent | undefined> {
    const [video] = await db.select().from(videoContent).where(eq(videoContent.id, id)).limit(1);
    return video;
  }

  async listVideosByChannel(channelId: string): Promise<VideoContent[]> {
    return db.select().from(videoContent)
      .where(eq(videoContent.venueChannelId, channelId))
      .orderBy(videoContent.sortOrder, desc(videoContent.createdAt));
  }

  async listVideosByCity(cityId: string, filters?: { screenEligible?: boolean; pulseEligible?: boolean; businessId?: string }): Promise<VideoContent[]> {
    const conditions: SQL[] = [eq(videoContent.cityId, cityId)];
    if (filters?.screenEligible !== undefined) conditions.push(eq(videoContent.screenEligible, filters.screenEligible));
    if (filters?.pulseEligible !== undefined) conditions.push(eq(videoContent.pulseEligible, filters.pulseEligible));
    if (filters?.businessId) conditions.push(eq(videoContent.businessId, filters.businessId));
    return db.select().from(videoContent)
      .where(and(...conditions))
      .orderBy(desc(videoContent.createdAt));
  }

  async createVideoContent(data: InsertVideoContent): Promise<VideoContent> {
    const [video] = await db.insert(videoContent).values(data).returning();
    return video;
  }

  async updateVideoContent(id: string, data: Partial<InsertVideoContent>): Promise<VideoContent | undefined> {
    const [video] = await db.update(videoContent).set(data).where(eq(videoContent.id, id)).returning();
    return video;
  }

  async deleteVideoContent(id: string): Promise<void> {
    await db.delete(videoContent).where(eq(videoContent.id, id));
  }

  // Live Sessions
  async getLiveSession(id: string): Promise<LiveSession | undefined> {
    const [session] = await db.select().from(liveSessions).where(eq(liveSessions.id, id)).limit(1);
    return session;
  }

  async getActiveLiveSessions(cityId: string): Promise<LiveSession[]> {
    return db.select().from(liveSessions)
      .where(and(
        eq(liveSessions.cityId, cityId),
        sql`${liveSessions.status} IN ('live', 'scheduled')`
      ))
      .orderBy(desc(liveSessions.createdAt));
  }

  async getLiveSessionByBusiness(businessId: string): Promise<LiveSession | undefined> {
    const [session] = await db.select().from(liveSessions)
      .where(and(eq(liveSessions.businessId, businessId), eq(liveSessions.status, "live")))
      .limit(1);
    return session;
  }

  async createLiveSession(data: InsertLiveSession): Promise<LiveSession> {
    const [session] = await db.insert(liveSessions).values(data).returning();
    return session;
  }

  async updateLiveSession(id: string, data: Partial<InsertLiveSession>): Promise<LiveSession | undefined> {
    const [session] = await db.update(liveSessions).set(data).where(eq(liveSessions.id, id)).returning();
    return session;
  }

  // Offers
  async getOffer(id: string): Promise<Offer | undefined> {
    const [offer] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
    return offer;
  }

  async listOffersByBusiness(businessId: string): Promise<Offer[]> {
    return db.select().from(offers)
      .where(eq(offers.businessId, businessId))
      .orderBy(desc(offers.createdAt));
  }

  async listActiveOffers(cityId: string): Promise<Offer[]> {
    return db.select().from(offers)
      .where(and(eq(offers.cityId, cityId), eq(offers.active, true)))
      .orderBy(desc(offers.createdAt));
  }

  async createOffer(data: InsertOffer): Promise<Offer> {
    const [offer] = await db.insert(offers).values(data).returning();
    return offer;
  }

  async updateOffer(id: string, data: Partial<InsertOffer>): Promise<Offer | undefined> {
    const [offer] = await db.update(offers).set({ ...data, updatedAt: new Date() }).where(eq(offers.id, id)).returning();
    return offer;
  }

  async deleteOffer(id: string): Promise<void> {
    await db.delete(offers).where(eq(offers.id, id));
  }

  // Transactions
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return txn;
  }

  async listTransactionsByOffer(offerId: string): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(eq(transactions.offerId, offerId))
      .orderBy(desc(transactions.createdAt));
  }

  async listTransactionsByBusiness(businessId: string, filters?: { startDate?: Date; endDate?: Date }): Promise<Transaction[]> {
    const conditions: SQL[] = [eq(transactions.businessId, businessId)];
    if (filters?.startDate) conditions.push(sql`${transactions.createdAt} >= ${filters.startDate}`);
    if (filters?.endDate) conditions.push(sql`${transactions.createdAt} <= ${filters.endDate}`);
    return db.select().from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [txn] = await db.insert(transactions).values(data).returning();
    return txn;
  }

  async updateTransaction(id: string, data: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [txn] = await db.update(transactions).set(data).where(eq(transactions.id, id)).returning();
    return txn;
  }

  async getDigitalCardBySlug(slug: string): Promise<DigitalCard | undefined> {
    const [card] = await db.select().from(digitalCards).where(eq(digitalCards.slug, slug)).limit(1);
    return card;
  }

  async createCardBooking(data: InsertCardBooking): Promise<CardBooking> {
    const [booking] = await db.insert(cardBookings).values(data).returning();
    return booking;
  }

  // Live Broadcasts
  async getLiveBroadcast(id: string): Promise<LiveBroadcast | undefined> {
    const [broadcast] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, id)).limit(1);
    return broadcast;
  }

  async getActiveBroadcasts(): Promise<LiveBroadcast[]> {
    return db.select().from(liveBroadcasts)
      .where(or(
        eq(liveBroadcasts.status, "live"),
        eq(liveBroadcasts.status, "scheduled")
      ))
      .orderBy(desc(liveBroadcasts.scheduledStartAt));
  }

  async getAllBroadcasts(): Promise<LiveBroadcast[]> {
    return db.select().from(liveBroadcasts)
      .orderBy(desc(liveBroadcasts.createdAt));
  }

  async createLiveBroadcast(data: InsertLiveBroadcast): Promise<LiveBroadcast> {
    const [broadcast] = await db.insert(liveBroadcasts).values(data).returning();
    return broadcast;
  }

  async updateLiveBroadcast(id: string, data: Partial<InsertLiveBroadcast>): Promise<LiveBroadcast | undefined> {
    const [broadcast] = await db.update(liveBroadcasts).set(data).where(eq(liveBroadcasts.id, id)).returning();
    return broadcast;
  }

  async deleteLiveBroadcast(id: string): Promise<void> {
    await db.delete(liveBroadcasts).where(eq(liveBroadcasts.id, id));
  }

  async getRadioStationById(id: string): Promise<RadioStation | undefined> {
    const [station] = await db.select().from(radioStations).where(eq(radioStations.id, id)).limit(1);
    return station;
  }

  async getRadioStationBySlug(slug: string): Promise<RadioStation | undefined> {
    const [station] = await db.select().from(radioStations).where(eq(radioStations.slug, slug)).limit(1);
    return station;
  }

  async listRadioStations(filters?: { status?: string; stationType?: string; cityId?: string }): Promise<RadioStation[]> {
    const conditions: SQL[] = [];
    if (filters?.status) conditions.push(eq(radioStations.status, filters.status as any));
    if (filters?.stationType) conditions.push(eq(radioStations.stationType, filters.stationType as any));
    if (filters?.cityId) conditions.push(eq(radioStations.cityId, filters.cityId));
    return conditions.length > 0
      ? db.select().from(radioStations).where(and(...conditions)).orderBy(desc(radioStations.createdAt))
      : db.select().from(radioStations).orderBy(desc(radioStations.createdAt));
  }

  async createRadioStation(data: InsertRadioStation): Promise<RadioStation> {
    const [station] = await db.insert(radioStations).values(data).returning();
    return station;
  }

  async updateRadioStation(id: string, data: Partial<InsertRadioStation>): Promise<RadioStation | undefined> {
    const [station] = await db.update(radioStations).set({ ...data, updatedAt: new Date() }).where(eq(radioStations.id, id)).returning();
    return station;
  }

  async deleteRadioStation(id: string): Promise<void> {
    await db.delete(radioStations).where(eq(radioStations.id, id));
  }

  async getRadioSegmentById(id: string): Promise<RadioSegment | undefined> {
    const [segment] = await db.select().from(radioSegments).where(eq(radioSegments.id, id)).limit(1);
    return segment;
  }

  async listRadioSegments(stationId: string, filters?: { status?: string }): Promise<RadioSegment[]> {
    const conditions: SQL[] = [eq(radioSegments.stationId, stationId)];
    if (filters?.status) conditions.push(eq(radioSegments.status, filters.status as any));
    return db.select().from(radioSegments).where(and(...conditions)).orderBy(asc(radioSegments.priority), asc(radioSegments.scheduledAt));
  }

  async createRadioSegment(data: InsertRadioSegment): Promise<RadioSegment> {
    const [segment] = await db.insert(radioSegments).values(data).returning();
    return segment;
  }

  async updateRadioSegment(id: string, data: Partial<InsertRadioSegment>): Promise<RadioSegment | undefined> {
    const [segment] = await db.update(radioSegments).set(data).where(eq(radioSegments.id, id)).returning();
    return segment;
  }

  async deleteRadioSegment(id: string): Promise<void> {
    await db.delete(radioSegments).where(eq(radioSegments.id, id));
  }

  async getLocalPodcasts(filters?: { status?: string; category?: string; cityId?: string; featured?: boolean; q?: string }): Promise<LocalPodcast[]> {
    const conditions: SQL[] = [];
    if (filters?.status) conditions.push(eq(localPodcasts.status, filters.status as any));
    if (filters?.category) conditions.push(eq(localPodcasts.category, filters.category));
    if (filters?.cityId) conditions.push(eq(localPodcasts.cityId, filters.cityId));
    if (filters?.featured !== undefined) conditions.push(eq(localPodcasts.featured, filters.featured));
    if (filters?.q) conditions.push(or(ilike(localPodcasts.name, `%${filters.q}%`), ilike(localPodcasts.hostName, `%${filters.q}%`))!);
    return db.select().from(localPodcasts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(localPodcasts.createdAt));
  }

  async getLocalPodcastById(id: string): Promise<LocalPodcast | undefined> {
    const [podcast] = await db.select().from(localPodcasts).where(eq(localPodcasts.id, id)).limit(1);
    return podcast;
  }

  async getLocalPodcastBySlug(slug: string): Promise<LocalPodcast | undefined> {
    const [podcast] = await db.select().from(localPodcasts).where(eq(localPodcasts.slug, slug)).limit(1);
    return podcast;
  }

  async createLocalPodcast(data: InsertLocalPodcast): Promise<LocalPodcast> {
    const [podcast] = await db.insert(localPodcasts).values(data).returning();
    return podcast;
  }

  async updateLocalPodcast(id: string, data: Partial<InsertLocalPodcast>): Promise<LocalPodcast | undefined> {
    const [podcast] = await db.update(localPodcasts).set({ ...data, updatedAt: new Date() }).where(eq(localPodcasts.id, id)).returning();
    return podcast;
  }

  async deleteLocalPodcast(id: string): Promise<void> {
    await db.delete(localPodcasts).where(eq(localPodcasts.id, id));
  }

  async getLocalPodcastEpisodes(podcastId: string, limit = 50, offset = 0): Promise<LocalPodcastEpisode[]> {
    return db.select().from(localPodcastEpisodes)
      .where(eq(localPodcastEpisodes.podcastId, podcastId))
      .orderBy(desc(localPodcastEpisodes.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  async getLocalPodcastEpisodeById(id: string): Promise<LocalPodcastEpisode | undefined> {
    const [episode] = await db.select().from(localPodcastEpisodes).where(eq(localPodcastEpisodes.id, id)).limit(1);
    return episode;
  }

  async createLocalPodcastEpisode(data: InsertLocalPodcastEpisode): Promise<LocalPodcastEpisode> {
    const [episode] = await db.insert(localPodcastEpisodes).values(data).returning();
    return episode;
  }

  async deleteLocalPodcastEpisode(id: string): Promise<void> {
    await db.delete(localPodcastEpisodes).where(eq(localPodcastEpisodes.id, id));
  }

  async getMusicArtists(filters?: { status?: string; genre?: string; cityId?: string; q?: string }): Promise<MusicArtist[]> {
    const conditions: SQL[] = [];
    if (filters?.status) conditions.push(eq(musicArtists.status, filters.status as any));
    if (filters?.genre) conditions.push(eq(musicArtists.genre, filters.genre));
    if (filters?.cityId) conditions.push(eq(musicArtists.cityId, filters.cityId));
    if (filters?.q) conditions.push(ilike(musicArtists.name, `%${filters.q}%`));
    return db.select().from(musicArtists)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(musicArtists.createdAt));
  }

  async getMusicArtistById(id: string): Promise<MusicArtist | undefined> {
    const [artist] = await db.select().from(musicArtists).where(eq(musicArtists.id, id)).limit(1);
    return artist;
  }

  async getMusicArtistBySlug(slug: string): Promise<MusicArtist | undefined> {
    const [artist] = await db.select().from(musicArtists).where(eq(musicArtists.slug, slug)).limit(1);
    return artist;
  }

  async createMusicArtist(data: InsertMusicArtist): Promise<MusicArtist> {
    const [artist] = await db.insert(musicArtists).values(data).returning();
    return artist;
  }

  async updateMusicArtist(id: string, data: Partial<InsertMusicArtist>): Promise<MusicArtist | undefined> {
    const [artist] = await db.update(musicArtists).set({ ...data, updatedAt: new Date() }).where(eq(musicArtists.id, id)).returning();
    return artist;
  }

  async deleteMusicArtist(id: string): Promise<void> {
    await db.delete(musicArtists).where(eq(musicArtists.id, id));
  }

  async getMusicTracks(filters?: { status?: string; genre?: string; artistId?: string; cityId?: string }): Promise<MusicTrack[]> {
    const conditions: SQL[] = [];
    if (filters?.status) conditions.push(eq(musicTracks.status, filters.status as any));
    if (filters?.genre) conditions.push(eq(musicTracks.genre, filters.genre));
    if (filters?.artistId) conditions.push(eq(musicTracks.artistId, filters.artistId));
    if (filters?.cityId) conditions.push(eq(musicTracks.cityId, filters.cityId));
    return db.select().from(musicTracks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(musicTracks.createdAt));
  }

  async getMusicTrackById(id: string): Promise<MusicTrack | undefined> {
    const [track] = await db.select().from(musicTracks).where(eq(musicTracks.id, id)).limit(1);
    return track;
  }

  async createMusicTrack(data: InsertMusicTrack): Promise<MusicTrack> {
    const [track] = await db.insert(musicTracks).values(data).returning();
    return track;
  }

  async updateMusicTrack(id: string, data: Partial<InsertMusicTrack>): Promise<MusicTrack | undefined> {
    const [track] = await db.update(musicTracks).set({ ...data, updatedAt: new Date() }).where(eq(musicTracks.id, id)).returning();
    return track;
  }

  async deleteMusicTrack(id: string): Promise<void> {
    await db.delete(musicTracks).where(eq(musicTracks.id, id));
  }

  async getMusicMoodPresets(cityId?: string): Promise<MusicMoodPreset[]> {
    if (cityId) {
      return db.select().from(musicMoodPresets).where(eq(musicMoodPresets.cityId, cityId)).orderBy(asc(musicMoodPresets.sortOrder));
    }
    return db.select().from(musicMoodPresets).orderBy(asc(musicMoodPresets.sortOrder));
  }

  async getMusicMoodPresetById(id: string): Promise<MusicMoodPreset | undefined> {
    const [preset] = await db.select().from(musicMoodPresets).where(eq(musicMoodPresets.id, id)).limit(1);
    return preset;
  }

  async createMusicMoodPreset(data: InsertMusicMoodPreset): Promise<MusicMoodPreset> {
    const [preset] = await db.insert(musicMoodPresets).values(data).returning();
    return preset;
  }

  async updateMusicMoodPreset(id: string, data: Partial<InsertMusicMoodPreset>): Promise<MusicMoodPreset | undefined> {
    const [preset] = await db.update(musicMoodPresets).set({ ...data, updatedAt: new Date() }).where(eq(musicMoodPresets.id, id)).returning();
    return preset;
  }

  async deleteMusicMoodPreset(id: string): Promise<void> {
    await db.delete(musicMoodPresets).where(eq(musicMoodPresets.id, id));
  }

  async getVenueAudioProfiles(): Promise<VenueAudioProfile[]> {
    return db.select().from(venueAudioProfiles).orderBy(desc(venueAudioProfiles.createdAt));
  }

  async getVenueAudioProfileByScreenId(screenId: string): Promise<VenueAudioProfile | undefined> {
    const [profile] = await db.select().from(venueAudioProfiles).where(eq(venueAudioProfiles.screenId, screenId)).limit(1);
    return profile;
  }

  async getVenueAudioProfileById(id: string): Promise<VenueAudioProfile | undefined> {
    const [profile] = await db.select().from(venueAudioProfiles).where(eq(venueAudioProfiles.id, id)).limit(1);
    return profile;
  }

  async createVenueAudioProfile(data: InsertVenueAudioProfile): Promise<VenueAudioProfile> {
    const [profile] = await db.insert(venueAudioProfiles).values(data).returning();
    return profile;
  }

  async updateVenueAudioProfile(id: string, data: Partial<InsertVenueAudioProfile>): Promise<VenueAudioProfile | undefined> {
    const [profile] = await db.update(venueAudioProfiles).set({ ...data, updatedAt: new Date() }).where(eq(venueAudioProfiles.id, id)).returning();
    return profile;
  }

  async getAmbassadorsByCityId(cityId: string): Promise<Ambassador[]> {
    return db.select().from(ambassadors).where(eq(ambassadors.cityId, cityId)).orderBy(desc(ambassadors.createdAt));
  }

  async getAmbassadorById(id: string): Promise<Ambassador | undefined> {
    const [row] = await db.select().from(ambassadors).where(eq(ambassadors.id, id)).limit(1);
    return row;
  }

  async getAmbassadorByReferralCode(code: string): Promise<Ambassador | undefined> {
    const [row] = await db.select().from(ambassadors).where(eq(ambassadors.referralCode, code)).limit(1);
    return row;
  }

  async getAmbassadorByEmail(email: string, cityId: string): Promise<Ambassador | undefined> {
    const [row] = await db.select().from(ambassadors).where(and(eq(ambassadors.email, email), eq(ambassadors.cityId, cityId))).limit(1);
    return row;
  }

  async createAmbassador(data: InsertAmbassador): Promise<Ambassador> {
    const [row] = await db.insert(ambassadors).values(data).returning();
    return row;
  }

  async updateAmbassador(id: string, data: Partial<InsertAmbassador>): Promise<Ambassador | undefined> {
    const [row] = await db.update(ambassadors).set({ ...data, updatedAt: new Date() }).where(eq(ambassadors.id, id)).returning();
    return row;
  }

  async getAmbassadorReferrals(ambassadorId: string): Promise<AmbassadorReferral[]> {
    return db.select().from(ambassadorReferrals).where(eq(ambassadorReferrals.ambassadorId, ambassadorId)).orderBy(desc(ambassadorReferrals.createdAt));
  }

  async createAmbassadorReferral(data: InsertAmbassadorReferral): Promise<AmbassadorReferral> {
    const [row] = await db.insert(ambassadorReferrals).values(data).returning();
    return row;
  }

  async updateAmbassadorReferral(id: string, data: Partial<InsertAmbassadorReferral>): Promise<AmbassadorReferral | undefined> {
    const [row] = await db.update(ambassadorReferrals).set(data).where(eq(ambassadorReferrals.id, id)).returning();
    return row;
  }

  async getAmbassadorInquiries(cityId: string, status?: string): Promise<AmbassadorInquiry[]> {
    const conds = [eq(ambassadorInquiries.cityId, cityId)];
    if (status) conds.push(eq(ambassadorInquiries.status, status as any));
    return db.select().from(ambassadorInquiries).where(and(...conds)).orderBy(desc(ambassadorInquiries.createdAt));
  }

  async createAmbassadorInquiry(data: InsertAmbassadorInquiry): Promise<AmbassadorInquiry> {
    const [row] = await db.insert(ambassadorInquiries).values(data).returning();
    return row;
  }

  async updateAmbassadorInquiry(id: string, data: Partial<InsertAmbassadorInquiry>): Promise<AmbassadorInquiry | undefined> {
    const [row] = await db.update(ambassadorInquiries).set(data).where(eq(ambassadorInquiries.id, id)).returning();
    return row;
  }

  async getVerifiedContributors(filters?: { status?: string; tier?: string }): Promise<PublicUser[]> {
    const conds: SQL[] = [eq(publicUsers.isVerifiedContributor, true)];
    if (filters?.status) conds.push(eq(publicUsers.contributorStatus, filters.status));
    if (filters?.tier) conds.push(eq(publicUsers.verificationTier, filters.tier));
    return db.select().from(publicUsers).where(and(...conds)).orderBy(desc(publicUsers.verificationCompletedAt));
  }

  async updateContributorVerification(userId: string, data: {
    isVerifiedContributor: boolean;
    contributorStatus: string;
    verificationTier?: string | null;
    verificationAmountCents?: number | null;
    verificationPaymentId?: string | null;
    verificationCompletedAt?: Date | null;
    moderationTrustScore?: number;
  }): Promise<PublicUser | undefined> {
    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (data.isVerifiedContributor !== undefined) setFields.isVerifiedContributor = data.isVerifiedContributor;
    if (data.contributorStatus !== undefined) setFields.contributorStatus = data.contributorStatus;
    if (data.verificationTier !== undefined) setFields.verificationTier = data.verificationTier;
    if (data.verificationAmountCents !== undefined) setFields.verificationAmountCents = data.verificationAmountCents;
    if (data.verificationPaymentId !== undefined) setFields.verificationPaymentId = data.verificationPaymentId;
    if (data.verificationCompletedAt !== undefined) setFields.verificationCompletedAt = data.verificationCompletedAt;
    if (data.moderationTrustScore !== undefined) setFields.moderationTrustScore = data.moderationTrustScore;
    const [row] = await db.update(publicUsers).set(setFields).where(eq(publicUsers.id, userId)).returning();
    return row;
  }

  async createCommunityFundEntry(data: InsertCommunityFundLedger): Promise<CommunityFundLedger> {
    const [row] = await db.insert(communityFundLedger).values(data).returning();
    return row;
  }

  async getCommunityFundEntries(filters?: { userId?: string; status?: string }): Promise<CommunityFundLedger[]> {
    const conds: SQL[] = [];
    if (filters?.userId) conds.push(eq(communityFundLedger.userId, filters.userId));
    if (filters?.status) conds.push(eq(communityFundLedger.paymentStatus, filters.status as any));
    return db.select().from(communityFundLedger).where(conds.length ? and(...conds) : undefined).orderBy(desc(communityFundLedger.recordedAt));
  }

  async getCommunityFundSummary(): Promise<{ totalRaisedCents: number; totalContributors: number; byTier: Record<string, { count: number; totalCents: number }> }> {
    const completed = await db.select().from(communityFundLedger).where(eq(communityFundLedger.paymentStatus, "completed"));
    const totalRaisedCents = completed.reduce((sum, e) => sum + (e.netAmountCents || e.grossAmountCents), 0);
    const uniqueUsers = new Set(completed.filter(e => e.userId).map(e => e.userId));
    const byTier: Record<string, { count: number; totalCents: number }> = {};
    for (const entry of completed) {
      const tier = entry.contributionTier || "unknown";
      if (!byTier[tier]) byTier[tier] = { count: 0, totalCents: 0 };
      byTier[tier].count++;
      byTier[tier].totalCents += entry.netAmountCents || entry.grossAmountCents;
    }
    return { totalRaisedCents, totalContributors: uniqueUsers.size, byTier };
  }

  async updateCommunityFundEntry(id: string, data: Partial<InsertCommunityFundLedger>): Promise<CommunityFundLedger | undefined> {
    const [row] = await db.update(communityFundLedger).set(data).where(eq(communityFundLedger.id, id)).returning();
    return row;
  }

  async getContributorSubmissionStats(userId: string): Promise<ContributorSubmissionStats | undefined> {
    const [row] = await db.select().from(contributorSubmissionStats).where(eq(contributorSubmissionStats.userId, userId)).limit(1);
    return row;
  }

  async upsertContributorSubmissionStats(userId: string, updates: Partial<InsertContributorSubmissionStats>): Promise<ContributorSubmissionStats> {
    const existing = await this.getContributorSubmissionStats(userId);
    if (existing) {
      const [row] = await db.update(contributorSubmissionStats).set({ ...updates, updatedAt: new Date() }).where(eq(contributorSubmissionStats.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(contributorSubmissionStats).values({ userId, ...updates }).returning();
    return row;
  }
  async getCommunityFundEntryByPaymentId(paymentId: string): Promise<CommunityFundLedger | undefined> {
    const [row] = await db.select().from(communityFundLedger).where(eq(communityFundLedger.paymentId, paymentId)).limit(1);
    return row;
  }

  async getPlatformSetting(key: string): Promise<unknown | undefined> {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    return row?.value;
  }

  async setPlatformSetting(key: string, value: unknown): Promise<void> {
    await db.insert(platformSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } });
  }

  async getSuiteLocationBySlug(slug: string): Promise<SuiteLocation | undefined> {
    const [row] = await db.select().from(suiteLocations).where(eq(suiteLocations.slug, slug)).limit(1);
    return row;
  }
  async getSuiteLocationById(id: string): Promise<SuiteLocation | undefined> {
    const [row] = await db.select().from(suiteLocations).where(eq(suiteLocations.id, id)).limit(1);
    return row;
  }
  async getSuiteLocationsByCityId(cityId: string): Promise<SuiteLocation[]> {
    return db.select().from(suiteLocations).where(eq(suiteLocations.cityId, cityId)).orderBy(asc(suiteLocations.name));
  }
  async createSuiteLocation(data: InsertSuiteLocation): Promise<SuiteLocation> {
    const [row] = await db.insert(suiteLocations).values(data).returning();
    return row;
  }
  async updateSuiteLocation(id: string, data: Partial<InsertSuiteLocation>): Promise<SuiteLocation | undefined> {
    const [row] = await db.update(suiteLocations).set({ ...data, updatedAt: new Date() }).where(eq(suiteLocations.id, id)).returning();
    return row;
  }
  async deleteSuiteLocation(id: string): Promise<void> {
    await db.delete(suiteLocations).where(eq(suiteLocations.id, id));
  }

  async getProviderBySlug(cityId: string, slug: string): Promise<Provider | undefined> {
    const [row] = await db.select().from(providers).where(and(eq(providers.cityId, cityId), eq(providers.slug, slug))).limit(1);
    return row;
  }
  async getProviderById(id: string): Promise<Provider | undefined> {
    const [row] = await db.select().from(providers).where(eq(providers.id, id)).limit(1);
    return row;
  }
  async getProvidersByCityId(cityId: string, filters?: { category?: string; zoneId?: string; suiteLocationId?: string; verified?: boolean; acceptsWalkIns?: boolean; hasBooking?: boolean; q?: string; availability?: string; hubId?: string }): Promise<Provider[]> {
    const conditions: SQL[] = [eq(providers.cityId, cityId), eq(providers.isActive, true)];
    if (filters?.category) conditions.push(sql`${providers.category} = ${filters.category}`);
    if (filters?.zoneId) conditions.push(eq(providers.zoneId, filters.zoneId));
    if (filters?.suiteLocationId) conditions.push(eq(providers.suiteLocationId, filters.suiteLocationId));
    if (filters?.verified) conditions.push(eq(providers.isVerified, true));
    if (filters?.acceptsWalkIns) conditions.push(eq(providers.acceptsWalkIns, true));
    if (filters?.hasBooking) conditions.push(isNotNull(providers.bookingUrl));
    if (filters?.q) conditions.push(ilike(providers.displayName, `%${filters.q}%`));
    if (filters?.availability === "today") {
      const today = new Date().toISOString().split("T")[0];
      conditions.push(
        sql`EXISTS (SELECT 1 FROM provider_openings po WHERE po.provider_id = ${providers.id} AND po.status = 'active' AND po.opening_date = ${today})`
      );
    } else if (filters?.availability === "tomorrow") {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      conditions.push(
        sql`EXISTS (SELECT 1 FROM provider_openings po WHERE po.provider_id = ${providers.id} AND po.status = 'active' AND po.opening_date = ${tomorrow})`
      );
    }
    if (filters?.hubId) conditions.push(eq(providers.zoneId, filters.hubId));
    return db.select().from(providers).where(and(...conditions)).orderBy(desc(providers.isVerified), asc(providers.displayName));
  }
  async getProvidersBySuiteLocationId(suiteLocationId: string): Promise<Provider[]> {
    return db.select().from(providers).where(and(eq(providers.suiteLocationId, suiteLocationId), eq(providers.isActive, true))).orderBy(asc(providers.displayName));
  }
  async createProvider(data: InsertProvider): Promise<Provider> {
    const [row] = await db.insert(providers).values(data).returning();
    return row;
  }
  async updateProvider(id: string, data: Partial<InsertProvider>): Promise<Provider | undefined> {
    const [row] = await db.update(providers).set({ ...data, updatedAt: new Date() }).where(eq(providers.id, id)).returning();
    return row;
  }
  async deleteProvider(id: string): Promise<void> {
    await db.delete(providers).where(eq(providers.id, id));
  }
  async getAllProviders(cityId?: string): Promise<Provider[]> {
    if (cityId) return db.select().from(providers).where(eq(providers.cityId, cityId)).orderBy(desc(providers.createdAt));
    return db.select().from(providers).orderBy(desc(providers.createdAt));
  }

  async getProviderServicesByProviderId(providerId: string): Promise<ProviderService[]> {
    return db.select().from(providerServices).where(eq(providerServices.providerId, providerId)).orderBy(asc(providerServices.sortOrder));
  }
  async createProviderService(data: InsertProviderService): Promise<ProviderService> {
    const [row] = await db.insert(providerServices).values(data).returning();
    return row;
  }
  async updateProviderService(id: string, data: Partial<InsertProviderService>): Promise<ProviderService | undefined> {
    const [row] = await db.update(providerServices).set(data).where(eq(providerServices.id, id)).returning();
    return row;
  }
  async deleteProviderService(id: string): Promise<void> {
    await db.delete(providerServices).where(eq(providerServices.id, id));
  }

  async getProviderOpeningsByProviderId(providerId: string, filters?: { status?: string }): Promise<ProviderOpening[]> {
    const conditions: SQL[] = [eq(providerOpenings.providerId, providerId)];
    if (filters?.status) conditions.push(sql`${providerOpenings.status} = ${filters.status}`);
    return db.select().from(providerOpenings).where(and(...conditions)).orderBy(asc(providerOpenings.openingDate));
  }
  async getActiveOpeningsByCityId(cityId: string, filters?: { urgencyLabel?: string; category?: string; limit?: number }): Promise<(ProviderOpening & { providerName: string; providerSlug: string; providerCategory: string; providerImageUrl: string | null })[]> {
    const conditions: SQL[] = [eq(providers.cityId, cityId), sql`${providerOpenings.status} = 'active'`, eq(providers.isActive, true)];
    if (filters?.urgencyLabel) conditions.push(sql`${providerOpenings.urgencyLabel} = ${filters.urgencyLabel}`);
    if (filters?.category) conditions.push(sql`${providers.category} = ${filters.category}`);
    const rows = await db.select({
      id: providerOpenings.id,
      providerId: providerOpenings.providerId,
      serviceId: providerOpenings.serviceId,
      title: providerOpenings.title,
      openingDate: providerOpenings.openingDate,
      openingTimeLabel: providerOpenings.openingTimeLabel,
      startAt: providerOpenings.startAt,
      endAt: providerOpenings.endAt,
      notes: providerOpenings.notes,
      status: providerOpenings.status,
      urgencyLabel: providerOpenings.urgencyLabel,
      expiresAt: providerOpenings.expiresAt,
      createdBy: providerOpenings.createdBy,
      createdAt: providerOpenings.createdAt,
      updatedAt: providerOpenings.updatedAt,
      providerName: providers.displayName,
      providerSlug: providers.slug,
      providerCategory: providers.category,
      providerImageUrl: providers.profileImageUrl,
    }).from(providerOpenings)
      .innerJoin(providers, eq(providerOpenings.providerId, providers.id))
      .where(and(...conditions))
      .orderBy(asc(providerOpenings.openingDate))
      .limit(filters?.limit || 50);
    return rows;
  }
  async createProviderOpening(data: InsertProviderOpening): Promise<ProviderOpening> {
    const [row] = await db.insert(providerOpenings).values(data).returning();
    return row;
  }
  async updateProviderOpening(id: string, data: Partial<InsertProviderOpening>): Promise<ProviderOpening | undefined> {
    const [row] = await db.update(providerOpenings).set({ ...data, updatedAt: new Date() }).where(eq(providerOpenings.id, id)).returning();
    return row;
  }
  async deleteProviderOpening(id: string): Promise<void> {
    await db.delete(providerOpenings).where(eq(providerOpenings.id, id));
  }
  async expireOldOpenings(): Promise<number> {
    const result = await db.execute(
      sql`UPDATE provider_openings SET status = 'expired', updated_at = NOW() WHERE status = 'active' AND expires_at <= NOW()`
    );
    return (result as { rowCount?: number }).rowCount || 0;
  }

  async logProviderContactAction(data: InsertProviderContactAction): Promise<ProviderContactAction> {
    const [row] = await db.insert(providerContactActions).values(data).returning();
    return row;
  }
  async getProviderContactActionStats(providerId: string, since?: Date): Promise<Record<string, number>> {
    const conditions: SQL[] = [eq(providerContactActions.providerId, providerId)];
    if (since) conditions.push(gte(providerContactActions.createdAt, since));
    const rows = await db.select({
      actionType: providerContactActions.actionType,
      count: sql<number>`count(*)::int`,
    }).from(providerContactActions).where(and(...conditions)).groupBy(providerContactActions.actionType);
    const stats: Record<string, number> = {};
    for (const r of rows) stats[r.actionType] = r.count;
    return stats;
  }
  async getTopProvidersByActions(cityId: string, limit?: number, since?: Date): Promise<{ providerId: string; providerName: string; totalActions: number }[]> {
    const conditions: SQL[] = [eq(providerContactActions.cityId, cityId)];
    if (since) conditions.push(gte(providerContactActions.createdAt, since));
    return db.select({
      providerId: providerContactActions.providerId,
      providerName: providers.displayName,
      totalActions: sql<number>`count(*)::int`,
    }).from(providerContactActions)
      .innerJoin(providers, eq(providerContactActions.providerId, providers.id))
      .where(and(...conditions))
      .groupBy(providerContactActions.providerId, providers.displayName)
      .orderBy(desc(sql`count(*)`))
      .limit(limit || 20);
  }

  async getTopOpeningsByClicks(cityId: string, limit?: number, since?: Date): Promise<{ openingId: string; title: string; providerName: string; clicks: number }[]> {
    const conditions: SQL[] = [
      eq(providerContactActions.cityId, cityId),
      sql`${providerContactActions.actionType} = 'opening_click'`,
    ];
    if (since) conditions.push(gte(providerContactActions.createdAt, since));
    const rows = await db.select({
      openingId: sql<string>`(${providerContactActions.metadata}->>'openingId')`,
      title: sql<string>`MAX((${providerContactActions.metadata}->>'openingTitle'))`,
      providerName: providers.displayName,
      clicks: sql<number>`count(*)::int`,
    }).from(providerContactActions)
      .innerJoin(providers, eq(providerContactActions.providerId, providers.id))
      .where(and(...conditions))
      .groupBy(sql`(${providerContactActions.metadata}->>'openingId')`, providers.displayName)
      .orderBy(desc(sql`count(*)`))
      .limit(limit || 20);
    return rows.filter(r => r.openingId);
  }

  async getActionsByType(cityId: string, since?: Date): Promise<{ actionType: string; count: number }[]> {
    const conditions: SQL[] = [eq(providerContactActions.cityId, cityId)];
    if (since) conditions.push(gte(providerContactActions.createdAt, since));
    return db.select({
      actionType: sql<string>`${providerContactActions.actionType}::text`,
      count: sql<number>`count(*)::int`,
    }).from(providerContactActions)
      .where(and(...conditions))
      .groupBy(providerContactActions.actionType)
      .orderBy(desc(sql`count(*)`));
  }

  async getProviderStatsByZone(cityId: string): Promise<{ zoneId: string | null; zoneName: string | null; providerCount: number; actionCount: number }[]> {
    const rows = await db.execute(sql`
      SELECT
        p.zone_id as "zoneId",
        z.name as "zoneName",
        COUNT(DISTINCT p.id)::int as "providerCount",
        COUNT(pca.id)::int as "actionCount"
      FROM providers p
      LEFT JOIN zones z ON z.id = p.zone_id
      LEFT JOIN provider_contact_actions pca ON pca.provider_id = p.id
      WHERE p.city_id = ${cityId} AND p.is_active = true
      GROUP BY p.zone_id, z.name
      ORDER BY COUNT(pca.id) DESC
    `);
    return (rows as { rows?: { zoneId: string | null; zoneName: string | null; providerCount: number; actionCount: number }[] }).rows || [];
  }

  async getBookingPlatformConfigs(category?: string): Promise<BookingPlatformConfig[]> {
    if (category) {
      return db.select().from(bookingPlatformConfigs).where(
        and(eq(bookingPlatformConfigs.isActive, true), or(eq(bookingPlatformConfigs.category, category), eq(bookingPlatformConfigs.category, "both")))
      ).orderBy(asc(bookingPlatformConfigs.displayName));
    }
    return db.select().from(bookingPlatformConfigs).where(eq(bookingPlatformConfigs.isActive, true)).orderBy(asc(bookingPlatformConfigs.displayName));
  }

  async createApplicantProfile(data: InsertApplicantProfile): Promise<ApplicantProfile> {
    const [row] = await db.insert(applicantProfiles).values(data).returning();
    return row;
  }
  async getApplicantProfileByUserId(userId: string): Promise<ApplicantProfile | undefined> {
    const [row] = await db.select().from(applicantProfiles).where(eq(applicantProfiles.userId, userId));
    return row;
  }
  async updateApplicantProfile(id: string, data: Partial<InsertApplicantProfile>): Promise<ApplicantProfile | undefined> {
    const [row] = await db.update(applicantProfiles).set({ ...data, updatedAt: new Date() }).where(eq(applicantProfiles.id, id)).returning();
    return row;
  }
  async listApplicantProfilesByZone(zoneId: string): Promise<ApplicantProfile[]> {
    return db.select().from(applicantProfiles).where(eq(applicantProfiles.zoneId, zoneId));
  }

  async addApplicantSkill(data: InsertApplicantSkill): Promise<ApplicantSkill> {
    const [row] = await db.insert(applicantSkills).values(data).returning();
    return row;
  }
  async removeApplicantSkill(id: string): Promise<void> {
    await db.delete(applicantSkills).where(eq(applicantSkills.id, id));
  }
  async listApplicantSkills(applicantId: string): Promise<(ApplicantSkill & { skillName: string; subcategoryName: string; categoryName: string })[]> {
    return db.select({
      id: applicantSkills.id,
      applicantId: applicantSkills.applicantId,
      skillId: applicantSkills.skillId,
      level: applicantSkills.level,
      yearsUsed: applicantSkills.yearsUsed,
      isTopSkill: applicantSkills.isTopSkill,
      createdAt: applicantSkills.createdAt,
      skillName: skillsTable.name,
      subcategoryName: skillSubcategories.name,
      categoryName: skillCategories.name,
    }).from(applicantSkills)
      .innerJoin(skillsTable, eq(applicantSkills.skillId, skillsTable.id))
      .innerJoin(skillSubcategories, eq(skillsTable.subcategoryId, skillSubcategories.id))
      .innerJoin(skillCategories, eq(skillSubcategories.categoryId, skillCategories.id))
      .where(eq(applicantSkills.applicantId, applicantId));
  }
  async updateApplicantSkill(id: string, data: Partial<InsertApplicantSkill>): Promise<ApplicantSkill | undefined> {
    const [row] = await db.update(applicantSkills).set(data).where(eq(applicantSkills.id, id)).returning();
    return row;
  }

  async addApplicantCredential(data: InsertApplicantCredential): Promise<ApplicantCredential> {
    const [row] = await db.insert(applicantCredentials).values(data).returning();
    return row;
  }
  async updateApplicantCredential(id: string, data: Partial<InsertApplicantCredential>): Promise<ApplicantCredential | undefined> {
    const [row] = await db.update(applicantCredentials).set({ ...data, updatedAt: new Date() }).where(eq(applicantCredentials.id, id)).returning();
    return row;
  }
  async listApplicantCredentials(applicantId: string): Promise<(ApplicantCredential & { credentialName: string })[]> {
    const rows = await db.select({
      id: applicantCredentials.id,
      applicantId: applicantCredentials.applicantId,
      credentialId: applicantCredentials.credentialId,
      verificationStatus: applicantCredentials.verificationStatus,
      issuedDate: applicantCredentials.issuedDate,
      expirationDate: applicantCredentials.expirationDate,
      jurisdiction: applicantCredentials.jurisdiction,
      credentialNumber: applicantCredentials.credentialNumber,
      documentUrl: applicantCredentials.documentUrl,
      isCustom: applicantCredentials.isCustom,
      customName: applicantCredentials.customName,
      customIssuingBody: applicantCredentials.customIssuingBody,
      createdAt: applicantCredentials.createdAt,
      updatedAt: applicantCredentials.updatedAt,
      directoryName: credentialDirectory.name,
    }).from(applicantCredentials)
      .leftJoin(credentialDirectory, eq(applicantCredentials.credentialId, credentialDirectory.id))
      .where(eq(applicantCredentials.applicantId, applicantId));
    return rows.map(r => ({
      ...r,
      credentialName: r.isCustom ? (r.customName || "Custom Credential") : (r.directoryName || "Unknown"),
    }));
  }

  async addApplicantResume(data: InsertApplicantResume): Promise<ApplicantResume> {
    const [row] = await db.insert(applicantResumes).values(data).returning();
    return row;
  }
  async setPrimaryResume(applicantId: string, resumeId: string): Promise<void> {
    await db.update(applicantResumes).set({ isPrimary: false }).where(eq(applicantResumes.applicantId, applicantId));
    await db.update(applicantResumes).set({ isPrimary: true }).where(and(eq(applicantResumes.id, resumeId), eq(applicantResumes.applicantId, applicantId)));
  }
  async listApplicantResumes(applicantId: string): Promise<ApplicantResume[]> {
    return db.select().from(applicantResumes).where(eq(applicantResumes.applicantId, applicantId));
  }
  async deleteApplicantResume(id: string): Promise<void> {
    await db.delete(applicantResumes).where(eq(applicantResumes.id, id));
  }

  async listSkillCategories(): Promise<SkillCategory[]> {
    return db.select().from(skillCategories).orderBy(asc(skillCategories.sortOrder));
  }
  async listSkillSubcategories(categoryId: string): Promise<SkillSubcategory[]> {
    return db.select().from(skillSubcategories).where(eq(skillSubcategories.categoryId, categoryId)).orderBy(asc(skillSubcategories.sortOrder));
  }
  async listSkillsBySubcategory(subcategoryId: string): Promise<Skill[]> {
    return db.select().from(skillsTable).where(eq(skillsTable.subcategoryId, subcategoryId)).orderBy(asc(skillsTable.sortOrder));
  }
  async getFullSkillTaxonomy(): Promise<(SkillCategory & { subcategories: (SkillSubcategory & { skills: Skill[] })[] })[]> {
    const cats = await db.select().from(skillCategories).orderBy(asc(skillCategories.sortOrder));
    const subcats = await db.select().from(skillSubcategories).orderBy(asc(skillSubcategories.sortOrder));
    const allSkills = await db.select().from(skillsTable).orderBy(asc(skillsTable.sortOrder));

    const skillsBySubcat = new Map<string, Skill[]>();
    for (const s of allSkills) {
      if (!skillsBySubcat.has(s.subcategoryId)) skillsBySubcat.set(s.subcategoryId, []);
      skillsBySubcat.get(s.subcategoryId)!.push(s);
    }

    const subcatsByCat = new Map<string, (SkillSubcategory & { skills: Skill[] })[]>();
    for (const sc of subcats) {
      if (!subcatsByCat.has(sc.categoryId)) subcatsByCat.set(sc.categoryId, []);
      subcatsByCat.get(sc.categoryId)!.push({ ...sc, skills: skillsBySubcat.get(sc.id) || [] });
    }

    return cats.map(c => ({ ...c, subcategories: subcatsByCat.get(c.id) || [] }));
  }

  async listCredentialDirectory(): Promise<CredentialDirectoryEntry[]> {
    return db.select().from(credentialDirectory).orderBy(asc(credentialDirectory.name));
  }
  async searchCredentialDirectory(q: string): Promise<CredentialDirectoryEntry[]> {
    return db.select().from(credentialDirectory).where(or(ilike(credentialDirectory.name, `%${q}%`), ilike(credentialDirectory.category, `%${q}%`))).orderBy(asc(credentialDirectory.name));
  }

  async createBusinessHiringProfile(data: InsertBusinessHiringProfile): Promise<BusinessHiringProfile> {
    const [row] = await db.insert(businessHiringProfiles).values(data).returning();
    return row;
  }
  async getBusinessHiringProfile(businessId: string): Promise<BusinessHiringProfile | undefined> {
    const [row] = await db.select().from(businessHiringProfiles).where(eq(businessHiringProfiles.businessId, businessId));
    return row;
  }
  async updateBusinessHiringProfile(id: string, data: Partial<InsertBusinessHiringProfile>): Promise<BusinessHiringProfile | undefined> {
    const [row] = await db.update(businessHiringProfiles).set({ ...data, updatedAt: new Date() }).where(eq(businessHiringProfiles.id, id)).returning();
    return row;
  }
  async listActivelyHiringBusinesses(zoneId?: string): Promise<(BusinessHiringProfile & { businessName: string; businessSlug: string })[]> {
    const conditions: SQL[] = [eq(businessHiringProfiles.hiringStatus, "ACTIVELY_HIRING")];
    if (zoneId) {
      conditions.push(eq(businesses.zoneId, zoneId));
    }
    return db.select({
      id: businessHiringProfiles.id,
      businessId: businessHiringProfiles.businessId,
      hiringStatus: businessHiringProfiles.hiringStatus,
      companyDescription: businessHiringProfiles.companyDescription,
      typicalRoles: businessHiringProfiles.typicalRoles,
      industries: businessHiringProfiles.industries,
      benefitsOffered: businessHiringProfiles.benefitsOffered,
      applicationUrl: businessHiringProfiles.applicationUrl,
      contactEmail: businessHiringProfiles.contactEmail,
      contactPhone: businessHiringProfiles.contactPhone,
      workplaceSummary: businessHiringProfiles.workplaceSummary,
      cultureDescription: businessHiringProfiles.cultureDescription,
      hiringContactMethod: businessHiringProfiles.hiringContactMethod,
      verificationBadges: businessHiringProfiles.verificationBadges,
      createdAt: businessHiringProfiles.createdAt,
      updatedAt: businessHiringProfiles.updatedAt,
      businessName: businesses.name,
      businessSlug: businesses.slug,
    }).from(businessHiringProfiles)
      .innerJoin(businesses, eq(businessHiringProfiles.businessId, businesses.id))
      .where(and(...conditions));
  }

  async createJobListing(data: InsertJobListing): Promise<JobListing> {
    const [row] = await db.insert(jobListings).values(data).returning();
    return row;
  }
  async getJobListingById(id: string): Promise<JobListing | undefined> {
    const [row] = await db.select().from(jobListings).where(eq(jobListings.id, id));
    return row;
  }
  async updateJobListing(id: string, data: Partial<InsertJobListing>): Promise<JobListing | undefined> {
    const [row] = await db.update(jobListings).set({ ...data, updatedAt: new Date() }).where(eq(jobListings.id, id)).returning();
    return row;
  }
  async listJobListingsByBusiness(businessId: string): Promise<JobListing[]> {
    return db.select().from(jobListings).where(eq(jobListings.businessId, businessId)).orderBy(desc(jobListings.createdAt));
  }

  async createJobApplication(data: InsertJobApplication): Promise<JobApplication> {
    const [row] = await db.insert(jobApplications).values(data).returning();
    return row;
  }
  async getJobApplicationById(id: string): Promise<JobApplication | undefined> {
    const [row] = await db.select().from(jobApplications).where(eq(jobApplications.id, id));
    return row;
  }
  async updateJobApplication(id: string, data: Partial<InsertJobApplication>): Promise<JobApplication | undefined> {
    const [row] = await db.update(jobApplications).set({ ...data, updatedAt: new Date() }).where(eq(jobApplications.id, id)).returning();
    return row;
  }
  async listJobApplicationsByApplicant(applicantId: string): Promise<JobApplication[]> {
    return db.select().from(jobApplications).where(eq(jobApplications.applicantId, applicantId)).orderBy(desc(jobApplications.appliedAt));
  }
  async listJobApplicationsByListing(listingId: string): Promise<JobApplication[]> {
    return db.select().from(jobApplications).where(eq(jobApplications.jobListingId, listingId)).orderBy(desc(jobApplications.appliedAt));
  }

  async getEmployerHiringMetrics(businessId: string, month: string): Promise<EmployerHiringMetrics | undefined> {
    const [row] = await db.select().from(employerHiringMetrics).where(
      and(eq(employerHiringMetrics.businessId, businessId), eq(employerHiringMetrics.month, month))
    );
    return row;
  }
  async listEmployerHiringMetrics(businessId: string): Promise<EmployerHiringMetrics[]> {
    return db.select().from(employerHiringMetrics).where(eq(employerHiringMetrics.businessId, businessId)).orderBy(desc(employerHiringMetrics.month));
  }
  async upsertEmployerHiringMetrics(data: InsertEmployerHiringMetrics): Promise<EmployerHiringMetrics> {
    const existing = await this.getEmployerHiringMetrics(data.businessId, data.month);
    if (existing) {
      const [row] = await db.update(employerHiringMetrics).set(data).where(
        and(eq(employerHiringMetrics.businessId, data.businessId), eq(employerHiringMetrics.month, data.month))
      ).returning();
      return row;
    }
    const [row] = await db.insert(employerHiringMetrics).values(data).returning();
    return row;
  }

  async addCredentialJurisdiction(data: InsertApplicantCredentialJurisdiction): Promise<ApplicantCredentialJurisdiction> {
    const [row] = await db.insert(applicantCredentialJurisdictions).values(data).returning();
    return row;
  }
  async listCredentialJurisdictions(credentialRecordId: string): Promise<ApplicantCredentialJurisdiction[]> {
    return db.select().from(applicantCredentialJurisdictions).where(eq(applicantCredentialJurisdictions.credentialRecordId, credentialRecordId));
  }
  async deleteCredentialJurisdiction(id: string): Promise<void> {
    await db.delete(applicantCredentialJurisdictions).where(eq(applicantCredentialJurisdictions.id, id));
  }

  async getApplicantProfileById(id: string): Promise<ApplicantProfile | undefined> {
    const [row] = await db.select().from(applicantProfiles).where(eq(applicantProfiles.id, id));
    return row;
  }
  async getBusinessHiringProfileById(profileId: string): Promise<BusinessHiringProfile | undefined> {
    const [row] = await db.select().from(businessHiringProfiles).where(eq(businessHiringProfiles.id, profileId));
    return row;
  }
  async getPublicBusinessHiringProfile(businessId: string): Promise<(BusinessHiringProfile & { businessName: string; businessSlug: string; businessCityId: string }) | undefined> {
    const [row] = await db.select({
      id: businessHiringProfiles.id,
      businessId: businessHiringProfiles.businessId,
      hiringStatus: businessHiringProfiles.hiringStatus,
      companyDescription: businessHiringProfiles.companyDescription,
      typicalRoles: businessHiringProfiles.typicalRoles,
      industries: businessHiringProfiles.industries,
      benefitsOffered: businessHiringProfiles.benefitsOffered,
      applicationUrl: businessHiringProfiles.applicationUrl,
      contactEmail: businessHiringProfiles.contactEmail,
      contactPhone: businessHiringProfiles.contactPhone,
      workplaceSummary: businessHiringProfiles.workplaceSummary,
      cultureDescription: businessHiringProfiles.cultureDescription,
      hiringContactMethod: businessHiringProfiles.hiringContactMethod,
      verificationBadges: businessHiringProfiles.verificationBadges,
      createdAt: businessHiringProfiles.createdAt,
      updatedAt: businessHiringProfiles.updatedAt,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      businessCityId: businesses.cityId,
    }).from(businessHiringProfiles)
      .innerJoin(businesses, eq(businessHiringProfiles.businessId, businesses.id))
      .where(eq(businessHiringProfiles.businessId, businessId));
    return row;
  }

  async getWorkforceStats(): Promise<{ applicantProfiles: number; activeHiringBusinesses: number; totalSkills: number; pendingCredentials: number; jobListings: number }> {
    const [apCount] = await db.select({ count: sql<number>`count(*)::int` }).from(applicantProfiles);
    const [ahCount] = await db.select({ count: sql<number>`count(*)::int` }).from(businessHiringProfiles).where(eq(businessHiringProfiles.hiringStatus, "ACTIVELY_HIRING"));
    const [skCount] = await db.select({ count: sql<number>`count(*)::int` }).from(skillsTable);
    const [pcCount] = await db.select({ count: sql<number>`count(*)::int` }).from(applicantCredentials).where(eq(applicantCredentials.verificationStatus, "PENDING"));
    const [jlCount] = await db.select({ count: sql<number>`count(*)::int` }).from(jobListings);
    return {
      applicantProfiles: apCount.count,
      activeHiringBusinesses: ahCount.count,
      totalSkills: skCount.count,
      pendingCredentials: pcCount.count,
      jobListings: jlCount.count,
    };
  }

  private _hubEngine: typeof import("./hub-entitlements") | null = null;
  private async hubEngine() {
    if (!this._hubEngine) {
      this._hubEngine = await import("./hub-entitlements");
    }
    return this._hubEngine;
  }

  async getActiveHubEntitlements(presenceId: string): Promise<HubEntitlement[]> {
    return (await this.hubEngine()).getActiveHubEntitlements(presenceId);
  }
  async getHubEntitlement(presenceId: string, hubId: string): Promise<HubEntitlement | null> {
    return (await this.hubEngine()).getHubEntitlement(presenceId, hubId);
  }
  async createHubEntitlement(data: { presenceId: string; hubId: string; cityId: string; isBaseHub?: boolean; billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date }): Promise<HubEntitlement> {
    return (await this.hubEngine()).createHubEntitlement(data);
  }
  async getActiveCategoryEntitlements(presenceId: string, hubEntitlementId?: string): Promise<CategoryEntitlement[]> {
    return (await this.hubEngine()).getActiveCategoryEntitlements(presenceId, hubEntitlementId);
  }
  async getCategoryEntitlement(presenceId: string, hubEntitlementId: string, categoryId: string): Promise<CategoryEntitlement | null> {
    return (await this.hubEngine()).getCategoryEntitlement(presenceId, hubEntitlementId, categoryId);
  }
  async createCategoryEntitlement(data: { presenceId: string; hubEntitlementId: string; categoryId: string; isBaseCategory?: boolean; billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date }): Promise<CategoryEntitlement> {
    return (await this.hubEngine()).createCategoryEntitlement(data);
  }
  async getActiveMicroEntitlements(presenceId: string, categoryEntitlementId?: string): Promise<MicroEntitlement[]> {
    return (await this.hubEngine()).getActiveMicroEntitlements(presenceId, categoryEntitlementId);
  }
  async getMicroEntitlement(presenceId: string, categoryEntitlementId: string, microId: string): Promise<MicroEntitlement | null> {
    return (await this.hubEngine()).getMicroEntitlement(presenceId, categoryEntitlementId, microId);
  }
  async createMicroEntitlement(data: { presenceId: string; categoryEntitlementId: string; microId: string; isBaseMicro?: boolean; billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date }): Promise<MicroEntitlement> {
    return (await this.hubEngine()).createMicroEntitlement(data);
  }
  async getActiveCapabilities(presenceId: string, hubEntitlementId?: string): Promise<CapabilityEntitlement[]> {
    return (await this.hubEngine()).getActiveCapabilities(presenceId, hubEntitlementId);
  }
  async hasCapability(presenceId: string, hubEntitlementId: string, capabilityType: CapabilityType): Promise<boolean> {
    return (await this.hubEngine()).hasCapability(presenceId, hubEntitlementId, capabilityType);
  }
  async createCapabilityEntitlement(data: { presenceId: string; hubEntitlementId: string; capabilityType: CapabilityType; billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date }): Promise<CapabilityEntitlement> {
    return (await this.hubEngine()).createCapabilityEntitlement(data);
  }
  async getPresenceEntitlementSummary(presenceId: string): Promise<{
    hubs: (HubEntitlement & { categories: (CategoryEntitlement & { micros: MicroEntitlement[] })[]; capabilities: CapabilityEntitlement[] })[];
    creditWallet: CreditWallet | null;
  }> {
    return (await this.hubEngine()).getPresenceEntitlementSummary(presenceId);
  }
  async getCreditWallet(presenceId: string): Promise<CreditWallet | null> {
    return (await this.hubEngine()).getCreditWallet(presenceId);
  }
  async getOrCreateCreditWallet(presenceId: string): Promise<CreditWallet> {
    return (await this.hubEngine()).getOrCreateCreditWallet(presenceId);
  }
  async getCreditBalance(presenceId: string): Promise<{ monthly: number; banked: number; total: number }> {
    return (await this.hubEngine()).getCreditBalance(presenceId);
  }
  async grantMonthlyCredits(presenceId: string, amount: number): Promise<CreditWallet> {
    return (await this.hubEngine()).grantMonthlyCredits(presenceId, amount);
  }
  async purchaseCredits(presenceId: string, amount: number, referenceId?: string): Promise<CreditWallet> {
    return (await this.hubEngine()).purchaseCredits(presenceId, amount, referenceId);
  }
  async adminGrantCredits(presenceId: string, amount: number, note?: string): Promise<CreditWallet> {
    return (await this.hubEngine()).adminGrantCredits(presenceId, amount, note);
  }
  async spendCredits(presenceId: string, amount: number, actionType: string, referenceId?: string): Promise<{ success: boolean; wallet?: CreditWallet; shortfall?: number }> {
    return (await this.hubEngine()).spendCredits(presenceId, amount, actionType, referenceId);
  }
  async expireMonthlyCredits(presenceId: string): Promise<number> {
    return (await this.hubEngine()).expireMonthlyCredits(presenceId);
  }
  async getCreditTransactions(presenceId: string, limit?: number): Promise<CreditTransaction[]> {
    return (await this.hubEngine()).getCreditTransactions(presenceId, limit);
  }
  async getCreditActionCost(actionType: string): Promise<number | null> {
    return (await this.hubEngine()).getCreditActionCost(actionType);
  }
  async getAllCreditActionCosts(): Promise<CreditActionCost[]> {
    return (await this.hubEngine()).getAllCreditActionCosts();
  }
  async upsertCreditActionCost(actionType: string, label: string, costCredits: number, canSubstituteAddon?: string | null): Promise<CreditActionCost> {
    return (await this.hubEngine()).upsertCreditActionCost(actionType, label, costCredits, canSubstituteAddon);
  }
  async getCurrentPlanVersion(): Promise<PlanVersion | null> {
    return (await this.hubEngine()).getCurrentPlanVersion();
  }
  async getFounderPlanVersion(): Promise<PlanVersion | null> {
    return (await this.hubEngine()).getFounderPlanVersion();
  }
  async getAllPlanVersions(): Promise<PlanVersion[]> {
    return (await this.hubEngine()).getAllPlanVersions();
  }
  async upsertPlanVersion(data: { versionKey: string; label: string; presenceMonthly: number; presenceAnnual: number; hubAddonMonthly: number; hubAddonAnnual: number; categoryAddonMonthly: number; categoryAddonAnnual: number; microAddonMonthly: number; microAddonAnnual: number; monthlyCreditsIncluded: number; isCurrentOffering: boolean; isFounderPlan: boolean }): Promise<PlanVersion> {
    return (await this.hubEngine()).upsertPlanVersion(data);
  }

  async getPulseIssuesByHub(cityId: string, hubSlug: string, statusFilter?: string): Promise<PulseIssue[]> {
    const conditions = [eq(pulseIssues.cityId, cityId), eq(pulseIssues.hubSlug, hubSlug)];
    if (statusFilter) conditions.push(eq(pulseIssues.status, statusFilter as "draft" | "review" | "published" | "archived"));
    return db.select().from(pulseIssues).where(and(...conditions)).orderBy(desc(pulseIssues.issueNumber));
  }

  async getPulseIssueBySlug(cityId: string, hubSlug: string, slug: string, statusFilter?: string): Promise<PulseIssue | undefined> {
    const conditions = [eq(pulseIssues.cityId, cityId), eq(pulseIssues.hubSlug, hubSlug), eq(pulseIssues.slug, slug)];
    if (statusFilter) conditions.push(eq(pulseIssues.status, statusFilter as "draft" | "review" | "published" | "archived"));
    const [result] = await db.select().from(pulseIssues).where(and(...conditions));
    return result;
  }

  async getPulseIssueById(id: string): Promise<PulseIssue | undefined> {
    const [result] = await db.select().from(pulseIssues).where(eq(pulseIssues.id, id));
    return result;
  }

  async createPulseIssue(data: InsertPulseIssue): Promise<PulseIssue> {
    const [result] = await db.insert(pulseIssues).values(data).returning();
    return result;
  }

  async updatePulseIssue(id: string, data: Partial<InsertPulseIssue>): Promise<PulseIssue | undefined> {
    const [result] = await db.update(pulseIssues).set({ ...data, updatedAt: new Date() }).where(eq(pulseIssues.id, id)).returning();
    return result;
  }

  async deletePulseIssue(id: string): Promise<void> {
    await db.delete(pulseIssues).where(eq(pulseIssues.id, id));
  }

  async getAllPulseIssues(cityId?: string, hubSlug?: string): Promise<PulseIssue[]> {
    const conditions = [];
    if (cityId) conditions.push(eq(pulseIssues.cityId, cityId));
    if (hubSlug) conditions.push(eq(pulseIssues.hubSlug, hubSlug));
    return conditions.length > 0
      ? db.select().from(pulseIssues).where(and(...conditions)).orderBy(desc(pulseIssues.createdAt))
      : db.select().from(pulseIssues).orderBy(desc(pulseIssues.createdAt));
  }

  async getPulsePickupLocations(cityId: string, hubSlug: string, activeOnly = true): Promise<PulsePickupLocation[]> {
    const conditions = [eq(pulsePickupLocations.cityId, cityId), eq(pulsePickupLocations.hubSlug, hubSlug)];
    if (activeOnly) conditions.push(eq(pulsePickupLocations.isActive, true));
    return db.select().from(pulsePickupLocations).where(and(...conditions));
  }

  async getAllPulsePickupLocations(cityId?: string, hubSlug?: string): Promise<PulsePickupLocation[]> {
    const conditions = [];
    if (cityId) conditions.push(eq(pulsePickupLocations.cityId, cityId));
    if (hubSlug) conditions.push(eq(pulsePickupLocations.hubSlug, hubSlug));
    return conditions.length > 0
      ? db.select().from(pulsePickupLocations).where(and(...conditions))
      : db.select().from(pulsePickupLocations);
  }

  async createPulsePickupLocation(data: InsertPulsePickupLocation): Promise<PulsePickupLocation> {
    const [result] = await db.insert(pulsePickupLocations).values(data).returning();
    return result;
  }

  async updatePulsePickupLocation(id: string, data: Partial<InsertPulsePickupLocation>): Promise<PulsePickupLocation | undefined> {
    const [result] = await db.update(pulsePickupLocations).set({ ...data, updatedAt: new Date() }).where(eq(pulsePickupLocations.id, id)).returning();
    return result;
  }

  async deletePulsePickupLocation(id: string): Promise<void> {
    await db.delete(pulsePickupLocations).where(eq(pulsePickupLocations.id, id));
  }

  async createWorkflowSession(data: InsertWorkflowSession): Promise<WorkflowSession> {
    const [result] = await db.insert(workflowSessions).values(data).returning();
    return result;
  }

  async getWorkflowSession(id: string): Promise<WorkflowSession | undefined> {
    const [result] = await db.select().from(workflowSessions).where(eq(workflowSessions.id, id)).limit(1);
    return result;
  }

  async updateWorkflowSession(id: string, data: Partial<InsertWorkflowSession>): Promise<WorkflowSession | undefined> {
    const [result] = await db.update(workflowSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowSessions.id, id))
      .returning();
    return result;
  }

  async addWorkflowEvent(data: InsertWorkflowEvent): Promise<WorkflowEvent> {
    const [result] = await db.insert(workflowEvents).values(data).returning();
    return result;
  }

  async getWorkflowEvents(sessionId: string): Promise<WorkflowEvent[]> {
    return db.select().from(workflowEvents)
      .where(eq(workflowEvents.sessionId, sessionId))
      .orderBy(asc(workflowEvents.createdAt));
  }

  async getWorkflowSessionsByCity(
    cityId: string,
    filters?: { source?: string; status?: string; presenceType?: string; limit?: number; offset?: number }
  ): Promise<{ sessions: WorkflowSession[]; total: number }> {
    const conditions: SQL[] = [eq(workflowSessions.cityId, cityId)];
    if (filters?.source) conditions.push(sql`${workflowSessions.source} = ${filters.source}`);
    if (filters?.status) conditions.push(sql`${workflowSessions.status} = ${filters.status}`);
    if (filters?.presenceType) conditions.push(sql`${workflowSessions.presenceType} = ${filters.presenceType}`);

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(workflowSessions)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    const sessions = await db.select().from(workflowSessions)
      .where(and(...conditions))
      .orderBy(desc(workflowSessions.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    return { sessions, total };
  }
  async findResumableWorkflowSession(
    cityId: string,
    source: string,
    context: { entityId?: string; contactEmail?: string; businessName?: string }
  ): Promise<WorkflowSession | undefined> {
    const conditions: SQL[] = [
      eq(workflowSessions.cityId, cityId),
      sql`${workflowSessions.status} IN ('active', 'paused')`,
    ];
    if (source) {
      conditions.push(sql`${workflowSessions.source} = ${source}`);
    }

    if (context.entityId) {
      conditions.push(eq(workflowSessions.entityId, context.entityId));
    } else if (context.contactEmail) {
      conditions.push(eq(workflowSessions.contactEmail, context.contactEmail));
    } else if (context.businessName) {
      conditions.push(eq(workflowSessions.businessName, context.businessName));
    } else {
      return undefined;
    }

    const results = await db.select().from(workflowSessions)
      .where(and(...conditions))
      .orderBy(desc(workflowSessions.updatedAt))
      .limit(1);

    return results[0] || undefined;
  }

  async findWorkflowSessionByChat(chatSessionId: string): Promise<WorkflowSession | undefined> {
    const results = await db
      .select()
      .from(workflowSessions)
      .where(eq(workflowSessions.chatSessionId, chatSessionId))
      .limit(1);
    return results[0] || undefined;
  }

  async createWorkflowFollowUp(data: InsertWorkflowFollowUp): Promise<WorkflowFollowUp> {
    const [result] = await db.insert(workflowFollowUps).values(data).returning();
    return result;
  }

  async getWorkflowFollowUps(sessionId: string): Promise<WorkflowFollowUp[]> {
    return db
      .select()
      .from(workflowFollowUps)
      .where(eq(workflowFollowUps.sessionId, sessionId))
      .orderBy(desc(workflowFollowUps.scheduledAt));
  }

  async updateWorkflowFollowUp(id: string, data: Partial<InsertWorkflowFollowUp>): Promise<WorkflowFollowUp | undefined> {
    const [result] = await db
      .update(workflowFollowUps)
      .set(data)
      .where(eq(workflowFollowUps.id, id))
      .returning();
    return result || undefined;
  }

  async createWorkflowActionRecommendation(data: InsertWorkflowActionRecommendation): Promise<WorkflowActionRecommendation> {
    const [result] = await db.insert(workflowActionRecommendations).values(data).returning();
    return result;
  }

  async getWorkflowActionRecommendations(sessionId: string): Promise<WorkflowActionRecommendation[]> {
    return db
      .select()
      .from(workflowActionRecommendations)
      .where(
        and(
          eq(workflowActionRecommendations.sessionId, sessionId),
          eq(workflowActionRecommendations.dismissed, false)
        )
      )
      .orderBy(workflowActionRecommendations.priority);
  }

  async dismissWorkflowActionRecommendation(id: string): Promise<void> {
    await db
      .update(workflowActionRecommendations)
      .set({ dismissed: true })
      .where(eq(workflowActionRecommendations.id, id));
  }

  // Automation Engine
  async getAutomationRules(filters?: { cityId?: string; triggerEvent?: string; isActive?: boolean }): Promise<AutomationRule[]> {
    const conditions: SQL[] = [];
    if (filters?.cityId) {
      conditions.push(or(eq(automationRules.cityId, filters.cityId), sql`${automationRules.cityId} IS NULL`)!);
    }
    if (filters?.triggerEvent) conditions.push(eq(automationRules.triggerEvent, filters.triggerEvent as any));
    if (filters?.isActive !== undefined) conditions.push(eq(automationRules.isActive, filters.isActive));
    return db.select().from(automationRules)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(automationRules.createdAt));
  }

  async getAutomationRuleById(id: string): Promise<AutomationRule | undefined> {
    const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, id)).limit(1);
    return rule || undefined;
  }

  async createAutomationRule(data: InsertAutomationRule): Promise<AutomationRule> {
    const [rule] = await db.insert(automationRules).values(data).returning();
    return rule;
  }

  async updateAutomationRule(id: string, data: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined> {
    const [rule] = await db.update(automationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automationRules.id, id))
      .returning();
    return rule || undefined;
  }

  async deleteAutomationRule(id: string): Promise<void> {
    await db.delete(automationLog).where(eq(automationLog.ruleId, id));
    await db.delete(automationQueue).where(eq(automationQueue.ruleId, id));
    await db.delete(automationRules).where(eq(automationRules.id, id));
  }

  async enqueueAutomationItem(data: InsertAutomationQueueItem): Promise<AutomationQueueItem> {
    const [item] = await db.insert(automationQueue).values(data).returning();
    return item;
  }

  async getDueAutomationItems(): Promise<AutomationQueueItem[]> {
    return db.select().from(automationQueue)
      .where(and(
        lte(automationQueue.fireAt, new Date()),
        sql`${automationQueue.processedAt} IS NULL`
      ))
      .orderBy(asc(automationQueue.fireAt))
      .limit(50);
  }

  async markAutomationItemProcessed(id: string): Promise<void> {
    await db.update(automationQueue)
      .set({ processedAt: new Date() })
      .where(eq(automationQueue.id, id));
  }

  async createAutomationLog(data: InsertAutomationLogEntry): Promise<AutomationLogEntry> {
    const [entry] = await db.insert(automationLog).values(data).returning();
    return entry;
  }

  async getAutomationLogs(filters?: { ruleId?: string; limit?: number }): Promise<AutomationLogEntry[]> {
    const conditions: SQL[] = [];
    if (filters?.ruleId) conditions.push(eq(automationLog.ruleId, filters.ruleId));
    return db.select().from(automationLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(automationLog.executedAt))
      .limit(filters?.limit || 100);
  }

  async getAutomationQueueItems(filters?: { ruleId?: string; processed?: boolean; limit?: number }): Promise<AutomationQueueItem[]> {
    const conditions: SQL[] = [];
    if (filters?.ruleId) conditions.push(eq(automationQueue.ruleId, filters.ruleId));
    if (filters?.processed === true) conditions.push(isNotNull(automationQueue.processedAt));
    if (filters?.processed === false) conditions.push(sql`${automationQueue.processedAt} IS NULL`);
    return db.select().from(automationQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(automationQueue.createdAt))
      .limit(filters?.limit || 100);
  }

  async getActiveRulesForTrigger(triggerEvent: string, cityId?: string): Promise<AutomationRule[]> {
    const conditions: SQL[] = [
      eq(automationRules.triggerEvent, triggerEvent as any),
      eq(automationRules.isActive, true),
    ];
    return db.select().from(automationRules)
      .where(and(...conditions))
      .then(rules => rules.filter(r => !r.cityId || r.cityId === cityId));
  }

  async createStoryInvitation(data: InsertStoryInvitation): Promise<StoryInvitation> {
    const [inv] = await db.insert(storyInvitations).values(data).returning();
    return inv;
  }

  async getStoryInvitationById(id: string): Promise<StoryInvitation | undefined> {
    const [inv] = await db.select().from(storyInvitations).where(eq(storyInvitations.id, id)).limit(1);
    return inv;
  }

  async getStoryInvitationByToken(token: string): Promise<StoryInvitation | undefined> {
    const [inv] = await db.select().from(storyInvitations).where(eq(storyInvitations.token, token)).limit(1);
    return inv;
  }

  async listStoryInvitations(): Promise<StoryInvitation[]> {
    return db.select().from(storyInvitations).orderBy(desc(storyInvitations.createdAt));
  }

  async updateStoryInvitation(id: string, data: Partial<InsertStoryInvitation>): Promise<StoryInvitation | undefined> {
    const setData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    const [inv] = await db.update(storyInvitations)
      .set(setData as typeof storyInvitations.$inferInsert)
      .where(eq(storyInvitations.id, id))
      .returning();
    return inv;
  }

  async getInterviewQuestions(templateSetName?: string): Promise<InterviewQuestionTemplate[]> {
    if (templateSetName) {
      return db.select().from(interviewQuestionTemplates)
        .where(eq(interviewQuestionTemplates.templateSetName, templateSetName))
        .orderBy(asc(interviewQuestionTemplates.displayOrder));
    }
    return db.select().from(interviewQuestionTemplates)
      .where(eq(interviewQuestionTemplates.isDefault, true))
      .orderBy(asc(interviewQuestionTemplates.displayOrder));
  }

  async createInterviewQuestion(data: InsertInterviewQuestion): Promise<InterviewQuestionTemplate> {
    const [q] = await db.insert(interviewQuestionTemplates).values(data).returning();
    return q;
  }

  async updateInterviewQuestion(id: string, data: Partial<InsertInterviewQuestion>): Promise<InterviewQuestionTemplate | undefined> {
    const setData: Record<string, unknown> = { ...data };
    const [q] = await db.update(interviewQuestionTemplates)
      .set(setData as typeof interviewQuestionTemplates.$inferInsert)
      .where(eq(interviewQuestionTemplates.id, id))
      .returning();
    return q;
  }

  async deleteInterviewQuestion(id: string): Promise<void> {
    await db.delete(interviewQuestionTemplates).where(eq(interviewQuestionTemplates.id, id));
  }

  async getIntakeResponses(invitationId: string): Promise<IntakeResponse[]> {
    return db.select().from(intakeResponses)
      .where(eq(intakeResponses.invitationId, invitationId))
      .orderBy(asc(intakeResponses.displayOrder));
  }

  async upsertIntakeResponse(data: InsertIntakeResponse): Promise<IntakeResponse> {
    const existing = await db.select().from(intakeResponses)
      .where(and(
        eq(intakeResponses.invitationId, data.invitationId),
        eq(intakeResponses.questionId, data.questionId),
      )).limit(1);
    if (existing.length > 0) {
      const setData: Record<string, unknown> = { ...data, updatedAt: new Date() };
      const [updated] = await db.update(intakeResponses)
        .set(setData as typeof intakeResponses.$inferInsert)
        .where(eq(intakeResponses.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(intakeResponses).values(data).returning();
    return created;
  }

  async getLinkHubSettings(userId: string): Promise<LinkHubSettings | undefined> {
    const [settings] = await db.select().from(linkHubSettings).where(eq(linkHubSettings.userId, userId)).limit(1);
    return settings;
  }

  async upsertLinkHubSettings(data: InsertLinkHubSettings): Promise<LinkHubSettings> {
    const existing = await db.select().from(linkHubSettings).where(eq(linkHubSettings.userId, data.userId)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(linkHubSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(linkHubSettings.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(linkHubSettings).values(data).returning();
    return created;
  }

  async getLinkHubLinks(userId: string): Promise<LinkHubLink[]> {
    return db.select().from(linkHubLinks)
      .where(eq(linkHubLinks.userId, userId))
      .orderBy(asc(linkHubLinks.sortOrder));
  }

  async createLinkHubLink(data: InsertLinkHubLink): Promise<LinkHubLink> {
    const [created] = await db.insert(linkHubLinks).values(data).returning();
    return created;
  }

  async updateLinkHubLink(id: string, data: Partial<InsertLinkHubLink>): Promise<LinkHubLink | undefined> {
    const [updated] = await db.update(linkHubLinks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(linkHubLinks.id, id))
      .returning();
    return updated;
  }

  async deleteLinkHubLink(id: string): Promise<void> {
    await db.delete(linkHubLinks).where(eq(linkHubLinks.id, id));
  }

  async incrementLinkHubLinkClick(id: string): Promise<void> {
    await db.update(linkHubLinks)
      .set({ clickCount: sql`${linkHubLinks.clickCount} + 1` })
      .where(eq(linkHubLinks.id, id));
  }

  async reorderLinkHubLinks(userId: string, linkIds: string[]): Promise<void> {
    for (let i = 0; i < linkIds.length; i++) {
      await db.update(linkHubLinks)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(linkHubLinks.id, linkIds[i]), eq(linkHubLinks.userId, userId)));
    }
  }
}

export const storage = new DatabaseStorage();
