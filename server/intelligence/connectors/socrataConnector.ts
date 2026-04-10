import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";

const PAGE_SIZE = 1000;
const RATE_LIMIT_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SocrataConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const { baseUrl, datasetId, paramsJson, lastPulledAt } = config;

    if (!datasetId) {
      throw new Error("SocrataConnector requires datasetId");
    }

    const allRows: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`${baseUrl}/resource/${datasetId}.json`);
      url.searchParams.set("$limit", String(PAGE_SIZE));
      url.searchParams.set("$offset", String(offset));

      if (paramsJson.orderBy) {
        url.searchParams.set("$order", paramsJson.orderBy);
      }

      if (paramsJson.dateField && lastPulledAt) {
        const isoDate = lastPulledAt.toISOString();
        url.searchParams.set(
          "$where",
          `${paramsJson.dateField} > '${isoDate}'`
        );
      }

      if (paramsJson.select) {
        url.searchParams.set("$select", paramsJson.select);
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          `Socrata API error ${response.status}: ${await response.text()}`
        );
      }

      const rows = await response.json();
      allRows.push(...rows);

      if (rows.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
        await sleep(RATE_LIMIT_MS);
      }
    }

    return {
      rows: allRows,
      nextCursor: String(offset),
      totalAvailable: allRows.length,
    };
  }
}
