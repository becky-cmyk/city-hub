import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Building2, ExternalLink, Settings } from "lucide-react";
import { useState } from "react";
import type { Business } from "@shared/schema";

const TIER_COLORS: Record<string, string> = {
  VERIFIED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ENHANCED: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export default function MyListings({ citySlug }: { citySlug: string }) {
  const { user, isLoggedIn, isLoading: authLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const { data: listings, isLoading } = useQuery<Business[]>({
    queryKey: ["/api/auth/my-listings"],
    enabled: isLoggedIn,
  });

  if (authLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Sign in to view your listings</h2>
        <p className="text-muted-foreground mb-4 max-w-sm">
          If you've claimed any business listings, they'll appear here after you sign in.
        </p>
        <Button onClick={() => setAuthOpen(true)} data-testid="button-signin-listings">
          Sign In
        </Button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-my-listings-title">My Listings</h1>
        <p className="text-sm text-muted-foreground">Businesses you've claimed and manage</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : !listings?.length ? (
        <Card className="p-8 text-center">
          <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-lg font-medium mb-1">No claimed listings yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Browse the directory and claim your business to manage it here.
          </p>
          <Link href={`/${citySlug}/directory`}>
            <Button variant="outline" data-testid="link-browse-directory">Browse Directory</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {listings.map((biz) => (
            <Card key={biz.id} className="p-4" data-testid={`card-listing-${biz.slug}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{biz.name}</h3>
                    <Badge className={`text-[10px] ${TIER_COLORS[biz.listingTier || "VERIFIED"] || ""}`}>
                      {biz.listingTier || "VERIFIED"}
                    </Badge>
                  </div>
                  {biz.address && (
                    <p className="text-sm text-muted-foreground mt-0.5">{biz.address}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/${citySlug}/directory/${biz.slug}`}>
                    <Button size="sm" variant="ghost" data-testid={`link-view-${biz.slug}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/${citySlug}/owner/${biz.slug}`}>
                    <Button size="sm" variant="outline" className="gap-1" data-testid={`link-manage-${biz.slug}`}>
                      <Settings className="h-4 w-4" />
                      <span className="hidden sm:inline">Manage</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
