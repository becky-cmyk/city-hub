import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2, Users, ClipboardList, ArrowLeft, Plus, Check, X,
  Tag, User, Phone, Mail, Briefcase, CreditCard, Shield, Loader2
} from "lucide-react";
import { useState } from "react";
import type { OpsAccount, Business } from "@shared/schema";

const STATUSES = ["PROSPECT", "CONTACTED", "QUALIFIED", "ONBOARDING", "ACTIVE", "SPONSOR", "CHURNED"] as const;

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PROSPECT: "outline",
  CONTACTED: "secondary",
  QUALIFIED: "secondary",
  ONBOARDING: "secondary",
  ACTIVE: "default",
  SPONSOR: "default",
  CHURNED: "destructive",
};

interface AccountSummary {
  account: OpsAccount;
  people: Array<{ id: string; name: string; email: string | null; phone: string | null; roleTitle: string | null; isPrimary: boolean }>;
  tasks: Array<{ id: string; title: string; status: string; dueAt: string | null; notes: string | null }>;
  linkedBusiness: { id: string; name: string; slug: string; listingTier: string; claimStatus: string; ownerEmail: string | null } | null;
  stripeContext: { stripeCustomerId: string } | null;
  entitlementContext: {
    tier: string;
    capabilities: Record<string, boolean>;
    activeEntitlements?: Array<{ id: string; productType: string; status: string; stripeSubscriptionId: string | null; startAt: string | null; endAt: string | null }>;
  } | null;
}

export default function CustomerOps({ cityId }: { cityId?: string }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [bizFilter, setBizFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  if (selectedAccountId) {
    return <AccountDetail accountId={selectedAccountId} onBack={() => setSelectedAccountId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-semibold text-lg" data-testid="text-ops-title">Customer Ops</h2>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-account">
          <Plus className="h-4 w-4 mr-1" /> New Account
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder="Filter by tag..."
          className="w-36"
          data-testid="input-tag-filter"
        />
        <Select value={bizFilter} onValueChange={setBizFilter}>
          <SelectTrigger className="w-40" data-testid="select-biz-filter">
            <SelectValue placeholder="Linked Business" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Has Business</SelectItem>
            <SelectItem value="false">No Business</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showCreate && <CreateAccountForm onClose={() => setShowCreate(false)} />}

      <AccountList
        statusFilter={statusFilter === "all" ? undefined : statusFilter}
        tagFilter={tagFilter || undefined}
        bizFilter={bizFilter === "all" ? undefined : bizFilter === "true"}
        onSelect={setSelectedAccountId}
      />
    </div>
  );
}

function AccountList({ statusFilter, tagFilter, bizFilter, onSelect }: {
  statusFilter?: string; tagFilter?: string; bizFilter?: boolean; onSelect: (id: string) => void;
}) {
  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (tagFilter) params.set("tag", tagFilter);
  if (bizFilter !== undefined) params.set("hasBusinessId", String(bizFilter));
  const qs = params.toString();

  const url = qs ? `/api/admin/ops/accounts?${qs}` : "/api/admin/ops/accounts";
  const { data: accounts, isLoading } = useQuery<OpsAccount[]>({
    queryKey: ["/api/admin/ops/accounts", { statusFilter, tagFilter, bizFilter }],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  if (!accounts || accounts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="font-semibold mb-1">No accounts found</h3>
        <p className="text-sm text-muted-foreground">Create your first account to get started</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {accounts.map(acc => (
        <Card
          key={acc.id}
          className="p-4 hover-elevate cursor-pointer"
          onClick={() => onSelect(acc.id)}
          data-testid={`card-ops-account-${acc.id}`}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold text-sm" data-testid={`text-account-name-${acc.id}`}>{acc.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={statusColors[acc.status] || "outline"} className="text-[10px]">{acc.status}</Badge>
                {acc.businessId && <Badge variant="outline" className="text-[10px]"><Building2 className="h-2.5 w-2.5 mr-0.5" />Linked</Badge>}
                {acc.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]"><Tag className="h-2.5 w-2.5 mr-0.5" />{t}</Badge>)}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CreateAccountForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [status, setStatus] = useState("PROSPECT");

  const { data: allBiz } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses"],
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/ops/accounts", {
        name, businessId: businessId || undefined, status,
      });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/accounts"] });
      toast({ title: "Account created" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to create account", variant: "destructive" }),
  });

  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold text-sm">Create New Account</h3>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Account name" data-testid="input-new-account-name" />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger data-testid="select-new-account-status"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={businessId || "none"} onValueChange={v => setBusinessId(v === "none" ? "" : v)}>
        <SelectTrigger data-testid="select-new-account-business"><SelectValue placeholder="Link business (optional)" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No linked business</SelectItem>
          {allBiz?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => createMut.mutate()} disabled={!name || createMut.isPending} data-testid="button-submit-account">
          {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} data-testid="button-cancel-account">Cancel</Button>
      </div>
    </Card>
  );
}

function AccountDetail({ accountId, onBack }: { accountId: string; onBack: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<AccountSummary>({
    queryKey: ["/api/admin/ops/accounts", accountId],
  });

  const updateMut = useMutation({
    mutationFn: async (patch: any) => {
      await apiRequest("PATCH", `/api/admin/ops/accounts/${accountId}`, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/accounts", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/accounts"] });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { account, people, tasks, linkedBusiness, stripeContext, entitlementContext } = data;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-accounts">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Accounts
      </Button>

      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-lg" data-testid="text-account-detail-name">{account.name}</h2>
            {linkedBusiness && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <Building2 className="inline h-3 w-3 mr-1" />Linked: {linkedBusiness.name} ({linkedBusiness.listingTier})
              </p>
            )}
          </div>
          <Badge variant={statusColors[account.status] || "outline"}>{account.status}</Badge>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={account.status} onValueChange={v => updateMut.mutate({ status: v })}>
            <SelectTrigger className="w-40" data-testid="select-account-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <TagsEditor tags={account.tags} onSave={tags => updateMut.mutate({ tags })} />
      </Card>

      <PeopleSection accountId={accountId} cityId={account.cityId} people={people} />
      <TasksSection accountId={accountId} cityId={account.cityId} tasks={tasks} />

      {linkedBusiness ? (
        <EntitlementBox linkedBusiness={linkedBusiness} stripeContext={stripeContext} entitlementContext={entitlementContext} />
      ) : (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground" data-testid="text-no-linked-business">No linked business</p>
        </Card>
      )}
    </div>
  );
}

function TagsEditor({ tags, onSave }: { tags: string[]; onSave: (tags: string[]) => void }) {
  const [newTag, setNewTag] = useState("");

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Tags</p>
      <div className="flex items-center gap-1 flex-wrap">
        {tags.map(t => (
          <Badge key={t} variant="secondary" className="text-[10px] gap-1">
            {t}
            <button onClick={() => onSave(tags.filter(x => x !== t))} className="ml-0.5" data-testid={`button-remove-tag-${t}`}>
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            placeholder="Add tag"
            className="h-7 w-24 text-xs"
            onKeyDown={e => {
              if (e.key === "Enter" && newTag.trim()) {
                onSave([...tags, newTag.trim()]);
                setNewTag("");
              }
            }}
            data-testid="input-new-tag"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => { if (newTag.trim()) { onSave([...tags, newTag.trim()]); setNewTag(""); } }}
            data-testid="button-add-tag"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PeopleSection({ accountId, cityId, people }: { accountId: string; cityId: string; people: AccountSummary["people"] }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const addMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/ops/accounts/${accountId}/people`, {
        name, email: email || undefined, phone: phone || undefined,
        roleTitle: roleTitle || undefined, isPrimary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/accounts", accountId] });
      toast({ title: "Person added" });
      setShowAdd(false); setName(""); setEmail(""); setPhone(""); setRoleTitle(""); setIsPrimary(false);
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/ops/people/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/accounts", accountId] }),
  });

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1"><Users className="h-4 w-4" /> People</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-person">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-2 border-t pt-3">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name *" data-testid="input-person-name" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" data-testid="input-person-email" />
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" data-testid="input-person-phone" />
          </div>
          <Input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="Role/Title" data-testid="input-person-role" />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} data-testid="checkbox-person-primary" />
            Primary contact
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => addMut.mutate()} disabled={!name || addMut.isPending} data-testid="button-submit-person">
              {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {people.length > 0 ? (
        <div className="space-y-2">
          {people.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0" data-testid={`row-person-${p.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.isPrimary && <Badge variant="default" className="text-[9px]">Primary</Badge>}
                  {p.roleTitle && <span className="text-xs text-muted-foreground">{p.roleTitle}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {p.email && <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{p.email}</span>}
                  {p.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{p.phone}</span>}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(p.id)} data-testid={`button-delete-person-${p.id}`}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No people added yet</p>
      )}
    </Card>
  );
}

function TasksSection({ accountId, cityId, tasks }: { accountId: string; cityId: string; tasks: AccountSummary["tasks"] }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");

  const addMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/ops/accounts/${accountId}/tasks`, {
        title, dueAt: dueAt || undefined, notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/accounts", accountId] });
      toast({ title: "Task created" });
      setShowAdd(false); setTitle(""); setDueAt(""); setNotes("");
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/ops/tasks/${id}`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/accounts", accountId] }),
  });

  const openTasks = tasks.filter(t => t.status === "OPEN");
  const doneTasks = tasks.filter(t => t.status !== "OPEN");

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1"><ClipboardList className="h-4 w-4" /> Tasks</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-task">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-2 border-t pt-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title *" data-testid="input-task-title" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} data-testid="input-task-due" />
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" className="text-xs" data-testid="input-task-notes" />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => addMut.mutate()} disabled={!title || addMut.isPending} data-testid="button-submit-task">
              {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {openTasks.length > 0 ? (
        <div className="space-y-1.5">
          {openTasks.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0" data-testid={`row-task-${t.id}`}>
              <div className="flex-1 min-w-0">
                <span className="text-sm">{t.title}</span>
                {t.dueAt && <span className="text-xs text-muted-foreground ml-2">Due: {new Date(t.dueAt).toLocaleDateString()}</span>}
                {t.notes && <p className="text-xs text-muted-foreground mt-0.5">{t.notes}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateMut.mutate({ id: t.id, status: "DONE" })}
                disabled={updateMut.isPending}
                data-testid={`button-done-task-${t.id}`}
              >
                <Check className="h-3 w-3 mr-1" /> Done
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No open tasks</p>
      )}

      {doneTasks.length > 0 && (
        <div className="border-t pt-2 mt-2">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Completed / Canceled</p>
          {doneTasks.slice(0, 5).map(t => (
            <div key={t.id} className="text-xs text-muted-foreground py-0.5 line-through">{t.title}</div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EntitlementBox({ linkedBusiness, stripeContext, entitlementContext }: {
  linkedBusiness: AccountSummary["linkedBusiness"];
  stripeContext: AccountSummary["stripeContext"];
  entitlementContext: AccountSummary["entitlementContext"];
}) {
  return (
    <Card className="p-5 space-y-3" data-testid="card-entitlement-box">
      <h3 className="text-sm font-semibold flex items-center gap-1"><Shield className="h-4 w-4" /> Stripe / Entitlements</h3>

      {linkedBusiness && (
        <div className="text-xs space-y-1">
          <p>Business: <span className="font-medium">{linkedBusiness.name}</span> ({linkedBusiness.listingTier})</p>
          <p>Claim Status: <span className="font-medium">{linkedBusiness.claimStatus}</span></p>
          {linkedBusiness.ownerEmail && <p>Owner Email: <span className="font-medium">{linkedBusiness.ownerEmail}</span></p>}
        </div>
      )}

      {stripeContext ? (
        <div className="text-xs space-y-0.5">
          <p className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Stripe Customer: <span className="font-mono text-[10px]">{stripeContext.stripeCustomerId}</span></p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No Stripe customer found</p>
      )}

      {entitlementContext ? (
        <div className="text-xs space-y-1">
          <p>Tier: <Badge variant="outline" className="text-[10px]">{entitlementContext.tier}</Badge></p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(entitlementContext.capabilities).map(([k, v]) => (
              <Badge key={k} variant={v ? "default" : "secondary"} className="text-[9px]">{k}: {v ? "Yes" : "No"}</Badge>
            ))}
          </div>
          {entitlementContext.activeEntitlements && entitlementContext.activeEntitlements.length > 0 && (
            <div className="border-t pt-1 mt-1 space-y-0.5">
              <p className="font-semibold">Active Entitlements:</p>
              {entitlementContext.activeEntitlements.map(e => (
                <div key={e.id} className="text-[10px] font-mono">
                  {e.productType} ({e.status})
                  {e.stripeSubscriptionId && <span className="ml-1">sub: {e.stripeSubscriptionId}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground" data-testid="text-no-entitlements">No entitlements data</p>
      )}
    </Card>
  );
}
