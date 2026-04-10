import type { Express, Request, Response, NextFunction } from "express";
import type OpenAI from "openai";
import { openai } from "./lib/openai";
import { db } from "./db";
import { charlottePublicConfig, charlottePublicMessages, charlotteFlowSessions, businesses, categories, zones, cities, verificationCodes, charlotteMemory } from "@shared/schema";
import { eq, and, desc, isNull, gt, sql, ilike } from "drizzle-orm";
import { buildFlowSystemPrompt, handleFlowAnswer, generateStoryArticle, getNextQuestion, getFlowProgress, getApplicableQuestions, buildConversationSystemPrompt, handleConversationData, handleExtractLead, generateSpotlightArticle, checkPremiumWritingAccess, buildCrownOnboardingSystemPrompt } from "./charlotte-flows";
import { storage } from "./storage";
import { sendTerritoryEmail } from "./services/territory-email";
import { sendTerritorySms } from "./services/territory-sms";
import { createInboxItemIfNotOpen, onVisitorFeedback } from "./admin-inbox";
import { generateBusinessSlug } from "./lib/slug-utils";
import { queueTranslation } from "./services/auto-translate";
import { geoTagAndClassify } from "./services/geo-tagger";
import { workflowEngine } from "./workflow-engine";
import {
  PUBLIC_GUIDE_GREETINGS,
  PUBLIC_GUIDE_SYSTEM,
  buildLanguageInstruction,
  STEP_CONTEXT_PROMPTS,
} from "./ai/prompts/public-guide";

async function getCategorySlugsForBusiness(businessId: string): Promise<string[]> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz?.categoryIds?.length) return [];
  const allCats = await db.select().from(categories);
  return allCats.filter((c: any) => biz.categoryIds?.includes(c.id)).map((c: any) => c.slug);
}

const DEFAULT_GREETINGS = PUBLIC_GUIDE_GREETINGS;

const DEFAULT_GREETING = DEFAULT_GREETINGS.en;

const DEFAULT_SYSTEM_INSTRUCTIONS = PUBLIC_GUIDE_SYSTEM;

interface PageContext {
  page?: string;
  step?: string;
  presenceType?: string;
  selectedTier?: string;
  businessName?: string;
  flowType?: string;
  flowSessionId?: string;
  businessId?: string;
  cityName?: string;
  mode?: string;
  activeHubFilter?: string;
  activeFeedContext?: string;
  intent?: string;
}

async function getRecentObservations(limit = 10): Promise<string> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const rows = await db.select()
      .from(charlotteMemory)
      .where(and(
        eq(charlotteMemory.type, "system_observation"),
        gt(charlotteMemory.createdAt, cutoff),
      ))
      .orderBy(desc(charlotteMemory.createdAt))
      .limit(limit);
    if (rows.length === 0) return "";
    const lines = rows.map(r => `- ${r.content}`).join("\n");
    return `\n\n## Recent Local News & Articles (use to answer "what's new" or "what's happening" questions)\n${lines}`;
  } catch {
    return "";
  }
}

function buildSystemPrompt(config: { systemInstructions: string; talkingPoints: string } | null, pageContext?: PageContext, locale?: string, observationsBlock?: string): string {
  let prompt = DEFAULT_SYSTEM_INSTRUCTIONS;
  prompt += buildLanguageInstruction(locale);

  if (config?.systemInstructions) {
    prompt += `\n\n## Additional Instructions from Admin\n${config.systemInstructions}`;
  }

  if (config?.talkingPoints) {
    prompt += `\n\n## Key Talking Points\n${config.talkingPoints}`;
  }

  if (observationsBlock) {
    prompt += observationsBlock;
  }

  if (pageContext?.page) {
    prompt += `\n\n## Current Page Context`;
    prompt += `\nThe user is currently on the "${pageContext.page}" page.`;
    if (pageContext.step) {
      prompt += `\nCurrent step: "${pageContext.step}"`;
      const stepHint = STEP_CONTEXT_PROMPTS[pageContext.step];
      if (stepHint) {
        prompt += `\n${stepHint}`;
      }
    }
    if (pageContext.presenceType) {
      prompt += `\nPresence type: ${pageContext.presenceType === "commerce" ? "Business (Commerce)" : "Community Organization"}`;
    }
    if (pageContext.selectedTier) {
      prompt += `\nSelected tier: ${pageContext.selectedTier}`;
    }
    if (pageContext.businessName) {
      prompt += `\nBusiness/org name: "${pageContext.businessName}"`;
    }
    if (pageContext.activeHubFilter) {
      prompt += `\nThe user is currently filtering the feed by neighborhood/hub: "${pageContext.activeHubFilter}". Tailor your suggestions to this specific area. For example, mention what's new, trending, or happening in this hub. Be specific about this neighborhood when offering suggestions.`;
    }
    if (pageContext.activeFeedContext) {
      const contextDescriptions: Record<string, string> = {
        trending: "The user is viewing trending/popular content.",
        new: "The user is viewing the newest content.",
        weekend: "The user is viewing weekend events and activities.",
        nearby: "The user is viewing content near their location.",
      };
      const desc = contextDescriptions[pageContext.activeFeedContext];
      if (desc) {
        prompt += `\n${desc}`;
      }
    }
    prompt += `\nTailor your responses to be relevant to what the user is currently doing. Reference their specific step and situation naturally.`;
  }

  return prompt;
}

export function registerCharlottePublicRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void
): void {
  app.get("/api/charlotte-public/config/:cityId", async (req: Request, res: Response) => {
    try {
      const { cityId } = req.params;
      const locale = (req.query.locale as string) || "en";
      const [config] = await db
        .select()
        .from(charlottePublicConfig)
        .where(eq(charlottePublicConfig.cityId, cityId as string))
        .limit(1);

      const defaultGreeting = DEFAULT_GREETINGS[locale] || DEFAULT_GREETINGS.en;

      if (!config) {
        return res.json({
          greetingMessage: defaultGreeting,
          isActive: true,
        });
      }

      res.json({
        greetingMessage: locale === "es" ? defaultGreeting : (config.greetingMessage || defaultGreeting),
        isActive: config.isActive,
      });
    } catch (error) {
      console.error("Error fetching charlotte public config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.get("/api/admin/charlotte-public/config/:cityId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId } = req.params;
      const [config] = await db
        .select()
        .from(charlottePublicConfig)
        .where(eq(charlottePublicConfig.cityId, cityId as string))
        .limit(1);

      if (!config) {
        return res.json({
          id: null,
          cityId,
          greetingMessage: DEFAULT_GREETING,
          systemInstructions: DEFAULT_SYSTEM_INSTRUCTIONS,
          talkingPoints: "",
          isActive: true,
        });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching charlotte admin config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.put("/api/admin/charlotte-public/config/:cityId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId } = req.params;
      const { greetingMessage, systemInstructions, talkingPoints, isActive } = req.body;

      const [existing] = await db
        .select()
        .from(charlottePublicConfig)
        .where(eq(charlottePublicConfig.cityId, cityId as string))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(charlottePublicConfig)
          .set({
            greetingMessage: greetingMessage ?? existing.greetingMessage,
            systemInstructions: systemInstructions ?? existing.systemInstructions,
            talkingPoints: talkingPoints ?? existing.talkingPoints,
            isActive: isActive ?? existing.isActive,
            updatedAt: new Date(),
          })
          .where(eq(charlottePublicConfig.id, existing.id))
          .returning();
        return res.json(updated);
      }

      const [created] = await db
        .insert(charlottePublicConfig)
        .values({
          cityId: cityId as string,
          greetingMessage: greetingMessage || DEFAULT_GREETING,
          systemInstructions: systemInstructions || "",
          talkingPoints: talkingPoints || "",
          isActive: isActive ?? true,
        })
        .returning();

      res.json(created);
    } catch (error) {
      console.error("Error updating charlotte config:", error);
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  app.get("/api/charlotte-public/flow/rate-limit", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId || null;
      if (!userId) {
        return res.json({ allowed: false, reason: "auth_required" });
      }

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const flowType = (req.query.flowType as string) || "story-interview";

      const recentSessions = await db
        .select()
        .from(charlotteFlowSessions)
        .where(
          and(
            eq(charlotteFlowSessions.userId, userId),
            eq(charlotteFlowSessions.flowType, flowType),
            gt(charlotteFlowSessions.createdAt, oneWeekAgo)
          )
        );

      const storyLimit = 1;
      const eventLimit = 3;
      const isEventFlow = flowType === "event-submission";
      const limit = isEventFlow ? eventLimit : storyLimit;
      const count = recentSessions.length;

      if (count >= limit) {
        return res.json({
          allowed: false,
          reason: "rate_limited",
          count,
          limit,
          message: isEventFlow
            ? "You've submitted your event limit this week. Come back next week or upgrade for more."
            : "You've shared your story this week. Come back next week or upgrade for more.",
        });
      }

      return res.json({ allowed: true, count, limit });
    } catch (error) {
      console.error("Error checking rate limit:", error);
      res.status(500).json({ error: "Failed to check rate limit" });
    }
  });

  app.post("/api/charlotte-public/flow/start", async (req: Request, res: Response) => {
    try {
      const { flowType, cityId, businessId, chatSessionId } = req.body;
      if (!flowType || !cityId) {
        return res.status(400).json({ error: "flowType and cityId are required" });
      }

      const userId = (req as any).session?.userId || null;
      if (!userId) {
        return res.status(401).json({ error: "auth_required", message: "Please sign in or create an account to continue." });
      }

      if (userId) {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentSessions = await db
          .select()
          .from(charlotteFlowSessions)
          .where(
            and(
              eq(charlotteFlowSessions.userId, userId),
              eq(charlotteFlowSessions.flowType, flowType),
              gt(charlotteFlowSessions.createdAt, oneWeekAgo)
            )
          );

        const isEventFlow = flowType === "event-submission";
        const limit = isEventFlow ? 3 : 1;

        if (recentSessions.length >= limit) {
          return res.status(429).json({
            error: "rate_limited",
            message: isEventFlow
              ? "You've submitted your event limit this week. Come back next week or upgrade for more."
              : "You've shared your story this week. Come back next week or upgrade for more.",
            count: recentSessions.length,
            limit,
          });
        }
      }

      const [session] = await db
        .insert(charlotteFlowSessions)
        .values({
          flowType,
          cityId,
          businessId: businessId || null,
          chatSessionId: chatSessionId || null,
          userId,
          responses: {},
          status: "in_progress",
        })
        .returning();

      const businessCategorySlugs = businessId ? await getCategorySlugsForBusiness(businessId) : [];

      const nextQuestion = getNextQuestion(flowType, businessCategorySlugs, {});
      const progress = getFlowProgress(flowType, businessCategorySlugs, {});

      const flowSourceMap: Record<string, string> = {
        "opportunity-profile": "activate",
        "story-interview": "story",
        "event-submission": "event",
      };
      const wfSource = flowSourceMap[flowType] || "story";
      let workflowSessionId: string | null = null;
      try {
        const wfResult = await workflowEngine.startSession({
          cityId,
          source: wfSource as "activate" | "claim" | "story" | "crown" | "qr" | "cta" | "event" | "job" | "publication",
          entityId: businessId || undefined,
          entityType: businessId ? "business" : undefined,
          chatSessionId: chatSessionId || undefined,
          sessionData: { flowType, charlotteFlowSessionId: session.id },
          internalResume: true,
        });
        workflowSessionId = wfResult.session.id;
      } catch (err) {
        console.error("[WORKFLOW] charlotte flow start:", err);
      }

      res.json({
        sessionId: session.id,
        workflowSessionId,
        nextQuestion,
        progress,
      });
    } catch (error) {
      console.error("Error starting flow:", error);
      res.status(500).json({ error: "Failed to start flow" });
    }
  });

  app.post("/api/charlotte-public/crown-onboarding/start", async (req: Request, res: Response) => {
    try {
      const { inviteToken, chatSessionId } = req.body;
      if (!inviteToken) {
        return res.status(400).json({ error: "inviteToken is required" });
      }

      const { crownParticipants, crownCategories, crownInvitations } = await import("@shared/schema");

      const [participant] = await db.select().from(crownParticipants)
        .where(eq(crownParticipants.inviteToken, inviteToken)).limit(1);
      if (!participant) {
        return res.status(404).json({ error: "Invalid invitation token" });
      }

      const trustedCityId = participant.cityId;

      const [category] = await db.select().from(crownCategories)
        .where(eq(crownCategories.id, participant.categoryId)).limit(1);

      const invitation = await db.select().from(crownInvitations)
        .where(eq(crownInvitations.participantId, participant.id))
        .then(r => r[0]);

      if (invitation) {
        if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
          if (invitation.invitationStatus !== "EXPIRED" && invitation.invitationStatus !== "CLAIM_COMPLETED") {
            await db.update(crownInvitations).set({ invitationStatus: "EXPIRED" })
              .where(eq(crownInvitations.id, invitation.id));
          }
          return res.status(410).json({ error: "Invitation has expired" });
        }
        if (invitation.invitationStatus === "DECLINED") {
          return res.status(410).json({ error: "Invitation has been declined" });
        }
        if (invitation.invitationStatus === "SENT") {
          await db.update(crownInvitations).set({
            invitationStatus: "VIEWED",
            viewedAt: new Date(),
          }).where(eq(crownInvitations.id, invitation.id));
        }
      }

      let autoLinkedBusinessId = participant.businessId || null;
      let autoLinkedBusinessName: string | undefined;
      if (autoLinkedBusinessId) {
        const [biz] = await db.select().from(businesses)
          .where(eq(businesses.id, autoLinkedBusinessId)).limit(1);
        if (biz) autoLinkedBusinessName = biz.name;
      }

      const [session] = await db
        .insert(charlotteFlowSessions)
        .values({
          flowType: "crown-onboarding",
          cityId: trustedCityId,
          businessId: autoLinkedBusinessId,
          chatSessionId: chatSessionId || null,
          userId: null,
          responses: {},
          status: "in_progress",
          businessName: participant.name,
          generatedContent: {
            crownParticipantId: participant.id,
            crownCategoryId: participant.categoryId,
            crownCategoryName: category?.name || "Unknown",
            participantType: participant.participantType,
            inviteToken,
            profileCompleted: !!participant.bio && participant.bio.length > 0,
            businessLinked: !!autoLinkedBusinessId,
            linkedBusinessId: autoLinkedBusinessId,
            linkedBusinessName: autoLinkedBusinessName,
          },
        })
        .returning();

      const hasAccepted = !["invited", "candidate"].includes(participant.status);
      const hasProfile = !!participant.bio && participant.bio.length > 0;
      const hasBusinessLinked = !!participant.businessId;

      res.json({
        sessionId: session.id,
        cityId: trustedCityId,
        participant: {
          id: participant.id,
          name: participant.name,
          status: participant.status,
          categoryName: category?.name || "Unknown",
          participantType: participant.participantType,
          bio: participant.bio,
          hasAccepted,
          hasProfile,
          hasBusinessLinked,
        },
      });
    } catch (error) {
      console.error("Error starting crown onboarding:", error);
      res.status(500).json({ error: "Failed to start crown onboarding" });
    }
  });

  app.get("/api/charlotte-public/flow/:sessionId", async (req: Request, res: Response) => {
    try {
      const [session] = await db
        .select()
        .from(charlotteFlowSessions)
        .where(eq(charlotteFlowSessions.id, req.params.sessionId))
        .limit(1);

      if (!session) return res.status(404).json({ error: "Session not found" });

      const businessCategorySlugs = session.businessId ? await getCategorySlugsForBusiness(session.businessId) : [];

      const responses = (session.responses as Record<string, any>) || {};
      const nextQuestion = getNextQuestion(session.flowType, businessCategorySlugs, responses);
      const progress = getFlowProgress(session.flowType, businessCategorySlugs, responses);

      res.json({
        session,
        nextQuestion,
        progress,
      });
    } catch (error) {
      console.error("Error fetching flow session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  function getFlowTools(flowType: string): OpenAI.ChatCompletionTool[] {
    if (flowType === "opportunity-profile") {
      return [{
        type: "function",
        function: {
          name: "save_profile_answer",
          description: "Save the business owner's answer to a profiling question. Call this immediately after the user responds to each question.",
          parameters: {
            type: "object",
            properties: {
              questionId: { type: "string", description: "The question ID (e.g., screens_count, ad_channels)" },
              answer: {
                oneOf: [
                  { type: "string" },
                  { type: "array", items: { type: "string" } },
                ],
                description: "The user's answer. Use a string for single-select, an array of strings for multi-select.",
              },
            },
            required: ["questionId", "answer"],
          },
        },
      }];
    }

    if (flowType === "story-interview") {
      return [
        {
          type: "function",
          function: {
            name: "save_conversation_data",
            description: "Save the interviewee's response and any signals discovered. Call this after each meaningful exchange with the module ID that best matches what they shared.",
            parameters: {
              type: "object",
              properties: {
                moduleId: { type: "string", description: "The conversation module ID (e.g., personal_story, origin_story, neighborhood, primary_business, community_impact, vision_passion, events_gatherings, local_recommendations, venue_screens, job_employment, etc.)" },
                responseText: { type: "string", description: "The interviewee's full response to this topic" },
                extractedSignals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", description: "Extraction category: story_material, lead_generation, community_intelligence, job_board, marketplace, venue_tv, media_sources, or entrepreneur_ecosystem" },
                      type: { type: "string", description: "Signal type (e.g., business_mention, person_to_interview, hiring_signal, venue_with_screens, hidden_gem, event_lead, publication_mention)" },
                      value: { type: "string", description: "The entity or thing discovered (e.g., a business name, a person's name, a publication)" },
                      context: { type: "string", description: "Brief context about this signal from the conversation" },
                    },
                    required: ["category", "type", "value", "context"],
                  },
                  description: "Any leads, businesses, people, places, or signals discovered in the response",
                },
              },
              required: ["moduleId", "responseText"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "extract_lead",
            description: "Explicitly flag a lead discovered during conversation — a business, person, venue, hiring opportunity, or community resource worth following up on.",
            parameters: {
              type: "object",
              properties: {
                leadType: { type: "string", description: "Type of lead: business, person_to_interview, venue_screen, hiring, marketplace, media, coworking, event" },
                entityName: { type: "string", description: "Name of the business, person, or entity" },
                detail: { type: "string", description: "Brief detail about why this is a lead" },
                sourceModuleId: { type: "string", description: "Which conversation module this lead came from" },
              },
              required: ["leadType", "entityName", "detail", "sourceModuleId"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "generate_spotlight_article",
            description: "Generate a Local Leader / Neighborhood Leader spotlight article from the full interview. Call this when story depth is sufficient and the conversation reaches a natural conclusion.",
            parameters: {
              type: "object",
              properties: {
                articleStyle: { type: "string", enum: ["spotlight", "brief"], description: "spotlight for a full ~2000-word profile, brief for a 200-300 word community story" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "activate_presence",
            description: "Look up and activate a business or organization presence on the Hub. Call this after collecting the business basics and details. Always returns found:true — Charlotte should ALWAYS say 'I found your listing.'",
            parameters: {
              type: "object",
              properties: {
                businessName: { type: "string", description: "Name of the business or organization" },
                presenceType: { type: "string", enum: ["commerce", "organization"], description: "Whether this is a commerce business or nonprofit/community organization" },
                email: { type: "string", description: "Contact email address" },
                phone: { type: "string", description: "Contact phone number" },
                website: { type: "string", description: "Website URL (optional)" },
                zipCode: { type: "string", description: "ZIP code for location" },
                categoryName: { type: "string", description: "Business category (e.g., Restaurant, Hair Salon, Nonprofit)" },
                description: { type: "string", description: "Brief description of what the business does" },
                role: { type: "string", description: "The person's role/title (e.g., Owner, Manager, Director)" },
                contactName: { type: "string", description: "Contact person's first name" },
                contactLastName: { type: "string", description: "Contact person's last name" },
              },
              required: ["businessName", "presenceType", "email", "phone", "categoryName", "contactName"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "send_verification_code",
            description: "Send a verification code to the business contact via email or SMS. Call after activate_presence to verify their identity.",
            parameters: {
              type: "object",
              properties: {
                method: { type: "string", enum: ["email", "sms"], description: "How to send the code" },
                businessId: { type: "string", description: "The business ID returned from activate_presence" },
              },
              required: ["method", "businessId"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "verify_code",
            description: "Verify the 6-digit code the user provides. Call when the user types their verification code in the chat.",
            parameters: {
              type: "object",
              properties: {
                code: { type: "string", description: "The 6-digit verification code" },
                businessId: { type: "string", description: "The business ID from activate_presence" },
              },
              required: ["code", "businessId"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "register_venue",
            description: "Register a venue in the Hub Venue Network. Creates a TV screen entry, CRM contact, and venue audio profile with their music preferences. Always say 'I found your space' after calling this.",
            parameters: {
              type: "object",
              properties: {
                venueName: { type: "string", description: "Name of the venue" },
                venueAddress: { type: "string", description: "Full address of the venue" },
                contactName: { type: "string", description: "Contact person's full name" },
                contactEmail: { type: "string", description: "Contact email address" },
                contactPhone: { type: "string", description: "Contact phone number" },
                citySlug: { type: "string", description: "City slug (e.g., charlotte)" },
                presetSlug: { type: "string", description: "Mood preset slug (coffee-shop-chill, nightlife-energy, office-focus, gym-pump, sunday-brunch, family-dining, happy-hour, retail-vibe) or empty for custom" },
                customGenres: { type: "array", items: { type: "string" }, description: "Custom genre preferences if no preset selected" },
                customMoods: { type: "array", items: { type: "string" }, description: "Custom mood tags if no preset selected" },
                energyLevel: { type: "string", enum: ["low", "medium", "high"], description: "Energy level preference" },
                musicEnabled: { type: "boolean", description: "Whether music should play" },
                talkSegmentsEnabled: { type: "boolean", description: "Whether talk segments should play" },
                excludedGenres: { type: "array", items: { type: "string" }, description: "Genres to exclude from the mix" },
                footTraffic: { type: "number", description: "Estimated daily foot traffic" },
                hasExistingScreens: { type: "boolean", description: "Whether the venue already has TV screens" },
              },
              required: ["venueName", "contactName", "contactEmail", "citySlug"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "set_participation_identity",
            description: "Set the participant's identity and role in the community. Call this once you've naturally determined their relationship to their business or organization (owner, manager, volunteer, creator, etc.).",
            parameters: {
              type: "object",
              properties: {
                role: { type: "string", enum: ["owner", "manager", "employee", "marketing_rep", "executive_director", "board_member", "volunteer", "host", "organizer", "creator", "contributor"], description: "Their role relative to the entity" },
                presenceType: { type: "string", enum: ["commerce", "organization"], description: "Whether this is a commerce business or nonprofit/community organization" },
              },
              required: ["role"],
            },
          },
        },
      ];
    }

    if (flowType === "crown-onboarding") {
      return [
        {
          type: "function",
          function: {
            name: "accept_crown_nomination",
            description: "Accept the Crown Program nomination on behalf of the nominee. Call this when the nominee confirms they want to accept their nomination.",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "complete_nominee_profile",
            description: "Save the nominee's profile information including their bio and optional website URL. Call this after gathering their bio through conversation.",
            parameters: {
              type: "object",
              properties: {
                bio: { type: "string", description: "The nominee's bio — what makes them special, what they bring to the community" },
                websiteUrl: { type: "string", description: "Optional website URL" },
              },
              required: ["bio"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "link_business_to_nomination",
            description: "Link an existing business listing to the nomination, or create a new one. Call this to connect their Hub presence to their Crown nomination.",
            parameters: {
              type: "object",
              properties: {
                createNew: { type: "boolean", description: "Whether to create a new business listing (true) or search for an existing one (false)" },
                businessName: { type: "string", description: "Name of the business to search for or create" },
                email: { type: "string", description: "Business contact email (required for new listings)" },
                phone: { type: "string", description: "Business phone number (optional)" },
                description: { type: "string", description: "Brief description of the business (for new listings)" },
              },
              required: ["createNew", "businessName"],
            },
          },
        },
      ];
    }

    return [];
  }

  async function advanceWorkflowFromChat(
    flowSessionId: string,
    targetStep: string,
    eventData?: Record<string, unknown>
  ): Promise<void> {
    try {
      const [flowSession] = await db
        .select()
        .from(charlotteFlowSessions)
        .where(eq(charlotteFlowSessions.id, flowSessionId))
        .limit(1);
      if (!flowSession?.chatSessionId) return;

      const wfSession = await storage.findWorkflowSessionByChat(flowSession.chatSessionId);
      if (!wfSession || wfSession.status !== "active") return;

      await workflowEngine.advanceThroughSteps(
        wfSession.id,
        targetStep as Parameters<typeof workflowEngine.advanceThroughSteps>[1],
        { ...eventData, source: "charlotte_conductor", flowSessionId }
      );
    } catch (err) {
      console.error("[WORKFLOW-CONDUCTOR] advance failed:", (err as Error).message);
    }
  }

  async function executeFlowToolCall(
    toolName: string,
    args: any,
    flowSessionId: string
  ): Promise<{ result: any; suggestions?: { id: string; label: string }[]; topicProgress?: any[]; storyDepthScore?: number; completeness?: any }> {
    if (toolName === "save_profile_answer") {
      const { questionId, answer } = args;
      const result = await handleFlowAnswer(flowSessionId, questionId, answer);

      let suggestions: { id: string; label: string }[] | undefined;
      if (result.nextQuestion?.options) {
        suggestions = result.nextQuestion.options.map((o) => ({ id: o.id, label: o.label }));
      }

      return {
        result: {
          saved: true,
          progress: result.progress,
          nextQuestionId: result.nextQuestion?.id || null,
          flowComplete: result.progress.complete,
        },
        suggestions,
      };
    }

    if (toolName === "save_conversation_data") {
      const { moduleId, responseText, extractedSignals } = args;
      const result = await handleConversationData(flowSessionId, moduleId, responseText, extractedSignals);

      advanceWorkflowFromChat(flowSessionId, "story_builder", {
        moduleId,
        storyDepthScore: result.storyDepthScore,
        milestone: "story_data_saved",
      }).catch((err) => {
        console.error("[WORKFLOW-CONDUCTOR] story_data_saved advance failed:", (err as Error).message);
      });

      if (result.completeness.ready && result.storyDepthScore >= 60) {
        (async () => {
          try {
            const [fs] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, flowSessionId)).limit(1);
            if (fs?.chatSessionId) {
              const ws = await storage.findWorkflowSessionByChat(fs.chatSessionId);
              if (ws) {
                await workflowEngine.recordEvent(ws.id, "step_advance" as Parameters<typeof workflowEngine.recordEvent>[1], {
                  milestone: "story_completed",
                  storyDepthScore: result.storyDepthScore,
                  detectedPersona: result.detectedPersona,
                });
              }
            }
          } catch (err) {
            console.error("[WORKFLOW-CONDUCTOR] story_completed event failed:", (err as Error).message);
          }
        })();
      }

      return {
        result: {
          saved: true,
          nextModule: result.nextModule,
          detectedPersona: result.detectedPersona,
          storyDepthScore: result.storyDepthScore,
          completeness: result.completeness,
          flowComplete: result.completeness.ready && result.storyDepthScore >= 60,
        },
        topicProgress: result.topicProgress,
        storyDepthScore: result.storyDepthScore,
        completeness: result.completeness,
      };
    }

    if (toolName === "extract_lead") {
      const { leadType, entityName, detail, sourceModuleId } = args;
      const result = await handleExtractLead(flowSessionId, leadType, entityName, detail, sourceModuleId);
      return { result: { ...result, leadType, entityName } };
    }

    if (toolName === "generate_story") {
      if (!openai) throw new Error("OpenAI not configured");
      const story = await generateStoryArticle(flowSessionId, openai);

      advanceWorkflowFromChat(flowSessionId, "capability_activation", {
        milestone: "story_generated",
        articleId: story.articleId,
        title: story.title,
      }).catch((err) => {
        console.error("[WORKFLOW-CONDUCTOR] story_generated advance failed:", (err as Error).message);
      });

      return {
        result: {
          generated: true,
          title: story.title,
          content: story.content,
          articleId: story.articleId,
        },
      };
    }

    if (toolName === "generate_spotlight_article") {
      if (!openai) throw new Error("OpenAI not configured");

      const premiumCheck = await checkPremiumWritingAccess(flowSessionId);
      if (!premiumCheck.allowed) {
        return {
          result: {
            generated: false,
            premiumRequired: true,
            tier: premiumCheck.tier,
            businessId: premiumCheck.businessId,
            message: "This user does not have the Enhanced tier. AI-generated spotlight articles are a premium feature. Let the user know their story has been saved and will be reviewed, but Charlotte AI writing requires upgrading their presence. Suggest they upgrade to Enhanced to get a full spotlight article written by Charlotte.",
          },
        };
      }

      const style = args.articleStyle || "spotlight";
      const story = await generateSpotlightArticle(flowSessionId, openai, style);

      (async () => {
        try {
          const [fs] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, flowSessionId)).limit(1);
          if (fs?.chatSessionId) {
            const ws = await storage.findWorkflowSessionByChat(fs.chatSessionId);
            if (ws) {
              await workflowEngine.recordEvent(ws.id, "step_advance" as Parameters<typeof workflowEngine.recordEvent>[1], {
                milestone: "article_generated",
                articleId: story.articleId,
                title: story.title,
                wordCount: story.wordCount,
              });
              await workflowEngine.advanceThroughSteps(ws.id, "capability_activation", {
                storyComplete: true,
                articleId: story.articleId,
              });
              await workflowEngine.generateRecommendations(ws.id);
            }
          }
        } catch (err) {
          console.error("[WORKFLOW-CONDUCTOR] article_generated event failed:", (err as Error).message);
        }
      })();

      return {
        result: {
          generated: true,
          title: story.title,
          content: story.content,
          articleId: story.articleId,
          wordCount: story.wordCount,
        },
      };
    }

    if (toolName === "set_participation_identity") {
      const { role, presenceType } = args;
      try {
        const [flowSession] = await db
          .select()
          .from(charlotteFlowSessions)
          .where(eq(charlotteFlowSessions.id, flowSessionId))
          .limit(1);
        if (flowSession?.chatSessionId) {
          const wfSession = await storage.findWorkflowSessionByChat(flowSession.chatSessionId);
          if (wfSession) {
            await workflowEngine.setIdentityRole(wfSession.id, role, presenceType);
            advanceWorkflowFromChat(flowSessionId, "identity_router", { role, presenceType }).catch((err) => {
              console.error("[WORKFLOW-CONDUCTOR] identity_router advance failed:", (err as Error).message);
            });
          }
        }
      } catch (err) {
        console.error("[WORKFLOW-CONDUCTOR] identity routing failed:", (err as Error).message);
      }
      return {
        result: {
          saved: true,
          role,
          presenceType: presenceType || "commerce",
        },
      };
    }

    if (toolName === "activate_presence") {
      const { businessName, presenceType, email, phone, website, zipCode, categoryName, description, role, contactName, contactLastName } = args;

      let zoneRecord: any = null;
      let cityId: string | null = null;

      if (zipCode) {
        const [zoneByZip] = await db.select().from(zones).where(sql`${zipCode} = ANY(${zones.zipCodes})`).limit(1);
        if (zoneByZip) {
          zoneRecord = zoneByZip;
          cityId = zoneByZip.cityId;
        }
      }

      if (!zoneRecord) {
        const allZones = await db.select().from(zones).limit(1);
        if (allZones.length > 0) {
          zoneRecord = allZones[0];
          cityId = allZones[0].cityId;
        }
      }

      if (!cityId) {
        const [city] = await db.select().from(cities).limit(1);
        cityId = city?.id || null;
      }

      let categoryId: string | null = null;
      if (categoryName) {
        const [catMatch] = await db.select().from(categories).where(ilike(categories.name, `%${categoryName}%`)).limit(1);
        if (catMatch) categoryId = catMatch.id;
      }
      if (!categoryId) {
        const [defaultCat] = await db.select().from(categories).limit(1);
        categoryId = defaultCat?.id || null;
      }

      const cityRecord = cityId ? await db.select().from(cities).where(eq(cities.id, cityId)).limit(1) : [];
      const cityName = cityRecord[0]?.brandName || "Charlotte";

      let existingMatch: any = null;
      try {
        const matches = await storage.searchBusinessesFuzzy(businessName, cityName, website || undefined);
        if (matches.length === 1) {
          existingMatch = matches[0];
        } else if (matches.length > 1 && website) {
          let websiteDomain: string | null = null;
          try {
            const u = new URL(website.startsWith("http") ? website : `https://${website}`);
            websiteDomain = u.hostname.replace(/^www\./, "").toLowerCase();
          } catch {}
          if (websiteDomain) {
            const exactUrlMatch = matches.find((m: any) => {
              if (!m.websiteUrl) return false;
              try {
                const mu = new URL(m.websiteUrl.startsWith("http") ? m.websiteUrl : `https://${m.websiteUrl}`);
                return mu.hostname.replace(/^www\./, "").toLowerCase() === websiteDomain;
              } catch { return false; }
            });
            if (exactUrlMatch) existingMatch = exactUrlMatch;
          }
        }
      } catch (searchErr) {
        console.log("[CHARLOTTE-ACTIVATE] Fuzzy search error (non-fatal):", (searchErr as Error).message);
      }

      let aiDescription = description || `Discover ${businessName}, proudly serving the Charlotte community.`;
      let aiTagline = "";
      try {
        if (openai) {
          const aiResp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            max_tokens: 250,
            messages: [
              { role: "system", content: "You write short, warm, professional directory descriptions for local businesses and organizations. Output valid JSON only." },
              { role: "user", content: `Write a directory listing for "${businessName}", a ${presenceType} in the ${categoryName} category, located in ${zoneRecord?.name || "Charlotte"}, NC. ${website ? `Website: ${website}.` : ""} ${description ? `About: ${description}.` : ""} Return JSON: {"description": "2-3 sentence factual directory description", "tagline": "A catchy 3-6 word tagline."}` }
            ],
            response_format: { type: "json_object" },
          });
          const aiContent = aiResp.choices[0]?.message?.content;
          if (aiContent) {
            const parsed = JSON.parse(aiContent);
            aiDescription = parsed.description || aiDescription;
            aiTagline = parsed.tagline || "";
          }
        }
      } catch (aiErr) {
        console.log("[CHARLOTTE-ACTIVATE] AI description skipped:", (aiErr as Error).message);
      }

      let entityId: string;
      let neighborhood = zoneRecord?.name || "Charlotte";

      if (existingMatch && existingMatch.claimStatus === "UNCLAIMED") {
        await db.update(businesses).set({
          ownerEmail: email,
          claimStatus: "PENDING",
          draftContactPhone: phone,
          claimantRole: role || null,
          presenceStatus2: "DRAFT",
          description: aiDescription || existingMatch.description,
          micrositeTagline: aiTagline || existingMatch.micrositeTagline,
          activationSource: "charlotte",
        }).where(eq(businesses.id, existingMatch.id));
        entityId = existingMatch.id;
        const matchZone = existingMatch.zoneId ? await db.select().from(zones).where(eq(zones.id, existingMatch.zoneId)).limit(1) : [];
        neighborhood = matchZone[0]?.name || neighborhood;

        queueTranslation("business", entityId);
      } else {
        const slug = await generateBusinessSlug(businessName, cityId!, {
          zoneId: zoneRecord?.id,
          hubSlug: zoneRecord?.slug,
          cityName: "Charlotte",
        });

        const [draft] = await db.insert(businesses).values({
          cityId: cityId!,
          zoneId: zoneRecord?.id || null,
          name: businessName,
          slug,
          phone,
          ownerEmail: email,
          websiteUrl: website || null,
          description: aiDescription,
          micrositeTagline: aiTagline || null,
          presenceType: presenceType === "organization" ? "organization" : "commerce",
          categoryIds: categoryId ? [categoryId] : [],
          listingTier: "VERIFIED",
          presenceStatus2: "DRAFT",
          draftContactPhone: phone,
          claimantRole: role || null,
          activationSource: "charlotte",
        }).returning();
        entityId = draft.id;

        queueTranslation("business", entityId);
        geoTagAndClassify("business", entityId, cityId!, {
          title: businessName,
          description: aiDescription || null,
          address: null,
          zip: null,
          categoryIds: categoryId ? [categoryId] : [],
        }, { existingZoneId: zoneRecord?.id || undefined }).catch(err => console.error("[GeoTagger] Charlotte biz:", err.message));
      }

      await db.update(charlotteFlowSessions).set({
        businessId: entityId,
        businessName,
      }).where(eq(charlotteFlowSessions.id, flowSessionId));

      createInboxItemIfNotOpen({
        itemType: "new_activation",
        relatedTable: "businesses",
        relatedId: entityId,
        title: `Charlotte Activation: ${businessName}`,
        summary: `${presenceType === "organization" ? "Organization" : "Commerce"} activation via Charlotte conversation by ${contactName}${contactLastName ? " " + contactLastName : ""} (${email}) in ${neighborhood}.`,
        tags: ["Activation", "Charlotte", presenceType === "organization" ? "Organization" : "Commerce"],
        links: [{ label: "Review Presence", urlOrRoute: `/admin/businesses?openBiz=${entityId}` }],
      }).catch(err => console.error("[INBOX] Failed to create Charlotte activation inbox item:", err));

      advanceWorkflowFromChat(flowSessionId, "match", {
        businessId: entityId,
        businessName,
        activationSource: "charlotte",
      }).catch((err) => {
        console.error("[WORKFLOW-CONDUCTOR] match advance failed:", (err as Error).message);
      });

      return {
        result: {
          found: true,
          businessId: entityId,
          businessName,
          neighborhood,
          category: categoryName,
        },
      };
    }

    if (toolName === "send_verification_code") {
      const { method, businessId } = args;

      const [flowSession] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, flowSessionId)).limit(1);
      if (!flowSession?.businessId || flowSession.businessId !== businessId) {
        return { result: { sent: false, error: "Business must be activated in this session first" } };
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!biz) {
        return { result: { sent: false, error: "Business not found" } };
      }

      const target = method === "sms" ? (biz.draftContactPhone || biz.phone) : biz.ownerEmail;
      if (!target) {
        return { result: { sent: false, error: `No ${method === "sms" ? "phone number" : "email address"} on file` } };
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(verificationCodes).values({
        entityId: businessId,
        code,
        type: method === "sms" ? "SMS" : "EMAIL",
        target,
        expiresAt,
      });

      const entityCityId = biz.cityId || undefined;

      if (method === "email") {
        const result = await sendTerritoryEmail({
          cityId: entityCityId,
          to: target,
          subject: "CLT Metro Hub - Verification Code",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #5B1D8F; margin-bottom: 16px;">Verify Your Presence</h2>
              <p style="color: #333; font-size: 16px;">Your verification code is:</p>
              <div style="background: #f4f0ff; border: 2px solid #5B1D8F; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #5B1D8F;">${code}</span>
              </div>
              <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
              <p style="color: #999; font-size: 12px; margin-top: 24px;">CLT Metro Hub</p>
            </div>
          `,
          metadata: { type: "verification_code", entityId: businessId },
        });
        if (!result.success) {
          return { result: { sent: false, error: "Failed to send verification email" } };
        }
      } else {
        const result = await sendTerritorySms({
          cityId: entityCityId,
          to: target,
          body: `CLT Metro Hub verification code: ${code}. Expires in 10 minutes.`,
          metadata: { type: "verification_code", entityId: businessId },
        });
        if (!result.success) {
          return { result: { sent: false, error: "Failed to send SMS" } };
        }
      }

      const masked = method === "sms"
        ? target.replace(/(\d{3})\d{4}(\d{3,4})/, "$1****$2")
        : target.replace(/(.{2}).*(@.*)/, "$1***$2");

      return {
        result: {
          sent: true,
          method,
          destination: masked,
        },
      };
    }

    if (toolName === "verify_code") {
      const { code, businessId } = args;

      const [flowSession] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, flowSessionId)).limit(1);
      if (!flowSession?.businessId || flowSession.businessId !== businessId) {
        return { result: { verified: false, error: "Business must be activated in this session first" } };
      }

      const [match] = await db.select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.entityId, businessId),
            eq(verificationCodes.code, code),
            isNull(verificationCodes.usedAt),
            gt(verificationCodes.expiresAt, new Date()),
          )
        )
        .limit(1);

      if (!match) {
        return { result: { verified: false, error: "Invalid or expired code. Please request a new one." } };
      }

      await db.update(verificationCodes)
        .set({ usedAt: new Date() })
        .where(eq(verificationCodes.id, match.id));

      const updateData: any = {
        activationSource: "charlotte",
        presenceStatus2: "PENDING_PAYMENT",
        listingTier: "VERIFIED",
      };
      if (match.type === "EMAIL") {
        updateData.emailVerifiedAt = new Date();
        updateData.verificationMethodUsed = "EMAIL";
      } else {
        updateData.phoneVerifiedAt = new Date();
        updateData.verificationMethodUsed = "SMS";
      }

      await db.update(businesses)
        .set(updateData)
        .where(eq(businesses.id, businessId));

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      const citySlug = biz ? await (async () => {
        if (biz.cityId) {
          const [city] = await db.select().from(cities).where(eq(cities.id, biz.cityId)).limit(1);
          return city?.slug || "charlotte";
        }
        return "charlotte";
      })() : "charlotte";
      const paymentUrl = `/${citySlug}/activate?step=payment&entityId=${businessId}`;

      advanceWorkflowFromChat(flowSessionId, "verification", {
        method: match.type,
        businessId,
        verifiedAt: new Date().toISOString(),
      }).catch((err) => {
        console.error("[WORKFLOW-CONDUCTOR] verification advance failed:", (err as Error).message);
      });

      return {
        result: {
          verified: true,
          requiresPayment: true,
          paymentUrl,
          businessName: biz?.name || args.businessName,
        },
      };
    }

    if (toolName === "register_venue") {
      const { venueName, venueAddress, contactName, contactEmail, contactPhone, citySlug: venueCitySlug, presetSlug, customGenres, customMoods, energyLevel, musicEnabled, talkSegmentsEnabled, excludedGenres, footTraffic, hasExistingScreens } = args;

      let cityId: string | null = null;
      if (venueCitySlug) {
        const city = await storage.getCityBySlug(venueCitySlug);
        if (city) cityId = city.id;
      }
      if (!cityId) {
        const [city] = await db.select().from(cities).limit(1);
        cityId = city?.id || null;
      }

      const screen = await storage.createTvScreen({
        name: `${venueName} Screen`,
        cityId: cityId || null,
        metroSlug: venueCitySlug || "charlotte",
        hubSlug: null,
        status: "inactive",
        languageMode: "en",
        competitorProtectionEnabled: false,
        protectedCategoryIds: [],
        venueName,
        venueAddress: venueAddress || null,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        notes: `Venue Network onboarding. Foot traffic: ~${footTraffic || "unknown"}/day. Has screens: ${hasExistingScreens ? "yes" : "no"}.`,
      });

      try {
        const { crmContacts } = await import("@shared/schema");
        await db.insert(crmContacts).values({
          userId: "system",
          name: contactName,
          email: contactEmail,
          phone: contactPhone || null,
          company: venueName,
          source: "hub-screens" as any,
          cityId: cityId || null,
          notes: `Venue Network onboarding via Charlotte. Screen ID: ${screen.id}. Foot traffic: ~${footTraffic || "unknown"}/day.`,
        } as any);
      } catch (e) {
        console.log("[VENUE-ONBOARD] CRM contact creation skipped:", e);
      }

      let presetId: string | null = null;
      if (presetSlug) {
        try {
          const { musicMoodPresets } = await import("@shared/schema");
          const [preset] = await db.select().from(musicMoodPresets).where(eq(musicMoodPresets.slug, presetSlug)).limit(1);
          if (preset) presetId = preset.id;
        } catch (e) {
          console.log("[VENUE-ONBOARD] Preset lookup skipped:", e);
        }
      }

      try {
        const { venueAudioProfiles } = await import("@shared/schema");
        await db.insert(venueAudioProfiles).values({
          screenId: screen.id,
          presetId,
          customMoods: customMoods || [],
          customGenres: customGenres || [],
          excludedGenres: excludedGenres || [],
          excludedArtistIds: [],
          volumeLevel: "medium",
          musicEnabled: musicEnabled !== false,
          talkSegmentsEnabled: talkSegmentsEnabled !== false,
          adSegmentsEnabled: true,
          musicMixPercent: 70,
        });
      } catch (e) {
        console.log("[VENUE-ONBOARD] Audio profile creation skipped:", e);
      }

      createInboxItemIfNotOpen({
        itemType: "venue_onboard",
        relatedTable: "tv_screens",
        relatedId: screen.id,
        title: `Venue Network: ${venueName}`,
        summary: `${contactName} (${contactEmail}) joined the venue network via Charlotte. Preset: ${presetSlug || "custom"}. Foot traffic: ~${footTraffic || "unknown"}/day.`,
        tags: ["Venue Network", "Charlotte", "Hub Screens"],
        links: [{ label: "Review Screen", urlOrRoute: "/admin/web-tv" }],
      }).catch(err => console.error("[INBOX] Failed to create venue onboard inbox item:", err));

      return {
        result: {
          found: true,
          screenId: screen.id,
          screenKey: screen.screenKey,
          venueName,
          presetName: presetSlug ? presetSlug.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : "Custom",
        },
      };
    }

    if (toolName === "accept_crown_nomination") {
      const { crownParticipants, crownInvitations } = await import("@shared/schema");
      const [flowSession] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, flowSessionId)).limit(1);
      if (!flowSession) return { result: { accepted: false, error: "Session not found" } };

      const metadata = (flowSession.generatedContent || {}) as any;
      const participantId = metadata.crownParticipantId;
      if (!participantId) return { result: { accepted: false, error: "No Crown participant linked to this session" } };

      const [participant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId)).limit(1);
      if (!participant) return { result: { accepted: false, error: "Participant not found" } };

      if (!["invited", "candidate"].includes(participant.status)) {
        return { result: { accepted: true, alreadyAccepted: true, message: "Nomination was already accepted" } };
      }

      await db.update(crownParticipants).set({ status: "accepted" }).where(eq(crownParticipants.id, participantId));

      const [invitation] = await db.select().from(crownInvitations).where(eq(crownInvitations.participantId, participantId)).limit(1);
      if (invitation && ["SENT", "VIEWED"].includes(invitation.invitationStatus)) {
        await db.update(crownInvitations).set({
          invitationStatus: "CLAIM_STARTED",
          claimStartedAt: new Date(),
        }).where(eq(crownInvitations.id, invitation.id));
      }

      const hasProfile = !!participant.bio && participant.bio.length > 0;
      const hasBusinessLinked = !!participant.businessId;

      if (hasProfile && hasBusinessLinked) {
        await db.update(crownParticipants).set({
          status: "verified_participant",
          verifiedAt: new Date(),
        }).where(eq(crownParticipants.id, participantId));

        if (invitation) {
          await db.update(crownInvitations).set({
            invitationStatus: "CLAIM_COMPLETED",
            claimCompletedAt: new Date(),
            acceptedAt: new Date(),
          }).where(eq(crownInvitations.id, invitation.id));
        }

        await db.update(charlotteFlowSessions).set({
          status: "completed",
          generatedContent: { ...metadata, profileCompleted: true, businessLinked: true },
          updatedAt: new Date(),
        }).where(eq(charlotteFlowSessions.id, flowSessionId));

        return {
          result: {
            accepted: true,
            participantName: participant.name,
            flowComplete: true,
            message: "Nomination accepted and onboarding complete — you are now a verified participant!",
          },
        };
      }

      return { result: { accepted: true, participantName: participant.name } };
    }

    if (toolName === "complete_nominee_profile") {
      const { bio, websiteUrl } = args;
      const { crownParticipants, crownInvitations } = await import("@shared/schema");
      const [flowSession] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, flowSessionId)).limit(1);
      if (!flowSession) return { result: { saved: false, error: "Session not found" } };

      const metadata = (flowSession.generatedContent || {}) as any;
      const participantId = metadata.crownParticipantId;
      if (!participantId) return { result: { saved: false, error: "No Crown participant linked" } };

      const [currentParticipant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId)).limit(1);
      if (!currentParticipant) return { result: { saved: false, error: "Participant not found" } };
      if (["invited", "candidate"].includes(currentParticipant.status)) {
        return { result: { saved: false, error: "Please accept the nomination first before completing your profile." } };
      }

      const profileUpdates: Record<string, any> = { bio };
      if (websiteUrl) profileUpdates.websiteUrl = websiteUrl;
      await db.update(crownParticipants).set(profileUpdates).where(eq(crownParticipants.id, participantId));

      const hasBusinessLinked = !!currentParticipant.businessId;
      const updatedMetadata = { ...metadata, profileCompleted: true };

      if (hasBusinessLinked) {
        await db.update(crownParticipants).set({
          status: "verified_participant",
          verifiedAt: new Date(),
        }).where(eq(crownParticipants.id, participantId));

        const [invitation] = await db.select().from(crownInvitations).where(eq(crownInvitations.participantId, participantId)).limit(1);
        if (invitation) {
          await db.update(crownInvitations).set({
            invitationStatus: "CLAIM_COMPLETED",
            claimCompletedAt: new Date(),
            acceptedAt: invitation.acceptedAt || new Date(),
          }).where(eq(crownInvitations.id, invitation.id));
        }

        await db.update(charlotteFlowSessions).set({
          status: "completed",
          generatedContent: updatedMetadata,
          updatedAt: new Date(),
        }).where(eq(charlotteFlowSessions.id, flowSessionId));

        return {
          result: {
            saved: true,
            status: "verified_participant",
            flowComplete: true,
            message: "Profile saved and onboarding complete — you are now a verified participant!",
          },
        };
      }

      await db.update(charlotteFlowSessions).set({
        generatedContent: updatedMetadata,
        updatedAt: new Date(),
      }).where(eq(charlotteFlowSessions.id, flowSessionId));

      return {
        result: {
          saved: true,
          profileCompleted: true,
          needsBusinessLink: true,
          message: "Profile saved! Now let's link your business listing to complete onboarding.",
        },
      };
    }

    if (toolName === "link_business_to_nomination") {
      const { createNew, businessName, email, phone, description } = args;
      const { crownParticipants, crownInvitations } = await import("@shared/schema");
      const [flowSession] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, flowSessionId)).limit(1);
      if (!flowSession) return { result: { linked: false, error: "Session not found" } };

      const metadata = (flowSession.generatedContent || {}) as any;
      const participantId = metadata.crownParticipantId;
      if (!participantId) return { result: { linked: false, error: "No Crown participant linked" } };

      const [currentParticipant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId)).limit(1);
      if (!currentParticipant) return { result: { linked: false, error: "Participant not found" } };
      if (["invited", "candidate"].includes(currentParticipant.status)) {
        return { result: { linked: false, error: "Please accept the nomination first before linking a business." } };
      }

      let businessId: string | null = null;

      if (!createNew) {
        const matches = await db.select().from(businesses)
          .where(and(ilike(businesses.name, `%${businessName}%`), eq(businesses.cityId, flowSession.cityId)))
          .limit(5);
        if (matches.length > 0) {
          businessId = matches[0].id;
        }
      }

      if (!businessId && createNew) {
        const slug = await generateBusinessSlug(businessName, flowSession.cityId, { cityName: "Charlotte" });
        const [newBiz] = await db.insert(businesses).values({
          cityId: flowSession.cityId,
          name: businessName,
          slug,
          ownerEmail: email || null,
          phone: phone || null,
          description: description || null,
          presenceType: "commerce",
          listingTier: "FREE",
          presenceStatus2: "DRAFT",
          activationSource: "crown_onboarding",
          categoryIds: [],
        }).returning();
        businessId = newBiz.id;
        geoTagAndClassify("business", newBiz.id, flowSession.cityId, {
          title: businessName, description: description || null,
        }).catch(err => console.error("[GeoTagger] Crown biz:", err.message));
      }

      if (businessId) {
        await db.update(crownParticipants).set({ businessId }).where(eq(crownParticipants.id, participantId));

        const [updatedParticipant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId)).limit(1);
        const hasProfile = !!updatedParticipant?.bio && updatedParticipant.bio.length > 0;
        const updatedMetadata = { ...metadata, businessLinked: true, linkedBusinessId: businessId };

        if (hasProfile) {
          await db.update(crownParticipants).set({
            status: "verified_participant",
            verifiedAt: new Date(),
          }).where(eq(crownParticipants.id, participantId));

          const [invitation] = await db.select().from(crownInvitations).where(eq(crownInvitations.participantId, participantId)).limit(1);
          if (invitation) {
            await db.update(crownInvitations).set({
              invitationStatus: "CLAIM_COMPLETED",
              claimCompletedAt: new Date(),
              acceptedAt: invitation.acceptedAt || new Date(),
            }).where(eq(crownInvitations.id, invitation.id));
          }

          await db.update(charlotteFlowSessions).set({
            businessId,
            businessName,
            status: "completed",
            generatedContent: updatedMetadata,
            updatedAt: new Date(),
          }).where(eq(charlotteFlowSessions.id, flowSessionId));

          return {
            result: {
              linked: true,
              businessId,
              businessName,
              isNew: createNew,
              flowComplete: true,
              message: "Business linked and onboarding complete — you are now a verified participant!",
            },
          };
        }

        await db.update(charlotteFlowSessions).set({
          businessId,
          businessName,
          generatedContent: updatedMetadata,
          updatedAt: new Date(),
        }).where(eq(charlotteFlowSessions.id, flowSessionId));

        return { result: { linked: true, businessId, businessName, isNew: createNew, needsProfile: true } };
      }

      return { result: { linked: false, error: "No matching business found. Try creating a new listing instead.", suggestCreate: true } };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }

  app.post("/api/charlotte-public/chat", async (req: Request, res: Response) => {
    try {
      const { message, sessionId, cityId, pageContext, locale } = req.body;

      if (!message || !sessionId || !cityId) {
        return res.status(400).json({ error: "message, sessionId, and cityId are required" });
      }

      const ctx = pageContext as PageContext | undefined;
      const isFlowMode = ctx?.flowType && ctx?.flowSessionId;

      if (message === "[GENERATE_MY_STORY]" && isFlowMode && ctx?.flowSessionId && openai) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const premiumCheck = await checkPremiumWritingAccess(ctx.flowSessionId);
        if (!premiumCheck.allowed) {
          const upgradeMsg = `Thank you so much for sharing your story! Everything you've told me has been saved and will be reviewed by our editorial team.\n\nWant Charlotte to craft a full spotlight article from your interview? That's available with a Charter or Enhanced presence upgrade. Upgrading also gets your business featured in the community feed and search results.`;
          res.write(`data: ${JSON.stringify({ content: upgradeMsg })}\n\n`);
          const doneData: any = {
            done: true,
            flowComplete: true,
            premiumRequired: true,
            premiumTier: premiumCheck.tier,
            premiumBusinessId: premiumCheck.businessId,
          };
          try {
            const [flowSess] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, ctx.flowSessionId)).limit(1);
            if (flowSess?.businessId) {
              const [biz] = await db.select().from(businesses).where(eq(businesses.id, flowSess.businessId)).limit(1);
              if (biz && (biz.listingTier === "FREE" || (biz.listingTier === "VERIFIED" && !biz.isVerified))) {
                doneData.verificationOffer = { businessId: biz.id, businessName: biz.name };
              }
            }
          } catch (e) {
            console.log("[STORY FLOW] Verification offer lookup skipped:", e);
          }
          res.write(`data: ${JSON.stringify(doneData)}\n\n`);
          await db.insert(charlottePublicMessages).values({ sessionId, role: "user", content: "Generate my story" });
          await db.insert(charlottePublicMessages).values({ sessionId, role: "assistant", content: upgradeMsg });
          res.end();
          return;
        }

        try {
          const story = await generateSpotlightArticle(ctx.flowSessionId, openai, "spotlight");
          const thankYou = `Thank you so much for sharing your story! I've put together a spotlight based on everything you told me. I hope it captures the heart of what you do for this community.`;
          res.write(`data: ${JSON.stringify({ content: thankYou })}\n\n`);

          let verificationOffer: { businessId: string; businessName: string } | undefined;
          try {
            const [flowSess] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, ctx.flowSessionId)).limit(1);
            if (flowSess?.businessId) {
              const [biz] = await db.select().from(businesses).where(eq(businesses.id, flowSess.businessId)).limit(1);
              if (biz && (biz.listingTier === "FREE" || (biz.listingTier === "VERIFIED" && !biz.isVerified))) {
                verificationOffer = { businessId: biz.id, businessName: biz.name };
              }
            }
          } catch (e) {
            console.log("[STORY FLOW] Verification offer lookup skipped:", e);
          }

          const doneData: any = {
            done: true,
            flowComplete: true,
            generatedStory: { title: story.title, content: story.content, wordCount: story.wordCount },
          };
          if (verificationOffer) doneData.verificationOffer = verificationOffer;
          res.write(`data: ${JSON.stringify(doneData)}\n\n`);

          await db.insert(charlottePublicMessages).values({ sessionId, role: "user", content: "Generate my story" });
          await db.insert(charlottePublicMessages).values({ sessionId, role: "assistant", content: thankYou });
        } catch (err: any) {
          console.error("[STORY FLOW] Force generate failed:", err.message);
          res.write(`data: ${JSON.stringify({ content: "I ran into a hiccup putting your story together. Let me try asking a couple more questions and we'll give it another go." })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        }
        return res.end();
      }

      await db.insert(charlottePublicMessages).values({
        sessionId,
        role: "user",
        content: message,
      });

      const history = await db
        .select()
        .from(charlottePublicMessages)
        .where(eq(charlottePublicMessages.sessionId, sessionId))
        .orderBy(charlottePublicMessages.createdAt)
        .limit(20);

      const [config] = await db
        .select()
        .from(charlottePublicConfig)
        .where(eq(charlottePublicConfig.cityId, cityId))
        .limit(1);

      let systemPrompt: string;
      let tools: OpenAI.ChatCompletionTool[] | undefined;

      if (isFlowMode && ctx?.flowType && ctx?.flowSessionId) {
        const [flowSession] = await db
          .select()
          .from(charlotteFlowSessions)
          .where(eq(charlotteFlowSessions.id, ctx.flowSessionId))
          .limit(1);

        const businessCategorySlugs = flowSession?.businessId ? await getCategorySlugsForBusiness(flowSession.businessId) : [];

        if (ctx.flowType === "story-interview") {
          systemPrompt = buildConversationSystemPrompt({
            businessName: flowSession?.businessName || ctx.businessName,
            cityName: ctx.cityName,
            detectedPersona: flowSession?.detectedPersona,
            completedModules: (flowSession?.modulesCompleted as string[]) || [],
            currentResponses: (flowSession?.responses as Record<string, any>) || {},
            extractedSignals: flowSession?.extractedSignals as any,
            storyDepthScore: flowSession?.storyDepthScore || 0,
            intent: ctx.intent,
          });
        } else if (ctx.flowType === "crown-onboarding" && flowSession) {
          const { crownParticipants, crownCategories } = await import("@shared/schema");
          const metadata = (flowSession.generatedContent || {}) as any;
          const participantId = metadata.crownParticipantId;
          let participantName = flowSession.businessName || "Nominee";
          let categoryName = metadata.crownCategoryName || "Unknown";
          let participantType = metadata.participantType || "business";
          let hasAccepted = false;
          let hasProfile = false;
          let hasBusinessLinked = false;
          let businessName: string | undefined;

          if (participantId) {
            const [p] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId)).limit(1);
            if (p) {
              participantName = p.name;
              hasAccepted = !["invited", "candidate"].includes(p.status);
              hasProfile = !!p.bio && p.bio.length > 0;
              hasBusinessLinked = !!p.businessId;
              participantType = p.participantType;
              if (p.businessId) {
                const [biz] = await db.select().from(businesses).where(eq(businesses.id, p.businessId)).limit(1);
                if (biz) businessName = biz.name;
              }
            }
          }

          systemPrompt = buildCrownOnboardingSystemPrompt({
            participantName,
            categoryName,
            participantType,
            cityName: ctx.cityName,
            hasAccepted,
            hasProfile,
            hasBusinessLinked,
            businessName,
          });
        } else {
          systemPrompt = buildFlowSystemPrompt(ctx.flowType, {
            businessName: ctx.businessName,
            businessCategorySlugs,
            currentResponses: (flowSession?.responses as Record<string, any>) || {},
            cityName: ctx.cityName,
            mode: ctx.mode,
          });
        }
        tools = getFlowTools(ctx.flowType);
      } else {
        const observations = await getRecentObservations();
        systemPrompt = buildSystemPrompt(config, ctx, locale, observations);
        tools = [{
          type: "function",
          function: {
            name: "report_visitor_feedback",
            description: "Report visitor feedback, bug reports, suggestions, complaints, or praise to the admin team. Call this when the visitor shares feedback about the platform.",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "A concise summary of the visitor's feedback" },
                category: { type: "string", enum: ["bug", "suggestion", "complaint", "praise"], description: "The category of feedback" },
              },
              required: ["summary", "category"],
            },
          },
        }];
      }

      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      if (!openai) {
        const fallbackGreeting = isFlowMode
          ? `Hi there! I'm Charlotte, the Neighborhood Story Editor for City Metro Hub. I'd love to hear your story and share it with the community.\n\nLet's start with something simple — what's your name?`
          : `Hi! I'm Charlotte. How can I help you today?`;

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify({ content: fallbackGreeting })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

        await db.insert(charlottePublicMessages).values({
          sessionId,
          role: "assistant",
          content: fallbackGreeting,
        });

        return res.end();
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (isFlowMode && tools && tools.length > 0) {
        let fullResponse = "";
        let suggestions: { id: string; label: string }[] | undefined;
        let flowComplete = false;
        let generatedStory: { title: string; content: string; wordCount?: number } | undefined;
        let topicProgress: any[] | undefined;
        let storyDepthScore: number | undefined;
        let completeness: any | undefined;

        let loopMessages: OpenAI.ChatCompletionMessageParam[] = [...chatMessages];
        let maxRounds = 5;

        while (maxRounds > 0) {
          maxRounds--;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: loopMessages,
            tools,
            max_tokens: 1000,
          });

          const choice = completion.choices[0];

          if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            loopMessages.push(choice.message as OpenAI.ChatCompletionMessageParam);

            for (const toolCall of choice.message.tool_calls) {
              let args: any;
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch (parseErr) {
                console.error(`[STORY FLOW] Failed to parse tool args for ${toolCall.function.name}:`, toolCall.function.arguments);
                loopMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: "Invalid tool arguments" }),
                } as OpenAI.ChatCompletionMessageParam);
                continue;
              }
              console.log(`[STORY FLOW] Tool call: ${toolCall.function.name}`, JSON.stringify(args).substring(0, 200));
              try {
                const toolResult = await executeFlowToolCall(
                  toolCall.function.name,
                  args,
                  ctx!.flowSessionId!
                );
                console.log(`[STORY FLOW] Tool result for ${toolCall.function.name}:`, JSON.stringify(toolResult.result).substring(0, 200));

                if (toolResult.suggestions) suggestions = toolResult.suggestions;
                if (toolResult.result.flowComplete) flowComplete = true;
                if (toolResult.result.generated) {
                  generatedStory = { title: toolResult.result.title, content: toolResult.result.content, wordCount: toolResult.result.wordCount };
                }
                if (toolResult.topicProgress) topicProgress = toolResult.topicProgress;
                if (toolResult.storyDepthScore !== undefined) storyDepthScore = toolResult.storyDepthScore;
                if (toolResult.completeness) completeness = toolResult.completeness;

                loopMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(toolResult.result),
                } as OpenAI.ChatCompletionMessageParam);
              } catch (err: any) {
                console.error(`[STORY FLOW] Tool call FAILED: ${toolCall.function.name}`, err.message);
                loopMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: err.message }),
                } as OpenAI.ChatCompletionMessageParam);
              }
            }

            continue;
          }

          fullResponse = choice.message.content || "";
          break;
        }

        if (!fullResponse) {
          if (isFlowMode && ctx?.flowType === "story-interview" && ctx?.flowSessionId) {
            const [freshSession] = await db
              .select()
              .from(charlotteFlowSessions)
              .where(eq(charlotteFlowSessions.id, ctx.flowSessionId))
              .limit(1);
            if (freshSession) {
              const freshPrompt = buildConversationSystemPrompt({
                businessName: freshSession.businessName || ctx.businessName,
                cityName: ctx.cityName,
                detectedPersona: freshSession.detectedPersona,
                completedModules: (freshSession.modulesCompleted as string[]) || [],
                currentResponses: (freshSession.responses as Record<string, any>) || {},
                extractedSignals: freshSession.extractedSignals as any,
                storyDepthScore: freshSession.storyDepthScore || 0,
                intent: ctx.intent,
              });
              loopMessages[0] = { role: "system", content: freshPrompt + "\n\nIMPORTANT: You just saved the user's response. Now acknowledge what they shared briefly and ask your next question. Do NOT just acknowledge — you MUST continue the conversation with a new question." };
            }
          }
          const finalCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: loopMessages,
            max_tokens: 1000,
          });
          fullResponse = finalCompletion.choices[0].message.content || "";
        }

        if (!suggestions && isFlowMode && ctx?.flowType && ctx?.flowSessionId) {
          const [latestSession] = await db
            .select()
            .from(charlotteFlowSessions)
            .where(eq(charlotteFlowSessions.id, ctx.flowSessionId))
            .limit(1);

          if (latestSession) {
            let catSlugs: string[] = [];
            if (latestSession.businessId) {
              catSlugs = await getCategorySlugsForBusiness(latestSession.businessId);
            }
            const nextQ = getNextQuestion(ctx.flowType, catSlugs, (latestSession.responses as Record<string, any>) || {});
            if (nextQ?.options) {
              suggestions = nextQ.options.map((o) => ({ id: o.id, label: o.label }));
            }
          }
        }

        res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);

        const donePayload: any = { done: true };
        if (suggestions) donePayload.suggestions = suggestions;
        if (flowComplete) donePayload.flowComplete = true;
        if (generatedStory) donePayload.generatedStory = generatedStory;
        if (topicProgress) donePayload.topicProgress = topicProgress;
        if (storyDepthScore !== undefined) donePayload.storyDepthScore = storyDepthScore;
        if (completeness) donePayload.completeness = completeness;

        if (generatedStory && isFlowMode && ctx?.flowSessionId) {
          try {
            const [flowSess] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, ctx.flowSessionId)).limit(1);
            if (flowSess?.businessId) {
              const [biz] = await db.select().from(businesses).where(eq(businesses.id, flowSess.businessId)).limit(1);
              if (biz && (biz.listingTier === "FREE" || (biz.listingTier === "VERIFIED" && !biz.isVerified))) {
                donePayload.verificationOffer = { businessId: biz.id, businessName: biz.name };
              }
            }
          } catch (e) {
            console.log("[STORY FLOW] Verification offer lookup skipped:", e);
          }
        }

        res.write(`data: ${JSON.stringify(donePayload)}\n\n`);

        await db.insert(charlottePublicMessages).values({
          sessionId,
          role: "assistant",
          content: fullResponse,
        });

        res.end();
      } else {
        let loopMessages: OpenAI.ChatCompletionMessageParam[] = [...chatMessages];
        let feedbackHandled = false;
        let maxToolRounds = 3;

        while (maxToolRounds > 0) {
          maxToolRounds--;
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: loopMessages,
            tools,
            max_tokens: 500,
          });

          const choice = completion.choices[0];

          if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            loopMessages.push(choice.message as OpenAI.ChatCompletionMessageParam);

            for (const toolCall of choice.message.tool_calls) {
              if (toolCall.function.name === "report_visitor_feedback") {
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  const pageCtxStr = ctx?.page ? `Page: ${ctx.page}${ctx.step ? ` (step: ${ctx.step})` : ""}` : undefined;
                  console.log(`[CHARLOTTE] Visitor feedback tool called — category: ${args.category}, summary: ${(args.summary || "").substring(0, 100)}, session: ${sessionId}`);
                  const inboxItem = await onVisitorFeedback({
                    sessionId,
                    summary: args.summary || "No summary provided",
                    category: ["bug", "suggestion", "complaint", "praise"].includes(args.category) ? args.category : "suggestion",
                    pageContext: pageCtxStr,
                  });
                  console.log(`[CHARLOTTE] Feedback saved to inbox — item ID: ${inboxItem?.id}, status: ${inboxItem?.status}`);
                  feedbackHandled = true;
                  loopMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ success: true, message: "Feedback has been recorded and sent to the team." }),
                  } as OpenAI.ChatCompletionMessageParam);
                } catch (err: any) {
                  console.error("[CHARLOTTE] Feedback tool error:", err.message, err.stack);
                  loopMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ success: false, error: "Failed to record feedback" }),
                  } as OpenAI.ChatCompletionMessageParam);
                }
              } else {
                loopMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: "Unknown tool" }),
                } as OpenAI.ChatCompletionMessageParam);
              }
            }
            continue;
          }

          const fullResponse = choice.message.content || "";
          res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);

          await db.insert(charlottePublicMessages).values({
            sessionId,
            role: "assistant",
            content: fullResponse,
          });

          const donePayload: any = { done: true };
          if (feedbackHandled) donePayload.feedbackRecorded = true;
          res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
          res.end();
          break;
        }

        if (maxToolRounds <= 0) {
          res.write(`data: ${JSON.stringify({ content: "I'm here to help! What can I do for you?" })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        }
      }
    } catch (error: any) {
      console.error("Error in charlotte public chat:", error?.message || error);
      const isQuotaError = error?.code === "insufficient_quota" || error?.status === 429;
      const userMessage = req.body.message || "";
      const sessionId = req.body.sessionId || "unknown";

      const feedbackKeywords = /bug|broken|error|issue|problem|wrong|not work|doesn't work|can't|won't load|missing|fix|crash|glitch|complaint|frustrated|annoyed|terrible|horrible|awful|suggestion|feature|request|improve|feedback/i;
      if (feedbackKeywords.test(userMessage)) {
        try {
          const pageCtxStr = (req.body.pageContext as PageContext | undefined)?.page || undefined;
          console.log(`[CHARLOTTE] AI unavailable — saving user message as direct feedback: ${userMessage.substring(0, 100)}`);
          await onVisitorFeedback({
            sessionId,
            summary: userMessage.substring(0, 500),
            category: /bug|broken|error|crash|glitch|not work|doesn't work|won't load/i.test(userMessage) ? "bug" : "suggestion",
            pageContext: pageCtxStr ? `Page: ${pageCtxStr}` : undefined,
          });
        } catch (fbErr: unknown) {
          console.error("[CHARLOTTE] Failed to save fallback feedback:", fbErr instanceof Error ? fbErr.message : fbErr);
        }
      }

      if (res.headersSent) {
        if (isQuotaError) {
          const fallback = feedbackKeywords.test(userMessage)
            ? "Thank you for letting me know about that! I've passed your feedback along to the team. I'm experiencing a brief technical hiccup right now, but your message has been recorded and someone will look into it."
            : "I appreciate your patience — I'm experiencing a brief technical hiccup. Could you try again in a moment? I'd really love to hear your story.";
          res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true, feedbackRecorded: feedbackKeywords.test(userMessage) })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ error: "Something went wrong. Please try again." })}\n\n`);
        }
        res.end();
      } else {
        const ctx = (req.body.pageContext as PageContext | undefined);
        const isFlowMode = ctx?.flowType && ctx?.flowSessionId;

        if (isQuotaError) {
          const fallbackGreeting = isFlowMode
            ? `Hi there! I'm Charlotte, the Neighborhood Story Editor for City Metro Hub. I'd love to hear your story and share it with the community.\n\nLet's start with something simple — what's your name?`
            : feedbackKeywords.test(userMessage)
              ? `Thank you for letting me know! I've recorded your feedback and passed it along to the team. They'll look into it. Is there anything else I can help with?`
              : `Hi! I'm Charlotte. How can I help you today?`;

          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.write(`data: ${JSON.stringify({ content: fallbackGreeting })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true, feedbackRecorded: feedbackKeywords.test(userMessage) })}\n\n`);

          try {
            await db.insert(charlottePublicMessages).values({
              sessionId: req.body.sessionId,
              role: "assistant",
              content: fallbackGreeting,
            });
          } catch {}

          res.end();
        } else {
          res.status(500).json({ error: "Failed to process message" });
        }
      }
    }
  });

  app.get("/api/charlotte-public/history/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const messages = await db
        .select()
        .from(charlottePublicMessages)
        .where(eq(charlottePublicMessages.sessionId, sessionId as string))
        .orderBy(charlottePublicMessages.createdAt)
        .limit(50);

      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/charlotte-public/flow/photos", async (req: Request, res: Response) => {
    try {
      const { sessionId, photoUrls } = req.body;
      if (!sessionId || !Array.isArray(photoUrls)) {
        return res.status(400).json({ error: "sessionId and photoUrls array required" });
      }

      const [session] = await db
        .select()
        .from(charlotteFlowSessions)
        .where(eq(charlotteFlowSessions.id, sessionId))
        .limit(1);

      if (!session) return res.status(404).json({ error: "Session not found" });

      const responses = (session.responses as Record<string, any>) || {};
      const existing = responses.photo_uploads || [];
      responses.photo_uploads = [...existing, ...photoUrls];

      await db
        .update(charlotteFlowSessions)
        .set({ responses })
        .where(eq(charlotteFlowSessions.id, sessionId));

      res.json({ success: true, totalPhotos: responses.photo_uploads.length });
    } catch (error) {
      console.error("Error saving flow photos:", error);
      res.status(500).json({ error: "Failed to save photos" });
    }
  });

  app.post("/api/charlotte-public/flow/upload-files", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId || null;
      if (!userId) {
        return res.status(401).json({ error: "auth_required" });
      }

      const { sessionId, files } = req.body;
      if (!sessionId || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "sessionId and files array required" });
      }

      const [session] = await db
        .select()
        .from(charlotteFlowSessions)
        .where(eq(charlotteFlowSessions.id, sessionId))
        .limit(1);

      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.userId !== userId) return res.status(403).json({ error: "Not your session" });

      const existingFiles = (session.uploadedFiles as any[]) || [];

      const MAX_PDFS = 1;
      const MAX_IMAGES = 5;
      const existingPdfs = existingFiles.filter((f: any) => f.type === "pdf").length;
      const existingImages = existingFiles.filter((f: any) => f.type === "image").length;

      const validTypes = ["pdf", "image"];
      const newFiles: any[] = [];
      let pdfCount = existingPdfs;
      let imageCount = existingImages;

      for (const f of files) {
        if (!f.url || !f.filename || !f.type || !validTypes.includes(f.type)) continue;
        if (f.type === "pdf" && pdfCount >= MAX_PDFS) continue;
        if (f.type === "image" && imageCount >= MAX_IMAGES) continue;
        if (f.type === "pdf") pdfCount++;
        if (f.type === "image") imageCount++;
        newFiles.push({
          url: f.url,
          filename: f.filename,
          mimetype: f.mimetype || "",
          type: f.type as "pdf" | "image",
          uploadedAt: new Date().toISOString(),
        });
      }

      const allFiles = [...existingFiles, ...newFiles];

      await db
        .update(charlotteFlowSessions)
        .set({ uploadedFiles: allFiles, updatedAt: new Date() })
        .where(eq(charlotteFlowSessions.id, sessionId));

      res.json({ success: true, totalFiles: allFiles.length });
    } catch (error) {
      console.error("Error saving flow uploaded files:", error);
      res.status(500).json({ error: "Failed to save uploaded files" });
    }
  });

  app.post("/api/charlotte-public/flow/form-submit", async (req: Request, res: Response) => {
    try {
      const { cityId, contactInfo, storyType, businessInfo, eventInfo, individualInfo, storyResponses, photoUrls } = req.body;

      if (!cityId || !contactInfo?.name || !contactInfo?.phone || !contactInfo?.email) {
        return res.status(400).json({ error: "cityId and contact info (name, phone, email) are required" });
      }

      if (!storyType) {
        return res.status(400).json({ error: "storyType is required" });
      }

      const personaMap: Record<string, string> = {
        "business": "business_owner",
        "nonprofit": "nonprofit_leader",
        "church": "faith_leader",
        "school": "educator",
        "event": "event_host",
        "individual": "long_time_resident",
      };

      const detectedPersona = personaMap[storyType] || "community_member";

      const responses: Record<string, any> = {};

      responses.contact_info = {
        answer: {
          name: contactInfo.name,
          role: contactInfo.role || "",
          phone: contactInfo.phone,
          email: contactInfo.email,
          callbackRequested: !!contactInfo.callbackRequested,
        },
        answeredAt: new Date().toISOString(),
      };

      responses.story_type = {
        answer: storyType,
        answeredAt: new Date().toISOString(),
      };

      if (businessInfo && ["business", "nonprofit", "church", "school"].includes(storyType)) {
        responses.business_info = {
          answer: {
            name: businessInfo.name || "",
            address: businessInfo.address || "",
            city: businessInfo.city || "",
            state: businessInfo.state || "",
            zip: businessInfo.zip || "",
            phone: businessInfo.phone || "",
            website: businessInfo.website || "",
            socialMedia: businessInfo.socialMedia || "",
            description: businessInfo.description || "",
          },
          answeredAt: new Date().toISOString(),
        };
      }

      if (eventInfo && storyType === "event") {
        responses.event_info = {
          answer: {
            name: eventInfo.name || "",
            venue: eventInfo.venue || "",
            address: eventInfo.address || "",
            city: eventInfo.city || "",
            state: eventInfo.state || "",
            zip: eventInfo.zip || "",
            dates: eventInfo.dates || "",
            time: eventInfo.time || "",
            website: eventInfo.website || "",
            phone: eventInfo.phone || "",
            description: eventInfo.description || "",
          },
          answeredAt: new Date().toISOString(),
        };
      }

      if (individualInfo && storyType === "individual") {
        responses.individual_info = {
          answer: {
            neighborhood: individualInfo.neighborhood || "",
            yearsHere: individualInfo.yearsHere || "",
            description: individualInfo.description || "",
          },
          answeredAt: new Date().toISOString(),
        };
      }

      const validModuleIds = new Set([
        "origin_story", "personal_story", "primary_business", "neighborhood",
        "community_impact", "vision_passion", "events_gatherings",
        "local_recommendations", "community_connectors", "local_pride",
      ]);

      if (storyResponses && typeof storyResponses === "object") {
        for (const [moduleId, answer] of Object.entries(storyResponses)) {
          if (validModuleIds.has(moduleId) && answer && typeof answer === "string" && answer.trim()) {
            responses[moduleId] = {
              answer: answer.trim(),
              answeredAt: new Date().toISOString(),
            };
          }
        }
      }

      if (photoUrls && Array.isArray(photoUrls) && photoUrls.length > 0) {
        responses.photo_uploads = {
          answer: photoUrls,
          answeredAt: new Date().toISOString(),
        };
      }

      const status = contactInfo.callbackRequested ? "callback_requested" : "completed";

      const businessName = businessInfo?.name || eventInfo?.name || contactInfo.name;

      const [session] = await db
        .insert(charlotteFlowSessions)
        .values({
          flowType: "story-interview",
          cityId,
          contactEmail: contactInfo.email,
          contactName: contactInfo.name,
          businessName: businessName,
          status,
          detectedPersona,
          responses,
        })
        .returning();

      res.json({ success: true, sessionId: session.id });
    } catch (error) {
      console.error("Error submitting story form:", error);
      res.status(500).json({ error: "Failed to submit story form" });
    }
  });
}
