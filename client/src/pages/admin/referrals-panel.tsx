import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, ArrowRight, Clock, CheckCircle2, XCircle, MessageSquare } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-600",
  contacted: "bg-purple-500/10 text-purple-600",
  connected: "bg-teal-500/10 text-teal-600",
  in_progress: "bg-amber-500/10 text-amber-700",
  completed: "bg-emerald-500/10 text-emerald-600",
  declined: "bg-red-500/10 text-red-600",
};

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

export default function ReferralsPanel({ cityId }: { cityId?: string }) {
  const [filter, setFilter] = useState("all");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [selectedTriangle, setSelectedTriangle] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  const { data, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["/api/referral-triangles", cityId, filter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      if (filter !== "all") p.set("filter", filter);
      const res = await fetch(`/api/referral-triangles?${p}`, { credentials: "include" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/referral-triangles/${selectedTriangle.id}`, {
        status: newStatus,
        outcomeNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-triangles"] });
      setUpdateOpen(false);
    },
  });

  const openUpdate = (triangle: any) => {
    setSelectedTriangle(triangle);
    setNewStatus(triangle.status);
    setOutcomeNotes(triangle.outcomeNotes || "");
    setUpdateOpen(true);
  };

  const triangles = data?.data || [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" data-testid="text-referrals-title">Your Referrals</h2>

      <div className="flex gap-1">
        {FILTER_TABS.map(tab => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter(tab.value)}
            data-testid={`button-filter-${tab.value}`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading referrals...</div>
      ) : triangles.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No referrals yet. Submit one from Catch.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {triangles.map((tri: any) => (
            <Card key={tri.id} className="hover:bg-muted/30 transition" data-testid={`card-referral-${tri.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">{tri.personA?.name?.[0]?.toUpperCase() || "?"}</span>
                      </div>
                      <span className="text-sm font-medium">{tri.personA?.name || "Unknown"}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-1.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">{tri.personB?.name?.[0]?.toUpperCase() || "?"}</span>
                      </div>
                      <span className="text-sm font-medium">{tri.personB?.name || "Unknown"}</span>
                    </div>
                  </div>
                  <Badge className={`${STATUS_COLORS[tri.status] || ""} text-[10px]`}>
                    {tri.status?.replace("_", " ")}
                  </Badge>
                </div>

                {tri.sharedMessage && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                    {tri.sharedMessage}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tri.createdAt ? new Date(tri.createdAt).toLocaleDateString() : ""}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openUpdate(tri)} data-testid={`button-update-referral-${tri.id}`}>
                    Update Status
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Referral Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-referral-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome Notes</Label>
              <Textarea value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)} rows={3} data-testid="input-outcome-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateOpen(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-status">
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
