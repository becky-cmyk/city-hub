import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mic,
  Search,
  ArrowRight,
  Users,
  Star,
  Calendar,
  DollarSign,
  CheckCircle,
} from "lucide-react";

interface SpeakerListing {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  categoryIds: string[] | null;
  zoneId: string | null;
  listingTier: string;
  speakerTopics: string[];
  speakingFeeRange: string | null;
  speakingFormats: string[];
  speakerAvailability: string | null;
  acceptingSpeakingRequests: boolean;
  featured: boolean;
  badgeMeta: Record<string, any>;
}

function SpeakerCard({ speaker, citySlug, isFeatured, onRequest }: {
  speaker: SpeakerListing;
  citySlug: string;
  isFeatured?: boolean;
  onRequest: (speaker: SpeakerListing) => void;
}) {
  const formatLabels: Record<string, string> = {
    workshop: "Workshop",
    keynote: "Keynote",
    panel: "Panel",
    training: "Training",
    fireside: "Fireside Chat",
    webinar: "Webinar",
  };

  return (
    <Card
      data-testid={`card-speaker-${speaker.id}`}
      className={`bg-gray-900 overflow-hidden ${isFeatured ? "border-amber-500/60 border-2" : "border-gray-800"}`}
    >
      <div className="flex gap-4 p-5">
        <div className="shrink-0">
          {speaker.imageUrl ? (
            <img
              src={speaker.imageUrl}
              alt={speaker.name}
              className="w-20 h-20 rounded-lg object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center">
              <Mic className="w-8 h-8 text-amber-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-lg font-semibold text-white truncate">
              {speaker.name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {isFeatured && (
                <Badge className="bg-amber-500 text-black text-xs flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Featured
                </Badge>
              )}
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                Speaker
              </Badge>
            </div>
          </div>
          {speaker.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-2">
              {speaker.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mb-2">
            {speaker.speakingFeeRange && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <DollarSign className="w-3 h-3 text-green-400" />
                <span>{speaker.speakingFeeRange}</span>
              </div>
            )}
            {speaker.speakerAvailability && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="w-3 h-3 text-blue-400" />
                <span>{speaker.speakerAvailability}</span>
              </div>
            )}
            {speaker.acceptingSpeakingRequests && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle className="w-3 h-3" />
                <span>Accepting Requests</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {speaker.speakerTopics.length > 0 && (
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {speaker.speakerTopics.map((topic, i) => (
              <Badge
                key={i}
                variant="outline"
                className="border-gray-700 text-gray-300 text-xs"
              >
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {speaker.speakingFormats.length > 0 && (
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {speaker.speakingFormats.map((fmt, i) => (
              <Badge
                key={i}
                className="bg-gray-800 text-gray-400 border-gray-700 text-xs"
              >
                {formatLabels[fmt] || fmt}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 pb-4 flex items-center gap-3">
        <a
          href={`/${citySlug}/directory/${speaker.slug}`}
          data-testid={`link-speaker-profile-${speaker.id}`}
        >
          <Button
            variant="ghost"
            className="text-amber-400 p-0 h-auto text-sm"
          >
            View Profile
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </a>
        {speaker.acceptingSpeakingRequests && (
          <Button
            size="sm"
            className="bg-amber-500 text-black text-xs font-semibold ml-auto"
            onClick={() => onRequest(speaker)}
            data-testid={`button-request-speaker-${speaker.id}`}
          >
            Request Speaker
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function SpeakersBureau() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<string | null>(null);
  const [requestSpeaker, setRequestSpeaker] = useState<SpeakerListing | null>(null);
  const [formData, setFormData] = useState({
    requesterName: "",
    requesterEmail: "",
    eventName: "",
    eventDate: "",
    eventType: "",
    message: "",
  });
  const { toast } = useToast();

  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "landing") : null;

  usePageMeta({
    title: `Speakers Bureau ${brand?.titleSuffix || "| CLT Hub"}`,
    description: `Book local speakers in Charlotte for keynotes, panels, workshops, and training sessions on ${brand?.descriptionBrand || "CLT Hub"}.`,
    ogSiteName: brand?.ogSiteName,
  });

  const { data: speakers = [], isLoading } = useQuery<SpeakerListing[]>({
    queryKey: [`/api/cities/${citySlug}/speakers`],
  });

  const requestMutation = useMutation({
    mutationFn: async (data: typeof formData & { speakerId: string }) => {
      await apiRequest("POST", `/api/cities/${citySlug}/speaker-requests`, data);
    },
    onSuccess: () => {
      toast({ title: "Request sent", description: "The speaker will be notified of your request." });
      setRequestSpeaker(null);
      setFormData({ requesterName: "", requesterEmail: "", eventName: "", eventDate: "", eventType: "", message: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send request. Please try again.", variant: "destructive" });
    },
  });

  const allTopics = [...new Set(speakers.flatMap(s => s.speakerTopics))].filter(Boolean).sort();
  const allFormats = [...new Set(speakers.flatMap(s => s.speakingFormats))].filter(Boolean).sort();

  const formatLabels: Record<string, string> = {
    workshop: "Workshop",
    keynote: "Keynote",
    panel: "Panel",
    training: "Training",
    fireside: "Fireside Chat",
    webinar: "Webinar",
  };

  const filtered = speakers.filter(s => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nameMatch = s.name.toLowerCase().includes(term);
      const descMatch = (s.description || "").toLowerCase().includes(term);
      const topicMatch = s.speakerTopics.some(t => t.toLowerCase().includes(term));
      if (!nameMatch && !descMatch && !topicMatch) return false;
    }
    if (activeTopic && !s.speakerTopics.includes(activeTopic)) return false;
    if (activeFormat && !s.speakingFormats.includes(activeFormat)) return false;
    return true;
  });

  const featuredSpeakers = filtered.filter(s => s.featured);
  const regularSpeakers = filtered.filter(s => !s.featured);

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Charlotte Speakers Bureau",
        description: "Book local speakers in Charlotte for keynotes, panels, workshops, and training sessions.",
        url: `${window.location.origin}/${citySlug}/speakers/directory`,
        isPartOf: {
          "@type": "WebSite",
          name: brand?.jsonLdName || "CLT Metro Hub",
          alternateName: branding?.brandVariants || [],
          ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
        },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "How do I find a speaker on CLT Hub?", acceptedAnswer: { "@type": "Answer", text: "Browse the CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) Speakers Bureau by topic, expertise area, or format. Each speaker profile includes topics, past engagements, fees, and availability. You can submit a speaking request directly through the platform." } },
          { "@type": "Question", name: "What types of speakers are available on CLT Hub?", acceptedAnswer: { "@type": "Answer", text: "CLT Hub (CLT Metro Hub, Charlotte City Hub, CLT City Hub, Charlotte Metro Hub) features keynote speakers, panelists, workshop facilitators, moderators, podcast guests, and subject matter experts across business, technology, healthcare, education, and community topics in the Charlotte metro area." } },
        ],
      }} />
      <div className="px-4 py-8 mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Mic className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-bold text-white" data-testid="text-speakers-title">
              Speakers Bureau
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Book local speakers for your next event — keynotes, panels, workshops, and more
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              data-testid="input-speaker-search"
              placeholder="Search speakers by name or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-700 text-white"
            />
          </div>
        </div>

        {allTopics.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge
              data-testid="badge-topic-all"
              variant={activeTopic === null ? "default" : "outline"}
              className={`cursor-pointer ${activeTopic === null ? "bg-amber-500 text-black" : "border-gray-600 text-gray-300"}`}
              onClick={() => setActiveTopic(null)}
            >
              All Topics
            </Badge>
            {allTopics.map(topic => (
              <Badge
                key={topic}
                data-testid={`badge-topic-${topic}`}
                variant={activeTopic === topic ? "default" : "outline"}
                className={`cursor-pointer ${activeTopic === topic ? "bg-amber-500 text-black" : "border-gray-600 text-gray-300"}`}
                onClick={() => setActiveTopic(activeTopic === topic ? null : topic)}
              >
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {allFormats.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge
              data-testid="badge-format-all"
              variant={activeFormat === null ? "default" : "outline"}
              className={`cursor-pointer ${activeFormat === null ? "bg-purple-500 text-white" : "border-gray-600 text-gray-300"}`}
              onClick={() => setActiveFormat(null)}
            >
              All Formats
            </Badge>
            {allFormats.map(fmt => (
              <Badge
                key={fmt}
                data-testid={`badge-format-${fmt}`}
                variant={activeFormat === fmt ? "default" : "outline"}
                className={`cursor-pointer ${activeFormat === fmt ? "bg-purple-500 text-white" : "border-gray-600 text-gray-300"}`}
                onClick={() => setActiveFormat(activeFormat === fmt ? null : fmt)}
              >
                {formatLabels[fmt] || fmt}
              </Badge>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg bg-gray-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No speakers found</p>
            <p className="text-white/40 text-sm mt-1">
              Check back soon — speakers are being added to the bureau
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {featuredSpeakers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-semibold text-white" data-testid="text-featured-heading">
                    Featured Speakers
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {featuredSpeakers.map(speaker => (
                    <SpeakerCard key={speaker.id} speaker={speaker} citySlug={citySlug} isFeatured onRequest={setRequestSpeaker} />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regularSpeakers.map(speaker => (
                <SpeakerCard key={speaker.id} speaker={speaker} citySlug={citySlug} onRequest={setRequestSpeaker} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!requestSpeaker} onOpenChange={(open) => !open && setRequestSpeaker(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Request {requestSpeaker?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Your Name</Label>
              <Input
                data-testid="input-requester-name"
                value={formData.requesterName}
                onChange={(e) => setFormData(p => ({ ...p, requesterName: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">Your Email</Label>
              <Input
                data-testid="input-requester-email"
                type="email"
                value={formData.requesterEmail}
                onChange={(e) => setFormData(p => ({ ...p, requesterEmail: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">Event Name</Label>
              <Input
                data-testid="input-event-name"
                value={formData.eventName}
                onChange={(e) => setFormData(p => ({ ...p, eventName: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">Event Date</Label>
              <Input
                data-testid="input-event-date"
                type="date"
                value={formData.eventDate}
                onChange={(e) => setFormData(p => ({ ...p, eventDate: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">Event Type</Label>
              <Select value={formData.eventType} onValueChange={(v) => setFormData(p => ({ ...p, eventType: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1" data-testid="select-event-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keynote">Keynote</SelectItem>
                  <SelectItem value="panel">Panel Discussion</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="training">Training Session</SelectItem>
                  <SelectItem value="fireside">Fireside Chat</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">Message</Label>
              <Textarea
                data-testid="input-request-message"
                value={formData.message}
                onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                rows={3}
                placeholder="Tell the speaker about your event..."
              />
            </div>
            <Button
              data-testid="button-submit-speaker-request"
              className="w-full bg-amber-500 text-black font-semibold"
              disabled={requestMutation.isPending || !formData.requesterEmail || !formData.eventName}
              onClick={() => {
                if (!requestSpeaker) return;
                requestMutation.mutate({
                  ...formData,
                  speakerId: requestSpeaker.id,
                });
              }}
            >
              {requestMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DarkPageShell>
  );
}
