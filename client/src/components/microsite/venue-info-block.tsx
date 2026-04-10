import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { MapPin } from "lucide-react";

interface VenueInfoBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function VenueInfoBlock({ block, template, accentColor, locale }: VenueInfoBlockProps) {
  const { headline, body, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Información del Lugar" : "Venue Details");
  const descText = t(body, locale);
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  const features = (items || []) as Array<{
    label?: string;
    value?: string;
  }>;

  const metadata = (block as any).metadata || {};
  const capacity = metadata.capacity as number | undefined;
  const venueType = metadata.venueType as string | undefined;
  const mediaEligible = metadata.mediaEligible as boolean | undefined;

  return (
    <section id="venue-info" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-venue-info">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <MapPin className="w-8 h-8" style={{ color: accentColor }} />
          <h2
            className={`text-3xl md:text-4xl ${headingClass}`}
            style={{ fontFamily: template.fontHeading, color: accentColor }}
            data-testid="text-venue-headline"
          >
            {headlineText}
          </h2>
        </div>

        {descText && (
          <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }} data-testid="text-venue-description">
            {descText}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {venueType && (
            <div className={`${template.borderRadius} border p-4`} data-testid="card-venue-type">
              <p className="text-xs text-muted-foreground">Venue Type</p>
              <p className="font-medium" style={{ fontFamily: template.fontHeading }}>{venueType}</p>
            </div>
          )}
          {capacity && (
            <div className={`${template.borderRadius} border p-4`} data-testid="card-venue-capacity">
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="font-medium" style={{ fontFamily: template.fontHeading }}>{capacity.toLocaleString()}</p>
            </div>
          )}
          {mediaEligible !== undefined && (
            <div className={`${template.borderRadius} border p-4`} data-testid="card-venue-media">
              <p className="text-xs text-muted-foreground">Hub Media Network</p>
              <p className="font-medium" style={{ fontFamily: template.fontHeading }}>
                {mediaEligible ? "Eligible" : "Not Enrolled"}
              </p>
            </div>
          )}
        </div>

        {features.length > 0 && (
          <div className="space-y-4" data-testid="venue-features">
            <h3 className="text-lg font-medium" style={{ fontFamily: template.fontHeading }}>
              {locale === "es" ? "Características" : "Venue Features"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {features.map((f, i) => (
                <div
                  key={i}
                  className={`${template.borderRadius} border p-3 flex items-center justify-between`}
                  data-testid={`card-venue-feature-${i}`}
                >
                  <span className="text-sm font-medium">{f.label}</span>
                  {f.value && <span className="text-sm text-muted-foreground">{f.value}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {features.length === 0 && !descText && !venueType && !capacity && (
          <p className="text-muted-foreground italic">No venue details added yet.</p>
        )}
      </div>
    </section>
  );
}
