import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdminCitySelection } from "@/hooks/use-city";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, MapPin, Tag, Search, Zap, Database, BarChart3 } from "lucide-react";

interface FeedItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  primaryTag: { slug: string; label: string; type: string } | null;
  locationTags: { slug: string; label: string }[];
  sponsored: boolean;
  priorityScore: number;
  whyShown: string;
  url: string;
}

interface TagInfo {
  id: string;
  slug: string;
  name: string;
  type: string;
  parentTagId: string | null;
  icon: string | null;
  sortOrder: number;
}

export default function FeedDebugPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const { selectedCitySlug } = useAdminCitySelection();
  const [geoTag, setGeoTag] = useState("");
  const [topicTag, setTopicTag] = useState("");
  const [simulatedFeed, setSimulatedFeed] = useState<FeedItem[] | null>(null);

  const { data: tagStats } = useQuery<{ location: number; topic: number; entity: number; status: number; total: number; contentTags: number }>({
    queryKey: ["/api/admin/feed/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/feed/stats", { credentials: "include" });
      if (!res.ok) return { location: 0, topic: 0, entity: 0, status: 0, total: 0, contentTags: 0 };
      return res.json();
    },
  });

  const { data: allTags, isLoading: tagsLoading } = useQuery<TagInfo[]>({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (data.tags && typeof data.tags === "object" && !Array.isArray(data.tags)) {
        const flat: TagInfo[] = [];
        for (const group of Object.values(data.tags) as TagInfo[][]) {
          if (Array.isArray(group)) flat.push(...group);
        }
        return flat;
      }
      return Array.isArray(data) ? data : [];
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/tags/backfill");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Backfill Complete", description: `Location: ${data.stats?.locationTags || 0}, Topic: ${data.stats?.topicTags || 0}, Content: ${data.stats?.contentTags || 0}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feed/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
    onError: (error: any) => {
      toast({ title: "Backfill Failed", description: error.message, variant: "destructive" });
    },
  });

  const simulateFeed = async () => {
    try {
      const params = new URLSearchParams({ citySlug: selectedCitySlug || "", page: "1", limit: "20" });
      if (geoTag) params.set("geoTag", geoTag);
      if (topicTag) params.set("topicTag", topicTag);
      const res = await fetch(`/api/feed?${params}`);
      const data = await res.json();
      setSimulatedFeed(data.items || []);
    } catch {
      toast({ title: "Simulation failed", variant: "destructive" });
    }
  };

  const locationTags = allTags?.filter(t => t.type === "location") || [];
  const topicTags = allTags?.filter(t => t.type === "topic") || [];

  const isReady = (tagStats?.total || 0) > 0 && (tagStats?.contentTags || 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="feed-debug-title">Feed Debug Panel</h2>
          <p className="text-sm text-muted-foreground">Inspect tags, simulate feeds, and trigger backfill</p>
        </div>
        <Badge variant={isReady ? "default" : "destructive"} className="text-xs" data-testid="feed-readiness-badge">
          {isReady ? "Feed Ready" : "Backfill Needed"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Tag Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location tags</span>
                <span className="font-mono" data-testid="stat-location-tags">{tagStats?.location || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Topic tags</span>
                <span className="font-mono" data-testid="stat-topic-tags">{tagStats?.topic || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entity tags</span>
                <span className="font-mono">{tagStats?.entity || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status tags</span>
                <span className="font-mono">{tagStats?.status || 0}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Total tags</span>
                <span className="font-mono" data-testid="stat-total-tags">{tagStats?.total || 0}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Content-tag links</span>
                <span className="font-mono" data-testid="stat-content-tags">{tagStats?.contentTags || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Backfill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Populate tags from existing zones, categories, and content. Safe to re-run (idempotent).
            </p>
            <Button
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
              className="w-full"
              data-testid="button-run-backfill"
            >
              {backfillMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Run Backfill</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4" />
              Feed Simulator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Geo tag slug (e.g. southend)"
              value={geoTag}
              onChange={(e) => setGeoTag(e.target.value)}
              className="text-xs"
              data-testid="input-simulate-geo"
            />
            <Input
              placeholder="Topic tag slug (e.g. food-dining)"
              value={topicTag}
              onChange={(e) => setTopicTag(e.target.value)}
              className="text-xs"
              data-testid="input-simulate-topic"
            />
            <Button onClick={simulateFeed} className="w-full" data-testid="button-simulate-feed">
              <BarChart3 className="mr-2 h-4 w-4" /> Simulate
            </Button>
          </CardContent>
        </Card>
      </div>

      {simulatedFeed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Simulated Feed — {simulatedFeed.length} items
              {geoTag && <Badge variant="outline" className="ml-2 text-xs"><MapPin className="h-3 w-3 mr-1" />{geoTag}</Badge>}
              {topicTag && <Badge variant="outline" className="ml-2 text-xs"><Tag className="h-3 w-3 mr-1" />{topicTag}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {simulatedFeed.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No items match these filters</p>
              )}
              {simulatedFeed.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="flex items-start gap-3 p-2 rounded border text-xs" data-testid={`feed-debug-item-${idx}`}>
                  <span className="shrink-0 font-mono text-muted-foreground w-5 text-right">{idx + 1}</span>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted shrink-0 flex items-center justify-center text-[8px] text-muted-foreground">No img</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant={item.sponsored ? "default" : "secondary"} className="text-[9px] px-1 py-0">
                        {item.type}{item.sponsored ? " ★" : ""}
                      </Badge>
                      <span className="font-medium truncate">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Score: <strong className="text-foreground">{item.priorityScore}</strong></span>
                      {item.primaryTag && (
                        <span className="flex items-center gap-0.5">
                          <Tag className="h-2.5 w-2.5" />{item.primaryTag.label}
                        </span>
                      )}
                      {item.locationTags.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />{item.locationTags[0].label}
                        </span>
                      )}
                    </div>
                    {item.whyShown && (
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{item.whyShown}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location Tags ({locationTags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tagsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {locationTags.slice(0, 50).map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between text-xs py-0.5 border-b last:border-0">
                    <div className="flex items-center gap-1.5">
                      {tag.parentTagId && <span className="text-muted-foreground ml-3">↳</span>}
                      <span>{tag.name}</span>
                    </div>
                    <code className="text-[10px] text-muted-foreground">{tag.slug}</code>
                  </div>
                ))}
                {locationTags.length > 50 && (
                  <p className="text-[10px] text-muted-foreground py-1">...and {locationTags.length - 50} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Topic Tags ({topicTags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tagsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {topicTags.slice(0, 50).map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between text-xs py-0.5 border-b last:border-0">
                    <div className="flex items-center gap-1.5">
                      {tag.parentTagId && <span className="text-muted-foreground ml-3">↳</span>}
                      <span>{tag.name}</span>
                    </div>
                    <code className="text-[10px] text-muted-foreground">{tag.slug}</code>
                  </div>
                ))}
                {topicTags.length > 50 && (
                  <p className="text-[10px] text-muted-foreground py-1">...and {topicTags.length - 50} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
