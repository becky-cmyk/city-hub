import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, Settings, CreditCard, Coins, Save, Plus, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface PlanVersion {
  id: string;
  versionKey: string;
  label: string;
  presenceMonthly: number;
  presenceAnnual: number;
  hubAddonMonthly: number;
  hubAddonAnnual: number;
  categoryAddonMonthly: number;
  categoryAddonAnnual: number;
  microAddonMonthly: number;
  microAddonAnnual: number;
  monthlyCreditsIncluded: number;
  isCurrentOffering: boolean;
  isFounderPlan: boolean;
  createdAt: string;
}

interface CreditActionCost {
  id: string;
  actionType: string;
  label: string;
  costCredits: number;
  isActive: boolean;
}

interface CreditWalletData {
  balance: { monthly: number; banked: number; total: number };
  transactions: Array<{
    id: string;
    txType: string;
    amount: number;
    balanceAfterMonthly: number;
    balanceAfterBanked: number;
    actionType: string | null;
    note: string | null;
    createdAt: string;
  }>;
}

function cents(v: number) {
  return `$${(v / 100).toFixed(2)}`;
}

function PlansTab() {
  const { toast } = useToast();
  const { data: plans, isLoading } = useQuery<PlanVersion[]>({
    queryKey: ["/api/admin/plan-versions"],
  });

  const [editingPlan, setEditingPlan] = useState<PlanVersion | null>(null);
  const [form, setForm] = useState({
    versionKey: "",
    label: "",
    presenceMonthly: 0,
    presenceAnnual: 0,
    hubAddonMonthly: 0,
    hubAddonAnnual: 0,
    categoryAddonMonthly: 0,
    categoryAddonAnnual: 0,
    microAddonMonthly: 0,
    microAddonAnnual: 0,
    monthlyCreditsIncluded: 10,
    isCurrentOffering: false,
    isFounderPlan: false,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/admin/plan-versions", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plan-versions"] });
      setEditingPlan(null);
      toast({ title: "Plan saved" });
    },
    onError: () => {
      toast({ title: "Failed to save plan", variant: "destructive" });
    },
  });

  const startEdit = (plan: PlanVersion) => {
    setEditingPlan(plan);
    setForm({
      versionKey: plan.versionKey,
      label: plan.label,
      presenceMonthly: plan.presenceMonthly,
      presenceAnnual: plan.presenceAnnual,
      hubAddonMonthly: plan.hubAddonMonthly,
      hubAddonAnnual: plan.hubAddonAnnual,
      categoryAddonMonthly: plan.categoryAddonMonthly,
      categoryAddonAnnual: plan.categoryAddonAnnual,
      microAddonMonthly: plan.microAddonMonthly,
      microAddonAnnual: plan.microAddonAnnual,
      monthlyCreditsIncluded: plan.monthlyCreditsIncluded,
      isCurrentOffering: plan.isCurrentOffering,
      isFounderPlan: plan.isFounderPlan,
    });
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      {!editingPlan && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" data-testid="text-plans-heading">Plan Versions</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPlan({ id: "new" } as PlanVersion);
                setForm({
                  versionKey: "", label: "",
                  presenceMonthly: 2900, presenceAnnual: 29900,
                  hubAddonMonthly: 1900, hubAddonAnnual: 19900,
                  categoryAddonMonthly: 900, categoryAddonAnnual: 8900,
                  microAddonMonthly: 300, microAddonAnnual: 2900,
                  monthlyCreditsIncluded: 10,
                  isCurrentOffering: false, isFounderPlan: false,
                });
              }}
              data-testid="button-add-plan"
            >
              <Plus className="h-4 w-4 mr-1" /> New Plan
            </Button>
          </div>
          <div className="space-y-3">
            {plans?.map((plan) => (
              <Card key={plan.id} className="p-4" data-testid={`card-plan-${plan.versionKey}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{plan.label}</span>
                      <Badge variant="outline" className="text-[10px]">{plan.versionKey}</Badge>
                      {plan.isCurrentOffering && <Badge className="text-[10px]">Current</Badge>}
                      {plan.isFounderPlan && <Badge variant="secondary" className="text-[10px]">Founder</Badge>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>Presence: {cents(plan.presenceMonthly)}/mo</span>
                      <span>Presence: {cents(plan.presenceAnnual)}/yr</span>
                      <span>Hub Add-on: {cents(plan.hubAddonMonthly)}/mo</span>
                      <span>Hub Add-on: {cents(plan.hubAddonAnnual)}/yr</span>
                      <span>Category: {cents(plan.categoryAddonMonthly)}/mo</span>
                      <span>Category: {cents(plan.categoryAddonAnnual)}/yr</span>
                      <span>Micro: {cents(plan.microAddonMonthly)}/mo</span>
                      <span>Micro: {cents(plan.microAddonAnnual)}/yr</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.monthlyCreditsIncluded} monthly credits included
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => startEdit(plan)} data-testid={`button-edit-plan-${plan.versionKey}`}>
                    Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {editingPlan && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4" data-testid="text-plan-form-heading">
            {editingPlan.id === "new" ? "New Plan Version" : `Edit: ${editingPlan.label}`}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Version Key</Label>
                <Input
                  value={form.versionKey}
                  onChange={(e) => setForm(f => ({ ...f, versionKey: e.target.value }))}
                  placeholder="e.g. standard_v2"
                  disabled={editingPlan.id !== "new"}
                  data-testid="input-plan-version-key"
                />
              </div>
              <div>
                <Label>Label</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Standard Plan"
                  data-testid="input-plan-label"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "presenceMonthly", label: "Presence /mo" },
                { key: "presenceAnnual", label: "Presence /yr" },
                { key: "hubAddonMonthly", label: "Hub Add-on /mo" },
                { key: "hubAddonAnnual", label: "Hub Add-on /yr" },
                { key: "categoryAddonMonthly", label: "Category /mo" },
                { key: "categoryAddonAnnual", label: "Category /yr" },
                { key: "microAddonMonthly", label: "Micro /mo" },
                { key: "microAddonAnnual", label: "Micro /yr" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs">{label} (cents)</Label>
                  <Input
                    type="number"
                    value={form[key as keyof typeof form] as number}
                    onChange={(e) => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
                    data-testid={`input-plan-${key}`}
                  />
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs">Monthly Credits Included</Label>
              <Input
                type="number"
                value={form.monthlyCreditsIncluded}
                onChange={(e) => setForm(f => ({ ...f, monthlyCreditsIncluded: parseInt(e.target.value) || 0 }))}
                data-testid="input-plan-credits"
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isCurrentOffering}
                  onCheckedChange={(v) => setForm(f => ({ ...f, isCurrentOffering: v }))}
                  data-testid="switch-plan-current"
                />
                <Label className="text-sm">Current Offering</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isFounderPlan}
                  onCheckedChange={(v) => setForm(f => ({ ...f, isFounderPlan: v }))}
                  data-testid="switch-plan-founder"
                />
                <Label className="text-sm">Founder Plan</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-plan">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Plan
              </Button>
              <Button variant="outline" onClick={() => setEditingPlan(null)} data-testid="button-cancel-plan">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function CreditCostsTab() {
  const { toast } = useToast();
  const { data: costs, isLoading } = useQuery<CreditActionCost[]>({
    queryKey: ["/api/admin/credit-action-costs"],
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newCost, setNewCost] = useState({ actionType: "", label: "", costCredits: 1 });

  const saveMutation = useMutation({
    mutationFn: async (data: { actionType: string; label: string; costCredits: number }) => {
      await apiRequest("PUT", "/api/admin/credit-action-costs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-action-costs"] });
      setShowAdd(false);
      setNewCost({ actionType: "", label: "", costCredits: 1 });
      toast({ title: "Credit cost saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" data-testid="text-credit-costs-heading">Credit Action Costs</h3>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-credit-cost">
          <Plus className="h-4 w-4 mr-1" /> Add Action
        </Button>
      </div>

      {showAdd && (
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Action Type</Label>
              <Input
                value={newCost.actionType}
                onChange={(e) => setNewCost(c => ({ ...c, actionType: e.target.value }))}
                placeholder="e.g. FEATURED_ROTATION"
                data-testid="input-new-action-type"
              />
            </div>
            <div>
              <Label className="text-xs">Display Label</Label>
              <Input
                value={newCost.label}
                onChange={(e) => setNewCost(c => ({ ...c, label: e.target.value }))}
                placeholder="e.g. Featured Rotation"
                data-testid="input-new-action-label"
              />
            </div>
            <div>
              <Label className="text-xs">Cost (credits)</Label>
              <Input
                type="number"
                value={newCost.costCredits}
                onChange={(e) => setNewCost(c => ({ ...c, costCredits: parseInt(e.target.value) || 0 }))}
                data-testid="input-new-action-cost"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={() => saveMutation.mutate(newCost)} disabled={saveMutation.isPending} data-testid="button-save-credit-cost">
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} data-testid="button-cancel-credit-cost">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Action</th>
              <th className="text-left p-2 font-medium">Label</th>
              <th className="text-right p-2 font-medium">Credits</th>
              <th className="text-center p-2 font-medium">Status</th>
              <th className="text-right p-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {costs?.map((cost) => (
              <CreditCostRow key={cost.id} cost={cost} onSave={(data) => saveMutation.mutate(data)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreditCostRow({ cost, onSave }: { cost: CreditActionCost; onSave: (data: { actionType: string; label: string; costCredits: number }) => void }) {
  const [editing, setEditing] = useState(false);
  const [editCost, setEditCost] = useState(cost.costCredits);
  const [editLabel, setEditLabel] = useState(cost.label);

  return (
    <tr className="border-t" data-testid={`row-credit-cost-${cost.actionType}`}>
      <td className="p-2 font-mono text-xs">{cost.actionType}</td>
      <td className="p-2">
        {editing ? (
          <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8 text-xs" data-testid={`input-edit-label-${cost.actionType}`} />
        ) : (
          cost.label
        )}
      </td>
      <td className="p-2 text-right">
        {editing ? (
          <Input type="number" value={editCost} onChange={(e) => setEditCost(parseInt(e.target.value) || 0)} className="h-8 text-xs w-20 ml-auto" data-testid={`input-edit-cost-${cost.actionType}`} />
        ) : (
          <span className="font-semibold">{cost.costCredits}</span>
        )}
      </td>
      <td className="p-2 text-center">
        <Badge variant={cost.isActive ? "default" : "secondary"} className="text-[10px]">
          {cost.isActive ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="p-2 text-right">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <Button size="sm" variant="outline" onClick={() => { onSave({ actionType: cost.actionType, label: editLabel, costCredits: editCost }); setEditing(false); }} data-testid={`button-save-cost-${cost.actionType}`}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} data-testid={`button-cancel-cost-${cost.actionType}`}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} data-testid={`button-edit-cost-${cost.actionType}`}>
            Edit
          </Button>
        )}
      </td>
    </tr>
  );
}

function CreditManagementTab() {
  const { toast } = useToast();
  const [businessId, setBusinessId] = useState("");
  const [searchDone, setSearchDone] = useState(false);

  const { data: walletData, isLoading: walletLoading, refetch } = useQuery<CreditWalletData>({
    queryKey: ["/api/admin/businesses", businessId, "credit-wallet"],
    enabled: false,
  });

  const [grantAmount, setGrantAmount] = useState(10);
  const [grantNote, setGrantNote] = useState("");

  const grantMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/grant-credits`, {
        amount: grantAmount,
        note: grantNote || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "credit-wallet"] });
      refetch();
      setGrantAmount(10);
      setGrantNote("");
      toast({ title: "Credits granted" });
    },
    onError: () => {
      toast({ title: "Failed to grant credits", variant: "destructive" });
    },
  });

  const doSearch = () => {
    if (!businessId.trim()) return;
    setSearchDone(true);
    refetch();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold" data-testid="text-credit-mgmt-heading">Credit Management</h3>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Business ID</Label>
          <Input
            value={businessId}
            onChange={(e) => { setBusinessId(e.target.value); setSearchDone(false); }}
            placeholder="Paste business ID..."
            data-testid="input-credit-business-id"
          />
        </div>
        <Button onClick={doSearch} disabled={!businessId.trim()} data-testid="button-lookup-wallet">
          <Search className="h-4 w-4 mr-1" /> Look Up
        </Button>
      </div>

      {searchDone && walletLoading && <Skeleton className="h-20 w-full" />}

      {searchDone && walletData && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold" data-testid="text-wallet-monthly">{walletData.balance.monthly}</p>
                <p className="text-xs text-muted-foreground">Monthly</p>
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-wallet-banked">{walletData.balance.banked}</p>
                <p className="text-xs text-muted-foreground">Banked</p>
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-wallet-total">{walletData.balance.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Grant Credits</h4>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(parseInt(e.target.value) || 0)}
                  className="w-24"
                  data-testid="input-grant-amount"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Note (optional)</Label>
                <Input
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="Reason for grant..."
                  data-testid="input-grant-note"
                />
              </div>
              <Button onClick={() => grantMutation.mutate()} disabled={grantMutation.isPending || grantAmount <= 0} data-testid="button-grant-credits">
                {grantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Coins className="h-4 w-4 mr-1" />}
                Grant
              </Button>
            </div>
          </Card>

          {walletData.transactions.length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3">Recent Transactions</h4>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-left p-2 font-medium">Type</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                      <th className="text-left p-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletData.transactions.map((tx) => (
                      <tr key={tx.id} className="border-t" data-testid={`row-tx-${tx.id}`}>
                        <td className="p-2">{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td className="p-2">
                          <Badge variant={tx.amount > 0 ? "default" : "secondary"} className="text-[10px]">
                            {tx.txType}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-mono">
                          <span className={tx.amount > 0 ? "text-green-600" : "text-red-500"}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount}
                          </span>
                        </td>
                        <td className="p-2 text-muted-foreground truncate max-w-[200px]">{tx.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function EntitlementViewerTab() {
  const [businessId, setBusinessId] = useState("");
  const [searchDone, setSearchDone] = useState(false);

  const { data: summary, isLoading, refetch } = useQuery<{
    hubs: Array<{
      id: string; hubId: string; status: string; isBaseHub: boolean; billingInterval: string;
      categories: Array<{
        id: string; categoryId: string; status: string; isBaseCategory: boolean;
        micros: Array<{ id: string; microId: string; status: string; isBaseMicro: boolean }>;
      }>;
      capabilities: Array<{ id: string; capabilityType: string; status: string }>;
    }>;
    creditWallet: { monthlyBalance: number; bankedBalance: number } | null;
  }>({
    queryKey: ["/api/admin/businesses", businessId, "entitlement-summary"],
    enabled: false,
  });

  const doSearch = () => {
    if (!businessId.trim()) return;
    setSearchDone(true);
    refetch();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold" data-testid="text-ent-viewer-heading">Per-Account Entitlement Viewer</h3>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Business ID</Label>
          <Input
            value={businessId}
            onChange={(e) => { setBusinessId(e.target.value); setSearchDone(false); }}
            placeholder="Paste business ID..."
            data-testid="input-ent-business-id"
          />
        </div>
        <Button onClick={doSearch} disabled={!businessId.trim()} data-testid="button-lookup-entitlements">
          <Search className="h-4 w-4 mr-1" /> Look Up
        </Button>
      </div>

      {searchDone && isLoading && <Skeleton className="h-40 w-full" />}

      {searchDone && summary && (
        <div className="space-y-3">
          {summary.hubs.length === 0 && (
            <Card className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-entitlements">
              No active entitlements found for this business.
            </Card>
          )}

          {summary.hubs.map((hub) => (
            <Card key={hub.id} className="p-4" data-testid={`card-hub-ent-${hub.id}`}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={hub.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">{hub.status}</Badge>
                <span className="text-sm font-semibold">Hub: {hub.hubId.substring(0, 8)}...</span>
                {hub.isBaseHub && <Badge variant="outline" className="text-[10px]">Base</Badge>}
                <Badge variant="outline" className="text-[10px]">{hub.billingInterval}</Badge>
              </div>

              {hub.categories.length > 0 && (
                <div className="ml-4 space-y-2 mt-2">
                  {hub.categories.map((cat) => (
                    <div key={cat.id} className="border-l-2 pl-3" data-testid={`card-cat-ent-${cat.id}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant={cat.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">{cat.status}</Badge>
                        <span className="text-xs">Category: {cat.categoryId.substring(0, 8)}...</span>
                        {cat.isBaseCategory && <Badge variant="outline" className="text-[10px]">Base</Badge>}
                      </div>
                      {cat.micros.length > 0 && (
                        <div className="ml-4 mt-1 space-y-1">
                          {cat.micros.map((micro) => (
                            <div key={micro.id} className="flex items-center gap-2" data-testid={`card-micro-ent-${micro.id}`}>
                              <Badge variant={micro.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">{micro.status}</Badge>
                              <span className="text-xs">Micro: {micro.microId.substring(0, 8)}...</span>
                              {micro.isBaseMicro && <Badge variant="outline" className="text-[10px]">Base</Badge>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {hub.capabilities.length > 0 && (
                <div className="ml-4 mt-2 flex flex-wrap gap-1">
                  {hub.capabilities.map((cap) => (
                    <Badge key={cap.id} variant={cap.status === "ACTIVE" ? "default" : "outline"} className="text-[10px]" data-testid={`badge-cap-${cap.capabilityType}`}>
                      {cap.capabilityType}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}

          {summary.creditWallet && (
            <Card className="p-4" data-testid="card-viewer-wallet">
              <div className="flex items-center gap-4">
                <Coins className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-sm font-semibold">Credit Wallet</span>
                  <p className="text-xs text-muted-foreground">
                    Monthly: {summary.creditWallet.monthlyBalance} | Banked: {summary.creditWallet.bankedBalance} | Total: {summary.creditWallet.monthlyBalance + summary.creditWallet.bankedBalance}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function EntitlementManagementPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-entitlement-panel-heading">
          <Settings className="h-5 w-5 text-primary" />
          Entitlement Management
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage plans, pricing, credit costs, and account entitlements
        </p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList data-testid="tabs-entitlement-mgmt">
          <TabsTrigger value="plans" data-testid="tab-plans">
            <DollarSign className="h-4 w-4 mr-1" /> Plans & Pricing
          </TabsTrigger>
          <TabsTrigger value="credit-costs" data-testid="tab-credit-costs">
            <CreditCard className="h-4 w-4 mr-1" /> Credit Costs
          </TabsTrigger>
          <TabsTrigger value="credit-mgmt" data-testid="tab-credit-mgmt">
            <Coins className="h-4 w-4 mr-1" /> Credit Management
          </TabsTrigger>
          <TabsTrigger value="viewer" data-testid="tab-viewer">
            <Search className="h-4 w-4 mr-1" /> Entitlement Viewer
          </TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-4">
          <PlansTab />
        </TabsContent>
        <TabsContent value="credit-costs" className="mt-4">
          <CreditCostsTab />
        </TabsContent>
        <TabsContent value="credit-mgmt" className="mt-4">
          <CreditManagementTab />
        </TabsContent>
        <TabsContent value="viewer" className="mt-4">
          <EntitlementViewerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
