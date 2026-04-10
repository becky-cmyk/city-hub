import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bookmark, Trash2, Building2, Calendar, FileText } from "lucide-react";
import { Link } from "wouter";
import { getDeviceId } from "@/lib/device";

interface SavedItem {
  id: string;
  itemType: string;
  itemId: string;
  planName: string | null;
  createdAt: string;
  itemName?: string;
  itemSlug?: string;
}

export default function SavedItems({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const deviceId = getDeviceId();

  const { data: items, isLoading } = useQuery<SavedItem[]>({
    queryKey: ["/api/cities", citySlug, "saved", `?deviceId=${deviceId}`],
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cities/${citySlug}/saved/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "saved"] });
      toast({ title: "Removed from saved" });
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "BUSINESS": return Building2;
      case "EVENT": return Calendar;
      case "ARTICLE": return FileText;
      default: return Bookmark;
    }
  };

  const getLink = (item: SavedItem) => {
    switch (item.itemType) {
      case "BUSINESS": return `/${citySlug}/directory/${item.itemSlug || item.itemId}`;
      case "EVENT": return `/${citySlug}/events/${item.itemSlug || item.itemId}`;
      case "ARTICLE": return `/${citySlug}/articles/${item.itemSlug || item.itemId}`;
      default: return "#";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="text-saved-title">
          <Bookmark className="h-6 w-6 text-primary" />
          Saved Items
        </h1>
        <p className="text-muted-foreground text-sm">Your saved businesses, events, and articles</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = getIcon(item.itemType);
            return (
              <Card key={item.id} className="p-4" data-testid={`card-saved-${item.id}`}>
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={getLink(item)}>
                      <span className="font-semibold hover:underline cursor-pointer">
                        {item.itemName || `${item.itemType} item`}
                      </span>
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{item.itemType}</Badge>
                      {item.planName && <Badge variant="secondary" className="text-[10px]">{item.planName}</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMutation.mutate(item.id)}
                    disabled={removeMutation.isPending}
                    data-testid={`button-remove-saved-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">No saved items yet</h3>
          <p className="text-muted-foreground text-sm">
            Tap the bookmark icon on any business, event, or article to save it here.
          </p>
        </Card>
      )}
    </div>
  );
}
