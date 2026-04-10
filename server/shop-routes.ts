import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, inArray, gte, lte } from "drizzle-orm";
import {
  shopItems, shopDrops, shopClaims, businesses,
  insertShopItemSchema, insertShopDropSchema,
  type ShopItem, type ShopDrop, type ShopClaim,
} from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { geoTagAndClassify } from "./services/geo-tagger";

const router = Router();

function getPublicUserId(req: Request): string | null {
  return (req.session as any)?.publicUserId || null;
}

function getAdminUserId(req: Request): string | null {
  return (req.session as any)?.userId || null;
}

function generateClaimCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 8);
}

router.get("/api/shop/items", async (req: Request, res: Response) => {
  try {
    const { cityId, businessId, status } = req.query;
    const conditions: any[] = [];
    if (cityId) conditions.push(eq(shopItems.cityId, cityId as string));
    if (businessId) conditions.push(eq(shopItems.businessId, businessId as string));
    if (status) conditions.push(eq(shopItems.status, status as any));
    else conditions.push(eq(shopItems.status, "active"));

    const items = await db.select().from(shopItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shopItems.createdAt))
      .limit(50);

    res.json(items);
  } catch (err) {
    console.error("[SHOP] Error fetching items:", err);
    res.status(500).json({ error: "Failed to fetch shop items" });
  }
});

router.get("/api/shop/items/:id", async (req: Request, res: Response) => {
  try {
    const [item] = await db.select().from(shopItems).where(eq(shopItems.id, req.params.id));
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

router.post("/api/shop/items", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin access required" });

    const data = insertShopItemSchema.parse(req.body);
    const [item] = await db.insert(shopItems).values(data).returning();
    geoTagAndClassify("shop_item", item.id, data.cityId, {
      title: data.title,
      description: data.description || null,
      businessId: data.businessId,
      category: data.category || null,
    }, { skipAi: true }).catch(err => console.error("[GeoTagger] Shop item:", err.message));
    res.status(201).json(item);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid item data", details: err.errors });
    console.error("[SHOP] Error creating item:", err);
    res.status(500).json({ error: "Failed to create item" });
  }
});

router.patch("/api/shop/items/:id", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin access required" });

    const [existing] = await db.select().from(shopItems).where(eq(shopItems.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Item not found" });

    const updates: Partial<ShopItem> = {};
    const allowed = ["title", "description", "price", "compareAtPrice", "imageUrl", "imageUrls", "category", "status", "type", "inventoryCount", "externalUrl", "expiresAt"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) (updates as any)[key] = req.body[key];
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(shopItems).set(updates).where(eq(shopItems.id, req.params.id)).returning();
    res.json(updated);
  } catch (err) {
    console.error("[SHOP] Error updating item:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

router.delete("/api/shop/items/:id", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin access required" });

    await db.delete(shopItems).where(eq(shopItems.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

router.get("/api/shop/drops", async (req: Request, res: Response) => {
  try {
    const { cityId, businessId, status } = req.query;
    const conditions: any[] = [];
    if (cityId) conditions.push(eq(shopDrops.cityId, cityId as string));
    if (businessId) conditions.push(eq(shopDrops.businessId, businessId as string));
    if (status) conditions.push(eq(shopDrops.status, status as any));

    const drops = await db.select().from(shopDrops)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shopDrops.createdAt))
      .limit(50);

    res.json(drops);
  } catch (err) {
    console.error("[SHOP] Error fetching drops:", err);
    res.status(500).json({ error: "Failed to fetch drops" });
  }
});

router.get("/api/shop/drops/active", async (req: Request, res: Response) => {
  try {
    const { cityId } = req.query;
    const now = new Date();
    const conditions: any[] = [
      eq(shopDrops.status, "active"),
    ];
    if (cityId) conditions.push(eq(shopDrops.cityId, cityId as string));

    const drops = await db.select().from(shopDrops)
      .where(and(...conditions))
      .orderBy(desc(shopDrops.createdAt))
      .limit(20);

    res.json(drops);
  } catch (err) {
    console.error("[SHOP] Error fetching active drops:", err);
    res.status(500).json({ error: "Failed to fetch active drops" });
  }
});

router.get("/api/shop/drops/:id", async (req: Request, res: Response) => {
  try {
    const [drop] = await db.select().from(shopDrops).where(eq(shopDrops.id, req.params.id));
    if (!drop) return res.status(404).json({ error: "Drop not found" });
    res.json(drop);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch drop" });
  }
});

router.post("/api/shop/drops", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin access required" });

    const data = insertShopDropSchema.parse(req.body);
    const [drop] = await db.insert(shopDrops).values(data).returning();
    res.status(201).json(drop);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid drop data", details: err.errors });
    console.error("[SHOP] Error creating drop:", err);
    res.status(500).json({ error: "Failed to create drop" });
  }
});

router.patch("/api/shop/drops/:id", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin access required" });

    const [existing] = await db.select().from(shopDrops).where(eq(shopDrops.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Drop not found" });

    const updates: Partial<ShopDrop> = {};
    const allowed = ["title", "description", "imageUrl", "discountPercent", "discountAmount", "originalPrice", "dealPrice", "dealType", "startAt", "endAt", "maxClaims", "status", "terms"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) (updates as any)[key] = req.body[key];
    }

    const [updated] = await db.update(shopDrops).set(updates).where(eq(shopDrops.id, req.params.id)).returning();
    res.json(updated);
  } catch (err) {
    console.error("[SHOP] Error updating drop:", err);
    res.status(500).json({ error: "Failed to update drop" });
  }
});

router.delete("/api/shop/drops/:id", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin access required" });

    await db.delete(shopDrops).where(eq(shopDrops.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete drop" });
  }
});

router.post("/api/shop/claims", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ error: "Login required to claim" });

    const claimSchema = z.object({
      itemType: z.enum(["shop_item", "shop_drop"]),
      itemId: z.string().min(1),
    });
    const data = claimSchema.parse(req.body);

    if (data.itemType === "shop_item") {
      const [item] = await db.select().from(shopItems).where(eq(shopItems.id, data.itemId));
      if (!item) return res.status(404).json({ error: "Item not found" });
      if (item.status !== "active") return res.status(400).json({ error: "Item is not available" });
      if (item.inventoryCount !== null && item.inventoryCount <= 0) {
        return res.status(400).json({ error: "Item is sold out" });
      }

      const claimCode = generateClaimCode();
      const [claim] = await db.insert(shopClaims).values({
        userId,
        itemType: "shop_item",
        itemId: data.itemId,
        claimCode,
        status: "claimed",
      }).returning();

      await db.update(shopItems).set({
        claimCount: sql`${shopItems.claimCount} + 1`,
        inventoryCount: item.inventoryCount !== null ? sql`${shopItems.inventoryCount} - 1` : undefined,
        updatedAt: new Date(),
      }).where(eq(shopItems.id, data.itemId));

      if (item.inventoryCount !== null && item.inventoryCount <= 1) {
        await db.update(shopItems).set({ status: "sold_out" }).where(eq(shopItems.id, data.itemId));
      }

      res.status(201).json(claim);
    } else {
      const [drop] = await db.select().from(shopDrops).where(eq(shopDrops.id, data.itemId));
      if (!drop) return res.status(404).json({ error: "Drop not found" });
      if (drop.status !== "active") return res.status(400).json({ error: "Drop is not available" });
      if (drop.maxClaims !== null && drop.claimCount >= drop.maxClaims) {
        return res.status(400).json({ error: "Drop has reached max claims" });
      }

      const claimCode = generateClaimCode();
      const [claim] = await db.insert(shopClaims).values({
        userId,
        itemType: "shop_drop",
        itemId: data.itemId,
        claimCode,
        status: "claimed",
      }).returning();

      await db.update(shopDrops).set({
        claimCount: sql`${shopDrops.claimCount} + 1`,
      }).where(eq(shopDrops.id, data.itemId));

      if (drop.maxClaims !== null && drop.claimCount + 1 >= drop.maxClaims) {
        await db.update(shopDrops).set({ status: "sold_out" }).where(eq(shopDrops.id, data.itemId));
      }

      res.status(201).json(claim);
    }
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid claim data" });
    console.error("[SHOP] Error creating claim:", err);
    res.status(500).json({ error: "Failed to create claim" });
  }
});

router.get("/api/shop/claims/mine", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ error: "Login required" });

    const claims = await db.select().from(shopClaims)
      .where(eq(shopClaims.userId, userId))
      .orderBy(desc(shopClaims.claimedAt))
      .limit(50);

    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch claims" });
  }
});

router.post("/api/shop/claims/:id/redeem", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin or business owner access required" });

    const [claim] = await db.select().from(shopClaims).where(eq(shopClaims.id, req.params.id));
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    if (claim.status !== "claimed") return res.status(400).json({ error: "Claim cannot be redeemed" });

    const [updated] = await db.update(shopClaims).set({
      status: "redeemed",
      redeemedAt: new Date(),
    }).where(eq(shopClaims.id, req.params.id)).returning();

    res.json(updated);
  } catch (err) {
    console.error("[SHOP] Error redeeming claim:", err);
    res.status(500).json({ error: "Failed to redeem claim" });
  }
});

router.get("/api/shop/claims", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin access required" });

    const { status, code } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(shopClaims.status, status as any));
    if (code) conditions.push(eq(shopClaims.claimCode, (code as string).toUpperCase()));

    const claims = await db.select().from(shopClaims)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shopClaims.claimedAt))
      .limit(100);

    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch claims" });
  }
});

export default router;
