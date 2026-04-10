export interface LiveFeed {
  id: string;
  title: string;
  type: "youtube" | "page";
  embedUrl: string;
  sourceUrl: string;
  category: LiveFeedCategory;
  description: string;
  organizationSlug: string;
  featured?: boolean;
}

export type LiveFeedCategory =
  | "Charlotte Skyline"
  | "Wildlife / Raptor"
  | "NC Scenic / Beach"
  | "Traffic & Transit"
  | "Weather"
  | "Sports"
  | "News & Media"
  | "Community"
  | "Mountains & More";

export const LIVE_FEED_CATEGORIES: LiveFeedCategory[] = [
  "Charlotte Skyline",
  "Wildlife / Raptor",
  "NC Scenic / Beach",
  "Traffic & Transit",
  "Weather",
  "Sports",
  "News & Media",
  "Community",
  "Mountains & More",
];

export const LIVE_FEEDS: LiveFeed[] = [
  {
    id: "clt-skyline-wbtv",
    title: "Charlotte Skyline (WBTV Tower Cam)",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/4Vv6mf2TLPo",
    sourceUrl: "https://www.youtube.com/watch?v=4Vv6mf2TLPo",
    category: "Charlotte Skyline",
    description: "Live view of the Charlotte skyline from the WBTV tower cam.",
    organizationSlug: "wbtv-charlotte",
    featured: true,
  },
  {
    id: "clt-skyline-live",
    title: "Charlotte Skyline Live",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/JXeIZvgayDE",
    sourceUrl: "https://www.youtube.com/watch?v=JXeIZvgayDE",
    category: "Charlotte Skyline",
    description: "24/7 live stream of the Charlotte, NC skyline.",
    organizationSlug: "wbtv-charlotte",
  },
  {
    id: "jordan-lake-eagle-1",
    title: "Jordan Lake Eagle Cam (NC)",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/K-JIB3vHWYs",
    sourceUrl: "https://www.youtube.com/watch?v=K-JIB3vHWYs",
    category: "Wildlife / Raptor",
    description: "Live bald eagle nest cam at Jordan Lake, North Carolina.",
    organizationSlug: "jordan-lake-state-recreation-area",
  },
  {
    id: "jordan-lake-eagle-2",
    title: "Jordan Lake Eagle Cam (Alt)",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/_0T1CHgnn-A",
    sourceUrl: "https://www.youtube.com/watch?v=_0T1CHgnn-A",
    category: "Wildlife / Raptor",
    description: "Alternate angle of the Jordan Lake bald eagle nest.",
    organizationSlug: "jordan-lake-state-recreation-area",
  },
  {
    id: "obx-webcams",
    title: "Outer Banks Webcams (Directory)",
    type: "page",
    embedUrl: "https://www.outerbanks.org/webcams/",
    sourceUrl: "https://www.outerbanks.org/webcams/",
    category: "NC Scenic / Beach",
    description: "Live webcams from across the Outer Banks, NC.",
    organizationSlug: "outer-banks-visitors-bureau",
  },
  {
    id: "surfchex-carolina-beach",
    title: "Surfchex — Carolina Beach Cam",
    type: "page",
    embedUrl: "https://www.surfchex.com/cams/carolina-beach-web-cam/",
    sourceUrl: "https://www.surfchex.com/cams/carolina-beach-web-cam/",
    category: "NC Scenic / Beach",
    description: "Live surf and beach conditions at Carolina Beach, NC.",
    organizationSlug: "surfchex",
  },
  {
    id: "ncdot-traffic-clt",
    title: "NCDOT Charlotte Traffic Cams",
    type: "page",
    embedUrl: "https://tims.ncdot.gov/tims/RegionSummary.aspx?type=Camera&region=Charlotte",
    sourceUrl: "https://tims.ncdot.gov/tims/RegionSummary.aspx?type=Camera&region=Charlotte",
    category: "Traffic & Transit",
    description: "Live traffic cameras across the Charlotte metro area from NCDOT.",
    organizationSlug: "ncdot",
  },
  {
    id: "clt-airport",
    title: "CLT Airport Flight Tracker",
    type: "page",
    embedUrl: "https://www.flightradar24.com/35.22,-80.94/12",
    sourceUrl: "https://www.flightradar24.com/35.22,-80.94/12",
    category: "Traffic & Transit",
    description: "Live flight tracking around Charlotte Douglas International Airport.",
    organizationSlug: "clt-airport",
  },
  {
    id: "nws-clt-radar",
    title: "NWS Charlotte Weather Radar",
    type: "page",
    embedUrl: "https://radar.weather.gov/?settings=v1_eyJhZ2VuZGEiOnsiaWQiOm51bGwsImNlbnRlciI6Wy04MC44NCwzNS4yM10sInpvb20iOjh9fQ%3D%3D",
    sourceUrl: "https://radar.weather.gov/",
    category: "Weather",
    description: "Live National Weather Service radar centered on Charlotte, NC.",
    organizationSlug: "nws-charlotte",
  },
  {
    id: "charlotte-motor-speedway",
    title: "Charlotte Motor Speedway",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/live_stream?channel=UCcaMuZaeuu9_4JlID_EtPBQ",
    sourceUrl: "https://www.youtube.com/c/CharlotteMotorSpeedway/live",
    category: "Sports",
    description: "Live streams and events from Charlotte Motor Speedway.",
    organizationSlug: "charlotte-motor-speedway",
  },
  {
    id: "wbtv-live-news",
    title: "WBTV Live News Stream",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/live_stream?channel=UCEIOhKF_egl81RLeTt86xwA",
    sourceUrl: "https://www.youtube.com/@WBTV/live",
    category: "News & Media",
    description: "Live news coverage from WBTV, Charlotte's CBS affiliate.",
    organizationSlug: "wbtv-charlotte",
  },
  {
    id: "wcnc-live-news",
    title: "WCNC Charlotte Live",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/live_stream?channel=UCMw_MrcgIKH4rU5D4zH6Hrg",
    sourceUrl: "https://www.youtube.com/@wcnc/live",
    category: "News & Media",
    description: "Live news from WCNC, Charlotte's NBC affiliate.",
    organizationSlug: "wcnc-charlotte",
  },
  {
    id: "wsoc-live-news",
    title: "WSOC-TV Charlotte Live",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/live_stream?channel=UC_SHPxQB2NwmbOEBfomBd6A",
    sourceUrl: "https://www.youtube.com/@WSOCTV/live",
    category: "News & Media",
    description: "Live coverage from WSOC-TV, Charlotte's ABC affiliate.",
    organizationSlug: "wsoc-tv-charlotte",
  },
  {
    id: "clt-city-council",
    title: "Charlotte City Council Meetings",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/live_stream?channel=UCiVPEUMk1n2GJzmduABmZ5g",
    sourceUrl: "https://www.youtube.com/@CityofCharlotte/live",
    category: "Community",
    description: "Live streams of Charlotte City Council and committee meetings.",
    organizationSlug: "charlotte-city-council",
  },
  {
    id: "emerald-isle-cams",
    title: "Emerald Isle Live Cameras",
    type: "page",
    embedUrl: "https://www.emeraldisle-nc.org/375/EI-Live-Cameras",
    sourceUrl: "https://www.emeraldisle-nc.org/375/EI-Live-Cameras",
    category: "Mountains & More",
    description: "Live cameras from Emerald Isle, NC.",
    organizationSlug: "town-of-emerald-isle",
  },
  {
    id: "bryson-city-cams",
    title: "Bryson City Webcams",
    type: "page",
    embedUrl: "https://www.explorebrysoncity.com/plan-your-visit/bryson-city-smoky-mountain-webcams/",
    sourceUrl: "https://www.explorebrysoncity.com/plan-your-visit/bryson-city-smoky-mountain-webcams/",
    category: "Mountains & More",
    description: "Live webcams from Bryson City and the Great Smoky Mountains.",
    organizationSlug: "bryson-city-tourism",
  },
];

export function getFeedsByCategory(category: LiveFeedCategory): LiveFeed[] {
  return LIVE_FEEDS.filter(f => f.category === category);
}

export function getFeaturedFeed(): LiveFeed {
  return LIVE_FEEDS.find(f => f.featured) || LIVE_FEEDS[0];
}
