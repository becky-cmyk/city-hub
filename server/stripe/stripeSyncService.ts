import { db } from "../db";
import { platformProducts, platformPrices } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { PlatformProduct, PlatformPrice } from "@shared/schema";

export interface StripeSyncMismatch {
  type: "missing_stripe_id" | "price_drift" | "inactive_in_stripe" | "missing_in_db" | "product_missing_stripe_id";
  productKey: string;
  productName: string;
  billingInterval?: string;
  dbValue?: string | number | null;
  stripeValue?: string | number | null;
  details: string;
}

export interface StripeSyncAuditResult {
  checkedAt: string;
  totalProducts: number;
  totalPrices: number;
  mismatches: StripeSyncMismatch[];
  healthy: boolean;
}

export async function auditStripeSync(): Promise<StripeSyncAuditResult> {
  const products = await db.select().from(platformProducts).where(eq(platformProducts.active, true));
  const prices = await db.select().from(platformPrices).where(eq(platformPrices.isActive, true));

  const mismatches: StripeSyncMismatch[] = [];

  for (const product of products) {
    if (!product.stripeProductId) {
      mismatches.push({
        type: "product_missing_stripe_id",
        productKey: product.productKey,
        productName: product.name,
        details: `Product "${product.name}" (${product.productKey}) has no Stripe product ID linked`,
      });
    }
  }

  for (const price of prices) {
    const product = products.find(p => p.id === price.productId);
    if (!product) continue;

    if (!price.stripePriceId) {
      mismatches.push({
        type: "missing_stripe_id",
        productKey: product.productKey,
        productName: product.name,
        billingInterval: price.billingInterval,
        details: `Price for "${product.name}" (${price.billingInterval}) has no Stripe price ID`,
      });
    }
  }

  let stripeValidated = false;
  try {
    const stripe = await getStripeClient();
    if (stripe) {
      for (const price of prices) {
        if (!price.stripePriceId) continue;
        const product = products.find(p => p.id === price.productId);
        if (!product) continue;

        try {
          const stripePrice = await stripe.prices.retrieve(price.stripePriceId);
          if (stripePrice.unit_amount !== null && stripePrice.unit_amount !== price.priceAmount) {
            mismatches.push({
              type: "price_drift",
              productKey: product.productKey,
              productName: product.name,
              billingInterval: price.billingInterval,
              dbValue: price.priceAmount,
              stripeValue: stripePrice.unit_amount,
              details: `DB price ${price.priceAmount} != Stripe price ${stripePrice.unit_amount} for "${product.name}" (${price.billingInterval})`,
            });
          }
          if (!stripePrice.active) {
            mismatches.push({
              type: "inactive_in_stripe",
              productKey: product.productKey,
              productName: product.name,
              billingInterval: price.billingInterval,
              dbValue: price.stripePriceId,
              details: `Stripe price ${price.stripePriceId} is inactive but DB marks it active`,
            });
          }
        } catch {
          mismatches.push({
            type: "missing_in_db",
            productKey: product.productKey,
            productName: product.name,
            billingInterval: price.billingInterval,
            dbValue: price.stripePriceId,
            details: `Stripe price ${price.stripePriceId} could not be retrieved — may not exist`,
          });
        }
      }
      stripeValidated = true;
    }
  } catch {
    // Stripe not available — only DB-level checks
  }

  return {
    checkedAt: new Date().toISOString(),
    totalProducts: products.length,
    totalPrices: prices.length,
    mismatches,
    healthy: mismatches.length === 0,
  };
}

export async function createStripeProductForPlatformProduct(
  productId: string,
  approvalFlag: boolean
): Promise<{ success: boolean; stripeProductId?: string; error?: string }> {
  if (!approvalFlag) {
    return { success: false, error: "Explicit approval required — set approvalFlag to true" };
  }

  const [product] = await db.select().from(platformProducts).where(eq(platformProducts.id, productId));
  if (!product) return { success: false, error: "Product not found" };
  if (product.stripeProductId) return { success: false, error: "Product already has a Stripe product ID" };

  const stripe = await getStripeClient();
  if (!stripe) return { success: false, error: "Stripe not configured" };

  const stripeProduct = await stripe.products.create({
    name: product.name,
    metadata: { product_key: product.productKey, platform_product_id: product.id },
  });

  await db.update(platformProducts)
    .set({ stripeProductId: stripeProduct.id, updatedAt: new Date() })
    .where(eq(platformProducts.id, productId));

  return { success: true, stripeProductId: stripeProduct.id };
}

export async function createStripePriceForPlatformPrice(
  priceId: string,
  approvalFlag: boolean
): Promise<{ success: boolean; stripePriceId?: string; error?: string }> {
  if (!approvalFlag) {
    return { success: false, error: "Explicit approval required — set approvalFlag to true" };
  }

  const [price] = await db.select().from(platformPrices).where(eq(platformPrices.id, priceId));
  if (!price) return { success: false, error: "Price not found" };
  if (price.stripePriceId) return { success: false, error: "Price already has a Stripe price ID" };

  const [product] = await db.select().from(platformProducts).where(eq(platformProducts.id, price.productId));
  if (!product) return { success: false, error: "Associated product not found" };
  if (!product.stripeProductId) return { success: false, error: "Product must have a Stripe product ID first" };

  const stripe = await getStripeClient();
  if (!stripe) return { success: false, error: "Stripe not configured" };

  const recurring = price.billingInterval !== "one_time"
    ? { interval: price.billingInterval === "annual" ? "year" as const : "month" as const }
    : undefined;

  const stripePrice = await stripe.prices.create({
    product: product.stripeProductId,
    unit_amount: price.priceAmount,
    currency: price.currency,
    ...(recurring ? { recurring } : {}),
    metadata: { platform_price_id: price.id, billing_interval: price.billingInterval },
  });

  await db.update(platformPrices)
    .set({ stripePriceId: stripePrice.id, updatedAt: new Date() })
    .where(eq(platformPrices.id, priceId));

  return { success: true, stripePriceId: stripePrice.id };
}

export async function getPricingSummary(): Promise<{
  products: (PlatformProduct & { prices: PlatformPrice[] })[];
}> {
  const products = await db.select().from(platformProducts);
  const prices = await db.select().from(platformPrices);

  const result = products.map(product => ({
    ...product,
    prices: prices.filter(p => p.productId === product.id),
  }));

  return { products: result };
}

async function getStripeClient() {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    const Stripe = (await import("stripe")).default;
    return new Stripe(key, { apiVersion: "2023-10-16" as any });
  } catch {
    return null;
  }
}
