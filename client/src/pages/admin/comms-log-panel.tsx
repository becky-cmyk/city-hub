import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Phone, ChevronDown, ChevronUp, Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface CommsLogEntry {
  id: string;
  channel: "EMAIL" | "SMS";
  direction: "OUTBOUND" | "INBOUND";
  territoryId: string | null;
  cityId: string | null;
  operatorId: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  senderAddress: string;
  subject: string | null;
  bodyPreview: string | null;
  status: string;
  messageId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface TerritoryRef {
  id: string;
  name: string;
  code: string;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    SENT: "bg-green-100 text-green-800",
    DELIVERED: "bg-green-100 text-green-800",
    QUEUED: "bg-yellow-100 text-yellow-800",
    BOUNCED: "bg-red-100 text-red-800",
    FAILED: "bg-red-100 text-red-800",
  };
  return <Badge className={colors[status] || ""} data-testid={`badge-status-${status}`}>{status}</Badge>;
}

function CommsRow({ entry, territories }: { entry: CommsLogEntry; territories: TerritoryRef[] }) {
  const [expanded, setExpanded] = useState(false);
  const territory = territories.find(t => t.id === entry.territoryId);

  return (
    <div className="border rounded-lg p-3 space-y-2" data-testid={`comms-row-${entry.id}`}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          {entry.channel === "EMAIL"
            ? <Mail className="h-4 w-4 text-blue-600" />
            : <Phone className="h-4 w-4 text-green-600" />
          }
          {entry.direction === "OUTBOUND"
            ? <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
            : <ArrowDownLeft className="h-3 w-3 text-muted-foreground" />
          }
          <div>
            <span className="font-medium text-sm" data-testid={`text-recipient-${entry.id}`}>
              {entry.recipientEmail || entry.recipientPhone || "Unknown"}
            </span>
            {entry.subject && (
              <span className="text-muted-foreground text-sm ml-2">— {entry.subject}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {territory && <Badge variant="outline" data-testid={`badge-territory-${entry.id}`}>{territory.code}</Badge>}
          {statusBadge(entry.status)}
          <span className="text-xs text-muted-foreground">
            {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="pl-10 pt-2 border-t space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground">From:</span> <span data-testid={`text-sender-${entry.id}`}>{entry.senderAddress}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Channel:</span> {entry.channel}
            </div>
            {entry.messageId && (
              <div>
                <span className="text-muted-foreground">Message ID:</span> <span className="font-mono text-xs">{entry.messageId}</span>
              </div>
            )}
          </div>
          {entry.bodyPreview && (
            <div>
              <span className="text-muted-foreground">Preview:</span>
              <p className="mt-1 text-muted-foreground bg-muted rounded p-2">{entry.bodyPreview}</p>
            </div>
          )}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <span className="text-muted-foreground">Metadata:</span>
              <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(entry.metadata, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommsLogPanel({ cityId }: { cityId?: string }) {
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [territoryFilter, setTerritoryFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery<{ logs: CommsLogEntry[]; territories: TerritoryRef[] }>({
    queryKey: ["/api/admin/comms-log", cityId, channelFilter, territoryFilter, page],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (cityId) queryParams.set("cityId", cityId);
      if (channelFilter !== "ALL") queryParams.set("channel", channelFilter);
      if (territoryFilter !== "ALL") queryParams.set("territoryId", territoryFilter);
      queryParams.set("limit", pageSize.toString());
      queryParams.set("offset", (page * pageSize).toString());
      const res = await fetch(`/api/admin/comms-log?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comms log");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const allTerritories = data?.territories || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-comms-title">Communications Log</h2>
          <p className="text-muted-foreground">All emails and SMS sent across the platform</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-channel-filter">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Channels</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="SMS">SMS</SelectItem>
          </SelectContent>
        </Select>

        <Select value={territoryFilter} onValueChange={(v) => { setTerritoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]" data-testid="select-territory-filter">
            <SelectValue placeholder="Territory" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Territories</SelectItem>
            {allTerritories.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No communications logged yet</p>
            <p className="text-sm text-muted-foreground mt-1">Emails and SMS sent through the platform will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map(entry => (
            <CommsRow key={entry.id} entry={entry} territories={allTerritories} />
          ))}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" disabled={logs.length < pageSize} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
