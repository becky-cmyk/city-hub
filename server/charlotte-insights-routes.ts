import { Router, type RequestHandler } from "express";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { charlottePublicInsights } from "@shared/schema";
import { runInsightsAggregation } from "./services/charlotte-insights-worker";

export function registerCharlotteInsightsRoutes(app: Router, requireAdmin?: RequestHandler) {
  const adminGuard: RequestHandler[] = requireAdmin ? [requireAdmin] : [];

  app.get("/api/admin/charlotte/insights", ...adminGuard, async (req, res) => {
    try {
      const { type, timeWindow, cityId } = req.query;
      const tw = (timeWindow as string) || "24h";

      const conditions = [eq(charlottePublicInsights.timeWindow, tw)];

      if (type && type !== "all") {
        conditions.push(eq(charlottePublicInsights.insightType, type as typeof charlottePublicInsights.insightType.enumValues[number]));
      }

      if (cityId) {
        conditions.push(eq(charlottePublicInsights.cityId, cityId as string));
      }

      const insights = await db
        .select()
        .from(charlottePublicInsights)
        .where(and(...conditions))
        .orderBy(charlottePublicInsights.rank)
        .limit(100);

      res.json(insights);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/charlotte/insights/stats", ...adminGuard, async (req, res) => {
    try {
      const { timeWindow, cityId } = req.query;
      const tw = (timeWindow as string) || "24h";

      const conditions = [eq(charlottePublicInsights.timeWindow, tw)];
      if (cityId) {
        conditions.push(eq(charlottePublicInsights.cityId, cityId as string));
      }

      const allInsights = await db
        .select({
          insightType: charlottePublicInsights.insightType,
        })
        .from(charlottePublicInsights)
        .where(and(...conditions));

      const stats: Record<string, number> = {
        trending_search: 0,
        common_question: 0,
        unanswered_query: 0,
        demand_signal: 0,
        hot_neighborhood: 0,
      };

      for (const row of allInsights) {
        stats[row.insightType] = (stats[row.insightType] || 0) + 1;
      }

      res.json(stats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/charlotte/insights/refresh", ...adminGuard, async (req, res) => {
    try {
      const result = await runInsightsAggregation();
      res.json({ success: true, processed: result.processed });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });
}
