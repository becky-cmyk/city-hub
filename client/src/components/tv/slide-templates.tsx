import { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Calendar, Clock, Radio, AlertTriangle, Car, Construction, Sun, Cloud, CloudRain, CloudLightning, CloudSun, CloudFog, Snowflake, Wind, Droplets, Thermometer, ArrowUp, ArrowDown, Trophy, HelpCircle, Heart, Eye, QrCode, Megaphone, Timer, Store } from "lucide-react";
import { SiTiktok, SiInstagram } from "react-icons/si";

interface SlideProps {
  data: Record<string, any>;
  qrUrl?: string;
  assetUrl?: string;
  languageMode: "en" | "es" | "bilingual";
}

function useQrDataUrl(url?: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [url]);
  return dataUrl;
}

function getText(data: Record<string, any>, field: string, languageMode: string): string {
  if (languageMode === "es") {
    return data[`${field}Es`] || data[field] || "";
  }
  return data[field] || "";
}

function BilingualText({
  data,
  field,
  languageMode,
  className,
  subClassName,
}: {
  data: Record<string, any>;
  field: string;
  languageMode: string;
  className?: string;
  subClassName?: string;
}) {
  const primary = getText(data, field, languageMode);
  if (languageMode !== "bilingual") {
    return <span className={className}>{primary}</span>;
  }
  const en = data[field] || "";
  const es = data[`${field}Es`] || "";
  return (
    <span className={className}>
      {en}
      {es && <span className={subClassName || "block text-[0.65em] opacity-70 mt-1"}>{es}</span>}
    </span>
  );
}

function QrBlock({ qrDataUrl, label }: { qrDataUrl: string | null; label?: string }) {
  if (!qrDataUrl) return null;
  return (
    <div className="flex flex-col items-center gap-2" data-testid="tv-qr-block">
      <div className="rounded-md overflow-hidden bg-white p-1">
        <img src={qrDataUrl} alt="QR Code" className="w-28 h-28 md:w-36 md:h-36" />
      </div>
      {label && <span className="text-xs text-white/60 uppercase tracking-wider">{label}</span>}
    </div>
  );
}

function SlideFooter() {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-3 z-10">
      <span className="text-[11px] text-white/30 tracking-widest uppercase font-medium">
        Powered by CityMetroHub.tv
      </span>
    </div>
  );
}

export function HubEventSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.imageUrl || data.backgroundImage;
  const eventDate = data.date ? new Date(data.date) : null;

  return (
    <div
      className="relative w-screen h-screen flex items-end"
      style={{
        background: bgImage
          ? `url(${bgImage}) center/cover no-repeat`
          : "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      }}
      data-testid="slide-hub-event"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
      <div className="relative z-10 w-full px-16 pb-20 flex items-end justify-between gap-12">
        <div className="flex-1 max-w-[65%]">
          {data.category && (
            <Badge className="mb-4 text-sm px-3 py-1 bg-primary/80 border-primary/40 text-white no-default-hover-elevate no-default-active-elevate">
              {data.category}
            </Badge>
          )}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            <BilingualText data={data} field="title" languageMode={languageMode} />
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-white/80 text-xl">
            {eventDate && (
              <span className="flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                {eventDate.toLocaleDateString(languageMode === "es" ? "es-ES" : "en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {data.time && (
              <span className="flex items-center gap-2">
                <Clock className="w-6 h-6" />
                {data.time}
              </span>
            )}
            {data.location && (
              <span className="flex items-center gap-2">
                <MapPin className="w-6 h-6" />
                {data.location}
              </span>
            )}
          </div>
        </div>
        <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Escanea para detalles" : "Scan for details"} />
      </div>
      <SlideFooter />
    </div>
  );
}

export function PulseHeadlineSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.imageUrl;

  return (
    <div
      className="relative w-screen h-screen flex"
      style={{ background: "#0a0a0f" }}
      data-testid="slide-pulse-headline"
    >
      {bgImage && (
        <div
          className="absolute right-0 top-0 bottom-0 w-[45%]"
          style={{ background: `url(${bgImage}) center/cover no-repeat` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent" />
        </div>
      )}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-16 max-w-[60%]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-8 bg-primary rounded-full" />
          <span className="text-sm uppercase tracking-[0.25em] text-primary font-semibold">
            {languageMode === "es" ? "Noticias Locales" : "Local News"}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
          <BilingualText data={data} field="title" languageMode={languageMode} />
        </h1>
        {(data.excerpt || data.excerptEs) && (
          <p className="text-xl md:text-2xl text-white/70 leading-relaxed mb-8 line-clamp-2">
            {getText(data, "excerpt", languageMode)}
          </p>
        )}
        {data.author && (
          <span className="text-lg text-white/50">
            {languageMode === "es" ? "Por" : "By"} {data.author}
          </span>
        )}
      </div>
      <div className="absolute bottom-16 right-16 z-10">
        <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Lee el artículo" : "Read the article"} />
      </div>
      <SlideFooter />
    </div>
  );
}

export function HubDiscoverySlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.imageUrl;

  const gradientStyle = useMemo(() => ({
    background: "linear-gradient(135deg, #0c1445 0%, #1a0a3e 30%, #0d2847 60%, #061428 100%)",
    animation: "hubDiscoveryGradient 15s ease infinite",
  }), []);

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center"
      style={gradientStyle}
      data-testid="slide-hub-discovery"
    >
      <style>{`
        @keyframes hubDiscoveryGradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
      {bgImage && (
        <>
          <div
            className="absolute inset-0 opacity-20"
            style={{ background: `url(${bgImage}) center/cover no-repeat` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/60" />
        </>
      )}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="relative z-10 text-center px-16 flex flex-col items-center">
        <span className="text-sm uppercase tracking-[0.3em] text-blue-300/60 mb-4 font-medium">
          {languageMode === "es" ? "Descubre" : "Discover"}
        </span>
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8">
          <BilingualText
            data={data}
            field="hubName"
            languageMode={languageMode}
            subClassName="block text-[0.5em] opacity-60 mt-2"
          />
        </h1>
        <div className="flex items-center gap-12 mb-10">
          {data.businessCount != null && (
            <div className="text-center">
              <div className="text-4xl font-bold text-white">{data.businessCount}</div>
              <div className="text-sm text-white/50 mt-1">
                {languageMode === "es" ? "Negocios" : "Businesses"}
              </div>
            </div>
          )}
          {data.eventCount != null && (
            <div className="text-center">
              <div className="text-4xl font-bold text-white">{data.eventCount}</div>
              <div className="text-sm text-white/50 mt-1">
                {languageMode === "es" ? "Eventos" : "Events"}
              </div>
            </div>
          )}
          {data.articleCount != null && (
            <div className="text-center">
              <div className="text-4xl font-bold text-white">{data.articleCount}</div>
              <div className="text-sm text-white/50 mt-1">
                {languageMode === "es" ? "Artículos" : "Articles"}
              </div>
            </div>
          )}
        </div>
        <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Explora el vecindario" : "Explore the neighborhood"} />
      </div>
      <SlideFooter />
    </div>
  );
}

export function NeighborhoodSpotlightSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.imageUrl || data.heroImage;

  const rating = data.rating ? parseFloat(data.rating) : null;
  const fullStars = rating ? Math.floor(rating) : 0;

  return (
    <div
      className="relative w-screen h-screen flex"
      style={{ background: "#0a0a0f" }}
      data-testid="slide-neighborhood-spotlight"
    >
      {bgImage && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[50%]"
          style={{ background: `url(${bgImage}) center/cover no-repeat` }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0f] via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/60 to-transparent" />
        </div>
      )}
      <div className="relative z-10 ml-auto w-[55%] flex flex-col justify-center px-16">
        <span className="text-sm uppercase tracking-[0.25em] text-amber-400/80 mb-4 font-semibold">
          {languageMode === "es" ? "Negocio Destacado" : "Featured Business"}
        </span>
        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
          <BilingualText data={data} field="name" languageMode={languageMode} />
        </h1>
        {data.category && (
          <Badge className="mb-5 w-fit text-sm px-3 py-1 bg-white/10 border-white/20 text-white/80 no-default-hover-elevate no-default-active-elevate">
            {data.category}
          </Badge>
        )}
        {(data.description || data.descriptionEs) && (
          <p className="text-xl text-white/60 leading-relaxed mb-6 line-clamp-2">
            {getText(data, "description", languageMode)}
          </p>
        )}
        {rating && (
          <div className="flex items-center gap-2 mb-8">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${i < fullStars ? "text-amber-400 fill-amber-400" : "text-white/20"}`}
                />
              ))}
            </div>
            <span className="text-lg text-white/50 ml-1">{rating.toFixed(1)}</span>
          </div>
        )}
        <div className="mt-auto">
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Ver negocio" : "View business"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function VenueSpecialSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.imageUrl || data.logoUrl;
  const accentColor = data.accentColor || "#f59e0b";

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${accentColor}15 0%, #0a0a0f 40%, #0a0a0f 60%, ${accentColor}10 100%)`,
      }}
      data-testid="slide-venue-special"
    >
      <div
        className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-20"
        style={{ background: accentColor }}
      />
      <div
        className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-15"
        style={{ background: accentColor }}
      />
      <div className="relative z-10 w-full px-16 flex items-center gap-16">
        <div className="flex-1">
          {data.venueName && (
            <span className="text-lg uppercase tracking-[0.2em] text-white/40 mb-3 block font-medium">
              {data.venueName}
            </span>
          )}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6"
            style={{ color: accentColor }}
          >
            <BilingualText data={data} field="title" languageMode={languageMode} />
          </h1>
          {(data.description || data.descriptionEs) && (
            <p className="text-2xl text-white/70 leading-relaxed max-w-2xl">
              {getText(data, "description", languageMode)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-6">
          {bgImage && (
            <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-white/10">
              <img src={bgImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Más información" : "Learn more"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function LiveFeedSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.thumbnailUrl || data.imageUrl;

  return (
    <div
      className="relative w-screen h-screen flex items-center"
      style={{ background: "#05050a" }}
      data-testid="slide-live-feed"
    >
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes liveBorder {
          0%, 100% { border-color: rgba(239, 68, 68, 0.6); }
          50% { border-color: rgba(239, 68, 68, 0.15); }
        }
      `}</style>
      <div
        className="absolute inset-4 rounded-2xl border-2"
        style={{ animation: "liveBorder 2s ease-in-out infinite" }}
      />
      {bgImage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[60%] h-[70%] rounded-2xl opacity-30"
            style={{ background: `url(${bgImage}) center/cover no-repeat` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#05050a] via-[#05050a]/70 to-[#05050a]" />
        </div>
      )}
      <div className="relative z-10 w-full px-16 flex items-center justify-between gap-12">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-red-600/90 px-3 py-1.5 rounded-md">
              <div
                className="w-2.5 h-2.5 rounded-full bg-white"
                style={{ animation: "livePulse 1.5s ease-in-out infinite" }}
              />
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                {languageMode === "es" ? "En Vivo" : "Live"}
              </span>
            </div>
            <Radio className="w-5 h-5 text-red-400/60" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-4">
            <BilingualText data={data} field="title" languageMode={languageMode} />
          </h1>
          {(data.description || data.descriptionEs) && (
            <p className="text-xl text-white/50 leading-relaxed max-w-2xl">
              {getText(data, "description", languageMode)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-4">
          {bgImage && (
            <div className="w-48 h-48 rounded-xl overflow-hidden border border-white/10">
              <img src={bgImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Ver transmisión" : "Watch stream"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

function getTrafficPeriod(): "morning_rush" | "evening_rush" | "midday" | "overnight" {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 9) return "morning_rush";
  if (hour >= 16 && hour < 19) return "evening_rush";
  if (hour >= 9 && hour < 16) return "midday";
  return "overnight";
}

function getCorridorDefaults(period: ReturnType<typeof getTrafficPeriod>) {
  const corridors = [
    { name: "I-77", direction: "N/S", description: "Uptown to Lake Norman" },
    { name: "I-85", direction: "NE/SW", description: "Concord to Gastonia" },
    { name: "I-485", direction: "Loop", description: "Outer Belt" },
    { name: "I-277", direction: "Loop", description: "Inner Loop / Brookshire" },
  ];
  const statusByPeriod: Record<string, Array<"clear" | "moderate" | "heavy">> = {
    morning_rush: ["heavy", "moderate", "moderate", "heavy"],
    evening_rush: ["heavy", "heavy", "moderate", "moderate"],
    midday: ["clear", "clear", "clear", "clear"],
    overnight: ["clear", "clear", "clear", "clear"],
  };
  const delayByPeriod: Record<string, number[]> = {
    morning_rush: [12, 8, 5, 10],
    evening_rush: [15, 12, 6, 8],
    midday: [0, 0, 0, 0],
    overnight: [0, 0, 0, 0],
  };
  return corridors.map((c, i) => ({
    ...c,
    status: statusByPeriod[period][i],
    delayMin: delayByPeriod[period][i],
  }));
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  clear: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Clear" },
  moderate: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Moderate" },
  heavy: { bg: "bg-red-500/20", text: "text-red-400", label: "Heavy" },
};

const STATUS_DOT_COLORS: Record<string, string> = {
  clear: "#22c55e",
  moderate: "#f59e0b",
  heavy: "#ef4444",
};

export function TrafficUpdateSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const period = getTrafficPeriod();
  const corridors = data.corridors || getCorridorDefaults(period);
  const incidentCount = data.incidentCount ?? (period.includes("rush") ? 3 : 0);

  const periodLabels: Record<string, { en: string; es: string }> = {
    morning_rush: { en: "Morning Rush Hour", es: "Hora Pico Matutina" },
    evening_rush: { en: "Evening Rush Hour", es: "Hora Pico Vespertina" },
    midday: { en: "Midday Traffic", es: "Tráfico del Mediodía" },
    overnight: { en: "Overnight Traffic", es: "Tráfico Nocturno" },
  };

  const isRush = period === "morning_rush" || period === "evening_rush";
  const periodLabel = languageMode === "es" ? periodLabels[period].es : periodLabels[period].en;

  return (
    <div
      className="relative w-screen h-screen flex items-center"
      style={{
        background: "linear-gradient(160deg, #0c1220 0%, #0f1a2e 40%, #111827 100%)",
      }}
      data-testid="slide-traffic-update"
    >
      <div className="absolute inset-0 overflow-hidden">
        <svg viewBox="0 0 1920 1080" className="absolute inset-0 w-full h-full opacity-[0.06]">
          <line x1="960" y1="100" x2="960" y2="980" stroke="white" strokeWidth="3" strokeDasharray="12 8" />
          <line x1="200" y1="540" x2="1720" y2="540" stroke="white" strokeWidth="3" strokeDasharray="12 8" />
          <ellipse cx="960" cy="540" rx="500" ry="350" fill="none" stroke="white" strokeWidth="2" strokeDasharray="10 6" />
          <ellipse cx="960" cy="540" rx="180" ry="130" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 6" />
          <text x="960" y="525" textAnchor="middle" fill="white" fontSize="14" opacity="0.6">I-277</text>
          <text x="960" y="165" textAnchor="middle" fill="white" fontSize="14" opacity="0.6">I-77 N</text>
          <text x="960" y="935" textAnchor="middle" fill="white" fontSize="14" opacity="0.6">I-77 S</text>
          <text x="280" y="535" textAnchor="middle" fill="white" fontSize="14" opacity="0.6">I-85 SW</text>
          <text x="1640" y="535" textAnchor="middle" fill="white" fontSize="14" opacity="0.6">I-85 NE</text>
          <text x="1350" y="280" textAnchor="middle" fill="white" fontSize="14" opacity="0.6">I-485</text>
        </svg>
      </div>

      {isRush && (
        <div className="absolute top-8 right-8 z-10">
          <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 px-4 py-2 rounded-md">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
              {languageMode === "es" ? "Hora Pico" : "Rush Hour"}
            </span>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full px-16 flex items-start justify-between gap-12">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <Car className="w-7 h-7 text-blue-400" />
            <span className="text-sm uppercase tracking-[0.25em] text-blue-400/80 font-semibold">
              {languageMode === "es" ? "Tráfico de Charlotte" : "Charlotte Traffic"}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-3">
            {periodLabel}
          </h1>
          <p className="text-xl text-white/50 mb-10">
            {languageMode === "es"
              ? "Corredores principales del área metropolitana"
              : "Major metro area corridors"}
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-3xl">
            {corridors.map((corridor: any, idx: number) => {
              const st = STATUS_COLORS[corridor.status] || STATUS_COLORS.clear;
              const dotColor = STATUS_DOT_COLORS[corridor.status] || STATUS_DOT_COLORS.clear;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-4 px-5 py-4 rounded-md border border-white/10 ${st.bg}`}
                  data-testid={`traffic-corridor-${idx}`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}80` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl font-bold text-white">{corridor.name}</span>
                      <span className="text-sm text-white/40">{corridor.direction}</span>
                    </div>
                    <span className="text-sm text-white/40">{corridor.description}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-sm font-semibold ${st.text}`}>{st.label}</span>
                    {corridor.delayMin > 0 && (
                      <span className="block text-xs text-white/40">
                        +{corridor.delayMin} min
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {incidentCount > 0 && (
            <div className="flex items-center gap-2 mt-6 text-white/50">
              <Construction className="w-5 h-5 text-amber-400/60" />
              <span className="text-lg">
                {incidentCount} {languageMode === "es"
                  ? (incidentCount === 1 ? "incidente reportado" : "incidentes reportados")
                  : (incidentCount === 1 ? "reported incident" : "reported incidents")}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 pt-8">
          <QrBlock
            qrDataUrl={qrDataUrl}
            label={languageMode === "es" ? "Tráfico en vivo" : "Live traffic map"}
          />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

const WEATHER_ICON_MAP: Record<string, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-rain": CloudRain,
  "cloud-lightning": CloudLightning,
  "cloud-fog": CloudFog,
  snowflake: Snowflake,
  wind: Wind,
};

export function WeatherCurrentSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const IconComponent = WEATHER_ICON_MAP[data.conditionsIcon] || CloudSun;
  const temp = data.temperature ?? "--";
  const unit = data.temperatureUnit || "F";

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center"
      style={{
        background: "linear-gradient(160deg, #0b1a2e 0%, #0f2847 30%, #1a1a3e 60%, #0d1428 100%)",
      }}
      data-testid="slide-weather-current"
    >
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-blue-400/5 blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-cyan-400/5 blur-[100px]" />

      <div className="relative z-10 w-full px-16 flex items-center justify-between gap-16">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-blue-300/70" />
            <span className="text-lg text-blue-300/80 font-medium tracking-wide">
              {data.locationName || "Charlotte, NC"}
            </span>
          </div>

          <div className="flex items-start gap-8 mb-8">
            <IconComponent className="w-28 h-28 text-blue-200/90 flex-shrink-0" strokeWidth={1.2} />
            <div>
              <div className="flex items-start">
                <span className="text-[120px] font-bold text-white leading-none">{temp}</span>
                <span className="text-4xl text-white/60 mt-4 ml-1">{unit === "F" ? "\u00b0F" : "\u00b0C"}</span>
              </div>
              <p className="text-2xl text-white/70 mt-2">{data.conditions || ""}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8 text-white/60 text-lg">
            {data.high != null && (
              <span className="flex items-center gap-2">
                <ArrowUp className="w-5 h-5 text-red-400/70" />
                <span className="text-white/80">{data.high}\u00b0</span>
                <span className="text-sm">{languageMode === "es" ? "M\u00e1x" : "High"}</span>
              </span>
            )}
            {data.low != null && (
              <span className="flex items-center gap-2">
                <ArrowDown className="w-5 h-5 text-blue-400/70" />
                <span className="text-white/80">{data.low}\u00b0</span>
                <span className="text-sm">{languageMode === "es" ? "M\u00edn" : "Low"}</span>
              </span>
            )}
            {data.humidity && (
              <span className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400/70" />
                <span className="text-white/80">{data.humidity}</span>
                <span className="text-sm">{languageMode === "es" ? "Humedad" : "Humidity"}</span>
              </span>
            )}
            {data.windSpeed && (
              <span className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-slate-400/70" />
                <span className="text-white/80">
                  {data.windDirection ? `${data.windDirection} ` : ""}{data.windSpeed}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <QrBlock
            qrDataUrl={qrDataUrl}
            label={languageMode === "es" ? "Pron\u00f3stico completo" : "Full forecast"}
          />
          <span className="text-xs text-white/25 tracking-wider">
            Powered by NWS
          </span>
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function TriviaQuestionSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const answers: string[] = data.answers || [];
  const category = data.category || "Trivia";
  const answerLabels = ["A", "B", "C", "D"];

  const [countdown, setCountdown] = useState(30);
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 0 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const categoryColors: Record<string, string> = {
    History: "#f59e0b",
    Food: "#ef4444",
    Sports: "#3b82f6",
    "Local Knowledge": "#10b981",
  };
  const accent = categoryColors[data.category] || "#8b5cf6";

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${accent}15 0%, #0a0a0f 30%, #0a0a0f 70%, ${accent}10 100%)`,
      }}
      data-testid="slide-trivia-question"
    >
      <style>{`
        @keyframes qrPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0.3); }
          50% { transform: scale(1.05); box-shadow: 0 0 30px 10px rgba(255,255,255,0.15); }
        }
        @keyframes countdownTick {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-15"
        style={{ background: accent }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10"
        style={{ background: accent }}
      />

      <div className="relative z-10 w-full px-16 flex items-center gap-16">
        <div className="flex-1 max-w-[60%]">
          <div className="flex items-center gap-3 mb-6">
            <Badge
              className="text-sm px-3 py-1 text-white border-transparent no-default-hover-elevate no-default-active-elevate"
              style={{ backgroundColor: `${accent}cc`, borderColor: `${accent}60` }}
            >
              <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
              {category}
            </Badge>
            <div className="flex items-center gap-2 ml-auto">
              <div
                className="w-14 h-14 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: countdown <= 10 ? "#ef4444" : `${accent}80`,
                  animation: countdown <= 10 ? "countdownTick 1s ease-in-out infinite" : "none",
                }}
              >
                <span
                  className="text-2xl font-bold"
                  style={{ color: countdown <= 10 ? "#ef4444" : "white" }}
                >
                  {countdown}
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-10">
            <BilingualText data={data} field="question" languageMode={languageMode} />
          </h1>

          <div className="grid grid-cols-2 gap-4">
            {answers.map((answer: string, i: number) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl px-6 py-5 border border-white/10 bg-white/5"
                data-testid={`trivia-answer-${i}`}
              >
                <span
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg text-white"
                  style={{ backgroundColor: `${accent}80` }}
                >
                  {answerLabels[i]}
                </span>
                <span className="text-xl text-white/90 font-medium">{answer}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <span
            className="text-2xl font-bold uppercase tracking-wider"
            style={{ color: accent }}
          >
            {languageMode === "es" ? "Escanea para Responder" : "Scan to Answer!"}
          </span>
          {qrDataUrl && (
            <div
              className="rounded-xl overflow-hidden bg-white p-2"
              style={{ animation: "qrPulse 2s ease-in-out infinite" }}
              data-testid="trivia-qr-pulse"
            >
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            </div>
          )}
          <span className="text-sm text-white/40 uppercase tracking-widest">
            {languageMode === "es" ? "Responde y gana" : "Answer & Win"}
          </span>
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function SocialProofSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl || data.postUrl);
  const imageUrl = assetUrl || data.imageUrl;
  const platform = (data.platform || "tiktok").toLowerCase();
  const PlatformIcon = platform === "instagram" ? SiInstagram : SiTiktok;
  const platformColor = platform === "instagram" ? "#E1306C" : "#00f2ea";
  const platformLabel = platform === "instagram" ? "Instagram" : "TikTok";

  const likes = data.likes != null ? Number(data.likes) : null;
  const views = data.views != null ? Number(data.views) : null;

  function formatStat(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  return (
    <div
      className="relative w-screen h-screen flex items-center"
      style={{ background: "linear-gradient(145deg, #0a0a12 0%, #121225 40%, #0d0d1a 100%)" }}
      data-testid="slide-social-proof"
    >
      <style>{`
        @keyframes socialPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${platformColor}40; }
          50% { box-shadow: 0 0 0 20px ${platformColor}00; }
        }
      `}</style>
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10"
        style={{ background: platformColor }}
      />
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-5"
        style={{ background: platformColor }}
      />

      <div className="relative z-10 w-full px-16 flex items-center gap-16">
        {imageUrl && (
          <div className="flex-shrink-0">
            <div
              className="w-[420px] h-[420px] rounded-2xl overflow-hidden border-2"
              style={{
                borderColor: `${platformColor}30`,
                animation: "socialPulse 3s ease-in-out infinite",
              }}
            >
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-md"
              style={{ background: `${platformColor}15`, border: `1px solid ${platformColor}30` }}
            >
              <PlatformIcon style={{ color: platformColor, width: 20, height: 20 }} />
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: platformColor }}>
                {platformLabel}
              </span>
            </div>
          </div>

          <span className="text-sm uppercase tracking-[0.3em] text-white/40 mb-4 font-medium">
            {languageMode === "es" ? "Comunidad Destacada" : "Community Spotlight"}
          </span>

          {data.username && (
            <h2 className="text-3xl font-bold text-white mb-4">
              @{data.username}
            </h2>
          )}

          {data.caption && (
            <p className="text-xl text-white/60 leading-relaxed mb-8 line-clamp-3 max-w-xl">
              {data.caption}
            </p>
          )}

          {(likes != null || views != null) && (
            <div className="flex items-center gap-8 mb-10">
              {views != null && (
                <div className="flex items-center gap-2">
                  <Eye className="w-6 h-6 text-white/40" />
                  <span className="text-2xl font-semibold text-white">{formatStat(views)}</span>
                  <span className="text-sm text-white/40">{languageMode === "es" ? "vistas" : "views"}</span>
                </div>
              )}
              {likes != null && (
                <div className="flex items-center gap-2">
                  <Heart className="w-6 h-6 text-white/40" />
                  <span className="text-2xl font-semibold text-white">{formatStat(likes)}</span>
                  <span className="text-sm text-white/40">{languageMode === "es" ? "me gusta" : "likes"}</span>
                </div>
              )}
            </div>
          )}

          <QrBlock
            qrDataUrl={qrDataUrl}
            label={languageMode === "es" ? "Ver publicaci\u00f3n original" : "View original post"}
          />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

function GameStatusBadge({ status, detail }: { status: string; detail: string }) {
  const bgClass =
    status === "in"
      ? "bg-red-600/90"
      : status === "post"
        ? "bg-white/10"
        : "bg-emerald-600/80";
  const label =
    status === "in"
      ? "LIVE"
      : status === "post"
        ? "FINAL"
        : detail || "UPCOMING";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider text-white ${bgClass}`}
    >
      {status === "in" && (
        <span
          className="w-2 h-2 rounded-full bg-white"
          style={{ animation: "livePulse 1.5s ease-in-out infinite" }}
        />
      )}
      {label}
    </span>
  );
}

function GameCard({ game }: { game: Record<string, any> }) {
  const isLive = game.status === "in";
  const hasScores = game.homeScore != null && game.awayScore != null;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl p-5 ${
        isLive
          ? "bg-white/10 border border-red-500/30"
          : "bg-white/5 border border-white/10"
      } ${game.isLocalTeam ? "ring-1 ring-primary/40" : ""}`}
      data-testid={`game-card-${game.league}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge className="text-[10px] px-2 py-0.5 bg-white/10 border-white/20 text-white/70 no-default-hover-elevate no-default-active-elevate">
          {game.league}
        </Badge>
        <GameStatusBadge status={game.status} detail={game.statusDetail} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {game.awayLogo && (
            <img
              src={game.awayLogo}
              alt=""
              className="w-10 h-10 object-contain flex-shrink-0"
              crossOrigin="anonymous"
            />
          )}
          <span className="text-white font-semibold text-lg truncate">
            {game.awayAbbrev || game.awayTeam}
          </span>
        </div>
        {hasScores && (
          <span className="text-2xl font-bold text-white tabular-nums">
            {game.awayScore}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {game.homeLogo && (
            <img
              src={game.homeLogo}
              alt=""
              className="w-10 h-10 object-contain flex-shrink-0"
              crossOrigin="anonymous"
            />
          )}
          <span className="text-white font-semibold text-lg truncate">
            {game.homeAbbrev || game.homeTeam}
          </span>
        </div>
        {hasScores && (
          <span className="text-2xl font-bold text-white tabular-nums">
            {game.homeScore}
          </span>
        )}
      </div>
      {!hasScores && game.startTime && (
        <span className="text-sm text-white/40 text-center">
          {new Date(game.startTime).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}

export function SportsScoresSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const games: Record<string, any>[] = data.games || [];

  return (
    <div
      className="relative w-screen h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(160deg, #0c1220 0%, #111827 40%, #0f1629 100%)",
      }}
      data-testid="slide-sports-scores"
    >
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-3xl -translate-x-1/3 translate-y-1/3" />
      <div className="relative z-10 flex-1 flex flex-col px-16 py-14">
        <div className="flex items-center justify-between gap-4 mb-10 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">
                {languageMode === "es" ? "Resultados Deportivos" : "Sports Scores"}
              </h2>
              <span className="text-sm text-white/40">
                {languageMode === "es"
                  ? "Equipos de Charlotte y la región"
                  : "Charlotte & regional teams"}
              </span>
            </div>
          </div>
          <QrBlock
            qrDataUrl={qrDataUrl}
            label={languageMode === "es" ? "Todos los resultados" : "All scores"}
          />
        </div>
        {games.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xl text-white/30">
              {languageMode === "es"
                ? "No hay juegos programados"
                : "No games scheduled"}
            </span>
          </div>
        ) : (
          <div
            className={`grid gap-6 flex-1 items-center ${
              games.length <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
            }`}
          >
            {games.slice(0, 4).map((game, i) => (
              <GameCard key={i} game={game} />
            ))}
          </div>
        )}
      </div>
      <SlideFooter />
    </div>
  );
}

export function QrCtaSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl || data.qrUrl);
  const accentColor = data.accentColor || "#3b82f6";

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center"
      style={{
        background: `radial-gradient(ellipse at 30% 50%, ${accentColor}20 0%, #0a0a0f 60%)`,
      }}
      data-testid="slide-qr-cta"
    >
      <div
        className="absolute top-1/4 right-1/4 w-[350px] h-[350px] rounded-full blur-[120px] opacity-15"
        style={{ background: accentColor }}
      />
      <style>{`
        @keyframes qrPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${accentColor}40; }
          50% { box-shadow: 0 0 0 20px ${accentColor}00; }
        }
      `}</style>
      <div className="relative z-10 w-full px-16 flex items-center justify-between gap-16">
        <div className="flex-1 max-w-[55%]">
          <div className="flex items-center gap-3 mb-6">
            <QrCode className="w-8 h-8" style={{ color: accentColor }} />
            <Badge className="text-sm px-3 py-1 border-white/20 bg-white/10 text-white no-default-hover-elevate no-default-active-elevate">
              {languageMode === "es" ? "Escanea & Actúa" : "Scan & Go"}
            </Badge>
          </div>
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6"
            style={{ color: accentColor }}
          >
            <BilingualText data={data} field="headline" languageMode={languageMode} />
          </h1>
          {(data.description || data.descriptionEs) && (
            <p className="text-2xl text-white/70 leading-relaxed max-w-2xl">
              {getText(data, "description", languageMode)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-6">
          {qrDataUrl && (
            <div
              className="rounded-2xl overflow-hidden bg-white p-3"
              style={{ animation: "qrPulse 2.5s ease-in-out infinite" }}
            >
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 md:w-56 md:h-56" />
            </div>
          )}
          {(data.ctaText || data.ctaTextEs) && (
            <span
              className="text-xl font-bold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              {getText(data, "ctaText", languageMode)}
            </span>
          )}
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function SponsorAdSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl || data.qrUrl);
  const logoUrl = data.logoUrl || assetUrl;
  const accentColor = data.accentColor || "#10b981";

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center"
      style={{
        background: `linear-gradient(160deg, ${accentColor}12 0%, #0a0a0f 35%, #0a0a0f 65%, ${accentColor}08 100%)`,
      }}
      data-testid="slide-sponsor-ad"
    >
      <div
        className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full blur-[100px] opacity-15"
        style={{ background: accentColor }}
      />
      <div className="absolute top-6 right-8 z-20">
        <Badge className="text-[10px] px-2.5 py-1 bg-white/10 border-white/20 text-white/50 uppercase tracking-widest no-default-hover-elevate no-default-active-elevate">
          <Megaphone className="w-3 h-3 mr-1.5" />
          {languageMode === "es" ? "Patrocinado" : "Sponsored"}
        </Badge>
      </div>
      <div className="relative z-10 w-full px-16 flex items-center gap-16">
        <div className="flex-1">
          {logoUrl && (
            <div className="mb-8">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/10 bg-white/5">
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-3"
            style={{ color: accentColor }}
          >
            {data.businessName}
          </h1>
          {(data.tagline || data.taglineEs) && (
            <p className="text-2xl text-white/80 font-medium mb-6">
              {getText(data, "tagline", languageMode)}
            </p>
          )}
          {(data.promoText || data.promoTextEs) && (
            <div
              className="inline-block px-6 py-3 rounded-xl text-xl font-bold"
              style={{ background: `${accentColor}20`, color: accentColor }}
            >
              {getText(data, "promoText", languageMode)}
            </div>
          )}
          {(data.description || data.descriptionEs) && (
            <p className="text-lg text-white/50 leading-relaxed max-w-2xl mt-6">
              {getText(data, "description", languageMode)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-4">
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Visitar" : "Visit"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function EventCountdownSlide({ data, languageMode }: SlideProps) {
  const accentColor = data.accentColor || "#f43f5e";
  const eventTimeMs = useMemo(() => data.eventTime ? new Date(data.eventTime).getTime() : null, [data.eventTime]);

  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0, label: "" });

  useEffect(() => {
    if (!eventTimeMs) return;
    const tick = () => {
      const now = new Date();
      const diff = eventTimeMs - now.getTime();
      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, label: languageMode === "es" ? "¡Ahora!" : "Now!" });
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown({ hours, minutes, seconds, label: "" });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [eventTimeMs, languageMode]);

  const timeDisplay = eventTimeMs
    ? new Date(eventTimeMs).toLocaleTimeString(languageMode === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 50%, ${accentColor}15 0%, #0a0a0f 55%)`,
      }}
      data-testid="slide-event-countdown"
    >
      <style>{`
        @keyframes countdownPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes ringGlow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div
        className="absolute w-[500px] h-[500px] rounded-full border-2 blur-[1px]"
        style={{ borderColor: accentColor, animation: "ringGlow 3s ease-in-out infinite" }}
      />
      <div
        className="absolute w-[650px] h-[650px] rounded-full border blur-[2px]"
        style={{ borderColor: `${accentColor}30`, animation: "ringGlow 3s ease-in-out infinite 0.5s" }}
      />
      <div className="relative z-10 text-center max-w-3xl px-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Timer className="w-7 h-7" style={{ color: accentColor }} />
          <Badge className="text-sm px-3 py-1 border-white/20 bg-white/10 text-white no-default-hover-elevate no-default-active-elevate">
            {languageMode === "es" ? "Próximamente" : "Coming Up"}
          </Badge>
        </div>
        <h1
          className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4"
          style={{ color: accentColor }}
        >
          <BilingualText data={data} field="eventName" languageMode={languageMode} />
        </h1>
        {data.venue && (
          <p className="text-xl text-white/50 mb-2">{data.venue}</p>
        )}
        {timeDisplay && (
          <p className="text-lg text-white/40 mb-10">
            {languageMode === "es" ? "Hoy a las" : "Today at"} {timeDisplay}
          </p>
        )}
        {countdown.label ? (
          <div
            className="text-7xl md:text-8xl font-black tracking-tight"
            style={{ color: accentColor, animation: "countdownPulse 1.5s ease-in-out infinite" }}
          >
            {countdown.label}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6" style={{ animation: "countdownPulse 2s ease-in-out infinite" }}>
            {[
              { value: countdown.hours, unit: languageMode === "es" ? "HRS" : "HRS" },
              { value: countdown.minutes, unit: "MIN" },
              { value: countdown.seconds, unit: "SEC" },
            ].map((block) => (
              <div key={block.unit} className="flex flex-col items-center">
                <span
                  className="text-7xl md:text-8xl font-black tabular-nums"
                  style={{ color: accentColor }}
                >
                  {String(block.value).padStart(2, "0")}
                </span>
                <span className="text-sm text-white/40 uppercase tracking-widest mt-2">{block.unit}</span>
              </div>
            ))}
          </div>
        )}
        {(data.description || data.descriptionEs) && (
          <p className="text-xl text-white/50 leading-relaxed mt-10 max-w-xl mx-auto">
            {getText(data, "description", languageMode)}
          </p>
        )}
      </div>
      <SlideFooter />
    </div>
  );
}

interface TonightEvent {
  title: string;
  startTime: string;
  locationName: string;
  tag?: string;
  isFeatured?: boolean;
}

export function TonightAroundYouSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const events: TonightEvent[] = data.events || [];
  const defaultHeadline = languageMode === "es" ? "Esta Noche Cerca de Ti" : "Tonight Around You";
  const defaultSubline = languageMode === "es" ? "Qué está pasando cerca" : "What's happening nearby";
  const headline = getText(data, "headline", languageMode) || defaultHeadline;
  const subline = getText(data, "subline", languageMode) || defaultSubline;

  return (
    <div
      className="relative w-screen h-screen flex flex-col"
      style={{
        background: "linear-gradient(160deg, #0a0e1a 0%, #121a3a 35%, #1a0a2e 65%, #0a0a14 100%)",
      }}
      data-testid="slide-tonight-around-you"
    >
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-indigo-500/8 blur-3xl -translate-x-1/4 -translate-y-1/4" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-3xl translate-x-1/4 translate-y-1/4" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-3xl" />

      <div className="relative z-10 flex-1 flex flex-col px-16 py-14">
        <div className="flex items-start justify-between gap-8 mb-10 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1.5 h-10 bg-amber-400 rounded-full" />
              <div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                  {headline}
                </h2>
                <p className="text-lg text-white/40 mt-1">{subline}</p>
              </div>
            </div>
          </div>
          <QrBlock
            qrDataUrl={qrDataUrl}
            label={languageMode === "es" ? "Ver todos los eventos" : "See all events"}
          />
        </div>

        {events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <Calendar className="w-16 h-16 text-amber-400/40" />
            <h3 className="text-3xl font-bold text-white/70">
              {languageMode === "es" ? "¿Qué Pasa Esta Noche?" : "What's Going On Tonight?"}
            </h3>
            <p className="text-xl text-white/40 max-w-lg text-center">
              {languageMode === "es"
                ? "Escanea el código para descubrir eventos cerca de ti"
                : "Scan the code to discover events near you"}
            </p>
          </div>
        ) : events.length === 1 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-white/5 p-10">
              {events[0].isFeatured && (
                <Badge className="mb-4 text-xs px-2.5 py-1 bg-amber-500/20 border-amber-500/30 text-amber-400 no-default-hover-elevate no-default-active-elevate">
                  <Star className="w-3 h-3 mr-1" />
                  {languageMode === "es" ? "Destacado" : "Featured"}
                </Badge>
              )}
              <h3 className="text-4xl font-bold text-white mb-4">{events[0].title}</h3>
              <div className="flex flex-wrap items-center gap-6 text-white/60 text-xl">
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  {events[0].startTime}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-400" />
                  {events[0].locationName}
                </span>
              </div>
              {events[0].tag && (
                <Badge className="mt-5 text-sm px-3 py-1 bg-indigo-500/20 border-indigo-500/30 text-indigo-300 no-default-hover-elevate no-default-active-elevate">
                  {events[0].tag}
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center gap-4">
            {events.slice(0, 3).map((event, idx) => (
              <div
                key={idx}
                className="flex items-center gap-6 rounded-xl border border-white/10 bg-white/5 px-8 py-5"
                data-testid={`tonight-event-card-${idx}`}
              >
                <div className="flex items-center gap-2 min-w-[100px]">
                  <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <span className="text-lg font-semibold text-amber-400">{event.startTime}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-2xl font-bold text-white truncate">{event.title}</h4>
                  <span className="text-base text-white/50 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    {event.locationName}
                  </span>
                </div>
                {event.tag && (
                  <Badge className="text-xs px-2.5 py-1 bg-indigo-500/20 border-indigo-500/30 text-indigo-300 flex-shrink-0 no-default-hover-elevate no-default-active-elevate">
                    {event.tag}
                  </Badge>
                )}
                {event.isFeatured && (
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <SlideFooter />
    </div>
  );
}

interface WeekendEvent {
  title: string;
  startTime: string;
  dayLabel: string;
  locationName: string;
  tag?: string;
  isFeatured?: boolean;
}

const DAY_COLORS: Record<string, { bg: string; text: string }> = {
  Fri: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  Sat: { bg: "bg-blue-500/20", text: "text-blue-400" },
  Sun: { bg: "bg-purple-500/20", text: "text-purple-400" },
  Vie: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  Sáb: { bg: "bg-blue-500/20", text: "text-blue-400" },
  Dom: { bg: "bg-purple-500/20", text: "text-purple-400" },
};

export function ThisWeekendSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const events: WeekendEvent[] = data.events || [];
  const defaultHeadline = languageMode === "es" ? "Este Fin de Semana" : "This Weekend";
  const defaultSubline = languageMode === "es" ? "Planes cerca de ti" : "Plans around you";
  const headline = getText(data, "headline", languageMode) || defaultHeadline;
  const subline = getText(data, "subline", languageMode) || defaultSubline;

  return (
    <div
      className="relative w-screen h-screen flex flex-col"
      style={{
        background: "linear-gradient(160deg, #0c1220 0%, #0f1a2e 35%, #0a1628 65%, #080e1a 100%)",
      }}
      data-testid="slide-this-weekend"
    >
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-emerald-500/5 blur-3xl -translate-x-1/3 translate-y-1/3" />

      <div className="relative z-10 flex-1 flex flex-col px-16 py-14">
        <div className="flex items-start justify-between gap-8 mb-10 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-8 h-8 text-blue-400" />
              <div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                  {headline}
                </h2>
                <p className="text-lg text-white/40 mt-1">{subline}</p>
              </div>
            </div>
          </div>
          <QrBlock
            qrDataUrl={qrDataUrl}
            label={languageMode === "es" ? "Explorar eventos" : "Explore events"}
          />
        </div>

        {events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <Calendar className="w-16 h-16 text-blue-400/40" />
            <h3 className="text-3xl font-bold text-white/70">
              {languageMode === "es" ? "Escanea para descubrir eventos locales" : "Scan to discover local events"}
            </h3>
            <p className="text-xl text-white/40 max-w-lg text-center">
              {languageMode === "es"
                ? "Encuentra planes para este fin de semana cerca de ti"
                : "Find weekend plans near you"}
            </p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-4 items-center">
            {events.slice(0, 4).map((event, idx) => {
              const dayColor = DAY_COLORS[event.dayLabel] || { bg: "bg-white/10", text: "text-white/70" };
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-white/5 p-6 flex flex-col gap-3"
                  data-testid={`weekend-event-card-${idx}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className={`text-xs px-2.5 py-1 ${dayColor.bg} border-transparent ${dayColor.text} font-bold uppercase tracking-wider no-default-hover-elevate no-default-active-elevate`}>
                      {event.dayLabel}
                    </Badge>
                    <span className="text-sm text-white/50 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {event.startTime}
                    </span>
                    {event.tag && (
                      <Badge className="text-xs px-2 py-0.5 bg-white/10 border-white/20 text-white/60 no-default-hover-elevate no-default-active-elevate">
                        {event.tag}
                      </Badge>
                    )}
                  </div>
                  <h4 className="text-xl font-bold text-white leading-snug line-clamp-2">{event.title}</h4>
                  <span className="text-sm text-white/40 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    {event.locationName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <SlideFooter />
    </div>
  );
}

export function NonprofitShowcaseSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.imageUrl || data.heroImage;

  return (
    <div
      className="relative w-screen h-screen flex"
      style={{ background: "#0a0a0f" }}
      data-testid="slide-nonprofit-showcase"
    >
      {bgImage && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[50%]"
          style={{ background: `url(${bgImage}) center/cover no-repeat` }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0f] via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/60 to-transparent" />
        </div>
      )}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-rose-500/5 blur-3xl translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-pink-500/5 blur-3xl translate-y-1/3" />
      <div className="relative z-10 ml-auto w-[55%] flex flex-col justify-center px-16">
        <div className="flex items-center gap-3 mb-4">
          <Heart className="w-6 h-6 text-rose-400 fill-rose-400" />
          <Badge className="text-sm px-3 py-1 bg-rose-500/20 border-rose-500/30 text-rose-300 no-default-hover-elevate no-default-active-elevate">
            {languageMode === "es" ? "Socio Comunitario" : "Community Partner"}
          </Badge>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
          <BilingualText data={data} field="name" languageMode={languageMode} />
        </h1>
        {(data.mission || data.missionEs) && (
          <p className="text-xl text-white/60 leading-relaxed mb-6 line-clamp-3 italic">
            &ldquo;{getText(data, "mission", languageMode)}&rdquo;
          </p>
        )}
        {(data.description || data.descriptionEs) && (
          <p className="text-lg text-white/50 leading-relaxed mb-6 line-clamp-2">
            {getText(data, "description", languageMode)}
          </p>
        )}
        {data.impactStat && (
          <div className="flex items-center gap-4 mb-8">
            <div className="px-5 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="text-3xl font-bold text-rose-400">{data.impactStat}</div>
              <div className="text-sm text-white/40 mt-0.5">
                {data.impactLabel || (languageMode === "es" ? "Impacto" : "Impact")}
              </div>
            </div>
          </div>
        )}
        <div className="mt-auto">
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Donar / Apoyar" : "Donate / Support"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function SupportLocalSpotlightSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.imageUrl;
  const accentColor = data.accentColor || "#f59e0b";

  return (
    <div
      className="relative w-screen h-screen flex items-center"
      style={{
        background: `linear-gradient(160deg, ${accentColor}08 0%, #0a0a0f 30%, #0a0a0f 70%, ${accentColor}05 100%)`,
      }}
      data-testid="slide-support-local-spotlight"
    >
      <div
        className="absolute top-0 left-0 w-[450px] h-[450px] rounded-full blur-[120px] opacity-15"
        style={{ background: accentColor }}
      />
      <div
        className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full blur-[100px] opacity-10"
        style={{ background: accentColor }}
      />
      <div className="relative z-10 w-full px-16 flex items-center gap-16">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-6">
            <Store className="w-7 h-7" style={{ color: accentColor }} />
            <Badge
              className="text-sm px-3 py-1 no-default-hover-elevate no-default-active-elevate"
              style={{ background: `${accentColor}20`, borderColor: `${accentColor}40`, color: accentColor }}
            >
              {languageMode === "es" ? "Apoya lo Local" : "Support Local"}
            </Badge>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-4">
            <BilingualText data={data} field="name" languageMode={languageMode} />
          </h1>
          {data.category && (
            <Badge className="mb-5 text-sm px-3 py-1 bg-white/10 border-white/20 text-white/70 no-default-hover-elevate no-default-active-elevate">
              {data.category}
            </Badge>
          )}
          {(data.description || data.descriptionEs) && (
            <p className="text-2xl text-white/70 leading-relaxed max-w-2xl mb-6">
              {getText(data, "description", languageMode)}
            </p>
          )}
          {(data.shopLocalMessage || data.shopLocalMessageEs) && (
            <div
              className="inline-block px-6 py-3 rounded-xl text-lg font-semibold"
              style={{ background: `${accentColor}15`, color: accentColor }}
            >
              {getText(data, "shopLocalMessage", languageMode)}
            </div>
          )}
          {data.yearsInBusiness && (
            <p className="text-base text-white/40 mt-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {languageMode === "es"
                ? `${data.yearsInBusiness} años en la comunidad`
                : `${data.yearsInBusiness} years in the community`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-6">
          {bgImage && (
            <div className="w-36 h-36 rounded-2xl overflow-hidden border-2 border-white/10">
              <img src={bgImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Visitar negocio" : "Visit business"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function YouTubeLiveNowSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.thumbnailUrl;
  const youtubeVideoId = data.youtubeVideoId;

  return (
    <div
      className="relative w-screen h-screen flex items-center"
      style={{ background: "#05050a" }}
      data-testid="slide-youtube-live-now"
    >
      <style>{`
        @keyframes ytLivePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes ytLiveBorder {
          0%, 100% { border-color: rgba(239, 68, 68, 0.6); }
          50% { border-color: rgba(239, 68, 68, 0.15); }
        }
      `}</style>
      <div
        className="absolute inset-4 rounded-2xl border-2"
        style={{ animation: "ytLiveBorder 2s ease-in-out infinite" }}
      />
      {bgImage && !youtubeVideoId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[60%] h-[70%] rounded-2xl opacity-30"
            style={{ background: `url(${bgImage}) center/cover no-repeat` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#05050a] via-[#05050a]/70 to-[#05050a]" />
        </div>
      )}
      {youtubeVideoId && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-[45%] aspect-video rounded-2xl overflow-hidden border border-white/10 z-10">
          <img
            src={`https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center">
              <div className="w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-l-[22px] border-l-white ml-1" />
            </div>
          </div>
        </div>
      )}
      <div className="relative z-10 w-full px-16 flex items-center justify-between gap-12">
        <div className="flex-1 max-w-[45%]">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-red-600/90 px-3 py-1.5 rounded-md">
              <div
                className="w-2.5 h-2.5 rounded-full bg-white"
                style={{ animation: "ytLivePulse 1.5s ease-in-out infinite" }}
              />
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                {languageMode === "es" ? "En Vivo" : "Live Now"}
              </span>
            </div>
            <Radio className="w-5 h-5 text-red-400/60" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            <BilingualText data={data} field="title" languageMode={languageMode} />
          </h1>
          {data.businessName && (
            <p className="text-xl text-white/60 mb-4 flex items-center gap-2">
              <Store className="w-5 h-5" />
              {data.businessName}
            </p>
          )}
          {(data.description || data.descriptionEs) && (
            <p className="text-lg text-white/50 leading-relaxed max-w-xl">
              {getText(data, "description", languageMode)}
            </p>
          )}
        </div>
        {!youtubeVideoId && (
          <div className="flex flex-col items-center gap-4">
            <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Ver en vivo" : "Watch live"} />
          </div>
        )}
      </div>
      {youtubeVideoId && (
        <div className="absolute bottom-12 left-16 z-20">
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Ver en tu teléfono" : "Watch on your phone"} />
        </div>
      )}
      <SlideFooter />
    </div>
  );
}

export function YouTubeVideoSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.thumbnailUrl;
  const youtubeVideoId = data.youtubeVideoId;

  return (
    <div
      className="relative w-screen h-screen flex items-center"
      style={{ background: "#0a0a0f" }}
      data-testid="slide-youtube-video"
    >
      {youtubeVideoId ? (
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-[50%] aspect-video rounded-2xl overflow-hidden border border-white/10 z-10">
          <img
            src={`https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center">
              <div className="w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[18px] border-l-white ml-1" />
            </div>
          </div>
        </div>
      ) : bgImage ? (
        <div className="absolute right-0 top-0 bottom-0 w-[45%]">
          <div
            className="absolute inset-0"
            style={{ background: `url(${bgImage}) center/cover no-repeat` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent" />
        </div>
      ) : null}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-16 max-w-[45%]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-8 bg-red-500 rounded-full" />
          <span className="text-sm uppercase tracking-[0.25em] text-red-400/80 font-semibold">
            {languageMode === "es" ? "Video Destacado" : "Featured Video"}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
          <BilingualText data={data} field="title" languageMode={languageMode} />
        </h1>
        {data.businessName && (
          <p className="text-lg text-white/60 mb-4 flex items-center gap-2">
            <Store className="w-5 h-5" />
            {data.businessName}
          </p>
        )}
        {(data.description || data.descriptionEs) && (
          <p className="text-lg text-white/50 leading-relaxed line-clamp-2">
            {getText(data, "description", languageMode)}
          </p>
        )}
      </div>
      <div className="absolute bottom-12 left-16 z-20">
        <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Ver video completo" : "Watch full video"} />
      </div>
      <SlideFooter />
    </div>
  );
}

export function QuizPromoSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const accent = "#8b5cf6";
  const questionCount = data.questionCount || "10";

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${accent}15 0%, #0a0a0f 30%, #0a0a0f 70%, ${accent}10 100%)`,
      }}
      data-testid="slide-quiz-promo"
    >
      <div
        className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-15"
        style={{ background: accent }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10"
        style={{ background: accent }}
      />
      <div className="relative z-10 w-full px-16 flex items-center gap-16">
        <div className="flex-1 max-w-[55%]">
          <div className="flex items-center gap-3 mb-6">
            <Badge
              className="text-sm px-3 py-1 text-white border-transparent no-default-hover-elevate no-default-active-elevate"
              style={{ backgroundColor: `${accent}cc` }}
            >
              <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
              {languageMode === "es" ? "Cuestionario" : "Quiz"}
            </Badge>
            {data.prizeText && (
              <Badge className="text-sm px-3 py-1 bg-amber-500/20 border-amber-500/30 text-amber-300 no-default-hover-elevate no-default-active-elevate">
                <Trophy className="w-3.5 h-3.5 mr-1.5" />
                {data.prizeText}
              </Badge>
            )}
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            <BilingualText data={data} field="title" languageMode={languageMode} />
          </h1>
          {(data.description || data.descriptionEs) && (
            <p className="text-xl text-white/60 leading-relaxed mb-8 line-clamp-3">
              {getText(data, "description", languageMode)}
            </p>
          )}
          <div className="flex items-center gap-6">
            <div className="px-5 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <div className="text-3xl font-bold text-violet-400">{questionCount}</div>
              <div className="text-sm text-white/40 mt-0.5">
                {languageMode === "es" ? "Preguntas" : "Questions"}
              </div>
            </div>
            {data.timeLimit && (
              <div className="px-5 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <div className="text-3xl font-bold text-violet-400">{data.timeLimit}</div>
                <div className="text-sm text-white/40 mt-0.5">
                  {languageMode === "es" ? "Minutos" : "Minutes"}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="text-center mb-2">
            <p className="text-lg text-white/70 font-medium">
              {languageMode === "es" ? "Escanea para jugar" : "Scan to play"}
            </p>
          </div>
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Jugar ahora" : "Play now"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function GiveawayPromoSlide({ data, qrUrl, assetUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const bgImage = assetUrl || data.imageUrl;
  const accent = "#f59e0b";

  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative w-screen h-screen flex"
      style={{ background: "#0a0a0f" }}
      data-testid="slide-giveaway-promo"
    >
      {bgImage && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[45%]"
          style={{ background: `url(${bgImage}) center/cover no-repeat` }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0f] via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/60 to-transparent" />
        </div>
      )}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10"
        style={{ background: accent }}
      />
      <div className="relative z-10 ml-auto w-[55%] flex flex-col justify-center px-16">
        <div className="flex items-center gap-3 mb-4">
          <Badge
            className="text-sm px-3 py-1 text-white border-transparent no-default-hover-elevate no-default-active-elevate"
            style={{ backgroundColor: `${accent}cc` }}
          >
            <Megaphone className="w-3.5 h-3.5 mr-1.5" />
            {languageMode === "es" ? "Sorteo" : "Giveaway"}
          </Badge>
          {data.sponsorName && (
            <span className="text-sm text-white/50">
              {languageMode === "es" ? "por" : "by"} {data.sponsorName}
            </span>
          )}
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
          <BilingualText data={data} field="title" languageMode={languageMode} />
        </h1>
        {(data.prizeDescription || data.prizeDescriptionEs) && (
          <div className="mb-6 px-5 py-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="text-sm text-amber-400/80 uppercase tracking-wider mb-1">
              {languageMode === "es" ? "Premio" : "Prize"}
            </div>
            <p className="text-2xl font-bold text-amber-300">
              {getText(data, "prizeDescription", languageMode)}
            </p>
          </div>
        )}
        {data.endsAt && (
          <p className="text-lg text-white/50 mb-6 flex items-center gap-2">
            <Timer className="w-5 h-5" />
            {languageMode === "es" ? "Termina:" : "Ends:"} {data.endsAt}
          </p>
        )}
        <div
          className="inline-flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-500"
          style={{
            backgroundColor: pulse ? `${accent}30` : `${accent}15`,
            border: `1px solid ${pulse ? `${accent}60` : `${accent}30`}`,
          }}
        >
          <span className="text-white/80 text-lg font-medium">
            {languageMode === "es" ? "Escanea para participar" : "Scan to enter"}
          </span>
          <ArrowDown className="w-5 h-5 text-amber-400" />
        </div>
        <div className="mt-6">
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Participar" : "Enter now"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

export function JobListingSlide({ data, qrUrl, languageMode }: SlideProps) {
  const qrDataUrl = useQrDataUrl(qrUrl);
  const accent = "#10b981";
  const jobs: Array<{ title: string; employer: string; type: string; pay?: string }> = data.jobs || [];
  const displayJobs = jobs.slice(0, 4);

  return (
    <div
      className="relative w-screen h-screen flex items-center"
      style={{
        background: `linear-gradient(160deg, ${accent}08 0%, #0a0a0f 30%, #0a0a0f 70%, ${accent}05 100%)`,
      }}
      data-testid="slide-job-listing"
    >
      <div
        className="absolute top-0 left-0 w-[450px] h-[450px] rounded-full blur-[120px] opacity-15"
        style={{ background: accent }}
      />
      <div
        className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full blur-[100px] opacity-10"
        style={{ background: accent }}
      />
      <div className="relative z-10 w-full px-16 flex items-center gap-16">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 rounded-full" style={{ background: accent }} />
            <span className="text-sm uppercase tracking-[0.25em] font-semibold" style={{ color: `${accent}cc` }}>
              {languageMode === "es" ? "Empleos Locales" : "Local Jobs"}
            </span>
            {data.hubName && (
              <Badge className="text-sm px-3 py-1 bg-emerald-500/20 border-emerald-500/30 text-emerald-300 no-default-hover-elevate no-default-active-elevate">
                <MapPin className="w-3.5 h-3.5 mr-1.5" />
                {data.hubName}
              </Badge>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-8">
            <BilingualText data={data} field="headline" languageMode={languageMode} />
          </h1>
          <div className="space-y-3">
            {displayJobs.map((job, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex-1">
                  <div className="text-lg font-semibold text-white">{job.title}</div>
                  <div className="text-sm text-white/50 mt-0.5">{job.employer}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="text-xs px-2.5 py-0.5 bg-emerald-500/10 border-emerald-500/20 text-emerald-300 no-default-hover-elevate no-default-active-elevate">
                    {job.type}
                  </Badge>
                  {job.pay && (
                    <span className="text-sm text-white/40">{job.pay}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {data.totalJobs && (
            <p className="text-sm text-white/40 mt-4">
              +{Number(data.totalJobs) - displayJobs.length} {languageMode === "es" ? "más empleos" : "more jobs"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-4">
          <QrBlock qrDataUrl={qrDataUrl} label={languageMode === "es" ? "Ver empleos" : "View jobs"} />
        </div>
      </div>
      <SlideFooter />
    </div>
  );
}

const TEMPLATE_MAP: Record<string, (props: SlideProps) => JSX.Element> = {
  hub_event: HubEventSlide,
  pulse_headline: PulseHeadlineSlide,
  hub_discovery: HubDiscoverySlide,
  neighborhood_spotlight: NeighborhoodSpotlightSlide,
  venue_special: VenueSpecialSlide,
  live_feed: LiveFeedSlide,
  traffic_update: TrafficUpdateSlide,
  weather_current: WeatherCurrentSlide,
  trivia_question: TriviaQuestionSlide,
  sports_scores: SportsScoresSlide,
  social_proof: SocialProofSlide,
  qr_cta: QrCtaSlide,
  sponsor_ad: SponsorAdSlide,
  event_countdown: EventCountdownSlide,
  tonight_around_you: TonightAroundYouSlide,
  this_weekend: ThisWeekendSlide,
  nonprofit_showcase: NonprofitShowcaseSlide,
  support_local_spotlight: SupportLocalSpotlightSlide,
  youtube_live_now: YouTubeLiveNowSlide,
  youtube_video: YouTubeVideoSlide,
  quiz_promo: QuizPromoSlide,
  giveaway_promo: GiveawayPromoSlide,
  job_listing: JobListingSlide,
};

export function SlideRenderer({
  templateKey,
  data,
  qrUrl,
  assetUrl,
  languageMode,
}: {
  templateKey: string;
  data: Record<string, any>;
  qrUrl?: string;
  assetUrl?: string;
  languageMode: "en" | "es" | "bilingual";
}) {
  const Component = TEMPLATE_MAP[templateKey];
  if (!Component) {
    return (
      <div
        className="w-screen h-screen flex items-center justify-center bg-black"
        data-testid="slide-unknown"
      >
        <span className="text-white/40 text-2xl">Unknown template: {templateKey}</span>
        <SlideFooter />
      </div>
    );
  }
  return <Component data={data} qrUrl={qrUrl} assetUrl={assetUrl} languageMode={languageMode} />;
}
