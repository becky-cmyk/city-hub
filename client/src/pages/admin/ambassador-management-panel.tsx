import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Users, UserCheck, Clock, Loader2, Copy, ChevronDown, ChevronUp, Search, Eye, Link, Pencil, Check, X } from "lucide-react";

interface Ambassador {
  id: string;
  cityId: string;
  name: string;
  email: string;
  phone: string | null;
  referralCode: string;
  status: string;
  featureFlags: Record<string, boolean>;
  bio: string | null;
  socialUrl: string | null;
  totalReferrals: number;
  totalEarningsCents: number;
  territoryId: string | null;
  scope: string;
  commissionRateBps: number;
  assignedProducts: string[] | null;
  createdAt: string;
}

interface AmbassadorInquiry {
  id: string;
  cityId: string;
  name: string;
  email: string;
  phone: string | null;
  neighborhood: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

interface Referral {
  id: string;
  status: string;
  visitorEmail: string | null;
  conversionAmountCents: number | null;
  commissionCents: number | null;
  createdAt: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    REVOKED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    NEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    REVIEWED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return <Badge className={map[status] || "bg-gray-100 text-gray-700"} data-testid={`badge-status-${status}`}>{status}</Badge>;
}

function ReferralsDialog({ ambassador, open, onClose }: { ambassador: Ambassador; open: boolean; onClose: () => void }) {
  const { data: referrals = [], isLoading } = useQuery<Referral[]>({
    queryKey: ["/api/admin/ambassadors", ambassador.id, "referrals"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ambassadors/${ambassador.id}/referrals`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-referrals-title">Referrals - {ambassador.name}</DialogTitle>
        </DialogHeader>
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {!isLoading && referrals.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No referrals recorded yet.</p>
        )}
        {referrals.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground px-3 py-1">
              <span>Date</span>
              <span>Status</span>
              <span>Visitor</span>
              <span>Amount</span>
              <span>Commission</span>
            </div>
            {referrals.map((r) => (
              <div key={r.id} className="grid grid-cols-5 gap-2 items-center text-sm border rounded px-3 py-2" data-testid={`row-admin-referral-${r.id}`}>
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                {statusBadge(r.status)}
                <span className="text-xs truncate">{r.visitorEmail || "Anonymous"}</span>
                <span className="text-xs">{r.conversionAmountCents ? formatCents(r.conversionAmountCents) : "-"}</span>
                <span className="text-xs font-medium">{r.commissionCents ? formatCents(r.commissionCents) : "-"}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AmbassadorForm({ onSave, onCancel, isPending, cityId }: {
  onSave: (data: Record<string, string | number | null | string[]>) => void;
  onCancel: () => void;
  isPending: boolean;
  cityId: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [referralCode, setReferralCode] = useState("");
  const [scope, setScope] = useState("PLATFORM");
  const [commissionRateBps, setCommissionRateBps] = useState("1000");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" data-testid="input-amb-name" />
        </div>
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" data-testid="input-amb-email" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="input-amb-phone" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-amb-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Custom Referral Code</Label>
        <Input
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="e.g. mike-charlotte"
          data-testid="input-amb-referral-code"
        />
        <p className="text-[11px] text-muted-foreground">
          Leave blank to auto-generate. Use lowercase letters, numbers, and hyphens (3-30 chars).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Scope</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger data-testid="select-amb-scope"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PLATFORM">Platform</SelectItem>
              <SelectItem value="METRO">Metro</SelectItem>
              <SelectItem value="MICRO">Micro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Commission Rate (%)</Label>
          <Input
            type="number"
            min="0"
            max="10000"
            step="50"
            value={(parseInt(commissionRateBps) / 100).toString()}
            onChange={(e) => setCommissionRateBps(String(Math.round(parseFloat(e.target.value || "0") * 100)))}
            data-testid="input-amb-commission"
          />
          <p className="text-[11px] text-muted-foreground">
            Default: 10%. Enter as percentage (e.g. 10 = 10%).
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Social URL</Label>
        <Input value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} placeholder="https://..." data-testid="input-amb-social" />
      </div>
      <div className="space-y-2">
        <Label>Bio</Label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Brief bio..." rows={3} data-testid="input-amb-bio" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-amb">Cancel</Button>
        <Button onClick={() => {
          if (!name.trim() || !email.trim()) return;
          onSave({
            cityId,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            bio: bio.trim() || null,
            socialUrl: socialUrl.trim() || null,
            status,
            scope,
            commissionRateBps: parseInt(commissionRateBps) || 1000,
            ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
          });
        }} disabled={!name.trim() || !email.trim() || isPending} data-testid="button-save-amb">
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Add Ambassador
        </Button>
      </div>
    </div>
  );
}

function AmbassadorsTab({ cityId, citySlug, readOnly }: { cityId: string; citySlug: string; readOnly?: boolean }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewReferrals, setViewReferrals] = useState<Ambassador | null>(null);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState("");

  const { data: ambassadorsList = [], isLoading } = useQuery<Ambassador[]>({
    queryKey: ["/api/admin/ambassadors", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ambassadors?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const resp = await apiRequest("POST", "/api/admin/ambassadors", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ambassadors"] });
      toast({ title: "Ambassador created" });
      setShowForm(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const resp = await apiRequest("PATCH", `/api/admin/ambassadors/${id}`, data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ambassadors"] });
      setEditingCodeId(null);
      toast({ title: "Ambassador updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const getReferralUrl = (code: string) => `${window.location.origin}/${citySlug}?ref=${code}`;

  const filtered = searchQuery
    ? ambassadorsList.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.email.toLowerCase().includes(searchQuery.toLowerCase()))
    : ambassadorsList;

  const activeCount = ambassadorsList.filter(a => a.status === "ACTIVE").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">{ambassadorsList.length} total, {activeCount} active</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-48" data-testid="input-search-ambassadors" />
          </div>
          {!readOnly && (
            <Button onClick={() => setShowForm(true)} data-testid="button-add-ambassador">
              <Plus className="h-4 w-4 mr-1" /> Add Ambassador
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">New Ambassador</h3>
          <AmbassadorForm
            cityId={cityId}
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setShowForm(false)}
            isPending={createMutation.isPending}
          />
        </Card>
      )}

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {!isLoading && filtered.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No ambassadors found.</CardContent></Card>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((amb) => (
            <Card key={amb.id} data-testid={`card-ambassador-${amb.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" data-testid={`text-amb-name-${amb.id}`}>{amb.name}</span>
                      {statusBadge(amb.status)}
                      <Badge variant="outline" className="text-[10px]" data-testid={`badge-scope-${amb.id}`}>{amb.scope || "PLATFORM"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{amb.email}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{amb.totalReferrals} referrals</span>
                      <span>{formatCents(amb.totalEarningsCents)} earned</span>
                      <span>{(amb.commissionRateBps / 100).toFixed(1)}% commission</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      {editingCodeId === amb.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editCodeValue}
                            onChange={(e) => setEditCodeValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            className="h-8 w-48 text-xs font-mono"
                            data-testid={`input-edit-code-${amb.id}`}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              if (editCodeValue.trim().length >= 3) {
                                updateMutation.mutate({ id: amb.id, data: { referralCode: editCodeValue.trim() } });
                              }
                            }}
                            disabled={editCodeValue.trim().length < 3 || updateMutation.isPending}
                            data-testid={`button-save-code-${amb.id}`}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setEditingCodeId(null)}
                            data-testid={`button-cancel-code-${amb.id}`}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span
                            className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80 truncate max-w-[360px]"
                            onClick={() => {
                              navigator.clipboard.writeText(getReferralUrl(amb.referralCode));
                              toast({ title: "Referral link copied" });
                            }}
                            title={getReferralUrl(amb.referralCode)}
                            data-testid={`text-referral-url-${amb.id}`}
                          >
                            {getReferralUrl(amb.referralCode)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              navigator.clipboard.writeText(getReferralUrl(amb.referralCode));
                              toast({ title: "Referral link copied" });
                            }}
                            data-testid={`button-copy-link-${amb.id}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {!readOnly && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditingCodeId(amb.id);
                                setEditCodeValue(amb.referralCode);
                              }}
                              data-testid={`button-edit-code-${amb.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setViewReferrals(amb)} data-testid={`button-view-referrals-${amb.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!readOnly && amb.status === "ACTIVE" && (
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: amb.id, data: { status: "SUSPENDED" } })} data-testid={`button-suspend-${amb.id}`}>
                        Suspend
                      </Button>
                    )}
                    {!readOnly && amb.status !== "ACTIVE" && (
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: amb.id, data: { status: "ACTIVE" } })} data-testid={`button-activate-${amb.id}`}>
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewReferrals && (
        <ReferralsDialog ambassador={viewReferrals} open={!!viewReferrals} onClose={() => setViewReferrals(null)} />
      )}
    </div>
  );
}

function InquiriesTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: inquiries = [], isLoading } = useQuery<AmbassadorInquiry[]>({
    queryKey: ["/api/admin/ambassador-inquiries", cityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ cityId });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/ambassador-inquiries?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const resp = await apiRequest("PATCH", `/api/admin/ambassador-inquiries/${id}`, { status });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ambassador-inquiries"] });
      toast({ title: "Inquiry updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-inquiry-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="REVIEWED">Reviewed</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{inquiries.length} inquiries</span>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {!isLoading && inquiries.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No ambassador inquiries yet.</CardContent></Card>
      )}

      {inquiries.length > 0 && (
        <div className="space-y-2">
          {inquiries.map((inq) => (
            <Card key={inq.id} data-testid={`card-inquiry-${inq.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{inq.name}</span>
                      {statusBadge(inq.status)}
                      {inq.neighborhood && <Badge variant="outline" className="text-[10px]">{inq.neighborhood}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{inq.email}{inq.phone ? ` | ${inq.phone}` : ""}</p>
                    {inq.message && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{inq.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(inq.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {inq.status === "NEW" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: inq.id, status: "REVIEWED" })} data-testid={`button-review-${inq.id}`}>
                          Review
                        </Button>
                        <Button size="sm" onClick={() => updateMutation.mutate({ id: inq.id, status: "APPROVED" })} data-testid={`button-approve-inquiry-${inq.id}`}>
                          Approve
                        </Button>
                      </>
                    )}
                    {inq.status === "REVIEWED" && (
                      <>
                        <Button size="sm" onClick={() => updateMutation.mutate({ id: inq.id, status: "APPROVED" })} data-testid={`button-approve-inquiry-${inq.id}`}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: inq.id, status: "REJECTED" })} data-testid={`button-reject-inquiry-${inq.id}`}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AmbassadorManagementPanel({ selectedCityId, selectedCitySlug, adminMode }: { selectedCityId?: string; selectedCitySlug?: string; adminMode?: string }) {
  if (!selectedCityId) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Select a city to manage ambassadors.</CardContent></Card>;
  }

  const citySlug = selectedCitySlug || "";
  const isMetro = adminMode === "metro";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-ambassador-heading">Ambassador Program</h2>
        <p className="text-muted-foreground text-sm">
          {isMetro ? "View ambassadors and referral activity in your territory." : "Manage ambassadors, referral codes, and interest inquiries."}
        </p>
      </div>

      <Tabs defaultValue="ambassadors">
        <TabsList data-testid="tabs-ambassador-management">
          <TabsTrigger value="ambassadors" data-testid="tab-ambassadors">
            <Users className="h-4 w-4 mr-1" /> Ambassadors
          </TabsTrigger>
          {!isMetro && (
            <TabsTrigger value="inquiries" data-testid="tab-inquiries">
              <Clock className="h-4 w-4 mr-1" /> Inquiries
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="ambassadors">
          <AmbassadorsTab cityId={selectedCityId} citySlug={citySlug} readOnly={isMetro} />
        </TabsContent>
        {!isMetro && (
          <TabsContent value="inquiries">
            <InquiriesTab cityId={selectedCityId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
