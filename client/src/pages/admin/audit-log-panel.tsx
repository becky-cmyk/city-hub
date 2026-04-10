import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, ChevronDown, ChevronLeft, ChevronRight, Clock, User, FileText } from "lucide-react";

const ACTION_OPTIONS = [
  "LICENSE_CREATED",
  "LICENSE_SUSPENDED",
  "LICENSE_REVOKED",
  "LICENSE_REACTIVATED",
  "SCOPE_CHANGED",
  "ENTITY_ASSIGNED",
  "ENTITY_UNASSIGNED",
  "PAYOUT_APPROVED",
  "PAYOUT_PAID",
  "CHECKOUT_INITIATED",
  "CHECKOUT_COMPLETED",
  "OPERATOR_INVITED",
  "OPERATOR_REVOKED",
  "SOURCE_PULL_TRIGGERED",
  "KILL_SWITCH_BLOCKED",
  "PAYOUT_GENERATED",
  "REVENUE_SPLIT_CREATED",
  "TERRITORY_ASSIGNED",
  "TERRITORY_UNASSIGNED",
];

const ENTITY_TYPE_OPTIONS = [
  "OPERATOR",
  "TERRITORY",
  "BUSINESS",
  "ORG",
  "MULTIFAMILY",
  "PAYOUT",
  "SPLIT",
];

const PAGE_SIZE = 50;

function actionColor(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.includes("REVOKED") || action.includes("SUSPENDED") || action.includes("BLOCKED")) return "destructive";
  if (action.includes("CREATED") || action.includes("COMPLETED") || action.includes("APPROVED")) return "default";
  if (action.includes("PAID") || action.includes("REACTIVATED")) return "secondary";
  return "outline";
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface AuditEntry {
  id: string;
  actorUserId: string | null;
  actorOperatorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  operatorId: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
}

export default function AuditLogPanel({ cityId }: { cityId?: string }) {
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [page, setPage] = useState(0);

  const queryParams = new URLSearchParams();
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String(page * PAGE_SIZE));
  if (actionFilter) queryParams.set("action", actionFilter);
  if (entityTypeFilter) queryParams.set("entityType", entityTypeFilter);

  const { data, isLoading } = useQuery<{ entries: AuditEntry[]; total: number }>({
    queryKey: ["/api/admin/audit-log", actionFilter, entityTypeFilter, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-log?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load audit log");
      return res.json();
    },
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleResetFilters = () => {
    setActionFilter("");
    setEntityTypeFilter("");
    setPage(0);
  };

  return (
    <div className="space-y-4" data-testid="audit-log-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold" data-testid="text-audit-log-title">Audit Log</h2>
        <Badge variant="secondary" data-testid="text-audit-log-count">{total} entries</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleResetFilters} data-testid="button-reset-filters">
            Reset
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="w-56">
              <Select
                value={actionFilter}
                onValueChange={(val) => { setActionFilter(val === "__all__" ? "" : val); setPage(0); }}
              >
                <SelectTrigger data-testid="select-action-filter">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Actions</SelectItem>
                  {ACTION_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select
                value={entityTypeFilter}
                onValueChange={(val) => { setEntityTypeFilter(val === "__all__" ? "" : val); setPage(0); }}
              >
                <SelectTrigger data-testid="select-entity-type-filter">
                  <SelectValue placeholder="All Entity Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Entity Types</SelectItem>
                  {ENTITY_TYPE_OPTIONS.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground" data-testid="text-no-entries">
              No audit log entries found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Timestamp</TableHead>
                  <TableHead className="w-40">Actor</TableHead>
                  <TableHead className="w-48">Action</TableHead>
                  <TableHead className="w-40">Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const hasMetadata = entry.metadataJson && Object.keys(entry.metadataJson).length > 0;

  return (
    <>
      <TableRow
        className={hasMetadata ? "cursor-pointer hover-elevate" : ""}
        onClick={() => hasMetadata && setOpen(!open)}
        data-testid={`row-audit-${entry.id}`}
      >
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {formatTimestamp(entry.createdAt)}
          </div>
        </TableCell>
        <TableCell className="text-xs">
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="truncate max-w-[120px]" data-testid={`text-actor-${entry.id}`}>
              {entry.actorUserId ? `User ${entry.actorUserId.slice(0, 8)}...` :
               entry.actorOperatorId ? `Op ${entry.actorOperatorId.slice(0, 8)}...` : "System"}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={actionColor(entry.action)} className="text-[10px]" data-testid={`badge-action-${entry.id}`}>
            {entry.action.replace(/_/g, " ")}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">
          {entry.entityType && (
            <div className="flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span data-testid={`text-entity-${entry.id}`}>
                {entry.entityType}{entry.entityId ? ` #${entry.entityId.slice(0, 8)}` : ""}
              </span>
            </div>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {hasMetadata && (
            <div className="flex items-center gap-1">
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
              <span>View details</span>
            </div>
          )}
        </TableCell>
      </TableRow>
      {open && hasMetadata && (
        <TableRow data-testid={`row-audit-detail-${entry.id}`}>
          <TableCell colSpan={5} className="bg-muted/30">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono p-2 max-h-48 overflow-auto">
              {JSON.stringify(entry.metadataJson, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
