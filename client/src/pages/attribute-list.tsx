import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BusinessCard } from "@/components/content-card";
import { ArrowLeft, ListChecks } from "lucide-react";
import { Link } from "wouter";
import { BUSINESS_ATTRIBUTES } from "@shared/schema";
import { useCategories } from "@/hooks/use-city";
import { usePageMeta } from "@/hooks/use-page-meta";
import type { Business } from "@shared/schema";

export default function AttributeList({ citySlug, slug }: { citySlug: string; slug?: string }) {
  const attributeSlug = slug || "";
  const attribute = BUSINESS_ATTRIBUTES.find((a) => a.slug === attributeSlug);
  const { data: categories } = useCategories();

  const displayLabel = attribute?.label || attributeSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  usePageMeta({
    title: `${displayLabel} Businesses | CLT Connects`,
    description: `Browse all ${displayLabel.toLowerCase()} businesses in the Charlotte metro area.`,
    canonical: `${window.location.origin}/${citySlug}/lists/${attributeSlug}`,
  });

  const { data: businesses, isLoading } = useQuery<Business[]>({
    queryKey: [`/api/cities/${citySlug}/businesses?attribute=${attributeSlug}`],
    enabled: !!attributeSlug,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${citySlug}/lists`}>
          <Button variant="ghost" size="sm" className="gap-1 mb-2 -ml-2" data-testid="link-back-to-lists">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Lists
          </Button>
        </Link>
        <div className="border-b-2 border-foreground pb-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3" data-testid="text-attribute-list-title">
            {attribute?.icon && <span className="text-2xl">{attribute.icon}</span>}
            {displayLabel} Businesses
          </h1>
          {businesses && (
            <p className="text-muted-foreground text-sm mt-1" data-testid="text-attribute-count">
              {businesses.length} {businesses.length === 1 ? "business" : "businesses"} found
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="aspect-[16/10] w-full rounded-md" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </Card>
          ))}
        </div>
      ) : businesses && businesses.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((biz) => (
            <BusinessCard
              key={biz.id}
              business={biz}
              citySlug={citySlug}
              categories={categories}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1" data-testid="text-no-results">
            No {displayLabel.toLowerCase()} businesses found
          </h3>
          <p className="text-muted-foreground text-sm">
            Check back soon as more businesses add this attribute.
          </p>
        </Card>
      )}
    </div>
  );
}
