import { openai } from "../lib/openai";
import { db } from "../db";
import { businesses, events, articles, posts, marketplaceListings, cmsContentItems, rssItems } from "@shared/schema";
import { eq, and, or, isNull, sql, lt } from "drizzle-orm";
import { buildTranslationSystem } from "../ai/prompts/platform-services";

async function translateText(
  text: string,
  targetLang: "en" | "es",
  context?: string
): Promise<string> {
  if (!text || text.trim().length === 0) return "";
  if (!openai) {
    throw new Error("OpenAI client not available — cannot translate");
  }

  const systemPrompt = buildTranslationSystem(targetLang, context);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const result = response.choices[0]?.message?.content?.trim() || "";
    if (!result) {
      throw new Error("OpenAI returned empty translation");
    }
    return result;
  } catch (err) {
    const langLabel = targetLang === "es" ? "Spanish" : "English";
    console.error(`[AutoTranslate] Failed to translate to ${langLabel}:`, err);
    throw err;
  }
}

function detectLanguage(text: string): "en" | "es" | "unknown" {
  const spanishIndicators =
    /\b(el|la|los|las|de|del|en|es|un|una|que|por|para|con|como|más|pero|esta|este|su|sus|al|lo|se|le|no|si|hay|muy|también|tiene|puede|hace|está|son|fue|ser|todo|cada|otro|nueva|ciudad|negocio|evento)\b/i;
  const englishIndicators =
    /\b(the|is|are|was|were|and|but|for|not|you|all|can|had|her|one|our|out|has|his|how|its|let|may|new|now|old|see|way|who|did|get|got|him|own|say|she|too|use|will|with|have|this|that|from|they|been|call|come|each|find|first|give|into|just|know|like|long|look|make|many|more|most|must|name|only|over|part|some|such|take|than|them|then|very|what|when|your|about|after|being|could|every|great|other|still|their|there|these|think|those|three|under|which|while|would|people|should|through|business|community)\b/i;

  const spanishMatches = (text.match(spanishIndicators) || []).length;
  const englishMatches = (text.match(englishIndicators) || []).length;

  if (spanishMatches > englishMatches + 2) return "es";
  if (englishMatches > spanishMatches + 2) return "en";
  if (spanishMatches > 3) return "es";
  if (englishMatches > 3) return "en";
  return "en";
}

export async function autoTranslateBusiness(businessId: string): Promise<void> {
  try {
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz || !biz.description) {
      await db.update(businesses).set({
        translationStatus: "completed",
        lastTranslationAt: new Date(),
      }).where(eq(businesses.id, businessId));
      return;
    }

    const lang = detectLanguage(biz.description);
    const context = `Business name: ${biz.name}`;

    if (lang === "es") {
      if (!biz.descriptionEs || biz.descriptionEs === biz.description) {
        await db
          .update(businesses)
          .set({ descriptionEs: biz.description })
          .where(eq(businesses.id, businessId));
      }
      const translatedEn = await translateText(biz.description, "en", context);
      if (translatedEn) {
        await db
          .update(businesses)
          .set({ description: translatedEn, descriptionEs: biz.description })
          .where(eq(businesses.id, businessId));
      }
    } else {
      if (!biz.descriptionEs) {
        const translatedEs = await translateText(biz.description, "es", context);
        if (translatedEs) {
          await db
            .update(businesses)
            .set({ descriptionEs: translatedEs })
            .where(eq(businesses.id, businessId));
        }
      }
    }

    await db.update(businesses).set({
      translationStatus: "completed",
      translationError: null,
      lastTranslationAt: new Date(),
    }).where(eq(businesses.id, businessId));

    console.log(
      `[AutoTranslate] Business "${biz.name}" translated (source: ${lang})`
    );
  } catch (err: any) {
    console.error(
      `[AutoTranslate] Business ${businessId} translation error:`,
      err
    );
    await db.update(businesses).set({
      translationStatus: "failed",
      translationError: err?.message || "Unknown error",
      translationAttempts: sql`${businesses.translationAttempts} + 1`,
      lastTranslationAt: new Date(),
    }).where(eq(businesses.id, businessId)).catch(() => {});
  }
}

export async function autoTranslateEvent(eventId: string): Promise<void> {
  try {
    const [evt] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    if (!evt) return;

    if (!evt.title && !evt.description) {
      await db.update(events).set({
        translationStatus: "completed",
        lastTranslationAt: new Date(),
      }).where(eq(events.id, eventId));
      return;
    }

    const sourceText = evt.description || evt.title;
    const lang = detectLanguage(sourceText);
    const context = `Event name: ${evt.title}`;

    const updates: Record<string, any> = {};

    if (lang === "es") {
      if (evt.title && !evt.titleEs) updates.titleEs = evt.title;
      if (evt.description && !evt.descriptionEs)
        updates.descriptionEs = evt.description;
      if (evt.title) {
        const titleEn = await translateText(evt.title, "en", context);
        if (titleEn) {
          updates.titleEs = evt.title;
          updates.title = titleEn;
        }
      }
      if (evt.description) {
        const descEn = await translateText(evt.description, "en", context);
        if (descEn) {
          updates.descriptionEs = evt.description;
          updates.description = descEn;
        }
      }
    } else {
      if (evt.title && !evt.titleEs) {
        const titleEs = await translateText(evt.title, "es", context);
        if (titleEs) updates.titleEs = titleEs;
      }
      if (evt.description && !evt.descriptionEs) {
        const descEs = await translateText(evt.description, "es", context);
        if (descEs) updates.descriptionEs = descEs;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(events).set(updates).where(eq(events.id, eventId));
    }

    await db.update(events).set({
      translationStatus: "completed",
      translationError: null,
      lastTranslationAt: new Date(),
    }).where(eq(events.id, eventId));

    console.log(
      `[AutoTranslate] Event "${evt.title}" translated (source: ${lang})`
    );
  } catch (err: any) {
    console.error(
      `[AutoTranslate] Event ${eventId} translation error:`,
      err
    );
    await db.update(events).set({
      translationStatus: "failed",
      translationError: err?.message || "Unknown error",
      translationAttempts: sql`${events.translationAttempts} + 1`,
      lastTranslationAt: new Date(),
    }).where(eq(events.id, eventId)).catch(() => {});
  }
}

export async function autoTranslateArticle(articleId: string): Promise<void> {
  try {
    const [art] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);
    if (!art) return;

    if (!art.title && !art.content && !art.excerpt) {
      await db.update(articles).set({
        translationStatus: "completed",
        lastTranslationAt: new Date(),
      }).where(eq(articles.id, articleId));
      return;
    }

    const sourceText = art.content || art.excerpt || art.title;
    const lang = detectLanguage(sourceText);
    const context = `Article title: ${art.title}`;

    const updates: Record<string, any> = {};

    if (lang === "es") {
      if (art.title) {
        const titleEn = await translateText(art.title, "en", context);
        if (titleEn) {
          updates.titleEs = art.title;
          updates.title = titleEn;
        }
      }
      if (art.excerpt) {
        const excerptEn = await translateText(art.excerpt, "en", context);
        if (excerptEn) {
          updates.excerptEs = art.excerpt;
          updates.excerpt = excerptEn;
        }
      }
      if (art.content) {
        const contentEn = await translateText(art.content, "en", context);
        if (contentEn) {
          updates.contentEs = art.content;
          updates.content = contentEn;
        }
      }
    } else {
      if (art.title && !art.titleEs) {
        const titleEs = await translateText(art.title, "es", context);
        if (titleEs) updates.titleEs = titleEs;
      }
      if (art.excerpt && !art.excerptEs) {
        const excerptEs = await translateText(art.excerpt, "es", context);
        if (excerptEs) updates.excerptEs = excerptEs;
      }
      if (art.content && !art.contentEs) {
        const contentEs = await translateText(art.content, "es", context);
        if (contentEs) updates.contentEs = contentEs;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(articles)
        .set(updates)
        .where(eq(articles.id, articleId));
    }

    await db.update(articles).set({
      translationStatus: "completed",
      translationError: null,
      lastTranslationAt: new Date(),
    }).where(eq(articles.id, articleId));

    console.log(
      `[AutoTranslate] Article "${art.title}" translated (source: ${lang})`
    );
  } catch (err: any) {
    console.error(
      `[AutoTranslate] Article ${articleId} translation error:`,
      err
    );
    await db.update(articles).set({
      translationStatus: "failed",
      translationError: err?.message || "Unknown error",
      translationAttempts: sql`${articles.translationAttempts} + 1`,
      lastTranslationAt: new Date(),
    }).where(eq(articles.id, articleId)).catch(() => {});
  }
}

export async function autoTranslateRssItem(rssItemId: string): Promise<void> {
  try {
    const [item] = await db
      .select()
      .from(rssItems)
      .where(eq(rssItems.id, rssItemId))
      .limit(1);
    if (!item) return;

    const hasLocalArticle = !!item.localArticleBody;
    const sourceTitle = item.title;
    const sourceBody = hasLocalArticle ? item.localArticleBody : (item.rewrittenSummary || item.summary);
    if (!sourceTitle && !sourceBody) return;

    const lang = detectLanguage(sourceBody || sourceTitle || "");
    const context = `RSS article: ${sourceTitle}`;
    const updates: Record<string, any> = {};

    if (lang === "es") {
      if (sourceTitle && !item.titleEs) {
        const titleEn = await translateText(sourceTitle, "en", context);
        if (titleEn) {
          updates.titleEs = sourceTitle;
          updates.title = titleEn;
        }
      }
      if (item.rewrittenSummary) {
        const summaryEn = await translateText(item.rewrittenSummary, "en", context);
        if (summaryEn) {
          updates.rewrittenSummaryEs = item.rewrittenSummary;
          updates.rewrittenSummary = summaryEn;
        }
      }
      if (item.localArticleBody) {
        const bodyEn = await translateText(item.localArticleBody, "en", context);
        if (bodyEn) {
          updates.localArticleBodyEs = item.localArticleBody;
          updates.localArticleBody = bodyEn;
        }
      }
    } else {
      if (sourceTitle && !item.titleEs) {
        const titleEs = await translateText(sourceTitle, "es", context);
        if (titleEs) updates.titleEs = titleEs;
      }
      if (item.rewrittenSummary && !item.rewrittenSummaryEs) {
        const summaryEs = await translateText(item.rewrittenSummary, "es", context);
        if (summaryEs) updates.rewrittenSummaryEs = summaryEs;
      }
      if (item.localArticleBody && !item.localArticleBodyEs) {
        const bodyEs = await translateText(item.localArticleBody, "es", context);
        if (bodyEs) updates.localArticleBodyEs = bodyEs;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(rssItems).set({ ...updates, updatedAt: new Date() }).where(eq(rssItems.id, rssItemId));
    }

    console.log(`[AutoTranslate] RSS item "${sourceTitle}" translated (source: ${lang})`);
  } catch (err: any) {
    console.error(`[AutoTranslate] RSS item ${rssItemId} translation error:`, err?.message);
  }
}

export async function autoTranslatePost(postId: string): Promise<void> {
  try {
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (!post) return;

    if (!post.title && !post.body) {
      await db.update(posts).set({
        translationStatus: "completed",
        lastTranslationAt: new Date(),
      }).where(eq(posts.id, postId));
      return;
    }

    const sourceText = post.body || post.title;
    const lang = detectLanguage(sourceText);
    const context = `Community post: ${post.title}`;

    const updates: Record<string, any> = {};

    if (lang === "es") {
      if (post.title) {
        const titleEn = await translateText(post.title, "en", context);
        if (titleEn) {
          updates.titleEs = post.title;
          updates.title = titleEn;
        }
      }
      if (post.body) {
        const bodyEn = await translateText(post.body, "en", context);
        if (bodyEn) {
          updates.bodyEs = post.body;
          updates.body = bodyEn;
        }
      }
    } else {
      if (post.title && !post.titleEs) {
        const titleEs = await translateText(post.title, "es", context);
        if (titleEs) updates.titleEs = titleEs;
      }
      if (post.body && !post.bodyEs) {
        const bodyEs = await translateText(post.body, "es", context);
        if (bodyEs) updates.bodyEs = bodyEs;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(posts).set(updates).where(eq(posts.id, postId));
    }

    await db.update(posts).set({
      translationStatus: "completed",
      translationError: null,
      lastTranslationAt: new Date(),
    }).where(eq(posts.id, postId));

    console.log(`[AutoTranslate] Post "${post.title}" translated (source: ${lang})`);
  } catch (err: any) {
    console.error(`[AutoTranslate] Post ${postId} translation error:`, err);
    await db.update(posts).set({
      translationStatus: "failed",
      translationError: err?.message || "Unknown error",
      translationAttempts: sql`${posts.translationAttempts} + 1`,
      lastTranslationAt: new Date(),
    }).where(eq(posts.id, postId)).catch(() => {});
  }
}

export async function autoTranslateMarketplaceListing(listingId: string): Promise<void> {
  try {
    const [listing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, listingId))
      .limit(1);
    if (!listing) return;

    if (!listing.title && !listing.description) {
      await db.update(marketplaceListings).set({
        translationStatus: "completed",
        lastTranslationAt: new Date(),
      }).where(eq(marketplaceListings.id, listingId));
      return;
    }

    const sourceText = listing.description || listing.title;
    const lang = detectLanguage(sourceText);
    const context = `Marketplace listing: ${listing.title}`;

    const updates: Record<string, any> = {};

    if (lang === "es") {
      if (listing.title) {
        const titleEn = await translateText(listing.title, "en", context);
        if (titleEn) {
          updates.titleEs = listing.title;
          updates.title = titleEn;
        }
      }
      if (listing.description) {
        const descEn = await translateText(listing.description, "en", context);
        if (descEn) {
          updates.descriptionEs = listing.description;
          updates.description = descEn;
        }
      }
    } else {
      if (listing.title && !listing.titleEs) {
        const titleEs = await translateText(listing.title, "es", context);
        if (titleEs) updates.titleEs = titleEs;
      }
      if (listing.description && !listing.descriptionEs) {
        const descEs = await translateText(listing.description, "es", context);
        if (descEs) updates.descriptionEs = descEs;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(marketplaceListings).set(updates).where(eq(marketplaceListings.id, listingId));
    }

    await db.update(marketplaceListings).set({
      translationStatus: "completed",
      translationError: null,
      lastTranslationAt: new Date(),
    }).where(eq(marketplaceListings.id, listingId));

    console.log(`[AutoTranslate] Marketplace listing "${listing.title}" translated (source: ${lang})`);
  } catch (err: any) {
    console.error(`[AutoTranslate] Marketplace listing ${listingId} translation error:`, err);
    await db.update(marketplaceListings).set({
      translationStatus: "failed",
      translationError: err?.message || "Unknown error",
      translationAttempts: sql`${marketplaceListings.translationAttempts} + 1`,
      lastTranslationAt: new Date(),
    }).where(eq(marketplaceListings.id, listingId)).catch(() => {});
  }
}

export async function autoTranslateCmsContent(contentItemId: string): Promise<void> {
  try {
    const [item] = await db
      .select()
      .from(cmsContentItems)
      .where(eq(cmsContentItems.id, contentItemId))
      .limit(1);
    if (!item) return;

    if (!item.titleEn && !item.bodyEn && !item.excerptEn) {
      await db.update(cmsContentItems).set({
        translationStatus: "completed",
        lastTranslationAt: new Date(),
      }).where(eq(cmsContentItems.id, contentItemId));
      return;
    }

    const context = `CMS article: ${item.titleEn}`;
    const updates: Record<string, any> = {};

    if (item.titleEn && !item.titleEs) {
      const titleEs = await translateText(item.titleEn, "es", context);
      if (titleEs) updates.titleEs = titleEs;
    }
    if (item.excerptEn && !item.excerptEs) {
      const excerptEs = await translateText(item.excerptEn, "es", context);
      if (excerptEs) updates.excerptEs = excerptEs;
    }
    if (item.bodyEn && !item.bodyEs) {
      const bodyEs = await translateText(item.bodyEn, "es", context);
      if (bodyEs) updates.bodyEs = bodyEs;
    }
    if (item.seoTitleEn && !item.seoTitleEs) {
      const seoTitleEs = await translateText(item.seoTitleEn, "es", context);
      if (seoTitleEs) updates.seoTitleEs = seoTitleEs;
    }
    if (item.seoDescriptionEn && !item.seoDescriptionEs) {
      const seoDescEs = await translateText(item.seoDescriptionEn, "es", context);
      if (seoDescEs) updates.seoDescriptionEs = seoDescEs;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(cmsContentItems).set(updates).where(eq(cmsContentItems.id, contentItemId));
    }

    await db.update(cmsContentItems).set({
      translationStatus: "completed",
      translationError: null,
      lastTranslationAt: new Date(),
    }).where(eq(cmsContentItems.id, contentItemId));

    console.log(`[AutoTranslate] CMS content "${item.titleEn}" translated`);
  } catch (err: any) {
    console.error(`[AutoTranslate] CMS content ${contentItemId} translation error:`, err);
    await db.update(cmsContentItems).set({
      translationStatus: "failed",
      translationError: err?.message || "Unknown error",
      translationAttempts: sql`${cmsContentItems.translationAttempts} + 1`,
      lastTranslationAt: new Date(),
    }).where(eq(cmsContentItems.id, contentItemId)).catch(() => {});
  }
}

export type TranslationContentType = "business" | "event" | "article" | "post" | "marketplace_listing" | "cms_content";

export function queueTranslation(
  type: TranslationContentType,
  id: string
): void {
  const resetPending = async () => {
    try {
      switch (type) {
        case "business":
          await db.update(businesses).set({ translationStatus: "pending", translationError: null }).where(eq(businesses.id, id));
          break;
        case "event":
          await db.update(events).set({ translationStatus: "pending", translationError: null }).where(eq(events.id, id));
          break;
        case "article":
          await db.update(articles).set({ translationStatus: "pending", translationError: null }).where(eq(articles.id, id));
          break;
        case "post":
          await db.update(posts).set({ translationStatus: "pending", translationError: null }).where(eq(posts.id, id));
          break;
        case "marketplace_listing":
          await db.update(marketplaceListings).set({ translationStatus: "pending", translationError: null }).where(eq(marketplaceListings.id, id));
          break;
        case "cms_content":
          await db.update(cmsContentItems).set({ translationStatus: "pending", translationError: null }).where(eq(cmsContentItems.id, id));
          break;
      }
    } catch (err) {
      console.error(`[AutoTranslate] Failed to set pending status for ${type}:${id}`, err);
    }
  };

  resetPending().then(() => {
    setTimeout(() => {
      switch (type) {
        case "business":
          autoTranslateBusiness(id);
          break;
        case "event":
          autoTranslateEvent(id);
          break;
        case "article":
          autoTranslateArticle(id);
          break;
        case "post":
          autoTranslatePost(id);
          break;
        case "marketplace_listing":
          autoTranslateMarketplaceListing(id);
          break;
        case "cms_content":
          autoTranslateCmsContent(id);
          break;
      }
    }, 500);
  });
}

async function getItemTranslationStatus(type: TranslationContentType, id: string): Promise<string | null> {
  try {
    let result: { translationStatus: string | null }[] = [];
    switch (type) {
      case "business":
        result = await db.select({ translationStatus: businesses.translationStatus }).from(businesses).where(eq(businesses.id, id)).limit(1);
        break;
      case "event":
        result = await db.select({ translationStatus: events.translationStatus }).from(events).where(eq(events.id, id)).limit(1);
        break;
      case "article":
        result = await db.select({ translationStatus: articles.translationStatus }).from(articles).where(eq(articles.id, id)).limit(1);
        break;
      case "post":
        result = await db.select({ translationStatus: posts.translationStatus }).from(posts).where(eq(posts.id, id)).limit(1);
        break;
      case "marketplace_listing":
        result = await db.select({ translationStatus: marketplaceListings.translationStatus }).from(marketplaceListings).where(eq(marketplaceListings.id, id)).limit(1);
        break;
      case "cms_content":
        result = await db.select({ translationStatus: cmsContentItems.translationStatus }).from(cmsContentItems).where(eq(cmsContentItems.id, id)).limit(1);
        break;
    }
    return result[0]?.translationStatus || null;
  } catch {
    return null;
  }
}

export async function getContentCityId(type: TranslationContentType, id: string): Promise<string | null> {
  const tableMap: Record<TranslationContentType, any> = {
    business: businesses,
    event: events,
    article: articles,
    post: posts,
    marketplace_listing: marketplaceListings,
    cms_content: cmsContentItems,
  };
  const table = tableMap[type];
  if (!table) return null;
  const rows = await db.select({ cityId: table.cityId }).from(table).where(eq(table.id, id)).limit(1);
  return rows[0]?.cityId || null;
}

export async function retryFailedTranslation(
  type: TranslationContentType,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (type) {
      case "business":
        await db.update(businesses).set({ translationStatus: "pending", translationError: null }).where(eq(businesses.id, id));
        await autoTranslateBusiness(id);
        break;
      case "event":
        await db.update(events).set({ translationStatus: "pending", translationError: null }).where(eq(events.id, id));
        await autoTranslateEvent(id);
        break;
      case "article":
        await db.update(articles).set({ translationStatus: "pending", translationError: null }).where(eq(articles.id, id));
        await autoTranslateArticle(id);
        break;
      case "post":
        await db.update(posts).set({ translationStatus: "pending", translationError: null }).where(eq(posts.id, id));
        await autoTranslatePost(id);
        break;
      case "marketplace_listing":
        await db.update(marketplaceListings).set({ translationStatus: "pending", translationError: null }).where(eq(marketplaceListings.id, id));
        await autoTranslateMarketplaceListing(id);
        break;
      case "cms_content":
        await db.update(cmsContentItems).set({ translationStatus: "pending", translationError: null }).where(eq(cmsContentItems.id, id));
        await autoTranslateCmsContent(id);
        break;
    }

    const statusCheck = await getItemTranslationStatus(type, id);
    if (statusCheck === "failed") {
      return { success: false, error: "Translation failed after retry" };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function getTranslationStatusSummary(cityId?: string | null): Promise<{
  businesses: { completed: number; pending: number; failed: number };
  events: { completed: number; pending: number; failed: number };
  articles: { completed: number; pending: number; failed: number };
  posts: { completed: number; pending: number; failed: number };
  marketplaceListings: { completed: number; pending: number; failed: number };
  cmsContent: { completed: number; pending: number; failed: number };
}> {
  const countByStatus = async (table: any) => {
    const conditions = cityId && table.cityId ? [eq(table.cityId, cityId)] : [];
    const rows = await db
      .select({
        status: table.translationStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(table)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(table.translationStatus);
    const result = { completed: 0, pending: 0, failed: 0 };
    for (const row of rows) {
      if (row.status === "completed") result.completed = row.count;
      else if (row.status === "failed") result.failed = row.count;
      else result.pending += row.count;
    }
    return result;
  };

  const [biz, evt, art, post, ml, cms] = await Promise.all([
    countByStatus(businesses),
    countByStatus(events),
    countByStatus(articles),
    countByStatus(posts),
    countByStatus(marketplaceListings),
    countByStatus(cmsContentItems),
  ]);

  return {
    businesses: biz,
    events: evt,
    articles: art,
    posts: post,
    marketplaceListings: ml,
    cmsContent: cms,
  };
}

export async function getFailedTranslations(limit: number = 50, cityId?: string | null): Promise<Array<{
  type: TranslationContentType;
  id: string;
  name: string;
  error: string | null;
  attempts: number;
  lastAttempt: Date | null;
}>> {
  const results: Array<{
    type: TranslationContentType;
    id: string;
    name: string;
    error: string | null;
    attempts: number;
    lastAttempt: Date | null;
  }> = [];

  const failedCondition = (table: any) => {
    const conds = [eq(table.translationStatus, "failed")];
    if (cityId && table.cityId) conds.push(eq(table.cityId, cityId));
    return and(...conds);
  };

  const [failedBiz, failedEvt, failedArt, failedPosts, failedMl, failedCms] = await Promise.all([
    db.select({ id: businesses.id, name: businesses.name, error: businesses.translationError, attempts: businesses.translationAttempts, lastAttempt: businesses.lastTranslationAt })
      .from(businesses).where(failedCondition(businesses)).limit(limit),
    db.select({ id: events.id, name: events.title, error: events.translationError, attempts: events.translationAttempts, lastAttempt: events.lastTranslationAt })
      .from(events).where(failedCondition(events)).limit(limit),
    db.select({ id: articles.id, name: articles.title, error: articles.translationError, attempts: articles.translationAttempts, lastAttempt: articles.lastTranslationAt })
      .from(articles).where(failedCondition(articles)).limit(limit),
    db.select({ id: posts.id, name: posts.title, error: posts.translationError, attempts: posts.translationAttempts, lastAttempt: posts.lastTranslationAt })
      .from(posts).where(failedCondition(posts)).limit(limit),
    db.select({ id: marketplaceListings.id, name: marketplaceListings.title, error: marketplaceListings.translationError, attempts: marketplaceListings.translationAttempts, lastAttempt: marketplaceListings.lastTranslationAt })
      .from(marketplaceListings).where(failedCondition(marketplaceListings)).limit(limit),
    db.select({ id: cmsContentItems.id, name: cmsContentItems.titleEn, error: cmsContentItems.translationError, attempts: cmsContentItems.translationAttempts, lastAttempt: cmsContentItems.lastTranslationAt })
      .from(cmsContentItems).where(failedCondition(cmsContentItems)).limit(limit),
  ]);

  for (const r of failedBiz) results.push({ type: "business", id: r.id, name: r.name, error: r.error, attempts: r.attempts, lastAttempt: r.lastAttempt });
  for (const r of failedEvt) results.push({ type: "event", id: r.id, name: r.name, error: r.error, attempts: r.attempts, lastAttempt: r.lastAttempt });
  for (const r of failedArt) results.push({ type: "article", id: r.id, name: r.name, error: r.error, attempts: r.attempts, lastAttempt: r.lastAttempt });
  for (const r of failedPosts) results.push({ type: "post", id: r.id, name: r.name, error: r.error, attempts: r.attempts, lastAttempt: r.lastAttempt });
  for (const r of failedMl) results.push({ type: "marketplace_listing", id: r.id, name: r.name, error: r.error, attempts: r.attempts, lastAttempt: r.lastAttempt });
  for (const r of failedCms) results.push({ type: "cms_content", id: r.id, name: r.name, error: r.error, attempts: r.attempts, lastAttempt: r.lastAttempt });

  return results;
}

const SCAN_BATCH_SIZE = 10;
const MAX_RETRY_ATTEMPTS = 3;

export async function scanAndTranslateMissing(cityId?: string | null): Promise<{ queued: number }> {
  let queued = 0;

  const cityFilter = (table: any) => cityId && table.cityId ? eq(table.cityId, cityId) : undefined;

  const pendingBiz = await db.select({ id: businesses.id })
    .from(businesses)
    .where(and(
      eq(businesses.translationStatus, "pending"),
      sql`${businesses.description} IS NOT NULL AND ${businesses.description} != ''`,
      cityFilter(businesses)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of pendingBiz) { queueTranslation("business", r.id); queued++; }

  const incompleteBiz = await db.select({ id: businesses.id })
    .from(businesses)
    .where(and(
      eq(businesses.translationStatus, "completed"),
      sql`${businesses.description} IS NOT NULL AND ${businesses.description} != ''`,
      or(isNull(businesses.descriptionEs), sql`${businesses.descriptionEs} = ''`),
      cityFilter(businesses)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of incompleteBiz) { queueTranslation("business", r.id); queued++; }

  const pendingEvt = await db.select({ id: events.id })
    .from(events)
    .where(and(eq(events.translationStatus, "pending"), cityFilter(events)))
    .limit(SCAN_BATCH_SIZE);
  for (const r of pendingEvt) { queueTranslation("event", r.id); queued++; }

  const incompleteEvt = await db.select({ id: events.id })
    .from(events)
    .where(and(
      eq(events.translationStatus, "completed"),
      or(
        and(sql`${events.title} IS NOT NULL AND ${events.title} != ''`, or(isNull(events.titleEs), sql`${events.titleEs} = ''`)),
        and(sql`${events.description} IS NOT NULL AND ${events.description} != ''`, or(isNull(events.descriptionEs), sql`${events.descriptionEs} = ''`))
      ),
      cityFilter(events)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of incompleteEvt) { queueTranslation("event", r.id); queued++; }

  const pendingArt = await db.select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.translationStatus, "pending"), cityFilter(articles)))
    .limit(SCAN_BATCH_SIZE);
  for (const r of pendingArt) { queueTranslation("article", r.id); queued++; }

  const incompleteArt = await db.select({ id: articles.id })
    .from(articles)
    .where(and(
      eq(articles.translationStatus, "completed"),
      or(
        and(sql`${articles.title} IS NOT NULL AND ${articles.title} != ''`, or(isNull(articles.titleEs), sql`${articles.titleEs} = ''`)),
        and(sql`${articles.content} IS NOT NULL AND ${articles.content} != ''`, or(isNull(articles.contentEs), sql`${articles.contentEs} = ''`)),
        and(sql`${articles.excerpt} IS NOT NULL AND ${articles.excerpt} != ''`, or(isNull(articles.excerptEs), sql`${articles.excerptEs} = ''`))
      ),
      cityFilter(articles)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of incompleteArt) { queueTranslation("article", r.id); queued++; }

  const pendingPosts = await db.select({ id: posts.id })
    .from(posts)
    .where(and(
      eq(posts.translationStatus, "pending"),
      eq(posts.status, "published"),
      cityFilter(posts)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of pendingPosts) { queueTranslation("post", r.id); queued++; }

  const incompletePosts = await db.select({ id: posts.id })
    .from(posts)
    .where(and(
      eq(posts.translationStatus, "completed"),
      eq(posts.status, "published"),
      or(
        and(sql`${posts.title} IS NOT NULL AND ${posts.title} != ''`, or(isNull(posts.titleEs), sql`${posts.titleEs} = ''`)),
        and(sql`${posts.body} IS NOT NULL AND ${posts.body} != ''`, or(isNull(posts.bodyEs), sql`${posts.bodyEs} = ''`))
      ),
      cityFilter(posts)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of incompletePosts) { queueTranslation("post", r.id); queued++; }

  const pendingMl = await db.select({ id: marketplaceListings.id })
    .from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.translationStatus, "pending"),
      eq(marketplaceListings.status, "ACTIVE"),
      cityFilter(marketplaceListings)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of pendingMl) { queueTranslation("marketplace_listing", r.id); queued++; }

  const incompleteMl = await db.select({ id: marketplaceListings.id })
    .from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.translationStatus, "completed"),
      eq(marketplaceListings.status, "ACTIVE"),
      or(
        and(sql`${marketplaceListings.title} IS NOT NULL AND ${marketplaceListings.title} != ''`, or(isNull(marketplaceListings.titleEs), sql`${marketplaceListings.titleEs} = ''`)),
        and(sql`${marketplaceListings.description} IS NOT NULL AND ${marketplaceListings.description} != ''`, or(isNull(marketplaceListings.descriptionEs), sql`${marketplaceListings.descriptionEs} = ''`))
      ),
      cityFilter(marketplaceListings)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of incompleteMl) { queueTranslation("marketplace_listing", r.id); queued++; }

  const pendingCms = await db.select({ id: cmsContentItems.id })
    .from(cmsContentItems)
    .where(and(eq(cmsContentItems.translationStatus, "pending"), cityFilter(cmsContentItems)))
    .limit(SCAN_BATCH_SIZE);
  for (const r of pendingCms) { queueTranslation("cms_content", r.id); queued++; }

  const incompleteCms = await db.select({ id: cmsContentItems.id })
    .from(cmsContentItems)
    .where(and(
      eq(cmsContentItems.translationStatus, "completed"),
      or(
        and(sql`${cmsContentItems.titleEn} IS NOT NULL AND ${cmsContentItems.titleEn} != ''`, or(isNull(cmsContentItems.titleEs), sql`${cmsContentItems.titleEs} = ''`)),
        and(sql`${cmsContentItems.bodyEn} IS NOT NULL AND ${cmsContentItems.bodyEn} != ''`, or(isNull(cmsContentItems.bodyEs), sql`${cmsContentItems.bodyEs} = ''`)),
        and(sql`${cmsContentItems.excerptEn} IS NOT NULL AND ${cmsContentItems.excerptEn} != ''`, or(isNull(cmsContentItems.excerptEs), sql`${cmsContentItems.excerptEs} = ''`)),
        and(sql`${cmsContentItems.seoTitleEn} IS NOT NULL AND ${cmsContentItems.seoTitleEn} != ''`, or(isNull(cmsContentItems.seoTitleEs), sql`${cmsContentItems.seoTitleEs} = ''`)),
        and(sql`${cmsContentItems.seoDescriptionEn} IS NOT NULL AND ${cmsContentItems.seoDescriptionEn} != ''`, or(isNull(cmsContentItems.seoDescriptionEs), sql`${cmsContentItems.seoDescriptionEs} = ''`))
      ),
      cityFilter(cmsContentItems)
    ))
    .limit(SCAN_BATCH_SIZE);
  for (const r of incompleteCms) { queueTranslation("cms_content", r.id); queued++; }

  const retryableBiz = await db.select({ id: businesses.id })
    .from(businesses)
    .where(and(
      eq(businesses.translationStatus, "failed"),
      lt(businesses.translationAttempts, MAX_RETRY_ATTEMPTS),
      cityFilter(businesses)
    ))
    .limit(5);
  for (const r of retryableBiz) { queueTranslation("business", r.id); queued++; }

  const retryableEvt = await db.select({ id: events.id })
    .from(events)
    .where(and(
      eq(events.translationStatus, "failed"),
      lt(events.translationAttempts, MAX_RETRY_ATTEMPTS),
      cityFilter(events)
    ))
    .limit(5);
  for (const r of retryableEvt) { queueTranslation("event", r.id); queued++; }

  const retryableArt = await db.select({ id: articles.id })
    .from(articles)
    .where(and(
      eq(articles.translationStatus, "failed"),
      lt(articles.translationAttempts, MAX_RETRY_ATTEMPTS),
      cityFilter(articles)
    ))
    .limit(5);
  for (const r of retryableArt) { queueTranslation("article", r.id); queued++; }

  const retryablePosts = await db.select({ id: posts.id })
    .from(posts)
    .where(and(
      eq(posts.translationStatus, "failed"),
      lt(posts.translationAttempts, MAX_RETRY_ATTEMPTS),
      eq(posts.status, "published"),
      cityFilter(posts)
    ))
    .limit(5);
  for (const r of retryablePosts) { queueTranslation("post", r.id); queued++; }

  const retryableMl = await db.select({ id: marketplaceListings.id })
    .from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.translationStatus, "failed"),
      lt(marketplaceListings.translationAttempts, MAX_RETRY_ATTEMPTS),
      eq(marketplaceListings.status, "ACTIVE"),
      cityFilter(marketplaceListings)
    ))
    .limit(5);
  for (const r of retryableMl) { queueTranslation("marketplace_listing", r.id); queued++; }

  const retryableCms = await db.select({ id: cmsContentItems.id })
    .from(cmsContentItems)
    .where(and(
      eq(cmsContentItems.translationStatus, "failed"),
      lt(cmsContentItems.translationAttempts, MAX_RETRY_ATTEMPTS),
      cityFilter(cmsContentItems)
    ))
    .limit(5);
  for (const r of retryableCms) { queueTranslation("cms_content", r.id); queued++; }

  if (queued > 0) {
    console.log(`[AutoTranslate] Background scan queued ${queued} translations`);
  }

  return { queued };
}

let scanIntervalHandle: ReturnType<typeof setInterval> | null = null;

export function startTranslationScanner(intervalMs: number = 5 * 60 * 1000): void {
  if (scanIntervalHandle) return;

  console.log(`[AutoTranslate] Starting background translation scanner (interval: ${intervalMs / 1000}s)`);

  setTimeout(() => {
    scanAndTranslateMissing().catch(err => {
      console.error("[AutoTranslate] Initial scan error:", err);
    });
  }, 30000);

  scanIntervalHandle = setInterval(() => {
    scanAndTranslateMissing().catch(err => {
      console.error("[AutoTranslate] Periodic scan error:", err);
    });
  }, intervalMs);
}

export function stopTranslationScanner(): void {
  if (scanIntervalHandle) {
    clearInterval(scanIntervalHandle);
    scanIntervalHandle = null;
  }
}
