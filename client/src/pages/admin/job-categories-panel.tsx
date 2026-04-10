import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Edit, Trash2, GripVertical, Tag, FolderOpen } from "lucide-react";

interface JobCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function JobCategoriesPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<JobCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobCategory | null>(null);

  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  const { data: categories, isLoading } = useQuery<JobCategory[]>({
    queryKey: ["/api/admin/job-categories", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/job-categories?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load job categories");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<JobCategory, "id" | "createdAt">) => {
      const res = await apiRequest("POST", "/api/admin/job-categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-categories"] });
      toast({ title: "Job category created" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<JobCategory, "id" | "createdAt">> }) => {
      const res = await apiRequest("PATCH", `/api/admin/job-categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-categories"] });
      toast({ title: "Job category updated" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/job-categories/${id}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-categories"] });
      toast({ title: "Job category deleted" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Cannot delete", description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  function closeDialog() {
    setShowDialog(false);
    setEditing(null);
    resetForm();
  }

  function resetForm() {
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormIcon("");
    setFormSortOrder(0);
    setFormIsActive(true);
  }

  function openCreate() {
    resetForm();
    setEditing(null);
    setShowDialog(true);
  }

  function openEdit(cat: JobCategory) {
    setEditing(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDescription(cat.description || "");
    setFormIcon(cat.icon || "");
    setFormSortOrder(cat.sortOrder);
    setFormIsActive(cat.isActive);
    setShowDialog(true);
  }

  function handleSubmit() {
    const payload = {
      name: formName,
      slug: formSlug || slugify(formName),
      description: formDescription || null,
      icon: formIcon || null,
      sortOrder: formSortOrder,
      isActive: formIsActive,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center gap-2" data-testid="job-categories-loading">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading job categories...</span>
      </div>
    );
  }

  const sortedCategories = [...(categories || [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="p-4 space-y-4" data-testid="job-categories-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" data-testid="text-job-categories-title">
            <Tag className="h-5 w-5" /> Job Categories
          </h2>
          <p className="text-sm text-muted-foreground">Manage industry and role categories for job listings</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-job-category">
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>

      {sortedCategories.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-job-categories">No job categories yet. Add your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {sortedCategories.map((cat) => (
            <Card key={cat.id} className="p-0" data-testid={`job-category-${cat.id}`}>
              <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate" data-testid={`text-job-category-name-${cat.id}`}>
                      {cat.icon && <span className="mr-1">{cat.icon}</span>}
                      {cat.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">{cat.slug}</Badge>
                    {!cat.isActive && (
                      <Badge variant="outline" className="text-[10px] text-amber-600">Inactive</Badge>
                    )}
                  </div>
                  {cat.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{cat.description}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">#{cat.sortOrder}</span>
                <Button size="icon" variant="ghost" onClick={() => openEdit(cat)} data-testid={`button-edit-job-category-${cat.id}`}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(cat)} data-testid={`button-delete-job-category-${cat.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Job Category" : "Add Job Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (!editing) setFormSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Healthcare"
                data-testid="input-job-category-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="auto-generated"
                data-testid="input-job-category-slug"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this category"
                rows={2}
                data-testid="input-job-category-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Icon (optional)</Label>
                <Input
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder="e.g. stethoscope"
                  data-testid="input-job-category-icon"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                  data-testid="input-job-category-sort"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
                data-testid="switch-job-category-active"
              />
              <Label className="text-xs">Active</Label>
            </div>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!formName || isPending}
              data-testid="button-save-job-category"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-job-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete-job-category"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
