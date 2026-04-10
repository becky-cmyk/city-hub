import pg from "pg";
import fs from "fs";
import path from "path";

const DEV_CITY_ID = "b0d970f5-cfd6-475b-8739-cfd5352094c4";
const OUT_DIR = path.join(process.cwd(), "scripts", "migration-data");

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const exportTable = async (name: string, query: string) => {
    const { rows } = await pool.query(query);
    fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(rows, null, 2));
    console.log(`Exported ${rows.length} rows for ${name}`);
    return rows;
  };

  await exportTable("metro_sources", `SELECT * FROM metro_sources WHERE city_id = '${DEV_CITY_ID}'`);
  await exportTable("rss_items", `SELECT * FROM rss_items WHERE city_id = '${DEV_CITY_ID}'`);
  await exportTable("articles", `SELECT * FROM articles WHERE city_id = '${DEV_CITY_ID}'`);
  await exportTable("events", `SELECT * FROM events WHERE city_id = '${DEV_CITY_ID}'`);
  await exportTable("categories", `SELECT * FROM categories`);
  await exportTable("tags", `SELECT * FROM tags`);

  const tagIds = (await pool.query(`SELECT id FROM tags`)).rows.map((r: any) => r.id);
  const contentTagRows = (await pool.query(`SELECT * FROM content_tags`)).rows;
  const filtered = contentTagRows.filter((ct: any) => tagIds.includes(ct.tag_id));
  fs.writeFileSync(path.join(OUT_DIR, "content_tags.json"), JSON.stringify(filtered, null, 2));
  console.log(`Exported ${filtered.length} content_tags`);

  await exportTable("zones", `SELECT id, name, type FROM zones WHERE city_id = '${DEV_CITY_ID}'`);

  await pool.end();
  console.log("Export complete!");
}

main().catch(console.error);
