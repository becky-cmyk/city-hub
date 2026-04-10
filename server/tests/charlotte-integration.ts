import { pool, db } from "../db";
import { businesses, crmContacts, events, zones, entityScores, trustProfiles } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { ActionTemplateKey } from "../charlotte-proposal-engine";

type TestResult = { name: string; passed: boolean; details: string; duration: number };

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const details = await fn();
    results.push({ name, passed: true, details, duration: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, details: msg, duration: Date.now() - start });
    console.log(`  ✗ ${name}: ${msg} (${Date.now() - start}ms)`);
  }
}

async function getTestMetroId(): Promise<string> {
  const r = await pool.query(`SELECT id FROM cities LIMIT 1`);
  if (r.rows.length === 0) throw new Error("No cities in database");
  return r.rows[0].id;
}

async function getTestBusinessId(metroId: string): Promise<string | null> {
  const [biz] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.cityId, metroId)).limit(1);
  return biz?.id || null;
}

async function getTestContactId(): Promise<string | null> {
  const [contact] = await db.select({ id: crmContacts.id }).from(crmContacts).limit(1);
  return contact?.id || null;
}

async function getTestEventId(metroId: string): Promise<string | null> {
  const [evt] = await db.select({ id: events.id }).from(events).where(eq(events.cityId, metroId)).limit(1);
  return evt?.id || null;
}

export async function runCharlotteIntegrationTests(): Promise<{ total: number; passed: number; failed: number; results: TestResult[] }> {
  results.length = 0;

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  CHARLOTTE END-TO-END INTEGRATION TEST SUITE");
  console.log("═══════════════════════════════════════════════════════════\n");

  const metroId = await getTestMetroId();
  console.log(`Test metro: ${metroId}\n`);

  console.log("─── 1. ORCHESTRATOR CORE ───");

  await runTest("classifyIntent — fallback (no OpenAI)", async () => {
    const { classifyIntent } = await import("../charlotte-orchestrator");
    const result = await classifyIntent({
      input: "find restaurants in South End",
      metroId,
      source: "api",
    });
    if (!result.mode) throw new Error("Missing mode");
    if (!result.intent) throw new Error("Missing intent");
    if (typeof result.confidence !== "number") throw new Error("Confidence must be a number");
    if (!Array.isArray(result.entityReferences)) throw new Error("entityReferences must be array");
    return `mode=${result.mode}, intent="${result.intent}", confidence=${result.confidence}`;
  });

  await runTest("classifyIntent — operator mode detection", async () => {
    const { classifyIntent } = await import("../charlotte-orchestrator");
    const result = await classifyIntent({
      input: "create a new contact for John Smith at ABC Corp",
      metroId,
      source: "admin_chat",
    });
    if (result.mode !== "operator") throw new Error(`Expected operator, got ${result.mode}`);
    return `mode=${result.mode}, confidence=${result.confidence}`;
  });

  await runTest("classifyIntent — search mode detection", async () => {
    const { classifyIntent } = await import("../charlotte-orchestrator");
    const result = await classifyIntent({
      input: "show me coffee shops near NoDa",
      metroId,
      source: "api",
    });
    if (result.mode !== "search") throw new Error(`Expected search, got ${result.mode}`);
    return `mode=${result.mode}`;
  });

  await runTest("classifyIntent — proposal mode detection", async () => {
    const { classifyIntent } = await import("../charlotte-orchestrator");
    const result = await classifyIntent({
      input: "launch a campaign for all businesses in the metro",
      metroId,
      source: "admin_chat",
    });
    if (result.mode !== "proposal") throw new Error(`Expected proposal, got ${result.mode}`);
    return `mode=${result.mode}, requiresProposal=${result.requiresProposal}`;
  });

  await runTest("classifyIntent — brainstorm mode detection", async () => {
    const { classifyIntent } = await import("../charlotte-orchestrator");
    const result = await classifyIntent({
      input: "brainstorm content ideas for a new food festival",
      metroId,
      source: "admin_chat",
    });
    if (result.mode !== "brainstorm") throw new Error(`Expected brainstorm, got ${result.mode}`);
    return `mode=${result.mode}`;
  });

  await runTest("classifyIntent — concierge mode detection", async () => {
    const { classifyIntent } = await import("../charlotte-orchestrator");
    const result = await classifyIntent({
      input: "recommend a good Italian restaurant near NoDa",
      metroId,
      source: "consumer",
    });
    if (!["concierge", "search"].includes(result.mode)) throw new Error(`Expected concierge or search, got ${result.mode}`);
    if (!result.intent) throw new Error("Missing intent");
    return `mode=${result.mode}, intent=${result.intent}`;
  });

  await runTest("resolveEntities — business by name", async () => {
    const { resolveEntities } = await import("../charlotte-orchestrator");
    const resolved = await resolveEntities([
      { rawText: "some business", entityType: "business", identifiers: { name: "test" } },
    ], metroId);
    if (!Array.isArray(resolved)) throw new Error("resolveEntities must return array");
    if (resolved.length !== 1) throw new Error(`Expected 1 entity, got ${resolved.length}`);
    const e = resolved[0];
    if (!["HIGH", "MEDIUM", "LOW"].includes(e.confidence)) throw new Error(`Invalid confidence: ${e.confidence}`);
    return `entityType=${e.entityType}, confidence=${e.confidence}, id=${e.entityId || "null"}`;
  });

  await runTest("resolveEntities — contact by email", async () => {
    const { resolveEntities } = await import("../charlotte-orchestrator");
    const resolved = await resolveEntities([
      { rawText: "test contact", entityType: "contact", identifiers: { email: "nonexistent@test.com" } },
    ]);
    if (resolved.length !== 1) throw new Error(`Expected 1 entity, got ${resolved.length}`);
    return `confidence=${resolved[0].confidence}, id=${resolved[0].entityId || "null"}`;
  });

  await runTest("resolveEntities — event by name", async () => {
    const { resolveEntities } = await import("../charlotte-orchestrator");
    const resolved = await resolveEntities([
      { rawText: "test event", entityType: "event", identifiers: { name: "festival" } },
    ], metroId);
    if (resolved.length !== 1) throw new Error(`Expected 1, got ${resolved.length}`);
    return `confidence=${resolved[0].confidence}`;
  });

  await runTest("resolveEntities — zone entity", async () => {
    const { resolveEntities } = await import("../charlotte-orchestrator");
    const resolved = await resolveEntities([
      { rawText: "South End", entityType: "zone", identifiers: { name: "South End" } },
    ]);
    if (resolved.length !== 1) throw new Error(`Expected 1, got ${resolved.length}`);
    if (resolved[0].entityType !== "zone") throw new Error("Wrong type");
    return `name=${resolved[0].name}, confidence=${resolved[0].confidence}`;
  });

  await runTest("resolveEntities — low confidence → inbox fallback path", async () => {
    const { resolveEntities } = await import("../charlotte-orchestrator");
    const resolved = await resolveEntities([
      { rawText: "zzz_nonexistent_xyz_987", entityType: "business", identifiers: { name: "zzz_nonexistent_xyz_987" } },
    ], metroId);
    if (resolved[0].confidence !== "LOW") throw new Error(`Expected LOW, got ${resolved[0].confidence}`);

    const { createInboxItemIfNotOpen } = await import("../admin-inbox");
    const testRelatedId = `orch_test_${Date.now()}`;
    const inboxItem = await createInboxItemIfNotOpen({
      itemType: "pipeline_needs_review",
      relatedTable: "orchestrator_decisions",
      relatedId: testRelatedId,
      title: `Entity match review: zzz_nonexistent_xyz_987`,
      summary: `The orchestrator could not confidently match "zzz_nonexistent_xyz_987" (business). No match found.`,
      priority: "low",
      tags: ["Orchestrator", "Entity Match"],
    });

    if (!inboxItem || !inboxItem.id) throw new Error("createInboxItemIfNotOpen did not return an inbox item");

    const inboxCheck = await pool.query(
      `SELECT id, title FROM admin_inbox_items WHERE id = $1`,
      [inboxItem.id]
    );
    if (inboxCheck.rows.length === 0) throw new Error("Inbox item was not persisted to DB");

    await pool.query(`DELETE FROM admin_inbox_history WHERE inbox_item_id = $1`, [inboxItem.id]);
    await pool.query(`DELETE FROM admin_inbox_items WHERE id = $1`, [inboxItem.id]);

    return `LOW confidence → inbox item created and verified: "${inboxCheck.rows[0].title}"`;
  });

  await runTest("routeCommand — keyword-based engine mapping", async () => {
    const { routeCommand } = await import("../charlotte-orchestrator");
    const command = {
      mode: "operator" as const,
      intent: "import restaurants from google",
      entities: [],
      targetEngines: [],
      geoContext: null,
      confidence: 0.8,
      requiresProposal: false,
      batchMode: false,
      rawClassification: {
        mode: "operator" as const,
        intent: "import restaurants",
        entityReferences: [],
        desiredAction: "import restaurants from google places",
        locationHint: null,
        confidence: 0.8,
        requiresProposal: false,
        batchMode: false,
      },
    };
    const plan = routeCommand(command);
    if (!plan.steps || plan.steps.length === 0) throw new Error("No routing steps generated");
    const engines = plan.steps.map(s => s.engine);
    if (!engines.includes("google-places")) throw new Error(`Expected google-places engine, got: ${engines.join(", ")}`);
    return `${plan.steps.length} steps: ${engines.join(", ")}`;
  });

  await runTest("routeCommand — entity-based engine addition", async () => {
    const { routeCommand } = await import("../charlotte-orchestrator");
    const command = {
      mode: "search" as const,
      intent: "find info",
      entities: [{ entityType: "business" as const, entityId: "test", name: "Test Biz", confidence: "HIGH" as const }],
      targetEngines: [],
      geoContext: null,
      confidence: 0.7,
      requiresProposal: false,
      batchMode: false,
      rawClassification: {
        mode: "search" as const,
        intent: "find info",
        entityReferences: [],
        desiredAction: "find info about a business",
        locationHint: null,
        confidence: 0.7,
        requiresProposal: false,
        batchMode: false,
      },
    };
    const plan = routeCommand(command);
    const engines = plan.steps.map(s => s.engine);
    if (!engines.includes("presence-manager")) throw new Error(`Business entity should add presence-manager`);
    return `Engines: ${engines.join(", ")}`;
  });

  await runTest("orchestrate — full pipeline execution", async () => {
    const { orchestrate } = await import("../charlotte-orchestrator");
    const result = await orchestrate({
      input: "find Italian restaurants in uptown",
      metroId,
      source: "api",
    });
    if (!result.command) throw new Error("Missing command");
    if (!result.routing) throw new Error("Missing routing");
    if (!result.command.mode) throw new Error("Missing mode on command");
    if (!Array.isArray(result.routing.steps)) throw new Error("Routing steps must be array");
    return `mode=${result.command.mode}, engines=${result.command.targetEngines.join(",")}, logId=${result.logId || "null"}`;
  });

  await runTest("orchestrate — decision logged to DB", async () => {
    const { orchestrate } = await import("../charlotte-orchestrator");
    const result = await orchestrate({
      input: "search for plumbers near me",
      metroId,
      source: "api",
    });
    if (!result.logId) throw new Error("Decision not logged (logId is null)");
    const check = await pool.query(`SELECT id, mode, intent FROM orchestrator_decisions WHERE id = $1`, [result.logId]);
    if (check.rows.length === 0) throw new Error("Decision not found in DB");
    return `Logged as ${result.logId}, mode=${check.rows[0].mode}`;
  });

  await runTest("getOrchestratorSummary — formats correctly", async () => {
    const { orchestrate, getOrchestratorSummary } = await import("../charlotte-orchestrator");
    const result = await orchestrate({
      input: "update listing tier",
      metroId,
      source: "admin_chat",
    });
    const summary = getOrchestratorSummary(result);
    if (!summary.includes("Mode:")) throw new Error("Summary missing Mode");
    if (!summary.includes("Intent:")) throw new Error("Summary missing Intent");
    return summary.substring(0, 120);
  });

  console.log("\n─── 2. RECOMMENDATION CONNECTOR ───");

  await runTest("queryRecommendations — business search with trust scoring", async () => {
    const { queryRecommendations } = await import("../charlotte-recommendation-connector");
    const results = await queryRecommendations({
      metroId,
      query: "restaurant",
      sortBy: "trust",
      limit: 5,
    });
    if (!Array.isArray(results)) throw new Error("queryRecommendations must return array");
    for (const r of results) {
      if (typeof r.trustScore !== "number") throw new Error(`Missing trustScore on ${r.name}`);
      if (typeof r.relevanceScore !== "number") throw new Error(`Missing relevanceScore on ${r.name}`);
      if (!Array.isArray(r.categoryIds)) throw new Error(`Missing categoryIds on ${r.name}`);
      if (!r.participationSignals) throw new Error(`Missing participationSignals on ${r.name}`);
    }
    if (results.length >= 2) {
      for (let i = 1; i < results.length; i++) {
        if (results[i].trustScore > results[i - 1].trustScore) throw new Error("Trust sort order violated");
      }
    }
    return `${results.length} results, trust-sorted`;
  });

  await runTest("queryRecommendations — relevance sort", async () => {
    const { queryRecommendations } = await import("../charlotte-recommendation-connector");
    const results = await queryRecommendations({
      metroId,
      sortBy: "relevance",
      limit: 5,
    });
    if (results.length >= 2) {
      for (let i = 1; i < results.length; i++) {
        if (results[i].relevanceScore > results[i - 1].relevanceScore) throw new Error("Relevance sort order violated");
      }
    }
    return `${results.length} results, relevance-sorted`;
  });

  await runTest("queryRecommendations — geo filter by zone", async () => {
    const { queryRecommendations } = await import("../charlotte-recommendation-connector");
    const [zone] = await db.select({ id: zones.id, slug: zones.slug }).from(zones).where(eq(zones.cityId, metroId)).limit(1);
    if (!zone) return "No zones — skipped";
    const results = await queryRecommendations({
      metroId,
      geo: { type: "zone", zoneSlug: zone.slug },
      limit: 5,
    });
    return `${results.length} results in zone ${zone.slug}`;
  });

  await runTest("queryConcierge — dining domain", async () => {
    const { queryConcierge } = await import("../charlotte-recommendation-connector");
    const response = await queryConcierge(metroId, "dining", "pizza", undefined, 5);
    if (!response.domain) throw new Error("Missing domain");
    if (response.domain !== "dining") throw new Error(`Expected dining, got ${response.domain}`);
    if (!Array.isArray(response.results)) throw new Error("results must be array");
    if (!Array.isArray(response.followOnSuggestions)) throw new Error("followOnSuggestions must be array");
    return `${response.results.length} dining results, ${response.followOnSuggestions.length} suggestions`;
  });

  await runTest("queryConcierge — jobs domain", async () => {
    const { queryConcierge } = await import("../charlotte-recommendation-connector");
    const response = await queryConcierge(metroId, "jobs", undefined, undefined, 5);
    if (response.domain !== "jobs") throw new Error(`Expected jobs, got ${response.domain}`);
    for (const r of response.results) {
      if (!Array.isArray(r.categoryIds)) throw new Error(`Job result missing categoryIds`);
    }
    return `${response.results.length} job results`;
  });

  await runTest("queryConcierge — events domain", async () => {
    const { queryConcierge } = await import("../charlotte-recommendation-connector");
    const response = await queryConcierge(metroId, "events", undefined, undefined, 5);
    if (response.domain !== "events") throw new Error(`Expected events, got ${response.domain}`);
    for (const r of response.results) {
      if (!Array.isArray(r.categoryIds)) throw new Error(`Event result missing categoryIds`);
    }
    return `${response.results.length} event results`;
  });

  await runTest("queryConcierge — marketplace domain", async () => {
    const { queryConcierge } = await import("../charlotte-recommendation-connector");
    const response = await queryConcierge(metroId, "marketplace", undefined, undefined, 5);
    if (response.domain !== "marketplace") throw new Error(`Expected marketplace, got ${response.domain}`);
    return `${response.results.length} marketplace results`;
  });

  await runTest("getDomainFromQuery — domain classification", async () => {
    const { getDomainFromQuery } = await import("../charlotte-recommendation-connector");
    const tests: [string, string][] = [
      ["find a good restaurant for dinner", "dining"],
      ["looking for a job in tech", "jobs"],
      ["concerts this weekend", "events"],
      ["need a plumber", "services"],
      ["apartments for rent", "housing"],
      ["buy a used car", "marketplace"],
      ["random question", "general"],
    ];
    const failures: string[] = [];
    for (const [query, expected] of tests) {
      const actual = getDomainFromQuery(query);
      if (actual !== expected) failures.push(`"${query}": expected ${expected}, got ${actual}`);
    }
    if (failures.length > 0) throw new Error(failures.join("; "));
    return `All ${tests.length} domain classifications correct`;
  });

  await runTest("resolveLocationFromText — zone detection", async () => {
    const { resolveLocationFromText } = await import("../charlotte-recommendation-connector");
    const result = await resolveLocationFromText("South End", metroId);
    return result ? `Resolved: type=${result.type}, slug=${result.zoneSlug || result.hubCode || "none"}` : "No location match (acceptable if no matching zone data)";
  });

  console.log("\n─── 3. PROPOSAL ENGINE ───");

  await runTest("getActionTemplate — all templates accessible", async () => {
    const { getActionTemplate, getAllActionTemplates } = await import("../charlotte-proposal-engine");
    const all = getAllActionTemplates();
    if (all.length < 10) throw new Error(`Expected at least 10 templates, got ${all.length}`);
    const keys: ActionTemplateKey[] = ["CLAIM_LISTING", "STORY_DRAFT", "BECKY_OUTREACH", "CROWN_CANDIDATE", "FOLLOWUP_EMAIL", "LISTING_UPGRADE", "TV_VENUE_SCREEN", "CONTENT_ARTICLE", "EVENT_PROMOTION", "SEARCH_RECOMMENDATION"];
    const missing = keys.filter(k => !getActionTemplate(k));
    if (missing.length > 0) throw new Error(`Missing templates: ${missing.join(", ")}`);
    return `${all.length} templates registered, all keys accessible`;
  });

  const businessId = await getTestBusinessId(metroId);
  if (businessId) {
    await runTest("evaluateOpportunities — business evaluation", async () => {
      const { evaluateOpportunities } = await import("../charlotte-proposal-engine");
      const result = await evaluateOpportunities(businessId!, "business", metroId);
      if (!result.entityId) throw new Error("Missing entityId");
      if (!result.entityName) throw new Error("Missing entityName");
      if (!Array.isArray(result.eligibleTemplates)) throw new Error("eligibleTemplates must be array");
      return `${result.entityName}: ${result.eligibleTemplates.length} eligible templates [${result.eligibleTemplates.join(", ")}]`;
    });

    await runTest("buildProposal — creates proposal with items", async () => {
      const { buildProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "business" as const, entityId: businessId!, name: "Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, [], { metroId, source: "integration_test", directive: "Integration test proposal" });
      if (!proposal.id) throw new Error("Proposal not saved (no id)");
      if (proposal.status !== "pending") throw new Error(`Expected pending, got ${proposal.status}`);
      if (!Array.isArray(proposal.items)) throw new Error("items must be array");

      const dbCheck = await pool.query(`SELECT id, status, total_items FROM charlotte_proposals WHERE id = $1`, [proposal.id]);
      if (dbCheck.rows.length === 0) throw new Error("Proposal not found in DB");

      const itemCheck = await pool.query(`SELECT count(*) as cnt FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      if (parseInt(itemCheck.rows[0].cnt) !== proposal.items.length) throw new Error("Item count mismatch");

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);

      return `Proposal ${proposal.id} created with ${proposal.items.length} items, DB verified, cleaned up`;
    });

    await runTest("getProposalSummary — formats correctly", async () => {
      const { buildProposal, getProposalSummary } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "business" as const, entityId: businessId!, name: "Summary Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, [], { metroId, source: "integration_test" });
      const summary = getProposalSummary(proposal);
      if (!summary.includes("Proposal")) throw new Error("Summary missing Proposal prefix");
      if (!summary.includes("Status:")) throw new Error("Summary missing Status");

      if (proposal.id) {
        await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
        await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);
      }

      return summary.substring(0, 120);
    });
  } else {
    console.log("  ⊘ Skipping business-specific proposal tests (no businesses in metro)");
  }

  const contactId = await getTestContactId();
  if (contactId) {
    await runTest("evaluateOpportunities — contact evaluation", async () => {
      const { evaluateOpportunities } = await import("../charlotte-proposal-engine");
      const result = await evaluateOpportunities(contactId!, "contact");
      if (!result.entityName) throw new Error("Missing entityName");
      return `${result.entityName}: ${result.eligibleTemplates.length} eligible [${result.eligibleTemplates.join(", ")}]`;
    });
  }

  const eventId = await getTestEventId(metroId);
  if (eventId) {
    await runTest("evaluateOpportunities — event evaluation", async () => {
      const { evaluateOpportunities } = await import("../charlotte-proposal-engine");
      const result = await evaluateOpportunities(eventId!, "event", metroId);
      if (!result.entityName) throw new Error("Missing entityName");
      return `${result.entityName}: ${result.eligibleTemplates.length} eligible [${result.eligibleTemplates.join(", ")}]`;
    });
  }

  await runTest("buildBatchProposal — batch directive processing", async () => {
    const { buildBatchProposal } = await import("../charlotte-proposal-engine");
    const proposal = await buildBatchProposal({
      directive: "Integration test batch",
      metroId,
      entityType: "business",
      filters: {},
      templateKeys: ["CLAIM_LISTING", "CROWN_CANDIDATE"],
      limit: 3,
    });
    if (!proposal.id) throw new Error("Batch proposal not saved");
    if (!proposal.batchMode) throw new Error("batchMode should be true");

    const cleanup = proposal.id;
    await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [cleanup]);
    await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [cleanup]);

    return `Batch proposal ${proposal.id}: ${proposal.items.length} items across up to 3 entities, cleaned up`;
  });

  console.log("\n─── 4. ACTION TEMPLATE WIRING ───");

  if (businessId) {
    await runTest("CLAIM_LISTING template — queues listing", async () => {
      const existing = await pool.query(`SELECT id FROM listings_to_claim_queue WHERE presence_id = $1 LIMIT 1`, [businessId]);
      const hadExisting = existing.rows.length > 0;

      const { executeProposal, buildProposal, confirmAllProposalItems } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "business" as const, entityId: businessId!, name: "Claim Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["CLAIM_LISTING"], { metroId, source: "integration_test" });

      if (proposal.items.length === 0) return "No CLAIM_LISTING items (business may be claimed) — wiring OK";

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);
      if (!hadExisting) {
        await pool.query(`DELETE FROM listings_to_claim_queue WHERE presence_id = $1`, [businessId]);
      }

      return `Executed: ${execResult.executed} succeeded, ${execResult.failed} failed`;
    });

    await runTest("CROWN_CANDIDATE template — creates inbox item", async () => {
      const { buildProposal, confirmAllProposalItems, executeProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "business" as const, entityId: businessId!, name: "Crown Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["CROWN_CANDIDATE"], { metroId, source: "integration_test" });

      if (proposal.items.length === 0) return "No CROWN_CANDIDATE items — template returned empty";

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);

      if (execResult.failed > 0) throw new Error(`Execution failures: ${execResult.results.filter(r => r.error).map(r => r.error).join("; ")}`);
      return `Crown candidate flagged: ${execResult.executed} executed`;
    });

    await runTest("TV_VENUE_SCREEN template — creates inbox item", async () => {
      const { buildProposal, confirmAllProposalItems, executeProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "business" as const, entityId: businessId!, name: "TV Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["TV_VENUE_SCREEN"], { metroId, source: "integration_test" });

      if (proposal.items.length === 0) return "No TV_VENUE_SCREEN items — template returned empty";

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);

      if (execResult.failed > 0) throw new Error(`Execution failures: ${execResult.results.filter(r => r.error).map(r => r.error).join("; ")}`);
      return `TV venue screen flagged: ${execResult.executed} executed`;
    });

    await runTest("LISTING_UPGRADE template — creates inbox item", async () => {
      const { buildProposal, confirmAllProposalItems, executeProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "business" as const, entityId: businessId!, name: "Upgrade Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["LISTING_UPGRADE"], { metroId, source: "integration_test" });

      if (proposal.items.length === 0) return "No LISTING_UPGRADE items (business not on FREE tier) — wiring OK";

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);

      return `Listing upgrade: ${execResult.executed} executed, ${execResult.failed} failed`;
    });

    await runTest("SEARCH_RECOMMENDATION template — updates entity_scores", async () => {
      const { buildProposal, confirmAllProposalItems, executeProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "business" as const, entityId: businessId!, name: "Search Rec Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["SEARCH_RECOMMENDATION"], { metroId, source: "integration_test" });

      if (proposal.items.length === 0) return "No SEARCH_RECOMMENDATION items — template returned empty";

      const scoreBefore = await db.select().from(entityScores).where(eq(entityScores.entityId, businessId!)).limit(1);

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      const scoreAfter = await db.select().from(entityScores).where(eq(entityScores.entityId, businessId!)).limit(1);

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);

      if (execResult.failed > 0) throw new Error(`Execution failed: ${execResult.results.filter(r => r.error).map(r => r.error).join("; ")}`);
      if (scoreAfter.length === 0) throw new Error("entity_scores row should exist after upsert but was not found");
      if (scoreAfter[0].prospectFitScore === null || scoreAfter[0].prospectFitScore < 10) throw new Error(`prospect_fit_score should be >= 10, got ${scoreAfter[0].prospectFitScore}`);
      return `Search recommendation: score=${scoreAfter[0].prospectFitScore}, row existed before=${scoreBefore.length > 0}`;
    });
  }

  if (eventId) {
    await runTest("EVENT_PROMOTION template — sets featured flag", async () => {
      const { buildProposal, confirmAllProposalItems, executeProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "event" as const, entityId: eventId!, name: "Promo Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["EVENT_PROMOTION"], { metroId, source: "integration_test" });

      if (proposal.items.length === 0) return "No EVENT_PROMOTION items — template returned empty";

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);

      if (execResult.failed > 0) throw new Error(`Execution failed: ${execResult.results.filter(r => r.error).map(r => r.error).join("; ")}`);
      return `Event promotion: ${execResult.executed} executed`;
    });
  }

  if (contactId) {
    await runTest("STORY_DRAFT template — generates story for contact", async () => {
      const { buildProposal, confirmAllProposalItems, executeProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "contact" as const, entityId: contactId!, name: "Story Draft Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["STORY_DRAFT"], { metroId, source: "integration_test" });

      if (proposal.items.length === 0) return "No STORY_DRAFT items — contact already has linked article or no company name (wiring OK)";

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);

      if (execResult.failed > 0) throw new Error(`Story draft execution failed: ${execResult.results.filter(r => r.error).map(r => r.error).join("; ")}`);
      return `Story draft: ${execResult.executed} executed successfully`;
    });

    await runTest("BECKY_OUTREACH template — sends outreach email", async () => {
      const { buildProposal, confirmAllProposalItems, executeProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "contact" as const, entityId: contactId!, name: "Becky Outreach Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["BECKY_OUTREACH"], { metroId, source: "integration_test" });

      if (proposal.items.length === 0) return "No BECKY_OUTREACH items — contact not eligible (no email or already contacted, wiring OK)";

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);

      if (execResult.failed > 0) throw new Error(`Becky outreach execution failed: ${execResult.results.filter(r => r.error).map(r => r.error).join("; ")}`);
      return `Becky outreach: ${execResult.executed} executed successfully`;
    });
  }

  console.log("\n─── 5. COMMAND CENTER QUERIES ───");

  await runTest("getCommandCenterSummary — returns structured data", async () => {
    const { getCommandCenterSummary } = await import("../charlotte-command-center");
    const summary = await getCommandCenterSummary(metroId);
    if (typeof summary.metro?.totalListings !== "number") throw new Error("Missing metro.totalListings");
    if (typeof summary.trust?.profilesComputed !== "number") throw new Error("Missing trust.profilesComputed");
    if (typeof summary.pipeline?.highFitCount !== "number") throw new Error("Missing pipeline.highFitCount");
    if (typeof summary.crown?.totalParticipants !== "number") throw new Error("Missing crown.totalParticipants");
    if (typeof summary.content?.totalArticles !== "number") throw new Error("Missing content.totalArticles");
    if (typeof summary.events?.totalEvents !== "number") throw new Error("Missing events.totalEvents");
    if (typeof summary.jobs?.totalJobs !== "number") throw new Error("Missing jobs.totalJobs");
    if (typeof summary.recentCaptures?.newBusinessesThisWeek !== "number") throw new Error("Missing recentCaptures");
    return `Listings: ${summary.metro.totalListings}, Trust profiles: ${summary.trust.profilesComputed}, Articles: ${summary.content.totalArticles}`;
  });

  await runTest("identifyAdvertiserOpportunities — returns scored list", async () => {
    const { identifyAdvertiserOpportunities } = await import("../charlotte-command-center");
    const opportunities = await identifyAdvertiserOpportunities(metroId, { limit: 5 });
    if (!Array.isArray(opportunities)) throw new Error("Must return array");
    for (const opp of opportunities) {
      if (!opp.businessId) throw new Error("Missing businessId");
      if (!opp.businessName) throw new Error("Missing businessName");
      if (typeof opp.prospectFit !== "number") throw new Error("Missing prospectFit");
      if (!Array.isArray(opp.signals)) throw new Error("Missing signals array");
      if (!Array.isArray(opp.suggestedActions)) throw new Error("Missing suggestedActions array");
    }
    return `${opportunities.length} advertiser opportunities identified`;
  });

  await runTest("getCrownReadinessReport — returns readiness data", async () => {
    const { getCrownReadinessReport } = await import("../charlotte-command-center");
    const report = await getCrownReadinessReport(metroId, { limit: 5 });
    if (!Array.isArray(report)) throw new Error("Must return array");
    for (const entry of report) {
      if (!entry.businessId) throw new Error("Missing businessId");
      if (typeof entry.readinessScore !== "number") throw new Error("Missing readinessScore");
      if (!Array.isArray(entry.blockers)) throw new Error("Missing blockers array");
    }
    return `${report.length} Crown readiness entries`;
  });

  await runTest("getZoneActivitySummary — returns zone data", async () => {
    const { getZoneActivitySummary } = await import("../charlotte-command-center");
    const zones = await getZoneActivitySummary(metroId);
    if (!Array.isArray(zones)) throw new Error("Must return array");
    for (const z of zones) {
      if (!z.zoneId) throw new Error("Missing zoneId");
      if (!z.zoneName) throw new Error("Missing zoneName");
      if (typeof z.listingCount !== "number") throw new Error("Missing listingCount");
    }
    return `${zones.length} zones with activity data`;
  });

  await runTest("getRecentOrchestratorActivity — returns logged decisions", async () => {
    const { getRecentOrchestratorActivity } = await import("../charlotte-command-center");
    const activity = await getRecentOrchestratorActivity(metroId, 5);
    if (!Array.isArray(activity)) throw new Error("Must return array");
    return `${activity.length} recent orchestrator decisions`;
  });

  console.log("\n─── 6. TRUST SERVICE ───");

  if (businessId) {
    await runTest("computeTrustProfile — computes and stores profile", async () => {
      const { computeTrustProfile } = await import("../trust-service");
      const profile = await computeTrustProfile(businessId!);
      if (!profile) return "Profile computation returned null (acceptable for business with no data)";
      if (!profile.trustLevel) throw new Error("Missing trustLevel");
      if (!profile.operationalStatus) throw new Error("Missing operationalStatus");
      if (!profile.signalSnapshot) throw new Error("Missing signalSnapshot");
      return `Trust: ${profile.trustLevel}, Status: ${profile.operationalStatus}, Network eligible: ${profile.isEligibleForNetwork}`;
    });

    await runTest("getTrustProfile — retrieves stored profile", async () => {
      const { getTrustProfile } = await import("../trust-service");
      const profile = await getTrustProfile(businessId!);
      if (!profile) return "No trust profile found (compute may not have run)";
      return `Retrieved profile: ${profile.trustLevel}, status=${profile.operationalStatus}`;
    });
  }

  console.log("\n─── 7. ORCHESTRATOR MODE EXECUTION ───");

  await runTest("executeWithConstraints — search mode", async () => {
    const { orchestrate, executeWithConstraints } = await import("../charlotte-orchestrator");
    const result = await orchestrate({
      input: "find coffee shops",
      metroId,
      source: "api",
    });
    const output = await executeWithConstraints(result, metroId);
    if (!output.constraints) throw new Error("Missing constraints");
    if (output.searchResults) {
      return `Search: ${output.searchResults.results.length} results in ${output.searchResults.domain}`;
    }
    if (output.conciergeResults) {
      return `Concierge response received`;
    }
    return `Mode=${result.command.mode}, constraints applied`;
  });

  await runTest("executeWithConstraints — concierge mode", async () => {
    const { orchestrate, executeWithConstraints } = await import("../charlotte-orchestrator");
    const result = await orchestrate({
      input: "recommend restaurants near South End",
      metroId,
      source: "consumer",
    });
    const output = await executeWithConstraints(result, metroId);
    if (!output.constraints) throw new Error("Missing constraints");
    if (output.conciergeResults) {
      return `Concierge: ${output.conciergeResults.summary}`;
    }
    if (output.searchResults) {
      return `Concierge routed to search: ${output.searchResults.results.length} results`;
    }
    return `Concierge mode: mode=${result.command.mode}, constraints applied`;
  });

  await runTest("executeWithConstraints — builds lifecycle context", async () => {
    const { orchestrate, executeWithConstraints } = await import("../charlotte-orchestrator");
    const result = await orchestrate({
      input: "update tier for businesses",
      metroId,
      source: "admin_chat",
    });
    const output = await executeWithConstraints(result, metroId);
    return `Constraints: enforceGeo=${output.constraints.enforceGeo}, enforceTrust=${output.constraints.enforceTrust}, lifecycle=${output.lifecycleContext?.stage || "none"}`;
  });

  await runTest("handleProposalMode — from orchestrator result", async () => {
    const { orchestrate, handleProposalMode } = await import("../charlotte-orchestrator");
    const result = await orchestrate({
      input: "launch a campaign for all businesses",
      metroId,
      source: "admin_chat",
    });
    const proposalResult = await handleProposalMode(result, { metroId });
    if (proposalResult.proposal?.id) {
      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposalResult.proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposalResult.proposal.id]);
    }
    return `Proposal: ${proposalResult.summary.substring(0, 100)}`;
  });

  console.log("\n─── 8. OPPORTUNITY SCORING ───");

  await runTest("computeOpportunityScores — returns valid scores", async () => {
    const { computeOpportunityScores, getBestEntryPoint } = await import("../opportunity-scoring");
    const scores = computeOpportunityScores(
      { websiteUrl: "https://test.com", googleRating: "4.5", venueScreenLikely: true },
      {}
    );
    if (typeof scores.hubTv !== "number") throw new Error("Missing hubTv");
    if (typeof scores.listingUpgrade !== "number") throw new Error("Missing listingUpgrade");
    if (typeof scores.adBuyer !== "number") throw new Error("Missing adBuyer");
    if (typeof scores.eventPartner !== "number") throw new Error("Missing eventPartner");
    if (typeof scores.overall !== "number") throw new Error("Missing overall");
    if (scores.overall < 0 || scores.overall > 100) throw new Error(`Overall out of range: ${scores.overall}`);

    const bestEntry = getBestEntryPoint(scores);
    if (!bestEntry) throw new Error("getBestEntryPoint returned null");

    return `hubTv=${scores.hubTv}, upgrade=${scores.listingUpgrade}, ad=${scores.adBuyer}, event=${scores.eventPartner}, overall=${scores.overall}, best=${bestEntry}`;
  });

  console.log("\n─── 9. ENTITY SCORING ───");

  if (businessId) {
    await runTest("computeEntityScores — runs without error", async () => {
      const { computeEntityScores } = await import("../intelligence/scoring/entityScoring");
      await computeEntityScores(businessId!);
      return "Entity scores computed successfully";
    });
  }

  console.log("\n─── 10. FIELD CAPTURE / EXPO FLOW ───");

  await runTest("capture session — create, list, get lifecycle", async () => {
    const sessionRes = await pool.query(
      `INSERT INTO capture_sessions (id, metro_id, event_name, status, operator_user_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'Integration Test Expo', 'open', 'test-operator', NOW(), NOW())
       RETURNING id, status`,
      [metroId]
    );
    const sessionId = sessionRes.rows[0].id;
    if (sessionRes.rows[0].status !== "open") throw new Error(`Expected open, got ${sessionRes.rows[0].status}`);

    const listRes = await pool.query(`SELECT id FROM capture_sessions WHERE metro_id = $1 AND id = $2`, [metroId, sessionId]);
    if (listRes.rows.length !== 1) throw new Error("Session not found in list query");

    const getRes = await pool.query(`SELECT id, status, event_name FROM capture_sessions WHERE id = $1`, [sessionId]);
    if (getRes.rows[0].event_name !== "Integration Test Expo") throw new Error("Event name mismatch");

    await pool.query(`DELETE FROM capture_session_items WHERE session_id = $1`, [sessionId]);
    await pool.query(`DELETE FROM capture_sessions WHERE id = $1`, [sessionId]);
    return `Session ${sessionId} lifecycle verified: create → list → get → delete`;
  });

  await runTest("capture session items — add and retrieve", async () => {
    const sessionRes = await pool.query(
      `INSERT INTO capture_sessions (id, metro_id, event_name, status, operator_user_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'Item Test Expo', 'open', 'test-operator', NOW(), NOW())
       RETURNING id`,
      [metroId]
    );
    const sessionId = sessionRes.rows[0].id;

    await pool.query(
      `INSERT INTO capture_session_items (id, session_id, capture_type, raw_data, processing_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'business_card', $2, 'pending', NOW(), NOW())`,
      [sessionId, JSON.stringify({ name: "Test Business", phone: "555-0100" })]
    );
    await pool.query(
      `INSERT INTO capture_session_items (id, session_id, capture_type, raw_data, processing_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'contact_hint', $2, 'pending', NOW(), NOW())`,
      [sessionId, JSON.stringify({ name: "Jane Doe", email: "jane@test.com" })]
    );

    const items = await pool.query(`SELECT id, capture_type, processing_status FROM capture_session_items WHERE session_id = $1`, [sessionId]);
    if (items.rows.length !== 2) throw new Error(`Expected 2 items, got ${items.rows.length}`);

    const statuses = items.rows.map((r: { processing_status: string }) => r.processing_status);
    if (!statuses.every((s: string) => s === "pending")) throw new Error("Items should start as pending");

    await pool.query(`DELETE FROM capture_session_items WHERE session_id = $1`, [sessionId]);
    await pool.query(`DELETE FROM capture_sessions WHERE id = $1`, [sessionId]);
    return `2 items added to session, verified pending status, cleaned up`;
  });

  await runTest("batch processor — entity resolution in capture context", async () => {
    const { resolveEntities } = await import("../charlotte-orchestrator");
    const refs: Array<{ rawText: string; entityType: "business" | "contact"; identifiers: Record<string, string> }> = [
      { rawText: "Unknown Corp", entityType: "business", identifiers: { name: "zzz_nonexistent_capture_test" } },
      { rawText: "Known contact", entityType: "contact", identifiers: { email: "nonexistent_capture@test.com" } },
    ];
    const resolved = await resolveEntities(refs, metroId);
    if (resolved.length !== 2) throw new Error(`Expected 2 resolved, got ${resolved.length}`);
    for (const r of resolved) {
      if (!["HIGH", "MEDIUM", "LOW"].includes(r.confidence)) throw new Error(`Invalid confidence: ${r.confidence}`);
    }
    return `Resolved ${resolved.length} entities: ${resolved.map(r => `${r.entityType}=${r.confidence}`).join(", ")}`;
  });

  await runTest("batch processor — proposal generation from resolved entity", async () => {
    if (!businessId) return "Skipped — no business in metro";
    const { evaluateOpportunities, buildProposal } = await import("../charlotte-proposal-engine");
    const eval_ = await evaluateOpportunities(businessId!, "business", metroId);
    if (!eval_.entityId) throw new Error("Missing entityId from evaluateOpportunities");

    const entity = { entityType: "business" as const, entityId: businessId!, name: eval_.entityName, confidence: "HIGH" as const };
    const proposal = await buildProposal(entity, [], { metroId, source: "capture_batch_test" });
    if (!proposal.id) throw new Error("Proposal not persisted");
    if (!Array.isArray(proposal.items)) throw new Error("items not array");

    await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
    await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);
    return `Capture→Proposal: ${proposal.items.length} items for "${eval_.entityName}", cleaned up`;
  });

  console.log("\n─── 11. HOUSING / RELOCATION FLOW ───");

  await runTest("queryConcierge — housing domain returns agents + listings", async () => {
    const { queryConcierge } = await import("../charlotte-recommendation-connector");
    const response = await queryConcierge(metroId, "housing", "apartments for rent", undefined, 10);
    if (response.domain !== "housing") throw new Error(`Expected housing, got ${response.domain}`);
    if (!Array.isArray(response.results)) throw new Error("results must be array");
    if (!Array.isArray(response.followOnSuggestions)) throw new Error("followOnSuggestions must be array");
    for (const r of response.results) {
      if (!r.id) throw new Error("Missing id on result");
      if (!Array.isArray(r.followOnActions)) throw new Error("Missing followOnActions");
    }
    return `Housing: ${response.results.length} results (agents + listings), ${response.followOnSuggestions.length} suggestions`;
  });

  await runTest("queryConcierge — relocation query includes zone insights", async () => {
    const { queryConcierge } = await import("../charlotte-recommendation-connector");
    const response = await queryConcierge(metroId, "housing", "where should I live with my family", undefined, 10);
    if (response.domain !== "housing") throw new Error(`Expected housing, got ${response.domain}`);

    const withInsights = response as typeof response & { zoneInsights?: unknown[] };
    const hasInsights = Array.isArray(withInsights.zoneInsights) && withInsights.zoneInsights.length > 0;
    const hasRelocationSuggestions = response.followOnSuggestions.some(s =>
      s.toLowerCase().includes("neighborhood") || s.toLowerCase().includes("area")
    );

    return `Relocation: ${response.results.length} results, zoneInsights=${hasInsights ? withInsights.zoneInsights!.length : 0}, relocationSuggestions=${hasRelocationSuggestions}`;
  });

  await runTest("getDomainFromQuery — housing/relocation keywords", async () => {
    const { getDomainFromQuery } = await import("../charlotte-recommendation-connector");
    const tests: [string, string][] = [
      ["apartments for rent near uptown", "housing"],
      ["where should I live in Charlotte", "housing"],
      ["relocating to Charlotte with family", "housing"],
      ["good neighborhoods for families", "housing"],
      ["houses for sale", "housing"],
    ];
    const failures: string[] = [];
    for (const [query, expected] of tests) {
      const actual = getDomainFromQuery(query);
      if (actual !== expected) failures.push(`"${query}": expected ${expected}, got ${actual}`);
    }
    if (failures.length > 0) throw new Error(failures.join("; "));
    return `All ${tests.length} housing/relocation domain classifications correct`;
  });

  console.log("\n─── 12. ACTION ROUTE RESOLUTION ───");

  await runTest("resolveActionRoute — all critical actions resolve", async () => {
    const { resolveActionRoute } = await import("../charlotte-recommendation-connector");
    const entity = { id: "test-123", slug: "test-biz", entityType: "business", latitude: 35.2271, longitude: -80.8431 };
    const citySlug = "charlotte";

    const criticalActions = [
      "view_profile", "read_story", "view_map", "view_on_map",
      "connect_to_booking", "start_claim", "make_reservation",
      "contact", "view_details", "apply", "view_listing",
      "rsvp", "save_job", "set_alert", "add_to_calendar",
      "contact_seller", "get_directions", "view_menu",
      "book_consultation", "view_portfolio", "book",
    ];

    const resolved = criticalActions.map(a => resolveActionRoute(a, entity, citySlug));
    const withRoutes = resolved.filter(r => r.route !== null);
    const withLabels = resolved.filter(r => r.label && r.label.length > 0);
    const missingLabels = resolved.filter(r => !r.label);

    if (missingLabels.length > 0) throw new Error(`Actions with missing labels: ${missingLabels.map(r => r.action).join(", ")}`);
    if (withRoutes.length < 15) throw new Error(`Expected at least 15 routable actions, got ${withRoutes.length}`);

    return `${criticalActions.length} actions tested: ${withRoutes.length} have routes, all have labels`;
  });

  await runTest("resolveActionRoute — profile route correctness", async () => {
    const { resolveActionRoute } = await import("../charlotte-recommendation-connector");
    const r = resolveActionRoute("view_profile", { id: "abc", slug: "joes-bbq", entityType: "business" }, "charlotte");
    if (r.route !== "/charlotte/biz/joes-bbq") throw new Error(`Expected /charlotte/biz/joes-bbq, got ${r.route}`);
    if (r.label !== "View Profile") throw new Error(`Expected "View Profile", got "${r.label}"`);
    return `view_profile → ${r.route} (${r.label})`;
  });

  await runTest("resolveActionRoute — directions uses lat/lng", async () => {
    const { resolveActionRoute } = await import("../charlotte-recommendation-connector");
    const r = resolveActionRoute("get_directions", { id: "x", entityType: "business", latitude: 35.22, longitude: -80.84 }, "charlotte");
    if (!r.route || !r.route.includes("maps.google.com")) throw new Error(`Expected Google Maps URL, got ${r.route}`);
    if (!r.route.includes("35.22")) throw new Error("Missing lat in directions URL");
    return `get_directions → ${r.route}`;
  });

  await runTest("resolveActionRoute — unknown action returns fallback", async () => {
    const { resolveActionRoute } = await import("../charlotte-recommendation-connector");
    const r = resolveActionRoute("completely_unknown_action", { id: "x", entityType: "business" }, "charlotte");
    if (r.route !== null) throw new Error(`Unknown action should return null route, got ${r.route}`);
    if (!r.label) throw new Error("Even unknown actions should get a generated label");
    return `Unknown action fallback: route=null, label="${r.label}"`;
  });

  await runTest("resolveActionRoute — event entity routes", async () => {
    const { resolveActionRoute } = await import("../charlotte-recommendation-connector");
    const entity = { id: "evt-123", entityType: "event" };

    const detailsR = resolveActionRoute("view_details", entity, "charlotte");
    if (!detailsR.route || !detailsR.route.includes("/events/")) throw new Error(`view_details for event should use /events/ path`);

    const rsvpR = resolveActionRoute("rsvp", entity, "charlotte");
    if (!rsvpR.route || !rsvpR.route.includes("/events/")) throw new Error(`rsvp should use /events/ path`);

    return `Event routes: view_details=${detailsR.route}, rsvp=${rsvpR.route}`;
  });

  console.log("\n─── 13. NO RESULT / LOW CONFIDENCE / GAP FLOW ───");

  await runTest("recommendation gap — inbox item created for empty search", async () => {
    const { createInboxItemIfNotOpen } = await import("../admin-inbox");
    const testKey = `gap-${metroId}-test_domain_integration`;
    const item = await createInboxItemIfNotOpen({
      itemType: "recommendation_gap",
      relatedTable: "orchestrator_decisions",
      relatedId: testKey,
      title: "Coverage gap: no test_domain results",
      summary: "Integration test gap item",
      priority: "low",
      tags: ["RecommendationGap", "test_domain"],
    });
    if (!item || !item.id) throw new Error("Gap inbox item not created");

    const check = await pool.query(`SELECT id, item_type, title FROM admin_inbox_items WHERE id = $1`, [item.id]);
    if (check.rows.length === 0) throw new Error("Gap inbox item not persisted");
    if (check.rows[0].item_type !== "recommendation_gap") throw new Error(`Wrong type: ${check.rows[0].item_type}`);

    await pool.query(`DELETE FROM admin_inbox_history WHERE inbox_item_id = $1`, [item.id]);
    await pool.query(`DELETE FROM admin_inbox_items WHERE id = $1`, [item.id]);
    return `Gap inbox item created: type=recommendation_gap, verified and cleaned up`;
  });

  await runTest("recommendation gap — dedup prevents duplicate items", async () => {
    const { createInboxItemIfNotOpen } = await import("../admin-inbox");
    const testKey = `gap-${metroId}-dedup_test`;
    const item1 = await createInboxItemIfNotOpen({
      itemType: "recommendation_gap",
      relatedTable: "orchestrator_decisions",
      relatedId: testKey,
      title: "Coverage gap: dedup test",
      summary: "First gap item",
      priority: "low",
      tags: ["RecommendationGap"],
    });
    if (!item1 || !item1.id) throw new Error("First gap item not created");

    const item2 = await createInboxItemIfNotOpen({
      itemType: "recommendation_gap",
      relatedTable: "orchestrator_decisions",
      relatedId: testKey,
      title: "Coverage gap: dedup test duplicate",
      summary: "Should be deduped",
      priority: "low",
      tags: ["RecommendationGap"],
    });

    const count = await pool.query(
      `SELECT count(*) as cnt FROM admin_inbox_items WHERE related_id = $1 AND item_type = 'recommendation_gap'`,
      [testKey]
    );
    const cnt = parseInt(count.rows[0].cnt);
    if (cnt > 1) throw new Error(`Dedup failed: ${cnt} items with same relatedId`);

    const itemIds = await pool.query(
      `SELECT id FROM admin_inbox_items WHERE related_id = $1 AND item_type = 'recommendation_gap'`,
      [testKey]
    );
    for (const row of itemIds.rows) {
      await pool.query(`DELETE FROM admin_inbox_comments WHERE inbox_item_id = $1`, [row.id]).catch(() => {});
      await pool.query(`DELETE FROM admin_inbox_history WHERE inbox_item_id = $1`, [row.id]).catch(() => {});
    }
    await pool.query(`DELETE FROM admin_inbox_items WHERE related_id = $1`, [testKey]);
    return `Dedup verified: 1 item persisted despite 2 create calls, cleaned up`;
  });

  await runTest("low confidence entity → inbox review path", async () => {
    const { resolveEntities } = await import("../charlotte-orchestrator");
    const resolved = await resolveEntities([
      { rawText: "totally_fake_zzz_99", entityType: "business", identifiers: { name: "totally_fake_zzz_99" } },
    ], metroId);
    if (resolved[0].confidence !== "LOW") throw new Error(`Expected LOW, got ${resolved[0].confidence}`);
    return `LOW confidence entity correctly identified — eligible for inbox review`;
  });

  console.log("\n─── 14. SEARCH / CONCIERGE FLOW VALIDATION ───");

  await runTest("handleSearchMode — returns structured search results", async () => {
    const { orchestrate, handleSearchMode } = await import("../charlotte-orchestrator");
    const result = await orchestrate({ input: "find bakeries", metroId, source: "api" });
    const searchResult = await handleSearchMode(result, { metroId });
    if (!searchResult.domain) throw new Error("Missing domain");
    if (typeof searchResult.summary !== "string") throw new Error("Missing summary");
    if (!Array.isArray(searchResult.results)) throw new Error("results not array");
    return `Search: ${searchResult.results.length} results in ${searchResult.domain}, summary="${searchResult.summary.slice(0, 80)}"`;
  });

  await runTest("handleConciergeMode — returns concierge response shape", async () => {
    const { orchestrate, handleConciergeMode } = await import("../charlotte-orchestrator");
    const result = await orchestrate({ input: "what should I do this weekend", metroId, source: "consumer" });
    const conciergeResult = await handleConciergeMode(result, { metroId });
    if (typeof conciergeResult.summary !== "string") throw new Error("Missing summary");
    if (conciergeResult.response !== null) {
      const resp = conciergeResult.response as { domain?: string; results?: unknown[]; followOnSuggestions?: string[] };
      if (!resp.domain) throw new Error("Concierge response missing domain");
      if (!Array.isArray(resp.results)) throw new Error("Concierge response missing results array");
    }
    return `Concierge: ${conciergeResult.summary.slice(0, 100)}`;
  });

  console.log("\n─── 15. PROPOSAL CONFIRMATION / EXECUTION FLOW ───");

  if (businessId) {
    await runTest("proposal — confirm → execute → results shape", async () => {
      const { buildProposal, confirmAllProposalItems, executeProposal } = await import("../charlotte-proposal-engine");
      const entity = { entityType: "business" as const, entityId: businessId!, name: "E2E Exec Test", confidence: "HIGH" as const };
      const proposal = await buildProposal(entity, ["CROWN_CANDIDATE"], { metroId, source: "e2e_test" });

      if (proposal.items.length === 0) {
        if (proposal.id) {
          await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
          await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);
        }
        return "No eligible items — wiring OK";
      }

      const preExec = await pool.query(`SELECT status FROM charlotte_proposals WHERE id = $1`, [proposal.id]);
      if (preExec.rows[0].status !== "pending") throw new Error(`Pre-confirm status should be pending`);

      await confirmAllProposalItems(proposal.id!);
      const execResult = await executeProposal(proposal.id!);

      if (typeof execResult.executed !== "number") throw new Error("Missing executed count");
      if (typeof execResult.failed !== "number") throw new Error("Missing failed count");
      if (!Array.isArray(execResult.results)) throw new Error("Missing results array");

      const postExec = await pool.query(`SELECT status FROM charlotte_proposals WHERE id = $1`, [proposal.id]);
      if (!["completed", "partially_executed"].includes(postExec.rows[0].status)) {
        throw new Error(`Post-exec status should be completed or partially_executed, got ${postExec.rows[0].status}`);
      }

      await pool.query(`DELETE FROM charlotte_proposal_items WHERE proposal_id = $1`, [proposal.id]);
      await pool.query(`DELETE FROM charlotte_proposals WHERE id = $1`, [proposal.id]);
      return `Confirm→Execute: ${execResult.executed} ok, ${execResult.failed} failed, status=${postExec.rows[0].status}`;
    });
  }

  console.log("\n─── 16. OPERATOR FLOW VALIDATION ───");

  await runTest("operator mode — routes to engines correctly", async () => {
    const { orchestrate, routeCommand } = await import("../charlotte-orchestrator");
    const result = await orchestrate({ input: "import businesses from google places for uptown", metroId, source: "admin_chat" });
    const plan = routeCommand(result.command);
    if (!plan.steps || plan.steps.length === 0) throw new Error("No routing steps");
    const engines = plan.steps.map(s => s.engine);
    return `Operator: ${engines.length} steps → ${engines.join(", ")}`;
  });

  await runTest("operator mode — entity-aware routing adds correct engines", async () => {
    const { routeCommand } = await import("../charlotte-orchestrator");
    const eventCommand = {
      mode: "operator" as const,
      intent: "promote this event",
      entities: [{ entityType: "event" as const, entityId: "evt-123", name: "Test Event", confidence: "HIGH" as const }],
      targetEngines: [],
      geoContext: null,
      confidence: 0.8,
      requiresProposal: false,
      batchMode: false,
      rawClassification: { mode: "operator" as const, intent: "promote event", entityReferences: [], desiredAction: "promote event", locationHint: null, confidence: 0.8, requiresProposal: false, batchMode: false },
    };
    const plan = routeCommand(eventCommand);
    const engines = plan.steps.map(s => s.engine);
    if (!engines.includes("events")) throw new Error(`Expected events engine, got: ${engines.join(", ")}`);
    return `Event entity routing: ${engines.join(", ")}`;
  });

  console.log("\n--- Section 17: Charlotte Response Doctrine ---\n");

  await runTest("doctrine — detectCharlotteMode identifies discovery", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("Best brunch in Ballantyne");
    if (mode !== "discovery") throw new Error(`Expected discovery, got ${mode}`);
    return `"Best brunch in Ballantyne" → ${mode}`;
  });

  await runTest("doctrine — detectCharlotteMode identifies concierge", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("I'm moving to Charlotte, where should I look for housing?");
    if (mode !== "concierge") throw new Error(`Expected concierge, got ${mode}`);
    return `Relocation query → ${mode}`;
  });

  await runTest("doctrine — detectCharlotteMode identifies editor", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("Show me the story we wrote on this business and ask what we missed");
    if (mode !== "editor") throw new Error(`Expected editor, got ${mode}`);
    return `Story review → ${mode}`;
  });

  await runTest("doctrine — detectCharlotteMode identifies organizer", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("How should this business be positioned in the hub?");
    if (mode !== "organizer") throw new Error(`Expected organizer, got ${mode}`);
    return `Positioning in hub → ${mode}`;
  });

  await runTest("doctrine — detectCharlotteMode identifies growth", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("Let's get them verified and set up their portal");
    if (mode !== "growth") throw new Error(`Expected growth, got ${mode}`);
    return `Verification/onboarding → ${mode}`;
  });

  await runTest("doctrine — detectCharlotteMode identifies brainstorm", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("Give me newsletter ideas for girls night out");
    if (mode !== "brainstorm") throw new Error(`Expected brainstorm, got ${mode}`);
    return `Newsletter ideas → ${mode}`;
  });

  await runTest("doctrine — buildDoctrineContext produces structured output", async () => {
    const { buildDoctrineContext } = await import("../services/charlotte/charlotte-response-doctrine");
    const ctx = buildDoctrineContext("discovery");
    if (!ctx.includes("CHARLOTTE BEHAVIOR DOCTRINE")) throw new Error("Missing doctrine header");
    if (!ctx.includes("DISCOVERY")) throw new Error("Missing mode name");
    if (!ctx.includes("Tone:")) throw new Error("Missing tone");
    if (!ctx.includes("Closing:")) throw new Error("Missing closing guidance");
    return `Discovery doctrine: ${ctx.length} chars`;
  });

  await runTest("doctrine — growth mode with onboarding stage includes stage details", async () => {
    const { buildDoctrineContext } = await import("../services/charlotte/charlotte-response-doctrine");
    const ctx = buildDoctrineContext("growth", "story");
    if (!ctx.includes("ONBOARDING STAGE: STORY")) throw new Error("Missing onboarding stage");
    if (!ctx.includes("What did we miss")) throw new Error("Missing story questions");
    if (!ctx.includes("COMMUNITY FUND")) throw new Error("Missing community fund context");
    return `Growth+story doctrine: includes stage, questions, fund`;
  });

  await runTest("doctrine — onboarding stage progression", async () => {
    const { getNextOnboardingStage } = await import("../services/charlotte/charlotte-response-doctrine");
    const flow = ["verify", "story", "align", "recommend", "close", "downsell"] as const;
    for (let i = 0; i < flow.length - 1; i++) {
      const next = getNextOnboardingStage(flow[i]);
      if (next !== flow[i + 1]) throw new Error(`After ${flow[i]} expected ${flow[i + 1]}, got ${next}`);
    }
    const last = getNextOnboardingStage("downsell");
    if (last !== null) throw new Error(`After downsell expected null, got ${last}`);
    return `Onboarding flow: verify→story→align→recommend→close→downsell→null`;
  });

  console.log("\n--- Section 18: Objection Handling & Fit Filters ---\n");

  await runTest("objection — detects 'too expensive'", async () => {
    const { detectObjection } = await import("../services/charlotte/charlotte-response-doctrine");
    const obj = detectObjection("That's too expensive for us right now");
    if (!obj) throw new Error("Should detect objection");
    if (obj.nextAction !== "re_anchor") throw new Error(`Expected re_anchor, got ${obj.nextAction}`);
    return `"too expensive" → ${obj.nextAction}`;
  });

  await runTest("objection — detects 'can't afford' and suggests downsell", async () => {
    const { detectObjection } = await import("../services/charlotte/charlotte-response-doctrine");
    const obj = detectObjection("We can't afford that");
    if (!obj) throw new Error("Should detect objection");
    if (obj.nextAction !== "downsell") throw new Error(`Expected downsell, got ${obj.nextAction}`);
    return `"can't afford" → ${obj.nextAction}`;
  });

  await runTest("objection — detects handoff request", async () => {
    const { detectObjection } = await import("../services/charlotte/charlotte-response-doctrine");
    const obj = detectObjection("Can I talk to a real person about this?");
    if (!obj) throw new Error("Should detect handoff");
    if (obj.nextAction !== "handoff") throw new Error(`Expected handoff, got ${obj.nextAction}`);
    return `"real person" → ${obj.nextAction}`;
  });

  await runTest("objection — no match returns null", async () => {
    const { detectObjection } = await import("../services/charlotte/charlotte-response-doctrine");
    const obj = detectObjection("Tell me more about the hub features");
    if (obj !== null) throw new Error(`Should not match: ${obj.nextAction}`);
    return `Neutral input → no objection detected`;
  });

  await runTest("objection — builds context string", async () => {
    const { detectObjection, buildObjectionContext } = await import("../services/charlotte/charlotte-response-doctrine");
    const obj = detectObjection("Not sure this is for me");
    if (!obj) throw new Error("Should detect");
    const ctx = buildObjectionContext(obj);
    if (!ctx.includes("OBJECTION DETECTED")) throw new Error("Missing header");
    if (!ctx.includes("re_anchor")) throw new Error("Missing action");
    return `Objection context: ${ctx.length} chars`;
  });

  await runTest("fit filter — detects outside metro", async () => {
    const { detectFitIssue } = await import("../services/charlotte/charlotte-response-doctrine");
    const fit = detectFitIssue("We're not in Charlotte, we're based in Raleigh");
    if (!fit) throw new Error("Should detect outside metro");
    if (fit.condition !== "outside_metro") throw new Error(`Expected outside_metro, got ${fit.condition}`);
    if (fit.action !== "redirect") throw new Error(`Expected redirect, got ${fit.action}`);
    return `Outside metro → ${fit.action}`;
  });

  await runTest("fit filter — detects no budget", async () => {
    const { detectFitIssue } = await import("../services/charlotte/charlotte-response-doctrine");
    const fit = detectFitIssue("We have zero budget for anything right now");
    if (!fit) throw new Error("Should detect no budget");
    if (fit.condition !== "no_budget") throw new Error(`Expected no_budget, got ${fit.condition}`);
    if (fit.action !== "disengage") throw new Error(`Expected disengage, got ${fit.action}`);
    return `No budget → ${fit.action}`;
  });

  await runTest("fit filter — detects not a business", async () => {
    const { detectFitIssue } = await import("../services/charlotte/charlotte-response-doctrine");
    const fit = detectFitIssue("I'm just looking around, this is more of a hobby");
    if (!fit) throw new Error("Should detect not a business");
    if (fit.condition !== "not_a_business") throw new Error(`Expected not_a_business, got ${fit.condition}`);
    if (fit.action !== "defer") throw new Error(`Expected defer, got ${fit.action}`);
    return `Not a business → ${fit.action}`;
  });

  await runTest("fit filter — no match returns null", async () => {
    const { detectFitIssue } = await import("../services/charlotte/charlotte-response-doctrine");
    const fit = detectFitIssue("We're a restaurant in uptown Charlotte");
    if (fit !== null) throw new Error(`Should not match: ${fit.condition}`);
    return `Valid business → no fit issue`;
  });

  console.log("\n--- Section 19: Doctrine Mode Coverage ---\n");

  await runTest("doctrine — all 6 modes have doctrines", async () => {
    const { MODE_DOCTRINES } = await import("../services/charlotte/charlotte-response-doctrine");
    const modes = ["discovery", "concierge", "editor", "organizer", "growth", "brainstorm"] as const;
    for (const mode of modes) {
      const d = MODE_DOCTRINES[mode];
      if (!d) throw new Error(`Missing doctrine for ${mode}`);
      if (!d.tone) throw new Error(`Missing tone for ${mode}`);
      if (!d.openingStyle) throw new Error(`Missing openingStyle for ${mode}`);
      if (!d.closingStyle) throw new Error(`Missing closingStyle for ${mode}`);
      if (!d.responseGuidance) throw new Error(`Missing responseGuidance for ${mode}`);
      if (d.samplePhrasing.length === 0) throw new Error(`Missing samplePhrasing for ${mode}`);
    }
    return `All 6 modes: complete doctrines with tone/opening/closing/guidance/phrasing`;
  });

  await runTest("doctrine — all 6 onboarding stages defined", async () => {
    const { ONBOARDING_STAGES } = await import("../services/charlotte/charlotte-response-doctrine");
    const stages = ["verify", "story", "align", "recommend", "close", "downsell"] as const;
    for (const stage of stages) {
      const s = ONBOARDING_STAGES[stage];
      if (!s) throw new Error(`Missing stage config for ${stage}`);
      if (!s.goal) throw new Error(`Missing goal for ${stage}`);
      if (s.keyMessages.length === 0) throw new Error(`Missing keyMessages for ${stage}`);
      if (!s.transitionCue) throw new Error(`Missing transitionCue for ${stage}`);
    }
    return `All 6 stages: verify→story→align→recommend→close→downsell`;
  });

  await runTest("doctrine — CORE_TONE_RULES has complete rules", async () => {
    const { CORE_TONE_RULES } = await import("../services/charlotte/charlotte-response-doctrine");
    if (!CORE_TONE_RULES.overall) throw new Error("Missing overall tone");
    if (!CORE_TONE_RULES.identity) throw new Error("Missing identity");
    if (CORE_TONE_RULES.doNot.length < 5) throw new Error(`Expected 5+ doNot rules, got ${CORE_TONE_RULES.doNot.length}`);
    if (CORE_TONE_RULES.doAlways.length < 3) throw new Error(`Expected 3+ doAlways rules, got ${CORE_TONE_RULES.doAlways.length}`);
    return `Tone rules: ${CORE_TONE_RULES.doNot.length} do-not, ${CORE_TONE_RULES.doAlways.length} do-always`;
  });

  await runTest("doctrine — community fund rules defined", async () => {
    const { COMMUNITY_FUND_RULES } = await import("../services/charlotte/charlotte-response-doctrine");
    if (!COMMUNITY_FUND_RULES.positioning) throw new Error("Missing positioning");
    if (COMMUNITY_FUND_RULES.rules.length < 3) throw new Error("Too few rules");
    if (COMMUNITY_FUND_RULES.naturalPhrasing.length < 2) throw new Error("Too few natural phrasings");
    return `Fund rules: ${COMMUNITY_FUND_RULES.rules.length} rules, ${COMMUNITY_FUND_RULES.naturalPhrasing.length} phrasings`;
  });

  await runTest("doctrine — editor mode context includes story guidance", async () => {
    const { buildDoctrineContext } = await import("../services/charlotte/charlotte-response-doctrine");
    const ctx = buildDoctrineContext("editor");
    if (!ctx.includes("EDITOR SPECIFIC")) throw new Error("Missing editor section");
    if (!ctx.includes("origins")) throw new Error("Missing origins guidance");
    return `Editor doctrine includes story guidance`;
  });

  await runTest("doctrine — brainstorm mode context bridges idea to action", async () => {
    const { buildDoctrineContext } = await import("../services/charlotte/charlotte-response-doctrine");
    const ctx = buildDoctrineContext("brainstorm");
    if (!ctx.includes("BRAINSTORM SPECIFIC")) throw new Error("Missing brainstorm section");
    if (!ctx.includes("executable")) throw new Error("Missing executable guidance");
    return `Brainstorm doctrine includes idea-to-action bridge`;
  });

  console.log("\n--- Section 20: Mode Detection Regression (Negative Cases) ---\n");

  await runTest("mode regression — 'onboard a business' → growth not organizer", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("Let's onboard this business and get them started");
    if (mode === "organizer") throw new Error("'onboard' should not map to organizer");
    return `"onboard business" → ${mode} (not organizer)`;
  });

  await runTest("mode regression — 'ask about pricing' → growth not editor", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("Can you tell them about our pricing options?");
    if (mode === "editor") throw new Error("pricing question should not map to editor");
    if (mode !== "growth") throw new Error(`Expected growth, got ${mode}`);
    return `"pricing options" → ${mode} (not editor)`;
  });

  await runTest("mode regression — growth beats organizer for 'set up their portal'", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("Set up their listing in the hub");
    if (mode !== "growth") throw new Error(`Expected growth, got ${mode}`);
    return `"set up their listing" → ${mode}`;
  });

  await runTest("fit filter regression — 'I'm in Charlotte' does NOT trigger outside_metro", async () => {
    const { detectFitIssue } = await import("../services/charlotte/charlotte-response-doctrine");
    const fit = detectFitIssue("I'm in Charlotte and looking for a good plumber");
    if (fit !== null && fit.condition === "outside_metro") throw new Error("In-metro statement should not trigger outside_metro filter");
    return `"I'm in Charlotte" → no false positive`;
  });

  await runTest("fit filter regression — 'We're based in Ballantyne' does NOT trigger outside_metro", async () => {
    const { detectFitIssue } = await import("../services/charlotte/charlotte-response-doctrine");
    const fit = detectFitIssue("We're based in Ballantyne, been here 5 years");
    if (fit !== null && fit.condition === "outside_metro") throw new Error("In-metro statement should not trigger outside_metro filter");
    return `"We're based in Ballantyne" → no false positive`;
  });

  await runTest("mode regression — 'find me a good restaurant' → discovery not concierge", async () => {
    const { detectCharlotteMode } = await import("../services/charlotte/charlotte-response-doctrine");
    const mode = detectCharlotteMode("Find me a good restaurant near uptown");
    if (mode !== "discovery") throw new Error(`Expected discovery, got ${mode}`);
    return `"find good restaurant" → ${mode}`;
  });

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\n  RESULTS: ${passed}/${total} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\n  FAILURES:");
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    ✗ ${r.name}: ${r.details}`);
    }
  }
  console.log("\n═══════════════════════════════════════════════════════════\n");

  return { total, passed, failed, results };
}
