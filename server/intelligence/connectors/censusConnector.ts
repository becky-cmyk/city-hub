import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";

export class CensusConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const { paramsJson } = config;

    const dataset = paramsJson.dataset;
    const year = paramsJson.year || 2022;
    const getFields = paramsJson.getFields;
    const forGeo = paramsJson.forGeo;
    const inGeo = paramsJson.inGeo;

    if (!dataset || !getFields || !forGeo) {
      throw new Error(
        "CensusConnector requires paramsJson with dataset, getFields, and forGeo"
      );
    }

    const url = new URL(`https://api.census.gov/data/${year}/${dataset}`);
    url.searchParams.set("get", getFields);
    url.searchParams.set("for", forGeo);

    if (inGeo) {
      url.searchParams.set("in", inGeo);
    }

    if (paramsJson.key) {
      url.searchParams.set("key", paramsJson.key);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Census API error ${response.status}: ${await response.text()}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length < 2) {
      return { rows: [], totalAvailable: 0 };
    }

    const headers = data[0] as string[];
    const rows = data.slice(1).map((values: string[]) => {
      const row: Record<string, any> = {};
      headers.forEach((header, i) => {
        row[header] = values[i];
      });

      const geoParts: string[] = [];
      if (row["state"]) geoParts.push(`state:${row["state"]}`);
      if (row["county"]) geoParts.push(`county:${row["county"]}`);
      if (row["zip code tabulation area"])
        geoParts.push(`zcta:${row["zip code tabulation area"]}`);
      if (row["tract"]) geoParts.push(`tract:${row["tract"]}`);

      row._externalId = `census-${year}-${dataset.replace(/\//g, "-")}-${geoParts.join("-") || values.join("-")}`;
      row._year = year;
      row._dataset = dataset;

      return row;
    });

    return {
      rows,
      totalAvailable: rows.length,
    };
  }
}
