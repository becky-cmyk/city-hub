import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown, ChevronUp, FileText, Calendar, Briefcase,
  Users, MessageSquare, Camera, History, Clock, Mail, Phone,
  ExternalLink, Building2,
} from "lucide-react";

interface BusinessActivitySectionsProps {
  businessId: string;
  onNavigateToContact?: (contactId: string) => void;
}

function ActivitySection({
  title,
  icon,
  count,
  children,
  defaultOpen,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: (isOpen: boolean) => React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || false);

  return (
    <div className="border-t">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/20 transition-colors"
        onClick={() => setOpen(!open)}
        data-testid={`button-toggle-activity-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {icon}
        {title}
        {count !== undefined && (
          <Badge variant="secondary" className="text-[9px] ml-1">{count}</Badge>
        )}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && <div className="px-3 pb-3">{children(open)}</div>}
    </div>
  );
}

function ArticlesActivity({ businessId }: { businessId: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "activity", "articles"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/activity/articles`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No articles mention this business.</p>;

  return (
    <div className="space-y-2">
      {data.map((a: any) => (
        <div key={a.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-article-${a.id}`}>
          <FileText className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{a.title}</p>
            {a.excerpt && <p className="text-muted-foreground truncate mt-0.5">{a.excerpt}</p>}
            <p className="text-muted-foreground text-[10px] mt-0.5 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : new Date(a.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventsActivity({ businessId }: { businessId: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "activity", "events"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/activity/events`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No events connected to this business.</p>;

  return (
    <div className="space-y-2">
      {data.map((e: any) => (
        <div key={e.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-event-${e.id}`}>
          <Calendar className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium truncate">{e.title}</p>
              {e.hostBusinessId === businessId && <Badge variant="default" className="text-[9px] h-4">Host</Badge>}
              {e.venuePresenceId === businessId && <Badge variant="outline" className="text-[9px] h-4">Venue</Badge>}
              {e.isSponsored && <Badge variant="secondary" className="text-[9px] h-4">Sponsor</Badge>}
            </div>
            {e.locationName && <p className="text-muted-foreground mt-0.5">{e.locationName}</p>}
            <p className="text-muted-foreground text-[10px] mt-0.5 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {new Date(e.startDateTime).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function JobsActivity({ businessId }: { businessId: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "activity", "jobs"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/activity/jobs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No jobs posted by this business.</p>;

  return (
    <div className="space-y-2">
      {data.map((j: any) => (
        <div key={j.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-job-${j.id}`}>
          <Briefcase className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium truncate">{j.title}</p>
              <Badge variant={j.jobStatus === "active" ? "default" : "outline"} className="text-[9px] h-4">
                {j.jobStatus || "active"}
              </Badge>
            </div>
            {j.employmentType && <p className="text-muted-foreground mt-0.5">{j.employmentType}</p>}
            {j.locationText && <p className="text-muted-foreground mt-0.5">{j.locationText}</p>}
            <p className="text-muted-foreground text-[10px] mt-0.5 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {j.postedAt ? new Date(j.postedAt).toLocaleDateString() : "No date"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkedContactsActivity({ businessId, onNavigateToContact }: { businessId: string; onNavigateToContact?: (id: string) => void }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "activity", "contacts"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/activity/contacts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No linked contacts.</p>;

  return (
    <div className="space-y-2">
      {data.map((c: any) => (
        <div key={c.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-contact-${c.id}`}>
          <Users className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium">{c.name}</p>
              {c.isPrimary && <Badge variant="default" className="text-[9px] h-4">Primary</Badge>}
              <Badge variant="outline" className="text-[9px] h-4">{c.role}</Badge>
            </div>
            {c.title && <p className="text-muted-foreground">{c.title}</p>}
            <div className="flex items-center gap-3 mt-0.5 text-muted-foreground">
              {c.email && <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{c.email}</span>}
              {c.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{c.phone}</span>}
            </div>
          </div>
          {c.crmContactId && onNavigateToContact && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 shrink-0"
              onClick={() => onNavigateToContact(c.crmContactId)}
              data-testid={`button-nav-contact-${c.crmContactId}`}
            >
              <ExternalLink className="h-2.5 w-2.5" /> View
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function CommunicationsActivity({ businessId }: { businessId: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "activity", "communications"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/activity/communications`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No communication history.</p>;

  const typeIcon: Record<string, string> = { EMAIL: "📧", PHONE: "📞", NOTE: "📝", MEETING: "🤝", INVOICE: "🧾", OTHER: "📎" };

  return (
    <div className="space-y-2">
      {data.map((entry: any) => (
        <div key={entry.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-comm-${entry.id}`}>
          <span className="text-sm">{typeIcon[entry.type] || "📎"}</span>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] h-4">{entry.type}</Badge>
              <span className="text-muted-foreground">
                {entry.direction === "inbound" ? "← Inbound" : "→ Outbound"}
              </span>
              <span className="ml-auto text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {new Date(entry.createdAt).toLocaleDateString()}
              </span>
            </div>
            {entry.subject && <p className="font-medium">{entry.subject}</p>}
            {entry.body && <p className="text-muted-foreground line-clamp-2">{entry.body}</p>}
            {entry.createdBy && <p className="text-muted-foreground text-[10px]">by {entry.createdBy}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CapturesActivity({ businessId }: { businessId: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "activity", "captures"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/activity/captures`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No captures reference this business.</p>;

  return (
    <div className="space-y-2">
      {data.map((item: any) => (
        <div key={item.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-capture-${item.id}`}>
          <Camera className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[9px] h-4">{item.itemType?.replace(/_/g, " ")}</Badge>
              <Badge variant={item.status === "processed" ? "default" : "outline"} className="text-[9px] h-4">{item.status}</Badge>
            </div>
            {item.matchedEntityName && <p className="text-muted-foreground mt-0.5">Matched: {item.matchedEntityName}</p>}
            <p className="text-muted-foreground text-[10px] mt-0.5 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EnrichmentHistoryActivity({ businessId }: { businessId: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/businesses", businessId, "activity", "enrichment-history"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/activity/enrichment-history`, { credentials: "include" });
      if (!res.ok) return { verification: [], fieldHistory: [] };
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  const hasData = data?.verification?.length > 0 || data?.fieldHistory?.length > 0;
  if (!hasData) return <p className="text-xs text-muted-foreground">No enrichment or crawl history.</p>;

  return (
    <div className="space-y-3">
      {data.verification?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Crawl Verification</p>
          <div className="space-y-2">
            {data.verification.map((v: any) => (
              <div key={v.id} className="p-2 rounded-md border bg-card text-xs space-y-1" data-testid={`activity-verify-${v.id}`}>
                <div className="flex items-center gap-1.5">
                  <Badge variant={v.crawlStatus === "SUCCESS" ? "default" : "outline"} className="text-[9px] h-4">
                    {v.crawlStatus}
                  </Badge>
                  {v.httpStatus && <span className="text-muted-foreground">HTTP {v.httpStatus}</span>}
                  {v.confidenceScore > 0 && <span className="text-muted-foreground">Score: {v.confidenceScore}</span>}
                </div>
                {v.websiteUrl && <p className="text-muted-foreground truncate">{v.websiteUrl}</p>}
                {v.detectedName && <p className="text-muted-foreground">Name: {v.detectedName}</p>}
                {v.detectedPhone && <p className="text-muted-foreground">Phone: {v.detectedPhone}</p>}
                {v.detectedEmail && <p className="text-muted-foreground">Email: {v.detectedEmail}</p>}
                {v.crawledAt && (
                  <p className="text-muted-foreground text-[10px] flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(v.crawledAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.fieldHistory?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Field Changes</p>
          <div className="space-y-1">
            {data.fieldHistory.map((h: any) => (
              <div key={h.id} className="flex items-center gap-2 text-[10px] p-1.5 rounded border bg-card" data-testid={`activity-field-${h.id}`}>
                <Badge variant="outline" className="text-[8px] h-3.5 shrink-0">{h.source}</Badge>
                <span className="font-medium shrink-0">{h.fieldName}</span>
                <span className="text-muted-foreground truncate">
                  {h.oldValue ? `"${h.oldValue}"` : "(empty)"} → {h.newValue ? `"${h.newValue}"` : "(empty)"}
                </span>
                <span className="ml-auto text-muted-foreground shrink-0">
                  {new Date(h.changedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BusinessActivitySections({ businessId, onNavigateToContact }: BusinessActivitySectionsProps) {
  return (
    <Card className="border-t mt-4 overflow-hidden">
      <div className="bg-muted/30 px-3 py-2 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Activity & History</span>
      </div>

      <ActivitySection title="Linked Contacts" icon={<Users className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <LinkedContactsActivity businessId={businessId} onNavigateToContact={onNavigateToContact} />}
      </ActivitySection>

      <ActivitySection title="Articles" icon={<FileText className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <ArticlesActivity businessId={businessId} />}
      </ActivitySection>

      <ActivitySection title="Events" icon={<Calendar className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <EventsActivity businessId={businessId} />}
      </ActivitySection>

      <ActivitySection title="Jobs" icon={<Briefcase className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <JobsActivity businessId={businessId} />}
      </ActivitySection>

      <ActivitySection title="Communications" icon={<MessageSquare className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <CommunicationsActivity businessId={businessId} />}
      </ActivitySection>

      <ActivitySection title="Captures" icon={<Camera className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <CapturesActivity businessId={businessId} />}
      </ActivitySection>

      <ActivitySection title="Enrichment History" icon={<History className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <EnrichmentHistoryActivity businessId={businessId} />}
      </ActivitySection>
    </Card>
  );
}
