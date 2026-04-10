import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { TrendingUp, ChevronRight, Award, X, Search } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import type { CuratedList } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

export default function CuratedListsIndex({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();
  const { data: lists, isLoading } = useQuery<CuratedList[]>({
    queryKey: ["/api/cities", citySlug, "curated-lists"],
  });

  const [searchQuery, setSearchQuery] = useState("");

  const filteredLists = useMemo(() => {
    if (!lists) return [];
    if (!searchQuery) return lists;
    const q = searchQuery.toLowerCase();
    return lists.filter(l => l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q));
  }, [lists, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-foreground pb-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3" data-testid="text-lists-title">
          <Award className="h-7 w-7" style={{ color: "hsl(var(--brand-gold))" }} />
          {t("home.curatedLists")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hand-picked, curated collections of Charlotte's finest
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lists..."
            className="h-9 pl-9 pr-10 text-sm"
            data-testid="input-lists-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="button-clear-list-search">
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
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      ) : filteredLists.length > 0 ? (
        <div className="space-y-0 divide-y divide-border">
          {filteredLists.map((list, index) => (
            <Link key={list.id} href={`/${citySlug}/top/${list.slug}`}>
              <div className="group flex items-center gap-4 py-4 px-2 cursor-pointer hover:bg-muted/30 transition-colors rounded-sm" data-testid={`card-list-${list.id}`}>
                <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg" style={{ backgroundColor: "hsl(var(--brand-gold) / 0.12)", color: "hsl(var(--brand-gold))" }}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base group-hover:text-primary transition-colors">{list.title}</h3>
                    <Badge variant="outline" className="text-[10px]">{list.type}</Badge>
                  </div>
                  {list.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{list.description}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{searchQuery ? "No lists match your search" : "No curated lists yet"}</h3>
        </Card>
      )}
    </div>
  );
}
