import type { HistoricalCandle } from "./backtesting";
import type { GenericStrategyResult, StrategyId } from "./strategy";

export type LiveTimeframe =
  "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "12H" | "1D";
export type ChartMode = "CANDLESTICK" | "LINE";

export interface LiveTimeframeDefinition {
  id: LiveTimeframe;
  seconds: number;
  label: string;
  providerGranularitySeconds: 60 | 300 | 900 | 3600 | 21600 | 86400;
  aggregationFactor: number;
  refreshMs: number;
}

export interface LiveCandleSet {
  pair: "SOL-USD";
  source: "Coinbase Exchange";
  timeframe: LiveTimeframe;
  intervalSeconds: number;
  fetchedAt: string;
  candles: HistoricalCandle[];
}

export type LiveCandleApiResponse =
  { success: true; data: LiveCandleSet } | { success: false; error: string };

export interface AutomationSettings {
  version: 1;
  enabled: boolean;
  strategyId: StrategyId;
  timeframe: LiveTimeframe;
  lastProcessedCandleId: string | null;
  processedCandleIds: string[];
}

export interface AutomationStatus {
  signal: GenericStrategyResult | null;
  lastEvaluatedCandle: string | null;
  lastEvaluationTime: string | null;
  lastExecution: string | null;
  nextExpectedClose: string | null;
}
