import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Loader2, ChevronRight, ChevronDown, Edit, Trash2, FolderTree, Tag, Layers } from "lucide-react";

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parentCategoryId: string | null;
  sortOrder: number;
  children?: CategoryNode[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function CategoriesPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());
  const [expandedL2, setExpandedL2] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newLevel, setNewLevel] = useState<"L1" | "L2" | "L3">("L1");
  const [newParentId, setNewParentId] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);

  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);

  const { data: categoryTree, isLoading } = useQuery<CategoryNode[]>({
    queryKey: ["/api/admin/categories", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/categories?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({ title: "Category created" });
      setShowAddDialog(false);
      resetAddForm();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create category", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({ title: "Category updated" });
      setEditingCategory(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/categories/${id}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({ title: "Category deleted" });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Cannot delete", description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  function resetAddForm() {
    setNewName("");
    setNewSlug("");
    setNewLevel("L1");
    setNewParentId("");
    setNewIcon("");
    setNewSortOrder(0);
  }

  function openAddDialog() {
    resetAddForm();
    setShowAddDialog(true);
  }

  function openEditDialog(cat: CategoryNode) {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditIcon(cat.icon || "");
    setEditSortOrder(cat.sortOrder);
  }

  function handleCreate() {
    const slug = newSlug || slugify(newName);
    createMutation.mutate({
      name: newName,
      slug,
      parentCategoryId: newLevel !== "L1" ? newParentId : null,
      icon: newIcon || null,
      sortOrder: newSortOrder,
    });
  }

  function handleUpdate() {
    if (!editingCategory) return;
    updateMutation.mutate({
      id: editingCategory.id,
      data: {
        name: editName,
        slug: editSlug,
        icon: editIcon || null,
        sortOrder: editSortOrder,
      },
    });
  }

  function toggleL1(id: string) {
    setExpandedL1(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleL2(id: string) {
    setExpandedL2(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allL1 = categoryTree || [];
  const allL2 = allL1.flatMap(l1 => (l1.children || []).map(c => ({ ...c, parentName: l1.name })));

  function getParentOptions() {
    if (newLevel === "L2") {
      return allL1.map(l1 => ({ id: l1.id, name: l1.name }));
    }
    if (newLevel === "L3") {
      return allL2.map(l2 => ({ id: l2.id, name: `${l2.parentName} > ${l2.name}` }));
    }
    return [];
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading categories...</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" data-testid="text-categories-title">
            <FolderTree className="h-5 w-5" /> Category Manager
          </h2>
          <p className="text-sm text-muted-foreground">Manage L1, L2, and L3 micro-tag categories</p>
        </div>
        <Button onClick={openAddDialog} data-testid="button-add-category">
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>

      {allL1.length === 0 && (
        <Card className="p-8 text-center">
          <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No categories yet. Add your first one.</p>
        </Card>
      )}

      <div className="space-y-1">
        {allL1.map(l1 => {
          const isExpanded = expandedL1.has(l1.id);
          const l2Count = l1.children?.length || 0;
          const l3Count = l1.children?.reduce((sum, c) => sum + (c.children?.length || 0), 0) || 0;

          return (
            <div key={l1.id} data-testid={`category-l1-${l1.id}`}>
              <Card className="p-0">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    className="shrink-0"
                    onClick={() => toggleL1(l1.id)}
                    data-testid={`button-toggle-l1-${l1.id}`}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <span className="font-semibold text-sm flex-1 min-w-0 truncate" data-testid={`text-category-name-${l1.id}`}>
                    {l1.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{l1.slug}</Badge>
                  {l2Count > 0 && (
                    <Badge variant="outline" className="text-[10px]">{l2Count} sub</Badge>
                  )}
                  {l3Count > 0 && (
                    <Badge variant="outline" className="text-[10px]">{l3Count} tags</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">#{l1.sortOrder}</span>
                  <Button size="icon" variant="ghost" onClick={() => openEditDialog(l1)} data-testid={`button-edit-${l1.id}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(l1)} data-testid={`button-delete-${l1.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>

              {isExpanded && l1.children && l1.children.length > 0 && (
                <div className="ml-6 mt-1 space-y-1">
                  {l1.children.map(l2 => {
                    const isL2Expanded = expandedL2.has(l2.id);
                    const microCount = l2.children?.length || 0;

                    return (
                      <div key={l2.id} data-testid={`category-l2-${l2.id}`}>
                        <Card className="p-0">
                          <div className="flex items-center gap-2 px-3 py-1.5">
                            <button
                              className="shrink-0"
                              onClick={() => toggleL2(l2.id)}
                              data-testid={`button-toggle-l2-${l2.id}`}
                            >
                              {microCount > 0 ? (
                                isL2Expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                              ) : (
                                <span className="w-3.5" />
                              )}
                            </button>
                            <span className="text-sm flex-1 min-w-0 truncate" data-testid={`text-category-name-${l2.id}`}>
                              {l2.name}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">{l2.slug}</Badge>
                            {microCount > 0 && (
                              <Badge variant="outline" className="text-[10px]">{microCount} tags</Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">#{l2.sortOrder}</span>
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(l2)} data-testid={`button-edit-${l2.id}`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(l2)} data-testid={`button-delete-${l2.id}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </Card>

                        {isL2Expanded && l2.children && l2.children.length > 0 && (
                          <div className="ml-6 mt-1 space-y-0.5">
                            {l2.children.map(l3 => (
                              <div
                                key={l3.id}
                                className="flex items-center gap-2 px-3 py-1 rounded-md border bg-card"
                                data-testid={`category-l3-${l3.id}`}
                              >
                                <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-xs flex-1 min-w-0 truncate" data-testid={`text-category-name-${l3.id}`}>
                                  {l3.name}
                                </span>
                                <Badge variant="secondary" className="text-[9px]">{l3.slug}</Badge>
                                <span className="text-[10px] text-muted-foreground">#{l3.sortOrder}</span>
                                <Button size="icon" variant="ghost" onClick={() => openEditDialog(l3)} data-testid={`button-edit-${l3.id}`}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(l3)} data-testid={`button-delete-${l3.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Level</Label>
              <Select value={newLevel} onValueChange={(v) => { setNewLevel(v as any); setNewParentId(""); }}>
                <SelectTrigger data-testid="select-category-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">L1 - Top-level Category</SelectItem>
                  <SelectItem value="L2">L2 - Subcategory</SelectItem>
                  <SelectItem value="L3">L3 - Micro-tag</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newLevel !== "L1" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Parent</Label>
                <Select value={newParentId} onValueChange={setNewParentId}>
                  <SelectTrigger data-testid="select-category-parent">
                    <SelectValue placeholder="Select parent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getParentOptions().map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNewSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Food & Dining"
                data-testid="input-category-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="auto-generated"
                data-testid="input-category-slug"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Icon (optional)</Label>
                <Input
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  placeholder="e.g. utensils"
                  data-testid="input-category-icon"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(parseInt(e.target.value) || 0)}
                  data-testid="input-category-sort"
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={!newName || (newLevel !== "L1" && !newParentId) || createMutation.isPending}
              data-testid="button-create-category"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-category-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                data-testid="input-edit-category-slug"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Icon</Label>
                <Input
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  data-testid="input-edit-category-icon"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(parseInt(e.target.value) || 0)}
                  data-testid="input-edit-category-sort"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleUpdate}
              disabled={!editName || updateMutation.isPending}
              data-testid="button-save-category"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone. Categories that are in use by businesses or have subcategories cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete"
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
