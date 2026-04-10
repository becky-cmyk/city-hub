import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Camera, QrCode, Mic, PenLine, User, UserPlus,
  Receipt, FileText, Navigation, Sparkles, ChevronRight, X, Check,
  Loader2, Globe, Languages, Mail, Phone, Building2, Briefcase, MapPin,
  Link2, MessageSquare, Smartphone, Upload, CircleStop,
  Undo2, Redo2, Trash2, Minus, Plus, Palette, AlertTriangle,
  Megaphone, BookOpen, ImageIcon, Tag, ContactRound
} from "lucide-react";
import type { City } from "@shared/schema";
import faceAppBg from "@assets/General_Backgroun_CLT_colors_1772211996088.png";
import { saveCaptureLocally, type LocalCapture } from "@/lib/capture-store";
import { createRecorderWithFallback } from "@/lib/audio-mime";
import { FieldToolbar, FieldAuthGuard } from "@/components/field-toolbar";
import { useFieldAuth } from "@/hooks/use-field-auth";

type WizardStep = "type_select" | "capture_method" | "doc_subtype" | "camera" | "scanning" | "form" | "confirm";
type CaptureDialog = "voice" | "voice_interview" | "qr" | "handwrite" | "phone_import" | null;
type VoiceState = "pre_record" | "recording" | "review";
type InterviewState = "pre_record" | "recording" | "transcribing" | "review";
type IntakeType = "person" | "document" | "receipt" | "ad_spot" | "stock_photo";
type CaptureMethod = "photo" | "voice" | "voice_interview" | "qr_scan" | "manual" | "handwrite" | "file_upload" | "phone_import";

const CONNECTION_SOURCES = [
  { value: "networking_event", label: "Networking Event" },
  { value: "chamber_event", label: "Chamber Event" },
  { value: "picked_up_card", label: "Picked Up Card" },
  { value: "referral", label: "Referral" },
  { value: "conference", label: "Conference / Trade Show" },
  { value: "social_media", label: "Social Media" },
  { value: "phone_call", label: "Phone Call" },
  { value: "walk_in", label: "Walk-In / Office Visit" },
  { value: "other", label: "Other" },
];

const CAPTURE_ORIGINS = [
  { value: "met_in_person", label: "Met in Person", description: "I actually met this person or rep" },
  { value: "stopped_by_location", label: "Stopped by Location", description: "I visited the location but may not have met anyone" },
  { value: "found_business_card", label: "Found Business Card", description: "I picked up a card, flyer, or printed info" },
  { value: "found_ad", label: "Spotted an Ad", description: "I photographed a competitor's advertisement" },
];

const DRAW_COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#EF4444", label: "Red" },
  { value: "#22C55E", label: "Green" },
  { value: "#A855F7", label: "Purple" },
  { value: "#F97316", label: "Orange" },
];

const AD_MEDIUM_OPTIONS = [
  { value: "billboard", label: "Billboard" },
  { value: "flyer", label: "Flyer" },
  { value: "magazine", label: "Magazine" },
  { value: "vehicle_wrap", label: "Vehicle Wrap" },
  { value: "social_media", label: "Social Media Ad" },
  { value: "window_sign", label: "Window Sign" },
  { value: "poster", label: "Poster" },
  { value: "banner", label: "Banner" },
  { value: "newspaper", label: "Newspaper" },
  { value: "direct_mail", label: "Direct Mail" },
  { value: "other", label: "Other" },
];

type Stroke = { points: { x: number; y: number }[]; color: string; width: number };

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="flex gap-1 w-full max-w-xs mx-auto" data-testid="progress-bar">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-purple-500" : "bg-white/15"}`}
        />
      ))}
    </div>
  );
}

function parseVcardToData(text: string): Record<string, string> {
  const data: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("FN:")) data.name = line.slice(3);
    else if (line.startsWith("EMAIL") && line.includes(":")) data.email = line.split(":").slice(1).join(":");
    else if (line.startsWith("TEL") && line.includes(":")) data.phone = line.split(":").slice(1).join(":");
    else if (line.startsWith("ORG:")) data.company = line.slice(4).replace(/;/g, " ").trim();
    else if (line.startsWith("TITLE:")) data.jobTitle = line.slice(6);
    else if (line.startsWith("URL:")) data.website = line.slice(4);
    else if (line.startsWith("ADR") && line.includes(":")) {
      const parts = line.split(":").slice(1).join(":").split(";").filter(Boolean);
      data.address = parts.join(", ");
    }
  }
  return data;
}

export default function CapturePage() {
  const [, navigate] = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [step, setStep] = useState<WizardStep>("type_select");
  const [intakeType, setIntakeType] = useState<IntakeType>("person");
  const [captureMethod, setCaptureMethod] = useState<CaptureMethod>("manual");
  const [captureDialog, setCaptureDialog] = useState<CaptureDialog>(null);
  const [showSavedDialog, setShowSavedDialog] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [showBackDialog, setShowBackDialog] = useState(false);
  const [capturingBack, setCapturingBack] = useState(false);

  const [voiceState, setVoiceState] = useState<VoiceState>("pre_record");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [interviewState, setInterviewState] = useState<InterviewState>("pre_record");
  const [interviewTime, setInterviewTime] = useState(0);
  const interviewRecorderRef = useRef<MediaRecorder | null>(null);
  const interviewChunksRef = useRef<Blob[]>([]);
  const interviewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [interviewAudioBase64, setInterviewAudioBase64] = useState<string | null>(null);
  const [interviewAudioUrl, setInterviewAudioUrl] = useState<string | null>(null);
  const [interviewTranscript, setInterviewTranscript] = useState<string>("");
  const [interviewSignals, setInterviewSignals] = useState<Record<string, string> | null>(null);

  const [scanningStatus, setScanningStatus] = useState("");

  const [documentCategory, setDocumentCategory] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentImage, setDocumentImage] = useState<string | null>(null);
  const [handwritingImage, setHandwritingImage] = useState<string | null>(null);

  const [qrResult, setQrResult] = useState<string | null>(null);
  const [qrIsVcard, setQrIsVcard] = useState(false);
  const [qrBanner, setQrBanner] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrAnimRef = useRef<number | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);

  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawColor, setDrawColor] = useState("#000000");
  const [drawWidth, setDrawWidth] = useState(3);
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const strokesRef = useRef<Stroke[]>([]);
  const redoStackRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formParentBrand, setFormParentBrand] = useState("");
  const [formPreferredLanguage, setFormPreferredLanguage] = useState("");
  const [formJobTitle, setFormJobTitle] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formConnectionSource, setFormConnectionSource] = useState("");
  const [formCaptureOrigin, setFormCaptureOrigin] = useState("");
  const [formAdMedium, setFormAdMedium] = useState("");
  const [formStockTags, setFormStockTags] = useState("");
  const [stockPhotos, setStockPhotos] = useState<string[]>([]);
  const [adPhotos, setAdPhotos] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState("");
  const [formTranscript, setFormTranscript] = useState("");
  const [selectedHubId, setSelectedHubId] = useState<string>(() => localStorage.getItem("face_hub_id") || "");
  const [aiExtracted, setAiExtracted] = useState<Record<string, any> | null>(null);

  const [savedContact, setSavedContact] = useState<any>(null);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [savedOffline, setSavedOffline] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [voiceSavedBanner, setVoiceSavedBanner] = useState(false);
  const [savedListing, setSavedListing] = useState<{ businessId: string | null; action: string; businessName?: string } | null>(null);
  const [businessDuplicates, setBusinessDuplicates] = useState<{ id: string; name: string; slug: string; websiteUrl: string | null }[]>([]);
  const [outreachStoryLoading, setOutreachStoryLoading] = useState(false);
  const [outreachStoryDone, setOutreachStoryDone] = useState(false);
  const [outreachIntroLoading, setOutreachIntroLoading] = useState(false);
  const [outreachIntroDone, setOutreachIntroDone] = useState(false);
  const [outreachEmailLoading, setOutreachEmailLoading] = useState(false);
  const [outreachEmailDone, setOutreachEmailDone] = useState(false);
  const { toast } = useToast();
  const { fieldUser } = useFieldAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraContainerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const vcfInputRef = useRef<HTMLInputElement | null>(null);

  const { data: citiesData } = useQuery<City[]>({ queryKey: ["/api/admin/cities"] });
  const { data: cardsData } = useQuery<{ data: any[] }>({ queryKey: ["/api/digital-cards"] });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get("shared");
    if (!shareToken) return;

    window.history.replaceState({}, "", "/capture");

    fetch(`/api/share-target/payload/${shareToken}`, { credentials: "include" })
      .then(r => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((payload: any) => {
        if (!payload) return;

        const { title, text, url, files, fileType } = payload;

        if (files?.length && fileType === "image") {
          const firstFile = files[0];
          fetch(`/api/share-target/file/${shareToken}/${firstFile}`, { credentials: "include" })
            .then(r => r.blob())
            .then(blob => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result as string;
                setFrontImage(base64);
                setIntakeType("person");
                setCaptureMethod("photo");
                setStep("scanning");
                setScanningStatus("Analyzing shared image...");
                apiRequest("POST", "/api/capture/analyze-card", {
                  image: base64.split(",")[1] || base64,
                  mimeType: blob.type || "image/jpeg",
                })
                  .then(r => r.json())
                  .then((data: any) => {
                    if (data.name) setFormName(data.name);
                    if (data.email) setFormEmail(data.email);
                    if (data.phone) setFormPhone(data.phone);
                    if (data.company) setFormCompany(data.company);
                    if (data.jobTitle) setFormJobTitle(data.jobTitle);
                    if (data.website) setFormWebsite(data.website);
                    if (data.address) setFormAddress(data.address);
                    setAiExtracted(data);
                    setStep("form");
                  })
                  .catch(() => setStep("form"));
              };
              reader.readAsDataURL(blob);
            })
            .catch(() => setStep("type_select"));
        } else if (files?.length && fileType === "vcard") {
          const firstFile = files[0];
          fetch(`/api/share-target/file/${shareToken}/${firstFile}`, { credentials: "include" })
            .then(r => r.text())
            .then(vcfText => {
              const parsed = parseVcardToData(vcfText);
              if (parsed.name) setFormName(parsed.name);
              if (parsed.email) setFormEmail(parsed.email);
              if (parsed.phone) setFormPhone(parsed.phone);
              if (parsed.company) setFormCompany(parsed.company);
              if (parsed.jobTitle) setFormJobTitle(parsed.jobTitle);
              if (parsed.website) setFormWebsite(parsed.website);
              if (parsed.address) setFormAddress(parsed.address);
              setIntakeType("person");
              setCaptureMethod("manual");
              setStep("form");
            })
            .catch(() => setStep("type_select"));
        } else if (url) {
          setFormWebsite(url);
          if (title) setFormCompany(title);
          setIntakeType("person");
          setCaptureMethod("manual");
          setStep("form");
        } else if (text) {
          setFormNotes(text);
          if (title) setFormCompany(title);
          setIntakeType("person");
          setCaptureMethod("manual");
          setStep("form");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "face_hub_id") {
        setSelectedHubId(e.newValue || "");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopQrCamera = useCallback(() => {
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(t => t.stop());
      qrStreamRef.current = null;
    }
    if (qrAnimRef.current) {
      cancelAnimationFrame(qrAnimRef.current);
      qrAnimRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.error("Camera error:", e);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (intakeType === "person" && cameraContainerRef.current) {
      const container = cameraContainerRef.current;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw === 0 || ch === 0 || vw === 0 || vh === 0) {
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL("image/jpeg", 0.85);
      }

      const guideW = cw * 0.85;
      const guideH = guideW * (2 / 3.5);
      const guideX = (cw - guideW) / 2;
      const guideY = (ch - guideH) / 2;

      const videoAspect = vw / vh;
      const containerAspect = cw / ch;
      let scale: number, offsetX: number, offsetY: number;
      if (videoAspect > containerAspect) {
        scale = vh / ch;
        offsetX = (vw - cw * scale) / 2;
        offsetY = 0;
      } else {
        scale = vw / cw;
        offsetX = 0;
        offsetY = (vh - ch * scale) / 2;
      }

      const sx = offsetX + guideX * scale;
      const sy = offsetY + guideY * scale;
      const sw = guideW * scale;
      const sh = guideH * scale;

      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), 0, 0, Math.round(sw), Math.round(sh));
      return canvas.toDataURL("image/jpeg", 0.85);
    }

    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, [intakeType]);

  const handleShutter = useCallback(() => {
    const img = capturePhoto();
    if (!img) return;

    if (intakeType === "document" || intakeType === "receipt") {
      setDocumentImage(img);
      stopCamera();
      setStep("form");
      return;
    }

    if (intakeType === "ad_spot") {
      setDocumentImage(img);
      setAdPhotos(prev => [...prev, img]);
      stopCamera();
      if (isOnline) {
        setStep("scanning");
        runAdAnalysis(img);
      } else {
        setStep("form");
      }
      return;
    }

    if (intakeType === "stock_photo") {
      setStockPhotos(prev => [...prev, img]);
      if (!frontImage) setFrontImage(img);
      stopCamera();
      setStep("form");
      return;
    }

    if (capturingBack) {
      setBackImage(img);
      setCapturingBack(false);
      setShowBackDialog(false);
      stopCamera();
      if (isOnline) {
        setStep("scanning");
        runCardAnalysis(frontImage!, img);
      } else {
        setStep("form");
      }
    } else {
      setFrontImage(img);
      stopCamera();
      setShowBackDialog(true);
    }
  }, [capturePhoto, capturingBack, stopCamera, isOnline, frontImage, intakeType]);

  const handleNoBackSide = useCallback(() => {
    setShowBackDialog(false);
    if (isOnline && frontImage) {
      setStep("scanning");
      runCardAnalysis(frontImage, null);
    } else {
      setStep("form");
    }
  }, [isOnline, frontImage]);

  const handleCaptureBackSide = useCallback(() => {
    setShowBackDialog(false);
    setCapturingBack(true);
    setStep("camera");
    startCamera();
  }, [startCamera]);

  const stripDataUrl = (dataUrl: string): string => {
    const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
    return match ? match[1] : dataUrl;
  };

  const runCardAnalysis = async (front: string, back: string | null) => {
    setScanningStatus("Reading card...");
    try {
      const res = await apiRequest("POST", "/api/capture/analyze-card", { image: stripDataUrl(front), mimeType: "image/jpeg" });
      const data = await res.json();
      setScanningStatus("Extracting details...");
      setAiExtracted(data);
      if (data.name) setFormName(data.name);
      if (data.email) setFormEmail(data.email);
      if (data.phone) setFormPhone(data.phone);
      if (data.company) setFormCompany(data.company);
      if (data.jobTitle) setFormJobTitle(data.jobTitle);
      if (data.website) setFormWebsite(data.website);
      if (data.address) setFormAddress(data.address);
      await new Promise(r => setTimeout(r, 500));
      setStep("form");
    } catch (e) {
      console.error("Card analysis failed:", e);
      toast({ title: "AI extraction failed", description: "Could not read the card. Please fill in the details manually.", variant: "destructive" });
      setStep("form");
    }
  };

  const runAdAnalysis = async (photo: string) => {
    setScanningStatus("Analyzing advertisement...");
    try {
      const res = await apiRequest("POST", "/api/capture/analyze-ad", { image: stripDataUrl(photo), mimeType: "image/jpeg" });
      const data = await res.json();
      setScanningStatus("Extracting business details...");
      setAiExtracted(data);
      if (data.businessName) setFormCompany(data.businessName);
      if (data.website) setFormWebsite(data.website);
      if (data.phone) setFormPhone(data.phone);
      if (data.email) setFormEmail(data.email);
      if (data.address) setFormAddress(data.address);
      if (data.adMedium) setFormAdMedium(data.adMedium);
      if (data.businessName) setFormName(`Ad Capture — ${data.businessName}`);
      await new Promise(r => setTimeout(r, 500));
      setStep("form");
    } catch (e) {
      console.error("Ad analysis failed:", e);
      toast({ title: "AI extraction failed", description: "Could not read the advertisement. Please fill in the details manually.", variant: "destructive" });
      setStep("form");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { recorder, mimeType: activeMime } = createRecorderWithFallback(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: activeMime });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
        setVoiceState("review");
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setVoiceState("recording");
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (e: unknown) {
      setVoiceState("pre_record");
      setIsRecording(false);
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Microphone access failed", description: msg.includes("NotAllowed") ? "Please allow microphone access in your browser settings." : `Could not start recording: ${msg}`, variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const resetVoiceDialog = () => {
    setVoiceState("pre_record");
    setAudioBase64(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const saveVoiceToInbox = async () => {
    const dateFmt = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const payload: any = {
      name: `Voice Note — ${dateFmt}`,
      captureMethod: "voice",
      intakeType: "person",
      audioRecordingUrl: audioBase64 || undefined,
      capturedWithHubId: selectedHubId || undefined,
    };

    const localRecord = await saveCaptureLocally(payload);

    if (isOnline) {
      try {
        const res = await apiRequest("POST", "/api/capture/save", payload);
        const data = await res.json();
        const { markCaptureSynced } = await import("@/lib/capture-store");
        await markCaptureSynced(localRecord.localId, data.contact?.id);
        setSavedContact(data.contact);
        setDuplicates(data.duplicates || []);
        setSavedListing(data.listing || null);
        setSavedOffline(false);
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      } catch (e) {
        console.error("Server save failed, saved offline:", e);
        setSavedOffline(true);
      }
    } else {
      setSavedOffline(true);
    }

    setCaptureDialog(null);
    resetVoiceDialog();
    setVoiceSavedBanner(true);
    setTimeout(() => setVoiceSavedBanner(false), 5000);
    setSavedCount(1);
    setShowSavedDialog(true);
  };

  const startInterviewRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { recorder, mimeType: activeMime } = createRecorderWithFallback(stream);
      interviewChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) interviewChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(interviewChunksRef.current, { type: activeMime });
        const url = URL.createObjectURL(blob);
        setInterviewAudioUrl(url);
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        setInterviewAudioBase64(base64Data);
        setInterviewState("transcribing");
        try {
          const transcribeRes = await apiRequest("POST", "/api/capture/transcribe", { audio: base64Data });
          const transcribeData = await transcribeRes.json();
          setInterviewTranscript(transcribeData.transcript || "");
          setInterviewSignals(transcribeData.signals || null);
          if (transcribeData.signals) {
            if (transcribeData.signals.name) setFormName(transcribeData.signals.name);
            if (transcribeData.signals.company) setFormCompany(transcribeData.signals.company);
            if (transcribeData.signals.phone) setFormPhone(transcribeData.signals.phone);
            if (transcribeData.signals.email) setFormEmail(transcribeData.signals.email);
            if (transcribeData.signals.website) setFormWebsite(transcribeData.signals.website);
            if (transcribeData.signals.jobTitle) setFormJobTitle(transcribeData.signals.jobTitle);
            if (transcribeData.signals.address) setFormAddress(transcribeData.signals.address);
          }
          setInterviewState("review");
        } catch (transcribeErr) {
          console.error("Transcription failed:", transcribeErr);
          setInterviewTranscript("");
          setInterviewState("review");
          toast({ title: "Transcription unavailable", description: "Recording saved but transcription could not be completed.", variant: "destructive" });
        }
      };
      recorder.start(1000);
      interviewRecorderRef.current = recorder;
      setIsRecording(true);
      setInterviewState("recording");
      setInterviewTime(0);
      interviewTimerRef.current = setInterval(() => setInterviewTime(t => t + 1), 1000);
    } catch (e: unknown) {
      setInterviewState("pre_record");
      setIsRecording(false);
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Microphone access failed", description: msg.includes("NotAllowed") ? "Please allow microphone access in your browser settings." : `Could not start recording: ${msg}`, variant: "destructive" });
    }
  };

  const stopInterviewRecording = () => {
    if (interviewRecorderRef.current && isRecording) {
      interviewRecorderRef.current.stop();
      setIsRecording(false);
      if (interviewTimerRef.current) clearInterval(interviewTimerRef.current);
    }
  };

  const resetInterviewDialog = () => {
    setInterviewState("pre_record");
    setInterviewAudioBase64(null);
    if (interviewAudioUrl) URL.revokeObjectURL(interviewAudioUrl);
    setInterviewAudioUrl(null);
    setInterviewTime(0);
    setInterviewTranscript("");
    setInterviewSignals(null);
  };

  const saveInterviewToInbox = async () => {
    const dateFmt = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const payload: Record<string, unknown> = {
      name: interviewSignals?.name || formName || `Voice Interview — ${dateFmt}`,
      company: interviewSignals?.company || formCompany || undefined,
      phone: interviewSignals?.phone || formPhone || undefined,
      email: interviewSignals?.email || formEmail || undefined,
      website: interviewSignals?.website || formWebsite || undefined,
      jobTitle: interviewSignals?.jobTitle || formJobTitle || undefined,
      address: interviewSignals?.address || formAddress || undefined,
      captureMethod: "voice_interview",
      intakeType: "person",
      audioRecordingUrl: interviewAudioBase64 || undefined,
      audioTranscription: interviewTranscript || undefined,
      capturedWithHubId: selectedHubId || undefined,
      aiExtracted: interviewSignals || undefined,
    };

    const localRecord = await saveCaptureLocally(payload);

    if (isOnline) {
      try {
        const res = await apiRequest("POST", "/api/capture/save", payload);
        const data = await res.json();
        const { markCaptureSynced } = await import("@/lib/capture-store");
        await markCaptureSynced(localRecord.localId, data.contact?.id);
        setSavedContact(data.contact);
        setDuplicates(data.duplicates || []);
        setSavedListing(data.listing || null);
        setSavedOffline(false);
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      } catch (e) {
        console.error("Server save failed, saved offline:", e);
        setSavedOffline(true);
      }
    } else {
      setSavedOffline(true);
    }

    setCaptureDialog(null);
    resetInterviewDialog();
    setVoiceSavedBanner(true);
    setTimeout(() => setVoiceSavedBanner(false), 5000);
    setSavedCount(1);
    setShowSavedDialog(true);
  };

  const startQrScan = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        qrVideoRef.current.play();
      }
      const scanFrame = async () => {
        if (!qrVideoRef.current || !qrCanvasRef.current || !qrStreamRef.current) return;
        const video = qrVideoRef.current;
        const canvas = qrCanvasRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const jsQR = (await import("jsqr")).default;
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              const text = code.data;
              setQrResult(text);
              setQrBanner(true);
              if (text.includes("BEGIN:VCARD")) {
                setQrIsVcard(true);
                const parsed = parseVcardToData(text);
                if (parsed.name) setFormName(parsed.name);
                if (parsed.email) setFormEmail(parsed.email);
                if (parsed.phone) setFormPhone(parsed.phone);
                if (parsed.company) setFormCompany(parsed.company);
                if (parsed.jobTitle) setFormJobTitle(parsed.jobTitle);
                if (parsed.website) setFormWebsite(parsed.website);
                if (parsed.address) setFormAddress(parsed.address);
              } else {
                setQrIsVcard(false);
              }
              stopQrCamera();
              setCaptureDialog(null);
              setCaptureMethod("qr_scan");
              setStep("form");
              return;
            }
          }
        }
        qrAnimRef.current = requestAnimationFrame(scanFrame);
      };
      qrAnimRef.current = requestAnimationFrame(scanFrame);
    } catch (e) {
      console.error("QR camera error:", e);
    }
  }, [stopQrCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (intakeType === "stock_photo") {
      const fileArray = Array.from(files);
      let processed = 0;
      fileArray.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setStockPhotos(prev => [...prev, base64]);
          processed++;
          if (processed === fileArray.length) {
            setStep("form");
          }
        };
        reader.readAsDataURL(file);
      });
    } else if (intakeType === "ad_spot") {
      const fileArray = Array.from(files);
      let processed = 0;
      fileArray.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setAdPhotos(prev => [...prev, base64]);
          processed++;
          if (processed === 1) {
            setDocumentImage(base64);
          }
          if (processed === fileArray.length) {
            setStep("form");
          }
        };
        reader.readAsDataURL(file);
      });
    } else if (intakeType === "person") {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFrontImage(base64);
        setCaptureMethod("file_upload");
        if (isOnline) {
          setStep("scanning");
          runCardAnalysis(base64, null);
        } else {
          setStep("form");
        }
      };
      reader.readAsDataURL(file);
    } else {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setDocumentImage(base64);
        setStep("form");
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = "";
  };

  const handleVcfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const text = reader.result as string;
      const cards = text.match(/BEGIN:VCARD[\s\S]*?END:VCARD/g) || [];
      const parsed = cards.slice(0, 5).map(parseVcardToData);

      if (parsed.length === 0) return;

      if (parsed.length === 1) {
        const c = parsed[0];
        if (c.name) setFormName(c.name);
        if (c.email) setFormEmail(c.email);
        if (c.phone) setFormPhone(c.phone);
        if (c.company) setFormCompany(c.company);
        if (c.jobTitle) setFormJobTitle(c.jobTitle);
        if (c.website) setFormWebsite(c.website);
        if (c.address) setFormAddress(c.address);
        setCaptureMethod("phone_import");
        setCaptureDialog(null);
        setStep("form");
      } else {
        const payloads = parsed.map(c => ({
          name: c.name || "Imported Contact",
          email: c.email || undefined,
          phone: c.phone || undefined,
          company: c.company || undefined,
          jobTitle: c.jobTitle || undefined,
          website: c.website || undefined,
          address: c.address || undefined,
          captureMethod: "phone_import",
          intakeType: "person",
          qrRawText: text,
        }));

        for (const p of payloads) {
          await saveCaptureLocally(p);
        }

        if (isOnline) {
          try {
            await apiRequest("POST", "/api/capture/sync-batch", { captures: payloads });
            queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
            setSavedOffline(false);
          } catch {
            setSavedOffline(true);
          }
        } else {
          setSavedOffline(true);
        }

        setSavedCount(parsed.length);
        setCaptureDialog(null);
        setShowSavedDialog(true);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const redrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    currentStrokeRef.current = { points: [coords], color: drawColor, width: drawWidth };
    setIsDrawingActive(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingActive || !currentStrokeRef.current) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    currentStrokeRef.current.points.push(coords);
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pts = currentStrokeRef.current.points;
    ctx.strokeStyle = currentStrokeRef.current.color;
    ctx.lineWidth = currentStrokeRef.current.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      strokesRef.current.push(currentStrokeRef.current);
      redoStackRef.current = [];
    }
    currentStrokeRef.current = null;
    setIsDrawingActive(false);
  };

  const undoDraw = () => {
    const last = strokesRef.current.pop();
    if (last) redoStackRef.current.push(last);
    redrawCanvas();
  };

  const redoDraw = () => {
    const last = redoStackRef.current.pop();
    if (last) strokesRef.current.push(last);
    redrawCanvas();
  };

  const clearDraw = () => {
    strokesRef.current = [];
    redoStackRef.current = [];
    redrawCanvas();
  };

  const saveDrawing = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setHandwritingImage(dataUrl);
    setCaptureMethod("handwrite");
    setCaptureDialog(null);
    setStep("form");
  };

  const initDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    redoStackRef.current = [];
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (intakeType === "stock_photo" && stockPhotos.length === 0 && !frontImage) {
        throw new Error("At least one photo is required for stock photo captures");
      }

      const buildBasePayload = (adPhotoOverride?: string) => ({
        name: formName,
        email: formEmail || undefined,
        phone: formPhone || undefined,
        company: formCompany || undefined,
        parentBrand: formParentBrand || undefined,
        preferredLanguage: formPreferredLanguage || undefined,
        jobTitle: formJobTitle || undefined,
        website: formWebsite || undefined,
        address: formAddress || undefined,
        notes: formNotes || undefined,
        connectionSource: formConnectionSource || undefined,
        captureOrigin: formCaptureOrigin || undefined,
        captureMethod,
        intakeType,
        documentCategory: documentCategory || undefined,
        documentTitle: documentTitle || undefined,
        capturedWithHubId: selectedHubId || undefined,
        businessCardImageUrl: frontImage || undefined,
        businessCardBackImageUrl: backImage || undefined,
        documentImageUrl: adPhotoOverride || documentImage || undefined,
        handwritingImageUrl: handwritingImage || undefined,
        audioTranscription: formTranscript || undefined,
        audioRecordingUrl: audioBase64 || undefined,
        qrLinkUrl: (qrResult && !qrIsVcard) ? qrResult : undefined,
        qrRawText: qrResult || undefined,
        aiExtracted: aiExtracted ? { ...aiExtracted, adMedium: formAdMedium || aiExtracted.adMedium || undefined } : (formAdMedium ? { adMedium: formAdMedium } : undefined),
        adMedium: formAdMedium || undefined,
        adPhotoUrl: intakeType === "ad_spot" ? (adPhotoOverride || documentImage || undefined) : undefined,
        stockPhotoUrls: intakeType === "stock_photo" ? (stockPhotos.length > 0 ? stockPhotos : undefined) : undefined,
        stockTags: intakeType === "stock_photo" ? (formStockTags || undefined) : undefined,
      });

      if (intakeType === "stock_photo" && stockPhotos.length > 1) {
        let lastData: any = null;
        for (const photo of stockPhotos) {
          const perPhotoPayload: any = buildBasePayload();
          perPhotoPayload.stockPhotoUrls = [photo];
          const localRecord = await saveCaptureLocally(perPhotoPayload);
          if (isOnline) {
            const res = await apiRequest("POST", "/api/capture/save", perPhotoPayload);
            lastData = await res.json();
            const { markCaptureSynced } = await import("@/lib/capture-store");
            await markCaptureSynced(localRecord.localId, lastData.contact?.id);
          }
        }
        if (isOnline && lastData) {
          setSavedContact(lastData.contact);
          setDuplicates(lastData.duplicates || []);
          setSavedListing(lastData.listing || null);
          setBusinessDuplicates(lastData.businessDuplicates || []);
          setSavedOffline(false);
          queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
        } else if (!isOnline) {
          setSavedOffline(true);
        }
        return;
      }

      if (intakeType === "ad_spot" && adPhotos.length > 0) {
        let lastData: any = null;
        for (const photo of adPhotos) {
          const payload: any = buildBasePayload(photo);
          const localRecord = await saveCaptureLocally(payload);
          if (isOnline) {
            const res = await apiRequest("POST", "/api/capture/save", payload);
            lastData = await res.json();
            const { markCaptureSynced } = await import("@/lib/capture-store");
            await markCaptureSynced(localRecord.localId, lastData.contact?.id);
          }
        }
        if (isOnline && lastData) {
          setSavedContact(lastData.contact);
          setDuplicates(lastData.duplicates || []);
          setSavedListing(lastData.listing || null);
          setBusinessDuplicates(lastData.businessDuplicates || []);
          setSavedOffline(false);
          queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
        } else if (!isOnline) {
          setSavedOffline(true);
        }
        return;
      }

      const payload: any = buildBasePayload();
      const localRecord = await saveCaptureLocally(payload);

      if (isOnline) {
        const res = await apiRequest("POST", "/api/capture/save", payload);
        const data = await res.json();
        const { markCaptureSynced } = await import("@/lib/capture-store");
        await markCaptureSynced(localRecord.localId, data.contact?.id);
        setSavedContact(data.contact);
        setDuplicates(data.duplicates || []);
        setSavedListing(data.listing || null);
        setBusinessDuplicates(data.businessDuplicates || []);
        setSavedOffline(false);
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      } else {
        setSavedOffline(true);
      }
    },
    onSuccess: () => {
      setSavedCount(1);
      setShowSavedDialog(true);
    },
    onError: (err: Error) => {
      console.error("Capture save failed:", err);
      setSavedOffline(true);
      setSavedCount(1);
      setShowSavedDialog(true);
    },
  });

  const resetWizard = () => {
    setStep("type_select");
    setIntakeType("person");
    setCaptureMethod("manual");
    setCaptureDialog(null);
    setShowSavedDialog(false);
    setFrontImage(null);
    setBackImage(null);
    setDocumentImage(null);
    setHandwritingImage(null);
    setAudioBase64(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setQrResult(null);
    setQrIsVcard(false);
    setQrBanner(false);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormCompany("");
    setFormParentBrand("");
    setFormJobTitle("");
    setFormWebsite("");
    setFormAddress("");
    setFormConnectionSource("");
    setFormNotes("");
    setFormTranscript("");
    setAiExtracted(null);
    setSavedContact(null);
    setSavedListing(null);
    setDuplicates([]);
    setDocumentCategory("");
    setDocumentTitle("");
    setPhotoExpanded(false);
    setShowBackDialog(false);
    setCapturingBack(false);
    setSavedOffline(false);
    setVoiceState("pre_record");
    setVoiceSavedBanner(false);
    setFormAdMedium("");
    setFormStockTags("");
    setStockPhotos([]);
    setAdPhotos([]);
    setFormCaptureOrigin("");
    setBusinessDuplicates([]);
  };

  const getStepNumber = (): number => {
    switch (step) {
      case "type_select": return 1;
      case "capture_method": case "doc_subtype": return 2;
      case "camera": case "scanning": return 3;
      case "form": return 4;
      case "confirm": return 5;
      default: return 1;
    }
  };

  const goBack = () => {
    stopCamera();
    stopQrCamera();
    if (isRecording) stopRecording();
    switch (step) {
      case "type_select": navigate("/face"); break;
      case "capture_method":
        setStep("type_select");
        break;
      case "doc_subtype": setStep("type_select"); break;
      case "camera":
        if (intakeType === "person") setStep("capture_method");
        else if (intakeType === "document") setStep("doc_subtype");
        else setStep("capture_method");
        break;
      case "form":
        if (intakeType === "person") setStep("capture_method");
        else if (intakeType === "document") setStep("doc_subtype");
        else setStep("capture_method");
        break;
      case "confirm": setStep("form"); break;
      default: break;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      stopQrCamera();
    };
  }, [stopCamera, stopQrCamera]);

  useEffect(() => {
    if (step === "camera") startCamera();
  }, [step, startCamera]);

  useEffect(() => {
    if (captureDialog === "qr") {
      const timer = setTimeout(() => startQrScan(), 300);
      return () => clearTimeout(timer);
    } else {
      stopQrCamera();
    }
  }, [captureDialog, startQrScan, stopQrCamera]);

  useEffect(() => {
    if (captureDialog === "handwrite") {
      const timer = setTimeout(() => initDrawCanvas(), 100);
      return () => clearTimeout(timer);
    }
  }, [captureDialog, initDrawCanvas]);

  useEffect(() => {
    if (captureDialog !== "voice" && captureDialog !== "voice_interview" && isRecording) {
      stopRecording();
      stopInterviewRecording();
    }
  }, [captureDialog]);

  return (
    <FieldAuthGuard>
    <div className="min-h-screen relative flex flex-col items-center">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${faceAppBg})` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[hsl(273,60%,8%)/80%] to-black/85" />

      <div className="w-full relative z-20">
        <FieldToolbar />
      </div>

      <div className="w-full max-w-[440px] flex flex-col relative z-10 min-h-screen">
        {step !== "camera" && (
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <button onClick={goBack} className="text-white/70 hover:text-white" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-white font-bold text-lg flex-1" data-testid="text-step-title">
              {step === "type_select" && "What are you capturing?"}
              {step === "capture_method" && (intakeType === "person" ? "Capture Method" : intakeType === "stock_photo" ? "Capture Photo" : intakeType === "ad_spot" ? "Capture Ad" : "Capture your document")}
              {step === "doc_subtype" && "Document Type"}
              {step === "scanning" && "Processing..."}
              {step === "form" && (intakeType === "receipt" ? "Receipt Details" : intakeType === "document" ? "Document Details" : intakeType === "stock_photo" ? "Photo Details" : intakeType === "ad_spot" ? "Ad Details" : "Contact Details")}
              {step === "confirm" && "Confirm & Save"}
            </h1>
          </div>
        )}
        {step !== "camera" && selectedHubId && citiesData && (
          <div className="px-5 pb-1">
            <div className="flex items-center gap-1.5" data-testid="hub-indicator">
              <Globe className="h-3 w-3 text-purple-400" />
              <span className="text-purple-300 text-xs font-medium">
                {citiesData.find(c => c.id === selectedHubId)?.name || "Platform"}
              </span>
            </div>
          </div>
        )}
        {step !== "camera" && (
          <div className="px-5 pb-3">
            <ProgressBar step={getStepNumber()} totalSteps={5} />
          </div>
        )}

        <div className="flex-1 px-5 pb-8 overflow-y-auto">

          {step === "type_select" && (
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-white/50 text-sm mb-1">Choose what you want to capture</p>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setIntakeType("person"); setStep("capture_method"); }}
                data-testid="tile-person"
              >
                <div className="h-12 w-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Person / Contact</p>
                  <p className="text-white/40 text-xs">Business card, new connection, referral</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setIntakeType("receipt"); setStep("capture_method"); }}
                data-testid="tile-receipt"
              >
                <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Receipt</p>
                  <p className="text-white/40 text-xs">Snap a receipt to attach to a client or event</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setIntakeType("document"); setStep("doc_subtype"); }}
                data-testid="tile-document"
              >
                <div className="h-12 w-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-amber-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Document / ID</p>
                  <p className="text-white/40 text-xs">License, passport, insurance, contracts</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-cyan-500/30 bg-[hsl(195,40%,12%)] hover:bg-[hsl(195,40%,17%)] transition"
                onClick={() => { setIntakeType("stock_photo"); setStep("capture_method"); }}
                data-testid="tile-stock-photo"
              >
                <div className="h-12 w-12 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-cyan-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Location / Stock Photo</p>
                  <p className="text-white/40 text-xs">Snap photos of locations, storefronts, or neighborhoods</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-rose-500/30 bg-[hsl(350,40%,12%)] hover:bg-[hsl(350,40%,17%)] transition"
                onClick={() => { setIntakeType("ad_spot"); setStep("capture_method"); }}
                data-testid="tile-ad-spot"
              >
                <div className="h-12 w-12 rounded-xl bg-rose-500/15 flex items-center justify-center">
                  <Megaphone className="h-6 w-6 text-rose-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Competitor Ad</p>
                  <p className="text-white/40 text-xs">Photograph a billboard, flyer, or ad you spotted</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>


              <div className="flex items-center gap-2 justify-center pt-4">
                <MessageSquare className="h-4 w-4 text-purple-400" />
                <span className="text-purple-300/70 text-xs">Let Charlotte guide you</span>
              </div>
            </div>
          )}

          {step === "capture_method" && intakeType === "person" && (
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-white/50 text-sm mb-1">How would you like to capture?</p>

              {voiceSavedBanner && (
                <div className="border border-emerald-500/30 rounded-xl p-3 bg-emerald-500/10 animate-in fade-in" data-testid="banner-voice-saved">
                  <p className="text-emerald-400 font-semibold text-sm flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> Voice note saved
                  </p>
                  <p className="text-emerald-400/60 text-xs mt-0.5">Sent to your Inbox for review. Charlotte is reviewing it.</p>
                </div>
              )}

              <div>
                <button
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                  onClick={() => setPhotoExpanded(!photoExpanded)}
                  data-testid="tile-photo"
                >
                  <div className="h-12 w-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
                    <Camera className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-semibold">
                      Business Card / Photo <Sparkles className="h-3.5 w-3.5 text-amber-400 inline ml-1" />
                    </p>
                    <p className="text-white/40 text-xs">Reads cards, screenshots & images</p>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-white/30 transition-transform ${photoExpanded ? "rotate-90" : ""}`} />
                </button>
                {photoExpanded && (
                  <div className="ml-4 mt-1 flex flex-col gap-1">
                    <button
                      className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(273,45%,12%)] hover:bg-[hsl(273,45%,18%)] transition"
                      onClick={() => { setCaptureMethod("photo"); setStep("camera"); }}
                      data-testid="tile-take-photo"
                    >
                      <Camera className="h-4 w-4 text-purple-300" />
                      <div className="text-left">
                        <p className="text-white/80 text-sm">Take Photo</p>
                        <p className="text-white/30 text-[11px]">Use camera to scan</p>
                      </div>
                    </button>
                    <button
                      className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(273,45%,12%)] hover:bg-[hsl(273,45%,18%)] transition"
                      onClick={() => { setCaptureMethod("file_upload"); fileInputRef.current?.click(); }}
                      data-testid="tile-upload-photo"
                    >
                      <Upload className="h-4 w-4 text-purple-300" />
                      <div className="text-left">
                        <p className="text-white/80 text-sm">Upload from Photos</p>
                        <p className="text-white/30 text-[11px]">Pick a screenshot or saved image</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => setCaptureDialog("phone_import")}
                data-testid="tile-phone-import"
              >
                <div className="h-12 w-12 rounded-xl bg-pink-500/15 flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-pink-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">From My Phone</p>
                  <p className="text-white/40 text-xs">Import contacts from your phone (up to 5)</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setCaptureMethod("qr_scan"); setCaptureDialog("qr"); }}
                data-testid="tile-qr"
              >
                <div className="h-12 w-12 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <QrCode className="h-6 w-6 text-cyan-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">
                    QR Code / vCard <Sparkles className="h-3.5 w-3.5 text-amber-400 inline ml-1" />
                  </p>
                  <p className="text-white/40 text-xs">Scan QR codes, links & digital cards</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setCaptureMethod("manual"); setStep("form"); }}
                data-testid="tile-manual"
              >
                <div className="h-12 w-12 rounded-xl bg-slate-500/15 flex items-center justify-center">
                  <User className="h-6 w-6 text-slate-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Manual Entry</p>
                  <p className="text-white/40 text-xs">Type in details, notes, or reminders</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setCaptureMethod("voice"); setCaptureDialog("voice"); }}
                data-testid="tile-voice"
              >
                <div className="h-12 w-12 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <Mic className="h-6 w-6 text-red-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">
                    Voice Note <Sparkles className="h-3.5 w-3.5 text-amber-400 inline ml-1" />
                  </p>
                  <p className="text-white/40 text-xs">Speak it — saves directly to inbox</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setCaptureMethod("voice_interview"); setCaptureDialog("voice_interview"); }}
                data-testid="tile-voice-interview"
              >
                <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">
                    Voice Interview <Sparkles className="h-3.5 w-3.5 text-amber-400 inline ml-1" />
                  </p>
                  <p className="text-white/40 text-xs">Record a conversation — auto-transcribe and extract details</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setCaptureMethod("handwrite"); setCaptureDialog("handwrite"); }}
                data-testid="tile-handwrite"
              >
                <div className="h-12 w-12 rounded-xl bg-orange-500/15 flex items-center justify-center">
                  <PenLine className="h-6 w-6 text-orange-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Handwrite</p>
                  <p className="text-white/40 text-xs">Jot with stylus or finger — read later from inbox</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>
            </div>
          )}

          {step === "capture_method" && (intakeType === "receipt" || intakeType === "document") && (
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-white/50 text-sm mb-1">
                {intakeType === "receipt" ? "How would you like to capture this receipt?" : "How would you like to capture this document?"}
              </p>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-amber-500/30 bg-[hsl(40,30%,12%)] hover:bg-[hsl(40,30%,17%)] transition"
                onClick={() => { setCaptureMethod("photo"); setStep("camera"); }}
                data-testid="tile-doc-photo"
              >
                <div className="h-12 w-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-amber-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Take Photo</p>
                  <p className="text-white/40 text-xs">Use camera to capture</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-amber-500/30 bg-[hsl(40,30%,12%)] hover:bg-[hsl(40,30%,17%)] transition"
                onClick={() => { setCaptureMethod("file_upload"); fileInputRef.current?.click(); }}
                data-testid="tile-doc-upload"
              >
                <div className="h-12 w-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Upload File</p>
                  <p className="text-white/40 text-xs">Pick from your photos or files</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-amber-500/30 bg-[hsl(40,30%,12%)] hover:bg-[hsl(40,30%,17%)] transition"
                onClick={() => { setCaptureMethod("manual"); setStep("form"); }}
                data-testid="tile-doc-manual"
              >
                <div className="h-12 w-12 rounded-xl bg-slate-500/15 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Manual Entry</p>
                  <p className="text-white/40 text-xs">Type in details manually</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>
            </div>
          )}

          {step === "capture_method" && (intakeType === "stock_photo" || intakeType === "ad_spot") && (
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-white/50 text-sm mb-1">
                {intakeType === "stock_photo" ? "How would you like to capture this photo?" : "How would you like to capture this ad?"}
              </p>

              <button
                className={`w-full flex items-center gap-4 p-4 rounded-xl border ${intakeType === "stock_photo" ? "border-cyan-500/30 bg-[hsl(195,40%,12%)] hover:bg-[hsl(195,40%,17%)]" : "border-rose-500/30 bg-[hsl(350,40%,12%)] hover:bg-[hsl(350,40%,17%)]"} transition`}
                onClick={() => { setCaptureMethod("photo"); setStep("camera"); }}
                data-testid="tile-take-photo-capture"
              >
                <div className={`h-12 w-12 rounded-xl ${intakeType === "stock_photo" ? "bg-cyan-500/15" : "bg-rose-500/15"} flex items-center justify-center`}>
                  <Camera className={`h-6 w-6 ${intakeType === "stock_photo" ? "text-cyan-400" : "text-rose-400"}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Take Photo</p>
                  <p className="text-white/40 text-xs">Use camera to capture</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className={`w-full flex items-center gap-4 p-4 rounded-xl border ${intakeType === "stock_photo" ? "border-cyan-500/30 bg-[hsl(195,40%,12%)] hover:bg-[hsl(195,40%,17%)]" : "border-rose-500/30 bg-[hsl(350,40%,12%)] hover:bg-[hsl(350,40%,17%)]"} transition`}
                onClick={() => { setCaptureMethod("file_upload"); fileInputRef.current?.click(); }}
                data-testid="tile-upload-photos"
              >
                <div className="h-12 w-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Upload from Photos</p>
                  <p className="text-white/40 text-xs">Pick one or more photos from your gallery</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              {intakeType === "stock_photo" && (
                <button
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-cyan-500/30 bg-[hsl(195,40%,12%)] hover:bg-[hsl(195,40%,17%)] transition"
                  onClick={() => { setCaptureMethod("manual"); setStep("form"); }}
                  data-testid="tile-manual-entry"
                >
                  <div className="h-12 w-12 rounded-xl bg-slate-500/15 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-semibold">Manual Entry</p>
                    <p className="text-white/40 text-xs">Type in details manually</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/30" />
                </button>
              )}
            </div>
          )}

          {step === "doc_subtype" && (
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-white/50 text-sm mb-1">What type of document?</p>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setDocumentCategory("id"); setStep("capture_method"); }}
                data-testid="doc-id"
              >
                <div className="h-12 w-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">ID</p>
                  <p className="text-white/40 text-xs">Driver's license, passport, state ID</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-[hsl(273,50%,15%)] hover:bg-[hsl(273,50%,20%)] transition"
                onClick={() => { setDocumentCategory("document"); setStep("capture_method"); }}
                data-testid="doc-document"
              >
                <div className="h-12 w-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-amber-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold">Document</p>
                  <p className="text-white/40 text-xs">Insurance, contracts, receipts, certificates</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>
            </div>
          )}

          {step === "camera" && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
              <div className="flex items-center justify-between p-4">
                <Badge className="bg-white/10 text-white border-0 text-xs">
                  <Camera className="h-3 w-3 mr-1" />
                  {intakeType === "receipt" ? "Receipt" : intakeType === "document" ? "Document" : intakeType === "ad_spot" ? "Ad Capture" : intakeType === "stock_photo" ? "Location Photo" : "Scan Card"}
                </Badge>
                <button onClick={() => { stopCamera(); goBack(); }} className="text-white/70 hover:text-white text-sm" data-testid="button-cancel-camera">
                  Cancel <X className="h-4 w-4 inline ml-1" />
                </button>
              </div>
              <div className="flex-1 relative" ref={cameraContainerRef}>
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {intakeType === "person" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" data-testid="card-guide-overlay">
                    <div className="relative" style={{ width: "85%", aspectRatio: "3.5 / 2" }}>
                      <div className="absolute inset-0 border-2 border-white/60 rounded-xl" />
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />
                    </div>
                    <p className="text-white/70 text-xs mt-3 bg-black/40 px-3 py-1 rounded-full">Align card within the frame</p>
                  </div>
                )}
              </div>
              <div className="flex justify-center py-6">
                <button
                  className="h-16 w-16 rounded-full bg-white/90 hover:bg-white border-4 border-white/30 flex items-center justify-center transition active:scale-90"
                  onClick={handleShutter}
                  data-testid="button-shutter"
                >
                  <Camera className="h-7 w-7 text-black" />
                </button>
              </div>
            </div>
          )}

          {step === "scanning" && (
            <div className="flex flex-col items-center gap-6 pt-24 bg-[hsl(273,50%,8%)]/90 rounded-xl border border-purple-500/20 p-4">
              <Loader2 className="h-16 w-16 text-purple-400 animate-spin" />
              <p className="text-white/70 text-sm" data-testid="text-scanning-status">{scanningStatus}</p>
              {!isOnline && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-4">
                  <p className="text-amber-400 text-xs text-center">You're offline — AI processing requires connectivity</p>
                </div>
              )}
            </div>
          )}

          {step === "form" && intakeType === "receipt" && (
            <div className="flex flex-col gap-4 pt-2 bg-[hsl(273,50%,8%)]/90 rounded-xl border border-purple-500/20 p-4">
              {documentImage && (
                <img src={documentImage} alt="Receipt" className="h-32 rounded-lg border border-purple-500/20 object-cover" data-testid="img-receipt" />
              )}

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Vendor / Store <span className="text-red-400">*</span>
                </Label>
                <Input value={formCompany} onChange={e => setFormCompany(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="e.g., Office Depot, Staples..." data-testid="input-vendor" />
              </div>

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Description
                </Label>
                <Input value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="e.g., Office supplies, client lunch..." data-testid="input-receipt-desc" />
              </div>

              <div>
                <Label className="text-white/60 text-xs">Notes</Label>
                <Textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="bg-white/5 border-purple-500/20 text-white mt-1"
                  rows={3}
                  placeholder="Any details about this receipt..."
                  data-testid="input-receipt-notes"
                />
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <p className="text-purple-300/80 text-xs">This receipt will land in your inbox. You'll attach it to a contact and add the amount there.</p>
              </div>

              <Button
                className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-base mt-2"
                disabled={!formCompany.trim()}
                onClick={() => {
                  if (!formName.trim()) {
                    setFormName(`Receipt — ${formCompany || new Date().toLocaleDateString()}`);
                  }
                  setStep("confirm");
                }}
                data-testid="button-continue-review"
              >
                Continue to Review <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
          )}

          {step === "form" && intakeType === "stock_photo" && (
            <div className="flex flex-col gap-4 pt-2 bg-[hsl(273,50%,8%)]/90 rounded-xl border border-purple-500/20 p-4">
              {stockPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Camera className="h-3 w-3" /> {stockPhotos.length} Photo{stockPhotos.length > 1 ? "s" : ""} Captured
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {stockPhotos.map((photo, idx) => (
                      <div key={idx} className="relative shrink-0">
                        <img src={photo} alt={`Photo ${idx + 1}`} className="h-32 w-32 rounded-lg border border-purple-500/20 object-cover" data-testid={`img-stock-photo-${idx}`} />
                        <button
                          onClick={() => setStockPhotos(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs"
                          data-testid={`button-remove-stock-photo-${idx}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-purple-500/30 text-white/70"
                    onClick={() => { startCamera(); setStep("camera"); }}
                    data-testid="button-add-more-photos"
                  >
                    <Camera className="h-4 w-4 mr-1" /> Add Another Photo
                  </Button>
                </div>
              )}

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Notes
                </Label>
                <Textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="bg-white/5 border-purple-500/20 text-white mt-1"
                  rows={3}
                  placeholder="Location description, neighborhood, what's in the photo..."
                  data-testid="input-stock-notes"
                />
              </div>

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tags
                </Label>
                <Input
                  value={formStockTags}
                  onChange={e => setFormStockTags(e.target.value)}
                  className="bg-white/5 border-purple-500/20 text-white mt-1"
                  placeholder="storefront, mural, uptown, nightlife..."
                  data-testid="input-stock-tags"
                />
                <p className="text-white/30 text-xs mt-1">Separate with commas</p>
              </div>

              {citiesData && citiesData.length > 0 && (
                <div>
                  <Label className="text-white/60 text-xs flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Hub / City
                  </Label>
                  <Select value={selectedHubId || "__none__"} onValueChange={(v) => setSelectedHubId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="bg-white/5 border-purple-500/20 text-white mt-1" data-testid="select-stock-hub">
                      <SelectValue placeholder="Select hub..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No hub selected</SelectItem>
                      {citiesData.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                <p className="text-cyan-300/80 text-xs">This photo will land in your inbox. From there you can add it to the media library.</p>
              </div>

              <Button
                className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-base mt-2"
                onClick={() => {
                  if (!formName.trim()) {
                    setFormName(`Stock Photo — ${formStockTags.split(",")[0]?.trim() || new Date().toLocaleDateString()}`);
                  }
                  setFormCaptureOrigin("stopped_by_location");
                  setStep("confirm");
                }}
                data-testid="button-stock-continue-review"
              >
                Continue to Review <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
          )}

          {step === "form" && intakeType === "ad_spot" && (
            <div className="flex flex-col gap-4 pt-2 bg-[hsl(273,50%,8%)]/90 rounded-xl border border-purple-500/20 p-4">
              {(adPhotos.length > 0 || documentImage) && (
                <div className="space-y-2">
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Megaphone className="h-3 w-3" /> {adPhotos.length > 1 ? `${adPhotos.length} Ads Captured` : "Captured Advertisement"}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {adPhotos.length > 0 ? adPhotos.map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <img src={photo} alt={`Ad ${idx + 1}`} className="h-24 w-24 rounded-lg border-2 border-rose-400/40 object-cover shadow-lg" data-testid={`img-ad-capture-${idx}`} />
                        <button
                          className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                          onClick={() => {
                            const updated = adPhotos.filter((_, i) => i !== idx);
                            setAdPhotos(updated);
                            setDocumentImage(updated[0] || null);
                          }}
                          data-testid={`button-remove-ad-${idx}`}
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    )) : documentImage && (
                      <img src={documentImage} alt="Ad" className="h-32 rounded-lg border-2 border-rose-400/40 object-cover shadow-lg" data-testid="img-ad-capture" />
                    )}
                  </div>
                </div>
              )}

              {aiExtracted && (
                <div className="border border-rose-500/30 rounded-xl p-3 bg-rose-500/5" data-testid="banner-ad-extracted">
                  <p className="text-white font-semibold text-sm flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-rose-400" /> Ad details extracted
                  </p>
                  <p className="text-white/40 text-xs">We identified the business from this ad.</p>
                </div>
              )}

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Business Name <span className="text-red-400">*</span>
                </Label>
                <Input value={formCompany} onChange={e => setFormCompany(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="Business being advertised" data-testid="input-ad-business" />
              </div>

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Website
                </Label>
                <Input value={formWebsite} onChange={e => setFormWebsite(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="website.com" data-testid="input-ad-website" />
              </div>

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </Label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="555-123-4567" data-testid="input-ad-phone" />
              </div>

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="email@example.com" data-testid="input-ad-email" />
              </div>

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Address
                </Label>
                <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="Business address" data-testid="input-ad-address" />
              </div>

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <Megaphone className="h-3 w-3" /> Ad Medium
                </Label>
                <Select value={formAdMedium || "__none__"} onValueChange={(v) => setFormAdMedium(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-white/5 border-purple-500/20 text-white mt-1" data-testid="select-ad-medium">
                    <SelectValue placeholder="What type of ad?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select ad type...</SelectItem>
                    {AD_MEDIUM_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white/60 text-xs">Notes</Label>
                <Textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="bg-white/5 border-purple-500/20 text-white mt-1"
                  rows={3}
                  placeholder="Where did you see this ad? Any other details..."
                  data-testid="input-ad-notes"
                />
              </div>

              <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                <p className="text-rose-300/80 text-xs">This business will be added to the Opportunity Radar as a scored prospect with an "advertising elsewhere" signal.</p>
              </div>

              <Button
                className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-base mt-2"
                disabled={!formCompany.trim()}
                onClick={() => {
                  if (!formName.trim()) {
                    setFormName(`Ad Capture — ${formCompany || new Date().toLocaleDateString()}`);
                  }
                  setFormCaptureOrigin("found_ad");
                  setStep("confirm");
                }}
                data-testid="button-ad-continue-review"
              >
                Continue to Review <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
          )}

          {step === "form" && intakeType !== "receipt" && intakeType !== "ad_spot" && (
            <div className="flex flex-col gap-4 pt-2 bg-[hsl(273,50%,8%)]/90 rounded-xl border border-purple-500/20 p-4">
              {aiExtracted && (
                <div className="border border-purple-500/30 rounded-xl p-3 bg-[hsl(273,50%,8%)]/90" data-testid="banner-extracted">
                  <p className="text-white font-semibold text-sm">Information extracted</p>
                  <p className="text-white/40 text-xs">We found contact details in the image.</p>
                </div>
              )}

              {qrBanner && (
                <div className="border border-cyan-500/30 rounded-xl p-3 bg-cyan-500/5" data-testid="banner-qr">
                  <p className="text-cyan-400 font-semibold text-sm flex items-center gap-1.5">
                    <QrCode className="h-4 w-4" /> QR code scanned
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">Review the info below.</p>
                </div>
              )}

              {!isOnline && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-amber-400 text-xs">You're offline — details saved locally, AI will process when you reconnect</p>
                </div>
              )}

              {(frontImage || documentImage || handwritingImage) && (
                <div className="space-y-2">
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Camera className="h-3 w-3" />
                    {frontImage ? "Captured Card" : documentImage ? "Captured Document" : "Captured Note"}
                  </p>
                  <div className="flex gap-3">
                    {frontImage && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={frontImage} alt="Front" className="h-32 rounded-lg border-2 border-purple-400/40 object-cover shadow-lg" data-testid="img-front" />
                        <span className="text-[10px] text-white/40">Front</span>
                      </div>
                    )}
                    {backImage && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={backImage} alt="Back" className="h-32 rounded-lg border-2 border-purple-400/40 object-cover shadow-lg" data-testid="img-back" />
                        <span className="text-[10px] text-white/40">Back</span>
                      </div>
                    )}
                    {documentImage && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={documentImage} alt="Document" className="h-32 rounded-lg border-2 border-purple-400/40 object-cover shadow-lg" data-testid="img-document" />
                      </div>
                    )}
                    {handwritingImage && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={handwritingImage} alt="Handwriting" className="h-32 rounded-lg border-2 border-purple-400/40 object-cover shadow-lg" data-testid="img-handwriting" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {citiesData && citiesData.length > 0 && intakeType === "person" && (
                <div>
                  <Label className="text-white/60 text-xs flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Wearing Hat <span className="text-white/30">(optional)</span>
                  </Label>
                  <Select value={selectedHubId || "__none__"} onValueChange={(v) => setSelectedHubId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="bg-white/5 border-purple-500/20 text-white mt-1" data-testid="select-hub">
                      <SelectValue placeholder="No hat selected" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No hat selected</SelectItem>
                      {citiesData.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-white/30 text-[10px] mt-0.5">Track which role you were in when you met this contact</p>
                </div>
              )}

              {intakeType === "person" && (
                <>
                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <User className="h-3 w-3" /> Name
                    </Label>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="Full name" data-testid="input-name" />
                  </div>

                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </Label>
                    <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="email@example.com" data-testid="input-email" />
                  </div>

                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone
                    </Label>
                    <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="555-123-4567" data-testid="input-phone" />
                    <p className="text-white/30 text-[10px] mt-0.5">Fill in at least one field (name, email, phone, or company)</p>
                  </div>

                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Employer
                    </Label>
                    <Input value={formCompany} onChange={e => setFormCompany(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="Company name" data-testid="input-company" />
                  </div>

                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Parent Brand (optional)
                    </Label>
                    <Input value={formParentBrand} onChange={e => setFormParentBrand(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="e.g., American Express, State Farm" data-testid="input-parent-brand" />
                  </div>

                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> Job Title
                    </Label>
                    <Input value={formJobTitle} onChange={e => setFormJobTitle(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="Job title" data-testid="input-job-title" />
                  </div>

                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <Languages className="h-3 w-3" /> Preferred Language
                    </Label>
                    <div className="flex gap-1 mt-1">
                      {[{ value: "", label: "Not set" }, { value: "en", label: "English" }, { value: "es", label: "Español" }].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormPreferredLanguage(opt.value)}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${formPreferredLanguage === opt.value ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 border border-purple-500/20"}`}
                          data-testid={`button-lang-${opt.value || "none"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Website
                    </Label>
                    <Input value={formWebsite} onChange={e => setFormWebsite(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="website.com" data-testid="input-website" />
                  </div>

                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Address
                    </Label>
                    <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="Full address" data-testid="input-address" />
                  </div>

                  {qrResult && !qrIsVcard && (
                    <div>
                      <Label className="text-white/60 text-xs flex items-center gap-1">
                        <Link2 className="h-3 w-3" /> QR Link URL
                      </Label>
                      <a
                        href={qrResult}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-white/5 border border-purple-500/20 rounded-md px-3 py-2 text-cyan-400 hover:text-cyan-300 text-sm mt-1 truncate underline"
                        data-testid="link-qr-url"
                      >
                        {qrResult}
                      </a>
                      <p className="text-white/30 text-[10px] mt-0.5">(e.g., HiHello digital card)</p>
                    </div>
                  )}

                  {formTranscript && (
                    <div>
                      <Label className="text-white/60 text-xs flex items-center gap-1">
                        <Mic className="h-3 w-3" /> Voice Transcript
                      </Label>
                      <div className="bg-white/5 border border-purple-500/20 rounded-md px-3 py-2 text-white/60 text-xs mt-1 max-h-24 overflow-y-auto">{formTranscript}</div>
                    </div>
                  )}
                </>
              )}

              {intakeType === "document" && (
                <>
                  <div>
                    <Label className="text-white/60 text-xs flex items-center gap-1">
                      <User className="h-3 w-3" /> Name
                    </Label>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="Document holder name" data-testid="input-name" />
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs">Document Title</Label>
                    <Input value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} className="bg-white/5 border-purple-500/20 text-white mt-1" placeholder="Document title" data-testid="input-doc-title" />
                  </div>
                  {documentCategory && (
                    <div className="text-white/40 text-xs">Category: {documentCategory === "id" ? "ID" : "Document"}</div>
                  )}
                </>
              )}

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" /> How did you connect?
                </Label>
                <Select value={formConnectionSource} onValueChange={setFormConnectionSource}>
                  <SelectTrigger className="bg-white/5 border-purple-500/20 text-white mt-1" data-testid="select-connection">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONNECTION_SOURCES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white/60 text-xs flex items-center gap-1">
                  <Navigation className="h-3 w-3" /> How did you encounter this business?
                </Label>
                <Select value={formCaptureOrigin} onValueChange={setFormCaptureOrigin}>
                  <SelectTrigger className="bg-white/5 border-purple-500/20 text-white mt-1" data-testid="select-capture-origin">
                    <SelectValue placeholder="Select origin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPTURE_ORIGINS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formCaptureOrigin && (
                  <p className="text-white/40 text-xs mt-1">
                    {CAPTURE_ORIGINS.find(o => o.value === formCaptureOrigin)?.description}
                  </p>
                )}
              </div>

              {intakeType !== "document" && (
                <div>
                  <Label className="text-white/60 text-xs">Notes</Label>
                  <Textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    className="bg-white/5 border-purple-500/20 text-white mt-1"
                    rows={3}
                    placeholder="How did you connect?"
                    data-testid="input-notes"
                  />
                </div>
              )}

              <Button
                className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-base mt-2"
                disabled={intakeType === "person" && !formName.trim() && !formEmail.trim() && !formPhone.trim() && !formCompany.trim()}
                onClick={() => {
                  if (!formName.trim() && intakeType === "document") {
                    setFormName(documentTitle || `Document — ${new Date().toLocaleDateString()}`);
                  }
                  setStep("confirm");
                }}
                data-testid="button-continue-review"
              >
                Continue to Review <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
          )}

          {step === "confirm" && (
            <div className="flex flex-col gap-4 pt-2 bg-[hsl(273,50%,8%)]/90 rounded-xl border border-purple-500/20 p-4">
              <div className="border border-purple-500/30 rounded-xl p-4 bg-[hsl(273,50%,8%)]/90 space-y-3" data-testid="confirm-card">
                <div className="flex items-center gap-2">
                  {intakeType === "receipt" ? (
                    <Receipt className="h-5 w-5 text-emerald-400" />
                  ) : intakeType === "ad_spot" ? (
                    <Megaphone className="h-5 w-5 text-rose-400" />
                  ) : intakeType === "stock_photo" ? (
                    <ImageIcon className="h-5 w-5 text-cyan-400" />
                  ) : (
                    <User className="h-5 w-5 text-purple-400" />
                  )}
                  <span className="text-white font-semibold text-lg">{formName || formCompany}</span>
                </div>
                {intakeType === "receipt" && documentTitle && (
                  <div className="text-white/60 text-sm">{documentTitle}</div>
                )}
                {formEmail && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <Mail className="h-4 w-4 text-white/40" /> {formEmail}
                  </div>
                )}
                {formPhone && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <Phone className="h-4 w-4 text-white/40" /> {formPhone}
                  </div>
                )}
                {formCompany && intakeType !== "receipt" && intakeType !== "ad_spot" && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <Building2 className="h-4 w-4 text-white/40" /> {formCompany}
                  </div>
                )}
                {formAdMedium && intakeType === "ad_spot" && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <Megaphone className="h-4 w-4 text-white/40" /> {AD_MEDIUM_OPTIONS.find(o => o.value === formAdMedium)?.label || formAdMedium}
                  </div>
                )}
                {formStockTags && intakeType === "stock_photo" && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <Tag className="h-4 w-4 text-white/40" /> {formStockTags}
                  </div>
                )}
                {formNotes && intakeType === "stock_photo" && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <MessageSquare className="h-4 w-4 text-white/40" /> {formNotes}
                  </div>
                )}
                {formAddress && (
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <MapPin className="h-4 w-4 text-white/40" /> {formAddress}
                  </div>
                )}

                {intakeType === "stock_photo" && stockPhotos.length > 0 ? (
                  <div>
                    <p className="text-white/40 text-xs mb-1">{stockPhotos.length} Location Photo{stockPhotos.length > 1 ? "s" : ""}</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {stockPhotos.map((photo, idx) => (
                        <img key={idx} src={photo} alt={`Photo ${idx + 1}`} className="h-28 w-28 rounded-lg border border-purple-500/20 object-cover shrink-0" />
                      ))}
                    </div>
                    {stockPhotos.length > 1 && (
                      <p className="text-cyan-300/60 text-xs mt-1">Each photo will be saved as a separate capture entry.</p>
                    )}
                  </div>
                ) : intakeType === "ad_spot" && adPhotos.length > 0 ? (
                  <div>
                    <p className="text-white/40 text-xs mb-1">{adPhotos.length} Ad Photo{adPhotos.length > 1 ? "s" : ""}</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {adPhotos.map((photo, idx) => (
                        <img key={idx} src={photo} alt={`Ad ${idx + 1}`} className="h-28 w-28 rounded-lg border border-purple-500/20 object-cover shrink-0" data-testid={`confirm-ad-photo-${idx}`} />
                      ))}
                    </div>
                    {adPhotos.length > 1 && (
                      <p className="text-rose-300/60 text-xs mt-1">Each photo will be saved as a separate capture entry.</p>
                    )}
                  </div>
                ) : (frontImage || documentImage) ? (
                  <div>
                    <p className="text-white/40 text-xs mb-1">
                      {intakeType === "person" ? "Front" : intakeType === "receipt" ? "Receipt" : intakeType === "ad_spot" ? "Advertisement" : "Document"}
                    </p>
                    <img src={frontImage || documentImage || ""} alt="Captured" className="h-28 rounded-lg border border-purple-500/20 object-cover" />
                  </div>
                ) : null}

                {handwritingImage && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Handwriting</p>
                    <img src={handwritingImage} alt="Handwriting" className="h-28 rounded-lg border border-purple-500/20 object-cover" />
                  </div>
                )}

                {formConnectionSource && (
                  <div className="flex items-center gap-2 text-white/50 text-xs">
                    <FileText className="h-3 w-3" />
                    {CONNECTION_SOURCES.find(s => s.value === formConnectionSource)?.label}
                  </div>
                )}
                {formCaptureOrigin && (
                  <div className="flex items-center gap-2 text-white/50 text-xs" data-testid="text-capture-origin">
                    <Navigation className="h-3 w-3" />
                    {CAPTURE_ORIGINS.find(o => o.value === formCaptureOrigin)?.label}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-purple-500/20 text-white/70 hover:bg-white/5" onClick={() => setStep("form")} data-testid="button-edit-details">
                  Edit Details
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  data-testid="button-save-inbox"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Save to Inbox
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} data-testid="input-file-upload" />
      <input ref={vcfInputRef} type="file" accept=".vcf,text/vcard" className="hidden" onChange={handleVcfUpload} data-testid="input-vcf-upload" />

      <Dialog open={showBackDialog} onOpenChange={setShowBackDialog}>
        <DialogContent className="max-w-sm bg-[hsl(273,50%,10%)] border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Camera className="h-5 w-5 text-purple-400" /> Two-Sided Card?
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/60 text-sm">
            Does this card have information on the back? Flip it over and capture both sides for a complete record.
          </p>
          {frontImage && (
            <div>
              <p className="text-white/40 text-xs mb-1">Front side captured:</p>
              <img src={frontImage} alt="Front" className="w-full rounded-lg border border-purple-500/20" />
            </div>
          )}
          <div className="flex flex-col gap-2 mt-2">
            <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white" onClick={handleCaptureBackSide} data-testid="button-capture-back">
              <Camera className="h-4 w-4 mr-2" /> Capture Back Side
            </Button>
            <Button variant="outline" className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10" onClick={handleNoBackSide} data-testid="button-no-back">
              No Back Side
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={captureDialog === "voice"} onOpenChange={(open) => { if (!open) { if (isRecording) stopRecording(); resetVoiceDialog(); setCaptureDialog(null); } }}>
        <DialogContent className="max-w-sm bg-[hsl(273,50%,10%)] border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Mic className="h-5 w-5 text-purple-400" /> Voice Note
            </DialogTitle>
          </DialogHeader>

          {voiceState === "pre_record" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="h-24 w-24 rounded-full bg-purple-500/15 flex items-center justify-center">
                <Mic className="h-12 w-12 text-purple-400" />
              </div>
              <p className="text-white/60 text-sm text-center">Tap Start to record a voice note for this contact.</p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10" onClick={() => setCaptureDialog(null)} data-testid="button-voice-cancel">
                  Cancel
                </Button>
                <Button className="flex-1 bg-purple-600 hover:bg-purple-500 text-white" onClick={startRecording} data-testid="button-start-recording">
                  <Mic className="h-4 w-4 mr-1" /> Start Recording
                </Button>
              </div>
            </div>
          )}

          {voiceState === "recording" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="h-24 w-24 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                <Mic className="h-12 w-12 text-amber-400" />
              </div>
              <p className="text-amber-400 font-mono text-2xl" data-testid="text-recording-time">
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
              </p>
              <p className="text-white/60 text-sm">Recording... Tap stop when you're done.</p>
              <Button className="w-full border-2 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400" onClick={stopRecording} data-testid="button-stop-recording">
                <CircleStop className="h-4 w-4 mr-1" /> Stop Recording
              </Button>
            </div>
          )}

          {voiceState === "review" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="h-20 w-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Check className="h-10 w-10 text-emerald-400" />
              </div>
              <p className="text-white/60 text-sm text-center">Voice note recorded. Play to review.</p>
              {audioUrl && (
                <audio src={audioUrl} controls className="w-full" data-testid="audio-playback" />
              )}
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10" onClick={() => { resetVoiceDialog(); }} data-testid="button-record-again">
                  Record Again
                </Button>
                <Button className="flex-1 bg-purple-600 hover:bg-purple-500 text-white" onClick={saveVoiceToInbox} disabled={!audioBase64} data-testid="button-voice-save">
                  {!audioBase64 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Save to Inbox
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={captureDialog === "voice_interview"} onOpenChange={(open) => { if (!open) { if (isRecording) stopInterviewRecording(); resetInterviewDialog(); setCaptureDialog(null); } }}>
        <DialogContent className="max-w-sm bg-[hsl(273,50%,10%)] border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="h-5 w-5 text-emerald-400" /> Voice Interview
            </DialogTitle>
          </DialogHeader>

          {interviewState === "pre_record" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="h-24 w-24 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <MessageSquare className="h-12 w-12 text-emerald-400" />
              </div>
              <p className="text-white/60 text-sm text-center">Record a conversation with a business owner or contact. The audio will be transcribed and key details extracted automatically.</p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10" onClick={() => setCaptureDialog(null)} data-testid="button-interview-cancel">
                  Cancel
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={startInterviewRecording} data-testid="button-start-interview">
                  <Mic className="h-4 w-4 mr-1" /> Start Interview
                </Button>
              </div>
            </div>
          )}

          {interviewState === "recording" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
                <Mic className="h-12 w-12 text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-mono text-2xl" data-testid="text-interview-time">
                {Math.floor(interviewTime / 60)}:{(interviewTime % 60).toString().padStart(2, "0")}
              </p>
              <p className="text-white/60 text-sm">Interview in progress...</p>
              <Button className="w-full border-2 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400" onClick={stopInterviewRecording} data-testid="button-stop-interview">
                <CircleStop className="h-4 w-4 mr-1" /> End Interview
              </Button>
            </div>
          )}

          {interviewState === "transcribing" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="h-24 w-24 rounded-full bg-purple-500/15 flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-purple-400 animate-spin" />
              </div>
              <p className="text-white/60 text-sm text-center">Transcribing and extracting details...</p>
            </div>
          )}

          {interviewState === "review" && (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Check className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Interview Complete</p>
                  <p className="text-white/40 text-xs">{Math.floor(interviewTime / 60)}m {interviewTime % 60}s recorded</p>
                </div>
              </div>
              {interviewAudioUrl && (
                <audio src={interviewAudioUrl} controls className="w-full" data-testid="audio-interview-playback" />
              )}
              {interviewTranscript && (
                <div className="rounded-lg bg-white/5 border border-white/10 p-3 max-h-32 overflow-y-auto">
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Transcript</p>
                  <p className="text-white/80 text-xs leading-relaxed" data-testid="text-interview-transcript">{interviewTranscript}</p>
                </div>
              )}
              {interviewSignals && Object.keys(interviewSignals).length > 0 && (
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                  <p className="text-emerald-400 text-[10px] uppercase tracking-wider mb-1.5">Extracted Details</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(interviewSignals).map(([key, val]) => (
                      <Badge key={key} variant="outline" className="border-emerald-500/30 text-emerald-300 text-[10px]">
                        {key}: {val}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10" onClick={resetInterviewDialog} data-testid="button-interview-again">
                  Record Again
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={saveInterviewToInbox} disabled={!interviewAudioBase64} data-testid="button-interview-save">
                  {!interviewAudioBase64 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Save to Inbox
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {captureDialog === "phone_import" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="modal-phone-import">
          <div className="absolute inset-0 bg-black/70" onPointerDown={() => setCaptureDialog(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[hsl(273,50%,10%)] border border-purple-500/30 text-white rounded-xl flex flex-col max-h-[85vh]" onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 pb-2 shrink-0">
              <h3 className="flex items-center gap-2 text-white font-semibold">
                <Smartphone className="h-5 w-5 text-pink-400" /> Import from Phone
              </h3>
              <button onPointerDown={(e) => { e.stopPropagation(); setCaptureDialog(null); }} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10" data-testid="button-phone-close">
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <p className="text-white/60 text-sm mb-3">Export contacts from your phone, then upload the file here. You can import up to 5 contacts at a time.</p>
              <div className="space-y-4">
                <div>
                  <p className="text-white font-semibold text-sm mb-2">iPhone</p>
                  <ol className="text-white/50 text-xs space-y-1 list-decimal list-inside">
                    <li>Open the <strong className="text-white/70">Contacts</strong> app</li>
                    <li>Tap on the contact you want to export</li>
                    <li>Tap <strong className="text-white/70">Share Contact</strong></li>
                    <li>Select up to 5 contacts if sharing multiple</li>
                    <li>Choose <strong className="text-white/70">Save to Files</strong></li>
                    <li>Save it where you can find it (e.g., On My iPhone)</li>
                    <li>Come back here and upload the .vcf file</li>
                  </ol>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-2">Android</p>
                  <ol className="text-white/50 text-xs space-y-1 list-decimal list-inside">
                    <li>Open the <strong className="text-white/70">Contacts</strong> app</li>
                    <li>Long-press to select contacts (up to 5)</li>
                    <li>Tap the <strong className="text-white/70">Share</strong> icon</li>
                    <li>Choose <strong className="text-white/70">Share as .vcf</strong></li>
                    <li>Save the file to your device</li>
                    <li>Come back here and upload the .vcf file</li>
                  </ol>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-4 pt-3 border-t border-purple-500/20 shrink-0">
              <Button className="w-full bg-purple-600 text-white" onClick={() => vcfInputRef.current?.click()} data-testid="button-upload-vcf">
                <Upload className="h-4 w-4 mr-2" /> Upload Contact File (.vcf)
              </Button>
              <Button variant="outline" className="w-full border-purple-500/30 text-purple-300" onPointerDown={() => setCaptureDialog(null)} data-testid="button-phone-cancel">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={captureDialog === "qr"} onOpenChange={(open) => { if (!open) { stopQrCamera(); setCaptureDialog(null); } }}>
        <DialogContent className="max-w-sm bg-[hsl(273,50%,10%)] border-purple-500/30 text-white p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <QrCode className="h-5 w-5 text-cyan-400" /> Scan QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black">
            <video ref={qrVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <canvas ref={qrCanvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-48 w-48 border-2 border-purple-400/50 rounded-2xl" />
            </div>
            <p className="absolute bottom-3 left-0 right-0 text-white/40 text-xs text-center">Point at a QR code</p>
          </div>
          <Button variant="outline" className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10 mt-1" onClick={() => { stopQrCamera(); setCaptureDialog(null); }} data-testid="button-qr-cancel">
            Cancel
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={captureDialog === "handwrite"} onOpenChange={(open) => { if (!open) setCaptureDialog(null); }}>
        <DialogContent className="max-w-md bg-[hsl(273,50%,10%)] border-purple-500/30 text-white p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <PenLine className="h-5 w-5 text-orange-400" /> Handwrite a Note
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/50 text-xs">Use your stylus, pen, or finger to write notes</p>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Palette className="h-3.5 w-3.5 text-white/40" />
              {DRAW_COLORS.map(c => (
                <button
                  key={c.value}
                  className={`h-6 w-6 rounded-full border-2 transition ${drawColor === c.value ? "border-white scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setDrawColor(c.value)}
                  title={c.label}
                  data-testid={`color-${c.label.toLowerCase()}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center" onClick={() => setDrawWidth(w => Math.max(1, w - 1))} data-testid="button-size-minus">
                <Minus className="h-3 w-3 text-white/60" />
              </button>
              <span className="text-white/50 text-xs w-5 text-center">{drawWidth}</span>
              <button className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center" onClick={() => setDrawWidth(w => Math.min(12, w + 1))} data-testid="button-size-plus">
                <Plus className="h-3 w-3 text-white/60" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center" onClick={undoDraw} data-testid="button-undo">
                <Undo2 className="h-3.5 w-3.5 text-white/60" />
              </button>
              <button className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center" onClick={redoDraw} data-testid="button-redo">
                <Redo2 className="h-3.5 w-3.5 text-white/60" />
              </button>
              <button className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center" onClick={clearDraw} data-testid="button-clear-canvas">
                <Trash2 className="h-3.5 w-3.5 text-white/60" />
              </button>
            </div>
          </div>

          <canvas
            ref={drawCanvasRef}
            width={600}
            height={400}
            className="w-full rounded-lg border border-purple-500/20 touch-none bg-white cursor-crosshair"
            style={{ aspectRatio: "3/2" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            data-testid="canvas-draw"
          />
          <p className="text-white/30 text-[10px] text-center">Draw with your finger, stylus, or Apple Pencil. Pressure sensitivity supported where available.</p>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10" onClick={() => setCaptureDialog(null)} data-testid="button-handwrite-cancel">
              Cancel
            </Button>
            <Button className="flex-1 bg-purple-600 hover:bg-purple-500 text-white" onClick={saveDrawing} data-testid="button-save-drawing">
              <PenLine className="h-4 w-4 mr-1" /> Save Drawing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSavedDialog} onOpenChange={(open) => { if (!open) resetWizard(); }}>
        <DialogContent className="max-w-sm bg-[hsl(273,50%,10%)] border-purple-500/30 text-white">
          <div className="flex flex-col gap-4 py-2">
            {duplicates.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3">
                <p className="text-amber-400 font-semibold text-sm">Possible duplicate detected</p>
                <p className="text-amber-400/60 text-xs">{duplicates.length} pending inbox match. Check your inbox before promoting.</p>
              </div>
            )}

            {businessDuplicates.length > 0 && intakeType === "ad_spot" && (
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3" data-testid="business-duplicate-banner">
                <p className="text-rose-400 font-semibold text-sm">Existing business match found</p>
                <p className="text-rose-400/60 text-xs mt-1">
                  {businessDuplicates.map(b => b.name).join(", ")} already {businessDuplicates.length === 1 ? "exists" : "exist"} in the directory. The ad capture has been linked to the existing record.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-emerald-400" />
              </div>
              <h2 className="text-white font-bold text-lg">Saved to Inbox</h2>
            </div>

            <p className="text-white/50 text-sm">
              {savedCount > 1
                ? `${savedCount} contacts have been added to your inbox for review.`
                : "Contact has been added to your inbox for review."}
            </p>

            {savedListing && savedListing.action === "created" && (
              <div className={`${intakeType === "ad_spot" ? "bg-rose-500/10 border-rose-500/25" : "bg-purple-500/10 border-purple-500/25"} border rounded-xl p-3`} data-testid="listing-created-banner">
                <p className={`${intakeType === "ad_spot" ? "text-rose-300" : "text-purple-300"} font-semibold text-sm`}>
                  {intakeType === "ad_spot" ? `Prospect created: ${savedListing.businessName}` : `Listing created for ${savedListing.businessName}`}
                </p>
                <p className={`${intakeType === "ad_spot" ? "text-rose-300/60" : "text-purple-300/60"} text-xs mt-1`}>
                  {intakeType === "ad_spot"
                    ? "Added to Opportunity Radar with \"advertising elsewhere\" signal. Website crawl + enrichment queued."
                    : "Website crawl + enrichment queued. Check your inbox to review and send verification."}
                </p>
              </div>
            )}

            {savedListing && savedListing.action === "linked" && (
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-3" data-testid="listing-linked-banner">
                <p className="text-blue-300 font-semibold text-sm">Linked to {savedListing.businessName}</p>
                <p className="text-blue-300/60 text-xs mt-1">Contact added to existing listing.</p>
              </div>
            )}

            {savedOffline && (
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  <p className="text-amber-400 font-semibold text-sm">Not yet synced to server</p>
                </div>
                <p className="text-amber-400/70 text-xs">This capture is saved on your device only. Return to the Catch app when you have a connection to sync it.</p>
              </div>
            )}

            <hr className="border-white/10" />


            {savedContact?.id && !savedOffline && formEmail && (
              <div className="bg-[hsl(273,50%,12%)] border border-purple-500/25 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-400" />
                  <p className="text-white font-semibold text-sm">Outreach Actions</p>
                </div>
                <p className="text-white/40 text-xs">
                  Generate a community feature story or send a personalized digital card.
                </p>
                <div className="flex gap-2">
                  {outreachStoryDone ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs" data-testid="text-story-done">
                      <Check className="h-3.5 w-3.5" /> Story created
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1 border-purple-500/30 text-purple-300 text-xs h-10"
                      disabled={outreachStoryLoading}
                      onClick={async () => {
                        setOutreachStoryLoading(true);
                        try {
                          await apiRequest("POST", `/api/outreach/captures/${savedContact.id}/generate-story`);
                          setOutreachStoryDone(true);
                          toast({ title: "Story draft created" });
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : "Failed";
                          toast({ title: "Story generation failed", description: msg, variant: "destructive" });
                        } finally {
                          setOutreachStoryLoading(false);
                        }
                      }}
                      data-testid="button-generate-story"
                    >
                      {outreachStoryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <BookOpen className="h-3.5 w-3.5 mr-1" />}
                      Generate Story
                    </Button>
                  )}

                  {outreachIntroDone ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs" data-testid="text-intro-done">
                      <Check className="h-3.5 w-3.5" /> Digital card sent
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1 border-purple-500/30 text-purple-300 text-xs h-10"
                      disabled={outreachIntroLoading}
                      onClick={async () => {
                        setOutreachIntroLoading(true);
                        try {
                          await apiRequest("POST", `/api/outreach/captures/${savedContact.id}/send-intro`);
                          setOutreachIntroDone(true);
                          toast({ title: "Digital card sent" });
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : "Failed";
                          toast({ title: "Failed to send digital card", description: msg, variant: "destructive" });
                        } finally {
                          setOutreachIntroLoading(false);
                        }
                      }}
                      data-testid="button-send-digital-card"
                    >
                      {outreachIntroLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ContactRound className="h-3.5 w-3.5 mr-1" />}
                      Send Digital Card
                    </Button>
                  )}
                </div>
                {savedListing?.businessId && (formEmail || savedContact?.email) && (
                  <div className="pt-1">
                    {outreachEmailDone ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs" data-testid="text-outreach-sent">
                        <Check className="h-3.5 w-3.5" /> Story outreach sent
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-emerald-500/30 text-emerald-300 text-xs h-10"
                        disabled={outreachEmailLoading}
                        onClick={async () => {
                          setOutreachEmailLoading(true);
                          try {
                            const variant = Math.random() < 0.5 ? "A" : "B";
                            await apiRequest("POST", "/api/outreach/send", {
                              businessId: savedListing.businessId,
                              contactId: savedContact?.id,
                              variant,
                              recipientEmail: formEmail || savedContact?.email,
                              recipientName: savedContact?.name || formName,
                              businessName: savedListing.businessName || formCompany || savedContact?.company,
                            });
                            setOutreachEmailDone(true);
                            toast({ title: "Story outreach sent", description: `Version ${variant} sent to ${formEmail || savedContact?.email}` });
                          } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : "Failed";
                            toast({ title: "Failed to send outreach", description: msg, variant: "destructive" });
                          } finally {
                            setOutreachEmailLoading(false);
                          }
                        }}
                        data-testid="button-send-outreach"
                      >
                        {outreachEmailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
                        Send Outreach
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold"
              onClick={resetWizard}
              data-testid="button-capture-more"
            >
              <Camera className="h-5 w-5 mr-2" /> Capture More
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 border-purple-500/25 text-purple-300 hover:bg-purple-500/10 rounded-xl font-semibold"
              onClick={() => navigate("/admin")}
              data-testid="button-go-inbox"
            >
              Go to Inbox
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </FieldAuthGuard>
  );
}
