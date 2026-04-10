import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ArrowLeft, Calendar, Clock } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";

interface MapEvent {
  id: string;
  title: string;
  slug: string;
  start_date_time: string;
  end_date_time?: string | null;
  location_name?: string | null;
  address?: string | null;
  cost_text?: string | null;
  image_url?: string | null;
  is_featured: boolean;
  latitude?: string | null;
  longitude?: string | null;
  host_business_name?: string | null;
}

function createEventIcon(isFeatured: boolean) {
  const color = isFeatured ? "#a855f7" : "#6366f1";
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28" height="28"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  });
}

function MapBoundsUpdater({ events }: { events: MapEvent[] }) {
  const map = useMap();
  const hasSet = useRef(false);

  useEffect(() => {
    if (hasSet.current || events.length === 0) return;
    const valid = events.filter(e => e.latitude && e.longitude);
    if (valid.length === 0) return;

    const bounds = L.latLngBounds(
      valid.map(e => [parseFloat(e.latitude!), parseFloat(e.longitude!)] as [number, number])
    );
    map.fitBounds(bounds.pad(0.15));
    hasSet.current = true;
  }, [events, map]);

  return null;
}

export default function EventsMap({ citySlug }: { citySlug: string }) {
  usePageMeta({
    title: "Event Map | Events",
    description: "Find events near you on the map.",
    canonical: `${window.location.origin}/${citySlug}/events/map`,
  });

  const { data: events, isLoading } = useQuery<MapEvent[]>({
    queryKey: ["/api/cities", citySlug, "events", "map"],
  });

  const validEvents = (events || []).filter(e => e.latitude && e.longitude);
  const defaultCenter: [number, number] = [35.2271, -80.8431];
  const center = validEvents.length > 0
    ? [parseFloat(validEvents[0].latitude!), parseFloat(validEvents[0].longitude!)] as [number, number]
    : defaultCenter;

  return (
    <DarkPageShell fillHeight>
      <div className="space-y-4">
        <div>
          <Link href={`/${citySlug}/events`}>
            <Button variant="ghost" size="sm" className="text-white/60 mb-2" data-testid="button-back-events">
              <ArrowLeft className="h-4 w-4 mr-1" /> All Events
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1 text-white" data-testid="text-map-title">
            <MapPin className="h-6 w-6 text-purple-400" />
            Event Map
          </h1>
          <p className="text-white/50 text-sm">{validEvents.length} events with locations</p>
        </div>

        {isLoading ? (
          <Skeleton className="w-full h-[500px] rounded-lg bg-white/10" />
        ) : validEvents.length > 0 ? (
          <div className="rounded-lg overflow-hidden border border-white/10" style={{ height: "500px" }}>
            <MapContainer
              center={center}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <MapBoundsUpdater events={validEvents} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {validEvents.map((evt) => (
                <Marker
                  key={evt.id}
                  position={[parseFloat(evt.latitude!), parseFloat(evt.longitude!)] as [number, number]}
                  icon={createEventIcon(evt.is_featured)}
                >
                  <Popup>
                    <div className="min-w-[200px]" data-testid={`popup-event-${evt.id}`}>
                      <h3 className="font-bold text-sm mb-1">{evt.title}</h3>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(evt.start_date_time), "MMM d, yyyy")}
                        </p>
                        <p className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(evt.start_date_time), "h:mm a")}
                        </p>
                        {evt.location_name && (
                          <p className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{evt.location_name}
                          </p>
                        )}
                        {evt.cost_text && <p className="font-medium">{evt.cost_text}</p>}
                      </div>
                      <Link href={`/${citySlug}/events/${evt.slug}`}>
                        <button className="mt-2 text-xs text-purple-600 font-medium hover:underline" data-testid={`link-event-detail-${evt.id}`}>
                          View Event →
                        </button>
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        ) : (
          <div className="rounded-md bg-white/10 border border-white/10 p-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-white/20 mb-4" />
            <h3 className="font-semibold text-lg mb-1 text-white" data-testid="text-map-empty">No events with locations</h3>
            <p className="text-white/50 text-sm">Events will appear on the map when they have location data.</p>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
