import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, Search, Trash2, Flag, CheckCircle, XCircle, Eye, ExternalLink, Receipt
} from "lucide-react";
import type { MarketplaceListing } from "@shared/schema";

interface AdminTransaction {
  id: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-emerald-500/20 text-emerald-400" },
  DRAFT: { label: "Draft", className: "bg-gray-500/20 text-gray-400" },
  PENDING_REVIEW: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400" },
  EXPIRED: { label: "Expired", className: "bg-amber-500/20 text-amber-400" },
  REMOVED: { label: "Removed", className: "bg-red-500/20 text-red-400" },
  FLAGGED: { label: "Flagged", className: "bg-orange-500/20 text-orange-400" },
  ARCHIVED: { label: "Archived", className: "bg-slate-500/20 text-slate-400" },
  REJECTED: { label: "Rejected", className: "bg-red-600/20 text-red-500" },
};

const TYPE_LABELS: Record<string, string> = {
  SERVICE: "Service", FOR_SALE: "For Sale", HOUSING: "Housing", JOB: "Job",
  COMMUNITY: "Community", WANTED: "Wanted", CLASSIFIED: "Classified",
  HOUSING_SUPPLY: "Housing Supply", HOUSING_DEMAND: "Housing Wanted",
  COMMERCIAL_PROPERTY: "Commercial",
};

const OWNER_TYPE_LABELS: Record<string, string> = {
  READER: "Reader", HUB_PRESENCE: "Hub Presence", ADMIN: "Admin",
};

export default function MarketplacePanel() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showTransactions, setShowTransactions] = useState(false);

  const { data: adminTransactions } = useQuery<AdminTransaction[]>({
    queryKey: ["/api/admin/marketplace/transactions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/marketplace/transactions");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showTransactions,
  });

  const queryParams = new URLSearchParams();
  if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
  if (typeFilter !== "ALL") queryParams.set("type", typeFilter);
  if (search) queryParams.set("q", search);

  const { data: listings, isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/admin/marketplace/listings", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/marketplace/listings?${queryParams.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PUT", `/api/admin/marketplace/listings/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/listings"] });
      toast({ title: "Status updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/marketplace/listings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/listings"] });
      toast({ title: "Listing deleted" });
    },
  });

  const bulkAction = async (action: string) => {
    if (!selectedIds.size) return;
    for (const id of selectedIds) {
      if (action === "delete") {
        await deleteMutation.mutateAsync(id);
      } else {
        await statusMutation.mutateAsync({ id, status: action });
      }
    }
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!listings) return;
    if (selectedIds.size === listings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listings.map(l => l.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-admin-marketplace-title">
          <ShoppingBag className="h-5 w-5" /> Marketplace Management
        </h2>
        <span className="text-sm text-muted-foreground">{listings?.length || 0} listings</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="admin-marketplace-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="admin-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="FLAGGED">Flagged</SelectItem>
            <SelectItem value="REMOVED">Removed</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]" data-testid="admin-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="HOUSING_SUPPLY">Housing Supply</SelectItem>
            <SelectItem value="HOUSING_DEMAND">Housing Wanted</SelectItem>
            <SelectItem value="COMMERCIAL_PROPERTY">Commercial</SelectItem>
            <SelectItem value="SERVICE">Service</SelectItem>
            <SelectItem value="FOR_SALE">For Sale</SelectItem>
            <SelectItem value="HOUSING">Housing</SelectItem>
            <SelectItem value="JOB">Job</SelectItem>
            <SelectItem value="COMMUNITY">Community</SelectItem>
            <SelectItem value="WANTED">Wanted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border" data-testid="bulk-actions">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => bulkAction("ACTIVE")} data-testid="bulk-approve">
            <CheckCircle className="h-3 w-3" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => bulkAction("FLAGGED")} data-testid="bulk-flag">
            <Flag className="h-3 w-3" /> Flag
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-red-500" onClick={() => bulkAction("REMOVED")} data-testid="bulk-remove">
            <XCircle className="h-3 w-3" /> Remove
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => bulkAction("ARCHIVED")} data-testid="bulk-archive">
            Archive
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-red-400" onClick={() => bulkAction("REJECTED")} data-testid="bulk-reject">
            Reject
          </Button>
          <Button size="sm" variant="destructive" className="gap-1" onClick={() => { if (confirm("Delete selected?")) bulkAction("delete"); }} data-testid="bulk-delete">
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : !listings?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No marketplace listings found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="admin-marketplace-table">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left w-8">
                  <input type="checkbox" onChange={toggleAll} checked={selectedIds.size === listings.length && listings.length > 0} data-testid="checkbox-all" />
                </th>
                <th className="p-3 text-left font-medium">Listing</th>
                <th className="p-3 text-left font-medium">Type</th>
                <th className="p-3 text-left font-medium">Owner</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Price</th>
                <th className="p-3 text-left font-medium">Posted</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(listing => {
                const statusInfo = STATUS_STYLES[listing.status] || STATUS_STYLES.DRAFT;
                return (
                  <tr key={listing.id} className="border-b hover:bg-muted/30" data-testid={`admin-listing-${listing.id}`}>
                    <td className="p-3">
                      <input type="checkbox" checked={selectedIds.has(listing.id)} onChange={() => toggleSelect(listing.id)} />
                    </td>
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[250px]">{listing.title}</p>
                      {listing.neighborhood && <p className="text-xs text-muted-foreground">{listing.neighborhood}</p>}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[listing.type] || listing.type}</Badge>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] text-muted-foreground">{OWNER_TYPE_LABELS[listing.ownerType || "READER"] || listing.ownerType || "—"}</span>
                    </td>
                    <td className="p-3">
                      <Badge className={`text-[10px] border-0 ${statusInfo.className}`}>{statusInfo.label}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {listing.price != null ? `$${listing.price.toLocaleString()}` : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        {listing.status !== "ACTIVE" && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => statusMutation.mutate({ id: listing.id, status: "ACTIVE" })} title="Approve" data-testid={`approve-${listing.id}`}>
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          </Button>
                        )}
                        {listing.status !== "FLAGGED" && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => statusMutation.mutate({ id: listing.id, status: "FLAGGED" })} title="Flag" data-testid={`flag-${listing.id}`}>
                            <Flag className="h-3.5 w-3.5 text-orange-500" />
                          </Button>
                        )}
                        {listing.status !== "REMOVED" && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => statusMutation.mutate({ id: listing.id, status: "REMOVED" })} title="Remove" data-testid={`remove-${listing.id}`}>
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { if (confirm("Delete permanently?")) deleteMutation.mutate(listing.id); }} title="Delete" data-testid={`delete-${listing.id}`}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t pt-6">
        <button
          onClick={() => setShowTransactions(prev => !prev)}
          className="flex items-center gap-2 text-sm font-semibold hover:underline"
          data-testid="button-toggle-transactions"
        >
          <Receipt className="h-4 w-4" /> {showTransactions ? "Hide" : "Show"} Transaction History
        </button>
        {showTransactions && (
          <div className="mt-4 rounded-lg border overflow-hidden">
            {!adminTransactions?.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Listing</th>
                    <th className="text-left p-3 font-medium">Buyer</th>
                    <th className="text-left p-3 font-medium">Seller</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTransactions.map(tx => (
                    <tr key={tx.id} className="border-t" data-testid={`admin-transaction-${tx.id}`}>
                      <td className="p-3 font-medium max-w-[200px] truncate">{tx.listingTitle}</td>
                      <td className="p-3 text-muted-foreground">{tx.buyerName}</td>
                      <td className="p-3 text-muted-foreground">{tx.sellerName}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {tx.type === "PURCHASE" ? "Purchase" : "Featured"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-bold">${(tx.amount / 100).toFixed(2)}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-[10px] ${tx.status === "COMPLETED" ? "border-emerald-500/30 text-emerald-500" : "border-yellow-500/30 text-yellow-500"}`}>
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
