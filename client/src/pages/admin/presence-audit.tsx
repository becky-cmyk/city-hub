import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, ArrowRight, FileText, User } from "lucide-react";

interface AuditEntry {
  id: string;
  presenceId: string;
  actorType: string;
  actorUserId: string | null;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  reason: string | null;
}

function actorVariant(actorType: string): "default" | "secondary" | "outline" {
  switch (actorType) {
    case "admin": return "default";
    case "charlotte_ai": return "secondary";
    case "system": return "outline";
    default: return "outline";
  }
}

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PresenceAudit({ presenceId }: { presenceId: string }) {
  const { data: entries, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/api/admin/presence-audit", presenceId],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="font-semibold mb-1">No audit history</h3>
        <p className="text-sm text-muted-foreground">No field-level changes have been recorded yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => (
        <div
          key={entry.id}
          className="flex gap-3"
          data-testid={`row-audit-${entry.id}`}
        >
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
            {idx < entries.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>

          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-medium" data-testid={`text-audit-field-${entry.id}`}>
                {entry.fieldName}
              </span>
              <Badge variant={actorVariant(entry.actorType)} className="text-[10px]">
                {entry.actorType}
              </Badge>
              {entry.actorUserId && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <User className="h-2.5 w-2.5" />
                  {entry.actorUserId.slice(0, 8)}...
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs mb-1" data-testid={`text-audit-change-${entry.id}`}>
              <span className="text-muted-foreground line-through">{entry.oldValue || "(empty)"}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-medium">{entry.newValue || "(empty)"}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {formatTimestamp(entry.changedAt)}
              </span>
              {entry.reason && (
                <span className="text-[10px] text-muted-foreground italic" data-testid={`text-audit-reason-${entry.id}`}>
                  {entry.reason}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
