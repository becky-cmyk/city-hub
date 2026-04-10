import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertTriangle, Circle, ClipboardList } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AuditItem {
  id: string;
  featureName: string;
  tier: string;
  status: string;
  notes: string | null;
  lastUpdated: string;
}

const tierColors: Record<string, string> = {
  Enhanced: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Shared: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  "Implemented": CheckCircle2,
  "Partial": AlertTriangle,
  "Not Implemented": Circle,
};

const statusColors: Record<string, string> = {
  "Implemented": "text-green-600",
  "Partial": "text-amber-500",
  "Not Implemented": "text-gray-400",
};

export default function FeatureAuditPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery<AuditItem[]>({
    queryKey: ["/api/admin/feature-audit"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: string; notes?: string }) => {
      await apiRequest("PUT", `/api/admin/feature-audit/${id}`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-audit"] });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    },
  });

  const implemented = items.filter(i => i.status === "Implemented").length;
  const partial = items.filter(i => i.status === "Partial").length;
  const notImpl = items.filter(i => i.status === "Not Implemented").length;
  const topGaps = items.filter(i => i.status === "Not Implemented").slice(0, 10);

  const filtered = filter === "all" ? items : items.filter(i => i.tier === filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold" data-testid="text-feature-audit-title">Hub Presence Feature Audit</h1>
          <p className="text-sm text-muted-foreground">Track implementation status of all Hub Presence features</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-implemented-count">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold">{implemented}</div>
              <div className="text-sm text-muted-foreground">Implemented</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-partial-count">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{partial}</div>
              <div className="text-sm text-muted-foreground">Partial</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-not-implemented-count">
          <CardContent className="p-4 flex items-center gap-3">
            <Circle className="h-8 w-8 text-gray-400" />
            <div>
              <div className="text-2xl font-bold">{notImpl}</div>
              <div className="text-sm text-muted-foreground">Not Implemented</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {topGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Gaps (Not Implemented)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {topGaps.map(g => (
                <li key={g.id} className="text-sm flex items-center gap-2">
                  <Circle className="h-3 w-3 text-gray-400 shrink-0" />
                  <span>{g.featureName}</span>
                  <Badge className={tierColors[g.tier] || ""} variant="outline">{g.tier}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Filter by tier:</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40" data-testid="select-tier-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="Enhanced">Enhanced</SelectItem>
            <SelectItem value="Shared">Shared</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map(item => {
          const Icon = statusIcons[item.status] || Circle;
          return (
            <Card key={item.id} className="p-4" data-testid={`card-audit-${item.id}`}>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${statusColors[item.status] || ""}`} />
                  <span className="text-sm font-medium truncate">{item.featureName}</span>
                  <Badge className={tierColors[item.tier] || ""} variant="outline">{item.tier}</Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={item.status}
                    onValueChange={(v) => updateMutation.mutate({ id: item.id, status: v })}
                  >
                    <SelectTrigger className="w-44" data-testid={`select-status-${item.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Implemented">Implemented</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="Not Implemented">Not Implemented</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Notes..."
                    defaultValue={item.notes || ""}
                    className="w-48 text-xs"
                    data-testid={`input-notes-${item.id}`}
                    onBlur={(e) => {
                      if (e.target.value !== (item.notes || "")) {
                        updateMutation.mutate({ id: item.id, notes: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground shrink-0 hidden lg:block">
                  {new Date(item.lastUpdated).toLocaleDateString()}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
