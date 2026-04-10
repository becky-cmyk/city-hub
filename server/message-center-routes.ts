import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";

let pool: any;
async function ensurePool() {
  if (!pool) {
    const dbModule = await import("./db");
    pool = dbModule.pool;
  }
  return pool;
}

const router = Router();

const VALID_ENGINES = ["crown", "outreach", "events", "digest", "crm", "general", "sms", "venue_tv", "pulse"] as const;
const VALID_CHANNELS = ["email", "sms", "pulse_draft", "venue_tv", "print", "in_app"] as const;
const VALID_STATUSES = ["draft", "queued", "sent", "delivered", "failed", "bounced", "canceled"] as const;

const isPlatformAdminRole = (role: string | undefined) =>
  role === "SUPER_ADMIN" || role === "PLATFORM_ADMIN";

async function getAuthorizedCityId(req: Request, requestedCityId?: string): Promise<{ cityId: string | null; forbidden: boolean }> {
  const session = req.session as Record<string, unknown>;
  const userId = session.userId as string | undefined;
  if (!userId) return { cityId: null, forbidden: true };
  const user = await storage.getUserById(userId);
  if (!user) return { cityId: null, forbidden: true };
  if (isPlatformAdminRole(user.role)) {
    return { cityId: requestedCityId || null, forbidden: false };
  }
  if (user.role === "CITY_ADMIN" && user.cityId) {
    if (requestedCityId && requestedCityId !== user.cityId) {
      return { cityId: null, forbidden: true };
    }
    return { cityId: user.cityId, forbidden: false };
  }
  return { cityId: null, forbidden: true };
}

async function ensureMessageCenterTables() {
  const pool = await ensurePool();
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_msg_engine') THEN
        CREATE TYPE platform_msg_engine AS ENUM ('crown','outreach','events','digest','crm','general','sms','venue_tv','pulse');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_msg_channel') THEN
        CREATE TYPE platform_msg_channel AS ENUM ('email','sms','pulse_draft','venue_tv','print','in_app');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_msg_status') THEN
        CREATE TYPE platform_msg_status AS ENUM ('draft','queued','sent','delivered','failed','bounced','canceled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_tpl_status') THEN
        CREATE TYPE platform_tpl_status AS ENUM ('draft','active','archived');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS platform_messages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      city_id VARCHAR REFERENCES cities(id),
      source_engine platform_msg_engine NOT NULL DEFAULT 'general',
      channel platform_msg_channel NOT NULL DEFAULT 'email',
      status platform_msg_status NOT NULL DEFAULT 'queued',
      recipient_address VARCHAR,
      recipient_name VARCHAR,
      subject VARCHAR,
      body_preview TEXT,
      template_id VARCHAR,
      campaign_id VARCHAR,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pm_city_idx ON platform_messages(city_id);
    CREATE INDEX IF NOT EXISTS pm_engine_idx ON platform_messages(source_engine);
    CREATE INDEX IF NOT EXISTS pm_channel_idx ON platform_messages(channel);
    CREATE INDEX IF NOT EXISTS pm_status_idx ON platform_messages(status);
    CREATE INDEX IF NOT EXISTS pm_created_idx ON platform_messages(created_at DESC);

    CREATE TABLE IF NOT EXISTS platform_message_templates (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      city_id VARCHAR REFERENCES cities(id),
      name VARCHAR NOT NULL,
      engine_tag platform_msg_engine NOT NULL DEFAULT 'general',
      channel platform_msg_channel NOT NULL DEFAULT 'email',
      subject_template VARCHAR,
      body_template TEXT,
      variables JSONB NOT NULL DEFAULT '[]'::jsonb,
      status platform_tpl_status NOT NULL DEFAULT 'draft',
      created_by VARCHAR,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pmt_city_idx ON platform_message_templates(city_id);
    CREATE INDEX IF NOT EXISTS pmt_engine_idx ON platform_message_templates(engine_tag);
    CREATE INDEX IF NOT EXISTS pmt_channel_idx ON platform_message_templates(channel);
  `);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pm_template_fk'
        AND table_name = 'platform_messages'
      ) THEN
        ALTER TABLE platform_messages
          ADD CONSTRAINT pm_template_fk
          FOREIGN KEY (template_id) REFERENCES platform_message_templates(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
}

let tablesReady = false;
async function ensureReady() {
  if (!tablesReady) {
    await ensureMessageCenterTables();
    tablesReady = true;
  }
}

export interface RecordPlatformMessageParams {
  cityId?: string;
  sourceEngine: string;
  channel: string;
  status?: string;
  recipientAddress?: string;
  recipientName?: string;
  subject?: string;
  bodyPreview?: string;
  templateId?: string;
  campaignId?: string;
  metadata?: Record<string, unknown>;
  sentAt?: Date;
}

export async function recordPlatformMessage(params: RecordPlatformMessageParams): Promise<string> {
  await ensureReady();
  const pool = await ensurePool();
  const {
    cityId, sourceEngine, channel, status = "sent",
    recipientAddress, recipientName, subject, bodyPreview,
    templateId, campaignId, metadata = {}, sentAt,
  } = params;

  const result = await pool.query(
    `INSERT INTO platform_messages (city_id, source_engine, channel, status, recipient_address, recipient_name, subject, body_preview, template_id, campaign_id, metadata, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [
      cityId || null, sourceEngine, channel, status,
      recipientAddress || null, recipientName || null,
      subject || null, bodyPreview ? bodyPreview.substring(0, 500) : null,
      templateId || null, campaignId || null,
      JSON.stringify(metadata), sentAt || new Date(),
    ]
  );
  return result.rows[0].id;
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  const session = req.session as Record<string, unknown>;
  if (!session.userId) return res.status(401).json({ message: "Not authenticated" });
  next();
}

router.get("/api/admin/message-center/messages", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const pool = await ensurePool();
    const { engine, channel, status, limit: limitStr, offset: offsetStr, search, fromDate, toDate } = req.query;
    const auth = await getAuthorizedCityId(req, req.query.cityId as string | undefined);
    if (auth.forbidden) return res.status(403).json({ message: "Forbidden" });

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (auth.cityId) {
      conditions.push(`city_id = $${paramIdx++}`);
      params.push(auth.cityId);
    }
    if (engine) {
      conditions.push(`source_engine = $${paramIdx++}`);
      params.push(engine);
    }
    if (channel) {
      conditions.push(`channel = $${paramIdx++}`);
      params.push(channel);
    }
    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }
    if (fromDate) {
      conditions.push(`created_at >= $${paramIdx++}`);
      params.push(new Date(fromDate as string));
    }
    if (toDate) {
      conditions.push(`created_at <= $${paramIdx++}`);
      params.push(new Date(toDate as string));
    }
    if (search) {
      conditions.push(`(subject ILIKE $${paramIdx} OR recipient_address ILIKE $${paramIdx} OR recipient_name ILIKE $${paramIdx} OR body_preview ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const offset = parseInt(offsetStr as string) || 0;

    const countResult = await pool.query(`SELECT COUNT(*) FROM platform_messages ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT * FROM platform_messages ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    res.json({ messages: result.rows, total, limit, offset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

router.get("/api/admin/message-center/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const pool = await ensurePool();
    const auth = await getAuthorizedCityId(req, req.query.cityId as string | undefined);
    if (auth.forbidden) return res.status(403).json({ message: "Forbidden" });
    const cityFilter = auth.cityId ? "WHERE city_id = $1" : "";
    const cityParams = auth.cityId ? [auth.cityId] : [];

    const byEngine = await pool.query(
      `SELECT source_engine, COUNT(*) as count FROM platform_messages ${cityFilter} GROUP BY source_engine ORDER BY count DESC`,
      cityParams
    );
    const byChannel = await pool.query(
      `SELECT channel, COUNT(*) as count FROM platform_messages ${cityFilter} GROUP BY channel ORDER BY count DESC`,
      cityParams
    );
    const byStatus = await pool.query(
      `SELECT status, COUNT(*) as count FROM platform_messages ${cityFilter} GROUP BY status ORDER BY count DESC`,
      cityParams
    );
    const totalResult = await pool.query(
      `SELECT COUNT(*) FROM platform_messages ${cityFilter}`,
      cityParams
    );

    res.json({
      total: parseInt(totalResult.rows[0].count),
      byEngine: byEngine.rows,
      byChannel: byChannel.rows,
      byStatus: byStatus.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

const createTemplateSchema = z.object({
  cityId: z.string().optional(),
  name: z.string().min(1),
  engineTag: z.enum(VALID_ENGINES).default("general"),
  channel: z.enum(VALID_CHANNELS).default("email"),
  subjectTemplate: z.string().optional(),
  bodyTemplate: z.string().optional(),
  variables: z.array(z.string()).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

router.get("/api/admin/message-center/templates", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const pool = await ensurePool();
    const { engine, channel, status } = req.query;
    const auth = await getAuthorizedCityId(req, req.query.cityId as string | undefined);
    if (auth.forbidden) return res.status(403).json({ message: "Forbidden" });

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (auth.cityId) {
      conditions.push(`city_id = $${paramIdx++}`);
      params.push(auth.cityId);
    }
    if (engine) {
      conditions.push(`engine_tag = $${paramIdx++}`);
      params.push(engine);
    }
    if (channel) {
      conditions.push(`channel = $${paramIdx++}`);
      params.push(channel);
    }
    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT * FROM platform_message_templates ${where} ORDER BY updated_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

router.post("/api/admin/message-center/templates", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const pool = await ensurePool();
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

    const { name, engineTag, channel, subjectTemplate, bodyTemplate, variables, status } = parsed.data;
    const auth = await getAuthorizedCityId(req, parsed.data.cityId);
    if (auth.forbidden) return res.status(403).json({ message: "Forbidden" });
    const session = req.session as Record<string, unknown>;
    const createdBy = session.userId as string || "admin";

    const result = await pool.query(
      `INSERT INTO platform_message_templates (city_id, name, engine_tag, channel, subject_template, body_template, variables, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [auth.cityId || null, name, engineTag, channel, subjectTemplate || null, bodyTemplate || null, JSON.stringify(variables || []), status || "draft", createdBy]
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

const patchTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  engineTag: z.enum(VALID_ENGINES).optional(),
  channel: z.enum(VALID_CHANNELS).optional(),
  subjectTemplate: z.string().optional(),
  bodyTemplate: z.string().optional(),
  variables: z.array(z.string()).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  cityId: z.string().optional(),
}).strict();

router.patch("/api/admin/message-center/templates/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const pool = await ensurePool();
    const { id } = req.params;

    const parsed = patchTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

    const existing = await pool.query("SELECT id, city_id FROM platform_message_templates WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: "Template not found" });

    const auth = await getAuthorizedCityId(req, existing.rows[0].city_id || undefined);
    if (auth.forbidden) return res.status(403).json({ message: "Forbidden" });

    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    const allowedFields: Record<string, string> = {
      name: "name", engineTag: "engine_tag", channel: "channel",
      subjectTemplate: "subject_template", bodyTemplate: "body_template",
      variables: "variables", status: "status",
    };

    const data = parsed.data;
    for (const [jsKey, dbCol] of Object.entries(allowedFields)) {
      const val = data[jsKey as keyof typeof data];
      if (val !== undefined) {
        const dbVal = jsKey === "variables" ? JSON.stringify(val) : val;
        fields.push(`${dbCol} = $${paramIdx++}`);
        params.push(dbVal);
      }
    }

    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE platform_message_templates SET ${fields.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

router.delete("/api/admin/message-center/templates/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const pool = await ensurePool();
    const { id } = req.params;
    const existing = await pool.query("SELECT city_id FROM platform_message_templates WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: "Template not found" });
    const auth = await getAuthorizedCityId(req, existing.rows[0].city_id || undefined);
    if (auth.forbidden) return res.status(403).json({ message: "Forbidden" });
    await pool.query("DELETE FROM platform_message_templates WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

router.get("/api/admin/message-center/templates/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const pool = await ensurePool();
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM platform_message_templates WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Template not found" });
    const auth = await getAuthorizedCityId(req, result.rows[0].city_id || undefined);
    if (auth.forbidden) return res.status(403).json({ message: "Forbidden" });
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

export default router;
