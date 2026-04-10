import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Headphones,
  Play,
  Pause,
  ExternalLink,
  Clock,
  Search,
  Star,
  ArrowLeft,
  Send,
  Mic,
  ChevronRight,
} from "lucide-react";

interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string | null;
  audioUrl: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  episodeNumber: number | null;
  seasonNumber: number | null;
  createdAt: string;
}

interface Podcast {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  rssUrl: string | null;
  websiteUrl: string | null;
  applePodcastUrl: string | null;
  spotifyUrl: string | null;
  hostName: string | null;
  hostEmail: string | null;
  cityId: string | null;
  hubSlug: string | null;
  category: string | null;
  status: string;
  featured: boolean;
  subscriberCount: number | null;
  episodeCount?: number;
  episodes?: PodcastEpisode[];
  createdAt: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EpisodePlayer({ episode }: { episode: PodcastEpisode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0" data-testid={`episode-row-${episode.id}`}>
      <div className="flex-shrink-0 pt-0.5">
        {episode.audioUrl ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={togglePlay}
              data-testid={`button-play-episode-${episode.id}`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <audio ref={audioRef} src={episode.audioUrl} preload="none" />
          </>
        ) : (
          <div className="h-9 w-9 flex items-center justify-center">
            <Mic className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="font-medium text-sm leading-snug" data-testid={`text-episode-title-${episode.id}`}>
              {episode.seasonNumber && episode.episodeNumber
                ? `S${episode.seasonNumber} E${episode.episodeNumber}: `
                : episode.episodeNumber
                  ? `Ep ${episode.episodeNumber}: `
                  : ""}
              {episode.title}
            </p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {episode.publishedAt && (
                <span className="text-xs text-muted-foreground">{formatDate(episode.publishedAt)}</span>
              )}
              {episode.durationSeconds && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(episode.durationSeconds)}
                </span>
              )}
            </div>
          </div>
          {episode.externalUrl && (
            <a
              href={episode.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`link-episode-external-${episode.id}`}
            >
              <Button size="icon" variant="ghost">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
        {episode.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{episode.description.replace(/<[^>]*>/g, "")}</p>
        )}
      </div>
    </div>
  );
}

function PodcastCard({ podcast, onClick }: { podcast: Podcast; onClick: () => void }) {
  return (
    <Card
      className="hover-elevate cursor-pointer"
      onClick={onClick}
      data-testid={`card-podcast-${podcast.id}`}
    >
      <div className="flex gap-4 p-4">
        <div className="flex-shrink-0 w-20 h-20 rounded-md bg-muted flex items-center justify-center overflow-hidden">
          {podcast.imageUrl ? (
            <img
              src={podcast.imageUrl}
              alt={podcast.name}
              className="w-full h-full object-cover"
              data-testid={`img-podcast-cover-${podcast.id}`}
            />
          ) : (
            <Headphones className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-snug line-clamp-1" data-testid={`text-podcast-name-${podcast.id}`}>
              {podcast.name}
            </h3>
            {podcast.featured && (
              <Badge variant="secondary" className="flex-shrink-0">
                <Star className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>
          {podcast.hostName && (
            <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-podcast-host-${podcast.id}`}>
              Hosted by {podcast.hostName}
            </p>
          )}
          {podcast.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{podcast.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {podcast.category && (
              <Badge variant="outline" className="text-xs">{podcast.category}</Badge>
            )}
            {(podcast.episodeCount ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground">{podcast.episodeCount} episodes</span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </Card>
  );
}

function PodcastDetail({ podcast, onBack }: { podcast: Podcast; onBack: () => void }) {
  const { data: fullPodcast, isLoading } = useQuery<Podcast>({
    queryKey: ["/api/podcasts", podcast.slug],
  });

  const detail = fullPodcast || podcast;
  const episodes = detail.episodes || [];

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4" data-testid="button-back-to-podcasts">
        <ArrowLeft className="h-4 w-4 mr-2" />
        All Podcasts
      </Button>

      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="flex-shrink-0 w-40 h-40 rounded-md bg-muted flex items-center justify-center overflow-hidden mx-auto sm:mx-0">
          {detail.imageUrl ? (
            <img
              src={detail.imageUrl}
              alt={detail.name}
              className="w-full h-full object-cover"
              data-testid="img-podcast-detail-cover"
            />
          ) : (
            <Headphones className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h1 className="text-2xl font-bold" data-testid="text-podcast-detail-name">{detail.name}</h1>
            {detail.featured && (
              <Badge variant="secondary">
                <Star className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>
          {detail.hostName && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-podcast-detail-host">
              Hosted by {detail.hostName}
            </p>
          )}
          {detail.description && (
            <p className="text-sm text-muted-foreground mt-3">{detail.description}</p>
          )}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {detail.category && <Badge variant="outline">{detail.category}</Badge>}
            {detail.websiteUrl && (
              <a href={detail.websiteUrl} target="_blank" rel="noopener noreferrer" data-testid="link-podcast-website">
                <Button variant="outline" size="sm">
                  Website
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </a>
            )}
            {detail.applePodcastUrl && (
              <a href={detail.applePodcastUrl} target="_blank" rel="noopener noreferrer" data-testid="link-podcast-apple">
                <Button variant="outline" size="sm">Apple Podcasts</Button>
              </a>
            )}
            {detail.spotifyUrl && (
              <a href={detail.spotifyUrl} target="_blank" rel="noopener noreferrer" data-testid="link-podcast-spotify">
                <Button variant="outline" size="sm">Spotify</Button>
              </a>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4" data-testid="text-episodes-heading">
          Episodes ({episodes.length})
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : episodes.length > 0 ? (
          <Card>
            <div className="p-4">
              {episodes.map((ep) => (
                <EpisodePlayer key={ep.id} episode={ep} />
              ))}
            </div>
          </Card>
        ) : (
          <Card>
            <div className="p-8 text-center">
              <Mic className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No episodes available yet.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SubmitPodcastDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    hostName: "",
    hostEmail: "",
    rssUrl: "",
    websiteUrl: "",
    applePodcastUrl: "",
    spotifyUrl: "",
    category: "",
    submittedByEmail: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/podcasts/submit", form);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Podcast submitted", description: "Your podcast has been submitted for review." });
      setOpen(false);
      setForm({ name: "", description: "", hostName: "", hostEmail: "", rssUrl: "", websiteUrl: "", applePodcastUrl: "", spotifyUrl: "", category: "", submittedByEmail: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit podcast", variant: "destructive" });
    },
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-submit-podcast">
          <Send className="h-4 w-4 mr-2" />
          Submit Your Podcast
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Your Local Podcast</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium">Podcast Name *</label>
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="My Local Podcast"
              data-testid="input-podcast-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="What's your podcast about?"
              data-testid="input-podcast-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Host Name</label>
              <Input
                value={form.hostName}
                onChange={(e) => handleChange("hostName", e.target.value)}
                placeholder="Jane Doe"
                data-testid="input-podcast-host"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
                placeholder="Business, Culture, Sports..."
                data-testid="input-podcast-category"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">RSS Feed URL</label>
            <Input
              value={form.rssUrl}
              onChange={(e) => handleChange("rssUrl", e.target.value)}
              placeholder="https://feeds.example.com/podcast.xml"
              data-testid="input-podcast-rss"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Website</label>
              <Input
                value={form.websiteUrl}
                onChange={(e) => handleChange("websiteUrl", e.target.value)}
                placeholder="https://..."
                data-testid="input-podcast-website"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Your Email</label>
              <Input
                value={form.submittedByEmail}
                onChange={(e) => handleChange("submittedByEmail", e.target.value)}
                placeholder="you@email.com"
                data-testid="input-podcast-email"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Apple Podcasts URL</label>
              <Input
                value={form.applePodcastUrl}
                onChange={(e) => handleChange("applePodcastUrl", e.target.value)}
                placeholder="https://podcasts.apple.com/..."
                data-testid="input-podcast-apple"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Spotify URL</label>
              <Input
                value={form.spotifyUrl}
                onChange={(e) => handleChange("spotifyUrl", e.target.value)}
                placeholder="https://open.spotify.com/..."
                data-testid="input-podcast-spotify"
              />
            </div>
          </div>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.name || mutation.isPending}
            className="w-full"
            data-testid="button-submit-podcast-form"
          >
            {mutation.isPending ? "Submitting..." : "Submit Podcast"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PodcastDirectory({ citySlug }: { citySlug: string }) {
  usePageMeta({ title: "Local Podcasts — CLT Metro Hub", description: "Discover local podcasts from the Charlotte metro area." });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);

  const { data: podcasts = [], isLoading } = useQuery<Podcast[]>({
    queryKey: ["/api/podcasts"],
  });

  const featured = podcasts.filter((p) => p.featured);
  const categories = Array.from(new Set(podcasts.map((p) => p.category).filter(Boolean))) as string[];

  const filtered = podcasts.filter((p) => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.hostName?.toLowerCase().includes(q)) ||
        (p.description?.toLowerCase().includes(q)) ||
        (p.category?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (selectedPodcast) {
    return (
      <div className="mx-auto px-4 py-6">
        <PodcastDetail podcast={selectedPodcast} onBack={() => setSelectedPodcast(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Headphones className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-podcast-directory-title">Local Podcasts</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Discover podcasts from the Charlotte metro area
          </p>
        </div>
        <SubmitPodcastDialog />
      </div>

      {featured.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3" data-testid="text-featured-heading">Featured Podcasts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map((p) => (
              <PodcastCard key={p.id} podcast={p} onClick={() => setSelectedPodcast(p)} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search podcasts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-podcasts"
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6" data-testid="podcast-category-filters">
          <Badge
            variant={selectedCategory === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(null)}
            data-testid="button-filter-all"
          >
            All ({podcasts.length})
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(cat)}
              data-testid={`button-filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {cat} ({podcasts.filter((p) => p.category === cat).length})
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3" data-testid="podcast-list">
          {filtered.map((p) => (
            <PodcastCard key={p.id} podcast={p} onClick={() => setSelectedPodcast(p)} />
          ))}
        </div>
      ) : (
        <Card>
          <div className="p-12 text-center">
            <Headphones className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {searchQuery || selectedCategory ? "No podcasts match your search." : "No local podcasts yet. Be the first to submit one!"}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
