import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureTranslationColumns(): Promise<void> {
  const addColumnIfMissing = async (table: string, column: string, colType: string, defaultVal?: string) => {
    const result = await db.execute(sql.raw(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`
    ));
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    if (rows.length === 0) {
      const def = defaultVal ? ` DEFAULT ${defaultVal}` : "";
      await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${colType}${def}`));
      console.log(`[Migration] Added column ${table}.${column}`);
    }
  };

  const tables = ["businesses", "events", "articles", "posts", "marketplace_listings", "cms_content_items"];
  for (const table of tables) {
    await addColumnIfMissing(table, "translation_status", "text", "'pending'");
    await addColumnIfMissing(table, "translation_error", "text");
    await addColumnIfMissing(table, "translation_attempts", "integer", "0");
    await addColumnIfMissing(table, "last_translation_at", "timestamp");
  }

  await addColumnIfMissing("posts", "title_es", "text");
  await addColumnIfMissing("posts", "body_es", "text");
  await addColumnIfMissing("marketplace_listings", "title_es", "text");
  await addColumnIfMissing("marketplace_listings", "description_es", "text");

  console.log("[Migration] Translation columns verified");
}
