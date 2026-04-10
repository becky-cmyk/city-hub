import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { Gift, AlertTriangle, ArrowRight } from "lucide-react";

interface WishlistBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  wishlistItems?: any[];
}

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "High", color: "text-red-600", bg: "bg-red-100 dark:bg-red-950" },
  medium: { label: "Medium", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" },
  low: { label: "Low", color: "text-green-600", bg: "bg-green-100 dark:bg-green-950" },
};

export function WishlistBlock({ block, template, accentColor, locale, wishlistItems = [] }: WishlistBlockProps) {
  const { headline } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Lista de Necesidades" : "Wishlist");
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  if (wishlistItems.length === 0) return null;

  return (
    <section id="wishlist" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-wishlist">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl mb-8 ${headingClass}`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-wishlist-headline"
        >
          {headlineText}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishlistItems.map((item: any) => {
            const urgency = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.medium;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border/50 bg-card overflow-hidden hover:shadow-md transition-shadow"
                data-testid={`card-wishlist-${item.id}`}
              >
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.title} className="w-full h-36 object-cover" loading="lazy" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
                      <h3 className="font-semibold text-sm leading-tight" data-testid={`text-wishlist-title-${item.id}`}>
                        {item.title}
                      </h3>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${urgency.bg} ${urgency.color}`}>
                      <AlertTriangle className="h-2.5 w-2.5" /> {urgency.label}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
                  )}
                  {item.quantityNeeded && (
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Qty needed: {item.quantityNeeded}
                    </p>
                  )}
                  {item.externalUrl && (
                    <a
                      href={item.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium"
                      style={{ color: accentColor }}
                      data-testid={`link-wishlist-donate-${item.id}`}
                    >
                      Contact / Donate <ArrowRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
