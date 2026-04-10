import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { z, ZodError } from "zod";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { crmContacts, interviewQuestionTemplates } from "@shared/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { openai } from "./lib/openai";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { speechToText, ensureCompatibleFormat } from "./replit_integrations/audio/client";
import { Buffer } from "node:buffer";

const storyUploadsDir = path.join(process.cwd(), "uploads", "story-studio");
if (!fs.existsSync(storyUploadsDir)) fs.mkdirSync(storyUploadsDir, { recursive: true });

const ALLOWED_AUDIO_MIMES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3"];
const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const SAFE_AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mp3": ".mp3",
};
const SAFE_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
};

function audioFileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ALLOWED_AUDIO_MIMES.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only audio files are allowed"));
}

function imageFileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed"));
}

const storyDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, storyUploadsDir),
  filename: (_req, file, cb) => {
    const safeExt = SAFE_AUDIO_EXTENSIONS[file.mimetype] || SAFE_IMAGE_EXTENSIONS[file.mimetype] || ".bin";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`);
  },
});

const audioUpload = multer({ storage: storyDiskStorage, limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: audioFileFilter });
const photoUpload = multer({ storage: storyDiskStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFileFilter });

function handleError(res: Response, e: any) {
  if (e instanceof ZodError) {
    return res.status(400).json({ message: "Validation error", errors: e.errors });
  }
  console.error("[StoryStudio]", e.message);
  res.status(500).json({ message: e.message });
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

export function registerStoryStudioRoutes(app: Express, requireAdmin: any) {
  app.get("/api/story-studio/questions", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const templateSetName = _req.query.templateSetName as string | undefined;
      const questions = await storage.getInterviewQuestions(templateSetName || undefined);
      res.json(questions);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-studio/questions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        questionText: z.string().min(1),
        displayOrder: z.number().default(0),
        fieldMapping: z.string().optional().nullable(),
        isCustom: z.boolean().default(true),
        isDefault: z.boolean().default(false),
        templateSetName: z.string().optional().nullable(),
      });
      const parsed = schema.parse(req.body);
      const q = await storage.createInterviewQuestion(parsed);
      res.status(201).json(q);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.patch("/api/story-studio/questions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const patchSchema = z.object({
        questionText: z.string().min(1).optional(),
        displayOrder: z.number().optional(),
        fieldMapping: z.string().nullable().optional(),
        isDefault: z.boolean().optional(),
      }).strict();
      const parsed = patchSchema.parse(req.body);
      const q = await storage.updateInterviewQuestion(req.params.id, parsed);
      if (!q) return res.status(404).json({ message: "Question not found" });
      res.json(q);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.delete("/api/story-studio/questions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteInterviewQuestion(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-studio/questions/reorder", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        orderedIds: z.array(z.string()),
      });
      const { orderedIds } = schema.parse(req.body);
      for (let i = 0; i < orderedIds.length; i++) {
        await storage.updateInterviewQuestion(orderedIds[i], { displayOrder: i });
      }
      res.json({ ok: true });
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.get("/api/story-studio/template-sets", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allQuestions = await db.select().from(interviewQuestionTemplates);
      const setNames = new Set<string>();
      for (const q of allQuestions) {
        if (q.templateSetName) setNames.add(q.templateSetName);
      }
      res.json(Array.from(setNames));
    } catch (e: unknown) {
      handleError(res, e);
    }
  });

  app.post("/api/story-studio/template-sets", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(100),
        questionIds: z.array(z.string()),
      });
      const { name, questionIds } = schema.parse(req.body);
      for (const qId of questionIds) {
        await storage.updateInterviewQuestion(qId, { templateSetName: name });
      }
      res.json({ ok: true, name });
    } catch (e: unknown) {
      handleError(res, e);
    }
  });

  app.post("/api/story-studio/template-sets/load", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({ name: z.string().min(1) });
      const { name } = schema.parse(req.body);
      const questions = await db.select().from(interviewQuestionTemplates)
        .where(eq(interviewQuestionTemplates.templateSetName, name))
        .orderBy(asc(interviewQuestionTemplates.displayOrder));
      res.json(questions);
    } catch (e: unknown) {
      handleError(res, e);
    }
  });

  app.post("/api/story-studio/crawl-website", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({ url: z.string().url() });
      const { url: rawUrl } = schema.parse(req.body);

      const dns = await import("dns");
      const net = await import("net");

      function isPrivateIP(ip: string): boolean {
        if (net.isIPv4(ip)) {
          const parts = ip.split(".").map(Number);
          if (parts[0] === 10) return true;
          if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
          if (parts[0] === 192 && parts[1] === 168) return true;
          if (parts[0] === 127) return true;
          if (parts[0] === 0) return true;
          if (parts[0] === 169 && parts[1] === 254) return true;
          return false;
        }
        if (net.isIPv6(ip)) {
          const lower = ip.toLowerCase();
          if (lower === "::1" || lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd") || lower === "::") return true;
          return false;
        }
        return false;
      }

      async function validateUrl(url: string): Promise<void> {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Only HTTP/HTTPS URLs are allowed");
        }
        const hostname = parsed.hostname.toLowerCase();
        if (hostname.endsWith(".internal") || hostname.endsWith(".local")) {
          throw new Error("Internal hostnames are not allowed");
        }
        const metadataHosts = ["metadata.google.internal", "metadata.google", "metadata.aws", "169.254.169.254"];
        if (metadataHosts.some(h => hostname === h || hostname.endsWith("." + h))) {
          throw new Error("Cloud metadata endpoints are not allowed");
        }
        if (net.isIP(hostname)) {
          if (isPrivateIP(hostname)) throw new Error("Private IP addresses are not allowed");
        } else {
          const addresses = await dns.promises.resolve4(hostname).catch(() => [] as string[]);
          const addresses6 = await dns.promises.resolve6(hostname).catch(() => [] as string[]);
          const allAddrs = [...addresses, ...addresses6];
          if (allAddrs.length === 0) throw new Error("Could not resolve hostname");
          if (allAddrs.every(a => isPrivateIP(a))) {
            throw new Error("Hostname resolves to private IP address");
          }
        }
      }

      try {
        await validateUrl(rawUrl);
      } catch (e: any) {
        return res.status(400).json({ message: e.message || "URL validation failed" });
      }

      const MAX_REDIRECTS = 3;
      let html = "";
      try {
        let currentUrl = rawUrl;
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
          const response = await fetch(currentUrl, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "CLTMetroHub/1.0 StoryStudio" },
            redirect: "manual",
          });
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location || hop === MAX_REDIRECTS) {
              return res.status(400).json({ message: "Too many redirects" });
            }
            currentUrl = new URL(location, currentUrl).toString();
            try {
              await validateUrl(currentUrl);
            } catch (e: any) {
              return res.status(400).json({ message: `Redirect blocked: ${e.message}` });
            }
          } else {
            html = await response.text();
            break;
          }
        }
      } catch {
        return res.status(400).json({ message: "Could not fetch website" });
      }

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const phoneMatch = html.match(/(?:tel:|href="tel:)([+\d\s().-]+)/i) || html.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const addressMatch = html.match(/\d+\s+[A-Za-z\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Way|Ln|Lane|Ct|Court)[.,]?\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/i);

      res.json({
        name: titleMatch?.[1]?.trim()?.replace(/\s*[|–—-]\s*.*$/, "") || null,
        description: descMatch?.[1]?.trim() || null,
        phone: phoneMatch?.[1]?.trim() || phoneMatch?.[0]?.trim() || null,
        email: emailMatch?.[0] || null,
        address: addressMatch?.[0]?.trim() || null,
      });
    } catch (e: unknown) {
      handleError(res, e);
    }
  });

  app.get("/api/story-studio/invitations", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const invitations = await storage.listStoryInvitations();
      res.json(invitations);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.get("/api/story-studio/invitations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const inv = await storage.getStoryInvitationById(req.params.id);
      if (!inv) return res.status(404).json({ message: "Not found" });
      const responses = await storage.getIntakeResponses(inv.id);
      res.json({ invitation: inv, responses });
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-studio/invitations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        contactName: z.string().min(1),
        contactEmail: z.string().optional().nullable(),
        contactPhone: z.string().optional().nullable(),
        contactTitle: z.string().optional().nullable(),
        companyName: z.string().optional().nullable(),
        website: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        googlePlaceId: z.string().optional().nullable(),
        crmContactId: z.string().optional().nullable(),
        operatorName: z.string().min(1),
        operatorPhotoUrl: z.string().optional().nullable(),
        operatorGreeting: z.string().optional().nullable(),
        questionIds: z.array(z.string()).optional(),
        cityId: z.string().optional().nullable(),
      });
      const parsed = schema.parse(req.body);
      const token = crypto.randomBytes(24).toString("hex");
      const allQuestions = await db.select().from(interviewQuestionTemplates).orderBy(asc(interviewQuestionTemplates.displayOrder));
      const questionIds = parsed.questionIds && parsed.questionIds.length > 0
        ? parsed.questionIds
        : allQuestions.filter(q => q.isDefault).map(q => q.id);
      const selectedQuestions = allQuestions.filter(q => questionIds.includes(q.id));
      const questionSnapshots = selectedQuestions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        displayOrder: q.displayOrder,
        fieldMapping: q.fieldMapping,
      }));

      const inv = await storage.createStoryInvitation({
        ...parsed,
        token,
        status: "pending",
        questionIds,
        questionSnapshots,
        photoUrls: [],
      });

      res.status(201).json(inv);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.patch("/api/story-studio/invitations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const patchSchema = z.object({
        status: z.enum(["pending", "in_progress", "submitted", "listing_created", "archived"]).optional(),
        operatorGreeting: z.string().optional(),
        operatorPhotoUrl: z.string().optional(),
        operatorName: z.string().optional(),
        draftContent: z.string().optional(),
      }).passthrough();
      const parsed = patchSchema.parse(req.body);
      const inv = await storage.updateStoryInvitation(req.params.id, parsed);
      if (!inv) return res.status(404).json({ message: "Not found" });
      res.json(inv);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.get("/api/story-intake/:token", async (req: Request, res: Response) => {
    try {
      const inv = await storage.getStoryInvitationByToken(req.params.token);
      if (!inv) return res.status(404).json({ message: "Invitation not found" });
      if (inv.status === "archived") return res.status(410).json({ message: "This invitation is no longer active" });

      const snapshots = (inv.questionSnapshots || []) as Array<{ id: string; questionText: string; displayOrder: number; fieldMapping?: string | null }>;
      let questions: Array<{ id: string; questionText: string; displayOrder: number; fieldMapping?: string | null }>;
      if (snapshots.length > 0) {
        questions = snapshots.sort((a, b) => a.displayOrder - b.displayOrder);
      } else {
        const questionIds = (inv.questionIds || []) as string[];
        const allQuestions = await db.select().from(interviewQuestionTemplates)
          .where(questionIds.length > 0 ? inArray(interviewQuestionTemplates.id, questionIds) : undefined)
          .orderBy(asc(interviewQuestionTemplates.displayOrder));
        questions = allQuestions;
      }

      const responses = await storage.getIntakeResponses(inv.id);

      res.json({
        invitation: {
          id: inv.id,
          contactName: inv.contactName,
          companyName: inv.companyName,
          operatorName: inv.operatorName,
          operatorPhotoUrl: inv.operatorPhotoUrl,
          operatorGreeting: inv.operatorGreeting,
          status: inv.status,
          photoUrls: inv.photoUrls,
        },
        questions: questions.sort((a, b) => a.displayOrder - b.displayOrder),
        responses,
      });
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-intake/:token/save", async (req: Request, res: Response) => {
    try {
      const inv = await storage.getStoryInvitationByToken(req.params.token);
      if (!inv) return res.status(404).json({ message: "Invitation not found" });

      const schema = z.object({
        questionId: z.string(),
        questionText: z.string(),
        answerText: z.string().optional().nullable(),
        displayOrder: z.number().default(0),
      });
      const parsed = schema.parse(req.body);

      const response = await storage.upsertIntakeResponse({
        invitationId: inv.id,
        ...parsed,
      });

      if (inv.status === "pending") {
        await storage.updateStoryInvitation(inv.id, { status: "in_progress" });
      }

      res.json(response);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-intake/:token/upload-audio", audioUpload.single("audio"), async (req: Request, res: Response) => {
    try {
      const inv = await storage.getStoryInvitationByToken(req.params.token);
      if (!inv) return res.status(404).json({ message: "Invitation not found" });
      if (!req.file) return res.status(400).json({ message: "No audio file" });

      const questionId = req.body.questionId;
      const questionText = req.body.questionText || "";
      const displayOrder = parseInt(req.body.displayOrder || "0");

      const audioUrl = `/uploads/story-studio/${req.file.filename}`;

      let transcription = "";
      try {
        const audioBuffer = fs.readFileSync(req.file.path);
        const { buffer, format } = await ensureCompatibleFormat(Buffer.from(audioBuffer));
        transcription = await speechToText(buffer, format);
      } catch (err: any) {
        console.error("[StoryStudio] Transcription error:", err.message);
      }

      const response = await storage.upsertIntakeResponse({
        invitationId: inv.id,
        questionId,
        questionText,
        answerText: transcription || null,
        audioUrl,
        transcription: transcription || null,
        displayOrder,
      });

      if (inv.status === "pending") {
        await storage.updateStoryInvitation(inv.id, { status: "in_progress" });
      }

      res.json(response);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-intake/:token/upload-photo", photoUpload.single("photo"), async (req: Request, res: Response) => {
    try {
      const inv = await storage.getStoryInvitationByToken(req.params.token);
      if (!inv) return res.status(404).json({ message: "Invitation not found" });
      if (!req.file) return res.status(400).json({ message: "No photo file" });

      const photoUrl = `/uploads/story-studio/${req.file.filename}`;
      const currentPhotos = (inv.photoUrls as string[]) || [];
      currentPhotos.push(photoUrl);

      await storage.updateStoryInvitation(inv.id, { photoUrls: currentPhotos });

      res.json({ photoUrl, allPhotos: currentPhotos });
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-intake/:token/submit", async (req: Request, res: Response) => {
    try {
      const inv = await storage.getStoryInvitationByToken(req.params.token);
      if (!inv) return res.status(404).json({ message: "Invitation not found" });
      if (inv.status === "submitted" || inv.status === "listing_created") {
        return res.status(400).json({ message: "Already submitted" });
      }

      const responses = await storage.getIntakeResponses(inv.id);

      const fieldMap: Record<string, string> = {};
      const snapshots = (inv.questionSnapshots || []) as Array<{ id: string; fieldMapping?: string | null }>;
      for (const resp of responses) {
        const snap = snapshots.find(s => s.id === resp.questionId);
        if (snap?.fieldMapping && resp.answerText) {
          fieldMap[snap.fieldMapping] = resp.answerText;
        }
      }

      let businessId = inv.linkedBusinessId;
      const cityList = await storage.getAllCities();
      const city = inv.cityId ? cityList.find(c => c.id === inv.cityId) : cityList[0];
      const bizName = inv.companyName || inv.contactName;

      function buildBizUpdates(): Record<string, unknown> {
        const updates: Record<string, unknown> = { listingTier: "VERIFIED" };
        if (fieldMap.whatSpecial) updates.description = fieldMap.whatSpecial;
        if (fieldMap.hours) updates.hoursJson = { notes: fieldMap.hours };
        if (fieldMap.services) updates.servicesOffered = fieldMap.services;
        if (inv.website) updates.websiteUrl = inv.website;
        if (inv.contactPhone) updates.phone = inv.contactPhone;
        if (inv.contactEmail) updates.email = inv.contactEmail;
        return updates;
      }

      if (businessId) {
        await storage.updateBusiness(businessId, buildBizUpdates());
      } else if (city) {
        const existingBizList = await storage.getBusinessesByCityId(city.id);
        const normalizedName = bizName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
        const match = existingBizList.find(b =>
          b.name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim() === normalizedName
        );

        if (match) {
          businessId = match.id;
          await storage.updateBusiness(businessId, buildBizUpdates());
        } else {
          const slug = slugify(bizName) + "-" + Date.now();
          const zones = await storage.getZonesByCityId(city.id);
          const zoneId = zones.length > 0 ? zones[0].id : null;

          if (zoneId) {
            const biz = await storage.createBusiness({
              cityId: city.id,
              name: bizName,
              slug,
              zoneId,
              address: inv.address?.split(",")[0]?.trim() || null,
              city: city.name,
              state: "NC",
              phone: inv.contactPhone || null,
              email: inv.contactEmail || null,
              websiteUrl: inv.website || null,
              imageUrl: null,
              listingTier: "VERIFIED",
              claimStatus: "UNCLAIMED",
              description: fieldMap.whatSpecial || fieldMap.originStory || null,
              hoursJson: fieldMap.hours ? { notes: fieldMap.hours } : null,
            });
            businessId = biz.id;
          }
        }
      }

      if (inv.crmContactId) {
        const crmUpdate: Record<string, unknown> = { outreachStatus: "STORY_SUBMITTED", updatedAt: new Date() };
        if (businessId) crmUpdate.linkedBusinessId = businessId;
        await db.update(crmContacts).set(crmUpdate as typeof crmContacts.$inferInsert).where(eq(crmContacts.id, inv.crmContactId));
      }

      const finalStatus = businessId ? "listing_created" : "submitted";
      await storage.updateStoryInvitation(inv.id, {
        status: finalStatus,
        submittedAt: new Date(),
        linkedBusinessId: businessId || undefined,
      });

      createInboxItemIfNotOpen({
        itemType: "story_submission",
        relatedTable: "story_invitations",
        relatedId: inv.id,
        title: `Story submission from ${inv.contactName}${inv.companyName ? ` (${inv.companyName})` : ""}`,
        summary: `${inv.contactName} has submitted their story intake. ${responses.length} questions answered.`,
        priority: "med",
        tags: ["story-studio"],
        suggestedAction: "Review submission and draft article with Charlotte",
      }).catch(err => console.error("[StoryStudio] Inbox error:", err));

      res.json({ success: true, businessId });
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-studio/invitations/:id/draft", requireAdmin, async (req: Request, res: Response) => {
    try {
      const inv = await storage.getStoryInvitationById(req.params.id);
      if (!inv) return res.status(404).json({ message: "Not found" });

      const responses = await storage.getIntakeResponses(inv.id);

      const answersText = responses.map(r => {
        const answer = r.answerText || r.transcription || "(no answer)";
        return `Q: ${r.questionText}\nA: ${answer}`;
      }).join("\n\n");

      const operatorNotes = req.body.notes || "";

      if (!openai) {
        return res.status(503).json({ message: "AI not available" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a ghostwriter helping ${inv.operatorName} write a warm, engaging community feature article about a local business/person. Write as if ${inv.operatorName} personally wrote this article — use first person ("I recently sat down with..."), be genuine, warm, and community-focused. The article should read like a local magazine feature, not a press release. No emojis. Include a compelling title. Format as JSON: { "title": "...", "content": "..." }`,
          },
          {
            role: "user",
            content: `Write a feature article about ${inv.contactName}${inv.companyName ? ` from ${inv.companyName}` : ""}.\n\nInterview responses:\n${answersText}${operatorNotes ? `\n\nOperator notes: ${operatorNotes}` : ""}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content;
      let draft = { title: "", content: "" };
      if (raw) {
        try {
          draft = JSON.parse(raw);
        } catch {
          draft = { title: `Meet ${inv.contactName}`, content: raw };
        }
      }

      await storage.updateStoryInvitation(inv.id, {
        draftContent: JSON.stringify(draft),
      });

      res.json(draft);
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.post("/api/story-studio/invitations/:id/publish", requireAdmin, async (req: Request, res: Response) => {
    try {
      const inv = await storage.getStoryInvitationById(req.params.id);
      if (!inv) return res.status(404).json({ message: "Not found" });

      const { title, content } = req.body;
      if (!title || !content) return res.status(400).json({ message: "Title and content required" });

      const cityList = await storage.getAllCities();
      const city = inv.cityId ? cityList.find(c => c.id === inv.cityId) : cityList[0];
      if (!city) return res.status(400).json({ message: "No city found" });

      const slug = slugify(title) + "-" + Date.now();

      const article = await storage.createArticle({
        cityId: city.id,
        title,
        slug,
        excerpt: content.substring(0, 200) + "...",
        content,
        imageUrl: (inv.photoUrls as string[])?.[0] || null,
        publishedAt: new Date(),
        isFeatured: false,
        isSponsored: false,
        priorityRank: 0,
      });

      await storage.updateStoryInvitation(inv.id, {
        status: "listing_created",
        linkedArticleId: article.id,
      });

      res.json({ article });
    } catch (e: any) {
      handleError(res, e);
    }
  });

  app.use("/uploads/story-studio", (req, res, next) => {
    const filename = path.basename(req.path);
    const filePath = path.join(storyUploadsDir, filename);
    if (!filePath.startsWith(storyUploadsDir)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filename).toLowerCase();
      const safeTypes: Record<string, string> = {
        ".webm": "audio/webm", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg", ".wav": "audio/wav",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".gif": "image/gif",
      };
      const contentType = safeTypes[ext] || "application/octet-stream";
      const isMedia = contentType.startsWith("audio/") || contentType.startsWith("image/");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      res.setHeader("Content-Disposition", isMedia ? "inline" : `attachment; filename="${filename}"`);
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  });
}
