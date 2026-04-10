import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CmsTag {
  id: string;
  name: string;
  slug: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function CmsTagsManager({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editTag, setEditTag] = useState<CmsTag | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const { data: tags, isLoading } = useQuery<CmsTag[]>({
    queryKey: ["/api/admin/cms/tags"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      return apiRequest("POST", "/api/admin/cms/tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/tags"] });
      setShowCreate(false);
      setName("");
      setSlug("");
      toast({ title: "Tag created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create tag", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; slug: string } }) => {
      return apiRequest("PATCH", `/api/admin/cms/tags/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/tags"] });
      setEditTag(null);
      setName("");
      setSlug("");
      toast({ title: "Tag updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update tag", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/cms/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/tags"] });
      toast({ title: "Tag deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete tag", description: err.message, variant: "destructive" });
    },
  });

  function openCreate() {
    setName("");
    setSlug("");
    setShowCreate(true);
  }

  function openEdit(tag: CmsTag) {
    setEditTag(tag);
    setName(tag.name);
    setSlug(tag.slug);
  }

  return (
    <div className="space-y-4" data-testid="cms-tags-manager">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tags</h2>
        <Button onClick={openCreate} data-testid="button-create-tag">
          <Plus className="w-4 h-4 mr-2" /> New Tag
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      ) : !tags?.length ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No tags yet. Create your first tag to start organizing content.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tags.map((tag) => (
            <Card key={tag.id} className="p-3 flex items-center justify-between" data-testid={`card-tag-${tag.id}`}>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{tag.name}</p>
                  <p className="text-xs text-muted-foreground">{tag.slug}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => openEdit(tag)}
                  data-testid={`button-edit-tag-${tag.id}`}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteMutation.mutate(tag.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-tag-${tag.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate || !!editTag} onOpenChange={() => { setShowCreate(false); setEditTag(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTag ? "Edit Tag" : "Create Tag"}</DialogTitle>
            <DialogDescription>{editTag ? "Update the tag name and slug." : "Add a new tag to organize your content."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editTag) setSlug(slugify(e.target.value));
                }}
                placeholder="Tag name"
                data-testid="input-tag-name"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="tag-slug"
                data-testid="input-tag-slug"
              />
            </div>
            <Button
              className="w-full"
              disabled={!name || !slug || createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (editTag) {
                  updateMutation.mutate({ id: editTag.id, data: { name, slug } });
                } else {
                  createMutation.mutate({ name, slug });
                }
              }}
              data-testid="button-save-tag"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editTag ? "Update Tag" : "Create Tag"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
