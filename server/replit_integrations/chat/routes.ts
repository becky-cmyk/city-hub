import type { Express, Request, Response, NextFunction } from "express";
import type OpenAI from "openai";
import { openai } from "../../lib/openai";
import { chatStorage } from "./storage";
import { buildCityBranding, type CityRecord } from "@shared/city-branding";
import { buildContentWriterSystem, buildSeoSpecialistSystem, buildEmailDrafterSystem, buildAdminAssistantSystem } from "../../ai/prompts/platform-services";

function buildSystemPrompt(cityName: string, citySlug: string): string {
  return `${buildAdminAssistantSystem(cityName, citySlug)}

## Your Role
You help admins manage their city hub content: businesses, events, articles, zones, categories, curated lists, and submissions. You can analyze data, suggest improvements, clean up CSV imports, draft content, and propose changes — but you NEVER make database changes directly. All changes require admin approval.

## Platform Data Model
- **Cities**: Multi-tenant root (id, name, slug, brandName)
- **Zones**: Neighborhoods/districts within a city with types: ZIP, NEIGHBORHOOD, DISTRICT, MICRO_HUB
- **Categories**: Business categories (Business, Food & Drink, Family, Seniors, Pets, Events, Marketplace)
- **Businesses**: Scoped to city+zone. Fields: name, slug, description, address, city, state, zip, phone, website, email, categoryId, zoneId, listingTier (FREE/VERIFIED/PREMIUM), featured, verified, claimStatus, hours, tags
- **Events**: Scoped to city+zone. Fields: title, slug, description, startDate, endDate, location, cost, zoneId, featured
- **Articles**: City-scoped content. Fields: title, slug, body, excerpt, author, categoryId, featured
- **Curated Lists**: "Top 10" style lists linking to businesses/events/articles
- **Submissions**: Public submission queue (BUSINESS, EVENT, ARTICLE_PITCH types) with status PENDING/APPROVED/REJECTED
- **Listing Tiers**: FREE (basic listing), VERIFIED (claimed + verified), PREMIUM (full features + analytics)

## CSV Processing
When the admin uploads CSV data, you will receive the parsed rows. Your job is to:
1. Analyze the columns and map them to the correct business fields
2. Identify and fix issues: missing required fields, inconsistent formatting, duplicates
3. Normalize data: standardize phone numbers, addresses, categories, zones
4. Suggest the best zone match for each business based on address/zip
5. Present a clean summary of what you'd import and any issues found
6. Format your proposed changes as a structured table the admin can review

## Response Guidelines
- Be concise but thorough
- When proposing data changes, use clear tables or lists
- Always explain what you'd change and why
- Flag any data quality issues or concerns
- When you're unsure about a zone or category mapping, say so and suggest options
- Use markdown formatting for readability
- If asked to do something outside your capabilities, explain what you can and can't do`;
}

async function resolveCityContext(req: Request): Promise<{ cityName: string; citySlug: string; brandShort: string }> {
  const requestedSlug = (req.body?.citySlug || req.query?.citySlug || "") as string;
  try {
    const { pool } = await import("../../db");

    let citySlug = requestedSlug;
    const userId = (req.session as Record<string, unknown>)?.userId as string | undefined;
    if (userId) {
      const userRes = await pool.query("SELECT role, city_id FROM users WHERE id = $1 LIMIT 1", [userId]);
      const user = userRes.rows[0];
      if (user?.role === "CITY_ADMIN" && user.city_id) {
        const assignedRes = await pool.query("SELECT slug FROM cities WHERE id = $1 LIMIT 1", [user.city_id]);
        const assignedSlug = assignedRes.rows[0]?.slug;
        if (assignedSlug) {
          if (citySlug && citySlug !== assignedSlug) {
            citySlug = assignedSlug;
          } else if (!citySlug) {
            citySlug = assignedSlug;
          }
        }
      }
    }

    let result;
    if (citySlug) {
      result = await pool.query(
        "SELECT name, slug, city_code, brand_name, ai_guide_name, site_url, email_domain FROM cities WHERE slug = $1 LIMIT 1",
        [citySlug]
      );
    } else {
      result = await pool.query(
        "SELECT name, slug, city_code, brand_name, ai_guide_name, site_url, email_domain FROM cities ORDER BY name LIMIT 1"
      );
    }
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const city: CityRecord = {
        name: row.name,
        slug: row.slug,
        cityCode: row.city_code,
        brandName: row.brand_name,
        aiGuideName: row.ai_guide_name,
        siteUrl: row.site_url,
        emailDomain: row.email_domain,
      };
      const branding = buildCityBranding(city);
      return { cityName: city.name, citySlug: city.slug, brandShort: branding.brandShort };
    }
  } catch {}
  return { cityName: "Metro", citySlug: "metro", brandShort: "Metro Hub" };
}

export function registerChatRoutes(app: Express, requireAdmin: (req: Request, res: Response, next: NextFunction) => void): void {
  app.get("/api/admin/ai/conversations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/admin/ai/conversations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const msgList = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages: msgList });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/admin/ai/conversations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/admin/ai/conversations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/admin/ai/conversations/:id/messages", requireAdmin, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id as string);
      const { content } = req.body;

      if (!openai) {
        return res.status(503).json({ error: "OpenAI client not available" });
      }

      await chatStorage.createMessage(conversationId, "user", content);

      const ctx = await resolveCityContext(req);
      const msgHistory = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: buildSystemPrompt(ctx.cityName, ctx.citySlug) },
        ...msgHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 8192,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  app.post("/api/admin/ai/compose", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { action, title, excerpt, body, contentType, context } = req.body;
      if (!action) return res.status(400).json({ error: "Action is required" });
      if (!openai) return res.status(503).json({ error: "OpenAI client not available" });

      const ctx = await resolveCityContext(req);

      let prompt = "";
      if (action === "generate") {
        prompt = `Write a compelling ${contentType || "article"} for ${ctx.brandShort} about: "${title || "untitled"}".
${context ? `Additional context: ${context}` : ""}
${excerpt ? `Existing excerpt/summary: ${excerpt}` : ""}

Write engaging, informative content appropriate for a local community audience in ${ctx.cityName}. Use a professional yet approachable tone. Structure with clear paragraphs. Do not include the title in your response — just the body content.`;
      } else if (action === "improve") {
        prompt = `Improve and polish the following ${contentType || "article"} content for ${ctx.brandShort}.

Title: ${title || "Untitled"}
${excerpt ? `Excerpt: ${excerpt}` : ""}

Current body:
${body || "(empty)"}

${context ? `Instructions: ${context}` : `Make it more engaging, fix any grammar issues, improve flow, and ensure it reads well for a local ${ctx.cityName} audience.`}

Return only the improved body content.`;
      } else if (action === "excerpt") {
        prompt = `Write a compelling 1-2 sentence excerpt/summary for this ${contentType || "article"}:

Title: ${title || "Untitled"}
Body: ${(body || "").substring(0, 3000)}

The excerpt should be concise, engaging, and make readers want to read the full article. Return only the excerpt text.`;
      } else {
        return res.status(400).json({ error: "Invalid action" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: buildContentWriterSystem(ctx.brandShort, ctx.cityName) },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_completion_tokens: 4096,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in AI compose:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate content" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to generate content" });
      }
    }
  });

  app.post("/api/admin/ai/seo", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { title, excerpt, body, contentType } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required" });
      if (!openai) return res.status(503).json({ error: "OpenAI client not available" });

      const ctx = await resolveCityContext(req);

      const prompt = `Generate SEO metadata for this ${contentType || "article"} on ${ctx.brandShort}:

Title: ${title}
${excerpt ? `Excerpt: ${excerpt}` : ""}
${body ? `Body preview: ${(body).substring(0, 2000)}` : ""}

Provide the following in JSON format (no markdown code fences):
{
  "seoTitle": "An optimized title tag (50-60 chars, include relevant keywords)",
  "seoDescription": "A compelling meta description (150-160 chars, include call-to-action)",
  "suggestedSlug": "a-seo-friendly-url-slug"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: buildSeoSpecialistSystem(ctx.brandShort) },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 500,
      });

      const text = response.choices[0]?.message?.content || "{}";
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try {
        const seoData = JSON.parse(cleaned);
        res.json(seoData);
      } catch {
        res.json({ seoTitle: title, seoDescription: excerpt || "", suggestedSlug: "" });
      }
    } catch (error) {
      console.error("Error in AI SEO:", error);
      res.status(500).json({ error: "Failed to generate SEO data" });
    }
  });

  app.post("/api/admin/ai/draft-email", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { purpose, recipientName, recipientType, businessName, eventTitle, context } = req.body;
      if (!purpose) return res.status(400).json({ error: "Purpose is required" });
      if (!openai) return res.status(503).json({ error: "OpenAI client not available" });

      const ctx = await resolveCityContext(req);

      const prompt = `Draft a professional email for ${ctx.brandShort}.

Purpose: ${purpose}
${recipientName ? `Recipient: ${recipientName}` : ""}
${recipientType ? `Recipient type: ${recipientType}` : ""}
${businessName ? `Business: ${businessName}` : ""}
${eventTitle ? `Event: ${eventTitle}` : ""}
${context ? `Additional context: ${context}` : ""}

Write a professional, friendly email appropriate for a local community platform. Include a clear subject line. Format as:
Subject: [subject line]

[email body]`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: buildEmailDrafterSystem(ctx.brandShort) },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_completion_tokens: 2048,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in AI email draft:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to draft email" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to draft email" });
      }
    }
  });

  app.post("/api/admin/ai/csv-analyze", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { csvData, instructions } = req.body;
      if (!csvData) return res.status(400).json({ error: "CSV data is required" });
      if (!openai) return res.status(503).json({ error: "OpenAI client not available" });

      const ctx = await resolveCityContext(req);

      const lines = csvData.split("\n").filter((l: string) => l.trim());
      const rowCount = lines.length - 1;
      const preview = lines.slice(0, Math.min(6, lines.length)).join("\n");

      const prompt = `The admin has uploaded a CSV file with ${rowCount} data rows. Here are the headers and first few rows:

\`\`\`
${preview}
\`\`\`

${instructions ? `Admin instructions: "${instructions}"` : "Please analyze this CSV and tell me what you see."}

Total rows: ${rowCount}
Full CSV data:
\`\`\`
${csvData.substring(0, 15000)}
\`\`\`
${csvData.length > 15000 ? `\n(CSV truncated at 15,000 chars; ${csvData.length} total chars)` : ""}

Please:
1. Identify what type of data this is (businesses, events, etc.)
2. Map the columns to our platform fields
3. Flag any data quality issues (missing fields, bad formatting, duplicates)
4. Suggest how to clean and normalize the data
5. Show a summary table of the proposed import with any corrections`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: buildSystemPrompt(ctx.cityName, ctx.citySlug) },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_completion_tokens: 8192,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error analyzing CSV:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to analyze CSV" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to analyze CSV" });
      }
    }
  });
}
