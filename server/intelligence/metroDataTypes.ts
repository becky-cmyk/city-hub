export enum StreamId {
  SEARCH_QUERIES = "search_queries",
  FILTER_USAGE = "filter_usage",
  NEIGHBORHOOD_EXPLORATION = "neighborhood_exploration",
  SAVES_FOLLOWS = "saves_follows",
  NO_RESULT_EVENTS = "no_result_events",
  REPEAT_QUERIES = "repeat_queries",
  LANGUAGE_OVERLAY = "language_overlay",
  LISTING_ENGAGEMENT = "listing_engagement",
  LISTING_UPDATES = "listing_updates",
  EVENT_ENGAGEMENT = "event_engagement",
  DROP_PARTICIPATION = "drop_participation",
  REFERRAL_ACTIVITY = "referral_activity",
  CROSS_PROMO = "cross_promo",
  LEAD_SUBMISSIONS = "lead_submissions",
  LEAD_FUNNEL = "lead_funnel",
  RESPONSE_TIME = "response_time",
  OUTCOME_TRACKING = "outcome_tracking",
  DEMAND_SUPPLY_GAP = "demand_supply_gap",
  BUILDING_PERMITS = "building_permits",
  ZONING_PETITIONS = "zoning_petitions",
  DEV_APPROVALS = "dev_approvals",
  INFRA_PROJECTS = "infra_projects",
  SCHOOL_CHANGES = "school_changes",
  CRIME_TRENDS = "crime_trends",
  RETAIL_VACANCY = "retail_vacancy",
  MULTIFAMILY_INVENTORY = "multifamily_inventory",
  RESIDENTIAL_MOVING = "residential_moving",
  BUSINESS_FILINGS = "business_filings",
  BUSINESS_CLOSURES = "business_closures",
  LIQUOR_LICENSES = "liquor_licenses",
  HEALTH_INSPECTIONS = "health_inspections",
  VENDOR_REQUESTS = "vendor_requests",
  SPACE_AVAILABLE = "space_available",
  COMMUNITY_PARTNERSHIPS = "community_partnerships",
  EVENT_VENDOR_CALLS = "event_vendor_calls",
  QR_SCAN_LOGS = "qr_scan_logs",
  ONPREM_CONVERSION = "onprem_conversion",
  HOST_PERFORMANCE = "host_performance",
}

export enum SignalType {
  BUSINESS_FILING = "business_filing",
  MULTIFAMILY = "multifamily",
  LANGUAGE_SPIKE = "language_spike",
  SEARCH_SPIKE = "search_spike",
  PERMIT = "permit",
  ZONING = "zoning",
  VACANCY = "vacancy",
}

export enum DataSourceType {
  MANUAL = "manual",
  CSV_IMPORT = "csv_import",
  STATE_REGISTRY = "state_registry",
  THIRD_PARTY_API = "third_party_api",
  PUBLIC_RECORD = "public_record",
  INTERNAL_LOG = "internal_log",
  SITE = "site",
  LICENSED_FEED = "licensed_feed",
}

export enum OutreachStatus {
  UNCONTACTED = "uncontacted",
  ATTEMPTED = "attempted",
  CONNECTED = "connected",
  NOT_INTERESTED = "not_interested",
  CONVERTED = "converted",
}

export enum LeaseUpStatus {
  PLANNING = "planning",
  UNDER_CONSTRUCTION = "under_construction",
  LEASE_UP = "lease_up",
  STABILIZED = "stabilized",
  UNKNOWN = "unknown",
}

export enum PartnerStatus {
  UNCONTACTED = "uncontacted",
  ATTEMPTED = "attempted",
  CONNECTED = "connected",
  NOT_INTERESTED = "not_interested",
  PARTNERED = "partnered",
}

export enum RefreshCadence {
  REALTIME = "realtime",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  MANUAL = "manual",
}

export enum LogEventType {
  PAGE_VIEW = "page_view",
  TOGGLE_LANGUAGE = "toggle_language",
  SEARCH_SUBMIT = "search_submit",
  FILTER_APPLY = "filter_apply",
}

export enum Language {
  EN = "en",
  ES = "es",
}

export interface BusinessFilingRecord {
  filingExternalId: string | null;
  businessName: string;
  filingDate: string;
  status: string | null;
  industryCode: string | null;
  organizerName: string | null;
  registeredAgent: string | null;
  registeredAddress: string | null;
  mailingAddress: string | null;
  stateCode: string;
  source: string;
  sourceUrl: string | null;
  outreachStatus: OutreachStatus;
  notes: string | null;
}

export interface MultifamilyRecord {
  propertyName: string;
  address: string;
  city: string | null;
  stateCode: string;
  unitCount: number | null;
  developer: string | null;
  managementCompany: string | null;
  completionDate: string | null;
  leaseUpStatus: LeaseUpStatus;
  rentLow: number | null;
  rentHigh: number | null;
  website: string | null;
  phone: string | null;
  source: string;
  sourceUrl: string | null;
  partnerStatus: PartnerStatus;
  qrInstalledFlag: boolean;
  hubIntegratedFlag: boolean;
  notes: string | null;
}

export interface LanguageUsageRecord {
  pageType: string;
  pageRefId: string | null;
  language: Language;
  eventType: LogEventType;
  queryText: string | null;
  categoryId: string | null;
  source: string;
}

export interface SignalFeedRecord {
  signalType: SignalType;
  title: string;
  summary: string | null;
  relatedTable: string | null;
  relatedId: string | null;
  signalDate: string | null;
  score: number;
}

export interface PermitRecord {
  permitNumber: string | null;
  permitType: string;
  address: string;
  value: number | null;
  contractor: string | null;
  issueDate: string | null;
  source: string;
  sourceUrl: string | null;
}

export interface ZoningRecord {
  petitionId: string | null;
  petitionType: string;
  address: string | null;
  hearingDate: string | null;
  outcome: string | null;
  source: string;
  sourceUrl: string | null;
}

export interface VacancyRecord {
  propertyType: string;
  address: string;
  sqft: number | null;
  askingRent: number | null;
  timeOnMarket: number | null;
  source: string;
  sourceUrl: string | null;
}

export interface QrScanRecord {
  locationNodeId: string;
  scannedAt: string;
  resultAction: string | null;
  conversionPath: string | null;
}

export interface StreamDefinition {
  id: StreamId;
  name: string;
  category: string;
  fields: string[];
  sources: DataSourceType[];
  cadence: RefreshCadence;
  storagePattern: "event_log" | "snapshot" | "log";
  monetizationProduct: string | null;
}
