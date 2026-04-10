import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Crown, Check, Edit, Save } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";

interface ListingTier {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  maxPhotos: number;
  allowVideo: boolean;
  allowSocialLinks: boolean;
  priorityBoost: number;
  badgeText: string | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
}

function TierEditDialog({ tier, onClose }: { tier: ListingTier; onClose: () => void }) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(tier.displayName);
  const [description, setDescription] = useState(tier.description || "");
  const [monthlyPrice, setMonthlyPrice] = useState(tier.monthlyPrice);
  const [annualPrice, setAnnualPrice] = useState(tier.annualPrice);
  const [features, setFeatures] = useState((tier.features || []).join("\n"));
  const [maxPhotos, setMaxPhotos] = useState(tier.maxPhotos);
  const [allowVideo, setAllowVideo] = useState(tier.allowVideo);
  const [allowSocialLinks, setAllowSocialLinks] = useState(tier.allowSocialLinks);
  const [priorityBoost, setPriorityBoost] = useState(tier.priorityBoost);
  const [badgeText, setBadgeText] = useState(tier.badgeText || "");
  const [stripePriceIdMonthly, setStripePriceIdMonthly] = useState(tier.stripePriceIdMonthly || "");
  const [stripePriceIdAnnual, setStripePriceIdAnnual] = useState(tier.stripePriceIdAnnual || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/listing-tiers/${tier.id}`, {
        displayName,
        description: description || null,
        monthlyPrice,
        annualPrice,
        features: features.split("\n").map((f) => f.trim()).filter(Boolean),
        maxPhotos,
        allowVideo,
        allowSocialLinks,
        priorityBoost,
        badgeText: badgeText || null,
        stripePriceIdMonthly: stripePriceIdMonthly || null,
        stripePriceIdAnnual: stripePriceIdAnnual || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listing-tiers"] });
      toast({ title: "Tier updated successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to update tier", variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" /> Edit: {tier.displayName}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Display Name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} data-testid="input-tier-displayName" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-tier-description" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Monthly Price (cents)</Label>
            <Input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(parseInt(e.target.value) || 0)} data-testid="input-tier-monthlyPrice" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Annual Price (cents)</Label>
            <Input type="number" value={annualPrice} onChange={(e) => setAnnualPrice(parseInt(e.target.value) || 0)} data-testid="input-tier-annualPrice" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Features (one per line)</Label>
          <Textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={4} data-testid="input-tier-features" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Max Photos</Label>
            <Input type="number" value={maxPhotos} onChange={(e) => setMaxPhotos(parseInt(e.target.value) || 0)} data-testid="input-tier-maxPhotos" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Priority Boost</Label>
            <Input type="number" value={priorityBoost} onChange={(e) => setPriorityBoost(parseInt(e.target.value) || 0)} data-testid="input-tier-priorityBoost" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={allowVideo} onCheckedChange={setAllowVideo} data-testid="switch-tier-allowVideo" />
            <Label className="text-sm">Allow Video</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={allowSocialLinks} onCheckedChange={setAllowSocialLinks} data-testid="switch-tier-allowSocialLinks" />
            <Label className="text-sm">Allow Social Links</Label>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Badge Text</Label>
          <Input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="e.g. Premium, Verified" data-testid="input-tier-badgeText" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Stripe Price ID (Monthly)</Label>
            <Input value={stripePriceIdMonthly} onChange={(e) => setStripePriceIdMonthly(e.target.value)} placeholder="price_..." data-testid="input-tier-stripePriceIdMonthly" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Stripe Price ID (Annual)</Label>
            <Input value={stripePriceIdAnnual} onChange={(e) => setStripePriceIdAnnual(e.target.value)} placeholder="price_..." data-testid="input-tier-stripePriceIdAnnual" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-tier">
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function ListingTiers({ cityId }: { cityId?: string }) {
  const [editingTier, setEditingTier] = useState<ListingTier | null>(null);

  const { data: tiers, isLoading } = useQuery<ListingTier[]>({
    queryKey: ["/api/admin/listing-tiers", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/listing-tiers?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load listing tiers");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-listing-tiers-title">
          <Crown className="h-5 w-5" /> Listing Tiers
        </h2>
        <p className="text-sm text-muted-foreground">Manage listing tier definitions and pricing</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading tiers...</div>
      ) : !tiers || tiers.length === 0 ? (
        <Card className="p-8 text-center">
          <Crown className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No tiers found</h3>
          <p className="text-sm text-muted-foreground">Listing tiers have not been configured yet</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <Card key={tier.id} className="p-4 space-y-3" data-testid={`card-tier-${tier.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold" data-testid={`text-tier-name-${tier.id}`}>{tier.displayName}</h3>
                  {tier.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>
                  )}
                </div>
                <Dialog open={editingTier?.id === tier.id} onOpenChange={(open) => setEditingTier(open ? tier : null)}>
                  <Button size="sm" variant="outline" onClick={() => setEditingTier(tier)} data-testid={`button-edit-tier-${tier.id}`}>
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {editingTier?.id === tier.id && (
                    <TierEditDialog tier={tier} onClose={() => setEditingTier(null)} />
                  )}
                </Dialog>
              </div>

              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-lg font-bold" data-testid={`text-tier-price-${tier.id}`}>
                  ${(tier.monthlyPrice / 100).toFixed(2)}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </span>
                {tier.annualPrice > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ${(tier.annualPrice / 100).toFixed(2)}/yr
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {tier.badgeText && <Badge variant="secondary" data-testid={`badge-tier-${tier.id}`}>{tier.badgeText}</Badge>}
                <Badge variant="outline" className="text-[10px]">{tier.maxPhotos} photos</Badge>
                {tier.allowVideo && <Badge variant="outline" className="text-[10px]">Video</Badge>}
                {tier.allowSocialLinks && <Badge variant="outline" className="text-[10px]">Social</Badge>}
                {tier.priorityBoost > 0 && <Badge variant="outline" className="text-[10px]">+{tier.priorityBoost} boost</Badge>}
              </div>

              {tier.features && tier.features.length > 0 && (
                <ul className="space-y-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="text-xs flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
