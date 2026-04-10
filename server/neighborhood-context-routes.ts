import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { storage } from "./storage";
import { toFiniteCoord } from "./services/geocoding";
import {
  getOtherVerticals,
  getVerticalRegistry,
  type VerticalType,
  type NearbyItem,
  type NearbyGroup,
  type NearbyResponse,
} from "@shared/neighborhood-context";

const CITY_SLUG_ALIASES: Record<string, string> = { clt: "charlotte" };
const DEFAULT_RADIUS_MILES = 1.5;
const MAX_RADIUS_MILES = 5;
const MAX_ITEMS_PER_VERTICAL = 6;

function haversineSQL(latField: string, lngField: string, lat: number, lng: number): string {
  return `(3959 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(${lat})) * cos(radians(${latField}::double precision))
      * cos(radians(${lngField}::double precision) - radians(${lng}))
      + sin(radians(${lat})) * sin(radians(${latField}::double precision))
    ))
  ))`;
}

export function registerNeighborhoodContextRoutes(app: Express) {
  app.get("/api/cities/:citySlug/nearby", async (req: Request, res: Response) => {
    try {
      const slug = CITY_SLUG_ALIASES[req.params.citySlug] || req.params.citySlug;
      const city = await storage.getCityBySlug(slug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const lat = toFiniteCoord(req.query.lat);
      const lng = toFiniteCoord(req.query.lng);
      if (lat === null || lng === null) {
        return res.status(400).json({ message: "lat and lng are required" });
      }

      const validTypes = new Set(getVerticalRegistry().map((v) => v.type));
      const rawSourceType = (req.query.sourceType as string) || "business";
      if (!validTypes.has(rawSourceType as VerticalType)) {
        return res.status(400).json({ message: `Invalid sourceType. Valid: ${[...validTypes].join(", ")}` });
      }
      const sourceType = rawSourceType as VerticalType;

      const radiusRaw = toFiniteCoord(req.query.radius);
      const radiusMiles = Math.min(
        radiusRaw !== null && radiusRaw > 0 ? radiusRaw : DEFAULT_RADIUS_MILES,
        MAX_RADIUS_MILES
      );

      const verticals = getOtherVerticals(sourceType);

      const queryResults = await Promise.allSettled(
        verticals.map(async (vert) => {
          const distExpr = haversineSQL(vert.latField, vert.lngField, lat, lng);
          const extras = (vert.extraSelectFields || []).map((f) => `, ${f}`).join("");

          let whereClause = `city_id = $1 AND ${vert.latField} IS NOT NULL AND ${vert.lngField} IS NOT NULL AND ${distExpr} <= $2`;

          if (vert.type === "event") {
            whereClause += ` AND start_date_time >= NOW()`;
          }
          if (vert.type === "business") {
            whereClause += ` AND presence_status != 'ARCHIVED'`;
          }
          if (vert.type === "marketplace") {
            whereClause += ` AND status = 'ACTIVE'`;
          }
          if (vert.type === "job") {
            whereClause += ` AND status = 'ACTIVE'`;
          }

          const sql = `
            SELECT
              id, ${vert.slugField} AS slug, ${vert.nameField} AS name,
              ${vert.imageField} AS image_url,
              ${distExpr} AS dist_miles
              ${extras}
            FROM ${vert.tableName}
            WHERE ${whereClause}
            ORDER BY dist_miles ASC
            LIMIT ${MAX_ITEMS_PER_VERTICAL}
          `;

          const result = await pool.query(sql, [city.id, radiusMiles]);
          return { vert, rows: result.rows };
        })
      );

      const groups: NearbyGroup[] = [];
      for (const settled of queryResults) {
        if (settled.status === "rejected") {
          console.warn(`[NEARBY] Failed to query vertical:`, settled.reason?.message || settled.reason);
          continue;
        }
        const { vert, rows } = settled.value;
        if (rows.length > 0) {
          const items: NearbyItem[] = rows.map((row: Record<string, unknown>) => {
            const extra: Record<string, unknown> = {};
            for (const ef of vert.extraSelectFields || []) {
              const colName = ef.includes(" AS ") ? ef.split(" AS ")[1].trim() : ef;
              if (row[colName] !== undefined) extra[colName] = row[colName];
            }

            return {
              type: vert.type,
              id: String(row.id),
              slug: String(row.slug),
              name: String(row.name),
              imageUrl: row.image_url ? String(row.image_url) : null,
              detailUrl: vert.detailUrlPattern(req.params.citySlug, String(row.slug)),
              distanceMiles: Math.round(Number(row.dist_miles) * 100) / 100,
              extra,
            };
          });

          groups.push({
            type: vert.type,
            label: vert.label,
            pluralLabel: vert.pluralLabel,
            icon: vert.icon,
            items,
          });
        }
      }

      const response: NearbyResponse = {
        groups,
        centerLat: lat,
        centerLng: lng,
        radiusMiles,
      };

      res.json(response);
    } catch (err) {
      console.error("[NEARBY] Error:", (err as Error).message);
      res.status(500).json({ message: "Failed to load nearby content" });
    }
  });
}
