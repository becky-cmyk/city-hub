import { db } from "../server/db";
import { events } from "../shared/schema";
import { isNotNull, inArray } from "drizzle-orm";

const NEGATIVE_BLOCKLIST = [
  "crime", "shooting", "murder", "stabbing", "robbery", "arrest",
  "homicide", "assault", "fatal", "killed", "death toll", "manslaughter",
  "carjacking", "arson", "kidnapping", "gunshot", "gunfire",
  "crimen", "tiroteo", "asesinato", "apunalamiento", "robo", "arresto",
  "homicidio", "agresion", "muerto", "muertes", "homicidio involuntario",
  "secuestro", "incendio provocado", "disparo", "disparos",
  "balacera", "feminicidio", "mataron", "fallecido", "victima mortal",
];

const EVENT_IRRELEVANT_BLOCKLIST = [
  "pal session", "peer-led session", "study session", "review session",
  "grades due", "grading deadline", "last day to drop", "last day to add",
  "last day to withdraw", "registration deadline", "registration opens",
  "registration closes", "census date", "academic calendar",
  "faculty meeting", "faculty senate", "staff meeting", "board meeting",
  "commencement rehearsal", "orientation session", "advising period",
  "reading day", "study day", "exam period", "final exam", "midterm exam",
  "exam review",
  "spring break", "fall break", "winter break", "summer break",
  "classes begin", "classes end", "classes resume",
  "no classes", "university closed", "campus closed", "office closed",
  "holiday break", "recess", "convocation",
  "half term", "first half term", "second half term",
  "tuition due", "fee payment", "financial aid deadline",
  "drop deadline", "add deadline", "withdrawal deadline",
  "administrative", "payroll", "human resources",
  "weekly meeting", "monthly meeting", "bi-weekly meeting", "biweekly meeting",
  "club meeting", "chapter meeting", "committee meeting",
  "general body meeting", "rsa general body",
  "info session", "information session", "orientation event",
  "practice schedule", "tryout schedule", "game schedule", "season schedule",
  "tournament schedule",
  "sunday service", "worship service", "bible study", "prayer meeting",
  "sunday school", "church service", "mass schedule",
  "syllabus", "course registration", "dean's list", "honor roll",
  "student government", "academic senate", "faculty development",
  "campus tour", "parent orientation", "homecoming court", "pep rally",
  "class schedule", "lab hours", "office hours", "tutoring session",
  "drop-in hours", "walk in hours", "walk-in hours",
  "study group", "thesis defense", "dissertation", "capstone presentation",
  "board of directors meeting", "staff development", "professional development day",
  "in-service day", "department meeting", "division meeting",
  "team meeting", "standup meeting",
  "procrastination workshop", "time management", "effective communication",
  "self-accountability", "decision making", "bystander intervention",
  "safer drinking", "effective decision",
  "graduate research symposium", "research symposium",
];

const EDUCATION_BLOCKLIST = [
  "school board", "board of education", "school district", "education board",
  "pta meeting", "pta event", "parent teacher", "school calendar",
  "classroom", "school lunch", "school bus", "superintendent",
  "school closure", "snow day", "teacher workday", "staff development day",
  "standardized test", "end of grade", "school enrollment",
  "reunión de la junta escolar", "distrito escolar", "calendario escolar",
];

const LOW_INTEREST_BLOCKLIST = [
  "weekly meeting", "monthly meeting", "club meeting", "chapter meeting",
  "committee meeting", "bi-weekly meeting", "biweekly meeting",
  "call for volunteers", "volunteers needed", "volunteer opportunity",
  "agenda posted", "minutes posted", "meeting minutes", "meeting agenda",
  "sign-up deadline", "signup deadline", "early bird registration",
  "registration now open", "registration is open",
  "newsletter", "e-newsletter", "email blast",
  "obituary", "obituaries", "in memoriam", "funeral service", "memorial service",
  "for sale", "price reduced", "open house", "just listed", "mls#",
  "new listing", "price cut", "reduced price", "asking price",
  "zoning hearing", "planning commission", "public comment period",
  "code enforcement", "variance request", "rezoning",
  "public hearing", "budget hearing", "city council agenda",
  "practice schedule", "tryout schedule", "game schedule", "season schedule",
  "tournament schedule", "preseason schedule",
  "high school baseball", "high school basketball", "high school football",
  "high school soccer", "high school softball", "high school volleyball",
  "high school tennis", "high school track", "high school wrestling",
  "high school swimming", "high school golf", "high school lacrosse",
  "jv schedule", "varsity schedule", "junior varsity",
  "sports analytics club", "analytics club meeting",
];

function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const COURSE_CODE_RX = /\b(ACCT|CHEM|PHYS|MATH|ENGR|ECON|PSYC|BIOL|COMM|PHIL|EXER|ITSC|ITIS|STAT|SOCY|POLS|HIST|GEOG|ANTH|MGMT|FINN|MKTG|INFO|LBST|ENGL|NURS|KNES|AERO|MSCI|EDUC|SOWK|MUSC|THEA|DANC|ARTH|ARCH|ELED|ECGR|MECH|MINE|CIVL|BINF|BIOE|SENG|GEOL|ATMS|MBAD|MACC|MHIT|MNGT|OPMT|DSBA)\s*\d{3,4}\b/i;

interface FilterResult {
  passed: boolean;
  reason?: string;
  matchedTerm?: string;
}

function checkEventFilter(
  title: string,
  description: string,
  locationName: string | null,
  address: string | null,
): FilterResult {
  const text = stripDiacritics(`${title} ${description}`.toLowerCase());

  for (const term of NEGATIVE_BLOCKLIST) {
    if (text.includes(term)) return { passed: false, reason: "negative_content", matchedTerm: term };
  }
  for (const term of EVENT_IRRELEVANT_BLOCKLIST) {
    if (text.includes(term)) return { passed: false, reason: "academic_administrative", matchedTerm: term };
  }
  for (const term of EDUCATION_BLOCKLIST) {
    if (text.includes(term)) return { passed: false, reason: "education_content", matchedTerm: term };
  }
  for (const term of LOW_INTEREST_BLOCKLIST) {
    if (text.includes(term)) return { passed: false, reason: "low_interest_content", matchedTerm: term };
  }

  if (COURSE_CODE_RX.test(title)) {
    return { passed: false, reason: "academic_course_code", matchedTerm: title };
  }

  if (title.trim().length < 15) {
    return { passed: false, reason: "event_title_too_short", matchedTerm: title.trim() };
  }

  if (title.length > 10 && title === title.toUpperCase() && /[A-Z]/.test(title)) {
    return { passed: false, reason: "all_caps_title", matchedTerm: title };
  }

  const hasLocation = !!(locationName?.trim() || address?.trim());
  if (!hasLocation) {
    return { passed: false, reason: "no_location", matchedTerm: undefined };
  }

  return { passed: true };
}

async function cleanupFilteredEvents() {
  const dryRun = !process.argv.includes("--apply");
  const mode = dryRun ? "DRY RUN" : "APPLY";
  console.log(`[CLEANUP-EVENTS] Starting retroactive event cleanup (${mode})...`);
  if (dryRun) {
    console.log("[CLEANUP-EVENTS] Pass --apply to actually delete events.");
  }

  const allAutoIngested = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      locationName: events.locationName,
      address: events.address,
      seedSourceType: events.seedSourceType,
    })
    .from(events)
    .where(isNotNull(events.seedSourceType));

  console.log(`[CLEANUP-EVENTS] Found ${allAutoIngested.length} auto-ingested events to check`);

  const toDelete: { id: string; title: string; reason: string }[] = [];

  for (const evt of allAutoIngested) {
    const result = checkEventFilter(
      evt.title,
      evt.description || "",
      evt.locationName,
      evt.address,
    );

    if (!result.passed) {
      const reason = result.matchedTerm
        ? `${result.reason}: matched "${result.matchedTerm}"`
        : result.reason || "unknown";
      toDelete.push({ id: evt.id, title: evt.title, reason });
    }
  }

  console.log(`[CLEANUP-EVENTS] ${toDelete.length} events would be removed by the updated filter`);

  if (toDelete.length === 0) {
    console.log("[CLEANUP-EVENTS] No events to clean up. Done.");
    process.exit(0);
  }

  console.log("[CLEANUP-EVENTS] Events to remove:");
  const reasonCounts: Record<string, number> = {};
  for (const item of toDelete) {
    const shortReason = item.reason.split(":")[0];
    reasonCounts[shortReason] = (reasonCounts[shortReason] || 0) + 1;
    console.log(`  - [${item.reason}] "${item.title.slice(0, 80)}"`);
  }

  console.log("\n[CLEANUP-EVENTS] Summary by reason:");
  for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`);
  }

  if (dryRun) {
    console.log(`\n[CLEANUP-EVENTS] DRY RUN complete. ${toDelete.length} events would be deleted.`);
    console.log("[CLEANUP-EVENTS] Run with --apply to actually delete them.");
    process.exit(0);
  }

  const idsToDelete = toDelete.map((e) => e.id);
  const batchSize = 100;
  let deletedTotal = 0;

  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    await db.delete(events).where(inArray(events.id, batch));
    deletedTotal += batch.length;
    console.log(`[CLEANUP-EVENTS] Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} events (total: ${deletedTotal})`);
  }

  console.log(`[CLEANUP-EVENTS] Done. Removed ${deletedTotal} events.`);
  process.exit(0);
}

cleanupFilteredEvents().catch((err) => {
  console.error("[CLEANUP-EVENTS] Error:", err);
  process.exit(1);
});
