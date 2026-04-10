import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Play, Pause, SkipForward, Volume2, VolumeX, Clock, Music, Mic, Megaphone, Users, Signal, ChevronDown, Headphones, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Link } from "wouter";
import type { RadioStation, RadioSegment, LiveBroadcast } from "@shared/schema";

type StationWithNowPlaying = RadioStation & {
  nowPlaying?: RadioSegment & { artistName?: string | null } | null;
};

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getSegmentIcon(type: string) {
  switch (type) {
    case "music": return <Music className="h-4 w-4" />;
    case "talk": case "interview": case "expert_show": return <Mic className="h-4 w-4" />;
    case "ad": return <Megaphone className="h-4 w-4" />;
    case "announcement": return <Radio className="h-4 w-4" />;
    default: return <Music className="h-4 w-4" />;
  }
}

function getSegmentLabel(type: string) {
  switch (type) {
    case "music": return "Music";
    case "talk": return "Talk";
    case "interview": return "Interview";
    case "expert_show": return "Expert Show";
    case "ad": return "Sponsored";
    case "announcement": return "Announcement";
    default: return type;
  }
}

export default function RadioPlayer({ citySlug }: { citySlug: string }) {
  const [selectedStationSlug, setSelectedStationSlug] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showStationSelector, setShowStationSelector] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    document.title = "Hub Radio — CLT Metro Hub";
  }, []);

  const { data: stations = [], isLoading: stationsLoading } = useQuery<RadioStation[]>({
    queryKey: ["/api/radio/stations"],
  });

  const activeStation = stations.find(s => s.slug === selectedStationSlug) || stations[0];

  useEffect(() => {
    if (stations.length > 0 && !selectedStationSlug) {
      setSelectedStationSlug(stations[0].slug);
    }
  }, [stations, selectedStationSlug]);

  const { data: stationDetail, isLoading: detailLoading } = useQuery<StationWithNowPlaying>({
    queryKey: ["/api/radio/stations", activeStation?.slug],
    enabled: !!activeStation?.slug,
    refetchInterval: 15000,
  });

  const { data: playlist = [], isLoading: playlistLoading } = useQuery<RadioSegment[]>({
    queryKey: ["/api/radio/stations", activeStation?.slug, "playlist"],
    enabled: !!activeStation?.slug,
    refetchInterval: 30000,
  });

  const { data: broadcasts = [] } = useQuery<LiveBroadcast[]>({
    queryKey: ["/api/broadcasts"],
    refetchInterval: 30000,
  });

  const liveBroadcast = broadcasts.find(b => b.status === "live");
  const upcomingBroadcasts = broadcasts
    .filter(b => b.status === "scheduled")
    .sort((a, b) => {
      if (!a.scheduledStartAt || !b.scheduledStartAt) return 0;
      return new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime();
    })
    .slice(0, 5);

  const nowPlaying = stationDetail?.nowPlaying;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const src = nowPlaying?.audioUrl || activeStation?.streamUrl;
      if (src) {
        audioRef.current.src = src;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleSkip = () => {
    if (playlist.length > 0) {
      const nextSeg = playlist[0];
      if (nextSeg.audioUrl && audioRef.current) {
        audioRef.current.src = nextSeg.audioUrl;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleStationChange = (slug: string) => {
    setSelectedStationSlug(slug);
    setIsPlaying(false);
    setShowStationSelector(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  };

  const isLive = stationDetail?.status === "live";

  if (stationsLoading) {
    return (
      <DarkPageShell maxWidth="wide" fillHeight>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48 bg-white/10" />
          <Skeleton className="h-64 w-full bg-white/10" />
          <Skeleton className="h-48 w-full bg-white/10" />
        </div>
      </DarkPageShell>
    );
  }

  if (stations.length === 0) {
    return (
      <DarkPageShell maxWidth="wide" fillHeight>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Radio className="h-16 w-16 text-white/20" />
          <h1 className="text-2xl font-bold text-white" data-testid="text-radio-no-stations">Hub Radio</h1>
          <p className="text-white/50 text-sm text-center max-w-md" data-testid="text-radio-coming-soon">
            Hub Radio is coming soon. Stay tuned for local music, community updates, and live broadcasts.
          </p>
        </div>
      </DarkPageShell>
    );
  }

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          )}
          <Radio className="h-6 w-6 text-purple-400" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="text-radio-title">
            Hub Radio
          </h1>
        </div>
        {isLive && (
          <Badge className="bg-red-600 text-white no-default-hover-elevate" data-testid="badge-live-indicator">
            LIVE
          </Badge>
        )}
      </div>

      {liveBroadcast && (
        <Card className="bg-red-950/40 border-red-800/50 mb-6 p-4" data-testid="card-live-broadcast">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-red-200 text-xs font-semibold uppercase tracking-wider" data-testid="text-live-label">Listen Live</p>
              <p className="text-white font-bold truncate" data-testid="text-live-broadcast-title">{liveBroadcast.title}</p>
              {liveBroadcast.hostName && (
                <p className="text-white/60 text-sm" data-testid="text-live-host">Hosted by {liveBroadcast.hostName}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Users className="h-3.5 w-3.5" />
              <span data-testid="text-live-viewers">{liveBroadcast.viewerCount}</span>
            </div>
          </div>
        </Card>
      )}

      <Card className="bg-white/5 border-white/10 p-4 sm:p-6 mb-6" data-testid="card-player">
        {stations.length > 1 && (
          <div className="relative mb-4">
            <Button
              variant="outline"
              className="w-full justify-between bg-white/5 border-white/20 text-white"
              onClick={() => setShowStationSelector(!showStationSelector)}
              data-testid="button-station-selector"
            >
              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-purple-400" />
                <span>{activeStation?.name || "Select Station"}</span>
                {activeStation?.stationType && (
                  <Badge variant="secondary" className="text-xs">{activeStation.stationType}</Badge>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${showStationSelector ? "rotate-180" : ""}`} />
            </Button>
            {showStationSelector && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-gray-900 border border-white/20 rounded-md overflow-hidden">
                {stations.map(station => (
                  <button
                    key={station.id}
                    onClick={() => handleStationChange(station.slug)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                      station.slug === activeStation?.slug
                        ? "bg-purple-900/50 text-white"
                        : "text-white/70 hover-elevate"
                    }`}
                    data-testid={`button-station-${station.slug}`}
                  >
                    <Signal className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{station.name}</p>
                      {station.description && (
                        <p className="text-xs text-white/40 truncate">{station.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{station.stationType}</Badge>
                    {station.status === "live" && (
                      <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {stationDetail?.imageUrl ? (
            <img
              src={stationDetail.imageUrl}
              alt={stationDetail.name}
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-md object-cover shrink-0"
              data-testid="img-station-art"
            />
          ) : (
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-md bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0" data-testid="img-station-placeholder">
              <Radio className="h-10 w-10 text-white/80" />
            </div>
          )}

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Now Playing</p>
            {detailLoading ? (
              <Skeleton className="h-6 w-40 bg-white/10" />
            ) : nowPlaying ? (
              <>
                <h2 className="text-white text-lg font-bold truncate" data-testid="text-now-playing-title">
                  {nowPlaying.title}
                </h2>
                {nowPlaying.artistName && (
                  <p className="text-white/60 text-sm" data-testid="text-now-playing-artist">{nowPlaying.artistName}</p>
                )}
                <div className="flex items-center gap-2 justify-center sm:justify-start mt-1">
                  {getSegmentIcon(nowPlaying.segmentType)}
                  <span className="text-white/40 text-xs">{getSegmentLabel(nowPlaying.segmentType)}</span>
                  <span className="text-white/30 text-xs">{formatDuration(nowPlaying.durationSeconds)}</span>
                </div>
              </>
            ) : (
              <h2 className="text-white/40 text-lg" data-testid="text-now-playing-empty">
                {activeStation?.name || "Hub Radio"}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="text-white"
              onClick={handlePlayPause}
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white/60"
              onClick={handleSkip}
              data-testid="button-skip"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 max-w-xs ml-auto sm:ml-0">
          <Button
            size="icon"
            variant="ghost"
            className="text-white/60 shrink-0"
            onClick={() => setIsMuted(!isMuted)}
            data-testid="button-mute"
          >
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={100}
            step={1}
            onValueChange={(val) => {
              setVolume(val[0]);
              if (val[0] > 0) setIsMuted(false);
            }}
            className="flex-1"
            data-testid="slider-volume"
          />
        </div>

        {activeStation && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-white/40 text-xs flex-wrap">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span data-testid="text-listener-count">{stationDetail?.listenerCount || 0} listeners</span>
            </div>
            <div className="flex items-center gap-1">
              <Signal className="h-3.5 w-3.5" />
              <span data-testid="text-station-type">{activeStation.stationType} station</span>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-purple-400" />
            <h3 className="text-white font-semibold" data-testid="text-up-next-heading">Up Next</h3>
          </div>
          <Card className="bg-white/5 border-white/10" data-testid="card-up-next">
            {playlistLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full bg-white/10" />)}
              </div>
            ) : playlist.length === 0 ? (
              <div className="p-8 text-center">
                <Music className="h-8 w-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-sm" data-testid="text-queue-empty">No segments queued</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {playlist.slice(0, 10).map((seg, idx) => (
                  <div key={seg.id} className="flex items-center gap-3 p-3" data-testid={`queue-item-${idx}`}>
                    <span className="text-white/30 text-xs w-5 text-right shrink-0">{idx + 1}</span>
                    <div className="text-purple-400 shrink-0">{getSegmentIcon(seg.segmentType)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{seg.title}</p>
                      <p className="text-white/40 text-xs">{getSegmentLabel(seg.segmentType)}</p>
                    </div>
                    <span className="text-white/30 text-xs shrink-0">{formatDuration(seg.durationSeconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-purple-400" />
            <h3 className="text-white font-semibold" data-testid="text-schedule-heading">Schedule</h3>
          </div>
          <Card className="bg-white/5 border-white/10" data-testid="card-schedule">
            {upcomingBroadcasts.length === 0 ? (
              <div className="p-8 text-center">
                <Headphones className="h-8 w-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-sm" data-testid="text-schedule-empty">No upcoming broadcasts scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {upcomingBroadcasts.map((bc, idx) => (
                  <div key={bc.id} className="flex items-center gap-3 p-3" data-testid={`schedule-item-${idx}`}>
                    <div className="text-purple-400 shrink-0">
                      <Mic className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{bc.title}</p>
                      {bc.hostName && <p className="text-white/40 text-xs">by {bc.hostName}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {bc.scheduledStartAt && (
                        <p className="text-white/50 text-xs" data-testid={`text-broadcast-time-${idx}`}>
                          {new Date(bc.scheduledStartAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      )}
                      <Badge variant="secondary" className="text-xs mt-0.5">{bc.broadcastType}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="mt-6">
            <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-700/30 p-5" data-testid="card-advertise-cta">
              <div className="flex items-start gap-3">
                <Megaphone className="h-6 w-6 text-purple-300 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-white font-bold text-sm" data-testid="text-advertise-heading">Advertise on Hub Radio</h4>
                  <p className="text-white/50 text-xs mt-1 mb-3">
                    Reach Charlotte's local audience with targeted audio ads on metro, micro, and venue stations.
                  </p>
                  <Link href={`/${citySlug}/advertise`}>
                    <Button variant="outline" className="text-white border-purple-500/50" data-testid="button-advertise-cta">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DarkPageShell>
  );
}
