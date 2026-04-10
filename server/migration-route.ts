import { type Express } from "express";
import { pool } from "./db";
import crypto from "crypto";
import fs from "fs";
import path from "path";

function loadJSON(name: string) {
  const filePath = path.join(process.cwd(), "scripts", "migration-data", `${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function registerMigrationRoute(app: Express) {
  app.post("/api/admin/run-content-migration", async (req, res) => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { storage } = await import("./storage");
    const adminUser = await storage.getUserById(adminUserId);
    if (!adminUser || !["SUPER_ADMIN", "super_admin"].includes(adminUser.role)) {
      return res.status(403).json({ error: "Super admin only" });
    }

    const PROD_CITY_ID = req.body.targetCityId;
    if (!PROD_CITY_ID) return res.status(400).json({ error: "targetCityId required" });

    const log: string[] = [];
    const addLog = (msg: string) => { log.push(msg); console.log(`[MIGRATION] ${msg}`); };

    const client = await pool.connect();
    try {
      const devZones: any[] = loadJSON("zones");
      const devCategories: any[] = loadJSON("categories");
      const devTags: any[] = loadJSON("tags");
      const devSources: any[] = loadJSON("metro_sources");
      const devRssItems: any[] = loadJSON("rss_items");
      const devArticles: any[] = loadJSON("articles");
      const devEvents: any[] = loadJSON("events");
      const devContentTags: any[] = loadJSON("content_tags");

      addLog(`Loaded: ${devSources.length} sources, ${devRssItems.length} rss_items, ${devArticles.length} articles, ${devEvents.length} events, ${devCategories.length} categories, ${devTags.length} tags, ${devContentTags.length} content_tags`);

      const prodZonesRes = await client.query(`SELECT id, name, type FROM zones WHERE city_id = $1`, [PROD_CITY_ID]);
      const prodZoneByKey: Record<string, string> = {};
      prodZonesRes.rows.forEach((z: any) => { prodZoneByKey[`${z.name}|${z.type}`] = z.id; });

      const zoneMap: Record<string, string> = {};
      devZones.forEach((dz: any) => {
        const key = `${dz.name}|${dz.type}`;
        if (prodZoneByKey[key]) zoneMap[dz.id] = prodZoneByKey[key];
      });
      addLog(`Zone mapping: ${Object.keys(zoneMap).length} of ${devZones.length}`);

      const prodCatsRes = await client.query(`SELECT id, slug FROM categories`);
      const prodCatBySlug: Record<string, string> = {};
      prodCatsRes.rows.forEach((c: any) => { prodCatBySlug[c.slug] = c.id; });

      const catMap: Record<string, string> = {};
      const catsToCreate: any[] = [];
      devCategories.forEach((dc: any) => {
        if (prodCatBySlug[dc.slug]) {
          catMap[dc.id] = prodCatBySlug[dc.slug];
        } else {
          catsToCreate.push(dc);
        }
      });

      const sortedCats: any[] = [];
      const catCreated = new Set<string>();
      let remaining = [...catsToCreate];
      for (let pass = 0; pass < 10 && remaining.length > 0; pass++) {
        const next: any[] = [];
        for (const c of remaining) {
          if (!c.parent_category_id || catMap[c.parent_category_id] || catCreated.has(c.parent_category_id)) {
            sortedCats.push(c);
            catCreated.add(c.id);
            catMap[c.id] = crypto.randomUUID();
          } else {
            next.push(c);
          }
        }
        remaining = next;
      }
      remaining.forEach(c => { catMap[c.id] = crypto.randomUUID(); sortedCats.push(c); });

      let catInserted = 0;
      for (const c of sortedCats) {
        const newId = catMap[c.id];
        const parentId = c.parent_category_id ? (catMap[c.parent_category_id] || null) : null;
        try {
          await client.query(
            `INSERT INTO categories (id, name, slug, icon, parent_category_id, sort_order, sic_code) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
            [newId, c.name, c.slug, c.icon || null, parentId, c.sort_order || 0, c.sic_code || null]
          );
          catInserted++;
        } catch {}
      }
      addLog(`Categories created: ${catInserted}`);

      const prodTagsRes = await client.query(`SELECT id, name, type FROM tags`);
      const prodTagByKey: Record<string, string> = {};
      prodTagsRes.rows.forEach((t: any) => { prodTagByKey[`${t.name}|${t.type}`] = t.id; });

      const tagMap: Record<string, string> = {};
      let tagsCreated = 0;
      for (const dt of devTags) {
        const key = `${dt.name}|${dt.type}`;
        if (prodTagByKey[key]) {
          tagMap[dt.id] = prodTagByKey[key];
        } else {
          const newId = crypto.randomUUID();
          tagMap[dt.id] = newId;
          try {
            await client.query(
              `INSERT INTO tags (id, name, slug, type, city_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
              [newId, dt.name, dt.slug, dt.type, PROD_CITY_ID]
            );
            tagsCreated++;
          } catch {}
        }
      }
      addLog(`Tags: ${Object.keys(tagMap).length - tagsCreated} mapped, ${tagsCreated} created`);

      const sourceMap: Record<string, string> = {};
      let sourcesInserted = 0;
      for (const s of devSources) {
        const newId = crypto.randomUUID();
        sourceMap[s.id] = newId;
        try {
          await client.query(
            `INSERT INTO metro_sources (id, city_id, name, source_type, base_url, dataset_id, layer_url, params_json, pull_frequency, enabled, last_cursor, status, is_event_source, feed_url, scrape_config) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO NOTHING`,
            [newId, PROD_CITY_ID, s.name, s.source_type, s.base_url || null, s.dataset_id || null,
             s.layer_url || null, s.params_json ? JSON.stringify(s.params_json) : null,
             s.pull_frequency || "DAILY", s.enabled ?? false, s.last_cursor || null,
             s.status || "OK", s.is_event_source ?? false, s.feed_url || null,
             s.scrape_config ? JSON.stringify(s.scrape_config) : null]
          );
          sourcesInserted++;
        } catch (err: any) {
          addLog(`Source error (${s.name}): ${err.message}`);
        }
      }
      addLog(`Metro sources inserted: ${sourcesInserted}`);

      const rssItemMap: Record<string, string> = {};
      let rssInserted = 0, rssErrors = 0;
      for (let i = 0; i < devRssItems.length; i++) {
        const r = devRssItems[i];
        const newId = crypto.randomUUID();
        rssItemMap[r.id] = newId;
        const mappedSourceId = sourceMap[r.metro_source_id] || null;
        try {
          await client.query(
            `INSERT INTO rss_items (id, city_id, metro_source_id, external_id, source_name, title, url, published_at, summary, rewritten_summary, author, image_url, categories_json, raw_json, review_status, view_count, zone_slug, title_es, rewritten_summary_es, local_article_slug, local_article_body, local_article_body_es) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) ON CONFLICT (id) DO NOTHING`,
            [newId, PROD_CITY_ID, mappedSourceId, r.external_id, r.source_name, r.title, r.url,
             r.published_at, r.summary, r.rewritten_summary, r.author, r.image_url,
             r.categories_json ? JSON.stringify(r.categories_json) : null,
             null,
             r.review_status || "PENDING", r.view_count || 0, r.zone_slug || null,
             r.title_es || null, r.rewritten_summary_es || null,
             r.local_article_slug || null, r.local_article_body || null, r.local_article_body_es || null]
          );
          rssInserted++;
        } catch { rssErrors++; }
        if ((i + 1) % 500 === 0) addLog(`RSS progress: ${i + 1}/${devRssItems.length}`);
      }
      addLog(`RSS items inserted: ${rssInserted}, errors: ${rssErrors}`);

      const prodArticleSlugs = (await client.query(`SELECT slug FROM articles WHERE city_id = $1`, [PROD_CITY_ID])).rows.map((r: any) => r.slug);
      const existingSlugs = new Set(prodArticleSlugs);
      let articlesInserted = 0;
      const articleMap: Record<string, string> = {};
      for (const a of devArticles) {
        if (existingSlugs.has(a.slug)) continue;
        const newId = crypto.randomUUID();
        articleMap[a.id] = newId;
        const mappedZone = a.zone_id ? (zoneMap[a.zone_id] || null) : null;
        const mappedCat = a.primary_category_id ? (catMap[a.primary_category_id] || null) : null;
        try {
          await client.query(
            `INSERT INTO articles (id, city_id, title, slug, content, excerpt, author_id, zone_id, primary_category_id, image_url, published_at, display_date, is_featured, is_sponsored, priority_rank, title_es, content_es, excerpt_es) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO NOTHING`,
            [newId, PROD_CITY_ID, a.title, a.slug, a.content, a.excerpt, a.author_id || null,
             mappedZone, mappedCat, a.image_url || null, a.published_at || null, a.display_date || null,
             a.is_featured ?? false, a.is_sponsored ?? false, a.priority_rank || 0,
             a.title_es || null, a.content_es || null, a.excerpt_es || null]
          );
          articlesInserted++;
        } catch (err: any) {
          addLog(`Article error (${a.title}): ${err.message}`);
        }
      }
      addLog(`Articles inserted: ${articlesInserted}`);

      const defaultZoneRes = await client.query(`SELECT id FROM zones WHERE city_id = $1 AND name = 'Uptown' AND type = 'DISTRICT' LIMIT 1`, [PROD_CITY_ID]);
      const defaultZoneId = defaultZoneRes.rows[0]?.id || null;

      const prodEventSlugs = (await client.query(`SELECT slug FROM events WHERE city_id = $1`, [PROD_CITY_ID])).rows.map((r: any) => r.slug);
      const existingEventSlugs = new Set(prodEventSlugs);
      let eventsInserted = 0;
      const eventMap: Record<string, string> = {};
      for (const e of devEvents) {
        if (existingEventSlugs.has(e.slug)) continue;
        const newId = crypto.randomUUID();
        eventMap[e.id] = newId;
        const mappedZone = e.zone_id ? (zoneMap[e.zone_id] || defaultZoneId) : defaultZoneId;
        if (!mappedZone) continue;
        try {
          await client.query(
            `INSERT INTO events (id, city_id, zone_id, title, slug, description, start_date_time, end_date_time, location_name, address, city, state, zip, cost_text, image_url, is_featured, is_sponsored, priority_rank, content_rating, title_es, description_es, visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) ON CONFLICT (id) DO NOTHING`,
            [newId, PROD_CITY_ID, mappedZone, e.title, e.slug, e.description,
             e.start_date_time, e.end_date_time || null, e.location_name || null,
             e.address || null, e.city || null, e.state || null, e.zip || null,
             e.cost_text || null, e.image_url || null, e.is_featured ?? false,
             e.is_sponsored ?? false, e.priority_rank || 0, e.content_rating || "G",
             e.title_es || null, e.description_es || null, e.visibility || "PUBLIC"]
          );
          eventsInserted++;
        } catch (err: any) {
          addLog(`Event error (${e.title}): ${err.message}`);
        }
      }
      addLog(`Events inserted: ${eventsInserted}`);

      let ctInserted = 0, ctErrors = 0;
      for (const ct of devContentTags) {
        const mappedTagId = tagMap[ct.tag_id];
        if (!mappedTagId) continue;
        let mappedContentId = ct.content_id;
        if (ct.content_type === "rss_item" && rssItemMap[ct.content_id]) mappedContentId = rssItemMap[ct.content_id];
        else if (ct.content_type === "event" && eventMap[ct.content_id]) mappedContentId = eventMap[ct.content_id];
        else if (ct.content_type === "article" && articleMap[ct.content_id]) mappedContentId = articleMap[ct.content_id];
        try {
          await client.query(
            `INSERT INTO content_tags (id, content_type, content_id, tag_id) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
            [crypto.randomUUID(), ct.content_type, mappedContentId, mappedTagId]
          );
          ctInserted++;
        } catch { ctErrors++; }
      }
      addLog(`Content tags inserted: ${ctInserted}, errors: ${ctErrors}`);

      const summary = {
        categoriesCreated: catInserted,
        tagsCreated,
        metroSources: sourcesInserted,
        rssItems: rssInserted,
        articles: articlesInserted,
        events: eventsInserted,
        contentTags: ctInserted,
        log
      };
      addLog("Migration complete!");
      res.json(summary);
    } catch (err: any) {
      addLog(`FATAL: ${err.message}`);
      res.status(500).json({ error: err.message, log });
    } finally {
      client.release();
    }
  });

  app.post("/api/admin/bulk-approve-rss", async (req, res) => {
    const adminUserId = (req.session as Record<string, unknown>)?.userId;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { storage } = await import("./storage");
    const adminUser = await storage.getUserById(adminUserId as string);
    if (!adminUser || !["SUPER_ADMIN", "super_admin"].includes(adminUser.role)) {
      return res.status(403).json({ error: "Super admin only" });
    }

    const cityId = req.body.cityId;
    if (!cityId) return res.status(400).json({ error: "cityId required" });

    const result = await pool.query(
      `UPDATE rss_items SET review_status = 'APPROVED' WHERE city_id = $1 AND review_status = 'PENDING'`,
      [cityId]
    );
    res.json({ approved: result.rowCount });
  });
}
