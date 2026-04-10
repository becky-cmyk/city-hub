import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Search, Package, Tag, ShoppingBag, Clock,
  Check, X, Loader2, RefreshCw, Zap, TicketPercent,
  DollarSign, Hash, Store,
} from "lucide-react";
import type { ShopItem, ShopDrop, ShopClaim } from "@shared/schema";

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ItemsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);

  const { data: items, isLoading } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop/items", cityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/shop/items?${params.toString()}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shop/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/items"] });
      toast({ title: "Item deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-item-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sold_out">Sold Out</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setEditingItem(null); setShowCreate(true); }} data-testid="button-create-item">
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Item
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {!isLoading && items && items.length === 0 && (
        <Card className="p-8 text-center">
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-items">No shop items found</p>
        </Card>
      )}

      {!isLoading && items && items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => (
            <Card key={item.id} className="p-3" data-testid={`item-card-${item.id}`}>
              <div className="flex items-start gap-3">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="h-14 w-14 rounded-md object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold truncate" data-testid={`text-item-title-${item.id}`}>{item.title}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={item.status === "active" ? "default" : "secondary"} data-testid={`badge-item-status-${item.id}`}>
                        {item.status}
                      </Badge>
                      <Badge variant="outline">{item.type}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="font-semibold text-foreground" data-testid={`text-item-price-${item.id}`}>{formatPrice(item.price)}</span>
                    {item.compareAtPrice && (
                      <span className="line-through">{formatPrice(item.compareAtPrice)}</span>
                    )}
                    {item.inventoryCount !== null && (
                      <span>Stock: {item.inventoryCount}</span>
                    )}
                    <span>Claims: {item.claimCount}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditingItem(item); setShowCreate(true); }}
                    data-testid={`button-edit-item-${item.id}`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { if (confirm("Delete this item?")) deleteMutation.mutate(item.id); }}
                    data-testid={`button-delete-item-${item.id}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <ItemFormDialog
          item={editingItem}
          cityId={cityId}
          onClose={() => { setShowCreate(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

function ItemFormDialog({ item, cityId, onClose }: { item: ShopItem | null; cityId?: string; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!item;
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [price, setPrice] = useState(item ? (item.price / 100).toFixed(2) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(item?.compareAtPrice ? (item.compareAtPrice / 100).toFixed(2) : "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || "");
  const [category, setCategory] = useState(item?.category || "");
  const [type, setType] = useState<string>(item?.type || "product");
  const [status, setStatus] = useState<string>(item?.status || "draft");
  const [inventoryCount, setInventoryCount] = useState(item?.inventoryCount?.toString() || "");
  const [externalUrl, setExternalUrl] = useState(item?.externalUrl || "");
  const [businessId, setBusinessId] = useState(item?.businessId || "");

  const { data: businesses } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses?limit=200${cityId ? `&cityId=${cityId}` : ""}`);
      const data = await res.json();
      return data.businesses || data || [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title,
        description: description || null,
        price: Math.round(parseFloat(price) * 100),
        compareAtPrice: compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : null,
        imageUrl: imageUrl || null,
        category: category || null,
        type,
        status,
        inventoryCount: inventoryCount ? parseInt(inventoryCount) : null,
        externalUrl: externalUrl || null,
        businessId,
        cityId: cityId || "",
      };
      if (isEdit) {
        return apiRequest("PATCH", `/api/shop/items/${item!.id}`, body);
      }
      return apiRequest("POST", "/api/shop/items", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/items"] });
      toast({ title: isEdit ? "Item updated" : "Item created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to save item", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Item" : "Create Item"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div>
            <Label>Business</Label>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger data-testid="select-item-business">
                <SelectValue placeholder="Select business..." />
              </SelectTrigger>
              <SelectContent>
                {(businesses || []).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} data-testid="input-item-title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-item-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price ($)</Label>
              <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} data-testid="input-item-price" />
            </div>
            <div>
              <Label>Compare At ($)</Label>
              <Input type="number" step="0.01" value={compareAtPrice} onChange={e => setCompareAtPrice(e.target.value)} data-testid="input-item-compare-price" />
            </div>
          </div>
          <div>
            <Label>Image URL</Label>
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} data-testid="input-item-image" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-item-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                  <SelectItem value="gift_card">Gift Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-item-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold_out">Sold Out</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} data-testid="input-item-category" />
            </div>
            <div>
              <Label>Inventory</Label>
              <Input type="number" value={inventoryCount} onChange={e => setInventoryCount(e.target.value)} placeholder="Unlimited" data-testid="input-item-inventory" />
            </div>
          </div>
          <div>
            <Label>External URL</Label>
            <Input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} data-testid="input-item-external-url" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !title || !price || !businessId} data-testid="button-save-item">
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DropsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingDrop, setEditingDrop] = useState<ShopDrop | null>(null);

  const { data: drops, isLoading } = useQuery<ShopDrop[]>({
    queryKey: ["/api/shop/drops", cityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/shop/drops?${params.toString()}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shop/drops/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/drops"] });
      toast({ title: "Drop deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-drop-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="sold_out">Sold Out</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setEditingDrop(null); setShowCreate(true); }} data-testid="button-create-drop">
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Drop
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {!isLoading && drops && drops.length === 0 && (
        <Card className="p-8 text-center">
          <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-drops">No drops found</p>
        </Card>
      )}

      {!isLoading && drops && drops.length > 0 && (
        <div className="space-y-2">
          {drops.map(drop => (
            <Card key={drop.id} className="p-3" data-testid={`drop-card-${drop.id}`}>
              <div className="flex items-start gap-3">
                {drop.imageUrl && (
                  <img src={drop.imageUrl} alt="" className="h-14 w-14 rounded-md object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold truncate" data-testid={`text-drop-title-${drop.id}`}>{drop.title}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={drop.status === "active" ? "default" : "secondary"} data-testid={`badge-drop-status-${drop.id}`}>
                        {drop.status}
                      </Badge>
                      <Badge variant="outline">{drop.dealType.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {drop.discountPercent && (
                      <span className="font-semibold text-foreground">{drop.discountPercent}% OFF</span>
                    )}
                    {drop.dealPrice && (
                      <span className="font-semibold text-foreground">{formatPrice(drop.dealPrice)}</span>
                    )}
                    {drop.originalPrice && (
                      <span className="line-through">{formatPrice(drop.originalPrice)}</span>
                    )}
                    <span>Claims: {drop.claimCount}{drop.maxClaims ? `/${drop.maxClaims}` : ""}</span>
                    {drop.endAt && (
                      <span>Ends: {new Date(drop.endAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditingDrop(drop); setShowCreate(true); }}
                    data-testid={`button-edit-drop-${drop.id}`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { if (confirm("Delete this drop?")) deleteMutation.mutate(drop.id); }}
                    data-testid={`button-delete-drop-${drop.id}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <DropFormDialog
          drop={editingDrop}
          cityId={cityId}
          onClose={() => { setShowCreate(false); setEditingDrop(null); }}
        />
      )}
    </div>
  );
}

function DropFormDialog({ drop, cityId, onClose }: { drop: ShopDrop | null; cityId?: string; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!drop;
  const [title, setTitle] = useState(drop?.title || "");
  const [description, setDescription] = useState(drop?.description || "");
  const [imageUrl, setImageUrl] = useState(drop?.imageUrl || "");
  const [dealType, setDealType] = useState<string>(drop?.dealType || "flash_deal");
  const [discountPercent, setDiscountPercent] = useState(drop?.discountPercent?.toString() || "");
  const [discountAmount, setDiscountAmount] = useState(drop?.discountAmount ? (drop.discountAmount / 100).toFixed(2) : "");
  const [originalPrice, setOriginalPrice] = useState(drop?.originalPrice ? (drop.originalPrice / 100).toFixed(2) : "");
  const [dealPrice, setDealPrice] = useState(drop?.dealPrice ? (drop.dealPrice / 100).toFixed(2) : "");
  const [startAt, setStartAt] = useState(drop?.startAt ? new Date(drop.startAt).toISOString().slice(0, 16) : "");
  const [endAt, setEndAt] = useState(drop?.endAt ? new Date(drop.endAt).toISOString().slice(0, 16) : "");
  const [maxClaims, setMaxClaims] = useState(drop?.maxClaims?.toString() || "");
  const [status, setStatus] = useState<string>(drop?.status || "scheduled");
  const [terms, setTerms] = useState(drop?.terms || "");
  const [businessId, setBusinessId] = useState(drop?.businessId || "");

  const { data: businesses } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses?limit=200${cityId ? `&cityId=${cityId}` : ""}`);
      const data = await res.json();
      return data.businesses || data || [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        dealType,
        discountPercent: discountPercent ? parseInt(discountPercent) : null,
        discountAmount: discountAmount ? Math.round(parseFloat(discountAmount) * 100) : null,
        originalPrice: originalPrice ? Math.round(parseFloat(originalPrice) * 100) : null,
        dealPrice: dealPrice ? Math.round(parseFloat(dealPrice) * 100) : null,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        maxClaims: maxClaims ? parseInt(maxClaims) : null,
        status,
        terms: terms || null,
        businessId,
        cityId: cityId || "",
      };
      if (isEdit) {
        return apiRequest("PATCH", `/api/shop/drops/${drop!.id}`, body);
      }
      return apiRequest("POST", "/api/shop/drops", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/drops"] });
      toast({ title: isEdit ? "Drop updated" : "Drop created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to save drop", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Drop" : "Create Drop"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div>
            <Label>Business</Label>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger data-testid="select-drop-business">
                <SelectValue placeholder="Select business..." />
              </SelectTrigger>
              <SelectContent>
                {(businesses || []).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} data-testid="input-drop-title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} data-testid="input-drop-description" />
          </div>
          <div>
            <Label>Deal Type</Label>
            <Select value={dealType} onValueChange={setDealType}>
              <SelectTrigger data-testid="select-drop-deal-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flash_deal">Flash Deal</SelectItem>
                <SelectItem value="daily_deal">Daily Deal</SelectItem>
                <SelectItem value="weekend_special">Weekend Special</SelectItem>
                <SelectItem value="clearance">Clearance</SelectItem>
                <SelectItem value="bogo">BOGO</SelectItem>
                <SelectItem value="bundle">Bundle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Discount %</Label>
              <Input type="number" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} data-testid="input-drop-discount-percent" />
            </div>
            <div>
              <Label>Discount $ Off</Label>
              <Input type="number" step="0.01" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} data-testid="input-drop-discount-amount" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Original Price ($)</Label>
              <Input type="number" step="0.01" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} data-testid="input-drop-original-price" />
            </div>
            <div>
              <Label>Deal Price ($)</Label>
              <Input type="number" step="0.01" value={dealPrice} onChange={e => setDealPrice(e.target.value)} data-testid="input-drop-deal-price" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} data-testid="input-drop-start" />
            </div>
            <div>
              <Label>End</Label>
              <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} data-testid="input-drop-end" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max Claims</Label>
              <Input type="number" value={maxClaims} onChange={e => setMaxClaims(e.target.value)} placeholder="Unlimited" data-testid="input-drop-max-claims" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-drop-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="sold_out">Sold Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Image URL</Label>
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} data-testid="input-drop-image" />
          </div>
          <div>
            <Label>Terms & Conditions</Label>
            <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={2} data-testid="input-drop-terms" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !title || !businessId} data-testid="button-save-drop">
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClaimsTab() {
  const { toast } = useToast();
  const [searchCode, setSearchCode] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: claims, isLoading, refetch } = useQuery<ShopClaim[]>({
    queryKey: ["/api/shop/claims", statusFilter, searchCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchCode.trim()) params.set("code", searchCode.trim());
      const res = await fetch(`/api/shop/claims?${params.toString()}`);
      return res.json();
    },
  });

  const redeemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/shop/claims/${id}/redeem`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/claims"] });
      toast({ title: "Claim redeemed" });
    },
    onError: () => toast({ title: "Redeem failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={searchCode}
            onChange={e => setSearchCode(e.target.value.toUpperCase())}
            placeholder="Search by claim code..."
            className="flex-1"
            data-testid="input-claim-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-claim-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
            <SelectItem value="redeemed">Redeemed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-claims">
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {!isLoading && claims && claims.length === 0 && (
        <Card className="p-8 text-center">
          <Hash className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-claims">No claims found</p>
        </Card>
      )}

      {!isLoading && claims && claims.length > 0 && (
        <div className="space-y-2">
          {claims.map(claim => (
            <Card key={claim.id} className="p-3" data-testid={`claim-card-${claim.id}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-mono font-bold bg-muted px-2 py-0.5 rounded" data-testid={`text-claim-code-${claim.id}`}>
                      {claim.claimCode}
                    </code>
                    <Badge variant={claim.status === "claimed" ? "default" : claim.status === "redeemed" ? "secondary" : "outline"} data-testid={`badge-claim-status-${claim.id}`}>
                      {claim.status}
                    </Badge>
                    <Badge variant="outline">{claim.itemType.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Claimed: {new Date(claim.claimedAt).toLocaleString()}
                    {claim.redeemedAt && <> | Redeemed: {new Date(claim.redeemedAt).toLocaleString()}</>}
                  </div>
                </div>
                {claim.status === "claimed" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => redeemMutation.mutate(claim.id)}
                    disabled={redeemMutation.isPending}
                    data-testid={`button-redeem-${claim.id}`}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Mark Redeemed
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopManagementPanel({ selectedCityId }: { selectedCityId?: string }) {
  const [activeTab, setActiveTab] = useState("items");

  const { data: itemStats } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop/items", selectedCityId, "active"],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "active" });
      if (selectedCityId) params.set("cityId", selectedCityId);
      const res = await fetch(`/api/shop/items?${params.toString()}`);
      return res.json();
    },
  });

  const { data: dropStats } = useQuery<ShopDrop[]>({
    queryKey: ["/api/shop/drops", selectedCityId, "active"],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "active" });
      if (selectedCityId) params.set("cityId", selectedCityId);
      const res = await fetch(`/api/shop/drops?${params.toString()}`);
      return res.json();
    },
  });

  const { data: recentClaims } = useQuery<ShopClaim[]>({
    queryKey: ["/api/shop/claims", "recent"],
    queryFn: async () => {
      const res = await fetch("/api/shop/claims?status=claimed");
      return res.json();
    },
  });

  const activeItems = itemStats?.length || 0;
  const activeDrops = dropStats?.length || 0;
  const claimsThisWeek = recentClaims?.filter(c => {
    const d = new Date(c.claimedAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).length || 0;

  return (
    <div className="space-y-4 p-4 max-w-4xl" data-testid="shop-management-panel">
      <div>
        <h2 className="text-lg font-bold" data-testid="text-shop-title">Shop & Deals</h2>
        <p className="text-xs text-muted-foreground">Manage products, deals, and customer claims</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Package className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs text-muted-foreground">Active Items</span>
          </div>
          <span className="text-xl font-bold" data-testid="stat-active-items">{activeItems}</span>
        </Card>
        <Card className="p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground">Active Drops</span>
          </div>
          <span className="text-xl font-bold" data-testid="stat-active-drops">{activeDrops}</span>
        </Card>
        <Card className="p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TicketPercent className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">Claims (7d)</span>
          </div>
          <span className="text-xl font-bold" data-testid="stat-claims-week">{claimsThisWeek}</span>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-shop">
          <TabsTrigger value="items" data-testid="tab-items">
            <Package className="h-3.5 w-3.5 mr-1" />
            Items
          </TabsTrigger>
          <TabsTrigger value="drops" data-testid="tab-drops">
            <Zap className="h-3.5 w-3.5 mr-1" />
            Drops
          </TabsTrigger>
          <TabsTrigger value="claims" data-testid="tab-claims">
            <TicketPercent className="h-3.5 w-3.5 mr-1" />
            Claims
          </TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <ItemsTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="drops">
          <DropsTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="claims">
          <ClaimsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
