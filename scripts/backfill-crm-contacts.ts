import { db } from "../server/db";
import { businesses, crmContacts, users } from "../shared/schema";
import { eq, sql, isNull, and } from "drizzle-orm";

async function backfillCrmContacts() {
  const [adminUser] = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN")).limit(1);
  if (!adminUser) {
    console.error("No SUPER_ADMIN user found");
    process.exit(1);
  }
  console.log(`Using admin user: ${adminUser.id}`);

  const existingLinked = await db
    .select({ linkedBusinessId: crmContacts.linkedBusinessId })
    .from(crmContacts)
    .where(sql`${crmContacts.linkedBusinessId} IS NOT NULL`);

  const alreadyLinkedIds = new Set(existingLinked.map(c => c.linkedBusinessId));
  console.log(`Already linked to CRM: ${alreadyLinkedIds.size} businesses`);

  const bizList = await db.select({
    id: businesses.id,
    name: businesses.name,
    phone: businesses.phone,
    ownerEmail: businesses.ownerEmail,
    websiteUrl: businesses.websiteUrl,
    address: businesses.address,
    googlePlaceId: businesses.googlePlaceId,
  }).from(businesses).where(sql`${businesses.googlePlaceId} IS NOT NULL`);

  console.log(`Found ${bizList.length} businesses with Google Place IDs`);

  let created = 0;
  let skipped = 0;

  for (const biz of bizList) {
    if (alreadyLinkedIds.has(biz.id)) {
      skipped++;
      continue;
    }

    const hasContact = biz.phone || biz.ownerEmail || biz.websiteUrl;

    try {
      await db.insert(crmContacts).values({
        userId: adminUser.id,
        name: biz.name,
        company: biz.name,
        phone: biz.phone || null,
        email: biz.ownerEmail || null,
        website: biz.websiteUrl || null,
        address: biz.address || null,
        linkedBusinessId: biz.id,
        category: "potential_client",
        status: "active",
        captureMethod: "google_places",
        connectionSource: "google_places_import",
        notes: hasContact
          ? "Backfilled from Google Places import with contact info"
          : "Backfilled from Google Places import — no contact info yet",
      });
      created++;
      console.log(`[${created + skipped}/${bizList.length}] Created contact: ${biz.name}${biz.phone ? ` (${biz.phone})` : ""}`);
    } catch (err: any) {
      console.error(`Failed to create contact for ${biz.name}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${created} contacts created, ${skipped} already existed`);
  process.exit(0);
}

backfillCrmContacts().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
