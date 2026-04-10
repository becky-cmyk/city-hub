import { Card } from "@/components/ui/card";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";

interface TeamBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
}

export function TeamBlock({ block, template, accentColor, locale }: TeamBlockProps) {
  const { headline, items } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Conozca Nuestro Equipo" : "Meet Our Team");
  const teamMembers = items || [];
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  if (teamMembers.length === 0) return null;

  return (
    <section id="team" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-team">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-team-headline"
        >
          {headlineText}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map((member: any, i: number) => {
            const memberName = t(member.name, locale) || "";
            const memberRole = t(member.role, locale);
            const memberBio = t(member.bio, locale);
            return (
              <Card key={i} className={`${template.cardStyle} p-6 text-center space-y-4`} data-testid={`card-team-${i}`}>
                <div
                  className="h-20 w-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white overflow-hidden"
                  style={{ backgroundColor: accentColor }}
                >
                  {member.image ? (
                    <img src={member.image} alt={memberName} className="w-full h-full object-cover" />
                  ) : (
                    (memberName || "?")[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="font-semibold" style={{ fontFamily: template.fontHeading }}>
                    {memberName}
                  </h3>
                  {memberRole && (
                    <p className="text-sm text-muted-foreground">{memberRole}</p>
                  )}
                </div>
                {memberBio && (
                  <p className="text-sm text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }}>
                    {memberBio}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
