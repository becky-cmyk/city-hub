import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertTerritorySchema, insertOperatorSchema, insertOperatorTerritorySchema, payoutLedger, auditLog, revenueSplits, operators, territories, revenueTransactions, operatorTerritories } from "@shared/schema";
import { z } from "zod";
import { eq, and, gte, lte, desc, sql, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db";
import { calculateRevenueSplit, handleRevocation } from "./services/revenue";
import { logAudit, AuditActions } from "./services/audit-logger";

export function registerLicensingRoutes(app: Express, requireAdmin: any, requirePlatformAdmin?: any) {
  const platformGuard = requirePlatformAdmin || requireAdmin;

  app.post("/api/admin/territories", platformGuard, async (req: Request, res: Response) => {
    try {
      const data = insertTerritorySchema.parse(req.body);
      const existing = await storage.getTerritoryByCode(data.code);
      if (existing) return res.status(409).json({ message: "Territory code already exists" });
      if (data.type === "MICRO" && !data.parentTerritoryId) {
        return res.status(400).json({ message: "Micro territories must have a parent Metro territory" });
      }
      const territory = await storage.createTerritory(data);
      res.status(201).json(territory);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/territories", platformGuard, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.type) filters.type = req.query.type;
      if (req.query.status) filters.status = req.query.status;
      if (req.query.parentTerritoryId) filters.parentTerritoryId = req.query.parentTerritoryId;
      const list = await storage.listTerritories(filters);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/territories/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const territory = await storage.getTerritory(req.params.id);
      if (!territory) return res.status(404).json({ message: "Territory not found" });
      const children = await storage.getTerritoryChildren(territory.id);
      const operatorAssignments = await storage.getActiveOperatorsForTerritory(territory.id);
      res.json({ ...territory, children, operatorAssignments });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/territories/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const territory = await storage.updateTerritory(req.params.id, req.body);
      if (!territory) return res.status(404).json({ message: "Territory not found" });
      res.json(territory);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/operators", platformGuard, async (req: Request, res: Response) => {
    try {
      const data = insertOperatorSchema.parse(req.body);
      data.email = data.email.toLowerCase().trim();
      const operator = await storage.createOperator(data);
      logAudit({ actorUserId: (req.session as any).userId, action: AuditActions.LICENSE_CREATED, entityType: "OPERATOR", entityId: operator.id, operatorId: operator.id, metadata: { operatorType: operator.operatorType, displayName: operator.displayName } });
      res.status(201).json(operator);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/operators", platformGuard, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.operatorType) filters.operatorType = req.query.operatorType;
      if (req.query.status) filters.status = req.query.status;
      const list = await storage.listOperators(filters);

      const enriched = await Promise.all(list.map(async (op) => {
        const assignments = await storage.getOperatorTerritories(op.id);
        const territoryDetails = await Promise.all(
          assignments.map(async (a) => {
            const t = await storage.getTerritory(a.territoryId);
            return { ...a, territory: t };
          })
        );
        return { ...op, territories: territoryDetails };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/operators/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const operator = await storage.getOperator(req.params.id);
      if (!operator) return res.status(404).json({ message: "Operator not found" });
      const assignments = await storage.getOperatorTerritories(operator.id);
      res.json({ ...operator, territories: assignments });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/operators/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const operator = await storage.updateOperator(req.params.id, req.body);
      if (!operator) return res.status(404).json({ message: "Operator not found" });
      res.json(operator);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/operators/:id/revoke", platformGuard, async (req: Request, res: Response) => {
    try {
      await handleRevocation(req.params.id);
      const operator = await storage.getOperator(req.params.id);
      logAudit({ actorUserId: (req.session as any).userId, action: AuditActions.OPERATOR_REVOKED, entityType: "OPERATOR", entityId: req.params.id, operatorId: req.params.id, metadata: { displayName: operator?.displayName } });
      res.json({ message: "Operator revoked. Future revenue splits will auto-adjust.", operator });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/operator-territories", platformGuard, async (req: Request, res: Response) => {
    try {
      const data = insertOperatorTerritorySchema.parse(req.body);
      const operator = await storage.getOperator(data.operatorId);
      if (!operator) return res.status(404).json({ message: "Operator not found" });
      const territory = await storage.getTerritory(data.territoryId);
      if (!territory) return res.status(404).json({ message: "Territory not found" });
      const assignment = await storage.assignOperatorToTerritory(data);
      logAudit({ actorUserId: (req.session as any).userId, action: AuditActions.TERRITORY_ASSIGNED, entityType: "OPERATOR_TERRITORY", entityId: assignment.id, operatorId: data.operatorId, metadata: { territoryId: data.territoryId, territoryName: territory.name } });
      res.status(201).json(assignment);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/admin/operator-territories/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      await storage.removeOperatorFromTerritory(req.params.id);
      logAudit({ actorUserId: (req.session as any).userId, action: AuditActions.TERRITORY_UNASSIGNED, entityType: "OPERATOR_TERRITORY", entityId: req.params.id });
      res.json({ message: "Assignment removed" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/revenue/by-territory/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const territory = await storage.getTerritory(req.params.id);
      if (!territory) return res.status(404).json({ message: "Territory not found" });
      const listings = await storage.listTerritoryListings(territory.id);
      const allTransactions = [];
      for (const listing of listings) {
        const txns = await storage.listRevenueTransactions({ territoryListingId: listing.id });
        for (const txn of txns) {
          const splits = await storage.listSplitsByTransaction(txn.id);
          allTransactions.push({ ...txn, splits });
        }
      }
      const totalGross = allTransactions.reduce((sum, t) => sum + t.grossAmount, 0);
      res.json({ territory, totalGross, transactions: allTransactions });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/revenue/by-operator/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const operator = await storage.getOperator(req.params.id);
      if (!operator) return res.status(404).json({ message: "Operator not found" });
      const splits = await storage.listSplitsByOperator(operator.id);
      const totalEarned = splits.reduce((sum, s) => sum + s.splitAmount, 0);
      const pending = splits.filter(s => s.status === "PENDING").reduce((sum, s) => sum + s.splitAmount, 0);
      const payable = splits.filter(s => s.status === "PAYABLE").reduce((sum, s) => sum + s.splitAmount, 0);
      const paid = splits.filter(s => s.status === "PAID").reduce((sum, s) => sum + s.splitAmount, 0);
      res.json({ operator, totalEarned, pending, payable, paid, splits });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/revenue/splits", platformGuard, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.operatorId) filters.operatorId = req.query.operatorId;
      const splits = await storage.listAllSplits(filters);
      res.json(splits);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/revenue-splits/:id/status", platformGuard, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!["PENDING", "PAYABLE", "PAID"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const split = await storage.updateSplitStatus(req.params.id, status);
      if (!split) return res.status(404).json({ message: "Split not found" });
      res.json(split);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/revenue-splits/:id/override", platformGuard, async (req: Request, res: Response) => {
    try {
      const { splitAmount, splitType } = req.body;
      const updates: any = {};
      if (splitAmount !== undefined) updates.splitAmount = splitAmount;
      if (splitType) updates.splitType = splitType;
      const split = await storage.updateRevenueSplit(req.params.id, updates);
      if (!split) return res.status(404).json({ message: "Split not found" });
      res.json(split);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/revenue/summary", platformGuard, async (req: Request, res: Response) => {
    try {
      const allSplits = await storage.listAllSplits();
      const pending = allSplits.filter(s => s.status === "PENDING").reduce((sum, s) => sum + s.splitAmount, 0);
      const payable = allSplits.filter(s => s.status === "PAYABLE").reduce((sum, s) => sum + s.splitAmount, 0);
      const paid = allSplits.filter(s => s.status === "PAID").reduce((sum, s) => sum + s.splitAmount, 0);
      const totalRevenue = allSplits.reduce((sum, s) => sum + s.splitAmount, 0);

      const allTerritories = await storage.listTerritories();
      const allOperators = await storage.listOperators();

      res.json({
        totalRevenue,
        pending,
        payable,
        paid,
        territoryCount: allTerritories.length,
        operatorCount: allOperators.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/revenue/split-preview", platformGuard, async (req: Request, res: Response) => {
    try {
      const { territoryId, amount, transactionType } = req.query;
      if (!territoryId || !amount) return res.status(400).json({ message: "territoryId and amount required" });
      const grossAmount = parseInt(amount as string, 10);
      const splits = await calculateRevenueSplit(
        grossAmount,
        territoryId as string,
        (transactionType as any) || "LISTING"
      );
      res.json({ grossAmount, splits });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/license-pipeline", platformGuard, async (req: Request, res: Response) => {
    try {
      const allOperators = await storage.listOperators();
      const enriched = await Promise.all(allOperators.map(async (op) => {
        const assignments = await storage.getOperatorTerritories(op.id);
        const territoryDetails = await Promise.all(
          assignments.map(async (a) => {
            const t = await storage.getTerritory(a.territoryId);
            let city = null;
            if (t?.cityId) {
              city = await storage.getCityById(t.cityId);
            }
            return { ...a, territory: t, city };
          })
        );
        return { ...op, territories: territoryDetails };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/operators/:id/pipeline", platformGuard, async (req: Request, res: Response) => {
    try {
      const { pipelineStage, pipelineNotes, lastContactedAt } = req.body;
      const validStages = ["PROSPECT", "CONTACTED", "APPLICATION", "ONBOARDING", "ACTIVE", "SUSPENDED"];
      const updates: any = {};
      if (pipelineStage) {
        if (!validStages.includes(pipelineStage)) {
          return res.status(400).json({ message: `Invalid pipeline stage. Must be one of: ${validStages.join(", ")}` });
        }
        updates.pipelineStage = pipelineStage;
      }
      if (pipelineNotes !== undefined) updates.pipelineNotes = pipelineNotes;
      if (lastContactedAt) updates.lastContactedAt = new Date(lastContactedAt);
      const operator = await storage.updateOperator(req.params.id, updates);
      if (!operator) return res.status(404).json({ message: "Operator not found" });
      if (pipelineStage === "SUSPENDED") {
        logAudit({ actorUserId: (req.session as any).userId, action: AuditActions.LICENSE_SUSPENDED, entityType: "OPERATOR", entityId: req.params.id, operatorId: req.params.id, metadata: { pipelineStage, pipelineNotes } });
      } else if (pipelineStage === "ACTIVE") {
        logAudit({ actorUserId: (req.session as any).userId, action: AuditActions.LICENSE_REACTIVATED, entityType: "OPERATOR", entityId: req.params.id, operatorId: req.params.id, metadata: { pipelineStage } });
      }
      res.json(operator);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/payouts/generate", platformGuard, async (req: Request, res: Response) => {
    try {
      const { generateMonthlyLedger } = await import("./services/payout-engine");
      const forDate = req.body.month ? new Date(req.body.month) : new Date();
      const result = await generateMonthlyLedger(forDate);
      res.json({ message: "Monthly ledger generated", ...result });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/payouts", platformGuard, async (req: Request, res: Response) => {
    try {
      const { status, month, operatorId: opId } = req.query;
      const conditions: any[] = [];
      if (status) conditions.push(eq(payoutLedger.status, status as any));
      if (opId) conditions.push(eq(payoutLedger.operatorId, opId as string));
      if (month) {
        const d = new Date(month as string);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        conditions.push(gte(payoutLedger.periodStart, start));
        conditions.push(lte(payoutLedger.periodStart, end));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const entries = await db.select({
        id: payoutLedger.id,
        operatorId: payoutLedger.operatorId,
        operatorName: operators.displayName,
        operatorType: operators.operatorType,
        periodStart: payoutLedger.periodStart,
        periodEnd: payoutLedger.periodEnd,
        totalSplitsCents: payoutLedger.totalSplitsCents,
        splitCount: payoutLedger.splitCount,
        status: payoutLedger.status,
        approvedAt: payoutLedger.approvedAt,
        paidAt: payoutLedger.paidAt,
        notes: payoutLedger.notes,
        createdAt: payoutLedger.createdAt,
      })
        .from(payoutLedger)
        .leftJoin(operators, eq(payoutLedger.operatorId, operators.id))
        .where(where)
        .orderBy(desc(payoutLedger.periodStart));

      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/payouts/:id/approve", platformGuard, async (req: Request, res: Response) => {
    try {
      const { approvePayout } = await import("./services/payout-engine");
      await approvePayout(req.params.id, (req.session as any).userId);
      res.json({ message: "Payout approved" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/admin/payouts/:id/paid", platformGuard, async (req: Request, res: Response) => {
    try {
      const { markPaid } = await import("./services/payout-engine");
      await markPaid(req.params.id, (req.session as any).userId, req.body.notes);
      res.json({ message: "Payout marked as paid" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/payouts/:id/splits", platformGuard, async (req: Request, res: Response) => {
    try {
      const [entry] = await db.select().from(payoutLedger).where(eq(payoutLedger.id, req.params.id));
      if (!entry) return res.status(404).json({ message: "Not found" });
      const splits = await db.select().from(revenueSplits)
        .where(and(
          eq(revenueSplits.operatorId, entry.operatorId),
          gte(revenueSplits.createdAt, entry.periodStart),
          lte(revenueSplits.createdAt, entry.periodEnd),
        ))
        .orderBy(desc(revenueSplits.createdAt));
      res.json(splits);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/audit-log", platformGuard, async (req: Request, res: Response) => {
    try {
      const { action, entityType, limit: limitStr, offset: offsetStr } = req.query;
      const pageLimit = Math.min(parseInt(limitStr as string) || 50, 100);
      const pageOffset = parseInt(offsetStr as string) || 0;
      const conditions: any[] = [];
      if (action) conditions.push(eq(auditLog.action, action as string));
      if (entityType) conditions.push(eq(auditLog.entityType, entityType as string));

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const entries = await db.select().from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(pageLimit)
        .offset(pageOffset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where);
      res.json({ entries, total: count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/territory-sales", platformGuard, async (req: Request, res: Response) => {
    try {
      const conditions: any[] = [isNotNull(territories.pricingTier)];
      if (req.query.saleStatus) conditions.push(eq(territories.saleStatus, req.query.saleStatus as any));
      if (req.query.tier) conditions.push(eq(territories.pricingTier, parseInt(req.query.tier as string)));

      const results = await db.select({
        territory: territories,
        operator: {
          id: operators.id,
          displayName: operators.displayName,
          email: operators.email,
        },
      })
        .from(territories)
        .leftJoin(operators, eq(territories.soldToOperatorId, operators.id))
        .where(and(...conditions))
        .orderBy(territories.pricingTier, territories.name);

      res.json(results.map(r => ({
        ...r.territory,
        operator: r.operator?.id ? r.operator : null,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/territory-sales/summary", platformGuard, async (_req: Request, res: Response) => {
    try {
      const all = await db.select({
        saleStatus: territories.saleStatus,
        territoryPrice: territories.territoryPrice,
        cnt: sql<number>`count(*)::int`,
        totalPrice: sql<number>`coalesce(sum(${territories.territoryPrice}), 0)::int`,
      })
        .from(territories)
        .where(isNotNull(territories.pricingTier))
        .groupBy(territories.saleStatus);

      const summary: Record<string, { count: number; total: number }> = {};
      let totalPipeline = 0;
      let totalTerritories = 0;
      for (const row of all) {
        const status = row.saleStatus || "AVAILABLE";
        summary[status] = { count: row.cnt, total: row.totalPrice };
        totalPipeline += row.totalPrice;
        totalTerritories += row.cnt;
      }

      const [revCollected] = await db.select({
        total: sql<number>`coalesce(sum(${revenueTransactions.grossAmount}), 0)::int`,
      })
        .from(revenueTransactions)
        .where(eq(revenueTransactions.transactionType, "ACTIVATION"));

      res.json({
        byStatus: summary,
        totalPipeline,
        totalTerritories,
        revenueCollected: revCollected?.total || 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/territory-sales/:id/mark-sold", platformGuard, async (req: Request, res: Response) => {
    try {
      const { operatorId } = req.body;
      if (!operatorId) return res.status(400).json({ message: "operatorId is required" });

      const territory = await storage.getTerritory(req.params.id);
      if (!territory) return res.status(404).json({ message: "Territory not found" });
      if (territory.saleStatus === "ACTIVE") return res.status(409).json({ message: "Territory is already active" });
      if (territory.saleStatus === "SOLD" && territory.soldToOperatorId) return res.status(409).json({ message: "Territory is already sold" });

      const [op] = await db.select().from(operators).where(eq(operators.id, operatorId));
      if (!op) return res.status(404).json({ message: "Operator not found" });

      await db.update(territories).set({
        saleStatus: "SOLD",
        soldAt: new Date(),
        soldToOperatorId: operatorId,
        updatedAt: new Date(),
      }).where(eq(territories.id, territory.id));

      const existingAssignment = await db.select().from(operatorTerritories)
        .where(and(eq(operatorTerritories.operatorId, operatorId), eq(operatorTerritories.territoryId, territory.id)));
      if (existingAssignment.length === 0) {
        await db.insert(operatorTerritories).values({
          operatorId,
          territoryId: territory.id,
          exclusivity: "CONDITIONAL",
        });
      }

      logAudit({
        actorUserId: (req.session as any).userId,
        action: "TERRITORY_SOLD",
        entityType: "TERRITORY",
        entityId: territory.id,
        operatorId,
        metadata: { territoryName: territory.name, price: territory.territoryPrice },
      });

      const updated = await storage.getTerritory(territory.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/territory-sales/:id/send-invoice", platformGuard, async (req: Request, res: Response) => {
    try {
      const territory = await storage.getTerritory(req.params.id);
      if (!territory) return res.status(404).json({ message: "Territory not found" });
      if (!territory.soldToOperatorId) return res.status(400).json({ message: "Territory must be marked as sold first" });
      if (!territory.territoryPrice) return res.status(400).json({ message: "Territory has no price set" });

      const [op] = await db.select().from(operators).where(eq(operators.id, territory.soldToOperatorId));
      if (!op) return res.status(404).json({ message: "Operator not found" });

      let stripeAvailable = false;
      try {
        const { getStripe } = await import("./stripe/webhook");
        const stripe = getStripe();
        stripeAvailable = true;

        let customer: any;
        const existingCustomers = await stripe.customers.list({ email: op.email, limit: 1 });
        if (existingCustomers.data.length > 0) {
          customer = existingCustomers.data[0];
        } else {
          customer = await stripe.customers.create({
            email: op.email,
            name: op.displayName,
            metadata: { operator_id: op.id },
          });
        }

        const invoiceItem = await stripe.invoiceItems.create({
          customer: customer.id,
          amount: territory.territoryPrice,
          currency: "usd",
          description: `Territory Activation: ${territory.name} (Tier ${territory.pricingTier})`,
          metadata: {
            territory_id: territory.id,
            territory_code: territory.code,
            type: "TERRITORY_ACTIVATION",
          },
        });

        const invoice = await stripe.invoices.create({
          customer: customer.id,
          collection_method: "send_invoice",
          days_until_due: 7,
          metadata: {
            territory_id: territory.id,
            territory_code: territory.code,
            type: "TERRITORY_ACTIVATION",
          },
        });

        await stripe.invoices.sendInvoice(invoice.id);

        await db.update(territories).set({
          activationStripeInvoiceId: invoice.id,
          updatedAt: new Date(),
        }).where(eq(territories.id, territory.id));

        logAudit({
          actorUserId: (req.session as any).userId,
          action: "TERRITORY_INVOICE_SENT",
          entityType: "TERRITORY",
          entityId: territory.id,
          metadata: { invoiceId: invoice.id, amount: territory.territoryPrice },
        });

        res.json({ invoiceId: invoice.id, invoiceUrl: invoice.hosted_invoice_url, status: "sent" });
      } catch (stripeErr: any) {
        if (!stripeAvailable) {
          return res.status(503).json({ message: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable invoicing." });
        }
        throw stripeErr;
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/territory-sales/:id/create-checkout", platformGuard, async (req: Request, res: Response) => {
    try {
      const territory = await storage.getTerritory(req.params.id);
      if (!territory) return res.status(404).json({ message: "Territory not found" });
      if (!territory.soldToOperatorId) return res.status(400).json({ message: "Territory must be marked as sold first" });
      if (!territory.territoryPrice) return res.status(400).json({ message: "Territory has no price set" });

      const [op] = await db.select().from(operators).where(eq(operators.id, territory.soldToOperatorId));
      if (!op) return res.status(404).json({ message: "Operator not found" });

      const { getStripe } = await import("./stripe/webhook");
      const stripe = getStripe();

      let customer: any;
      const existingCustomers = await stripe.customers.list({ email: op.email, limit: 1 });
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: op.email,
          name: op.displayName,
          metadata: { operator_id: op.id },
        });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: territory.territoryPrice,
            product_data: {
              name: `Territory Activation: ${territory.name}`,
              description: `Tier ${territory.pricingTier} territory — ${territory.name} micro hub activation`,
            },
          },
          quantity: 1,
        }],
        metadata: {
          territory_id: territory.id,
          territory_code: territory.code,
          type: "TERRITORY_ACTIVATION",
        },
        success_url: `${req.headers.origin || "https://cltcityhub.com"}/admin?section=territory-sales&activated=${territory.id}`,
        cancel_url: `${req.headers.origin || "https://cltcityhub.com"}/admin?section=territory-sales`,
      });

      await db.update(territories).set({
        activationStripeInvoiceId: session.id,
        updatedAt: new Date(),
      }).where(eq(territories.id, territory.id));

      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/territory-sales/:id/confirm-activation", platformGuard, async (req: Request, res: Response) => {
    try {
      const territory = await storage.getTerritory(req.params.id);
      if (!territory) return res.status(404).json({ message: "Territory not found" });
      if (!territory.soldToOperatorId) return res.status(400).json({ message: "Territory must be marked as sold first" });
      if (!territory.territoryPrice) return res.status(400).json({ message: "Territory has no price set" });
      if (territory.activationPaidAt) return res.status(409).json({ message: "Territory activation already confirmed" });

      const now = new Date();
      const quarterlyStart = new Date(now);
      quarterlyStart.setDate(quarterlyStart.getDate() + 90);

      await db.update(territories).set({
        saleStatus: "ACTIVE",
        activationPaidAt: now,
        quarterlyBillingStartDate: quarterlyStart,
        updatedAt: now,
      }).where(eq(territories.id, territory.id));

      await db.insert(revenueTransactions).values({
        grossAmount: territory.territoryPrice,
        transactionType: "ACTIVATION",
        paymentMethod: "manual",
        businessId: null,
        notes: `Territory activation: ${territory.name} (Tier ${territory.pricingTier}) [manual]`,
      });

      logAudit({
        actorUserId: (req.session as any).userId,
        action: "TERRITORY_ACTIVATED",
        entityType: "TERRITORY",
        entityId: territory.id,
        metadata: { activatedAt: now.toISOString(), quarterlyStart: quarterlyStart.toISOString(), method: "manual" },
      });

      const updated = await storage.getTerritory(territory.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/territory-sales/:id/revenue-minimum", platformGuard, async (req: Request, res: Response) => {
    try {
      const { revenueMinimum } = req.body;
      if (revenueMinimum === undefined || revenueMinimum === null) {
        return res.status(400).json({ message: "revenueMinimum is required (in cents)" });
      }
      const parsedMin = parseInt(revenueMinimum);
      if (isNaN(parsedMin) || parsedMin < 0) {
        return res.status(400).json({ message: "revenueMinimum must be a non-negative number" });
      }

      const territory = await storage.getTerritory(req.params.id);
      if (!territory) return res.status(404).json({ message: "Territory not found" });

      await db.update(territories).set({
        revenueMinimum: parsedMin,
        updatedAt: new Date(),
      }).where(eq(territories.id, territory.id));

      const updated = await storage.getTerritory(territory.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/territory-sales/alerts", platformGuard, async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

      const activeWithMins = await db.select({
        territory: territories,
        operator: {
          id: operators.id,
          displayName: operators.displayName,
          email: operators.email,
        },
      })
        .from(territories)
        .leftJoin(operators, eq(territories.soldToOperatorId, operators.id))
        .where(and(
          eq(territories.saleStatus, "ACTIVE"),
          isNotNull(territories.revenueMinimum),
        ));

      const alerts: any[] = [];
      for (const row of activeWithMins) {
        const t = row.territory;
        if (!t.revenueMinimum) continue;

        const [revResult] = await db.select({
          total: sql<number>`coalesce(sum(${revenueTransactions.grossAmount}), 0)::int`,
          lastTx: sql<string>`max(${revenueTransactions.createdAt})`,
        })
          .from(revenueTransactions)
          .where(and(
            gte(revenueTransactions.createdAt, quarterStart),
            sql`${revenueTransactions.notes} ilike ${'%' + t.name + '%'}`,
          ));

        const actual = revResult?.total || 0;
        if (actual < t.revenueMinimum) {
          alerts.push({
            territoryId: t.id,
            territoryName: t.name,
            pricingTier: t.pricingTier,
            operator: row.operator?.id ? row.operator : null,
            revenueMinimum: t.revenueMinimum,
            actualRevenue: actual,
            shortfall: t.revenueMinimum - actual,
            lastTransactionDate: revResult?.lastTx || null,
          });
        }
      }

      res.json({ alerts, count: alerts.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/platform/stats", platformGuard, async (req: Request, res: Response) => {
    try {
      const { pool } = await import("./db");

      const citiesResult = await pool.query(`SELECT id, name, slug, city_code, is_active, primary_color FROM cities ORDER BY name`);
      const allCities = citiesResult.rows;
      const activeCities = allCities.filter((c: { is_active: boolean }) => c.is_active);

      const bizCountResult = await pool.query(`SELECT city_id, COUNT(*)::int as cnt FROM businesses GROUP BY city_id`);
      const bizCounts = new Map<string, number>();
      for (const row of bizCountResult.rows) {
        bizCounts.set(row.city_id, row.cnt);
      }

      const allOperators = await storage.listOperators();
      const allTerritories = await storage.listTerritories();
      const soldTerritories = allTerritories.filter((t: { soldToOperatorId: string | null }) => t.soldToOperatorId);

      const pipelineResult = await pool.query(
        `SELECT pipeline_stage, COUNT(*)::int as cnt FROM operators WHERE pipeline_stage IS NOT NULL GROUP BY pipeline_stage ORDER BY pipeline_stage`
      );
      const pipeline = pipelineResult.rows.map((r: { pipeline_stage: string; cnt: number }) => ({
        stage: r.pipeline_stage,
        count: r.cnt,
      }));

      const mrrResult = await pool.query(
        `SELECT COALESCE(SUM(gross_amount), 0)::int as total FROM revenue_transactions WHERE created_at >= NOW() - INTERVAL '30 days'`
      );
      const totalMrr = mrrResult.rows[0]?.total || 0;

      const mrrByCityResult = await pool.query(
        `SELECT b.city_id, COALESCE(SUM(rt.gross_amount), 0)::int as mrr
         FROM revenue_transactions rt
         JOIN businesses b ON rt.business_id = b.id
         WHERE rt.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY b.city_id`
      );
      const mrrByCity = new Map<string, number>();
      for (const row of mrrByCityResult.rows) {
        mrrByCity.set(row.city_id, row.mrr);
      }

      const revenueByMetro = allCities.map((c: { id: string; name: string; city_code: string; is_active: boolean }) => ({
        cityName: c.name,
        cityCode: c.city_code || c.name.substring(0, 3).toUpperCase(),
        mrr: mrrByCity.get(c.id) || 0,
        businessCount: bizCounts.get(c.id) || 0,
        isActive: c.is_active,
      }));

      const pendingOps = allOperators
        .filter((o: { pipelineStage: string | null; status: string }) => o.pipelineStage && o.pipelineStage !== "LAUNCHED" && o.status !== "REVOKED")
        .slice(0, 5)
        .map((o: { id: string; companyName: string; pipelineStage: string | null; territory?: string }) => ({
          id: o.id,
          name: o.companyName || "Unnamed",
          territory: o.territory || "",
          stage: o.pipelineStage || "PROSPECT",
          value: 0,
        }));

      res.json({
        totalMetros: allCities.length,
        activeMetros: activeCities.length,
        totalBusinesses: Array.from(bizCounts.values()).reduce((a, b) => a + b, 0),
        totalOperators: allOperators.length,
        territoriesSold: soldTerritories.length,
        territoriesAvailable: allTerritories.length - soldTerritories.length,
        totalMrr,
        revenueByMetro,
        pipeline,
        pendingDeals: pendingOps,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Platform Stats]", message);
      res.status(500).json({ message });
    }
  });

}
