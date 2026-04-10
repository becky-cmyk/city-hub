import { storage } from "../storage";
import type { InsertRevenueSplit } from "@shared/schema";

interface SplitResult {
  operatorId: string | null;
  splitType: "MICRO" | "METRO" | "CITY_CORE" | "REFERRAL" | "VENUE" | "AMBASSADOR" | "OPS" | "COMMUNITY_FUND" | "GROWTH_FUND";
  splitAmount: number;
}

export async function calculateRevenueSplit(
  grossAmount: number,
  territoryId: string,
  transactionType: "LISTING" | "AD" | "ACTIVATION" | "OTHER",
  sourceOperatorType?: "METRO" | "CITY_CORE",
  referralOperatorId?: string
): Promise<SplitResult[]> {
  const territory = await storage.getTerritory(territoryId);
  if (!territory) throw new Error(`Territory ${territoryId} not found`);

  let microTerritoryId: string | null = null;
  let metroTerritoryId: string | null = null;

  if (territory.type === "MICRO") {
    microTerritoryId = territory.id;
    metroTerritoryId = territory.parentTerritoryId;
  } else {
    metroTerritoryId = territory.id;
  }

  const microOps = microTerritoryId
    ? await storage.getActiveOperatorsForTerritory(microTerritoryId)
    : [];
  const metroOps = metroTerritoryId
    ? await storage.getActiveOperatorsForTerritory(metroTerritoryId)
    : [];

  const activeMicro = microOps.find(o => o.operator.operatorType === "MICRO");
  const activeMetro = metroOps.find(o => o.operator.operatorType === "METRO");

  if (transactionType === "ACTIVATION") {
    return calculateActivationSplit(grossAmount, activeMicro, activeMetro, sourceOperatorType, referralOperatorId);
  }

  return calculateStandardSplit(grossAmount, activeMicro, activeMetro);
}

function calculateStandardSplit(
  grossAmount: number,
  activeMicro?: { operator: { id: string } } | null,
  activeMetro?: { operator: { id: string } } | null
): SplitResult[] {
  const splits: SplitResult[] = [];

  if (activeMicro && activeMetro) {
    splits.push({ operatorId: activeMicro.operator.id, splitType: "MICRO", splitAmount: Math.round(grossAmount * 0.4) });
    splits.push({ operatorId: activeMetro.operator.id, splitType: "METRO", splitAmount: Math.round(grossAmount * 0.3) });
    splits.push({ operatorId: null, splitType: "CITY_CORE", splitAmount: grossAmount - Math.round(grossAmount * 0.4) - Math.round(grossAmount * 0.3) });
  } else if (activeMetro && !activeMicro) {
    splits.push({ operatorId: activeMetro.operator.id, splitType: "METRO", splitAmount: Math.round(grossAmount * 0.6) });
    splits.push({ operatorId: null, splitType: "CITY_CORE", splitAmount: grossAmount - Math.round(grossAmount * 0.6) });
  } else {
    splits.push({ operatorId: null, splitType: "CITY_CORE", splitAmount: grossAmount });
  }

  return splits;
}

function calculateActivationSplit(
  grossAmount: number,
  activeMicro?: { operator: { id: string } } | null,
  activeMetro?: { operator: { id: string } } | null,
  sourceOperatorType?: "METRO" | "CITY_CORE",
  referralOperatorId?: string
): SplitResult[] {
  const splits: SplitResult[] = [];

  if (sourceOperatorType === "METRO" && activeMetro) {
    splits.push({ operatorId: activeMetro.operator.id, splitType: "METRO", splitAmount: Math.round(grossAmount * 0.5) });
    splits.push({ operatorId: null, splitType: "CITY_CORE", splitAmount: grossAmount - Math.round(grossAmount * 0.5) });
  } else {
    let cityCoreAmount = grossAmount;

    if (referralOperatorId) {
      const referralAmount = Math.round(grossAmount * 0.1);
      cityCoreAmount -= referralAmount;
      splits.push({ operatorId: referralOperatorId, splitType: "REFERRAL", splitAmount: referralAmount });
    }

    splits.push({ operatorId: null, splitType: "CITY_CORE", splitAmount: cityCoreAmount });
  }

  return splits;
}

export async function handleRevocation(operatorId: string): Promise<void> {
  await storage.updateOperator(operatorId, { status: "REVOKED" });
}

export async function handleReferralCommission(
  referralOperatorId: string,
  transactionId: string,
  grossAmount: number
): Promise<void> {
  const referralAmount = Math.round(grossAmount * 0.1);
  await storage.createRevenueSplit({
    transactionId,
    operatorId: referralOperatorId,
    splitAmount: referralAmount,
    splitType: "REFERRAL",
    status: "PENDING",
  });
}

export async function processRevenueFromPayment(
  stripePaymentIntentId: string,
  grossAmount: number,
  territoryListingId: string,
  transactionType: "LISTING" | "AD" | "ACTIVATION" | "OTHER",
  sourceOperatorType?: "METRO" | "CITY_CORE",
  referralOperatorId?: string
): Promise<void> {
  const listing = await storage.getTerritoryListing(territoryListingId);
  if (!listing) return;

  const existingTxns = await storage.listRevenueTransactions({ territoryListingId });
  const alreadyProcessed = existingTxns.find(t => t.stripePaymentIntentId === stripePaymentIntentId);
  if (alreadyProcessed) {
    console.log(`[REVENUE] Skipping duplicate payment intent ${stripePaymentIntentId}`);
    return;
  }

  const transaction = await storage.createRevenueTransaction({
    stripePaymentIntentId,
    territoryListingId,
    grossAmount,
    transactionType,
  });

  const splits = await calculateRevenueSplit(
    grossAmount,
    listing.territoryId,
    transactionType,
    sourceOperatorType,
    referralOperatorId
  );

  for (const split of splits) {
    await storage.createRevenueSplit({
      transactionId: transaction.id,
      operatorId: split.operatorId,
      splitAmount: split.splitAmount,
      splitType: split.splitType,
      status: "PENDING",
    });
  }
}

export type RadioAdLevel = "metro" | "micro" | "venue";

export function calculateRadioAdSplit(
  grossAmount: number,
  level: RadioAdLevel,
  ambassadorOperatorId?: string | null,
  venueOperatorId?: string | null,
  metroOperatorId?: string | null,
  microOperatorId?: string | null
): SplitResult[] {
  const splits: SplitResult[] = [];

  const communityFund = Math.round(grossAmount * 0.10);
  const growthFund = Math.round(grossAmount * 0.05);
  splits.push({ operatorId: null, splitType: "COMMUNITY_FUND", splitAmount: communityFund });
  splits.push({ operatorId: null, splitType: "GROWTH_FUND", splitAmount: growthFund });

  const netAmount = grossAmount - communityFund - growthFund;

  if (level === "metro") {
    const divisor = ambassadorOperatorId ? 100 : 85;
    const ambassadorAmount = ambassadorOperatorId ? Math.round(netAmount * (15 / divisor)) : 0;
    const remaining = netAmount - ambassadorAmount;
    const coreAmount = Math.round(remaining * (55 / 85));
    const metroAmount = Math.round(remaining * (15 / 85));
    const microPoolAmount = Math.round(remaining * (10 / 85));
    const opsAmount = remaining - coreAmount - metroAmount - microPoolAmount;

    splits.push({ operatorId: null, splitType: "CITY_CORE", splitAmount: coreAmount });
    splits.push({ operatorId: metroOperatorId || null, splitType: "METRO", splitAmount: metroAmount });
    splits.push({ operatorId: microOperatorId || null, splitType: "MICRO", splitAmount: microPoolAmount });
    splits.push({ operatorId: null, splitType: "OPS", splitAmount: opsAmount });
    if (ambassadorOperatorId) {
      splits.push({ operatorId: ambassadorOperatorId, splitType: "AMBASSADOR", splitAmount: ambassadorAmount });
    }
  } else if (level === "micro") {
    const divisor = ambassadorOperatorId ? 100 : 85;
    const ambassadorAmount = ambassadorOperatorId ? Math.round(netAmount * (15 / divisor)) : 0;
    const remaining = netAmount - ambassadorAmount;
    const coreAmount = Math.round(remaining * (50 / 85));
    const metroAmount = Math.round(remaining * (10 / 85));
    const microAmount = Math.round(remaining * (20 / 85));
    const opsAmount = remaining - coreAmount - metroAmount - microAmount;

    splits.push({ operatorId: null, splitType: "CITY_CORE", splitAmount: coreAmount });
    splits.push({ operatorId: metroOperatorId || null, splitType: "METRO", splitAmount: metroAmount });
    splits.push({ operatorId: microOperatorId || null, splitType: "MICRO", splitAmount: microAmount });
    splits.push({ operatorId: null, splitType: "OPS", splitAmount: opsAmount });
    if (ambassadorOperatorId) {
      splits.push({ operatorId: ambassadorOperatorId, splitType: "AMBASSADOR", splitAmount: ambassadorAmount });
    }
  } else if (level === "venue") {
    const divisor = ambassadorOperatorId ? 100 : 85;
    const ambassadorAmount = ambassadorOperatorId ? Math.round(netAmount * (15 / divisor)) : 0;
    const remaining = netAmount - ambassadorAmount;
    const venueAmount = Math.round(remaining * (30 / 85));
    const coreAmount = Math.round(remaining * (30 / 85));
    const metroAmount = Math.round(remaining * (10 / 85));
    const microAmount = Math.round(remaining * (10 / 85));
    const opsAmount = remaining - venueAmount - coreAmount - metroAmount - microAmount;

    splits.push({ operatorId: venueOperatorId || null, splitType: "VENUE", splitAmount: venueAmount });
    splits.push({ operatorId: null, splitType: "CITY_CORE", splitAmount: coreAmount });
    splits.push({ operatorId: metroOperatorId || null, splitType: "METRO", splitAmount: metroAmount });
    splits.push({ operatorId: microOperatorId || null, splitType: "MICRO", splitAmount: microAmount });
    splits.push({ operatorId: null, splitType: "OPS", splitAmount: opsAmount });
    if (ambassadorOperatorId) {
      splits.push({ operatorId: ambassadorOperatorId, splitType: "AMBASSADOR", splitAmount: ambassadorAmount });
    }
  }

  return splits;
}

export async function processRadioAdRevenue(
  bookingId: string,
  grossAmount: number,
  level: RadioAdLevel,
  stripePaymentIntentId: string,
  ambassadorOperatorId?: string | null,
  venueOperatorId?: string | null,
  metroOperatorId?: string | null,
  microOperatorId?: string | null
): Promise<void> {
  const splits = calculateRadioAdSplit(grossAmount, level, ambassadorOperatorId, venueOperatorId, metroOperatorId, microOperatorId);

  console.log(`[RADIO-REVENUE] Processing ${level} radio ad revenue: $${(grossAmount / 100).toFixed(2)} for booking ${bookingId}`);
  for (const split of splits) {
    console.log(`  → ${split.splitType}: $${(split.splitAmount / 100).toFixed(2)} ${split.operatorId ? `(operator: ${split.operatorId})` : "(platform)"}`);
  }

  try {
    const transaction = await storage.createRevenueTransaction({
      stripePaymentIntentId,
      territoryListingId: bookingId,
      grossAmount,
      transactionType: "AD",
    });

    for (const split of splits) {
      await storage.createRevenueSplit({
        transactionId: transaction.id,
        operatorId: split.operatorId,
        splitAmount: split.splitAmount,
        splitType: split.splitType,
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error(`[RADIO-REVENUE] Failed to record revenue for booking ${bookingId}:`, err);
  }
}
