import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class EventbriteConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const token = process.env.EVENTBRITE_TOKEN;
    if (!token) {
      console.warn("EventbriteConnector: EVENTBRITE_TOKEN not set — returning empty result");
      return { rows: [], totalAvailable: 0 };
    }

    const params = config.paramsJson || {};
    const location = params.location || "Charlotte";
    const latitude = params.latitude || 35.2271;
    const longitude = params.longitude || -80.8431;
    const withinMiles = params.withinMiles || 25;
    const limit = Math.min(params.limit || 10, 50);

    const searchParams = new URLSearchParams({
      "location.latitude": String(latitude),
      "location.longitude": String(longitude),
      "location.within": `${withinMiles}mi`,
      "sort_by": "date",
      "expand": "venue,organizer",
      "page_size": String(limit),
    });

    const url = `https://www.eventbriteapi.com/v3/events/search/?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Eventbrite API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const events = data.events || [];
    const rows: any[] = [];

    for (const event of events.slice(0, limit)) {
      const title = event.name?.text || "";
      if (!title) continue;

      const description = event.description?.text
        ? stripHtml(event.description.text)
        : event.summary || "";

      const startUtc = event.start?.utc || null;
      const endUtc = event.end?.utc || null;

      const venue = event.venue || {};
      const venueName = venue.name || null;
      const venueAddress = venue.address || {};
      const address = venueAddress.localized_address_display || venueAddress.address_1 || null;
      const city = venueAddress.city || location;
      const state = venueAddress.region || "NC";
      const zip = venueAddress.postal_code || null;

      const organizer = event.organizer?.name || null;
      const ticketUrl = event.url || null;
      const imageUrl = event.logo?.original?.url || event.logo?.url || null;
      const eventId = String(event.id);

      const isFree = event.is_free === true;
      const costText = isFree ? "Free" : null;

      rows.push({
        _externalId: eventId,
        _sourceType: "EVENTBRITE",
        _title: title,
        _description: description.slice(0, 5000),
        _startDateTime: startUtc,
        _endDateTime: endUtc,
        _locationName: venueName,
        _address: address,
        _city: city,
        _state: state,
        _zip: zip,
        _costText: costText,
        _imageUrl: imageUrl,
        _sourceUrl: ticketUrl,
        _organizer: organizer,
        _raw: event,
      });
    }

    return {
      rows,
      totalAvailable: data.pagination?.object_count || rows.length,
    };
  }
}
