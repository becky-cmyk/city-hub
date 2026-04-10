import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Star, Landmark, MapPin, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Attraction, Zone } from "@shared/schema";
import { useDefaultCityId, useAdminCitySelection } from "@/hooks/use-city";

const ATTRACTION_TYPES = [
  { value: "HISTORICAL", label: "Historical" },
  { value: "PARK", label: "Park" },
  { value: "LANDMARK", label: "Landmark" },
  { value: "HIDDEN_GEM", label: "Hidden Gem" },
  { value: "MUSEUM", label: "Museum" },
  { value: "TOUR", label: "Tour" },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function AttractionForm({ attraction, zones, onClose }: { attraction?: Attraction; zones: Zone[]; onClose: () => void }) {
  const CITY_ID = useDefaultCityId();
  const { toast } = useToast();
  const [name, setName] = useState(attraction?.name || "");
  const [slug, setSlug] = useState(attraction?.slug || "");
  const [description, setDescription] = useState(attraction?.description || "");
  const [address, setAddress] = useState(attraction?.address || "");
  const [imageUrl, setImageUrl] = useState(attraction?.imageUrl || "");
  const [attractionType, setAttractionType] = useState<string>(attraction?.attractionType || "LANDMARK");
  const [funFact, setFunFact] = useState(attraction?.funFact || "");
  const [isFeatured, setIsFeatured] = useState(attraction?.isFeatured || false);
  const [zoneId, setZoneId] = useState(attraction?.zoneId || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        slug: slug || slugify(name),
        description: description || null,
        address: address || null,
        imageUrl: imageUrl || null,
        attractionType,
        funFact: funFact || null,
        isFeatured,
        cityId: CITY_ID,
        zoneId: zoneId || null,
      };
      if (attraction) {
        await apiRequest("PATCH", `/api/admin/attractions/${attraction.id}`, payload);
      } else {
        await apiRequest("POST", `/api/admin/attractions`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attractions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cities"] });
      toast({ title: attraction ? "Attraction updated" : "Attraction created" });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); if (!attraction) setSlug(slugify(e.target.value)); }} data-testid="input-attraction-name" />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} data-testid="input-attraction-slug" />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={attractionType} onValueChange={setAttractionType}>
            <SelectTrigger data-testid="select-attraction-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTRACTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Zone</Label>
          <Select value={zoneId || "none"} onValueChange={(v) => setZoneId(v === "none" ? "" : v)}>
            <SelectTrigger data-testid="select-attraction-zone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Zone</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-attraction-address" />
        </div>
        <div className="sm:col-span-2">
          <Label>Image URL</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} data-testid="input-attraction-imageurl" />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} data-testid="input-attraction-description" />
        </div>
        <div className="sm:col-span-2">
          <Label className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Fun Fact</Label>
          <Textarea value={funFact} onChange={(e) => setFunFact(e.target.value)} rows={2} placeholder="Did you know?" data-testid="input-attraction-funfact" />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isFeatured} onCheckedChange={setIsFeatured} data-testid="switch-attraction-featured" />
          <Label>Featured</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-attraction">Cancel</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending} data-testid="button-save-attraction">
          {saveMutation.isPending ? "Saving..." : attraction ? "Update" : "Create"}
        </Button>
      </div>
    </div>
  );
}

export default function AttractionsPanel({ cityId }: { cityId?: string }) {
  const { selectedCitySlug } = useAdminCitySelection();
  const CITY_SLUG = selectedCitySlug;
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Attraction | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: attractions, isLoading } = useQuery<Attraction[]>({
    queryKey: ["/api/admin/attractions"],
  });

  const { data: zones } = useQuery<Zone[]>({
    queryKey: ["/api/cities", CITY_SLUG, "zones"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/attractions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attractions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cities", CITY_SLUG, "attractions"] });
      toast({ title: "Attraction deleted" });
      setDeletingId(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-admin-attractions-title">
            <Landmark className="h-5 w-5" /> Attractions
          </h2>
          <p className="text-sm text-muted-foreground">{attractions?.length || 0} total</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setShowForm(true); }} className="gap-1" data-testid="button-add-attraction">
          <Plus className="h-4 w-4" /> Add Attraction
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Attraction" : "New Attraction"}</DialogTitle>
          </DialogHeader>
          <AttractionForm attraction={editing} zones={zones || []} onClose={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attraction?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)} data-testid="button-confirm-delete">Delete</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-1/2 mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      ) : attractions && attractions.length > 0 ? (
        <div className="space-y-3">
          {attractions.map((a) => (
            <Card key={a.id} className="p-4" data-testid={`card-admin-attraction-${a.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{a.name}</h3>
                    {a.isFeatured && <Badge variant="secondary" className="text-[10px]"><Star className="h-3 w-3 mr-0.5" />Featured</Badge>}
                    <Badge variant="outline" className="text-[10px]">{a.attractionType}</Badge>
                  </div>
                  {a.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {a.address}
                    </p>
                  )}
                  {a.funFact && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                      <Sparkles className="h-3 w-3 shrink-0 mt-0.5" /> {a.funFact}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setShowForm(true); }} data-testid={`button-edit-attraction-${a.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeletingId(a.id)} data-testid={`button-delete-attraction-${a.id}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Landmark className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-muted-foreground">No attractions yet</p>
        </Card>
      )}
    </div>
  );
}
