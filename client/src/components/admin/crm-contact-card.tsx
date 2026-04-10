import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import {
  User, Phone, Mail, MessageSquare, ChevronDown, ChevronUp,
  Plus, Trash2, CreditCard, Clock, Pencil, Save, X, Send, Heart, Check, Loader2
} from "lucide-react";
import { useState } from "react";
import type { BusinessContact, CommunicationLogEntry } from "@shared/schema";

interface CrmContactCardProps {
  businessId: string;
  businessName: string;
  ownerEmail?: string | null;
  claimStatus: string;
  listingTier: string;
  preferredLanguage?: string | null;
}

export function CrmContactCard({ businessId, businessName, ownerEmail, claimStatus, listingTier, preferredLanguage }: CrmContactCardProps) {
  const [contactsOpen, setContactsOpen] = useState(true);
  const [commOpen, setCommOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [addingComm, setAddingComm] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [claimNonprofit, setClaimNonprofit] = useState(false);
  const [claimEmailSending, setClaimEmailSending] = useState(false);
  const [claimEmailSent, setClaimEmailSent] = useState(false);
  const [claimEmailAddr, setClaimEmailAddr] = useState(ownerEmail || "");
  const { toast } = useToast();

  const contactsQuery = useQuery<BusinessContact[]>({
    queryKey: ["/api/admin/businesses", businessId, "contacts"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/contacts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load contacts");
      return res.json();
    },
  });

  const commLogQuery = useQuery<CommunicationLogEntry[]>({
    queryKey: ["/api/admin/businesses", businessId, "comm-log"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/comm-log`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load log");
      return res.json();
    },
    enabled: commOpen,
  });

  return (
    <Card className="border-t mt-4 overflow-hidden">
      <div className="bg-muted/30 px-3 py-2 flex items-center gap-2">
        <User className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">CRM Contact Card</span>
        <Badge variant="outline" className="ml-auto text-[10px]">{claimStatus}</Badge>
      </div>

      <CollapsibleSection
        title="Contact Info"
        icon={<Phone className="h-3.5 w-3.5" />}
        open={contactsOpen}
        onToggle={() => setContactsOpen(!contactsOpen)}
      >
        {contactsQuery.isLoading ? (
          <p className="text-xs text-muted-foreground px-3 py-2">Loading...</p>
        ) : (
          <div className="space-y-2 p-3">
            {(contactsQuery.data || []).map((c) => (
              editingContactId === c.id ? (
                <ContactEditForm
                  key={c.id}
                  contact={c}
                  businessId={businessId}
                  onDone={() => setEditingContactId(null)}
                />
              ) : (
                <ContactRow
                  key={c.id}
                  contact={c}
                  businessId={businessId}
                  onEdit={() => setEditingContactId(c.id)}
                />
              )
            ))}
            {(!contactsQuery.data || contactsQuery.data.length === 0) && !addingContact && (
              <p className="text-xs text-muted-foreground">No contacts yet.</p>
            )}
            {addingContact ? (
              <ContactAddForm
                businessId={businessId}
                defaultEmail={ownerEmail || ""}
                onDone={() => setAddingContact(false)}
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setAddingContact(true)}
                data-testid="button-add-contact"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Contact
              </Button>
            )}
          </div>
        )}
      </CollapsibleSection>

      

      <CollapsibleSection
        title="Communication History"
        icon={<MessageSquare className="h-3.5 w-3.5" />}
        open={commOpen}
        onToggle={() => setCommOpen(!commOpen)}
      >
        <div className="space-y-2 p-3">
          {commLogQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : (
            <>
              {(commLogQuery.data || []).map((entry) => (
                <CommLogRow key={entry.id} entry={entry} businessId={businessId} />
              ))}
              {(!commLogQuery.data || commLogQuery.data.length === 0) && !addingComm && (
                <p className="text-xs text-muted-foreground">No communication logged yet.</p>
              )}
            </>
          )}
          {addingComm ? (
            <CommAddForm businessId={businessId} onDone={() => setAddingComm(false)} />
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setAddingComm(true)}
              data-testid="button-add-comm"
            >
              <Plus className="h-3 w-3 mr-1" /> Log Interaction
            </Button>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Billing"
        icon={<CreditCard className="h-3.5 w-3.5" />}
        open={billingOpen}
        onToggle={() => setBillingOpen(!billingOpen)}
      >
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Listing Tier</span>
            <Badge variant={listingTier === "ENHANCED" ? "default" : "outline"}>
              {listingTier}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">Stripe billing integration coming soon.</p>
        </div>
      </CollapsibleSection>
    </Card>
  );
}

function CollapsibleSection({ title, icon, open, onToggle, children }: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/20 transition-colors"
        onClick={onToggle}
        data-testid={`button-toggle-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {icon}
        {title}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && children}
    </div>
  );
}

function ContactRow({ contact, businessId, onEdit }: { contact: BusinessContact; businessId: string; onEdit: () => void }) {
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/contacts/${contact.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "contacts"] });
      toast({ title: "Contact removed" });
    },
  });

  return (
    <div className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`contact-row-${contact.id}`}>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{contact.name}</span>
          {contact.isPrimary && <Badge variant="default" className="text-[9px] h-4">Primary</Badge>}
          <Badge variant="outline" className="text-[9px] h-4">{contact.role}</Badge>
        </div>
        {contact.title && <p className="text-muted-foreground">{contact.title}</p>}
        {contact.email && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <Mail className="h-3 w-3" /> {contact.email}
          </p>
        )}
        {contact.phone && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <Phone className="h-3 w-3" /> {contact.phone}
          </p>
        )}
        {contact.notes && <p className="text-muted-foreground italic mt-1">{contact.notes}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit} data-testid={`button-edit-contact-${contact.id}`}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          data-testid={`button-delete-contact-${contact.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function ContactAddForm({ businessId, defaultEmail, onDone }: { businessId: string; defaultEmail: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("OWNER");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/contacts`, {
        name, role, title: title || null, email: email || null, phone: phone || null, notes: notes || null, isPrimary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "contacts"] });
      toast({ title: "Contact added" });
      onDone();
    },
    onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
  });

  return (
    <div className="space-y-2 p-2 rounded-md border bg-muted/20">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" data-testid="input-contact-name" />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-contact-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OWNER">Owner</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="MARKETING">Marketing</SelectItem>
            <SelectItem value="BILLING">Billing</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" data-testid="input-contact-title" />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs" data-testid="input-contact-email" />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-xs" data-testid="input-contact-phone" />
      </div>
      <Textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs min-h-[50px]" data-testid="input-contact-notes" />
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} data-testid="checkbox-primary" />
        Primary contact
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending} data-testid="button-save-contact">
          <Save className="h-3 w-3 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} data-testid="button-cancel-contact">
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function ContactEditForm({ contact, businessId, onDone }: { contact: BusinessContact; businessId: string; onDone: () => void }) {
  const [name, setName] = useState(contact.name);
  const [role, setRole] = useState(contact.role);
  const [title, setTitle] = useState(contact.title || "");
  const [email, setEmail] = useState(contact.email || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [notes, setNotes] = useState(contact.notes || "");
  const [isPrimary, setIsPrimary] = useState(contact.isPrimary);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/contacts/${contact.id}`, {
        name, role, title: title || null, email: email || null, phone: phone || null, notes: notes || null, isPrimary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "contacts"] });
      toast({ title: "Contact updated" });
      onDone();
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  return (
    <div className="space-y-2 p-2 rounded-md border bg-muted/20">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" data-testid="input-edit-contact-name" />
        <Select value={role} onValueChange={(v) => setRole(v as any)}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-edit-contact-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OWNER">Owner</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="MARKETING">Marketing</SelectItem>
            <SelectItem value="BILLING">Billing</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs" />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-xs" />
      </div>
      <Textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs min-h-[50px]" />
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
        Primary contact
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => updateMutation.mutate()} disabled={!name || updateMutation.isPending} data-testid="button-update-contact">
          <Save className="h-3 w-3 mr-1" /> Update
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function CommLogRow({ entry, businessId }: { entry: CommunicationLogEntry; businessId: string }) {
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/comm-log/${entry.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "comm-log"] });
      toast({ title: "Entry removed" });
    },
  });

  const typeIcon: Record<string, string> = {
    EMAIL: "📧",
    PHONE: "📞",
    NOTE: "📝",
    MEETING: "🤝",
    INVOICE: "🧾",
    OTHER: "📎",
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`comm-row-${entry.id}`}>
      <span className="text-sm">{typeIcon[entry.type] || "📎"}</span>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] h-4">{entry.type}</Badge>
          <span className="text-muted-foreground">
            {entry.direction === "inbound" ? "← Inbound" : "→ Outbound"}
          </span>
          <span className="ml-auto text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(entry.createdAt).toLocaleDateString()}
          </span>
        </div>
        {entry.subject && <p className="font-medium">{entry.subject}</p>}
        {entry.body && <p className="text-muted-foreground whitespace-pre-wrap">{entry.body}</p>}
        {entry.createdBy && <p className="text-muted-foreground text-[10px]">by {entry.createdBy}</p>}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-destructive shrink-0"
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
        data-testid={`button-delete-comm-${entry.id}`}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function CommAddForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [type, setType] = useState("NOTE");
  const [direction, setDirection] = useState("outbound");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/comm-log`, {
        type, direction, subject: subject || null, body: body || null, createdBy: createdBy || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "comm-log"] });
      toast({ title: "Interaction logged" });
      onDone();
    },
    onError: () => toast({ title: "Failed to log interaction", variant: "destructive" }),
  });

  return (
    <div className="space-y-2 p-2 rounded-md border bg-muted/20">
      <div className="grid grid-cols-2 gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-comm-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="PHONE">Phone Call</SelectItem>
            <SelectItem value="NOTE">Note</SelectItem>
            <SelectItem value="MEETING">Meeting</SelectItem>
            <SelectItem value="INVOICE">Invoice</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-comm-direction">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 text-xs" data-testid="input-comm-subject" />
      <Textarea placeholder="Details..." value={body} onChange={(e) => setBody(e.target.value)} className="text-xs min-h-[60px]" data-testid="input-comm-body" />
      <Input placeholder="Logged by (your name)" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} className="h-8 text-xs" data-testid="input-comm-created-by" />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-comm">
          <Save className="h-3 w-3 mr-1" /> Log
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} data-testid="button-cancel-comm">
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}
