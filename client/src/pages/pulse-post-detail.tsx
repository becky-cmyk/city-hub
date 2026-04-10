import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { ArrowLeft, Film, MessageSquare, Clock, User } from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { format } from "date-fns";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ShareMenu } from "@/components/share-menu";
import type { Post } from "@shared/schema";
import { useI18n, localized } from "@/lib/i18n";

type PostWithBilingual = Post & { titleEs?: string | null; bodyEs?: string | null };

interface PostWithAuthor extends PostWithBilingual {
  author?: { displayName: string; handle?: string | null } | null;
}

export default function PulsePostDetail({ citySlug, postId }: { citySlug: string; postId: string }) {
  const { t, locale } = useI18n();
  const smartBack = useSmartBack(`/${citySlug}`);
  const { data: post, isLoading } = useQuery<PostWithAuthor>({
    queryKey: ["/api/posts", postId],
  });

  useRegisterAdminEdit("pulse-posts", post?.id, "Edit Post");

  const postTitle = post?.title || t("pulse.post");
  const postDescription = post?.body?.slice(0, 160) || "";
  const postUrl = `${window.location.origin}/${citySlug}/pulse/post/${postId}`;
  const ogImageUrl = `${window.location.origin}/api/og-image/pulse/${postId}`;

  usePageMeta({
    title: `${postTitle} | CLT Metro Hub Pulse`,
    description: postDescription,
    canonical: postUrl,
    ogTitle: postTitle,
    ogDescription: postDescription,
    ogImage: ogImageUrl,
    ogUrl: postUrl,
    ogType: "article",
    twitterCard: "summary_large_image",
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="aspect-video w-full rounded-md" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="p-12 text-center">
          <h3 className="font-semibold text-lg mb-1" data-testid="text-post-not-found">{t("pulse.postNotFound")}</h3>
          <Link href={`/${citySlug}`}>
            <Button variant="ghost" className="mt-2" data-testid="link-back-feed">{t("pulse.backToFeed")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isReel = post.mediaType === "reel";
  const isVideo = post.mediaType === "video" || isReel;
  const displayImage = post.coverImageUrl || post.videoThumbnailUrl || (post.mediaUrls && post.mediaUrls[0]) || null;
  const authorName = post.author?.displayName || t("pulse.anonymous");
  const authorHandle = post.author?.handle ? `@${post.author.handle}` : null;
  const displayTitle = localized(locale, post.title, post.titleEs);

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-4">
      <Button variant="ghost" size="sm" className="gap-1 text-purple-300" onClick={smartBack} data-testid="link-back-feed">
        <ArrowLeft className="h-4 w-4" /> {t("pulse.backToFeed")}
      </Button>

      {isVideo && post.videoUrl ? (
        <div className="aspect-video overflow-hidden rounded-md bg-black">
          <video
            src={post.videoUrl}
            poster={post.videoThumbnailUrl || undefined}
            controls
            className="h-full w-full object-contain"
            data-testid="video-post-player"
          />
        </div>
      ) : isVideo && post.videoEmbedUrl ? (
        <div className="aspect-video overflow-hidden rounded-md bg-black">
          <iframe
            src={post.videoEmbedUrl}
            className="h-full w-full border-0"
            allowFullScreen
            data-testid="video-post-embed"
            title={displayTitle}
          />
        </div>
      ) : displayImage ? (
        <div className="overflow-hidden rounded-md">
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full object-cover"
            data-testid="image-post-cover"
          />
        </div>
      ) : null}

      {post.mediaType === "gallery" && post.mediaUrls && post.mediaUrls.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {post.mediaUrls.slice(1).map((url, idx) => (
            <div key={idx} className="overflow-hidden rounded-md">
              <img src={url} alt={`${displayTitle} ${idx + 2}`} className="w-full aspect-square object-cover" data-testid={`image-gallery-${idx}`} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-post-title">{displayTitle}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1" data-testid="badge-post-type">
              {isReel ? <Film className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
              {isReel ? t("pulse.reel") : post.mediaType === "video" ? t("pulse.video") : t("pulse.post")}
            </Badge>
            {post.publishedAt && (
              <span className="text-sm text-muted-foreground flex items-center gap-1" data-testid="text-post-date">
                <Clock className="h-3 w-3" />
                {format(new Date(post.publishedAt), "MMMM d, yyyy")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareMenu title={displayTitle} url={postUrl} type="article" slug={postId} />
        </div>
      </div>

      <div className="flex items-center gap-3 py-2" data-testid="text-post-author">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-sm">{authorName}</p>
          {authorHandle && (
            <p className="text-xs text-muted-foreground">{authorHandle}</p>
          )}
        </div>
      </div>

      {post.body && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-post-body">
          {localized(locale, post.body, post.bodyEs)}
        </div>
      )}

    </div>
  );
}
