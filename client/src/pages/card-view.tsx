import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { Phone, Mail, Globe, Download, Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, Check, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DigitalCard } from "@shared/schema";
import { usePageMeta } from "@/hooks/use-page-meta";
import { apiRequest } from "@/lib/queryClient";
import { DarkPageShell } from "@/components/dark-page-shell";

function generateVCard(card: DigitalCard): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${card.name}`,
  ];
  if (card.title) lines.push(`TITLE:${card.title}`);
  if (card.company) lines.push(`ORG:${card.company}`);
  if (card.email) lines.push(`EMAIL;TYPE=WORK:${card.email}`);
  if (card.phone) lines.push(`TEL;TYPE=WORK:${card.phone}`);
  if (card.websiteUrl) lines.push(`URL:${card.websiteUrl}`);
  if (card.personPhotoUrl) lines.push(`PHOTO;VALUE=URI:${card.personPhotoUrl}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadVCard(card: DigitalCard) {
  const vcf = generateVCard(card);
  const blob = new Blob([vcf], { type: "text/vcard" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${card.name.replace(/\s+/g, "_")}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadIcs(icsData: string, filename: string) {
  const blob = new Blob([icsData], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type BookingStep = "calendar" | "slots" | "form" | "confirmed";

function BookingFlow({ card, themeColor }: { card: DigitalCard; themeColor: string }) {
  const [step, setStep] = useState<BookingStep>("calendar");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const maxDays = card.bookingMaxDaysAhead || 30;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDays);

  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const { data: slotsData, isLoading: slotsLoading } = useQuery<{ slots: { start: string; end: string }[] }>({
    queryKey: ["/api/card", card.slug, "availability", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/card/${card.slug}/availability?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to load availability");
      return res.json();
    },
    enabled: !!selectedDate && step === "slots",
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/card/${card.slug}/book`, {
        guestName,
        guestEmail,
        guestPhone: guestPhone || undefined,
        startTime: selectedSlot!.start,
        endTime: selectedSlot!.end,
        notes: notes || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmedBooking(data);
      setStep("confirmed");
    },
  });

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const handleDateClick = (day: number) => {
    const dateStr = toDateStr(viewYear, viewMonth, day);
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setStep("slots");
  };

  const handleSlotClick = (slot: { start: string; end: string }) => {
    setSelectedSlot(slot);
    setStep("form");
  };

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim() || !selectedSlot) return;
    bookMutation.mutate();
  };

  if (step === "confirmed" && confirmedBooking) {
    return (
      <div className="space-y-4 text-center" data-testid="div-booking-confirmed">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: themeColor }}>
          <Check className="w-7 h-7 text-white" />
        </div>
        <h3 className="font-semibold text-lg">Meeting Booked</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p data-testid="text-confirmed-date">{formatDateDisplay(selectedDate)}</p>
          <p data-testid="text-confirmed-time">{formatTime(selectedSlot!.start)} - {formatTime(selectedSlot!.end)}</p>
          <p>with {card.name}</p>
        </div>
        {confirmedBooking.ics && (
          <Button
            variant="outline"
            onClick={() => downloadIcs(confirmedBooking.ics, `meeting-${card.name.replace(/\s+/g, "-")}.ics`)}
            data-testid="button-add-to-calendar"
          >
            <CalendarDays className="w-4 h-4 mr-1.5" />
            Add to Calendar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => { setStep("calendar"); setSelectedDate(""); setSelectedSlot(null); setGuestName(""); setGuestEmail(""); setGuestPhone(""); setNotes(""); setConfirmedBooking(null); }}
          data-testid="button-book-another"
        >
          Book another time
        </Button>
      </div>
    );
  }

  if (step === "form" && selectedSlot) {
    return (
      <div className="space-y-4" data-testid="div-booking-form">
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground"
          onClick={() => setStep("slots")}
          data-testid="button-back-to-slots"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-accent/50 rounded-lg p-3 text-sm space-y-1">
          <p className="font-medium">{formatDateDisplay(selectedDate)}</p>
          <p className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="guest-name" className="text-sm">Your Name *</Label>
            <Input
              id="guest-name"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Full name"
              required
              data-testid="input-guest-name"
            />
          </div>
          <div>
            <Label htmlFor="guest-email" className="text-sm">Your Email *</Label>
            <Input
              id="guest-email"
              type="email"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              placeholder="email@example.com"
              required
              data-testid="input-guest-email"
            />
          </div>
          <div>
            <Label htmlFor="guest-phone" className="text-sm">Phone (optional)</Label>
            <Input
              id="guest-phone"
              type="tel"
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)}
              placeholder="(555) 555-5555"
              data-testid="input-guest-phone"
            />
          </div>
          <div>
            <Label htmlFor="guest-notes" className="text-sm">Notes (optional)</Label>
            <Textarea
              id="guest-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What would you like to discuss?"
              rows={2}
              data-testid="input-guest-notes"
            />
          </div>
          {bookMutation.isError && (
            <p className="text-destructive text-sm" data-testid="text-booking-error">
              {(bookMutation.error as any)?.message || "Failed to book. Please try again."}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            style={{ backgroundColor: themeColor, borderColor: themeColor }}
            disabled={bookMutation.isPending || !guestName.trim() || !guestEmail.trim()}
            data-testid="button-confirm-booking"
          >
            {bookMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarDays className="w-4 h-4 mr-2" />}
            Confirm Booking
          </Button>
        </form>
      </div>
    );
  }

  if (step === "slots") {
    return (
      <div className="space-y-4" data-testid="div-booking-slots">
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground"
          onClick={() => { setStep("calendar"); setSelectedDate(""); }}
          data-testid="button-back-to-calendar"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <p className="font-medium text-sm">{formatDateDisplay(selectedDate)}</p>
        {slotsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (slotsData?.slots || []).length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground" data-testid="text-no-slots">
            <p>No available times on this date.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setStep("calendar"); setSelectedDate(""); }} data-testid="button-pick-another-date">
              Pick another date
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {(slotsData?.slots || []).map((slot) => (
              <button
                key={slot.start}
                className="px-3 py-2.5 text-sm rounded-lg border transition-colors text-center font-medium"
                style={{
                  borderColor: selectedSlot?.start === slot.start ? themeColor : undefined,
                  backgroundColor: selectedSlot?.start === slot.start ? `${themeColor}15` : undefined,
                  color: selectedSlot?.start === slot.start ? themeColor : undefined,
                }}
                onClick={() => handleSlotClick(slot)}
                data-testid={`button-slot-${slot.start}`}
              >
                {formatTime(slot.start)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="div-booking-calendar">
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"
          data-testid="button-prev-month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium" data-testid="text-calendar-month">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={handleNextMonth}
          disabled={!canGoNext}
          className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"
          data-testid="button-next-month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-[11px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {calendarDays.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const dateStr = toDateStr(viewYear, viewMonth, day);
          const dateObj = new Date(dateStr + "T12:00:00");
          const isPast = dateStr < todayStr;
          const isTooFar = dateObj > maxDate;
          const isDisabled = isPast || isTooFar;
          const isToday = dateStr === todayStr;

          return (
            <button
              key={dateStr}
              disabled={isDisabled}
              onClick={() => handleDateClick(day)}
              className={`text-sm py-2 rounded-lg transition-colors ${
                isDisabled ? "text-muted-foreground/30 cursor-not-allowed" :
                isToday ? "font-bold ring-1 ring-current" :
                "hover:bg-accent"
              }`}
              style={!isDisabled ? { color: themeColor } : undefined}
              data-testid={`button-day-${dateStr}`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        {card.bookingSlotMinutes || 30} min meetings
      </p>
    </div>
  );
}

function ContactExchangeForm({ card, themeColor }: { card: DigitalCard; themeColor: string }) {
  const [showForm, setShowForm] = useState(false);
  const [exchangeName, setExchangeName] = useState("");
  const [exchangeEmail, setExchangeEmail] = useState("");
  const [exchangePhone, setExchangePhone] = useState("");
  const [exchangeBusiness, setExchangeBusiness] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const exchangeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/card/${card.slug}/exchange`, {
        name: exchangeName,
        email: exchangeEmail,
        phone: exchangePhone || undefined,
        businessName: exchangeBusiness || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  if (submitted) {
    return (
      <div className="text-center space-y-2 py-3" data-testid="div-exchange-success">
        <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: themeColor }}>
          <Check className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm font-medium">Info Sent</p>
        <p className="text-xs text-muted-foreground">{card.name} now has your contact details.</p>
      </div>
    );
  }

  if (!showForm) {
    return (
      <Button
        variant="outline"
        className="w-full"
        style={{ borderColor: themeColor, color: themeColor }}
        onClick={() => setShowForm(true)}
        data-testid="button-share-my-info"
      >
        <UserPlus className="w-4 h-4 mr-2" />
        Share My Info
      </Button>
    );
  }

  return (
    <div className="space-y-3 border rounded-lg p-4" data-testid="div-exchange-form">
      <p className="text-sm font-medium text-center">Share your contact info with {card.name}</p>
      <div>
        <Label htmlFor="ex-name" className="text-sm">Name *</Label>
        <Input
          id="ex-name"
          value={exchangeName}
          onChange={e => setExchangeName(e.target.value)}
          placeholder="Your full name"
          required
          data-testid="input-exchange-name"
        />
      </div>
      <div>
        <Label htmlFor="ex-email" className="text-sm">Email *</Label>
        <Input
          id="ex-email"
          type="email"
          value={exchangeEmail}
          onChange={e => setExchangeEmail(e.target.value)}
          placeholder="you@example.com"
          required
          data-testid="input-exchange-email"
        />
      </div>
      <div>
        <Label htmlFor="ex-phone" className="text-sm">Phone</Label>
        <Input
          id="ex-phone"
          type="tel"
          value={exchangePhone}
          onChange={e => setExchangePhone(e.target.value)}
          placeholder="(555) 555-5555"
          data-testid="input-exchange-phone"
        />
      </div>
      <div>
        <Label htmlFor="ex-business" className="text-sm">Business Name</Label>
        <Input
          id="ex-business"
          value={exchangeBusiness}
          onChange={e => setExchangeBusiness(e.target.value)}
          placeholder="Your company (if applicable)"
          data-testid="input-exchange-business"
        />
      </div>
      {exchangeMutation.isError && (
        <p className="text-destructive text-sm" data-testid="text-exchange-error">Failed to send. Please try again.</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => setShowForm(false)}
          data-testid="button-exchange-cancel"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1 text-white"
          style={{ backgroundColor: themeColor }}
          disabled={exchangeMutation.isPending || !exchangeName.trim() || !exchangeEmail.trim()}
          onClick={() => exchangeMutation.mutate()}
          data-testid="button-exchange-submit"
        >
          {exchangeMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
          Send
        </Button>
      </div>
    </div>
  );
}

export default function CardView() {
  const params = useParams<{ slug: string }>();
  const [showBooking, setShowBooking] = useState(false);

  const { data: card, isLoading, error } = useQuery<DigitalCard>({
    queryKey: ["/api/card", params.slug],
    enabled: !!params.slug,
  });

  useRegisterAdminEdit("digital-cards", card?.id, "Edit Card");

  const ogDescription = card ? `${card.name}${card.title ? ` - ${card.title}` : ""}${card.company ? ` at ${card.company}` : ""}` : "";
  usePageMeta({
    title: card ? `${card.name} - Digital Card` : "Digital Card",
    description: ogDescription,
    ogTitle: card ? card.name : "Digital Card",
    ogDescription,
    ogImage: card?.personPhotoUrl || card?.cardImageUrl || card?.companyLogoUrl || undefined,
    ogType: "profile",
    ogUrl: card ? `${window.location.origin}/card/${card.slug}` : undefined,
  });

  if (isLoading) {
    return (
      <DarkPageShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md p-6 space-y-4">
            <Skeleton className="w-full h-40 rounded-md" />
            <div className="flex justify-center">
              <Skeleton className="w-24 h-24 rounded-full" />
            </div>
            <Skeleton className="w-48 h-6 mx-auto" />
            <Skeleton className="w-32 h-4 mx-auto" />
            <Skeleton className="w-40 h-4 mx-auto" />
            <div className="flex gap-3 justify-center">
              <Skeleton className="w-20 h-9" />
              <Skeleton className="w-20 h-9" />
              <Skeleton className="w-20 h-9" />
            </div>
          </Card>
        </div>
      </DarkPageShell>
    );
  }

  if (error || !card) {
    return (
      <DarkPageShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md p-8 text-center space-y-4">
            <h1 className="text-xl font-semibold" data-testid="text-card-not-found">Card Not Found</h1>
            <p className="text-muted-foreground">This digital business card doesn't exist or has been deactivated.</p>
          </Card>
        </div>
      </DarkPageShell>
    );
  }

  const themeColor = card.themeColor || "#6B21A8";
  const initials = card.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const hasExternalCalendar = !!card.calendarUrl && !card.bookingEnabled;
  const hasNativeBooking = !!card.bookingEnabled;
  const hasAnyBooking = hasExternalCalendar || hasNativeBooking;

  return (
    <DarkPageShell>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md">
        <Card className="overflow-visible relative">
          {card.cardImageUrl ? (
            <div className="w-full h-48 overflow-hidden rounded-t-md">
              <img
                src={card.cardImageUrl}
                alt="Card banner"
                className="w-full h-full object-cover"
                data-testid="img-card-banner"
              />
            </div>
          ) : (
            <div
              className="w-full h-48 rounded-t-md"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}88)` }}
              data-testid="div-card-banner"
            />
          )}

          <div className="flex justify-center -mt-14 relative z-10">
            <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
              {(card.personPhotoUrl || card.photoUrl) ? (
                <AvatarImage
                  src={card.personPhotoUrl || card.photoUrl || ""}
                  alt={card.name}
                  data-testid="img-person-photo"
                />
              ) : null}
              <AvatarFallback
                className="text-2xl font-bold text-white"
                style={{ backgroundColor: themeColor }}
                data-testid="text-person-initials"
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="px-6 pt-4 pb-6 text-center space-y-4">
            {card.companyLogoUrl && (
              <div className="flex justify-center">
                <img
                  src={card.companyLogoUrl}
                  alt={card.company || "Company logo"}
                  className="h-8 object-contain"
                  data-testid="img-company-logo"
                />
              </div>
            )}

            <div className="space-y-1">
              <h1 className="text-2xl font-bold" data-testid="text-card-name">{card.name}</h1>
              {card.title && (
                <p className="text-muted-foreground" data-testid="text-card-title">{card.title}</p>
              )}
              {card.company && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1" data-testid="text-card-company">
                  <Building2 className="w-3.5 h-3.5" />
                  {card.company}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {card.phone && (
                <Button
                  variant="outline"
                  asChild
                  data-testid="button-call"
                >
                  <a href={`tel:${card.phone}`}>
                    <Phone className="w-4 h-4 mr-1.5" />
                    Call
                  </a>
                </Button>
              )}
              {card.email && (
                <Button
                  variant="outline"
                  asChild
                  data-testid="button-email"
                >
                  <a href={`mailto:${card.email}`}>
                    <Mail className="w-4 h-4 mr-1.5" />
                    Email
                  </a>
                </Button>
              )}
              {card.websiteUrl && (
                <Button
                  variant="outline"
                  asChild
                  data-testid="button-website"
                >
                  <a href={card.websiteUrl} target="_blank" rel="noopener noreferrer">
                    <Globe className="w-4 h-4 mr-1.5" />
                    Website
                  </a>
                </Button>
              )}
            </div>

            {(card.phone || card.email) && (
              <div className="pt-2 space-y-2 text-sm text-muted-foreground">
                {card.phone && (
                  <p data-testid="text-phone">{card.phone}</p>
                )}
                {card.email && (
                  <p data-testid="text-email">{card.email}</p>
                )}
              </div>
            )}

            {hasAnyBooking && !showBooking && (
              <div className="pt-2">
                {hasNativeBooking ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    style={{ borderColor: themeColor, color: themeColor }}
                    onClick={() => setShowBooking(true)}
                    data-testid="button-schedule-time"
                  >
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Schedule Time
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    style={{ borderColor: themeColor, color: themeColor }}
                    asChild
                    data-testid="button-book-meeting-external"
                  >
                    <a href={card.calendarUrl!} target="_blank" rel="noopener noreferrer">
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Book a Meeting
                    </a>
                  </Button>
                )}
              </div>
            )}

            {hasNativeBooking && showBooking && (
              <div className="pt-2 border-t">
                <BookingFlow card={card} themeColor={themeColor} />
              </div>
            )}

            <div className="pt-2">
              <ContactExchangeForm card={card} themeColor={themeColor} />
            </div>

            <div className="pt-2">
              <Button
                className="w-full"
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
                onClick={() => downloadVCard(card)}
                data-testid="button-save-contact"
              >
                <Download className="w-4 h-4 mr-2" />
                Save Contact
              </Button>
            </div>
          </div>
        </Card>

          <p className="text-center text-xs text-muted-foreground mt-4" data-testid="text-powered-by">
            Powered by CLT Hub Digital Cards
          </p>
        </div>
      </div>
    </DarkPageShell>
  );
}
