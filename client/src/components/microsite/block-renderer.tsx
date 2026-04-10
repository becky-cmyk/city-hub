import type { MicrositeBlock, MicrositeBlockType, BilingualText } from "@shared/schema";
import { getTemplateStyle, getTemplateVars } from "./templates";
import type { TemplateStyle } from "./templates";
import { HeroBlock } from "./hero-block";
import { AboutBlock } from "./about-block";
import { ServicesBlock } from "./services-block";
import { GalleryBlock } from "./gallery-block";
import { TestimonialsBlock } from "./testimonials-block";
import { CtaBlock } from "./cta-block";
import { FaqBlock } from "./faq-block";
import { TeamBlock } from "./team-block";
import { HoursBlock } from "./hours-block";
import { EventsBlock } from "./events-block";
import { ReviewsBlock } from "./reviews-block";
import { ContactBlock } from "./contact-block";
import { PodcastBlock } from "./podcast-block";
import { CreatorBlock } from "./creator-block";
import { ContributorBlock } from "./contributor-block";
import { ExpertBlock } from "./expert-block";
import { SpeakerBlock } from "./speaker-block";
import { VenueInfoBlock } from "./venue-info-block";
import { VolunteerOpportunitiesBlock } from "./volunteer-opportunities-block";
import { WishlistBlock } from "./wishlist-block";
import { createContext, useContext } from "react";

export type Locale = "en" | "es";

const LocaleContext = createContext<Locale>("en");
export const useLocale = () => useContext(LocaleContext);

export function t(value: BilingualText | string | undefined | null, locale: Locale = "en"): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && ("en" in value || "es" in value)) {
    return (value as BilingualText)[locale] || (value as BilingualText).en || "";
  }
  return String(value);
}

export interface BlockRendererContext {
  businessName: string;
  coverImage?: string | null;
  galleryImages?: string[];
  hoursOfOperation?: Record<string, string>;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  menuUrl?: string | null;
  orderingLinks?: Record<string, string> | null;
  reservationUrl?: string | null;
  businessId?: string | null;
  events?: { id: string; title: string; slug: string; startDateTime: string; endDateTime?: string | null; locationName?: string; visibility?: string }[];
  reviews?: { id: string; rating: number; text: string; displayName: string; source: string; createdAt: string }[];
  googleRating?: string;
  googleReviewCount?: number;
  citySlug?: string;
  businessSlug?: string;
  latitude?: number | null;
  longitude?: number | null;
  volunteerOpportunities?: any[];
  wishlistItems?: any[];
  businessFaqs?: { id: string; question: string; answer: string; sortOrder: number }[];
}

interface BlockRendererProps {
  blocks: MicrositeBlock[];
  template: string;
  accentColor: string;
  context: BlockRendererContext;
  locale?: Locale;
}

function renderBlock(
  block: MicrositeBlock,
  templateStyle: TemplateStyle,
  accentColor: string,
  context: BlockRendererContext,
  locale: Locale,
) {
  const common = { block, template: templateStyle, accentColor, locale };

  switch (block.type as MicrositeBlockType) {
    case "hero":
      return <HeroBlock {...common} businessName={context.businessName} coverImage={context.coverImage} galleryImages={context.galleryImages} />;
    case "about":
      return <AboutBlock {...common} />;
    case "services":
      return <ServicesBlock {...common} />;
    case "gallery":
      return <GalleryBlock {...common} galleryImages={context.galleryImages} />;
    case "testimonials":
      return <TestimonialsBlock {...common} />;
    case "cta":
      return <CtaBlock {...common} />;
    case "faq":
      return <FaqBlock {...common} businessFaqs={context.businessFaqs} businessName={context.businessName} />;
    case "team":
      return <TeamBlock {...common} />;
    case "hours":
      return <HoursBlock {...common} hoursOfOperation={context.hoursOfOperation} address={context.address || undefined} />;
    case "events":
      return <EventsBlock {...common} events={context.events} citySlug={context.citySlug} />;
    case "reviews":
      return <ReviewsBlock {...common} reviews={context.reviews} googleRating={context.googleRating} googleReviewCount={context.googleReviewCount} citySlug={context.citySlug} businessSlug={context.businessSlug} />;
    case "contact":
      return <ContactBlock {...common} phone={context.phone} email={context.email} website={context.website} address={context.address} menuUrl={context.menuUrl} orderingLinks={context.orderingLinks} reservationUrl={context.reservationUrl} businessId={context.businessId} citySlug={context.citySlug} businessSlug={context.businessSlug} latitude={context.latitude} longitude={context.longitude} businessName={context.businessName} />;
    case "podcast":
      return <PodcastBlock {...common} />;
    case "creator":
      return <CreatorBlock {...common} />;
    case "contributor":
      return <ContributorBlock {...common} />;
    case "expert":
      return <ExpertBlock {...common} />;
    case "speaker":
      return <SpeakerBlock {...common} />;
    case "venue_info":
      return <VenueInfoBlock {...common} />;
    case "volunteer_opportunities":
      return <VolunteerOpportunitiesBlock {...common} volunteerOpportunities={context.volunteerOpportunities} />;
    case "wishlist":
      return <WishlistBlock {...common} wishlistItems={context.wishlistItems} />;
    default:
      return null;
  }
}

export function BlockRenderer({ blocks, template, accentColor, context, locale = "en" }: BlockRendererProps) {
  const templateStyle = getTemplateStyle(template);
  const templateVars = getTemplateVars(template, accentColor);

  const enabledBlocks = blocks
    .filter((b) => b.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <LocaleContext.Provider value={locale}>
      <div style={templateVars} data-testid="microsite-block-renderer">
        {enabledBlocks.map((block) => (
          <div key={block.id} data-block-id={block.id} data-block-type={block.type}>
            {renderBlock(block, templateStyle, accentColor, context, locale)}
          </div>
        ))}
      </div>
    </LocaleContext.Provider>
  );
}
