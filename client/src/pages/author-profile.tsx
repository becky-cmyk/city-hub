import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Phone, Globe, PenTool } from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { SiX, SiLinkedin, SiInstagram, SiYoutube, SiTiktok } from "react-icons/si";
import { Link } from "wouter";
import { format } from "date-fns";
import { usePageMeta } from "@/hooks/use-page-meta";

interface AuthorProfile {
  id: string;
  name: string;
  penName: string | null;
  slug: string;
  roleTitle: string | null;
  photoUrl: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  socialTwitter: string | null;
  socialLinkedin: string | null;
  socialInstagram: string | null;
  socialYoutube: string | null;
  socialTiktok: string | null;
  articles: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    imageUrl: string | null;
    publishedAt: string | null;
  }[];
}

export default function AuthorProfilePage({ citySlug, slug }: { citySlug: string; slug: string }) {
  const smartBack = useSmartBack(`/${citySlug}/articles`);
  const { data: author, isLoading } = useQuery<AuthorProfile>({
    queryKey: ["/api/cities", citySlug, "authors", slug],
  });

  useRegisterAdminEdit("authors", author?.id, "Edit Author");

  usePageMeta({
    title: author ? `${author.name} - Author | CLT Metro Hub` : "Author | CLT Metro Hub",
    description: author?.bio?.slice(0, 160) || "Author profile on CLT Metro Hub.",
    canonical: `${window.location.origin}/${citySlug}/authors/${slug}`,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <Skeleton className="h-28 w-28 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!author) {
    return (
      <Card className="p-12 text-center max-w-lg mx-auto">
        <h3 className="font-semibold text-lg mb-1">Author not found</h3>
        <Link href={`/${citySlug}/articles`}>
          <Button variant="ghost" className="mt-2">Back to articles</Button>
        </Link>
      </Card>
    );
  }

  const socials = [
    { url: author.socialTwitter, icon: SiX, label: "X / Twitter" },
    { url: author.socialLinkedin, icon: SiLinkedin, label: "LinkedIn" },
    { url: author.socialInstagram, icon: SiInstagram, label: "Instagram" },
    { url: author.socialYoutube, icon: SiYoutube, label: "YouTube" },
    { url: author.socialTiktok, icon: SiTiktok, label: "TikTok" },
  ].filter((s) => s.url);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack} data-testid="link-back-articles">
        <ArrowLeft className="h-4 w-4" /> Back to articles
      </Button>

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl" />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 sm:p-8">
          {author.photoUrl ? (
            <img
              src={author.photoUrl}
              alt={author.name}
              className="h-28 w-28 sm:h-32 sm:w-32 rounded-full object-cover ring-4 ring-background shadow-lg shrink-0"
              data-testid="img-author-photo"
            />
          ) : (
            <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-background shadow-lg shrink-0">
              <PenTool className="h-10 w-10 text-primary" />
            </div>
          )}
          <div className="text-center sm:text-left space-y-2 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-author-name">
              {author.name}
            </h1>
            {author.penName && (
              <p className="text-sm text-muted-foreground italic">Writing as {author.penName}</p>
            )}
            {author.roleTitle && (
              <Badge variant="secondary" className="text-xs font-medium" data-testid="text-author-role">
                {author.roleTitle}
              </Badge>
            )}

            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start pt-1">
              {author.email && (
                <a href={`mailto:${author.email}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" data-testid="link-author-email">
                  <Mail className="h-3.5 w-3.5" /> {author.email}
                </a>
              )}
              {author.phone && (
                <a href={`tel:${author.phone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" data-testid="link-author-phone">
                  <Phone className="h-3.5 w-3.5" /> {author.phone}
                </a>
              )}
              {author.websiteUrl && (
                <a href={author.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" data-testid="link-author-website">
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              )}
            </div>

            {socials.length > 0 && (
              <div className="flex items-center gap-3 justify-center sm:justify-start pt-1">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title={s.label}
                    data-testid={`link-social-${s.label.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {author.bio && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed" data-testid="text-author-bio">{author.bio}</p>
        </div>
      )}

      {author.articles.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Articles by {author.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {author.articles.map((article) => (
              <Link key={article.id} href={`/${citySlug}/articles/${article.slug}`}>
                <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group" data-testid={`card-article-${article.id}`}>
                  {article.imageUrl && (
                    <div className="aspect-[2/1] overflow-hidden">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-1.5">
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors" data-testid={`text-article-title-${article.id}`}>
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{article.excerpt}</p>
                    )}
                    {article.publishedAt && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(article.publishedAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {author.articles.length === 0 && (
        <Card className="p-8 text-center">
          <PenTool className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No published articles yet.</p>
        </Card>
      )}
    </div>
  );
}
