import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Camera, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Search, QrCode } from "lucide-react";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Link } from "wouter";

interface CheckinResult {
  valid: boolean;
  alreadyCheckedIn?: boolean;
  checkinAt?: string;
  buyerName?: string;
  buyerEmail?: string;
  ticketTypeName?: string;
  eventTitle?: string;
  quantity?: number;
  message?: string;
}

export default function EventCheckin({ citySlug, slug, initialToken }: { citySlug: string; slug: string; initialToken?: string }) {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<CheckinResult | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [initialProcessed, setInitialProcessed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: eventData } = useQuery<{ id: string; title: string; host_business_id: string }>({
    queryKey: ["/api/cities", citySlug, "events", slug, "basic"],
    queryFn: async () => {
      const resp = await fetch(`/api/cities/${citySlug}/events/${slug}`);
      if (!resp.ok) throw new Error("Not found");
      return resp.json();
    },
  });

  const eventId = eventData?.id;

  const processCheckin = useCallback(async (token: string) => {
    if (processing || !eventId) return;
    setProcessing(true);
    try {
      const resp = await apiRequest("POST", `/api/events/${eventId}/checkin/${token}`);
      const data = await resp.json();
      setScanResult(data);
      if (data.valid) {
        toast({ title: `Checked in: ${data.buyerName}` });
      }
    } catch (err: any) {
      try {
        const errData = await err.json?.();
        setScanResult(errData || { valid: false, message: "Check-in failed" });
      } catch {
        setScanResult({ valid: false, message: "Check-in failed" });
      }
    } finally {
      setProcessing(false);
    }
  }, [eventId, processing, toast]);

  const startScanning = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        try {
          if ("BarcodeDetector" in window) {
            const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0) {
              const url = barcodes[0].rawValue;
              const tokenMatch = url.match(/checkin\/([a-f0-9-]+)/i);
              if (tokenMatch) {
                processCheckin(tokenMatch[1]);
              }
            }
          }
        } catch {
        }
      }, 1000);
    } catch (err) {
      toast({ title: "Camera access denied", variant: "destructive" });
    }
  }, [processCheckin, toast]);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const [pendingToken, setPendingToken] = useState<string | null>(null);

  useEffect(() => {
    if (initialToken && eventId && !initialProcessed) {
      setInitialProcessed(true);
      setPendingToken(initialToken);
    }
  }, [initialToken, eventId, initialProcessed]);

  const handleManualCheckin = () => {
    if (!manualToken.trim()) return;
    const tokenMatch = manualToken.match(/([a-f0-9-]{36})/i);
    const token = tokenMatch ? tokenMatch[1] : manualToken.trim();
    processCheckin(token);
    setManualToken("");
  };

  return (
    <DarkPageShell maxWidth="narrow">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href={`/${citySlug}/events/${slug}`}>
            <Button variant="ghost" size="sm" className="gap-1 text-purple-300" data-testid="link-back-event">
              <ArrowLeft className="h-4 w-4" /> Back to Event
            </Button>
          </Link>
        </div>

        <div className="text-center space-y-2">
          <QrCode className="h-8 w-8 mx-auto text-purple-400" />
          <h1 className="text-xl font-bold text-white" data-testid="text-checkin-title">
            Check-in Scanner
          </h1>
          {eventData && (
            <p className="text-sm text-muted-foreground" data-testid="text-checkin-event">
              {eventData.title}
            </p>
          )}
        </div>

        {pendingToken && !scanResult && (
          <Card className="p-5 border-purple-500 bg-purple-950/20" data-testid="card-pending-checkin">
            <div className="space-y-3 text-center">
              <QrCode className="h-8 w-8 mx-auto text-purple-400" />
              <p className="font-semibold text-white">Ticket token detected</p>
              <p className="text-xs text-muted-foreground font-mono break-all">{pendingToken}</p>
              <p className="text-sm text-muted-foreground">Sign in as an organizer or admin, then confirm check-in.</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPendingToken(null)}
                  className="flex-1"
                  data-testid="button-dismiss-pending"
                >
                  Dismiss
                </Button>
                <Button
                  onClick={() => { processCheckin(pendingToken); setPendingToken(null); }}
                  disabled={processing}
                  className="flex-1"
                  data-testid="button-confirm-checkin"
                >
                  {processing ? "..." : "Confirm Check-in"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {scanResult && (
          <Card className={`p-5 ${scanResult.valid ? "border-green-500 bg-green-950/20" : scanResult.alreadyCheckedIn ? "border-amber-500 bg-amber-950/20" : "border-red-500 bg-red-950/20"}`} data-testid="card-scan-result">
            <div className="flex items-start gap-3">
              {scanResult.valid ? (
                <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
              ) : scanResult.alreadyCheckedIn ? (
                <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500 shrink-0" />
              )}
              <div className="space-y-1">
                <p className="font-semibold text-white" data-testid="text-result-status">
                  {scanResult.valid ? "Checked In" : scanResult.alreadyCheckedIn ? "Already Checked In" : "Invalid Ticket"}
                </p>
                {scanResult.buyerName && (
                  <p className="text-sm text-white" data-testid="text-result-name">{scanResult.buyerName}</p>
                )}
                {scanResult.ticketTypeName && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-result-ticket-type">
                    {scanResult.ticketTypeName}
                  </Badge>
                )}
                {scanResult.quantity && scanResult.quantity > 1 && (
                  <p className="text-xs text-muted-foreground">Qty: {scanResult.quantity}</p>
                )}
                {scanResult.checkinAt && (
                  <p className="text-xs text-muted-foreground">
                    Checked in at: {new Date(scanResult.checkinAt).toLocaleTimeString()}
                  </p>
                )}
                {scanResult.message && !scanResult.valid && !scanResult.alreadyCheckedIn && (
                  <p className="text-xs text-red-400">{scanResult.message}</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => setScanResult(null)}
              data-testid="button-scan-next"
            >
              Scan Next
            </Button>
          </Card>
        )}

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Camera className="h-4 w-4" /> Camera Scanner
          </h3>
          {scanning ? (
            <div className="space-y-3">
              <div className="relative aspect-square max-h-64 mx-auto rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-2 border-purple-400 rounded-lg pointer-events-none" />
              </div>
              <Button variant="outline" onClick={stopScanning} className="w-full" data-testid="button-stop-scan">
                Stop Scanning
              </Button>
            </div>
          ) : (
            <Button onClick={startScanning} className="w-full" data-testid="button-start-scan">
              <Camera className="h-4 w-4 mr-2" /> Start Camera
            </Button>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Search className="h-4 w-4" /> Manual Entry
          </h3>
          <div className="flex gap-2">
            <Input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste ticket token or URL..."
              onKeyDown={(e) => e.key === "Enter" && handleManualCheckin()}
              data-testid="input-manual-token"
            />
            <Button onClick={handleManualCheckin} disabled={!manualToken.trim() || processing} data-testid="button-manual-checkin">
              {processing ? "..." : "Check In"}
            </Button>
          </div>
        </Card>
      </div>
    </DarkPageShell>
  );
}
