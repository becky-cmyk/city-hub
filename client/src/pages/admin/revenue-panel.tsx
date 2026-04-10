import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, TrendingUp, Clock, CheckCircle, MapPin, Users, Loader2 } from "lucide-react";
import type { Territory, RevenueSplit } from "@shared/schema";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function splitStatusBadge(status: string) {
  if (status === "PAID") return <Badge className="bg-green-100 text-green-800" data-testid={`badge-split-${status}`}>Paid</Badge>;
  if (status === "PAYABLE") return <Badge className="bg-blue-100 text-blue-800" data-testid={`badge-split-${status}`}>Payable</Badge>;
  return <Badge variant="secondary" data-testid={`badge-split-${status}`}>Pending</Badge>;
}

function splitTypeBadge(type: string) {
  const colors: Record<string, string> = {
    CITY_CORE: "bg-purple-100 text-purple-800",
    METRO: "bg-indigo-100 text-indigo-800",
    MICRO: "bg-teal-100 text-teal-800",
    REFERRAL: "bg-orange-100 text-orange-800",
  };
  return <Badge className={colors[type] || ""} data-testid={`badge-type-${type}`}>{type}</Badge>;
}

function OverviewTab() {
  const { data: summary, isLoading } = useQuery<{
    totalRevenue: number;
    pending: number;
    payable: number;
    paid: number;
    territoryCount: number;
    operatorCount: number;
  }>({ queryKey: ["/api/admin/revenue/summary"] });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!summary) return <p className="text-muted-foreground">No revenue data available yet.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-revenue">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold" data-testid="text-total-revenue">{formatCents(summary.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold" data-testid="text-pending">{formatCents(summary.pending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-payable">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Payable</p>
                <p className="text-2xl font-bold" data-testid="text-payable">{formatCents(summary.payable)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-paid">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold" data-testid="text-paid">{formatCents(summary.paid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <MapPin className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Active Territories</p>
              <p className="text-xl font-bold" data-testid="text-territory-count">{summary.territoryCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Licensed Operators</p>
              <p className="text-xl font-bold" data-testid="text-operator-count">{summary.operatorCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="text-sm space-y-2">
          <p className="font-medium">Revenue Split Rules</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-muted-foreground">
            <div>
              <p className="font-medium text-foreground text-xs uppercase tracking-wider mb-1">Standard Listing</p>
              <p>With Micro: 40% Micro / 30% Metro / 30% City Core</p>
              <p>No Micro: 60% Metro / 40% City Core</p>
              <p>No Metro: 100% City Core</p>
            </div>
            <div>
              <p className="font-medium text-foreground text-xs uppercase tracking-wider mb-1">Activation Fees</p>
              <p>Micro (by Metro): 50% Metro / 50% City Core</p>
              <p>Metro: 100% City Core (10% referral if Micro sourced)</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ByTerritoryTab() {
  const [selectedId, setSelectedId] = useState<string>("");
  const { data: territories = [] } = useQuery<Territory[]>({ queryKey: ["/api/admin/territories"] });
  const { data: territoryRevenue, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/revenue/by-territory", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/revenue/by-territory/${selectedId}`);
      if (!res.ok) throw new Error("Failed to fetch territory revenue");
      return res.json();
    },
    enabled: !!selectedId,
  });

  return (
    <div className="space-y-4">
      <div>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full md:w-80" data-testid="select-territory-revenue">
            <SelectValue placeholder="Select a territory..." />
          </SelectTrigger>
          <SelectContent>
            {territories.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name} ({t.code}) - {t.type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {territoryRevenue && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Gross Revenue</p>
              <p className="text-3xl font-bold" data-testid="text-territory-gross">{formatCents(territoryRevenue.totalGross)}</p>
            </CardContent>
          </Card>

          {territoryRevenue.transactions?.length > 0 ? (
            <div className="space-y-2">
              {territoryRevenue.transactions.map((txn: any) => (
                <Card key={txn.id} data-testid={`card-txn-${txn.id}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{txn.transactionType}</Badge>
                        <span className="font-medium">{formatCents(txn.grossAmount)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(txn.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {txn.splits?.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-1 text-sm">
                          {splitTypeBadge(s.splitType)}
                          <span>{formatCents(s.splitAmount)}</span>
                          {splitStatusBadge(s.status)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No transactions for this territory yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PayoutLedgerTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const queryKey = statusFilter === "all"
    ? ["/api/admin/revenue/splits"]
    : ["/api/admin/revenue/splits", { status: statusFilter }];

  const url = statusFilter === "all"
    ? "/api/admin/revenue/splits"
    : `/api/admin/revenue/splits?status=${statusFilter}`;

  const { data: splits = [], isLoading } = useQuery<RevenueSplit[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch splits");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/revenue-splits/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/revenue/splits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/revenue/summary"] });
      toast({ title: "Split status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="select-payout-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAYABLE">Payable</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{splits.length} splits</span>
      </div>

      {isLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {splits.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No revenue splits found. Splits are created automatically when payments come through Stripe.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {splits.map((split) => (
          <Card key={split.id} data-testid={`card-split-${split.id}`}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {splitTypeBadge(split.splitType)}
                <span className="font-medium">{formatCents(split.splitAmount)}</span>
                {splitStatusBadge(split.status)}
                <span className="text-xs text-muted-foreground">{new Date(split.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2">
                {split.status === "PENDING" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: split.id, status: "PAYABLE" })} data-testid={`button-mark-payable-${split.id}`}>
                    Mark Payable
                  </Button>
                )}
                {split.status === "PAYABLE" && (
                  <Button size="sm" variant="default" onClick={() => updateStatusMutation.mutate({ id: split.id, status: "PAID" })} data-testid={`button-mark-paid-${split.id}`}>
                    Mark Paid
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function RevenuePanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-revenue-heading">Revenue & Payouts</h2>
        <p className="text-muted-foreground">Track revenue, manage splits, and process operator payouts. All revenue flows through City Metro Hub.</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-revenue-overview">Overview</TabsTrigger>
          <TabsTrigger value="by-territory" data-testid="tab-revenue-territory">By Territory</TabsTrigger>
          <TabsTrigger value="payout-ledger" data-testid="tab-payout-ledger">Payout Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="by-territory"><ByTerritoryTab /></TabsContent>
        <TabsContent value="payout-ledger"><PayoutLedgerTab /></TabsContent>
      </Tabs>
    </div>
  );
}
