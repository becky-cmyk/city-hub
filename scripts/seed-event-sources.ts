import { db } from "../server/db";
import { cities, metroSources } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const EVENT_SOURCES = [
  {
    name: "UNC Charlotte Events",
    sourceType: "ICAL" as const,
    baseUrl: "https://campusevents.charlotte.edu/calendar.ics",
    enabled: false,
    pullFrequency: "DAILY" as const,
    paramsJson: { content_type: "event" },
  },
  {
    name: "Blumenthal Performing Arts",
    sourceType: "RSS" as const,
    baseUrl: "https://www.blumenthalarts.org/events/rss",
    enabled: true,
    pullFrequency: "DAILY" as const,
    paramsJson: { content_type: "event" },
    isEventSource: true,
  },
  {
    name: "Charlotte City Council (Legistar)",
    sourceType: "ICAL" as const,
    baseUrl: "https://charlottenc.legistar.com/Feed.ashx?M=Calendar&ID=18273993&GUID=0989dfa8-cb5e-4f31-8640-3e6fbe37d626",
    enabled: true,
    pullFrequency: "DAILY" as const,
    paramsJson: { content_type: "event" },
  },
];

async function seedEventSources() {
  console.log("[SEED-EVENTS] Starting event sources seed...");

  const existingCities = await db.select().from(cities);
  const charlotteCity = existingCities.find((c) => c.slug === "charlotte");

  if (!charlotteCity) {
    console.error("[SEED-EVENTS] Charlotte city not found! Run main seed first.");
    process.exit(1);
  }

  console.log(`[SEED-EVENTS] Charlotte city ID: ${charlotteCity.id}`);

  for (const src of EVENT_SOURCES) {
    const existing = await db
      .select()
      .from(metroSources)
      .where(and(eq(metroSources.cityId, charlotteCity.id), eq(metroSources.baseUrl, src.baseUrl)));

    if (existing.length > 0) {
      const updates: Record<string, unknown> = {};
      if (!src.enabled && existing[0].enabled) updates.enabled = false;
      if (src.isEventSource && !existing[0].isEventSource) updates.isEventSource = true;
      if (Object.keys(updates).length > 0) {
        await db.update(metroSources).set(updates).where(eq(metroSources.id, existing[0].id));
        console.log(`[SEED-EVENTS] Updated: ${src.name} (${Object.keys(updates).join(", ")})`);
      } else {
        console.log(`[SEED-EVENTS] Already exists: ${src.name}`);
      }
      continue;
    }

    const [created] = await db
      .insert(metroSources)
      .values({
        cityId: charlotteCity.id,
        name: src.name,
        sourceType: src.sourceType,
        baseUrl: src.baseUrl,
        enabled: src.enabled,
        pullFrequency: src.pullFrequency,
        paramsJson: src.paramsJson,
        isEventSource: src.isEventSource || false,
      })
      .returning();

    console.log(`[SEED-EVENTS] Created: ${created.name} (${created.id}) type=${src.sourceType} enabled=${created.enabled}`);
  }

  console.log("[SEED-EVENTS] Done.");
  process.exit(0);
}

seedEventSources().catch((err) => {
  console.error("[SEED-EVENTS] Error:", err);
  process.exit(1);
});
