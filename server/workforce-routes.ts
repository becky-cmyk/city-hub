import { Router, type Request, type Response } from "express";
import { storage } from "./storage";
import { isAdminSession } from "./admin-check";
import { z } from "zod";
import { insertApplicantProfileSchema, insertApplicantSkillSchema, insertApplicantCredentialSchema, insertApplicantResumeSchema, insertBusinessHiringProfileSchema, insertJobApplicationSchema, insertJobListingSchema, insertApplicantCredentialJurisdictionSchema } from "@shared/schema";
import { db } from "./db";
import { eq, sql, asc } from "drizzle-orm";
import { businesses, applicantProfiles, applicantSkills, applicantCredentials, applicantCredentialJurisdictions, businessHiringProfiles, skillCategories, credentialDirectory, jobListings, jobApplications, publicUsers, zones, jobCategories, insertJobCategorySchema } from "@shared/schema";

const router = Router();

interface WorkforceSession {
  publicUserId?: string;
  userId?: string;
}

function getSessionData(req: Request): WorkforceSession {
  return req.session as WorkforceSession;
}

function getPublicUserId(req: Request): string | null {
  return getSessionData(req).publicUserId || null;
}

function requirePublicAuth(req: Request, res: Response): string | null {
  const userId = getPublicUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Login required" });
    return null;
  }
  return userId;
}

async function requirePublicOrAdmin(req: Request, res: Response): Promise<{ userId: string | null; isAdmin: boolean }> {
  const userId = getPublicUserId(req) || null;
  const admin = await isAdminSession(req);
  if (!userId && !admin) { res.status(401).json({ message: "Login required" }); }
  return { userId, isAdmin: admin };
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!getSessionData(req).userId) {
    res.status(401).json({ message: "Admin login required" });
    return false;
  }
  return true;
}

router.post("/api/workforce/applicant-profile", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const existing = await storage.getApplicantProfileByUserId(userId);
    if (existing) return res.status(409).json({ message: "Profile already exists" });
    const data = insertApplicantProfileSchema.parse({ ...req.body, userId });
    const profile = await storage.createApplicantProfile(data);
    res.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.get("/api/workforce/applicant-profile", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile found" });
    res.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/workforce/applicant-profile", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile found" });
    const allowedFields = insertApplicantProfileSchema.partial().omit({ userId: true }).safeParse(req.body);
    if (!allowedFields.success) return res.status(400).json({ message: "Invalid data", errors: allowedFields.error.flatten() });
    const updated = await storage.updateApplicantProfile(profile.id, allowedFields.data);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.post("/api/workforce/applicant-skills", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "Create an applicant profile first" });
    const data = insertApplicantSkillSchema.parse({ ...req.body, applicantId: profile.id });
    const skill = await storage.addApplicantSkill(data);
    res.json(skill);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.get("/api/workforce/applicant-skills", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.json([]);
    const skills = await storage.listApplicantSkills(profile.id);
    res.json(skills);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.delete("/api/workforce/applicant-skills/:id", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    const [skill] = await db.select().from(applicantSkills).where(eq(applicantSkills.id, req.params.id));
    if (!skill || skill.applicantId !== profile.id) return res.status(403).json({ message: "Not your skill record" });
    await storage.removeApplicantSkill(req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/workforce/applicant-credentials", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "Create an applicant profile first" });
    const data = insertApplicantCredentialSchema.parse({ ...req.body, applicantId: profile.id });
    const cred = await storage.addApplicantCredential(data);
    res.json(cred);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.get("/api/workforce/applicant-credentials", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.json([]);
    const creds = await storage.listApplicantCredentials(profile.id);
    res.json(creds);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/workforce/applicant-credentials/:id", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    const [cred] = await db.select().from(applicantCredentials).where(eq(applicantCredentials.id, req.params.id));
    if (!cred || cred.applicantId !== profile.id) return res.status(403).json({ message: "Not your credential" });
    const { applicantId, id, ...safeUpdates } = req.body;
    const updated = await storage.updateApplicantCredential(req.params.id, safeUpdates);
    if (!updated) return res.status(404).json({ message: "Credential not found" });
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.delete("/api/workforce/applicant-credentials/:id", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    const [cred] = await db.select().from(applicantCredentials).where(eq(applicantCredentials.id, req.params.id));
    if (!cred || cred.applicantId !== profile.id) return res.status(403).json({ message: "Not your credential" });
    await db.delete(applicantCredentials).where(eq(applicantCredentials.id, req.params.id));
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/workforce/applicant-resumes", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "Create an applicant profile first" });
    const data = insertApplicantResumeSchema.parse({ ...req.body, applicantId: profile.id });
    const resume = await storage.addApplicantResume(data);
    res.json(resume);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.get("/api/workforce/applicant-resumes", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.json([]);
    const resumes = await storage.listApplicantResumes(profile.id);
    res.json(resumes);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.delete("/api/workforce/applicant-resumes/:id", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    const resumes = await storage.listApplicantResumes(profile.id);
    const resume = resumes.find(r => r.id === req.params.id);
    if (!resume) return res.status(403).json({ message: "Not your resume" });
    await storage.deleteApplicantResume(req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/workforce/applicant-resumes/:id/set-primary", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    await storage.setPrimaryResume(profile.id, req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/workforce/skill-taxonomy", async (_req: Request, res: Response) => {
  try {
    const taxonomy = await storage.getFullSkillTaxonomy();
    res.json(taxonomy);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/workforce/credential-directory", async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const creds = q ? await storage.searchCredentialDirectory(q) : await storage.listCredentialDirectory();
    res.json(creds);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/workforce/my-business", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const [biz] = await db.select({ id: businesses.id, name: businesses.name, slug: businesses.slug })
      .from(businesses).where(eq(businesses.claimedByUserId, userId)).limit(1);
    if (!biz) return res.status(404).json({ message: "No claimed business" });
    res.json(biz);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/workforce/employer-hiring-profile", async (req: Request, res: Response) => {
  const { userId, isAdmin: adminBypass } = await requirePublicOrAdmin(req, res);
  if (!userId && !adminBypass) return;
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ message: "businessId required" });
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!biz) return res.status(404).json({ message: "Business not found" });
    if (!adminBypass && biz.claimedByUserId !== userId) return res.status(403).json({ message: "You must be the owner of this business" });
    const existing = await storage.getBusinessHiringProfile(businessId);
    if (existing) return res.status(409).json({ message: "Hiring profile already exists" });
    const data = insertBusinessHiringProfileSchema.parse(req.body);
    const profile = await storage.createBusinessHiringProfile(data);
    res.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.get("/api/workforce/employer-hiring-profile", async (req: Request, res: Response) => {
  const { userId, isAdmin: adminBypass } = await requirePublicOrAdmin(req, res);
  if (!userId && !adminBypass) return;
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ message: "businessId query param required" });
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!biz) return res.status(404).json({ message: "Business not found" });
    if (!adminBypass && biz.claimedByUserId !== userId) return res.status(403).json({ message: "You must be the owner of this business" });
    const profile = await storage.getBusinessHiringProfile(businessId);
    if (!profile) return res.status(404).json({ message: "No hiring profile found" });
    res.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/workforce/employer-hiring-profile", async (req: Request, res: Response) => {
  const { userId, isAdmin: adminBypass } = await requirePublicOrAdmin(req, res);
  if (!userId && !adminBypass) return;
  try {
    const { businessId, ...updates } = req.body;
    if (!businessId) return res.status(400).json({ message: "businessId required" });
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!biz) return res.status(404).json({ message: "Business not found" });
    if (!adminBypass && biz.claimedByUserId !== userId) return res.status(403).json({ message: "You must be the owner of this business" });
    const profile = await storage.getBusinessHiringProfile(businessId);
    if (!profile) return res.status(404).json({ message: "No hiring profile found" });
    const allowedFields = insertBusinessHiringProfileSchema.partial().omit({ businessId: true }).safeParse(updates);
    if (!allowedFields.success) return res.status(400).json({ message: "Invalid data", errors: allowedFields.error.flatten() });
    const updated = await storage.updateBusinessHiringProfile(profile.id, allowedFields.data);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.post("/api/workforce/job-listings", async (req: Request, res: Response) => {
  const { userId, isAdmin: adminBypass } = await requirePublicOrAdmin(req, res);
  if (!userId && !adminBypass) return;
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ message: "businessId required" });
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!biz) return res.status(404).json({ message: "Business not found" });
    if (!adminBypass && biz.claimedByUserId !== userId) return res.status(403).json({ message: "You must be the owner of this business" });
    const data = insertJobListingSchema.parse({ ...req.body, cityId: biz.cityId });
    if (!data.latitude || !data.longitude) {
      if (data.location) {
        try {
          const { geocodeAddress } = await import("./services/geocoding");
          const coords = await geocodeAddress(data.location);
          if (coords) { data.latitude = coords.latitude; data.longitude = coords.longitude; }
        } catch (e) { console.error("[Workforce] Job geocode:", e instanceof Error ? e.message : e); }
      }
      if (!data.latitude || !data.longitude) {
        if (biz.latitude && biz.longitude) {
          data.latitude = String(biz.latitude);
          data.longitude = String(biz.longitude);
        }
      }
      if (!data.latitude || !data.longitude) {
        if (data.zoneId || biz.zoneId) {
          try {
            const { getZoneCentroid } = await import("./services/geocoding");
            const centroid = await getZoneCentroid((data.zoneId || biz.zoneId)!);
            if (centroid) { data.latitude = centroid.latitude; data.longitude = centroid.longitude; }
          } catch {}
        }
      }
    }
    const listing = await storage.createJobListing(data);
    res.json(listing);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.get("/api/workforce/job-listings", async (req: Request, res: Response) => {
  const { userId, isAdmin: adminBypass } = await requirePublicOrAdmin(req, res);
  if (!userId && !adminBypass) return;
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ message: "businessId query param required" });
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!biz) return res.status(404).json({ message: "Business not found" });
    if (!adminBypass && biz.claimedByUserId !== userId) return res.status(403).json({ message: "You must be the owner of this business" });
    const listings = await storage.listJobListingsByBusiness(businessId);
    res.json(listings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/workforce/job-listings/:id", async (req: Request, res: Response) => {
  const { userId, isAdmin: adminBypass } = await requirePublicOrAdmin(req, res);
  if (!userId && !adminBypass) return;
  try {
    const listing = await storage.getJobListingById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, listing.businessId));
    if (!adminBypass && (!biz || biz.claimedByUserId !== userId)) return res.status(403).json({ message: "Not your listing" });
    const { id, businessId, createdAt, ...safeUpdates } = req.body;
    const updated = await storage.updateJobListing(req.params.id, safeUpdates);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.post("/api/workforce/job-applications", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "Create an applicant profile first" });
    const jobListingId = req.body.jobListingId || req.body.listingId;
    const listing = await storage.getJobListingById(jobListingId);
    if (!listing) return res.status(404).json({ message: "Job listing not found" });
    const data = insertJobApplicationSchema.parse({ ...req.body, applicantId: profile.id, jobListingId });
    const application = await storage.createJobApplication(data);
    res.json(application);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.get("/api/workforce/my-applications", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.json([]);
    const applications = await storage.listJobApplicationsByApplicant(profile.id);
    res.json(applications);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/workforce/job-applications/:listingId", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const listing = await storage.getJobListingById(req.params.listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, listing.businessId));
    if (!biz || biz.claimedByUserId !== userId) return res.status(403).json({ message: "Not your listing" });
    const applications = await storage.listJobApplicationsByListing(req.params.listingId);
    res.json(applications);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/workforce/job-applications/:id/status", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const application = await storage.getJobApplicationById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    const listing = await storage.getJobListingById(application.jobListingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, listing.businessId));
    if (!biz || biz.claimedByUserId !== userId) return res.status(403).json({ message: "Not your listing" });
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateJobApplication(req.params.id, { status });
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.get("/api/workforce/hiring-businesses", async (req: Request, res: Response) => {
  try {
    const zoneId = req.query.zoneId as string | undefined;
    const hiringBusinesses = await storage.listActivelyHiringBusinesses(zoneId);
    res.json(hiringBusinesses);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

// Skill top-skill toggle
router.patch("/api/workforce/applicant-skills/:id", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    const [skill] = await db.select().from(applicantSkills).where(eq(applicantSkills.id, req.params.id));
    if (!skill || skill.applicantId !== profile.id) return res.status(403).json({ message: "Not your skill record" });
    const updateSchema = z.object({
      isTopSkill: z.boolean().optional(),
      level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]).optional(),
      yearsUsed: z.number().int().min(0).nullable().optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    const updated = await storage.updateApplicantSkill(req.params.id, parsed.data);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

// Credential jurisdiction CRUD
router.get("/api/workforce/credential-jurisdictions/:credentialId", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    const [cred] = await db.select().from(applicantCredentials).where(eq(applicantCredentials.id, req.params.credentialId));
    if (!cred || cred.applicantId !== profile.id) return res.status(403).json({ message: "Not your credential" });
    const jurisdictions = await storage.listCredentialJurisdictions(req.params.credentialId);
    res.json(jurisdictions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/workforce/credential-jurisdictions", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    const { credentialRecordId } = req.body;
    const [cred] = await db.select().from(applicantCredentials).where(eq(applicantCredentials.id, credentialRecordId));
    if (!cred || cred.applicantId !== profile.id) return res.status(403).json({ message: "Not your credential" });
    const data = insertApplicantCredentialJurisdictionSchema.parse(req.body);
    const jurisdiction = await storage.addCredentialJurisdiction(data);
    res.json(jurisdiction);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ message });
  }
});

router.delete("/api/workforce/credential-jurisdictions/:id", async (req: Request, res: Response) => {
  const userId = requirePublicAuth(req, res);
  if (!userId) return;
  try {
    const profile = await storage.getApplicantProfileByUserId(userId);
    if (!profile) return res.status(404).json({ message: "No applicant profile" });
    const [j] = await db.select().from(applicantCredentialJurisdictions).where(eq(applicantCredentialJurisdictions.id, req.params.id));
    if (!j) return res.status(404).json({ message: "Jurisdiction not found" });
    const [cred] = await db.select().from(applicantCredentials).where(eq(applicantCredentials.id, j.credentialRecordId));
    if (!cred || cred.applicantId !== profile.id) return res.status(403).json({ message: "Not your credential" });
    await storage.deleteCredentialJurisdiction(req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

// Public applicant profile (respects visibility)
router.get("/api/workforce/public/applicant/:id", async (req: Request, res: Response) => {
  try {
    const profile = await storage.getApplicantProfileById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Applicant not found" });
    if (profile.visibilityLevel !== "PUBLIC") return res.status(404).json({ message: "Profile is not publicly visible" });

    const [user] = await db.select({ displayName: publicUsers.displayName, avatarUrl: publicUsers.avatarUrl }).from(publicUsers).where(eq(publicUsers.id, profile.userId));
    const skills = await storage.listApplicantSkills(profile.id);
    const credentials = await storage.listApplicantCredentials(profile.id);

    let zone = null;
    if (profile.zoneId) {
      const [z] = await db.select({ name: zones.name, slug: zones.slug }).from(zones).where(eq(zones.id, profile.zoneId));
      zone = z || null;
    }

    res.json({
      profile: {
        id: profile.id,
        headline: profile.headline,
        summary: profile.summary,
        availabilityType: profile.availabilityType,
        desiredRoles: profile.desiredRoles,
        desiredIndustries: profile.desiredIndustries,
        yearsExperience: profile.yearsExperience,
        highestEducation: profile.highestEducation,
        remotePreference: profile.remotePreference,
        visibilityLevel: profile.visibilityLevel,
      },
      user: user || { displayName: "Anonymous", avatarUrl: null },
      zone,
      skills: skills.map(s => ({
        skillName: s.skillName,
        subcategoryName: s.subcategoryName,
        categoryName: s.categoryName,
        level: s.level,
        yearsUsed: s.yearsUsed,
        isTopSkill: s.isTopSkill,
      })),
      credentials: credentials.map(c => ({
        credentialName: c.credentialName,
        verificationStatus: c.verificationStatus,
        expirationDate: c.expirationDate,
        isCustom: c.isCustom,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

// Public employer hiring profile
router.get("/api/workforce/public/employer/:businessId", async (req: Request, res: Response) => {
  try {
    const profile = await storage.getPublicBusinessHiringProfile(req.params.businessId);
    if (!profile) return res.status(404).json({ message: "Hiring profile not found" });

    const listings = await storage.listJobListingsByBusiness(req.params.businessId);
    const activeListings = listings.filter(l => l.status === "ACTIVE");

    res.json({
      profile: {
        id: profile.id,
        businessId: profile.businessId,
        businessName: profile.businessName,
        businessSlug: profile.businessSlug,
        hiringStatus: profile.hiringStatus,
        companyDescription: profile.companyDescription,
        typicalRoles: profile.typicalRoles,
        industries: profile.industries,
        benefitsOffered: profile.benefitsOffered,
        applicationUrl: profile.applicationUrl,
        workplaceSummary: profile.workplaceSummary,
        cultureDescription: profile.cultureDescription,
        hiringContactMethod: profile.hiringContactMethod,
        verificationBadges: profile.verificationBadges,
      },
      activeJobs: activeListings.map(j => ({
        id: j.id,
        title: j.title,
        employmentType: j.employmentType,
        location: j.location,
        isRemote: j.isRemote,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/admin/workforce/overview", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const defaultStats = {
    applicantProfiles: 0,
    activeHiringBusinesses: 0,
    totalSkills: 0,
    pendingCredentials: 0,
    jobListings: 0,
  };

  function isSchemaError(e: unknown): boolean {
    if (!(e instanceof Error)) return false;
    const msg = e.message || "";
    const errObj = e as Record<string, unknown>;
    const code = typeof errObj.code === "string" ? errObj.code : "";
    return msg.includes("does not exist") || msg.includes("relation") || code === "42P01";
  }

  try {
    const schemaErrors: string[] = [];

    let stats = defaultStats;
    try {
      stats = await storage.getWorkforceStats();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[workforce-overview] Failed to load stats:", msg);
      if (isSchemaError(e)) schemaErrors.push(`Stats: ${msg}`);
    }

    let topSkills: { category_name: string; usage_count: number }[] = [];
    try {
      const topSkillsResult = await db.execute(sql`
        SELECT sc.name as category_name, COUNT(asl.id)::int as usage_count
        FROM applicant_skills asl
        JOIN skills s ON s.id = asl.skill_id
        JOIN skill_subcategories ss ON ss.id = s.subcategory_id
        JOIN skill_categories sc ON sc.id = ss.category_id
        GROUP BY sc.name
        ORDER BY usage_count DESC
        LIMIT 10
      `);
      topSkills = topSkillsResult.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[workforce-overview] Failed to load top skills:", msg);
      if (isSchemaError(e)) schemaErrors.push(`Top skills: ${msg}`);
    }

    let credentialPipeline: { verification_status: string; count: number }[] = [];
    try {
      const credPipelineResult = await db.execute(sql`
        SELECT verification_status, COUNT(*)::int as count
        FROM applicant_credentials
        GROUP BY verification_status
        ORDER BY count DESC
      `);
      credentialPipeline = credPipelineResult.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[workforce-overview] Failed to load credential pipeline:", msg);
      if (isSchemaError(e)) schemaErrors.push(`Credential pipeline: ${msg}`);
    }

    let activeHiringBusinesses: { business_name: string; business_slug: string; hiring_status: string; typical_roles: string[] }[] = [];
    try {
      const activeHiringResult = await db.execute(sql`
        SELECT b.name as business_name, b.slug as business_slug, bhp.hiring_status, bhp.typical_roles
        FROM business_hiring_profiles bhp
        JOIN businesses b ON b.id = bhp.business_id
        WHERE bhp.hiring_status = 'ACTIVELY_HIRING'
        ORDER BY bhp.updated_at DESC
        LIMIT 20
      `);
      activeHiringBusinesses = activeHiringResult.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[workforce-overview] Failed to load active hiring:", msg);
      if (isSchemaError(e)) schemaErrors.push(`Active hiring: ${msg}`);
    }

    let jobListingsByStatus: { status: string; count: number }[] = [];
    try {
      const jobListingCountResult = await db.execute(sql`
        SELECT status, COUNT(*)::int as count
        FROM job_listings
        GROUP BY status
      `);
      jobListingsByStatus = jobListingCountResult.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[workforce-overview] Failed to load job listings by status:", msg);
      if (isSchemaError(e)) schemaErrors.push(`Job listings: ${msg}`);
    }

    if (schemaErrors.length > 0) {
      console.error("[workforce-overview] Schema errors detected:", schemaErrors);
      return res.status(500).json({
        message: `Database schema issue: required tables are missing. Run migrations to fix. Details: ${schemaErrors.join("; ")}`,
      });
    }

    res.json({
      stats,
      topSkills,
      credentialPipeline,
      activeHiringBusinesses,
      jobListingsByStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[workforce-overview] Unhandled error:", message);
    res.status(500).json({ message });
  }
});

router.get("/api/admin/charlotte/workforce-query", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { type, userId, businessId, zoneId } = req.query;

    if (type === "applicant-summary" && userId) {
      const profile = await storage.getApplicantProfileByUserId(userId as string);
      if (!profile) return res.json({ profile: null, skills: [], credentials: [] });
      const skills = await storage.listApplicantSkills(profile.id);
      const credentials = await storage.listApplicantCredentials(profile.id);
      return res.json({ profile, skills, credentials });
    }

    if (type === "employer-summary" && businessId) {
      const hiringProfile = await storage.getBusinessHiringProfile(businessId as string);
      const listings = await storage.listJobListingsByBusiness(businessId as string);
      return res.json({ hiringProfile: hiringProfile || null, jobListings: listings });
    }

    if (type === "zone-hiring-activity" && zoneId) {
      const hiringBusinesses = await storage.listActivelyHiringBusinesses(zoneId as string);
      const profilesInZone = await storage.listApplicantProfilesByZone(zoneId as string);
      return res.json({
        activeHiringBusinesses: hiringBusinesses.length,
        applicantProfilesInZone: profilesInZone.length,
        businesses: hiringBusinesses.slice(0, 10),
      });
    }

    return res.status(400).json({ message: "Provide type=applicant-summary|employer-summary|zone-hiring-activity with appropriate params" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/admin/job-categories", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await db.select().from(jobCategories).orderBy(asc(jobCategories.sortOrder));
    res.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[job-categories] list error:", message);
    res.status(500).json({ message });
  }
});

router.post("/api/admin/job-categories", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const parsed = insertJobCategorySchema.parse(req.body);
    const [created] = await db.insert(jobCategories).values(parsed).returning();
    res.json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[job-categories] create error:", message);
    res.status(400).json({ message });
  }
});

router.patch("/api/admin/job-categories/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const { name, slug, description, icon, sortOrder, isActive } = req.body as {
      name?: string; slug?: string; description?: string | null;
      icon?: string | null; sortOrder?: number; isActive?: boolean;
    };
    const updates: Partial<{ name: string; slug: string; description: string | null; icon: string | null; sortOrder: number; isActive: boolean }> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(jobCategories).set(updates).where(eq(jobCategories.id, id)).returning();
    if (!updated) return res.status(404).json({ message: "Job category not found" });
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[job-categories] update error:", message);
    res.status(400).json({ message });
  }
});

router.delete("/api/admin/job-categories/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const [deleted] = await db.delete(jobCategories).where(eq(jobCategories.id, id)).returning();
    if (!deleted) return res.status(404).json({ message: "Job category not found" });
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[job-categories] delete error:", message);
    res.status(500).json({ message });
  }
});

export default router;
