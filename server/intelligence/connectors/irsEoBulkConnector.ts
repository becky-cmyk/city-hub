import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";
import https from "https";
import http from "http";
import { Readable } from "stream";
import readline from "readline";

const IRS_EO_CSV_URLS = [
  "https://www.irs.gov/pub/irs-soi/eo1.csv",
  "https://www.irs.gov/pub/irs-soi/eo2.csv",
  "https://www.irs.gov/pub/irs-soi/eo3.csv",
  "https://www.irs.gov/pub/irs-soi/eo4.csv",
];

const NTEE_TO_CATEGORY_SLUG: Record<string, string> = {
  A: "arts-culture",
  B: "education",
  C: "environment",
  D: "animal-related",
  E: "healthcare",
  F: "mental-health",
  G: "disease-disorders",
  H: "medical-research",
  I: "crime-legal",
  J: "employment",
  K: "food-agriculture",
  L: "housing-shelter",
  M: "public-safety",
  N: "recreation-sports",
  O: "youth-development",
  P: "human-services",
  Q: "international",
  R: "civil-rights",
  S: "community-improvement",
  T: "philanthropy",
  U: "science-technology",
  V: "social-science",
  W: "public-benefit",
  X: "religion",
  Y: "mutual-membership",
  Z: "unknown",
};

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fetchStream(url: string): Promise<Readable> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "CityHub/1.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchStream(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} fetching IRS EO data`));
        return;
      }
      resolve(res as unknown as Readable);
    }).on("error", reject);
  });
}

export class IrsEoBulkConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const params = config.paramsJson || {};
    const stateCode = (params.stateCode as string) || "NC";
    const zipPrefixes: string[] = (params.zipPrefixes as string[]) || [];
    const limit = (params.limit as number) || 10;

    const csvUrls = config.baseUrl
      ? [config.baseUrl]
      : IRS_EO_CSV_URLS;

    const rows: any[] = [];

    for (const csvUrl of csvUrls) {
      if (rows.length >= limit) break;

      let stream: Readable;
      try {
        stream = await fetchStream(csvUrl);
      } catch (err: any) {
        console.warn(`IrsEoBulkConnector: Failed to fetch ${csvUrl}: ${err.message}`);
        continue;
      }

      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      let headers: string[] | null = null;
      let headerMap: Record<string, number> = {};

      const col = (row: string[], name: string): string => {
        const idx = headerMap[name.toUpperCase()];
        return idx !== undefined ? (row[idx] || "").trim() : "";
      };

      try {
        for await (const line of rl) {
          if (!headers) {
            headers = parseCSVLine(line);
            headers.forEach((h, i) => {
              headerMap[h.toUpperCase()] = i;
            });
            continue;
          }

          if (rows.length >= limit) break;

          const fields = parseCSVLine(line);

          const state = col(fields, "STATE");
          if (state.toUpperCase() !== stateCode.toUpperCase()) continue;

          const zip = col(fields, "ZIP");
          if (zipPrefixes.length > 0) {
            const zipClean = zip.replace(/-.*$/, "");
            if (!zipPrefixes.some((p) => zipClean.startsWith(p))) continue;
          }

          const ein = col(fields, "EIN");
          const name = col(fields, "NAME") || col(fields, "ORGANIZATION");
          if (!name || !ein) continue;

          const city = col(fields, "CITY");
          const street = col(fields, "STREET");
          const nteeCode = col(fields, "NTEE_CD") || col(fields, "NTEE");
          const activity = col(fields, "ACTIVITY");
          const classification = col(fields, "CLASSIFICATION");

          const nteeMajor = nteeCode ? nteeCode.charAt(0).toUpperCase() : "";
          const categorySlug = NTEE_TO_CATEGORY_SLUG[nteeMajor] || null;

          rows.push({
            _externalId: ein,
            _name: titleCase(name),
            _address: street ? titleCase(street) : null,
            _city: city ? titleCase(city) : null,
            _stateCode: state.toUpperCase(),
            _zip: zip,
            _presenceType: "organization",
            _isNonprofit: true,
            _nteeCode: nteeCode,
            _categorySlug: categorySlug,
            _seedSourceType: "IRS",
            _activity: activity,
            _classification: classification,
            _raw: Object.fromEntries(
              (headers || []).map((h, i) => [h, fields[i] || ""])
            ),
          });
        }
      } finally {
        rl.close();
      }
    }

    return {
      rows,
      totalAvailable: rows.length,
    };
  }
}
