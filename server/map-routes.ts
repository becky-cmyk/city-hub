import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { db } from "./db";
import { storage } from "./storage";
import { eq } from "drizzle-orm";
import { mapPlacements } from "@shared/schema";
import { toFiniteCoord } from "./services/geocoding";

async function resolveCity(citySlug: string) {
  const CITY_SLUG_ALIASES: Record<string, string> = { clt: "charlotte" };
  const resolved = CITY_SLUG_ALIASES[citySlug] || citySlug;
  return storage.getCityBySlug(resolved);
}

export interface MapItem {
  type: string;
  id: string;
  slug: string;
  title: string;
  lat: number;
  lng: number;
  category?: string;
  categorySlug?: string;
  categorySlugs?: string[];
  categoryNames?: string[];
  presenceType?: string;
  marketplaceSubtype?: string;
  eventCategoryNames?: string[];
  zone?: string;
  zoneSlug?: string;
  imageUrl?: string;
  isFeatured: boolean;
  isVerified: boolean;
  isSponsored: boolean;
  isCrown: boolean;
  promotedPin: boolean;
  detailUrl: string;
  address?: string;
  description?: string;
}

export function registerMapRoutes(app: Express, requireAdmin: (req: Request, res: Response, next: Function) => void) {
  app.get("/api/cities/:citySlug/map", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const citySlug = req.params.citySlug;
      const now = new Date();
      const items: MapItem[] = [];

      const zoneCentroids = new Map<string, { lat: number; lng: number }>();
      try {
        const zoneCoords = await pool.query(
          `SELECT z.id AS zone_id, r.center_lat, r.center_lng
           FROM zones z
           INNER JOIN regions r ON LOWER(r.name) = LOWER(z.name) AND r.center_lat IS NOT NULL AND r.center_lng IS NOT NULL
           WHERE z.city_id = $1 AND z.is_active = true`,
          [city.id]
        );
        for (const zc of zoneCoords.rows) {
          zoneCentroids.set(zc.zone_id, {
            lat: parseFloat(zc.center_lat),
            lng: parseFloat(zc.center_lng),
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] zone centroid query failed:", (e as Error).message);
      }

      const promotedPinIds = new Set<string>();
      try {
        const promotedResult = await pool.query(
          `SELECT business_id FROM map_placements
           WHERE city_id = $1 AND type = 'promoted_pin' AND is_active = true
           AND (start_date IS NULL OR start_date <= $2)
           AND (end_date IS NULL OR end_date >= $2)`,
          [city.id, now]
        );
        promotedResult.rows.forEach((r: any) => {
          if (r.business_id) promotedPinIds.add(r.business_id);
        });
      } catch (e) {
        console.warn("[UNIFIED-MAP] promoted pins query failed:", (e as Error).message);
      }

      const crownBusinessIds = new Set<string>();
      try {
        const crownResult = await pool.query(
          `SELECT DISTINCT business_id FROM crown_participants
           WHERE city_id = $1 AND status IN ('confirmed', 'winner', 'finalist', 'candidate')
           AND business_id IS NOT NULL`,
          [city.id]
        );
        crownResult.rows.forEach((r: any) => {
          if (r.business_id) crownBusinessIds.add(r.business_id);
        });
      } catch (e) {
        console.warn("[UNIFIED-MAP] crown lookup query failed:", (e as Error).message);
      }

      try {
        const bizResult = await pool.query(
          `SELECT b.id, b.slug, b.name, b.latitude, b.longitude, b.image_url, b.is_featured, b.is_verified, b.is_sponsored, b.address, b.description, b.presence_type, b.creator_type,
                  z.name AS zone_name, z.slug AS zone_slug,
                  COALESCE(
                    (SELECT array_agg(c.slug) FROM categories c WHERE c.id = ANY(b.category_ids)),
                    ARRAY[]::text[]
                  ) AS category_slugs,
                  COALESCE(
                    (SELECT array_agg(c.name) FROM categories c WHERE c.id = ANY(b.category_ids)),
                    ARRAY[]::text[]
                  ) AS category_names
           FROM businesses b
           LEFT JOIN zones z ON z.id = b.zone_id
           WHERE b.city_id = $1 AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
           AND COALESCE(b.presence_status, 'ACTIVE') = 'ACTIVE'`,
          [city.id]
        );

        for (const b of bizResult.rows) {
          const isOrg = b.presence_type === 'organization';
          const isCreator = !!b.creator_type;
          const slugs: string[] = b.category_slugs || [];
          const names: string[] = b.category_names || [];
          items.push({
            type: isCreator ? 'creator' : isOrg ? 'organization' : 'business',
            id: b.id,
            slug: b.slug,
            title: b.name,
            lat: parseFloat(b.latitude),
            lng: parseFloat(b.longitude),
            category: names[0] || undefined,
            categorySlug: slugs[0] || undefined,
            categorySlugs: slugs,
            categoryNames: names,
            presenceType: b.presence_type || undefined,
            zone: b.zone_name,
            zoneSlug: b.zone_slug,
            imageUrl: b.image_url,
            isFeatured: b.is_featured,
            isVerified: b.is_verified,
            isSponsored: b.is_sponsored,
            isCrown: crownBusinessIds.has(b.id),
            promotedPin: promotedPinIds.has(b.id),
            detailUrl: `/${citySlug}/directory/${b.slug}`,
            address: b.address,
            description: b.description,
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] businesses query failed:", (e as Error).message);
      }

      try {
        const eventResult = await pool.query(
          `SELECT e.id, e.title, e.slug, e.image_url, e.is_featured, e.location_name,
                  e.latitude AS event_lat, e.longitude AS event_lng, e.zone_id AS event_zone_id,
                  b.latitude AS biz_lat, b.longitude AS biz_lng, b.name AS host_biz_name,
                  COALESCE(z2.name, z.name) AS zone_name, COALESCE(z2.slug, z.slug) AS zone_slug,
                  COALESCE(
                    (SELECT array_agg(c.name) FROM categories c WHERE c.id = ANY(e.category_ids)),
                    ARRAY[]::text[]
                  ) AS event_category_names,
                  COALESCE(
                    (SELECT array_agg(c.slug) FROM categories c WHERE c.id = ANY(e.category_ids)),
                    ARRAY[]::text[]
                  ) AS event_category_slugs
           FROM events e
           LEFT JOIN businesses b ON e.host_business_id = b.id
           LEFT JOIN zones z ON b.zone_id = z.id
           LEFT JOIN zones z2 ON e.zone_id = z2.id
           WHERE e.city_id = $1
           AND COALESCE(e.visibility, 'public') = 'public'
           AND COALESCE(e.end_date_time, e.start_date_time + interval '3 hours') > $2
           AND (e.latitude IS NOT NULL OR b.latitude IS NOT NULL)`,
          [city.id, now]
        );

        for (const ev of eventResult.rows) {
          const lat = toFiniteCoord(ev.event_lat) ?? toFiniteCoord(ev.biz_lat);
          const lng = toFiniteCoord(ev.event_lng) ?? toFiniteCoord(ev.biz_lng);
          if (lat === null || lng === null) continue;
          const catNames: string[] = ev.event_category_names || [];
          const catSlugs: string[] = ev.event_category_slugs || [];
          items.push({
            type: 'event',
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            lat,
            lng,
            zone: ev.zone_name,
            zoneSlug: ev.zone_slug,
            imageUrl: ev.image_url,
            isFeatured: ev.is_featured,
            isVerified: false,
            isSponsored: false,
            isCrown: false,
            promotedPin: false,
            detailUrl: `/${citySlug}/events/${ev.slug}`,
            address: ev.host_biz_name || ev.location_name,
            eventCategoryNames: catNames,
            categorySlugs: catSlugs,
            categoryNames: catNames,
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] events query failed:", (e as Error).message);
      }

      try {
        const attrResult = await pool.query(
          `SELECT a.id, a.slug, a.name, a.latitude, a.longitude, a.image_url, a.attraction_type AS attr_type, a.address,
                  z.name AS zone_name, z.slug AS zone_slug
           FROM attractions a
           LEFT JOIN zones z ON a.zone_id = z.id
           WHERE a.city_id = $1 AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
           LIMIT 200`,
          [city.id]
        );
        for (const a of attrResult.rows) {
          items.push({
            type: 'attraction',
            id: a.id,
            slug: a.slug,
            title: a.name,
            lat: parseFloat(a.latitude),
            lng: parseFloat(a.longitude),
            category: a.attr_type,
            zone: a.zone_name,
            zoneSlug: a.zone_slug,
            imageUrl: a.image_url,
            isFeatured: false,
            isVerified: false,
            isSponsored: false,
            isCrown: false,
            promotedPin: false,
            detailUrl: `/${citySlug}/attractions`,
            address: a.address,
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] attractions query failed:", (e as Error).message);
      }

      try {
        const jobResult = await pool.query(
          `SELECT j.id, j.title, j.slug, j.zone_id,
                  j.latitude AS job_lat, j.longitude AS job_lng,
                  b.latitude AS biz_lat, b.longitude AS biz_lng, b.name AS biz_name,
                  z.name AS zone_name, z.slug AS zone_slug
           FROM job_listings j
           LEFT JOIN businesses b ON j.business_id = b.id
           LEFT JOIN zones z ON j.zone_id = z.id
           WHERE j.city_id = $1 AND j.status = 'ACTIVE'`,
          [city.id]
        );
        for (const j of jobResult.rows) {
          let lat = toFiniteCoord(j.job_lat) ?? toFiniteCoord(j.biz_lat);
          let lng = toFiniteCoord(j.job_lng) ?? toFiniteCoord(j.biz_lng);
          if (lat === null || lng === null) {
            const zc = j.zone_id ? zoneCentroids.get(j.zone_id) : null;
            if (zc) {
              lat = zc.lat;
              lng = zc.lng;
            }
          }
          if (lat === null || lng === null) continue;
          items.push({
            type: 'job',
            id: j.id,
            slug: j.slug || j.id,
            title: j.title,
            lat,
            lng,
            zone: j.zone_name,
            zoneSlug: j.zone_slug,
            isFeatured: false,
            isVerified: false,
            isSponsored: false,
            isCrown: false,
            promotedPin: false,
            detailUrl: `/${citySlug}/jobs`,
            address: j.biz_name,
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] jobs query failed:", (e as Error).message);
      }

      try {
        const articleResult = await pool.query(
          `SELECT a.id, a.title, a.slug, a.latitude, a.longitude, a.zone_id,
                  a.image_url, a.excerpt,
                  z.name AS zone_name, z.slug AS zone_slug
           FROM articles a
           LEFT JOIN zones z ON a.zone_id = z.id
           WHERE a.city_id = $1 AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
           ORDER BY a.published_at DESC NULLS LAST
           LIMIT 200`,
          [city.id]
        );
        for (const a of articleResult.rows) {
          const lat = toFiniteCoord(a.latitude);
          const lng = toFiniteCoord(a.longitude);
          if (lat === null || lng === null) continue;
          items.push({
            type: 'article',
            id: a.id,
            slug: a.slug || a.id,
            title: a.title,
            lat,
            lng,
            zone: a.zone_name,
            zoneSlug: a.zone_slug,
            imageUrl: a.image_url,
            description: a.excerpt ? a.excerpt.substring(0, 120) : undefined,
            isVerified: false,
            isSponsored: false,
            isCrown: false,
            promotedPin: false,
            detailUrl: `/${citySlug}/stories/${a.slug || a.id}`,
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] articles query failed:", (e as Error).message);
      }

      try {
        const mktResult = await pool.query(
          `SELECT m.id, m.title, m.zone_id, m.type AS listing_type, m.category,
                  b.latitude, b.longitude,
                  z.name AS zone_name, z.slug AS zone_slug
           FROM marketplace_listings m
           LEFT JOIN businesses b ON b.id = COALESCE(m.posted_by_business_id, m.creator_business_id)
           LEFT JOIN zones z ON m.zone_id = z.id
           WHERE m.city_id = $1 AND m.status = 'ACTIVE'
           AND m.type IN ('HOUSING_SUPPLY', 'COMMERCIAL_PROPERTY')`,
          [city.id]
        );
        for (const m of mktResult.rows) {
          let lat = toFiniteCoord(m.latitude);
          let lng = toFiniteCoord(m.longitude);
          if (lat === null || lng === null) {
            const zc = m.zone_id ? zoneCentroids.get(m.zone_id) : null;
            if (zc) {
              lat = zc.lat;
              lng = zc.lng;
            }
          }
          if (lat === null || lng === null) continue;
          items.push({
            type: 'marketplace',
            id: m.id,
            slug: m.id,
            title: m.title,
            lat,
            lng,
            category: m.category || m.listing_type,
            categorySlug: m.listing_type,
            marketplaceSubtype: m.listing_type || undefined,
            zone: m.zone_name,
            zoneSlug: m.zone_slug,
            isFeatured: false,
            isVerified: false,
            isSponsored: false,
            isCrown: false,
            promotedPin: false,
            detailUrl: `/${citySlug}/marketplace/${m.id}`,
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] marketplace query failed:", (e as Error).message);
      }

      try {
        const crownResult = await pool.query(
          `SELECT cp.id, cp.name, cp.slug, cp.image_url, cp.status, cp.bio,
                  cp.business_id, cp.hub_id,
                  b.latitude, b.longitude, b.zone_id AS biz_zone_id,
                  cc.headline AS campaign_name,
                  z.name AS zone_name, z.slug AS zone_slug
           FROM crown_participants cp
           LEFT JOIN businesses b ON cp.business_id = b.id
           LEFT JOIN crown_categories ccat ON cp.category_id = ccat.id
           LEFT JOIN crown_campaigns cc ON cc.city_id = cp.city_id AND cc.status IN ('LAUNCHED', 'NOMINATIONS_OPEN', 'VOTING_OPEN', 'WINNERS_ANNOUNCED')
           LEFT JOIN zones z ON b.zone_id = z.id
           WHERE cp.city_id = $1
           AND cp.status IN ('confirmed', 'winner', 'finalist', 'candidate')
           LIMIT 200`,
          [city.id]
        );
        for (const cp of crownResult.rows) {
          let lat = toFiniteCoord(cp.latitude);
          let lng = toFiniteCoord(cp.longitude);
          if (lat === null || lng === null) {
            const zc = cp.biz_zone_id ? zoneCentroids.get(cp.biz_zone_id) : null;
            if (zc) {
              lat = zc.lat;
              lng = zc.lng;
            }
          }
          if (lat === null || lng === null) continue;
          items.push({
            type: 'crown',
            id: cp.id,
            slug: cp.slug,
            title: cp.name,
            lat,
            lng,
            zone: cp.zone_name,
            zoneSlug: cp.zone_slug,
            imageUrl: cp.image_url,
            isFeatured: cp.status === 'winner',
            isVerified: cp.status === 'confirmed' || cp.status === 'winner',
            isSponsored: false,
            isCrown: true,
            promotedPin: false,
            detailUrl: `/${citySlug}/vote`,
            description: cp.bio,
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] crown participants query failed:", (e as Error).message);
      }

      let placementRows: any[] = [];
      try {
        const placements = await pool.query(
          `SELECT mp.*, b.name AS business_name, b.microsite_logo AS biz_logo,
                  z.name AS zone_name, z.slug AS zone_slug,
                  r.center_lat AS zone_center_lat, r.center_lng AS zone_center_lng
           FROM map_placements mp
           LEFT JOIN businesses b ON mp.business_id = b.id
           LEFT JOIN zones z ON mp.zone_id = z.id
           LEFT JOIN regions r ON LOWER(r.name) = LOWER(z.name) AND r.center_lat IS NOT NULL
           WHERE mp.city_id = $1 AND mp.is_active = true
           AND (mp.start_date IS NULL OR mp.start_date <= $2)
           AND (mp.end_date IS NULL OR mp.end_date >= $2)`,
          [city.id, now]
        );
        placementRows = placements.rows;
      } catch (e) {
        console.warn("[UNIFIED-MAP] placements query failed:", (e as Error).message);
      }

      let zoneRows: any[] = [];
      try {
        const zones = await pool.query(
          `SELECT z.id, z.name, z.slug, r.center_lat, r.center_lng
           FROM zones z
           LEFT JOIN regions r ON LOWER(r.name) = LOWER(z.name) AND r.center_lat IS NOT NULL AND r.center_lng IS NOT NULL
           WHERE z.city_id = $1 AND z.is_active = true ORDER BY z.name`,
          [city.id]
        );
        zoneRows = zones.rows;
      } catch (e) {
        console.warn("[UNIFIED-MAP] zones query failed:", (e as Error).message);
      }

      let categoryRows: any[] = [];
      try {
        const categories = await pool.query(
          `SELECT DISTINCT c.name, c.slug FROM categories c
           INNER JOIN businesses b ON c.id = ANY(b.category_ids)
           WHERE b.city_id = $1 AND b.latitude IS NOT NULL
           ORDER BY c.name`,
          [city.id]
        );
        categoryRows = categories.rows;
      } catch (e) {
        console.warn("[UNIFIED-MAP] categories query failed:", (e as Error).message);
      }

      try {
        const pickupResult = await pool.query(
          `SELECT id, hub_slug, name, address, latitude, longitude
           FROM pulse_pickup_locations
           WHERE city_id = $1 AND is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL`,
          [city.id]
        );
        for (const p of pickupResult.rows) {
          items.push({
            type: "pulse_pickup",
            id: p.id,
            slug: p.hub_slug,
            title: p.name,
            lat: parseFloat(p.latitude),
            lng: parseFloat(p.longitude),
            isFeatured: false,
            isVerified: false,
            isSponsored: false,
            isCrown: false,
            promotedPin: false,
            detailUrl: `/${citySlug}/hub/${p.hub_slug}`,
            address: p.address,
          });
        }
      } catch (e) {
        console.warn("[UNIFIED-MAP] pulse pickup query failed:", (e as Error).message);
      }

      const CITY_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
        charlotte: { minLat: 34.5, maxLat: 36.0, minLng: -82.5, maxLng: -79.5 },
        clt: { minLat: 34.5, maxLat: 36.0, minLng: -82.5, maxLng: -79.5 },
      };
      const bounds = CITY_BOUNDS[citySlug];
      const finalItems = bounds
        ? items.filter(i =>
            i.lat >= bounds.minLat && i.lat <= bounds.maxLat &&
            i.lng >= bounds.minLng && i.lng <= bounds.maxLng
          )
        : items;

      let centerLat = 35.2271;
      let centerLng = -80.8431;
      if (finalItems.length > 0) {
        const sumLat = finalItems.reduce((s, i) => s + i.lat, 0);
        const sumLng = finalItems.reduce((s, i) => s + i.lng, 0);
        centerLat = sumLat / finalItems.length;
        centerLng = sumLng / finalItems.length;
      }

      res.json({
        items: finalItems,
        placements: placementRows,
        zones: zoneRows,
        categories: categoryRows,
        center: { lat: centerLat, lng: centerLng },
      });
    } catch (err: unknown) {
      console.error("[UNIFIED-MAP]", err);
      res.status(500).json({ message: "Failed to fetch map data" });
    }
  });

  app.get("/api/admin/map-placements", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      const result = await pool.query(
        `SELECT mp.*, b.name AS business_name
         FROM map_placements mp
         LEFT JOIN businesses b ON mp.business_id = b.id
         ${cityId ? 'WHERE mp.city_id = $1' : ''}
         ORDER BY mp.created_at DESC`,
        cityId ? [cityId] : []
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch placements" });
    }
  });

  app.post("/api/admin/map-placements", requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body.cityId || !body.type) {
        return res.status(400).json({ message: "cityId and type are required" });
      }
      const result = await db.insert(mapPlacements).values({
        cityId: body.cityId,
        type: body.type,
        businessId: body.businessId || null,
        zoneId: body.zoneId || null,
        title: body.title || null,
        tagline: body.tagline || null,
        logoUrl: body.logoUrl || null,
        ctaUrl: body.ctaUrl || null,
        ctaText: body.ctaText || null,
        startDate: body.startDate ? (() => { const d = new Date(body.startDate); if (isNaN(d.getTime())) throw new Error("Invalid startDate"); return d; })() : null,
        endDate: body.endDate ? (() => { const d = new Date(body.endDate); if (isNaN(d.getTime())) throw new Error("Invalid endDate"); return d; })() : null,
        isActive: body.isActive !== false,
      }).returning();
      res.json(result[0]);
    } catch (err: any) {
      if (err?.message?.startsWith("Invalid ")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("[MAP-PLACEMENT-CREATE]", err);
      res.status(500).json({ message: "Failed to create placement" });
    }
  });

  app.patch("/api/admin/map-placements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const allowedFields = ['type', 'businessId', 'zoneId', 'title', 'tagline', 'logoUrl', 'ctaUrl', 'ctaText', 'isActive'] as const;
      const updates: Record<string, unknown> = {};
      for (const f of allowedFields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      if (req.body.startDate !== undefined) updates.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
      if (req.body.endDate !== undefined) updates.endDate = req.body.endDate ? new Date(req.body.endDate) : null;
      updates.updatedAt = new Date();

      const result = await db.update(mapPlacements).set(updates).where(eq(mapPlacements.id, req.params.id)).returning();
      if (result.length === 0) return res.status(404).json({ message: "Not found" });
      res.json(result[0]);
    } catch (err) {
      res.status(500).json({ message: "Failed to update placement" });
    }
  });

  app.delete("/api/admin/map-placements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(mapPlacements).where(eq(mapPlacements.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete placement" });
    }
  });
}
