import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { Award } from "lucide-react";

interface ExpertBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function ExpertBlock({ block, template, accentColor, locale }: ExpertBlockProps) {
  const { headline, body, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Experto Local" : "Local Expert");
  const credentialsText = t(body, locale);
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  const topics = (items || []) as Array<{
    topic?: string;
    description?: string;
    quoteReady?: boolean;
  }>;

  const metadata = (block as any).metadata || {};
  const credentials = (metadata.credentials || []) as string[];

  return (
    <section id="expert" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-expert">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Award className="w-8 h-8" style={{ color: accentColor }} />
          <h2
            className={`text-3xl md:text-4xl ${headingClass}`}
            style={{ fontFamily: template.fontHeading, color: accentColor }}
            data-testid="text-expert-headline"
          >
            {headlineText}
          </h2>
        </div>

        {credentialsText && (
          <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }} data-testid="text-expert-credentials">
            {credentialsText}
          </p>
        )}

        {credentials.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="expert-credentials-list">
            {credentials.map((cred, i) => (
              <span
                key={i}
                className={`${template.borderRadius} border px-3 py-1 text-sm`}
                style={{ borderColor: accentColor, color: accentColor }}
                data-testid={`badge-credential-${i}`}
              >
                {cred}
              </span>
            ))}
          </div>
        )}

        {topics.length > 0 && (
          <div className="space-y-4" data-testid="expert-topics">
            <h3 className="text-lg font-medium" style={{ fontFamily: template.fontHeading }}>
              {locale === "es" ? "Temas de Experiencia" : "Topics of Expertise"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topics.map((t, i) => (
                <div
                  key={i}
                  className={`${template.borderRadius} border p-4 space-y-1`}
                  data-testid={`card-topic-${i}`}
                >
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium" style={{ fontFamily: template.fontHeading }}>
                      {t.topic || `Topic ${i + 1}`}
                    </h4>
                    {t.quoteReady && (
                      <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: accentColor, color: accentColor }}>
                        Available for Quotes
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {topics.length === 0 && !credentialsText && credentials.length === 0 && (
          <p className="text-muted-foreground italic">No expertise topics added yet.</p>
        )}
      </div>
    </section>
  );
}
