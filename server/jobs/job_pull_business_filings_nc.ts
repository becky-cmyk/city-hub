export async function pullBusinessFilingsNC(): Promise<void> {
  const enabled = process.env.ENABLE_FILINGS_PULL === "true";

  if (!enabled) {
    console.log("[FILINGS-PULL] Disabled. Set ENABLE_FILINGS_PULL=true to enable.");
    return;
  }

  // TODO: Implement NC Secretary of State business filings pull
  // Source: https://www.sosnc.gov/online_services/search/by_title/_Business_Registration
  // Steps:
  //   1. Fetch new filings from NC SOS API or scrape search results
  //   2. Parse filing records: business name, filing date, status, organizer, registered agent/address
  //   3. Map filing address ZIP to zoneId via zones table lookup
  //   4. Normalize via normalizeBusinessFiling() from server/services/normalize.ts
  //   5. Upsert into business_filings_log (dedupe by filingExternalId or businessName+filingDate+address)
  //   6. Create signals_feed entry for each new filing (signalType = "business_filing")
  //
  // Cadence: Daily or weekly cron
  // Rate limiting: Respect source rate limits, add exponential backoff
  // Error handling: Log failures, continue processing remaining records
  // State tracking: Store last pull timestamp to avoid re-fetching

  console.log("[FILINGS-PULL] Would pull NC business filings here. Not yet implemented.");
}
