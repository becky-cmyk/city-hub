import { pool } from "./db";
import { PRESENCE_BASE_ALLOCATIONS } from "@shared/schema";
import type {
  HubEntitlement, CategoryEntitlement, MicroEntitlement,
  CapabilityEntitlement, CreditWallet, CreditTransaction,
  CreditActionCost, PlanVersion,
  CapabilityType,
} from "@shared/schema";
import type { Request, Response, NextFunction } from "express";

export interface AllocationCheck {
  allowed: boolean;
  isIncluded: boolean;
  usedCount: number;
  includedCount: number;
}

export async function checkHubAllocation(presenceId: string): Promise<AllocationCheck> {
  const hubs = await getActiveHubEntitlements(presenceId);
  const baseHubs = hubs.filter(h => h.isBaseHub);
  const includedCount = PRESENCE_BASE_ALLOCATIONS.hubsIncluded;
  return {
    allowed: baseHubs.length < includedCount,
    isIncluded: baseHubs.length < includedCount,
    usedCount: baseHubs.length,
    includedCount,
  };
}

export async function checkCategoryAllocation(presenceId: string, hubEntitlementId: string): Promise<AllocationCheck> {
  const cats = await getActiveCategoryEntitlements(presenceId, hubEntitlementId);
  const baseCats = cats.filter(c => c.isBaseCategory);
  const includedCount = PRESENCE_BASE_ALLOCATIONS.categoriesPerHub;
  return {
    allowed: baseCats.length < includedCount,
    isIncluded: baseCats.length < includedCount,
    usedCount: baseCats.length,
    includedCount,
  };
}

export async function checkMicroAllocation(presenceId: string, categoryEntitlementId: string): Promise<AllocationCheck> {
  const micros = await getActiveMicroEntitlements(presenceId, categoryEntitlementId);
  const baseMicros = micros.filter(m => m.isBaseMicro);
  const includedCount = PRESENCE_BASE_ALLOCATIONS.microsPerCategory;
  return {
    allowed: baseMicros.length < includedCount,
    isIncluded: baseMicros.length < includedCount,
    usedCount: baseMicros.length,
    includedCount,
  };
}

export async function getRemainingAllocations(presenceId: string): Promise<{
  hubsRemaining: number;
  categoriesRemaining: Record<string, number>;
  microsRemaining: Record<string, number>;
}> {
  const hubs = await getActiveHubEntitlements(presenceId);
  const baseHubCount = hubs.filter(h => h.isBaseHub).length;
  const hubsRemaining = Math.max(0, PRESENCE_BASE_ALLOCATIONS.hubsIncluded - baseHubCount);

  const categoriesRemaining: Record<string, number> = {};
  const microsRemaining: Record<string, number> = {};

  for (const hub of hubs) {
    const cats = await getActiveCategoryEntitlements(presenceId, hub.id);
    const baseCatCount = cats.filter(c => c.isBaseCategory).length;
    categoriesRemaining[hub.id] = Math.max(0, PRESENCE_BASE_ALLOCATIONS.categoriesPerHub - baseCatCount);

    for (const cat of cats) {
      const micros = await getActiveMicroEntitlements(presenceId, cat.id);
      const baseMicroCount = micros.filter(m => m.isBaseMicro).length;
      microsRemaining[cat.id] = Math.max(0, PRESENCE_BASE_ALLOCATIONS.microsPerCategory - baseMicroCount);
    }
  }

  return { hubsRemaining, categoriesRemaining, microsRemaining };
}

export async function getActiveHubEntitlements(presenceId: string): Promise<HubEntitlement[]> {
  const { rows } = await pool.query(
    `SELECT * FROM hub_entitlements WHERE presence_id = $1 AND status = 'ACTIVE'`,
    [presenceId]
  );
  return rows.map(mapHubEntitlement);
}

export async function getHubEntitlement(presenceId: string, hubId: string): Promise<HubEntitlement | null> {
  const { rows } = await pool.query(
    `SELECT * FROM hub_entitlements WHERE presence_id = $1 AND hub_id = $2 AND status = 'ACTIVE' LIMIT 1`,
    [presenceId, hubId]
  );
  return rows.length > 0 ? mapHubEntitlement(rows[0]) : null;
}

export async function createHubEntitlement(data: {
  presenceId: string; hubId: string; cityId: string; isBaseHub?: boolean;
  billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number;
  endAt?: Date;
}): Promise<HubEntitlement> {
  const { rows } = await pool.query(
    `INSERT INTO hub_entitlements (presence_id, hub_id, city_id, is_base_hub, billing_interval, stripe_subscription_id, amount_cents, end_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.presenceId, data.hubId, data.cityId, data.isBaseHub || false,
     data.billingInterval || "monthly", data.stripeSubscriptionId || null,
     data.amountCents || null, data.endAt || null]
  );
  return mapHubEntitlement(rows[0]);
}

export async function getActiveCategoryEntitlements(presenceId: string, hubEntitlementId?: string): Promise<CategoryEntitlement[]> {
  let query = `SELECT * FROM category_entitlements WHERE presence_id = $1 AND status = 'ACTIVE'`;
  const params: any[] = [presenceId];
  if (hubEntitlementId) {
    query += ` AND hub_entitlement_id = $2`;
    params.push(hubEntitlementId);
  }
  const { rows } = await pool.query(query, params);
  return rows.map(mapCategoryEntitlement);
}

export async function getCategoryEntitlement(presenceId: string, hubEntitlementId: string, categoryId: string): Promise<CategoryEntitlement | null> {
  const { rows } = await pool.query(
    `SELECT * FROM category_entitlements WHERE presence_id = $1 AND hub_entitlement_id = $2 AND category_id = $3 AND status = 'ACTIVE' LIMIT 1`,
    [presenceId, hubEntitlementId, categoryId]
  );
  return rows.length > 0 ? mapCategoryEntitlement(rows[0]) : null;
}

export async function createCategoryEntitlement(data: {
  presenceId: string; hubEntitlementId: string; categoryId: string; isBaseCategory?: boolean;
  billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date;
}): Promise<CategoryEntitlement> {
  const { rows } = await pool.query(
    `INSERT INTO category_entitlements (presence_id, hub_entitlement_id, category_id, is_base_category, billing_interval, stripe_subscription_id, amount_cents, end_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.presenceId, data.hubEntitlementId, data.categoryId, data.isBaseCategory || false,
     data.billingInterval || "monthly", data.stripeSubscriptionId || null,
     data.amountCents || null, data.endAt || null]
  );
  return mapCategoryEntitlement(rows[0]);
}

export async function getActiveMicroEntitlements(presenceId: string, categoryEntitlementId?: string): Promise<MicroEntitlement[]> {
  let query = `SELECT * FROM micro_entitlements WHERE presence_id = $1 AND status = 'ACTIVE'`;
  const params: any[] = [presenceId];
  if (categoryEntitlementId) {
    query += ` AND category_entitlement_id = $2`;
    params.push(categoryEntitlementId);
  }
  const { rows } = await pool.query(query, params);
  return rows.map(mapMicroEntitlement);
}

export async function getMicroEntitlement(presenceId: string, categoryEntitlementId: string, microId: string): Promise<MicroEntitlement | null> {
  const { rows } = await pool.query(
    `SELECT * FROM micro_entitlements WHERE presence_id = $1 AND category_entitlement_id = $2 AND micro_id = $3 AND status = 'ACTIVE' LIMIT 1`,
    [presenceId, categoryEntitlementId, microId]
  );
  return rows.length > 0 ? mapMicroEntitlement(rows[0]) : null;
}

export async function createMicroEntitlement(data: {
  presenceId: string; categoryEntitlementId: string; microId: string; isBaseMicro?: boolean;
  billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date;
}): Promise<MicroEntitlement> {
  const { rows } = await pool.query(
    `INSERT INTO micro_entitlements (presence_id, category_entitlement_id, micro_id, is_base_micro, billing_interval, stripe_subscription_id, amount_cents, end_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.presenceId, data.categoryEntitlementId, data.microId, data.isBaseMicro || false,
     data.billingInterval || "monthly", data.stripeSubscriptionId || null,
     data.amountCents || null, data.endAt || null]
  );
  return mapMicroEntitlement(rows[0]);
}

export async function getActiveCapabilities(presenceId: string, hubEntitlementId?: string): Promise<CapabilityEntitlement[]> {
  let query = `SELECT * FROM capability_entitlements WHERE presence_id = $1 AND status = 'ACTIVE'`;
  const params: any[] = [presenceId];
  if (hubEntitlementId) {
    query += ` AND hub_entitlement_id = $2`;
    params.push(hubEntitlementId);
  }
  const { rows } = await pool.query(query, params);
  return rows.map(mapCapabilityEntitlement);
}

export async function hasCapability(presenceId: string, hubEntitlementId: string, capabilityType: CapabilityType): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM capability_entitlements WHERE presence_id = $1 AND hub_entitlement_id = $2 AND capability_type = $3 AND status = 'ACTIVE' LIMIT 1`,
    [presenceId, hubEntitlementId, capabilityType]
  );
  return rows.length > 0;
}

export async function getCapabilityEntitlement(presenceId: string, hubEntitlementId: string, capabilityType: CapabilityType): Promise<CapabilityEntitlement | null> {
  const { rows } = await pool.query(
    `SELECT * FROM capability_entitlements WHERE presence_id = $1 AND hub_entitlement_id = $2 AND capability_type = $3 AND status IN ('ACTIVE', 'GRACE', 'EXPIRED') ORDER BY created_at DESC LIMIT 1`,
    [presenceId, hubEntitlementId, capabilityType]
  );
  return rows.length > 0 ? mapCapabilityEntitlement(rows[0]) : null;
}

export async function createCapabilityEntitlement(data: {
  presenceId: string; hubEntitlementId: string; capabilityType: CapabilityType;
  billingInterval?: string; stripeSubscriptionId?: string; amountCents?: number; endAt?: Date;
}): Promise<CapabilityEntitlement> {
  const { rows } = await pool.query(
    `INSERT INTO capability_entitlements (presence_id, hub_entitlement_id, capability_type, billing_interval, stripe_subscription_id, amount_cents, end_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.presenceId, data.hubEntitlementId, data.capabilityType,
     data.billingInterval || "monthly", data.stripeSubscriptionId || null,
     data.amountCents || null, data.endAt || null]
  );
  return mapCapabilityEntitlement(rows[0]);
}

export interface PresenceEntitlementSummary {
  hubs: (HubEntitlement & {
    categories: (CategoryEntitlement & {
      micros: MicroEntitlement[];
    })[];
    capabilities: CapabilityEntitlement[];
  })[];
  creditWallet: CreditWallet | null;
}

export async function getPresenceEntitlementSummary(presenceId: string): Promise<PresenceEntitlementSummary> {
  const hubs = await getActiveHubEntitlements(presenceId);
  const enrichedHubs = await Promise.all(hubs.map(async (hub) => {
    const categories = await getActiveCategoryEntitlements(presenceId, hub.id);
    const enrichedCats = await Promise.all(categories.map(async (cat) => {
      const micros = await getActiveMicroEntitlements(presenceId, cat.id);
      return { ...cat, micros };
    }));
    const capabilities = await getActiveCapabilities(presenceId, hub.id);
    return { ...hub, categories: enrichedCats, capabilities };
  }));
  const wallet = await getCreditWallet(presenceId);
  return { hubs: enrichedHubs, creditWallet: wallet };
}

export async function checkHubAccess(presenceId: string, hubId: string): Promise<{ allowed: boolean; hubEntitlement?: HubEntitlement; canAutoProvision?: boolean }> {
  const ent = await getHubEntitlement(presenceId, hubId);
  if (ent) return { allowed: true, hubEntitlement: ent };
  const allocation = await checkHubAllocation(presenceId);
  if (allocation.allowed) {
    return { allowed: true, canAutoProvision: true };
  }
  return { allowed: false };
}

export async function checkCategoryAccess(presenceId: string, hubId: string, categoryId: string): Promise<{ allowed: boolean; categoryEntitlement?: CategoryEntitlement; canAutoProvision?: boolean }> {
  const hubEnt = await getHubEntitlement(presenceId, hubId);
  if (!hubEnt) {
    const hubAccess = await checkHubAccess(presenceId, hubId);
    if (!hubAccess.allowed) return { allowed: false };
    return { allowed: true, canAutoProvision: true };
  }
  const catEnt = await getCategoryEntitlement(presenceId, hubEnt.id, categoryId);
  if (catEnt) return { allowed: true, categoryEntitlement: catEnt };
  const allocation = await checkCategoryAllocation(presenceId, hubEnt.id);
  if (allocation.allowed) {
    return { allowed: true, canAutoProvision: true };
  }
  return { allowed: false };
}

export async function checkMicroAccess(presenceId: string, hubId: string, categoryId: string, microId: string): Promise<{ allowed: boolean; canAutoProvision?: boolean }> {
  const hubEnt = await getHubEntitlement(presenceId, hubId);
  if (!hubEnt) {
    const hubAccess = await checkHubAccess(presenceId, hubId);
    if (!hubAccess.allowed) return { allowed: false };
    return { allowed: true, canAutoProvision: true };
  }
  const catEnt = await getCategoryEntitlement(presenceId, hubEnt.id, categoryId);
  if (!catEnt) {
    const catAccess = await checkCategoryAccess(presenceId, hubId, categoryId);
    if (!catAccess.allowed) return { allowed: false };
    return { allowed: true, canAutoProvision: true };
  }
  const microEnt = await getMicroEntitlement(presenceId, catEnt.id, microId);
  if (microEnt) return { allowed: true };
  const allocation = await checkMicroAllocation(presenceId, catEnt.id);
  if (allocation.allowed) {
    return { allowed: true, canAutoProvision: true };
  }
  return { allowed: false };
}

export async function checkCapabilityAccess(presenceId: string, hubId: string, capabilityType: CapabilityType): Promise<{ allowed: boolean }> {
  const hubEnt = await getHubEntitlement(presenceId, hubId);
  if (!hubEnt) return { allowed: false };
  const has = await hasCapability(presenceId, hubEnt.id, capabilityType);
  return { allowed: has };
}

export async function getCreditWallet(presenceId: string): Promise<CreditWallet | null> {
  const { rows } = await pool.query(
    `SELECT * FROM credit_wallets WHERE presence_id = $1 LIMIT 1`,
    [presenceId]
  );
  return rows.length > 0 ? mapCreditWallet(rows[0]) : null;
}

export async function getOrCreateCreditWallet(presenceId: string): Promise<CreditWallet> {
  const existing = await getCreditWallet(presenceId);
  if (existing) return existing;
  const { rows } = await pool.query(
    `INSERT INTO credit_wallets (presence_id, monthly_balance, banked_balance) VALUES ($1, 0, 0)
     ON CONFLICT (presence_id) DO UPDATE SET updated_at = NOW() RETURNING *`,
    [presenceId]
  );
  return mapCreditWallet(rows[0]);
}

export async function getCreditBalance(presenceId: string): Promise<{ monthly: number; banked: number; total: number }> {
  const wallet = await getCreditWallet(presenceId);
  if (!wallet) return { monthly: 0, banked: 0, total: 0 };
  return { monthly: wallet.monthlyBalance, banked: wallet.bankedBalance, total: wallet.monthlyBalance + wallet.bankedBalance };
}

export async function grantMonthlyCredits(presenceId: string, amount: number): Promise<CreditWallet> {
  const wallet = await getOrCreateCreditWallet(presenceId);
  const newMonthly = amount;
  const { rows } = await pool.query(
    `UPDATE credit_wallets SET monthly_balance = $1, monthly_reset_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
    [newMonthly, wallet.id]
  );
  await pool.query(
    `INSERT INTO credit_transactions (wallet_id, tx_type, amount, balance_after_monthly, balance_after_banked, note)
     VALUES ($1, 'MONTHLY_GRANT', $2, $3, $4, 'Monthly credit grant')`,
    [wallet.id, amount, newMonthly, wallet.bankedBalance]
  );
  return mapCreditWallet(rows[0]);
}

export async function purchaseCredits(presenceId: string, amount: number, referenceId?: string): Promise<CreditWallet> {
  const wallet = await getOrCreateCreditWallet(presenceId);
  const newBanked = wallet.bankedBalance + amount;
  const { rows } = await pool.query(
    `UPDATE credit_wallets SET banked_balance = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [newBanked, wallet.id]
  );
  await pool.query(
    `INSERT INTO credit_transactions (wallet_id, tx_type, amount, balance_after_monthly, balance_after_banked, reference_id, note)
     VALUES ($1, 'PURCHASED', $2, $3, $4, $5, 'Credit pack purchase')`,
    [wallet.id, amount, wallet.monthlyBalance, newBanked, referenceId || null]
  );
  return mapCreditWallet(rows[0]);
}

export async function adminGrantCredits(presenceId: string, amount: number, note?: string): Promise<CreditWallet> {
  const wallet = await getOrCreateCreditWallet(presenceId);
  const newBanked = wallet.bankedBalance + amount;
  const { rows } = await pool.query(
    `UPDATE credit_wallets SET banked_balance = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [newBanked, wallet.id]
  );
  await pool.query(
    `INSERT INTO credit_transactions (wallet_id, tx_type, amount, balance_after_monthly, balance_after_banked, note)
     VALUES ($1, 'ADMIN_GRANT', $2, $3, $4, $5)`,
    [wallet.id, amount, wallet.monthlyBalance, newBanked, note || "Admin credit grant"]
  );
  return mapCreditWallet(rows[0]);
}

export async function spendCredits(presenceId: string, amount: number, actionType: string, referenceId?: string): Promise<{ success: boolean; wallet?: CreditWallet; shortfall?: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const walletRes = await client.query(
      `SELECT * FROM credit_wallets WHERE presence_id = $1 FOR UPDATE`,
      [presenceId]
    );

    if (walletRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, shortfall: amount };
    }

    const w = walletRes.rows[0];
    const total = w.monthly_balance + w.banked_balance;
    if (total < amount) {
      await client.query("ROLLBACK");
      return { success: false, shortfall: amount - total };
    }

    let monthlySpend = Math.min(w.monthly_balance, amount);
    let bankedSpend = amount - monthlySpend;
    let newMonthly = w.monthly_balance - monthlySpend;
    let newBanked = w.banked_balance - bankedSpend;

    const { rows } = await client.query(
      `UPDATE credit_wallets SET monthly_balance = $1, banked_balance = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [newMonthly, newBanked, w.id]
    );

    await client.query(
      `INSERT INTO credit_transactions (wallet_id, tx_type, amount, balance_after_monthly, balance_after_banked, action_type, reference_id, note)
       VALUES ($1, 'SPEND', $2, $3, $4, $5, $6, $7)`,
      [w.id, -amount, newMonthly, newBanked, actionType, referenceId || null, `Spent ${amount} credits on ${actionType}`]
    );

    await client.query("COMMIT");
    return { success: true, wallet: mapCreditWallet(rows[0]) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function expireMonthlyCredits(presenceId: string): Promise<number> {
  const wallet = await getCreditWallet(presenceId);
  if (!wallet || wallet.monthlyBalance <= 0) return 0;

  const expired = wallet.monthlyBalance;
  await pool.query(
    `UPDATE credit_wallets SET monthly_balance = 0, updated_at = NOW() WHERE id = $1`,
    [wallet.id]
  );
  await pool.query(
    `INSERT INTO credit_transactions (wallet_id, tx_type, amount, balance_after_monthly, balance_after_banked, note)
     VALUES ($1, 'EXPIRATION', $2, 0, $3, 'Monthly credits expired')`,
    [wallet.id, -expired, wallet.bankedBalance]
  );
  return expired;
}

export async function getCreditTransactions(presenceId: string, limit: number = 50): Promise<CreditTransaction[]> {
  const wallet = await getCreditWallet(presenceId);
  if (!wallet) return [];
  const { rows } = await pool.query(
    `SELECT * FROM credit_transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [wallet.id, limit]
  );
  return rows.map(mapCreditTransaction);
}

export async function getCreditActionCost(actionType: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT cost_credits FROM credit_action_costs WHERE action_type = $1 AND is_active = TRUE LIMIT 1`,
    [actionType]
  );
  return rows.length > 0 ? rows[0].cost_credits : null;
}

export async function getAllCreditActionCosts(): Promise<CreditActionCost[]> {
  const { rows } = await pool.query(`SELECT * FROM credit_action_costs ORDER BY action_type`);
  return rows.map(mapCreditActionCost);
}

export async function upsertCreditActionCost(actionType: string, label: string, costCredits: number, canSubstituteAddon?: string | null): Promise<CreditActionCost> {
  const { rows } = await pool.query(
    `INSERT INTO credit_action_costs (action_type, label, cost_credits, can_substitute_addon) VALUES ($1, $2, $3, $4)
     ON CONFLICT (action_type) DO UPDATE SET label = $2, cost_credits = $3, can_substitute_addon = $4, updated_at = NOW() RETURNING *`,
    [actionType, label, costCredits, canSubstituteAddon ?? null]
  );
  return mapCreditActionCost(rows[0]);
}

export async function getCurrentPlanVersion(): Promise<PlanVersion | null> {
  const { rows } = await pool.query(
    `SELECT * FROM plan_versions WHERE is_current_offering = TRUE LIMIT 1`
  );
  return rows.length > 0 ? mapPlanVersion(rows[0]) : null;
}

export async function getFounderPlanVersion(): Promise<PlanVersion | null> {
  const { rows } = await pool.query(
    `SELECT * FROM plan_versions WHERE is_founder_plan = TRUE LIMIT 1`
  );
  return rows.length > 0 ? mapPlanVersion(rows[0]) : null;
}

export async function getAllPlanVersions(): Promise<PlanVersion[]> {
  const { rows } = await pool.query(`SELECT * FROM plan_versions ORDER BY created_at`);
  return rows.map(mapPlanVersion);
}

export async function upsertPlanVersion(data: {
  versionKey: string; label: string;
  presenceMonthly: number; presenceAnnual: number;
  hubAddonMonthly: number; hubAddonAnnual: number;
  categoryAddonMonthly: number; categoryAddonAnnual: number;
  microAddonMonthly: number; microAddonAnnual: number;
  monthlyCreditsIncluded: number;
  isCurrentOffering: boolean; isFounderPlan: boolean;
}): Promise<PlanVersion> {
  if (data.isCurrentOffering) {
    await pool.query(`UPDATE plan_versions SET is_current_offering = FALSE WHERE is_current_offering = TRUE`);
  }
  const { rows } = await pool.query(
    `INSERT INTO plan_versions (version_key, label, presence_monthly, presence_annual, hub_addon_monthly, hub_addon_annual,
     category_addon_monthly, category_addon_annual, micro_addon_monthly, micro_addon_annual, monthly_credits_included,
     is_current_offering, is_founder_plan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (version_key) DO UPDATE SET label=$2, presence_monthly=$3, presence_annual=$4,
     hub_addon_monthly=$5, hub_addon_annual=$6, category_addon_monthly=$7, category_addon_annual=$8,
     micro_addon_monthly=$9, micro_addon_annual=$10, monthly_credits_included=$11,
     is_current_offering=$12, is_founder_plan=$13, updated_at=NOW() RETURNING *`,
    [data.versionKey, data.label, data.presenceMonthly, data.presenceAnnual,
     data.hubAddonMonthly, data.hubAddonAnnual, data.categoryAddonMonthly, data.categoryAddonAnnual,
     data.microAddonMonthly, data.microAddonAnnual, data.monthlyCreditsIncluded,
     data.isCurrentOffering, data.isFounderPlan]
  );
  return mapPlanVersion(rows[0]);
}

const ENTITLEMENT_TABLES: Record<string, string> = {
  hub_entitlements: "hub_entitlements",
  category_entitlements: "category_entitlements",
  micro_entitlements: "micro_entitlements",
  capability_entitlements: "capability_entitlements",
};

export async function updateEntitlementStatus(table: string, id: string, status: string, graceExpiresAt?: Date): Promise<void> {
  const safeTable = ENTITLEMENT_TABLES[table];
  if (!safeTable) throw new Error(`Invalid entitlement table: ${table}`);
  if (graceExpiresAt) {
    await pool.query(
      `UPDATE ${safeTable} SET status = $1, grace_expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [status, graceExpiresAt, id]
    );
  } else {
    await pool.query(
      `UPDATE ${safeTable} SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );
  }
}

export async function processExpiredHubGracePeriods(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE hub_entitlements SET status = 'EXPIRED', updated_at = NOW() WHERE status = 'GRACE' AND grace_expires_at < NOW()`
  );
  const { rowCount: catCount } = await pool.query(
    `UPDATE category_entitlements SET status = 'EXPIRED', updated_at = NOW() WHERE status = 'GRACE' AND grace_expires_at < NOW()`
  );
  const { rowCount: microCount } = await pool.query(
    `UPDATE micro_entitlements SET status = 'EXPIRED', updated_at = NOW() WHERE status = 'GRACE' AND grace_expires_at < NOW()`
  );
  const { rowCount: capCount } = await pool.query(
    `UPDATE capability_entitlements SET status = 'EXPIRED', updated_at = NOW() WHERE status = 'GRACE' AND grace_expires_at < NOW()`
  );
  return (rowCount || 0) + (catCount || 0) + (microCount || 0) + (capCount || 0);
}

export function requireHubEntitlement() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const presenceId = (req as any)._businessId || req.params.businessId;
    const hubId = (req as any)._hubId || req.body?.hubId || req.params.hubId;
    if (!presenceId || !hubId) {
      return res.status(400).json({ error: "MISSING_CONTEXT", message: "presenceId and hubId required" });
    }
    const { allowed } = await checkHubAccess(presenceId, hubId);
    if (!allowed) {
      return res.status(403).json({
        error: "HUB_ENTITLEMENT_REQUIRED",
        message: "Active hub entitlement required for this hub",
        presenceId, hubId,
      });
    }
    next();
  };
}

export function requireCapability(capabilityType: CapabilityType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const presenceId = (req as any)._businessId || req.params.businessId;
    const hubId = (req as any)._hubId || req.body?.hubId || req.params.hubId;
    if (!presenceId || !hubId) {
      return res.status(400).json({ error: "MISSING_CONTEXT", message: "presenceId and hubId required" });
    }
    const { allowed } = await checkCapabilityAccess(presenceId, hubId, capabilityType);
    if (!allowed) {
      return res.status(403).json({
        error: "CAPABILITY_REQUIRED",
        message: `Active ${capabilityType} capability required`,
        requiredCapability: capabilityType,
        presenceId, hubId,
      });
    }
    next();
  };
}

export function requireCategoryEntitlement() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const presenceId = (req as any)._businessId || req.params.businessId;
    const hubId = (req as any)._hubId || req.body?.hubId || req.params.hubId;
    const categoryId = (req as any)._categoryId || req.body?.categoryId || req.params.categoryId;
    if (!presenceId || !hubId || !categoryId) {
      return res.status(400).json({ error: "MISSING_CONTEXT", message: "presenceId, hubId, and categoryId required" });
    }
    const { allowed } = await checkCategoryAccess(presenceId, hubId, categoryId);
    if (!allowed) {
      return res.status(403).json({
        error: "CATEGORY_ENTITLEMENT_REQUIRED",
        message: "Active category entitlement required",
        presenceId, hubId, categoryId,
      });
    }
    next();
  };
}

export function requireVerification() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const presenceId = (req as any)._businessId || req.params.businessId;
    if (!presenceId) {
      return res.status(400).json({ error: "MISSING_CONTEXT", message: "presenceId required" });
    }
    const { rows } = await pool.query(
      `SELECT is_verified FROM businesses WHERE id = $1 LIMIT 1`,
      [presenceId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Business not found" });
    }
    if (!rows[0].is_verified) {
      return res.status(403).json({
        error: "VERIFICATION_REQUIRED",
        message: "Business must complete verification before using this feature",
        presenceId,
      });
    }
    next();
  };
}

function mapHubEntitlement(row: any): HubEntitlement {
  return {
    id: row.id,
    presenceId: row.presence_id,
    hubId: row.hub_id,
    cityId: row.city_id,
    isBaseHub: row.is_base_hub,
    status: row.status,
    billingInterval: row.billing_interval,
    stripeSubscriptionId: row.stripe_subscription_id,
    amountCents: row.amount_cents,
    startAt: row.start_at,
    endAt: row.end_at,
    graceExpiresAt: row.grace_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategoryEntitlement(row: any): CategoryEntitlement {
  return {
    id: row.id,
    presenceId: row.presence_id,
    hubEntitlementId: row.hub_entitlement_id,
    categoryId: row.category_id,
    isBaseCategory: row.is_base_category,
    status: row.status,
    billingInterval: row.billing_interval,
    stripeSubscriptionId: row.stripe_subscription_id,
    amountCents: row.amount_cents,
    startAt: row.start_at,
    endAt: row.end_at,
    graceExpiresAt: row.grace_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMicroEntitlement(row: any): MicroEntitlement {
  return {
    id: row.id,
    presenceId: row.presence_id,
    categoryEntitlementId: row.category_entitlement_id,
    microId: row.micro_id,
    isBaseMicro: row.is_base_micro,
    status: row.status,
    billingInterval: row.billing_interval,
    stripeSubscriptionId: row.stripe_subscription_id,
    amountCents: row.amount_cents,
    startAt: row.start_at,
    endAt: row.end_at,
    graceExpiresAt: row.grace_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCapabilityEntitlement(row: any): CapabilityEntitlement {
  return {
    id: row.id,
    presenceId: row.presence_id,
    hubEntitlementId: row.hub_entitlement_id,
    capabilityType: row.capability_type,
    status: row.status,
    billingInterval: row.billing_interval,
    stripeSubscriptionId: row.stripe_subscription_id,
    amountCents: row.amount_cents,
    startAt: row.start_at,
    endAt: row.end_at,
    graceExpiresAt: row.grace_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCreditWallet(row: any): CreditWallet {
  return {
    id: row.id,
    presenceId: row.presence_id,
    monthlyBalance: row.monthly_balance,
    bankedBalance: row.banked_balance,
    monthlyResetAt: row.monthly_reset_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCreditTransaction(row: any): CreditTransaction {
  return {
    id: row.id,
    walletId: row.wallet_id,
    txType: row.tx_type,
    amount: row.amount,
    balanceAfterMonthly: row.balance_after_monthly,
    balanceAfterBanked: row.balance_after_banked,
    actionType: row.action_type,
    referenceId: row.reference_id,
    note: row.note,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function mapCreditActionCost(row: any): CreditActionCost {
  return {
    id: row.id,
    actionType: row.action_type,
    label: row.label,
    costCredits: row.cost_credits,
    canSubstituteAddon: row.can_substitute_addon || null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlanVersion(row: any): PlanVersion {
  return {
    id: row.id,
    versionKey: row.version_key,
    label: row.label,
    presenceMonthly: row.presence_monthly,
    presenceAnnual: row.presence_annual,
    hubAddonMonthly: row.hub_addon_monthly,
    hubAddonAnnual: row.hub_addon_annual,
    categoryAddonMonthly: row.category_addon_monthly,
    categoryAddonAnnual: row.category_addon_annual,
    microAddonMonthly: row.micro_addon_monthly,
    microAddonAnnual: row.micro_addon_annual,
    monthlyCreditsIncluded: row.monthly_credits_included,
    isCurrentOffering: row.is_current_offering,
    isFounderPlan: row.is_founder_plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
