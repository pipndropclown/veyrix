import type { BacktestTimeframe, HistoricalDataQuality } from "./backtesting";
import type { StrategyId } from "./strategy";
export type CacheStatus = "HIT" | "MISS" | "IN_FLIGHT_REUSED";
export interface ResearchVersions {
  strategyConfigVersion: string;
  executionModelVersion: string;
  validationModelVersion: string;
  regimeModelVersion: string;
  scoreModelVersion: string;
  parameterGridVersion: string;
  cacheSchemaVersion: string;
}
export interface ResearchConfiguration {
  marketId?: import("@/lib/market/marketRegistry").MarketId;
  strategies: readonly StrategyId[];
  timeframe: Extract<BacktestTimeframe, "90D" | "180D" | "365D">;
  anchor: string;
  validationMethod: string;
  versions: ResearchVersions;
  execution: {
    feePercentPerSide: number;
    slippagePercent: number;
    collisionPolicy: string;
  };
  risk: {
    stopLossPercent: number;
    takeProfitPercent: number;
    positionSizePercent: number;
  };
  validation: {
    embargoCandles: number;
    trainingCandles: number;
    testCandles: number;
  };
  historical: {
    source: "Coinbase Exchange";
    pair: string;
    granularitySeconds: 21600;
  };
}
export interface ResearchManifest {
  schemaVersion: "veyrix-research-v1";
  researchRunId: string;
  generatedAt: string;
  historicalStart: string;
  historicalEnd: string;
  candleInterval: "6 hours";
  candleCount: number;
  source: "Coinbase Exchange";
  dataQuality: HistoricalDataQuality;
  strategies: readonly StrategyId[];
  strategyParameterGrids: Record<string, unknown>;
  executionAssumptions: ResearchConfiguration["execution"];
  riskSettings: ResearchConfiguration["risk"];
  validationMethod: string;
  validationSettings: ResearchConfiguration["validation"];
  scoringModelVersions: ResearchVersions;
  benchmarkSettings: { fullExposurePercent: 100; matchedExposurePercent: 10 };
  datasetFingerprint: string;
}
export interface ResearchTiming {
  historicalRetrievalMs: number;
  normalizationMs: number;
  parameterSensitivityMs: number;
  validationMethodMs: number;
  regimeAnalysisMs: number;
  strategyArenaMs: number;
  analysisMs: number;
  totalMs: number;
}
export interface ResearchRecord<T = unknown> {
  schemaVersion: "veyrix-cache-v1";
  researchRunId: string;
  configuration: ResearchConfiguration;
  manifest: ResearchManifest;
  createdAt: string;
  expiresAt: string;
  result: T;
  resultFingerprint: string;
  timing: ResearchTiming;
}
export interface ResearchResponse<T = unknown> {
  cacheStatus: CacheStatus;
  cachedAgeMs: number | null;
  record: ResearchRecord<T>;
}
export interface AnchorStrategySummary {
  strategyId: StrategyId;
  averageOosReturnPercent: number;
  multiRegimeRobustnessScore: number;
  researchScore: number;
  matchedBeatRatePercent: number;
  rank: number;
}
export interface AnchorResult {
  anchor: string;
  summaries: AnchorStrategySummary[];
  researchRunId: string;
  cacheStatus: CacheStatus;
  durationMs: number;
}
export type TemporalReliability =
  "STABLE" | "VARIABLE" | "UNSTABLE" | "INSUFFICIENT_DATA";
export interface TemporalStrategyResult {
  strategyId: StrategyId;
  anchors: number;
  averageOosReturnPercent: number;
  positiveAnchorPercent: number;
  averageRobustness: number;
  averageResearchScore: number;
  averageMatchedBeatRate: number;
  anchorConsistencyScore: number;
  temporalReliability: TemporalReliability;
  temporalResearchScore: number;
}
export interface MultiAnchorResult {
  anchors: string[];
  anchorResults: AnchorResult[];
  leaderboard: TemporalStrategyResult[];
}
export type ResearchAccessSource =
  "MEMORY_HIT" | "STORE_HIT" | "COMPUTED" | "IN_FLIGHT_REUSED";
export type ResearchPersistenceStatus =
  "PERSISTED" | "MEMORY_ONLY" | "STORE_WRITE_FAILED";
export type ResearchMode = "EXTENDED_VALIDATION" | "MULTI_ANCHOR";
export interface ResearchSizeMetadata {
  summaryBytes: number;
  detailedBytes: number;
  storedRecordBytes: number;
  standardBytes?: number;
  fullBytes?: number;
}
export interface ResearchSummary {
  marketId?: import("@/lib/market/marketRegistry").MarketId;
  schemaVersion: "veyrix-summary-v1";
  researchRunId: string;
  createdAt: string;
  timeframe: "180D" | "365D";
  anchor: string;
  mode: ResearchMode;
  strategies: readonly StrategyId[];
  topStrategy: StrategyId | null;
  robustnessLeader?: StrategyId | null;
  researchEvidenceLeader?: StrategyId | null;
  temporalResearchScore: number | null;
  researchScore: number | null;
  multiRegimeRobustness: number | null;
  anchorConsistency: number | null;
  temporalReliability: TemporalReliability;
  averageOosReturnPercent: number | null;
  matchedBenchmarkBeatRatePercent: number | null;
  validationConfidence: string;
  datasetFingerprintPrefix: string;
  resultFingerprintPrefix: string;
  executionDurationMs: number;
  accessSource: ResearchAccessSource;
  persistenceStatus: ResearchPersistenceStatus;
  pinned: boolean;
  note: string | null;
  sizes: ResearchSizeMetadata;
}
export interface StoredResearchRecord<T = unknown> {
  schemaVersion: "veyrix-store-v1";
  researchRunId: string;
  createdAt: string;
  expiresAt: string;
  configuration: ResearchConfiguration;
  manifest: ResearchManifest;
  resultFingerprint: string;
  datasetFingerprint: string;
  compactSummary: ResearchSummary;
  detailedResult: T;
  timing: ResearchTiming;
  sizes: ResearchSizeMetadata;
  pinned: boolean;
  note: string | null;
  strategyNotes?: Partial<Record<StrategyId, string>>;
}
export interface StoredResearchResponse<T = unknown> {
  source: ResearchAccessSource;
  persistenceStatus: ResearchPersistenceStatus;
  cachedAgeMs: number | null;
  summary: ResearchSummary;
  record: StoredResearchRecord<T>;
}
export interface ResearchStoreStatus {
  memory: "AVAILABLE";
  durable: "CONFIGURED" | "NOT_CONFIGURED" | "UNAVAILABLE";
  provider: "filesystem" | null;
  schemaVersion: "veyrix-store-v1" | "veyrix-store-v2";
}
export interface ResearchComparison {
  runIds: string[];
  rows: Array<
    Pick<
      ResearchSummary,
      | "marketId"
      | "researchRunId"
      | "timeframe"
      | "anchor"
      | "topStrategy"
      | "temporalResearchScore"
      | "anchorConsistency"
      | "multiRegimeRobustness"
      | "averageOosReturnPercent"
      | "matchedBenchmarkBeatRatePercent"
      | "temporalReliability"
    >
  >;
}
export type ResearchArtifactType =
  | "FOLD"
  | "BACKTEST"
  | "EQUITY"
  | "DRAWDOWN"
  | "TRADES"
  | "BENCHMARK"
  | "SENSITIVITY"
  | "CONFIG"
  | "REGIME";
export interface ResearchArtifact<T = unknown> {
  schemaVersion: "veyrix-artifact-v1";
  artifactId: string;
  type: ResearchArtifactType;
  contentHash: string;
  sizeBytes: number;
  label: string;
  context: string;
  data: T;
}
export interface ResearchArtifactIndexEntry {
  artifactId: string;
  type: ResearchArtifactType;
  sizeBytes: number;
  label: string;
  context: string;
  contentHash: string;
}
export interface NormalizedResearchDetail {
  schemaVersion: "veyrix-standard-v1";
  researchRunId: string;
  rankings: {
    performance: StrategyId[];
    robustness: StrategyId[];
    research: StrategyId[];
  };
  strategies: unknown[];
  artifactIndex: ResearchArtifactIndexEntry[];
}
export interface NormalizedResearchSizes {
  summarySizeBytes: number;
  standardSizeBytes: number;
  fullNormalizedSizeBytes: number;
  storedSizeBytes: number;
  legacyEstimateBytes: number | null;
  reductionVsLegacyEstimatePercent: number | null;
}
export interface NormalizedResearchRecord {
  schemaVersion: string;
  complete: true;
  researchRunId: string;
  createdAt: string;
  expiresAt: string;
  configuration: ResearchConfiguration;
  manifest: ResearchManifest;
  rootFingerprint: string;
  datasetFingerprint: string;
  compactSummary: ResearchSummary;
  standardDetail: NormalizedResearchDetail;
  artifactIndex: ResearchArtifactIndexEntry[];
  artifacts: Record<string, ResearchArtifact>;
  timing: ResearchTiming;
  sizes: NormalizedResearchSizes;
  pinned: boolean;
  note: string | null;
  strategyNotes?: Partial<Record<StrategyId, string>>;
}
export type ResearchDetailLevel = "summary" | "standard" | "full";
