import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ClipboardList, CheckCircle2, Archive, Loader2, ExternalLink, Camera, ImageOff } from "lucide-react";

interface ListingPresence {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  googlePlaceId: string | null;
  galleryImages: string[] | null;
  description: string | null;
}

interface ListingToClaim {
  id: string;
  presenceId: string;
  source: string;
  status: string;
  notes: string | null;
  createdAt: string;
  presence?: ListingPresence;
}

function getPhotoStatus(item: ListingToClaim): { color: string; label: string; source: string } {
  const imageUrl = item.presence?.imageUrl;
  if (!imageUrl) {
    return { color: "text-red-500", label: "No Photo", source: "None" };
  }
  if (
    imageUrl.includes("googleusercontent.com") ||
    imageUrl.includes("googleapis.com") ||
    imageUrl.includes("google.com/maps")
  ) {
    return { color: "text-green-500", label: "Google Photo", source: "Google Places" };
  }
  if (
    imageUrl.includes("/assets/stock_images/") ||
    imageUrl.includes("/images/seed/") ||
    imageUrl.includes("placeholder") ||
    imageUrl.includes("default")
  ) {
    return { color: "text-yellow-500", label: "Stock/Fallback", source: "Fallback" };
  }
  return { color: "text-green-500", label: "Has Photo", source: "Manual" };
}

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Ready", value: "ready" },
  { label: "Published", value: "published_free" },
  { label: "Claimed", value: "claimed" },
  { label: "Archived", value: "archived" },
];

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    ready: "secondary",
    published_free: "default",
    claimed: "default",
    archived: "outline",
  };
  const labels: Record<string, string> = {
    ready: "Ready",
    published_free: "Published (Free)",
    claimed: "Claimed",
    archived: "Archived",
  };
  return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
}

function ListingCard({
  item,
  selected,
  onToggleSelect,
}: {
  item: ListingToClaim;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const { toast } = useToast();

  const publishMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/listings-to-claim/${item.id}`, { status: "published_free" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listings-to-claim"] });
      toast({ title: `${item.presence?.name || "Listing"} published as free listing` });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/listings-to-claim/${item.id}`, { status: "archived" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listings-to-claim"] });
      toast({ title: `${item.presence?.name || "Listing"} archived` });
    },
  });

  const isReady = item.status === "ready";

  const photoStatus = getPhotoStatus(item);
  const presenceName = item.presence?.name || `Presence #${item.presenceId}`;

  return (
    <Card className="p-4" data-testid={`card-listing-${item.id}`}>
      <div className="flex items-start gap-3">
        {isReady && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(item.id)}
            className="mt-1"
            data-testid={`checkbox-listing-${item.id}`}
          />
        )}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span data-testid={`icon-photo-status-${item.id}`}>
                    {photoStatus.source === "None" ? (
                      <ImageOff className={`h-4 w-4 ${photoStatus.color}`} />
                    ) : (
                      <Camera className={`h-4 w-4 ${photoStatus.color}`} />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{photoStatus.label}</p>
                </TooltipContent>
              </Tooltip>
              <span className="font-semibold text-sm" data-testid={`text-name-${item.id}`}>{presenceName}</span>
              <StatusBadge status={item.status} />
              <Badge variant="outline" className="text-xs">{item.source}</Badge>
              <Badge variant="outline" className="text-xs" data-testid={`badge-photo-source-${item.id}`}>{photoStatus.source}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
          </div>

          {item.presence?.description && (
            <div className="bg-muted/50 rounded p-2">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Description</p>
              <p className="text-sm" data-testid={`text-draft-desc-${item.id}`}>{item.presence.description}</p>
            </div>
          )}

          {item.notes && (
            <p className="text-xs text-muted-foreground italic">{item.notes}</p>
          )}

          {isReady && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending} data-testid={`button-publish-${item.id}`}>
                {publishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Publish Free
              </Button>
              <Button size="sm" variant="outline" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending} data-testid={`button-archive-${item.id}`}>
                {archiveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Archive className="h-3.5 w-3.5 mr-1" />}
                Archive
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ListingsToClaimPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("ready");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: items, isLoading } = useQuery<ListingToClaim[]>({
    queryKey: ["/api/admin/listings-to-claim", cityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/listings-to-claim?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load listings to claim");
      return res.json();
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (action: "publish_free" | "archive") => {
      await apiRequest("POST", "/api/admin/listings-to-claim/bulk", {
        ids: Array.from(selectedIds),
        action,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listings-to-claim"] });
      setSelectedIds(new Set());
      toast({ title: "Bulk action completed" });
    },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (!items) return;
    const readyItems = items.filter((i) => i.status === "ready");
    if (selectedIds.size === readyItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(readyItems.map((i) => i.id)));
    }
  };

  const readyItems = items?.filter((i) => i.status === "ready") || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-listings-claim-title">
          <ClipboardList className="h-5 w-5" />
          Listings to Claim
        </h2>
        <p className="text-sm text-muted-foreground">Review imported listings, publish or archive them</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={statusFilter === f.value ? "default" : "outline"}
              onClick={() => { setStatusFilter(f.value); setSelectedIds(new Set()); }}
              data-testid={`button-filter-${f.value}`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button size="sm" onClick={() => bulkMutation.mutate("publish_free")} disabled={bulkMutation.isPending} data-testid="button-bulk-publish">
              Publish All
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate("archive")} disabled={bulkMutation.isPending} data-testid="button-bulk-archive">
              Archive All
            </Button>
          </div>
        )}
      </div>

      {readyItems.length > 0 && statusFilter === "ready" && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedIds.size === readyItems.length && readyItems.length > 0}
            onCheckedChange={selectAll}
            data-testid="checkbox-select-all"
          />
          <span className="text-sm text-muted-foreground">Select all ({readyItems.length})</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !items || items.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-listings">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No listings found for this filter</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
