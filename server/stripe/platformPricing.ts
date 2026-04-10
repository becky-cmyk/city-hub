import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { platformProducts, platformPrices, metroPricingOverrides } from "@shared/schema";
import { STRIPE_PRICE_MAP } from "./priceMap";

export async function getPlatformPrice({ productKey }: { productKey: string }): Promise<string> {
  const rows = await db
    .select()
    .from(platformProducts)
    .where(and(eq(platformProducts.productKey, productKey), eq(platformProducts.active, true)))
    .limit(1);

  if (rows.length > 0 && rows[0].stripePriceId) {
    return rows[0].stripePriceId;
  }

  const envFallback = STRIPE_PRICE_MAP[productKey];
  if (envFallback) {
    return envFallback;
  }

  throw new Error(`Platform price not configured for product: ${productKey}`);
}

export async function getPlatformProduct({ productKey }: { productKey: string }) {
  const rows = await db
    .select()
    .from(platformProducts)
    .where(and(eq(platformProducts.productKey, productKey), eq(platformProducts.active, true)))
    .limit(1);

  return rows[0] || null;
}

export interface EffectivePriceResult {
  priceAmount: number;
  currency: string;
  stripePriceId: string | null;
  billingInterval: string;
  source: "metro_override" | "platform" | "plan_version" | "env_fallback";
  productName: string;
  productKey: string;
}

export async function getEffectivePrice({
  productId,
  metroId,
  billingInterval,
}: {
  productId: string;
  metroId?: string;
  billingInterval?: string;
}): Promise<EffectivePriceResult | null> {
  const interval = billingInterval || "monthly";

  const [product] = await db
    .select()
    .from(platformProducts)
    .where(and(eq(platformProducts.id, productId), eq(platformProducts.active, true)))
    .limit(1);

  if (!product) return null;

  if (metroId) {
    const overrides = await db
      .select()
      .from(metroPricingOverrides)
      .where(
        and(
          eq(metroPricingOverrides.metroId, metroId),
          eq(metroPricingOverrides.productId, productId),
          eq(metroPricingOverrides.billingInterval, interval as "monthly" | "annual" | "one_time"),
          eq(metroPricingOverrides.isActive, true)
        )
      )
      .limit(1);

    if (overrides.length > 0) {
      const override = overrides[0];

      if (override.overrideType === "fixed") {
        return {
          priceAmount: override.overrideValue,
          currency: "usd",
          stripePriceId: null,
          billingInterval: interval,
          source: "metro_override",
          productName: product.name,
          productKey: product.productKey,
        };
      }

      const basePrices = await db
        .select()
        .from(platformPrices)
        .where(
          and(
            eq(platformPrices.productId, productId),
            eq(platformPrices.billingInterval, interval as "monthly" | "annual" | "one_time"),
            eq(platformPrices.isActive, true)
          )
        )
        .orderBy(platformPrices.createdAt)
        .limit(1);

      if (basePrices.length > 0) {
        const base = basePrices[0].priceAmount;
        let effectivePrice: number;
        if (override.overrideType === "percentage_discount") {
          effectivePrice = Math.round(base * (1 - override.overrideValue / 100));
        } else {
          effectivePrice = Math.round(base * (1 + override.overrideValue / 100));
        }

        return {
          priceAmount: effectivePrice,
          currency: basePrices[0].currency,
          stripePriceId: null,
          billingInterval: interval,
          source: "metro_override",
          productName: product.name,
          productKey: product.productKey,
        };
      }
    }
  }

  const prices = await db
    .select()
    .from(platformPrices)
    .where(
      and(
        eq(platformPrices.productId, productId),
        eq(platformPrices.billingInterval, interval as "monthly" | "annual" | "one_time"),
        eq(platformPrices.isActive, true)
      )
    )
    .orderBy(platformPrices.createdAt)
    .limit(1);

  if (prices.length > 0) {
    return {
      priceAmount: prices[0].priceAmount,
      currency: prices[0].currency,
      stripePriceId: prices[0].stripePriceId,
      billingInterval: interval,
      source: "platform",
      productName: product.name,
      productKey: product.productKey,
    };
  }

  const envFallback = STRIPE_PRICE_MAP[product.productKey];
  if (envFallback) {
    return {
      priceAmount: 0,
      currency: "usd",
      stripePriceId: envFallback,
      billingInterval: interval,
      source: "env_fallback",
      productName: product.name,
      productKey: product.productKey,
    };
  }

  return null;
}

export async function getEffectivePriceByKey({
  productKey,
  metroId,
  billingInterval,
}: {
  productKey: string;
  metroId?: string;
  billingInterval?: string;
}): Promise<EffectivePriceResult | null> {
  const [product] = await db
    .select()
    .from(platformProducts)
    .where(and(eq(platformProducts.productKey, productKey), eq(platformProducts.active, true)))
    .limit(1);

  if (!product) return null;

  return getEffectivePrice({ productId: product.id, metroId, billingInterval });
}
