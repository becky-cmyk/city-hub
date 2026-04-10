import { db } from "../db";
import { payoutLedger, revenueSplits, operators } from "@shared/schema";
import { eq, and, gte, lte, sql, ne } from "drizzle-orm";
import { logAudit, AuditActions } from "./audit-logger";

function getMonthBounds(date: Date): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { periodStart, periodEnd };
}

export async function generateMonthlyLedger(forDate?: Date): Promise<{ created: number; updated: number }> {
  const targetDate = forDate || new Date();
  const { periodStart, periodEnd } = getMonthBounds(targetDate);

  const activeOps = await db.select({ id: operators.id })
    .from(operators)
    .where(eq(operators.status, "ACTIVE"));

  let created = 0;
  let updated = 0;

  for (const op of activeOps) {
    const [agg] = await db.select({
      total: sql<number>`COALESCE(SUM(${revenueSplits.splitAmount}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
      .from(revenueSplits)
      .where(and(
        eq(revenueSplits.operatorId, op.id),
        gte(revenueSplits.createdAt, periodStart),
        lte(revenueSplits.createdAt, periodEnd),
      ));

    const totalSplitsCents = Number(agg.total) || 0;
    const splitCount = Number(agg.count) || 0;

    const [existing] = await db.select().from(payoutLedger)
      .where(and(
        eq(payoutLedger.operatorId, op.id),
        eq(payoutLedger.periodStart, periodStart),
      ));

    if (existing) {
      if (existing.status === "OPEN") {
        await db.update(payoutLedger).set({
          totalSplitsCents,
          splitCount,
          updatedAt: new Date(),
        }).where(eq(payoutLedger.id, existing.id));
        updated++;
      }
    } else {
      await db.insert(payoutLedger).values({
        operatorId: op.id,
        periodStart,
        periodEnd,
        totalSplitsCents,
        splitCount,
        status: "OPEN",
      });
      created++;
    }
  }

  logAudit({ action: AuditActions.PAYOUT_GENERATED, metadata: { periodStart: periodStart.toISOString(), created, updated, operatorCount: activeOps.length } });

  return { created, updated };
}

export async function approvePayout(ledgerId: string, approverUserId: string): Promise<void> {
  const [entry] = await db.select().from(payoutLedger).where(eq(payoutLedger.id, ledgerId));
  if (!entry) throw new Error("Payout ledger entry not found");
  if (entry.status !== "OPEN") throw new Error(`Cannot approve — status is ${entry.status}`);

  await db.update(payoutLedger).set({
    status: "APPROVED",
    approvedAt: new Date(),
    approvedBy: approverUserId,
    updatedAt: new Date(),
  }).where(eq(payoutLedger.id, ledgerId));

  logAudit({ actorUserId: approverUserId, action: AuditActions.PAYOUT_APPROVED, entityType: "PAYOUT_LEDGER", entityId: ledgerId, operatorId: entry.operatorId, metadata: { totalSplitsCents: entry.totalSplitsCents, periodStart: entry.periodStart } });
}

export async function markPaid(ledgerId: string, approverUserId: string, notes?: string): Promise<void> {
  const [entry] = await db.select().from(payoutLedger).where(eq(payoutLedger.id, ledgerId));
  if (!entry) throw new Error("Payout ledger entry not found");
  if (entry.status !== "APPROVED") throw new Error(`Cannot mark paid — status is ${entry.status}`);

  await db.update(payoutLedger).set({
    status: "PAID",
    paidAt: new Date(),
    notes: notes || entry.notes,
    updatedAt: new Date(),
  }).where(eq(payoutLedger.id, ledgerId));

  logAudit({ actorUserId: approverUserId, action: AuditActions.PAYOUT_PAID, entityType: "PAYOUT_LEDGER", entityId: ledgerId, operatorId: entry.operatorId, metadata: { totalSplitsCents: entry.totalSplitsCents, periodStart: entry.periodStart } });
}
