import { buildCharlotteStoryEditorIntro, buildCharlotteStoryEditorForCity, buildCrownOnboardingIntro } from "./ai/prompts/story-flows";
import { db } from "./db";
import { charlotteFlowSessions, businesses, categories, zones, cities, CHARLOTTE_FLOWS, OPPORTUNITY_PROFILE_QUESTIONS, STORY_INTERVIEW_QUESTIONS, CONVERSATION_MODULES, EXTRACTION_CATEGORIES } from "@shared/schema";
import type { ProfileQuestion, CharlotteFlowConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { computeOpportunityScores, getBestEntryPoint } from "./opportunity-scoring";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { storage } from "./storage";
import { selectNextModule, getPromptOptionsForModule, detectPersonaFromResponses, getCompletedModuleSummary, getPersonaById } from "./charlotte-conversation-modules";
import { computeStoryDepthScore, getConversationCompleteness, getTopicProgressLabels } from "./story-depth-scoring";
import { updateStoryTrustFields } from "./trust-service";
import { STORY_EDITOR_IDENTITY, CONVERSATION_BEHAVIOR_RULES } from "./ai/prompts/story-flows";
import { queueTranslation } from "./services/auto-translate";
import { applyFullTagStack } from "./services/content-tagger";

type ProfileResponses = Record<string, { answer: string | string[]; answeredAt: string }>;

async function checkAutoPublishSafe(openaiClient: any, title: string, content: string): Promise<boolean> {
  try {
    const modResult = await openaiClient.moderations.create({
      input: `${title}\n\n${content}`,
    });
    const flagged = modResult.results?.[0]?.flagged === true;
    if (flagged) {
      const categories = modResult.results[0].categories;
      const flaggedCats = Object.entries(categories)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      console.log(`[AutoPublish] Content flagged by moderation: ${flaggedCats.join(", ")}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[AutoPublish] Moderation check failed, defaulting to draft:", err.message);
    return false;
  }
}

export function getFlowConfig(flowType: string): CharlotteFlowConfig | null {
  return CHARLOTTE_FLOWS[flowType] || null;
}

export function getApplicableQuestions(
  flowType: string,
  businessCategorySlugs: string[] = []
): ProfileQuestion[] {
  const flow = getFlowConfig(flowType);
  if (!flow) return [];

  return flow.questions.filter((q) => {
    if (q.appliesTo === "all") return true;
    return q.appliesTo.some((slug) => businessCategorySlugs.includes(slug));
  });
}

export function getNextQuestion(
  flowType: string,
  businessCategorySlugs: string[],
  existingResponses: ProfileResponses
): ProfileQuestion | null {
  const applicable = getApplicableQuestions(flowType, businessCategorySlugs);
  for (const q of applicable) {
    if (!existingResponses[q.id]) {
      return q;
    }
  }
  return null;
}

export function getFlowProgress(
  flowType: string,
  businessCategorySlugs: string[],
  existingResponses: ProfileResponses
): { answered: number; total: number; complete: boolean } {
  const applicable = getApplicableQuestions(flowType, businessCategorySlugs);
  const answered = applicable.filter((q) => existingResponses[q.id]).length;
  return { answered, total: applicable.length, complete: answered >= applicable.length };
}

export function buildFlowSystemPrompt(
  flowType: string,
  context: {
    businessName?: string;
    businessCategorySlugs?: string[];
    currentResponses?: ProfileResponses;
    cityName?: string;
    mode?: string;
  }
): string {
  const flow = getFlowConfig(flowType);
  if (!flow) return "";

  const categorySlugs = context.businessCategorySlugs || [];
  const responses = context.currentResponses || {};
  const nextQ = getNextQuestion(flowType, categorySlugs, responses);
  const progress = getFlowProgress(flowType, categorySlugs, responses);
  const businessName = context.businessName || "your business";

  const mode = context.mode || "standard";

  let prompt = "";

  prompt += buildCharlotteStoryEditorIntro(flowType);

  if (flowType === "opportunity-profile") {
    prompt += `## Your Current Task
You are conducting an Opportunity Profile interview with the owner of "${businessName}". Your goal is to ask questions one at a time, naturally and conversationally, to learn about their business and identify how CLT Metro Hub can help them.

## Rules
- Ask ONE question at a time — never bundle multiple questions
- Be warm, natural, and conversational — not robotic or survey-like
- After the user answers, acknowledge their answer briefly, then ask the next question
- Use the save_profile_answer tool to save each answer IMMEDIATELY when the user responds
- Replace {businessName} in your prompts with "${businessName}"
- Keep responses short (1-2 sentences of acknowledgment + the next question)
- If the user gives an answer that doesn't match the options, interpret their intent and pick the closest option
- For multi-select questions, let them pick multiple and save as an array
- When all questions are done, congratulate them and let them know you've built their opportunity profile\n`;
  } else if (flowType === "story-interview") {
    prompt += `## Your Current Task
You are conducting a story interview with a local business owner or community voice for CLT Metro Hub${context.cityName ? ` in ${context.cityName}` : ""}. Your role is to gather their story through a short, warm conversation so it can be shaped into a community spotlight.

## Your Voice
Your voice is warm, polished, human, community-centered, and lightly formal. You are a Neighborhood Story Editor — not a chatbot, not a survey, not a tech product.

## Rules
- Ask ONE question at a time — be genuinely curious and present
- Use the save_story_answer tool to save each answer IMMEDIATELY
- For intro questions (name, business name, business type, email), be brief and natural — get these basics quickly before diving into the story
- For story questions, use warm editorial phrasing — draw out details with genuine interest
- Replace {businessName} with their actual business name once you learn it
- When all questions have been answered, use the generate_story tool to create their spotlight
- After generating, show them a preview and thank them warmly
- Never say "I am an AI", "I can help generate", "Let's proceed", "Based on your response", "Thank you for that information"
- Use natural editorial phrasing like "I'd love to learn a little about your story", "Thanks for sharing that", "That helps paint a picture."
- Use acknowledgments from this bank between questions: "Thanks for sharing that.", "That's helpful to know.", "That gives a clearer picture.", "That's good to hear.", "That really helps tell the story."
${mode === "recognition" ? `\n## Mode: Recognition First\nThis person was identified through outreach — we came across their business and reached out to feature them. Open with warmth and let them know we'd love to spotlight their story. Frame it as: "We recently came across your business and would love to learn more about what you bring to the community."\n` : `\n## Mode: Standard\nThis person came to us organically to share their story. Welcome them warmly and let them know this is a short conversation to help create a community spotlight.\n`}\n`;
  }

  if (progress.complete) {
    if (flowType === "opportunity-profile") {
      prompt += `\n## Status: ALL QUESTIONS COMPLETE
All ${progress.total} questions have been answered. Thank the owner warmly and let them know their opportunity profile has been built. Tell them CLT Metro Hub will use this to recommend the best ways to grow their visibility.`;
    } else {
      prompt += `\n## Status: INTERVIEW COMPLETE
All questions have been answered. If you haven't generated the story yet, use the generate_story tool now.`;
    }
  } else if (nextQ) {
    const promptText = nextQ.charlottePrompt.replace(/\{businessName\}/g, businessName);
    prompt += `\n## Current Question (${progress.answered + 1} of ${progress.total})
Question ID: "${nextQ.id}"
How to ask it: "${promptText}"
Type: ${nextQ.type}`;
    if (nextQ.options) {
      prompt += `\nOptions: ${nextQ.options.map((o) => `"${o.id}" (${o.label})`).join(", ")}`;
    }
    prompt += `\n\nAsk this question conversationally. After the user answers, call the save tool with questionId="${nextQ.id}" and their answer.`;

    if (progress.answered === 0) {
      prompt += `\n\nThis is the FIRST question — greet them warmly first, then ask it.`;
    }
  }

  prompt += `\n\n## Answered So Far (${progress.answered}/${progress.total})`;
  for (const [qId, resp] of Object.entries(responses)) {
    prompt += `\n- ${qId}: ${JSON.stringify(resp.answer)}`;
  }

  return prompt;
}

export async function handleFlowAnswer(
  sessionId: string,
  questionId: string,
  answer: string | string[]
): Promise<{ saved: boolean; nextQuestion: ProfileQuestion | null; progress: { answered: number; total: number; complete: boolean } }> {
  const [session] = await db
    .select()
    .from(charlotteFlowSessions)
    .where(eq(charlotteFlowSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Flow session ${sessionId} not found`);
  }

  const flow = getFlowConfig(session.flowType);
  const questionDef = flow?.questions.find(q => q.id === questionId);

  let normalizedAnswer = answer;
  if (questionDef?.type === "multi" && typeof answer === "string") {
    normalizedAnswer = [answer];
  }

  const responses: ProfileResponses = (session.responses as ProfileResponses) || {};
  responses[questionId] = {
    answer: normalizedAnswer,
    answeredAt: new Date().toISOString(),
  };

  await db
    .update(charlotteFlowSessions)
    .set({ responses, updatedAt: new Date() })
    .where(eq(charlotteFlowSessions.id, sessionId));

  let businessCategorySlugs: string[] = [];
  if (session.businessId) {
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, session.businessId))
      .limit(1);
    if (biz) {
      if (biz.categoryIds && biz.categoryIds.length > 0) {
        const allCats = await db.select().from(categories);
        businessCategorySlugs = allCats
          .filter((c: any) => biz.categoryIds?.includes(c.id))
          .map((c: any) => c.slug);
      }

      if (session.flowType === "opportunity-profile") {
        await db
          .update(businesses)
          .set({
            opportunityProfile: responses,
            opportunityScores: computeOpportunityScores(biz, responses),
            updatedAt: new Date(),
          })
          .where(eq(businesses.id, session.businessId));
      }

      if (questionId === "screen_provider" && typeof answer === "string") {
        const updateFields: any = { venueScreenProvider: answer, updatedAt: new Date() };
        await db.update(businesses).set(updateFields).where(eq(businesses.id, session.businessId));
      }

      if (questionId === "business_inspiration" && typeof answer === "string") {
        await db.update(businesses).set({ businessInspiration: answer, updatedAt: new Date() }).where(eq(businesses.id, session.businessId));
      }
    }
  }

  const nextQuestion = getNextQuestion(session.flowType, businessCategorySlugs, responses);
  const progress = getFlowProgress(session.flowType, businessCategorySlugs, responses);

  if (progress.complete) {
    await db
      .update(charlotteFlowSessions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(charlotteFlowSessions.id, sessionId));
  }

  return { saved: true, nextQuestion, progress };
}

export async function generateStoryArticle(
  sessionId: string,
  openai: any
): Promise<{ title: string; content: string; articleId?: string }> {
  const [session] = await db
    .select()
    .from(charlotteFlowSessions)
    .where(eq(charlotteFlowSessions.id, sessionId))
    .limit(1);

  if (!session) throw new Error("Session not found");

  const responses = session.responses as ProfileResponses;
  const ownerName = (responses.owner_name?.answer as string) || "A local business owner";
  const businessName = (responses.business_name?.answer as string) || session.businessName || "a local business";
  const businessType = (responses.business_type?.answer as string) || "";
  const originStory = (responses.origin_story?.answer as string) || "";
  const whatSpecial = (responses.what_special?.answer as string) || "";
  const favoriteMoment = (responses.favorite_moment?.answer as string) || "";
  const neighborhoodLove = (responses.neighborhood_love?.answer as string) || "";
  const messageToCommunity = (responses.message_to_community?.answer as string) || "";

  const storyPrompt = `Write a warm, engaging community story (200-300 words) about ${businessName} for CLT Metro Hub's Pulse feed. Write in Charlotte's voice — friendly, genuine, celebrating local businesses.

Owner: ${ownerName}
Business: ${businessName}
Type: ${businessType}
Their origin story: ${originStory}
What makes them special: ${whatSpecial}
Favorite customer moment: ${favoriteMoment}
What they love about the neighborhood: ${neighborhoodLove}
Message to the community: ${messageToCommunity}

Write a compelling title and story. The story should feel like a neighbor introducing you to a great local spot. Don't use bullet points — write flowing prose. Include a brief headline/title at the top (separate from the body).

Format your response as JSON: { "title": "...", "content": "..." }`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: storyPrompt }],
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(completion.choices[0].message.content || '{}');
  const title = result.title || `Meet ${ownerName} of ${businessName}`;
  const content = result.content || "";

  const slug = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-story-${Date.now()}`;

  const autoPublish = await checkAutoPublishSafe(openai, title, content);

  try {
    const article = await storage.createArticle({
      cityId: session.cityId,
      title,
      slug,
      excerpt: content.substring(0, 200) + "...",
      content,
      authorId: null,
      publishedAt: autoPublish ? new Date() : null,
    });

    queueTranslation("article", article.id);

    try {
      let bizCatIds: string[] = [];
      if (session.businessId) {
        const [biz] = await db.select({ categoryIds: businesses.categoryIds }).from(businesses).where(eq(businesses.id, session.businessId)).limit(1);
        if (biz?.categoryIds) bizCatIds = biz.categoryIds;
      }
      await applyFullTagStack("article", article.id, {
        cityId: session.cityId,
        categoryIds: bizCatIds.length > 0 ? bizCatIds : undefined,
        title,
      });
    } catch (tagErr) {
      console.error(`[Charlotte] Tag stack failed for article ${article.id}:`, tagErr instanceof Error ? tagErr.message : tagErr);
    }

    if (autoPublish) {
      console.log(`[AutoPublish] Story auto-published: "${title}" (${article.id})`);
    } else {
      console.log(`[AutoPublish] Story flagged for review: "${title}" (${article.id})`);
    }

    await db
      .update(charlotteFlowSessions)
      .set({
        generatedContent: { title, content, articleId: article.id },
        businessName: businessName,
        contactName: ownerName,
        contactEmail: (responses.contact_email?.answer as string) || null,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(charlotteFlowSessions.id, sessionId));

    return { title, content, articleId: article.id };
  } catch (err) {
    console.error("[CHARLOTTE FLOWS] Failed to create article:", err);

    await db
      .update(charlotteFlowSessions)
      .set({
        generatedContent: { title, content },
        businessName: businessName,
        contactName: ownerName,
        contactEmail: (responses.contact_email?.answer as string) || null,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(charlotteFlowSessions.id, sessionId));

    return { title, content };
  }
}

export function buildConversationSystemPrompt(context: {
  businessName?: string;
  cityName?: string;
  neighborhoodName?: string;
  detectedPersona?: string | null;
  completedModules?: string[];
  currentResponses?: ProfileResponses;
  extractedSignals?: Record<string, { signals: any[] }> | null;
  storyDepthScore?: number;
  intent?: string;
}): string {
  const {
    businessName,
    cityName,
    neighborhoodName,
    detectedPersona,
    completedModules = [],
    currentResponses = {},
    extractedSignals,
    storyDepthScore,
    intent,
  } = context;

  const personaLabel = detectedPersona
    ? getPersonaById(detectedPersona)?.label || detectedPersona
    : null;

  const nextModule = selectNextModule(detectedPersona || null, completedModules, currentResponses);
  const completeness = getConversationCompleteness(completedModules, currentResponses, extractedSignals);
  const topicProgress = getTopicProgressLabels(completedModules);
  const completedNames = getCompletedModuleSummary(completedModules);

  const nameRef = businessName || "their business";
  const promptOptions = nextModule
    ? getPromptOptionsForModule(nextModule.id, { businessName: nameRef, neighborhoodName, cityName })
    : [];

  let prompt = buildCharlotteStoryEditorForCity(cityName);

  prompt += `${STORY_EDITOR_IDENTITY}\n\n`;

  prompt += `${CONVERSATION_BEHAVIOR_RULES}\n\n`;

  if (personaLabel) {
    prompt += `## Detected Persona: ${personaLabel}
Tailor your follow-up topics and phrasing to their context as a ${personaLabel.toLowerCase()}.\n\n`;
  }

  prompt += `## Conversation Progress
Topics covered: ${completedModules.length > 0 ? completedNames.join(", ") : "None yet"}
Story depth score: ${storyDepthScore ?? 0}/100
Status: ${completeness.suggestion}\n`;

  const coveredLabels = topicProgress.filter(t => t.completed).map(t => t.label);
  const uncoveredLabels = topicProgress.filter(t => !t.completed).map(t => t.label);
  if (coveredLabels.length > 0) prompt += `Covered topic groups: ${coveredLabels.join(", ")}\n`;
  if (uncoveredLabels.length > 0) prompt += `Uncovered topic groups: ${uncoveredLabels.join(", ")}\n`;

  if (completeness.ready) {
    prompt += `\n## READY TO GENERATE ARTICLE
You have enough material for a spotlight article. You can either:
- Continue exploring more topics to enrich the story
- Offer to generate their spotlight article using the generate_spotlight_article tool
Let the conversation flow naturally — when there's a natural pause or they seem to wrap up, offer to write their story.

IMPORTANT: AI-generated spotlight articles are a premium feature. If the generate_spotlight_article tool returns premiumRequired: true, it means the user needs a Charter or Enhanced presence upgrade to get Charlotte AI writing. In that case:
- Thank them warmly for sharing their story
- Let them know everything they shared has been saved and will be reviewed by the editorial team
- Mention that Charlotte AI writing is available with a presence upgrade
- Say something like: "Want me to write your spotlight article? That's part of our Charter presence — it also gets your business featured in the community feed."
- NEVER make them feel like their submission was wasted — their content is saved and will be reviewed

After generating their story, if they shared about their business, mention: "I found your listing! To verify it, we just ask for a $1 donation to our community fund — it goes right back into supporting local hubs and neighborhoods." NEVER say "payment", "fee", "charge", or "cost" — always frame it as a "donation to our community fund." Say "I found your listing" — never "register", "sign up", or "create."\n\n`;
  }

  const hasPhotos = currentResponses && (currentResponses as any).photo_uploads?.length > 0;
  if (completedModules.length >= 3 && !hasPhotos) {
    prompt += `\n## PHOTO OPPORTUNITY
The basics are covered and the story is developing. At a natural moment, invite them to share photos using the photo button in the chat. Keep it casual and optional — something like:
- "If you have any photos you'd like to share — your logo, a picture of your space, your team — there's a photo button right next to the text input. Totally optional, but photos really bring a story to life."
- "Feel free to add any images that help tell your story — you can tap the photo icon anytime."
Only mention photos ONCE during the conversation. Do not repeatedly ask.\n\n`;
  }

  if (completedModules.length > 0) {
    prompt += `\n## DO NOT REVISIT THESE TOPICS (already covered)
${completedNames.map(n => `- ${n}`).join("\n")}
These topics have been discussed. Do NOT ask about them again in any form.\n\n`;
  }

  if (nextModule) {
    prompt += `\n## Next Suggested Topic: ${nextModule.name}
Target: ${nextModule.targetDescription}
Priority: ${nextModule.priority}

Suggested ways to approach this (pick one or rephrase naturally — do NOT use these word-for-word every time):
${promptOptions.map((p, i) => `${i + 1}. "${p}"`).join("\n")}

Module ID for save_conversation_data: "${nextModule.id}"
After they respond, call save_conversation_data with moduleId="${nextModule.id}", their responseText, and any signals you extracted.\n\n`;

    prompt += `## Extraction Targets for This Module
This module feeds: ${nextModule.extractionCategories.join(", ")}
Look for any of these signals in their response and include them in extractedSignals when calling save_conversation_data.\n\n`;
  }

  if (completedModules.length === 0) {
    prompt += `## FIRST INTERACTION
This is the very beginning of the interview. Start with a warm, personal greeting. Introduce yourself as Charlotte, the Neighborhood Story Editor, and explain you're gathering stories about the people and businesses that make this community special.

Get the basics first before diving into the story:
1. Ask their first AND last name (if they only give a first name, warmly ask "And your last name? I want to make sure we feature you properly.")
2. Ask the name of their business or organization
3. Ask what kind of business it is
4. Ask for a good email to reach them (so you can let them know when their spotlight is ready)

After these basics, naturally collect their business details before moving to story questions:
5. Ask for their website or social media ("Do you have a website or social media where people can find you?")
6. Ask for their location/address ("Where are you located?")
7. Ask for their phone number ("What's the best number to reach you at?")
8. Ask their role/title ("And what's your role or title?")

You can weave these in naturally — you don't need to ask them all in a row. If they volunteer info (like mentioning their website), just save it and skip that question.

After collecting the basics and details, transition into the deeper story questions with something like "Now that I know a bit about you, I'd love to learn more about your story..."

We know people are busy, so frame this as: we created this experience to make it easy to share your story. Charlotte will shape it into a community spotlight from their answers.

Never use AI language. You are an editorial voice, not a chatbot.\n\n`;
  }

  if (intent && intent !== "story") {
    if (intent === "event") {
      prompt += `## INTENT: EVENT SUBMISSION
The person is here to submit a community event. After getting their name and contact info, focus on gathering event details:
1. Event name
2. Venue / location name
3. Full address (street, city, state, ZIP)
4. Date(s) and time(s)
5. A description of what people can expect
6. Website or link for tickets/more info
7. Contact phone number
8. Any cost or ticket price

Use moduleId "event_submission" when saving event details via save_conversation_data.
Keep it conversational — "That sounds like a great event! Where is it being held?" — but make sure you collect all the key details.
When you have enough event info, offer to submit it and use generate_spotlight_article with articleStyle="brief" to create the event listing.\n\n`;
    } else if (intent === "shout-out") {
      prompt += `## INTENT: HUB SHOUT-OUT
The person is here to give a shout-out to someone who deserves recognition. After getting the submitter's name and contact info, focus on:
1. Who they want to recognize (person or business name)
2. What they do / what the business or org is
3. Why they deserve recognition
4. How the submitter knows them
5. Any website or social media for the person/business being recognized

Use moduleId "shout_out" when saving via save_conversation_data.
Keep it warm — "That's so great that you want to recognize them! Tell me more about what makes them special."
When you have enough info, thank them warmly and use generate_spotlight_article with articleStyle="brief" to create the shout-out.\n\n`;
    } else if (intent === "nominate") {
      prompt += `## INTENT: STORY NOMINATION
The person is here to nominate someone else whose story should be told. After getting the nominator's name and contact info, focus on:
1. Who should be featured (full name)
2. Their business or organization name
3. What makes their story worth telling
4. How to reach the nominee (phone, email, or social)
5. The nominator's relationship to them

Use moduleId "story_nomination" when saving via save_conversation_data.
Keep it warm — "It's wonderful that you want to share their story! What is it about them that you think people should hear?"
When you have enough info, thank the nominator and let them know you'll reach out to the nominee to schedule their story interview.\n\n`;
    } else if (intent === "activate") {
      prompt += `## INTENT: ACTIVATE PRESENCE
The person is here to activate their business or organization on the Metro Hub. This is a multi-phase conversation.

### CRITICAL FRAMING RULES
- NEVER say "create," "register," "sign up," or "add" a listing. ALWAYS frame it as "found," "pulled up," "connected you to," or "confirmed."
- The platform already knows about every local business. You are helping them CLAIM and ACTIVATE their existing spot.
- Example phrases: "I found your listing," "Let me pull up your presence," "We already have you in our directory," "I just need to confirm some details."
- Even if the system creates a brand new record behind the scenes, you ALWAYS say "I found your listing for [Name]."

### Phase 1 — Basics
Collect conversationally (weave these in naturally):
1. Their first and last name
2. Their role or title (owner, manager, director, etc.)
3. Business or organization name
4. What they do — a brief description of their business/org
5. Whether this is a commerce business or a nonprofit/community organization

### Phase 2 — Details
After basics, gather:
1. Category — suggest one based on their description ("Sounds like you might be in [category] — does that fit?")
2. Neighborhood name or ZIP code
3. Phone number
4. Email address
5. Website URL (optional — "Do you have a website people can visit?")

### Phase 3 — Lookup & Claim
Once you have enough info, call the \`activate_presence\` tool with all gathered details.
After the tool responds, ALWAYS say something like:
"I found your listing for [Business Name] in [neighborhood]! Let me just confirm a few details with you..."
Then confirm key details: name spelling, phone, email, category.

### Phase 4 — Verify
After confirmation, send a verification code:
"To connect you to your listing, I just need to verify your identity. Would you prefer a code sent to your email or phone?"
Call \`send_verification_code\` with their preferred method and the businessId.
Then ask them to type the code: "Go ahead and type the verification code when you get it."
When they provide the code, call \`verify_code\` to validate it.
If verification fails, offer to resend: "That code didn't match. Want me to send a new one?"

### Phase 5 — $1 Verification Payment
After the code is verified, the result will include a \`paymentUrl\`. You MUST direct the user to complete the $1 verification payment to activate their listing:
"Your code has been verified! There's just one more quick step — a $1 verification payment to activate your listing. Click here to complete it: [paymentUrl from the result]"
Do NOT tell them their listing is active yet — it is NOT active until the $1 payment is completed. The \`paymentUrl\` will take them to the checkout page.

### Phase 6 — Opportunity Profiling
After directing them to payment, transition warmly:
"Once your payment is processed, your presence will be live on the Hub! Before I let you go, I'd love to learn a bit more about your business so we can connect you with the right opportunities..."
Ask 3-5 opportunity questions conversationally:
- Do you have TVs or screens in your space where you show content?
- Are you interested in local marketing or promotions?
- Do you host or would you host community events?
- What are your biggest growth challenges right now?
- Would you be open to barter or trade with other local businesses?
Save opportunity answers using save_conversation_data with moduleId "activate_presence".

### Phase 6 — Story Offer
After profiling, offer the story interview:
"One more thing — would you like to share your story so we can create a community spotlight feature about you? It only takes a few more minutes and it's a great way for the community to get to know you."
If yes → transition into normal story interview modules (personal_story, origin_story, etc.)
If no → warm thank you: "You're all set! Once your $1 verification payment is complete, your presence will be live on the Hub. Welcome to the community!"

Use moduleId "activate_presence" when saving activation-related data via save_conversation_data.\n\n`;
    } else if (intent === "venue") {
      prompt += `## INTENT: VENUE NETWORK ONBOARDING
The person is here to join the Hub Venue Network — they want their space to receive curated local content, community TV, and a custom music/audio experience.

### CRITICAL FRAMING RULES
- NEVER say "create," "register," or "sign up." ALWAYS frame it as "I found your listing," "I found your space," or "I'm connecting your venue to the network."
- The platform already knows about local venues. You are helping them CLAIM and ACTIVATE their spot in the network.
- Be excited about what they get: free community content on their screens, curated local music, local exposure, and analytics.

### Phase 1 — Venue Basics
Collect conversationally:
1. Their first and last name
2. The venue name (restaurant, bar, gym, coffee shop, office, etc.)
3. What type of venue it is
4. The venue's address
5. Approximate daily foot traffic ("How many people come through your space on a typical day?")
6. Whether they already have TVs or screens in their space

### Phase 2 — Music & Audio Vibe
This is the exciting part — help them pick their audio identity:
"Let's set up your venue's audio vibe! What kind of atmosphere does your space have?"

Offer these preset options naturally:
- Coffee Shop Chill — mellow jazz, acoustic, indie, soul
- Nightlife Energy — hip-hop, R&B, pop, dance, electronic
- Office Focus — lo-fi, ambient, acoustic, classical
- Gym Pump — hip-hop, electronic, pop, rock (high energy)
- Sunday Brunch — soul, jazz, R&B, acoustic
- Family Dining — pop, acoustic, soul, jazz (mellow)
- Happy Hour — pop, R&B, hip-hop, latin (upbeat)
- Retail Vibe — pop, indie, electronic (medium energy)
- Custom — they can describe their own vibe

If they pick a preset, confirm it. If they say "custom," ask what genres they prefer and what energy level (low/medium/high).

Also ask:
- "Would you like music playing, or do you prefer talk segments and announcements too?"
- "Any genres or types of music you definitely want to avoid?"

### Phase 3 — Contact Info
Collect:
1. Email address
2. Phone number

### Phase 4 — Register the Venue
Once you have all the info, call the \`register_venue\` tool with:
- venueName, venueAddress, contactName, contactEmail, contactPhone
- citySlug (use the current city)
- presetSlug (the mood preset slug they picked, like "coffee-shop-chill", "nightlife-energy", "office-focus", "gym-pump", "sunday-brunch", "family-dining", "happy-hour", "retail-vibe", or null for custom)
- customGenres (array if custom — e.g. ["jazz", "soul", "r&b"])
- customMoods (array if custom — e.g. ["chill", "background"])
- energyLevel ("low", "medium", or "high")
- musicEnabled (true/false)
- talkSegmentsEnabled (true/false)
- excludedGenres (array of genres to avoid)
- footTraffic (estimated daily number)
- hasExistingScreens (true/false)

After the tool responds, say:
"I found your space and connected [Venue Name] to the Hub Venue Network! Your custom audio profile is set up — you'll get curated ${presetName || "custom"} music, local community content, and neighborhood exposure."

### Phase 5 — Next Steps
Tell them what happens next:
- "Our team will reach out to get your screen set up with the Hub content feed"
- "You can adjust your music preferences anytime through your venue portal"
- "Your venue will start appearing in the local directory and on the Hub map"
- "You'll receive analytics on foot traffic and community engagement"

Thank them warmly and welcome them to the network.

Use moduleId "venue_onboard" when saving via save_conversation_data.\n\n`;
    }
  } else if (!intent && completedModules.length === 0) {
    prompt += `## DETECT INTENT
After greeting and getting the person's name, find out what brings them here. They might want to:
- Share their own story (default — continue with the story interview)
- Submit a community event (ask event details)
- Give a shout-out to someone who deserves recognition (ask about the person/business)
- Nominate someone else whose story should be told (ask about the nominee)

Ask naturally: "What brings you here today? Are you sharing your own story, submitting an event, giving a shout-out, telling us about someone whose story should be heard, or activating your business presence?"
If they say they're here to share their own story or just want to chat, continue with the normal story interview flow.
If they want to activate their business, follow the ACTIVATE PRESENCE flow (use moduleId "activate_presence").
If they have a different intent, adapt your questions accordingly using the appropriate moduleId (event_submission, shout_out, or story_nomination).\n\n`;
  }

  prompt += `## What You've Learned So Far\n`;
  if (Object.keys(currentResponses).length === 0) {
    prompt += `Nothing yet — this is a fresh conversation.\n`;
  } else {
    for (const [moduleId, resp] of Object.entries(currentResponses)) {
      const answer = Array.isArray(resp.answer) ? resp.answer.join(", ") : resp.answer;
      const truncated = answer.length > 200 ? answer.substring(0, 200) + "..." : answer;
      prompt += `- ${moduleId}: ${truncated}\n`;
    }
  }

  if (extractedSignals && Object.keys(extractedSignals).length > 0) {
    prompt += `\n## Signals Already Extracted\n`;
    for (const [cat, data] of Object.entries(extractedSignals)) {
      if (data.signals.length > 0) {
        const catLabel = EXTRACTION_CATEGORIES.find(c => c.id === cat)?.label || cat;
        prompt += `- ${catLabel}: ${data.signals.map(s => s.value).join(", ")}\n`;
      }
    }
  }

  return prompt;
}

export async function handleConversationData(
  sessionId: string,
  moduleId: string,
  responseText: string,
  extractedSignalsList?: { category: string; type: string; value: string; context: string }[]
): Promise<{
  saved: boolean;
  nextModule: { id: string; name: string } | null;
  detectedPersona: string | null;
  storyDepthScore: number;
  completeness: { ready: boolean; suggestion: string };
  topicProgress: { id: string; label: string; completed: boolean }[];
}> {
  const [session] = await db
    .select()
    .from(charlotteFlowSessions)
    .where(eq(charlotteFlowSessions.id, sessionId))
    .limit(1);

  if (!session) throw new Error(`Flow session ${sessionId} not found`);

  const responses: ProfileResponses = (session.responses as ProfileResponses) || {};
  responses[moduleId] = {
    answer: responseText,
    answeredAt: new Date().toISOString(),
  };

  const existingCompleted = (session.modulesCompleted as string[]) || [];
  const modulesCompleted = [...new Set([...existingCompleted, moduleId])];

  let extractedSignals = (session.extractedSignals as Record<string, { signals: { type: string; value: string; context: string; confidence: number }[] }>) || {};
  if (extractedSignalsList && extractedSignalsList.length > 0) {
    for (const signal of extractedSignalsList) {
      if (!extractedSignals[signal.category]) {
        extractedSignals[signal.category] = { signals: [] };
      }
      extractedSignals[signal.category].signals.push({
        type: signal.type,
        value: signal.value,
        context: signal.context,
        confidence: 0.8,
      });
    }
  }

  const detectedPersona = detectPersonaFromResponses(responses);

  if (moduleId === "personal_story" || moduleId === "primary_business") {
    const nameMatch = responseText.match(/(?:I'm|my name is|call me|I am|name's|it's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i);
    if (nameMatch && !session.contactName) {
      await db.update(charlotteFlowSessions)
        .set({ contactName: nameMatch[1].trim() })
        .where(eq(charlotteFlowSessions.id, sessionId));
    }

    const businessMatch = responseText.match(/(?:called|named|it's|run|own)\s+([A-Z][^,.!?]+)/i);
    if (businessMatch && !session.businessName) {
      await db.update(charlotteFlowSessions)
        .set({ businessName: businessMatch[1].trim() })
        .where(eq(charlotteFlowSessions.id, sessionId));
    }
  }

  if (moduleId === "mentor_inspiration" && session.businessId && responseText.trim()) {
    await db.update(businesses)
      .set({ businessInspiration: responseText.trim(), updatedAt: new Date() })
      .where(eq(businesses.id, session.businessId));
  }

  const score = computeStoryDepthScore(modulesCompleted, responses, extractedSignals);
  const completeness = getConversationCompleteness(modulesCompleted, responses, extractedSignals);
  const topicProgress = getTopicProgressLabels(modulesCompleted);

  await db
    .update(charlotteFlowSessions)
    .set({
      responses,
      modulesCompleted,
      extractedSignals,
      detectedPersona,
      storyDepthScore: score,
      updatedAt: new Date(),
    })
    .where(eq(charlotteFlowSessions.id, sessionId));

  if (completeness.ready && session.businessId) {
    try {
      const storyTrustFields = deriveStoryTrustFields(modulesCompleted, responses, extractedSignals);
      await updateStoryTrustFields(session.businessId, storyTrustFields);
    } catch (err) {
      console.error("[TrustFields] Error updating story trust fields:", err);
    }
  }

  const nextMod = selectNextModule(detectedPersona, modulesCompleted, responses);

  return {
    saved: true,
    nextModule: nextMod ? { id: nextMod.id, name: nextMod.name } : null,
    detectedPersona,
    storyDepthScore: score,
    completeness,
    topicProgress,
  };
}

function deriveStoryTrustFields(
  completedModules: string[],
  responses: ProfileResponses,
  extractedSignals: Record<string, { signals: { type: string; value: string; context: string; confidence: number }[] }> | null
): { serviceClarity: number; localRelevance: number; communityInvolvement: number } {
  const completed = new Set(completedModules);
  let serviceClarity = 0;
  let localRelevance = 0;
  let communityInvolvement = 0;

  if (completed.has("primary_business")) serviceClarity += 30;
  if (completed.has("customer_perspective")) serviceClarity += 25;
  if (responses.primary_business?.answer && (responses.primary_business.answer as string).length > 50) serviceClarity += 15;
  if (completed.has("origin_story")) serviceClarity += 10;

  if (completed.has("neighborhood")) localRelevance += 30;
  if (completed.has("neighborhood_history")) localRelevance += 20;
  if (completed.has("local_recommendations")) localRelevance += 20;
  if (completed.has("local_pride")) localRelevance += 15;

  if (completed.has("community_impact")) communityInvolvement += 30;
  if (completed.has("community_connectors")) communityInvolvement += 25;
  if (completed.has("events_gatherings")) communityInvolvement += 20;
  if (completed.has("collaboration_network")) communityInvolvement += 15;

  if (extractedSignals) {
    const communitySignals = extractedSignals["community_impact"]?.signals?.length || 0;
    communityInvolvement += Math.min(10, communitySignals * 3);
  }

  return {
    serviceClarity: Math.min(100, serviceClarity),
    localRelevance: Math.min(100, localRelevance),
    communityInvolvement: Math.min(100, communityInvolvement),
  };
}

export async function handleExtractLead(
  sessionId: string,
  leadType: string,
  entityName: string,
  detail: string,
  sourceModuleId: string
): Promise<{ saved: boolean }> {
  const [session] = await db
    .select()
    .from(charlotteFlowSessions)
    .where(eq(charlotteFlowSessions.id, sessionId))
    .limit(1);

  if (!session) throw new Error(`Flow session ${sessionId} not found`);

  let extractedSignals = (session.extractedSignals as Record<string, { signals: { type: string; value: string; context: string; confidence: number }[] }>) || {};

  const category = leadType === "venue_screen" ? "venue_tv"
    : leadType === "hiring" ? "job_board"
    : leadType === "marketplace" ? "marketplace"
    : leadType === "media" ? "media_sources"
    : leadType === "coworking" ? "entrepreneur_ecosystem"
    : "lead_generation";

  if (!extractedSignals[category]) {
    extractedSignals[category] = { signals: [] };
  }

  extractedSignals[category].signals.push({
    type: leadType,
    value: entityName,
    context: detail,
    confidence: 0.9,
  });

  await db
    .update(charlotteFlowSessions)
    .set({ extractedSignals, updatedAt: new Date() })
    .where(eq(charlotteFlowSessions.id, sessionId));

  return { saved: true };
}

export async function generateSpotlightArticle(
  sessionId: string,
  openaiClient: any,
  articleStyle: "spotlight" | "brief" = "spotlight"
): Promise<{ title: string; content: string; articleId?: string; wordCount: number }> {
  const [session] = await db
    .select()
    .from(charlotteFlowSessions)
    .where(eq(charlotteFlowSessions.id, sessionId))
    .limit(1);

  if (!session) throw new Error("Session not found");

  const responses = session.responses as ProfileResponses;
  const contactName = session.contactName || "A local community member";
  const businessName = session.businessName || "a local business";
  const persona = session.detectedPersona || "community member";
  const signals = session.extractedSignals as Record<string, { signals: any[] }> | null;

  let contextBlock = `Interviewee: ${contactName}\nBusiness/Project: ${businessName}\nPersona: ${persona}\n\n`;
  contextBlock += `## Interview Responses\n`;
  for (const [moduleId, resp] of Object.entries(responses)) {
    const answer = Array.isArray(resp.answer) ? resp.answer.join(", ") : resp.answer;
    contextBlock += `\n### ${moduleId}\n${answer}\n`;
  }

  if (signals && Object.keys(signals).length > 0) {
    contextBlock += `\n## Community Signals Discovered\n`;
    for (const [cat, data] of Object.entries(signals)) {
      if (data.signals.length > 0) {
        contextBlock += `\n### ${cat}\n`;
        for (const s of data.signals) {
          contextBlock += `- ${s.value}: ${s.context}\n`;
        }
      }
    }
  }

  const isSpotlight = articleStyle === "spotlight";
  const wordTarget = isSpotlight ? "1,500-2,000" : "200-300";

  const storyPrompt = `Write a ${isSpotlight ? "compelling Local Leader / Neighborhood Leader spotlight profile" : "brief community story"} (${wordTarget} words) for ${cityNameFromSession(session)} Metro Hub's Pulse feed.

${contextBlock}

## Writing Guidelines
${isSpotlight ? `- This is a FEATURE PROFILE, not a business review or directory listing
- Write about the PERSON, their journey, their place in the neighborhood, how they serve the community
- Include their origin story, what drives them, how they are experienced by others
- Weave in their neighborhood connection and local recommendations naturally
- Include their vision for the future
- Write with warmth and texture — this should feel like a neighbor introducing you to someone special
- Use flowing prose, not bullet points
- Include quotes and specific details from the interview
- End with their closing reflection or message to the community` : `- Write a warm, engaging community story in Charlotte's voice
- Celebrate what makes them and their work special
- Keep it concise but heartfelt`}

Write in Charlotte's voice — friendly, genuine, celebrating the people who make this community special.

Format your response as JSON: { "title": "...", "content": "..." }`;

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: storyPrompt }],
    max_tokens: isSpotlight ? 3000 : 800,
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(completion.choices[0].message.content || '{}');
  const title = result.title || `Meet ${contactName}`;
  const content = result.content || "";
  const wordCount = content.split(/\s+/).length;

  let zoneName = "";
  let townName = "";
  if (session.businessId) {
    const [biz] = await db.select({ zoneName: zones.name, townName: businesses.city }).from(businesses).leftJoin(zones, eq(businesses.zoneId, zones.id)).where(eq(businesses.id, session.businessId)).limit(1);
    if (biz?.zoneName) zoneName = biz.zoneName;
    if (biz?.townName) townName = biz.townName;
  }

  const slugParts = ["meet"];
  const cleanName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (contactName && contactName !== "A local community member") slugParts.push(cleanName(contactName));
  if (businessName && businessName !== "a local business") slugParts.push(cleanName(businessName));
  if (zoneName) slugParts.push(cleanName(zoneName));
  if (townName && cleanName(townName) !== cleanName(zoneName)) slugParts.push(cleanName(townName));
  slugParts.push("spotlight");
  const alphaChars = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphaChars[Math.floor(Math.random() * alphaChars.length)];
  const slug = slugParts.join("-").substring(0, 120) + "-" + suffix;

  const autoPublish = await checkAutoPublishSafe(openaiClient, title, content);

  try {
    const article = await storage.createArticle({
      cityId: session.cityId,
      title,
      slug,
      excerpt: content.substring(0, 300) + "...",
      content,
      authorId: null,
      publishedAt: autoPublish ? new Date() : null,
    });

    queueTranslation("article", article.id);

    try {
      let spotlightCatIds: string[] = [];
      if (session.businessId) {
        const [spotBiz] = await db.select({ categoryIds: businesses.categoryIds }).from(businesses).where(eq(businesses.id, session.businessId)).limit(1);
        if (spotBiz?.categoryIds) spotlightCatIds = spotBiz.categoryIds;
      }
      await applyFullTagStack("article", article.id, {
        cityId: session.cityId,
        categoryIds: spotlightCatIds.length > 0 ? spotlightCatIds : undefined,
        title,
      });
    } catch (tagErr) {
      console.error(`[Charlotte] Tag stack failed for spotlight ${article.id}:`, tagErr instanceof Error ? tagErr.message : tagErr);
    }

    if (autoPublish) {
      console.log(`[AutoPublish] Spotlight auto-published: "${title}" (${article.id})`);
    } else {
      console.log(`[AutoPublish] Spotlight flagged for review: "${title}" (${article.id})`);
    }

    let citySlug = "charlotte";
    try {
      const [city] = await db.select({ slug: cities.slug }).from(cities).where(eq(cities.id, session.cityId)).limit(1);
      if (city?.slug) citySlug = city.slug;
    } catch {}

    try {
      await createInboxItemIfNotOpen({
        itemType: "spotlight_article_generated",
        relatedTable: "articles",
        relatedId: article.id,
        title: autoPublish ? `New Spotlight Published: ${title}` : `Spotlight Needs Review: ${title}`,
        summary: `${contactName} / ${businessName}${zoneName ? ` (${zoneName})` : ""}${townName && townName !== zoneName ? `, ${townName}` : ""} — ${wordCount} words, ${articleStyle}. ${autoPublish ? "Auto-published." : "Flagged for editorial review."}`,
        priority: autoPublish ? "low" : "high",
        tags: ["spotlight", articleStyle, autoPublish ? "auto-published" : "needs-review"],
        links: [
          { label: "View Article", urlOrRoute: `/${citySlug}/articles/${slug}` },
          { label: "Admin Articles", urlOrRoute: `/admin/articles` },
        ],
      });
    } catch (inboxErr) {
      console.error("[CHARLOTTE FLOWS] Failed to create inbox notification:", inboxErr);
    }

    await db
      .update(charlotteFlowSessions)
      .set({
        generatedContent: { title, content, articleId: article.id, wordCount, articleStyle },
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(charlotteFlowSessions.id, sessionId));

    return { title, content, articleId: article.id, wordCount };
  } catch (err) {
    console.error("[CHARLOTTE FLOWS] Failed to create spotlight article:", err);

    await db
      .update(charlotteFlowSessions)
      .set({
        generatedContent: { title, content, wordCount, articleStyle },
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(charlotteFlowSessions.id, sessionId));

    return { title, content, wordCount };
  }
}

export async function checkPremiumWritingAccess(sessionId: string): Promise<{ allowed: boolean; tier: string | null; businessId: string | null }> {
  const [session] = await db
    .select()
    .from(charlotteFlowSessions)
    .where(eq(charlotteFlowSessions.id, sessionId))
    .limit(1);

  if (!session) return { allowed: false, tier: null, businessId: null };

  if (!session.businessId) {
    return { allowed: false, tier: null, businessId: null };
  }

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, session.businessId))
    .limit(1);

  if (!biz) return { allowed: false, tier: null, businessId: session.businessId };

  const premiumTiers = ["ENHANCED"];
  const allowed = premiumTiers.includes(biz.listingTier);
  return { allowed, tier: biz.listingTier, businessId: biz.id };
}

function cityNameFromSession(session: any): string {
  return "CLT";
}

export function buildCrownOnboardingSystemPrompt(context: {
  participantName: string;
  categoryName: string;
  participantType: string;
  cityName?: string;
  hasAccepted: boolean;
  hasProfile: boolean;
  hasBusinessLinked: boolean;
  businessName?: string;
}): string {
  const {
    participantName,
    categoryName,
    participantType,
    cityName = "CLT",
    hasAccepted,
    hasProfile,
    hasBusinessLinked,
    businessName,
  } = context;

  let prompt = buildCrownOnboardingIntro(cityName);

  prompt += `## Your Personality
- Warm, celebratory, and genuinely excited about their nomination
- Encouraging and supportive — make them feel special and valued
- Conversational and natural — not robotic or survey-like
- You believe in community recognition and local excellence
- Keep responses brief (2-4 sentences) unless they ask detailed questions\n\n`;

  prompt += `## Nominee Details
- Name: ${participantName}
- Category: ${categoryName}
- Type: ${participantType}
${businessName ? `- Business: ${businessName}` : ""}\n\n`;

  prompt += `## Onboarding Steps & Your Tools
You have these tools to guide the nominee through onboarding:\n`;

  if (!hasAccepted) {
    prompt += `\n### Step 1: Accept Nomination (CURRENT)
The nominee needs to accept their nomination. Greet them warmly, explain what the Crown Program is (a community recognition program celebrating the best local businesses, creators, and organizations), and what being nominated means. Then ask if they'd like to accept.
- When they agree, call \`accept_crown_nomination\` to accept it
- If they have questions about the program, answer them enthusiastically\n`;
  } else {
    prompt += `\n### Step 1: Accept Nomination ✓ COMPLETED\n`;
  }

  if (!hasProfile && hasAccepted) {
    prompt += `\n### Step 2: Complete Nominee Profile (CURRENT)
Help them complete their nominee profile. Ask conversationally about:
- A brief bio about themselves or their business (what makes them special, what they bring to the community)
- Why they deserve the Crown (what sets them apart)
- Their website URL (optional)
When you have their bio (and optionally website), call \`complete_nominee_profile\` to save it.\n`;
  } else if (hasProfile) {
    prompt += `\n### Step 2: Complete Nominee Profile ✓ COMPLETED\n`;
  }

  if (!hasBusinessLinked && hasAccepted) {
    prompt += `\n### Step 3: Link Business${hasProfile ? " (CURRENT)" : ""}
Ask if they already have a business listing on the Hub. 
- If yes, call \`link_business_to_nomination\` with createNew=false and their business name to search for and link it
- If no, call \`link_business_to_nomination\` with createNew=true and their business details to create a new listing
This step is REQUIRED to complete onboarding. Both profile and business linking must be done.\n`;
  } else if (hasBusinessLinked) {
    prompt += `\n### Step 3: Link Business ✓ COMPLETED\n`;
  }

  if (hasAccepted && hasProfile && hasBusinessLinked) {
    prompt += `\n## All Steps Complete!
Present a warm confirmation summary:
1. Congratulate them on completing onboarding
2. Explain the timeline: voting will open soon, community members can vote for them
3. Encourage them to share their nomination with friends and supporters
4. Let them know their status is now "Verified Participant"
5. Mention they'll be visible in the Crown voting page when voting opens\n`;
  }

  if (hasAccepted && (!hasProfile || !hasBusinessLinked)) {
    prompt += `\n## IMPORTANT: Both profile AND business linking are required to complete onboarding.
The nominee's status will transition to "Verified Participant" only after BOTH steps are completed. Do not tell the nominee they are done until both milestones are met. The tools will automatically finalize the flow when the last required step is completed.\n`;
  }

  prompt += `\n## Rules
- Ask ONE thing at a time — never bundle multiple questions
- Be warm and celebratory — this is a special moment for them
- Call the appropriate tool IMMEDIATELY when you have the needed information
- Never say "I am an AI" — you are Charlotte, the community guide
- Use warm acknowledgments: "That's wonderful!", "I love that!", "The community is lucky to have you!"
- If they seem hesitant, be reassuring — there's no obligation, but the community wants to celebrate them\n`;

  return prompt;
}
