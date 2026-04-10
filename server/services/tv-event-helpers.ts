import { db } from "../db";
import { events, cities, zones } from "@shared/schema";
import { eq, and, gte, lte, asc, sql } from "drizzle-orm";

export interface TvEventItem {
  title: string;
  startTime: string;
  dayLabel?: string;
  locationName: string;
  tag?: string;
  isFeatured?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

async function resolveCityId(metroSlug: string): Promise<string | null> {
  const [city] = await db.select().from(cities).where(eq(cities.slug, metroSlug)).limit(1);
  return city?.id || null;
}

async function resolveZoneId(cityId: string, hubSlug: string): Promise<string | null> {
  const [zone] = await db
    .select()
    .from(zones)
    .where(and(eq(zones.cityId, cityId), eq(zones.slug, hubSlug)))
    .limit(1);
  return zone?.id || null;
}

function mapEventToTvItem(evt: any, includeDayLabel = false): TvEventItem {
  const startDate = new Date(evt.startDateTime);
  return {
    title: evt.title,
    startTime: formatTime(startDate),
    ...(includeDayLabel ? { dayLabel: getDayLabel(startDate) } : {}),
    locationName: evt.locationName || "",
    tag: evt.isFeatured ? "Featured" : undefined,
    isFeatured: evt.isFeatured || false,
  };
}

export async function getTonightEvents(
  metroSlug: string,
  hubSlug?: string,
  locationSlug?: string
): Promise<TvEventItem[]> {
  const cityId = await resolveCityId(metroSlug);
  if (!cityId) return [];

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const baseConditions = [
    eq(events.cityId, cityId),
    gte(events.startDateTime, startOfDay),
    lte(events.startDateTime, endOfDay),
    sql`COALESCE(${events.endDateTime}, ${events.startDateTime} + interval '3 hours') > ${now}`,
  ];

  if (hubSlug) {
    const zoneId = await resolveZoneId(cityId, hubSlug);
    if (zoneId) {
      const hubResults = await db
        .select()
        .from(events)
        .where(and(...baseConditions, eq(events.zoneId, zoneId)))
        .orderBy(asc(events.startDateTime))
        .limit(3);

      if (hubResults.length > 0) {
        return hubResults.map((e) => mapEventToTvItem(e));
      }
    }
  }

  const metroResults = await db
    .select()
    .from(events)
    .where(and(...baseConditions))
    .orderBy(asc(events.startDateTime))
    .limit(3);

  return metroResults.map((e) => mapEventToTvItem(e));
}

export async function getWeekendEvents(
  metroSlug: string,
  hubSlug?: string,
  locationSlug?: string
): Promise<TvEventItem[]> {
  const cityId = await resolveCityId(metroSlug);
  if (!cityId) return [];

  const now = new Date();
  const dayOfWeek = now.getDay();

  const friday = new Date(now);
  if (dayOfWeek <= 5) {
    friday.setDate(now.getDate() + (5 - dayOfWeek));
  } else {
    friday.setDate(now.getDate());
  }
  friday.setHours(17, 0, 0, 0);

  if (dayOfWeek === 6) {
    friday.setDate(now.getDate() - 1);
    friday.setHours(17, 0, 0, 0);
  }
  if (dayOfWeek === 0) {
    friday.setDate(now.getDate() - 2);
    friday.setHours(17, 0, 0, 0);
  }

  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  sunday.setHours(23, 59, 59, 999);

  const rangeStart = now > friday ? now : friday;

  const baseConditions = [
    eq(events.cityId, cityId),
    gte(events.startDateTime, rangeStart),
    lte(events.startDateTime, sunday),
    sql`COALESCE(${events.endDateTime}, ${events.startDateTime} + interval '3 hours') > ${now}`,
  ];

  if (hubSlug) {
    const zoneId = await resolveZoneId(cityId, hubSlug);
    if (zoneId) {
      const hubResults = await db
        .select()
        .from(events)
        .where(and(...baseConditions, eq(events.zoneId, zoneId)))
        .orderBy(asc(events.startDateTime))
        .limit(4);

      if (hubResults.length > 0) {
        return hubResults.map((e) => mapEventToTvItem(e, true));
      }
    }
  }

  const metroResults = await db
    .select()
    .from(events)
    .where(and(...baseConditions))
    .orderBy(asc(events.startDateTime))
    .limit(4);

  return metroResults.map((e) => mapEventToTvItem(e, true));
}
