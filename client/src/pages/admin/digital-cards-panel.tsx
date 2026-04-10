import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, CreditCard, Eye, ExternalLink, Pencil, Trash2, Copy, Share2, Download, QrCode, Contact, CalendarDays, Link, Clock, X, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import QRCode from "qrcode";
import { PhotoUpload } from "@/components/photo-upload";

function generateVCard(card: any): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${card.name || ""}`,
    `N:${(card.name || "").split(" ").reverse().join(";")};;;`,
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

function downloadVCard(card: any) {
  const vcf = generateVCard(card);
  const blob = new Blob([vcf], { type: "text/vcard" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(card.name || "card").replace(/\s+/g, "_")}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DigitalCardsPanel({ cityId }: { cityId?: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editCard, setEditCard] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCard, setShareCard] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [bookingsCard, setBookingsCard] = useState<any>(null);

  const { data, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["/api/digital-cards"],
  });

  const { data: cityData } = useQuery<any>({
    queryKey: ["/api/cities/charlotte"],
  });

  const saveMutation = useMutation({
    mutationFn: async (card: any) => {
      if (isNew) return apiRequest("POST", "/api/digital-cards", card);
      return apiRequest("PATCH", `/api/digital-cards/${card.id}`, card);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-cards"] });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/digital-cards/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/digital-cards"] }),
  });

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery<{ data: any[] }>({
    queryKey: ["/api/digital-cards", bookingsCard?.id, "bookings"],
    queryFn: async () => {
      const res = await fetch(`/api/digital-cards/${bookingsCard.id}/bookings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bookings");
      return res.json();
    },
    enabled: !!bookingsCard?.id && bookingsOpen,
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async ({ cardId, bookingId }: { cardId: string; bookingId: string }) => {
      return apiRequest("PATCH", `/api/digital-cards/${cardId}/bookings/${bookingId}`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-cards", bookingsCard?.id, "bookings"] });
    },
  });

  const defaultAvailability: Record<string, { start: string; end: string; enabled: boolean }> = {
    monday: { start: "09:00", end: "17:00", enabled: true },
    tuesday: { start: "09:00", end: "17:00", enabled: true },
    wednesday: { start: "09:00", end: "17:00", enabled: true },
    thursday: { start: "09:00", end: "17:00", enabled: true },
    friday: { start: "09:00", end: "17:00", enabled: true },
    saturday: { start: "10:00", end: "14:00", enabled: false },
    sunday: { start: "10:00", end: "14:00", enabled: false },
  };

  const openNew = () => {
    setEditCard({
      name: "", title: "", company: "", email: "", phone: "", websiteUrl: "", themeColor: "#6B21A8",
      cardImageUrl: "", personPhotoUrl: "",
      companyLogoUrl: cityData?.logoUrl || "",
      calendarUrl: "",
      bookingEnabled: false,
      bookingSlotMinutes: 30,
      bookingTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      bookingAvailability: defaultAvailability,
      bookingBufferMinutes: 0,
      bookingMaxDaysAhead: 30,
    });
    setIsNew(true);
    setEditOpen(true);
  };

  const openEdit = (card: any) => {
    setEditCard({
      ...card,
      bookingAvailability: card.bookingAvailability || defaultAvailability,
    });
    setIsNew(false);
    setEditOpen(true);
  };

  const openShare = (card: any) => {
    setShareCard(card);
    setCopied(false);
    setShareOpen(true);
  };

  useEffect(() => {
    if (shareOpen && shareCard) {
      const cardUrl = `${window.location.origin}/card/${shareCard.slug}`;
      QRCode.toDataURL(cardUrl, { width: 300, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(""));
    }
  }, [shareOpen, shareCard?.slug]);

  const downloadQr = () => {
    if (!qrDataUrl || !shareCard) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${(shareCard.name || "card").replace(/\s+/g, "_")}_qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyLink = () => {
    if (!shareCard) return;
    const url = `${window.location.origin}/card/${shareCard.slug}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cards = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold" data-testid="text-cards-title">Digital Cards</h2>
        <Button onClick={openNew} size="sm" data-testid="button-add-card">
          <Plus className="h-4 w-4 mr-1" /> Create Card
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading cards...</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No digital cards yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card: any) => (
            <Card key={card.id} className="overflow-hidden" data-testid={`card-digital-${card.id}`}>
              {card.cardImageUrl ? (
                <div className="h-20 w-full">
                  <img src={card.cardImageUrl} alt="Card preview" className="h-full w-full object-cover" data-testid={`img-card-preview-${card.id}`} />
                </div>
              ) : (
                <div className="h-2" style={{ backgroundColor: card.themeColor || "#6B21A8" }} />
              )}
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {card.personPhotoUrl ? (
                    <img src={card.personPhotoUrl} alt={card.name} className="h-12 w-12 rounded-full object-cover shrink-0 border" data-testid={`img-person-photo-${card.id}`} />
                  ) : (
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: card.themeColor || "#6B21A8" }}>
                      {card.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{card.name}</p>
                    {card.title && <p className="text-xs text-muted-foreground">{card.title}</p>}
                    {card.company && <p className="text-xs text-muted-foreground">{card.company}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  <span>{card.viewCount || 0} views</span>
                  <Badge variant={card.isActive ? "default" : "secondary"} className="text-[9px] ml-auto">
                    {card.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex gap-1 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => openShare(card)} data-testid={`button-share-${card.id}`}>
                    <Share2 className="h-3 w-3 mr-1" /> Share
                  </Button>
                  {card.bookingEnabled && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setBookingsCard(card); setBookingsOpen(true); }} data-testid={`button-bookings-${card.id}`}>
                      <CalendarDays className="h-3 w-3 mr-1" /> Bookings
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.open(`/card/${card.slug}`, "_blank")} data-testid={`button-view-card-${card.id}`}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(card)} data-testid={`button-edit-card-${card.id}`}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Delete this card?")) deleteMutation.mutate(card.id); }} data-testid={`button-delete-card-${card.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Create Digital Card" : "Edit Card"}</DialogTitle>
          </DialogHeader>
          {editCard && (
            <div className="space-y-3">
              <div>
                <Label>Full Name</Label>
                <Input value={editCard.name || ""} onChange={e => setEditCard({ ...editCard, name: e.target.value })} data-testid="input-card-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Title</Label>
                  <Input value={editCard.title || ""} onChange={e => setEditCard({ ...editCard, title: e.target.value })} placeholder="e.g. Sales Director" data-testid="input-card-title" />
                </div>
                <div>
                  <Label>Company</Label>
                  <Input value={editCard.company || ""} onChange={e => setEditCard({ ...editCard, company: e.target.value })} data-testid="input-card-company" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input value={editCard.email || ""} onChange={e => setEditCard({ ...editCard, email: e.target.value })} data-testid="input-card-email" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={editCard.phone || ""} onChange={e => setEditCard({ ...editCard, phone: e.target.value })} data-testid="input-card-phone" />
                </div>
              </div>
              <div>
                <Label>Website</Label>
                <Input value={editCard.websiteUrl || ""} onChange={e => setEditCard({ ...editCard, websiteUrl: e.target.value })} placeholder="https://..." data-testid="input-card-website" />
              </div>
              <div>
                <Label>Theme Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editCard.themeColor || "#6B21A8"} onChange={e => setEditCard({ ...editCard, themeColor: e.target.value })} className="h-8 w-12 rounded border cursor-pointer" data-testid="input-card-color" />
                  <Input value={editCard.themeColor || ""} onChange={e => setEditCard({ ...editCard, themeColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Your Photo</Label>
                <PhotoUpload
                  currentUrl={editCard.personPhotoUrl || ""}
                  onUploaded={(url) => setEditCard({ ...editCard, personPhotoUrl: url })}
                  shape="circle"
                />
              </div>
              <div>
                <Label>Card Image</Label>
                <PhotoUpload
                  currentUrl={editCard.cardImageUrl || ""}
                  onUploaded={(url) => setEditCard({ ...editCard, cardImageUrl: url })}
                  shape="square"
                />
              </div>
              <div>
                <Label>Company / Hub Logo</Label>
                <PhotoUpload
                  currentUrl={editCard.companyLogoUrl || ""}
                  onUploaded={(url) => setEditCard({ ...editCard, companyLogoUrl: url })}
                  shape="square"
                />
              </div>

              <Separator className="my-2" />
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Booking Settings</span>
              </div>

              <div>
                <Label>External Calendar URL</Label>
                <Input
                  value={editCard.calendarUrl || ""}
                  onChange={e => setEditCard({ ...editCard, calendarUrl: e.target.value })}
                  placeholder="https://calendly.com/your-link"
                  data-testid="input-card-calendar-url"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Calendly, Cal.com, or other booking link</p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm">Enable Built-in Booking</Label>
                  <p className="text-[11px] text-muted-foreground">Let visitors book time slots directly</p>
                </div>
                <Switch
                  checked={!!editCard.bookingEnabled}
                  onCheckedChange={(checked) => setEditCard({ ...editCard, bookingEnabled: checked })}
                  data-testid="switch-booking-enabled"
                />
              </div>

              {editCard.bookingEnabled && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Meeting Duration</Label>
                      <Select
                        value={String(editCard.bookingSlotMinutes || 30)}
                        onValueChange={(v) => setEditCard({ ...editCard, bookingSlotMinutes: parseInt(v) })}
                      >
                        <SelectTrigger data-testid="select-booking-duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">60 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Timezone</Label>
                      <Select
                        value={editCard.bookingTimezone || "America/New_York"}
                        onValueChange={(v) => setEditCard({ ...editCard, bookingTimezone: v })}
                      >
                        <SelectTrigger data-testid="select-booking-timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern</SelectItem>
                          <SelectItem value="America/Chicago">Central</SelectItem>
                          <SelectItem value="America/Denver">Mountain</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                          <SelectItem value="America/Anchorage">Alaska</SelectItem>
                          <SelectItem value="Pacific/Honolulu">Hawaii</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Buffer Between Meetings</Label>
                      <Select
                        value={String(editCard.bookingBufferMinutes || 0)}
                        onValueChange={(v) => setEditCard({ ...editCard, bookingBufferMinutes: parseInt(v) })}
                      >
                        <SelectTrigger data-testid="select-booking-buffer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No buffer</SelectItem>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Max Days Ahead</Label>
                      <Select
                        value={String(editCard.bookingMaxDaysAhead || 30)}
                        onValueChange={(v) => setEditCard({ ...editCard, bookingMaxDaysAhead: parseInt(v) })}
                      >
                        <SelectTrigger data-testid="select-booking-max-days">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1 block">Weekly Availability</Label>
                    <div className="space-y-1.5">
                      {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => {
                        const avail = editCard.bookingAvailability?.[day] || { start: "09:00", end: "17:00", enabled: false };
                        return (
                          <div key={day} className="flex items-center gap-2" data-testid={`row-availability-${day}`}>
                            <Switch
                              checked={avail.enabled}
                              onCheckedChange={(checked) => {
                                setEditCard({
                                  ...editCard,
                                  bookingAvailability: {
                                    ...editCard.bookingAvailability,
                                    [day]: { ...avail, enabled: checked },
                                  },
                                });
                              }}
                              data-testid={`switch-availability-${day}`}
                            />
                            <span className={`text-xs w-12 capitalize ${avail.enabled ? "" : "text-muted-foreground"}`}>
                              {day.slice(0, 3)}
                            </span>
                            {avail.enabled ? (
                              <div className="flex items-center gap-1 flex-1">
                                <Input
                                  type="time"
                                  value={avail.start}
                                  onChange={(e) => {
                                    setEditCard({
                                      ...editCard,
                                      bookingAvailability: {
                                        ...editCard.bookingAvailability,
                                        [day]: { ...avail, start: e.target.value },
                                      },
                                    });
                                  }}
                                  className="text-xs"
                                  data-testid={`input-availability-start-${day}`}
                                />
                                <span className="text-xs text-muted-foreground">to</span>
                                <Input
                                  type="time"
                                  value={avail.end}
                                  onChange={(e) => {
                                    setEditCard({
                                      ...editCard,
                                      bookingAvailability: {
                                        ...editCard.bookingAvailability,
                                        [day]: { ...avail, end: e.target.value },
                                      },
                                    });
                                  }}
                                  className="text-xs"
                                  data-testid={`input-availability-end-${day}`}
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground flex-1">Unavailable</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!isNew && editCard.slug && (
                    <div>
                      <Label className="mb-1 block">iCal Feed URL</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={`${window.location.origin}/api/card/${editCard.slug}/calendar.ics`}
                          className="text-xs"
                          data-testid="input-ical-feed-url"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard?.writeText(`${window.location.origin}/api/card/${editCard.slug}/calendar.ics`);
                          }}
                          data-testid="button-copy-ical-url"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Subscribe in Google Calendar, Apple Calendar, or Outlook</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editCard && saveMutation.mutate(editCard)} disabled={saveMutation.isPending || !editCard?.name} data-testid="button-save-card">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share Card</DialogTitle>
          </DialogHeader>
          {shareCard && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: shareCard.themeColor || "#6B21A8" }}>
                  {shareCard.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" data-testid="text-share-name">{shareCard.name}</p>
                  {shareCard.title && <p className="text-xs text-muted-foreground">{shareCard.title}{shareCard.company ? ` at ${shareCard.company}` : ""}</p>}
                </div>
              </div>

              <div className="flex justify-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-md" data-testid="img-share-qr" />
                ) : (
                  <div className="w-48 h-48 rounded-md bg-muted flex items-center justify-center">
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground">Scan to view digital card</p>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={copyLink} data-testid="button-share-copy-link">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {copied ? "Copied" : "Copy Link"}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadQr} disabled={!qrDataUrl} data-testid="button-share-download-qr">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download QR
                </Button>
              </div>
              <Button className="w-full" size="sm" onClick={() => downloadVCard(shareCard)} data-testid="button-share-download-vcard">
                <Contact className="h-3.5 w-3.5 mr-1.5" />
                Download vCard (.vcf)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={bookingsOpen} onOpenChange={setBookingsOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Bookings {bookingsCard?.name ? `- ${bookingsCard.name}` : ""}
              </div>
            </DialogTitle>
          </DialogHeader>
          {bookingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (bookingsData?.data || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-bookings">
              No bookings yet
            </div>
          ) : (
            <div className="space-y-3">
              {(bookingsData?.data || []).map((booking: any) => {
                const start = new Date(booking.startTime);
                const end = new Date(booking.endTime);
                const isPast = start < new Date();
                const isCancelled = booking.status === "cancelled";
                return (
                  <div
                    key={booking.id}
                    className={`border rounded-lg p-3 space-y-1.5 ${isCancelled ? "opacity-50" : ""}`}
                    data-testid={`booking-${booking.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm" data-testid={`text-booking-guest-${booking.id}`}>{booking.guestName}</p>
                        <p className="text-xs text-muted-foreground">{booking.guestEmail}</p>
                        {booking.guestPhone && <p className="text-xs text-muted-foreground">{booking.guestPhone}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={isCancelled ? "secondary" : isPast ? "outline" : "default"}
                          className="text-[9px]"
                          data-testid={`badge-booking-status-${booking.id}`}
                        >
                          {isCancelled ? "Cancelled" : isPast ? "Past" : "Upcoming"}
                        </Badge>
                        {!isCancelled && !isPast && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => cancelBookingMutation.mutate({ cardId: bookingsCard.id, bookingId: booking.id })}
                            disabled={cancelBookingMutation.isPending}
                            data-testid={`button-cancel-booking-${booking.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      <span>{start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      <Clock className="h-3 w-3 ml-1" />
                      <span>
                        {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    {booking.notes && (
                      <p className="text-xs text-muted-foreground italic">{booking.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
