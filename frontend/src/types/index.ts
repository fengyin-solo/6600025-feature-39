export interface CanFrame {
  id: string;
  timestamp: number;
  arbitrationId: number;
  dlc: number;
  data: string;
  decoded: Record<string, number>;
  direction: 'RX' | 'TX';
}

export interface DbcSignal {
  name: string;
  startBit: number;
  bitLength: number;
  factor: number;
  offset: number;
  unit: string;
  minValue: number;
  maxValue: number;
  messageId: number;
}

export interface DbcMessage {
  id: number;
  name: string;
  dlc: number;
  sender: string;
  signals: DbcSignal[];
}

export interface BusStats {
  totalFrames: number;
  rxCount: number;
  txCount: number;
  errorCount: number;
  busLoad: number;
  lastUpdate: number;
}

export interface SignalStats {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  last: number;
  unit: string;
  outOfRangeCount: number;
}

export type AnomalyType = 'out_of_range' | 'unknown_id' | 'data_length' | 'jump';

export interface AnomalyItem {
  type: AnomalyType;
  frameId: string;
  timestamp: number;
  message: string;
  details?: string;
}

export interface ExportPreviewData {
  frameCount: number;
  timeRange: { start: number; end: number } | null;
  rxCount: number;
  txCount: number;
  uniqueIds: number;
  decodedCount: number;
  undecodedCount: number;
  signalStats: SignalStats[];
  anomalies: AnomalyItem[];
  anomalyCountByType: Record<AnomalyType, number>;
}
