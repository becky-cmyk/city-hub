import { Button } from "@/components/ui/button";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";

interface CtaBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function CtaBlock({ block, template, accentColor, locale }: CtaBlockProps) {
  const { headline, subheadline, ctaText, ctaLink } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "¿Listo para Comenzar?" : "Ready to Get Started?");
  const subText = t(subheadline, locale);
  const ctaLabel = t(ctaText, locale) || (locale === "es" ? "Contáctenos" : "Contact Us");
  const ctaHref = ctaLink || "#contact";
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  return (
    <section
      id="cta"
      className={`${template.sectionSpacing} px-6 md:px-8`}
      style={{ backgroundColor: accentColor }}
      data-testid="block-cta"
    >
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-white`}
          style={{ fontFamily: template.fontHeading }}
          data-testid="text-cta-headline"
        >
          {headlineText}
        </h2>
        {subText && (
          <p className="text-lg text-white/80 leading-relaxed" style={{ fontFamily: template.fontBody }}>
            {subText}
          </p>
        )}
        <a href={ctaHref}>
          <Button
            className={template.buttonStyle}
            style={{ backgroundColor: "#fff", color: accentColor }}
            data-testid="button-cta-action"
          >
            {ctaLabel}
          </Button>
        </a>
      </div>
    </section>
  );
}
