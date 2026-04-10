import type { Express, Request, Response } from "express";
import { db } from "./db";
import { mileageTrips, insertMileageTripSchema } from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export function registerMileageRoutes(app: Express, requireAdmin: any) {
  app.get("/api/mileage/trips", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { startDate, endDate, category } = req.query;

      let conditions = [eq(mileageTrips.userId, userId)];
      if (startDate) conditions.push(gte(mileageTrips.tripDate, new Date(startDate as string)));
      if (endDate) conditions.push(lte(mileageTrips.tripDate, new Date(endDate as string)));
      if (category && category !== "all") conditions.push(eq(mileageTrips.category, category as any));

      const trips = await db.select().from(mileageTrips)
        .where(and(...conditions))
        .orderBy(desc(mileageTrips.tripDate));

      res.json({ data: trips });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/mileage/trips/summary", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { startDate, endDate } = req.query;

      let conditions = [eq(mileageTrips.userId, userId)];
      if (startDate) conditions.push(gte(mileageTrips.tripDate, new Date(startDate as string)));
      if (endDate) conditions.push(lte(mileageTrips.tripDate, new Date(endDate as string)));

      const [summary] = await db.select({
        totalMiles: sql<string>`coalesce(sum(${mileageTrips.miles}), 0)`,
        tripCount: sql<number>`count(*)`,
        totalMinutes: sql<number>`coalesce(sum(${mileageTrips.durationMinutes}), 0)`,
      }).from(mileageTrips).where(and(...conditions));

      const byCategory = await db.select({
        category: mileageTrips.category,
        totalMiles: sql<string>`coalesce(sum(${mileageTrips.miles}), 0)`,
        tripCount: sql<number>`count(*)`,
      }).from(mileageTrips)
        .where(and(...conditions))
        .groupBy(mileageTrips.category);

      res.json({
        totalMiles: parseFloat(summary.totalMiles) || 0,
        tripCount: Number(summary.tripCount),
        totalMinutes: Number(summary.totalMinutes),
        byCategory,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/mileage/trips", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const parsed = insertMileageTripSchema.parse({ ...req.body, userId });
      const [trip] = await db.insert(mileageTrips).values(parsed).returning();
      res.status(201).json(trip);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/mileage/trips/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [existing] = await db.select().from(mileageTrips)
        .where(and(eq(mileageTrips.id, req.params.id), eq(mileageTrips.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Trip not found" });

      await db.delete(mileageTrips).where(eq(mileageTrips.id, req.params.id));
      res.json({ message: "Trip deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
