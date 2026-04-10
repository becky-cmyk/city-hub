import type { Request, Response } from "express";
import { z } from "zod";
import { getStripe } from "./webhook";
import { resolvePriceId, resolveCheckoutMode, isPresenceProductType } from "./priceMap";
import { storage } from "../storage";
import { db, pool } from "../db";
import { operators } from "@shared/schema";
import { eq } from "drizzle-orm";

const checkoutBodySchema = z.object({
  citySlug: z.string().min(1),
  subjectType: z.enum(["BUSINESS", "USER", "ZONE", "CITY"]),
  subjectId: z.string().min(1),
  productType: z.enum([
    "LISTING_TIER", "FEATURED_PLACEMENT", "SPOTLIGHT", "SPONSORSHIP", "CONTRIBUTOR_PACKAGE",
    "HUB_PRESENCE", "HUB_ADDON", "CATEGORY_ADDON", "MICRO_ADDON", "CAPABILITY",
    "CONTENT_BOOST", "CONTENT_SPONSORSHIP",
  ]),
  tier: z.enum(["ENHANCED"]).optional(),
  billingInterval: z.enum(["monthly", "annual"]).optional(),
  hubId: z.string().optional(),
  categoryId: z.string().optional(),
  microId: z.string().optional(),
  capabilityType: z.enum(["JOBS", "MARKETPLACE", "CREATOR", "EXPERT", "EVENTS", "PROVIDER", "COMMUNITY"]).optional(),
  successPath: z.string().optional(),
  cancelPath: z.string().optional(),
  operatorId: z.string().optional(),
  ref: z.string().optional(),
});

export async function stripeCheckoutHandler(req: Request, res: Response): Promise<void> {
  const parsed = checkoutBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const {
    citySlug, subjectType, subjectId, productType, tier, billingInterval,
    hubId, categoryId, microId, capabilityType,
    successPath, cancelPath, operatorId, ref,
  } = parsed.data;

  const city = await storage.getCityBySlug(citySlug);
  if (!city) {
    res.status(404).json({ message: "City not found" });
    return;
  }

  if (productType === "LISTING_TIER" && !tier) {
    res.status(400).json({ message: "tier is required when productType is LISTING_TIER" });
    return;
  }

  if (isPresenceProductType(productType) && subjectType === "BUSINESS") {
    const { rows: verifyRows } = await pool.query(
      `SELECT is_verified FROM businesses WHERE id = $1 LIMIT 1`,
      [subjectId]
    );
    if (verifyRows.length === 0) {
      res.status(404).json({ message: "Business not found" });
      return;
    }
    if (!verifyRows[0].is_verified) {
      res.status(403).json({
        error: "VERIFICATION_REQUIRED",
        message: "Business must complete verification before purchasing a subscription",
      });
      return;
    }
  }

  if (productType === "HUB_PRESENCE" && !hubId) {
    res.status(400).json({ message: "hubId is required for HUB_PRESENCE" });
    return;
  }
  if (productType === "HUB_ADDON" && !hubId) {
    res.status(400).json({ message: "hubId is required for HUB_ADDON" });
    return;
  }
  if (productType === "CATEGORY_ADDON" && (!hubId || !categoryId)) {
    res.status(400).json({ message: "hubId and categoryId are required for CATEGORY_ADDON" });
    return;
  }
  if (productType === "MICRO_ADDON" && (!hubId || !categoryId || !microId)) {
    res.status(400).json({ message: "hubId, categoryId, and microId are required for MICRO_ADDON" });
    return;
  }
  if (productType === "CAPABILITY" && (!capabilityType || !hubId)) {
    res.status(400).json({ message: "capabilityType and hubId are required for CAPABILITY" });
    return;
  }
  if (productType === "CAPABILITY" && billingInterval === "annual") {
    res.status(400).json({ message: "Capability subscriptions are monthly-only" });
    return;
  }

  let isFounder = false;
  let resolvedPlanVersionId: string | undefined;
  if (productType === "HUB_PRESENCE" && subjectType === "BUSINESS") {
    const founderStatus = await checkFounderEligibility(subjectId);
    isFounder = founderStatus.eligible;
    const planKey = isFounder ? "founder_v1" : "standard_v1";
    const { rows: pvRows } = await pool.query(
      `SELECT id FROM plan_versions WHERE version_key = $1 LIMIT 1`,
      [planKey]
    );
    if (pvRows.length > 0) {
      resolvedPlanVersionId = pvRows[0].id;
    }
  }

  let validatedOperatorId: string | undefined;
  if (operatorId) {
    const [op] = await db.select({ id: operators.id, status: operators.status }).from(operators).where(eq(operators.id, operatorId));
    if (op && op.status === "ACTIVE") {
      validatedOperatorId = op.id;
    }
  }

  const priceId = resolvePriceId(productType, tier, billingInterval, {
    isFounder,
    capabilityType,
  });
  if (!priceId) {
    const envHint = productType === "LISTING_TIER"
      ? `STRIPE_PRICE_LISTING_${tier}`
      : `STRIPE_PRICE_${productType}`;
    res.status(400).json({ message: `No Stripe price configured. Set env var ${envHint}` });
    return;
  }

  let email: string;
  if (subjectType === "BUSINESS") {
    const biz = await storage.getBusinessById(subjectId);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }
    if (!biz.ownerEmail) {
      res.status(400).json({ message: "Business has no owner email. Claim the listing first." });
      return;
    }
    email = biz.ownerEmail;
  } else if (subjectType === "USER") {
    const user = await storage.getUserById(subjectId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    email = user.email;
  } else {
    res.status(400).json({ message: `subjectType "${subjectType}" is not supported for checkout yet` });
    return;
  }

  const stripe = getStripe();

  if (billingInterval && isPresenceProductType(productType)) {
    let existingSubQuery: string | null = null;
    let existingSubParams: string[] = [];

    if ((productType === "HUB_PRESENCE" || productType === "HUB_ADDON") && hubId) {
      existingSubQuery = `SELECT stripe_subscription_id, billing_interval FROM hub_entitlements
        WHERE presence_id = $1 AND hub_id = $2 AND status = 'ACTIVE' AND stripe_subscription_id IS NOT NULL LIMIT 1`;
      existingSubParams = [subjectId, hubId];
    } else if (productType === "CATEGORY_ADDON" && hubId && categoryId) {
      existingSubQuery = `SELECT ce.stripe_subscription_id, ce.billing_interval FROM category_entitlements ce
        JOIN hub_entitlements he ON ce.hub_entitlement_id = he.id
        WHERE ce.presence_id = $1 AND he.hub_id = $2 AND ce.category_id = $3 AND ce.status = 'ACTIVE' AND ce.stripe_subscription_id IS NOT NULL LIMIT 1`;
      existingSubParams = [subjectId, hubId, categoryId];
    } else if (productType === "MICRO_ADDON" && hubId && categoryId && microId) {
      existingSubQuery = `SELECT me.stripe_subscription_id, me.billing_interval FROM micro_entitlements me
        JOIN category_entitlements ce ON me.category_entitlement_id = ce.id
        JOIN hub_entitlements he ON ce.hub_entitlement_id = he.id
        WHERE me.presence_id = $1 AND he.hub_id = $2 AND ce.category_id = $3 AND me.micro_id = $4 AND me.status = 'ACTIVE' AND me.stripe_subscription_id IS NOT NULL LIMIT 1`;
      existingSubParams = [subjectId, hubId, categoryId, microId];
    } else if (productType === "CAPABILITY" && hubId && capabilityType) {
      existingSubQuery = `SELECT cape.stripe_subscription_id, cape.billing_interval FROM capability_entitlements cape
        JOIN hub_entitlements he ON cape.hub_entitlement_id = he.id
        WHERE cape.presence_id = $1 AND he.hub_id = $2 AND cape.capability_type = $3 AND cape.status = 'ACTIVE' AND cape.stripe_subscription_id IS NOT NULL LIMIT 1`;
      existingSubParams = [subjectId, hubId, capabilityType];
    }

    if (existingSubQuery) {
      const { rows: existingSub } = await pool.query(existingSubQuery, existingSubParams);
      if (existingSub.length > 0 && existingSub[0].billing_interval !== billingInterval) {
        const subId = existingSub[0].stripe_subscription_id;
        const sub = await stripe.subscriptions.retrieve(subId);
        const itemId = sub.items.data[0]?.id;
        if (itemId) {
          await stripe.subscriptions.update(subId, {
            items: [{ id: itemId, price: priceId }],
            proration_behavior: "create_prorations",
            metadata: {
              subject_id: subjectId,
              product_type: productType,
              billing_interval: billingInterval,
              city_id: city.id,
              ...(hubId ? { hub_id: hubId } : {}),
              ...(categoryId ? { category_id: categoryId } : {}),
              ...(microId ? { micro_id: microId } : {}),
              ...(capabilityType ? { capability_type: capabilityType } : {}),
              ...(resolvedPlanVersionId ? { plan_version_id: resolvedPlanVersionId } : {}),
              ...(isFounder ? { is_founder: "true", founder_locked: "true" } : {}),
            },
          });
          res.json({ switched: true, from: existingSub[0].billing_interval, to: billingInterval });
          return;
        }
      }
    }
  }

  let stripeCustomerId: string;
  const existing = await storage.getStripeCustomerByEmail(email, city.id);
  if (existing) {
    stripeCustomerId = existing.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({ email, metadata: { city_id: city.id, city_slug: citySlug } });
    await storage.createStripeCustomer({ cityId: city.id, email, stripeCustomerId: customer.id });
    stripeCustomerId = customer.id;
  }

  const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
  const mode = resolveCheckoutMode(productType);

  const metadataObj: Record<string, string> = {
    city_id: city.id,
    city_slug: citySlug,
    subject_type: subjectType,
    subject_id: subjectId,
    product_type: productType,
    billing_interval: billingInterval || "monthly",
    ...(tier ? { tier } : {}),
    ...(hubId ? { hub_id: hubId } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(microId ? { micro_id: microId } : {}),
    ...(capabilityType ? { capability_type: capabilityType } : {}),
    ...(resolvedPlanVersionId ? { plan_version_id: resolvedPlanVersionId } : {}),
    ...(isFounder ? { is_founder: "true", founder_locked: "true" } : {}),
    ...(validatedOperatorId ? { source_operator_id: validatedOperatorId } : {}),
    ...(ref ? { ambassador_ref: ref } : {}),
  };

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/${citySlug}${successPath || "/owner"}?checkout=success`,
    cancel_url: `${appUrl}/${citySlug}${cancelPath || "/owner"}`,
    metadata: metadataObj,
    ...(mode === "subscription" ? { subscription_data: { metadata: metadataObj } } : {}),
  });

  res.json({ url: session.url });
}

async function checkFounderEligibility(businessId: string): Promise<{ eligible: boolean; lapsed: boolean }> {
  const { rows } = await pool.query(
    `SELECT he.id, he.status, he.founder_locked, he.plan_version_id, pv.is_founder_plan
     FROM hub_entitlements he
     LEFT JOIN plan_versions pv ON he.plan_version_id = pv.id
     WHERE he.presence_id = $1
     ORDER BY he.created_at DESC LIMIT 1`,
    [businessId]
  );

  if (rows.length === 0) {
    const { rows: legacyFounderRows } = await pool.query(
      `SELECT e.status, e.founder_rate_locked FROM entitlements e
       WHERE e.subject_id = $1 AND e.product_type = 'LISTING_TIER' AND e.founder_rate_locked = TRUE
       ORDER BY e.created_at DESC LIMIT 1`,
      [businessId]
    );
    if (legacyFounderRows.length > 0) {
      if (legacyFounderRows[0].status === "ACTIVE") {
        return { eligible: true, lapsed: false };
      }
      return { eligible: false, lapsed: true };
    }

    const { rows: anyLegacy } = await pool.query(
      `SELECT 1 FROM entitlements e
       WHERE e.subject_id = $1 AND e.product_type = 'LISTING_TIER' AND e.status IN ('EXPIRED', 'CANCELED')
       LIMIT 1`,
      [businessId]
    );
    if (anyLegacy.length > 0) {
      return { eligible: false, lapsed: false };
    }

    const { rows: planRows } = await pool.query(
      `SELECT 1 FROM plan_versions WHERE is_founder_plan = TRUE AND is_current_offering = TRUE LIMIT 1`
    );
    return { eligible: planRows.length > 0, lapsed: false };
  }

  const lastEnt = rows[0];
  if (lastEnt.status === "ACTIVE" && (lastEnt.founder_locked || lastEnt.is_founder_plan)) {
    return { eligible: true, lapsed: false };
  }

  if (lastEnt.status === "EXPIRED" || lastEnt.status === "CANCELED") {
    if (lastEnt.founder_locked || lastEnt.is_founder_plan) {
      return { eligible: false, lapsed: true };
    }
  }

  return { eligible: false, lapsed: false };
}
