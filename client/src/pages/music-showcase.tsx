import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Music, Play, Pause, Clock, Disc3, Globe, ExternalLink, ChevronLeft, Star, Send, User, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import type { MusicArtist, MusicTrack } from "@shared/schema";

type ArtistWithTracks = MusicArtist & { tracks: MusicTrack[] };

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TrackRow({ track, isPlaying, onToggle }: { track: MusicTrack; isPlaying: boolean; onToggle: () => void }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-md hover:bg-white/5 cursor-pointer group"
      data-testid={`track-row-${track.id}`}
      onClick={onToggle}
    >
      <Button
        size="icon"
        variant={isPlaying ? "default" : "ghost"}
        className="shrink-0 text-white"
        data-testid={`button-play-track-${track.id}`}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-white" data-testid={`text-track-title-${track.id}`}>{track.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {track.albumName && (
            <span className="text-xs text-white/40 truncate" data-testid={`text-track-album-${track.id}`}>
              {track.albumName}
            </span>
          )}
          {track.genre && (
            <Badge variant="secondary" className="text-[10px] bg-white/10 text-white/70" data-testid={`badge-track-genre-${track.id}`}>
              {track.genre}
            </Badge>
          )}
          {track.mood && track.mood.length > 0 && track.mood.map(m => (
            <Badge key={m} variant="outline" className="text-[10px] border-white/20 text-white/50">{m}</Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-white/40 text-xs">
        {track.playCount > 0 && (
          <span data-testid={`text-track-plays-${track.id}`}>{track.playCount.toLocaleString()} plays</span>
        )}
        <span className="flex items-center gap-1" data-testid={`text-track-duration-${track.id}`}>
          <Clock className="h-3 w-3" />
          {formatDuration(track.durationSeconds)}
        </span>
      </div>
    </div>
  );
}

function InlineAudioPlayer({ track, isPlaying, onEnded }: { track: MusicTrack | null; isPlaying: boolean; onEnded: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && track?.audioUrl) {
      audioRef.current.src = `/api/music/tracks/${track.id}/stream`;
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, track]);

  if (!track) return null;

  return (
    <audio ref={audioRef} onEnded={onEnded} className="hidden" />
  );
}

function ArtistCard({ artist, onClick }: { artist: MusicArtist; onClick: () => void }) {
  return (
    <Card
      className="overflow-visible hover-elevate cursor-pointer bg-white/5 border-white/10"
      onClick={onClick}
      data-testid={`card-artist-${artist.id}`}
    >
      <div className="aspect-square relative bg-white/5 rounded-t-md overflow-hidden">
        {artist.imageUrl ? (
          <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="h-16 w-16 text-white/20" />
          </div>
        )}
        {artist.featured && (
          <Badge className="absolute top-2 right-2" data-testid={`badge-featured-${artist.id}`}>
            <Star className="h-3 w-3 mr-1" /> Featured
          </Badge>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold truncate text-white" data-testid={`text-artist-name-${artist.id}`}>{artist.name}</h3>
        {artist.genre && (
          <p className="text-sm text-white/50" data-testid={`text-artist-genre-${artist.id}`}>{artist.genre}</p>
        )}
      </div>
    </Card>
  );
}

function ArtistDetailView({ slug, citySlug, onBack }: { slug: string; citySlug: string; onBack: () => void }) {
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { data: artist, isLoading } = useQuery<ArtistWithTracks>({
    queryKey: ["/api/music/artists", slug],
  });

  usePageMeta({
    title: artist ? `${artist.name} — Local Music | CLT Metro Hub` : "Artist | CLT Metro Hub",
    description: artist?.bio || "Local artist on CLT Metro Hub",
  });

  const toggleTrack = (track: MusicTrack) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-white/10" />
        <div className="flex flex-col sm:flex-row gap-6">
          <Skeleton className="w-48 h-48 rounded-md shrink-0 bg-white/10" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-64 bg-white/10" />
            <Skeleton className="h-4 w-full bg-white/10" />
            <Skeleton className="h-4 w-3/4 bg-white/10" />
          </div>
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full bg-white/10" />)}
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="text-center py-16">
        <Music className="h-12 w-12 text-white/20 mx-auto mb-3" />
        <p className="text-white/50">Artist not found.</p>
        <Button variant="outline" onClick={onBack} className="mt-4 border-white/20 text-white" data-testid="button-back-to-artists">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Artists
        </Button>
      </div>
    );
  }

  const socialLinks = (artist.socialLinks || {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      <InlineAudioPlayer track={currentTrack} isPlaying={isPlaying} onEnded={() => setIsPlaying(false)} />

      <Button variant="ghost" onClick={onBack} className="text-white/70 hover:text-white hover:bg-white/10" data-testid="button-back-to-artists">
        <ChevronLeft className="h-4 w-4 mr-1" /> All Artists
      </Button>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-48 h-48 rounded-md overflow-hidden bg-white/5 shrink-0">
          {artist.imageUrl ? (
            <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="h-20 w-20 text-white/20" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white" data-testid="text-artist-detail-name">{artist.name}</h1>
            {artist.featured && (
              <Badge data-testid="badge-artist-featured"><Star className="h-3 w-3 mr-1" /> Featured</Badge>
            )}
          </div>
          {artist.genre && (
            <p className="text-white/50 mt-1" data-testid="text-artist-detail-genre">{artist.genre}</p>
          )}
          {artist.bio && (
            <p className="mt-3 text-sm leading-relaxed text-white/70" data-testid="text-artist-bio">{artist.bio}</p>
          )}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {artist.websiteUrl && (
              <a href={artist.websiteUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-white/20 text-white" data-testid="link-artist-website">
                  <Globe className="h-3.5 w-3.5 mr-1" /> Website
                </Button>
              </a>
            )}
            {Object.entries(socialLinks).map(([platform, url]) => (
              url ? (
                <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="border-white/20 text-white" data-testid={`link-artist-social-${platform}`}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> {platform}
                  </Button>
                </a>
              ) : null
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white" data-testid="text-tracks-heading">
          <Disc3 className="h-5 w-5" /> Tracks ({artist.tracks?.length || 0})
        </h2>
        {artist.tracks && artist.tracks.length > 0 ? (
          <div className="space-y-1">
            {artist.tracks.map(track => (
              <TrackRow
                key={track.id}
                track={track}
                isPlaying={isPlaying && currentTrack?.id === track.id}
                onToggle={() => toggleTrack(track)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Music className="h-8 w-8 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/40">No tracks available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitMusicDialog({ citySlug, onClose }: { citySlug: string; onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    genre: "",
    bio: "",
    websiteUrl: "",
    submittedByEmail: "",
  });

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/music/artists/submit", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Submitted!", description: "Your artist profile has been submitted for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/music/artists"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()} data-testid="dialog-submit-music">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Music className="h-5 w-5" /> Submit Your Music
        </h2>
        <p className="text-sm text-muted-foreground">
          Share your music with the Charlotte community. We'll review your submission and get you featured.
        </p>
        <div className="space-y-3">
          <Input
            placeholder="Artist / Band Name *"
            value={formData.name}
            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
            data-testid="input-artist-name"
          />
          <Input
            placeholder="Genre (e.g. Hip-Hop, Jazz, Indie)"
            value={formData.genre}
            onChange={e => setFormData(p => ({ ...p, genre: e.target.value }))}
            data-testid="input-artist-genre"
          />
          <Input
            placeholder="Your Email *"
            type="email"
            value={formData.submittedByEmail}
            onChange={e => setFormData(p => ({ ...p, submittedByEmail: e.target.value }))}
            data-testid="input-artist-email"
          />
          <Input
            placeholder="Website URL"
            value={formData.websiteUrl}
            onChange={e => setFormData(p => ({ ...p, websiteUrl: e.target.value }))}
            data-testid="input-artist-website"
          />
          <textarea
            placeholder="Tell us about yourself..."
            value={formData.bio}
            onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            data-testid="input-artist-bio"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-submit">Cancel</Button>
          <Button
            onClick={() => submitMutation.mutate(formData)}
            disabled={!formData.name || !formData.submittedByEmail || submitMutation.isPending}
            data-testid="button-submit-artist"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit"}
            <Send className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function MusicShowcase({ citySlug }: { citySlug: string }) {
  const [selectedArtistSlug, setSelectedArtistSlug] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string>("");

  usePageMeta({
    title: "Local Music — CLT Metro Hub",
    description: "Discover local artists and music from the Charlotte metro area.",
  });

  const { data: artists = [], isLoading } = useQuery<MusicArtist[]>({
    queryKey: ["/api/music/artists", search, genreFilter].filter(Boolean),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (genreFilter) params.set("genre", genreFilter);
      const res = await fetch(`/api/music/artists?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch artists");
      return res.json();
    },
  });

  const featuredArtists = artists.filter(a => a.featured);
  const regularArtists = artists.filter(a => !a.featured);

  const allGenres = Array.from(new Set(artists.map(a => a.genre).filter(Boolean))) as string[];

  if (selectedArtistSlug) {
    return (
      <DarkPageShell maxWidth="wide">
        <ArtistDetailView
          slug={selectedArtistSlug}
          citySlug={citySlug}
          onBack={() => setSelectedArtistSlug(null)}
        />
      </DarkPageShell>
    );
  }

  return (
    <DarkPageShell maxWidth="wide">
      <div className="space-y-6">
      {showSubmit && <SubmitMusicDialog citySlug={citySlug} onClose={() => setShowSubmit(false)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-white" data-testid="text-music-title">
            <Music className="h-7 w-7" /> Local Music
          </h1>
          <p className="text-white/50 text-sm mt-1" data-testid="text-music-subtitle">
            Discover artists and sounds from the Charlotte metro area
          </p>
        </div>
        <Button onClick={() => setShowSubmit(true)} data-testid="button-submit-music-cta">
          <Send className="h-4 w-4 mr-1" /> Submit Your Music
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search artists..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            data-testid="input-search-artists"
          />
        </div>
        {allGenres.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={genreFilter === "" ? "default" : "outline"}
              size="sm"
              className={genreFilter === "" ? "" : "border-white/20 text-white/70"}
              onClick={() => setGenreFilter("")}
              data-testid="button-genre-all"
            >
              All
            </Button>
            {allGenres.slice(0, 8).map(g => (
              <Button
                key={g}
                variant={genreFilter === g ? "default" : "outline"}
                size="sm"
                className={genreFilter === g ? "" : "border-white/20 text-white/70"}
                onClick={() => setGenreFilter(genreFilter === g ? "" : g)}
                data-testid={`button-genre-${g.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              >
                {g}
              </Button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Card key={i} className="bg-white/5 border-white/10">
              <Skeleton className="aspect-square rounded-t-md bg-white/10" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-white/10" />
                <Skeleton className="h-3 w-1/2 bg-white/10" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && featuredArtists.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white" data-testid="text-featured-heading">
            <Star className="h-5 w-5 text-yellow-500" /> Featured Artists
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredArtists.map(artist => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                onClick={() => setSelectedArtistSlug(artist.slug)}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && regularArtists.length > 0 && (
        <div>
          {featuredArtists.length > 0 && (
            <h2 className="text-lg font-semibold mb-3 text-white" data-testid="text-all-artists-heading">All Artists</h2>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {regularArtists.map(artist => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                onClick={() => setSelectedArtistSlug(artist.slug)}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && artists.length === 0 && (
        <div className="text-center py-16">
          <Music className="h-12 w-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 mb-4">No artists found. Be the first to share your music!</p>
          <Button onClick={() => setShowSubmit(true)} data-testid="button-submit-music-empty">
            <Send className="h-4 w-4 mr-1" /> Submit Your Music
          </Button>
        </div>
      )}
      </div>
    </DarkPageShell>
  );
}
