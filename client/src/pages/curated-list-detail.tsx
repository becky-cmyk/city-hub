import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { ArrowLeft, TrendingUp, Share2 } from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { CuratedList, CuratedListItem, Business, Event as EventType, Article } from "@shared/schema";

interface ListDetail extends CuratedList {
  items: (CuratedListItem & {
    business?: Business | null;
    event?: EventType | null;
    article?: Article | null;
  })[];
}

export default function CuratedListDetail({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const smartBack = useSmartBack(`/${citySlug}/top`);
  const { data: list, isLoading } = useQuery<ListDetail>({
    queryKey: ["/api/cities", citySlug, "curated-lists", slug],
  });

  useRegisterAdminEdit("curated-lists", list?.id, "Edit List");

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: list?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-full" />
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>
        ))}
      </div>
    );
  }

  if (!list) {
    return (
      <Card className="p-12 text-center">
        <h3 className="font-semibold text-lg mb-1">List not found</h3>
        <Link href={`/${citySlug}/top`}>
          <Button variant="ghost" className="mt-2">Back to curated lists</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack} data-testid="link-back-lists">
        <ArrowLeft className="h-4 w-4" /> Back to curated lists
      </Button>

      <div>
        <Badge variant="secondary" className="mb-2">{list.type}</Badge>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold md:text-3xl" data-testid="text-list-title">{list.title}</h1>
          <Button variant="outline" size="icon" onClick={handleShare} data-testid="button-share-list">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        {list.description && (
          <p className="mt-2 text-muted-foreground">{list.description}</p>
        )}
      </div>

      <div className="space-y-3">
        {list.items?.sort((a, b) => a.rank - b.rank).map((item, idx) => {
          const label = item.business?.name || item.event?.title || item.article?.title || "Unknown";
          const linkPath =
            item.itemType === "BUSINESS" && item.business
              ? `/${citySlug}/directory/${item.business.slug}`
              : item.itemType === "EVENT" && item.event
              ? `/${citySlug}/events/${item.event.slug}`
              : item.itemType === "ARTICLE" && item.article
              ? `/${citySlug}/articles/${item.article.slug}`
              : "#";

          return (
            <Link key={item.id} href={linkPath}>
              <Card className="hover-elevate cursor-pointer p-4" data-testid={`card-list-item-${item.id}`}>
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary shrink-0">
                    {item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{label}</h3>
                    {item.note && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{item.note}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{item.itemType}</Badge>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
