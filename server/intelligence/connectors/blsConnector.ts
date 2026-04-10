import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";

const BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

export class BlsConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const { paramsJson } = config;

    const seriesIds: string[] = Array.isArray(paramsJson.seriesId)
      ? paramsJson.seriesId
      : [paramsJson.seriesId];
    const startYear = paramsJson.startYear || new Date().getFullYear() - 1;
    const endYear = paramsJson.endYear || new Date().getFullYear();

    if (!seriesIds.length || !seriesIds[0]) {
      throw new Error("BlsConnector requires paramsJson.seriesId");
    }

    const body: Record<string, any> = {
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(endYear),
    };

    if (paramsJson.registrationKey) {
      body.registrationkey = paramsJson.registrationKey;
    }

    const response = await fetch(BLS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `BLS API error ${response.status}: ${await response.text()}`
      );
    }

    const result = await response.json();

    if (result.status !== "REQUEST_SUCCEEDED") {
      throw new Error(
        `BLS API request failed: ${result.message?.join("; ") || JSON.stringify(result)}`
      );
    }

    const allRows: any[] = [];

    for (const series of result.Results?.series || []) {
      const seriesId = series.seriesID;

      for (const dataPoint of series.data || []) {
        allRows.push({
          seriesId,
          year: dataPoint.year,
          period: dataPoint.period,
          periodName: dataPoint.periodName,
          value: dataPoint.value,
          footnotes: dataPoint.footnotes,
          _externalId: `bls-${seriesId}-${dataPoint.year}-${dataPoint.period}`,
        });
      }
    }

    return {
      rows: allRows,
      totalAvailable: allRows.length,
    };
  }
}
