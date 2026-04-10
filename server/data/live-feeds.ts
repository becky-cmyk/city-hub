export interface LiveFeedConfig {
  id: string;
  title: string;
  type: "youtube" | "page";
  embedUrl: string;
  sourceUrl: string;
  category: string;
  description: string;
  organizationSlug: string;
  featured?: boolean;
}

export const LIVE_FEEDS: LiveFeedConfig[] = [
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
    id: "charlotte-motor-speedway",
    title: "Charlotte Motor Speedway",
    type: "youtube",
    embedUrl: "https://www.youtube.com/embed/live_stream?channel=UCcaMuZaeuu9_4JlID_EtPBQ",
    sourceUrl: "https://www.youtube.com/c/CharlotteMotorSpeedway/live",
    category: "Sports",
    description: "Live streams and events from Charlotte Motor Speedway.",
    organizationSlug: "charlotte-motor-speedway",
  },
];
