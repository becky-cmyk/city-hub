import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, QrCode, Loader2, Copy, ExternalLink } from "lucide-react";

type PageType = "custom" | "business" | "event" | "tell-your-story" | "directory" | "activate" | "feed";

interface QrResult {
  qrDataUrl: string;
  url: string;
  label: string;
  format: string;
  size: number;
  cityCode: string | null;
}

export default function QrGeneratorPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [pageType, setPageType] = useState<PageType>("custom");
  const [customUrl, setCustomUrl] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [qrSize, setQrSize] = useState(400);
  const [qrResult, setQrResult] = useState<QrResult | null>(null);

  const { data: businessesList } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses"],
    enabled: pageType === "business",
  });

  const { data: eventsList } = useQuery<any[]>({
    queryKey: ["/api/admin/events"],
    enabled: pageType === "event",
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      let body: any = { format: "png", size: qrSize, includeCityCode: true, cityCode: "CLT" };

      if (pageType === "custom") {
        if (!customUrl.trim()) throw new Error("Enter a URL");
        body.url = customUrl.startsWith("http") ? customUrl : `https://${customUrl}`;
      } else if (pageType === "business" || pageType === "event") {
        if (!selectedEntityId) throw new Error("Select an item");
        body.entityType = pageType;
        body.entityId = selectedEntityId;
      } else {
        const origin = window.location.origin;
        const pageMap: Record<string, { url: string; label: string }> = {
          "tell-your-story": { url: `${origin}/charlotte/tell-your-story`, label: "Tell Your Story" },
          "directory": { url: `${origin}/charlotte/directory`, label: "Charlotte Directory" },
          "activate": { url: `${origin}/charlotte/activate`, label: "Activate Your Business" },
          "feed": { url: `${origin}/charlotte`, label: "Charlotte Pulse Feed" },
        };
        const page = pageMap[pageType];
        body.url = page.url;
        body.label = page.label;
      }

      const res = await apiRequest("POST", "/api/qr/generate", body);
      return await res.json();
    },
    onSuccess: (data: QrResult) => {
      setQrResult(data);
      toast({ title: "QR code generated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to generate", description: err.message, variant: "destructive" });
    },
  });

  const handleDownload = () => {
    if (!qrResult) return;
    const link = document.createElement("a");
    link.download = `qr-${pageType}-${Date.now()}.png`;
    link.href = qrResult.qrDataUrl;
    link.click();
  };

  const handleCopyUrl = () => {
    if (!qrResult) return;
    navigator.clipboard.writeText(qrResult.url);
    toast({ title: "URL copied" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-qr-generator">
          <QrCode className="h-6 w-6" />
          QR Code Generator
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Generate branded QR codes for any page to use in marketing materials, signs, and outreach.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Page Type</Label>
            <Select value={pageType} onValueChange={(v) => { setPageType(v as PageType); setSelectedEntityId(""); setQrResult(null); }}>
              <SelectTrigger data-testid="select-page-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom URL</SelectItem>
                <SelectItem value="business">Business Listing</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="tell-your-story">Tell Your Story</SelectItem>
                <SelectItem value="directory">Directory</SelectItem>
                <SelectItem value="activate">Activate Your Business</SelectItem>
                <SelectItem value="feed">Pulse Feed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pageType === "custom" && (
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://..."
                data-testid="input-custom-url"
              />
            </div>
          )}

          {pageType === "business" && (
            <div className="space-y-2">
              <Label>Select Business</Label>
              <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                <SelectTrigger data-testid="select-business">
                  <SelectValue placeholder="Choose a business..." />
                </SelectTrigger>
                <SelectContent>
                  {(businessesList || []).slice(0, 100).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {pageType === "event" && (
            <div className="space-y-2">
              <Label>Select Event</Label>
              <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                <SelectTrigger data-testid="select-event">
                  <SelectValue placeholder="Choose an event..." />
                </SelectTrigger>
                <SelectContent>
                  {(eventsList || []).slice(0, 100).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Size (px)</Label>
            <Select value={String(qrSize)} onValueChange={(v) => setQrSize(Number(v))}>
              <SelectTrigger data-testid="select-qr-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="200">200px</SelectItem>
                <SelectItem value="400">400px</SelectItem>
                <SelectItem value="600">600px</SelectItem>
                <SelectItem value="800">800px</SelectItem>
                <SelectItem value="1000">1000px</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-qr"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4 mr-2" />
            )}
            Generate QR Code
          </Button>
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center min-h-[300px]">
          {qrResult ? (
            <div className="space-y-4 text-center w-full">
              <img
                src={qrResult.qrDataUrl}
                alt="Generated QR Code"
                className="mx-auto border rounded-lg"
                style={{ width: Math.min(qrResult.size, 300), height: Math.min(qrResult.size, 300) }}
                data-testid="img-qr-preview"
              />
              <p className="text-sm font-medium truncate max-w-full" data-testid="text-qr-label">
                {qrResult.label}
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                <Button onClick={handleDownload} data-testid="button-download-qr">
                  <Download className="h-4 w-4 mr-2" />
                  Download PNG
                </Button>
                <Button variant="outline" onClick={handleCopyUrl} data-testid="button-copy-qr-url">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </Button>
                <Button variant="outline" onClick={() => window.open(qrResult.url, "_blank")} data-testid="button-open-qr-url">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Page
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <QrCode className="h-16 w-16 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select a page type and generate a QR code</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
