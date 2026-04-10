import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Repeat, Plus, DollarSign, Loader2, CheckCircle } from "lucide-react";
import type { Business, RevenueTransaction } from "@shared/schema";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function productLabel(type: string): string {
  const labels: Record<string, string> = {
    LISTING: "Directory Listing",
    AD: "Ad Space",
    OTHER: "License Fee",
  };
  return labels[type] || type;
}

export default function ItexTradesPanel({ cityId: propCityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [productType, setProductType] = useState("");
  const [amount, setAmount] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [itexReferenceId, setItexReferenceId] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: trades, isLoading } = useQuery<RevenueTransaction[]>({
    queryKey: ["/api/admin/itex-trades"],
  });

  const { data: allBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses"],
  });

  const filteredBusinesses = (allBusinesses || []).filter(b =>
    searchQuery.length >= 2 && b.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10);

  const selectedBusiness = allBusinesses?.find(b => b.id === businessId);

  const recordMutation = useMutation({
    mutationFn: async () => {
      const cityId = propCityId || selectedBusiness?.cityId || undefined;
      await apiRequest("POST", "/api/admin/itex-trades", {
        businessId: businessId || undefined,
        productType,
        amount: parseFloat(amount),
        itexReferenceId: itexReferenceId || undefined,
        notes: notes || undefined,
        cityId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/itex-trades"] });
      toast({ title: "ITEX trade recorded" });
      setShowForm(false);
      setProductType("");
      setAmount("");
      setBusinessId("");
      setItexReferenceId("");
      setNotes("");
      setSearchQuery("");
    },
    onError: (err: any) => {
      toast({ title: "Error recording trade", description: err.message, variant: "destructive" });
    },
  });

  const totalItex = (trades || []).reduce((sum, t) => sum + t.grossAmount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-itex-title">
            <Repeat className="h-6 w-6 text-emerald-600" />
            ITEX Barter Trades
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Record and track ITEX barter payments for platform services</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-itex-trade">
          <Plus className="h-4 w-4 mr-1" />
          Record Trade
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-itex-total">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total ITEX Volume</p>
                <p className="text-2xl font-bold" data-testid="text-itex-total">{formatCents(totalItex)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-itex-count">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Repeat className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Trades</p>
                <p className="text-2xl font-bold" data-testid="text-itex-count">{(trades || []).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-itex-recent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold" data-testid="text-itex-month">
                  {(trades || []).filter(t => {
                    const d = new Date(t.createdAt);
                    const now = new Date();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card data-testid="card-itex-form">
          <CardHeader>
            <CardTitle className="text-lg">Record ITEX Trade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Type *</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger data-testid="select-itex-product">
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AD">Ad Space</SelectItem>
                    <SelectItem value="LISTING_TIER">Directory Listing (Hub Presence)</SelectItem>
                    <SelectItem value="LICENSE">Metro / Micro License Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ITEX Trade Amount ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-itex-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Business (optional)</Label>
              <div className="relative">
                <Input
                  value={selectedBusiness ? selectedBusiness.name : searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    if (businessId) setBusinessId("");
                  }}
                  placeholder="Search business by name..."
                  data-testid="input-itex-business-search"
                />
                {filteredBusinesses.length > 0 && !businessId && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredBusinesses.map(b => (
                      <button
                        key={b.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setBusinessId(b.id);
                          setSearchQuery("");
                        }}
                        data-testid={`option-business-${b.id}`}
                      >
                        {b.name}
                        {b.address && <span className="text-muted-foreground ml-2 text-xs">{b.address}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedBusiness && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedBusiness.name}</Badge>
                  <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={() => { setBusinessId(""); setSearchQuery(""); }}>
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ITEX Reference / Transaction ID</Label>
                <Input
                  value={itexReferenceId}
                  onChange={e => setItexReferenceId(e.target.value)}
                  placeholder="e.g., ITEX-2026-001"
                  data-testid="input-itex-reference"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional notes about this trade..."
                  rows={2}
                  data-testid="input-itex-notes"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => recordMutation.mutate()}
                disabled={!productType || !amount || recordMutation.isPending}
                data-testid="button-submit-itex-trade"
              >
                {recordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Repeat className="h-4 w-4 mr-1" />}
                Record ITEX Trade
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} data-testid="button-cancel-itex">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (trades || []).length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No ITEX trades recorded yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-muted-foreground border-b pb-2">
                <span>Date</span>
                <span>Type</span>
                <span>Amount</span>
                <span>Reference</span>
                <span>Notes</span>
              </div>
              {(trades || []).map((trade) => (
                <div key={trade.id} className="grid grid-cols-5 gap-2 text-sm py-2 border-b last:border-0" data-testid={`row-itex-trade-${trade.id}`}>
                  <span className="text-muted-foreground">
                    {new Date(trade.createdAt).toLocaleDateString()}
                  </span>
                  <span>
                    <Badge variant="secondary" className="text-xs">
                      {productLabel(trade.transactionType)}
                    </Badge>
                  </span>
                  <span className="font-semibold text-emerald-600">{formatCents(trade.grossAmount)}</span>
                  <span className="text-muted-foreground text-xs truncate">{(trade as any).itexReferenceId || "—"}</span>
                  <span className="text-muted-foreground text-xs truncate">{(trade as any).notes || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
