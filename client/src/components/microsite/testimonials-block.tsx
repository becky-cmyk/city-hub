import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";

interface TestimonialsBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function TestimonialsBlock({ block, template, accentColor, locale }: TestimonialsBlockProps) {
  const { headline, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Lo Que Dicen" : "What People Say");
  const testimonials = items || [];
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  if (testimonials.length === 0) return null;

  return (
    <section id="testimonials" className={`${template.sectionSpacing} px-6 md:px-8 bg-muted/30`} data-testid="block-testimonials">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-testimonials-headline"
        >
          {headlineText}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((item: any, i: number) => {
            const authorName = t(item.author || item.name, locale) || "Anonymous";
            const quoteText = t(item.quote || item.text, locale);
            const roleText = t(item.role, locale);
            return (
              <Card key={i} className={`${template.cardStyle} p-6 space-y-4`} data-testid={`card-testimonial-${i}`}>
                {item.rating && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 ${s <= item.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                      />
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground leading-relaxed italic" style={{ fontFamily: template.fontBody }}>
                  "{quoteText}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>
                    {authorName[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{authorName}</p>
                    {roleText && <p className="text-xs text-muted-foreground">{roleText}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
