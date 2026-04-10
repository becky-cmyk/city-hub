import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Globe, CalendarCheck, UtensilsCrossed, Menu as MenuIcon, Car } from "lucide-react";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { trackLeadEvent } from "@/lib/lead-tracking";
import { trackIntelligenceEvent } from "@/lib/intelligence-tracker";
import { usePlatformAffiliates } from "@/hooks/use-platform-affiliates";
import { buildUberRideLink, buildLyftRideLink, wrapAffiliateLink, getAffiliateId } from "@/lib/affiliate-links";

interface ContactBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  menuUrl?: string | null;
  orderingLinks?: Record<string, string> | null;
  reservationUrl?: string | null;
  businessId?: string | null;
  citySlug?: string | null;
  businessSlug?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  businessName?: string | null;
}

export function ContactBlock({ block, template, accentColor, locale, phone, email, website, address, menuUrl, orderingLinks, reservationUrl, businessId, citySlug, businessSlug, latitude, longitude, businessName }: ContactBlockProps) {
  const { headline } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Contáctenos" : "Contact Us");
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;
  const { data: affiliateConfigs } = usePlatformAffiliates();

  const trackLead = (eventType: Parameters<typeof trackLeadEvent>[2]) => {
    if (citySlug && businessSlug) trackLeadEvent(citySlug, businessSlug, eventType);
  };
  const trackIntel = (eventType: string, metadata?: Record<string, string>) => {
    if (citySlug && businessId) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: businessId, eventType: eventType as any, metadata });
  };

  const contactItems = [
    { icon: MapPin, label: address, href: address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null, onClick: () => { trackLead("CLICK_DIRECTIONS"); trackIntel("DIRECTIONS_CLICK"); } },
    { icon: Phone, label: phone, href: phone ? `tel:${phone}` : null, onClick: () => { trackLead("CLICK_CALL"); trackIntel("CALL_CLICK"); } },
    { icon: Mail, label: email, href: email ? `mailto:${email}` : null, onClick: undefined },
    { icon: Globe, label: website?.replace(/^https?:\/\//, ""), href: website, onClick: () => { trackLead("CLICK_WEBSITE"); trackIntel("WEBSITE_CLICK"); } },
  ].filter((item) => item.label);

  const platformLabels: Record<string, string> = { doordash: "DoorDash", ubereats: "Uber Eats", postmates: "Postmates", grubhub: "Grubhub" };
  const orderEntries = orderingLinks ? Object.entries(orderingLinks).filter(([, url]) => url) : [];
  const hasRideLinks = latitude && longitude;

  if (contactItems.length === 0 && !reservationUrl && !menuUrl && orderEntries.length === 0 && !hasRideLinks) return null;

  return (
    <section id="contact" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-contact">
      <div className="max-w-3xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-contact-headline"
        >
          {headlineText}
        </h2>
        <Card className={`${template.cardStyle} p-8`}>
          {contactItems.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-6">
              {contactItems.map((item, i) => (
                <a
                  key={i}
                  href={item.href || "#"}
                  target={item.icon === Globe ? "_blank" : undefined}
                  rel={item.icon === Globe ? "noopener noreferrer" : undefined}
                  onClick={item.onClick}
                  className="flex items-start gap-3 group"
                  data-testid={`link-contact-${i}`}
                >
                  <item.icon className="h-5 w-5 mt-0.5 shrink-0" style={{ color: accentColor }} />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors" style={{ fontFamily: template.fontBody }}>
                    {item.label}
                  </span>
                </a>
              ))}
            </div>
          )}

          {(reservationUrl || menuUrl || orderEntries.length > 0 || hasRideLinks) && (
            <div className={`${contactItems.length > 0 ? "mt-6 pt-6 border-t" : ""} flex flex-wrap gap-3`}>
              {reservationUrl && (
                <a href={reservationUrl} target="_blank" rel="noopener noreferrer" onClick={() => { trackLead("CLICK_BOOKING"); trackIntel("BOOKING_CLICK"); }} data-testid="link-contact-reserve">
                  <Button size="sm" className="gap-2" style={{ backgroundColor: accentColor }}>
                    <CalendarCheck className="h-4 w-4" />
                    {locale === "es" ? "Reservar Mesa" : "Reserve Table"}
                  </Button>
                </a>
              )}
              {menuUrl && (
                <a href={menuUrl} target="_blank" rel="noopener noreferrer" onClick={() => { trackLead("CLICK_MENU"); trackIntel("MENU_CLICK"); }} data-testid="link-contact-menu">
                  <Button size="sm" variant="outline" className="gap-2">
                    <MenuIcon className="h-4 w-4" />
                    {locale === "es" ? "Ver Menú" : "View Menu"}
                  </Button>
                </a>
              )}
              {orderEntries.map(([platform, url]) => {
                const affiliatedUrl = wrapAffiliateLink(platform, url, getAffiliateId(affiliateConfigs || [], platform));
                return (
                  <a key={platform} href={affiliatedUrl} target="_blank" rel="noopener noreferrer" onClick={() => { trackLead("CLICK_ORDER"); trackIntel("ORDER_CLICK", { platform }); }} data-testid={`link-contact-order-${platform}`}>
                    <Button size="sm" variant="outline" className="gap-2">
                      <UtensilsCrossed className="h-4 w-4" />
                      {locale === "es" ? `Pedir en ${platformLabels[platform] || platform}` : `Order on ${platformLabels[platform] || platform}`}
                    </Button>
                  </a>
                );
              })}
              {hasRideLinks && (
                <>
                  <a
                    href={buildUberRideLink(latitude!, longitude!, businessName || "Destination", getAffiliateId(affiliateConfigs || [], "uber"))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { trackLead("CLICK_RIDE"); trackIntel("RIDE_CLICK", { platform: "uber" }); }}
                    data-testid="link-contact-ride-uber"
                  >
                    <Button size="sm" variant="outline" className="gap-2">
                      <Car className="h-4 w-4" /> Uber
                    </Button>
                  </a>
                  <a
                    href={buildLyftRideLink(latitude!, longitude!, getAffiliateId(affiliateConfigs || [], "lyft"))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { trackLead("CLICK_RIDE"); trackIntel("RIDE_CLICK", { platform: "lyft" }); }}
                    data-testid="link-contact-ride-lyft"
                  >
                    <Button size="sm" variant="outline" className="gap-2">
                      <Car className="h-4 w-4" /> Lyft
                    </Button>
                  </a>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
