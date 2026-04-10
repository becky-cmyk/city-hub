import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DollarSign, MapPin, Users, Store, AlertTriangle, Loader2, Send,
  Link2, CheckCircle, Clock, TrendingDown, Building2, Copy, Check
} from "lucide-react";
import type { Territory, Operator } from "@shared/schema";

type TerritoryWithOperator = Territory & {
  operator: { id: string; displayName: string; email: string } | null;
};

type SalesSummary = {
  byStatus: Record<string, { count: number; total: number }>;
  totalPipeline: number;
  totalTerritories: number;
  revenueCollected: number;
};

type Alert = {
  territoryId: string;
  territoryName: string;
  pricingTier: number;
  operator: { id: string; displayName: string; email: string } | null;
  revenueMinimum: number;
  actualRevenue: number;
  shortfall: number;
  lastTransactionDate: string | null;
};

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function tierBadge(tier: number | null) {
  if (!tier) return null;
  const colors: Record<number, string> = {
    1: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    2: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    3: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    4: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    5: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    6: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    7: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };
  return (
    <Badge className={colors[tier] || ""} data-testid={`badge-tier-${tier}`}>
      T{tier}
    </Badge>
  );
}

function saleStatusBadge(status: string | null) {
  const s = status || "AVAILABLE";
  const styles: Record<string, { className: string; label: string }> = {
    AVAILABLE: { className: "border border-muted-foreground/30 text-muted-foreground bg-transparent", label: "Available" },
    RESERVED: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Reserved" },
    SOLD: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Sold" },
    ACTIVE: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Active" },
    DELINQUENT: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Delinquent" },
  };
  const style = styles[s] || styles.AVAILABLE;
  return <Badge className={style.className} data-testid={`badge-sale-${s.toLowerCase()}`}>{style.label}</Badge>;
}

function SummaryCards({ summary }: { summary: SalesSummary }) {
  const available = summary.byStatus["AVAILABLE"] || { count: 0, total: 0 };
  const sold = (summary.byStatus["SOLD"]?.count || 0) + (summary.byStatus["ACTIVE"]?.count || 0);
  const soldTotal = (summary.byStatus["SOLD"]?.total || 0) + (summary.byStatus["ACTIVE"]?.total || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card data-testid="card-pipeline-value">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Pipeline</p>
              <p className="text-2xl font-bold" data-testid="text-pipeline-value">{formatDollars(summary.totalPipeline)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-territories-sold">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Store className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Territories Sold</p>
              <p className="text-2xl font-bold" data-testid="text-territories-sold">{sold} <span className="text-sm font-normal text-muted-foreground">({formatDollars(soldTotal)})</span></p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-revenue-collected">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">Revenue Collected</p>
              <p className="text-2xl font-bold" data-testid="text-revenue-collected">{formatDollars(summary.revenueCollected)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-territories-available">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <MapPin className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold" data-testid="text-territories-available">{available.count} <span className="text-sm font-normal text-muted-foreground">({formatDollars(available.total)})</span></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MarkSoldDialog({ territory, open, onClose }: { territory: TerritoryWithOperator; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [operatorEmail, setOperatorEmail] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("");

  const { data: existingOperators } = useQuery<Operator[]>({
    queryKey: ["/api/admin/operators"],
    enabled: open,
  });

  const createOperatorMutation = useMutation({
    mutationFn: async (data: { displayName: string; email: string }) => {
      const res = await apiRequest("POST", "/api/admin/operators", {
        ...data,
        operatorType: "MICRO",
        status: "ACTIVE",
        pipelineStage: "ACTIVE",
      });
      return res.json();
    },
  });

  const markSoldMutation = useMutation({
    mutationFn: async (operatorId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/territory-sales/${territory.id}/mark-sold`, { operatorId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territory-sales"] });
      toast({ title: "Territory marked as sold", description: `${territory.name} has been assigned.` });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  async function handleSubmit() {
    let opId = selectedOperatorId;
    if (!opId && operatorEmail && operatorName) {
      try {
        const newOp = await createOperatorMutation.mutateAsync({ displayName: operatorName, email: operatorEmail });
        opId = newOp.id;
      } catch {
        return;
      }
    }
    if (!opId) {
      toast({ title: "Select or create an operator", variant: "destructive" });
      return;
    }
    markSoldMutation.mutate(opId);
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-mark-sold">
        <DialogHeader>
          <DialogTitle>Mark {territory.name} as Sold</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tier {territory.pricingTier} — {formatDollars(territory.territoryPrice || 0)}</p>
          </div>
          {existingOperators && existingOperators.length > 0 && (
            <div className="space-y-2">
              <Label>Select Existing Operator</Label>
              <Select value={selectedOperatorId} onValueChange={(v) => { setSelectedOperatorId(v); setOperatorEmail(""); setOperatorName(""); }}>
                <SelectTrigger data-testid="select-operator">
                  <SelectValue placeholder="Choose operator..." />
                </SelectTrigger>
                <SelectContent>
                  {existingOperators.map(op => (
                    <SelectItem key={op.id} value={op.id}>{op.displayName} ({op.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Or create new operator</p>
            <div className="space-y-2">
              <Input
                placeholder="Operator name"
                value={operatorName}
                onChange={e => { setOperatorName(e.target.value); setSelectedOperatorId(""); }}
                data-testid="input-operator-name"
              />
              <Input
                placeholder="Operator email"
                value={operatorEmail}
                onChange={e => { setOperatorEmail(e.target.value); setSelectedOperatorId(""); }}
                data-testid="input-operator-email"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-sold">Cancel</Button>
          <Button onClick={handleSubmit} disabled={markSoldMutation.isPending} data-testid="button-confirm-sold">
            {markSoldMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Mark as Sold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetMinimumDialog({ territory, open, onClose }: { territory: TerritoryWithOperator; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(territory.revenueMinimum ? String(territory.revenueMinimum / 100) : "");

  const mutation = useMutation({
    mutationFn: async (revenueMinimum: number) => {
      const res = await apiRequest("PATCH", `/api/admin/territory-sales/${territory.id}/revenue-minimum`, { revenueMinimum });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territory-sales"] });
      toast({ title: "Revenue minimum updated" });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-set-minimum">
        <DialogHeader>
          <DialogTitle>Set Revenue Minimum — {territory.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Quarterly Minimum ($)</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 500"
              data-testid="input-revenue-minimum"
            />
            <p className="text-xs text-muted-foreground mt-1">Minimum revenue expected per quarter (in dollars)</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-minimum">Cancel</Button>
          <Button
            onClick={() => mutation.mutate(Math.round(parseFloat(amount) * 100))}
            disabled={mutation.isPending || !amount}
            data-testid="button-save-minimum"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TerritoryTable({ territories: data, filterStatus }: { territories: TerritoryWithOperator[]; filterStatus?: string }) {
  const { toast } = useToast();
  const [markSoldTarget, setMarkSoldTarget] = useState<TerritoryWithOperator | null>(null);
  const [setMinTarget, setSetMinTarget] = useState<TerritoryWithOperator | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/territory-sales/${id}/send-invoice`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territory-sales"] });
      toast({ title: "Invoice sent", description: `Invoice ${data.invoiceId} sent to operator.` });
    },
    onError: (err: any) => {
      toast({ title: "Invoice error", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/territory-sales/${id}/create-checkout`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        navigator.clipboard.writeText(data.checkoutUrl);
        setCopiedId(data.sessionId);
        setTimeout(() => setCopiedId(null), 3000);
        toast({ title: "Payment link copied", description: "Stripe checkout link has been copied to clipboard." });
      }
    },
    onError: (err: any) => {
      toast({ title: "Checkout error", description: err.message, variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/territory-sales/${id}/confirm-activation`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territory-sales"] });
      toast({ title: "Activation confirmed" });
    },
  });

  const filtered = filterStatus ? data.filter(t => (t.saleStatus || "AVAILABLE") === filterStatus) : data;

  const grouped: Record<string, TerritoryWithOperator[]> = {};
  for (const t of filtered) {
    const codes = t.geoCodes as string[] | null;
    const isSC = codes?.some(z => ["29706","29055","29707","29720","29710","29715","29708","29730","29732","29733","29745","29520","29709","29728"].includes(z));
    let county = "Other";
    if (t.code === "UPTOWN" || t.code === "BALLANTYNE" || t.code === "CORNELIUS" || t.code === "DAVIDSON" || t.code === "HUNTERSVILLE" || t.code === "MATTHEWS" || t.code === "MINTHILL" || t.code === "NORTHLAKE" || t.code === "PINEVILLE" || t.code === "UNICITY") county = "Mecklenburg";
    else if (t.code === "CONCORD" || t.code === "HARRISBURG" || t.code === "KANNAPOLIS" || t.code === "MIDLAND" || t.code === "MOUNTPLEASANT") county = "Cabarrus";
    else if (t.code === "CHESTER_TOWN" || t.code === "GREATFALLS") county = "Chester SC";
    else if (t.code === "GASTONIA" || t.code === "BELMONT" || t.code === "MOUNTHOLLY" || t.code === "CRAMERTON" || t.code === "LOWELL" || t.code === "MCADENVILLE" || t.code === "RANLO") county = "Gaston";
    else if (t.code === "MOORESVILLE" || t.code === "STATESVILLE" || t.code === "TROUTMAN") county = "Iredell";
    else if (t.code === "INDIANLAND" || t.code === "LANCASTER_TOWN") county = "Lancaster SC";
    else if (t.code === "DENVER" || t.code === "LINCOLNTON") county = "Lincoln";
    else if (t.code === "CHINAGROVE" || t.code === "SALISBURY") county = "Rowan";
    else if (t.code === "ALBEMARLE" || t.code === "LOCUST") county = "Stanly";
    else if (t.code === "INDIANTRAIL" || t.code === "MARVIN" || t.code === "MONROE" || t.code === "STALLINGS" || t.code === "WAXHAW" || t.code === "WEDDINGTON" || t.code === "WESLEYCHAPEL") county = "Union";
    else if (t.code === "CLOVER" || t.code === "FORTMILL" || t.code === "LAKEWYLIE" || t.code === "ROCKHILL" || t.code === "TEGACAY" || t.code === "YORK_TOWN") county = "York SC";
    else if (t.code === "WADESBORO" || t.code === "POLKTON" || t.code === "PEACHLAND" || t.code === "MORVEN" || t.code === "LILESVILLE") county = "Anson";
    else if (t.code === "SHELBY" || t.code === "KINGSMOUNTAIN" || t.code === "BOILINGSPRINGS" || t.code === "LAWNDALE") county = "Cleveland";
    else if (t.code === "HICKORY" || t.code === "NEWTON" || t.code === "CONOVER" || t.code === "MAIDEN") county = "Catawba";
    else if (t.code === "TAYLORSVILLE" || t.code === "HIDDENITE") county = "Alexander";
    else if (t.code === "MORGANTON" || t.code === "VALDESE" || t.code === "GLENALPINE") county = "Burke";
    else if (t.code === "LENOIR" || t.code === "GRANITEFALLS" || t.code === "HUDSON") county = "Caldwell";
    else if (t.code === "MARION" || t.code === "OLDFORT") county = "McDowell";
    else if (t.code === "CHERAW" || t.code === "CHESTERFIELD_TOWN" || t.code === "PAGELAND") county = "Chesterfield SC";
    if (!grouped[county]) grouped[county] = [];
    grouped[county].push(t);
  }

  const counties = Object.keys(grouped).sort();

  return (
    <>
      <div className="space-y-6">
        {counties.map(county => (
          <div key={county}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2" data-testid={`heading-county-${county.replace(/\s/g, "-").toLowerCase()}`}>
              {county} ({grouped[county].length})
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-medium">Hub</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">ZIPs</th>
                    <th className="text-right p-3 font-medium hidden lg:table-cell">Pop.</th>
                    <th className="text-right p-3 font-medium hidden lg:table-cell">Biz</th>
                    <th className="text-center p-3 font-medium">Tier</th>
                    <th className="text-right p-3 font-medium">Price</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium hidden xl:table-cell">Operator</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[county].map(t => {
                    const isSold = t.saleStatus === "SOLD" || t.saleStatus === "ACTIVE";
                    return (
                      <tr key={t.id} className="border-t hover:bg-muted/30" data-testid={`row-territory-${t.code}`}>
                        <td className="p-3 font-medium">{t.name}</td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{(t.geoCodes as string[] || []).join(", ")}</td>
                        <td className="p-3 text-right hidden lg:table-cell">{(t.population || 0).toLocaleString()}</td>
                        <td className="p-3 text-right hidden lg:table-cell">{(t.businessCount || 0).toLocaleString()}</td>
                        <td className="p-3 text-center">{tierBadge(t.pricingTier)}</td>
                        <td className="p-3 text-right font-medium">{formatDollars(t.territoryPrice || 0)}</td>
                        <td className="p-3 text-center">{saleStatusBadge(t.saleStatus)}</td>
                        <td className="p-3 hidden xl:table-cell">
                          {t.operator ? (
                            <span className="text-xs">{t.operator.displayName}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {(t.saleStatus === "AVAILABLE" || !t.saleStatus) && (
                              <Button size="sm" variant="outline" onClick={() => setMarkSoldTarget(t)} data-testid={`button-mark-sold-${t.code}`}>
                                <Store className="h-3 w-3 mr-1" /> Sell
                              </Button>
                            )}
                            {t.saleStatus === "SOLD" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => invoiceMutation.mutate(t.id)} disabled={invoiceMutation.isPending} data-testid={`button-invoice-${t.code}`}>
                                  <Send className="h-3 w-3 mr-1" /> Invoice
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => checkoutMutation.mutate(t.id)} disabled={checkoutMutation.isPending} data-testid={`button-link-${t.code}`}>
                                  {copiedId ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />} Link
                                </Button>
                                <Button size="sm" variant="default" onClick={() => confirmMutation.mutate(t.id)} disabled={confirmMutation.isPending} data-testid={`button-activate-${t.code}`}>
                                  <CheckCircle className="h-3 w-3 mr-1" /> Activate
                                </Button>
                              </>
                            )}
                            {isSold && (
                              <Button size="sm" variant="ghost" onClick={() => setSetMinTarget(t)} data-testid={`button-minimum-${t.code}`}>
                                <TrendingDown className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {counties.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No territories found.</p>
        )}
      </div>
      {markSoldTarget && (
        <MarkSoldDialog territory={markSoldTarget} open={!!markSoldTarget} onClose={() => setMarkSoldTarget(null)} />
      )}
      {setMinTarget && (
        <SetMinimumDialog territory={setMinTarget} open={!!setMinTarget} onClose={() => setSetMinTarget(null)} />
      )}
    </>
  );
}

function PipelineTab({ data }: { data: TerritoryWithOperator[] }) {
  const statuses = ["AVAILABLE", "RESERVED", "SOLD", "ACTIVE", "DELINQUENT"];
  const counts: Record<string, { count: number; value: number }> = {};
  for (const s of statuses) {
    counts[s] = { count: 0, value: 0 };
  }
  for (const t of data) {
    const s = t.saleStatus || "AVAILABLE";
    if (counts[s]) {
      counts[s].count++;
      counts[s].value += t.territoryPrice || 0;
    }
  }

  const stageColors: Record<string, string> = {
    AVAILABLE: "bg-gray-200 dark:bg-gray-700",
    RESERVED: "bg-yellow-200 dark:bg-yellow-800",
    SOLD: "bg-blue-200 dark:bg-blue-800",
    ACTIVE: "bg-green-200 dark:bg-green-800",
    DELINQUENT: "bg-red-200 dark:bg-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        {statuses.map(s => (
          <Card key={s} data-testid={`card-pipeline-${s.toLowerCase()}`}>
            <CardContent className="pt-4 pb-4 text-center">
              <div className={`w-full h-2 rounded-full mb-3 ${stageColors[s]}`} />
              <p className="text-xs text-muted-foreground uppercase">{s}</p>
              <p className="text-2xl font-bold">{counts[s].count}</p>
              <p className="text-xs text-muted-foreground">{formatDollars(counts[s].value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {statuses.filter(s => counts[s].count > 0).map(s => (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{s} ({counts[s].count})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {data.filter(t => (t.saleStatus || "AVAILABLE") === s).map(t => (
                  <div key={t.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{t.name} {tierBadge(t.pricingTier)}</span>
                    <span className="font-medium">{formatDollars(t.territoryPrice || 0)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AlertsTab() {
  const { data, isLoading } = useQuery<{ alerts: Alert[]; count: number }>({
    queryKey: ["/api/admin/territory-sales/alerts"],
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const alerts = data?.alerts || [];

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <p className="text-muted-foreground">All active territories are meeting their revenue minimums.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map(a => (
        <Card key={a.territoryId} className="border-red-200 dark:border-red-900" data-testid={`card-alert-${a.territoryId}`}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="font-medium">{a.territoryName}</span>
                  {tierBadge(a.pricingTier)}
                </div>
                {a.operator && (
                  <p className="text-sm text-muted-foreground">{a.operator.displayName} ({a.operator.email})</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm">Min: <span className="font-medium">{formatDollars(a.revenueMinimum)}</span></p>
                <p className="text-sm">Actual: <span className="font-medium text-red-600">{formatDollars(a.actualRevenue)}</span></p>
                <p className="text-sm font-bold text-red-600">Shortfall: {formatDollars(a.shortfall)}</p>
                {a.lastTransactionDate && (
                  <p className="text-xs text-muted-foreground mt-1">Last tx: {new Date(a.lastTransactionDate).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function TerritorySalesPanel({ cityId }: { cityId?: string }) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");

  const { data: territories, isLoading } = useQuery<TerritoryWithOperator[]>({
    queryKey: ["/api/admin/territory-sales"],
  });

  const { data: summary } = useQuery<SalesSummary>({
    queryKey: ["/api/admin/territory-sales/summary"],
  });

  const { data: alertData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/territory-sales/alerts"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  let filtered = territories || [];
  if (filterTier !== "all") {
    filtered = filtered.filter(t => t.pricingTier === parseInt(filterTier));
  }

  return (
    <div className="space-y-6" data-testid="territory-sales-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Territory Sales</h2>
          <p className="text-sm text-muted-foreground">Manage micro hub territory sales, invoicing, and revenue tracking</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-[120px]" data-testid="select-filter-tier">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7].map(t => (
                <SelectItem key={t} value={String(t)}>Tier {t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summary && <SummaryCards summary={summary} />}

      <Tabs defaultValue="territories">
        <TabsList data-testid="tabs-territory-sales">
          <TabsTrigger value="territories" data-testid="tab-territories">
            <MapPin className="h-4 w-4 mr-1" /> Territories
          </TabsTrigger>
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">
            <TrendingDown className="h-4 w-4 mr-1" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <AlertTriangle className="h-4 w-4 mr-1" /> Alerts
            {(alertData?.count || 0) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{alertData?.count}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="territories" className="mt-4">
          <div className="flex gap-2 mb-4">
            {["all", "AVAILABLE", "SOLD", "ACTIVE", "DELINQUENT"].map(s => (
              <Button
                key={s}
                size="sm"
                variant={filterStatus === s ? "default" : "outline"}
                onClick={() => setFilterStatus(s)}
                data-testid={`button-filter-${s.toLowerCase()}`}
              >
                {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
          <TerritoryTable territories={filtered} filterStatus={filterStatus === "all" ? undefined : filterStatus} />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab data={filtered} />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <AlertsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
