import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, ChevronDown, ChevronUp, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

interface ReportRequest {
  id: string;
  metroId: string;
  entityType: string;
  entityId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  requesterRole: string;
  preferredLanguage: string;
  requestReason: string;
  consentToContact: boolean;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  token: string | null;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "SENT", label: "Sent" },
  { value: "DECLINED", label: "Declined" },
  { value: "NEEDS_INFO", label: "Needs Info" },
];

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  IN_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  SENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  DECLINED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  NEEDS_INFO: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

const ENTITY_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "BUSINESS", label: "Business" },
  { value: "MULTIFAMILY", label: "Multifamily" },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  MARKETER: "Marketer",
  LEASING: "Leasing",
  VENDOR: "Vendor",
  OTHER: "Other",
};

const REASON_LABELS: Record<string, string> = {
  GROW_SALES: "Grow Sales",
  GET_MORE_LEADS: "Get More Leads",
  UNDERSTAND_CUSTOMERS: "Understand Customers",
  LEASE_UP: "Lease Up",
  NEW_OPENING: "New Opening",
  OTHER: "Other",
};

export default function ReportRequestsPanel({ cityId }: { cityId?: string }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (cityId) params.set("cityId", cityId);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
    if (search) params.set("search", search);
    const qs = params.toString();
    return `/api/admin/intelligence/report-requests${qs ? `?${qs}` : ""}`;
  };

  const { data, isLoading } = useQuery<{ total: number; rows: ReportRequest[] }>({
    queryKey: ["/api/admin/intelligence/report-requests", cityId, statusFilter, entityTypeFilter, search],
    queryFn: async () => {
      const res = await fetch(buildUrl(), { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: string; notes?: string }) => {
      const body: any = {};
      if (status !== undefined) body.status = status;
      if (notes !== undefined) body.notes = notes;
      return apiRequest("PATCH", `/api/admin/intelligence/report-requests/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/intelligence/report-requests") });
      toast({ title: "Request updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const rows = data?.rows || [];

  return (
    <div className="space-y-4" data-testid="panel-report-requests">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-panel-title">Intelligence Report Requests</h2>
          <p className="text-sm text-muted-foreground">{data?.total || 0} total requests</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-requests"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-[140px] h-9" data-testid="select-entity-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-requests">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No report requests found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map(req => {
            const isExpanded = expandedId === req.id;
            return (
              <Card key={req.id} className="overflow-hidden" data-testid={`card-request-${req.id}`}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  data-testid={`row-request-${req.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" data-testid={`text-name-${req.id}`}>{req.requesterName}</span>
                      <span className="text-xs text-muted-foreground">{req.requesterEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{req.entityType}</Badge>
                      <span className="text-xs text-muted-foreground">{ROLE_LABELS[req.requesterRole] || req.requesterRole}</span>
                      <span className="text-xs text-muted-foreground">{REASON_LABELS[req.requestReason] || req.requestReason}</span>
                    </div>
                  </div>
                  <Badge className={`${STATUS_COLORS[req.status] || STATUS_COLORS.NEW} border-0 shrink-0`} data-testid={`badge-status-${req.id}`}>
                    {req.status.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(req.createdAt).toLocaleDateString()}</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {isExpanded && (
                  <div className="border-t p-4 space-y-4 bg-muted/20" data-testid={`expanded-${req.id}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium">{req.requesterPhone || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Language</p>
                        <p className="font-medium">{req.preferredLanguage?.toUpperCase() || "EN"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Consent</p>
                        <p className="font-medium">{req.consentToContact ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Entity ID</p>
                        <p className="font-medium text-xs truncate">{req.entityId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Request ID</p>
                        <p className="font-medium text-xs truncate">{req.id}</p>
                      </div>
                    </div>

                    {req.token && (
                      <a
                        href={`/intelligence/report/${req.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline"
                        data-testid={`link-token-${req.id}`}
                      >
                        <ExternalLink className="h-3 w-3" /> View Token Page
                      </a>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <Textarea
                        value={editNotes[req.id] ?? req.notes ?? ""}
                        onChange={e => setEditNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="Add internal notes..."
                        rows={2}
                        className="text-sm"
                        data-testid={`textarea-notes-${req.id}`}
                      />
                      {(editNotes[req.id] !== undefined && editNotes[req.id] !== (req.notes ?? "")) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: req.id, notes: editNotes[req.id] })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-save-notes-${req.id}`}
                        >
                          {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Save Notes
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {req.status !== "IN_REVIEW" && (
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: req.id, status: "IN_REVIEW" })} disabled={updateMutation.isPending} data-testid={`button-in-review-${req.id}`}>
                          Mark In Review
                        </Button>
                      )}
                      {req.status !== "SENT" && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateMutation.mutate({ id: req.id, status: "SENT" })} disabled={updateMutation.isPending} data-testid={`button-sent-${req.id}`}>
                          Mark Sent
                        </Button>
                      )}
                      {req.status !== "NEEDS_INFO" && (
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: req.id, status: "NEEDS_INFO" })} disabled={updateMutation.isPending} data-testid={`button-needs-info-${req.id}`}>
                          Needs Info
                        </Button>
                      )}
                      {req.status !== "DECLINED" && (
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateMutation.mutate({ id: req.id, status: "DECLINED" })} disabled={updateMutation.isPending} data-testid={`button-declined-${req.id}`}>
                          Decline
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
