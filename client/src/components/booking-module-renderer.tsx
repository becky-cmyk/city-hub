import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, MessageCircle, Instagram, ExternalLink, Calendar, Clock, Zap } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { Provider, ProviderOpening } from "@shared/schema";

const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  available_today: { label: "Available Today", color: "bg-green-600" },
  available_tomorrow: { label: "Available Tomorrow", color: "bg-blue-600" },
  last_minute: { label: "Last-Minute Opening", color: "bg-red-600" },
  this_afternoon: { label: "This Afternoon", color: "bg-amber-600" },
  this_evening: { label: "This Evening", color: "bg-purple-600" },
};

function trackAction(
  providerId: string,
  actionType: string,
  context?: string,
  extra?: { cityId?: string; zoneId?: string; metadata?: Record<string, string> },
) {
  apiRequest("POST", `/api/providers/${providerId}/contact-action`, {
    actionType,
    sourceContext: context || "provider_profile",
    referrerPage: window.location.pathname,
    cityId: extra?.cityId || null,
    zoneId: extra?.zoneId || null,
    metadata: extra?.metadata || null,
  }).catch(() => {});
}

function sanitizeEmbedCode(html: string): string {
  const allowedTags = ["iframe", "script", "link", "div", "span", "style", "a", "button", "form", "input", "label"];
  const doc = new DOMParser().parseFromString(html, "text/html");
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (!allowedTags.includes(tag)) return "";
    const safeAttrs: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) continue;
      if (name === "href" || name === "src" || name === "action") {
        const val = attr.value.trim().toLowerCase();
        if (val.startsWith("javascript:") || val.startsWith("data:")) continue;
      }
      safeAttrs.push(`${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`);
    }
    const children = Array.from(node.childNodes).map(walk).join("");
    return `<${tag} ${safeAttrs.join(" ")}>${children}</${tag}>`;
  }
  return Array.from(doc.body.childNodes).map(walk).join("");
}

function CallTextButtons({ provider, cityId, zoneId }: { provider: Provider; cityId?: string; zoneId?: string | null }) {
  const ctx = { cityId, zoneId: zoneId || undefined };
  return (
    <div className="flex flex-wrap gap-2">
      {provider.phone && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          data-testid="button-call-provider"
          onClick={() => {
            trackAction(provider.id, "call_click", undefined, ctx);
            window.location.href = `tel:${provider.phone}`;
          }}
        >
          <Phone className="h-4 w-4" />
          Call
        </Button>
      )}
      {provider.smsNumber && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          data-testid="button-text-provider"
          onClick={() => {
            trackAction(provider.id, "text_click", undefined, ctx);
            window.location.href = `sms:${provider.smsNumber}`;
          }}
        >
          <MessageCircle className="h-4 w-4" />
          Text
        </Button>
      )}
      {provider.instagramUrl && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          data-testid="button-instagram-provider"
          onClick={() => {
            trackAction(provider.id, "instagram_click", undefined, ctx);
            window.open(provider.instagramUrl!, "_blank");
          }}
        >
          <Instagram className="h-4 w-4" />
          Instagram
        </Button>
      )}
      {provider.websiteUrl && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          data-testid="button-website-provider"
          onClick={() => {
            trackAction(provider.id, "website_click", undefined, ctx);
            window.open(provider.websiteUrl!, "_blank");
          }}
        >
          <ExternalLink className="h-4 w-4" />
          Website
        </Button>
      )}
    </div>
  );
}

function EmbedWidget({ provider, cityId, zoneId }: { provider: Provider; cityId?: string; zoneId?: string | null }) {
  if (!provider.bookingEmbedCode) return null;
  return (
    <div className="space-y-3">
      <div
        className="rounded-lg overflow-hidden border"
        style={{ minHeight: "400px" }}
        data-testid="embed-booking-widget"
      >
        <iframe
          src={provider.bookingWidgetUrl || undefined}
          srcDoc={!provider.bookingWidgetUrl && provider.bookingEmbedCode ? sanitizeEmbedCode(provider.bookingEmbedCode) : undefined}
          className="w-full border-0"
          style={{ minHeight: "400px" }}
          title={`Book with ${provider.displayName}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
      <CallTextButtons provider={provider} cityId={cityId} zoneId={zoneId} />
    </div>
  );
}

function PopupWidget({ provider, cityId, zoneId }: { provider: Provider; cityId?: string; zoneId?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className="w-full gap-2 text-base font-semibold"
        data-testid="button-book-now-popup"
        onClick={() => {
          trackAction(provider.id, "booking_click", "popup_widget", { cityId, zoneId: zoneId || undefined });
          setOpen(true);
        }}
      >
        <Calendar className="h-5 w-5" />
        Book Now
      </Button>
      <CallTextButtons provider={provider} cityId={cityId} zoneId={zoneId} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book with {provider.displayName}</DialogTitle>
          </DialogHeader>
          {provider.bookingWidgetUrl ? (
            <iframe
              src={provider.bookingWidgetUrl}
              className="w-full border-0 rounded"
              style={{ minHeight: "500px" }}
              title={`Book with ${provider.displayName}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : provider.bookingEmbedCode ? (
            <iframe
              srcDoc={sanitizeEmbedCode(provider.bookingEmbedCode)}
              className="w-full border-0 rounded"
              style={{ minHeight: "500px" }}
              title={`Book with ${provider.displayName}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <p className="text-muted-foreground text-sm">Booking widget is being configured.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeepLinkButton({ provider, cityId, zoneId }: { provider: Provider; cityId?: string; zoneId?: string | null }) {
  return (
    <div className="space-y-3">
      {provider.bookingUrl && (
        <Button
          size="lg"
          className="w-full gap-2 text-base font-semibold"
          data-testid="button-book-now-deeplink"
          onClick={() => {
            trackAction(provider.id, "booking_click", "deep_link", { cityId, zoneId: zoneId || undefined });
            window.open(provider.bookingUrl!, "_blank");
          }}
        >
          <Calendar className="h-5 w-5" />
          Book Now
        </Button>
      )}
      <CallTextButtons provider={provider} cityId={cityId} zoneId={zoneId} />
    </div>
  );
}

function CallTextFallback({ provider, cityId, zoneId }: { provider: Provider; cityId?: string; zoneId?: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Contact {provider.displayName} to book an appointment:
      </p>
      <CallTextButtons provider={provider} cityId={cityId} zoneId={zoneId} />
      {provider.bookingUrl && (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1.5"
          data-testid="button-book-online-fallback"
          onClick={() => {
            trackAction(provider.id, "booking_click", "fallback_link", { cityId, zoneId: zoneId || undefined });
            window.open(provider.bookingUrl!, "_blank");
          }}
        >
          <ExternalLink className="h-4 w-4" />
          Book Online
        </Button>
      )}
    </div>
  );
}

export function OpeningCard({
  opening,
  provider,
  compact = false,
  cityId,
  zoneId,
}: {
  opening: ProviderOpening;
  provider?: Pick<Provider, "id" | "displayName" | "slug" | "phone" | "smsNumber" | "instagramUrl" | "bookingUrl" | "profileImageUrl">;
  compact?: boolean;
  cityId?: string;
  zoneId?: string | null;
}) {
  const urgency = URGENCY_LABELS[opening.urgencyLabel] || URGENCY_LABELS.available_today;

  return (
    <Card className={`overflow-hidden ${compact ? "p-3" : "p-4"}`} data-testid={`card-opening-${opening.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${urgency.color} text-white text-[10px]`}>
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              {urgency.label}
            </Badge>
            {opening.openingTimeLabel && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {opening.openingTimeLabel}
              </span>
            )}
          </div>
          <p className={`font-semibold ${compact ? "text-sm" : "text-base"} leading-tight`}>{opening.title}</p>
          {provider && !compact && (
            <p className="text-xs text-muted-foreground">{provider.displayName}</p>
          )}
          {opening.notes && !compact && (
            <p className="text-xs text-muted-foreground">{opening.notes}</p>
          )}
        </div>
        {provider?.bookingUrl && (
          <Button
            size="sm"
            className="shrink-0 gap-1"
            data-testid={`button-opening-book-${opening.id}`}
            onClick={() => {
              trackAction(provider.id, "opening_click", `opening_${opening.id}`, {
                cityId: cityId,
                zoneId: zoneId || undefined,
                metadata: { openingId: opening.id, openingTitle: opening.title },
              });
              window.open(provider.bookingUrl!, "_blank");
            }}
          >
            <Calendar className="h-3.5 w-3.5" />
            Book
          </Button>
        )}
        {!provider?.bookingUrl && provider?.phone && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1"
            data-testid={`button-opening-call-${opening.id}`}
            onClick={() => {
              trackAction(provider.id, "opening_click", `opening_${opening.id}`, {
                cityId: cityId,
                zoneId: zoneId || undefined,
                metadata: { openingId: opening.id, openingTitle: opening.title },
              });
              window.location.href = `tel:${provider.phone}`;
            }}
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </Button>
        )}
      </div>
    </Card>
  );
}

function ManualLiveOpenings({ provider, openings }: { provider: Provider; openings: ProviderOpening[] }) {
  return (
    <div className="space-y-3">
      {openings.length > 0 ? (
        <div className="space-y-2">
          {openings.map((o) => (
            <OpeningCard key={o.id} opening={o} provider={provider} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No live openings right now. Check back soon.</p>
      )}
      <CallTextButtons provider={provider} />
    </div>
  );
}

function ApiConnectedPlaceholder({ provider }: { provider: Provider }) {
  return (
    <div className="space-y-3">
      <Card className="p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Real-time availability coming soon for {provider.displayName}.
        </p>
      </Card>
      <DeepLinkButton provider={provider} />
    </div>
  );
}

export function BookingModuleRenderer({
  provider,
  openings = [],
  cityId,
  zoneId,
}: {
  provider: Provider;
  openings?: ProviderOpening[];
  cityId?: string;
  zoneId?: string | null;
}) {
  switch (provider.bookingModuleType) {
    case "embed_widget":
      return <EmbedWidget provider={provider} />;
    case "popup_widget":
      return <PopupWidget provider={provider} />;
    case "deep_link":
      return <DeepLinkButton provider={provider} />;
    case "call_text_fallback":
      return <CallTextFallback provider={provider} />;
    case "manual_live_opening":
      return <ManualLiveOpenings provider={provider} openings={openings} />;
    case "api_connected":
      return <ApiConnectedPlaceholder provider={provider} />;
    default:
      return <DeepLinkButton provider={provider} />;
  }
}
