import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Trash2, Mail, Users, Calendar, UserCheck, Send, Plus, Copy } from "lucide-react";

const RSVP_COLORS: Record<string, string> = {
  attending: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  maybe: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const INVITATION_COLORS: Record<string, string> = {
  invited: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  maybe: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string | null;
  public_user_id: string | null;
  name: string | null;
  email: string | null;
  response: string;
  note: string | null;
  event_title?: string;
  start_date_time?: string;
  visibility?: string;
  created_at: string;
}

interface EventInvitation {
  id: string;
  event_id: string;
  email: string;
  name: string | null;
  invite_token: string;
  status: string;
  sent_at: string | null;
  responded_at: string | null;
  event_title?: string;
  event_slug?: string;
  city_slug?: string;
  start_date_time?: string;
  created_at: string;
}

interface AdminEvent {
  id: string;
  title: string;
  start_date_time: string | null;
  visibility: string;
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function SendInvitationsDialog({ open, onOpenChange, cityId }: { open: boolean; onOpenChange: (v: boolean) => void; cityId?: string }) {
  const { toast } = useToast();
  const [eventId, setEventId] = useState("");
  const [emailList, setEmailList] = useState("");

  const { data: events } = useQuery<AdminEvent[]>({
    queryKey: ["/api/admin/events", { cityId }],
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const lines = emailList.split("\n").map(l => l.trim()).filter(Boolean);
      const invitations = lines.map(line => {
        const parts = line.split(",").map(p => p.trim());
        return { email: parts[0], name: parts[1] || null };
      });
      const resp = await apiRequest("POST", `/api/admin/events/${eventId}/invitations`, { invitations });
      return resp.json();
    },
    onSuccess: (data: { created: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-invitations"] });
      toast({ title: `${data.created} invitation(s) created` });
      setEmailList("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error sending invitations", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Invitations</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger data-testid="select-invite-event">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {events?.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Emails (one per line, optionally: email, name)</Label>
            <textarea
              className="w-full min-h-[120px] rounded-md border px-3 py-2 text-sm bg-background"
              value={emailList}
              onChange={e => setEmailList(e.target.value)}
              placeholder={"john@example.com, John Doe\njane@example.com"}
              data-testid="input-invite-emails"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Credits: 1 per batch of 25 invitations
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !eventId || !emailList.trim()}
              data-testid="button-send-invitations"
            >
              <Send className="h-4 w-4 mr-1" />
              {sendMutation.isPending ? "Sending..." : "Send Invitations"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-invitations">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EventRsvpsPanel({ cityId }: { cityId?: string }) {
  const [search, setSearch] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [deletingRsvpId, setDeletingRsvpId] = useState<string | null>(null);
  const [deletingInvId, setDeletingInvId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: rsvps, isLoading: rsvpsLoading } = useQuery<EventRsvp[]>({
    queryKey: ["/api/admin/event-rsvps", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/event-rsvps?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load RSVPs");
      return res.json();
    },
  });

  const { data: invitations, isLoading: invLoading } = useQuery<EventInvitation[]>({
    queryKey: ["/api/admin/event-invitations", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/event-invitations?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invitations");
      return res.json();
    },
  });

  const deleteRsvpMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/event-rsvps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-rsvps"] });
      toast({ title: "RSVP removed" });
      setDeletingRsvpId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error removing RSVP", description: err.message, variant: "destructive" });
    },
  });

  const deleteInvMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/event-invitations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-invitations"] });
      toast({ title: "Invitation removed" });
      setDeletingInvId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error removing invitation", description: err.message, variant: "destructive" });
    },
  });

  const filteredRsvps = (rsvps || []).filter(r => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(term) ||
      (r.email || "").toLowerCase().includes(term) ||
      (r.event_title || "").toLowerCase().includes(term)
    );
  });

  const filteredInvitations = (invitations || []).filter(i => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (i.name || "").toLowerCase().includes(term) ||
      i.email.toLowerCase().includes(term) ||
      (i.event_title || "").toLowerCase().includes(term)
    );
  });

  const rsvpCounts = {
    attending: filteredRsvps.filter(r => r.response === "attending").length,
    maybe: filteredRsvps.filter(r => r.response === "maybe").length,
    declined: filteredRsvps.filter(r => r.response === "declined").length,
  };

  const invCounts = {
    invited: filteredInvitations.filter(i => i.status === "invited").length,
    accepted: filteredInvitations.filter(i => i.status === "accepted").length,
    declined: filteredInvitations.filter(i => i.status === "declined").length,
    maybe: filteredInvitations.filter(i => i.status === "maybe").length,
  };

  const copyInviteLink = (inv: EventInvitation) => {
    const citySlug = inv.city_slug || "";
    const eventSlug = inv.event_slug || inv.event_id;
    const url = `${window.location.origin}/${citySlug}/events/${eventSlug}?invite=${inv.invite_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Invite link copied" });
  };

  if (rsvpsLoading || invLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="section-event-rsvps">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-rsvps-title">RSVPs & Guests</h2>
          <p className="text-xs text-muted-foreground">Manage event RSVPs and invitations</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-56"
              placeholder="Search guests..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search-rsvps"
            />
          </div>
          <Button size="sm" onClick={() => setSendOpen(true)} data-testid="button-open-send-invitations">
            <Plus className="h-4 w-4 mr-1" /> Send Invitations
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-lg font-bold" data-testid="text-attending-count">{rsvpCounts.attending}</p>
              <p className="text-[10px] text-muted-foreground">Attending</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-600" />
            <div>
              <p className="text-lg font-bold" data-testid="text-maybe-count">{rsvpCounts.maybe}</p>
              <p className="text-[10px] text-muted-foreground">Maybe</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-lg font-bold" data-testid="text-invites-sent">{invCounts.invited}</p>
              <p className="text-[10px] text-muted-foreground">Invites Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-lg font-bold" data-testid="text-total-rsvps">{(rsvps || []).length}</p>
              <p className="text-[10px] text-muted-foreground">Total RSVPs</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="rsvps">
        <TabsList data-testid="tabs-rsvps">
          <TabsTrigger value="rsvps" data-testid="tab-rsvps">RSVPs ({filteredRsvps.length})</TabsTrigger>
          <TabsTrigger value="invitations" data-testid="tab-invitations">Invitations ({filteredInvitations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rsvps">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRsvps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No RSVPs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRsvps.map(r => (
                    <TableRow key={r.id} data-testid={`row-rsvp-${r.id}`}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{r.name || "Guest"}</p>
                          {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{r.event_title || r.event_id}</p>
                        {r.start_date_time && <p className="text-[10px] text-muted-foreground">{formatDate(r.start_date_time)}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] capitalize ${RSVP_COLORS[r.response] || ""}`} data-testid={`badge-rsvp-${r.id}`}>
                          {r.response}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingRsvpId(r.id)} data-testid={`button-delete-rsvp-${r.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No invitations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvitations.map(i => (
                    <TableRow key={i.id} data-testid={`row-invitation-${i.id}`}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{i.name || i.email}</p>
                          {i.name && <p className="text-xs text-muted-foreground">{i.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{i.event_title || i.event_id}</p>
                        {i.start_date_time && <p className="text-[10px] text-muted-foreground">{formatDate(i.start_date_time)}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] capitalize ${INVITATION_COLORS[i.status] || ""}`} data-testid={`badge-inv-${i.id}`}>
                          {i.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(i.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => copyInviteLink(i)} data-testid={`button-copy-invite-${i.id}`}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingInvId(i.id)} data-testid={`button-delete-inv-${i.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <SendInvitationsDialog open={sendOpen} onOpenChange={setSendOpen} cityId={cityId} />

      <AlertDialog open={!!deletingRsvpId} onOpenChange={() => setDeletingRsvpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove RSVP?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the guest's RSVP from the event.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel data-testid="button-cancel-delete-rsvp">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingRsvpId && deleteRsvpMutation.mutate(deletingRsvpId)} data-testid="button-confirm-delete-rsvp">
              Remove
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingInvId} onOpenChange={() => setDeletingInvId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Invitation?</AlertDialogTitle>
            <AlertDialogDescription>This will revoke the invitation.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel data-testid="button-cancel-delete-inv">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingInvId && deleteInvMutation.mutate(deletingInvId)} data-testid="button-confirm-delete-inv">
              Remove
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
