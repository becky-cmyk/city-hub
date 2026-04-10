import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Mail, ChevronRight, X, Search } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import type { Digest } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

export default function DigestsList({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();
  const { data: digests, isLoading } = useQuery<Digest[]>({
    queryKey: ["/api/cities", citySlug, "digests"],
  });

  const [searchQuery, setSearchQuery] = useState("");

  const filteredDigests = useMemo(() => {
    if (!digests) return [];
    if (!searchQuery) return digests;
    const q = searchQuery.toLowerCase();
    return digests.filter(d => d.title.toLowerCase().includes(q));
  }, [digests, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="text-digests-title">
          <Mail className="h-6 w-6 text-primary" />
          Inbox
        </h1>
        <p className="text-muted-foreground text-sm">Community digests and updates</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search digests..."
            className="h-9 pl-9 pr-10 text-sm"
            data-testid="input-digests-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="button-clear-digest-search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {searchQuery && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          <Badge variant="secondary" className="text-xs">"{searchQuery}"</Badge>
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")} className="h-6 px-2 text-xs" data-testid="button-clear-filters">
            <X className="h-3 w-3 mr-1" /> {t("directory.clear")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>
          ))}
        </div>
      ) : filteredDigests.length > 0 ? (
        <div className="space-y-3">
          {filteredDigests.map((digest) => (
            <Link key={digest.id} href={`/${citySlug}/digests/${digest.slug}`}>
              <Card className="hover-elevate cursor-pointer p-4" data-testid={`card-digest-${digest.id}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{digest.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {digest.publishedAt ? format(new Date(digest.publishedAt), "MMM d, yyyy") : "Draft"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{searchQuery ? "No digests match your search" : "No digests yet"}</h3>
          <p className="text-muted-foreground text-sm">Community updates will appear here</p>
        </Card>
      )}
    </div>
  );
}
