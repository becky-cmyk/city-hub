import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Share2 } from "lucide-react";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Digest } from "@shared/schema";

export default function DigestDetail({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const smartBack = useSmartBack(`/${citySlug}/digests`);
  const { data: digest, isLoading } = useQuery<Digest>({
    queryKey: ["/api/cities", citySlug, "digests", slug],
  });

  useRegisterAdminEdit("weekly-digest", digest?.id, "Edit Digest");

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: digest?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!" });
    }
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;

  if (!digest) return (
    <Card className="p-12 text-center">
      <h3 className="font-semibold text-lg mb-1">Digest not found</h3>
      <Button variant="ghost" className="mt-2" onClick={smartBack}>Back</Button>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold md:text-3xl" data-testid="text-digest-title">{digest.title}</h1>
          <Button variant="outline" size="icon" onClick={handleShare} data-testid="button-share-digest">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        {digest.publishedAt && <p className="text-sm text-muted-foreground mt-1">{format(new Date(digest.publishedAt), "MMMM d, yyyy")}</p>}
      </div>
      {digest.content && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: digest.content.replace(/\n/g, "<br/>") }} />
        </div>
      )}
    </div>
  );
}
