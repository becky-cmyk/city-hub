import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, CheckCircle, Clock, Loader2, RefreshCw, Search, ChevronDown, ChevronUp } from "lucide-react";

interface PayoutEntry {
  id: string;
  operatorId: string;
  operatorName: string | null;
  operatorType: string | null;
  periodStart: string;
  periodEnd: string;
  totalSplitsCents: number;
  splitCount: number;
  status: string;
  approvedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface SplitEntry {
  id: string;
  transactionId: string;
  splitType: string;
  splitAmount: number;
  operatorId: string | null;
  status: string;
  createdAt: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function statusBadge(status: string) {
  if (status === "PAID") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" data-testid={`badge-status-${status}`}>Paid</Badge>;
  if (status === "APPROVED") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid={`badge-status-${status}`}>Approved</Badge>;
  return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Open</Badge>;
}

function typeBadge(type: string | null) {
  if (!type) return null;
  if (type === "METRO") return <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" data-testid={`badge-type-${type}`}>Metro</Badge>;
  return <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400" data-testid={`badge-type-${type}`}>Micro</Badge>;
}

function SplitsDialog({ entry, open, onClose }: { entry: PayoutEntry; open: boolean; onClose: () => void }) {
  const { data: splits = [], isLoading } = useQuery<SplitEntry[]>({
    queryKey: ["/api/admin/payouts", entry.id, "splits"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payouts/${entry.id}/splits`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch splits");
      return res.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-splits-dialog-title">
            Revenue Splits — {entry.operatorName || entry.operatorId}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{formatMonth(entry.periodStart)}</p>
        </DialogHeader>
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {!isLoading && splits.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No revenue splits found for this period.</p>
        )}
        {splits.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground px-3 py-1">
              <span>Type</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Transaction</span>
              <span>Date</span>
            </div>
            {splits.map((s) => (
              <Card key={s.id} data-testid={`card-split-detail-${s.id}`}>
                <CardContent className="py-2 px-3">
                  <div className="grid grid-cols-5 gap-2 items-center text-sm">
                    <Badge variant="outline" className="w-fit">{s.splitType}</Badge>
                    <span className="font-medium">{formatCents(s.splitAmount)}</span>
                    <Badge variant="secondary" className="w-fit">{s.status}</Badge>
                    <span className="text-xs text-muted-foreground truncate">{s.transactionId?.slice(0, 8)}...</span>
                    <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">{splits.length} splits</span>
              <span className="text-sm font-bold" data-testid="text-splits-total">
                Total: {formatCents(entry.totalSplitsCents)}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PayoutManagementPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [operatorSearch, setOperatorSearch] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [splitsEntry, setSplitsEntry] = useState<PayoutEntry | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (monthFilter) queryParams.set("month", monthFilter);
  const qs = queryParams.toString();

  const { data: entries = [], isLoading } = useQuery<PayoutEntry[]>({
    queryKey: ["/api/admin/payouts", statusFilter, monthFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payouts${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payouts");
      return res.json();
    },
  });

  const filteredEntries = operatorSearch
    ? entries.filter((e) =>
        (e.operatorName || "").toLowerCase().includes(operatorSearch.toLowerCase()) ||
        e.operatorId.toLowerCase().includes(operatorSearch.toLowerCase())
      )
    : entries;

  const totalOpen = entries.filter((e) => e.status === "OPEN").reduce((s, e) => s + e.totalSplitsCents, 0);
  const totalApproved = entries.filter((e) => e.status === "APPROVED").reduce((s, e) => s + e.totalSplitsCents, 0);
  const totalPaid = entries.filter((e) => e.status === "PAID").reduce((s, e) => s + e.totalSplitsCents, 0);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/payouts/generate", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      toast({ title: "Ledger Generated", description: data.message || "Monthly payout ledger generated successfully." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/payouts/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      toast({ title: "Payout Approved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/payouts/${id}/paid`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      toast({ title: "Payout Marked as Paid" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-payout-heading">Payout Management</h2>
          <p className="text-muted-foreground text-sm">Review monthly operator payouts, approve, and mark paid.</p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-ledger"
        >
          {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Generate Current Month
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-open">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Open</p>
                <p className="text-2xl font-bold" data-testid="text-total-open">{formatCents(totalOpen)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-approved">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Approved</p>
                <p className="text-2xl font-bold" data-testid="text-total-approved">{formatCents(totalApproved)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-paid">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold" data-testid="text-total-paid">{formatCents(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-payout-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="w-48"
          data-testid="input-month-filter"
        />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search operator..."
            value={operatorSearch}
            onChange={(e) => setOperatorSearch(e.target.value)}
            className="pl-9"
            data-testid="input-operator-search"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filteredEntries.length} entries</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && filteredEntries.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No payout ledger entries found. Use "Generate Current Month" to create entries from existing revenue splits.
          </CardContent>
        </Card>
      )}

      {filteredEntries.length > 0 && (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-7 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Operator</span>
            <span>Type</span>
            <span>Period</span>
            <span>Splits</span>
            <span>Total Due</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {filteredEntries.map((entry) => (
            <Card key={entry.id} data-testid={`card-payout-${entry.id}`}>
              <CardContent className="py-3 px-4">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
                  <div className="min-w-0">
                    <p className="font-medium truncate" data-testid={`text-operator-name-${entry.id}`}>
                      {entry.operatorName || entry.operatorId.slice(0, 8)}
                    </p>
                  </div>
                  <div>{typeBadge(entry.operatorType)}</div>
                  <div className="text-sm text-muted-foreground" data-testid={`text-period-${entry.id}`}>
                    {formatMonth(entry.periodStart)}
                  </div>
                  <div className="text-sm" data-testid={`text-split-count-${entry.id}`}>
                    {entry.splitCount} splits
                  </div>
                  <div className="font-bold" data-testid={`text-total-due-${entry.id}`}>
                    {formatCents(entry.totalSplitsCents)}
                  </div>
                  <div>{statusBadge(entry.status)}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.status === "OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveMutation.mutate(entry.id)}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-${entry.id}`}
                      >
                        Approve
                      </Button>
                    )}
                    {entry.status === "APPROVED" && (
                      <Button
                        size="sm"
                        onClick={() => markPaidMutation.mutate(entry.id)}
                        disabled={markPaidMutation.isPending}
                        data-testid={`button-mark-paid-${entry.id}`}
                      >
                        Mark Paid
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSplitsEntry(entry)}
                      data-testid={`button-view-splits-${entry.id}`}
                    >
                      {expandedId === entry.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      View Splits
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {splitsEntry && (
        <SplitsDialog
          entry={splitsEntry}
          open={!!splitsEntry}
          onClose={() => setSplitsEntry(null)}
        />
      )}
    </div>
  );
}
