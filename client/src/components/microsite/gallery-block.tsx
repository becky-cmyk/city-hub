import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";

interface GalleryBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  galleryImages?: string[];
}

export function GalleryBlock({ block, template, accentColor, locale, galleryImages }: GalleryBlockProps) {
  const { headline, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Galería" : "Gallery");
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  const images = (items && items.length > 0)
    ? items.map((item: any) => item.url || item.src || "")
    : (galleryImages || []);

  if (images.length === 0) return null;

  return (
    <section id="gallery" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-gallery">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-gallery-headline"
        >
          {headlineText}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img: string, i: number) => (
            <div
              key={i}
              className={`${template.borderRadius} overflow-hidden aspect-square`}
              data-testid={`img-gallery-${i}`}
            >
              <img
                src={img}
                alt={`Gallery ${i + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
