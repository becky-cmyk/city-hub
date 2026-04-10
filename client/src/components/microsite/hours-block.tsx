import { Clock } from "lucide-react";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";

interface HoursBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  hoursOfOperation?: Record<string, string>;
  address?: string;
}

const DAY_LABELS: Record<string, { en: string; es: string }> = {
  monday: { en: "Monday", es: "Lunes" },
  tuesday: { en: "Tuesday", es: "Martes" },
  wednesday: { en: "Wednesday", es: "Miércoles" },
  thursday: { en: "Thursday", es: "Jueves" },
  friday: { en: "Friday", es: "Viernes" },
  saturday: { en: "Saturday", es: "Sábado" },
  sunday: { en: "Sunday", es: "Domingo" },
};

export function HoursBlock({ block, template, accentColor, locale, hoursOfOperation, address }: HoursBlockProps) {
  const { headline } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Horario y Ubicación" : "Hours & Location");
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;
  const hours = hoursOfOperation || {};
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  if (Object.keys(hours).length === 0 && !address) return null;

  return (
    <section id="hours" className={`${template.sectionSpacing} px-6 md:px-8 bg-muted/30`} data-testid="block-hours">
      <div className="max-w-3xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-hours-headline"
        >
          {headlineText}
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {Object.keys(hours).length > 0 && (
            <div className="space-y-3" data-testid="list-hours">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5" style={{ color: accentColor }} />
                <span className="font-semibold" style={{ fontFamily: template.fontHeading }}>
                  {locale === "es" ? "Horario Comercial" : "Business Hours"}
                </span>
              </div>
              {dayOrder.map((day) => {
                const value = hours[day];
                if (!value) return null;
                const isToday = day === today;
                const dayLabel = DAY_LABELS[day]?.[locale] || day;
                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between gap-4 py-2 px-3 ${template.borderRadius} ${isToday ? "bg-muted" : ""}`}
                    data-testid={`hours-${day}`}
                  >
                    <span className={`text-sm ${isToday ? "font-semibold" : ""}`}>
                      {dayLabel}
                      {isToday && <span className="ml-2 text-xs text-muted-foreground">({locale === "es" ? "Hoy" : "Today"})</span>}
                    </span>
                    <span className={`text-sm ${value.toLowerCase() === "closed" ? "text-muted-foreground" : ""}`}>
                      {value.toLowerCase() === "closed" ? (locale === "es" ? "Cerrado" : "Closed") : value}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {address && (
            <div className="space-y-3" data-testid="info-address">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-semibold" style={{ fontFamily: template.fontHeading }}>
                  {locale === "es" ? "Ubicación" : "Location"}
                </span>
              </div>
              <p className="text-muted-foreground" style={{ fontFamily: template.fontBody }}>
                {address}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
