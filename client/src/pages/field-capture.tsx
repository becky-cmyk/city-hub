import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Send, MapPin, User, Phone, Mail, Building2, CalendarDays, Link2, StickyNote } from "lucide-react";

const CAPTURE_TYPES = [
  { value: "business", label: "Business Lead" },
  { value: "event", label: "Event Info" },
  { value: "job_lead", label: "Job Lead" },
  { value: "creator_lead", label: "Creator Lead" },
  { value: "marketplace", label: "Marketplace Opportunity" },
  { value: "flyer", label: "Flyer / Promo" },
  { value: "community_update", label: "Community Update" },
  { value: "correction", label: "Listing Correction" },
  { value: "story_lead", label: "Story Lead" },
  { value: "quick_note", label: "Quick Note" },
  { value: "other", label: "Other" },
] as const;

interface CityData {
  id: string;
  name: string;
  slug: string;
}

interface ZoneData {
  id: string;
  name: string;
}

export default function FieldCapturePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: cities } = useQuery<CityData[]>({ queryKey: ["/api/cities"] });
  const activeCitySlug = window.location.pathname.split("/")[1] || "";
  const activeCity = cities?.find((c) => c.slug === activeCitySlug);

  const { data: zones } = useQuery<ZoneData[]>({
    queryKey: ["/api/cities", activeCitySlug, "zones"],
    enabled: !!activeCitySlug,
  });

  const [captureType, setCaptureType] = useState("quick_note");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [eventName, setEventName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [zoneId, setZoneId] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeCity) throw new Error("No city context");
      return apiRequest("POST", "/api/capture/field", {
        cityId: activeCity.id,
        zoneId: (zoneId && zoneId !== "none") ? zoneId : undefined,
        captureType,
        title,
        notes: notes || undefined,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        businessName: businessName || undefined,
        eventName: eventName || undefined,
        locationText: locationText || undefined,
        sourceUrl: sourceUrl || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Captured", description: "Your field capture has been submitted for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/field-captures"] });
      setTitle("");
      setNotes("");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setBusinessName("");
      setEventName("");
      setLocationText("");
      setSourceUrl("");
      setCaptureType("quick_note");
      setZoneId("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const showBusinessFields = ["business", "correction", "creator_lead", "marketplace"].includes(captureType);
  const showEventFields = ["event", "flyer"].includes(captureType);
  const showContactFields = ["business", "creator_lead", "job_lead", "marketplace"].includes(captureType);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${activeCitySlug}`)}
            data-testid="button-back-capture"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100" data-testid="text-capture-heading">
              Field Capture
            </h1>
            {activeCity && (
              <p className="text-sm text-neutral-500" data-testid="text-capture-city">{activeCity.name}</p>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">What did you find?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="captureType">Type</Label>
              <Select value={captureType} onValueChange={setCaptureType}>
                <SelectTrigger data-testid="select-capture-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPTURE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="title">Title / Label</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short description of what you found"
                data-testid="input-capture-title"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details, observations, context..."
                rows={3}
                data-testid="input-capture-notes"
              />
            </div>

            {showBusinessFields && (
              <div>
                <Label htmlFor="businessName" className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Business Name
                </Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Business or company name"
                  data-testid="input-capture-business-name"
                />
              </div>
            )}

            {showEventFields && (
              <div>
                <Label htmlFor="eventName" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Event Name
                </Label>
                <Input
                  id="eventName"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Event or gathering name"
                  data-testid="input-capture-event-name"
                />
              </div>
            )}

            {showContactFields && (
              <>
                <div>
                  <Label htmlFor="contactName" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Contact Name
                  </Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Person's name"
                    data-testid="input-capture-contact-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="contactPhone" className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </Label>
                    <Input
                      id="contactPhone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Phone number"
                      data-testid="input-capture-phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactEmail" className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </Label>
                    <Input
                      id="contactEmail"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Email address"
                      data-testid="input-capture-email"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="locationText" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Location
              </Label>
              <Input
                id="locationText"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Address, intersection, or area"
                data-testid="input-capture-location"
              />
            </div>

            <div>
              <Label htmlFor="sourceUrl" className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Source Link
              </Label>
              <Input
                id="sourceUrl"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Website, social link, or reference URL"
                data-testid="input-capture-source-url"
              />
            </div>

            {zones && zones.length > 0 && (
              <div>
                <Label htmlFor="zone">Zone</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger data-testid="select-capture-zone">
                    <SelectValue placeholder="Select zone (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No zone</SelectItem>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={!title.trim() || saveMutation.isPending || !activeCity}
              data-testid="button-submit-capture"
            >
              {saveMutation.isPending ? (
                "Submitting..."
              ) : (
                <span className="flex items-center gap-2"><Send className="h-4 w-4" /> Submit Capture</span>
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-neutral-400 text-center mt-4" data-testid="text-capture-hint">
          Captures go to the admin inbox for review and classification.
        </p>
      </div>
    </div>
  );
}
