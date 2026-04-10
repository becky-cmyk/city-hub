import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";

interface UsajobsParams {
  locationName?: string;
  radius?: number;
  limit?: number;
}

interface UsajobsPosition {
  PositionID: string;
  PositionTitle: string;
  PositionURI: string;
  PositionLocation: Array<{
    LocationName: string;
    CityName?: string;
    CountrySubDivisionCode?: string;
  }>;
  OrganizationName: string;
  DepartmentName: string;
  JobCategory: Array<{ Name: string; Code: string }>;
  PositionRemuneration: Array<{
    MinimumRange: string;
    MaximumRange: string;
    RateIntervalCode: string;
    Description?: string;
  }>;
  PositionStartDate: string;
  PositionEndDate: string;
  PublicationStartDate: string;
  ApplicationCloseDate: string;
  PositionOfferingType: Array<{ Name: string; Code: string }>;
  PositionSchedule: Array<{ Name: string; Code: string }>;
  QualificationSummary: string;
  ApplyURI?: string[];
  UserArea?: {
    Details?: {
      JobSummary?: string;
      MajorDuties?: string[];
      TeleworkEligible?: string;
    };
  };
}

function mapRateInterval(code: string): string {
  const map: Record<string, string> = {
    PA: "year",
    PH: "hour",
    PM: "month",
    PW: "week",
    PD: "day",
  };
  return map[code] || code;
}

function inferRemoteType(position: UsajobsPosition): string {
  const telework = position.UserArea?.Details?.TeleworkEligible;
  if (telework === "Yes") return "HYBRID";
  const title = position.PositionTitle?.toLowerCase() || "";
  if (title.includes("remote")) return "REMOTE";
  return "ONSITE";
}

export class UsajobsConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const params = (config.paramsJson || {}) as UsajobsParams;
    const locationName = params.locationName || "Charlotte, North Carolina";
    const radius = params.radius || 25;
    const limit = params.limit || 10;

    const apiKey = process.env.USAJOBS_API_KEY;
    const userAgent = process.env.USAJOBS_USER_AGENT;

    if (!apiKey || !userAgent) {
      console.warn(
        "UsajobsConnector: USAJOBS_API_KEY or USAJOBS_USER_AGENT not set. Returning empty results."
      );
      return { rows: [], totalAvailable: 0 };
    }

    const searchParams = new URLSearchParams({
      LocationName: locationName,
      Radius: String(radius),
      ResultsPerPage: String(limit),
      Page: "1",
      SortField: "DatePosted",
      SortDirection: "Desc",
    });

    const url = `https://data.usajobs.gov/api/Search?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: {
        "Authorization-Key": apiKey,
        "User-Agent": userAgent,
        Host: "data.usajobs.gov",
      },
    });

    if (!response.ok) {
      throw new Error(
        `USAJOBS API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const searchResult = data.SearchResult || {};
    const items: UsajobsPosition[] = (
      searchResult.SearchResultItems || []
    ).map((item: any) => item.MatchedObjectDescriptor);

    const totalAvailable = parseInt(
      searchResult.SearchResultCount || "0",
      10
    );

    const rows = items.map((pos) => {
      const loc = pos.PositionLocation?.[0];
      const rem = pos.PositionRemuneration?.[0];
      const applyUrl =
        pos.ApplyURI?.[0] || pos.PositionURI || "";

      return {
        _externalId: pos.PositionID,
        _sourceType: "USAJOBS",
        title: pos.PositionTitle,
        employer: pos.OrganizationName,
        department: pos.DepartmentName,
        employmentType: pos.PositionSchedule?.[0]?.Name || null,
        payMin: rem ? parseFloat(rem.MinimumRange) || null : null,
        payMax: rem ? parseFloat(rem.MaximumRange) || null : null,
        payUnit: rem ? mapRateInterval(rem.RateIntervalCode) : null,
        locationText: loc?.LocationName || null,
        city: loc?.CityName || null,
        stateCode: loc?.CountrySubDivisionCode || null,
        zipCode: null,
        remoteType: inferRemoteType(pos),
        postedAt: pos.PublicationStartDate || null,
        closesAt: pos.ApplicationCloseDate || null,
        applyUrl,
        detailsUrl: pos.PositionURI || null,
        description:
          pos.UserArea?.Details?.JobSummary ||
          pos.QualificationSummary ||
          null,
        sourceUrl: pos.PositionURI || null,
        _raw: pos,
      };
    });

    return {
      rows,
      totalAvailable,
      nextCursor:
        rows.length >= limit ? String(2) : undefined,
    };
  }
}
