import { Router, type Request, type Response, type NextFunction } from "express";
import { db, pool } from "./db";
import { jobs, publicUsers, businesses, shopItems } from "@shared/schema";
import { isAdminSession } from "./admin-check";
import { eq, and, or, ilike, desc, sql, count } from "drizzle-orm";

const router = Router();

let adminMiddleware: (req: Request, res: Response, next: NextFunction) => void;

export function initJobBoardRoutes(requireAdmin: (req: Request, res: Response, next: NextFunction) => void) {
  adminMiddleware = requireAdmin;
}

async function ensureJobBoardTables() {
  await pool.query(`
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS business_id VARCHAR;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS posted_by_user_id VARCHAR;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_status VARCHAR DEFAULT 'active';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_commitment TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills_helpful TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_url TEXT;

    DO $$ BEGIN
      ALTER TYPE employment_type ADD VALUE IF NOT EXISTS 'VOLUNTEER';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TYPE shop_item_type ADD VALUE IF NOT EXISTS 'wishlist';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS quantity_needed INTEGER;
    ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS urgency TEXT;

    CREATE TABLE IF NOT EXISTS job_applications (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id VARCHAR NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      user_id VARCHAR,
      applicant_name TEXT NOT NULL,
      applicant_email TEXT NOT NULL,
      applicant_phone TEXT,
      resume_url TEXT,
      cover_message TEXT,
      status VARCHAR NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_applications_user ON job_applications(user_id);

    CREATE TABLE IF NOT EXISTS saved_jobs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      job_id VARCHAR NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS job_alerts (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      city_id VARCHAR NOT NULL,
      search_query TEXT,
      employment_type VARCHAR,
      remote_type VARCHAR,
      department TEXT,
      frequency VARCHAR NOT NULL DEFAULT 'weekly',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_job_alerts_user ON job_alerts(user_id);

    CREATE TABLE IF NOT EXISTS user_resumes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_user_resumes_user ON user_resumes(user_id);
  `);
}

let tablesReady = false;
async function ensureReady() {
  if (!tablesReady) {
    await ensureJobBoardTables();
    tablesReady = true;
  }
}

function getPublicUserId(req: Request): string | null {
  return (req.session as Record<string, unknown>).publicUserId as string | null;
}

function getAdminUserId(req: Request): string | null {
  return (req.session as Record<string, unknown>).userId as string | null;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120);
}

router.post("/api/jobs/employer", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    const adminBypass = await isAdminSession(req);
    if (!userId && !adminBypass) return res.status(401).json({ message: "Login required" });

    const { title, description, department, employmentType, payMin, payMax, payUnit,
            locationText, city: jobCity, stateCode, zipCode, remoteType, closesAt, businessId, cityId,
            scheduleCommitment, skillsHelpful, contactUrl } = req.body;

    if (!title || !cityId) return res.status(400).json({ message: "Title and cityId are required" });
    if (employmentType === "VOLUNTEER") {
      if (!businessId) return res.status(400).json({ message: "Volunteer opportunities must be posted by a nonprofit business" });
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Business not found" });
      if (!biz.isNonprofit) return res.status(403).json({ message: "Only nonprofits can post volunteer opportunities" });
      if (!adminBypass && biz.claimedByUserId !== userId) return res.status(403).json({ message: "You do not own this business" });
    } else if (businessId) {
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Business not found" });
      if (!adminBypass && biz.claimedByUserId !== userId) return res.status(403).json({ message: "You do not own this business" });
    }

    const slug = slugify(title) + "-" + Date.now().toString(36);
    const [user] = await db.select({ displayName: publicUsers.displayName }).from(publicUsers).where(eq(publicUsers.id, userId)).limit(1);
    const employerName = businessId
      ? (await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, businessId)).limit(1))[0]?.name
      : user?.displayName || "Unknown";

    const result = await pool.query(
      `INSERT INTO jobs (id, city_id, title, slug, employer, department, employment_type, pay_min, pay_max, pay_unit,
        location_text, city, state_code, zip_code, remote_type, description, posted_at, closes_at,
        seed_source_type, seed_source_external_id, business_id, posted_by_user_id, job_status,
        schedule_commitment, skills_helpful, contact_url)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16,
        'employer_post', gen_random_uuid(), $17, $18, 'active', $19, $20, $21)
      RETURNING *`,
      [cityId, title, slug, employerName, department || null, employmentType || null,
       payMin || null, payMax || null, payUnit || null,
       locationText || null, jobCity || null, stateCode || null, zipCode || null,
       remoteType || null, description || null, closesAt || null,
       businessId || null, userId,
       scheduleCommitment || null, skillsHelpful || null, contactUrl || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/jobs/employer/my-jobs", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    const result = await pool.query(
      `SELECT j.*, (SELECT count(*) FROM job_applications WHERE job_id = j.id) as application_count
       FROM jobs j WHERE j.posted_by_user_id = $1 ORDER BY j.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.patch("/api/jobs/employer/:jobId", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    const adminBypass = await isAdminSession(req);
    if (!userId && !adminBypass) return res.status(401).json({ message: "Login required" });

    const { rows: [existing] } = await pool.query("SELECT * FROM jobs WHERE id = $1", [req.params.jobId]);
    if (!existing) return res.status(404).json({ message: "Job not found" });
    if (!adminBypass && existing.posted_by_user_id !== userId) return res.status(403).json({ message: "Not authorized" });

    const allowed = ["title", "description", "department", "employment_type", "pay_min", "pay_max",
      "pay_unit", "location_text", "city", "state_code", "zip_code", "remote_type", "closes_at", "job_status",
      "schedule_commitment", "skills_helpful", "contact_url"];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(req.body)) {
      const dbKey = key.replace(/[A-Z]/g, l => "_" + l.toLowerCase());
      if (allowed.includes(dbKey)) {
        sets.push(`${dbKey} = $${idx}`);
        vals.push(val);
        idx++;
      }
    }
    if (sets.length === 0) return res.status(400).json({ message: "No valid fields to update" });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.jobId);

    const { rows: [updated] } = await pool.query(
      `UPDATE jobs SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, vals
    );
    res.json(updated);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.delete("/api/jobs/employer/:jobId", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    const adminBypass = await isAdminSession(req);
    if (!userId && !adminBypass) return res.status(401).json({ message: "Login required" });

    const { rows: [existing] } = await pool.query("SELECT * FROM jobs WHERE id = $1", [req.params.jobId]);
    if (!existing) return res.status(404).json({ message: "Job not found" });
    if (!adminBypass && existing.posted_by_user_id !== userId) return res.status(403).json({ message: "Not authorized" });

    await pool.query("DELETE FROM jobs WHERE id = $1", [req.params.jobId]);
    res.json({ success: true });
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/jobs/employer/:jobId/applications", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    const adminBypass = await isAdminSession(req);
    if (!userId && !adminBypass) return res.status(401).json({ message: "Login required" });

    const { rows: [existing] } = await pool.query("SELECT * FROM jobs WHERE id = $1", [req.params.jobId]);
    if (!existing) return res.status(404).json({ message: "Job not found" });
    if (!adminBypass && existing.posted_by_user_id !== userId) return res.status(403).json({ message: "Not authorized" });

    const result = await pool.query(
      "SELECT * FROM job_applications WHERE job_id = $1 ORDER BY created_at DESC",
      [req.params.jobId]
    );
    res.json(result.rows);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.patch("/api/jobs/employer/applications/:appId/status", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    const adminBypass = await isAdminSession(req);
    if (!userId && !adminBypass) return res.status(401).json({ message: "Login required" });

    const { status } = req.body;
    if (!["pending", "reviewed", "shortlisted", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const { rows: [app] } = await pool.query("SELECT * FROM job_applications WHERE id = $1", [req.params.appId]);
    if (!app) return res.status(404).json({ message: "Application not found" });

    const { rows: [job] } = await pool.query("SELECT * FROM jobs WHERE id = $1", [app.job_id]);
    if (!adminBypass && (!job || job.posted_by_user_id !== userId)) return res.status(403).json({ message: "Not authorized" });

    const { rows: [updated] } = await pool.query(
      "UPDATE job_applications SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.appId]
    );
    res.json(updated);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.post("/api/jobs/:jobId/apply", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);

    const { applicantName, applicantEmail, applicantPhone, resumeUrl, coverMessage } = req.body;
    if (!applicantName || !applicantEmail) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const { rows: [job] } = await pool.query("SELECT * FROM jobs WHERE id = $1", [req.params.jobId]);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.job_status !== "active") return res.status(400).json({ message: "This job is no longer accepting applications" });

    if (userId) {
      const { rows: existing } = await pool.query(
        "SELECT id FROM job_applications WHERE job_id = $1 AND user_id = $2",
        [req.params.jobId, userId]
      );
      if (existing.length > 0) return res.status(409).json({ message: "You have already applied to this job" });
    }

    const { rows: [application] } = await pool.query(
      `INSERT INTO job_applications (job_id, user_id, applicant_name, applicant_email, applicant_phone, resume_url, cover_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.jobId, userId || null, applicantName, applicantEmail, applicantPhone || null, resumeUrl || null, coverMessage || null]
    );

    res.status(201).json(application);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.post("/api/jobs/:jobId/save", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    await pool.query(
      "INSERT INTO saved_jobs (user_id, job_id) VALUES ($1, $2) ON CONFLICT (user_id, job_id) DO NOTHING",
      [userId, req.params.jobId]
    );
    res.json({ saved: true });
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.delete("/api/jobs/:jobId/save", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    await pool.query("DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2", [userId, req.params.jobId]);
    res.json({ saved: false });
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/jobs/saved", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    const result = await pool.query(
      `SELECT j.*, TRUE as is_saved FROM jobs j
       INNER JOIN saved_jobs sj ON sj.job_id = j.id
       WHERE sj.user_id = $1 ORDER BY sj.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/jobs/saved-ids", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.json([]);

    const result = await pool.query("SELECT job_id FROM saved_jobs WHERE user_id = $1", [userId]);
    res.json(result.rows.map((r: Record<string, string>) => r.job_id));
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.post("/api/jobs/alerts", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    const { cityId, searchQuery, employmentType, remoteType, department, frequency } = req.body;
    if (!cityId) return res.status(400).json({ message: "cityId is required" });

    const { rows: [alert] } = await pool.query(
      `INSERT INTO job_alerts (user_id, city_id, search_query, employment_type, remote_type, department, frequency)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, cityId, searchQuery || null, employmentType || null, remoteType || null, department || null, frequency || "weekly"]
    );
    res.status(201).json(alert);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/jobs/alerts", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    const result = await pool.query(
      "SELECT * FROM job_alerts WHERE user_id = $1 ORDER BY created_at DESC", [userId]
    );
    res.json(result.rows);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.delete("/api/jobs/alerts/:alertId", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    await pool.query("DELETE FROM job_alerts WHERE id = $1 AND user_id = $2", [req.params.alertId, userId]);
    res.json({ success: true });
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.post("/api/jobs/resume", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    const { fileName, fileUrl } = req.body;
    if (!fileName || !fileUrl) return res.status(400).json({ message: "fileName and fileUrl are required" });

    await pool.query("UPDATE user_resumes SET is_default = FALSE WHERE user_id = $1", [userId]);

    const { rows: [resume] } = await pool.query(
      `INSERT INTO user_resumes (user_id, file_name, file_url, is_default) VALUES ($1, $2, $3, TRUE) RETURNING *`,
      [userId, fileName, fileUrl]
    );
    res.status(201).json(resume);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/jobs/resume", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    const result = await pool.query(
      "SELECT * FROM user_resumes WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.delete("/api/jobs/resume/:resumeId", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ message: "Login required" });

    await pool.query("DELETE FROM user_resumes WHERE id = $1 AND user_id = $2", [req.params.resumeId, userId]);
    res.json({ success: true });
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/jobs/:jobId", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { rows: [job] } = await pool.query("SELECT * FROM jobs WHERE id = $1", [req.params.jobId]);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const userId = getPublicUserId(req);
    const adminId = getAdminUserId(req);
    const isOwner = userId && job.posted_by_user_id === userId;
    const isAdmin = !!adminId;
    if (job.job_status && job.job_status !== "active" && !isOwner && !isAdmin) {
      return res.status(404).json({ message: "Job not found" });
    }

    let isSaved = false;
    let hasApplied = false;
    if (userId) {
      const { rows: savedRows } = await pool.query(
        "SELECT id FROM saved_jobs WHERE user_id = $1 AND job_id = $2", [userId, req.params.jobId]
      );
      isSaved = savedRows.length > 0;
      const { rows: appRows } = await pool.query(
        "SELECT id FROM job_applications WHERE user_id = $1 AND job_id = $2", [userId, req.params.jobId]
      );
      hasApplied = appRows.length > 0;
    }

    res.json({ ...job, isSaved, hasApplied });
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/admin/jobs", (req, res, next) => { if (adminMiddleware) adminMiddleware(req, res, next); else next(); }, async (req: Request, res: Response) => {
  try {
    await ensureReady();

    const status = req.query.status as string || "";
    let whereClause = "WHERE j.posted_by_user_id IS NOT NULL";
    const params: string[] = [];
    if (status && status !== "all") {
      params.push(status);
      whereClause += ` AND j.job_status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT j.*, (SELECT count(*) FROM job_applications WHERE job_id = j.id) as application_count
       FROM jobs j ${whereClause} ORDER BY j.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.patch("/api/admin/jobs/:jobId", (req, res, next) => { if (adminMiddleware) adminMiddleware(req, res, next); else next(); }, async (req: Request, res: Response) => {
  try {
    await ensureReady();

    const { jobStatus } = req.body;
    if (!["active", "closed", "pending_review", "rejected"].includes(jobStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const { rows: [updated] } = await pool.query(
      "UPDATE jobs SET job_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [jobStatus, req.params.jobId]
    );
    if (!updated) return res.status(404).json({ message: "Job not found" });
    res.json(updated);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

router.get("/api/admin/jobs/stats", (req, res, next) => { if (adminMiddleware) adminMiddleware(req, res, next); else next(); }, async (req: Request, res: Response) => {
  try {
    await ensureReady();

    const result = await pool.query(`
      SELECT
        (SELECT count(*) FROM jobs WHERE posted_by_user_id IS NOT NULL) as employer_posts,
        (SELECT count(*) FROM jobs WHERE posted_by_user_id IS NOT NULL AND job_status = 'active') as active_posts,
        (SELECT count(*) FROM job_applications) as total_applications,
        (SELECT count(*) FROM saved_jobs) as total_saves,
        (SELECT count(*) FROM job_alerts WHERE is_active = TRUE) as active_alerts
    `);
    res.json(result.rows[0]);
  } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
});

export default router;
