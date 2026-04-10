import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import {
  ShoppingBag, Plus, Edit, Trash2, RefreshCw, Eye, Clock,
  MessageSquare, AlertTriangle, Image as ImageIcon, Archive, Sparkles, Receipt
} from "lucide-react";
import { DarkPageShell } from "@/components/dark-page-shell";
import { usePageMeta } from "@/hooks/use-page-meta";
import type { MarketplaceListing } from "@shared/schema";

interface MarketplaceTransaction {
  id: string;
  listingTitle: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
  buyerName?: string;
  sellerName?: string;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  DRAFT: { label: "Draft", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  PENDING_REVIEW: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  EXPIRED: { label: "Expired", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  REMOVED: { label: "Removed", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  FLAGGED: { label: "Flagged", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  ARCHIVED: { label: "Archived", className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  REJECTED: { label: "Rejected", className: "bg-red-600/20 text-red-500 border-red-600/30" },
};

const READER_CAP = 3;

export default function MyMarketplace({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  usePageMeta({
    title: "My Marketplace Listings",
    description: "Manage your marketplace listings",
  });

  const { data: listings, isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/auth/my-marketplace-listings"],
    enabled: isLoggedIn,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cities/${citySlug}/marketplace/listings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-marketplace-listings"] });
      toast({ title: "Listing deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete listing", variant: "destructive" });
    },
  });

  const renewMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/cities/${citySlug}/marketplace/listings/${id}/renew`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-marketplace-listings"] });
      toast({ title: "Listing renewed for 30 days" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to renew listing", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/cities/${citySlug}/marketplace/listings/${id}`, { status: "ARCHIVED" } as Record<string, string>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-marketplace-listings"] });
      toast({ title: "Listing archived" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive listing", variant: "destructive" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cities/${citySlug}/marketplace/listings/${id}/promote`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start promotion checkout", variant: "destructive" });
    },
  });

  const { data: transactions } = useQuery<MarketplaceTransaction[]>({
    queryKey: ["/api/cities", citySlug, "marketplace/transactions/my"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/marketplace/transactions/my`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isLoggedIn,
  });

  if (authLoading) {
    return (
      <DarkPageShell maxWidth="wide" fillHeight>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48 bg-white/10" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-xl" />)}
        </div>
      </DarkPageShell>
    );
  }

  if (!isLoggedIn) {
    return (
      <DarkPageShell maxWidth="narrow" fillHeight>
        <div className="text-center py-16">
          <ShoppingBag className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in to manage listings</h2>
          <p className="text-sm text-white/50 mb-4">View and manage your marketplace listings after signing in.</p>
          <Button onClick={() => setAuthOpen(true)} className="bg-amber-500 text-black font-bold" data-testid="button-signin">Sign In</Button>
          <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        </div>
      </DarkPageShell>
    );
  }

  const filtered = listings?.filter(l => filter === "ALL" || l.status === filter) || [];
  const counts = {
    ALL: listings?.length || 0,
    ACTIVE: listings?.filter(l => l.status === "ACTIVE").length || 0,
    EXPIRED: listings?.filter(l => l.status === "EXPIRED").length || 0,
    DRAFT: listings?.filter(l => l.status === "DRAFT").length || 0,
  };

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2" data-testid="text-my-marketplace-title">
              <ShoppingBag className="h-6 w-6 text-amber-400" /> My Marketplace
            </h1>
            <p className="text-sm text-white/50 mt-0.5">Manage your listings, renewals, and inquiries</p>
          </div>
          <Link href={`/${citySlug}/marketplace/post`}>
            <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-1.5" data-testid="button-new-listing">
              <Plus className="h-4 w-4" /> New Listing
            </Button>
          </Link>
        </div>

        {listings && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 flex items-center justify-between" data-testid="reader-cap-status">
            <span className="text-xs text-white/50">
              Active listings: <span className="font-bold text-white">{listings.filter(l => l.status === "ACTIVE").length}</span> / {READER_CAP}
            </span>
            {listings.filter(l => l.status === "ACTIVE").length >= READER_CAP && (
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Cap reached — archive or remove a listing to post new ones
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {(["ALL", "ACTIVE", "EXPIRED", "DRAFT"] as const).map(key => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === key
                  ? "bg-amber-500 text-black"
                  : "bg-white/10 text-white/60 border border-white/10 hover:bg-white/15"
              }`}
              data-testid={`filter-${key.toLowerCase()}`}
            >
              {key === "ALL" ? "All" : key.charAt(0) + key.slice(1).toLowerCase()} ({counts[key]})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full bg-white/10 rounded-xl" />)}
          </div>
        ) : !filtered.length ? (
          <div className="rounded-xl bg-white/5 border border-white/10 p-12 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-white/15" />
            <h3 className="font-semibold text-lg text-white" data-testid="text-no-listings">No listings</h3>
            <p className="text-sm text-white/50 mt-1 mb-4">
              {filter === "ALL" ? "Create your first marketplace listing!" : `No ${filter.toLowerCase()} listings.`}
            </p>
            <Link href={`/${citySlug}/marketplace/post`}>
              <Button className="bg-amber-500 text-black font-bold gap-1.5" data-testid="button-create-first">
                <Plus className="h-4 w-4" /> Post a Listing
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3" data-testid="my-listings-grid">
            {filtered.map(listing => {
              const statusInfo = STATUS_STYLES[listing.status] || STATUS_STYLES.DRAFT;
              const isExpired = listing.status === "EXPIRED" || (listing.expiresAt && new Date(listing.expiresAt) < new Date());
              return (
                <div key={listing.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex gap-4" data-testid={`my-listing-${listing.id}`}>
                  <div className="w-20 h-20 rounded-lg bg-white/5 overflow-hidden shrink-0">
                    {listing.imageUrl ? (
                      <img src={listing.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-white/10" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm truncate" data-testid={`listing-title-${listing.id}`}>
                          {listing.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[10px] ${statusInfo.className}`}>
                            {statusInfo.label}
                          </Badge>
                          {listing.featuredFlag && (
                            <Badge className="text-[10px] border-0 text-black bg-amber-400" data-testid={`badge-featured-${listing.id}`}>
                              <Sparkles className="h-2.5 w-2.5 mr-0.5" />Featured
                            </Badge>
                          )}
                          {listing.price != null && (
                            <span className="text-xs font-bold text-amber-400">${listing.price.toLocaleString()}</span>
                          )}
                          <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                            <MessageSquare className="h-3 w-3" /> {listing.inquiryCount || 0}
                          </span>
                        </div>
                        {listing.expiresAt && (
                          <p className="text-[10px] text-white/30 mt-1 flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {isExpired ? "Expired" : `Expires ${new Date(listing.expiresAt).toLocaleDateString()}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link href={`/${citySlug}/marketplace/${listing.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white/40 hover:text-white" data-testid={`view-${listing.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/${citySlug}/marketplace/post?edit=${listing.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-400/60 hover:text-blue-400" data-testid={`edit-${listing.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        {(isExpired || listing.status === "EXPIRED") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-amber-400 hover:text-amber-300"
                            onClick={() => renewMutation.mutate(listing.id)}
                            disabled={renewMutation.isPending}
                            data-testid={`renew-${listing.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {listing.status === "ACTIVE" && !listing.featuredFlag && listing.ownerType === "HUB_PRESENCE" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-amber-400 hover:text-amber-300"
                            onClick={() => promoteMutation.mutate(listing.id)}
                            disabled={promoteMutation.isPending}
                            title="Promote to Featured"
                            data-testid={`promote-${listing.id}`}
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        )}
                        {listing.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                            onClick={() => archiveMutation.mutate(listing.id)}
                            disabled={archiveMutation.isPending}
                            title="Archive"
                            data-testid={`archive-${listing.id}`}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-400/60 hover:text-red-400"
                          onClick={() => {
                            if (confirm("Delete this listing?")) deleteMutation.mutate(listing.id);
                          }}
                          data-testid={`delete-${listing.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {transactions && transactions.length > 0 && (
          <div className="space-y-3" data-testid="transaction-history">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-400" /> Transaction History
            </h2>
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0" data-testid={`transaction-${tx.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{tx.listingTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={`text-[10px] ${tx.status === "COMPLETED" ? "border-emerald-500/30 text-emerald-400" : tx.status === "PENDING" ? "border-yellow-500/30 text-yellow-400" : "border-red-500/30 text-red-400"}`}>
                        {tx.status}
                      </Badge>
                      <span className="text-[10px] text-white/30">{tx.type === "PURCHASE" ? "Purchase" : "Featured Promotion"}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-amber-400">${(tx.amount / 100).toFixed(2)}</p>
                    <p className="text-[10px] text-white/30">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
