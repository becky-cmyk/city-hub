const SESSION_KEY = "cch_session_id";

function getSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

type LeadEventType = "CLICK_WEBSITE" | "CLICK_DIRECTIONS" | "CLICK_CALL" | "CLICK_BOOKING" | "CLICK_ORDER" | "CLICK_MENU" | "CLICK_RIDE" | "ARTICLE_MENTION_VIEW" | "ARTICLE_MENTION_CLICK";

export function trackLeadEvent(citySlug: string, businessSlug: string, eventType: LeadEventType) {
  const payload = JSON.stringify({
    eventType,
    pagePath: window.location.pathname,
    referrerPath: document.referrer ? new URL(document.referrer).pathname : null,
    sessionId: getSessionId(),
  });

  const url = `/api/cities/${citySlug}/business/${businessSlug}/lead-event`;

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
}

export function getLeadSessionId(): string {
  return getSessionId();
}
