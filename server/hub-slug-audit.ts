import { db } from "./db";
import { zones, territories } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface HubEntry {
  id: string;
  name: string;
  table: "zones" | "territories";
  county: string | null;
  zips: string[];
  oldSlug: string | null;
  newSlug: string;
  status: "OK" | "CREATED" | "FIXED_DUPLICATE" | "FIXED_INVALID";
  collisionNotes: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0) return false;
  if (slug.length > 40) return false;
  if (/[^a-z0-9-]/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  return true;
}

function resolveCollision(
  base: string,
  county: string | null,
  zips: string[],
  usedSlugs: Set<string>
): { slug: string; notes: string } {
  if (!usedSlugs.has(base.toLowerCase())) {
    return { slug: base, notes: "" };
  }

  if (county) {
    const withCounty = `${base}-${slugify(county)}`.slice(0, 40).replace(/-+$/g, "");
    if (!usedSlugs.has(withCounty.toLowerCase())) {
      return { slug: withCounty, notes: `collision resolved with county "${county}"` };
    }
  }

  if (zips.length > 0) {
    const withZip = `${base}-${zips[0]}`.slice(0, 40).replace(/-+$/g, "");
    if (!usedSlugs.has(withZip.toLowerCase())) {
      return { slug: withZip, notes: `collision resolved with ZIP "${zips[0]}"` };
    }
  }

  let counter = 2;
  while (counter < 100) {
    const candidate = `${base}-${counter}`.slice(0, 40).replace(/-+$/g, "");
    if (!usedSlugs.has(candidate.toLowerCase())) {
      return { slug: candidate, notes: `collision resolved with suffix "-${counter}"` };
    }
    counter++;
  }

  return { slug: `${base}-${Date.now()}`.slice(0, 40), notes: "collision resolved with timestamp" };
}

export async function runHubSlugAudit(dryRun = false): Promise<HubEntry[]> {
  const allZones = await db.select().from(zones).where(eq(zones.type, "MICRO_HUB"));
  const allTerritories = await db.select().from(territories).where(eq(territories.type, "MICRO"));

  const entries: HubEntry[] = [];
  const usedSlugs = new Set<string>();

  for (const z of allZones) {
    const currentSlug = z.slug || null;
    const baseSlug = slugify(z.name);
    const zips = (z.zipCodes || []) as string[];
    const county = z.county || null;

    if (currentSlug && isValidSlug(currentSlug) && !usedSlugs.has(currentSlug.toLowerCase())) {
      usedSlugs.add(currentSlug.toLowerCase());
      entries.push({
        id: z.id, name: z.name, table: "zones", county, zips,
        oldSlug: currentSlug, newSlug: currentSlug, status: "OK", collisionNotes: "",
      });
      continue;
    }

    let status: HubEntry["status"] = "CREATED";
    if (currentSlug && !isValidSlug(currentSlug)) {
      status = "FIXED_INVALID";
    } else if (currentSlug && usedSlugs.has(currentSlug.toLowerCase())) {
      status = "FIXED_DUPLICATE";
    }

    const { slug: resolved, notes } = resolveCollision(baseSlug, county, zips, usedSlugs);
    usedSlugs.add(resolved.toLowerCase());

    entries.push({
      id: z.id, name: z.name, table: "zones", county, zips,
      oldSlug: currentSlug, newSlug: resolved, status, collisionNotes: notes,
    });
  }

  for (const t of allTerritories) {
    const currentSlug = (t as any).slug || null;
    const baseSlug = slugify(t.name);
    const zips = (t.geoCodes || []) as string[];
    const county = null;

    if (currentSlug && isValidSlug(currentSlug) && !usedSlugs.has(currentSlug.toLowerCase())) {
      usedSlugs.add(currentSlug.toLowerCase());
      entries.push({
        id: t.id, name: t.name, table: "territories", county, zips,
        oldSlug: currentSlug, newSlug: currentSlug, status: "OK", collisionNotes: "",
      });
      continue;
    }

    let status: HubEntry["status"] = "CREATED";
    if (currentSlug && !isValidSlug(currentSlug)) {
      status = "FIXED_INVALID";
    } else if (currentSlug && usedSlugs.has(currentSlug.toLowerCase())) {
      status = "FIXED_DUPLICATE";
    }

    const { slug: resolved, notes } = resolveCollision(baseSlug, county, zips, usedSlugs);
    usedSlugs.add(resolved.toLowerCase());

    entries.push({
      id: t.id, name: t.name, table: "territories", county, zips,
      oldSlug: currentSlug, newSlug: resolved, status, collisionNotes: notes,
    });
  }

  if (!dryRun) {
    for (const entry of entries) {
      if (entry.status === "OK") continue;

      if (entry.table === "zones") {
        await db.update(zones).set({ slug: entry.newSlug }).where(eq(zones.id, entry.id));
      } else {
        await db.update(territories).set({ slug: entry.newSlug }).where(eq(territories.id, entry.id));
      }
    }
  }

  return entries;
}

function writeReport(entries: HubEntry[]) {
  const ok = entries.filter(e => e.status === "OK").length;
  const created = entries.filter(e => e.status === "CREATED").length;
  const fixedInvalid = entries.filter(e => e.status === "FIXED_INVALID").length;
  const fixedDuplicate = entries.filter(e => e.status === "FIXED_DUPLICATE").length;

  console.log("\n=== Hub Slug Audit Report ===");
  console.log(`Total hubs: ${entries.length}`);
  console.log(`OK: ${ok}`);
  console.log(`Created: ${created}`);
  console.log(`Fixed Invalid: ${fixedInvalid}`);
  console.log(`Fixed Duplicates: ${fixedDuplicate}`);
  console.log("");

  console.table(entries.map(e => ({
    id: e.id.slice(0, 8) + "...",
    name: e.name,
    table: e.table,
    old_slug: e.oldSlug || "(none)",
    new_slug: e.newSlug,
    status: e.status,
    notes: e.collisionNotes || "-",
  })));

  const tmpDir = path.resolve("./tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const csvPath = path.join(tmpDir, `hub-slug-audit-${dateStr}.csv`);

  const csvHeader = "hub_id,hub_name,table,county,zips,old_slug,new_slug,status,collision_notes";
  const csvRows = entries.map(e => {
    const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
    return [
      esc(e.id), esc(e.name), esc(e.table), esc(e.county || ""),
      esc(e.zips.join(";")), esc(e.oldSlug || ""), esc(e.newSlug),
      esc(e.status), esc(e.collisionNotes),
    ].join(",");
  });

  fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join("\n"), "utf-8");
  console.log(`\nCSV report written to: ${csvPath}`);
}

async function main() {
  console.log("Starting Hub Slug Audit...");
  const entries = await runHubSlugAudit(false);
  writeReport(entries);
  process.exit(0);
}

main().catch(err => {
  console.error("Hub Slug Audit failed:", err);
  process.exit(1);
});
