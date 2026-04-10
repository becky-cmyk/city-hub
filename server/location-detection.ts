import { db } from "./db";
import { zones, regions, hubZipCoverage, cities } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

export interface LocationMatch {
  type: "zone" | "hub" | "county" | "zip" | "city";
  id: string;
  slug: string;
  name: string;
  zoneType?: string;
  regionType?: string;
  hubZips?: string[];
}

export interface LocationDetectionResult {
  topicTerms: string;
  locationMatch: LocationMatch | null;
}

interface CachedLocationData {
  zones: { id: string; name: string; slug: string; type: string; zipCodes: string[] | null }[];
  hubs: { id: string; name: string; code: string | null; zips: string[] }[];
  counties: { id: string; name: string; code: string | null }[];
  cityName: string;
  citySlug: string;
  timestamp: number;
}

const locationCache = new Map<string, CachedLocationData>();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function loadLocationData(cityId: string): Promise<CachedLocationData> {
  const cached = locationCache.get(cityId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }

  const [cityRows, zoneRows] = await Promise.all([
    db.select({ name: cities.name, slug: cities.slug }).from(cities).where(eq(cities.id, cityId)).limit(1),
    db.select({
      id: zones.id,
      name: zones.name,
      slug: zones.slug,
      type: zones.type,
      zipCodes: zones.zipCodes,
    }).from(zones).where(and(eq(zones.cityId, cityId), eq(zones.isActive, true))).orderBy(asc(zones.name)),
  ]);

  const cityZips = new Set<string>();
  for (const z of zoneRows) {
    if (z.zipCodes) {
      for (const zip of z.zipCodes) cityZips.add(zip);
    }
  }

  const [allHubRows, allCountyRows] = await Promise.all([
    db.select({
      id: regions.id,
      name: regions.name,
      code: regions.code,
    }).from(regions).where(eq(regions.regionType, "hub")),
    db.select({
      id: regions.id,
      name: regions.name,
      code: regions.code,
    }).from(regions).where(eq(regions.regionType, "county")),
  ]);

  const hubsWithZips: CachedLocationData["hubs"] = [];
  for (const hub of allHubRows) {
    const coverageRows = await db.select({ zip: hubZipCoverage.zip })
      .from(hubZipCoverage)
      .where(eq(hubZipCoverage.hubRegionId, hub.id));
    const hubZips = coverageRows.map(r => r.zip);
    const overlaps = hubZips.some(z => cityZips.has(z));
    if (overlaps || cityZips.size === 0) {
      hubsWithZips.push({
        id: hub.id,
        name: hub.name,
        code: hub.code,
        zips: hubZips,
      });
    }
  }

  const data: CachedLocationData = {
    zones: zoneRows.map(z => ({
      id: z.id,
      name: z.name,
      slug: z.slug,
      type: z.type,
      zipCodes: z.zipCodes,
    })),
    hubs: hubsWithZips,
    counties: allCountyRows.map(c => ({
      id: c.id,
      name: c.name,
      code: c.code,
    })),
    cityName: cityRows[0]?.name || "",
    citySlug: cityRows[0]?.slug || "",
    timestamp: Date.now(),
  };

  locationCache.set(cityId, data);
  return data;
}

const ZIP_PATTERN = /\b(\d{5})\b/;

export async function detectLocation(query: string, cityId: string): Promise<LocationDetectionResult> {
  if (!query || !query.trim()) {
    return { topicTerms: query, locationMatch: null };
  }

  const data = await loadLocationData(cityId);
  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();

  const zipMatch = trimmed.match(ZIP_PATTERN);
  if (zipMatch) {
    const zip = zipMatch[1];
    const topicTerms = trimmed.replace(ZIP_PATTERN, "").replace(/\s+/g, " ").trim();

    const matchingZone = data.zones.find(z =>
      z.type === "ZIP" && z.zipCodes && z.zipCodes.includes(zip)
    );
    if (matchingZone) {
      return {
        topicTerms,
        locationMatch: {
          type: "zone",
          id: matchingZone.id,
          slug: matchingZone.slug,
          name: matchingZone.name,
          zoneType: matchingZone.type,
        },
      };
    }

    const matchingHub = data.hubs.find(h => h.zips.includes(zip));
    if (matchingHub) {
      return {
        topicTerms,
        locationMatch: {
          type: "hub",
          id: matchingHub.id,
          slug: matchingHub.code || matchingHub.name.toLowerCase().replace(/\s+/g, "-"),
          name: matchingHub.name,
          regionType: "hub",
          hubZips: matchingHub.zips,
        },
      };
    }

    const anyZoneWithZip = data.zones.find(z =>
      z.zipCodes && z.zipCodes.includes(zip)
    );
    if (anyZoneWithZip) {
      return {
        topicTerms,
        locationMatch: {
          type: "zone",
          id: anyZoneWithZip.id,
          slug: anyZoneWithZip.slug,
          name: anyZoneWithZip.name,
          zoneType: anyZoneWithZip.type,
        },
      };
    }

    return {
      topicTerms,
      locationMatch: {
        type: "zip",
        id: zip,
        slug: zip,
        name: `ZIP ${zip}`,
      },
    };
  }

  const sortedZones = [...data.zones].sort((a, b) => b.name.length - a.name.length);

  for (const zone of sortedZones) {
    const zoneLower = zone.name.toLowerCase();
    const idx = lowerQuery.indexOf(zoneLower);
    if (idx !== -1) {
      const before = idx > 0 ? lowerQuery[idx - 1] : " ";
      const after = idx + zoneLower.length < lowerQuery.length ? lowerQuery[idx + zoneLower.length] : " ";
      if (/[\s,]/.test(before) || idx === 0) {
        if (/[\s,]/.test(after) || idx + zoneLower.length === lowerQuery.length) {
          const topicTerms = (trimmed.substring(0, idx) + trimmed.substring(idx + zoneLower.length))
            .replace(/\s+/g, " ").trim();
          return {
            topicTerms,
            locationMatch: {
              type: "zone",
              id: zone.id,
              slug: zone.slug,
              name: zone.name,
              zoneType: zone.type,
            },
          };
        }
      }
    }

    const slugLower = zone.slug.toLowerCase();
    if (slugLower !== zoneLower) {
      const slugIdx = lowerQuery.indexOf(slugLower);
      if (slugIdx !== -1) {
        const before = slugIdx > 0 ? lowerQuery[slugIdx - 1] : " ";
        const after = slugIdx + slugLower.length < lowerQuery.length ? lowerQuery[slugIdx + slugLower.length] : " ";
        if (/[\s,]/.test(before) || slugIdx === 0) {
          if (/[\s,]/.test(after) || slugIdx + slugLower.length === lowerQuery.length) {
            const topicTerms = (trimmed.substring(0, slugIdx) + trimmed.substring(slugIdx + slugLower.length))
              .replace(/\s+/g, " ").trim();
            return {
              topicTerms,
              locationMatch: {
                type: "zone",
                id: zone.id,
                slug: zone.slug,
                name: zone.name,
                zoneType: zone.type,
              },
            };
          }
        }
      }
    }
  }

  const sortedHubs = [...data.hubs].sort((a, b) => b.name.length - a.name.length);

  for (const hub of sortedHubs) {
    const hubLower = hub.name.toLowerCase();
    const idx = lowerQuery.indexOf(hubLower);
    if (idx !== -1) {
      const before = idx > 0 ? lowerQuery[idx - 1] : " ";
      const after = idx + hubLower.length < lowerQuery.length ? lowerQuery[idx + hubLower.length] : " ";
      if (/[\s,]/.test(before) || idx === 0) {
        if (/[\s,]/.test(after) || idx + hubLower.length === lowerQuery.length) {
          const topicTerms = (trimmed.substring(0, idx) + trimmed.substring(idx + hubLower.length))
            .replace(/\s+/g, " ").trim();
          return {
            topicTerms,
            locationMatch: {
              type: "hub",
              id: hub.id,
              slug: hub.code || hub.name.toLowerCase().replace(/\s+/g, "-"),
              name: hub.name,
              regionType: "hub",
              hubZips: hub.zips,
            },
          };
        }
      }
    }

    if (hub.code) {
      const codeLower = hub.code.toLowerCase();
      const codeIdx = lowerQuery.indexOf(codeLower);
      if (codeIdx !== -1) {
        const before = codeIdx > 0 ? lowerQuery[codeIdx - 1] : " ";
        const after = codeIdx + codeLower.length < lowerQuery.length ? lowerQuery[codeIdx + codeLower.length] : " ";
        if (/[\s,]/.test(before) || codeIdx === 0) {
          if (/[\s,]/.test(after) || codeIdx + codeLower.length === lowerQuery.length) {
            const topicTerms = (trimmed.substring(0, codeIdx) + trimmed.substring(codeIdx + codeLower.length))
              .replace(/\s+/g, " ").trim();
            return {
              topicTerms,
              locationMatch: {
                type: "hub",
                id: hub.id,
                slug: hub.code || hub.name.toLowerCase().replace(/\s+/g, "-"),
                name: hub.name,
                regionType: "hub",
                hubZips: hub.zips,
              },
            };
          }
        }
      }
    }
  }

  const sortedCounties = [...data.counties].sort((a, b) => b.name.length - a.name.length);

  for (const county of sortedCounties) {
    const countyLower = county.name.toLowerCase();
    const idx = lowerQuery.indexOf(countyLower);
    if (idx !== -1) {
      const before = idx > 0 ? lowerQuery[idx - 1] : " ";
      const after = idx + countyLower.length < lowerQuery.length ? lowerQuery[idx + countyLower.length] : " ";
      if (/[\s,]/.test(before) || idx === 0) {
        if (/[\s,]/.test(after) || idx + countyLower.length === lowerQuery.length) {
          const topicTerms = (trimmed.substring(0, idx) + trimmed.substring(idx + countyLower.length))
            .replace(/\s+/g, " ").trim();
          return {
            topicTerms,
            locationMatch: {
              type: "county",
              id: county.id,
              slug: county.code || county.name.toLowerCase().replace(/\s+/g, "-"),
              name: county.name,
              regionType: "county",
            },
          };
        }
      }
    }

    if (county.code) {
      const codeLower = county.code.toLowerCase();
      const codeIdx = lowerQuery.indexOf(codeLower);
      if (codeIdx !== -1 && codeLower.length >= 3) {
        const before = codeIdx > 0 ? lowerQuery[codeIdx - 1] : " ";
        const after = codeIdx + codeLower.length < lowerQuery.length ? lowerQuery[codeIdx + codeLower.length] : " ";
        if (/[\s,]/.test(before) || codeIdx === 0) {
          if (/[\s,]/.test(after) || codeIdx + codeLower.length === lowerQuery.length) {
            const topicTerms = (trimmed.substring(0, codeIdx) + trimmed.substring(codeIdx + codeLower.length))
              .replace(/\s+/g, " ").trim();
            return {
              topicTerms,
              locationMatch: {
                type: "county",
                id: county.id,
                slug: county.code || county.name.toLowerCase().replace(/\s+/g, "-"),
                name: county.name,
                regionType: "county",
              },
            };
          }
        }
      }
    }
  }

  if (data.cityName && lowerQuery.includes(data.cityName.toLowerCase())) {
    const cityLower = data.cityName.toLowerCase();
    const idx = lowerQuery.indexOf(cityLower);
    const topicTerms = (trimmed.substring(0, idx) + trimmed.substring(idx + cityLower.length))
      .replace(/\s+/g, " ").trim();
    return {
      topicTerms,
      locationMatch: {
        type: "city",
        id: cityId,
        slug: data.citySlug,
        name: data.cityName,
      },
    };
  }

  return { topicTerms: trimmed, locationMatch: null };
}

export function clearLocationCache(cityId?: string): void {
  if (cityId) {
    locationCache.delete(cityId);
  } else {
    locationCache.clear();
  }
}
