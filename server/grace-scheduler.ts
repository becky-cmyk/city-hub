import { storage } from "./storage";
import { pool } from "./db";

const GRACE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function startGraceScheduler(): void {
  console.log("[GraceScheduler] Starting daily grace period enforcement (checks hourly)");
  runGraceEnforcement().catch(err => console.error("[GraceScheduler] Initial run error:", err.message));
  setInterval(() => {
    runGraceEnforcement().catch(err => console.error("[GraceScheduler] Error:", err.message));
  }, GRACE_CHECK_INTERVAL_MS);
}

export async function runGraceEnforcement(): Promise<{ legacyExpired: number; hubExpired: number }> {
  const legacyExpired = await storage.processExpiredGracePeriods();
  if (legacyExpired > 0) {
    console.log(`[GraceScheduler] Expired ${legacyExpired} legacy entitlements past grace period`);
  }

  const hubEngine = await import("./hub-entitlements");
  const hubExpired = await hubEngine.processExpiredHubGracePeriods();
  if (hubExpired > 0) {
    console.log(`[GraceScheduler] Expired ${hubExpired} hub-scoped entitlements past grace period`);

    try {
      const { rows: expiredHubBusinesses } = await pool.query(
        `SELECT DISTINCT presence_id FROM hub_entitlements
         WHERE status = 'EXPIRED' AND updated_at > NOW() - INTERVAL '1 hour'`
      );
      for (const row of expiredHubBusinesses) {
        const { rows: activeHubs } = await pool.query(
          `SELECT 1 FROM hub_entitlements WHERE presence_id = $1 AND status = 'ACTIVE' LIMIT 1`,
          [row.presence_id]
        );
        if (activeHubs.length === 0) {
          await pool.query(
            `UPDATE businesses SET listing_tier = 'VERIFIED' WHERE id = $1 AND listing_tier != 'VERIFIED'`,
            [row.presence_id]
          );
          await pool.query(
            `UPDATE presence_subscriptions SET status = 'expired', updated_at = NOW()
             WHERE presence_id = $1 AND status IN ('active', 'grace')`,
            [row.presence_id]
          );
          console.log(`[GraceScheduler] Downgraded business ${row.presence_id} to VERIFIED (all hub entitlements expired)`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[GraceScheduler] Hub business downgrade error:", message);
    }
  }

  if (legacyExpired > 0) {
    try {
      const { rows: expiredBusinesses } = await pool.query(
        `SELECT DISTINCT subject_id FROM entitlements
         WHERE status = 'EXPIRED' AND product_type = 'LISTING_TIER'
         AND updated_at > NOW() - INTERVAL '1 hour'`
      );
      for (const row of expiredBusinesses) {
        await pool.query(
          `UPDATE businesses SET listing_tier = 'VERIFIED' WHERE id = $1 AND listing_tier != 'VERIFIED'`,
          [row.subject_id]
        );
        await pool.query(
          `UPDATE presence_subscriptions SET status = 'expired', updated_at = NOW()
           WHERE presence_id = $1 AND status IN ('active', 'grace')`,
          [row.subject_id]
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[GraceScheduler] Business tier downgrade error:", message);
    }
  }

  return { legacyExpired, hubExpired };
}
