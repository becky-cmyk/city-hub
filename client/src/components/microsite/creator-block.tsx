import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { Video, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreatorBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function CreatorBlock({ block, template, accentColor, locale }: CreatorBlockProps) {
  const { headline, body, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Contenido del Creador" : "Creator Content");
  const bioText = t(body, locale);
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  const contentItems = (items || []) as Array<{
    title?: string;
    embedUrl?: string;
    thumbnailUrl?: string;
    platform?: string;
    description?: string;
  }>;

  const metadata = (block as any).metadata || {};
  const socialLinks = (metadata.socialLinks || []) as Array<{ platform: string; url: string }>;

  return (
    <section id="creator" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-creator">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Video className="w-8 h-8" style={{ color: accentColor }} />
          <h2
            className={`text-3xl md:text-4xl ${headingClass}`}
            style={{ fontFamily: template.fontHeading, color: accentColor }}
            data-testid="text-creator-headline"
          >
            {headlineText}
          </h2>
        </div>

        {bioText && (
          <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }} data-testid="text-creator-bio">
            {bioText}
          </p>
        )}

        {socialLinks.length > 0 && (
          <div className="flex flex-wrap gap-3" data-testid="creator-social-links">
            {socialLinks.map((link, i) => (
              <Button key={i} variant="outline" size="sm" asChild data-testid={`link-social-${link.platform}`}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {link.platform}
                </a>
              </Button>
            ))}
          </div>
        )}

        {contentItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="creator-content-gallery">
            {contentItems.map((item, i) => (
              <div
                key={i}
                className={`${template.borderRadius} border overflow-hidden`}
                data-testid={`card-creator-content-${i}`}
              >
                {item.thumbnailUrl && (
                  <img src={item.thumbnailUrl} alt={item.title || "Content"} className="w-full h-48 object-cover" />
                )}
                <div className="p-4 space-y-2">
                  {item.title && (
                    <h3 className="font-medium" style={{ fontFamily: template.fontHeading }}>
                      {item.title}
                    </h3>
                  )}
                  {item.platform && (
                    <p className="text-xs text-muted-foreground">{item.platform}</p>
                  )}
                  {item.description && (
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  )}
                  {item.embedUrl && (
                    <Button variant="outline" size="sm" asChild data-testid={`link-creator-content-${i}`}>
                      <a href={item.embedUrl} target="_blank" rel="noopener noreferrer">
                        View Content
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {contentItems.length === 0 && !bioText && (
          <p className="text-muted-foreground italic">No creator content added yet.</p>
        )}
      </div>
    </section>
  );
}
