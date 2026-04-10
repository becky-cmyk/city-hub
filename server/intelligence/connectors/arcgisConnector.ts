import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";

const PAGE_SIZE = 1000;
const RATE_LIMIT_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ArcgisConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const { layerUrl, paramsJson } = config;

    if (!layerUrl) {
      throw new Error("ArcgisConnector requires layerUrl");
    }

    const allRows: any[] = [];
    let offset = 0;
    let hasMore = true;

    const whereClause = paramsJson.where || "1=1";
    const outFields = paramsJson.outFields || "*";

    while (hasMore) {
      const url = new URL(`${layerUrl}/query`);
      url.searchParams.set("f", "json");
      url.searchParams.set("where", whereClause);
      url.searchParams.set("outFields", outFields);
      url.searchParams.set("resultOffset", String(offset));
      url.searchParams.set("resultRecordCount", String(PAGE_SIZE));
      url.searchParams.set("returnGeometry", "true");

      if (paramsJson.outSR) {
        url.searchParams.set("outSR", paramsJson.outSR);
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          `ArcGIS API error ${response.status}: ${await response.text()}`
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(
          `ArcGIS query error: ${data.error.message || JSON.stringify(data.error)}`
        );
      }

      const features = data.features || [];
      const rows = features.map((feature: any) => {
        const row: Record<string, any> = { ...feature.attributes };

        if (feature.geometry) {
          if (feature.geometry.x !== undefined && feature.geometry.y !== undefined) {
            row._latitude = feature.geometry.y;
            row._longitude = feature.geometry.x;
          } else if (feature.geometry.rings) {
            const allPoints = feature.geometry.rings.flat();
            if (allPoints.length > 0) {
              const sumX = allPoints.reduce((s: number, p: number[]) => s + p[0], 0);
              const sumY = allPoints.reduce((s: number, p: number[]) => s + p[1], 0);
              row._latitude = sumY / allPoints.length;
              row._longitude = sumX / allPoints.length;
            }
          }
        }

        return row;
      });

      allRows.push(...rows);

      const exceededTransferLimit = data.exceededTransferLimit === true;
      if (features.length < PAGE_SIZE && !exceededTransferLimit) {
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
