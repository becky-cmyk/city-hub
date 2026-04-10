import { db } from "./db";
import { revenuePrograms, adInventorySlots, territories } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_PROGRAMS = [
  {
    name: "Pulse Advertising",
    programType: "AD" as const,
    description: "Native advertising cards within the Pulse feed across hub or metro scope",
    billingCycle: "MONTHLY" as const,
    priceMode: "RANGE_PRICE" as const,
    minPriceCents: 5000,
    maxPriceCents: 50000,
    requiresExpandedListing: true,
    comingSoon: false,
  },
  {
    name: "Category Sponsorship",
    programType: "SPONSORSHIP" as const,
    description: "Exclusive sponsor position at the top of category and micro-category pages",
    billingCycle: "QUARTERLY" as const,
    priceMode: "CUSTOM_QUOTE" as const,
    requiresExpandedListing: true,
    comingSoon: false,
  },
  {
    name: "Event Promotion",
    programType: "PROMOTION" as const,
    description: "Featured placement in event listings and event detail pages",
    billingCycle: "ONE_TIME" as const,
    priceMode: "RANGE_PRICE" as const,
    minPriceCents: 2500,
    maxPriceCents: 20000,
    requiresExpandedListing: true,
    comingSoon: false,
  },
  {
    name: "Authority Position",
    programType: "AUTHORITY" as const,
    description: "Premium authority badge and top-of-category placement for recognized industry leaders",
    billingCycle: "QUARTERLY" as const,
    priceMode: "RANGE_PRICE" as const,
    minPriceCents: 15000,
    maxPriceCents: 75000,
    requiresExpandedListing: true,
    comingSoon: false,
  },
  {
    name: "Seasonal Guide Inclusion",
    programType: "GUIDE" as const,
    description: "Featured inclusion in seasonal and curated editorial guides",
    billingCycle: "ONE_TIME" as const,
    priceMode: "RANGE_PRICE" as const,
    minPriceCents: 10000,
    maxPriceCents: 50000,
    requiresExpandedListing: true,
    comingSoon: false,
  },
  {
    name: "Welcome Program Sponsor",
    programType: "WELCOME" as const,
    description: "Sponsor placement in new resident welcome packages and onboarding content",
    billingCycle: "ONE_TIME" as const,
    priceMode: "CUSTOM_QUOTE" as const,
    requiresExpandedListing: true,
    comingSoon: false,
  },
  {
    name: "Social Selling",
    programType: "SOCIAL_SELLING" as const,
    description: "Social commerce integration for direct product sales through hub channels",
    billingCycle: "MONTHLY" as const,
    priceMode: "RANGE_PRICE" as const,
    minPriceCents: 5000,
    maxPriceCents: 25000,
    requiresExpandedListing: true,
    comingSoon: true,
  },
];

const DEFAULT_SLOTS = [
  {
    slotName: "Pulse Feed Card",
    placementType: "CARD" as const,
    scopeType: "HUB_OR_METRO" as const,
    maxActivePlacements: 5,
    rotationStrategy: "ROUND_ROBIN" as const,
  },
  {
    slotName: "Category Header Sponsor",
    placementType: "FEATURED_BLOCK" as const,
    scopeType: "HUB_OR_METRO" as const,
    maxActivePlacements: 1,
    rotationStrategy: "NONE" as const,
  },
  {
    slotName: "Events Featured Slot",
    placementType: "FEATURED_BLOCK" as const,
    scopeType: "HUB_ONLY" as const,
    maxActivePlacements: 3,
    rotationStrategy: "ROUND_ROBIN" as const,
  },
  {
    slotName: "Neighborhood Hero Banner",
    placementType: "BANNER" as const,
    scopeType: "HUB_ONLY" as const,
    maxActivePlacements: 1,
    rotationStrategy: "NONE" as const,
  },
  {
    slotName: "Metro Homepage Sponsor",
    placementType: "BANNER" as const,
    scopeType: "METRO_ONLY" as const,
    maxActivePlacements: 2,
    rotationStrategy: "WEIGHTED" as const,
  },
  {
    slotName: "Metro Category Sponsor",
    placementType: "FEATURED_BLOCK" as const,
    scopeType: "METRO_ONLY" as const,
    maxActivePlacements: 1,
    rotationStrategy: "NONE" as const,
  },
];

export async function seedAdPrograms() {
  let programsCreated = 0;
  let programsSkipped = 0;

  const existing = await db.select().from(revenuePrograms);
  const existingNames = new Set(existing.map(p => p.name));

  for (const prog of DEFAULT_PROGRAMS) {
    if (existingNames.has(prog.name)) {
      programsSkipped++;
      continue;
    }
    await db.insert(revenuePrograms).values(prog);
    programsCreated++;
  }

  let slotsCreated = 0;
  let slotsSkipped = 0;

  const [metroTerritory] = await db
    .select()
    .from(territories)
    .where(eq(territories.code, "CLT_METRO"));
  const metroId = metroTerritory?.id || null;

  const existingSlots = await db.select().from(adInventorySlots);
  const existingSlotNames = new Set(existingSlots.map(s => s.slotName));

  for (const slot of DEFAULT_SLOTS) {
    if (existingSlotNames.has(slot.slotName)) {
      slotsSkipped++;
      continue;
    }
    await db.insert(adInventorySlots).values({
      ...slot,
      metroId,
    });
    slotsCreated++;
  }

  console.log(`[AdPrograms] Programs: ${programsCreated} created, ${programsSkipped} skipped. Slots: ${slotsCreated} created, ${slotsSkipped} skipped`);
}
