import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown, ChevronUp, FileText, Building2, MessageSquare,
  Camera, Clock, Mail, Phone, ExternalLink, Mic, User,
} from "lucide-react";
import type { CrmContact } from "@shared/schema";

interface ContactActivitySectionsProps {
  contact: CrmContact;
  onNavigateToBusiness?: (businessId: string) => void;
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
        data-testid={`button-toggle-contact-activity-${title.toLowerCase().replace(/\s+/g, "-")}`}
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

function LinkedBusinessesActivity({ contactId, onNavigateToBusiness }: { contactId: string; onNavigateToBusiness?: (id: string) => void }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts", contactId, "activity", "businesses"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contacts/${contactId}/activity/businesses`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No linked businesses.</p>;

  return (
    <div className="space-y-2">
      {data.map((link: any, idx: number) => (
        <div key={link.id || `linked-${idx}`} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-linked-biz-${link.businessId}`}>
          <Building2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium">{link.business?.name || "Unknown Business"}</p>
              <Badge variant="outline" className="text-[9px] h-4">{link.role}</Badge>
              {link.isPrimary && <Badge variant="default" className="text-[9px] h-4">Primary</Badge>}
            </div>
            {link.business?.address && (
              <p className="text-muted-foreground mt-0.5">
                {link.business.address}{link.business.city ? `, ${link.business.city}` : ""} {link.business.state || ""}
              </p>
            )}
            <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
              {link.business?.listingTier && (
                <Badge variant="secondary" className="text-[8px] h-3.5">{link.business.listingTier}</Badge>
              )}
              {link.business?.claimStatus && (
                <Badge variant="outline" className="text-[8px] h-3.5">{link.business.claimStatus}</Badge>
              )}
              {link.createdAt && (
                <span className="flex items-center gap-0.5 text-[10px]">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(link.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {onNavigateToBusiness && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 shrink-0"
              onClick={() => onNavigateToBusiness(link.businessId)}
              data-testid={`button-nav-business-${link.businessId}`}
            >
              <ExternalLink className="h-2.5 w-2.5" /> View
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function ContactCommunicationsActivity({ contactId }: { contactId: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts", contactId, "activity", "communications"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contacts/${contactId}/activity/communications`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No communication history for this contact.</p>;

  const typeIcon: Record<string, string> = { EMAIL: "📧", PHONE: "📞", NOTE: "📝", MEETING: "🤝", INVOICE: "🧾", OTHER: "📎" };

  return (
    <div className="space-y-2">
      {data.map((entry: any) => (
        <div key={entry.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-contact-comm-${entry.id}`}>
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
          </div>
        </div>
      ))}
    </div>
  );
}

function InterviewRecordingsSection({ contact }: { contact: CrmContact }) {
  const c = contact as any;
  const hasAudio = c.audioRecordingUrl;
  const hasTranscript = c.audioTranscription;

  if (!hasAudio && !hasTranscript) {
    return <p className="text-xs text-muted-foreground">No interview recordings or transcripts.</p>;
  }

  return (
    <div className="space-y-3">
      {hasAudio && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mic className="h-3 w-3" /> Voice Recording</p>
          <audio src={c.audioRecordingUrl} controls className="w-full h-8" data-testid={`audio-contact-recording-${contact.id}`} />
        </div>
      )}
      {hasTranscript && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mic className="h-3 w-3" /> Transcript</p>
          <div className="bg-muted/50 rounded-lg p-2 text-xs whitespace-pre-wrap">{c.audioTranscription}</div>
        </div>
      )}
    </div>
  );
}

function ContactCapturesActivity({ contactId }: { contactId: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts", contactId, "activity", "captures"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contacts/${contactId}/activity/captures`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No captures for this contact.</p>;

  return (
    <div className="space-y-2">
      {data.map((item: any) => (
        <div key={item.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-contact-capture-${item.id}`}>
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

function ContactArticlesActivity({ contactId }: { contactId: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts", contactId, "activity", "articles"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contacts/${contactId}/activity/articles`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No linked articles.</p>;

  return (
    <div className="space-y-2">
      {data.map((a: any) => (
        <div key={a.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs" data-testid={`activity-contact-article-${a.id}`}>
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

export function ContactActivitySections({ contact, onNavigateToBusiness }: ContactActivitySectionsProps) {
  return (
    <Card className="border-t mt-3 overflow-hidden">
      <div className="bg-muted/30 px-3 py-2 flex items-center gap-2">
        <User className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Activity & History</span>
      </div>

      <ActivitySection title="Linked Businesses" icon={<Building2 className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <LinkedBusinessesActivity contactId={contact.id} onNavigateToBusiness={onNavigateToBusiness} />}
      </ActivitySection>

      <ActivitySection title="Communications" icon={<MessageSquare className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <ContactCommunicationsActivity contactId={contact.id} />}
      </ActivitySection>

      <ActivitySection title="Interviews & Recordings" icon={<Mic className="h-3.5 w-3.5" />}>
        {() => <InterviewRecordingsSection contact={contact} />}
      </ActivitySection>

      <ActivitySection title="Captures" icon={<Camera className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <ContactCapturesActivity contactId={contact.id} />}
      </ActivitySection>

      <ActivitySection title="Articles" icon={<FileText className="h-3.5 w-3.5" />}>
        {(isOpen) => isOpen && <ContactArticlesActivity contactId={contact.id} />}
      </ActivitySection>
    </Card>
  );
}
