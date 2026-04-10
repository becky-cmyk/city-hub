export async function pullMultifamilyListings(): Promise<void> {
  const enabled = process.env.ENABLE_MULTIFAMILY_PULL === "true";

  if (!enabled) {
    console.log("[MULTIFAMILY-PULL] Disabled. Set ENABLE_MULTIFAMILY_PULL=true to enable.");
    return;
  }

  // TODO: Implement multifamily/apartment listings pull
  // Potential sources:
  //   - Apartments.com API (if licensed)
  //   - CoStar / RealPage data feeds (enterprise license)
  //   - Public permit databases for new construction
  //   - Local MLS feeds for multifamily properties
  //   - Manual CSV imports from commercial RE brokers
  //
  // Steps:
  //   1. Fetch new/updated multifamily listings from source
  //   2. Parse records: property name, address, unit count, developer, mgmt company, rent range, completion date
  //   3. Map address ZIP to zoneId via zones table lookup
  //   4. Normalize via normalizeMultifamily() from server/services/normalize.ts
  //   5. Upsert into multifamily_log (dedupe by propertyName + address composite)
  //   6. Create signals_feed entry for each new property (signalType = "multifamily")
  //
  // Cadence: Weekly
  // Rate limiting: Respect source API quotas
  // Error handling: Log failures per record, continue batch
  // State tracking: Store last pull timestamp and source cursor

  console.log("[MULTIFAMILY-PULL] Would pull multifamily listings here. Not yet implemented.");
}
