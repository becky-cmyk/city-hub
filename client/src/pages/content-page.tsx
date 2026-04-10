import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";

interface CmsPage {
  id: string;
  titleEn: string;
  titleEs: string | null;
  bodyEn: string;
  bodyEs: string | null;
  slug: string;
  seoTitleEn: string | null;
  seoDescriptionEn: string | null;
  status: string;
}

export default function ContentPage({ citySlug, slug }: { citySlug: string; slug?: string }) {

  const { data: page, isLoading, error } = useQuery<CmsPage>({
    queryKey: ["/api/cms/pages", slug],
    enabled: !!slug,
  });

  useRegisterAdminEdit("cms-editor", page?.id, "Edit Page");

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-4" data-testid="content-page-loading">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center" data-testid="content-page-not-found">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted-foreground">This page doesn't exist or hasn't been published yet.</p>
      </div>
    );
  }

  return (
    <>
      {page.seoTitleEn && <title>{page.seoTitleEn}</title>}
      {page.seoDescriptionEn && <meta name="description" content={page.seoDescriptionEn} />}
      <article className="max-w-3xl mx-auto py-8" data-testid="content-page-article">
        <h1 className="text-3xl font-bold mb-6" data-testid="text-page-title">{page.titleEn}</h1>
        <div
          className="prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: page.bodyEn }}
          data-testid="content-page-body"
        />
      </article>
    </>
  );
}
