import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function runMigration() {
  const migrationPath = path.join(process.cwd(), "migrations", "0001_workforce_tables.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  console.log("[Migration] Applying workforce tables migration...");

  const statements = migrationSql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("already exists") || message.includes("duplicate")) {
        continue;
      }
      console.error("[Migration] Statement error:", message);
      console.error("[Migration] Statement:", statement.slice(0, 100));
    }
  }

  console.log("[Migration] Migration applied. Verifying tables...");

  const tables = [
    "applicant_profiles", "skill_categories", "skill_subcategories", "skills",
    "applicant_skills", "credential_directory", "applicant_credentials",
    "applicant_resumes", "business_hiring_profiles", "job_listings",
    "job_applications", "employer_hiring_metrics"
  ];

  let allExist = true;
  for (const table of tables) {
    try {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
      console.log(`  ✓ ${table}: ${result.rows[0].count} rows`);
    } catch {
      console.error(`  ✗ ${table}: NOT FOUND`);
      allExist = false;
    }
  }

  const enums = [
    "availability_type", "credential_verification_status", "hiring_status",
    "employment_type", "compensation_type", "job_status", "skill_level"
  ];

  for (const enumName of enums) {
    try {
      const result = await db.execute(sql.raw(`SELECT enum_range(NULL::${enumName})`));
      console.log(`  ✓ enum ${enumName}: ${result.rows[0].enum_range}`);
    } catch {
      console.error(`  ✗ enum ${enumName}: NOT FOUND`);
      allExist = false;
    }
  }

  if (allExist) {
    console.log("[Migration] All workforce tables and enums verified successfully.");
  } else {
    console.error("[Migration] Some tables or enums are missing.");
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
