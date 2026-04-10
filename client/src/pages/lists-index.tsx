import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListChecks, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";

interface AttributeWithCount {
  slug: string;
  label: string;
  icon: string;
  count: number;
}

export default function ListsIndex({ citySlug }: { citySlug: string }) {
  usePageMeta({
    title: "Browse Business Lists | CLT Connects",
    description: "Browse businesses by features like dog-friendly, patio seating, live music, and more.",
    canonical: `${window.location.origin}/${citySlug}/lists`,
  });

  const { data: attributes, isLoading } = useQuery<AttributeWithCount[]>({
    queryKey: [`/api/business-attributes?city=${citySlug}`],
  });

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-foreground pb-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3" data-testid="text-lists-index-title">
          <ListChecks className="h-7 w-7" />
          Business Lists
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse businesses by features and attributes
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      ) : attributes && attributes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {attributes.map((attr) => (
            <Link key={attr.slug} href={`/${citySlug}/lists/${attr.slug}`}>
              <Card
                className="group p-4 cursor-pointer hover-elevate transition-colors"
                data-testid={`card-attribute-${attr.slug}`}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center text-lg">
                    {attr.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">
                        {attr.label}
                      </h3>
                      <Badge variant="secondary" className="text-[10px]">
                        {attr.count}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {attr.count} {attr.count === 1 ? "business" : "businesses"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1" data-testid="text-no-lists">No business lists available yet</h3>
          <p className="text-muted-foreground text-sm">Check back soon for curated business lists.</p>
        </Card>
      )}
    </div>
  );
}
