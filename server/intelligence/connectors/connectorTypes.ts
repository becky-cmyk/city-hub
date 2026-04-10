export interface PullResult {
  rows: any[];
  nextCursor?: string;
  totalAvailable?: number;
}

export interface ConnectorConfig {
  baseUrl: string;
  datasetId?: string;
  layerUrl?: string;
  paramsJson: Record<string, any>;
  lastCursor?: string;
  lastPulledAt?: Date;
}

export interface Connector {
  pull(config: ConnectorConfig): Promise<PullResult>;
}
