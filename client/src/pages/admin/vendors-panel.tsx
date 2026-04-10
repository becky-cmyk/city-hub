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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Plus, Edit, Trash2, Store, Users, Calendar, ArrowLeft, Star, Phone, Mail, Globe, UserPlus } from "lucide-react";

const VENDOR_TYPES = [
  { value: "event_vendor", label: "Event Vendor" },
  { value: "sponsor", label: "Sponsor" },
  { value: "both", label: "Both" },
];

const STATUS_PIPELINE = ["prospect", "invited", "committed", "paid", "attended", "churned"] as const;

const STATUS_COLORS: Record<string, string> = {
  prospect: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  invited: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  committed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  attended: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  churned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const TYPE_COLORS: Record<string, string> = {
  event_vendor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  sponsor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  both: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

interface Vendor {
  id: string;
  name: string;
  vendorType: string;
  website: string | null;
  notes: string | null;
  status: string;
}

interface VendorContact {
  id: string;
  vendorId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  roleTitle: string | null;
  isPrimary: boolean;
}

interface VendorEvent {
  id: string;
  title: string;
  date: string | null;
  status: string | null;
}

interface VendorDetail extends Vendor {
  contacts: VendorContact[];
  events: VendorEvent[];
}

function StatusPipeline({ current }: { current: string }) {
  return (
    <div className="flex flex-wrap gap-1" data-testid="status-pipeline">
      {STATUS_PIPELINE.map((stage) => (
        <Badge
          key={stage}
          className={`text-[10px] capitalize ${current === stage ? STATUS_COLORS[stage] : "bg-muted text-muted-foreground"}`}
          data-testid={`badge-pipeline-${stage}`}
        >
          {stage}
        </Badge>
      ))}
    </div>
  );
}

function ContactForm({ vendorId, contact, onClose }: { vendorId: string; contact?: VendorContact; onClose: () => void }) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(contact?.firstName || "");
  const [lastName, setLastName] = useState(contact?.lastName || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [roleTitle, setRoleTitle] = useState(contact?.roleTitle || "");
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary || false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { firstName, lastName, email: email || null, phone: phone || null, roleTitle: roleTitle || null, isPrimary };
      if (contact) {
        return apiRequest("PATCH", `/api/admin/vendor-contacts/${contact.id}`, payload);
      }
      return apiRequest("POST", `/api/admin/vendors/${vendorId}/contacts`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors", vendorId] });
      toast({ title: contact ? "Contact updated" : "Contact added" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error saving contact", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{contact ? "Edit Contact" : "Add Contact"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>First Name *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" data-testid="input-contact-firstName" />
          </div>
          <div className="space-y-1.5">
            <Label>Last Name *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" data-testid="input-contact-lastName" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" data-testid="input-contact-email" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="input-contact-phone" />
        </div>
        <div className="space-y-1.5">
          <Label>Role / Title</Label>
          <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Event Manager" data-testid="input-contact-roleTitle" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} id="isPrimary" data-testid="checkbox-contact-isPrimary" />
          <Label htmlFor="isPrimary">Primary Contact</Label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !firstName || !lastName} data-testid="button-save-contact">
            {saveMutation.isPending ? "Saving..." : contact ? "Update" : "Add Contact"}
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-contact">Cancel</Button>
        </div>
      </div>
    </DialogContent>
  );
}

function VendorDetailView({ vendorId, onBack }: { vendorId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<VendorContact | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  const { data: vendor, isLoading } = useQuery<VendorDetail>({
    queryKey: ["/api/admin/vendors", vendorId],
  });

  const [name, setName] = useState("");
  const [vendorType, setVendorType] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  const startEdit = () => {
    if (!vendor) return;
    setName(vendor.name);
    setVendorType(vendor.vendorType);
    setWebsite(vendor.website || "");
    setNotes(vendor.notes || "");
    setStatus(vendor.status);
    setIsEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/vendors/${vendorId}`, {
        name, vendorType, website: website || null, notes: notes || null, status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors", vendorId] });
      toast({ title: "Vendor updated" });
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast({ title: "Error updating vendor", description: err.message, variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/vendor-contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors", vendorId] });
      toast({ title: "Contact deleted" });
      setDeletingContactId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error deleting contact", description: err.message, variant: "destructive" });
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

  if (!vendor) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Vendor not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4" data-testid="button-back-not-found">Go Back</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-semibold" data-testid="text-vendor-detail-name">{vendor.name}</h2>
      </div>

      <StatusPipeline current={vendor.status} />

      <Tabs defaultValue="info">
        <TabsList data-testid="tabs-vendor-detail">
          <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts ({vendor.contacts?.length || 0})</TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">Events ({vendor.events?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="p-4">
            {isEditing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-edit-vendor-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={vendorType} onValueChange={setVendorType}>
                      <SelectTrigger data-testid="select-edit-vendor-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VENDOR_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger data-testid="select-edit-vendor-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_PIPELINE.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." data-testid="input-edit-vendor-website" />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} data-testid="input-edit-vendor-notes" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !name} data-testid="button-save-vendor">
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] capitalize ${STATUS_COLORS[vendor.status] || ""}`} data-testid="badge-vendor-status">
                        {vendor.status}
                      </Badge>
                      <Badge className={`text-[10px] ${TYPE_COLORS[vendor.vendorType] || ""}`} data-testid="badge-vendor-type">
                        {VENDOR_TYPES.find((t) => t.value === vendor.vendorType)?.label || vendor.vendorType}
                      </Badge>
                    </div>
                    {vendor.website && (
                      <p className="text-sm flex items-center gap-1 text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="underline" data-testid="link-vendor-website">
                          {vendor.website}
                        </a>
                      </p>
                    )}
                    {vendor.notes && (
                      <p className="text-sm text-muted-foreground" data-testid="text-vendor-notes">{vendor.notes}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={startEdit} data-testid="button-edit-vendor">
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Contacts</h3>
              <Dialog open={contactDialogOpen && !editingContact} onOpenChange={(open) => { setContactDialogOpen(open); if (!open) setEditingContact(null); }}>
                <Button size="sm" onClick={() => { setEditingContact(null); setContactDialogOpen(true); }} data-testid="button-add-contact">
                  <UserPlus className="h-3 w-3 mr-1" /> Add
                </Button>
                {contactDialogOpen && !editingContact && (
                  <ContactForm vendorId={vendorId} onClose={() => setContactDialogOpen(false)} />
                )}
              </Dialog>
            </div>

            {!vendor.contacts?.length ? (
              <Card className="p-6 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No contacts yet</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {vendor.contacts.map((c) => (
                  <Card key={c.id} className="p-3" data-testid={`card-contact-${c.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm" data-testid={`text-contact-name-${c.id}`}>
                            {c.firstName} {c.lastName}
                          </p>
                          {c.isPrimary && (
                            <Badge variant="default" className="text-[10px]" data-testid={`badge-primary-${c.id}`}>
                              <Star className="h-2 w-2 mr-0.5" /> Primary
                            </Badge>
                          )}
                        </div>
                        {c.roleTitle && <p className="text-xs text-muted-foreground">{c.roleTitle}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {c.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Dialog open={editingContact?.id === c.id} onOpenChange={(open) => { if (!open) setEditingContact(null); }}>
                          <Button size="icon" variant="ghost" onClick={() => setEditingContact(c)} data-testid={`button-edit-contact-${c.id}`}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          {editingContact?.id === c.id && (
                            <ContactForm vendorId={vendorId} contact={c} onClose={() => setEditingContact(null)} />
                          )}
                        </Dialog>
                        <AlertDialog open={deletingContactId === c.id} onOpenChange={(open) => setDeletingContactId(open ? c.id : null)}>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingContactId(c.id)} data-testid={`button-delete-contact-${c.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {deletingContactId === c.id && (
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove {c.firstName} {c.lastName} from this vendor?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="flex gap-2 justify-end">
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteContactMutation.mutate(c.id)}
                                  disabled={deleteContactMutation.isPending}
                                  className="bg-destructive text-destructive-foreground"
                                  data-testid="button-confirm-delete-contact"
                                >
                                  {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
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
        </TabsContent>

        <TabsContent value="events">
          {!vendor.events?.length ? (
            <Card className="p-6 text-center">
              <Calendar className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No events linked to this vendor</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {vendor.events.map((ev) => (
                <Card key={ev.id} className="p-3" data-testid={`card-event-${ev.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" data-testid={`text-event-title-${ev.id}`}>{ev.title}</p>
                      {ev.date && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(ev.date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {ev.status && (
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0">{ev.status}</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateVendorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [vendorType, setVendorType] = useState("event_vendor");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("prospect");

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/vendors", {
        name, vendorType, website: website || null, notes: notes || null, status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      toast({ title: "Vendor created" });
      setName("");
      setWebsite("");
      setNotes("");
      setVendorType("event_vendor");
      setStatus("prospect");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error creating vendor", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Vendor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vendor name" data-testid="input-vendor-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={vendorType} onValueChange={setVendorType}>
                <SelectTrigger data-testid="select-vendor-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-vendor-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_PIPELINE.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." data-testid="input-vendor-website" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes..." data-testid="input-vendor-notes" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !name} data-testid="button-create-vendor">
              {createMutation.isPending ? "Creating..." : "Create Vendor"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function VendorsPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  const { data: vendors, isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/admin/vendors", statusFilter !== "all" ? statusFilter : "", typeFilter !== "all" ? typeFilter : "", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("vendorType", typeFilter);
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/admin/vendors?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load vendors");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      toast({ title: "Vendor deleted" });
      setDeletingVendor(null);
    },
    onError: (err: any) => {
      toast({ title: "Error deleting vendor", description: err.message, variant: "destructive" });
    },
  });

  if (selectedVendorId) {
    return <VendorDetailView vendorId={selectedVendorId} onBack={() => setSelectedVendorId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-vendors-title">
            <Store className="h-5 w-5" /> Vendors
          </h2>
          <p className="text-sm text-muted-foreground">Manage event vendors and sponsors</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-open-create-vendor">
          <Plus className="h-4 w-4 mr-1" /> New Vendor
        </Button>
      </div>

      <CreateVendorDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-vendor-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_PIPELINE.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-type-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {VENDOR_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !vendors?.length ? (
        <Card className="p-8 text-center">
          <Store className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">No vendors found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {vendors.map((v) => (
            <Card
              key={v.id}
              className="p-4 cursor-pointer hover-elevate"
              onClick={() => setSelectedVendorId(v.id)}
              data-testid={`card-vendor-${v.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate" data-testid={`text-vendor-name-${v.id}`}>{v.name}</p>
                    <Badge className={`text-[10px] capitalize ${STATUS_COLORS[v.status] || ""}`} data-testid={`badge-status-${v.id}`}>
                      {v.status}
                    </Badge>
                    <Badge className={`text-[10px] ${TYPE_COLORS[v.vendorType] || ""}`} data-testid={`badge-type-${v.id}`}>
                      {VENDOR_TYPES.find((t) => t.value === v.vendorType)?.label || v.vendorType}
                    </Badge>
                  </div>
                  {v.website && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{v.website}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <AlertDialog open={deletingVendor?.id === v.id} onOpenChange={(open) => setDeletingVendor(open ? v : null)}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setDeletingVendor(v); }}
                      data-testid={`button-delete-vendor-${v.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {deletingVendor?.id === v.id && (
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Vendor?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Permanently delete "{v.name}" and all associated contacts?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex gap-2 justify-end">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(v.id)}
                            disabled={deleteMutation.isPending}
                            className="bg-destructive text-destructive-foreground"
                            data-testid="button-confirm-delete-vendor"
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