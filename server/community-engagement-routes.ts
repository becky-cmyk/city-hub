import { Router, type Request, type Response, type NextFunction } from "express";
import { db, pool } from "./db";
import { z } from "zod";
import { eq, and, or, desc, asc, sql, gte, lte, inArray, type SQL } from "drizzle-orm";
import {
  neighborhoodReviews, reviews, businesses, polls, pollOptions, pollVotes,
  votingCampaigns, votingCategories, votingNominees, votingBallots,
  quizzes, quizQuestions, quizAttempts,
  surveys, surveyQuestions, surveyResponses,
  contentReactions, publicUsers, zones,
  insertNeighborhoodReviewSchema, insertPollSchema, insertPollOptionSchema,
  insertVotingCampaignSchema, insertVotingCategorySchema, insertVotingNomineeSchema,
  insertQuizSchema, insertQuizQuestionSchema,
  insertSurveySchema, insertSurveyQuestionSchema,
  insertContentReactionSchema,
  type NeighborhoodReview, type Poll, type PollOption, type PollVote,
  type VotingCampaign, type VotingCategory, type VotingNominee, type VotingBallot,
  type Quiz, type QuizQuestion, type QuizAttempt,
  type Survey, type SurveyQuestion, type SurveyResponse,
  type ContentReaction,
} from "@shared/schema";

type AdminMiddleware = (req: Request, res: Response, next: Function) => void;
let _adminMiddleware: AdminMiddleware | null = null;

export function initCommunityEngagementRoutes(adminMiddleware: AdminMiddleware) {
  _adminMiddleware = adminMiddleware;
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!_adminMiddleware) {
    return res.status(500).json({ message: "Admin middleware not initialized" });
  }
  _adminMiddleware(req, res, next);
}

const router = Router();

function getPublicUserId(req: Request): string | null {
  return (req.session as any).publicUserId || null;
}

async function requireVerifiedUser(req: Request, res: Response, next: Function) {
  const userId = getPublicUserId(req);
  if (!userId) return res.status(401).json({ message: "Login required" });
  const [user] = await db.select({ isVerified: publicUsers.isVerified }).from(publicUsers).where(eq(publicUsers.id, userId));
  if (!user) return res.status(401).json({ message: "Account not found" });
  if (!user.isVerified) return res.status(403).json({ message: "Verified account required to participate" });
  next();
}

router.get("/api/community/neighborhood-reviews", async (req: Request, res: Response) => {
  try {
    const { cityId, zoneId } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const conditions: SQL[] = [eq(neighborhoodReviews.cityId, cityId as string)];
    if (zoneId) conditions.push(eq(neighborhoodReviews.zoneId, zoneId as string));
    conditions.push(eq(neighborhoodReviews.status, sql`'APPROVED'`));
    const rows = await db.select({
      id: neighborhoodReviews.id,
      cityId: neighborhoodReviews.cityId,
      zoneId: neighborhoodReviews.zoneId,
      userId: neighborhoodReviews.userId,
      rating: neighborhoodReviews.rating,
      comment: neighborhoodReviews.comment,
      pros: neighborhoodReviews.pros,
      cons: neighborhoodReviews.cons,
      status: neighborhoodReviews.status,
      createdAt: neighborhoodReviews.createdAt,
      updatedAt: neighborhoodReviews.updatedAt,
      displayName: sql<string>`COALESCE(${publicUsers.displayName}, 'Anonymous')`,
      zoneName: zones.name,
    }).from(neighborhoodReviews)
      .leftJoin(publicUsers, eq(neighborhoodReviews.userId, publicUsers.id))
      .leftJoin(zones, eq(neighborhoodReviews.zoneId, zones.id))
      .where(and(...conditions))
      .orderBy(desc(neighborhoodReviews.createdAt));
    res.json(rows);
  } catch (err: any) {
    console.error("[CommunityEngagement] neighborhood-reviews list error:", err);
    res.status(500).json({ message: "Failed to fetch neighborhood reviews" });
  }
});

router.get("/api/community/neighborhood-reviews/stats", async (req: Request, res: Response) => {
  try {
    const { cityId, zoneId } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const conditions: SQL[] = [
      eq(neighborhoodReviews.cityId, cityId as string),
      eq(neighborhoodReviews.status, sql`'APPROVED'`),
    ];
    if (zoneId) conditions.push(eq(neighborhoodReviews.zoneId, zoneId as string));
    const [stats] = await db.select({
      avgRating: sql<number>`ROUND(AVG(${neighborhoodReviews.rating})::numeric, 1)::float`,
      count: sql<number>`COUNT(*)::int`,
    }).from(neighborhoodReviews).where(and(...conditions));
    res.json(stats || { avgRating: 0, count: 0 });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to get stats" });
  }
});

router.post("/api/community/neighborhood-reviews", requireVerifiedUser, async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req)!;
    const parsed = insertNeighborhoodReviewSchema.parse({ ...req.body, userId, status: "PENDING" });
    const [row] = await db.insert(neighborhoodReviews).values(parsed).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
    console.error("[CommunityEngagement] create neighborhood review error:", err);
    res.status(500).json({ message: "Failed to create review" });
  }
});

router.patch("/api/admin/community/neighborhood-reviews/:id/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!["APPROVED", "REJECTED"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const [row] = await db.update(neighborhoodReviews)
      .set({ status, updatedAt: new Date() })
      .where(eq(neighborhoodReviews.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update status" });
  }
});

router.get("/api/admin/community/neighborhood-reviews", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, status, zoneId, dateFrom, dateTo } = req.query;
    const conditions: SQL[] = [];
    if (cityId) conditions.push(eq(neighborhoodReviews.cityId, cityId as string));
    if (status) conditions.push(eq(neighborhoodReviews.status, sql`${status}`));
    if (zoneId) conditions.push(eq(neighborhoodReviews.zoneId, zoneId as string));
    if (dateFrom) conditions.push(gte(neighborhoodReviews.createdAt, new Date(dateFrom as string)));
    if (dateTo) conditions.push(lte(neighborhoodReviews.createdAt, new Date(dateTo as string)));
    const rows = await db.select({
      id: neighborhoodReviews.id,
      cityId: neighborhoodReviews.cityId,
      zoneId: neighborhoodReviews.zoneId,
      userId: neighborhoodReviews.userId,
      rating: neighborhoodReviews.rating,
      comment: neighborhoodReviews.comment,
      pros: neighborhoodReviews.pros,
      cons: neighborhoodReviews.cons,
      status: neighborhoodReviews.status,
      createdAt: neighborhoodReviews.createdAt,
      updatedAt: neighborhoodReviews.updatedAt,
      displayName: sql<string>`COALESCE(${publicUsers.displayName}, 'Anonymous')`,
      zoneName: zones.name,
    }).from(neighborhoodReviews)
      .leftJoin(publicUsers, eq(neighborhoodReviews.userId, publicUsers.id))
      .leftJoin(zones, eq(neighborhoodReviews.zoneId, zones.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(neighborhoodReviews.createdAt));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

router.get("/api/community/polls", async (req: Request, res: Response) => {
  try {
    const { cityId, zoneId } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const conditions: SQL[] = [eq(polls.cityId, cityId as string), eq(polls.isActive, true)];
    if (zoneId) conditions.push(eq(polls.zoneId, zoneId as string));
    const now = new Date();
    const pollRows = await db.select().from(polls).where(and(...conditions)).orderBy(desc(polls.createdAt));
    const activePolls = pollRows.filter(p => !p.expiresAt || new Date(p.expiresAt) > now);
    const results = [];
    for (const poll of activePolls) {
      const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(asc(pollOptions.sortOrder));
      const allVotes = await db.select({ selectedOptionIds: pollVotes.selectedOptionIds }).from(pollVotes).where(eq(pollVotes.pollId, poll.id));
      const countMap: Record<string, number> = {};
      for (const vote of allVotes) {
        for (const optId of vote.selectedOptionIds) {
          countMap[optId] = (countMap[optId] || 0) + 1;
        }
      }
      const userId = getPublicUserId(req);
      let userVotedOptionIds: string[] = [];
      if (userId) {
        const [uv] = await db.select({ selectedOptionIds: pollVotes.selectedOptionIds }).from(pollVotes)
          .where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.userId, userId)));
        if (uv) userVotedOptionIds = uv.selectedOptionIds;
      }
      results.push({
        ...poll,
        options: options.map(o => ({ ...o, voteCount: countMap[o.id] || 0 })),
        totalVotes: allVotes.length,
        userVotedOptionIds,
      });
    }
    res.json(results);
  } catch (err: any) {
    console.error("[CommunityEngagement] polls list error:", err);
    res.status(500).json({ message: "Failed to fetch polls" });
  }
});

router.get("/api/community/polls/:id", async (req: Request, res: Response) => {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.id, req.params.id));
    if (!poll) return res.status(404).json({ message: "Poll not found" });
    const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(asc(pollOptions.sortOrder));
    const allVotes = await db.select({ selectedOptionIds: pollVotes.selectedOptionIds }).from(pollVotes).where(eq(pollVotes.pollId, poll.id));
    const countMap: Record<string, number> = {};
    for (const vote of allVotes) {
      for (const optId of vote.selectedOptionIds) {
        countMap[optId] = (countMap[optId] || 0) + 1;
      }
    }
    const userId = getPublicUserId(req);
    let userVotedOptionIds: string[] = [];
    if (userId) {
      const [uv] = await db.select({ selectedOptionIds: pollVotes.selectedOptionIds }).from(pollVotes)
        .where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.userId, userId)));
      if (uv) userVotedOptionIds = uv.selectedOptionIds;
    }
    res.json({
      ...poll,
      options: options.map(o => ({ ...o, voteCount: countMap[o.id] || 0 })),
      totalVotes: allVotes.length,
      userVotedOptionIds,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch poll" });
  }
});

router.post("/api/community/polls/:id/vote", requireVerifiedUser, async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req)!;
    const pollId = req.params.id;
    const { optionId, optionIds } = req.body;
    const [poll] = await db.select().from(polls).where(eq(polls.id, pollId));
    if (!poll) return res.status(404).json({ message: "Poll not found" });
    if (!poll.isActive) return res.status(400).json({ message: "Poll is closed" });
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return res.status(400).json({ message: "Poll has expired" });
    const rawIds: string[] = poll.choiceMode === "multi" && Array.isArray(optionIds)
      ? optionIds
      : optionId ? [optionId] : [];
    const selectedIds = [...new Set(rawIds)];
    if (selectedIds.length === 0) return res.status(400).json({ message: "optionId or optionIds required" });
    if (poll.choiceMode === "single" && selectedIds.length > 1) {
      return res.status(400).json({ message: "Single-choice poll allows only one option" });
    }
    const validOptions = await db.select().from(pollOptions)
      .where(eq(pollOptions.pollId, pollId));
    const validOptionIds = new Set(validOptions.map(o => o.id));
    for (const sid of selectedIds) {
      if (!validOptionIds.has(sid)) return res.status(400).json({ message: `Invalid option: ${sid}` });
    }
    const [vote] = await db.insert(pollVotes)
      .values({ pollId, userId, selectedOptionIds: selectedIds })
      .returning();
    res.status(201).json(vote);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ message: "Already voted on this poll" });
    }
    console.error("[CommunityEngagement] poll vote error:", err);
    res.status(500).json({ message: "Failed to vote" });
  }
});

router.post("/api/admin/community/polls", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { options: optionLabels, ...pollData } = req.body;
    const parsed = insertPollSchema.parse(pollData);
    const [poll] = await db.insert(polls).values(parsed).returning();
    if (Array.isArray(optionLabels)) {
      for (let i = 0; i < optionLabels.length; i++) {
        const label = typeof optionLabels[i] === "string" ? optionLabels[i] : optionLabels[i].label;
        const imageUrl = typeof optionLabels[i] === "object" ? optionLabels[i].imageUrl : undefined;
        await db.insert(pollOptions).values({ pollId: poll.id, label, imageUrl, sortOrder: i });
      }
    }
    const opts = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(asc(pollOptions.sortOrder));
    res.status(201).json({ ...poll, options: opts });
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
    console.error("[CommunityEngagement] create poll error:", err);
    res.status(500).json({ message: "Failed to create poll" });
  }
});

router.patch("/api/admin/community/polls/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isActive, isPinned, question, expiresAt } = req.body;
    const updates: Partial<Poll> & { updatedAt: Date } = { updatedAt: new Date() };
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (typeof isPinned === "boolean") updates.isPinned = isPinned;
    if (question) updates.question = question;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    const [row] = await db.update(polls).set(updates).where(eq(polls.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update poll" });
  }
});

router.get("/api/admin/community/polls", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, zoneId, dateFrom, dateTo } = req.query;
    const conditions: SQL[] = [];
    if (cityId) conditions.push(eq(polls.cityId, cityId as string));
    if (zoneId) conditions.push(eq(polls.zoneId, zoneId as string));
    if (dateFrom) conditions.push(gte(polls.createdAt, new Date(dateFrom as string)));
    if (dateTo) conditions.push(lte(polls.createdAt, new Date(dateTo as string)));
    const pollRows = await db.select().from(polls)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(polls.createdAt));
    const results = [];
    for (const poll of pollRows) {
      const opts = await db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).orderBy(asc(pollOptions.sortOrder));
      const [vc] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(pollVotes).where(eq(pollVotes.pollId, poll.id));
      results.push({ ...poll, options: opts, totalVotes: vc?.total || 0 });
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch polls" });
  }
});

router.get("/api/community/voting-campaigns", async (req: Request, res: Response) => {
  try {
    const { cityId, status } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const statusFilter = status === "completed" ? "closed" : "active";
    const rows = await db.select().from(votingCampaigns)
      .where(and(eq(votingCampaigns.cityId, cityId as string), eq(votingCampaigns.status, sql`${statusFilter}`)))
      .orderBy(desc(votingCampaigns.createdAt));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
});

router.get("/api/community/voting-campaigns/:id", async (req: Request, res: Response) => {
  try {
    const param = req.params.id;
    const [campaign] = await db.select().from(votingCampaigns).where(
      or(eq(votingCampaigns.id, param), eq(votingCampaigns.slug, param))
    );
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    const cats = await db.select().from(votingCategories).where(eq(votingCategories.campaignId, campaign.id)).orderBy(asc(votingCategories.sortOrder));
    const userId = getPublicUserId(req);
    const categoriesWithNominees = [];
    for (const cat of cats) {
      const nominees = await db.select().from(votingNominees).where(eq(votingNominees.categoryId, cat.id));
      const ballotCounts = await db.select({
        nomineeId: votingBallots.nomineeId,
        count: sql<number>`COUNT(*)::int`,
      }).from(votingBallots).where(eq(votingBallots.categoryId, cat.id)).groupBy(votingBallots.nomineeId);
      const countMap: Record<string, number> = {};
      for (const bc of ballotCounts) countMap[bc.nomineeId] = bc.count;
      let userBallotNomineeId: string | null = null;
      if (userId) {
        const [ub] = await db.select({ nomineeId: votingBallots.nomineeId }).from(votingBallots)
          .where(and(eq(votingBallots.campaignId, campaign.id), eq(votingBallots.categoryId, cat.id), eq(votingBallots.userId, userId)));
        if (ub) userBallotNomineeId = ub.nomineeId;
      }
      categoriesWithNominees.push({
        ...cat,
        nominees: nominees.map(n => ({ ...n, voteCount: countMap[n.id] || 0 })),
        userBallotNomineeId,
      });
    }
    res.json({ ...campaign, categories: categoriesWithNominees });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch campaign" });
  }
});

router.post("/api/community/voting-campaigns/:id/vote", requireVerifiedUser, async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req)!;
    const campaignId = req.params.id;
    const { categoryId, nomineeId } = req.body;
    if (!categoryId || !nomineeId) return res.status(400).json({ message: "categoryId and nomineeId required" });
    const [campaign] = await db.select().from(votingCampaigns).where(eq(votingCampaigns.id, campaignId));
    if (!campaign || campaign.status !== "active") return res.status(400).json({ message: "Campaign not active" });
    const now = new Date();
    if (campaign.startsAt && new Date(campaign.startsAt) > now) return res.status(400).json({ message: "Voting period has not started" });
    if (campaign.endsAt && new Date(campaign.endsAt) < now) return res.status(400).json({ message: "Voting period ended" });
    const [category] = await db.select().from(votingCategories)
      .where(and(eq(votingCategories.id, categoryId), eq(votingCategories.campaignId, campaignId)));
    if (!category) return res.status(400).json({ message: "Invalid category for this campaign" });
    const [nominee] = await db.select().from(votingNominees)
      .where(and(eq(votingNominees.id, nomineeId), eq(votingNominees.categoryId, categoryId)));
    if (!nominee) return res.status(400).json({ message: "Invalid nominee for this category" });
    const existing = await db.select().from(votingBallots)
      .where(and(eq(votingBallots.campaignId, campaignId), eq(votingBallots.categoryId, categoryId), eq(votingBallots.userId, userId)));
    if (existing.length > 0) return res.status(400).json({ message: "Already voted in this category" });
    const [ballot] = await db.insert(votingBallots).values({ campaignId, categoryId, nomineeId, userId }).returning();
    res.status(201).json(ballot);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ message: "Already voted in this category" });
    }
    console.error("[CommunityEngagement] voting error:", err);
    res.status(500).json({ message: "Failed to vote" });
  }
});

router.post("/api/admin/community/voting-campaigns", requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = insertVotingCampaignSchema.parse(req.body);
    const [campaign] = await db.insert(votingCampaigns).values(parsed).returning();
    res.status(201).json(campaign);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
    res.status(500).json({ message: "Failed to create campaign" });
  }
});

router.patch("/api/admin/community/voting-campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, title, description, startsAt, endsAt } = req.body;
    const updates: Partial<VotingCampaign> & { updatedAt: Date } = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (startsAt !== undefined) updates.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) updates.endsAt = endsAt ? new Date(endsAt) : null;
    const [row] = await db.update(votingCampaigns).set(updates).where(eq(votingCampaigns.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update campaign" });
  }
});

router.post("/api/admin/community/voting-campaigns/:campaignId/categories", requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = insertVotingCategorySchema.parse({ ...req.body, campaignId: req.params.campaignId });
    const [row] = await db.insert(votingCategories).values(parsed).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
    res.status(500).json({ message: "Failed to create category" });
  }
});

router.post("/api/admin/community/voting-categories/:categoryId/nominees", requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = insertVotingNomineeSchema.parse({ ...req.body, categoryId: req.params.categoryId });
    const [row] = await db.insert(votingNominees).values(parsed).returning();
    try {
      const { applyFullTagStack } = await import("./services/content-tagger");
      const hints: Record<string, string | null | undefined> = { title: parsed.name };
      if (parsed.businessId) {
        const [biz] = await db.select().from(businesses).where(eq(businesses.id, parsed.businessId)).limit(1);
        if (biz) { hints.cityId = biz.cityId; hints.zoneId = biz.zoneId; }
      }
      await applyFullTagStack("voting_nominee", row.id, hints);
    } catch (tagErr: unknown) {
      const msg = tagErr instanceof Error ? tagErr.message : String(tagErr);
      console.error(`[ContentTagger] Nominee tagging failed for ${row.id}:`, msg);
    }
    res.status(201).json(row);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
    res.status(500).json({ message: "Failed to create nominee" });
  }
});

router.get("/api/admin/community/voting-campaigns", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, dateFrom, dateTo } = req.query;
    const conditions: SQL[] = [];
    if (cityId) conditions.push(eq(votingCampaigns.cityId, cityId as string));
    if (dateFrom) conditions.push(gte(votingCampaigns.createdAt, new Date(dateFrom as string)));
    if (dateTo) conditions.push(lte(votingCampaigns.createdAt, new Date(dateTo as string)));
    const rows = await db.select().from(votingCampaigns)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(votingCampaigns.createdAt));
    const results = [];
    for (const c of rows) {
      const [bc] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(votingBallots).where(eq(votingBallots.campaignId, c.id));
      const catCount = await db.select({ total: sql<number>`COUNT(*)::int` }).from(votingCategories).where(eq(votingCategories.campaignId, c.id));
      results.push({ ...c, totalBallots: bc?.total || 0, categoryCount: catCount[0]?.total || 0 });
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
});

router.get("/api/admin/community/voting-campaigns/:id/results", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [campaign] = await db.select().from(votingCampaigns).where(eq(votingCampaigns.id, req.params.id));
    if (!campaign) return res.status(404).json({ message: "Not found" });
    const cats = await db.select().from(votingCategories).where(eq(votingCategories.campaignId, campaign.id)).orderBy(asc(votingCategories.sortOrder));
    const categoriesWithResults = [];
    for (const cat of cats) {
      const nominees = await db.select().from(votingNominees).where(eq(votingNominees.categoryId, cat.id));
      const ballotCounts = await db.select({
        nomineeId: votingBallots.nomineeId,
        count: sql<number>`COUNT(*)::int`,
      }).from(votingBallots).where(eq(votingBallots.categoryId, cat.id)).groupBy(votingBallots.nomineeId);
      const countMap: Record<string, number> = {};
      for (const bc of ballotCounts) countMap[bc.nomineeId] = bc.count;
      categoriesWithResults.push({
        ...cat,
        nominees: nominees.map(n => ({ ...n, voteCount: countMap[n.id] || 0 })).sort((a, b) => b.voteCount - a.voteCount),
      });
    }
    res.json({ ...campaign, categories: categoriesWithResults });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch results" });
  }
});

router.get("/api/community/quizzes", async (req: Request, res: Response) => {
  try {
    const { cityId } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const rows = await db.select().from(quizzes)
      .where(and(eq(quizzes.cityId, cityId as string), eq(quizzes.isActive, true)))
      .orderBy(desc(quizzes.createdAt));
    const results = [];
    for (const quiz of rows) {
      const [qc] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id));
      results.push({ ...quiz, questionCount: qc?.total || 0 });
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch quizzes" });
  }
});

router.get("/api/community/quizzes/:id", async (req: Request, res: Response) => {
  try {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, req.params.id));
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.sortOrder));
    const safeQuestions = questions.map(q => ({
      id: q.id,
      quizId: q.quizId,
      question: q.question,
      options: q.options,
      sortOrder: q.sortOrder,
    }));
    res.json({ ...quiz, questions: safeQuestions });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch quiz" });
  }
});

router.post("/api/community/quizzes/:id/check", async (req: Request, res: Response) => {
  try {
    const { questionId, answerIndex } = req.body;
    if (!questionId || answerIndex === undefined) return res.status(400).json({ message: "questionId and answerIndex required" });
    const [question] = await db.select().from(quizQuestions)
      .where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, req.params.id)));
    if (!question) return res.status(404).json({ message: "Question not found" });
    const correct = answerIndex === question.correctIndex;
    res.json({ correct, correctIndex: question.correctIndex, explanation: question.explanation });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to check answer" });
  }
});

router.post("/api/community/quizzes/:id/submit", requireVerifiedUser, async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req)!;
    const quizId = req.params.id;
    const { answers } = req.body;
    if (!Array.isArray(answers)) return res.status(400).json({ message: "answers array required" });
    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId)).orderBy(asc(quizQuestions.sortOrder));
    if (questions.length === 0) return res.status(404).json({ message: "Quiz not found or has no questions" });
    let score = 0;
    const results: { questionId: string; correct: boolean; correctIndex: number; explanation: string | null }[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnswer = answers[i];
      const isCorrect = userAnswer === q.correctIndex;
      if (isCorrect) score++;
      results.push({ questionId: q.id, correct: isCorrect, correctIndex: q.correctIndex, explanation: q.explanation });
    }
    const [attempt] = await db.insert(quizAttempts).values({
      quizId, userId, score, totalQuestions: questions.length, answers,
    }).returning();
    res.json({ attempt, results, score, totalQuestions: questions.length });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ message: "You have already completed this quiz" });
    }
    console.error("[CommunityEngagement] quiz submit error:", err);
    res.status(500).json({ message: "Failed to submit quiz" });
  }
});

router.post("/api/admin/community/quizzes", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { questions: questionData, ...quizData } = req.body;
    const parsed = insertQuizSchema.parse(quizData);
    const [quiz] = await db.insert(quizzes).values(parsed).returning();
    if (Array.isArray(questionData)) {
      for (let i = 0; i < questionData.length; i++) {
        const qd = questionData[i];
        await db.insert(quizQuestions).values({
          quizId: quiz.id, question: qd.question, options: qd.options,
          correctIndex: qd.correctIndex, explanation: qd.explanation, sortOrder: i,
        });
      }
    }
    const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.sortOrder));
    res.status(201).json({ ...quiz, questions: qs });
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
    console.error("[CommunityEngagement] create quiz error:", err);
    res.status(500).json({ message: "Failed to create quiz" });
  }
});

router.patch("/api/admin/community/quizzes/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isActive, title, description } = req.body;
    const updates: Partial<Quiz> & { updatedAt: Date } = { updatedAt: new Date() };
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    const [row] = await db.update(quizzes).set(updates).where(eq(quizzes.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update quiz" });
  }
});

router.get("/api/admin/community/quizzes", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, dateFrom, dateTo } = req.query;
    const conditions: SQL[] = [];
    if (cityId) conditions.push(eq(quizzes.cityId, cityId as string));
    if (dateFrom) conditions.push(gte(quizzes.createdAt, new Date(dateFrom as string)));
    if (dateTo) conditions.push(lte(quizzes.createdAt, new Date(dateTo as string)));
    const rows = await db.select().from(quizzes)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(quizzes.createdAt));
    const results = [];
    for (const quiz of rows) {
      const [qc] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id));
      const [ac] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(quizAttempts).where(eq(quizAttempts.quizId, quiz.id));
      const [avgScore] = await db.select({ avg: sql<number>`ROUND(AVG(${quizAttempts.score}::float / NULLIF(${quizAttempts.totalQuestions}, 0) * 100)::numeric, 1)::float` }).from(quizAttempts).where(eq(quizAttempts.quizId, quiz.id));
      results.push({ ...quiz, questionCount: qc?.total || 0, attemptCount: ac?.total || 0, avgScorePercent: avgScore?.avg || 0 });
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch quizzes" });
  }
});

router.get("/api/community/surveys", async (req: Request, res: Response) => {
  try {
    const { cityId } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const now = new Date();
    const rows = await db.select().from(surveys)
      .where(and(eq(surveys.cityId, cityId as string), eq(surveys.isActive, true)))
      .orderBy(desc(surveys.createdAt));
    const activeSurveys = rows.filter(s => !s.expiresAt || new Date(s.expiresAt) > now);
    const results = [];
    for (const survey of activeSurveys) {
      const qs = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, survey.id)).orderBy(asc(surveyQuestions.sortOrder));
      const [rc] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(surveyResponses).where(eq(surveyResponses.surveyId, survey.id));
      results.push({ ...survey, questions: qs, responseCount: rc?.total || 0 });
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch surveys" });
  }
});

router.get("/api/community/surveys/:id", async (req: Request, res: Response) => {
  try {
    const [survey] = await db.select().from(surveys).where(eq(surveys.id, req.params.id));
    if (!survey) return res.status(404).json({ message: "Survey not found" });
    const qs = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, survey.id)).orderBy(asc(surveyQuestions.sortOrder));
    res.json({ ...survey, questions: qs });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch survey" });
  }
});

router.post("/api/community/surveys/:id/respond", requireVerifiedUser, async (req: Request, res: Response) => {
  try {
    const surveyId = req.params.id;
    const userId = getPublicUserId(req)!;
    const { answers } = req.body;
    if (!answers || typeof answers !== "object") return res.status(400).json({ message: "answers object required" });
    const [survey] = await db.select().from(surveys).where(eq(surveys.id, surveyId));
    if (!survey) return res.status(404).json({ message: "Survey not found" });
    if (!survey.isActive) return res.status(400).json({ message: "Survey is closed" });
    const [response] = await db.insert(surveyResponses).values({
      surveyId, userId, answers,
    }).returning();
    res.status(201).json(response);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ message: "Already responded to this survey" });
    }
    console.error("[CommunityEngagement] survey respond error:", err);
    res.status(500).json({ message: "Failed to submit response" });
  }
});

router.post("/api/admin/community/surveys", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { questions: questionData, ...surveyData } = req.body;
    const parsed = insertSurveySchema.parse(surveyData);
    const [survey] = await db.insert(surveys).values(parsed).returning();
    if (Array.isArray(questionData)) {
      for (let i = 0; i < questionData.length; i++) {
        const qd = questionData[i];
        await db.insert(surveyQuestions).values({
          surveyId: survey.id, question: qd.question, questionType: qd.questionType,
          options: qd.options || null, isRequired: qd.isRequired ?? true, sortOrder: i,
        });
      }
    }
    const qs = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, survey.id)).orderBy(asc(surveyQuestions.sortOrder));
    res.status(201).json({ ...survey, questions: qs });
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
    console.error("[CommunityEngagement] create survey error:", err);
    res.status(500).json({ message: "Failed to create survey" });
  }
});

router.patch("/api/admin/community/surveys/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isActive, title, description, isAnonymous, expiresAt } = req.body;
    const updates: Partial<Survey> & { updatedAt: Date } = { updatedAt: new Date() };
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (typeof isAnonymous === "boolean") updates.isAnonymous = isAnonymous;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    const [row] = await db.update(surveys).set(updates).where(eq(surveys.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update survey" });
  }
});

router.get("/api/admin/community/surveys", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, dateFrom, dateTo } = req.query;
    const conditions: SQL[] = [];
    if (cityId) conditions.push(eq(surveys.cityId, cityId as string));
    if (dateFrom) conditions.push(gte(surveys.createdAt, new Date(dateFrom as string)));
    if (dateTo) conditions.push(lte(surveys.createdAt, new Date(dateTo as string)));
    const rows = await db.select().from(surveys)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(surveys.createdAt));
    const results = [];
    for (const survey of rows) {
      const [qc] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(surveyQuestions).where(eq(surveyQuestions.surveyId, survey.id));
      const [rc] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(surveyResponses).where(eq(surveyResponses.surveyId, survey.id));
      results.push({ ...survey, questionCount: qc?.total || 0, responseCount: rc?.total || 0 });
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch surveys" });
  }
});

router.get("/api/admin/community/surveys/:id/responses", requireAdmin, async (req: Request, res: Response) => {
  try {
    const surveyId = req.params.id;
    const qs = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, surveyId)).orderBy(asc(surveyQuestions.sortOrder));
    const responses = await db.select({
      id: surveyResponses.id,
      surveyId: surveyResponses.surveyId,
      userId: surveyResponses.userId,
      answers: surveyResponses.answers,
      submittedAt: surveyResponses.submittedAt,
      displayName: sql<string>`COALESCE(${publicUsers.displayName}, 'Anonymous')`,
    }).from(surveyResponses)
      .leftJoin(publicUsers, eq(surveyResponses.userId, publicUsers.id))
      .where(eq(surveyResponses.surveyId, surveyId))
      .orderBy(desc(surveyResponses.submittedAt));
    res.json({ questions: qs, responses });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch responses" });
  }
});

router.post("/api/community/reactions/toggle", requireVerifiedUser, async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req)!;
    const { entityType, entityId, reactionType, cityId } = req.body;
    if (!entityType || !entityId || !reactionType) {
      return res.status(400).json({ message: "entityType, entityId, and reactionType required" });
    }
    const existing = await db.select().from(contentReactions)
      .where(and(
        eq(contentReactions.entityType, entityType),
        eq(contentReactions.entityId, entityId),
        eq(contentReactions.userId, userId),
      ));
    if (existing.length > 0) {
      if (existing[0].reactionType === reactionType) {
        await db.delete(contentReactions).where(eq(contentReactions.id, existing[0].id));
        res.json({ action: "removed" });
      } else {
        const [row] = await db.update(contentReactions)
          .set({ reactionType })
          .where(eq(contentReactions.id, existing[0].id))
          .returning();
        res.json({ action: "changed", reaction: row });
      }
    } else {
      const [row] = await db.insert(contentReactions).values({ entityType, entityId, userId, reactionType, cityId: cityId || null }).returning();
      res.json({ action: "added", reaction: row });
    }
  } catch (err: any) {
    console.error("[CommunityEngagement] reaction toggle error:", err);
    res.status(500).json({ message: "Failed to toggle reaction" });
  }
});

router.get("/api/community/reactions", async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) return res.status(400).json({ message: "entityType and entityId required" });
    const counts = await db.select({
      reactionType: contentReactions.reactionType,
      count: sql<number>`COUNT(*)::int`,
    }).from(contentReactions)
      .where(and(eq(contentReactions.entityType, sql`${entityType}`), eq(contentReactions.entityId, entityId as string)))
      .groupBy(contentReactions.reactionType);
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.reactionType] = c.count;
    const userId = getPublicUserId(req);
    let userReaction: string | null = null;
    if (userId) {
      const [ur] = await db.select({ reactionType: contentReactions.reactionType }).from(contentReactions)
        .where(and(
          eq(contentReactions.entityType, sql`${entityType}`),
          eq(contentReactions.entityId, entityId as string),
          eq(contentReactions.userId, userId),
        ));
      if (ur) userReaction = ur.reactionType;
    }
    res.json({ counts: countMap, userReaction, totalReactions: Object.values(countMap).reduce((a, b) => a + b, 0) });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch reactions" });
  }
});

router.get("/api/admin/community/reactions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, dateFrom, dateTo } = req.query;
    const conditions: SQL[] = [];
    if (cityId) conditions.push(eq(contentReactions.cityId, cityId as string));
    if (dateFrom) conditions.push(gte(contentReactions.createdAt, new Date(dateFrom as string)));
    if (dateTo) conditions.push(lte(contentReactions.createdAt, new Date(dateTo as string)));
    const typeCounts = await db.select({
      reactionType: contentReactions.reactionType,
      count: sql<number>`COUNT(*)::int`,
    }).from(contentReactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(contentReactions.reactionType);
    const entityTypeCounts = await db.select({
      entityType: contentReactions.entityType,
      count: sql<number>`COUNT(*)::int`,
    }).from(contentReactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(contentReactions.entityType);
    const topReacted = await db.select({
      entityType: contentReactions.entityType,
      entityId: contentReactions.entityId,
      count: sql<number>`COUNT(*)::int`,
    }).from(contentReactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(contentReactions.entityType, contentReactions.entityId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);
    const recent = await db.select({
      id: contentReactions.id,
      entityType: contentReactions.entityType,
      entityId: contentReactions.entityId,
      reactionType: contentReactions.reactionType,
      createdAt: contentReactions.createdAt,
      displayName: sql<string>`COALESCE(${publicUsers.displayName}, 'Anonymous')`,
    }).from(contentReactions)
      .leftJoin(publicUsers, eq(contentReactions.userId, publicUsers.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(contentReactions.createdAt))
      .limit(25);
    const reactionsByType: Record<string, number> = {};
    for (const tc of typeCounts) reactionsByType[tc.reactionType] = tc.count;
    const reactionsByEntity: Record<string, number> = {};
    for (const ec of entityTypeCounts) reactionsByEntity[ec.entityType] = ec.count;
    res.json({ reactionsByType, reactionsByEntity, topReacted, recent });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch reactions analytics" });
  }
});

router.get("/api/admin/community/engagement-summary", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId } = req.query;
    const cid = cityId as string | undefined;
    const [nhrCount] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(neighborhoodReviews).where(cid ? eq(neighborhoodReviews.cityId, cid) : undefined);
    const [pollCount] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(polls).where(cid ? eq(polls.cityId, cid) : undefined);
    const voteCountQuery = cid
      ? await db.select({ total: sql<number>`COUNT(*)::int` }).from(pollVotes).innerJoin(polls, eq(pollVotes.pollId, polls.id)).where(eq(polls.cityId, cid))
      : await db.select({ total: sql<number>`COUNT(*)::int` }).from(pollVotes);
    const [campaignCount] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(votingCampaigns).where(cid ? eq(votingCampaigns.cityId, cid) : undefined);
    const ballotCountQuery = cid
      ? await db.select({ total: sql<number>`COUNT(*)::int` }).from(votingBallots).innerJoin(votingCampaigns, eq(votingBallots.campaignId, votingCampaigns.id)).where(eq(votingCampaigns.cityId, cid))
      : await db.select({ total: sql<number>`COUNT(*)::int` }).from(votingBallots);
    const [quizCount] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(quizzes).where(cid ? eq(quizzes.cityId, cid) : undefined);
    const attemptCountQuery = cid
      ? await db.select({ total: sql<number>`COUNT(*)::int` }).from(quizAttempts).innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id)).where(eq(quizzes.cityId, cid))
      : await db.select({ total: sql<number>`COUNT(*)::int` }).from(quizAttempts);
    const [surveyCount] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(surveys).where(cid ? eq(surveys.cityId, cid) : undefined);
    const responseCountQuery = cid
      ? await db.select({ total: sql<number>`COUNT(*)::int` }).from(surveyResponses).innerJoin(surveys, eq(surveyResponses.surveyId, surveys.id)).where(eq(surveys.cityId, cid))
      : await db.select({ total: sql<number>`COUNT(*)::int` }).from(surveyResponses);
    const [reactionCount] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(contentReactions).where(cid ? eq(contentReactions.cityId, cid) : undefined);
    const [activePolls] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(polls).where(and(cid ? eq(polls.cityId, cid) : undefined, eq(polls.isActive, true)));
    const [activeSurveys] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(surveys).where(and(cid ? eq(surveys.cityId, cid) : undefined, eq(surveys.isActive, true)));
    const [activeQuizzes] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(quizzes).where(and(cid ? eq(quizzes.cityId, cid) : undefined, eq(quizzes.isActive, true)));
    const [activeCampaigns] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(votingCampaigns).where(and(cid ? eq(votingCampaigns.cityId, cid) : undefined, eq(votingCampaigns.status, sql`'active'`)));
    const [pendingReviews] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(neighborhoodReviews).where(and(cid ? eq(neighborhoodReviews.cityId, cid) : undefined, eq(neighborhoodReviews.status, sql`'PENDING'`)));

    const topReactedContent = await db.select({
      entityType: contentReactions.entityType,
      entityId: contentReactions.entityId,
      count: sql<number>`COUNT(*)::int`,
    }).from(contentReactions)
      .where(cid ? eq(contentReactions.cityId, cid) : undefined)
      .groupBy(contentReactions.entityType, contentReactions.entityId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);

    const mostReviewedZones = await db.select({
      zoneId: neighborhoodReviews.zoneId,
      zoneName: zones.name,
      reviewCount: sql<number>`COUNT(*)::int`,
      avgRating: sql<number>`ROUND(AVG(${neighborhoodReviews.rating})::numeric, 1)::float`,
    }).from(neighborhoodReviews)
      .leftJoin(zones, eq(neighborhoodReviews.zoneId, zones.id))
      .where(and(cid ? eq(neighborhoodReviews.cityId, cid) : undefined, eq(neighborhoodReviews.status, sql`'APPROVED'`)))
      .groupBy(neighborhoodReviews.zoneId, zones.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);

    res.json({
      neighborhoodReviews: nhrCount?.total || 0,
      polls: pollCount?.total || 0,
      pollVotes: voteCountQuery[0]?.total || 0,
      votingCampaigns: campaignCount?.total || 0,
      votingBallots: ballotCountQuery[0]?.total || 0,
      quizzes: quizCount?.total || 0,
      quizAttempts: attemptCountQuery[0]?.total || 0,
      surveys: surveyCount?.total || 0,
      surveyResponses: responseCountQuery[0]?.total || 0,
      contentReactions: reactionCount?.total || 0,
      activePolls: activePolls?.total || 0,
      activeSurveys: activeSurveys?.total || 0,
      activeQuizzes: activeQuizzes?.total || 0,
      activeCampaigns: activeCampaigns?.total || 0,
      pendingReviews: pendingReviews?.total || 0,
      topReactedContent,
      mostReviewedZones,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch engagement summary" });
  }
});

router.get("/api/admin/community/quizzes/hardest-questions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId } = req.query;
    const cid = cityId as string | undefined;
    const quizList = await db.select().from(quizzes).where(cid ? eq(quizzes.cityId, cid) : undefined);
    if (quizList.length === 0) return res.json([]);
    const quizIds = quizList.map(q => q.id);
    const allQuestions = await db.select().from(quizQuestions).where(inArray(quizQuestions.quizId, quizIds)).orderBy(asc(quizQuestions.sortOrder));
    if (allQuestions.length === 0) return res.json([]);
    const attempts = await db.select().from(quizAttempts).where(inArray(quizAttempts.quizId, quizIds));
    if (attempts.length === 0) return res.json([]);
    const questionsByQuiz: Record<string, typeof allQuestions> = {};
    for (const qq of allQuestions) {
      if (!questionsByQuiz[qq.quizId]) questionsByQuiz[qq.quizId] = [];
      questionsByQuiz[qq.quizId].push(qq);
    }
    const questionStats: Record<string, { quizTitle: string; question: string; total: number; wrong: number }> = {};
    for (const attempt of attempts) {
      const quiz = quizList.find(q => q.id === attempt.quizId);
      if (!quiz) continue;
      const answers = attempt.answers as number[] | null;
      const questions = questionsByQuiz[quiz.id];
      if (!answers || !questions) continue;
      for (let i = 0; i < questions.length; i++) {
        if (i >= answers.length) break;
        const qq = questions[i];
        const key = `${quiz.id}-${qq.id}`;
        if (!questionStats[key]) questionStats[key] = { quizTitle: quiz.title, question: qq.question, total: 0, wrong: 0 };
        questionStats[key].total++;
        if (answers[i] !== qq.correctIndex) questionStats[key].wrong++;
      }
    }
    const result = Object.values(questionStats)
      .map(qs => ({ ...qs, wrongPercent: Math.round((qs.wrong / qs.total) * 100) }))
      .sort((a, b) => b.wrongPercent - a.wrongPercent)
      .slice(0, 10);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ message: "Failed to fetch hardest questions" });
  }
});

router.get("/api/admin/community/recent-activity", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId } = req.query;
    const cid = cityId as string | undefined;
    const recentReviews = await db.select({
      id: neighborhoodReviews.id,
      type: sql<string>`'review'`,
      label: sql<string>`COALESCE(${publicUsers.displayName}, 'Anonymous') || ' reviewed ' || COALESCE(${zones.name}, 'a neighborhood')`,
      createdAt: neighborhoodReviews.createdAt,
    }).from(neighborhoodReviews)
      .leftJoin(publicUsers, eq(neighborhoodReviews.userId, publicUsers.id))
      .leftJoin(zones, eq(neighborhoodReviews.zoneId, zones.id))
      .where(cid ? eq(neighborhoodReviews.cityId, cid) : undefined)
      .orderBy(desc(neighborhoodReviews.createdAt))
      .limit(5);
    const recentVotes = await db.select({
      id: pollVotes.id,
      type: sql<string>`'poll_vote'`,
      label: sql<string>`'Vote cast on poll'`,
      createdAt: pollVotes.createdAt,
    }).from(pollVotes)
      .innerJoin(polls, eq(pollVotes.pollId, polls.id))
      .where(cid ? eq(polls.cityId, cid) : undefined)
      .orderBy(desc(pollVotes.createdAt))
      .limit(5);
    const recentAttempts = await db.select({
      id: quizAttempts.id,
      type: sql<string>`'quiz_attempt'`,
      label: sql<string>`'Quiz attempt on "' || ${quizzes.title} || '"'`,
      createdAt: quizAttempts.completedAt,
    }).from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(cid ? eq(quizzes.cityId, cid) : undefined)
      .orderBy(desc(quizAttempts.completedAt))
      .limit(5);
    const recentSurveyResponses = await db.select({
      id: surveyResponses.id,
      type: sql<string>`'survey_response'`,
      label: sql<string>`'Survey response to "' || ${surveys.title} || '"'`,
      createdAt: surveyResponses.submittedAt,
    }).from(surveyResponses)
      .innerJoin(surveys, eq(surveyResponses.surveyId, surveys.id))
      .where(cid ? eq(surveys.cityId, cid) : undefined)
      .orderBy(desc(surveyResponses.submittedAt))
      .limit(5);
    const recentReactions = await db.select({
      id: contentReactions.id,
      type: sql<string>`'reaction'`,
      label: sql<string>`COALESCE(${publicUsers.displayName}, 'Someone') || ' reacted ' || ${contentReactions.reactionType} || ' on ' || ${contentReactions.entityType}`,
      createdAt: contentReactions.createdAt,
    }).from(contentReactions)
      .leftJoin(publicUsers, eq(contentReactions.userId, publicUsers.id))
      .where(cid ? eq(contentReactions.cityId, cid) : undefined)
      .orderBy(desc(contentReactions.createdAt))
      .limit(5);
    const allActivity = [...recentReviews, ...recentVotes, ...recentAttempts, ...recentSurveyResponses, ...recentReactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15);
    res.json(allActivity);
  } catch (err: unknown) {
    res.status(500).json({ message: "Failed to fetch recent activity" });
  }
});

router.get("/api/admin/community/reviews/trends", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, dateFrom, dateTo } = req.query;
    const cid = cityId as string | undefined;
    const conditions: SQL[] = [];
    if (cid) conditions.push(eq(neighborhoodReviews.cityId, cid));
    conditions.push(eq(neighborhoodReviews.status, "APPROVED"));
    if (dateFrom) conditions.push(gte(neighborhoodReviews.createdAt, new Date(dateFrom as string)));
    if (dateTo) conditions.push(lte(neighborhoodReviews.createdAt, new Date(dateTo as string)));
    const neighborhoodTrends = await db.select({
      month: sql<string>`TO_CHAR(${neighborhoodReviews.createdAt}, 'YYYY-MM')`,
      avgRating: sql<number>`ROUND(AVG(${neighborhoodReviews.rating})::numeric, 2)`,
      count: sql<number>`COUNT(*)::int`,
    }).from(neighborhoodReviews)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`TO_CHAR(${neighborhoodReviews.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${neighborhoodReviews.createdAt}, 'YYYY-MM')`);

    const bizConditions: SQL[] = [eq(reviews.status, "APPROVED")];
    if (cid) bizConditions.push(eq(businesses.cityId, cid));
    if (dateFrom) bizConditions.push(gte(reviews.createdAt, new Date(dateFrom as string)));
    if (dateTo) bizConditions.push(lte(reviews.createdAt, new Date(dateTo as string)));
    const businessTrends = await db.select({
      month: sql<string>`TO_CHAR(${reviews.createdAt}, 'YYYY-MM')`,
      avgRating: sql<number>`ROUND(AVG(${reviews.rating})::numeric, 2)`,
      count: sql<number>`COUNT(*)::int`,
    }).from(reviews)
      .innerJoin(businesses, eq(reviews.businessId, businesses.id))
      .where(and(...bizConditions))
      .groupBy(sql`TO_CHAR(${reviews.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${reviews.createdAt}, 'YYYY-MM')`);

    res.json({ neighborhoodTrends, businessTrends });
  } catch (err: unknown) {
    res.status(500).json({ message: "Failed to fetch review trends" });
  }
});

router.get("/api/admin/community/reviews/top-rated", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, dateFrom, dateTo } = req.query;
    const cid = cityId as string | undefined;
    const nConditions: SQL[] = [eq(neighborhoodReviews.status, "APPROVED")];
    if (cid) nConditions.push(eq(neighborhoodReviews.cityId, cid));
    if (dateFrom) nConditions.push(gte(neighborhoodReviews.createdAt, new Date(dateFrom as string)));
    if (dateTo) nConditions.push(lte(neighborhoodReviews.createdAt, new Date(dateTo as string)));
    const topNeighborhoods = await db.select({
      zoneId: neighborhoodReviews.zoneId,
      zoneName: zones.name,
      avgRating: sql<number>`ROUND(AVG(${neighborhoodReviews.rating})::numeric, 2)`,
      reviewCount: sql<number>`COUNT(*)::int`,
    }).from(neighborhoodReviews)
      .leftJoin(zones, eq(neighborhoodReviews.zoneId, zones.id))
      .where(and(...nConditions))
      .groupBy(neighborhoodReviews.zoneId, zones.name)
      .orderBy(sql`AVG(${neighborhoodReviews.rating}) DESC`)
      .limit(10);

    const bConditions: SQL[] = [eq(reviews.status, "APPROVED")];
    if (cid) bConditions.push(eq(businesses.cityId, cid));
    if (dateFrom) bConditions.push(gte(reviews.createdAt, new Date(dateFrom as string)));
    if (dateTo) bConditions.push(lte(reviews.createdAt, new Date(dateTo as string)));
    const topBusinesses = await db.select({
      businessId: reviews.businessId,
      businessName: businesses.name,
      avgRating: sql<number>`ROUND(AVG(${reviews.rating})::numeric, 2)`,
      reviewCount: sql<number>`COUNT(*)::int`,
    }).from(reviews)
      .innerJoin(businesses, eq(reviews.businessId, businesses.id))
      .where(and(...bConditions))
      .groupBy(reviews.businessId, businesses.name)
      .orderBy(sql`AVG(${reviews.rating}) DESC`)
      .limit(10);

    res.json({ topNeighborhoods, topBusinesses });
  } catch (err: unknown) {
    res.status(500).json({ message: "Failed to fetch top rated" });
  }
});

export default router;
