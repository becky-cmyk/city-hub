import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { featureAuditItems } from "@shared/schema";
import { eq } from "drizzle-orm";

const SPEC_FEATURES: Array<{ featureName: string; tier: string }> = [
  { featureName: "1 Primary Local Hub (ZIP/town)", tier: "Charter" },
  { featureName: "Rotating visibility inside Local Hub", tier: "Charter" },
  { featureName: "Appears in category filters", tier: "Charter" },
  { featureName: "Weighted placement (standard weight)", tier: "Charter" },
  { featureName: "1 Primary Category included", tier: "Charter" },
  { featureName: "3 Specialties included", tier: "Charter" },
  { featureName: "Additional Category add-on (+$75)", tier: "Charter" },
  { featureName: "Structured presence page", tier: "Charter" },
  { featureName: "Business/Organization description", tier: "Charter" },
  { featureName: "Contact information", tier: "Charter" },
  { featureName: "Website link", tier: "Charter" },
  { featureName: "Social links (limited)", tier: "Charter" },
  { featureName: "Gallery (limited image count)", tier: "Charter" },
  { featureName: "1 Profile Article per year", tier: "Charter" },
  { featureName: "Internal Hub article & publication linking", tier: "Charter" },
  { featureName: "Press releases accepted and attached", tier: "Charter" },
  { featureName: "Internal Charlotte reviews enabled", tier: "Charter" },
  { featureName: "No external review aggregation", tier: "Charter" },
  { featureName: "English + Spanish interface", tier: "Charter" },
  { featureName: "Business language indicator", tier: "Charter" },
  { featureName: "Shared rotating visibility (no dominance boost)", tier: "Charter" },
  { featureName: "Higher weighted rotation", tier: "Enhanced" },
  { featureName: "Stronger placement priority", tier: "Enhanced" },
  { featureName: "Greater surface visibility", tier: "Enhanced" },
  { featureName: "Up to 3 Categories", tier: "Enhanced" },
  { featureName: "5 Specialties included", tier: "Enhanced" },
  { featureName: "Additional Specialties (+$50 each)", tier: "Enhanced" },
  { featureName: "Cap recommended: 15 total max specialties", tier: "Enhanced" },
  { featureName: "Expert Q&A section (5 questions)", tier: "Enhanced" },
  { featureName: "Structured long-tail keyword capture", tier: "Enhanced" },
  { featureName: "AI search response support", tier: "Enhanced" },
  { featureName: "Indexing depth support", tier: "Enhanced" },
  { featureName: "Larger gallery (higher image cap)", tier: "Enhanced" },
  { featureName: "Video embed", tier: "Enhanced" },
  { featureName: "Custom accent color", tier: "Enhanced" },
  { featureName: "Custom hero image", tier: "Enhanced" },
  { featureName: "FAQ section", tier: "Enhanced" },
  { featureName: "Trust signals block (licensing, certs, awards)", tier: "Enhanced" },
  { featureName: "Town visibility labels", tier: "Enhanced" },
  { featureName: "Multi-location support (up to 5)", tier: "Enhanced" },
  { featureName: "2 Profile Articles per year", tier: "Enhanced" },
  { featureName: "Hub publication linking", tier: "Enhanced" },
  { featureName: "External publication linking", tier: "Enhanced" },
  { featureName: "Press release attachment (no limit)", tier: "Enhanced" },
  { featureName: "External event links (Eventbrite etc.)", tier: "Enhanced" },
  { featureName: "Media archive section", tier: "Enhanced" },
  { featureName: "External review aggregation (Google/Yelp)", tier: "Enhanced" },
  { featureName: "Clean URL inside Hub", tier: "Enhanced" },
  { featureName: "Optional custom domain redirect", tier: "Enhanced" },
  { featureName: "Can function as primary website", tier: "Enhanced" },
  { featureName: "Built for search engines", tier: "Enhanced" },
  { featureName: "Built for AI discovery", tier: "Enhanced" },
  { featureName: "Structured content blocks", tier: "Enhanced" },
  { featureName: "Long-tail indexing via Q&A", tier: "Enhanced" },
  { featureName: "Category + Specialty depth", tier: "Enhanced" },
  { featureName: "Community-first positioning", tier: "Enhanced" },
  { featureName: "Organized by Local Hub (ZIP + town)", tier: "Shared" },
  { featureName: "Community-first presentation", tier: "Shared" },
  { featureName: "Rotating visibility inside hub", tier: "Shared" },
  { featureName: "Pulses (community articles)", tier: "Shared" },
  { featureName: "Organization and nonprofit inclusion", tier: "Shared" },
  { featureName: "Events integration", tier: "Shared" },
  { featureName: "Press release recognition", tier: "Shared" },
  { featureName: "No exclusivity on presence", tier: "Shared" },
  { featureName: "Founder rate retained while active", tier: "Shared" },
  { featureName: "Multi-location rule (5 max, Enterprise beyond)", tier: "Shared" },
  { featureName: "Additional ZIP visibility add-on (+$50)", tier: "Shared" },
  { featureName: "Additional Category add-on (+$75 w/ 1 Specialty)", tier: "Shared" },
  { featureName: "Additional Specialty add-on (+$50, Enhanced only)", tier: "Shared" },
];

export function registerFeatureAuditRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void
): void {
  app.get("/api/admin/feature-audit", requireAdmin, async (_req: Request, res: Response) => {
    try {
      let items = await db.select().from(featureAuditItems);

      if (items.length === 0) {
        for (const feat of SPEC_FEATURES) {
          await db.insert(featureAuditItems).values({
            featureName: feat.featureName,
            tier: feat.tier,
            status: "Not Implemented",
            notes: "",
          });
        }
        items = await db.select().from(featureAuditItems);
      }

      res.json(items);
    } catch (err) {
      console.error("[FEATURE AUDIT] Error:", err);
      res.status(500).json({ error: "Failed to fetch feature audit items" });
    }
  });

  app.put("/api/admin/feature-audit/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const [updated] = await db
        .update(featureAuditItems)
        .set({
          status: status || undefined,
          notes: notes !== undefined ? notes : undefined,
          lastUpdated: new Date(),
        })
        .where(eq(featureAuditItems.id, id as string))
        .returning();

      if (!updated) return res.status(404).json({ error: "Item not found" });
      res.json(updated);
    } catch (err) {
      console.error("[FEATURE AUDIT] Update error:", err);
      res.status(500).json({ error: "Failed to update feature audit item" });
    }
  });
}
