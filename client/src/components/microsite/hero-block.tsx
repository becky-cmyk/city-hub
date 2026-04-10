import { Button } from "@/components/ui/button";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";

interface HeroBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  businessName: string;
  coverImage?: string | null;
  galleryImages?: string[];
}

export function HeroBlock({ block, template, accentColor, locale, businessName, coverImage, galleryImages }: HeroBlockProps) {
  const { headline, subheadline, ctaText, ctaLink, backgroundImage } = block.content;
  const heroImage = backgroundImage || coverImage || (galleryImages && galleryImages.length > 0 ? galleryImages[0] : undefined);
  const headlineText = t(headline, locale) || businessName;
  const subText = t(subheadline, locale);
  const ctaLabel = t(ctaText, locale) || (locale === "es" ? "Más Información" : "Learn More");
  const ctaHref = ctaLink || "#contact";

  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""} tracking-tight`;

  if (template.heroLayout === "split" && heroImage) {
    return (
      <section id="hero" className="relative min-h-[70vh] flex" data-testid="block-hero">
        <div className="flex-1 flex items-center justify-center p-8 md:p-16">
          <div className="max-w-lg space-y-6">
            <h1
              className={`text-4xl md:text-5xl lg:text-6xl ${headingClass}`}
              style={{ fontFamily: template.fontHeading }}
              data-testid="text-hero-headline"
            >
              {headlineText}
            </h1>
            {subText && (
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }}>
                {subText}
              </p>
            )}
            <a href={ctaHref}>
              <Button
                className={template.buttonStyle}
                style={{ backgroundColor: accentColor, color: "#fff", borderColor: accentColor }}
                data-testid="button-hero-cta"
              >
                {ctaLabel}
              </Button>
            </a>
          </div>
        </div>
        <div className="hidden md:block flex-1 relative">
          <img src={heroImage} alt={businessName} className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </section>
    );
  }

  return (
    <section
      id="hero"
      className="relative min-h-[70vh] flex items-center justify-center overflow-hidden"
      data-testid="block-hero"
    >
      {heroImage && (
        <>
          <img src={heroImage} alt={businessName} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </>
      )}
      {!heroImage && (
        <div className="absolute inset-0" style={{ backgroundColor: accentColor, opacity: 0.9 }} />
      )}
      <div
        className={`relative z-10 ${template.heroLayout === "left-aligned" ? "text-left max-w-3xl w-full px-8 md:px-16" : "text-center max-w-3xl px-6"} space-y-6`}
      >
        <h1
          className={`text-4xl md:text-5xl lg:text-6xl text-white ${headingClass}`}
          style={{ fontFamily: template.fontHeading }}
          data-testid="text-hero-headline"
        >
          {headlineText}
        </h1>
        {subText && (
          <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto" style={{ fontFamily: template.fontBody }}>
            {subText}
          </p>
        )}
        <a href={ctaHref}>
          <Button
            className={template.buttonStyle}
            style={{ backgroundColor: "#fff", color: accentColor }}
            data-testid="button-hero-cta"
          >
            {ctaLabel}
          </Button>
        </a>
      </div>
    </section>
  );
}
