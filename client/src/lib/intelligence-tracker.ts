type IntelligenceEventType =
  | "PROFILE_VIEW" | "WEBSITE_CLICK" | "CALL_CLICK" | "DIRECTIONS_CLICK"
  | "SAVE" | "LEAD_START" | "LEAD_SUBMIT" | "LEAD_ABANDON"
  | "DECISION_FACTOR" | "RSS_CLICK" | "SEARCH_RESULT_CLICK"
  | "FEED_CARD_VIEW" | "FEED_CARD_TAP" | "FEED_CARD_LIKE" | "FEED_CARD_SAVE" | "FEED_CARD_SHARE";

interface TrackParams {
  citySlug: string;
  entityType: "BUSINESS" | "MULTIFAMILY";
  entityId: string;
  eventType: IntelligenceEventType;
  zipOrigin?: string;
  language?: string;
  referrer?: string;
  metadata?: Record<string, any>;
}

export function trackIntelligenceEvent(params: TrackParams) {
  const payload = JSON.stringify(params);
  const url = "/api/intelligence/log";

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
}

type FeedEventType = "FEED_CARD_VIEW" | "FEED_CARD_TAP" | "FEED_CARD_LIKE" | "FEED_CARD_SAVE" | "FEED_CARD_SHARE" | "PROFILE_VIEW";

interface FeedEvent {
  eventType: FeedEventType;
  contentType: string;
  contentId: string;
  cityId: string;
}

let feedEventBuffer: FeedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushFeedEvents() {
  if (feedEventBuffer.length === 0) return;
  const events = [...feedEventBuffer];
  feedEventBuffer = [];
  const payload = JSON.stringify({ events });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/log/feed-events", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/log/feed-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
}

export function trackFeedEvent(event: FeedEvent) {
  feedEventBuffer.push(event);
  if (feedEventBuffer.length >= 20) {
    flushFeedEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushFeedEvents();
    }, 5000);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushFeedEvents);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushFeedEvents();
  });
}
