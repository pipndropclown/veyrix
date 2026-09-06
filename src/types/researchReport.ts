import type {
  ExtendedValidationReport,
  ValidationConfidence,
} from "./extendedValidation";
import type { MarketRegime, ReliabilityLabel } from "./multiRegime";
import type {
  NormalizedResearchDetail,
  ResearchManifest,
  ResearchSummary,
} from "./research";
import type { StrategyId } from "./strategy";

export type StrategyVerdict =
  "PROMISING" | "INCONCLUSIVE" | "WEAK" | "REGIME_DEPENDENT";
export type PerformanceQuality = "STRONG" | "MODERATE" | "WEAK" | "UNAVAILABLE";
export type ConclusionDrift =
  "STABLE" | "CHANGING" | "HIGHLY_VARIABLE" | "INSUFFICIENT_DATA";
export interface StrategyScorecard {
  strategyId: StrategyId;
  strategyName: string;
  historicalOosReturnPercent: number | null;
  matchedBenchmarkBeatRatePercent: number | null;
  profitableOosPercent: number | null;
  maximumDrawdownPercent: number | null;
  robustnessScore: number | null;
  temporalScore: number | null;
  researchScore: number | null;
  validationConfidence: ValidationConfidence;
  temporalReliability: ReliabilityLabel;
  performanceQuality: PerformanceQuality;
  evidenceQuality: ValidationConfidence;
  verdict: StrategyVerdict;
}
export interface RegimeStory {
  regime: Exclude<MarketRegime, "UNAVAILABLE">;
  averageOosReturnPercent: number | null;
  periods: number;
  matchedBenchmarkComparison: "OUTPERFORMED" | "UNDERPERFORMED" | "UNAVAILABLE";
  confidence: "AVAILABLE" | "INSUFFICIENT_DATA";
}
export interface FailureProfile {
  strategyId: StrategyId;
  stopLossUsd: number;
  strategySignalLossUsd: number;
  takeProfitLossUsd: number;
  feesUsd: number;
  slippageUsd: number;
  transactionCostSharePercent: number | null;
  worstFold: ExtendedValidationReport["worstFolds"][number] | null;
  weakestRegime: MarketRegime;
  longestLosingStreak: number | null;
  benchmarkUnderperformancePercent: number | null;
  statements: string[];
}
export interface EvidenceCard {
  historyDays: number;
  coveragePercent: number;
  independentOosFolds: number;
  validationMethods: number;
  observedRegimes: number;
  crossMethodAgreement: number | null;
  anchorConsistency: number | null;
  datasetQualityPercent: number;
  researchScore: number | null;
  validationConfidence: ValidationConfidence;
}
export interface StrategyReportEntry {
  scorecard: StrategyScorecard;
  regimes: RegimeStory[];
  failure: FailureProfile;
  suggestions: string[];
}
export interface ResearchReport {
  schemaVersion: "veyrix-report-v1";
  runId: string;
  title: string;
  generatedFromStoredData: true;
  historicalRange: { start: string; end: string; days: number };
  executiveSummary: string;
  sections: {
    overallResult: string;
    performanceLeader: string;
    robustnessLeader: string;
    evidenceLeader: string;
    benchmarkResult: string;
    bestRegime: string;
    weakestRegime: string;
    primaryFailureMode: string;
    evidenceQuality: string;
  };
  categoryWinners: Record<string, StrategyId | null>;
  strategies: StrategyReportEntry[];
  evidence: EvidenceCard;
  conclusion: string;
  nextExperiments: string[];
  assumptions: string[];
  disclaimer: string;
}
export interface ResearchReportInput {
  summary: ResearchSummary;
  manifest: ResearchManifest;
  detail: NormalizedResearchDetail;
}
export interface ResearchSnapshot {
  schemaVersion: "veyrix-snapshot-v1";
  runId: string;
  historicalPeriod: string;
  rankings: NormalizedResearchDetail["rankings"];
  headlineMetrics: {
    averageOosReturnPercent: number | null;
    matchedBenchmarkBeatRatePercent: number | null;
    researchScore: number | null;
    multiRegimeRobustness: number | null;
  };
  verdicts: Record<string, StrategyVerdict>;
  researchConfidence: string;
  benchmarkResult: string;
  simulationDisclaimer: string;
}
