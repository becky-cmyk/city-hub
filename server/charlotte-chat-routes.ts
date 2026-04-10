import { type Express, type Request, type Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import type OpenAI from "openai";
import { openai } from "./lib/openai";
import { runImportJob, getDailyUsage, type ImportSummary } from "./google-places";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { db } from "./db";
import { crmContacts, referralTriangles, engagementEvents, importDrafts, businesses, regions, hubZipCoverage, trustProfiles, profileBadges, reviews, charlotteTasks, rssItems, charlottePublicInsights, events, jobs, marketplaceListings, shopItems, shopDrops, giveaways, giveawayEntries, polls, pollVotes, videoContent, zones } from "@shared/schema";
import { eq, and, or, ilike, desc, sql, isNull, lte, inArray, gte, count } from "drizzle-orm";
import { queueTranslation } from "./services/auto-translate";
import crypto from "crypto";
import { LISTING_COPYWRITER_SYSTEM, buildContentRewriteSystem, URL_ARTICLE_SYSTEM, buildAdminChatSystem } from "./ai/prompts/platform-services";
import { orchestrate, getOrchestratorSummary, handleProposalMode, executeWithConstraints, executeWithEngagementCheck, type OrchestratorResult } from "./charlotte-orchestrator";
import { getRecentAdminMemory, buildMemoryContext, recordContextNote } from "./services/charlotte-memory-service";
import { createCharlotteTask } from "./charlotte-task-routes";
import { detectCharlotteMode, detectObjection, detectFitIssue, buildDoctrineContext, buildObjectionContext, buildFitFilterContext, type CharlotteMode, type OnboardingStage } from "./services/charlotte/charlotte-response-doctrine";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as Record<string, unknown>).default || pdfParseModule;

const charlotteUploadDir = path.join(process.cwd(), "uploads", "charlotte-chat");
if (!fs.existsSync(charlotteUploadDir)) fs.mkdirSync(charlotteUploadDir, { recursive: true });

const charlotteUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, charlotteUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".bin";
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "application/pdf",
      "text/csv", "text/plain", "text/tab-separated-values",
      "application/vnd.ms-excel",
    ]);
    const allowedExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".csv", ".tsv", ".txt"]);
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.has(file.mimetype) || allowedExts.has(ext)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

interface CharlotteAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

async function buildZipReference(): Promise<string> {
  try {
    const allHubs = await db.select({ id: regions.id, name: regions.name, code: regions.code })
      .from(regions)
      .where(and(eq(regions.regionType, "hub"), eq(regions.isActive, true)));
    const allCoverage = await db.select().from(hubZipCoverage);

    const hubZipMap = new Map<string, string[]>();
    for (const cov of allCoverage) {
      const hub = allHubs.find(h => h.id === cov.hubRegionId);
      if (!hub) continue;
      const name = hub.name;
      if (!hubZipMap.has(name)) hubZipMap.set(name, []);
      hubZipMap.get(name)!.push(cov.zip);
    }

    const entries: string[] = [];
    for (const [name, zips] of Array.from(hubZipMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      entries.push(`${zips.join("/")}=${name}`);
    }
    return entries.length > 0
      ? `Charlotte Metro ZIP codes and neighborhoods:\n${entries.join(", ")}`
      : "Charlotte ZIP codes: 28202=Uptown, 28203=South End, 28204=Elizabeth, 28205=Plaza Midwood, 28206=NoDa, 28207=Myers Park, 28209=Dilworth, 28210=SouthPark, 28134=Pineville, 28262=University City, 28277=Ballantyne";
  } catch (err) {
    console.error("[Charlotte] Failed to build ZIP reference:", err);
    return "Charlotte ZIP codes: 28202=Uptown, 28203=South End, 28204=Elizabeth, 28205=Plaza Midwood, 28206=NoDa, 28207=Myers Park, 28209=Dilworth, 28210=SouthPark, 28134=Pineville, 28262=University City, 28277=Ballantyne";
  }
}

const requireAdmin = (req: Request, res: Response, next: Function) => {
  if (!(req as any).session?.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
};

const charlotteTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "start_text_search_import",
      description: "Start a Google Places text search import job to find businesses. Builds query automatically from category, ZIP code, and area. Businesses are auto-published and assigned to the correct neighborhood based on their address ZIP code.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Business category to search (e.g. 'restaurants', 'coffee shops', 'hair salons')" },
          zipCode: { type: "string", description: "Optional ZIP code to target (e.g. '28217')" },
          area: { type: "string", description: "Optional area name (e.g. 'South End', 'NoDa'). Defaults to 'Charlotte NC'" },
          maxResults: { type: "number", description: "Max results to import (1-60, default 20)" },
        },
        required: ["category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_nearby_search_import",
      description: "Start a Google Places nearby search import around a location",
      parameters: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Center latitude" },
          lng: { type: "number", description: "Center longitude" },
          radiusMeters: { type: "number", description: "Search radius in meters (default 5000)" },
          keyword: { type: "string", description: "Keyword filter" },
          maxResults: { type: "number", description: "Max results (1-60, default 20)" },
        },
        required: ["lat", "lng", "keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_import_usage",
      description: "Get current daily API usage and limits",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_import_job_status",
      description: "Check the status and results of an import job",
      parameters: {
        type: "object",
        properties: { jobId: { type: "string", description: "The import job ID" } },
        required: ["jobId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_listing_description",
      description: "Generate a bilingual listing description draft for a business using only its factual data",
      parameters: {
        type: "object",
        properties: { presenceId: { type: "string", description: "The business/presence ID" } },
        required: ["presenceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_recent_imports",
      description: "List recent import jobs and their results",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search CRM contacts by name, email, phone, company, or a free-text fuzzy query. Great for finding people from vague descriptions like 'Joe who does something with cars'.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search (searches across name, email, phone, company, jobTitle, notes, connectionSource)" },
          status: { type: "string", description: "Filter by status: 'active', 'inbox', 'archived'" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_details",
      description: "Get full details for a specific CRM contact by ID, including capture evidence and engagement history",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string", description: "The contact ID" },
        },
        required: ["contactId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new CRM contact. Always confirm with the admin before creating.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name (required)" },
          email: { type: "string", description: "Email address" },
          phone: { type: "string", description: "Phone number" },
          company: { type: "string", description: "Company or organization" },
          jobTitle: { type: "string", description: "Job title or role" },
          notes: { type: "string", description: "Notes about this contact" },
          connectionSource: { type: "string", description: "How you met: networking_event, chamber_event, referral, conference, social_media, phone_call, walk_in, other" },
          website: { type: "string", description: "Website URL" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description: "Update fields on an existing CRM contact. Always confirm changes with the admin first.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string", description: "The contact ID to update" },
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          jobTitle: { type: "string" },
          notes: { type: "string" },
          status: { type: "string", description: "active, inbox, archived" },
          nudgeWindowDays: { type: "number", description: "Days between follow-up nudges" },
          birthday: { type: "string", description: "Birthday (MM/DD format)" },
          anniversary: { type: "string", description: "Anniversary (MM/DD format)" },
        },
        required: ["contactId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_inbox_contacts",
      description: "List contacts in 'inbox' status — freshly captured and pending review",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "promote_contacts",
      description: "Move one or more contacts from inbox to active status. Confirm with admin first.",
      parameters: {
        type: "object",
        properties: {
          contactIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of contact IDs to promote from inbox to active",
          },
        },
        required: ["contactIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_referral",
      description: "Create a referral triangle connecting Person A and Person B with a message. Confirm with admin first.",
      parameters: {
        type: "object",
        properties: {
          personAId: { type: "string", description: "Contact ID of Person A" },
          personBId: { type: "string", description: "Contact ID of Person B" },
          sharedMessage: { type: "string", description: "The referral message both people will see" },
          privateMessageToA: { type: "string", description: "Private note for Person A only" },
          privateMessageToB: { type: "string", description: "Private note for Person B only" },
        },
        required: ["personAId", "personBId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_referrals",
      description: "List referral triangles with optional status filter and contact name search",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: submitted, contacted, connected, in_progress, completed, declined" },
          contactName: { type: "string", description: "Search by contact name involved in the referral" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_referral_status",
      description: "Update the status of a referral triangle. Confirm with admin first.",
      parameters: {
        type: "object",
        properties: {
          referralId: { type: "string", description: "The referral triangle ID" },
          status: { type: "string", description: "New status: submitted, contacted, connected, in_progress, completed, declined" },
          outcomeNotes: { type: "string", description: "Optional notes about the outcome" },
        },
        required: ["referralId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_todays_nudges",
      description: "Get today's nudge recommendations — follow-ups, birthdays, anniversaries, stale referrals. Returns a prioritized list.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "log_engagement",
      description: "Log an engagement event for a contact (meeting, call, email, coffee, etc.). Also updates lastContactedAt.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string", description: "The contact ID" },
          eventType: { type: "string", description: "Type: meeting, call, email, coffee, event, referral_given, social, gift, other" },
          notes: { type: "string", description: "Optional notes about the engagement" },
        },
        required: ["contactId", "eventType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_drafts",
      description: "List import drafts awaiting review (PENDING status), with source and type info",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 30)" },
          draftType: { type: "string", description: "Filter by type: BUSINESS, EVENT, ARTICLE" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publish_drafts",
      description: "Publish one or more pending import drafts (creates the actual business/event/article). Confirm with admin first.",
      parameters: {
        type: "object",
        properties: {
          draftIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of draft IDs to publish",
          },
        },
        required: ["draftIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_duplicate_businesses",
      description: "Search for potential duplicate business listings by name, phone, or address. Useful for cleanup.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Business name, phone, or address fragment to search" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rewrite_content",
      description: "Use AI to rewrite/improve text content (business description, article excerpt, etc.). Returns the rewritten version for review.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The original text to rewrite" },
          style: { type: "string", description: "Style: 'professional', 'friendly', 'concise', 'detailed', 'seo_optimized'. Default 'professional'" },
          language: { type: "string", description: "Output language: 'en', 'es', 'both'. Default 'both'" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upgrade_listing_tier",
      description: "Upgrade or change a business listing's tier. Can target a single business by ID/name, or bulk-update all businesses matching a fromTier (optionally filtered by claimStatus). Sets both listingTier and micrositeTier correctly. Confirm with admin first.",
      parameters: {
        type: "object",
        properties: {
          businessId: { type: "string", description: "The business ID to upgrade" },
          businessName: { type: "string", description: "Business name to search for (used if businessId not provided)" },
          tier: { type: "string", description: "Target tier: FREE, VERIFIED, ENHANCED, CHARTER, PREMIUM, NONPROFIT, ORGANIZATION, HEALTHCARE_PROVIDER" },
          fromTier: { type: "string", description: "For bulk operations: update all businesses currently at this tier (e.g. 'VERIFIED')" },
          claimStatus: { type: "string", description: "For bulk operations: only update businesses with this claim status (e.g. 'UNCLAIMED')" },
        },
        required: ["tier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trust_profile",
      description: "Get the trust profile for a business — includes trust level, operational status (paused/removed/eligible), review summary, activity summary, badges, and recommendation eligibility.",
      parameters: {
        type: "object",
        properties: {
          businessId: { type: "string", description: "The business/presence ID" },
        },
        required: ["businessId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "story_from_url",
      description: "Generate an original local-angle article from a URL. Fetches the page, uses AI to write a fresh Charlotte-focused story inspired by the source content. Creates an article draft for review.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to generate a story from" },
          cityId: { type: "string", description: "The city ID (optional, defaults to Charlotte)" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_background_task",
      description: "Create a background task that continues running even if the operator closes the chat. Use this for long-running work like processing captures, generating stories in bulk, creating follow-up drafts, generating proposals, or drafting outreach. Always present the plan to the operator first and explain what you'll do. The task starts in 'awaiting_approval' status — the operator must approve before it runs.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["capture_processing", "followup_generation", "proposal_generation", "story_generation", "outreach_drafting", "general"], description: "Task type" },
          title: { type: "string", description: "Short descriptive title for the task" },
          plan_steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                engine: { type: "string" },
              },
              required: ["description"],
            },
            description: "List of steps Charlotte will take",
          },
          payload: { type: "object", description: "Data needed for task execution (e.g. sessionId, captureIds, proposalId, contactIds)" },
        },
        required: ["type", "title", "plan_steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_tasks",
      description: "Get recent background tasks to check status or report results to the operator",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["awaiting_approval", "pending", "running", "completed", "failed", "all"], description: "Filter by status (default: all)" },
          limit: { type: "number", description: "Max number of tasks to return (default: 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_articles",
      description: "Search stories and articles on the Stories page. This searches RSS feed items (ingested from sources like Blumenthal Arts, Charlotte Observer, WBTV, etc.) and returns matching articles. Searches across title, summary, sourceName, and rewrittenSummary fields. When the operator says 'stories', 'articles', 'RSS articles', or 'published content', use this tool. Try keyword fragments first (e.g., 'symphony' not 'Charlotte Symphony Orchestra').",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword to match against title, summary, or source name" },
          sourceName: { type: "string", description: "Filter by source name (e.g. 'Charlotte Symphony', 'WBTV')" },
          publishStatus: { type: "string", description: "Filter by publish status (e.g. 'published', 'draft', 'suppressed')" },
          reviewStatus: { type: "string", description: "Filter by review status: PENDING, APPROVED, SKIPPED, FLAGGED" },
          dateFrom: { type: "string", description: "Filter articles published after this date (ISO format)" },
          dateTo: { type: "string", description: "Filter articles published before this date (ISO format)" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_article_detail",
      description: "Get full details for a single RSS item/article by ID, including title, summary, image, zone, publish status, edit history, and all metadata.",
      parameters: {
        type: "object",
        properties: {
          articleId: { type: "string", description: "The RSS item ID" },
        },
        required: ["articleId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_article",
      description: "Update fields on an existing RSS item/article. Can change title, summary, image URL, zone, review status, publish status, and article body. Records edit history automatically. Confirm changes with the admin first.",
      parameters: {
        type: "object",
        properties: {
          articleId: { type: "string", description: "The RSS item ID to update" },
          title: { type: "string", description: "New title" },
          summary: { type: "string", description: "New summary text" },
          rewrittenSummary: { type: "string", description: "New rewritten summary" },
          imageUrl: { type: "string", description: "New image URL" },
          localArticleBody: { type: "string", description: "New article body content" },
          zoneSlug: { type: "string", description: "Zone slug assignment" },
          reviewStatus: { type: "string", description: "Review status: PENDING, APPROVED, SKIPPED, FLAGGED" },
          publishStatus: { type: "string", description: "Publish status (e.g. 'published', 'draft', 'suppressed')" },
        },
        required: ["articleId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update_articles",
      description: "Apply the same changes to multiple articles at once. When using filters (filterKeyword/filterSourceName), first call WITHOUT confirmExecution to preview the matched count and sample titles. Then call again WITH confirmExecution: true and the returned articleIds to execute. If more than 5 articles are affected, the work is queued as a background task. Confirm with admin first.",
      parameters: {
        type: "object",
        properties: {
          articleIds: { type: "array", items: { type: "string" }, description: "Array of specific RSS item IDs to update" },
          filterKeyword: { type: "string", description: "Instead of IDs, match articles by keyword in title/summary" },
          filterSourceName: { type: "string", description: "Instead of IDs, match articles by source name" },
          confirmExecution: { type: "boolean", description: "Set to true to confirm and execute after previewing matched articles" },
          title: { type: "string", description: "New title to set (use with caution for bulk)" },
          summary: { type: "string", description: "New summary to set" },
          rewrittenSummary: { type: "string", description: "New rewritten summary to set" },
          imageUrl: { type: "string", description: "New image URL to set" },
          zoneSlug: { type: "string", description: "Zone slug to assign" },
          reviewStatus: { type: "string", description: "Review status: PENDING, APPROVED, SKIPPED, FLAGGED" },
          publishStatus: { type: "string", description: "Publish status to set" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suppress_article",
      description: "Suppress/unpublish an article with a reason. Marks the item as suppressed so it won't appear on the public site. Confirm with admin first.",
      parameters: {
        type: "object",
        properties: {
          articleId: { type: "string", description: "The RSS item ID to suppress" },
          reason: { type: "string", description: "Reason for suppression (e.g. 'duplicate content', 'low quality', 'generic repeated title')" },
        },
        required: ["articleId", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_public_insights",
      description: "Get aggregated intelligence about what the public is searching for, asking Charlotte about, and what demand signals exist. Shows trending searches, common questions, unanswered queries (no matching listings), demand signals (popular searches with few or no results), and hot neighborhoods. Use this when the operator asks about public behavior, search trends, or community needs.",
      parameters: {
        type: "object",
        properties: {
          insightType: { type: "string", enum: ["trending_search", "common_question", "unanswered_query", "demand_signal", "hot_neighborhood", "all"], description: "Type of insight to retrieve (default: all)" },
          timeWindow: { type: "string", enum: ["24h", "7d", "30d"], description: "Time window for the data (default: 7d)" },
          limit: { type: "number", description: "Max results per category (default: 10)" },
          cityId: { type: "string", description: "City ID to scope insights to (optional)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_context_note",
      description: "Save a brief context note to Charlotte's memory about what the operator is working on. Use this when the operator mentions a project, event, or ongoing initiative that Charlotte should remember for future conversations.",
      parameters: {
        type: "object",
        properties: {
          note: { type: "string", description: "Brief context note (e.g. 'Operator is preparing for SouthEnd expo next week', 'Working on networking follow-ups from Chamber event')" },
        },
        required: ["note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_events",
      description: "Search community events on the platform. Find events by keyword, date range, venue, or neighborhood. Use when the operator asks about events, calendar items, or 'what's happening'. Try keyword fragments first.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword to match against event title, description, venue name, or location" },
          dateFrom: { type: "string", description: "Filter events starting after this date (ISO format)" },
          dateTo: { type: "string", description: "Filter events starting before this date (ISO format)" },
          venueName: { type: "string", description: "Filter by venue or location name" },
          zoneName: { type: "string", description: "Filter by neighborhood/zone name" },
          category: { type: "string", description: "Filter by category keyword (searches category IDs/tags)" },
          cityId: { type: "string", description: "Filter by city ID" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_jobs",
      description: "Search job listings on the platform. Find jobs by keyword, employer, employment type, or pay range. Use when the operator asks about jobs, hiring, workforce, or employment listings.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword to match against job title, employer, description, or department" },
          employer: { type: "string", description: "Filter by employer name" },
          employmentType: { type: "string", description: "Filter by type: full-time, part-time, contract, internship, etc." },
          status: { type: "string", description: "Filter by job status: active, closed, expired (default: all)" },
          minPay: { type: "number", description: "Minimum pay amount" },
          maxPay: { type: "number", description: "Maximum pay amount" },
          cityId: { type: "string", description: "Filter by city ID" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_marketplace",
      description: "Search marketplace listings — products, services, real estate, experiences, and classifieds. Use when the operator asks about marketplace items, things for sale, services offered, or real estate listings.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword to match against title, description, or category" },
          category: { type: "string", description: "Filter by category" },
          type: { type: "string", description: "Filter by listing type: CLASSIFIED, CREATOR_ART, CREATOR_PRINTS, CREATOR_MUSIC, CREATOR_VIDEO, CREATOR_DIGITAL, REAL_ESTATE, LOCAL_SERVICE, EXPERIENCE, GIFT_CARD" },
          status: { type: "string", description: "Filter by status: DRAFT, ACTIVE, EXPIRED, REMOVED, FLAGGED, PENDING_REVIEW, ARCHIVED, REJECTED (default: all)" },
          minPrice: { type: "number", description: "Minimum price in cents" },
          maxPrice: { type: "number", description: "Maximum price in cents" },
          cityId: { type: "string", description: "Filter by city ID" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_deals",
      description: "Search shop items (products from businesses) and shop drops (deals, flash sales, coupons). Use when the operator asks about deals, promotions, discounts, shop items, or business products.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword to match against title or description" },
          businessName: { type: "string", description: "Filter by business name (searches the linked business)" },
          itemType: { type: "string", description: "For shop items: product, service, experience, gift_card, wishlist" },
          itemStatus: { type: "string", description: "Filter shop items by status: draft, active, sold_out, expired" },
          dropStatus: { type: "string", description: "Filter shop drops by status: scheduled, active, expired, sold_out" },
          searchType: { type: "string", enum: ["items", "drops", "both"], description: "Search shop items, shop drops (deals), or both (default: both)" },
          cityId: { type: "string", description: "Filter by city ID" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_engagement",
      description: "Search engagement campaigns — giveaways and polls. Use when the operator asks about giveaways, contests, promotions, polls, community questions, or engagement campaigns.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword to match against title/question or description" },
          type: { type: "string", enum: ["giveaway", "poll", "both"], description: "Search giveaways, polls, or both (default: both)" },
          status: { type: "string", description: "For giveaways: draft, scheduled, active, paused, drawing, completed, cancelled. For polls: active or inactive (default: all)" },
          cityId: { type: "string", description: "Filter by city ID" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_hub_tv",
      description: "Search Hub TV video content — YouTube-hosted clips, podcasts, and local media from venue channels and businesses. Use when the operator asks about videos, media, Hub TV, podcasts, or video content.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword to match against video title or description" },
          businessName: { type: "string", description: "Filter by business name" },
          screenEligible: { type: "boolean", description: "Filter for screen-eligible videos (lobby display content)" },
          podcastEligible: { type: "boolean", description: "Filter for podcast-eligible content" },
          cityId: { type: "string", description: "Filter by city ID" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
];

const REFERRAL_STALE_THRESHOLDS: Record<string, number> = {
  submitted: 3,
  contacted: 7,
  connected: 14,
  in_progress: 21,
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function isWithinWindow(dateStr: string, windowDays: number): boolean {
  if (!dateStr) return false;
  const now = new Date();
  const thisYear = now.getFullYear();
  const [month, day] = dateStr.includes("/")
    ? dateStr.split("/").map(Number)
    : dateStr.includes("-")
      ? [parseInt(dateStr.split("-")[1]), parseInt(dateStr.split("-")[2])]
      : [0, 0];
  if (!month || !day) return false;
  const target = new Date(thisYear, month - 1, day);
  if (target < now) target.setFullYear(thisYear + 1);
  const diff = daysBetween(now, target);
  return diff >= 0 && diff <= windowDays;
}

async function executeCharlotteTool(name: string, args: any, userId?: string): Promise<string> {
  try {
  switch (name) {
    case "start_text_search_import": {
      const parts = [args.category];
      if (args.zipCode) parts.push(`in ${args.zipCode}`);
      parts.push(args.area || "Charlotte NC");
      const query = parts.join(" ");

      const job = await storage.createPlaceImportJob({
        createdByUserId: userId || null,
        mode: "text_search",
        queryText: query,
        categoryKeyword: args.category,
        zipCode: args.zipCode || null,
        centerLat: null,
        centerLng: null,
        radiusMeters: null,
        requestedCount: Math.min(args.maxResults || 20, 60),
        status: "queued",
        importedCount: 0,
        autoPublish: true,
      });

      const summary: ImportSummary | { error: string } = await runImportJob(job.id).catch((err) => {
        console.error(`[Charlotte] Import job ${job.id} failed:`, err.message);
        return { error: err.message as string };
      });

      if (!("error" in summary)) {
        const results = await storage.getPlaceImportResults(job.id);
        const importedNames = results
          .filter((r: any) => r.status === "presence_created")
          .map((r: any) => r.name)
          .slice(0, 30);
        return JSON.stringify({
          success: true, jobId: job.id, query,
          summary: { totalFound: summary.totalFound, imported: summary.imported, skipped: summary.skipped, failed: summary.failed },
          importedBusinesses: importedNames,
          message: `Import complete for "${query}". ${summary.imported} businesses imported and auto-published. ${summary.skipped} skipped (duplicates). ${summary.failed} failed.`,
        });
      }

      const errorMsg = summary.error;
      let friendlyMessage: string;
      if (/daily.*limit|quota|OVER_QUERY_LIMIT/i.test(errorMsg)) {
        friendlyMessage = `I've hit the daily Google Places API limit for today. Please try this import again tomorrow when the quota resets.`;
      } else if (/timeout|timed out|RPM throttle/i.test(errorMsg)) {
        friendlyMessage = `The import timed out — Google's API is responding slowly right now. Please try again in a few minutes with a smaller batch size.`;
      } else if (/load failed|fetch failed|network|ECONNREFUSED|ENOTFOUND/i.test(errorMsg)) {
        friendlyMessage = `I couldn't reach Google's Places API — there seems to be a network issue. Please check your internet connection and try again.`;
      } else if (/api key|REQUEST_DENIED|invalid key/i.test(errorMsg)) {
        friendlyMessage = `There's a problem with the Google Places API key configuration. Please ask a developer to check the API key settings.`;
      } else {
        friendlyMessage = `The import for "${query}" didn't complete successfully. Error: ${errorMsg || "Unknown error"}. Please try again or contact support if this keeps happening.`;
      }
      return JSON.stringify({ success: false, jobId: job.id, query, message: friendlyMessage });
    }

    case "start_nearby_search_import": {
      const job = await storage.createPlaceImportJob({
        createdByUserId: userId || null,
        mode: "nearby_search",
        queryText: null,
        categoryKeyword: args.keyword,
        centerLat: args.lat?.toString(),
        centerLng: args.lng?.toString(),
        radiusMeters: args.radiusMeters || 5000,
        requestedCount: Math.min(args.maxResults || 20, 60),
        status: "queued",
        importedCount: 0,
        autoPublish: true,
      });

      const summary = await runImportJob(job.id).catch((err) => {
        console.error(`[Charlotte] Nearby import job ${job.id} failed:`, err.message);
        return null;
      });

      if (summary) {
        const results = await storage.getPlaceImportResults(job.id);
        const importedNames = results
          .filter((r: any) => r.status === "presence_created")
          .map((r: any) => r.name)
          .slice(0, 30);
        return JSON.stringify({
          success: true, jobId: job.id,
          summary: { totalFound: summary.totalFound, imported: summary.imported, skipped: summary.skipped, failed: summary.failed },
          importedBusinesses: importedNames,
          message: `Nearby import complete. ${summary.imported} businesses imported.`,
        });
      }
      return JSON.stringify({ success: false, jobId: job.id, message: `Nearby import job failed.` });
    }

    case "get_import_usage": {
      return JSON.stringify(getDailyUsage());
    }

    case "get_import_job_status": {
      const job = await storage.getPlaceImportJob(args.jobId);
      if (!job) return JSON.stringify({ error: "Job not found" });
      const results = await storage.getPlaceImportResults(args.jobId);
      const counts = {
        total: results.length,
        created: results.filter((r: any) => r.status === "presence_created").length,
        skipped: results.filter((r: any) => r.status === "skipped").length,
        failed: results.filter((r: any) => r.status === "failed").length,
      };
      const importedNames = results
        .filter((r: any) => r.status === "presence_created")
        .map((r: any) => ({ name: r.name, address: r.formattedAddress }))
        .slice(0, 30);
      return JSON.stringify({ job: { id: job.id, status: job.status, query: job.queryText, importedCount: job.importedCount }, resultCounts: counts, importedBusinesses: importedNames });
    }

    case "draft_listing_description": {
      const biz = await storage.getBusinessById(args.presenceId);
      if (!biz) return JSON.stringify({ error: "Business not found" });

      if (!openai) return JSON.stringify({ error: "OpenAI not configured" });
      const facts = [
        `Business name: ${biz.name}`,
        biz.address ? `Address: ${biz.address}, ${biz.city || ""}, ${biz.state || ""}` : null,
        biz.phone ? `Phone: ${biz.phone}` : null,
        biz.websiteUrl ? `Website: ${biz.websiteUrl}` : null,
        biz.hoursOfOperation ? `Hours: ${JSON.stringify(biz.hoursOfOperation)}` : null,
      ].filter(Boolean).join("\n");

      const draftResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: LISTING_COPYWRITER_SYSTEM },
          { role: "user", content: `Write listing descriptions using only these facts:\n${facts}\n\nRespond in this exact JSON format:\n{"short": "...", "medium": "...", "shortEs": "...", "mediumEs": "..."}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = draftResp.choices[0]?.message?.content || "{}";
      let drafts;
      try { drafts = JSON.parse(content); } catch { drafts = { short: content, medium: content }; }

      await storage.updateBusiness(args.presenceId, {
        descriptionDraftEn: `SHORT:\n${drafts.short}\n\nMEDIUM:\n${drafts.medium}`,
        descriptionDraftEs: drafts.shortEs || drafts.mediumEs ? `SHORT:\n${drafts.shortEs || ""}\n\nMEDIUM:\n${drafts.mediumEs || ""}` : null,
        descriptionSource: "google_places_only",
        descriptionDraftedAt: new Date(),
      });

      return JSON.stringify({ success: true, presenceId: args.presenceId, name: biz.name, drafts, message: `Drafts generated and saved for "${biz.name}".` });
    }

    case "list_recent_imports": {
      const jobs = await storage.listPlaceImportJobs();
      const recent = jobs.slice(0, 10).map((j) => ({
        id: j.id, mode: j.mode, query: j.queryText || j.categoryKeyword,
        status: j.status, requested: j.requestedCount, imported: j.importedCount, createdAt: j.createdAt,
      }));
      return JSON.stringify(recent);
    }

    case "search_contacts": {
      const q = args.query?.trim();
      if (!q) return JSON.stringify({ contacts: [], message: "Please provide a search term." });

      const limit = Math.min(args.limit || 20, 50);
      const searchPattern = `%${q}%`;
      const conditions = [
        ilike(crmContacts.name, searchPattern),
        ilike(crmContacts.email, searchPattern),
        ilike(crmContacts.phone, searchPattern),
        ilike(crmContacts.company, searchPattern),
        ilike(crmContacts.jobTitle, searchPattern),
        ilike(crmContacts.notes, searchPattern),
        ilike(crmContacts.connectionSource, searchPattern),
        ilike(crmContacts.address, searchPattern),
      ];

      let whereClause = or(...conditions)!;
      if (args.status) {
        whereClause = and(whereClause, eq(crmContacts.status, args.status))!;
      }
      if (userId) {
        whereClause = and(whereClause, eq(crmContacts.userId, userId))!;
      }

      const results = await db.select({
        id: crmContacts.id, name: crmContacts.name, email: crmContacts.email,
        phone: crmContacts.phone, company: crmContacts.company, jobTitle: crmContacts.jobTitle,
        status: crmContacts.status, connectionSource: crmContacts.connectionSource,
        lastContactedAt: crmContacts.lastContactedAt, notes: crmContacts.notes,
      }).from(crmContacts).where(whereClause).orderBy(desc(crmContacts.updatedAt)).limit(limit);

      return JSON.stringify({ contacts: results, count: results.length, message: `Found ${results.length} contact(s) matching "${q}".` });
    }

    case "get_contact_details": {
      if (!userId) return JSON.stringify({ error: "No user session" });
      const contact = await db.select().from(crmContacts).where(and(eq(crmContacts.id, args.contactId), eq(crmContacts.userId, userId))!).then(r => r[0]);
      if (!contact) return JSON.stringify({ error: "Contact not found" });

      const events = await db.select().from(engagementEvents)
        .where(eq(engagementEvents.contactId, args.contactId))
        .orderBy(desc(engagementEvents.createdAt)).limit(10);

      const referrals = await db.select().from(referralTriangles)
        .where(or(
          eq(referralTriangles.personAId, args.contactId),
          eq(referralTriangles.personBId, args.contactId)
        )!)
        .orderBy(desc(referralTriangles.createdAt)).limit(10);

      return JSON.stringify({
        contact: {
          id: contact.id, name: contact.name, email: contact.email, phone: contact.phone,
          company: contact.company, jobTitle: contact.jobTitle, status: contact.status,
          connectionSource: contact.connectionSource, notes: contact.notes,
          birthday: contact.birthday, anniversary: contact.anniversary,
          lastContactedAt: contact.lastContactedAt, nudgeWindowDays: contact.nudgeWindowDays,
          captureMethod: contact.captureMethod, website: contact.website, address: contact.address,
          isFavorite: contact.isFavorite, createdAt: contact.createdAt,
          hasBusinessCard: !!contact.businessCardImageUrl,
          hasAudioRecording: !!contact.audioRecordingUrl,
          hasHandwriting: !!contact.handwritingImageUrl,
        },
        recentEngagements: events.map(e => ({ type: e.eventType, source: e.source, date: e.createdAt })),
        referrals: referrals.map(r => ({ id: r.id, status: r.status, personAId: r.personAId, personBId: r.personBId, message: r.sharedMessage, createdAt: r.createdAt })),
      });
    }

    case "create_contact": {
      if (!userId) return JSON.stringify({ error: "No user session" });
      const newContact = await db.insert(crmContacts).values({
        userId,
        name: args.name,
        email: args.email || null,
        phone: args.phone || null,
        company: args.company || null,
        jobTitle: args.jobTitle || null,
        notes: args.notes || null,
        connectionSource: args.connectionSource || null,
        website: args.website || null,
        status: "active",
        captureMethod: "charlotte_ai",
      }).returning();

      return JSON.stringify({ success: true, contact: { id: newContact[0].id, name: newContact[0].name }, message: `Contact "${args.name}" created successfully.` });
    }

    case "update_contact": {
      if (!userId) return JSON.stringify({ error: "No user session" });
      const existing = await db.select().from(crmContacts).where(and(eq(crmContacts.id, args.contactId), eq(crmContacts.userId, userId))!).then(r => r[0]);
      if (!existing) return JSON.stringify({ error: "Contact not found" });

      const updates: any = { updatedAt: new Date() };
      if (args.name) updates.name = args.name;
      if (args.email !== undefined) updates.email = args.email;
      if (args.phone !== undefined) updates.phone = args.phone;
      if (args.company !== undefined) updates.company = args.company;
      if (args.jobTitle !== undefined) updates.jobTitle = args.jobTitle;
      if (args.notes !== undefined) updates.notes = args.notes;
      if (args.status) updates.status = args.status;
      if (args.nudgeWindowDays !== undefined) updates.nudgeWindowDays = args.nudgeWindowDays;
      if (args.birthday !== undefined) updates.birthday = args.birthday;
      if (args.anniversary !== undefined) updates.anniversary = args.anniversary;

      await db.update(crmContacts).set(updates).where(eq(crmContacts.id, args.contactId));
      return JSON.stringify({ success: true, message: `Contact "${existing.name}" updated.`, updatedFields: Object.keys(updates).filter(k => k !== "updatedAt") });
    }

    case "list_inbox_contacts": {
      const limit = Math.min(args.limit || 20, 50);
      let whereClause = eq(crmContacts.status, "inbox");
      if (userId) whereClause = and(whereClause, eq(crmContacts.userId, userId))! as any;

      const contacts = await db.select({
        id: crmContacts.id, name: crmContacts.name, email: crmContacts.email,
        phone: crmContacts.phone, company: crmContacts.company, captureMethod: crmContacts.captureMethod,
        connectionSource: crmContacts.connectionSource, createdAt: crmContacts.createdAt,
      }).from(crmContacts).where(whereClause).orderBy(desc(crmContacts.createdAt)).limit(limit);

      return JSON.stringify({ contacts, count: contacts.length, message: `${contacts.length} contact(s) in your inbox.` });
    }

    case "promote_contacts": {
      if (!userId) return JSON.stringify({ error: "No user session" });
      const ids = args.contactIds || [];
      if (ids.length === 0) return JSON.stringify({ error: "No contact IDs provided" });

      await db.update(crmContacts)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(inArray(crmContacts.id, ids), eq(crmContacts.status, "inbox"), eq(crmContacts.userId, userId))!);

      return JSON.stringify({ success: true, promoted: ids.length, message: `${ids.length} contact(s) promoted from inbox to active.` });
    }

    case "create_referral": {
      if (!userId) return JSON.stringify({ error: "No user session" });

      const personA = await db.select({ name: crmContacts.name }).from(crmContacts).where(and(eq(crmContacts.id, args.personAId), eq(crmContacts.userId, userId))!).then(r => r[0]);
      const personB = await db.select({ name: crmContacts.name }).from(crmContacts).where(and(eq(crmContacts.id, args.personBId), eq(crmContacts.userId, userId))!).then(r => r[0]);

      if (!personA) return JSON.stringify({ error: `Person A (${args.personAId}) not found` });
      if (!personB) return JSON.stringify({ error: `Person B (${args.personBId}) not found` });

      const referral = await db.insert(referralTriangles).values({
        userId,
        personAId: args.personAId,
        personBId: args.personBId,
        sharedMessage: args.sharedMessage || null,
        privateMessageToA: args.privateMessageToA || null,
        privateMessageToB: args.privateMessageToB || null,
        status: "submitted",
        statusUpdatedAt: new Date(),
      }).returning();

      return JSON.stringify({
        success: true,
        referral: { id: referral[0].id, personA: personA.name, personB: personB.name },
        message: `Referral created: ${personA.name} ↔ ${personB.name}`,
      });
    }

    case "list_referrals": {
      const limit = Math.min(args.limit || 20, 50);
      let conditions: any[] = [];
      if (userId) conditions.push(eq(referralTriangles.userId, userId));
      if (args.status) conditions.push(eq(referralTriangles.status, args.status as any));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      let results = await db.select().from(referralTriangles)
        .where(whereClause)
        .orderBy(desc(referralTriangles.createdAt)).limit(limit);

      if (args.contactName) {
        const namePattern = `%${args.contactName}%`;
        const matchingContacts = await db.select({ id: crmContacts.id }).from(crmContacts)
          .where(ilike(crmContacts.name, namePattern));
        const matchIds = matchingContacts.map(c => c.id);
        results = results.filter(r => matchIds.includes(r.personAId) || matchIds.includes(r.personBId));
      }

      const enriched = await Promise.all(results.map(async (r) => {
        const a = await db.select({ name: crmContacts.name }).from(crmContacts).where(eq(crmContacts.id, r.personAId)).then(x => x[0]);
        const b = await db.select({ name: crmContacts.name }).from(crmContacts).where(eq(crmContacts.id, r.personBId)).then(x => x[0]);
        return { id: r.id, personA: a?.name || "Unknown", personB: b?.name || "Unknown", status: r.status, message: r.sharedMessage, createdAt: r.createdAt };
      }));

      return JSON.stringify({ referrals: enriched, count: enriched.length });
    }

    case "update_referral_status": {
      if (!userId) return JSON.stringify({ error: "No user session" });
      const existing = await db.select().from(referralTriangles).where(and(eq(referralTriangles.id, args.referralId), eq(referralTriangles.userId, userId))!).then(r => r[0]);
      if (!existing) return JSON.stringify({ error: "Referral not found" });

      const updates: any = { status: args.status, statusUpdatedAt: new Date() };
      if (args.outcomeNotes) updates.outcomeNotes = args.outcomeNotes;

      await db.update(referralTriangles).set(updates).where(eq(referralTriangles.id, args.referralId));
      return JSON.stringify({ success: true, message: `Referral status updated to "${args.status}".` });
    }

    case "get_todays_nudges": {
      if (!userId) return JSON.stringify({ error: "No user session" });
      const now = new Date();
      const nudges: any[] = [];

      const contacts = await db.select().from(crmContacts)
        .where(and(
          eq(crmContacts.userId, userId),
          eq(crmContacts.status, "active"),
          eq(crmContacts.nudgeSkippedToday, false),
          or(isNull(crmContacts.nudgeSnoozeUntil), lte(crmContacts.nudgeSnoozeUntil, now))!
        ));

      for (const contact of contacts) {
        if (contact.lastContactedAt && contact.nudgeWindowDays) {
          const daysSince = daysBetween(contact.lastContactedAt, now);
          if (daysSince >= contact.nudgeWindowDays) {
            nudges.push({
              type: "follow_up", score: 100 + (daysSince - contact.nudgeWindowDays) * 2,
              contactId: contact.id, contactName: contact.name,
              reason: `Last contacted ${daysSince} days ago (window: ${contact.nudgeWindowDays}d)`,
            });
          }
        } else if (!contact.lastContactedAt) {
          nudges.push({
            type: "follow_up", score: 80, contactId: contact.id, contactName: contact.name,
            reason: "Never contacted — new connection",
          });
        }

        if (contact.birthday && isWithinWindow(contact.birthday, 7)) {
          nudges.push({ type: "birthday", score: 120, contactId: contact.id, contactName: contact.name, reason: `Birthday coming up (${contact.birthday})` });
        }
        if (contact.anniversary && isWithinWindow(contact.anniversary, 7)) {
          nudges.push({ type: "anniversary", score: 110, contactId: contact.id, contactName: contact.name, reason: `Anniversary coming up (${contact.anniversary})` });
        }
      }

      const activeStatuses = ["submitted", "contacted", "connected", "in_progress"] as const;
      const triangles = await db.select().from(referralTriangles)
        .where(and(
          eq(referralTriangles.userId, userId),
          or(...activeStatuses.map(s => eq(referralTriangles.status, s)))!,
          isNull(referralTriangles.nudgeDismissedAt)
        ));

      for (const t of triangles) {
        const status = t.status || "submitted";
        const threshold = REFERRAL_STALE_THRESHOLDS[status];
        if (threshold && t.statusUpdatedAt) {
          const daysSince = daysBetween(t.statusUpdatedAt, now);
          if (daysSince >= threshold) {
            const a = await db.select({ name: crmContacts.name }).from(crmContacts).where(eq(crmContacts.id, t.personAId)).then(x => x[0]);
            const b = await db.select({ name: crmContacts.name }).from(crmContacts).where(eq(crmContacts.id, t.personBId)).then(x => x[0]);
            nudges.push({
              type: "referral_stale", score: 90 + daysSince,
              referralId: t.id, contactName: `${a?.name || "?"} ↔ ${b?.name || "?"}`,
              reason: `Referral stuck at "${status}" for ${daysSince} days`,
            });
          }
        }
      }

      nudges.sort((a, b) => b.score - a.score);
      const budgeted = nudges.slice(0, 8);
      return JSON.stringify({ nudges: budgeted, totalAvailable: nudges.length, budget: 8, message: `${budgeted.length} nudge(s) for today (${nudges.length} total available).` });
    }

    case "log_engagement": {
      if (!userId) return JSON.stringify({ error: "No user session" });
      const contact = await db.select({ name: crmContacts.name }).from(crmContacts).where(eq(crmContacts.id, args.contactId)).then(r => r[0]);
      if (!contact) return JSON.stringify({ error: "Contact not found" });

      await db.insert(engagementEvents).values({
        userId,
        trackingToken: crypto.randomUUID(),
        eventType: args.eventType as any,
        source: "manual" as any,
        contactId: args.contactId,
        contactName: contact.name,
        metadata: args.notes ? { notes: args.notes } : null,
        firedAt: new Date(),
      });

      await db.update(crmContacts)
        .set({ lastContactedAt: new Date(), updatedAt: new Date() })
        .where(eq(crmContacts.id, args.contactId));

      return JSON.stringify({ success: true, message: `Logged ${args.eventType} engagement with ${contact.name}. Last contacted date updated.` });
    }

    case "list_pending_drafts": {
      const limit = Math.min(args.limit || 30, 100);
      let whereClause: any = eq(importDrafts.status, "PENDING");
      if (args.draftType) {
        whereClause = and(whereClause, eq(importDrafts.draftType, args.draftType as any));
      }

      const drafts = await db.select({
        id: importDrafts.id, draftType: importDrafts.draftType, source: importDrafts.source,
        status: importDrafts.status, extractedData: importDrafts.extractedData, createdAt: importDrafts.createdAt,
      }).from(importDrafts).where(whereClause).orderBy(desc(importDrafts.createdAt)).limit(limit);

      const formatted = drafts.map(d => ({
        id: d.id, type: d.draftType, source: d.source,
        name: (d.extractedData as any)?.name || (d.extractedData as any)?.title || "Untitled",
        address: (d.extractedData as any)?.address || null,
        createdAt: d.createdAt,
      }));

      return JSON.stringify({ drafts: formatted, count: formatted.length, message: `${formatted.length} pending draft(s) awaiting review.` });
    }

    case "publish_drafts": {
      const ids = args.draftIds || [];
      if (ids.length === 0) return JSON.stringify({ error: "No draft IDs provided" });

      let published = 0;
      let failed = 0;
      const results: any[] = [];

      for (const draftId of ids) {
        try {
          const draft = await storage.getImportDraftById(draftId);
          if (!draft || draft.status === "PUBLISHED") {
            results.push({ id: draftId, ok: false, error: draft ? "Already published" : "Not found" });
            failed++;
            continue;
          }

          const data = draft.extractedData as any;
          let entityId = "";

          if (draft.draftType === "BUSINESS") {
            const existing = await storage.getBusinessBySlug(draft.cityId, data.slug);
            if (existing) {
              results.push({ id: draftId, ok: false, error: `Duplicate slug: ${data.slug}` });
              failed++;
              continue;
            }
            const biz = await storage.createBusiness({
              cityId: draft.cityId, zoneId: data.zoneId,
              name: data.name || "Unnamed Business", slug: data.slug,
              description: data.description || "", address: data.address || "",
              city: data.city || "", state: data.state || "", zip: data.zip || "",
              phone: data.phone || "", websiteUrl: data.websiteUrl || "",
              categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
              googlePlaceId: data.googlePlaceId || null,
              googleRating: data.googleRating ? String(data.googleRating) : null,
              googleReviewCount: data.googleReviewCount ? Number(data.googleReviewCount) : null,
              googleMapsUrl: data.googleMapsUrl || null,
              listingTier: "FREE", claimStatus: "UNCLAIMED",
            });
            entityId = biz.id;
            queueTranslation("business", biz.id);
          } else if (draft.draftType === "EVENT") {
            const evt = await storage.createEvent({
              cityId: draft.cityId, zoneId: data.zoneId,
              title: data.title, slug: data.slug,
              description: data.description || "",
              startDateTime: new Date(data.startDateTime),
              endDateTime: data.endDateTime ? new Date(data.endDateTime) : null,
              locationName: data.locationName || "", address: data.address || "",
              city: data.city || "", state: data.state || "", zip: data.zip || "",
              costText: data.costText || "", categoryIds: data.categoryIds || [],
            });
            entityId = evt.id;
            queueTranslation("event", evt.id);
          } else if (draft.draftType === "ARTICLE") {
            const article = await storage.createArticle({
              cityId: draft.cityId, title: data.title, slug: data.slug,
              excerpt: data.excerpt || "", content: data.content || "",
              publishedAt: new Date(),
            });
            entityId = article.id;
            queueTranslation("article", article.id);
          }

          await storage.updateImportDraft(draftId, { status: "PUBLISHED", publishedEntityId: entityId } as any);
          results.push({ id: draftId, ok: true, name: data.name || data.title, entityId });
          published++;
        } catch (err: any) {
          results.push({ id: draftId, ok: false, error: err.message });
          failed++;
        }
      }

      return JSON.stringify({ success: true, published, failed, total: ids.length, results, message: `Published ${published} draft(s). ${failed} failed.` });
    }

    case "find_duplicate_businesses": {
      const q = args.query?.trim();
      if (!q) return JSON.stringify({ error: "Please provide a search query" });

      const limit = Math.min(args.limit || 20, 50);
      const pattern = `%${q}%`;

      const matches = await db.select({
        id: businesses.id, name: businesses.name, address: businesses.address,
        phone: businesses.phone, city: businesses.city, state: businesses.state,
        zip: businesses.zip, listingTier: businesses.listingTier,
      }).from(businesses)
        .where(or(
          ilike(businesses.name, pattern),
          ilike(businesses.phone, pattern),
          ilike(businesses.address, pattern),
        )!)
        .orderBy(businesses.name)
        .limit(limit);

      const grouped: Record<string, any[]> = {};
      for (const m of matches) {
        const key = m.name?.toLowerCase().replace(/[^a-z0-9]/g, "") || m.id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
      }

      const potentialDupes = Object.values(grouped).filter(g => g.length > 1);

      return JSON.stringify({
        matches: matches.slice(0, 20),
        potentialDuplicateGroups: potentialDupes.length,
        duplicates: potentialDupes.map(g => ({ name: g[0].name, count: g.length, ids: g.map(x => x.id) })),
        totalMatches: matches.length,
        message: `Found ${matches.length} match(es) for "${q}". ${potentialDupes.length} potential duplicate group(s).`,
      });
    }

    case "rewrite_content": {
      if (!openai) return JSON.stringify({ error: "OpenAI not configured" });
      const style = args.style || "professional";
      const language = args.language || "both";

      let langInstruction = "Provide the rewrite in both English and Spanish.";
      if (language === "en") langInstruction = "Provide the rewrite in English only.";
      if (language === "es") langInstruction = "Provide the rewrite in Spanish only.";

      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: buildContentRewriteSystem(style, langInstruction) },
          { role: "user", content: args.content },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = resp.choices[0]?.message?.content || "{}";
      let result;
      try { result = JSON.parse(content); } catch { result = { en: content }; }

      return JSON.stringify({ success: true, original: args.content.substring(0, 100) + "...", rewritten: result, style, message: "Content rewritten. Review and apply as needed." });
    }

    case "get_trust_profile": {
      const bizId = args.businessId;
      if (!bizId) return JSON.stringify({ error: "businessId is required" });

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, bizId)).limit(1);
      if (!biz) return JSON.stringify({ error: "Business not found" });

      const [profile] = await db.select().from(trustProfiles).where(eq(trustProfiles.businessId, bizId)).limit(1);
      const badges = await db.select().from(profileBadges).where(and(eq(profileBadges.businessId, bizId), eq(profileBadges.enabled, true)));

      const snapshot = profile?.signalSnapshot as any;
      const isSuppressed = ["paused", "removed", "at_risk"].includes(profile?.operationalStatus || "");
      const isEligible = profile && profile.trustLevel !== "T0" && !isSuppressed;

      const trustData = {
        businessName: biz.name,
        trustLevel: profile?.trustLevel || "T0",
        operationalStatus: profile?.operationalStatus || "eligible",
        isVerified: snapshot?.isVerified ?? biz.isVerified,
        claimStatus: snapshot?.claimStatus ?? biz.claimStatus,
        reviewCount: snapshot?.reviewCount || 0,
        averageRating: snapshot?.averageRating || 0,
        badgeCount: snapshot?.badgeCount || 0,
        storyDepthScore: snapshot?.storyDepthScore || 0,
        recommendationEligible: isEligible,
        activeBadges: badges.map(b => b.badgeType),
        lastActivityAt: snapshot?.lastActivityAt || null,
        daysSinceLastActivity: snapshot?.daysSinceLastActivity || null,
      };

      return JSON.stringify({
        success: true,
        trustProfile: trustData,
        message: `Trust profile for "${biz.name}": Level=${trustData.trustLevel}, Status=${trustData.operationalStatus}, Reviews=${trustData.reviewCount} (avg ${trustData.averageRating}), Recommendation Eligible=${trustData.recommendationEligible}, Badges: ${trustData.activeBadges.join(", ") || "none"}`,
      });
    }

    case "story_from_url": {
      const storyUrl = args.url;
      if (!storyUrl) return JSON.stringify({ error: "URL is required" });

      const charlotteCityId = args.cityId || "b0d970f5-cfd6-475b-8739-cfd5352094c4";

      let pageText = "";
      try {
        const fetchResp = await fetch(storyUrl, {
          headers: { "User-Agent": "CityMetroHub/1.0 Content Importer" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await fetchResp.text();
        pageText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 12000);
      } catch {
        return JSON.stringify({ error: "Could not fetch the URL" });
      }

      if (!openai) return JSON.stringify({ error: "OpenAI not configured" });

      const storyResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: URL_ARTICLE_SYSTEM,
          },
          { role: "user", content: `Source URL: ${storyUrl}\n\nSource content:\n${pageText}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const storyContent = storyResp.choices[0]?.message?.content || "{}";
      let storyData: Record<string, unknown>;
      try { storyData = JSON.parse(storyContent); } catch { storyData = { title: "Could not generate", rawResponse: storyContent }; }

      const storyTitle = String(storyData.title || "untitled");

      const storyDraft = await storage.createImportDraft({
        cityId: charlotteCityId,
        draftType: "ARTICLE",
        source: "URL_EXTRACT",
        sourceUrl: storyUrl,
        extractedData: { ...storyData, slug: storyTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80), sourceUrl: storyUrl },
        rawData: { url: storyUrl, fetchedLength: pageText.length, generationType: "story_from_url" },
      });

      createInboxItemIfNotOpen({
        itemType: "listing_imported_needs_publish",
        relatedTable: "import_drafts",
        relatedId: storyDraft.id,
        title: `Story Draft: ${storyTitle}`,
        summary: `AI-generated story from ${storyUrl}. Review and publish.`,
        tags: ["Content", "Story"],
        links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
      }).catch(err => console.error("[Inbox] Charlotte story:", err.message));

      return JSON.stringify({
        success: true,
        draftId: storyDraft.id,
        title: storyTitle,
        excerpt: storyData.excerpt || "",
        wordCount: String(storyData.content || "").split(/\s+/).length,
        message: `Story draft "${storyTitle}" generated and saved. Check the Admin Inbox to review and publish.`,
      });
    }

    case "upgrade_listing_tier": {
      const validTiers = ["FREE", "VERIFIED", "ENHANCED", "CHARTER", "PREMIUM", "NONPROFIT", "ORGANIZATION", "HEALTHCARE_PROVIDER"];
      const tier = args.tier?.toUpperCase();
      if (!tier || !validTiers.includes(tier)) {
        return JSON.stringify({ error: `Invalid tier "${args.tier}". Valid tiers: ${validTiers.join(", ")}` });
      }

      const micrositeTierMap: Record<string, "none" | "enhanced" | "charter"> = { FREE: "none", VERIFIED: "none", ENHANCED: "enhanced", CHARTER: "charter", PREMIUM: "none", NONPROFIT: "none", ORGANIZATION: "none", HEALTHCARE_PROVIDER: "none" };

      if (args.fromTier) {
        const fromTier = args.fromTier.toUpperCase();
        if (!validTiers.includes(fromTier)) {
          return JSON.stringify({ error: `Invalid fromTier "${args.fromTier}". Valid tiers: ${validTiers.join(", ")}` });
        }
        const conditions = [eq(businesses.listingTier, fromTier as typeof businesses.listingTier.enumValues[number])];
        if (args.claimStatus) {
          const validClaimStatuses = ["UNCLAIMED", "CLAIMED", "PENDING", "VERIFIED"];
          const claimVal = args.claimStatus.toUpperCase();
          if (!validClaimStatuses.includes(claimVal)) {
            return JSON.stringify({ error: `Invalid claimStatus "${args.claimStatus}". Valid: ${validClaimStatuses.join(", ")}` });
          }
          conditions.push(eq(businesses.claimStatus, claimVal as typeof businesses.claimStatus.enumValues[number]));
        }
        const matching = await db.select({ id: businesses.id }).from(businesses).where(and(...conditions));
        if (matching.length === 0) {
          return JSON.stringify({ error: `No businesses found with tier=${fromTier}${args.claimStatus ? ` and claimStatus=${args.claimStatus.toUpperCase()}` : ""}` });
        }
        const micrositeTierValue = micrositeTierMap[tier];
        await db.update(businesses).set({
          listingTier: tier as typeof businesses.listingTier.enumValues[number],
          micrositeTier: micrositeTierValue,
        }).where(and(...conditions));
        return JSON.stringify({
          success: true,
          updatedCount: matching.length,
          fromTier,
          toTier: tier,
          claimStatusFilter: args.claimStatus?.toUpperCase() || "ALL",
          message: `Bulk updated ${matching.length} businesses from ${fromTier} to ${tier}${args.claimStatus ? ` (claimStatus=${args.claimStatus.toUpperCase()})` : ""}.`,
        });
      }

      let businessId = args.businessId;

      if (!businessId && args.businessName) {
        const matches = await db.select({ id: businesses.id, name: businesses.name })
          .from(businesses)
          .where(ilike(businesses.name, `%${args.businessName}%`))
          .limit(5);
        if (matches.length === 0) return JSON.stringify({ error: `No business found matching "${args.businessName}"` });
        if (matches.length > 1) return JSON.stringify({ error: `Multiple businesses found matching "${args.businessName}": ${matches.map(m => `${m.name} (${m.id})`).join(", ")}. Please specify the businessId.` });
        businessId = matches[0].id;
      }

      if (!businessId) return JSON.stringify({ error: "Please provide either businessId or businessName" });

      const listingTierValue = tier as typeof businesses.listingTier.enumValues[number];
      const micrositeTierValue = micrositeTierMap[tier];

      const updated = await storage.updateBusiness(businessId, {
        listingTier: listingTierValue,
        micrositeTier: micrositeTierValue,
      });

      if (!updated) return JSON.stringify({ error: `Business not found with ID "${businessId}"` });

      return JSON.stringify({
        success: true,
        businessId: updated.id,
        name: updated.name,
        listingTier: updated.listingTier,
        micrositeTier: updated.micrositeTier,
        message: `Successfully updated "${updated.name}" to ${tier} tier.`,
      });
    }

    case "create_background_task": {
      const taskType = args.type || "general";
      const title = args.title;
      if (!title) return JSON.stringify({ error: "Title is required" });

      const planSteps = (args.plan_steps || []).map((s: { description: string; engine?: string }) => ({
        description: s.description,
        engine: s.engine,
      }));

      const task = await createCharlotteTask({
        type: taskType,
        title,
        payload: args.payload || {},
        proposedPlan: { steps: planSteps },
        status: "awaiting_approval",
      });

      return JSON.stringify({
        success: true,
        taskId: task.id,
        title: task.title,
        status: "awaiting_approval",
        planSteps: planSteps.map((s: { description: string }) => s.description),
        message: `Task "${title}" created and awaiting your approval. You can approve it in the Tasks panel or tell me to go ahead. I'll continue working on it even if you close this chat.`,
      });
    }

    case "get_recent_tasks": {
      const statusFilter = args.status || "all";
      const limitNum = Math.min(args.limit || 10, 20);

      let rows;
      if (statusFilter === "all") {
        rows = await db.select().from(charlotteTasks).orderBy(desc(charlotteTasks.createdAt)).limit(limitNum);
      } else {
        rows = await db.select().from(charlotteTasks).where(eq(charlotteTasks.status, statusFilter as any)).orderBy(desc(charlotteTasks.createdAt)).limit(limitNum);
      }

      return JSON.stringify({
        tasks: rows.map(t => ({
          id: t.id,
          type: t.type,
          title: t.title,
          status: t.status,
          progress: t.progress,
          result: t.result ? (t.result as Record<string, unknown>).summary || "Completed" : null,
          error: t.error,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        })),
        total: rows.length,
      });
    }

    case "search_articles": {
      const limit = Math.min(args.limit || 20, 50);
      const conditions: any[] = [];

      if (args.keyword) {
        const pattern = `%${args.keyword}%`;
        conditions.push(or(
          ilike(rssItems.title, pattern),
          ilike(rssItems.summary, pattern),
          ilike(rssItems.sourceName, pattern),
          ilike(rssItems.rewrittenSummary, pattern)
        ));
      }
      if (args.sourceName) {
        conditions.push(ilike(rssItems.sourceName, `%${args.sourceName}%`));
      }
      if (args.publishStatus) {
        conditions.push(eq(rssItems.publishStatus, args.publishStatus));
      }
      if (args.reviewStatus) {
        conditions.push(eq(rssItems.reviewStatus, args.reviewStatus));
      }
      if (args.dateFrom) {
        conditions.push(gte(rssItems.publishedAt, new Date(args.dateFrom)));
      }
      if (args.dateTo) {
        conditions.push(lte(rssItems.publishedAt, new Date(args.dateTo)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.select({
        id: rssItems.id,
        title: rssItems.title,
        sourceName: rssItems.sourceName,
        imageUrl: rssItems.imageUrl,
        publishedAt: rssItems.publishedAt,
        publishStatus: rssItems.publishStatus,
        reviewStatus: rssItems.reviewStatus,
        zoneSlug: rssItems.zoneSlug,
        summary: rssItems.summary,
        lastEditedBy: rssItems.lastEditedBy,
        lastEditedAt: rssItems.lastEditedAt,
      }).from(rssItems).where(whereClause).orderBy(desc(rssItems.publishedAt)).limit(limit);

      return JSON.stringify({
        articles: results,
        count: results.length,
        message: `Found ${results.length} article(s).`,
      });
    }

    case "get_article_detail": {
      const article = await db.select().from(rssItems).where(eq(rssItems.id, args.articleId)).then(r => r[0]);
      if (!article) return JSON.stringify({ error: "Article not found" });

      return JSON.stringify({
        article: {
          id: article.id,
          title: article.title,
          originalTitle: article.originalTitle,
          summary: article.summary,
          originalSummary: article.originalSummary,
          rewrittenSummary: article.rewrittenSummary,
          imageUrl: article.imageUrl,
          originalImageUrl: article.originalImageUrl,
          sourceName: article.sourceName,
          url: article.url,
          author: article.author,
          publishedAt: article.publishedAt,
          publishStatus: article.publishStatus,
          reviewStatus: article.reviewStatus,
          zoneSlug: article.zoneSlug,
          localArticleBody: article.localArticleBody,
          localArticleSlug: article.localArticleSlug,
          contentType: article.contentType,
          categoryCoreSlug: article.categoryCoreSlug,
          categorySubSlug: article.categorySubSlug,
          editHistory: article.editHistory,
          lastEditedBy: article.lastEditedBy,
          lastEditedAt: article.lastEditedAt,
          suppressionReason: article.suppressionReason,
          suppressedBy: article.suppressedBy,
          suppressedAt: article.suppressedAt,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
        },
      });
    }

    case "update_article": {
      const article = await db.select().from(rssItems).where(eq(rssItems.id, args.articleId)).then(r => r[0]);
      if (!article) return JSON.stringify({ error: "Article not found" });

      const updates: any = { updatedAt: new Date(), lastEditedBy: "charlotte-ai", lastEditedAt: new Date() };
      const editedFields: string[] = [];

      if (args.title !== undefined) { updates.title = args.title; editedFields.push("title"); }
      if (args.summary !== undefined) { updates.summary = args.summary; editedFields.push("summary"); }
      if (args.rewrittenSummary !== undefined) { updates.rewrittenSummary = args.rewrittenSummary; editedFields.push("rewrittenSummary"); }
      if (args.imageUrl !== undefined) { updates.imageUrl = args.imageUrl; editedFields.push("imageUrl"); }
      if (args.localArticleBody !== undefined) { updates.localArticleBody = args.localArticleBody; editedFields.push("localArticleBody"); }
      if (args.zoneSlug !== undefined) { updates.zoneSlug = args.zoneSlug; editedFields.push("zoneSlug"); }
      if (args.reviewStatus !== undefined) { updates.reviewStatus = args.reviewStatus; editedFields.push("reviewStatus"); }
      if (args.publishStatus !== undefined) { updates.publishStatus = args.publishStatus; editedFields.push("publishStatus"); }

      if (editedFields.length === 0) return JSON.stringify({ error: "No fields to update" });

      const existingHistory = (article.editHistory as Array<{ fields: string[]; editorId: string; editedAt: string }>) || [];
      updates.editHistory = [...existingHistory, { fields: editedFields, editorId: "charlotte-ai", editedAt: new Date().toISOString() }];

      await db.update(rssItems).set(updates).where(eq(rssItems.id, args.articleId));
      return JSON.stringify({
        success: true,
        articleId: args.articleId,
        title: updates.title || article.title,
        updatedFields: editedFields,
        message: `Article "${updates.title || article.title}" updated. Fields changed: ${editedFields.join(", ")}.`,
      });
    }

    case "bulk_update_articles": {
      let targetIds: string[] = args.articleIds || [];

      if (targetIds.length === 0 && (args.filterKeyword || args.filterSourceName)) {
        const filterConditions: any[] = [];
        if (args.filterKeyword) {
          const pattern = `%${args.filterKeyword}%`;
          filterConditions.push(or(ilike(rssItems.title, pattern), ilike(rssItems.summary, pattern)));
        }
        if (args.filterSourceName) {
          filterConditions.push(ilike(rssItems.sourceName, `%${args.filterSourceName}%`));
        }
        const matched = await db.select({ id: rssItems.id, title: rssItems.title }).from(rssItems).where(and(...filterConditions)).limit(100);
        targetIds = matched.map(r => r.id);

        if (!args.confirmExecution) {
          return JSON.stringify({
            preview: true,
            articleCount: targetIds.length,
            sampleTitles: matched.slice(0, 5).map(r => r.title),
            articleIds: targetIds,
            message: `Found ${targetIds.length} article(s) matching your filter. Please confirm you want to proceed with the update by calling this tool again with confirmExecution: true and the articleIds list.`,
          });
        }
      }

      if (targetIds.length === 0) return JSON.stringify({ error: "No articles matched the criteria" });

      const updateFields: any = {};
      const editedFields: string[] = [];
      if (args.title !== undefined) { updateFields.title = args.title; editedFields.push("title"); }
      if (args.summary !== undefined) { updateFields.summary = args.summary; editedFields.push("summary"); }
      if (args.rewrittenSummary !== undefined) { updateFields.rewrittenSummary = args.rewrittenSummary; editedFields.push("rewrittenSummary"); }
      if (args.imageUrl !== undefined) { updateFields.imageUrl = args.imageUrl; editedFields.push("imageUrl"); }
      if (args.zoneSlug !== undefined) { updateFields.zoneSlug = args.zoneSlug; editedFields.push("zoneSlug"); }
      if (args.reviewStatus !== undefined) { updateFields.reviewStatus = args.reviewStatus; editedFields.push("reviewStatus"); }
      if (args.publishStatus !== undefined) { updateFields.publishStatus = args.publishStatus; editedFields.push("publishStatus"); }

      if (editedFields.length === 0) return JSON.stringify({ error: "No update fields provided" });

      if (targetIds.length > 5) {
        const task = await createCharlotteTask({
          type: "article_bulk_update",
          title: `Bulk update ${targetIds.length} articles (${editedFields.join(", ")})`,
          payload: { articleIds: targetIds, updateFields, editedFields },
          proposedPlan: {
            steps: targetIds.map(id => ({ description: `Update article ${id}: set ${editedFields.join(", ")}` })),
          },
          status: "awaiting_approval",
        });

        return JSON.stringify({
          success: true,
          queued: true,
          taskId: task.id,
          articleCount: targetIds.length,
          fields: editedFields,
          message: `${targetIds.length} articles will be updated. This has been queued as a background task (ID: ${task.id}) since it affects more than 5 articles. The task is awaiting your approval — approve it to proceed.`,
        });
      }

      let updated = 0;
      for (const id of targetIds) {
        const article = await db.select({ editHistory: rssItems.editHistory }).from(rssItems).where(eq(rssItems.id, id)).then(r => r[0]);
        if (!article) continue;

        const existingHistory = (article.editHistory as Array<{ fields: string[]; editorId: string; editedAt: string }>) || [];
        await db.update(rssItems).set({
          ...updateFields,
          updatedAt: new Date(),
          lastEditedBy: "charlotte-ai",
          lastEditedAt: new Date(),
          editHistory: [...existingHistory, { fields: editedFields, editorId: "charlotte-ai", editedAt: new Date().toISOString() }],
        }).where(eq(rssItems.id, id));
        updated++;
      }

      return JSON.stringify({
        success: true,
        queued: false,
        updated,
        total: targetIds.length,
        fields: editedFields,
        message: `${updated} of ${targetIds.length} article(s) updated. Fields changed: ${editedFields.join(", ")}.`,
      });
    }

    case "suppress_article": {
      const article = await db.select().from(rssItems).where(eq(rssItems.id, args.articleId)).then(r => r[0]);
      if (!article) return JSON.stringify({ error: "Article not found" });

      const existingHistory = (article.editHistory as Array<{ fields: string[]; editorId: string; editedAt: string }>) || [];
      await db.update(rssItems).set({
        publishStatus: "suppressed",
        suppressionReason: args.reason,
        suppressedBy: "charlotte-ai",
        suppressedAt: new Date(),
        lastEditedBy: "charlotte-ai",
        lastEditedAt: new Date(),
        updatedAt: new Date(),
        editHistory: [...existingHistory, { fields: ["publishStatus", "suppressionReason"], editorId: "charlotte-ai", editedAt: new Date().toISOString() }],
      }).where(eq(rssItems.id, args.articleId));

      return JSON.stringify({
        success: true,
        articleId: args.articleId,
        title: article.title,
        message: `Article "${article.title}" has been suppressed. Reason: ${args.reason}`,
      });
    }

    case "get_public_insights": {
      const insightType = args.insightType || "all";
      const timeWindow = args.timeWindow || "7d";
      const limit = Math.min(args.limit || 10, 25);

      const conditions = [eq(charlottePublicInsights.timeWindow, timeWindow)];
      if (insightType !== "all") {
        conditions.push(eq(charlottePublicInsights.insightType, insightType));
      }
      if (args.cityId) {
        conditions.push(eq(charlottePublicInsights.cityId, args.cityId));
      }

      const insights = await db
        .select()
        .from(charlottePublicInsights)
        .where(and(...conditions))
        .orderBy(charlottePublicInsights.insightType, charlottePublicInsights.rank)
        .limit(insightType === "all" ? limit * 5 : limit);

      const grouped: Record<string, unknown[]> = {};
      for (const ins of insights) {
        if (!grouped[ins.insightType]) grouped[ins.insightType] = [];
        if (grouped[ins.insightType].length < limit) {
          grouped[ins.insightType].push(ins.content);
        }
      }

      return JSON.stringify({
        timeWindow,
        insightType: insightType === "all" ? "summary" : insightType,
        data: grouped,
        totalRecords: insights.length,
      });
    }

    case "record_context_note": {
      const note = args.note;
      if (!note) return JSON.stringify({ error: "Note is required" });
      await recordContextNote(note);
      return JSON.stringify({ success: true, message: "Context noted" });
    }

    case "search_events": {
      const limit = Math.min(args.limit || 20, 50);
      const conditions: any[] = [];

      if (args.keyword) {
        const pattern = `%${args.keyword}%`;
        conditions.push(or(
          ilike(events.title, pattern),
          ilike(events.description, pattern),
          ilike(events.locationName, pattern),
          ilike(events.venueName, pattern),
          ilike(events.address, pattern)
        ));
      }
      if (args.venueName) {
        const venuePattern = `%${args.venueName}%`;
        conditions.push(or(
          ilike(events.venueName, venuePattern),
          ilike(events.locationName, venuePattern)
        ));
      }
      if (args.dateFrom) {
        conditions.push(gte(events.startDateTime, new Date(args.dateFrom)));
      }
      if (args.dateTo) {
        conditions.push(lte(events.startDateTime, new Date(args.dateTo)));
      }
      if (args.zoneName) {
        const matchingZones = await db.select({ id: zones.id }).from(zones).where(ilike(zones.name, `%${args.zoneName}%`));
        if (matchingZones.length > 0) {
          conditions.push(inArray(events.zoneId, matchingZones.map(z => z.id)));
        } else {
          conditions.push(sql`false`);
        }
      }
      if (args.cityId) {
        conditions.push(eq(events.cityId, args.cityId));
      }
      if (args.category) {
        conditions.push(or(
          sql`${events.categoryIds}::text[] && ARRAY[${args.category}]::text[]`,
          ilike(events.title, `%${args.category}%`)
        ));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.select({
        id: events.id,
        title: events.title,
        startDateTime: events.startDateTime,
        endDateTime: events.endDateTime,
        locationName: events.locationName,
        venueName: events.venueName,
        address: events.address,
        costText: events.costText,
        description: events.description,
        imageUrl: events.imageUrl,
        isFeatured: events.isFeatured,
        isSponsored: events.isSponsored,
        visibility: events.visibility,
      }).from(events).where(whereClause).orderBy(desc(events.startDateTime)).limit(limit);

      return JSON.stringify({
        events: results.map(e => ({
          ...e,
          description: e.description ? e.description.substring(0, 200) + (e.description.length > 200 ? "..." : "") : null,
        })),
        count: results.length,
        message: `Found ${results.length} event(s).`,
      });
    }

    case "search_jobs": {
      const limit = Math.min(args.limit || 20, 50);
      const conditions: any[] = [];

      if (args.keyword) {
        const pattern = `%${args.keyword}%`;
        conditions.push(or(
          ilike(jobs.title, pattern),
          ilike(jobs.employer, pattern),
          ilike(jobs.description, pattern),
          ilike(jobs.department, pattern)
        ));
      }
      if (args.employer) {
        conditions.push(ilike(jobs.employer, `%${args.employer}%`));
      }
      if (args.employmentType) {
        conditions.push(ilike(jobs.employmentType, `%${args.employmentType}%`));
      }
      if (args.status) {
        conditions.push(eq(jobs.jobStatus, args.status));
      }
      if (args.minPay) {
        conditions.push(gte(jobs.payMin, String(args.minPay)));
      }
      if (args.maxPay) {
        conditions.push(lte(jobs.payMax, String(args.maxPay)));
      }
      if (args.cityId) {
        conditions.push(eq(jobs.cityId, args.cityId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.select({
        id: jobs.id,
        title: jobs.title,
        employer: jobs.employer,
        department: jobs.department,
        employmentType: jobs.employmentType,
        payMin: jobs.payMin,
        payMax: jobs.payMax,
        payUnit: jobs.payUnit,
        locationText: jobs.locationText,
        remoteType: jobs.remoteType,
        jobStatus: jobs.jobStatus,
        postedAt: jobs.postedAt,
        closesAt: jobs.closesAt,
        applyUrl: jobs.applyUrl,
      }).from(jobs).where(whereClause).orderBy(desc(jobs.postedAt)).limit(limit);

      return JSON.stringify({
        jobs: results,
        count: results.length,
        message: `Found ${results.length} job listing(s).`,
      });
    }

    case "search_marketplace": {
      const limit = Math.min(args.limit || 20, 50);
      const conditions: any[] = [];

      if (args.keyword) {
        const pattern = `%${args.keyword}%`;
        conditions.push(or(
          ilike(marketplaceListings.title, pattern),
          ilike(marketplaceListings.description, pattern),
          ilike(marketplaceListings.category, pattern),
          ilike(marketplaceListings.shortDescription, pattern)
        ));
      }
      if (args.category) {
        conditions.push(ilike(marketplaceListings.category, `%${args.category}%`));
      }
      if (args.type) {
        conditions.push(eq(marketplaceListings.type, args.type));
      }
      if (args.status) {
        conditions.push(eq(marketplaceListings.status, args.status));
      }
      if (args.minPrice) {
        conditions.push(gte(marketplaceListings.price, args.minPrice));
      }
      if (args.maxPrice) {
        conditions.push(lte(marketplaceListings.price, args.maxPrice));
      }
      if (args.cityId) {
        conditions.push(eq(marketplaceListings.cityId, args.cityId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        type: marketplaceListings.type,
        status: marketplaceListings.status,
        category: marketplaceListings.category,
        price: marketplaceListings.price,
        pricingType: marketplaceListings.pricingType,
        neighborhood: marketplaceListings.neighborhood,
        contactName: marketplaceListings.contactName,
        imageUrl: marketplaceListings.imageUrl,
        viewCount: marketplaceListings.viewCount,
        inquiryCount: marketplaceListings.inquiryCount,
        publishedAt: marketplaceListings.publishedAt,
        shortDescription: marketplaceListings.shortDescription,
      }).from(marketplaceListings).where(whereClause).orderBy(desc(marketplaceListings.publishedAt)).limit(limit);

      return JSON.stringify({
        listings: results,
        count: results.length,
        message: `Found ${results.length} marketplace listing(s).`,
      });
    }

    case "search_deals": {
      const limit = Math.min(args.limit || 20, 50);
      const searchType = args.searchType || "both";
      const results: { items: any[]; drops: any[] } = { items: [], drops: [] };

      if (searchType === "items" || searchType === "both") {
        const itemConditions: any[] = [];
        if (args.keyword) {
          const pattern = `%${args.keyword}%`;
          itemConditions.push(or(
            ilike(shopItems.title, pattern),
            ilike(shopItems.description, pattern)
          ));
        }
        if (args.itemStatus) {
          itemConditions.push(eq(shopItems.status, args.itemStatus));
        }
        if (args.itemType) {
          itemConditions.push(eq(shopItems.type, args.itemType));
        }
        if (args.businessName) {
          const matchingBiz = await db.select({ id: businesses.id }).from(businesses).where(ilike(businesses.name, `%${args.businessName}%`)).limit(20);
          if (matchingBiz.length > 0) {
            itemConditions.push(inArray(shopItems.businessId, matchingBiz.map(b => b.id)));
          } else {
            itemConditions.push(sql`false`);
          }
        }
        if (args.cityId) {
          itemConditions.push(eq(shopItems.cityId, args.cityId));
        }

        const itemWhere = itemConditions.length > 0 ? and(...itemConditions) : undefined;
        const itemResults = await db.select({
          id: shopItems.id,
          title: shopItems.title,
          description: shopItems.description,
          price: shopItems.price,
          compareAtPrice: shopItems.compareAtPrice,
          category: shopItems.category,
          status: shopItems.status,
          type: shopItems.type,
          imageUrl: shopItems.imageUrl,
          businessId: shopItems.businessId,
        }).from(shopItems).where(itemWhere).orderBy(desc(shopItems.createdAt)).limit(limit);

        if (itemResults.length > 0) {
          const bizIds = [...new Set(itemResults.map(i => i.businessId))];
          const bizNames = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, bizIds));
          const bizMap = new Map(bizNames.map(b => [b.id, b.name]));
          results.items = itemResults.map(i => ({ ...i, businessName: bizMap.get(i.businessId) || "Unknown" }));
        }
      }

      if (searchType === "drops" || searchType === "both") {
        const dropConditions: any[] = [];
        if (args.keyword) {
          const pattern = `%${args.keyword}%`;
          dropConditions.push(or(
            ilike(shopDrops.title, pattern),
            ilike(shopDrops.description, pattern)
          ));
        }
        if (args.dropStatus) {
          dropConditions.push(eq(shopDrops.status, args.dropStatus));
        }
        if (args.businessName) {
          const matchingBiz = await db.select({ id: businesses.id }).from(businesses).where(ilike(businesses.name, `%${args.businessName}%`)).limit(20);
          if (matchingBiz.length > 0) {
            dropConditions.push(inArray(shopDrops.businessId, matchingBiz.map(b => b.id)));
          } else {
            dropConditions.push(sql`false`);
          }
        }
        if (args.cityId) {
          dropConditions.push(eq(shopDrops.cityId, args.cityId));
        }

        const dropWhere = dropConditions.length > 0 ? and(...dropConditions) : undefined;
        const dropResults = await db.select({
          id: shopDrops.id,
          title: shopDrops.title,
          description: shopDrops.description,
          discountPercent: shopDrops.discountPercent,
          discountAmount: shopDrops.discountAmount,
          originalPrice: shopDrops.originalPrice,
          dealPrice: shopDrops.dealPrice,
          dealType: shopDrops.dealType,
          startAt: shopDrops.startAt,
          endAt: shopDrops.endAt,
          status: shopDrops.status,
          claimCount: shopDrops.claimCount,
          maxClaims: shopDrops.maxClaims,
          businessId: shopDrops.businessId,
        }).from(shopDrops).where(dropWhere).orderBy(desc(shopDrops.createdAt)).limit(limit);

        if (dropResults.length > 0) {
          const bizIds = [...new Set(dropResults.map(d => d.businessId))];
          const bizNames = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, bizIds));
          const bizMap = new Map(bizNames.map(b => [b.id, b.name]));
          results.drops = dropResults.map(d => ({ ...d, businessName: bizMap.get(d.businessId) || "Unknown" }));
        }
      }

      const totalCount = results.items.length + results.drops.length;
      return JSON.stringify({
        shopItems: results.items,
        shopDrops: results.drops,
        count: totalCount,
        message: `Found ${results.items.length} shop item(s) and ${results.drops.length} deal/drop(s).`,
      });
    }

    case "search_engagement": {
      const limit = Math.min(args.limit || 20, 50);
      const engagementType = args.type || "both";
      const engagementResults: { giveaways: any[]; polls: any[] } = { giveaways: [], polls: [] };

      if (engagementType === "giveaway" || engagementType === "both") {
        const gConditions: any[] = [];
        if (args.keyword) {
          const pattern = `%${args.keyword}%`;
          gConditions.push(or(
            ilike(giveaways.title, pattern),
            ilike(giveaways.description, pattern)
          ));
        }
        if (args.status) {
          gConditions.push(eq(giveaways.status, args.status));
        }
        if (args.cityId) {
          gConditions.push(eq(giveaways.cityId, args.cityId));
        }
        const gWhere = gConditions.length > 0 ? and(...gConditions) : undefined;
        const gResults = await db.select({
          id: giveaways.id,
          title: giveaways.title,
          description: giveaways.description,
          status: giveaways.status,
          drawMethod: giveaways.drawMethod,
          maxEntries: giveaways.maxEntries,
          startsAt: giveaways.startsAt,
          endsAt: giveaways.endsAt,
          isPublic: giveaways.isPublic,
          isFeatured: giveaways.isFeatured,
        }).from(giveaways).where(gWhere).orderBy(desc(giveaways.createdAt)).limit(limit);

        if (gResults.length > 0) {
          const gIds = gResults.map(g => g.id);
          const entryCounts = await db.select({ giveawayId: giveawayEntries.giveawayId, entryCount: count() }).from(giveawayEntries).where(inArray(giveawayEntries.giveawayId, gIds)).groupBy(giveawayEntries.giveawayId);
          const entryMap = new Map(entryCounts.map(e => [e.giveawayId, Number(e.entryCount)]));
          engagementResults.giveaways = gResults.map(g => ({
            ...g,
            type: "giveaway",
            entryCount: entryMap.get(g.id) || 0,
            description: g.description ? g.description.substring(0, 200) + (g.description.length > 200 ? "..." : "") : null,
          }));
        }
      }

      if (engagementType === "poll" || engagementType === "both") {
        const pConditions: any[] = [];
        if (args.keyword) {
          const pattern = `%${args.keyword}%`;
          pConditions.push(ilike(polls.question, pattern));
        }
        if (args.status && (args.status === "active" || args.status === "inactive")) {
          pConditions.push(eq(polls.isActive, args.status === "active"));
        }
        if (args.cityId) {
          pConditions.push(eq(polls.cityId, args.cityId));
        }
        const pWhere = pConditions.length > 0 ? and(...pConditions) : undefined;
        const pResults = await db.select({
          id: polls.id,
          question: polls.question,
          choiceMode: polls.choiceMode,
          isPinned: polls.isPinned,
          isActive: polls.isActive,
          expiresAt: polls.expiresAt,
          createdAt: polls.createdAt,
        }).from(polls).where(pWhere).orderBy(desc(polls.createdAt)).limit(limit);

        if (pResults.length > 0) {
          const pIds = pResults.map(p => p.id);
          const voteCounts = await db.select({ pollId: pollVotes.pollId, voteCount: count() }).from(pollVotes).where(inArray(pollVotes.pollId, pIds)).groupBy(pollVotes.pollId);
          const voteMap = new Map(voteCounts.map(v => [v.pollId, Number(v.voteCount)]));
          engagementResults.polls = pResults.map(p => ({
            ...p,
            type: "poll",
            status: p.isActive ? "active" : "inactive",
            voteCount: voteMap.get(p.id) || 0,
          }));
        }
      }

      const totalCount = engagementResults.giveaways.length + engagementResults.polls.length;
      return JSON.stringify({
        giveaways: engagementResults.giveaways,
        polls: engagementResults.polls,
        count: totalCount,
        message: `Found ${engagementResults.giveaways.length} giveaway(s) and ${engagementResults.polls.length} poll(s).`,
      });
    }

    case "search_hub_tv": {
      const limit = Math.min(args.limit || 20, 50);
      const conditions: any[] = [];

      if (args.keyword) {
        const pattern = `%${args.keyword}%`;
        conditions.push(or(
          ilike(videoContent.title, pattern),
          ilike(videoContent.description, pattern)
        ));
      }
      if (args.businessName) {
        const matchingBiz = await db.select({ id: businesses.id }).from(businesses).where(ilike(businesses.name, `%${args.businessName}%`)).limit(20);
        if (matchingBiz.length > 0) {
          conditions.push(inArray(videoContent.businessId, matchingBiz.map(b => b.id)));
        } else {
          conditions.push(sql`false`);
        }
      }
      if (args.screenEligible !== undefined) {
        conditions.push(eq(videoContent.screenEligible, args.screenEligible));
      }
      if (args.podcastEligible !== undefined) {
        conditions.push(eq(videoContent.podcastEligible, args.podcastEligible));
      }
      if (args.cityId) {
        conditions.push(eq(videoContent.cityId, args.cityId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.select({
        id: videoContent.id,
        title: videoContent.title,
        description: videoContent.description,
        youtubeUrl: videoContent.youtubeUrl,
        thumbnailUrl: videoContent.thumbnailUrl,
        screenEligible: videoContent.screenEligible,
        podcastEligible: videoContent.podcastEligible,
        pulseEligible: videoContent.pulseEligible,
        durationSec: videoContent.durationSec,
        businessId: videoContent.businessId,
        createdAt: videoContent.createdAt,
      }).from(videoContent).where(whereClause).orderBy(desc(videoContent.createdAt)).limit(limit);

      let resultsWithBiz = results;
      if (results.length > 0) {
        const bizIds = [...new Set(results.filter(r => r.businessId).map(r => r.businessId!))];
        if (bizIds.length > 0) {
          const bizNames = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, bizIds));
          const bizMap = new Map(bizNames.map(b => [b.id, b.name]));
          resultsWithBiz = results.map(r => ({ ...r, businessName: r.businessId ? bizMap.get(r.businessId) || "Unknown" : null }));
        }
      }

      return JSON.stringify({
        videos: resultsWithBiz.map(v => ({
          ...v,
          description: v.description ? v.description.substring(0, 200) + (v.description.length > 200 ? "..." : "") : null,
        })),
        count: resultsWithBiz.length,
        message: `Found ${resultsWithBiz.length} video(s).`,
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
  } catch (err: any) {
    console.error(`[Charlotte Tool] Error in ${name}:`, err.message);
    return JSON.stringify({ error: `Tool "${name}" failed: ${err.message}` });
  }
}

export function registerCharlotteChatRoutes(app: Express) {
  app.get("/api/admin/charlotte-chat/threads", requireAdmin, async (req: Request, res: Response) => {
    try {
      const threads = await storage.getCharlotteChatThreads((req as any).session.userId);
      res.json(threads);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/charlotte-chat/threads", requireAdmin, async (req: Request, res: Response) => {
    try {
      const thread = await storage.createCharlotteChatThread({
        userId: (req as any).session.userId,
        title: req.body.title || "New Chat",
      });
      res.status(201).json(thread);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/charlotte-chat/threads/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteCharlotteChatThread(req.params.id as string);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/charlotte-chat/upload", requireAdmin, charlotteUpload.array("files", 5), async (req: Request & { files?: Express.Multer.File[] }, res: Response) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });

      const attachments: CharlotteAttachment[] = files.map((f) => ({
        url: `/uploads/charlotte-chat/${f.filename}`,
        filename: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
      }));

      res.json({ attachments });
    } catch (e: any) {
      console.error("[Charlotte Upload] Error:", e.message);
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/charlotte-chat/threads/:id/messages", requireAdmin, async (req: Request, res: Response) => {
    try {
      const messages = await storage.getCharlotteChatMessages(req.params.id as string);
      res.json(messages);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/charlotte-chat/threads/:id/messages", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        content: z.string().min(1),
        attachments: z.array(z.object({
          url: z.string(),
          filename: z.string(),
          mimeType: z.string(),
          size: z.number(),
        })).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Message content is required" });

      const threadId = req.params.id as string;
      const thread = await storage.getCharlotteChatThread(threadId);
      if (!thread) return res.status(404).json({ message: "Thread not found" });

      const userAttachments = (parsed.data.attachments || []).filter((att) => {
        return att.url.startsWith("/uploads/charlotte-chat/") && !att.url.includes("..");
      });

      await storage.createCharlotteChatMessage({
        threadId,
        role: "user",
        content: parsed.data.content,
        attachments: userAttachments.length > 0 ? userAttachments : null,
      });

      const history = await storage.getCharlotteChatMessages(threadId);
      if (!openai) return res.status(503).json({ message: "OpenAI not configured" });

      const sessionMetroId = (req as Record<string, Record<string, string>>).session?.cityId || process.env.DEFAULT_METRO_ID || "b0d970f5-cfd6-475b-8739-cfd5352094c4";

      let orchestratorResult: OrchestratorResult | null = null;
      try {
        orchestratorResult = await orchestrate({
          input: parsed.data.content,
          metroId: sessionMetroId,
          userId: (req as any).session.userId,
          source: "admin_chat",
        });
        console.log("[Charlotte] Orchestrator:", getOrchestratorSummary(orchestratorResult));
      } catch (orchErr: unknown) {
        const msg = orchErr instanceof Error ? orchErr.message : "Unknown";
        console.error("[Charlotte] Orchestrator error (non-blocking):", msg);
      }

      const zipReference = await buildZipReference();

      let systemContent = buildAdminChatSystem(zipReference);

      try {
        const recentMemory = await getRecentAdminMemory(20, 7);
        const memoryContext = buildMemoryContext(recentMemory);
        if (memoryContext) {
          systemContent += memoryContext;
        }
      } catch (memErr: unknown) {
        console.error("[Charlotte] Memory fetch (non-blocking):", memErr instanceof Error ? memErr.message : "Unknown");
      }

      if (orchestratorResult) {
        const { command } = orchestratorResult;
        const contextLines: string[] = [
          `\n\nORCHESTRATOR CONTEXT (use this to inform your response):`,
          `Operating Mode: ${command.mode}`,
          `Classified Intent: ${command.intent}`,
          `Confidence: ${(command.confidence * 100).toFixed(0)}%`,
          `Target Engines: ${command.targetEngines.join(", ")}`,
        ];
        if (command.entities.length > 0) {
          for (const entity of command.entities) {
            const idInfo = entity.entityId ? ` [ID: ${entity.entityId}]` : "";
            contextLines.push(`Entity: ${entity.name} (${entity.entityType}, confidence: ${entity.confidence})${idInfo}`);
          }
        }
        if (command.geoContext) {
          const geo = [command.geoContext.neighborhood, command.geoContext.zip, command.geoContext.zone].filter(Boolean).join(", ");
          if (geo) contextLines.push(`Location Context: ${geo}`);
        }
        let lifecycleStageForDoctrine: string | undefined;
        if (command.mode === "search" || command.mode === "concierge" || command.mode === "proposal") {
          try {
            const executionResult = await executeWithEngagementCheck(orchestratorResult, sessionMetroId);
            if (executionResult.lifecycleContext?.stage) {
              lifecycleStageForDoctrine = executionResult.lifecycleContext.stage;
            }
            contextLines.push(`Constraints: geo=${executionResult.constraints.enforceGeo}, trust=${executionResult.constraints.enforceTrust}, sort=${executionResult.constraints.sortPolicy}`);
            if (executionResult.lifecycleContext) {
              contextLines.push(`Sales Stage: ${executionResult.lifecycleContext.stage} — Next: ${executionResult.lifecycleContext.suggestedNextActions.join(", ")}`);
            }
            if (executionResult.engagementSuggestion) {
              contextLines.push(`\nENGAGEMENT CONTEXT (surface naturally, do not interrupt primary flow):`);
              contextLines.push(executionResult.engagementSuggestion);
            }
            if (executionResult.searchResults) {
              contextLines.push(`SEARCH RESULTS (${executionResult.searchResults.domain} domain): ${executionResult.searchResults.summary}`);
              if (Array.isArray(executionResult.searchResults.results) && executionResult.searchResults.results.length > 0) {
                const topResults = executionResult.searchResults.results.slice(0, 5) as Array<Record<string, unknown>>;
                for (const r of topResults) {
                  contextLines.push(`  - ${r.name} (trust: ${r.trustLevel || "N/A"}, score: ${r.relevanceScore})`);
                }
              }
              if (executionResult.searchResults.composed) {
                const c = executionResult.searchResults.composed;
                contextLines.push(`\nCOMPOSED RESPONSE (use this as a guide for your reply):`);
                contextLines.push(c.message);
                if (c.recommendations.length > 0) {
                  contextLines.push(`Top picks:`);
                  for (const rec of c.recommendations) {
                    contextLines.push(`  • ${rec.name} — ${rec.highlight}`);
                  }
                }
                if (c.followUps.length > 0) {
                  contextLines.push(`Suggested follow-ups: ${c.followUps.join(" | ")}`);
                }
                if (c.actions.length > 0) {
                  contextLines.push(`Available actions:`);
                  for (const act of c.actions) {
                    contextLines.push(`  • ${act.entityName}: ${act.routes.map(r => `${r.label} (${r.route})`).join(", ")}`);
                  }
                }
              }
            }
            if (executionResult.conciergeResults) {
              contextLines.push(`CONCIERGE: ${executionResult.conciergeResults.summary}`);
              if (executionResult.conciergeResults.response) {
                const resp = executionResult.conciergeResults.response as Record<string, unknown>;
                if (Array.isArray(resp.results) && resp.results.length > 0) {
                  const topResults = resp.results.slice(0, 5) as Array<Record<string, unknown>>;
                  for (const r of topResults) {
                    contextLines.push(`  - ${r.name} (trust: ${r.trustLevel || "N/A"}, score: ${r.relevanceScore})`);
                  }
                }
                if (Array.isArray(resp.followOnSuggestions)) {
                  contextLines.push(`Suggestions: ${resp.followOnSuggestions.join(", ")}`);
                }
              }
              if (executionResult.conciergeResults.composed) {
                const c = executionResult.conciergeResults.composed;
                contextLines.push(`\nCOMPOSED RESPONSE (use this as a guide for your reply):`);
                contextLines.push(c.message);
                if (c.recommendations.length > 0) {
                  contextLines.push(`Top picks:`);
                  for (const rec of c.recommendations) {
                    contextLines.push(`  • ${rec.name} — ${rec.highlight}`);
                  }
                }
                if (c.followUps.length > 0) {
                  contextLines.push(`Suggested follow-ups: ${c.followUps.join(" | ")}`);
                }
                if (c.actions.length > 0) {
                  contextLines.push(`Available actions:`);
                  for (const act of c.actions) {
                    contextLines.push(`  • ${act.entityName}: ${act.routes.map(r => `${r.label} (${r.route})`).join(", ")}`);
                  }
                }
              }
            }
            if (executionResult.proposalResults) {
              contextLines.push(`PROPOSAL: ${executionResult.proposalResults.summary}`);
            }
          } catch (execErr: unknown) {
            const msg = execErr instanceof Error ? execErr.message : "Unknown";
            console.error("[Charlotte] Execution mode error (non-blocking):", msg);
          }
        }

        if (command.requiresProposal && command.mode !== "proposal") {
          contextLines.push(`NOTE: This request may benefit from a structured plan before execution. Consider outlining steps before acting.`);

          try {
            const proposalSession = req.session as Record<string, unknown>;
            const proposalResult = await handleProposalMode(orchestratorResult, {
              metroId: sessionMetroId,
              userId: proposalSession.userId as string | undefined,
            });
            if (proposalResult.proposal) {
              contextLines.push(`PROPOSAL GENERATED: ${proposalResult.summary}`);
              contextLines.push(`Proposal ID: ${proposalResult.proposal.id}`);
              contextLines.push(`Items: ${proposalResult.proposal.items.map((i) => `${i.templateKey} for ${i.entityName}`).join(", ")}`);
            }
          } catch (propErr: unknown) {
            const propMsg = propErr instanceof Error ? propErr.message : "Unknown";
            console.error("[Charlotte] Proposal generation error (non-blocking):", propMsg);
          }
        }

        const charlotteMode = detectCharlotteMode(parsed.data.content, command.mode);
        let onboardingStage: OnboardingStage | undefined;
        const validOnboardingStages: OnboardingStage[] = ["verify", "story", "align", "recommend", "close", "downsell"];
        if (charlotteMode === "growth" && lifecycleStageForDoctrine && validOnboardingStages.includes(lifecycleStageForDoctrine as OnboardingStage)) {
          onboardingStage = lifecycleStageForDoctrine as OnboardingStage;
        }
        contextLines.push(buildDoctrineContext(charlotteMode, onboardingStage));

        const objection = detectObjection(parsed.data.content);
        if (objection) {
          contextLines.push(buildObjectionContext(objection));
        }

        const fitIssue = detectFitIssue(parsed.data.content);
        if (fitIssue) {
          contextLines.push(buildFitFilterContext(fitIssue));
        }

        systemContent += contextLines.join("\n");
      }

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemContent },
      ];

      for (const m of history) {
        const msgAttachments = (m.attachments || []) as CharlotteAttachment[];
        if (m.role === "user" && msgAttachments.length > 0) {
          const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
            { type: "text", text: m.content },
          ];

          for (const att of msgAttachments) {
            const sanitizedUrl = att.url.startsWith("/") ? att.url.slice(1) : att.url;
            const resolvedPath = path.resolve(process.cwd(), sanitizedUrl);
            const allowedDir = path.resolve(charlotteUploadDir);
            if (!resolvedPath.startsWith(allowedDir)) {
              contentParts.push({ type: "text", text: `[Attachment: ${att.filename} — invalid path]` });
              continue;
            }

            if (att.mimeType.startsWith("image/")) {
              try {
                const fileData = fs.readFileSync(resolvedPath);
                const base64 = fileData.toString("base64");
                contentParts.push({
                  type: "image_url",
                  image_url: { url: `data:${att.mimeType};base64,${base64}`, detail: "high" },
                });
              } catch {
                contentParts.push({ type: "text", text: `[Image attachment: ${att.filename} — file could not be read]` });
              }
            } else if (att.mimeType === "text/csv" || att.mimeType === "text/tab-separated-values" || att.mimeType === "text/plain" || att.filename.endsWith(".csv") || att.filename.endsWith(".tsv") || att.filename.endsWith(".txt")) {
              try {
                const textContent = fs.readFileSync(resolvedPath, "utf-8").substring(0, 30000);
                contentParts.push({ type: "text", text: `[File: ${att.filename}]\n${textContent}` });
              } catch {
                contentParts.push({ type: "text", text: `[File attachment: ${att.filename} — could not be read]` });
              }
            } else if (att.mimeType === "application/pdf" || att.filename.endsWith(".pdf")) {
              try {
                const pdfBuffer = fs.readFileSync(resolvedPath);
                const pdfData = await pdfParse(pdfBuffer);
                const pdfText = pdfData.text.substring(0, 30000);
                contentParts.push({ type: "text", text: `[PDF: ${att.filename}, ${pdfData.numpages} pages]\n${pdfText}` });
              } catch {
                contentParts.push({ type: "text", text: `[PDF attachment: ${att.filename} — could not extract text (${(att.size / 1024).toFixed(1)} KB)]` });
              }
            }
          }

          messages.push({ role: "user", content: contentParts });
        } else {
          messages.push({ role: m.role as "user" | "assistant", content: m.content });
        }
      }

      let response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: charlotteTools,
        tool_choice: "auto",
        temperature: 0.7,
      });

      let assistantMessage = response.choices[0]?.message;
      let toolResults: any[] = [];

      while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolCallMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        for (const tc of assistantMessage.tool_calls) {
          const fn = (tc as any).function;
          const args = JSON.parse(fn.arguments || "{}");
          const result = await executeCharlotteTool(fn.name, args, (req as any).session.userId);
          toolResults.push({ name: fn.name, args, result: JSON.parse(result) });

          toolCallMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }

        messages.push(assistantMessage as any);
        messages.push(...toolCallMessages);

        response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          tools: charlotteTools,
          tool_choice: "auto",
          temperature: 0.7,
        });

        assistantMessage = response.choices[0]?.message;
      }

      const responseContent = assistantMessage?.content || "I apologize, I was unable to generate a response.";

      const savedMsg = await storage.createCharlotteChatMessage({
        threadId,
        role: "assistant",
        content: responseContent,
        toolCalls: assistantMessage?.tool_calls || null,
        toolResults: toolResults.length > 0 ? toolResults : null,
      });

      if (history.length <= 1) {
        const titleSnippet = parsed.data.content.substring(0, 50);
        await storage.updateCharlotteChatThread(thread.id, { title: titleSnippet });
      }

      res.json(savedMsg);
    } catch (e: any) {
      console.error("[Charlotte Chat] Error:", e.message);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/charlotte-chat/send-to-inbox", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        title: z.string(),
        content: z.string(),
        messageId: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error" });

      const item = await createInboxItemIfNotOpen({
        itemType: "listing_imported_needs_publish",
        relatedTable: "charlotte_chat_messages",
        relatedId: parsed.data.messageId || "manual",
        title: parsed.data.title,
        summary: parsed.data.content.substring(0, 500),
        priority: "low",
      });

      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
