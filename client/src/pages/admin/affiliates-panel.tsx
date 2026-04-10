import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, ExternalLink, Loader2, Car, UtensilsCrossed, Check, X } from "lucide-react";

interface Affiliate {
  id: string;
  name: string;
  url: string | null;
  affiliateId: string | null;
  category: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlatformAffiliate {
  platform: string;
  affiliateId: string | null;
  enabled: boolean;
}

const AFFILIATE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "technology", label: "Technology" },
  { value: "finance", label: "Finance" },
  { value: "health", label: "Health & Wellness" },
  { value: "food", label: "Food & Beverage" },
  { value: "retail", label: "Retail" },
  { value: "travel", label: "Travel" },
  { value: "entertainment", label: "Entertainment" },
  { value: "education", label: "Education" },
  { value: "services", label: "Services" },
  { value: "media", label: "Media" },
  { value: "real-estate", label: "Real Estate" },
  { value: "automotive", label: "Automotive" },
  { value: "other", label: "Other" },
];

const PLATFORM_META: Record<string, { label: string; type: "ride" | "delivery"; description: string; signupUrl: string }> = {
  uber: { label: "Uber (Rides)", type: "ride", description: "Earn commissions on new rider signups via Impact.com", signupUrl: "https://partners.uber.com/" },
  lyft: { label: "Lyft (Rides)", type: "ride", description: "Earn per new rider referral via Impact.com", signupUrl: "https://www.lyft.com/partners" },
  doordash: { label: "DoorDash", type: "delivery", description: "Earn on first-time orders via Impact.com/CJ", signupUrl: "https://www.doordash.com/affiliates" },
  ubereats: { label: "Uber Eats", type: "delivery", description: "Same affiliate network as Uber Rides", signupUrl: "https://partners.uber.com/" },
  grubhub: { label: "Grubhub", type: "delivery", description: "Earn per new customer order via CJ Affiliate", signupUrl: "https://www.grubhub.com/partner" },
  postmates: { label: "Postmates", type: "delivery", description: "Now part of Uber Eats affiliate program", signupUrl: "https://partners.uber.com/" },
};

function PlatformCard({ affiliate }: { affiliate: PlatformAffiliate }) {
  const { toast } = useToast();
  const meta = PLATFORM_META[affiliate.platform] || { label: affiliate.platform, type: "delivery", description: "", signupUrl: "" };
  const [localId, setLocalId] = useState(affiliate.affiliateId || "");
  const [localEnabled, setLocalEnabled] = useState(affiliate.enabled);

  useEffect(() => {
    setLocalId(affiliate.affiliateId || "");
    setLocalEnabled(affiliate.enabled);
  }, [affiliate]);

  const mutation = useMutation({
    mutationFn: async (data: { affiliateId?: string; enabled?: boolean }) => {
      await apiRequest("PATCH", `/api/admin/platform-affiliates/${affiliate.platform}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-affiliates"] });
      toast({ title: `${meta.label} updated` });
    },
  });

  return (
    <Card className="p-4 space-y-3" data-testid={`card-platform-affiliate-${affiliate.platform}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {meta.type === "ride" ? <Car className="h-4 w-4 text-muted-foreground" /> : <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">{meta.label}</span>
          {localEnabled ? (
            <Badge variant="outline" className="text-green-600 border-green-200 text-[10px]">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px]">Disabled</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={localEnabled ? "outline" : "default"}
          className="h-7 text-xs"
          onClick={() => {
            const next = !localEnabled;
            setLocalEnabled(next);
            mutation.mutate({ enabled: next });
          }}
          disabled={mutation.isPending}
          data-testid={`button-toggle-${affiliate.platform}`}
        >
          {localEnabled ? <><X className="h-3 w-3 mr-1" /> Disable</> : <><Check className="h-3 w-3 mr-1" /> Enable</>}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{meta.description}</p>
      <div className="flex items-center gap-2">
        <Input
          value={localId}
          onChange={(e) => setLocalId(e.target.value)}
          placeholder="Enter your affiliate/partner ID..."
          className="text-sm"
          data-testid={`input-affiliate-${affiliate.platform}`}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => mutation.mutate({ affiliateId: localId || "" })}
          disabled={mutation.isPending}
          data-testid={`button-save-${affiliate.platform}`}
        >
          Save
        </Button>
      </div>
      {meta.signupUrl && (
        <a href={meta.signupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline" data-testid={`link-signup-${affiliate.platform}`}>
          Sign up for affiliate program
        </a>
      )}
    </Card>
  );
}

function PlatformAffiliatesSection() {
  const { data: affiliates, isLoading } = useQuery<PlatformAffiliate[]>({
    queryKey: ["/api/admin/platform-affiliates"],
  });

  const rideAffiliates = affiliates?.filter(a => PLATFORM_META[a.platform]?.type === "ride") || [];
  const deliveryAffiliates = affiliates?.filter(a => PLATFORM_META[a.platform]?.type === "delivery") || [];

  if (isLoading) return <div className="text-sm text-muted-foreground p-6">Loading platform affiliates...</div>;

  return (
    <div className="space-y-4" data-testid="section-platform-affiliates">
      <div>
        <h3 className="text-base font-semibold">Platform Affiliates</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Earn commissions when users click through to ride-hailing and food delivery platforms. Enter your affiliate/partner IDs below.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ride-Hailing</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {rideAffiliates.map(a => <PlatformCard key={a.platform} affiliate={a} />)}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Food Delivery</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {deliveryAffiliates.map(a => <PlatformCard key={a.platform} affiliate={a} />)}
        </div>
      </div>
    </div>
  );
}

function AffiliateForm({ affiliate, onSave, onCancel, isPending }: {
  affiliate?: Affiliate;
  onSave: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(affiliate?.name || "");
  const [url, setUrl] = useState(affiliate?.url || "");
  const [affId, setAffId] = useState(affiliate?.affiliateId || "");
  const [category, setCategory] = useState(affiliate?.category || "general");
  const [status, setStatus] = useState(affiliate?.status || "active");
  const [notes, setNotes] = useState(affiliate?.notes || "");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), url: url.trim() || null, affiliateId: affId.trim() || null, category, status, notes: notes.trim() || null });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner name" data-testid="input-affiliate-name" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." data-testid="input-affiliate-url" />
        </div>
        <div className="space-y-2">
          <Label>Affiliate ID</Label>
          <Input value={affId} onChange={(e) => setAffId(e.target.value)} placeholder="Partner/Affiliate ID" data-testid="input-affiliate-id" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-affiliate-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AFFILIATE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-affiliate-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about this affiliate..." rows={3} data-testid="input-affiliate-notes" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-affiliate">Cancel</Button>
        <Button onClick={handleSubmit} disabled={!name.trim() || isPending} data-testid="button-save-affiliate">
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {affiliate ? "Update" : "Add"} Affiliate
        </Button>
      </div>
    </div>
  );
}

export default function AffiliatesPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);

  const { data: affiliatesList, isLoading } = useQuery<Affiliate[]>({
    queryKey: ["/api/admin/affiliates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const resp = await apiRequest("POST", "/api/admin/affiliates", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates"] });
      toast({ title: "Affiliate added" });
      setShowForm(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to add affiliate", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const resp = await apiRequest("PATCH", `/api/admin/affiliates/${id}`, data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates"] });
      toast({ title: "Affiliate updated" });
      setEditingAffiliate(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update affiliate", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/affiliates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates"] });
      toast({ title: "Affiliate deleted" });
    },
  });

  const activeCount = affiliatesList?.filter(a => a.status === "active").length || 0;

  return (
    <div className="space-y-8" data-testid="panel-affiliates">
      <div>
        <h2 className="text-lg font-semibold">Affiliates</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage platform affiliates and affiliate partners in one place.
        </p>
      </div>

      <PlatformAffiliatesSection />

      <hr className="border-border" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Affiliate Partners</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage affiliate partners across all categories. {activeCount} active affiliate{activeCount !== 1 ? "s" : ""}.
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} data-testid="button-add-affiliate">
            <Plus className="h-4 w-4 mr-1" /> Add Affiliate
          </Button>
        </div>

        {showForm && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">New Affiliate</h3>
            <AffiliateForm
              onSave={(data) => createMutation.mutate(data)}
              onCancel={() => setShowForm(false)}
              isPending={createMutation.isPending}
            />
          </Card>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground p-6">Loading affiliates...</div>
        ) : !affiliatesList?.length ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No affiliates yet. Add your first affiliate partner above.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {affiliatesList.map((aff) => (
              <Card key={aff.id} className="p-4" data-testid={`card-affiliate-${aff.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{aff.name}</span>
                      <Badge variant={aff.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {aff.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {AFFILIATE_CATEGORIES.find(c => c.value === aff.category)?.label || aff.category}
                      </Badge>
                    </div>
                    {aff.affiliateId && (
                      <p className="text-xs text-muted-foreground mt-1">ID: {aff.affiliateId}</p>
                    )}
                    {aff.url && (
                      <a href={aff.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1 mt-1" data-testid={`link-affiliate-${aff.id}`}>
                        <ExternalLink className="h-3 w-3" /> {aff.url}
                      </a>
                    )}
                    {aff.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{aff.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => setEditingAffiliate(aff)} data-testid={`button-edit-affiliate-${aff.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(aff.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-affiliate-${aff.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editingAffiliate} onOpenChange={(open) => !open && setEditingAffiliate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Affiliate</DialogTitle>
          </DialogHeader>
          {editingAffiliate && (
            <AffiliateForm
              affiliate={editingAffiliate}
              onSave={(data) => updateMutation.mutate({ id: editingAffiliate.id, data })}
              onCancel={() => setEditingAffiliate(null)}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
