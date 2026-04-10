import { db } from "../db";
import { businesses } from "@shared/schema";
import { eq } from "drizzle-orm";
import { crawlForMicrosite } from "./crawl/micrositeCrawler";
import { generateMicrositeFromCrawl } from "./micrositeGenerator";

type GenerationStatus = "none" | "crawling" | "generating" | "draft_ready" | "needs_review" | "error";
type CrawlStatus = "none" | "crawling" | "crawled" | "blocked" | "failed" | "error";

const activeJobs = new Map<string, { status: GenerationStatus; startedAt: Date; error?: string }>();

export function getMicrositeJobStatus(businessId: string): { status: GenerationStatus; startedAt?: Date; error?: string } | null {
  return activeJobs.get(businessId) || null;
}

export async function runMicrositeGeneration(businessId: string, options?: { forceCrawl?: boolean }): Promise<{ success: boolean; error?: string }> {
  const existing = activeJobs.get(businessId);
  if (existing && (existing.status === "crawling" || existing.status === "generating")) {
    return { success: false, error: "Generation already in progress" };
  }

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return { success: false, error: "Business not found" };
  if (!biz.websiteUrl) return { success: false, error: "No website URL" };

  const isEnhanced = biz.listingTier === "ENHANCED" || biz.listingTier === "ENTERPRISE";
  if (!isEnhanced) return { success: false, error: "Business must be Enhanced tier" };

  const forceCrawl = options?.forceCrawl ?? false;
  activeJobs.set(businessId, { status: "crawling", startedAt: new Date() });

  runGenerationAsync(businessId, biz.websiteUrl, biz.name, forceCrawl).catch((err) => {
    console.error(`[MicrositeJob] Unhandled error for ${businessId}:`, err);
    activeJobs.set(businessId, { status: "error", startedAt: new Date(), error: (err as Error).message });
  });

  return { success: true };
}

async function runGenerationAsync(businessId: string, websiteUrl: string, businessName: string, forceCrawl: boolean = false): Promise<void> {
  try {
    const [currentBiz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    const hasFreshCrawl = !forceCrawl
      && currentBiz?.websiteCrawlStatus === "crawled"
      && currentBiz?.websiteLastCrawledAt
      && (Date.now() - new Date(currentBiz.websiteLastCrawledAt).getTime()) < 24 * 60 * 60 * 1000;

    let crawlResult;

    if (hasFreshCrawl) {
      console.log(`[MicrositeJob] Reusing recent crawl data for ${businessName} (${businessId})`);
      activeJobs.set(businessId, { status: "generating", startedAt: new Date() });
      await db.update(businesses).set({
        micrositeGenerationStatus: "generating",
        updatedAt: new Date(),
      }).where(eq(businesses.id, businessId));

      crawlResult = await crawlForMicrosite(websiteUrl);
    } else {
      activeJobs.set(businessId, { status: "crawling", startedAt: new Date() });
      await db.update(businesses).set({
        websiteCrawlStatus: "crawling",
        micrositeGenerationStatus: "crawling",
        updatedAt: new Date(),
      }).where(eq(businesses.id, businessId));

      console.log(`[MicrositeJob] Starting ${forceCrawl ? "forced " : ""}crawl for ${businessName} (${businessId})`);
      crawlResult = await crawlForMicrosite(websiteUrl);

      await db.update(businesses).set({
        websiteLastCrawledAt: new Date(),
        websiteCrawlStatus: crawlResult.status === "success" ? "crawled" : crawlResult.status,
        updatedAt: new Date(),
      }).where(eq(businesses.id, businessId));
    }

    if (crawlResult.status !== "success") {
      const errorMsg = crawlResult.error || "Crawl failed";
      console.error(`[MicrositeJob] Crawl failed for ${businessId}: ${errorMsg}`);
      activeJobs.set(businessId, { status: "error", startedAt: new Date(), error: errorMsg });
      await db.update(businesses).set({
        micrositeGenerationStatus: "error",
        micrositeDraftMeta: { error: errorMsg, crawlStatus: crawlResult.status, timestamp: new Date().toISOString() },
        updatedAt: new Date(),
      }).where(eq(businesses.id, businessId));
      return;
    }

    activeJobs.set(businessId, { status: "generating", startedAt: new Date() });
    await db.update(businesses).set({
      micrositeGenerationStatus: "generating",
      updatedAt: new Date(),
    }).where(eq(businesses.id, businessId));

    console.log(`[MicrositeJob] Generating microsite for ${businessName} from ${crawlResult.pagesCrawled} crawled pages`);
    const genResult = await generateMicrositeFromCrawl(crawlResult, businessName);

    const draftMeta = {
      sourceUrl: crawlResult.sourceUrl,
      pagesCrawled: crawlResult.pagesCrawled,
      aiNotes: genResult.aiNotes,
      usedFallback: genResult.usedFallback,
      generatedAt: new Date().toISOString(),
      crawledAt: new Date().toISOString(),
      detectedPhone: crawlResult.phone,
      detectedEmail: crawlResult.email,
      detectedAddress: crawlResult.address,
      socialLinks: crawlResult.socialLinks,
      bookingUrl: crawlResult.bookingUrl,
      brandColors: crawlResult.brandColors,
      hours: crawlResult.hours,
    };

    const existingGallery: string[] = (currentBiz?.galleryImages as string[]) || [];
    const crawledImages: string[] = crawlResult.imageUrls || [];
    const mergedGallery = [...new Set([...existingGallery, ...crawledImages])];

    await db.update(businesses).set({
      micrositeDraftBlocks: genResult.blocks,
      micrositeDraftMeta: draftMeta,
      micrositeGenerationStatus: "needs_review",
      micrositeLastGeneratedAt: new Date(),
      micrositeSourceType: "website_crawl",
      updatedAt: new Date(),
      ...(crawlResult.brandColors?.[0] ? { micrositeThemeColor: crawlResult.brandColors[0] } : {}),
      ...(crawledImages.length > 0 ? { galleryImages: mergedGallery } : {}),
    }).where(eq(businesses.id, businessId));

    activeJobs.set(businessId, { status: "needs_review", startedAt: new Date() });
    console.log(`[MicrositeJob] Draft ready for review — ${businessName}: ${genResult.blocks.length} blocks (${genResult.blocks.filter(b => b.enabled).length} enabled)`);
  } catch (err) {
    const errorMsg = (err as Error).message || "Unknown error";
    console.error(`[MicrositeJob] Generation failed for ${businessId}:`, errorMsg);

    activeJobs.set(businessId, { status: "error", startedAt: new Date(), error: errorMsg });
    try {
      await db.update(businesses).set({
        micrositeGenerationStatus: "error",
        micrositeDraftMeta: { error: errorMsg, timestamp: new Date().toISOString() },
        updatedAt: new Date(),
      }).where(eq(businesses.id, businessId));
    } catch (updateErr) {
      console.error(`[MicrositeJob] Failed to update error status:`, (updateErr as Error).message);
    }
  }
}

export async function refreshWebsiteCrawl(businessId: string): Promise<{ success: boolean; error?: string }> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return { success: false, error: "Business not found" };
  if (!biz.websiteUrl) return { success: false, error: "No website URL" };

  try {
    await db.update(businesses).set({
      websiteCrawlStatus: "crawling",
      updatedAt: new Date(),
    }).where(eq(businesses.id, businessId));

    const { crawlEntityWebsite } = await import("./crawl/websiteCrawler");
    const result = await crawlEntityWebsite(biz.id, biz.websiteUrl, biz.cityId || "");

    await db.update(businesses).set({
      websiteLastCrawledAt: new Date(),
      websiteCrawlStatus: result.crawlStatus === "SUCCESS" ? "crawled" : result.crawlStatus.toLowerCase(),
      updatedAt: new Date(),
    }).where(eq(businesses.id, businessId));

    return { success: true };
  } catch (err) {
    await db.update(businesses).set({
      websiteCrawlStatus: "error",
      updatedAt: new Date(),
    }).where(eq(businesses.id, businessId));
    return { success: false, error: (err as Error).message };
  }
}

export async function publishMicrositeDraft(businessId: string): Promise<{ success: boolean; error?: string }> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return { success: false, error: "Business not found" };

  const draftBlocks = biz.micrositeDraftBlocks;
  if (!draftBlocks || !Array.isArray(draftBlocks) || draftBlocks.length === 0) {
    return { success: false, error: "No draft microsite to publish" };
  }

  const isEnhanced = biz.listingTier === "ENHANCED" || biz.listingTier === "ENTERPRISE";
  if (!isEnhanced) return { success: false, error: "Business must be Enhanced tier" };

  try {
    await db.update(businesses).set({
      micrositeBlocks: draftBlocks,
      micrositeEnabled: true,
      micrositeTier: "enhanced",
      micrositeGenerationStatus: "draft_ready",
      micrositePublishedAt: new Date(),
      micrositeSourceType: biz.micrositeSourceType || "website_crawl",
      updatedAt: new Date(),
    }).where(eq(businesses.id, businessId));

    console.log(`[MicrositeJob] Published draft for ${biz.name} (${businessId})`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
