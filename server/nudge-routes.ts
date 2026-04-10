import type { Express, Request, Response } from "express";
import { db } from "./db";
import { crmContacts, referralTriangles, engagementEvents } from "@shared/schema";
import { eq, and, or, isNull, lte, gte, desc, sql } from "drizzle-orm";

interface Nudge {
  type: "follow_up" | "birthday" | "anniversary" | "referral_stale" | "engagement";
  score: number;
  contactId?: string;
  contactName?: string;
  referralTriangleId?: string;
  engagementEventId?: string;
  reason: string;
  daysOverdue?: number;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function isWithinWindow(dateStr: string, windowDays: number): boolean {
  if (!dateStr) return false;
  const now = new Date();
  const thisYear = now.getFullYear();
  const [month, day] = dateStr.includes("/")
    ? dateStr.split("/").map(Number)
    : dateStr.includes("-")
      ? [parseInt(dateStr.split("-")[1]), parseInt(dateStr.split("-")[2])]
      : [0, 0];
  if (!month || !day) return false;

  const target = new Date(thisYear, month - 1, day);
  if (target < now) target.setFullYear(thisYear + 1);

  const diff = daysBetween(now, target);
  return diff >= 0 && diff <= windowDays;
}

const REFERRAL_STALE_THRESHOLDS: Record<string, number> = {
  submitted: 3,
  contacted: 7,
  connected: 14,
  in_progress: 21,
};

const NUDGE_BUDGET = 8;

export function registerNudgeRoutes(app: Express, requireAdmin: any) {
  app.get("/api/nudges/today", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const now = new Date();
      const nudges: Nudge[] = [];

      const contacts = await db.select().from(crmContacts)
        .where(and(
          eq(crmContacts.userId, userId),
          eq(crmContacts.nudgeSkippedToday, false),
          or(isNull(crmContacts.nudgeSnoozeUntil), lte(crmContacts.nudgeSnoozeUntil, now))!
        ));

      for (const contact of contacts) {
        if (contact.lastContactedAt && contact.nudgeWindowDays) {
          const daysSince = daysBetween(contact.lastContactedAt, now);
          if (daysSince >= contact.nudgeWindowDays) {
            const overdue = daysSince - contact.nudgeWindowDays;
            const score = 100 + overdue * 2;
            nudges.push({
              type: "follow_up",
              score,
              contactId: contact.id,
              contactName: contact.name,
              reason: `Last contacted ${daysSince} days ago (window: ${contact.nudgeWindowDays}d)`,
              daysOverdue: overdue,
            });
          }
        } else if (!contact.lastContactedAt) {
          nudges.push({
            type: "follow_up",
            score: 80,
            contactId: contact.id,
            contactName: contact.name,
            reason: "Never contacted — new connection",
          });
        }

        if (contact.birthday && isWithinWindow(contact.birthday, 7)) {
          nudges.push({
            type: "birthday",
            score: 120,
            contactId: contact.id,
            contactName: contact.name,
            reason: `Birthday coming up (${contact.birthday})`,
          });
        }

        if (contact.anniversary && isWithinWindow(contact.anniversary, 7)) {
          nudges.push({
            type: "anniversary",
            score: 110,
            contactId: contact.id,
            contactName: contact.name,
            reason: `Anniversary coming up (${contact.anniversary})`,
          });
        }
      }

      const activeStatuses = ["submitted", "contacted", "connected", "in_progress"] as const;
      const triangles = await db.select().from(referralTriangles)
        .where(and(
          eq(referralTriangles.userId, userId),
          or(...activeStatuses.map(s => eq(referralTriangles.status, s)))!,
          isNull(referralTriangles.nudgeDismissedAt)
        ));

      for (const triangle of triangles) {
        const status = triangle.status || "submitted";
        const threshold = REFERRAL_STALE_THRESHOLDS[status];
        if (threshold && triangle.statusUpdatedAt) {
          const daysSince = daysBetween(triangle.statusUpdatedAt, now);
          if (daysSince >= threshold) {
            const contactA = contacts.find(c => c.id === triangle.personAId);
            const contactB = contacts.find(c => c.id === triangle.personBId);
            nudges.push({
              type: "referral_stale",
              score: 90 + (daysSince - threshold) * 3,
              referralTriangleId: triangle.id,
              contactName: `${contactA?.name || "Unknown"} ↔ ${contactB?.name || "Unknown"}`,
              reason: `Referral stuck at "${status}" for ${daysSince} days (threshold: ${threshold}d)`,
              daysOverdue: daysSince - threshold,
            });
          }
        }
      }

      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentEngagement = await db.select().from(engagementEvents)
        .where(and(
          eq(engagementEvents.userId, userId),
          gte(engagementEvents.firedAt, oneDayAgo),
          isNull(engagementEvents.dismissedAt)
        ));

      for (const event of recentEngagement) {
        nudges.push({
          type: "engagement",
          score: 130,
          engagementEventId: event.id,
          contactId: event.contactId || undefined,
          contactName: event.contactName || "Someone",
          reason: `${event.eventType.replace("_", " ")} detected (${event.source.replace(/_/g, " ")})`,
        });
      }

      nudges.sort((a, b) => b.score - a.score);
      res.json({ data: nudges.slice(0, NUDGE_BUDGET), total: nudges.length, budget: NUDGE_BUDGET });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/nudges/:contactId/skip", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      await db.update(crmContacts)
        .set({ nudgeSkippedToday: true })
        .where(and(eq(crmContacts.id, req.params.contactId), eq(crmContacts.userId, userId)));
      res.json({ message: "Skipped for today" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/nudges/:contactId/snooze", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { days } = req.body;
      const snoozeDays = Math.min(Math.max(parseInt(days) || 7, 1), 90);
      const snoozeUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000);

      await db.update(crmContacts)
        .set({ nudgeSnoozeUntil: snoozeUntil })
        .where(and(eq(crmContacts.id, req.params.contactId), eq(crmContacts.userId, userId)));
      res.json({ message: `Snoozed for ${snoozeDays} days`, snoozeUntil });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/nudges/referral/:triangleId/dismiss", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      await db.update(referralTriangles)
        .set({ nudgeDismissedAt: new Date() })
        .where(and(eq(referralTriangles.id, req.params.triangleId), eq(referralTriangles.userId, userId)));
      res.json({ message: "Referral nudge dismissed" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/nudges/engagement/:eventId/dismiss", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      await db.update(engagementEvents)
        .set({ dismissedAt: new Date() })
        .where(and(eq(engagementEvents.id, req.params.eventId), eq(engagementEvents.userId, userId)));
      res.json({ message: "Engagement nudge dismissed" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
