import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";
import crypto from "crypto";

const TZ_OFFSETS: Record<string, string> = {
  "America/New_York": "-05:00",
  "America/Chicago": "-06:00",
  "America/Denver": "-07:00",
  "America/Los_Angeles": "-08:00",
  "America/Phoenix": "-07:00",
  "US/Eastern": "-05:00",
  "US/Central": "-06:00",
  "US/Mountain": "-07:00",
  "US/Pacific": "-08:00",
  "EST": "-05:00",
  "CST": "-06:00",
  "MST": "-07:00",
  "PST": "-08:00",
  "EDT": "-04:00",
  "CDT": "-05:00",
  "MDT": "-06:00",
  "PDT": "-07:00",
};

function parseICalDate(raw: string, tzid?: string): string | null {
  if (!raw) return null;
  try {
    const cleaned = raw.trim();
    if (cleaned.length === 8 && /^\d{8}$/.test(cleaned)) {
      return new Date(`${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00Z`).toISOString();
    }
    const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (match) {
      const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
      if (cleaned.endsWith("Z")) {
        return new Date(iso + "Z").toISOString();
      }
      const offset = tzid ? TZ_OFFSETS[tzid] : null;
      if (offset) {
        return new Date(iso + offset).toISOString();
      }
      return new Date(iso + "-05:00").toISOString();
    }
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
  } catch {
    return null;
  }
}

function unfoldICalLines(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function computeExternalId(uid: string, summary: string, dtstart: string): string {
  const seed = uid || (summary + dtstart);
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export class ICalConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const { baseUrl } = config;
    if (!baseUrl) {
      throw new Error("ICalConnector requires baseUrl (the .ics feed URL)");
    }

    const resp = await fetch(baseUrl, {
      headers: { "User-Agent": "CityHub/1.0 (Calendar Aggregator)" },
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      throw new Error(`iCal fetch failed: ${resp.status} ${resp.statusText}`);
    }

    const text = await resp.text();
    const unfolded = unfoldICalLines(text);
    const blocks = unfolded.split("BEGIN:VEVENT");
    const rows: any[] = [];

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i].split("END:VEVENT")[0];

      const getProp = (prop: string): string => {
        const regex = new RegExp(`^${prop}[^:\\n]*:(.*)$`, "im");
        const m = block.match(regex);
        return (m?.[1] || "").trim();
      };

      const getTzid = (prop: string): string | undefined => {
        const regex = new RegExp(`^${prop};[^:]*TZID=([^;:]+)`, "im");
        const m = block.match(regex);
        return m?.[1]?.trim();
      };

      const summary = getProp("SUMMARY").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ");
      if (!summary) continue;

      const description = getProp("DESCRIPTION").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
      const dtstart = getProp("DTSTART");
      const dtend = getProp("DTEND");
      const dtstartTzid = getTzid("DTSTART");
      const dtendTzid = getTzid("DTEND");
      const location = getProp("LOCATION").replace(/\\,/g, ",").replace(/\\;/g, ";");
      const uid = getProp("UID");
      const url = getProp("URL");

      const startDate = parseICalDate(dtstart, dtstartTzid);
      const endDate = parseICalDate(dtend, dtendTzid);

      if (!startDate) continue;

      const externalId = computeExternalId(uid, summary, dtstart);

      rows.push({
        _externalId: externalId,
        _title: summary,
        _description: description.slice(0, 2000),
        _startDateTime: startDate,
        _endDateTime: endDate,
        _locationName: location || null,
        _address: location || null,
        _sourceUrl: url || null,
        _raw: { uid, summary, dtstart, dtend, location, description: description.slice(0, 500) },
      });
    }

    return {
      rows,
      totalAvailable: rows.length,
    };
  }
}
