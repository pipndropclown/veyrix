import { getHistoricalSolData } from "../backtesting/historicalMarketService.ts";
import { normalizeHistoricalCandles } from "../backtesting/marketCandles.ts";
import { backtestExecutionConfig } from "../backtesting/backtestConfig.ts";
import { parameterSchemas } from "../optimization/parameterSchemas.ts";
import { momentumStrategyConfig } from "../strategy/momentumStrategy.ts";
import { paperTradingConfig } from "../trading/tradingConfig.ts";
import { runExtendedValidationArena } from "../validation/extendedValidation.ts";
import { validationWindowConfig } from "../validation/validationWindows.ts";
import { normalizeResearchAnchor } from "./anchorValidation.ts";
import { RESEARCH_CACHE_TTL_MS } from "./researchCache.ts";
import {
  calculateNormalizedRootFingerprint,
  normalizeResearchArena,
} from "./researchArtifacts.ts";
import {
  createResearchRunId,
  fingerprintDataset,
  researchVersions,
  stableFingerprint,
} from "./researchIdentity.ts";
import {
  NormalizedFileResearchStore,
  NormalizedMemoryResearchStore,
  NORMALIZED_STORE_SCHEMA,
  validateNormalizedRecord,
} from "./normalizedResearchStore.ts";
import { researchDetail } from "./researchDetail.ts";
import { validateStrategyNotes } from "./researchNotes.ts";
import { validateResearchNote } from "./researchStore.ts";
import {
  createResearchSummary,
  sanitizeForJson,
  serializedBytes,
  withSummaryAccess,
} from "./researchSummary.ts";
import type { HistoricalDataSet } from "@/types/backtesting";
import type {
  NormalizedResearchRecord,
  ResearchArtifact,
  ResearchConfiguration,
  ResearchManifest,
  ResearchPersistenceStatus,
  ResearchStoreStatus,
} from "@/types/research";

const execution = {
  strategy: momentumStrategyConfig,
  paperTrading: paperTradingConfig,
  risk: paperTradingConfig,
  execution: backtestExecutionConfig,
};
const memory = new NormalizedMemoryResearchStore();
const durable =
  process.env.VEYRIX_RESEARCH_STORE === "filesystem" ||
  process.env.NODE_ENV === "development"
    ? new NormalizedFileResearchStore(process.env.VEYRIX_RESEARCH_STORE_PATH)
    : null;
const inflight = new Map<
  string,
  Promise<{
    record: NormalizedResearchRecord;
    persistence: ResearchPersistenceStatus;
  }>
>();
let unavailable = false;

function configuration(
  timeframe: "180D" | "365D",
  anchor: string,
): ResearchConfiguration {
  return {
    strategies: ["momentum", "moving_average", "mean_reversion"],
    timeframe,
    anchor,
    validationMethod: "ALL",
    versions: {
      ...researchVersions,
      cacheSchemaVersion: NORMALIZED_STORE_SCHEMA,
    },
    execution: backtestExecutionConfig,
    risk: {
      stopLossPercent: paperTradingConfig.stopLossPercent,
      takeProfitPercent: paperTradingConfig.takeProfitPercent,
      positionSizePercent: paperTradingConfig.positionSizePercent,
    },
    validation: validationWindowConfig,
    historical: {
      source: "Coinbase Exchange",
      pair: "SOL-USD",
      granularitySeconds: 21600,
    },
  };
}
function createManifest(
  config: ResearchConfiguration,
  data: HistoricalDataSet,
  id: string,
  datasetFingerprint: string,
): ResearchManifest {
  return {
    schemaVersion: "veyrix-research-v1",
    researchRunId: id,
    generatedAt: new Date().toISOString(),
    historicalStart: data.observations[0]?.timestamp ?? "",
    historicalEnd: data.observations.at(-1)?.timestamp ?? "",
    candleInterval: "6 hours",
    candleCount: data.observations.length,
    source: "Coinbase Exchange",
    dataQuality: data.quality,
    strategies: config.strategies,
    strategyParameterGrids: Object.fromEntries(
      Object.entries(parameterSchemas).map(([strategyId, schema]) => [
        strategyId,
        schema.parameters.map((parameter) => ({
          key: parameter.key,
          values: parameter.values,
        })),
      ]),
    ),
    executionAssumptions: config.execution,
    riskSettings: config.risk,
    validationMethod: config.validationMethod,
    validationSettings: config.validation,
    scoringModelVersions: config.versions,
    benchmarkSettings: { fullExposurePercent: 100, matchedExposurePercent: 10 },
    datasetFingerprint,
  };
}

export function normalizedStoreStatus(): ResearchStoreStatus {
  return {
    memory: "AVAILABLE",
    durable: durable
      ? unavailable
        ? "UNAVAILABLE"
        : "CONFIGURED"
      : "NOT_CONFIGURED",
    provider: durable ? "filesystem" : null,
    schemaVersion: NORMALIZED_STORE_SCHEMA,
  };
}

export async function runNormalizedResearch(
  timeframe: "180D" | "365D",
  anchorInput?: string,
  now = Date.now(),
) {
  const anchor = anchorInput
    ? normalizeResearchAnchor(anchorInput, now)
    : new Date(Math.floor(now / 21600000) * 21600000).toISOString();
  if (!anchor) throw new Error("Invalid anchor");
  const started = performance.now(),
    historyStarted = performance.now(),
    data = await getHistoricalSolData(timeframe, now, anchor),
    historicalRetrievalMs = performance.now() - historyStarted,
    normalStarted = performance.now(),
    candles = Object.freeze(
      normalizeHistoricalCandles(data.observations).candles.map((value) =>
        Object.freeze({ ...value }),
      ),
    ),
    normalizationMs = performance.now() - normalStarted,
    datasetFingerprint = fingerprintDataset(candles),
    config = configuration(timeframe, anchor),
    id = createResearchRunId(config, datasetFingerprint),
    isActive = (record: NormalizedResearchRecord) =>
      record.pinned || Date.parse(record.expiresAt) > now;
  const cached = await memory.get(id);
  if (cached && isActive(cached))
    return {
      source: "MEMORY_HIT" as const,
      persistenceStatus: cached.compactSummary.persistenceStatus,
      cachedAgeMs: Math.max(0, now - Date.parse(cached.createdAt)),
      summary: withSummaryAccess(
        cached.compactSummary,
        "MEMORY_HIT",
        cached.compactSummary.persistenceStatus,
      ),
      record: cached,
    };
  if (durable)
    try {
      const stored = await durable.get(id);
      if (stored && isActive(stored)) {
        unavailable = false;
        await memory.put(stored);
        return {
          source: "STORE_HIT" as const,
          persistenceStatus: "PERSISTED" as const,
          cachedAgeMs: Math.max(0, now - Date.parse(stored.createdAt)),
          summary: withSummaryAccess(
            stored.compactSummary,
            "STORE_HIT",
            "PERSISTED",
          ),
          record: stored,
        };
      }
    } catch {
      unavailable = true;
    }
  const pending = inflight.get(id);
  if (pending) {
    const result = await pending;
    return {
      source: "IN_FLIGHT_REUSED" as const,
      persistenceStatus: result.persistence,
      cachedAgeMs: null,
      summary: withSummaryAccess(
        result.record.compactSummary,
        "IN_FLIGHT_REUSED",
        result.persistence,
      ),
      record: result.record,
    };
  }
  const job = (async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    const analysisStarted = performance.now(),
      arena = sanitizeForJson(
        runExtendedValidationArena(
          candles,
          execution,
          Number(timeframe.slice(0, -1)),
          data.quality,
        ),
      ),
      analysisMs = performance.now() - analysisStarted,
      legacyEstimateBytes = serializedBytes(arena),
      createdAt = new Date().toISOString(),
      researchManifest = createManifest(config, data, id, datasetFingerprint),
      legacyFingerprint = stableFingerprint(arena),
      initial = createResearchSummary({
        runId: id,
        createdAt,
        timeframe,
        anchor,
        datasetFingerprint,
        resultFingerprint: legacyFingerprint,
        durationMs: performance.now() - started,
        arena,
      }),
      normalized = normalizeResearchArena(arena, id),
      rootFingerprint = calculateNormalizedRootFingerprint(
        stableFingerprint(researchManifest),
        initial,
        normalized.artifacts,
      ),
      timing = {
        historicalRetrievalMs,
        normalizationMs,
        parameterSensitivityMs: analysisMs,
        validationMethodMs: analysisMs,
        regimeAnalysisMs: analysisMs,
        strategyArenaMs: analysisMs,
        analysisMs,
        totalMs: performance.now() - started,
      },
      draft = {
        schemaVersion: NORMALIZED_STORE_SCHEMA,
        complete: true as const,
        researchRunId: id,
        createdAt,
        expiresAt: new Date(Date.now() + RESEARCH_CACHE_TTL_MS).toISOString(),
        configuration: config,
        manifest: researchManifest,
        rootFingerprint,
        datasetFingerprint,
        compactSummary: initial,
        standardDetail: normalized.standardDetail,
        artifactIndex: normalized.standardDetail.artifactIndex,
        artifacts: normalized.artifacts,
        timing,
        pinned: false,
        note: null,
        strategyNotes: {},
      },
      standardSizeBytes = serializedBytes({
        manifest: researchManifest,
        summary: initial,
        detail: normalized.standardDetail,
      }),
      fullNormalizedSizeBytes = serializedBytes(draft),
      sizes = {
        summarySizeBytes: serializedBytes(initial),
        standardSizeBytes,
        fullNormalizedSizeBytes,
        storedSizeBytes: fullNormalizedSizeBytes,
        legacyEstimateBytes,
        reductionVsLegacyEstimatePercent: legacyEstimateBytes
          ? Math.max(
              0,
              (1 - fullNormalizedSizeBytes / legacyEstimateBytes) * 100,
            )
          : null,
      };
    let record: NormalizedResearchRecord = {
      ...draft,
      sizes,
      compactSummary: {
        ...initial,
        resultFingerprintPrefix: rootFingerprint.slice(0, 12),
        sizes: {
          summaryBytes: sizes.summarySizeBytes,
          detailedBytes: sizes.fullNormalizedSizeBytes,
          storedRecordBytes: sizes.storedSizeBytes,
          standardBytes: sizes.standardSizeBytes,
          fullBytes: sizes.fullNormalizedSizeBytes,
        },
      },
    };
    record = {
      ...record,
      sizes: { ...sizes, storedSizeBytes: serializedBytes(record) },
    };
    let persistence: ResearchPersistenceStatus = durable
      ? "PERSISTED"
      : "MEMORY_ONLY";
    if (durable)
      try {
        await durable.put(record);
        unavailable = false;
      } catch {
        persistence = "STORE_WRITE_FAILED";
        unavailable = true;
      }
    record = {
      ...record,
      compactSummary: {
        ...record.compactSummary,
        persistenceStatus: persistence,
      },
    };
    await memory.put(record);
    return { record, persistence };
  })();
  inflight.set(id, job);
  try {
    const result = await job;
    return {
      source: "COMPUTED" as const,
      persistenceStatus: result.persistence,
      cachedAgeMs: null,
      summary: withSummaryAccess(
        result.record.compactSummary,
        "COMPUTED",
        result.persistence,
      ),
      record: result.record,
    };
  } finally {
    inflight.delete(id);
  }
}

export async function getNormalizedRecord(id: string) {
  const cached = await memory.get(id);
  if (cached) return cached;
  if (!durable) return null;
  try {
    const stored = await durable.get(id);
    if (stored) await memory.put(stored);
    return stored;
  } catch {
    unavailable = true;
    return null;
  }
}
export async function getNormalizedRecordMetadata(id: string) {
  const cached = await memory.getMetadata(id);
  if (cached) return cached;
  if (!durable) return null;
  try {
    return await durable.getMetadata(id);
  } catch {
    unavailable = true;
    return null;
  }
}
export async function listNormalizedSummaries(limit = 25) {
  const current = await memory.list(limit);
  const stored: typeof current = durable
    ? await durable.list(limit).catch(() => [])
    : [];
  const map = new Map(
    [...stored, ...current].map((item) => [item.researchRunId, item]),
  );
  return [...map.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, Math.min(25, limit));
}
export { researchDetail };
export async function readNormalizedArtifact(
  runId: string,
  artifactId: string,
): Promise<ResearchArtifact | null> {
  const cached = await memory.getArtifact(runId, artifactId);
  if (cached) return cached;
  if (!durable) return null;
  return durable.getArtifact(runId, artifactId);
}
export async function updateNormalizedMetadata(
  runId: string,
  input: { pinned?: boolean; note?: unknown; strategyNotes?: unknown },
) {
  if (!durable) throw new Error("Durable pinning is unavailable");
  const record = await getNormalizedRecord(runId);
  if (!record) throw new Error("Research run not found");
  const note =
      input.note === undefined ? record.note : validateResearchNote(input.note),
    pinned = input.pinned ?? record.pinned,
    strategyNotes =
      input.strategyNotes === undefined
        ? (record.strategyNotes ?? {})
        : validateStrategyNotes(input.strategyNotes),
    updated = {
      ...record,
      note,
      pinned,
      strategyNotes,
      compactSummary: { ...record.compactSummary, note, pinned },
    };
  await durable.put(updated);
  await memory.put(updated);
  return updated.compactSummary;
}
export function validateNormalizedExport(value: unknown) {
  return validateNormalizedRecord(value);
}
export const normalizedInflightCount = () => inflight.size;
