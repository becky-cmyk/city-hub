import { computeAllTrustProfiles, runDecayDetection } from "./trust-service";

let schedulerInterval: NodeJS.Timeout | null = null;

const TRUST_RECALC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startTrustScheduler() {
  if (schedulerInterval) {
    console.log("[TrustScheduler] Already running, skipping start");
    return;
  }

  console.log("[TrustScheduler] Starting periodic trust recalculation (every 24h)");

  schedulerInterval = setInterval(async () => {
    try {
      console.log("[TrustScheduler] Beginning periodic trust recalculation...");
      const computeResult = await computeAllTrustProfiles();
      console.log(`[TrustScheduler] Recalculation complete: ${computeResult.processed} processed, ${computeResult.errors} errors`);

      const decayResult = await runDecayDetection();
      console.log(`[TrustScheduler] Decay scan complete: ${decayResult.flagged} flagged, ${decayResult.atRisk} at-risk, ${decayResult.errors} errors`);
    } catch (err) {
      console.error("[TrustScheduler] Error during periodic recalculation:", err);
    }
  }, TRUST_RECALC_INTERVAL_MS);
}

export function stopTrustScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[TrustScheduler] Stopped");
  }
}
