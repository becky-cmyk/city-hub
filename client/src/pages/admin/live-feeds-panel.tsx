import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Radio, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import type { LiveFeed } from "@shared/schema";

function LiveFeedForm({
  feed,
  onClose,
  defaultCityId,
}: {
  feed?: LiveFeed;
  onClose: () => void;
  defaultCityId: string;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(feed?.title || "");
  const [type, setType] = useState<"youtube" | "page">(feed?.type || "youtube");
  const [embedUrl, setEmbedUrl] = useState(feed?.embedUrl || "");
  const [sourceUrl, setSourceUrl] = useState(feed?.sourceUrl || "");
  const [category, setCategory] = useState(feed?.category || "");
  const [description, setDescription] = useState(feed?.description || "");
  const [organizationSlug, setOrganizationSlug] = useState(
    feed?.organizationSlug || "",
  );
  const [featured, setFeatured] = useState(feed?.featured ?? false);
  const [sortOrder, setSortOrder] = useState(feed?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(feed?.isActive ?? true);
  const [cityId, setCityId] = useState(feed?.cityId || defaultCityId);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        type,
        embedUrl,
        sourceUrl,
        category,
        description: description || null,
        organizationSlug: organizationSlug || null,
        featured,
        sortOrder,
        isActive,
        cityId,
      };
      if (feed) {
        return apiRequest("PATCH", `/api/admin/live-feeds/${feed.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/live-feeds", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/live-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/live-feeds", defaultCityId] });
      toast({ title: feed ? "Live feed updated" : "Live feed created" });
      onClose();
    },
    onError: () => {
      toast({ title: "Error saving live feed", variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {feed ? "Edit Live Feed" : "Add Live Feed"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Feed title"
            data-testid="input-feed-title"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Type</label>
          <Select value={type} onValueChange={(v) => setType(v as "youtube" | "page")}>
            <SelectTrigger data-testid="select-feed-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="page">Page</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Embed URL</label>
          <Input
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="https://..."
            data-testid="input-feed-embed-url"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Source URL</label>
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            data-testid="input-feed-source-url"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Category</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. News, Sports"
            data-testid="input-feed-category"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            data-testid="input-feed-description"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Organization Slug</label>
          <Input
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value)}
            placeholder="organization-slug"
            data-testid="input-feed-org-slug"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Sort Order</label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            data-testid="input-feed-sort-order"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">City ID</label>
          <Input
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            data-testid="input-feed-city-id"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={featured}
              onCheckedChange={(v) => setFeatured(v === true)}
              data-testid="checkbox-feed-featured"
            />
            <label className="text-sm">Featured</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
              data-testid="checkbox-feed-active"
            />
            <label className="text-sm">Active</label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-feed">
          Cancel
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!title || !embedUrl || !sourceUrl || !category || saveMutation.isPending}
          data-testid="button-save-feed"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {feed ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function LiveFeedsPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [editingFeed, setEditingFeed] = useState<LiveFeed | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingFeed, setDeletingFeed] = useState<LiveFeed | null>(null);

  const feedsUrl = cityId ? `/api/admin/live-feeds?cityId=${cityId}` : "/api/admin/live-feeds";
  const { data: feeds, isLoading } = useQuery<LiveFeed[]>({
    queryKey: ["/api/admin/live-feeds", cityId],
    queryFn: async () => {
      const res = await fetch(feedsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch feeds");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/live-feeds/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/live-feeds", cityId] });
      toast({ title: "Live feed deleted" });
      setDeletingFeed(null);
    },
    onError: () => {
      toast({ title: "Error deleting live feed", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-lg" data-testid="text-live-feeds-title">
            Live Feeds
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage live video feeds and embedded pages
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-1"
          data-testid="button-add-live-feed"
        >
          <Plus className="h-4 w-4" /> Add Live Feed
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : feeds && feeds.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Sort Order</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed) => (
                <tr
                  key={feed.id}
                  className="border-b last:border-b-0"
                  data-testid={`row-feed-${feed.id}`}
                >
                  <td className="p-3 font-medium">
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span data-testid={`text-feed-title-${feed.id}`}>{feed.title}</span>
                      {feed.featured && (
                        <Badge variant="secondary" data-testid={`badge-featured-${feed.id}`}>
                          Featured
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3" data-testid={`text-feed-category-${feed.id}`}>
                    {feed.category}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" data-testid={`badge-type-${feed.id}`}>
                      {feed.type}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {feed.isActive ? (
                      <Badge variant="default" data-testid={`badge-status-${feed.id}`}>
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" data-testid={`badge-status-${feed.id}`}>
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="p-3" data-testid={`text-sort-order-${feed.id}`}>
                    {feed.sortOrder}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingFeed(feed)}
                        data-testid={`button-edit-feed-${feed.id}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingFeed(feed)}
                        data-testid={`button-delete-feed-${feed.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <Radio className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No live feeds yet</h3>
          <p className="text-sm text-muted-foreground">
            Add your first live feed to get started
          </p>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        {showCreate && (
          <LiveFeedForm onClose={() => setShowCreate(false)} defaultCityId={cityId || ""} />
        )}
      </Dialog>

      <Dialog
        open={!!editingFeed}
        onOpenChange={(open) => !open && setEditingFeed(null)}
      >
        {editingFeed && (
          <LiveFeedForm
            feed={editingFeed}
            onClose={() => setEditingFeed(null)}
            defaultCityId={cityId || ""}
          />
        )}
      </Dialog>

      <Dialog
        open={!!deletingFeed}
        onOpenChange={(open) => !open && setDeletingFeed(null)}
      >
        {deletingFeed && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Live Feed</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{deletingFeed.title}"? This
              action cannot be undone.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingFeed(null)}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deletingFeed.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
