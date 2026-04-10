import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Camera,
  X,
  Search,
  ExternalLink,
  User,
  MapPin,
  Tag,
  Image as ImageIcon,
  ShoppingCart,
  Lock,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GalleryAsset {
  id: string;
  fileUrl: string;
  fileType: string;
  altTextEn: string | null;
  captionEn: string | null;
  creditName: string | null;
  creditUrl: string | null;
  licenseType: string | null;
  tags: string[] | null;
  categoryIds: string[] | null;
  hubSlug: string | null;
  priceInCents: number | null;
  linkedBusiness: { id: string; name: string; slug: string } | null;
}

function ProtectedImage({
  src,
  alt,
  className,
  showWatermark = true,
  testId,
}: {
  src: string;
  alt: string;
  className?: string;
  showWatermark?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`relative overflow-hidden ${className || ""}`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none" } as any}
    >
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url(${src})`,
          userSelect: "none",
          WebkitUserSelect: "none",
          pointerEvents: "none",
        } as any}
        role="img"
        aria-label={alt}
      />
      {showWatermark && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ pointerEvents: "none", userSelect: "none" } as any}
        >
          <div
            className="absolute inset-[-50%] flex flex-wrap gap-12 items-center justify-center"
            style={{
              transform: "rotate(-30deg)",
              opacity: 0.12,
              pointerEvents: "none",
            }}
          >
            {Array.from({ length: 80 }).map((_, i) => (
              <span
                key={i}
                className="text-white font-bold text-2xl tracking-widest whitespace-nowrap"
                style={{ userSelect: "none" } as any}
              >
                CLT HUB
              </span>
            ))}
          </div>
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{ userSelect: "none" } as any}
        draggable="false"
      />
    </div>
  );
}

function DownloadFulfillment({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "limit">("loading");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/photos/download/${token}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setDownloadUrl(data.downloadUrl);
          setStatus("ready");
        } else if (res.status === 429) {
          setErrorMsg(data.message);
          setStatus("limit");
        } else {
          setErrorMsg(data.message || "Download unavailable");
          setStatus("error");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Download failed");
      });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <Card className="bg-gray-900 border-gray-700 p-8 text-center max-w-sm">
          <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white">Preparing your download...</p>
        </Card>
      </div>
    );
  }

  if (status === "ready" && downloadUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <Card className="bg-gray-900 border-gray-700 p-8 text-center max-w-sm">
          <Download className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Purchase Complete</h3>
          <p className="text-gray-400 text-sm mb-4">Your photo is ready for download.</p>
          <a href={downloadUrl} download data-testid="link-download-photo">
            <Button className="bg-amber-500 text-black font-semibold w-full mb-3">
              <Download className="w-4 h-4 mr-2" />
              Download Photo
            </Button>
          </a>
          <Button
            variant="ghost"
            className="text-gray-400 w-full"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("download");
              window.history.replaceState({}, "", url.toString());
              window.location.reload();
            }}
            data-testid="button-close-download"
          >
            Close
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <Card className="bg-gray-900 border-gray-700 p-8 text-center max-w-sm">
        <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">
          {status === "limit" ? "Download Limit Reached" : "Download Unavailable"}
        </h3>
        <p className="text-gray-400 text-sm mb-4">{errorMsg}</p>
        <Button
          variant="ghost"
          className="text-gray-400"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("download");
            window.history.replaceState({}, "", url.toString());
            window.location.reload();
          }}
          data-testid="button-close-download-error"
        >
          Close
        </Button>
      </Card>
    </div>
  );
}

export default function GalleryPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [selectedAsset, setSelectedAsset] = useState<GalleryAsset | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const { toast } = useToast();

  const downloadToken = new URLSearchParams(window.location.search).get("download");

  usePageMeta({
    title: "Photo Gallery | Charlotte Hub",
    description: "Browse community stock photos from Charlotte businesses, creators, and contributors.",
  });

  const queryUrl = activeTag
    ? `/api/cities/${citySlug}/gallery?tag=${encodeURIComponent(activeTag)}`
    : `/api/cities/${citySlug}/gallery`;

  const { data: assets = [], isLoading } = useQuery<GalleryAsset[]>({
    queryKey: [queryUrl],
  });

  const allTags = [...new Set(assets.flatMap(a => a.tags || []))].sort();

  const filtered = searchTerm
    ? assets.filter(a =>
        (a.altTextEn || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.captionEn || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.creditName || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : assets;

  function formatPrice(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  async function handlePurchase(asset: GalleryAsset) {
    if (!asset.priceInCents) return;
    setPurchasing(true);
    try {
      const res = await fetch(`/api/photos/${asset.id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citySlug }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Purchase unavailable", description: err.message, variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      {downloadToken && <DownloadFulfillment token={downloadToken} />}
      <div
        className="px-4 py-8 max-w-7xl mx-auto"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Camera className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-bold text-white" data-testid="text-gallery-title">
              Photo Gallery
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Community photos from local businesses, creators, and contributors
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              data-testid="input-gallery-search"
              placeholder="Search photos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-700 text-white"
            />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge
              data-testid="badge-tag-all"
              variant={activeTag === null ? "default" : "outline"}
              className={`cursor-pointer ${activeTag === null ? "bg-amber-500 text-black" : "border-gray-600 text-gray-300"}`}
              onClick={() => setActiveTag(null)}
            >
              All
            </Badge>
            {allTags.map(tag => (
              <Badge
                key={tag}
                data-testid={`badge-tag-${tag}`}
                variant={activeTag === tag ? "default" : "outline"}
                className={`cursor-pointer ${activeTag === tag ? "bg-amber-500 text-black" : "border-gray-600 text-gray-300"}`}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg bg-gray-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No photos found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(asset => (
              <Card
                key={asset.id}
                data-testid={`card-gallery-${asset.id}`}
                className="group relative overflow-hidden rounded-lg border-gray-800 bg-gray-900 cursor-pointer"
                onClick={() => setSelectedAsset(asset)}
              >
                <ProtectedImage
                  src={asset.fileUrl}
                  alt={asset.altTextEn || "Gallery photo"}
                  className="aspect-square"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {asset.priceInCents && (
                      <Badge className="bg-amber-500 text-black mb-1.5 text-xs">
                        {formatPrice(asset.priceInCents)}
                      </Badge>
                    )}
                    {asset.creditName && (
                      <div className="flex items-center gap-1.5 text-sm text-white">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate">{asset.creditName}</span>
                      </div>
                    )}
                    {asset.captionEn && (
                      <p className="text-xs text-gray-300 mt-1 line-clamp-2">{asset.captionEn}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
        <DialogContent className="max-w-4xl bg-gray-950 border-gray-800 p-0 overflow-hidden">
          {selectedAsset && (
            <div>
              <div className="relative">
                <ProtectedImage
                  src={selectedAsset.fileUrl}
                  alt={selectedAsset.altTextEn || "Gallery photo"}
                  className="w-full aspect-[16/10]"
                  testId="img-lightbox"
                />
                <Button
                  data-testid="button-close-lightbox"
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 text-white bg-black/50 rounded-full z-10"
                  onClick={() => setSelectedAsset(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-5 space-y-3">
                {selectedAsset.captionEn && (
                  <p className="text-white text-lg">{selectedAsset.captionEn}</p>
                )}

                {selectedAsset.priceInCents ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-white font-semibold text-lg">
                        <Lock className="w-4 h-4 text-amber-400" />
                        {formatPrice(selectedAsset.priceInCents)}
                      </div>
                      <p className="text-sm text-gray-400">
                        Purchase for full-resolution download
                      </p>
                    </div>
                    <Button
                      data-testid="button-purchase-photo"
                      className="bg-amber-500 text-black font-semibold"
                      disabled={purchasing}
                      onClick={() => handlePurchase(selectedAsset)}
                    >
                      {purchasing ? "Processing..." : (
                        <>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Purchase
                        </>
                      )}
                    </Button>
                  </div>
                ) : null}

                {selectedAsset.creditName && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <Camera className="w-4 h-4 text-amber-400" />
                    {selectedAsset.creditUrl ? (
                      <a
                        href={selectedAsset.creditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-amber-400 underline"
                        data-testid="link-credit"
                      >
                        {selectedAsset.creditName}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span>{selectedAsset.creditName}</span>
                    )}
                  </div>
                )}
                {selectedAsset.linkedBusiness && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <a
                      href={`/${citySlug}/directory/${selectedAsset.linkedBusiness.slug}`}
                      className="text-amber-400 underline"
                      data-testid="link-business"
                    >
                      {selectedAsset.linkedBusiness.name}
                    </a>
                  </div>
                )}
                {selectedAsset.licenseType && (
                  <div className="text-sm text-gray-500">
                    License: {selectedAsset.licenseType}
                  </div>
                )}
                {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="w-4 h-4 text-gray-500" />
                    {selectedAsset.tags.map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="border-gray-700 text-gray-400 text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DarkPageShell>
  );
}
