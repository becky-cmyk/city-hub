import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";

interface AboutBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function AboutBlock({ block, template, accentColor, locale }: AboutBlockProps) {
  const { headline, body, image } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Sobre Nosotros" : "About Us");
  const bodyText = t(body, locale);
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  return (
    <section id="about" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-about">
      <div className={`max-w-5xl mx-auto ${image ? "grid md:grid-cols-2 gap-12 items-center" : ""}`}>
        <div className="space-y-6">
          <h2
            className={`text-3xl md:text-4xl ${headingClass}`}
            style={{ fontFamily: template.fontHeading, color: accentColor }}
            data-testid="text-about-headline"
          >
            {headlineText}
          </h2>
          {bodyText && (
            <div className="space-y-4" style={{ fontFamily: template.fontBody }}>
              {bodyText.split("\n\n").map((paragraph, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          )}
        </div>
        {image && (
          <div className={`${template.borderRadius} overflow-hidden`}>
            <img src={image} alt="About" className="w-full h-auto object-cover aspect-[4/3]" />
          </div>
        )}
      </div>
    </section>
  );
}
