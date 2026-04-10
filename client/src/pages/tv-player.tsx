import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearch } from "wouter";
import { SlideRenderer } from "@/components/tv/slide-templates";

interface PlaylistItem {
  id: string;
  title: string;
  type: "slide" | "video";
  templateKey?: string;
  data?: Record<string, any>;
  assetUrl?: string;
  videoUrl?: string;
  clickUrl?: string;
  qrUrl?: string;
  durationSec?: number;
  audioUrl?: string | null;
  captionUrl?: string | null;
  subtitleText?: string | null;
  narrationEnabled?: boolean;
  loopId?: string;
  loopName?: string;
  sectionLabel?: string | null;
  liveOfferCount?: number;
  liveChannelSlug?: string;
}

interface PlaylistResponse {
  items: PlaylistItem[];
  generatedAt: string;
  nextRefreshSec: number;
  languageMode: "en" | "es" | "bilingual";
  hubSlug?: string;
  metroSlug?: string;
  totalDurationSec?: number;
  syncStartTime?: number;
  screenGroupOffset?: number;
  loopId?: string;
  loopName?: string;
  mode?: string;
}

interface VttCue {
  startTime: number;
  endTime: number;
  text: string;
}

function parseVtt(vttText: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = vttText.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    for (let i = 0; i < lines.length; i++) {
      const timeMatch = lines[i].match(
        /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
      );
      if (!timeMatch) {
        const shortMatch = lines[i].match(
          /(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})/
        );
        if (shortMatch) {
          const startTime =
            parseInt(shortMatch[1]) * 60 +
            parseInt(shortMatch[2]) +
            parseInt(shortMatch[3]) / 1000;
          const endTime =
            parseInt(shortMatch[4]) * 60 +
            parseInt(shortMatch[5]) +
            parseInt(shortMatch[6]) / 1000;
          const text = lines
            .slice(i + 1)
            .join("\n")
            .trim();
          if (text) cues.push({ startTime, endTime, text });
        }
        continue;
      }
      const startTime =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;
      const endTime =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;
      const text = lines
        .slice(i + 1)
        .join("\n")
        .trim();
      if (text) cues.push({ startTime, endTime, text });
    }
  }
  return cues;
}

function CaptionOverlay({
  captionUrl,
  subtitleText,
  audioStartTime,
}: {
  captionUrl?: string | null;
  subtitleText?: string | null;
  audioStartTime: number;
}) {
  const [cues, setCues] = useState<VttCue[]>([]);
  const [activeCueText, setActiveCueText] = useState<string>("");
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!captionUrl) {
      setCues([]);
      return;
    }
    let cancelled = false;
    fetch(captionUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load VTT");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setCues(parseVtt(text));
      })
      .catch(() => {
        if (!cancelled) setCues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [captionUrl]);

  useEffect(() => {
    if (cues.length === 0) {
      setActiveCueText("");
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - audioStartTime) / 1000;
      const active = cues.find(
        (c) => elapsed >= c.startTime && elapsed <= c.endTime
      );
      setActiveCueText(active ? active.text : "");
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cues, audioStartTime]);

  const displayText = cues.length > 0 ? activeCueText : subtitleText || "";

  if (!displayText) return null;

  return (
    <div
      className="absolute left-0 right-0 flex justify-center z-30 pointer-events-none"
      style={{ bottom: "3%" }}
      data-testid="tv-caption-overlay"
    >
      <div
        className="px-6 py-3 rounded-md max-w-[80%] text-center"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          fontSize: "clamp(28px, 2.6vw, 48px)",
          lineHeight: 1.3,
        }}
      >
        <span className="text-white font-medium">{displayText}</span>
      </div>
    </div>
  );
}

function LoopTransition({
  loopName,
  visible,
}: {
  loopName: string;
  visible: boolean;
}) {
  if (!loopName || !visible) return null;

  return (
    <div
      className="absolute top-6 left-0 right-0 flex justify-center z-20 pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 1.2s ease-in-out",
      }}
      data-testid="tv-loop-transition"
    >
      <div className="px-5 py-2 rounded-md bg-black/60">
        <span className="text-sm text-white/70 uppercase tracking-[0.2em] font-medium">
          {loopName}
        </span>
      </div>
    </div>
  );
}

function LiveOffersOverlay({
  offerCount,
  channelSlug,
  metroSlug,
  languageMode,
}: {
  offerCount: number;
  channelSlug?: string;
  metroSlug?: string;
  languageMode: string;
}) {
  const channelUrl = channelSlug && metroSlug
    ? `${window.location.origin}/${metroSlug}/channel/${channelSlug}`
    : null;

  const qrSrc = channelUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(channelUrl)}&bgcolor=000000&color=ffffff`
    : null;

  return (
    <div
      className="absolute bottom-6 right-6 z-20 flex items-center gap-3 pointer-events-none"
      data-testid="tv-live-offers-overlay"
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-md" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-emerald-400 text-sm font-semibold">
              {languageMode === "es" ? "Compra en vivo" : "Shop this stream"}
            </span>
          </div>
          <span className="text-white/60 text-xs">
            {offerCount} {languageMode === "es" ? (offerCount === 1 ? "oferta" : "ofertas") : (offerCount === 1 ? "offer" : "offers")}
          </span>
        </div>
        {qrSrc && (
          <img
            src={qrSrc}
            alt="Scan to shop"
            className="w-16 h-16 rounded-md"
            data-testid="img-shop-qr-code"
          />
        )}
      </div>
    </div>
  );
}

function ComingSoonSlide() {
  return (
    <div
      className="w-screen h-screen flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0c1445 0%, #1a0a3e 50%, #061428 100%)" }}
      data-testid="slide-coming-soon"
    >
      <h1 className="text-6xl font-bold text-white mb-6">Coming Soon</h1>
      <p className="text-2xl text-white/50">Your local content is being prepared</p>
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-3">
        <span className="text-[11px] text-white/30 tracking-widest uppercase font-medium">
          Powered by CityMetroHub.tv
        </span>
      </div>
    </div>
  );
}

export default function TvPlayer() {
  const params = useParams<{ citySlug: string; hubSlug?: string; locationSlug?: string }>();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const screenKey = searchParams.get("screenKey");

  const [playlist, setPlaylist] = useState<PlaylistResponse | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [loopTransitionVisible, setLoopTransitionVisible] = useState(false);
  const [loopTransitionName, setLoopTransitionName] = useState("");
  const [audioStartTime, setAudioStartTime] = useState(Date.now());

  const pendingPlaylistRef = useRef<PlaylistResponse | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideStartRef = useRef<number>(Date.now());
  const prevLoopIdRef = useRef<string | undefined>(undefined);

  const isDemo = !params.citySlug && !screenKey && window.location.pathname.includes("/tv/demo");

  const fetchPlaylist = useCallback(async () => {
    try {
      if (isDemo) {
        const res = await fetch("/api/tv/demo-playlist");
        if (!res.ok) return;
        return await res.json() as PlaylistResponse;
      }

      const qp = new URLSearchParams();
      if (params.citySlug) qp.set("metroSlug", params.citySlug);
      if (params.hubSlug) qp.set("hubSlug", params.hubSlug);
      if (params.locationSlug) qp.set("locationSlug", params.locationSlug);
      if (screenKey) qp.set("screenKey", screenKey);

      const res = await fetch(`/api/tv/playlist?${qp.toString()}`);
      if (!res.ok) return;
      const data: PlaylistResponse = await res.json();
      return data;
    } catch {
      return undefined;
    }
  }, [params.citySlug, params.hubSlug, params.locationSlug, screenKey]);

  const calculateSyncIndex = useCallback((data: PlaylistResponse): number => {
    if (!data.syncStartTime || !data.totalDurationSec || data.totalDurationSec === 0) return 0;
    const elapsed = ((Date.now() - data.syncStartTime) / 1000 + (data.screenGroupOffset || 0)) % data.totalDurationSec;
    let accumulated = 0;
    for (let i = 0; i < data.items.length; i++) {
      accumulated += data.items[i].durationSec || 9;
      if (accumulated > elapsed) return i;
    }
    return 0;
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const playAudio = useCallback((item: PlaylistItem) => {
    stopAudio();
    if (!item.audioUrl || item.narrationEnabled === false) return;

    const audio = new Audio();
    audio.src = item.audioUrl;
    audio.volume = 1.0;

    if (videoRef.current && !videoRef.current.muted) {
      videoRef.current.muted = true;
    }

    audio.play().catch(() => {});
    audio.onerror = () => {
      audio.src = "";
      audioRef.current = null;
    };

    audioRef.current = audio;
    setAudioStartTime(Date.now());
  }, [stopAudio]);

  const showLoopTransition = useCallback((name: string) => {
    setLoopTransitionName(name);
    setLoopTransitionVisible(true);
    if (loopTransitionTimeoutRef.current) {
      clearTimeout(loopTransitionTimeoutRef.current);
    }
    loopTransitionTimeoutRef.current = setTimeout(() => {
      setLoopTransitionVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      fetchPlaylist().then((data) => {
        if (data) {
          const startIdx = calculateSyncIndex(data);
          setCurrentIndex(startIdx);
          setPlaylist(data);
          setFetchFailed(false);
        } else {
          setFetchFailed(true);
          retryTimer = setTimeout(load, 30000);
        }
      });
    };
    load();
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, [fetchPlaylist, calculateSyncIndex]);

  useEffect(() => {
    if (!playlist) return;
    const interval = setInterval(async () => {
      const data = await fetchPlaylist();
      if (data) pendingPlaylistRef.current = data;
    }, (playlist.nextRefreshSec || 300) * 1000);
    return () => clearInterval(interval);
  }, [playlist, fetchPlaylist]);

  useEffect(() => {
    if (!screenKey) return;
    const sendHeartbeat = () => {
      fetch("/api/tv/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenKey }),
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [screenKey]);

  useEffect(() => {
    if (!playlist || playlist.items.length === 0) return;
    const item = playlist.items[currentIndex];
    if (!item) return;

    if (item.loopId && item.loopId !== prevLoopIdRef.current && item.loopName) {
      showLoopTransition(item.loopName);
    }
    prevLoopIdRef.current = item.loopId;

    if (item.audioUrl && item.narrationEnabled !== false) {
      playAudio(item);
    } else {
      stopAudio();
      setAudioStartTime(Date.now());
    }
  }, [playlist, currentIndex, playAudio, stopAudio, showLoopTransition]);

  const advanceSlide = useCallback(() => {
    if (playlist && playlist.items.length > 0) {
      const item = playlist.items[currentIndex];
      if (item) {
        const durationSec = Math.round((Date.now() - slideStartRef.current) / 1000);
        fetch("/api/tv/play-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenKey,
            itemId: item.id,
            templateKey: item.templateKey,
            durationSec,
            hubSlug: playlist.hubSlug,
          }),
        }).catch(() => {});
      }
    }

    stopAudio();

    setIsTransitioning(true);
    transitionTimeoutRef.current = setTimeout(() => {
      if (pendingPlaylistRef.current) {
        setPlaylist(pendingPlaylistRef.current);
        pendingPlaylistRef.current = null;
        setCurrentIndex(0);
      } else {
        setCurrentIndex((prev) => {
          if (!playlist) return 0;
          return (prev + 1) % playlist.items.length;
        });
      }
      slideStartRef.current = Date.now();
      setIsTransitioning(false);
    }, 600);
  }, [playlist, currentIndex, screenKey, stopAudio]);

  useEffect(() => {
    if (!playlist || playlist.items.length === 0) return;
    const item = playlist.items[currentIndex];
    if (!item) return;

    if (item.type === "video" && item.videoUrl && !item.data?.youtubeVideoId) return;

    const duration = (item.durationSec || 9) * 1000;
    const timer = setTimeout(advanceSlide, duration);
    return () => clearTimeout(timer);
  }, [playlist, currentIndex, advanceSlide]);

  useEffect(() => {
    if (!playlist || playlist.items.length === 0) return;
    const nextIdx = (currentIndex + 1) % playlist.items.length;
    const nextItem = playlist.items[nextIdx];
    if (nextItem?.assetUrl) {
      const img = new Image();
      img.src = nextItem.assetUrl;
    }
    if (nextItem?.data?.imageUrl) {
      const img = new Image();
      img.src = nextItem.data.imageUrl;
    }
  }, [currentIndex, playlist]);

  useEffect(() => {
    const handleMove = () => {
      setShowCursor(true);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = setTimeout(() => setShowCursor(false), 3000);
    };
    const handleContext = (e: MouseEvent) => e.preventDefault();

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("contextmenu", handleContext);

    cursorTimeoutRef.current = setTimeout(() => setShowCursor(false), 3000);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("contextmenu", handleContext);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    };
    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
      if (loopTransitionTimeoutRef.current) clearTimeout(loopTransitionTimeoutRef.current);
    };
  }, [stopAudio]);

  const handleVideoEnd = useCallback(() => {
    advanceSlide();
  }, [advanceSlide]);

  const handleVideoError = useCallback(() => {
    advanceSlide();
  }, [advanceSlide]);

  const handleImageError = useCallback(() => {
    advanceSlide();
  }, [advanceSlide]);

  if (!playlist) {
    return (
      <div
        className="w-screen h-screen bg-black flex items-center justify-center"
        style={{ cursor: showCursor ? "auto" : "none" }}
        data-testid="tv-player-loading"
      >
        {fetchFailed ? <ComingSoonSlide /> : (
          <div className="animate-spin h-12 w-12 border-4 border-white/30 border-t-white rounded-full" />
        )}
      </div>
    );
  }

  if (playlist.items.length === 0) {
    return (
      <div
        style={{ cursor: showCursor ? "auto" : "none" }}
        data-testid="tv-player-empty"
      >
        <ComingSoonSlide />
      </div>
    );
  }

  const currentItem = playlist.items[currentIndex];
  const languageMode = playlist.languageMode || "en";
  const hasCaption = !!(currentItem.captionUrl || currentItem.subtitleText);

  return (
    <div
      className="w-screen h-screen bg-black overflow-hidden"
      style={{ cursor: showCursor ? "auto" : "none" }}
      data-testid="tv-player"
    >
      <div
        className="w-full h-full relative"
        style={{
          opacity: isTransitioning ? 0 : 1,
          transition: "opacity 0.6s ease-in-out",
        }}
      >
        {currentItem.type === "video" && currentItem.videoUrl && currentItem.data?.youtubeVideoId ? (
          <div className="w-full h-full relative" data-testid="tv-youtube-embed">
            <iframe
              key={currentItem.id + "-" + currentIndex}
              src={`https://www.youtube.com/embed/${currentItem.data.youtubeVideoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&enablejsapi=1`}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            {currentItem.qrUrl && (
              <div className="absolute bottom-8 right-8 z-20">
                <div className="px-4 py-2 rounded-md bg-black/70 text-white text-sm flex items-center gap-2">
                  <span>{languageMode === "es" ? "Escanea para ver en tu teléfono" : "Scan to watch on your phone"}</span>
                </div>
              </div>
            )}
          </div>
        ) : currentItem.type === "video" && currentItem.videoUrl ? (
          <video
            ref={videoRef}
            key={currentItem.id + "-" + currentIndex}
            src={currentItem.videoUrl}
            autoPlay
            muted={!!(currentItem.audioUrl && currentItem.narrationEnabled !== false)}
            playsInline
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            className="w-full h-full object-cover"
            data-testid="tv-video-player"
          />
        ) : (
          <div onError={handleImageError}>
            <SlideRenderer
              templateKey={currentItem.templateKey || "hub_event"}
              data={currentItem.data || {}}
              qrUrl={currentItem.qrUrl || currentItem.clickUrl}
              assetUrl={currentItem.assetUrl}
              languageMode={languageMode}
            />
          </div>
        )}

        {hasCaption && (
          <CaptionOverlay
            captionUrl={currentItem.captionUrl}
            subtitleText={currentItem.subtitleText}
            audioStartTime={audioStartTime}
          />
        )}

        {currentItem.liveOfferCount && currentItem.liveOfferCount > 0 && (
          <LiveOffersOverlay
            offerCount={currentItem.liveOfferCount}
            channelSlug={currentItem.liveChannelSlug}
            metroSlug={params.citySlug}
            languageMode={languageMode}
          />
        )}

        <LoopTransition
          loopName={loopTransitionName}
          visible={loopTransitionVisible}
        />
      </div>
    </div>
  );
}
