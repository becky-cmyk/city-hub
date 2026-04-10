import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, Plus, Pencil, Trash2, Users, Loader2, ChevronDown, ChevronRight, X,
} from "lucide-react";
import { useState } from "react";

interface Region {
  id: string;
  name: string;
  regionType: string;
  parentRegionId: string | null;
  code: string | null;
  description: string | null;
  descriptionEs: string | null;
  isActive: boolean;
  createdAt: string;
}

interface RegionMember {
  id: string;
  regionId: string;
  userId: string;
  role: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

function typeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type) {
    case "metro": return "default";
    case "hub": return "secondary";
    default: return "outline";
  }
}

function RegionRow({
  region,
  onEdit,
  onDelete,
}: {
  region: Region;
  onEdit: (r: Region) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: members, isLoading: membersLoading } = useQuery<RegionMember[]>({
    queryKey: ["/api/admin/regions", region.id, "members"],
    enabled: expanded,
  });

  const { toast } = useToast();
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("viewer");

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/regions/${region.id}/members`, {
        userId: newMemberUserId,
        role: newMemberRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regions", region.id, "members"] });
      toast({ title: "Member added" });
      setNewMemberUserId("");
    },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("DELETE", `/api/admin/region-members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regions", region.id, "members"] });
      toast({ title: "Member removed" });
    },
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  return (
    <Card className="p-3" data-testid={`card-region-${region.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-region-${region.id}`}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm" data-testid={`text-region-name-${region.id}`}>{region.name}</span>
          <Badge variant={typeVariant(region.regionType)} className="text-[10px]">
            {region.regionType}
          </Badge>
          {region.code && (
            <span className="text-xs text-muted-foreground">({region.code})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => onEdit(region)} data-testid={`button-edit-region-${region.id}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(region.id)} data-testid={`button-delete-region-${region.id}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pl-9 space-y-3">
          <Separator />
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Users className="h-3.5 w-3.5" /> Members
          </div>

          {membersLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : members && members.length > 0 ? (
            <div className="space-y-1.5">
              {members.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-xs flex-wrap"
                  data-testid={`row-member-${m.id}`}
                >
                  <span>{m.userName || m.userEmail || m.userId.slice(0, 8)}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeMemberMutation.mutate(m.id)}
                      disabled={removeMemberMutation.isPending}
                      data-testid={`button-remove-member-${m.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No members assigned</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder="User ID"
              value={newMemberUserId}
              onChange={(e) => setNewMemberUserId(e.target.value)}
              className="w-40 text-xs"
              data-testid={`input-member-user-id-${region.id}`}
            />
            <Select value={newMemberRole} onValueChange={setNewMemberRole}>
              <SelectTrigger className="w-28" data-testid={`select-member-role-${region.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="manager">manager</SelectItem>
                <SelectItem value="rep">rep</SelectItem>
                <SelectItem value="viewer">viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addMemberMutation.mutate()}
              disabled={!newMemberUserId || addMemberMutation.isPending}
              data-testid={`button-add-member-${region.id}`}
            >
              {addMemberMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function RegionsPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editRegion, setEditRegion] = useState<Region | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("hub");
  const [formParent, setFormParent] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDescriptionEs, setFormDescriptionEs] = useState("");

  const { data: regions, isLoading } = useQuery<Region[]>({
    queryKey: ["/api/admin/regions"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = { name: formName, regionType: formType };
      if (formParent) body.parentRegionId = formParent;
      if (formCode) body.code = formCode;
      if (formDescription) body.description = formDescription;
      if (formDescriptionEs) body.descriptionEs = formDescriptionEs;
      await apiRequest("POST", "/api/admin/regions", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regions"] });
      toast({ title: "Region created" });
      resetForm();
    },
    onError: () => toast({ title: "Failed to create region", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editRegion) return;
      const body: Record<string, any> = { name: formName, regionType: formType };
      if (formParent) body.parentRegionId = formParent;
      if (formCode) body.code = formCode;
      body.description = formDescription || null;
      body.descriptionEs = formDescriptionEs || null;
      await apiRequest("PATCH", `/api/admin/regions/${editRegion.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regions"] });
      toast({ title: "Region updated" });
      resetForm();
    },
    onError: () => toast({ title: "Failed to update region", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/regions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regions"] });
      toast({ title: "Region deleted" });
    },
    onError: () => toast({ title: "Failed to delete region", variant: "destructive" }),
  });

  function resetForm() {
    setShowForm(false);
    setEditRegion(null);
    setFormName("");
    setFormType("hub");
    setFormParent("");
    setFormCode("");
    setFormDescription("");
    setFormDescriptionEs("");
  }

  function startEdit(region: Region) {
    setEditRegion(region);
    setFormName(region.name);
    setFormType(region.regionType);
    setFormParent(region.parentRegionId || "");
    setFormCode(region.code || "");
    setFormDescription(region.description || "");
    setFormDescriptionEs(region.descriptionEs || "");
    setShowForm(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Regions
        </h2>
        <Button
          size="sm"
          onClick={() => { resetForm(); setShowForm(true); }}
          data-testid="button-create-region"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> New Region
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">{editRegion ? "Edit Region" : "Create Region"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Region name"
                data-testid="input-region-name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger data-testid="select-region-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metro">metro</SelectItem>
                  <SelectItem value="hub">hub</SelectItem>
                  <SelectItem value="county">county</SelectItem>
                  <SelectItem value="zip">zip</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parent Region</Label>
              <Select value={formParent} onValueChange={setFormParent}>
                <SelectTrigger data-testid="select-region-parent">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {regions?.filter(r => r.id !== editRegion?.id).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Code</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="Optional code"
                data-testid="input-region-code"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description (EN)</Label>
            <Textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Neighborhood description for SEO (English)"
              className="text-xs"
              rows={3}
              data-testid="input-region-description"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description (ES)</Label>
            <Textarea
              value={formDescriptionEs}
              onChange={(e) => setFormDescriptionEs(e.target.value)}
              placeholder="Descripción del vecindario para SEO (Español)"
              className="text-xs"
              rows={3}
              data-testid="input-region-description-es"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => editRegion ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!formName || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-region"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {editRegion ? "Update" : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm} data-testid="button-cancel-region">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : regions && regions.length > 0 ? (
        <div className="space-y-2">
          {regions.map(region => (
            <RegionRow
              key={region.id}
              region={region}
              onEdit={startEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No regions created yet</p>
        </Card>
      )}
    </div>
  );
}
