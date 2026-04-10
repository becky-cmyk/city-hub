import { db } from "./db";
import { presenceAuditLog } from "@shared/schema";

type ActorType = "admin" | "sales" | "owner" | "charlotte_ai" | "system" | "operator";

interface AuditContext {
  presenceId: string;
  actorType: ActorType;
  actorUserId?: string;
  reason?: string;
}

export async function logPresenceFieldChange(
  ctx: AuditContext,
  fieldName: string,
  oldValue: string | null | undefined,
  newValue: string | null | undefined,
) {
  const oldStr = oldValue != null ? String(oldValue) : null;
  const newStr = newValue != null ? String(newValue) : null;
  if (oldStr === newStr) return;

  await db.insert(presenceAuditLog).values({
    presenceId: ctx.presenceId,
    actorType: ctx.actorType,
    actorUserId: ctx.actorUserId ?? null,
    fieldName,
    oldValue: oldStr,
    newValue: newStr,
    reason: ctx.reason ?? null,
  });
}

export async function logPresenceChanges(
  ctx: AuditContext,
  oldRecord: Record<string, any>,
  newValues: Record<string, any>,
) {
  const spineFields = [
    "claim_status", "claimStatus",
    "charlotte_verification_status", "charlotteVerificationStatus",
    "microsite_tier", "micrositeTier",
    "listing_tier", "listingTier",
    "presence_status", "presenceStatus",
    "presence_type", "presenceType",
    "is_verified", "isVerified",
    "microsite_enabled", "micrositeEnabled",
    "supporter_grace_started_at", "supporterGraceStartedAt",
    "supporter_grace_end_at", "supporterGraceEndAt",
    "owner_email", "ownerEmail",
    "name",
  ];

  for (const field of Object.keys(newValues)) {
    if (!spineFields.includes(field)) continue;
    const oldVal = oldRecord[field];
    const newVal = newValues[field];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      await logPresenceFieldChange(ctx, field, oldVal, newVal);
    }
  }
}
