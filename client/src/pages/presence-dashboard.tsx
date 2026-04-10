import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Users, Shield, Crown, Clock, CheckCircle, XCircle,
  Activity, ArrowLeft, Trash2, Edit2, Loader2, Send,
} from "lucide-react";

interface TeamMember {
  id: string;
  businessId: string;
  userId: string;
  role: string;
  status: string;
  permissions: Record<string, boolean>;
  displayName: string;
  email: string;
  approvedAt: string | null;
  createdAt: string;
}

interface ActivityEntry {
  id: string;
  changeType: string;
  changedByName: string | null;
  notes: string | null;
  createdAt: string;
  revisionNumber: number;
}

const PERMISSION_KEYS = [
  { key: "edit_details", label: "Edit Details" },
  { key: "upload_photos", label: "Upload Photos" },
  { key: "post_events", label: "Post Events" },
  { key: "respond_reviews", label: "Respond to Reviews" },
  { key: "view_analytics", label: "View Analytics" },
  { key: "invite_users", label: "Invite Users" },
  { key: "manage_permissions", label: "Manage Permissions" },
];

const ROLE_CONFIG: Record<string, { icon: typeof Crown; color: string }> = {
  OWNER: { icon: Crown, color: "bg-[#F2C230]/15 text-[#B8910A] dark:text-[#F2C230]" },
  MANAGER: { icon: Shield, color: "bg-[#5B1D8F]/15 text-[#5B1D8F] dark:text-[#C084FC]" },
  TEAM: { icon: Users, color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
};

const STATUS_CONFIG: Record<string, string> = {
  ACTIVE: "bg-green-500/15 text-green-700 dark:text-green-400",
  PENDING: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  SUSPENDED: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const CHANGE_TYPE_CONFIG: Record<string, string> = {
  CREATE: "bg-green-500/15 text-green-700 dark:text-green-400",
  CLAIM: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  EDIT: "bg-[#5B1D8F]/15 text-[#5B1D8F] dark:text-[#C084FC]",
  PERMISSION_CHANGE: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  TRANSFER: "bg-[#F2C230]/15 text-[#B8910A] dark:text-[#F2C230]",
  ARCHIVE: "bg-red-500/15 text-red-700 dark:text-red-400",
  RESTORE: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
};

export default function PresenceDashboard({ citySlug, businessId }: { citySlug: string; businessId: string }) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"team" | "activity">("team");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [transferForm, setTransferForm] = useState({ name: "", email: "", reason: "" });

  const { data: team, isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/presence", businessId, "team"],
  });

  const { data: activity, isLoading: activityLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/presence", businessId, "activity"],
    enabled: activeTab === "activity",
  });

  const { data: meData } = useQuery<{ id: string } | null>({
    queryKey: ["/api/auth/me"],
  });
  const currentUserId = meData?.id;
  const currentTeamMember = team?.find((m) => m.userId === currentUserId);
  const isOwner = isAdmin || currentTeamMember?.role === "OWNER";
  const isManager = isAdmin || currentTeamMember?.role === "MANAGER";

  const approveMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("PATCH", `/api/presence/${businessId}/team/${memberId}`, { status: "ACTIVE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/presence", businessId, "team"] });
      toast({ title: "Member approved" });
    },
    onError: () => {
      toast({ title: "Failed to approve member", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("PATCH", `/api/presence/${businessId}/team/${memberId}`, { status: "SUSPENDED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/presence", businessId, "team"] });
      toast({ title: "Member rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject member", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("DELETE", `/api/presence/${businessId}/team/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/presence", businessId, "team"] });
      toast({ title: "Member removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove member", variant: "destructive" });
    },
  });

  const permissionMutation = useMutation({
    mutationFn: async ({ memberId, permissions }: { memberId: string; permissions: Record<string, boolean> }) => {
      await apiRequest("PATCH", `/api/presence/${businessId}/team/${memberId}`, { permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/presence", businessId, "team"] });
      setEditingMemberId(null);
      toast({ title: "Permissions updated" });
    },
    onError: () => {
      toast({ title: "Failed to update permissions", variant: "destructive" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/presence/${businessId}/transfer-request`, transferForm);
    },
    onSuccess: () => {
      setTransferForm({ name: "", email: "", reason: "" });
      toast({ title: "Transfer request submitted" });
    },
    onError: () => {
      toast({ title: "Failed to submit transfer request", variant: "destructive" });
    },
  });

  const startEditPermissions = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setEditPermissions({ ...member.permissions });
  };

  if (teamLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-4 p-4" data-testid="presence-dashboard-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      <div className="space-y-2">
        <Link href={`/${citySlug}/my-listings`}>
          <Button variant="ghost" size="sm" className="gap-1" data-testid="link-back-listings">
            <ArrowLeft className="h-4 w-4" /> Back to My Listings
          </Button>
        </Link>
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Presence Dashboard</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === "team" ? "default" : "outline"}
          onClick={() => setActiveTab("team")}
          className="gap-1"
          data-testid="tab-team"
        >
          <Users className="h-4 w-4" /> Team
        </Button>
        <Button
          variant={activeTab === "activity" ? "default" : "outline"}
          onClick={() => setActiveTab("activity")}
          className="gap-1"
          data-testid="tab-activity"
        >
          <Activity className="h-4 w-4" /> Activity Log
        </Button>
      </div>

      {activeTab === "team" && (
        <div className="space-y-4" data-testid="section-team">
          {!team || team.length === 0 ? (
            <Card className="p-6 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No team members found.</p>
            </Card>
          ) : (
            team.map((member) => {
              const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.TEAM;
              const RoleIcon = roleConfig.icon;
              const isEditing = editingMemberId === member.id;

              return (
                <Card key={member.id} className="p-4" data-testid={`card-member-${member.id}`}>
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className={`flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${roleConfig.color}`}>
                      <RoleIcon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate" data-testid={`text-member-name-${member.id}`}>
                          {member.displayName}
                        </span>
                        <Badge className={`no-default-hover-elevate no-default-active-elevate ${roleConfig.color}`} data-testid={`badge-role-${member.id}`}>
                          {member.role}
                        </Badge>
                        <Badge className={`no-default-hover-elevate no-default-active-elevate ${STATUS_CONFIG[member.status] || ""}`} data-testid={`badge-status-${member.id}`}>
                          {member.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-member-email-${member.id}`}>
                        {member.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Clock className="inline h-3 w-3 mr-1" />
                        Joined {new Date(member.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {member.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(member.id)}
                            disabled={approveMutation.isPending}
                            className="gap-1"
                            data-testid={`button-approve-${member.id}`}
                          >
                            <CheckCircle className="h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectMutation.mutate(member.id)}
                            disabled={rejectMutation.isPending}
                            data-testid={`button-reject-${member.id}`}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {member.role !== "OWNER" && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => isEditing ? setEditingMemberId(null) : startEditPermissions(member)}
                            data-testid={`button-edit-permissions-${member.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeMutation.mutate(member.id)}
                            disabled={removeMutation.isPending}
                            data-testid={`button-remove-${member.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 pt-4 border-t space-y-3" data-testid={`permissions-panel-${member.id}`}>
                      <h4 className="text-sm font-semibold">Permissions</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PERMISSION_KEYS.map(({ key, label }) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                            data-testid={`permission-toggle-${key}-${member.id}`}
                          >
                            <input
                              type="checkbox"
                              checked={editPermissions[key] || false}
                              onChange={(e) =>
                                setEditPermissions((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                              className="rounded border-muted-foreground"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            permissionMutation.mutate({ memberId: member.id, permissions: editPermissions })
                          }
                          disabled={permissionMutation.isPending}
                          data-testid={`button-save-permissions-${member.id}`}
                        >
                          {permissionMutation.isPending ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving</>
                          ) : (
                            "Save Permissions"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingMemberId(null)}
                          data-testid={`button-cancel-permissions-${member.id}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-3" data-testid="section-activity">
          {activityLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : !activity || activity.length === 0 ? (
            <Card className="p-6 text-center">
              <Activity className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            </Card>
          ) : (
            activity.map((entry) => {
              const typeStyle = CHANGE_TYPE_CONFIG[entry.changeType] || "bg-muted text-muted-foreground";
              return (
                <Card key={entry.id} className="p-4" data-testid={`card-activity-${entry.id}`}>
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
                      <span className="text-xs font-bold text-muted-foreground">#{entry.revisionNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`no-default-hover-elevate no-default-active-elevate ${typeStyle}`} data-testid={`badge-change-type-${entry.id}`}>
                          {entry.changeType.replace(/_/g, " ")}
                        </Badge>
                        {entry.changedByName && (
                          <span className="text-sm text-muted-foreground" data-testid={`text-changed-by-${entry.id}`}>
                            by {entry.changedByName}
                          </span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-sm mt-1" data-testid={`text-activity-notes-${entry.id}`}>{entry.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {isOwner && (
        <Card className="p-5 space-y-4" data-testid="card-transfer-ownership">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-[#F2C230]" /> Transfer Ownership
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              Transfer this presence to another person. This action requires confirmation from the new owner.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">New Owner Name</label>
                <Input
                  value={transferForm.name}
                  onChange={(e) => setTransferForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  data-testid="input-transfer-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">New Owner Email</label>
                <Input
                  value={transferForm.email}
                  onChange={(e) => setTransferForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  type="email"
                  data-testid="input-transfer-email"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reason</label>
              <Textarea
                value={transferForm.reason}
                onChange={(e) => setTransferForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Why are you transferring ownership?"
                data-testid="input-transfer-reason"
              />
            </div>
            <Button
              onClick={() => transferMutation.mutate()}
              disabled={transferMutation.isPending || !transferForm.name || !transferForm.email}
              className="gap-1"
              data-testid="button-submit-transfer"
            >
              {transferMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting</>
              ) : (
                <><Send className="h-4 w-4" /> Submit Transfer Request</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
