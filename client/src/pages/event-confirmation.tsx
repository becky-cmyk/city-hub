import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ArrowLeft, Download, Calendar, QrCode } from "lucide-react";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Link } from "wouter";
import type { Event as EventType } from "@shared/schema";

function QRCodeDisplay({ value, size = 160 }: { value: string; size?: number }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&format=svg`;
  return (
    <div className="bg-white p-3 rounded-lg inline-block" data-testid="qr-code-display">
      <img src={qrUrl} alt="QR Code" width={size} height={size} />
    </div>
  );
}

export default function EventConfirmation({ citySlug, slug }: { citySlug: string; slug: string }) {
  const sessionId = new URLSearchParams(window.location.search).get("session_id") || "";

  const { data: event } = useQuery<EventType>({
    queryKey: ["/api/cities", citySlug, "events", slug],
    queryFn: async () => {
      const resp = await fetch(`/api/cities/${citySlug}/events/${slug}`);
      if (!resp.ok) throw new Error("Not found");
      return resp.json();
    },
  });

  const { data: tickets, isLoading } = useQuery<any[]>({
    queryKey: ["/api/events", event?.id, "confirmation", sessionId],
    queryFn: async () => {
      if (!event?.id || !sessionId) return [];
      const resp = await fetch(`/api/events/${event.id}/confirmation?session_id=${sessionId}`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!event?.id && !!sessionId,
  });

  const appUrl = window.location.origin;

  const handleAddToCalendar = () => {
    if (!event?.id) return;
    window.open(`/api/events/${event.id}/ics`, "_blank");
  };

  const handleGoogleCalendar = () => {
    if (!event) return;
    const start = new Date(event.startDateTime);
    const end = event.endDateTime ? new Date(event.endDateTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const formatGCal = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const location = [event.locationName, event.address, event.city, event.state].filter(Boolean).join(", ");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGCal(start)}/${formatGCal(end)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent((event.description || "").substring(0, 200))}`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <DarkPageShell maxWidth="narrow">
        <Skeleton className="h-40 w-full" />
      </DarkPageShell>
    );
  }

  return (
    <DarkPageShell maxWidth="narrow">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href={`/${citySlug}/events/${slug}`}>
            <Button variant="ghost" size="sm" className="gap-1 text-purple-300" data-testid="link-back-event">
              <ArrowLeft className="h-4 w-4" /> Back to Event
            </Button>
          </Link>
        </div>

        <Card className="p-6 text-center space-y-4 border-green-500/30 bg-green-950/10">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <div>
            <h1 className="text-xl font-bold text-white" data-testid="text-confirmation-title">
              Tickets Confirmed!
            </h1>
            {event && (
              <p className="text-sm text-muted-foreground mt-1">{event.title}</p>
            )}
          </div>
        </Card>

        {tickets && tickets.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase">Your Tickets</h2>
            {tickets.map((ticket: any) => (
              <Card key={ticket.id} className="p-5 space-y-4" data-testid={`card-ticket-${ticket.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white">{ticket.ticket_type_name || "General"}</p>
                    <p className="text-sm text-muted-foreground">{ticket.buyer_name}</p>
                    {ticket.total_paid > 0 && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        ${(ticket.total_paid / 100).toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-500/30">
                    <QrCode className="h-3 w-3 mr-1" /> Valid
                  </Badge>
                </div>
                <div className="flex justify-center">
                  <QRCodeDisplay
                    value={`${appUrl}/${citySlug}/events/${slug}/checkin/${ticket.qr_token}`}
                  />
                </div>
                <p className="text-[10px] text-center text-muted-foreground font-mono">
                  {ticket.qr_token}
                </p>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Add to Calendar
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAddToCalendar} className="flex-1" data-testid="button-add-ics">
              <Download className="h-4 w-4 mr-1" /> .ics File
            </Button>
            <Button variant="outline" size="sm" onClick={handleGoogleCalendar} className="flex-1" data-testid="button-add-google">
              Google Calendar
            </Button>
          </div>
        </Card>
      </div>
    </DarkPageShell>
  );
}
