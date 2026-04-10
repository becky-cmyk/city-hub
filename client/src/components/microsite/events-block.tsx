import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, ChevronDown, Lock, Repeat } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";

interface EventItem {
  id: string;
  title: string;
  slug: string;
  startDateTime: string;
  endDateTime?: string | null;
  locationName?: string;
  visibility?: string;
  citySlug?: string;
  eventSeriesId?: string | null;
  venueName?: string | null;
}

interface EventsBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  events?: EventItem[];
  citySlug?: string;
}

export function EventsBlock({ block, template, accentColor, locale, events, citySlug }: EventsBlockProps) {
  const [showPast, setShowPast] = useState(false);
  const { headline } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Pr\u00f3ximos Eventos" : "Upcoming Events");
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;
  const eventList = events || [];
  const now = new Date();

  const visibleEvents = eventList.filter(evt => !evt.visibility || evt.visibility === "public" || evt.visibility === "private");
  const unlisted = eventList.filter(evt => evt.visibility === "unlisted");

  const upcoming = visibleEvents.filter(evt => {
    if (evt.visibility === "private") return new Date(evt.startDateTime) >= now;
    return new Date(evt.startDateTime) >= now;
  });

  const past = visibleEvents.filter(evt => {
    if (evt.visibility === "private") return false;
    return new Date(evt.startDateTime) < now;
  });

  if (upcoming.length === 0 && past.length === 0) return null;

  const resolvedCitySlug = citySlug || "charlotte";

  return (
    <section id="events" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-events">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-events-headline"
        >
          {headlineText}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {upcoming.map((evt) => {
            if (evt.visibility === "private") {
              return (
                <Card key={evt.id} className={`${template.cardStyle} p-6 space-y-3 opacity-75`} data-testid={`card-event-private-${evt.id}`}>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(new Date(evt.startDateTime), "MMM d, yyyy")}
                    </span>
                  </div>
                  <h3 className="font-semibold text-muted-foreground" style={{ fontFamily: template.fontHeading }}>
                    Private Event Scheduled
                  </h3>
                  <Badge variant="outline" className="text-[10px]">Invite Only</Badge>
                </Card>
              );
            }
            return (
              <Link key={evt.id} href={`/${resolvedCitySlug}/events/${evt.slug}`}>
                <Card className={`${template.cardStyle} p-6 space-y-3 cursor-pointer hover-elevate`} data-testid={`card-event-${evt.id}`}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" style={{ color: accentColor }} />
                    <span className="text-sm font-medium" style={{ color: accentColor }}>
                      {format(new Date(evt.startDateTime), "MMM d, yyyy")}
                    </span>
                  </div>
                  <h3 className="font-semibold" style={{ fontFamily: template.fontHeading }}>
                    {evt.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(evt.startDateTime), "h:mm a")}
                      {evt.endDateTime && ` - ${format(new Date(evt.endDateTime), "h:mm a")}`}
                    </span>
                    {evt.locationName && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {evt.locationName}
                      </span>
                    )}
                    {evt.eventSeriesId && (
                      <Badge variant="outline" className="text-[10px] gap-0.5" data-testid={`badge-recurring-${evt.id}`}>
                        <Repeat className="h-2.5 w-2.5" /> Recurring
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {past.length > 0 && (
          <div className="mt-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPast(!showPast)}
              className="mx-auto flex items-center gap-1"
              data-testid="button-toggle-past-events"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showPast ? "rotate-180" : ""}`} />
              {showPast ? "Hide" : "Show"} Past Events ({past.length})
            </Button>
            {showPast && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {past.map(evt => (
                  <Link key={evt.id} href={`/${resolvedCitySlug}/events/${evt.slug}`}>
                    <Card className={`${template.cardStyle} p-4 space-y-2 opacity-60 cursor-pointer hover-elevate`} data-testid={`card-past-event-${evt.id}`}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(evt.startDateTime), "MMM d, yyyy")}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium" style={{ fontFamily: template.fontHeading }}>
                        {evt.title}
                      </h3>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
