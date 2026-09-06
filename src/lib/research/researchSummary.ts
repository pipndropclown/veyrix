import type { ExtendedValidationArena } from "@/types/extendedValidation";
import type {
  ResearchAccessSource,
  ResearchMode,
  ResearchSizeMetadata,
  ResearchSummary,
  ResearchPersistenceStatus,
} from "@/types/research";
const valid = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value),
  average = (values: (number | null | undefined)[]) => {
    const usable = values.filter(valid);
    return usable.length
      ? usable.reduce((sum, value) => sum + value, 0) / usable.length
      : null;
  },
  bytes = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).length;
export const serializedBytes = bytes;
export function createResearchSummary(input: {
  runId: string;
  createdAt: string;
  timeframe: "180D" | "365D";
  anchor: string;
  mode?: ResearchMode;
  datasetFingerprint: string;
  resultFingerprint: string;
  durationMs: number;
  arena: ExtendedValidationArena;
  source?: ResearchAccessSource;
  persistence?: ResearchPersistenceStatus;
  pinned?: boolean;
  note?: string | null;
  sizes?: ResearchSizeMetadata;
}): ResearchSummary {
  const top = input.arena.performanceRanking[0] ?? null,
    topEntry = top
      ? (input.arena.entries.find(
          (entry) => entry.strategyId === top.strategyId,
        ) ?? top)
      : null,
    oos = topEntry
      ? average(
          topEntry.methods.map(
            (method) => method.averageOutOfSampleReturnPercent,
          ),
        )
      : null;
  return {
    schemaVersion: "veyrix-summary-v1",
    researchRunId: input.runId,
    createdAt: input.createdAt,
    timeframe: input.timeframe,
    anchor: input.anchor,
    mode: input.mode ?? "EXTENDED_VALIDATION",
    strategies: input.arena.entries.map((entry) => entry.strategyId),
    topStrategy: top?.strategyId ?? null,
    robustnessLeader: input.arena.robustnessRanking[0]?.strategyId ?? null,
    researchEvidenceLeader: input.arena.researchRanking[0]?.strategyId ?? null,
    temporalResearchScore: null,
    researchScore: valid(topEntry?.researchScore)
      ? topEntry.researchScore
      : null,
    multiRegimeRobustness: valid(
      topEntry?.multiRegime.multiRegimeRobustnessScore,
    )
      ? topEntry.multiRegime.multiRegimeRobustnessScore
      : null,
    anchorConsistency: null,
    temporalReliability: "INSUFFICIENT_DATA",
    averageOosReturnPercent: oos,
    matchedBenchmarkBeatRatePercent: valid(
      topEntry?.averageMatchedBeatRatePercent,
    )
      ? topEntry.averageMatchedBeatRatePercent
      : null,
    validationConfidence: topEntry?.validationConfidence ?? "UNAVAILABLE",
    datasetFingerprintPrefix: input.datasetFingerprint.slice(0, 12),
    resultFingerprintPrefix: input.resultFingerprint.slice(0, 12),
    executionDurationMs: valid(input.durationMs) ? input.durationMs : 0,
    accessSource: input.source ?? "COMPUTED",
    persistenceStatus: input.persistence ?? "MEMORY_ONLY",
    pinned: input.pinned ?? false,
    note: input.note ?? null,
    sizes: input.sizes ?? {
      summaryBytes: 0,
      detailedBytes: 0,
      storedRecordBytes: 0,
    },
  };
}
export function withSummaryAccess(
  summary: ResearchSummary,
  source: ResearchAccessSource,
  persistence: ResearchPersistenceStatus,
) {
  return { ...summary, accessSource: source, persistenceStatus: persistence };
}
export function sanitizeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "number" && !Number.isFinite(item) ? null : item,
    ),
  ) as T;
}
