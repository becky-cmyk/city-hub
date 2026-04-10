import Stripe from "stripe";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { GRACE_PERIOD_DAYS, conversionAttributions, territories, revenueTransactions, ambassadors, ambassadorReferrals, publicUsers, VERIFICATION_TIERS, crownParticipants } from "@shared/schema";
import { processRevenueFromPayment } from "../services/revenue";
import { db, pool } from "../db";
import { eq } from "drizzle-orm";
import { logAudit, AuditActions } from "../services/audit-logger";
import { isPresenceProductType } from "./priceMap";

const HUB_GRACE_DAYS = 7;

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, { apiVersion: "2023-10-16" as Stripe.LatestApiVersion });
  return _stripe;
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  console.log("WEBHOOK HIT");
  console.log("[STRIPE] Webhook received:", req.headers["stripe-signature"] ? "has signature" : "no signature");
  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) {
    res.status(400).json({ message: "Missing stripe-signature header" });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[STRIPE] STRIPE_WEBHOOK_SECRET is not configured");
    res.status(500).json({ message: "Missing STRIPE_WEBHOOK_SECRET" });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      webhookSecret
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[STRIPE] Webhook signature verification failed:", message);
    res.status(400).json({ message: "Webhook signature verification failed" });
    return;
  }

  try {
    await handleWebhookEvent(event);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[STRIPE] Webhook handler error:", message);
    res.status(500).json({ message: "Webhook handler error" });
    return;
  }

  res.status(200).json({ received: true });
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      const meta = session.metadata || {};
      if (meta.type === "TERRITORY_ACTIVATION" && meta.territory_id) {
        await handleTerritoryActivationPayment(meta.territory_id, session.id, session.amount_total || 0);
        break;
      }

      if (meta.type === "CONTRIBUTOR_VERIFICATION" && meta.user_id) {
        await handleContributorVerification(meta.user_id, meta.tier || "standard", session.id, session.amount_total || 0);
        break;
      }

      if (meta.subject_type === "CROWN_PARTICIPANT" && meta.product_type === "CROWN_VERIFICATION" && meta.subject_id) {
        await handleCrownPayment(meta.subject_id, session.id, session.amount_total || 0);
        break;
      }

      if (meta.type === "MARKETPLACE_PURCHASE" && meta.transaction_id) {
        await handleMarketplacePurchase(meta.transaction_id, session.id, session.amount_total || 0);
        break;
      }

      if (meta.type === "MARKETPLACE_FEATURED" && meta.listing_id) {
        await handleMarketplaceFeatured(meta.listing_id, session.id, meta.transaction_id, session.amount_total || 0);
        break;
      }

      if (meta.type === "EVENT_TICKET" && meta.event_id) {
        await handleEventTicketPurchase(session);
        break;
      }

      if (session.mode === "subscription") break;

      const cityId = meta.city_id;
      const subjectType = meta.subject_type;
      const subjectId = meta.subject_id;
      const productType = meta.product_type;
      const tier = meta.tier;

      if (!cityId || !subjectType || !subjectId || !productType) {
        console.error("[STRIPE] Missing metadata on checkout.session.completed");
        return;
      }

      const now = new Date();
      await storage.upsertEntitlement({
        cityId,
        subjectType: subjectType as "BUSINESS" | "USER" | "ZONE" | "CITY",
        subjectId,
        productType: productType as "LISTING_TIER" | "FEATURED_PLACEMENT" | "SPOTLIGHT" | "SPONSORSHIP" | "CONTRIBUTOR_PACKAGE",
        status: "ACTIVE",
        startAt: now,
        endAt: null,
        stripeCheckoutSessionId: session.id,
        stripeSubscriptionId: null,
        metadata: tier ? { tier } : null,
      });

      if (productType === "LISTING_TIER" && tier && subjectType === "BUSINESS") {
        const normalizedTier = (tier === "CHARTER" || tier === "CHAMBER") ? "VERIFIED" : tier;
        await storage.updateBusiness(subjectId, { listingTier: normalizedTier as "FREE" | "VERIFIED" | "ENHANCED" | "ENTERPRISE" });
        console.log(`[STRIPE] Auto-upgraded business ${subjectId} to ${normalizedTier}`);
      }

      await recordAttribution(meta, session.id, session.customer as string || null, session.amount_total || 0);

      console.log("[STRIPE] Entitlement activated:", productType);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const meta = sub.metadata || {};
      const cityId = meta.city_id;
      const subjectType = meta.subject_type;
      const subjectId = meta.subject_id;
      const productType = meta.product_type;
      const tier = meta.tier;

      if (!cityId || !subjectType || !subjectId || !productType) {
        console.error("[STRIPE] Missing metadata on subscription event");
        return;
      }

      if (isPresenceProductType(productType)) {
        await handlePresenceSubscriptionEvent(event.type, sub, meta);
        break;
      }

      const startAt = new Date(sub.current_period_start * 1000);
      const endAt = new Date(sub.current_period_end * 1000);

      await storage.upsertEntitlement({
        cityId,
        subjectType: subjectType as "BUSINESS" | "USER" | "ZONE" | "CITY",
        subjectId,
        productType: productType as "LISTING_TIER" | "FEATURED_PLACEMENT" | "SPOTLIGHT" | "SPONSORSHIP" | "CONTRIBUTOR_PACKAGE",
        status: "ACTIVE",
        startAt,
        endAt,
        stripeSubscriptionId: sub.id,
        stripeCheckoutSessionId: null,
        metadata: tier ? { tier } : null,
      });

      if (productType === "LISTING_TIER" && tier && subjectType === "BUSINESS") {
        const normalizedSubTier = (tier === "CHARTER" || tier === "CHAMBER") ? "VERIFIED" : tier;
        await storage.updateBusiness(subjectId, { listingTier: normalizedSubTier as "FREE" | "VERIFIED" | "ENHANCED" | "ENTERPRISE", isVerified: true });
        console.log(`[STRIPE] Auto-upgraded business ${subjectId} to ${normalizedSubTier}`);

        if (event.type === "customer.subscription.updated") {
          const existingEntitlement = await storage.getEntitlementWithGrace(subjectId);
          if (existingEntitlement && existingEntitlement.founderRateLocked) {
            await storage.updateEntitlementGrace(
              existingEntitlement.id,
              null,
              true,
              existingEntitlement.founderPrice
            );
            console.log(`[STRIPE] Preserved founder rate for business ${subjectId}`);
          }
        }
      }

      if (event.type === "customer.subscription.created") {
        await recordAttribution(meta, sub.id, null, 0);
      }

      console.log("[STRIPE] Entitlement activated:", productType);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const meta = sub.metadata || {};
      const productType = meta.product_type || "unknown";
      const subjectType = meta.subject_type;
      const subjectId = meta.subject_id;

      if (isPresenceProductType(productType)) {
        await handlePresenceSubscriptionDeleted(sub, meta);
        break;
      }

      if (productType === "LISTING_TIER" && subjectType === "BUSINESS" && subjectId) {
        const graceExpiresAt = new Date();
        graceExpiresAt.setDate(graceExpiresAt.getDate() + GRACE_PERIOD_DAYS);

        await storage.startGracePeriod(sub.id, graceExpiresAt);
        console.log(`[STRIPE] Started ${GRACE_PERIOD_DAYS}-day grace period for business ${subjectId}, expires ${graceExpiresAt.toISOString()}`);
      } else {
        await storage.cancelEntitlementBySubscription(sub.id);
        console.log("[STRIPE] Entitlement canceled:", productType);
      }

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === "string" ? invoice.subscription : (invoice.subscription as Stripe.Subscription | null)?.id;
      if (!subId) break;

      const subMeta = (invoice as Record<string, unknown>).subscription_details as Record<string, unknown> | undefined;
      const meta = (subMeta?.metadata as Record<string, string>) || invoice.metadata || {};
      const productType = meta.product_type;

      if (productType && isPresenceProductType(productType)) {
        await handlePresencePaymentFailed(subId, meta);
      } else {
        const graceExpiresAt = new Date();
        graceExpiresAt.setDate(graceExpiresAt.getDate() + GRACE_PERIOD_DAYS);
        await storage.startGracePeriod(subId, graceExpiresAt);
        console.log(`[STRIPE] Payment failed for subscription ${subId}, started grace period`);
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails = (invoice as Record<string, unknown>).subscription_details as Record<string, unknown> | undefined;
      const meta = (subDetails?.metadata as Record<string, string>) || invoice.metadata || {};

      if (meta.type === "TERRITORY_ACTIVATION" && meta.territory_id) {
        await handleTerritoryActivationPayment(meta.territory_id, invoice.id, invoice.amount_paid || 0);
        break;
      }

      if (meta.product_type && isPresenceProductType(meta.product_type)) {
        await handlePresenceInvoicePaid(invoice, meta);
        break;
      }

      const territoryListingId = meta.territory_listing_id;
      const transactionType = meta.transaction_type || "LISTING";
      const sourceOperatorType = meta.source_operator_type;
      const referralOperatorId = meta.referral_operator_id;

      if (territoryListingId && invoice.amount_paid > 0) {
        try {
          const paymentIntent = (invoice as Record<string, unknown>).payment_intent as string || invoice.id;
          await processRevenueFromPayment(
            paymentIntent,
            invoice.amount_paid,
            territoryListingId,
            transactionType as "LISTING" | "ACTIVATION" | "RENEWAL",
            sourceOperatorType,
            referralOperatorId
          );
          console.log(`[STRIPE] Revenue split created for invoice ${invoice.id}, amount: ${invoice.amount_paid}`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`[STRIPE] Revenue split error for invoice ${invoice.id}:`, message);
        }
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = pi.metadata || {};
      const territoryListingId = meta.territory_listing_id;
      const transactionType = meta.transaction_type || "LISTING";
      const sourceOperatorType = meta.source_operator_type;
      const referralOperatorId = meta.referral_operator_id;

      if (territoryListingId && pi.amount > 0) {
        try {
          await processRevenueFromPayment(
            pi.id,
            pi.amount,
            territoryListingId,
            transactionType as "LISTING" | "ACTIVATION" | "RENEWAL",
            sourceOperatorType,
            referralOperatorId
          );
          console.log(`[STRIPE] Revenue split created for payment_intent ${pi.id}, amount: ${pi.amount}`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`[STRIPE] Revenue split error for payment_intent ${pi.id}:`, message);
        }
      }
      break;
    }

    default:
      break;
  }
}

async function handlePresenceSubscriptionEvent(
  eventType: string,
  sub: Stripe.Subscription,
  meta: Record<string, string>,
): Promise<void> {
  const subjectId = meta.subject_id;
  const productType = meta.product_type;
  const billingInterval = meta.billing_interval || "monthly";
  const hubId = meta.hub_id;
  const categoryId = meta.category_id;
  const microId = meta.micro_id;
  const capabilityType = meta.capability_type;
  const isFounder = meta.is_founder === "true";
  const founderLocked = meta.founder_locked === "true";
  const planVersionId = meta.plan_version_id;
  const cityId = meta.city_id;

  if (!subjectId || !productType) return;

  const hubEngine = await import("../hub-entitlements");
  const startAt = new Date(sub.current_period_start * 1000);
  const endAt = new Date(sub.current_period_end * 1000);
  const amountCents = sub.items?.data?.[0]?.price?.unit_amount || 0;

  if (productType === "HUB_PRESENCE" || productType === "HUB_ADDON") {
    if (!hubId || !cityId) return;
    const isAddon = productType === "HUB_ADDON";
    const { rows: existingRows } = await pool.query(
      `SELECT id FROM hub_entitlements WHERE presence_id = $1 AND hub_id = $2
       AND (stripe_subscription_id = $3 OR stripe_subscription_id IS NULL)
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 WHEN status = 'GRACE' THEN 1 ELSE 2 END LIMIT 1`,
      [subjectId, hubId, sub.id]
    );
    if (existingRows.length > 0) {
      await pool.query(
        `UPDATE hub_entitlements SET status = 'ACTIVE', billing_interval = $1, amount_cents = $2,
         start_at = $3, end_at = $4, grace_expires_at = NULL, stripe_subscription_id = $5,
         plan_version_id = COALESCE($6, plan_version_id),
         founder_locked = COALESCE($7, founder_locked),
         updated_at = NOW() WHERE id = $8`,
        [billingInterval, amountCents, startAt, endAt, sub.id, planVersionId || null, founderLocked || null, existingRows[0].id]
      );
      console.log(`[STRIPE] Updated hub entitlement ${existingRows[0].id} for ${subjectId} (interval: ${billingInterval}, amount: ${amountCents})`);
    } else {
      const allocation = await hubEngine.checkHubAllocation(subjectId);
      await hubEngine.createHubEntitlement({
        presenceId: subjectId,
        hubId,
        cityId,
        isBaseHub: isAddon ? false : allocation.isIncluded,
        billingInterval,
        stripeSubscriptionId: sub.id,
        amountCents,
        endAt,
      });
      const { rows: newEntRows } = await pool.query(
        `SELECT id FROM hub_entitlements WHERE presence_id = $1 AND hub_id = $2 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
        [subjectId, hubId]
      );
      if (newEntRows.length > 0 && (planVersionId || founderLocked)) {
        await pool.query(
          `UPDATE hub_entitlements SET plan_version_id = $1, founder_locked = $2, updated_at = NOW() WHERE id = $3`,
          [planVersionId || null, founderLocked, newEntRows[0].id]
        );
      }
      console.log(`[STRIPE] Created hub entitlement for ${subjectId} in hub ${hubId} (addon: ${isAddon}, founder: ${isFounder}, locked: ${founderLocked})`);
    }

    await syncPresenceSubscription(subjectId, sub, billingInterval, amountCents, isFounder, founderLocked);
  }

  if (productType === "CATEGORY_ADDON" && hubId && categoryId) {
    const { rows: hubRows } = await pool.query(
      `SELECT id FROM hub_entitlements WHERE presence_id = $1 AND hub_id = $2 AND status IN ('ACTIVE', 'GRACE')
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END LIMIT 1`,
      [subjectId, hubId]
    );
    if (hubRows.length === 0) {
      console.error(`[STRIPE] No hub entitlement for ${subjectId} in hub ${hubId}, cannot create category addon`);
      return;
    }
    const hubEntId = hubRows[0].id;
    const { rows: catRows } = await pool.query(
      `SELECT id FROM category_entitlements WHERE presence_id = $1 AND hub_entitlement_id = $2 AND category_id = $3
       AND (stripe_subscription_id = $4 OR stripe_subscription_id IS NULL)
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 WHEN status = 'GRACE' THEN 1 ELSE 2 END LIMIT 1`,
      [subjectId, hubEntId, categoryId, sub.id]
    );
    if (catRows.length > 0) {
      await pool.query(
        `UPDATE category_entitlements SET status = 'ACTIVE', billing_interval = $1, amount_cents = $2,
         start_at = $3, end_at = $4, grace_expires_at = NULL, stripe_subscription_id = $5, updated_at = NOW() WHERE id = $6`,
        [billingInterval, amountCents, startAt, endAt, sub.id, catRows[0].id]
      );
    } else {
      const allocation = await hubEngine.checkCategoryAllocation(subjectId, hubEntId);
      await hubEngine.createCategoryEntitlement({
        presenceId: subjectId,
        hubEntitlementId: hubEntId,
        categoryId,
        isBaseCategory: allocation.isIncluded,
        billingInterval,
        stripeSubscriptionId: sub.id,
        amountCents,
        endAt,
      });
    }
    console.log(`[STRIPE] Category entitlement activated for ${subjectId} in category ${categoryId}`);
  }

  if (productType === "MICRO_ADDON" && hubId && categoryId && microId) {
    const { rows: hubRows } = await pool.query(
      `SELECT id FROM hub_entitlements WHERE presence_id = $1 AND hub_id = $2 AND status IN ('ACTIVE', 'GRACE')
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END LIMIT 1`,
      [subjectId, hubId]
    );
    if (hubRows.length === 0) return;
    const { rows: catRows } = await pool.query(
      `SELECT id FROM category_entitlements WHERE presence_id = $1 AND hub_entitlement_id = $2 AND category_id = $3 AND status IN ('ACTIVE', 'GRACE')
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END LIMIT 1`,
      [subjectId, hubRows[0].id, categoryId]
    );
    if (catRows.length === 0) return;
    const catEntId = catRows[0].id;
    const { rows: microRows } = await pool.query(
      `SELECT id FROM micro_entitlements WHERE presence_id = $1 AND category_entitlement_id = $2 AND micro_id = $3
       AND (stripe_subscription_id = $4 OR stripe_subscription_id IS NULL)
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 WHEN status = 'GRACE' THEN 1 ELSE 2 END LIMIT 1`,
      [subjectId, catEntId, microId, sub.id]
    );
    if (microRows.length > 0) {
      await pool.query(
        `UPDATE micro_entitlements SET status = 'ACTIVE', billing_interval = $1, amount_cents = $2,
         start_at = $3, end_at = $4, grace_expires_at = NULL, stripe_subscription_id = $5, updated_at = NOW() WHERE id = $6`,
        [billingInterval, amountCents, startAt, endAt, sub.id, microRows[0].id]
      );
    } else {
      const allocation = await hubEngine.checkMicroAllocation(subjectId, catEntId);
      await hubEngine.createMicroEntitlement({
        presenceId: subjectId,
        categoryEntitlementId: catEntId,
        microId,
        isBaseMicro: allocation.isIncluded,
        billingInterval,
        stripeSubscriptionId: sub.id,
        amountCents,
        endAt,
      });
    }
    console.log(`[STRIPE] Micro entitlement activated for ${subjectId} in micro ${microId}`);
  }

  if (productType === "CAPABILITY" && capabilityType && hubId) {
    const { rows: hubRows } = await pool.query(
      `SELECT id FROM hub_entitlements WHERE presence_id = $1 AND hub_id = $2 AND status IN ('ACTIVE', 'GRACE')
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END LIMIT 1`,
      [subjectId, hubId]
    );
    if (hubRows.length === 0) return;
    const hubEntId = hubRows[0].id;
    const { rows: capRows } = await pool.query(
      `SELECT id FROM capability_entitlements WHERE presence_id = $1 AND hub_entitlement_id = $2 AND capability_type = $3
       AND (stripe_subscription_id = $4 OR stripe_subscription_id IS NULL)
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 WHEN status = 'GRACE' THEN 1 ELSE 2 END LIMIT 1`,
      [subjectId, hubEntId, capabilityType, sub.id]
    );
    if (capRows.length > 0) {
      await pool.query(
        `UPDATE capability_entitlements SET status = 'ACTIVE', billing_interval = $1, amount_cents = $2,
         start_at = $3, end_at = $4, grace_expires_at = NULL, stripe_subscription_id = $5, updated_at = NOW() WHERE id = $6`,
        [billingInterval, amountCents, startAt, endAt, sub.id, capRows[0].id]
      );
    } else {
      await hubEngine.createCapabilityEntitlement({
        presenceId: subjectId,
        hubEntitlementId: hubEntId,
        capabilityType: capabilityType as "JOBS" | "MARKETPLACE" | "CREATOR" | "EXPERT" | "EVENTS" | "PROVIDER" | "COMMUNITY",
        billingInterval,
        stripeSubscriptionId: sub.id,
        amountCents,
        endAt,
      });
    }
    console.log(`[STRIPE] Capability ${capabilityType} activated for ${subjectId}`);
  }
}

async function handlePresenceSubscriptionDeleted(
  sub: Stripe.Subscription,
  meta: Record<string, string>,
): Promise<void> {
  const subjectId = meta.subject_id;
  const productType = meta.product_type;

  if (!subjectId || !productType) return;

  const graceExpiresAt = new Date();
  graceExpiresAt.setDate(graceExpiresAt.getDate() + HUB_GRACE_DAYS);

  const tableMap: Record<string, string> = {
    HUB_PRESENCE: "hub_entitlements",
    HUB_ADDON: "hub_entitlements",
    CATEGORY_ADDON: "category_entitlements",
    MICRO_ADDON: "micro_entitlements",
    CAPABILITY: "capability_entitlements",
  };

  const table = tableMap[productType];
  if (!table) return;

  await pool.query(
    `UPDATE ${table} SET status = 'GRACE', grace_expires_at = $1, updated_at = NOW()
     WHERE stripe_subscription_id = $2 AND status = 'ACTIVE'`,
    [graceExpiresAt, sub.id]
  );

  if (productType === "HUB_PRESENCE" || productType === "HUB_ADDON") {
    await pool.query(
      `UPDATE category_entitlements SET status = 'GRACE', grace_expires_at = $1, updated_at = NOW()
       WHERE hub_entitlement_id IN (SELECT id FROM hub_entitlements WHERE stripe_subscription_id = $2) AND status = 'ACTIVE'`,
      [graceExpiresAt, sub.id]
    );
    await pool.query(
      `UPDATE micro_entitlements SET status = 'GRACE', grace_expires_at = $1, updated_at = NOW()
       WHERE category_entitlement_id IN (
         SELECT ce.id FROM category_entitlements ce
         JOIN hub_entitlements he ON ce.hub_entitlement_id = he.id
         WHERE he.stripe_subscription_id = $2
       ) AND status = 'ACTIVE'`,
      [graceExpiresAt, sub.id]
    );
    await pool.query(
      `UPDATE capability_entitlements SET status = 'GRACE', grace_expires_at = $1, updated_at = NOW()
       WHERE hub_entitlement_id IN (SELECT id FROM hub_entitlements WHERE stripe_subscription_id = $2) AND status = 'ACTIVE'`,
      [graceExpiresAt, sub.id]
    );
  }

  if (productType === "HUB_PRESENCE" || productType === "HUB_ADDON") {
    await updatePresenceSubscriptionStatus(subjectId, "grace", graceExpiresAt);
  }

  console.log(`[STRIPE] Started ${HUB_GRACE_DAYS}-day grace for ${productType} sub ${sub.id} (presence: ${subjectId})`);
}

async function handlePresencePaymentFailed(
  subId: string,
  meta: Record<string, string>,
): Promise<void> {
  const productType = meta.product_type;
  const subjectId = meta.subject_id;

  const graceExpiresAt = new Date();
  graceExpiresAt.setDate(graceExpiresAt.getDate() + HUB_GRACE_DAYS);

  const tableMap: Record<string, string> = {
    HUB_PRESENCE: "hub_entitlements",
    HUB_ADDON: "hub_entitlements",
    CATEGORY_ADDON: "category_entitlements",
    MICRO_ADDON: "micro_entitlements",
    CAPABILITY: "capability_entitlements",
  };

  const table = tableMap[productType || ""];
  if (!table) return;

  await pool.query(
    `UPDATE ${table} SET status = 'GRACE', grace_expires_at = $1, updated_at = NOW()
     WHERE stripe_subscription_id = $2 AND status = 'ACTIVE'`,
    [graceExpiresAt, subId]
  );

  if (productType === "HUB_PRESENCE" || productType === "HUB_ADDON") {
    await pool.query(
      `UPDATE category_entitlements SET status = 'GRACE', grace_expires_at = $1, updated_at = NOW()
       WHERE hub_entitlement_id IN (SELECT id FROM hub_entitlements WHERE stripe_subscription_id = $2) AND status = 'ACTIVE'`,
      [graceExpiresAt, subId]
    );
    await pool.query(
      `UPDATE micro_entitlements SET status = 'GRACE', grace_expires_at = $1, updated_at = NOW()
       WHERE category_entitlement_id IN (
         SELECT ce.id FROM category_entitlements ce
         JOIN hub_entitlements he ON ce.hub_entitlement_id = he.id
         WHERE he.stripe_subscription_id = $2
       ) AND status = 'ACTIVE'`,
      [graceExpiresAt, subId]
    );
    await pool.query(
      `UPDATE capability_entitlements SET status = 'GRACE', grace_expires_at = $1, updated_at = NOW()
       WHERE hub_entitlement_id IN (SELECT id FROM hub_entitlements WHERE stripe_subscription_id = $2) AND status = 'ACTIVE'`,
      [graceExpiresAt, subId]
    );
    if (subjectId) {
      await updatePresenceSubscriptionStatus(subjectId, "grace", graceExpiresAt);
    }
  }

  console.log(`[STRIPE] Payment failed for ${productType} sub ${subId}, grace until ${graceExpiresAt.toISOString()} (presence: ${subjectId})`);
}

async function handlePresenceInvoicePaid(
  invoice: Stripe.Invoice,
  meta: Record<string, string>,
): Promise<void> {
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : (invoice.subscription as Stripe.Subscription | null)?.id;
  if (!subId) return;

  const productType = meta.product_type;
  const tableMap: Record<string, string> = {
    HUB_PRESENCE: "hub_entitlements",
    HUB_ADDON: "hub_entitlements",
    CATEGORY_ADDON: "category_entitlements",
    MICRO_ADDON: "micro_entitlements",
    CAPABILITY: "capability_entitlements",
  };

  const table = tableMap[productType || ""];
  if (!table) return;

  await pool.query(
    `UPDATE ${table} SET status = 'ACTIVE', grace_expires_at = NULL, updated_at = NOW()
     WHERE stripe_subscription_id = $1 AND status IN ('GRACE', 'EXPIRED')`,
    [subId]
  );

  if (productType === "HUB_PRESENCE" || productType === "HUB_ADDON") {
    const subjectId = meta.subject_id;
    if (subjectId) {
      await pool.query(
        `UPDATE presence_subscriptions SET status = 'active', grace_end_at = NULL, updated_at = NOW()
         WHERE presence_id = $1 AND status IN ('grace', 'expired')`,
        [subjectId]
      );
    }
  }

  const { rows: existingRows } = await pool.query(
    `SELECT 1 FROM ${table} WHERE stripe_subscription_id = $1 LIMIT 1`,
    [subId]
  );

  if (existingRows.length === 0) {
    const subjectId = meta.subject_id;
    const hubId = meta.hub_id;
    const categoryId = meta.category_id;
    const microId = meta.micro_id;
    const capabilityType = meta.capability_type;
    const billingInterval = meta.billing_interval || "monthly";
    const cityId = meta.city_id;

    if (!subjectId) return;

    const hubEngine = await import("../hub-entitlements");
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    const amountCents = sub.items?.data?.[0]?.price?.unit_amount || 0;
    const endAt = new Date(sub.current_period_end * 1000);

    if ((productType === "HUB_PRESENCE" || productType === "HUB_ADDON") && hubId && cityId) {
      const isAddon = productType === "HUB_ADDON";
      const allocation = await hubEngine.checkHubAllocation(subjectId);
      await hubEngine.createHubEntitlement({
        presenceId: subjectId,
        hubId,
        cityId,
        isBaseHub: isAddon ? false : allocation.isIncluded,
        billingInterval,
        stripeSubscriptionId: subId,
        amountCents,
        endAt,
      });
      const founderLocked = meta.founder_locked === "true";
      const planVersionId = meta.plan_version_id;
      if (founderLocked || planVersionId) {
        await pool.query(
          `UPDATE hub_entitlements SET plan_version_id = $1, founder_locked = $2, updated_at = NOW()
           WHERE presence_id = $3 AND hub_id = $4 AND status = 'ACTIVE' AND stripe_subscription_id = $5`,
          [planVersionId || null, founderLocked, subjectId, hubId, subId]
        );
      }
      console.log(`[STRIPE] Invoice paid, created missing hub entitlement for ${subjectId} in hub ${hubId}`);
    } else if (productType === "CATEGORY_ADDON" && hubId && categoryId) {
      const hubEnt = await hubEngine.getHubEntitlement(subjectId, hubId);
      if (hubEnt) {
        const allocation = await hubEngine.checkCategoryAllocation(subjectId, hubEnt.id);
        await hubEngine.createCategoryEntitlement({
          presenceId: subjectId,
          hubEntitlementId: hubEnt.id,
          categoryId,
          isBaseCategory: allocation.isIncluded,
          billingInterval,
          stripeSubscriptionId: subId,
          amountCents,
          endAt,
        });
        console.log(`[STRIPE] Invoice paid, created missing category entitlement for ${subjectId}`);
      }
    } else if (productType === "MICRO_ADDON" && hubId && categoryId && microId) {
      const hubEnt = await hubEngine.getHubEntitlement(subjectId, hubId);
      if (hubEnt) {
        const catEnt = await hubEngine.getCategoryEntitlement(subjectId, hubEnt.id, categoryId);
        if (catEnt) {
          const allocation = await hubEngine.checkMicroAllocation(subjectId, catEnt.id);
          await hubEngine.createMicroEntitlement({
            presenceId: subjectId,
            categoryEntitlementId: catEnt.id,
            microId,
            isBaseMicro: allocation.isIncluded,
            billingInterval,
            stripeSubscriptionId: subId,
            amountCents,
            endAt,
          });
          console.log(`[STRIPE] Invoice paid, created missing micro entitlement for ${subjectId}`);
        }
      }
    } else if (productType === "CAPABILITY" && capabilityType && hubId) {
      const hubEnt = await hubEngine.getHubEntitlement(subjectId, hubId);
      if (hubEnt) {
        await hubEngine.createCapabilityEntitlement({
          presenceId: subjectId,
          hubEntitlementId: hubEnt.id,
          capabilityType: capabilityType as "JOBS" | "MARKETPLACE" | "CREATOR" | "EXPERT" | "EVENTS" | "PROVIDER" | "COMMUNITY",
          billingInterval,
          stripeSubscriptionId: subId,
          amountCents,
          endAt,
        });
        console.log(`[STRIPE] Invoice paid, created missing capability ${capabilityType} for ${subjectId}`);
      }
    }
    return;
  }

  console.log(`[STRIPE] Invoice paid, reactivated ${productType} for sub ${subId}`);
}

async function recordAttribution(
  meta: Record<string, string>,
  sessionOrSubId: string,
  stripeCustomerId: string | null,
  amountCents: number,
): Promise<void> {
  const sourceOperatorId = meta.source_operator_id;
  if (sourceOperatorId) {
    try {
      await db.insert(conversionAttributions).values({
        metroId: meta.city_id,
        operatorId: sourceOperatorId,
        entityType: meta.subject_type,
        entityId: meta.subject_id,
        stripeCheckoutSessionId: sessionOrSubId,
        stripeCustomerId: stripeCustomerId || null,
        planTier: meta.tier || meta.product_type,
        status: "PAID",
      });
      logAudit({ action: AuditActions.CHECKOUT_COMPLETED, entityType: meta.subject_type, entityId: meta.subject_id, operatorId: sourceOperatorId, metadata: { sessionId: sessionOrSubId, tier: meta.tier, productType: meta.product_type } });
      console.log(`[STRIPE] Conversion attribution recorded for operator ${sourceOperatorId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[STRIPE] Attribution recording error:`, message);
    }
  }

  const ambassadorRef = meta.ambassador_ref;
  if (ambassadorRef) {
    try {
      const [amb] = await db.select().from(ambassadors).where(eq(ambassadors.referralCode, ambassadorRef)).limit(1);
      if (amb) {
        await db.insert(ambassadorReferrals).values({
          ambassadorId: amb.id,
          referralCode: ambassadorRef,
          status: "CONVERTED",
          stripeSessionId: sessionOrSubId,
          conversionAmountCents: amountCents,
          convertedAt: new Date(),
        });
        await db.update(ambassadors).set({
          totalReferrals: amb.totalReferrals + 1,
        }).where(eq(ambassadors.id, amb.id));
        console.log(`[STRIPE] Ambassador referral recorded for ${ambassadorRef}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[STRIPE] Ambassador referral recording error:`, message);
    }
  }
}

async function handleTerritoryActivationPayment(territoryId: string, paymentRef: string, amountPaid: number): Promise<void> {
  const [territory] = await db.select().from(territories).where(eq(territories.id, territoryId));
  if (!territory) {
    console.error(`[STRIPE] Territory activation: territory ${territoryId} not found`);
    return;
  }

  if (territory.activationPaidAt) {
    console.log(`[STRIPE] Territory ${territory.name} already activated, skipping duplicate webhook`);
    return;
  }

  const now = new Date();
  const quarterlyStart = new Date(now);
  quarterlyStart.setDate(quarterlyStart.getDate() + 90);

  await db.update(territories).set({
    saleStatus: "ACTIVE",
    activationPaidAt: now,
    quarterlyBillingStartDate: quarterlyStart,
    updatedAt: now,
  }).where(eq(territories.id, territoryId));

  if (amountPaid > 0) {
    await db.insert(revenueTransactions).values({
      stripePaymentIntentId: paymentRef,
      grossAmount: amountPaid,
      transactionType: "ACTIVATION",
      paymentMethod: "stripe",
      notes: `Territory activation: ${territory.name} (Tier ${territory.pricingTier})`,
    });
  }

  logAudit({
    action: "TERRITORY_ACTIVATED",
    entityType: "TERRITORY",
    entityId: territoryId,
    metadata: { paymentRef, amountPaid, quarterlyStart: quarterlyStart.toISOString() },
  });

  console.log(`[STRIPE] Territory ${territory.name} activated, quarterly billing starts ${quarterlyStart.toISOString()}`);
}

async function handleContributorVerification(userId: string, tier: string, sessionId: string, amountCents: number): Promise<void> {
  const [user] = await db.select().from(publicUsers).where(eq(publicUsers.id, userId));
  if (!user) {
    console.error(`[STRIPE] Contributor verification: user ${userId} not found`);
    return;
  }

  const processingFee = Math.round(amountCents * 0.029 + 30);
  const netAmount = amountCents - processingFee;

  const existingEntry = await storage.getCommunityFundEntryByPaymentId(sessionId);
  if (existingEntry && existingEntry.paymentStatus !== "completed") {
    await storage.updateCommunityFundEntry(existingEntry.id, {
      grossAmountCents: amountCents,
      processingFeeCents: processingFee,
      netAmountCents: netAmount,
      paymentStatus: "completed",
      notes: `Verified contributor: ${tier} tier`,
    });
  } else if (!existingEntry) {
    await storage.createCommunityFundEntry({
      userId,
      sourceType: "verified_contributor",
      sourceEntityId: sessionId,
      contributionTier: tier as "standard" | "premium" | "patron",
      grossAmountCents: amountCents,
      processingFeeCents: processingFee,
      netAmountCents: netAmount,
      paymentProvider: "stripe",
      paymentId: sessionId,
      paymentStatus: "completed",
      notes: `Verified contributor: ${tier} tier`,
    });
  }

  if ((user as Record<string, unknown>).isVerifiedContributor) {
    console.log(`[STRIPE] User ${userId} already verified, ledger reconciled for session ${sessionId}`);
    return;
  }

  await storage.updateContributorVerification(userId, {
    isVerifiedContributor: true,
    contributorStatus: "verified",
    verificationTier: tier,
    verificationAmountCents: amountCents,
    verificationPaymentId: sessionId,
    verificationCompletedAt: new Date(),
    moderationTrustScore: 75,
  });

  logAudit({
    action: "CONTRIBUTOR_VERIFIED",
    entityType: "USER",
    entityId: userId,
    metadata: { tier, amountCents, sessionId },
  });

  console.log(`[STRIPE] User ${userId} verified as ${tier} contributor, $${(amountCents / 100).toFixed(2)} to community fund`);
}

async function handleCrownPayment(participantId: string, sessionId: string, amountCents: number): Promise<void> {
  const [participant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId));
  if (!participant) {
    console.error(`[STRIPE] Crown participant ${participantId} not found`);
    return;
  }

  if (participant.hasPaid) {
    console.log(`[STRIPE] Crown participant ${participantId} already paid, skipping`);
    return;
  }

  await db.update(crownParticipants).set({
    hasPaid: true,
    stripeSessionId: sessionId,
    status: "verified_participant",
    verifiedAt: new Date(),
  }).where(eq(crownParticipants.id, participantId));

  logAudit({
    action: "CROWN_PARTICIPANT_VERIFIED",
    entityType: "CROWN_PARTICIPANT",
    entityId: participantId,
    metadata: { amountCents, sessionId },
  });

  console.log(`[STRIPE] Crown participant ${participantId} verified via payment $${(amountCents / 100).toFixed(2)}`);
}

async function syncPresenceSubscription(
  presenceId: string,
  sub: Stripe.Subscription,
  billingInterval: string,
  amountCents: number,
  isFounder: boolean,
  founderLocked: boolean,
): Promise<void> {
  const { pool } = await import("../db");
  const startAt = new Date(sub.current_period_start * 1000);
  const endAt = new Date(sub.current_period_end * 1000);
  const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "grace" : "expired";
  const plan = "enhanced";
  const priceTier = isFounder ? "founder" : "standard";

  const { rows: existing } = await pool.query(
    `SELECT id FROM presence_subscriptions WHERE presence_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [presenceId]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE presence_subscriptions SET plan = $1, price_tier = $2, amount_cents = $3, status = $4,
       start_at = $5, end_at = $6, founder_locked = $7, updated_at = NOW() WHERE id = $8`,
      [plan, priceTier, amountCents, status, startAt, endAt, founderLocked, existing[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO presence_subscriptions (presence_id, plan, price_tier, amount_cents, status, start_at, end_at, founder_locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [presenceId, plan, priceTier, amountCents, status, startAt, endAt, founderLocked]
    );
  }
}

async function handleMarketplacePurchase(transactionId: string, sessionId: string, amountTotal: number): Promise<void> {
  const { storage } = await import("../storage");
  const txn = await storage.getMarketplaceTransactionById(transactionId);
  if (!txn) {
    console.error(`[STRIPE] Marketplace transaction ${transactionId} not found`);
    return;
  }
  await storage.updateMarketplaceTransaction(transactionId, {
    status: "COMPLETED",
    stripeCheckoutSessionId: sessionId,
  });
  await storage.createMarketplaceAnalyticsEvent({
    listingId: txn.listingId,
    cityId: txn.cityId,
    eventType: "TRANSACTION_COMPLETED",
    actorUserId: txn.buyerUserId,
    metadata: JSON.stringify({ amountCents: amountTotal, transactionId }),
  });
  console.log(`[STRIPE] Marketplace purchase completed: transaction ${transactionId}, amount ${amountTotal}`);
}

async function handleMarketplaceFeatured(listingId: string, sessionId: string, transactionId?: string, amountTotal?: number): Promise<void> {
  const { storage } = await import("../storage");
  const listing = await storage.getMarketplaceListingById(listingId);
  if (!listing) {
    console.error(`[STRIPE] Marketplace listing ${listingId} not found for featured promotion`);
    return;
  }
  await storage.updateMarketplaceListing(listingId, { featuredFlag: true });
  if (transactionId) {
    const updates: Record<string, unknown> = { status: "COMPLETED", stripeCheckoutSessionId: sessionId };
    if (amountTotal && amountTotal > 0) updates.amountCents = amountTotal;
    await storage.updateMarketplaceTransaction(transactionId, updates);
  }
  await storage.createMarketplaceAnalyticsEvent({
    listingId,
    cityId: listing.cityId,
    eventType: "LISTING_FEATURED",
    actorUserId: listing.postedByUserId,
    metadata: JSON.stringify({ stripeSessionId: sessionId, amountCents: amountTotal }),
  });
  console.log(`[STRIPE] Marketplace listing ${listingId} promoted to featured`);
}

async function handleEventTicketPurchase(session: Stripe.Checkout.Session): Promise<void> {
  const meta = session.metadata || {};
  const eventId = meta.event_id;
  const buyerName = meta.buyer_name;
  const buyerEmail = meta.buyer_email;
  const buyerPhone = meta.buyer_phone || null;
  const itemsJson = meta.items_json;
  const customFieldResponses = meta.custom_field_responses ? JSON.parse(meta.custom_field_responses) : null;

  if (!eventId || !buyerName || !buyerEmail || !itemsJson) {
    console.error("[STRIPE] Missing event ticket metadata");
    return;
  }

  const { pool } = await import("../db");

  const existingCheck = await pool.query(
    `SELECT id FROM ticket_purchases WHERE stripe_session_id = $1 LIMIT 1`,
    [session.id]
  );
  if (existingCheck.rows.length > 0) {
    console.log(`[STRIPE] Event ticket purchase already processed for session ${session.id}`);
    return;
  }

  const items = JSON.parse(itemsJson) as Array<{ ticketTypeId: string; quantity: number; unitPrice: number; name: string }>;

  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      await pool.query(
        `INSERT INTO ticket_purchases (event_id, ticket_type_id, buyer_name, buyer_email, buyer_phone,
          quantity, unit_price, total_paid, stripe_payment_intent_id, stripe_session_id,
          custom_field_responses)
         VALUES ($1, $2, $3, $4, $5, 1, $6, $6, $7, $8, $9)`,
        [eventId, item.ticketTypeId, buyerName, buyerEmail, buyerPhone,
         item.unitPrice,
         (session.payment_intent as string) || null,
         session.id,
         customFieldResponses ? JSON.stringify(customFieldResponses) : null]
      );
    }

    await pool.query(
      `UPDATE event_ticket_types SET quantity_sold = quantity_sold + $1 WHERE id = $2`,
      [item.quantity, item.ticketTypeId]
    );
  }

  const totalAmount = session.amount_total || 0;
  if (totalAmount > 0) {
    const platformShare = Math.round(totalAmount * 0.40);
    const operatorShare = Math.round(totalAmount * 0.30);
    const organizerShare = totalAmount - platformShare - operatorShare;

    try {
      const { storage } = await import("../storage");
      const eventResult = await pool.query(
        `SELECT host_business_id FROM events WHERE id = $1`, [eventId]
      );
      const hostBusinessId = eventResult.rows[0]?.host_business_id;

      if (hostBusinessId) {
        const eventDetails = await pool.query(
          `SELECT e.host_business_id, b.owner_account_id
           FROM events e LEFT JOIN businesses b ON b.id = e.host_business_id
           WHERE e.id = $1`, [eventId]
        );
        const ownerAccountId = eventDetails.rows[0]?.owner_account_id;

        const transaction = await storage.createRevenueTransaction({
          stripePaymentIntentId: (session.payment_intent as string) || session.id,
          grossAmount: totalAmount,
          transactionType: "LISTING",
          businessId: hostBusinessId,
          notes: `Event ticket purchase: event ${eventId}`,
        });

        await storage.createRevenueSplit({
          transactionId: transaction.id,
          operatorId: null,
          splitAmount: platformShare,
          splitType: "CITY_CORE",
          status: "PENDING",
        });

        await storage.createRevenueSplit({
          transactionId: transaction.id,
          operatorId: null,
          splitAmount: operatorShare,
          splitType: "METRO",
          status: "PENDING",
        });

        await storage.createRevenueSplit({
          transactionId: transaction.id,
          operatorId: ownerAccountId || hostBusinessId,
          splitAmount: organizerShare,
          splitType: "VENUE",
          status: "PENDING",
        });
      }
    } catch (revErr) {
      console.error("[STRIPE] Event ticket revenue tracking error:", revErr);
    }
  }

  console.log(`[STRIPE] Event ticket purchase completed for event ${eventId}, session ${session.id}, items: ${items.length}`);
}

async function updatePresenceSubscriptionStatus(presenceId: string, status: string, graceEndAt: Date | null): Promise<void> {
  const { pool } = await import("../db");
  if (graceEndAt) {
    await pool.query(
      `UPDATE presence_subscriptions SET status = $1, grace_end_at = $2, updated_at = NOW()
       WHERE presence_id = $3 AND status = 'active'`,
      [status, graceEndAt, presenceId]
    );
  } else {
    await pool.query(
      `UPDATE presence_subscriptions SET status = $1, grace_end_at = NULL, updated_at = NOW()
       WHERE presence_id = $2 AND status IN ('active', 'grace')`,
      [status, presenceId]
    );
  }
}
