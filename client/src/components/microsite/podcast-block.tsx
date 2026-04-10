import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { Headphones, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PodcastBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function PodcastBlock({ block, template, accentColor, locale }: PodcastBlockProps) {
  const { headline, body, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Podcast" : "Podcast");
  const descText = t(body, locale);
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  const episodes = (items || []) as Array<{
    title?: string;
    description?: string;
    date?: string;
    url?: string;
    duration?: string;
  }>;

  const metadata = (block as any).metadata || {};
  const listeningLinks = (metadata.listeningLinks || []) as Array<{ platform: string; url: string }>;
  const hostName = metadata.hostName as string | undefined;

  return (
    <section id="podcast" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-podcast">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Headphones className="w-8 h-8" style={{ color: accentColor }} />
          <h2
            className={`text-3xl md:text-4xl ${headingClass}`}
            style={{ fontFamily: template.fontHeading, color: accentColor }}
            data-testid="text-podcast-headline"
          >
            {headlineText}
          </h2>
        </div>

        {(descText || hostName) && (
          <div className="space-y-2" style={{ fontFamily: template.fontBody }}>
            {hostName && (
              <p className="text-sm text-muted-foreground" data-testid="text-podcast-host">
                Hosted by {hostName}
              </p>
            )}
            {descText && (
              <p className="text-muted-foreground leading-relaxed" data-testid="text-podcast-description">
                {descText}
              </p>
            )}
          </div>
        )}

        {listeningLinks.length > 0 && (
          <div className="flex flex-wrap gap-3" data-testid="podcast-listening-links">
            {listeningLinks.map((link, i) => (
              <Button key={i} variant="outline" size="sm" asChild data-testid={`link-podcast-${link.platform}`}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {link.platform}
                </a>
              </Button>
            ))}
          </div>
        )}

        {episodes.length > 0 && (
          <div className="space-y-4" data-testid="podcast-episodes">
            {episodes.map((ep, i) => (
              <div
                key={i}
                className={`${template.borderRadius} border p-4 space-y-2`}
                data-testid={`card-episode-${i}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-medium" style={{ fontFamily: template.fontHeading }}>
                      {ep.title || `Episode ${i + 1}`}
                    </h3>
                    {ep.date && (
                      <p className="text-xs text-muted-foreground">{ep.date}</p>
                    )}
                    {ep.duration && (
                      <p className="text-xs text-muted-foreground">{ep.duration}</p>
                    )}
                  </div>
                  {ep.url && (
                    <Button variant="outline" size="sm" asChild data-testid={`link-episode-${i}`}>
                      <a href={ep.url} target="_blank" rel="noopener noreferrer">
                        Listen
                      </a>
                    </Button>
                  )}
                </div>
                {ep.description && (
                  <p className="text-sm text-muted-foreground">{ep.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {episodes.length === 0 && !descText && (
          <p className="text-muted-foreground italic">No episodes added yet.</p>
        )}
      </div>
    </section>
  );
}
