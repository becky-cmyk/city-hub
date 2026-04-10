import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Newspaper, Clock, CheckCircle, XCircle, AlertCircle, Mail, User } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "open", label: "Open", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "claimed", label: "Claimed", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "fulfilled", label: "Fulfilled", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "closed", label: "Closed", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
];

const TYPE_LABELS: Record<string, string> = {
  expert_quote: "Expert Quote",
  business_feature: "Business Feature",
  event_coverage: "Event Coverage",
  community_story: "Community Story",
  data_request: "Data & Research",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  open: AlertCircle,
  claimed: Clock,
  fulfilled: CheckCircle,
  closed: XCircle,
};

export default function SourceRequestsPanel({ cityId }: { cityId?: string }) {
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/source-requests"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/source-requests/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/source-requests"] });
    },
  });

  const filtered = filterStatus === "all" ? requests : requests.filter((r: any) => r.status === filterStatus);

  const counts = {
    all: requests.length,
    open: requests.filter((r: any) => r.status === "open").length,
    claimed: requests.filter((r: any) => r.status === "claimed").length,
    fulfilled: requests.filter((r: any) => r.status === "fulfilled").length,
    closed: requests.filter((r: any) => r.status === "closed").length,
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="source-requests-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Source Requests</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {counts.open} open / {counts.all} total
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "open", "claimed", "fulfilled", "closed"] as const).map(status => (
          <Button
            key={status}
            variant={filterStatus === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(status)}
            data-testid={`filter-${status}`}
          >
            {status === "all" ? "All" : STATUS_OPTIONS.find(s => s.value === status)?.label || status}
            <span className="ml-1 opacity-70">({counts[status]})</span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No source requests found
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const statusOption = STATUS_OPTIONS.find(s => s.value === req.status);
            const StatusIcon = STATUS_ICONS[req.status] || AlertCircle;
            return (
              <Card key={req.id} data-testid={`source-request-${req.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <StatusIcon className="w-4 h-4 shrink-0" />
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{req.title}</h3>
                      </div>
                      {req.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{req.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={statusOption?.color}>
                          {statusOption?.label || req.status}
                        </Badge>
                        <Badge variant="outline">
                          {TYPE_LABELS[req.requestType] || req.requestType}
                        </Badge>
                        {req.deadline && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(req.deadline).toLocaleDateString()}
                          </span>
                        )}
                        {req.contactName && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {req.contactName}
                          </span>
                        )}
                        {req.contactEmail && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {req.contactEmail}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Select
                        value={req.status}
                        onValueChange={(val) => updateStatusMutation.mutate({ id: req.id, status: val })}
                      >
                        <SelectTrigger className="w-32" data-testid={`status-select-${req.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
