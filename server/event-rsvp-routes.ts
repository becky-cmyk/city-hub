import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as Record<string, unknown>).userId as string;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const result = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  if (result.rows.length === 0) return res.status(401).json({ message: "Unauthorized" });
  const role = result.rows[0].role;
  const adminRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN", "CITY_ADMIN"];
  if (!adminRoles.includes(role)) return res.status(403).json({ message: "Admin access required" });
  next();
}

function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as Record<string, unknown>).ownerAccountId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function registerEventRsvpRoutes(app: Express) {
  app.post("/api/events/:eventId/rsvp", async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const publicUserId = (req.session as Record<string, string>).publicUserId || null;
      const { response, name, email, note } = req.body;

      if (!response || !["attending", "maybe", "declined"].includes(response)) {
        return res.status(400).json({ message: "Valid response required (attending, maybe, declined)" });
      }

      const evtResult = await pool.query(
        `SELECT id, visibility, rsvp_enabled, max_capacity FROM events WHERE id = $1`,
        [eventId]
      );
      if (evtResult.rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }
      const evt = evtResult.rows[0];

      if (!evt.rsvp_enabled) {
        return res.status(400).json({ message: "RSVPs are not enabled for this event" });
      }

      if (evt.visibility === "private") {
        const token = req.query.invite as string;
        if (!token) {
          return res.status(403).json({ message: "Private event — invitation required" });
        }
        const inv = await pool.query(
          `SELECT id FROM event_invitations WHERE event_id = $1 AND invite_token = $2`,
          [eventId, token]
        );
        if (inv.rows.length === 0) {
          return res.status(403).json({ message: "Invalid invitation" });
        }
      }

      if (evt.max_capacity && response === "attending") {
        const countResult = await pool.query(
          `SELECT COUNT(*) AS cnt FROM event_rsvps WHERE event_id = $1 AND response = 'attending'`,
          [eventId]
        );
        if (parseInt(countResult.rows[0].cnt) >= evt.max_capacity) {
          return res.status(409).json({ message: "Event is at capacity" });
        }
      }

      if (!publicUserId) {
        return res.status(401).json({ message: "Must be logged in to RSVP" });
      }
      const identifierCol = "public_user_id";
      const identifierVal = publicUserId;

      const existing = await pool.query(
        `SELECT id FROM event_rsvps WHERE event_id = $1 AND ${identifierCol} = $2`,
        [eventId, identifierVal]
      );

      if (existing.rows.length > 0) {
        const updated = await pool.query(
          `UPDATE event_rsvps SET response = $1, name = COALESCE($2, name), note = COALESCE($3, note), updated_at = NOW() WHERE id = $4 RETURNING *`,
          [response, name || null, note || null, existing.rows[0].id]
        );
        return res.json(updated.rows[0]);
      }

      const inserted = await pool.query(
        `INSERT INTO event_rsvps (event_id, public_user_id, name, email, response, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [eventId, publicUserId, name || null, email || null, response, note || null]
      );

      import("./services/automation-triggers").then(({ enqueueAutomationTrigger }) => {
        pool.query(`SELECT city_id FROM events WHERE id = $1`, [eventId]).then(evtCity => {
          const cityId = evtCity.rows[0]?.city_id;
          enqueueAutomationTrigger({
            triggerEvent: "event_rsvp",
            entityType: "event",
            entityId: eventId,
            cityId: cityId || undefined,
            payload: { name, email, response, eventId, publicUserId },
          }).catch(err => console.error("[Automation] event_rsvp trigger error:", err));
        });
      });

      res.status(201).json(inserted.rows[0]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/rsvp/mine", async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const publicUserId = (req.session as Record<string, string>).publicUserId || null;
      if (!publicUserId) {
        return res.json(null);
      }
      const result = await pool.query(
        `SELECT * FROM event_rsvps WHERE event_id = $1 AND public_user_id = $2`,
        [eventId, publicUserId]
      );
      res.json(result.rows[0] || null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.delete("/api/events/:eventId/rsvp", async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const publicUserId = (req.session as Record<string, string>).publicUserId || null;
      if (!publicUserId) {
        return res.status(401).json({ message: "Not logged in" });
      }
      await pool.query(
        `DELETE FROM event_rsvps WHERE event_id = $1 AND public_user_id = $2`,
        [eventId, publicUserId]
      );
      res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/rsvp-counts", async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const isAdmin = !!(req.session as Record<string, unknown>).userId;
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId || null;

      if (!isAdmin && !ownerEntityId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (ownerEntityId && !isAdmin) {
        const ownerCheck = await pool.query(
          `SELECT id FROM events WHERE id = $1 AND host_business_id = $2`,
          [eventId, ownerEntityId]
        );
        if (ownerCheck.rows.length === 0) {
          return res.status(403).json({ message: "Not your event" });
        }
      }

      const result = await pool.query(
        `SELECT response, COUNT(*) AS count FROM event_rsvps WHERE event_id = $1 GROUP BY response`,
        [eventId]
      );
      const counts: Record<string, number> = { attending: 0, maybe: 0, declined: 0 };
      for (const row of result.rows) {
        counts[row.response] = parseInt(row.count);
      }
      res.json(counts);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/:eventId/rsvps", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const userId = (req.session as Record<string, string>).userId;
      const userResult = await pool.query(`SELECT role, city_id FROM users WHERE id = $1`, [userId]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        if (user.role === "CITY_ADMIN" && user.city_id) {
          const evtCheck = await pool.query(`SELECT city_id FROM events WHERE id = $1`, [eventId]);
          if (evtCheck.rows.length > 0 && evtCheck.rows[0].city_id !== user.city_id) {
            return res.status(403).json({ message: "Access denied to this city" });
          }
        }
      }
      const result = await pool.query(
        `SELECT r.*, e.title AS event_title FROM event_rsvps r JOIN events e ON e.id = r.event_id WHERE r.event_id = $1 ORDER BY r.created_at DESC`,
        [eventId]
      );
      res.json(result.rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/event-rsvps", requireAdmin, async (req: Request, res: Response) => {
    try {
      let cityId = req.query.cityId as string;
      const userId = (req.session as Record<string, string>).userId;
      const userResult = await pool.query(`SELECT role, city_id FROM users WHERE id = $1`, [userId]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        if (user.role === "CITY_ADMIN" && user.city_id) {
          if (cityId && cityId !== user.city_id) return res.status(403).json({ message: "Access denied" });
          cityId = user.city_id;
        }
      }
      let query = `SELECT r.*, e.title AS event_title, e.start_date_time, e.visibility FROM event_rsvps r JOIN events e ON e.id = r.event_id`;
      const params: string[] = [];
      if (cityId) {
        params.push(cityId);
        query += ` WHERE e.city_id = $${params.length}`;
      }
      query += ` ORDER BY r.created_at DESC LIMIT 200`;
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.delete("/api/admin/event-rsvps/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rsvpResult = await pool.query(
        `SELECT er.event_id, e.city_id FROM event_rsvps er JOIN events e ON e.id = er.event_id WHERE er.id = $1`,
        [req.params.id]
      );
      if (rsvpResult.rows.length === 0) return res.status(404).json({ message: "RSVP not found" });

      const session = req.session as Record<string, unknown>;
      const userId = session.userId as string;
      const userResult = await pool.query(`SELECT role, city_id FROM users WHERE id = $1`, [userId]);
      const user = userResult.rows[0];
      if (user.role === "CITY_ADMIN" && user.city_id !== rsvpResult.rows[0].city_id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await pool.query(`DELETE FROM event_rsvps WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/events/:eventId/invitations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { invitations } = req.body;

      if (!Array.isArray(invitations) || invitations.length === 0) {
        return res.status(400).json({ message: "At least one invitation required" });
      }

      const evtResult = await pool.query(`SELECT id, host_business_id FROM events WHERE id = $1`, [eventId]);
      if (evtResult.rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      const creditBatches = Math.ceil(invitations.length / 25);
      if (evtResult.rows[0].host_business_id && creditBatches > 0) {
        const { spendCredits } = await import("./hub-entitlements");
        const result = await spendCredits(evtResult.rows[0].host_business_id, creditBatches, "EVENT_INVITE_SEND", eventId);
        if (!result.success) {
          return res.status(402).json({ message: `Insufficient credits. Need ${creditBatches}, shortfall: ${result.shortfall}` });
        }
      }

      const created = [];
      const errors: string[] = [];
      for (const inv of invitations) {
        if (!inv.email) continue;
        try {
          const result = await pool.query(
            `INSERT INTO event_invitations (event_id, email, name) VALUES ($1, $2, $3) ON CONFLICT (event_id, email) DO NOTHING RETURNING *`,
            [eventId, inv.email.toLowerCase().trim(), inv.name || null]
          );
          if (result.rows.length > 0) {
            created.push(result.rows[0]);
          }
        } catch (invErr: unknown) {
          const msg = invErr instanceof Error ? invErr.message : "Unknown error";
          console.error(`[Invitations] Failed to insert invitation for ${inv.email}:`, msg);
          errors.push(inv.email);
        }
      }

      res.status(201).json({ created: created.length, invitations: created, ...(errors.length > 0 ? { failedEmails: errors } : {}) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/:eventId/invitations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const result = await pool.query(
        `SELECT * FROM event_invitations WHERE event_id = $1 ORDER BY created_at DESC`,
        [eventId]
      );
      res.json(result.rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/event-invitations", requireAdmin, async (req: Request, res: Response) => {
    try {
      let cityId = req.query.cityId as string;
      const userId = (req.session as Record<string, string>).userId;
      const userResult = await pool.query(`SELECT role, city_id FROM users WHERE id = $1`, [userId]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        if (user.role === "CITY_ADMIN" && user.city_id) {
          if (cityId && cityId !== user.city_id) return res.status(403).json({ message: "Access denied" });
          cityId = user.city_id;
        }
      }
      let query = `SELECT i.*, e.title AS event_title, e.slug AS event_slug, e.start_date_time, c.slug AS city_slug FROM event_invitations i JOIN events e ON e.id = i.event_id JOIN cities c ON c.id = e.city_id`;
      const params: string[] = [];
      if (cityId) {
        params.push(cityId);
        query += ` WHERE e.city_id = $${params.length}`;
      }
      query += ` ORDER BY i.created_at DESC LIMIT 200`;
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.delete("/api/admin/event-invitations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const invResult = await pool.query(
        `SELECT ei.event_id, e.city_id FROM event_invitations ei JOIN events e ON e.id = ei.event_id WHERE ei.id = $1`,
        [req.params.id]
      );
      if (invResult.rows.length === 0) return res.status(404).json({ message: "Invitation not found" });

      const session = req.session as Record<string, unknown>;
      const userId = session.userId as string;
      const userResult = await pool.query(`SELECT role, city_id FROM users WHERE id = $1`, [userId]);
      const user = userResult.rows[0];
      if (user.role === "CITY_ADMIN" && user.city_id !== invResult.rows[0].city_id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await pool.query(`DELETE FROM event_invitations WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/invite/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const result = await pool.query(
        `SELECT i.*, e.title AS event_title, e.slug AS event_slug, e.start_date_time, e.location_name, e.image_url, c.slug AS city_slug
         FROM event_invitations i
         JOIN events e ON e.id = i.event_id
         JOIN cities c ON c.id = e.city_id
         WHERE i.invite_token = $1`,
        [token]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      res.json(result.rows[0]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.patch("/api/events/invite/:token/respond", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { status } = req.body;
      if (!status || !["accepted", "declined", "maybe"].includes(status)) {
        return res.status(400).json({ message: "Valid status required (accepted, declined, maybe)" });
      }
      const result = await pool.query(
        `UPDATE event_invitations SET status = $1, responded_at = NOW() WHERE invite_token = $2 RETURNING *`,
        [status, token]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (status === "accepted") {
        const inv = result.rows[0];
        await pool.query(
          `INSERT INTO event_rsvps (event_id, email, name, response) VALUES ($1, $2, $3, 'attending')
           ON CONFLICT (event_id, email) WHERE email IS NOT NULL AND public_user_id IS NULL
           DO UPDATE SET response = 'attending', updated_at = NOW()`,
          [inv.event_id, inv.email, inv.name]
        );
      } else if (status === "maybe") {
        const inv = result.rows[0];
        await pool.query(
          `INSERT INTO event_rsvps (event_id, email, name, response) VALUES ($1, $2, $3, 'maybe')
           ON CONFLICT (event_id, email) WHERE email IS NOT NULL AND public_user_id IS NULL
           DO UPDATE SET response = 'maybe', updated_at = NOW()`,
          [inv.event_id, inv.email, inv.name]
        );
      }

      res.json(result.rows[0]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/owner/events", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      if (!ownerEntityId) {
        return res.status(403).json({ message: "No entity linked" });
      }
      const result = await pool.query(
        `SELECT e.*, 
          (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.response = 'attending') AS attending_count,
          (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.response = 'maybe') AS maybe_count,
          (SELECT COUNT(*) FROM event_invitations i WHERE i.event_id = e.id) AS invitation_count
         FROM events e WHERE e.host_business_id = $1 ORDER BY e.start_date_time DESC`,
        [ownerEntityId]
      );
      res.json(result.rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/owner/events/:eventId/rsvps", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      const { eventId } = req.params;
      const evtCheck = await pool.query(
        `SELECT id FROM events WHERE id = $1 AND host_business_id = $2`,
        [eventId, ownerEntityId]
      );
      if (evtCheck.rows.length === 0) {
        return res.status(403).json({ message: "Not your event" });
      }
      const result = await pool.query(
        `SELECT * FROM event_rsvps WHERE event_id = $1 ORDER BY created_at DESC`,
        [eventId]
      );
      res.json(result.rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/owner/events/:eventId/invitations", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      const { eventId } = req.params;
      const evtCheck = await pool.query(
        `SELECT id FROM events WHERE id = $1 AND host_business_id = $2`,
        [eventId, ownerEntityId]
      );
      if (evtCheck.rows.length === 0) {
        return res.status(403).json({ message: "Not your event" });
      }
      const result = await pool.query(
        `SELECT id, email, name, invite_token, status, responded_at, created_at FROM event_invitations WHERE event_id = $1 ORDER BY created_at DESC`,
        [eventId]
      );
      res.json(result.rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/owner/events/:eventId/invitations", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      const { eventId } = req.params;
      const { invitations } = req.body;

      const evtCheck = await pool.query(
        `SELECT id, host_business_id FROM events WHERE id = $1 AND host_business_id = $2`,
        [eventId, ownerEntityId]
      );
      if (evtCheck.rows.length === 0) {
        return res.status(403).json({ message: "Not your event" });
      }

      if (!Array.isArray(invitations) || invitations.length === 0) {
        return res.status(400).json({ message: "At least one invitation required" });
      }

      const creditBatches = Math.ceil(invitations.length / 25);
      if (creditBatches > 0) {
        const { spendCredits } = await import("./hub-entitlements");
        const result = await spendCredits(ownerEntityId, creditBatches, "EVENT_INVITE_SEND", eventId);
        if (!result.success) {
          return res.status(402).json({ message: `Insufficient credits. Need ${creditBatches}, shortfall: ${result.shortfall}` });
        }
      }

      const created = [];
      const errors: string[] = [];
      for (const inv of invitations) {
        if (!inv.email) continue;
        try {
          const result = await pool.query(
            `INSERT INTO event_invitations (event_id, email, name) VALUES ($1, $2, $3) ON CONFLICT (event_id, email) DO NOTHING RETURNING *`,
            [eventId, inv.email.toLowerCase().trim(), inv.name || null]
          );
          if (result.rows.length > 0) created.push(result.rows[0]);
        } catch (invErr: unknown) {
          const msg = invErr instanceof Error ? invErr.message : "Unknown error";
          console.error(`[Invitations] Failed to insert invitation for ${inv.email}:`, msg);
          errors.push(inv.email);
        }
      }

      res.status(201).json({ created: created.length, invitations: created, ...(errors.length > 0 ? { failedEmails: errors } : {}) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message });
    }
  });
}
