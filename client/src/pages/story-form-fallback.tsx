import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, ImagePlus, X, Loader2, CheckCircle2, Phone, MessageCircle } from "lucide-react";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import { mainLogo } from "@/lib/logos";

type StoryType = "business" | "nonprofit" | "church" | "school" | "event" | "individual" | "";

interface ContactInfo {
  name: string;
  role: string;
  phone: string;
  email: string;
  callbackRequested: boolean;
}

interface BusinessInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  socialMedia: string;
  description: string;
}

interface EventInfo {
  name: string;
  venue: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dates: string;
  time: string;
  website: string;
  phone: string;
  description: string;
}

interface IndividualInfo {
  neighborhood: string;
  yearsHere: string;
  description: string;
}

interface UploadedPhoto {
  thumb: string;
  original: string;
  variants?: Record<string, string>;
}

const STORY_TYPE_OPTIONS = [
  { value: "business", label: "Business", desc: "Restaurant, shop, service, etc." },
  { value: "nonprofit", label: "Nonprofit / Community Organization", desc: "" },
  { value: "church", label: "Church / Faith-Based Organization", desc: "" },
  { value: "school", label: "School / Education", desc: "" },
  { value: "event", label: "Event / Community Gathering", desc: "" },
  { value: "individual", label: "Individual / Resident Story", desc: "" },
] as const;

const STORY_QUESTIONS = [
  { id: "origin_story", question: "How did you get started? What inspired you to do what you do?" },
  { id: "personal_story", question: "How did you end up in this community? What makes it feel like home?" },
  { id: "primary_business", question: "In your own words, what do you do and what makes it different?" },
  { id: "neighborhood", question: "What's special about your neighborhood? What do outsiders miss?" },
  { id: "community_impact", question: "How do you give back or contribute to the community?" },
  { id: "vision_passion", question: "What's next for you? Any upcoming plans, launches, or goals?" },
  { id: "events_gatherings", question: "Do you host or participate in any events or community gatherings?" },
  { id: "local_recommendations", question: "What are your favorite local spots -- restaurants, coffee shops, hidden gems?" },
  { id: "community_connectors", question: "Know someone else whose story should be told? We'd love an introduction." },
  { id: "local_pride", question: "Anything else you'd like people to know about you or your story?" },
];

const TOTAL_STEPS = 15;

function isOrgType(t: StoryType) {
  return t === "business" || t === "nonprofit" || t === "church" || t === "school";
}

export default function StoryFormFallback({
  citySlug,
  cityName,
  cityId,
  onBackToChat,
}: {
  citySlug: string;
  cityName: string;
  cityId: string;
  onBackToChat?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    name: "", role: "", phone: "", email: "", callbackRequested: false,
  });
  const [storyType, setStoryType] = useState<StoryType>("");
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: "", address: "", city: "", state: "", zip: "", phone: "", website: "", socialMedia: "", description: "",
  });
  const [eventInfo, setEventInfo] = useState<EventInfo>({
    name: "", venue: "", address: "", city: "", state: "", zip: "", dates: "", time: "", website: "", phone: "", description: "",
  });
  const [individualInfo, setIndividualInfo] = useState<IndividualInfo>({
    neighborhood: "", yearsHere: "", description: "",
  });
  const [storyResponses, setStoryResponses] = useState<Record<string, string>>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  const progress = Math.round((step / TOTAL_STEPS) * 100);

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!contactInfo.name.trim()) newErrors.name = "Name is required";
      if (!contactInfo.phone.trim()) newErrors.phone = "Phone number is required";
      if (!contactInfo.email.trim()) newErrors.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email)) newErrors.email = "Enter a valid email";
    }

    if (step === 2) {
      if (!storyType) newErrors.storyType = "Please select a story type";
    }

    if (step === 3) {
      if (isOrgType(storyType)) {
        if (!businessInfo.name.trim()) newErrors.bizName = "Name is required";
        if (!businessInfo.address.trim()) newErrors.bizAddress = "Address is required";
        if (!businessInfo.city.trim()) newErrors.bizCity = "City is required";
        if (!businessInfo.state.trim()) newErrors.bizState = "State is required";
        if (!businessInfo.zip.trim()) newErrors.bizZip = "ZIP is required";
        if (!businessInfo.description.trim()) newErrors.bizDesc = "A brief description is required";
      } else if (storyType === "event") {
        if (!eventInfo.name.trim()) newErrors.eventName = "Event name is required";
        if (!eventInfo.venue.trim()) newErrors.eventVenue = "Venue is required";
        if (!eventInfo.address.trim()) newErrors.eventAddress = "Address is required";
        if (!eventInfo.city.trim()) newErrors.eventCity = "City is required";
        if (!eventInfo.state.trim()) newErrors.eventState = "State is required";
        if (!eventInfo.zip.trim()) newErrors.eventZip = "ZIP is required";
        if (!eventInfo.dates.trim()) newErrors.eventDates = "Date is required";
        if (!eventInfo.description.trim()) newErrors.eventDesc = "A brief description is required";
      } else if (storyType === "individual") {
        if (!individualInfo.neighborhood.trim()) newErrors.indNeighborhood = "Neighborhood is required";
        if (!individualInfo.description.trim()) newErrors.indDesc = "A brief description is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const skipStep = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  const handlePhotoUpload = useCallback(async (files: FileList) => {
    if (!files.length) return;
    setIsUploading(true);
    const newPhotos: UploadedPhoto[] = [];

    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          newPhotos.push({
            thumb: data.variants?.thumb || data.url,
            original: data.variants?.original || data.url,
            variants: data.variants,
          });
        }
      } catch (err) {
        console.error("[StoryForm] photo upload error:", err);
      }
    }

    if (newPhotos.length > 0) {
      setUploadedPhotos((prev) => [...prev, ...newPhotos]);
    }
    setIsUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const photoUrls = uploadedPhotos.map((p) => ({
        original: p.original,
        ...(p.variants || {}),
      }));

      const res = await fetch("/api/charlotte-public/flow/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId,
          contactInfo,
          storyType,
          businessInfo: isOrgType(storyType) ? businessInfo : undefined,
          eventInfo: storyType === "event" ? eventInfo : undefined,
          individualInfo: storyType === "individual" ? individualInfo : undefined,
          storyResponses,
          photoUrls,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        console.error("[StoryForm] submit failed:", res.status);
      }
    } catch (err) {
      console.error("[StoryForm] submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="dark flex flex-col items-center justify-center p-6 bg-gray-950 text-gray-100"
        style={{
          minHeight: "100dvh",
        }}
      >
        <div className="w-full max-w-md text-center space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <img
                src={charlotteAvatar}
                alt="Charlotte"
                className="h-16 w-16 rounded-full object-cover ring-4 ring-muted/40"
                data-testid="img-charlotte-avatar-form-done"
              />
              <CheckCircle2 className="absolute -bottom-1 -right-1 h-6 w-6 text-green-500 bg-white rounded-full" />
            </div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-form-complete-title">
              Thank you for sharing your story!
            </h1>
            {contactInfo.callbackRequested ? (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm" data-testid="text-form-complete-callback">
                Someone from our team will call you at <span className="font-medium text-foreground">{contactInfo.phone}</span> to help finish your story and make sure we get everything right.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm" data-testid="text-form-complete-email">
                We'll be in touch at <span className="font-medium text-foreground">{contactInfo.email}</span> when your community spotlight is ready.
              </p>
            )}
          </div>

          {uploadedPhotos.length > 0 && (
            <div className="flex justify-center gap-2 flex-wrap">
              {uploadedPhotos.map((photo, i) => (
                <img
                  key={i}
                  src={photo.thumb}
                  alt={`Photo ${i + 1}`}
                  className="h-16 w-16 rounded-lg object-cover border border-border/40"
                  data-testid={`img-submitted-photo-${i}`}
                />
              ))}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setContactInfo({ name: "", role: "", phone: "", email: "", callbackRequested: false });
                setStoryType("");
                setBusinessInfo({ name: "", address: "", city: "", state: "", zip: "", phone: "", website: "", socialMedia: "", description: "" });
                setEventInfo({ name: "", venue: "", address: "", city: "", state: "", zip: "", dates: "", time: "", website: "", phone: "", description: "" });
                setIndividualInfo({ neighborhood: "", yearsHere: "", description: "" });
                setStoryResponses({});
                setUploadedPhotos([]);
                setSubmitted(false);
              }}
              data-testid="button-share-another"
            >
              Share Another Story
            </Button>
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = `/${citySlug}`}
                className="text-muted-foreground"
                data-testid="button-back-to-hub-form"
              >
                Explore {cityName} Metro Hub
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderFieldError = (key: string) =>
    errors[key] ? <p className="text-xs text-destructive mt-1" data-testid={`error-${key}`}>{errors[key]}</p> : null;

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">About You</h2>
              <p className="text-sm text-muted-foreground mt-1">Let's start with your contact information.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="f-name">Full Name *</label>
                <Input
                  id="f-name"
                  value={contactInfo.name}
                  onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                  placeholder="Your name"
                  className="mt-1"
                  data-testid="input-form-name"
                />
                {renderFieldError("name")}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="f-role">Your Role / Title</label>
                <Input
                  id="f-role"
                  value={contactInfo.role}
                  onChange={(e) => setContactInfo({ ...contactInfo, role: e.target.value })}
                  placeholder="Owner, Pastor, Founder, Resident, etc."
                  className="mt-1"
                  data-testid="input-form-role"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="f-phone">Phone Number *</label>
                <Input
                  id="f-phone"
                  type="tel"
                  value={contactInfo.phone}
                  onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                  data-testid="input-form-phone"
                />
                {renderFieldError("phone")}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="f-email">Email Address *</label>
                <Input
                  id="f-email"
                  type="email"
                  value={contactInfo.email}
                  onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                  placeholder="you@example.com"
                  className="mt-1"
                  data-testid="input-form-email"
                />
                <p className="text-xs text-muted-foreground mt-1">So we can let you know when your story is published</p>
                {renderFieldError("email")}
              </div>
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="f-callback"
                  checked={contactInfo.callbackRequested}
                  onCheckedChange={(v) => setContactInfo({ ...contactInfo, callbackRequested: v === true })}
                  data-testid="checkbox-callback"
                />
                <label htmlFor="f-callback" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                  <Phone className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  I'd prefer someone call me to help finish my story
                </label>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">What type of story are you sharing?</h2>
              <p className="text-sm text-muted-foreground mt-1">This helps us ask the right questions.</p>
            </div>
            <div className="space-y-2">
              {STORY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setStoryType(opt.value as StoryType); setErrors({}); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    storyType === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                  data-testid={`button-type-${opt.value}`}
                >
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  {opt.desc && <span className="text-xs text-muted-foreground ml-1">({opt.desc})</span>}
                </button>
              ))}
            </div>
            {renderFieldError("storyType")}
          </div>
        );

      case 3:
        if (isOrgType(storyType)) {
          const typeLabel = storyType === "business" ? "business" : storyType === "nonprofit" ? "organization" : storyType === "church" ? "organization" : "school";
          return (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Tell us about your {typeLabel}</h2>
                <p className="text-sm text-muted-foreground mt-1">This information helps us create your community spotlight.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-biz-name">Name *</label>
                  <Input id="f-biz-name" value={businessInfo.name} onChange={(e) => setBusinessInfo({ ...businessInfo, name: e.target.value })} placeholder={`Name of your ${typeLabel}`} className="mt-1" data-testid="input-form-biz-name" />
                  {renderFieldError("bizName")}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-biz-addr">Street Address *</label>
                  <Input id="f-biz-addr" value={businessInfo.address} onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })} placeholder="123 Main St" className="mt-1" data-testid="input-form-biz-address" />
                  {renderFieldError("bizAddress")}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="f-biz-city">City *</label>
                    <Input id="f-biz-city" value={businessInfo.city} onChange={(e) => setBusinessInfo({ ...businessInfo, city: e.target.value })} placeholder="Charlotte" className="mt-1" data-testid="input-form-biz-city" />
                    {renderFieldError("bizCity")}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground" htmlFor="f-biz-state">State *</label>
                    <Input id="f-biz-state" value={businessInfo.state} onChange={(e) => setBusinessInfo({ ...businessInfo, state: e.target.value })} placeholder="NC" className="mt-1" data-testid="input-form-biz-state" />
                    {renderFieldError("bizState")}
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="f-biz-zip">ZIP *</label>
                    <Input id="f-biz-zip" value={businessInfo.zip} onChange={(e) => setBusinessInfo({ ...businessInfo, zip: e.target.value })} placeholder="28202" className="mt-1" data-testid="input-form-biz-zip" />
                    {renderFieldError("bizZip")}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-biz-phone">Business Phone</label>
                  <Input id="f-biz-phone" type="tel" value={businessInfo.phone} onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })} placeholder="If different from personal" className="mt-1" data-testid="input-form-biz-phone" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-biz-web">Website</label>
                  <Input id="f-biz-web" value={businessInfo.website} onChange={(e) => setBusinessInfo({ ...businessInfo, website: e.target.value })} placeholder="www.yourbusiness.com" className="mt-1" data-testid="input-form-biz-website" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-biz-social">Social Media</label>
                  <Input id="f-biz-social" value={businessInfo.socialMedia} onChange={(e) => setBusinessInfo({ ...businessInfo, socialMedia: e.target.value })} placeholder="@yourhandle or page URL" className="mt-1" data-testid="input-form-biz-social" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-biz-desc">In one sentence, what do you do? *</label>
                  <Input id="f-biz-desc" value={businessInfo.description} onChange={(e) => setBusinessInfo({ ...businessInfo, description: e.target.value })} placeholder="We are a..." className="mt-1" data-testid="input-form-biz-desc" />
                  {renderFieldError("bizDesc")}
                </div>
              </div>
            </div>
          );
        }

        if (storyType === "event") {
          return (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Tell us about your event</h2>
                <p className="text-sm text-muted-foreground mt-1">Help us share this with the community.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-evt-name">Event Name *</label>
                  <Input id="f-evt-name" value={eventInfo.name} onChange={(e) => setEventInfo({ ...eventInfo, name: e.target.value })} placeholder="Name of your event" className="mt-1" data-testid="input-form-evt-name" />
                  {renderFieldError("eventName")}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-evt-venue">Venue / Location *</label>
                  <Input id="f-evt-venue" value={eventInfo.venue} onChange={(e) => setEventInfo({ ...eventInfo, venue: e.target.value })} placeholder="Venue or location name" className="mt-1" data-testid="input-form-evt-venue" />
                  {renderFieldError("eventVenue")}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-evt-addr">Street Address *</label>
                  <Input id="f-evt-addr" value={eventInfo.address} onChange={(e) => setEventInfo({ ...eventInfo, address: e.target.value })} placeholder="123 Main St" className="mt-1" data-testid="input-form-evt-address" />
                  {renderFieldError("eventAddress")}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="f-evt-city">City *</label>
                    <Input id="f-evt-city" value={eventInfo.city} onChange={(e) => setEventInfo({ ...eventInfo, city: e.target.value })} placeholder="Charlotte" className="mt-1" data-testid="input-form-evt-city" />
                    {renderFieldError("eventCity")}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground" htmlFor="f-evt-state">State *</label>
                    <Input id="f-evt-state" value={eventInfo.state} onChange={(e) => setEventInfo({ ...eventInfo, state: e.target.value })} placeholder="NC" className="mt-1" data-testid="input-form-evt-state" />
                    {renderFieldError("eventState")}
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="f-evt-zip">ZIP *</label>
                    <Input id="f-evt-zip" value={eventInfo.zip} onChange={(e) => setEventInfo({ ...eventInfo, zip: e.target.value })} placeholder="28202" className="mt-1" data-testid="input-form-evt-zip" />
                    {renderFieldError("eventZip")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-foreground" htmlFor="f-evt-dates">Date(s) *</label>
                    <Input id="f-evt-dates" value={eventInfo.dates} onChange={(e) => setEventInfo({ ...eventInfo, dates: e.target.value })} placeholder="March 15, 2026" className="mt-1" data-testid="input-form-evt-dates" />
                    {renderFieldError("eventDates")}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground" htmlFor="f-evt-time">Time</label>
                    <Input id="f-evt-time" value={eventInfo.time} onChange={(e) => setEventInfo({ ...eventInfo, time: e.target.value })} placeholder="6:00 PM - 9:00 PM" className="mt-1" data-testid="input-form-evt-time" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-evt-web">Event Website or Ticket Link</label>
                  <Input id="f-evt-web" value={eventInfo.website} onChange={(e) => setEventInfo({ ...eventInfo, website: e.target.value })} placeholder="www.yourevent.com" className="mt-1" data-testid="input-form-evt-website" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-evt-phone">Event Contact Phone</label>
                  <Input id="f-evt-phone" type="tel" value={eventInfo.phone} onChange={(e) => setEventInfo({ ...eventInfo, phone: e.target.value })} placeholder="If different from personal" className="mt-1" data-testid="input-form-evt-phone" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-evt-desc">What is this event about? *</label>
                  <Textarea id="f-evt-desc" value={eventInfo.description} onChange={(e) => setEventInfo({ ...eventInfo, description: e.target.value })} placeholder="Tell us about your event..." rows={3} className="mt-1" data-testid="input-form-evt-desc" />
                  {renderFieldError("eventDesc")}
                </div>
              </div>
            </div>
          );
        }

        if (storyType === "individual") {
          return (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Tell us about yourself</h2>
                <p className="text-sm text-muted-foreground mt-1">Help us understand your connection to the community.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-ind-hood">Neighborhood or Area *</label>
                  <Input id="f-ind-hood" value={individualInfo.neighborhood} onChange={(e) => setIndividualInfo({ ...individualInfo, neighborhood: e.target.value })} placeholder="South End, NoDa, Matthews, etc." className="mt-1" data-testid="input-form-ind-neighborhood" />
                  {renderFieldError("indNeighborhood")}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-ind-years">How long have you lived here?</label>
                  <Input id="f-ind-years" value={individualInfo.yearsHere} onChange={(e) => setIndividualInfo({ ...individualInfo, yearsHere: e.target.value })} placeholder="5 years, born and raised, etc." className="mt-1" data-testid="input-form-ind-years" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="f-ind-desc">What's your connection to the community? *</label>
                  <Textarea id="f-ind-desc" value={individualInfo.description} onChange={(e) => setIndividualInfo({ ...individualInfo, description: e.target.value })} placeholder="Tell us about yourself..." rows={3} className="mt-1" data-testid="input-form-ind-desc" />
                  {renderFieldError("indDesc")}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Please go back and select a story type.</p>
          </div>
        );

      case 14:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Photos</h2>
              <p className="text-sm text-muted-foreground mt-1">Share photos of your space, team, logo, products, or event. High-res photos work best.</p>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) handlePhotoUpload(e.target.files); }}
              data-testid="input-form-photo-upload"
            />
            <div className="space-y-3">
              {uploadedPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {uploadedPhotos.map((photo, i) => (
                    <div key={i} className="relative">
                      <img src={photo.thumb} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border border-border/40" data-testid={`img-form-photo-${i}`} />
                      <button
                        type="button"
                        onClick={() => setUploadedPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5"
                        data-testid={`button-remove-form-photo-${i}`}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
                data-testid="button-form-add-photos"
              >
                {isUploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><ImagePlus className="h-4 w-4 mr-2" /> Add Photos</>
                )}
              </Button>
            </div>
          </div>
        );

      case 15: {
        const filledResponses = STORY_QUESTIONS.filter((q) => storyResponses[q.id]?.trim());
        const entityName = isOrgType(storyType) ? businessInfo.name : storyType === "event" ? eventInfo.name : contactInfo.name;
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Review Your Submission</h2>
              <p className="text-sm text-muted-foreground mt-1">Here's a summary of what you shared.</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                <p className="font-medium text-foreground">{contactInfo.name}</p>
                {contactInfo.role && <p className="text-muted-foreground">{contactInfo.role}</p>}
                <p className="text-muted-foreground">{contactInfo.email}</p>
                <p className="text-muted-foreground">{contactInfo.phone}</p>
                {contactInfo.callbackRequested && (
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mt-1">
                    <Phone className="h-3 w-3" /> Callback requested
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                <p className="font-medium text-foreground">{entityName}</p>
                <p className="text-xs text-muted-foreground capitalize">{storyType?.replace("_", " ")}</p>
                {isOrgType(storyType) && businessInfo.address && (
                  <p className="text-muted-foreground">{businessInfo.address}, {businessInfo.city}, {businessInfo.state} {businessInfo.zip}</p>
                )}
                {storyType === "event" && eventInfo.address && (
                  <>
                    <p className="text-muted-foreground">{eventInfo.venue}</p>
                    <p className="text-muted-foreground">{eventInfo.address}, {eventInfo.city}, {eventInfo.state} {eventInfo.zip}</p>
                    <p className="text-muted-foreground">{eventInfo.dates}{eventInfo.time ? ` at ${eventInfo.time}` : ""}</p>
                  </>
                )}
                {storyType === "individual" && <p className="text-muted-foreground">{individualInfo.neighborhood}</p>}
              </div>
              {filledResponses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Story Details</p>
                  {filledResponses.map((q) => (
                    <div key={q.id} className="p-3 rounded-lg bg-muted/40">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{q.question}</p>
                      <p className="text-foreground">{storyResponses[q.id]}</p>
                    </div>
                  ))}
                </div>
              )}
              {uploadedPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {uploadedPhotos.map((photo, i) => (
                    <img key={i} src={photo.thumb} alt={`Photo ${i + 1}`} className="h-14 w-14 rounded-lg object-cover border border-border/40" />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      default: {
        const qIdx = step - 4;
        if (qIdx >= 0 && qIdx < STORY_QUESTIONS.length) {
          const q = STORY_QUESTIONS[qIdx];
          return (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{q.question}</h2>
                <p className="text-sm text-muted-foreground mt-1">Take as much or as little space as you need.</p>
              </div>
              <Textarea
                value={storyResponses[q.id] || ""}
                onChange={(e) => setStoryResponses({ ...storyResponses, [q.id]: e.target.value })}
                placeholder="Share your thoughts here..."
                rows={5}
                className="text-sm"
                data-testid={`textarea-form-${q.id}`}
              />
            </div>
          );
        }
        return null;
      }
    }
  };

  const isSkippable = step >= 4 && step <= 14;

  return (
    <div
      className="dark flex flex-col bg-gray-950 text-gray-100"
      style={{
        minHeight: "100dvh",
      }}
    >
      <div className="shrink-0 flex flex-col items-center pt-4 pb-2 px-4 text-center border-b border-border/40">
        <img src={mainLogo} alt="CLT Metro Hub" className="h-10 object-contain mb-2" data-testid="img-form-logo" />
        {onBackToChat && (
          <button
            onClick={onBackToChat}
            className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"
            data-testid="button-back-to-chat"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Back to conversation with Charlotte
          </button>
        )}
        <p className="text-xs text-muted-foreground" data-testid="text-form-step-label">
          Story Submission — Step {step} of {TOTAL_STEPS}
        </p>
        <div className="w-full max-w-xs mt-2">
          <Progress value={progress} className="h-1.5" data-testid="progress-form" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full px-4 py-5">
          {renderStepContent()}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/40 bg-background">
        <div className="max-w-lg mx-auto w-full px-4 py-3 space-y-2">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="ghost" onClick={goBack} className="shrink-0" data-testid="button-form-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            <div className="flex-1" />
            {step < TOTAL_STEPS ? (
              <Button onClick={goNext} data-testid="button-form-next">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-form-submit">
                {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : "Submit Your Story"}
              </Button>
            )}
          </div>
          {isSkippable && step < TOTAL_STEPS && (
            <button
              type="button"
              onClick={skipStep}
              className="w-full text-center text-xs text-muted-foreground/70 py-1"
              data-testid="button-form-skip"
            >
              Skip this question
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
