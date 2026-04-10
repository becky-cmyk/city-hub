import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Plus, Edit, Trash2, ArrowLeft, Calendar, MapPin, DollarSign, Users } from "lucide-react";

const EVENT_STATUSES = ["draft", "selling", "active", "completed", "canceled"] as const;
const PARTICIPATION_STATUSES = ["invited", "applied", "accepted", "paid", "checked_in", "no_show"] as const;

const EVENT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  selling: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  canceled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const PARTICIPATION_COLORS: Record<string, string> = {
  invited: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  applied: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  checked_in: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  no_show: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

interface CrmEvent {
  id: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
  venueName: string | null;
  status: string;
  notes: string | null;
}

interface EventVendor {
  id: string;
  eventId: string;
  vendorId: string;
  participationStatus: string;
  boothDetails: string | null;
  amountDueCents: number | null;
  amountPaidCents: number | null;
  vendor?: { id: string; name: string };
}

interface CrmEventDetail extends CrmEvent {
  vendors: EventVendor[];
}

interface Vendor {
  id: string;
  name: string;
}

function formatDateTime(dt: string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toDateTimeLocal(dt: string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function centsToDisplay(cents: number | null): string {
  if (cents == null) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function CreateEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/crm-events", {
        name,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        venueName: venueName || null,
        status,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-events"] });
      toast({ title: "Event created" });
      setName(""); setStartAt(""); setEndAt(""); setVenueName(""); setStatus("draft"); setNotes("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error creating event", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" data-testid="input-event-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} data-testid="input-event-startAt" />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} data-testid="input-event-endAt" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Venue</Label>
              <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Venue name" data-testid="input-event-venueName" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-event-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Additional notes..." data-testid="input-event-notes" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !name} data-testid="button-save-event">
              {createMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddVendorDialog({ eventId, open, onOpenChange }: { eventId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState("");
  const [participationStatus, setParticipationStatus] = useState("invited");
  const [boothDetails, setBoothDetails] = useState("");
  const [amountDueCents, setAmountDueCents] = useState("");
  const [amountPaidCents, setAmountPaidCents] = useState("");

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/admin/vendors"],
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/admin/crm-events/${eventId}/vendors`, {
        vendorId,
        participationStatus,
        boothDetails: boothDetails || null,
        amountDueCents: amountDueCents ? Math.round(parseFloat(amountDueCents) * 100) : null,
        amountPaidCents: amountPaidCents ? Math.round(parseFloat(amountPaidCents) * 100) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-events", eventId] });
      toast({ title: "Vendor added to event" });
      setVendorId(""); setParticipationStatus("invited"); setBoothDetails(""); setAmountDueCents(""); setAmountPaidCents("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error adding vendor", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vendor to Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Vendor *</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger data-testid="select-add-vendor">
                <SelectValue placeholder="Select a vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Participation Status</Label>
            <Select value={participationStatus} onValueChange={setParticipationStatus}>
              <SelectTrigger data-testid="select-add-participation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTICIPATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Booth Details</Label>
            <Input value={boothDetails} onChange={(e) => setBoothDetails(e.target.value)} placeholder="e.g. Booth A-12" data-testid="input-add-boothDetails" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount Due ($)</Label>
              <Input type="number" step="0.01" value={amountDueCents} onChange={(e) => setAmountDueCents(e.target.value)} placeholder="0.00" data-testid="input-add-amountDue" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount Paid ($)</Label>
              <Input type="number" step="0.01" value={amountPaidCents} onChange={(e) => setAmountPaidCents(e.target.value)} placeholder="0.00" data-testid="input-add-amountPaid" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !vendorId} data-testid="button-save-add-vendor">
              {addMutation.isPending ? "Adding..." : "Add Vendor"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add-vendor">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditVendorDialog({ ev, open, onOpenChange }: { ev: EventVendor; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [participationStatus, setParticipationStatus] = useState(ev.participationStatus);
  const [boothDetails, setBoothDetails] = useState(ev.boothDetails || "");
  const [amountDueCents, setAmountDueCents] = useState(ev.amountDueCents != null ? (ev.amountDueCents / 100).toFixed(2) : "");
  const [amountPaidCents, setAmountPaidCents] = useState(ev.amountPaidCents != null ? (ev.amountPaidCents / 100).toFixed(2) : "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/event-vendors/${ev.id}`, {
        participationStatus,
        boothDetails: boothDetails || null,
        amountDueCents: amountDueCents ? Math.round(parseFloat(amountDueCents) * 100) : null,
        amountPaidCents: amountPaidCents ? Math.round(parseFloat(amountPaidCents) * 100) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-events", ev.eventId] });
      toast({ title: "Vendor participation updated" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error updating vendor", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Vendor Participation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Participation Status</Label>
            <Select value={participationStatus} onValueChange={setParticipationStatus}>
              <SelectTrigger data-testid="select-edit-participation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTICIPATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Booth Details</Label>
            <Input value={boothDetails} onChange={(e) => setBoothDetails(e.target.value)} placeholder="e.g. Booth A-12" data-testid="input-edit-boothDetails" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount Due ($)</Label>
              <Input type="number" step="0.01" value={amountDueCents} onChange={(e) => setAmountDueCents(e.target.value)} placeholder="0.00" data-testid="input-edit-amountDue" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount Paid ($)</Label>
              <Input type="number" step="0.01" value={amountPaidCents} onChange={(e) => setAmountPaidCents(e.target.value)} placeholder="0.00" data-testid="input-edit-amountPaid" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-edit-vendor">
              {updateMutation.isPending ? "Saving..." : "Update"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit-vendor">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventDetailView({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<EventVendor | null>(null);
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);

  const { data: event, isLoading } = useQuery<CrmEventDetail>({
    queryKey: ["/api/admin/crm-events", eventId],
  });

  const [name, setName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");

  const startEdit = () => {
    if (!event) return;
    setName(event.name);
    setStartAt(toDateTimeLocal(event.startAt));
    setEndAt(toDateTimeLocal(event.endAt));
    setVenueName(event.venueName || "");
    setStatus(event.status);
    setNotes(event.notes || "");
    setIsEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/crm-events/${eventId}`, {
        name,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        venueName: venueName || null,
        status,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-events", eventId] });
      toast({ title: "Event updated" });
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast({ title: "Error updating event", description: err.message, variant: "destructive" });
    },
  });

  const updateParticipationMutation = useMutation({
    mutationFn: async ({ id, participationStatus }: { id: string; participationStatus: string }) => {
      return apiRequest("PATCH", `/api/admin/event-vendors/${id}`, { participationStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-events", eventId] });
      toast({ title: "Participation status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error updating status", description: err.message, variant: "destructive" });
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/event-vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-events", eventId] });
      toast({ title: "Vendor removed from event" });
      setDeletingVendorId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error removing vendor", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Event not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4" data-testid="button-back-not-found">Go Back</Button>
      </Card>
    );
  }

  const vendors = event.vendors || [];
  const totalDue = vendors.reduce((sum, v) => sum + (v.amountDueCents || 0), 0);
  const totalPaid = vendors.reduce((sum, v) => sum + (v.amountPaidCents || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-semibold" data-testid="text-event-detail-name">{event.name}</h2>
        <Badge className={`text-[10px] capitalize ${EVENT_STATUS_COLORS[event.status] || ""}`} data-testid="badge-event-detail-status">
          {event.status}
        </Badge>
      </div>

      <Tabs defaultValue="info">
        <TabsList data-testid="tabs-event-detail">
          <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
          <TabsTrigger value="vendors" data-testid="tab-vendors">Vendors ({vendors.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="p-4">
            {isEditing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-edit-event-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Start</Label>
                    <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} data-testid="input-edit-event-startAt" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End</Label>
                    <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} data-testid="input-edit-event-endAt" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Venue</Label>
                    <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} data-testid="input-edit-event-venueName" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger data-testid="select-edit-event-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} data-testid="input-edit-event-notes" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !name} data-testid="button-save-event-edit">
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2 flex-1 min-w-0">
                    {event.startAt && (
                      <p className="text-sm flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(event.startAt)}
                        {event.endAt && ` - ${formatDateTime(event.endAt)}`}
                      </p>
                    )}
                    {event.venueName && (
                      <p className="text-sm flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span data-testid="text-event-venue">{event.venueName}</span>
                      </p>
                    )}
                    {event.notes && (
                      <p className="text-sm text-muted-foreground" data-testid="text-event-notes">{event.notes}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={startEdit} data-testid="button-edit-event">
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="vendors">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Card className="p-3 flex-1">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-total-due">Due: {centsToDisplay(totalDue)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium" data-testid="text-total-paid">Paid: {centsToDisplay(totalPaid)}</span>
                  </div>
                  <Badge variant={totalPaid >= totalDue && totalDue > 0 ? "default" : "secondary"} className="text-[10px]" data-testid="badge-balance">
                    Balance: {centsToDisplay(totalDue - totalPaid)}
                  </Badge>
                </div>
              </Card>
              <Button size="sm" onClick={() => setAddVendorOpen(true)} data-testid="button-add-vendor">
                <Plus className="h-3 w-3 mr-1" /> Add Vendor
              </Button>
            </div>

            <AddVendorDialog eventId={eventId} open={addVendorOpen} onOpenChange={setAddVendorOpen} />

            {!vendors.length ? (
              <Card className="p-6 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No vendors assigned to this event</p>
              </Card>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Booth</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((ev) => (
                      <TableRow key={ev.id} data-testid={`row-vendor-${ev.id}`}>
                        <TableCell className="font-medium" data-testid={`text-vendor-name-${ev.id}`}>
                          {ev.vendor?.name || ev.vendorId}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ev.participationStatus}
                            onValueChange={(val) => updateParticipationMutation.mutate({ id: ev.id, participationStatus: val })}
                          >
                            <SelectTrigger className="w-[130px]" data-testid={`select-participation-${ev.id}`}>
                              <Badge className={`text-[10px] capitalize ${PARTICIPATION_COLORS[ev.participationStatus] || ""}`}>
                                {ev.participationStatus.replace("_", " ")}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {PARTICIPATION_STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" data-testid={`text-booth-${ev.id}`}>
                          {ev.boothDetails || "-"}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`text-due-${ev.id}`}>
                          {centsToDisplay(ev.amountDueCents)}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`text-paid-${ev.id}`}>
                          {centsToDisplay(ev.amountPaidCents)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditingVendor(ev)} data-testid={`button-edit-vendor-${ev.id}`}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog open={deletingVendorId === ev.id} onOpenChange={(open) => setDeletingVendorId(open ? ev.id : null)}>
                              <Button size="icon" variant="ghost" onClick={() => setDeletingVendorId(ev.id)} data-testid={`button-delete-vendor-${ev.id}`}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                              {deletingVendorId === ev.id && (
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Vendor?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Remove {ev.vendor?.name || "this vendor"} from the event?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <div className="flex gap-2 justify-end">
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteVendorMutation.mutate(ev.id)}
                                      disabled={deleteVendorMutation.isPending}
                                      className="bg-destructive text-destructive-foreground"
                                      data-testid="button-confirm-delete-vendor"
                                    >
                                      {deleteVendorMutation.isPending ? "Removing..." : "Remove"}
                                    </AlertDialogAction>
                                  </div>
                                </AlertDialogContent>
                              )}
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {editingVendor && (
              <EditVendorDialog ev={editingVendor} open={!!editingVendor} onOpenChange={(open) => { if (!open) setEditingVendor(null); }} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CrmEventsPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CrmEvent | null>(null);

  const { data: events, isLoading } = useQuery<CrmEvent[]>({
    queryKey: ["/api/admin/crm-events", cityId, statusFilter, searchQuery],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (cityId) queryParams.set("cityId", cityId);
      if (statusFilter !== "all") queryParams.set("status", statusFilter);
      if (searchQuery) queryParams.set("q", searchQuery);
      const qs = queryParams.toString();
      const res = await fetch(`/api/admin/crm-events${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load events");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/crm-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-events"] });
      toast({ title: "Event deleted" });
      setDeletingEvent(null);
    },
    onError: (err: any) => {
      toast({ title: "Error deleting event", description: err.message, variant: "destructive" });
    },
  });

  if (selectedEventId) {
    return <EventDetailView eventId={selectedEventId} onBack={() => setSelectedEventId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-crm-events-title">
            <Calendar className="h-5 w-5" /> Events CRM
          </h2>
          <p className="text-sm text-muted-foreground">Manage events, vendors, and financials</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-event">
          <Plus className="h-4 w-4 mr-1" /> New Event
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="pl-8"
            data-testid="input-search-events"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CreateEventDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !events || events.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No events found</h3>
          <p className="text-sm text-muted-foreground">Create your first event to get started</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Card
              key={event.id}
              className="p-4 cursor-pointer hover-elevate"
              onClick={() => setSelectedEventId(event.id)}
              data-testid={`card-event-${event.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold truncate" data-testid={`text-event-name-${event.id}`}>
                      {event.name}
                    </h3>
                    <Badge className={`text-[10px] capitalize shrink-0 ${EVENT_STATUS_COLORS[event.status] || ""}`} data-testid={`badge-status-${event.id}`}>
                      {event.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    {event.startAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(event.startAt)}
                      </span>
                    )}
                    {event.venueName && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.venueName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <AlertDialog open={deletingEvent?.id === event.id} onOpenChange={(open) => setDeletingEvent(open ? event : null)}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingEvent(event)}
                      data-testid={`button-delete-event-${event.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {deletingEvent?.id === event.id && (
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{event.name}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex gap-2 justify-end">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(event.id)}
                            disabled={deleteMutation.isPending}
                            className="bg-destructive text-destructive-foreground"
                            data-testid="button-confirm-delete-event"
                          >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    )}
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
