import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import {
  businesses, events, articles, zones, cities,
  territories, operatorTerritories, territoryListings,
  digitalCards, attractions, cmsContentItems,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import QRCode from "qrcode";

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

const ENTITY_ROUTE_MAP: Record<string, string> = {
  business: "/biz",
  event: "/events",
  article: "/articles",
  zone: "/zone",
  digital_card: "/card",
  attraction: "/attractions",
};

async function resolveEntityUrl(
  entityType: string,
  entityId: string,
  baseUrl: string,
): Promise<{ url: string; label: string; cityId: string | null } | null> {
  const prefix = ENTITY_ROUTE_MAP[entityType];
  if (!prefix) return null;

  switch (entityType) {
    case "business": {
      const [biz] = await db.select({ slug: businesses.slug, name: businesses.name, cityId: businesses.cityId })
        .from(businesses).where(eq(businesses.id, entityId));
      if (!biz) return null;
      return { url: `${baseUrl}${prefix}/${biz.slug}`, label: biz.name, cityId: biz.cityId || null };
    }
    case "event": {
      const [evt] = await db.select({ slug: events.slug, title: events.title, zoneId: events.zoneId })
        .from(events).where(eq(events.id, entityId));
      if (!evt) return null;
      let cityId: string | null = null;
      if (evt.zoneId) {
        const [z] = await db.select({ cityId: zones.cityId }).from(zones).where(eq(zones.id, evt.zoneId));
        cityId = z?.cityId || null;
      }
      return { url: `${baseUrl}${prefix}/${evt.slug}`, label: evt.title, cityId };
    }
    case "article": {
      const [art] = await db.select({ slug: articles.slug, title: articles.title, cityId: articles.cityId })
        .from(articles).where(eq(articles.id, entityId));
      if (!art) return null;
      return { url: `${baseUrl}${prefix}/${art.slug}`, label: art.title, cityId: art.cityId || null };
    }
    case "zone": {
      const [z] = await db.select({ slug: zones.slug, name: zones.name, cityId: zones.cityId })
        .from(zones).where(eq(zones.id, entityId));
      if (!z) return null;
      return { url: `${baseUrl}${prefix}/${z.slug}`, label: z.name, cityId: z.cityId || null };
    }
    case "digital_card": {
      const [card] = await db.select({ slug: digitalCards.slug, name: digitalCards.name })
        .from(digitalCards).where(eq(digitalCards.id, entityId));
      if (!card) return null;
      return { url: `${baseUrl}${prefix}/${card.slug}`, label: card.name, cityId: null };
    }
    case "attraction": {
      const [attr] = await db.select({ slug: attractions.slug, name: attractions.name, zoneId: attractions.zoneId })
        .from(attractions).where(eq(attractions.id, entityId));
      if (!attr) return null;
      let cityId: string | null = null;
      if (attr.zoneId) {
        const [z] = await db.select({ cityId: zones.cityId }).from(zones).where(eq(zones.id, attr.zoneId));
        cityId = z?.cityId || null;
      }
      return { url: `${baseUrl}${prefix}/${attr.slug}`, label: attr.name, cityId };
    }
    default:
      return null;
  }
}

async function getCityCode(cityId: string | null): Promise<string | null> {
  if (!cityId) return null;
  const [territory] = await db.select({ code: territories.code })
    .from(territories)
    .where(and(eq(territories.cityId, cityId), eq(territories.type, "METRO")))
    .limit(1);
  return territory?.code || null;
}

function embedCityCodeInSvg(svgString: string, cityCode: string): string {
  const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) return svgString;

  const parts = viewBoxMatch[1].split(/\s+/).map(Number);
  const width = parts[2];
  const height = parts[3];
  const cx = width / 2;
  const cy = height / 2;

  const fontSize = Math.max(width * 0.12, 14);
  const padX = fontSize * cityCode.length * 0.35;
  const padY = fontSize * 0.65;

  const overlay = `
    <rect x="${cx - padX}" y="${cy - padY}" width="${padX * 2}" height="${padY * 2}" rx="2" fill="white"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
      font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${fontSize}"
      fill="#000000" letter-spacing="1">${cityCode}</text>`;

  return svgString.replace("</svg>", `${overlay}</svg>`);
}

async function generateQrDataUrl(
  url: string,
  format: "png" | "svg",
  size: number,
  cityCode: string | null,
): Promise<string> {
  if (format === "svg") {
    const svgString = await QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: cityCode ? "H" : "M",
      margin: 2,
      width: size,
    });

    const finalSvg = cityCode ? embedCityCodeInSvg(svgString, cityCode) : svgString;
    const base64 = Buffer.from(finalSvg).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }

  const pngBuffer = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: cityCode ? "H" : "M",
    margin: 2,
    width: size,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const base64 = pngBuffer.toString("base64");
  return `data:image/png;base64,${base64}`;
}

async function getOperatorCityIds(operatorId: string): Promise<string[]> {
  const assignments = await db.select().from(operatorTerritories)
    .where(eq(operatorTerritories.operatorId, operatorId));
  const territoryIds = assignments.map(a => a.territoryId);
  if (territoryIds.length === 0) return [];

  const terrs = await db.select({ cityId: territories.cityId })
    .from(territories)
    .where(inArray(territories.id, territoryIds));
  return [...new Set(terrs.map(t => t.cityId).filter(Boolean) as string[])];
}

async function verifyOperatorAccess(operatorId: string, entityType: string, entityId: string): Promise<boolean> {
  const assignments = await db.select().from(operatorTerritories)
    .where(eq(operatorTerritories.operatorId, operatorId));
  const territoryIds = assignments.map(a => a.territoryId);
  if (territoryIds.length === 0) return false;

  if (entityType === "business") {
    const listing = await db.select({ id: territoryListings.id })
      .from(territoryListings)
      .where(and(
        eq(territoryListings.businessId, entityId),
        inArray(territoryListings.territoryId, territoryIds),
      ))
      .limit(1);
    return listing.length > 0;
  }

  const operatorCityIds = await getOperatorCityIds(operatorId);
  if (operatorCityIds.length === 0) return false;

  if (entityType === "event") {
    const [evt] = await db.select({ zoneId: events.zoneId }).from(events).where(eq(events.id, entityId));
    if (!evt?.zoneId) return false;
    const [zone] = await db.select({ cityId: zones.cityId }).from(zones).where(eq(zones.id, evt.zoneId));
    return zone?.cityId ? operatorCityIds.includes(zone.cityId) : false;
  }

  if (entityType === "article") {
    const [art] = await db.select({ cityId: articles.cityId }).from(articles).where(eq(articles.id, entityId));
    return art?.cityId ? operatorCityIds.includes(art.cityId) : false;
  }

  if (entityType === "zone") {
    const [z] = await db.select({ cityId: zones.cityId }).from(zones).where(eq(zones.id, entityId));
    return z?.cityId ? operatorCityIds.includes(z.cityId) : false;
  }

  if (entityType === "attraction") {
    const [attr] = await db.select({ zoneId: attractions.zoneId }).from(attractions).where(eq(attractions.id, entityId));
    if (!attr?.zoneId) return false;
    const [zone] = await db.select({ cityId: zones.cityId }).from(zones).where(eq(zones.id, attr.zoneId));
    return zone?.cityId ? operatorCityIds.includes(zone.cityId) : false;
  }

  return true;
}

export function registerQrRoutes(app: Express, requireAdminOrOperator: AuthMiddleware) {
  app.post("/api/qr/generate", requireAdminOrOperator, async (req: Request, res: Response) => {
    try {
      const { url, entityType, entityId, format = "svg", size = 400, label, cityCode: overrideCityCode, includeCityCode = true } = req.body;

      if (!url && (!entityType || !entityId)) {
        return res.status(400).json({ message: "Provide either 'url' or 'entityType' + 'entityId'" });
      }

      const validEntityTypes = ["business", "event", "article", "zone", "digital_card", "attraction"];
      if (entityType && !validEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: `Invalid entityType. Must be one of: ${validEntityTypes.join(", ")}` });
      }

      const validFormats = ["png", "svg"];
      if (!validFormats.includes(format)) {
        return res.status(400).json({ message: "Format must be 'png' or 'svg'" });
      }

      const clampedSize = Math.min(Math.max(size, 100), 2000);

      const operatorId = (req.session as any).operatorId;
      if (operatorId && entityType && entityId) {
        const hasAccess = await verifyOperatorAccess(operatorId, entityType, entityId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Entity is not in your territory" });
        }
      }

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
      const baseUrl = `${protocol}://${host}`;

      let finalUrl = url;
      let finalLabel = label || url || "";
      let cityCodeToEmbed: string | null = null;

      if (entityType && entityId) {
        const resolved = await resolveEntityUrl(entityType, entityId, baseUrl);
        if (!resolved) {
          return res.status(404).json({ message: `${entityType} with id '${entityId}' not found` });
        }
        finalUrl = resolved.url;
        finalLabel = label || resolved.label;

        if (includeCityCode) {
          cityCodeToEmbed = overrideCityCode || await getCityCode(resolved.cityId);
        }
      } else if (includeCityCode && overrideCityCode) {
        cityCodeToEmbed = overrideCityCode;
      }

      const qrDataUrl = await generateQrDataUrl(finalUrl, format, clampedSize, cityCodeToEmbed);

      res.json({
        qrDataUrl,
        url: finalUrl,
        label: finalLabel,
        format,
        size: clampedSize,
        cityCode: cityCodeToEmbed,
      });
    } catch (err: any) {
      console.error("[QR Generate] Error:", err.message);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.post("/api/qr/generate-batch", requireAdminOrOperator, async (req: Request, res: Response) => {
    try {
      const { entityType, entityIds, format = "svg", size = 400, includeCityCode = true } = req.body;

      if (!entityType || !Array.isArray(entityIds) || entityIds.length === 0) {
        return res.status(400).json({ message: "Provide 'entityType' and 'entityIds' array" });
      }

      const validEntityTypes = ["business", "event", "article", "zone", "digital_card", "attraction"];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: `Invalid entityType. Must be one of: ${validEntityTypes.join(", ")}` });
      }

      if (entityIds.length > 100) {
        return res.status(400).json({ message: "Maximum 100 QR codes per batch" });
      }

      const validFormats = ["png", "svg"];
      if (!validFormats.includes(format)) {
        return res.status(400).json({ message: "Format must be 'png' or 'svg'" });
      }

      const clampedSize = Math.min(Math.max(size, 100), 2000);
      const operatorId = (req.session as any).operatorId;

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
      const baseUrl = `${protocol}://${host}`;

      const results: Array<{
        entityId: string;
        qrDataUrl: string;
        url: string;
        label: string;
        cityCode: string | null;
        error?: string;
      }> = [];

      for (const entityId of entityIds) {
        try {
          if (operatorId) {
            const hasAccess = await verifyOperatorAccess(operatorId, entityType, entityId);
            if (!hasAccess) {
              results.push({ entityId, qrDataUrl: "", url: "", label: "", cityCode: null, error: "Not in your territory" });
              continue;
            }
          }

          const resolved = await resolveEntityUrl(entityType, entityId, baseUrl);
          if (!resolved) {
            results.push({ entityId, qrDataUrl: "", url: "", label: "", cityCode: null, error: "Entity not found" });
            continue;
          }

          const cityCode = includeCityCode ? await getCityCode(resolved.cityId) : null;
          const qrDataUrl = await generateQrDataUrl(resolved.url, format, clampedSize, cityCode);

          results.push({
            entityId,
            qrDataUrl,
            url: resolved.url,
            label: resolved.label,
            cityCode,
          });
        } catch (innerErr: any) {
          results.push({ entityId, qrDataUrl: "", url: "", label: "", cityCode: null, error: innerErr.message });
        }
      }

      res.json({
        results,
        total: results.length,
        successful: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
      });
    } catch (err: any) {
      console.error("[QR Batch] Error:", err.message);
      res.status(500).json({ message: "Failed to generate QR codes" });
    }
  });
}
