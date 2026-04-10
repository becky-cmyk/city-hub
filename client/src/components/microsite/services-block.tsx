import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { CheckCircle } from "lucide-react";

interface ServicesBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function ServicesBlock({ block, template, accentColor, locale }: ServicesBlockProps) {
  const { headline, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Nuestros Servicios" : "Our Services");
  const serviceItems = items || [];
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  if (serviceItems.length === 0) return null;

  return (
    <section id="services" className={`${template.sectionSpacing} px-6 md:px-8 bg-background/95`} data-testid="block-services">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-services-headline"
        >
          {headlineText}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceItems.map((item: any, i: number) => (
            <div
              key={i}
              className={`${template.cardStyle} bg-card border border-border p-6 space-y-3`}
              data-testid={`card-service-${i}`}
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: accentColor }} />
                <div>
                  <h3 className="font-semibold text-foreground" style={{ fontFamily: template.fontHeading }}>
                    {t(item.name || item.title, locale)}
                  </h3>
                  {(item.description) && (
                    <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: template.fontBody }}>
                      {t(item.description, locale)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
