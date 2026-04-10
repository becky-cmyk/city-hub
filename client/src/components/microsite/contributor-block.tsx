import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { PenTool, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContributorBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function ContributorBlock({ block, template, accentColor, locale }: ContributorBlockProps) {
  const { headline, body, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Contribuciones" : "Contributions");
  const bioText = t(body, locale);
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  const articles = (items || []) as Array<{
    title?: string;
    publication?: string;
    date?: string;
    url?: string;
    excerpt?: string;
  }>;

  return (
    <section id="contributor" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-contributor">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <PenTool className="w-8 h-8" style={{ color: accentColor }} />
          <h2
            className={`text-3xl md:text-4xl ${headingClass}`}
            style={{ fontFamily: template.fontHeading, color: accentColor }}
            data-testid="text-contributor-headline"
          >
            {headlineText}
          </h2>
        </div>

        {bioText && (
          <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }} data-testid="text-contributor-bio">
            {bioText}
          </p>
        )}

        {articles.length > 0 && (
          <div className="space-y-4" data-testid="contributor-articles">
            {articles.map((article, i) => (
              <div
                key={i}
                className={`${template.borderRadius} border p-4 space-y-2`}
                data-testid={`card-article-${i}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-medium" style={{ fontFamily: template.fontHeading }}>
                      {article.title || `Article ${i + 1}`}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {article.publication && <span>{article.publication}</span>}
                      {article.publication && article.date && <span>·</span>}
                      {article.date && <span>{article.date}</span>}
                    </div>
                  </div>
                  {article.url && (
                    <Button variant="outline" size="sm" asChild data-testid={`link-article-${i}`}>
                      <a href={article.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Read
                      </a>
                    </Button>
                  )}
                </div>
                {article.excerpt && (
                  <p className="text-sm text-muted-foreground">{article.excerpt}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {articles.length === 0 && !bioText && (
          <p className="text-muted-foreground italic">No contributions added yet.</p>
        )}
      </div>
    </section>
  );
}
