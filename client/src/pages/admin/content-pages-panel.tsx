import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ExternalLink, Edit, Eye, Trash2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CmsPage {
  id: string;
  titleEn: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  contentType: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  published: "bg-green-500/10 text-green-500 border-green-500/30",
  archived: "bg-gray-500/10 text-gray-500 border-gray-500/30",
  review: "bg-blue-500/10 text-blue-500 border-blue-500/30",
};

interface ContentPagesPanelProps {
  onEditPage?: (id: string) => void;
  onCreateNew?: () => void;
  cityId?: string;
}

export default function ContentPagesPanel({ onEditPage, onCreateNew, cityId }: ContentPagesPanelProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: CmsPage[]; total: number }>({
    queryKey: ["/api/admin/cms/content", "pages-only"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cms/content?contentType=page&limit=100", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pages");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/cms/content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/content"] });
      toast({ title: "Page deleted" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error deleting page", description: err.message, variant: "destructive" });
    },
  });

  const pages = data?.items || [];

  return (
    <div className="space-y-6" data-testid="content-pages-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-content-pages-title">Content Pages</h2>
          <p className="text-muted-foreground text-sm">Manage public-facing pages like About, FAQ, Terms, etc.</p>
        </div>
        {onCreateNew && (
          <Button onClick={onCreateNew} data-testid="button-create-page">
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <Card className="p-8 text-center" data-testid="content-pages-empty">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Content Pages Yet</h3>
          <p className="text-muted-foreground mb-4">Create pages like About, FAQ, or Terms of Service.</p>
          {onCreateNew && (
            <Button onClick={onCreateNew} data-testid="button-create-first-page">
              <Plus className="h-4 w-4 mr-2" />
              Create First Page
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <Card key={page.id} className="p-4" data-testid={`card-page-${page.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate" data-testid={`text-page-title-${page.id}`}>
                      {page.titleEn}
                    </h3>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[page.status] || ""}
                      data-testid={`badge-page-status-${page.id}`}
                    >
                      {page.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span data-testid={`text-page-slug-${page.id}`}>/{page.slug}</span>
                    {page.publishedAt && (
                      <span>Published {new Date(page.publishedAt).toLocaleDateString()}</span>
                    )}
                    <span>Updated {new Date(page.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {page.status === "published" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/charlotte/pages/${page.slug}`, "_blank")}
                      data-testid={`button-view-page-${page.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {onEditPage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditPage(page.id)}
                      data-testid={`button-edit-page-${page.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(page.id)}
                    data-testid={`button-delete-page-${page.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this content page. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
