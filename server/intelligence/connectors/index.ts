import type { Connector } from "./connectorTypes";
import { SocrataConnector } from "./socrataConnector";
import { ArcgisConnector } from "./arcgisConnector";
import { CensusConnector } from "./censusConnector";
import { BlsConnector } from "./blsConnector";
import { RssConnector } from "./rssConnector";
import { EventbriteConnector } from "./eventbriteConnector";
import { OsmOverpassConnector } from "./osmOverpassConnector";
import { UsajobsConnector } from "./usajobsConnector";
import { IrsEoBulkConnector } from "./irsEoBulkConnector";
import { ICalConnector } from "./icalConnector";

const connectors: Record<string, Connector> = {
  SOCRATA: new SocrataConnector(),
  ARCGIS: new ArcgisConnector(),
  CENSUS: new CensusConnector(),
  BLS: new BlsConnector(),
  RSS: new RssConnector(),
  ICAL: new ICalConnector(),
  EVENTBRITE: new EventbriteConnector(),
  OSM_OVERPASS: new OsmOverpassConnector(),
  USAJOBS: new UsajobsConnector(),
  IRS_EO: new IrsEoBulkConnector(),
};

export function getConnector(sourceType: string): Connector {
  const connector = connectors[sourceType];
  if (!connector) {
    throw new Error(`No connector found for source type: ${sourceType}`);
  }
  return connector;
}

export type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";
