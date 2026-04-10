import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Pencil, Trash2, Loader2, DollarSign, Play, Pause, CheckCircle, XCircle,
  Upload, Volume2, TrendingUp, BarChart3, Megaphone, Clock, FileText
} from "lucide-react";
import { useState, useMemo } from "react";
import type { RadioAdTier, RadioAdBooking } from "@shared/schema";

type EnrichedBooking = RadioAdBooking & { businessName?: string | null; tierName?: string | null };

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
}

function statusColor(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
      return "destructive";
    case "paused":
    case "completed":
      return "outline";
    default:
      return "secondary";
  }
}

function TiersTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RadioAdTier | null>(null);

  const [name, setName] = useState("");
  const [level, setLevel] = useState("metro");
  const [timeSlot, setTimeSlot] = useState("standard");
  const [priceCents, setPriceCents] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [description, setDescription] = useState("");
  const [maxSpotsPerHour, setMaxSpotsPerHour] = useState("4");
  const [spotDurationSeconds, setSpotDurationSeconds] = useState("30");
  const [isActive, setIsActive] = useState(true);

  const { data: tiers, isLoading } = useQuery<RadioAdTier[]>({
    queryKey: ["/api/admin/radio/ad-tiers"],
  });

  const resetForm = (t?: RadioAdTier | null) => {
    setName(t?.name || "");
    setLevel(t?.level || "metro");
    setTimeSlot(t?.timeSlot || "standard");
    setPriceCents(t ? String(t.priceCents) : "");
    setBillingCycle(t?.billingCycle || "monthly");
    setDescription(t?.description || "");
    setMaxSpotsPerHour(String(t?.maxSpotsPerHour ?? 4));
    setSpotDurationSeconds(String(t?.spotDurationSeconds ?? 30));
    setIsActive(t?.isActive ?? true);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (t: RadioAdTier) => { setEditing(t); resetForm(t); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        level,
        timeSlot,
        priceCents: parseInt(priceCents) || 0,
        billingCycle,
        description: description || null,
        maxSpotsPerHour: parseInt(maxSpotsPerHour) || 4,
        spotDurationSeconds: parseInt(spotDurationSeconds) || 30,
        isActive,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/radio/ad-tiers/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/radio/ad-tiers", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/ad-tiers"] });
      toast({ title: editing ? "Tier updated" : "Tier created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving tier", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/radio/ad-tiers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/ad-tiers"] });
      toast({ title: "Tier deleted" });
    },
    onError: () => toast({ title: "Error deleting tier", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading tiers...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-tiers-title">Ad Tiers (3 Levels x 3 Time Slots)</h3>
        <Button onClick={openCreate} data-testid="button-create-tier">
          <Plus className="h-4 w-4 mr-1" /> New Tier
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-center p-3 font-medium">Level</th>
              <th className="text-center p-3 font-medium">Time Slot</th>
              <th className="text-right p-3 font-medium">Price</th>
              <th className="text-center p-3 font-medium">Billing</th>
              <th className="text-center p-3 font-medium">Spots/Hr</th>
              <th className="text-center p-3 font-medium">Duration</th>
              <th className="text-center p-3 font-medium">Active</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(tiers || []).map((t) => (
              <tr key={t.id} className="border-b last:border-b-0" data-testid={`row-tier-${t.id}`}>
                <td className="p-3 font-medium">{t.name}</td>
                <td className="p-3 text-center">
                  <Badge variant="outline">{t.level}</Badge>
                </td>
                <td className="p-3 text-center">
                  <Badge variant="outline">{t.timeSlot}</Badge>
                </td>
                <td className="p-3 text-right font-medium">{formatCents(t.priceCents)}/mo</td>
                <td className="p-3 text-center text-muted-foreground">{t.billingCycle}</td>
                <td className="p-3 text-center">{t.maxSpotsPerHour}</td>
                <td className="p-3 text-center">{t.spotDurationSeconds}s</td>
                <td className="p-3 text-center">
                  <Badge variant={t.isActive ? "default" : "secondary"} data-testid={`badge-active-${t.id}`}>
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)} data-testid={`button-edit-tier-${t.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(t.id)} data-testid={`button-delete-tier-${t.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(tiers || []).length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No ad tiers configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Ad Tier" : "Create Ad Tier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Metro Prime" data-testid="input-tier-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger data-testid="select-tier-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metro">Metro</SelectItem>
                    <SelectItem value="micro">Micro</SelectItem>
                    <SelectItem value="venue">Venue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger data-testid="select-tier-timeslot"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prime">Prime</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="overnight">Overnight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (cents)</Label>
                <Input type="number" value={priceCents} onChange={(e) => setPriceCents(e.target.value)} placeholder="50000" data-testid="input-tier-price" />
              </div>
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger data-testid="select-tier-billing"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Spots/Hour</Label>
                <Input type="number" value={maxSpotsPerHour} onChange={(e) => setMaxSpotsPerHour(e.target.value)} data-testid="input-tier-spots" />
              </div>
              <div className="space-y-2">
                <Label>Spot Duration (sec)</Label>
                <Input type="number" value={spotDurationSeconds} onChange={(e) => setSpotDurationSeconds(e.target.value)} data-testid="input-tier-duration" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" rows={2} data-testid="input-tier-description" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-tier-active" />
              <Label>Active</Label>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name} className="w-full" data-testid="button-save-tier">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Update Tier" : "Create Tier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedBooking | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);

  const [tierId, setTierId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [headline, setHeadline] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: bookings, isLoading } = useQuery<EnrichedBooking[]>({
    queryKey: ["/api/admin/radio/ad-bookings"],
  });

  const { data: tiers } = useQuery<RadioAdTier[]>({
    queryKey: ["/api/admin/radio/ad-tiers"],
  });

  const filtered = useMemo(() => {
    if (!bookings) return [];
    if (statusFilter === "all") return bookings;
    return bookings.filter((b) => b.status === statusFilter);
  }, [bookings, statusFilter]);

  const resetForm = (b?: EnrichedBooking | null) => {
    setTierId(b?.tierId || "");
    setBusinessId(b?.businessId || "");
    setHeadline(b?.headline || "");
    setScriptText(b?.scriptText || "");
    setStartDate(b?.startDate ? new Date(b.startDate).toISOString().split("T")[0] : "");
    setEndDate(b?.endDate ? new Date(b.endDate).toISOString().split("T")[0] : "");
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (b: EnrichedBooking) => { setEditing(b); resetForm(b); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        tierId,
        businessId: businessId || null,
        headline: headline || null,
        scriptText: scriptText || null,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/radio/ad-bookings/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/radio/ad-bookings", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/ad-bookings"] });
      toast({ title: editing ? "Booking updated" : "Booking created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving booking", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/radio/ad-bookings/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/ad-bookings"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Error updating status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/radio/ad-bookings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/ad-bookings"] });
      toast({ title: "Booking deleted" });
    },
    onError: () => toast({ title: "Error deleting booking", variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch(`/api/admin/radio/ad-bookings/${id}/upload-audio`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/ad-bookings"] });
      toast({ title: "Audio uploaded" });
    },
    onError: () => toast({ title: "Error uploading audio", variant: "destructive" }),
  });

  const handleFileUpload = (bookingId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadMutation.mutate({ id: bookingId, file });
    };
    input.click();
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading bookings...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-bookings-title">Ad Bookings</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-booking-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} data-testid="button-create-booking">
            <Plus className="h-4 w-4 mr-1" /> New Booking
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Headline</th>
              <th className="text-left p-3 font-medium">Business</th>
              <th className="text-left p-3 font-medium">Tier</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Dates</th>
              <th className="text-center p-3 font-medium">Audio</th>
              <th className="text-right p-3 font-medium">Paid</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-b last:border-b-0" data-testid={`row-booking-${b.id}`}>
                <td className="p-3 font-medium max-w-[200px] truncate">{b.headline || "-"}</td>
                <td className="p-3 text-muted-foreground">{b.businessName || "-"}</td>
                <td className="p-3 text-muted-foreground">{b.tierName || "-"}</td>
                <td className="p-3 text-center">
                  <Badge variant={statusColor(b.status)} data-testid={`badge-booking-status-${b.id}`}>
                    {b.status}
                  </Badge>
                </td>
                <td className="p-3 text-center text-xs text-muted-foreground">
                  {formatDate(b.startDate)} - {formatDate(b.endDate)}
                </td>
                <td className="p-3 text-center">
                  {b.audioUrl ? (
                    <Button size="icon" variant="ghost" onClick={() => setPreviewAudio(b.audioUrl)} data-testid={`button-play-audio-${b.id}`}>
                      <Play className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </td>
                <td className="p-3 text-right font-medium">{formatCents(b.totalPaidCents)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {b.status === "pending" && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: b.id, status: "approved" })} data-testid={`button-approve-booking-${b.id}`}>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: b.id, status: "rejected" })} data-testid={`button-reject-booking-${b.id}`}>
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                    {b.status === "approved" && (
                      <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: b.id, status: "active" })} data-testid={`button-activate-booking-${b.id}`}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {b.status === "active" && (
                      <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: b.id, status: "paused" })} data-testid={`button-pause-booking-${b.id}`}>
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {b.status === "paused" && (
                      <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: b.id, status: "active" })} data-testid={`button-resume-booking-${b.id}`}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {(b.status === "active" || b.status === "paused") && (
                      <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: b.id, status: "completed" })} data-testid={`button-complete-booking-${b.id}`}>
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => handleFileUpload(b.id)} data-testid={`button-upload-audio-${b.id}`}>
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(b)} data-testid={`button-edit-booking-${b.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(b.id)} data-testid={`button-delete-booking-${b.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No bookings found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {previewAudio && (
        <Dialog open={!!previewAudio} onOpenChange={() => setPreviewAudio(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Audio Preview</DialogTitle>
            </DialogHeader>
            <audio controls src={previewAudio} className="w-full" data-testid="audio-preview-player" />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Booking" : "Create Booking"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={tierId} onValueChange={setTierId}>
                <SelectTrigger data-testid="select-booking-tier"><SelectValue placeholder="Select tier" /></SelectTrigger>
                <SelectContent>
                  {(tiers || []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.level}/{t.timeSlot}) - {formatCents(t.priceCents)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Business ID (optional)</Label>
              <Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="Business ID" data-testid="input-booking-business" />
            </div>
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Ad headline" data-testid="input-booking-headline" />
            </div>
            <div className="space-y-2">
              <Label>Script Text</Label>
              <Textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} className="resize-none" rows={3} placeholder="Ad script / notes" data-testid="input-booking-script" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-booking-start" />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="input-booking-end" />
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !tierId} className="w-full" data-testid="button-save-booking">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Update Booking" : "Create Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InquiriesTab() {
  const { toast } = useToast();
  const { data: bookings, isLoading } = useQuery<EnrichedBooking[]>({
    queryKey: ["/api/admin/radio/ad-bookings"],
  });

  const inquiries = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((b) => b.status === "pending" && b.headline?.startsWith("Inquiry:"));
  }, [bookings]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/radio/ad-bookings/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/ad-bookings"] });
      toast({ title: "Inquiry converted" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading inquiries...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold" data-testid="text-inquiries-title">Inbound Inquiries</h3>
      {inquiries.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground" data-testid="text-no-inquiries">
          <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No pending inquiries
        </Card>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <Card key={inq.id} className="p-4 space-y-2" data-testid={`card-inquiry-${inq.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium" data-testid={`text-inquiry-headline-${inq.id}`}>{inq.headline}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(inq.createdAt)}</p>
                </div>
                <Badge variant="secondary">Inquiry</Badge>
              </div>
              {inq.scriptText && (
                <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid={`text-inquiry-details-${inq.id}`}>{inq.scriptText}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="default"
                  onClick={() => statusMutation.mutate({ id: inq.id, status: "approved" })}
                  disabled={statusMutation.isPending}
                  data-testid={`button-convert-inquiry-${inq.id}`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Convert to Booking
                </Button>
                <Button
                  variant="outline"
                  onClick={() => statusMutation.mutate({ id: inq.id, status: "rejected" })}
                  disabled={statusMutation.isPending}
                  data-testid={`button-decline-inquiry-${inq.id}`}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Decline
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RevenueTab() {
  const { data: bookings } = useQuery<EnrichedBooking[]>({
    queryKey: ["/api/admin/radio/ad-bookings"],
  });

  const { data: tiers } = useQuery<RadioAdTier[]>({
    queryKey: ["/api/admin/radio/ad-tiers"],
  });

  const stats = useMemo(() => {
    if (!bookings || !tiers) return null;

    const activeBookings = bookings.filter((b) => b.status === "active");
    const completedBookings = bookings.filter((b) => b.status === "completed");
    const totalEarned = bookings.reduce((sum, b) => sum + (b.totalPaidCents || 0), 0);

    const byLevel: Record<string, { active: number; completed: number; revenue: number }> = {};
    for (const b of bookings) {
      const tier = tiers.find((t) => t.id === b.tierId);
      const level = tier?.level || "unknown";
      if (!byLevel[level]) byLevel[level] = { active: 0, completed: 0, revenue: 0 };
      if (b.status === "active") byLevel[level].active++;
      if (b.status === "completed") byLevel[level].completed++;
      byLevel[level].revenue += b.totalPaidCents || 0;
    }

    return { activeBookings: activeBookings.length, completedBookings: completedBookings.length, totalEarned, byLevel };
  }, [bookings, tiers]);

  if (!stats) return <div className="text-sm text-muted-foreground p-4">Loading revenue data...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold" data-testid="text-revenue-title">Radio Ad Revenue</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4" data-testid="card-stat-active">
          <div className="flex items-center gap-2 mb-1">
            <Play className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Active Bookings</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-active-count">{stats.activeBookings}</p>
        </Card>
        <Card className="p-4" data-testid="card-stat-completed">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Completed</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-completed-count">{stats.completedBookings}</p>
        </Card>
        <Card className="p-4" data-testid="card-stat-revenue">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-total-revenue">{formatCents(stats.totalEarned)}</p>
        </Card>
      </div>

      <Card className="p-4" data-testid="card-revenue-by-level">
        <h4 className="font-medium mb-3">Revenue by Tier Level</h4>
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Level</th>
                <th className="text-center p-3 font-medium">Active</th>
                <th className="text-center p-3 font-medium">Completed</th>
                <th className="text-right p-3 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.byLevel).map(([level, data]) => (
                <tr key={level} className="border-b last:border-b-0" data-testid={`row-revenue-${level}`}>
                  <td className="p-3 font-medium capitalize">{level}</td>
                  <td className="p-3 text-center">{data.active}</td>
                  <td className="p-3 text-center">{data.completed}</td>
                  <td className="p-3 text-right font-medium">{formatCents(data.revenue)}</td>
                </tr>
              ))}
              {Object.keys(stats.byLevel).length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No revenue data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function RadioAdsPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Megaphone className="h-5 w-5" />
        <h2 className="text-lg font-bold" data-testid="text-radio-ads-title">Radio Advertising</h2>
      </div>

      <Tabs defaultValue="tiers">
        <TabsList data-testid="tabs-radio-ads">
          <TabsTrigger value="tiers" data-testid="tab-tiers">
            <DollarSign className="h-4 w-4 mr-1" /> Tiers
          </TabsTrigger>
          <TabsTrigger value="bookings" data-testid="tab-bookings">
            <FileText className="h-4 w-4 mr-1" /> Bookings
          </TabsTrigger>
          <TabsTrigger value="inquiries" data-testid="tab-inquiries">
            <Megaphone className="h-4 w-4 mr-1" /> Inquiries
          </TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">
            <TrendingUp className="h-4 w-4 mr-1" /> Revenue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiers">
          <TiersTab />
        </TabsContent>
        <TabsContent value="bookings">
          <BookingsTab />
        </TabsContent>
        <TabsContent value="inquiries">
          <InquiriesTab />
        </TabsContent>
        <TabsContent value="revenue">
          <RevenueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
