import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Wifi, WifiOff, ChevronDown, Scan, MapPin, Navigation, Users, CreditCard,
  LayoutDashboard, Square, Play, Save, Clock, Globe, X, Check, ArrowRight,
  ArrowLeft, User, Building2, Camera, QrCode, Mic, Send, Grid3X3, Download,
  Copy, Contact, Share2, Store, Phone, Mail, Monitor, Star, ExternalLink, Loader2
} from "lucide-react";
import QRCodeLib from "qrcode";
import type { CrmContact, City } from "@shared/schema";
import faceAppBg from "@assets/General_Backgroun_CLT_colors_1772211996088.png";
import { mainLogo } from "@/lib/logos";
import { useCaptureSync } from "@/lib/capture-store";
import { FieldToolbar, FieldAuthGuard } from "@/components/field-toolbar";
import { useToast } from "@/hooks/use-toast";

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MIN_SPEED_MPS = 0.9;
const MIN_ACCURACY_M = 100;

type TripState = "idle" | "requesting" | "tracking" | "saving";

interface TripData {
  startTime: number;
  points: { lat: number; lng: number; timestamp: number; speed: number | null }[];
  totalMiles: number;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function FaceApp() {
  const [, navigate] = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [greetingVisible, setGreetingVisible] = useState(true);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) {
      link.setAttribute("href", "/manifest-catch.json");
    }
    return () => {
      if (link) {
        link.setAttribute("href", "/manifest.json");
      }
    };
  }, []);
  const { pendingCount, isSyncing } = useCaptureSync();
  const [selectedHubId, setSelectedHubId] = useState<string>(() => localStorage.getItem("face_hub_id") || "");
  const [hubOpen, setHubOpen] = useState(false);

  const [tripState, setTripState] = useState<TripState>("idle");
  const [tripData, setTripData] = useState<TripData | null>(() => {
    const saved = localStorage.getItem("face_active_trip");
    return saved ? JSON.parse(saved) : null;
  });
  const watchIdRef = useRef<number | null>(null);
  const [tripElapsed, setTripElapsed] = useState(0);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [tripPurpose, setTripPurpose] = useState("");
  const [tripCategory, setTripCategory] = useState("sales");
  const [tripNotes, setTripNotes] = useState("");

  const [referralOpen, setReferralOpen] = useState(false);
  const [referralStep, setReferralStep] = useState(1);
  const [personAId, setPersonAId] = useState("");
  const [personBId, setPersonBId] = useState("");
  const [refMessage, setRefMessage] = useState("");
  const [refPrivateA, setRefPrivateA] = useState("");
  const [refPrivateB, setRefPrivateB] = useState("");

  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [faceShareOpen, setFaceShareOpen] = useState(false);
  const [faceShareCard, setFaceShareCard] = useState<any>(null);
  const [faceQrDataUrl, setFaceQrDataUrl] = useState("");
  const [faceCopied, setFaceCopied] = useState(false);

  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(0.5);
  const [nearbyGps, setNearbyGps] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyGpsLoading, setNearbyGpsLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [bizEditName, setBizEditName] = useState("");
  const [bizEditPhone, setBizEditPhone] = useState("");
  const [bizEditEmail, setBizEditEmail] = useState("");
  const [bizEditWebsite, setBizEditWebsite] = useState("");
  const [bizEditAddress, setBizEditAddress] = useState("");
  const [bizEditDescription, setBizEditDescription] = useState("");
  const [bizOperatorNotes, setBizOperatorNotes] = useState("");
  const { toast } = useToast();

  const { data: meData } = useQuery<{ id: string; email: string; name: string | null; role: string }>({
    queryKey: ["/api/admin/me"],
    retry: false,
  });

  const { data: fieldData } = useQuery<{ name: string; role: string }>({
    queryKey: ["/api/field/auth"],
    retry: false,
  });

  const { data: citiesData } = useQuery<City[]>({
    queryKey: ["/api/admin/cities"],
  });

  const { data: contactsData } = useQuery<{ data: CrmContact[] }>({
    queryKey: ["/api/crm/contacts", { limit: 200 }],
  });

  const { data: cardsData } = useQuery<{ data: any[] }>({
    queryKey: ["/api/digital-cards"],
  });

  const selectedHub = citiesData?.find(c => c.id === selectedHubId);
  const userName = meData?.name || fieldData?.name || meData?.email?.split("@")[0] || "Operator";

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setGreetingVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (tripData && tripState === "idle" && tripData.startTime) {
      setTripState("tracking");
      startWatching();
    }
  }, []);

  useEffect(() => {
    if (tripData) {
      localStorage.setItem("face_active_trip", JSON.stringify(tripData));
    } else {
      localStorage.removeItem("face_active_trip");
    }
  }, [tripData]);

  useEffect(() => {
    if (tripState !== "tracking" || !tripData) return;
    const interval = setInterval(() => {
      setTripElapsed(Math.floor((Date.now() - tripData.startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [tripState, tripData?.startTime]);

  const startWatching = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords;
        if (accuracy > MIN_ACCURACY_M) return;
        if (speed !== null && speed < MIN_SPEED_MPS) return;

        setTripData(prev => {
          if (!prev) return prev;
          const lastPt = prev.points[prev.points.length - 1];
          let addedMiles = 0;
          if (lastPt) {
            addedMiles = haversineDistance(lastPt.lat, lastPt.lng, lat, lng);
            if (addedMiles < 0.01) return prev;
          }
          return {
            ...prev,
            points: [...prev.points, { lat, lng, timestamp: Date.now(), speed }],
            totalMiles: prev.totalMiles + addedMiles,
          };
        });
      },
      (err) => console.warn("Geo error:", err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    watchIdRef.current = id;
  }, []);

  const startTrip = () => {
    setTripState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const data: TripData = {
          startTime: Date.now(),
          points: [{ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now(), speed: null }],
          totalMiles: 0,
        };
        setTripData(data);
        setTripState("tracking");
        startWatching();
      },
      (err) => {
        console.warn("GPS denied:", err.message);
        setTripState("idle");
      },
      { enableHighAccuracy: true }
    );
  };

  const endTrip = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSaveDialogOpen(true);
    setTripState("saving");
  };

  const saveTripMutation = useMutation({
    mutationFn: async () => {
      if (!tripData) throw new Error("No trip data");
      const firstPt = tripData.points[0];
      const lastPt = tripData.points[tripData.points.length - 1];
      return apiRequest("POST", "/api/mileage/trips", {
        miles: tripData.totalMiles.toFixed(2),
        startLocation: firstPt ? `${firstPt.lat.toFixed(4)}, ${firstPt.lng.toFixed(4)}` : null,
        endLocation: lastPt ? `${lastPt.lat.toFixed(4)}, ${lastPt.lng.toFixed(4)}` : null,
        durationMinutes: Math.floor((Date.now() - tripData.startTime) / 60000),
        category: tripCategory,
        notes: [tripPurpose, tripNotes].filter(Boolean).join(" — "),
        waypoints: tripData.points.map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mileage/trips"] });
      setTripData(null);
      setTripState("idle");
      setSaveDialogOpen(false);
      setTripPurpose("");
      setTripCategory("sales");
      setTripNotes("");
    },
  });

  const submitReferralMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/referral-triangles", {
        personAId,
        personBId,
        sharedMessage: refMessage,
        privateMessageToA: refPrivateA,
        privateMessageToB: refPrivateB,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-triangles"] });
      setReferralOpen(false);
      resetReferralForm();
    },
  });

  const resetReferralForm = () => {
    setReferralStep(1);
    setPersonAId("");
    setPersonBId("");
    setRefMessage("");
    setRefPrivateA("");
    setRefPrivateB("");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleVisChange = () => {
      if (document.visibilityState === "visible" && tripState === "tracking") {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        startWatching();
      }
    };
    document.addEventListener("visibilitychange", handleVisChange);
    return () => document.removeEventListener("visibilitychange", handleVisChange);
  }, [tripState, startWatching]);

  useEffect(() => {
    if (faceShareOpen && faceShareCard) {
      const cardUrl = `${window.location.origin}/card/${faceShareCard.slug}`;
      QRCodeLib.toDataURL(cardUrl, { width: 300, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
        .then(setFaceQrDataUrl)
        .catch(() => setFaceQrDataUrl(""));
    }
  }, [faceShareOpen, faceShareCard?.slug]);

  const openFaceShare = (card: any) => {
    setFaceShareCard(card);
    setFaceCopied(false);
    setCardMenuOpen(false);
    setFaceShareOpen(true);
  };

  const faceDownloadQr = () => {
    if (!faceQrDataUrl || !faceShareCard) return;
    const a = document.createElement("a");
    a.href = faceQrDataUrl;
    a.download = `${(faceShareCard.name || "card").replace(/\s+/g, "_")}_qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const faceCopyLink = (card: any) => {
    const url = `${window.location.origin}/card/${card.slug}`;
    navigator.clipboard?.writeText(url);
    setFaceCopied(true);
    setTimeout(() => setFaceCopied(false), 2000);
  };

  const faceDownloadVCard = (card: any) => {
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
    const vcf = lines.join("\r\n");
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(card.name || "card").replace(/\s+/g, "_")}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const contacts = contactsData?.data || [];
  const cards = cardsData?.data || [];
  const personA = contacts.find(c => c.id === personAId);
  const personB = contacts.find(c => c.id === personBId);

  const nearbyQueryKey = nearbyGps
    ? `/api/field/nearby-businesses?lat=${nearbyGps.lat}&lng=${nearbyGps.lng}&radius=${nearbyRadius}&limit=30`
    : null;
  const { data: nearbyData, isLoading: nearbyLoading, isError: nearbyError } = useQuery<{ businesses: any[]; total: number; radiusMiles: number }>({
    queryKey: [nearbyQueryKey],
    enabled: !!nearbyGps && nearbyOpen,
  });

  const openNearby = () => {
    setNearbyOpen(true);
    if (!nearbyGps) {
      setNearbyGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setNearbyGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setNearbyGpsLoading(false);
        },
        (err) => {
          console.warn("GPS error:", err.message);
          setNearbyGpsLoading(false);
          toast({ title: "GPS Unavailable", description: "Could not get your location. Please enable location services.", variant: "destructive" });
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }
  };

  const openBusinessDetail = (biz: any) => {
    setSelectedBusiness(biz);
    setBizEditName(biz.name || "");
    setBizEditPhone(biz.phone || "");
    setBizEditEmail(biz.ownerEmail || biz.email || "");
    setBizEditWebsite(biz.websiteUrl || "");
    setBizEditAddress(biz.address || "");
    setBizEditDescription(biz.description || "");
    setBizOperatorNotes("");
    apiRequest("POST", `/api/field/businesses/${biz.id}/log-visit`, { notes: "Opened detail from Nearby view" }).catch((err: any) => {
      console.warn("[Nearby] Visit log failed:", err);
    });
  };

  const saveBusinessMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBusiness) throw new Error("No business selected");
      return apiRequest("PATCH", `/api/field/businesses/${selectedBusiness.id}`, {
        name: bizEditName,
        phone: bizEditPhone,
        ownerEmail: bizEditEmail,
        websiteUrl: bizEditWebsite,
        address: bizEditAddress,
        description: bizEditDescription,
        operatorNotes: bizOperatorNotes || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Changes Saved", description: "Business information updated." });
      if (nearbyQueryKey) queryClient.invalidateQueries({ queryKey: [nearbyQueryKey] });
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message || "Could not save changes.", variant: "destructive" });
    },
  });

  const activateBusinessMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBusiness) throw new Error("No business selected");
      return apiRequest("POST", `/api/field/businesses/${selectedBusiness.id}/activate`, {
        phone: bizEditPhone,
        email: bizEditEmail,
        role: "owner",
        sendCode: false,
        codeMethod: "email",
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "Presence Activated", description: `${data.businessName || "Business"} has been activated.` });
      if (nearbyQueryKey) queryClient.invalidateQueries({ queryKey: [nearbyQueryKey] });
    },
    onError: (err: any) => {
      toast({ title: "Activation Failed", description: err.message || "Could not activate presence.", variant: "destructive" });
    },
  });

  const getClaimStatusBadge = (status: string | null | undefined) => {
    const s = (status || "").toLowerCase();
    if (s === "pending") return { label: "Pending", cls: "border-blue-400/40 text-blue-300 bg-blue-500/10" };
    if (s === "claimed") return { label: "Claimed", cls: "border-emerald-400/40 text-emerald-300 bg-emerald-500/10" };
    if (s === "verified") return { label: "Verified", cls: "border-purple-400/40 text-purple-300 bg-purple-500/10" };
    return { label: "Unclaimed", cls: "border-amber-400/40 text-amber-300 bg-amber-500/10" };
  };

  return (
    <FieldAuthGuard>
    <div className="min-h-screen relative flex flex-col items-center">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${faceAppBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-[hsl(273,60%,10%)/60%] to-black/70" />

      <div className="w-full relative z-20">
        <FieldToolbar />
      </div>

      <div className="w-full max-w-[400px] flex flex-col items-center gap-3 relative z-10 px-5 pt-4 pb-12">

        <Badge
          variant="outline"
          className={`text-xs px-3 py-1 rounded-full backdrop-blur-sm ${isOnline ? "border-emerald-400/60 text-emerald-300 bg-emerald-500/10" : "border-amber-500/50 text-amber-400 bg-amber-500/10"}`}
          data-testid="badge-online-status"
        >
          <span className={`h-2 w-2 rounded-full mr-1.5 inline-block ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
          {isOnline ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
          {isOnline ? "Online" : "Offline"}
        </Badge>

        <div className="relative mt-1" data-testid="hub-switcher">
          <button
            onClick={() => setHubOpen(!hubOpen)}
            className="flex items-center gap-2 text-sm text-white/90 hover:text-white transition"
          >
            <Globe className="h-4 w-4 text-purple-300" />
            <span className="font-medium">
              {selectedHub ? selectedHub.name : userName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/50" />
          </button>
          {hubOpen && (
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 w-64 bg-[hsl(273,50%,12%)/95%] backdrop-blur-md border border-purple-400/20 rounded-lg shadow-xl z-50 overflow-hidden">
              <button
                onClick={() => { setSelectedHubId(""); setHubOpen(false); localStorage.removeItem("face_hub_id"); }}
                className="w-full px-3 py-2.5 text-sm text-white/80 hover:bg-purple-500/10 text-left flex items-center gap-2"
                data-testid="hub-option-platform"
              >
                <div className="h-2 w-2 rounded-full bg-purple-400" />
                City Metro Hub (Platform)
              </button>
              {(citiesData || []).map(city => (
                <button
                  key={city.id}
                  onClick={() => { setSelectedHubId(city.id); setHubOpen(false); localStorage.setItem("face_hub_id", city.id); }}
                  className="w-full px-3 py-2.5 text-sm text-white/80 hover:bg-purple-500/10 text-left flex items-center gap-2"
                  data-testid={`hub-option-${city.slug}`}
                >
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: city.primaryColor || "#A855F7" }} />
                  {city.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 py-6">
          <img
            src={mainLogo}
            alt={selectedHub ? `${selectedHub.name} Hub` : "CLT Hub"}
            className="h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]"
            data-testid="img-hub-logo"
          />
          <h2 className="text-white font-bold text-lg mt-2 tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]" data-testid="text-brand-name">
            {selectedHub ? `${selectedHub.name} Hub` : "CLT Hub"}
          </h2>
          <p className="text-amber-400 text-xs font-medium tracking-widest drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" data-testid="text-tagline">
            Your City. Your Hub. Your Tools.
          </p>
        </div>

        <button
          className="w-full h-14 flex items-center justify-center gap-3 text-lg font-bold bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-400 text-black rounded-xl shadow-lg shadow-amber-500/30 transition-all active:scale-[0.98]"
          onClick={() => navigate("/capture")}
          data-testid="button-catch-scan"
        >
          <span>Catch / Scan</span>
          <div className="flex items-center gap-1.5 text-black/60">
            <Scan className="h-4 w-4" />
            <Camera className="h-4 w-4" />
            <QrCode className="h-4 w-4" />
            <Mic className="h-4 w-4" />
          </div>
        </button>
        <div className="flex items-center justify-center gap-2 -mt-1">
          <p className="text-amber-400/60 text-xs" data-testid="text-catch-subtitle">
            Contacts, notes, documents & more
          </p>
          {pendingCount > 0 && (
            <Badge className="h-4 px-1.5 text-[9px] bg-red-500 text-white border-0" data-testid="badge-pending-sync">
              {isSyncing ? "Syncing..." : `${pendingCount} pending`}
            </Badge>
          )}
        </div>

        <div className="w-full mt-1 border border-teal-400/30 rounded-xl px-4 py-3 bg-[hsl(173,40%,10%)] shadow-lg shadow-teal-500/15 flex items-center justify-between" data-testid="trip-tracker">
          {tripState === "idle" && (
            <>
              <div className="flex items-center gap-3" role="button" tabIndex={0} onClick={startTrip}>
                <div className="h-8 w-8 rounded-full bg-teal-500/15 flex items-center justify-center">
                  <Navigation className="h-4 w-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-white/90 text-sm font-medium">Track a Trip</p>
                  <p className="text-teal-400/60 text-[11px]">Auto-log mileage with GPS</p>
                </div>
              </div>
              <button onClick={startTrip} className="text-teal-400 hover:text-teal-300 transition" data-testid="button-start-trip">
                <Send className="h-4 w-4" />
              </button>
            </>
          )}
          {tripState === "requesting" && (
            <div className="w-full text-center py-1">
              <p className="text-white/50 text-sm animate-pulse">Requesting GPS access...</p>
            </div>
          )}
          {tripState === "tracking" && tripData && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-teal-400 animate-pulse" />
                  <span className="text-sm font-medium text-white/90">Tracking...</span>
                </div>
                <Badge className="bg-teal-500/20 text-teal-300 text-[10px] border-0">
                  {tripData.totalMiles.toFixed(1)} mi · {formatTime(tripElapsed)}
                </Badge>
              </div>
              <div className="flex gap-2 text-[10px] text-white/40 mb-2">
                <span>{tripData.points.length} GPS points</span>
              </div>
              <button
                className="w-full py-2 text-sm font-medium rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition"
                onClick={endTrip}
                data-testid="button-end-trip"
              >
                <Square className="h-3.5 w-3.5 mr-1.5 inline" />
                End & Save
              </button>
            </div>
          )}
        </div>

        <button
          className="w-full h-12 flex items-center justify-center gap-2 text-sm font-medium text-white border border-cyan-400/30 rounded-xl bg-[hsl(190,40%,12%)] shadow-lg shadow-cyan-500/15 hover:brightness-110 transition active:scale-[0.98]"
          onClick={openNearby}
          data-testid="button-nearby"
        >
          Nearby
          <Store className="h-4 w-4 text-cyan-400" />
        </button>

        <button
          className="w-full h-12 flex items-center justify-center gap-2 text-sm font-medium text-white border border-purple-400/30 rounded-xl bg-[hsl(273,50%,18%)] shadow-lg shadow-purple-500/20 hover:brightness-110 transition active:scale-[0.98]"
          onClick={() => { resetReferralForm(); setReferralOpen(true); }}
          data-testid="button-submit-referral"
        >
          Submit Referral
          <Send className="h-4 w-4 text-amber-400" />
        </button>

        <button
          className="w-full h-12 flex items-center justify-center gap-2 text-sm font-medium text-white border border-purple-300/20 rounded-xl bg-[hsl(273,45%,15%)] shadow-lg shadow-purple-500/15 hover:brightness-110 transition active:scale-[0.98]"
          onClick={() => navigate("/admin")}
          data-testid="button-go-dashboard"
        >
          Dashboard / Home Base
          <Grid3X3 className="h-4 w-4 text-purple-300" />
        </button>

        <button
          className="w-full h-12 flex items-center justify-center gap-2 text-sm font-medium text-white border border-amber-500/25 rounded-xl bg-[hsl(40,30%,12%)] shadow-lg shadow-amber-500/15 hover:brightness-110 transition active:scale-[0.98]"
          onClick={() => setCardMenuOpen(true)}
          data-testid="button-share-card"
        >
          Share My Card
          <CreditCard className="h-4 w-4 text-amber-400" />
          <ChevronDown className="h-3.5 w-3.5 text-white/60" />
        </button>

      </div>

      <div className="fixed bottom-6 right-6 z-20">
        <button
          className="h-14 w-14 rounded-full bg-purple-600 hover:bg-purple-500 shadow-xl shadow-purple-900/50 flex items-center justify-center transition-all hover:scale-105"
          onClick={() => navigate("/admin")}
          data-testid="button-charlotte-fab"
        >
          <Globe className="h-6 w-6 text-white" />
        </button>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={(open) => { if (!open && tripState === "saving") { setSaveDialogOpen(false); setTripState("idle"); setTripData(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Trip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {tripData && (
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="font-bold text-lg">{tripData.totalMiles.toFixed(1)}</p>
                  <p className="text-muted-foreground text-xs">miles</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{Math.floor((Date.now() - tripData.startTime) / 60000)}</p>
                  <p className="text-muted-foreground text-xs">min</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{tripData.points.length}</p>
                  <p className="text-muted-foreground text-xs">points</p>
                </div>
              </div>
            )}
            <div>
              <Label>Purpose</Label>
              <Input value={tripPurpose} onChange={e => setTripPurpose(e.target.value)} placeholder="e.g. Client visit downtown" data-testid="input-trip-purpose" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={tripCategory} onValueChange={setTripCategory}>
                <SelectTrigger data-testid="select-trip-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={tripNotes} onChange={e => setTripNotes(e.target.value)} rows={2} data-testid="input-trip-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSaveDialogOpen(false); setTripState("idle"); setTripData(null); }} data-testid="button-discard-trip">
              Discard
            </Button>
            <Button onClick={() => saveTripMutation.mutate()} disabled={saveTripMutation.isPending} data-testid="button-save-trip">
              <Save className="h-4 w-4 mr-2" />
              {saveTripMutation.isPending ? "Saving..." : "Save Trip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={referralOpen} onOpenChange={setReferralOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Submit Referral — Step {referralStep} of 5
            </DialogTitle>
          </DialogHeader>

          {referralStep === 1 && (
            <div className="space-y-3">
              <Label>Who are you referring? (Person A)</Label>
              <Select value={personAId} onValueChange={setPersonAId}>
                <SelectTrigger data-testid="select-person-a">
                  <SelectValue placeholder="Select a contact..." />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === personBId}>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>{c.name}</span>
                        {c.company && <span className="text-muted-foreground text-xs">({c.company})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contacts.length === 0 && (
                <p className="text-muted-foreground text-xs">No contacts yet. Add some from the admin panel first.</p>
              )}
            </div>
          )}

          {referralStep === 2 && (
            <div className="space-y-3">
              <Label>Who are you referring them to? (Person B)</Label>
              <Select value={personBId} onValueChange={setPersonBId}>
                <SelectTrigger data-testid="select-person-b">
                  <SelectValue placeholder="Select a contact..." />
                </SelectTrigger>
                <SelectContent>
                  {contacts.filter(c => c.id !== personAId).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>{c.name}</span>
                        {c.company && <span className="text-muted-foreground text-xs">({c.company})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {referralStep === 3 && (
            <div className="space-y-3">
              <Label>Private note to {personA?.name || "Person A"} (optional)</Label>
              <Textarea value={refPrivateA} onChange={e => setRefPrivateA(e.target.value)} rows={2} placeholder="A heads-up message..." data-testid="input-ref-private-a" />
              <Label>Private note to {personB?.name || "Person B"} (optional)</Label>
              <Textarea value={refPrivateB} onChange={e => setRefPrivateB(e.target.value)} rows={2} placeholder="A heads-up message..." data-testid="input-ref-private-b" />
            </div>
          )}

          {referralStep === 4 && (
            <div className="space-y-3">
              <Label>Introduction message (shared with both)</Label>
              <Textarea
                value={refMessage}
                onChange={e => setRefMessage(e.target.value)}
                rows={3}
                placeholder={`I'd like to introduce ${personA?.name || "Person A"} and ${personB?.name || "Person B"}...`}
                data-testid="input-ref-message"
              />
            </div>
          )}

          {referralStep === 5 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Review your referral:</p>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">{personA?.name}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">{personB?.name}</span>
                </div>
                {refMessage && <p className="text-muted-foreground text-xs">"{refMessage}"</p>}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {referralStep > 1 && (
              <Button variant="outline" onClick={() => setReferralStep(s => s - 1)} data-testid="button-ref-back">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {referralStep < 5 ? (
              <Button
                onClick={() => setReferralStep(s => s + 1)}
                disabled={(referralStep === 1 && !personAId) || (referralStep === 2 && !personBId)}
                data-testid="button-ref-next"
              >
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => submitReferralMutation.mutate()}
                disabled={submitReferralMutation.isPending}
                data-testid="button-ref-submit"
              >
                <Check className="h-4 w-4 mr-1" />
                {submitReferralMutation.isPending ? "Submitting..." : "Submit Referral"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={cardMenuOpen} onOpenChange={setCardMenuOpen}>
        <DialogContent className="max-w-sm bg-gray-950 border-purple-400/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-400" />
              Share My Card
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {cards.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">No digital cards yet. Create one in the admin panel.</p>
            ) : (
              cards.map(card => (
                <div key={card.id} className="px-3 py-3 rounded-lg bg-white/5 border border-white/10" data-testid={`card-item-${card.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: card.themeColor || "#A855F7" }}>
                      {card.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 text-sm font-medium truncate">{card.name}</p>
                      <p className="text-white/40 text-xs">{card.viewCount || 0} views</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 ml-[52px]">
                    <button
                      className="text-amber-400 hover:text-amber-300 text-xs px-2.5 py-1.5 border border-amber-400/30 rounded-md"
                      onClick={() => {
                        const url = `${window.location.origin}/card/${card.slug}`;
                        navigator.clipboard?.writeText(url);
                        setCardMenuOpen(false);
                      }}
                      data-testid={`button-copy-card-${card.id}`}
                    >
                      <Copy className="h-3 w-3 inline mr-1" />
                      Copy
                    </button>
                    <button
                      className="text-purple-300 hover:text-purple-200 text-xs px-2.5 py-1.5 border border-purple-400/30 rounded-md"
                      onClick={() => { setCardMenuOpen(false); openFaceShare(card); }}
                      data-testid={`button-qr-card-${card.id}`}
                    >
                      <QrCode className="h-3 w-3 inline mr-1" />
                      QR
                    </button>
                    <button
                      className="text-teal-300 hover:text-teal-200 text-xs px-2.5 py-1.5 border border-teal-400/30 rounded-md"
                      onClick={() => { setCardMenuOpen(false); faceDownloadVCard(card); }}
                      data-testid={`button-vcard-card-${card.id}`}
                    >
                      <Contact className="h-3 w-3 inline mr-1" />
                      vCard
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={faceShareOpen} onOpenChange={setFaceShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share Card</DialogTitle>
          </DialogHeader>
          {faceShareCard && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: faceShareCard.themeColor || "#6B21A8" }}>
                  {faceShareCard.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" data-testid="text-face-share-name">{faceShareCard.name}</p>
                  {faceShareCard.title && <p className="text-xs text-muted-foreground">{faceShareCard.title}{faceShareCard.company ? ` at ${faceShareCard.company}` : ""}</p>}
                </div>
              </div>

              <div className="flex justify-center">
                {faceQrDataUrl ? (
                  <img src={faceQrDataUrl} alt="QR Code" className="w-48 h-48 rounded-md" data-testid="img-face-share-qr" />
                ) : (
                  <div className="w-48 h-48 rounded-md bg-muted flex items-center justify-center">
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground">Scan to view digital card</p>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => faceCopyLink(faceShareCard)} data-testid="button-face-share-copy">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {faceCopied ? "Copied" : "Copy Link"}
                </Button>
                <Button variant="outline" size="sm" onClick={faceDownloadQr} disabled={!faceQrDataUrl} data-testid="button-face-share-qr-download">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download QR
                </Button>
              </div>
              <Button className="w-full" size="sm" onClick={() => faceDownloadVCard(faceShareCard)} data-testid="button-face-share-vcard">
                <Contact className="h-3.5 w-3.5 mr-1.5" />
                Download vCard (.vcf)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={nearbyOpen && !selectedBusiness} onOpenChange={(open) => { if (!open) { setNearbyOpen(false); } }}>
        <DialogContent className="max-w-md bg-gray-950 border-purple-400/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Store className="h-5 w-5 text-cyan-400" />
              Nearby Businesses
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap" data-testid="nearby-radius-selector">
            {[0.25, 0.5, 1, 2].map((r) => (
              <button
                key={r}
                onClick={() => setNearbyRadius(r)}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${
                  nearbyRadius === r
                    ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white/70"
                }`}
                data-testid={`button-radius-${r}`}
              >
                {r} mi
              </button>
            ))}
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {(nearbyGpsLoading || (nearbyLoading && nearbyGps)) && (
              <div className="flex flex-col items-center justify-center py-10 gap-3" data-testid="nearby-loading">
                <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
                <p className="text-white/50 text-sm">
                  {nearbyGpsLoading ? "Getting your location..." : "Finding nearby businesses..."}
                </p>
              </div>
            )}

            {!nearbyGpsLoading && nearbyError && (
              <div className="text-center py-10 px-4" data-testid="nearby-error">
                <MapPin className="h-10 w-10 text-red-400/40 mx-auto mb-3" />
                <p className="text-red-300/70 text-sm">
                  Could not load nearby businesses. Please try again.
                </p>
              </div>
            )}

            {!nearbyGpsLoading && !nearbyLoading && !nearbyError && nearbyData && nearbyData.businesses.length === 0 && (
              <div className="text-center py-10 px-4" data-testid="nearby-empty">
                <MapPin className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/50 text-sm">
                  No businesses found nearby. Try a larger radius or scan a business card to add one.
                </p>
              </div>
            )}

            {!nearbyGpsLoading && nearbyData && nearbyData.businesses.map((biz: any) => {
              const claim = getClaimStatusBadge(biz.claimStatus);
              return (
                <button
                  key={biz.id}
                  onClick={() => openBusinessDetail(biz)}
                  className="w-full text-left rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition"
                  data-testid={`nearby-biz-${biz.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 text-sm font-medium truncate">{biz.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {biz.categoryName && (
                          <span className="text-white/40 text-[11px]">{biz.categoryName}</span>
                        )}
                        {biz.address && (
                          <span className="text-white/30 text-[11px] truncate">
                            {biz.address}
                          </span>
                        )}
                      </div>
                    </div>
                    {biz.distance != null && (
                      <Badge className="shrink-0 bg-cyan-500/15 text-cyan-300 border-cyan-400/30 text-[10px]">
                        {Number(biz.distance).toFixed(1)} mi
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge className={`text-[10px] ${claim.cls}`} data-testid={`badge-claim-${biz.id}`}>
                      {claim.label}
                    </Badge>
                    {biz.phone && <Phone className="h-3 w-3 text-white/30" />}
                    {(biz.ownerEmail || biz.email) && <Mail className="h-3 w-3 text-white/30" />}
                    {biz.venueScreenLikely && <Monitor className="h-3 w-3 text-purple-300/50" />}
                    {biz.googleRating && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400/70">
                        <Star className="h-3 w-3" />
                        {biz.googleRating}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBusiness} onOpenChange={(open) => { if (!open) setSelectedBusiness(null); }}>
        <DialogContent className="max-w-md bg-gray-950 border-purple-400/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-400" />
              <span className="truncate">{selectedBusiness?.name || "Business Detail"}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedBusiness && (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <Label className="text-white/60 text-xs">Business Name</Label>
                <Input
                  value={bizEditName}
                  onChange={e => setBizEditName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-biz-name"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Phone</Label>
                <Input
                  value={bizEditPhone}
                  onChange={e => setBizEditPhone(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-biz-phone"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Email</Label>
                <Input
                  value={bizEditEmail}
                  onChange={e => setBizEditEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-biz-email"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Website</Label>
                <Input
                  value={bizEditWebsite}
                  onChange={e => setBizEditWebsite(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-biz-website"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Address</Label>
                <Input
                  value={bizEditAddress}
                  onChange={e => setBizEditAddress(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-biz-address"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Description</Label>
                <Textarea
                  value={bizEditDescription}
                  onChange={e => setBizEditDescription(e.target.value)}
                  rows={2}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-biz-description"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Operator Notes</Label>
                <Textarea
                  value={bizOperatorNotes}
                  onChange={e => setBizOperatorNotes(e.target.value)}
                  rows={2}
                  placeholder="Notes about this visit..."
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-biz-operator-notes"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                  onClick={() => saveBusinessMutation.mutate()}
                  disabled={saveBusinessMutation.isPending}
                  data-testid="button-save-business"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveBusinessMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>

                {(!selectedBusiness.claimStatus || selectedBusiness.claimStatus.toUpperCase() === "UNCLAIMED") && (
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={() => activateBusinessMutation.mutate()}
                    disabled={activateBusinessMutation.isPending}
                    data-testid="button-activate-presence"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {activateBusinessMutation.isPending ? "Activating..." : "Activate Presence"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full border-purple-400/30 text-purple-300"
                  onClick={() => {
                    const citySlug = selectedHub?.slug || "charlotte";
                    window.open(`/${citySlug}/tell-your-story?intent=activate`, "_blank");
                  }}
                  data-testid="button-share-story"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Share Story
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </FieldAuthGuard>
  );
}
