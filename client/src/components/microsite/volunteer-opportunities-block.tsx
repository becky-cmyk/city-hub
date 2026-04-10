import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { Heart, MapPin, Clock, ArrowRight } from "lucide-react";

interface VolunteerOpportunitiesBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  volunteerOpportunities?: any[];
}

export function VolunteerOpportunitiesBlock({ block, template, accentColor, locale, volunteerOpportunities = [] }: VolunteerOpportunitiesBlockProps) {
  const { headline } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Oportunidades de Voluntariado" : "Volunteer Opportunities");
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  if (volunteerOpportunities.length === 0) return null;

  return (
    <section id="volunteer-opportunities" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-volunteer-opportunities">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl mb-8 ${headingClass}`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-volunteer-headline"
        >
          {headlineText}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {volunteerOpportunities.map((opp: any) => (
            <div
              key={opp.id}
              className="rounded-xl border border-border/50 bg-card p-5 hover:shadow-md transition-shadow"
              data-testid={`card-volunteer-${opp.id}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${accentColor}20` }}>
                  <Heart className="h-4 w-4" style={{ color: accentColor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base leading-tight" data-testid={`text-volunteer-title-${opp.id}`}>
                    {opp.title}
                  </h3>
                  {opp.employer && (
                    <p className="text-sm text-muted-foreground mt-0.5">{opp.employer}</p>
                  )}
                </div>
              </div>
              {opp.description && (
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{opp.description}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                {opp.location_text && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {opp.location_text}
                  </span>
                )}
                {opp.schedule_commitment && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {opp.schedule_commitment}
                  </span>
                )}
              </div>
              {opp.skills_helpful && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">Skills helpful:</span> {opp.skills_helpful}
                </p>
              )}
              {opp.contact_url && (
                <a
                  href={opp.contact_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-sm font-medium"
                  style={{ color: accentColor }}
                  data-testid={`link-volunteer-apply-${opp.id}`}
                >
                  Apply / Contact <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
