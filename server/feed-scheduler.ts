import { runAllDue } from "./intelligence/jobRunner";

const FEED_INTERVAL_MS = 2 * 60 * 60 * 1000;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startFeedScheduler() {
  if (schedulerTimer) return;

  console.log(`[FeedScheduler] Starting — feed ingestion every 2 hours`);

  setTimeout(async () => {
    console.log(`[FeedScheduler] Running initial feed ingestion on startup...`);
    try {
      const result = await runAllDue();
      const totalInserted = result.results.reduce((sum: number, r: any) => sum + (r.rowsInserted || 0), 0);
      console.log(`[FeedScheduler] Initial run complete: ${result.ran} feeds pulled, ${totalInserted} inserted`);
    } catch (err: any) {
      console.error(`[FeedScheduler] Initial run error:`, err.message);
    }
  }, 30000);

  schedulerTimer = setInterval(async () => {
    console.log(`[FeedScheduler] Running scheduled feed ingestion...`);
    try {
      const result = await runAllDue();
      const totalInserted = result.results.reduce((sum: number, r: any) => sum + (r.rowsInserted || 0), 0);
      const totalUpdated = result.results.reduce((sum: number, r: any) => sum + (r.rowsUpdated || 0), 0);
      console.log(`[FeedScheduler] Complete: ${result.ran} feeds pulled, ${totalInserted} inserted, ${totalUpdated} updated`);
    } catch (err: any) {
      console.error(`[FeedScheduler] Error:`, err.message);
    }
  }, FEED_INTERVAL_MS);
}
