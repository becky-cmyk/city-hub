import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { Mic, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpeakerBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function SpeakerBlock({ block, template, accentColor, locale }: SpeakerBlockProps) {
  const { headline, body, items, ctaText, ctaLink } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Orador" : "Speaker");
  const bioText = t(body, locale);
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  const speakingTopics = (items || []) as Array<{
    topic?: string;
    audienceType?: string;
    description?: string;
    sampleTalk?: string;
  }>;

  const metadata = (block as any).metadata || {};
  const availableForBooking = metadata.availableForBooking as boolean | undefined;
  const mediaLinks = (metadata.mediaLinks || []) as Array<{ label: string; url: string }>;

  return (
    <section id="speaker" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-speaker">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Mic className="w-8 h-8" style={{ color: accentColor }} />
          <h2
            className={`text-3xl md:text-4xl ${headingClass}`}
            style={{ fontFamily: template.fontHeading, color: accentColor }}
            data-testid="text-speaker-headline"
          >
            {headlineText}
          </h2>
          {availableForBooking && (
            <span className="text-xs px-3 py-1 rounded-full border" style={{ borderColor: accentColor, color: accentColor }} data-testid="badge-available">
              Available for Booking
            </span>
          )}
        </div>

        {bioText && (
          <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }} data-testid="text-speaker-bio">
            {bioText}
          </p>
        )}

        {speakingTopics.length > 0 && (
          <div className="space-y-4" data-testid="speaker-topics">
            <h3 className="text-lg font-medium" style={{ fontFamily: template.fontHeading }}>
              {locale === "es" ? "Temas" : "Speaking Topics"}
            </h3>
            <div className="space-y-3">
              {speakingTopics.map((st, i) => (
                <div
                  key={i}
                  className={`${template.borderRadius} border p-4 space-y-2`}
                  data-testid={`card-speaking-topic-${i}`}
                >
                  <h4 className="font-medium" style={{ fontFamily: template.fontHeading }}>
                    {st.topic || `Topic ${i + 1}`}
                  </h4>
                  {st.audienceType && (
                    <p className="text-xs text-muted-foreground">Audience: {st.audienceType}</p>
                  )}
                  {st.description && (
                    <p className="text-sm text-muted-foreground">{st.description}</p>
                  )}
                  {st.sampleTalk && (
                    <p className="text-sm italic text-muted-foreground">Sample: "{st.sampleTalk}"</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {mediaLinks.length > 0 && (
          <div className="flex flex-wrap gap-3" data-testid="speaker-media-links">
            {mediaLinks.map((link, i) => (
              <Button key={i} variant="outline" size="sm" asChild data-testid={`link-speaker-media-${i}`}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {link.label}
                </a>
              </Button>
            ))}
          </div>
        )}

        {ctaLink && (
          <div className="pt-4">
            <Button asChild style={{ backgroundColor: accentColor }} data-testid="button-speaker-booking">
              <a href={ctaLink} target="_blank" rel="noopener noreferrer">
                {t(ctaText, locale) || (locale === "es" ? "Reservar Orador" : "Book This Speaker")}
              </a>
            </Button>
          </div>
        )}

        {speakingTopics.length === 0 && !bioText && (
          <p className="text-muted-foreground italic">No speaking topics added yet.</p>
        )}
      </div>
    </section>
  );
}
