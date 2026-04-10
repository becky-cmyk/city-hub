import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Trash2, Edit, Check, X } from "lucide-react";

interface MapPlacement {
  id: string;
  city_id: string;
  type: string;
  business_id?: string;
  zone_id?: string;
  title?: string;
  tagline?: string;
  logo_url?: string;
  cta_url?: string;
  cta_text?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  business_name?: string;
  created_at: string;
}

export default function MapPlacementsPanel({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "promoted_pin" as string,
    businessId: "",
    zoneId: "",
    title: "",
    tagline: "",
    logoUrl: "",
    ctaUrl: "",
    ctaText: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  const { data: placements, isLoading } = useQuery<MapPlacement[]>({
    queryKey: ["/api/admin/map-placements", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/map-placements?cityId=${cityId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: businesses } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/admin/businesses-list", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses?cityId=${cityId}&limit=500`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map((b: any) => ({ id: b.id, name: b.name }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/map-placements", {
        cityId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/map-placements"] });
      toast({ title: "Placement created" });
      resetForm();
    },
    onError: () => toast({ title: "Failed to create placement", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/map-placements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/map-placements"] });
      toast({ title: "Placement updated" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/map-placements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/map-placements"] });
      toast({ title: "Placement deleted" });
    },
  });

  const resetForm = () => {
    setForm({ type: "promoted_pin", businessId: "", zoneId: "", title: "", tagline: "", logoUrl: "", ctaUrl: "", ctaText: "", startDate: "", endDate: "", isActive: true });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const typeColors: Record<string, string> = {
    promoted_pin: "bg-purple-500/20 text-purple-300",
    zone_overlay: "bg-blue-500/20 text-blue-300",
    business_card_ad: "bg-yellow-500/20 text-yellow-300",
  };

  return (
    <div className="space-y-6" data-testid="map-placements-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-500" />
            Map Placements
          </h2>
          <p className="text-sm text-muted-foreground">Manage sponsored map pins, zone overlays, and card ads</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" data-testid="button-add-placement">
          <Plus className="w-4 h-4 mr-1" />
          Add Placement
        </Button>
      </div>

      {(showForm || editingId) && (
        <div className="border rounded-lg p-4 space-y-3 bg-card" data-testid="placement-form">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm bg-background"
                data-testid="select-placement-type"
              >
                <option value="promoted_pin">Promoted Pin</option>
                <option value="zone_overlay">Zone Overlay</option>
                <option value="business_card_ad">Business Card Ad</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Business</label>
              <select
                value={form.businessId}
                onChange={e => setForm(f => ({ ...f, businessId: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm bg-background"
                data-testid="select-placement-business"
              >
                <option value="">Select business...</option>
                {businesses?.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Display title" data-testid="input-placement-title" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tagline</label>
              <Input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Short tagline" data-testid="input-placement-tagline" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Zone ID (for overlays)</label>
              <Input value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))} placeholder="Zone ID" data-testid="input-placement-zone" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Logo URL</label>
              <Input value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." data-testid="input-placement-logo" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">CTA URL</label>
              <Input value={form.ctaUrl} onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))} placeholder="https://..." data-testid="input-placement-cta-url" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">CTA Text</label>
              <Input value={form.ctaText} onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))} placeholder="Learn More" data-testid="input-placement-cta-text" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Start Date</label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} data-testid="input-placement-start" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End Date</label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} data-testid="input-placement-end" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-placement">
              <Check className="w-4 h-4 mr-1" />
              {editingId ? "Update" : "Create"}
            </Button>
            <Button size="sm" variant="outline" onClick={resetForm} data-testid="button-cancel-placement">
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : !placements?.length ? (
        <div className="text-center py-12 border rounded-lg">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-muted-foreground">No map placements yet</p>
          <p className="text-xs text-muted-foreground/60">Create promoted pins, zone overlays, or card ads</p>
        </div>
      ) : (
        <div className="space-y-2">
          {placements.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card" data-testid={`placement-row-${p.id}`}>
              <Badge className={typeColors[p.type] || "bg-gray-500/20 text-gray-300"}>
                {p.type.replace(/_/g, " ")}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title || p.business_name || "Untitled"}</p>
                {p.tagline && <p className="text-xs text-muted-foreground truncate">{p.tagline}</p>}
              </div>
              <Badge variant={p.is_active ? "default" : "secondary"}>
                {p.is_active ? "Active" : "Inactive"}
              </Badge>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingId(p.id);
                    setForm({
                      type: p.type,
                      businessId: p.business_id || "",
                      zoneId: p.zone_id || "",
                      title: p.title || "",
                      tagline: p.tagline || "",
                      logoUrl: p.logo_url || "",
                      ctaUrl: p.cta_url || "",
                      ctaText: p.cta_text || "",
                      startDate: p.start_date ? new Date(p.start_date).toISOString().split("T")[0] : "",
                      endDate: p.end_date ? new Date(p.end_date).toISOString().split("T")[0] : "",
                      isActive: p.is_active,
                    });
                    setShowForm(true);
                  }}
                  data-testid={`button-edit-${p.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-400"
                  onClick={() => deleteMutation.mutate(p.id)}
                  data-testid={`button-delete-${p.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
