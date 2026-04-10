import { runCharlotteIntegrationTests } from "./charlotte-integration";

async function main() {
  try {
    const { total, passed, failed } = await runCharlotteIntegrationTests();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Fatal test runner error:", err);
    process.exit(2);
  }
}

main();
