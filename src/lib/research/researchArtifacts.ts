import { stableFingerprint } from "./researchIdentity.ts";
import { serializedBytes } from "./researchSummary.ts";
import type { BacktestResult, BenchmarkResult } from "@/types/backtesting";
import type {
  ExtendedValidationArena,
  ExtendedValidationReport,
  ValidationFoldResult,
} from "@/types/extendedValidation";
import type {
  NormalizedResearchDetail,
  ResearchArtifact,
  ResearchArtifactIndexEntry,
  ResearchArtifactType,
  ResearchSummary,
} from "@/types/research";
const prefix: Record<ResearchArtifactType, string> = {
    FOLD: "FD",
    BACKTEST: "BT",
    EQUITY: "EQ",
    DRAWDOWN: "DD",
    TRADES: "TR",
    BENCHMARK: "BM",
    SENSITIVITY: "SN",
    CONFIG: "CF",
    REGIME: "RG",
  },
  finite = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
export function createArtifactId(type: ResearchArtifactType, data: unknown) {
  return `${prefix[type]}-${stableFingerprint(data)}`;
}
export function verifyArtifact(value: unknown): value is ResearchArtifact {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<ResearchArtifact>;
  return (
    artifact.schemaVersion === "veyrix-artifact-v1" &&
    typeof artifact.artifactId === "string" &&
    typeof artifact.contentHash === "string" &&
    artifact.contentHash === stableFingerprint(artifact.data) &&
    artifact.artifactId === createArtifactId(artifact.type!, artifact.data) &&
    finite(artifact.sizeBytes) &&
    artifact.sizeBytes === serializedBytes(artifact.data)
  );
}
class Builder {
  artifacts = new Map<string, ResearchArtifact>();
  add(
    type: ResearchArtifactType,
    data: unknown,
    label: string,
    context: string,
  ) {
    const clean = JSON.parse(JSON.stringify(data)),
      id = createArtifactId(type, clean);
    if (!this.artifacts.has(id))
      this.artifacts.set(id, {
        schemaVersion: "veyrix-artifact-v1",
        artifactId: id,
        type,
        contentHash: stableFingerprint(clean),
        sizeBytes: serializedBytes(clean),
        label,
        context,
        data: clean,
      });
    return id;
  }
  index(): ResearchArtifactIndexEntry[] {
    return [...this.artifacts.values()]
      .sort((a, b) => a.artifactId.localeCompare(b.artifactId))
      .map(({ artifactId, type, sizeBytes, label, context, contentHash }) => ({
        artifactId,
        type,
        sizeBytes,
        label,
        context,
        contentHash,
      }));
  }
}
const metrics = (result: BacktestResult | null) =>
  result
    ? {
        initialBalance: result.initialBalance,
        finalBalance: result.finalBalance,
        finalCashBalance: result.finalCashBalance,
        finalPositionValue: result.finalPositionValue,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        analytics: {
          startingBalance: result.analytics.startingBalance,
          currentPortfolioValue: result.analytics.currentPortfolioValue,
          netProfit: result.analytics.netProfit,
          totalReturnPercent: result.analytics.totalReturnPercent,
          realizedPnl: result.analytics.realizedPnl,
          unrealizedPnl: result.analytics.unrealizedPnl,
          completedTrades: result.analytics.completedTrades,
          winningTrades: result.analytics.winningTrades,
          losingTrades: result.analytics.losingTrades,
          winRate: result.analytics.winRate,
          profitFactor: result.analytics.profitFactor,
          expectancyDollars: result.analytics.expectancyDollars,
          maximumDrawdownDollars: result.analytics.maximumDrawdownDollars,
          maximumDrawdownPercent: result.analytics.maximumDrawdownPercent,
          largestWinningTrade: result.analytics.largestWinningTrade,
          largestLosingTrade: result.analytics.largestLosingTrade,
        },
        costs: result.costs,
        strategyId: result.strategyId,
        processedObservations: result.processedObservations,
        ignoredObservations: result.ignoredObservations,
        openPosition: result.openPosition,
        returnVsFullSolPercent: result.returnVsFullSolPercent,
        returnVsMatchedExposurePercent: result.returnVsMatchedExposurePercent,
      }
    : null;
function curve(
  builder: Builder,
  points: readonly {
    timestamp: string;
    equity: number;
    tradeId?: string | null;
  }[],
  type: "EQUITY" | "DRAWDOWN",
  context: string,
) {
  return builder.add(
    type,
    points.map((point) => [
      point.timestamp,
      point.equity,
      point.tradeId ?? null,
    ]),
    `${type.toLowerCase()} curve`,
    context,
  );
}
function benchmark(builder: Builder, value: BenchmarkResult, context: string) {
  const { equityCurve, ...scalars } = value,
    equityCurveArtifactId = curve(builder, equityCurve, "EQUITY", context);
  return builder.add(
    "BENCHMARK",
    { ...scalars, equityCurveArtifactId },
    "benchmark",
    context,
  );
}
function backtest(builder: Builder, result: BacktestResult, context: string) {
  const tradeSetArtifactId = builder.add(
      "TRADES",
      result.trades,
      "trade set",
      context,
    ),
    strategyEquityArtifactId = curve(
      builder,
      result.strategyEquityCurve,
      "EQUITY",
      context,
    ),
    analyticsEquityArtifactId = curve(
      builder,
      result.analytics.equityCurve,
      "EQUITY",
      context,
    ),
    drawdownArtifactId = builder.add(
      "DRAWDOWN",
      result.analytics.drawdownCurve.map((point) => [
        point.timestamp,
        point.runningPeak,
        point.equity,
        point.drawdownDollars,
        point.drawdownPercent,
        point.tradeId ?? null,
      ]),
      "drawdown curve",
      context,
    ),
    benchmarkArtifactId = benchmark(
      builder,
      result.benchmark,
      `${context}:full`,
    ),
    matchedBenchmarkArtifactId = benchmark(
      builder,
      result.matchedBenchmark,
      `${context}:matched`,
    );
  return builder.add(
    "BACKTEST",
    {
      ...metrics(result),
      latestDecision: result.latestDecision,
      tradeSetArtifactId,
      strategyEquityArtifactId,
      analyticsEquityArtifactId,
      drawdownArtifactId,
      benchmarkArtifactId,
      matchedBenchmarkArtifactId,
    },
    "selected backtest",
    context,
  );
}
function fold(builder: Builder, value: ValidationFoldResult, context: string) {
  const inSample = value.inSample
      ? {
          parameters: value.inSample.parameters,
          veyrixScore: value.inSample.veyrixScore,
          backtestArtifactId: backtest(
            builder,
            value.inSample.result,
            `${context}:IS`,
          ),
        }
      : null,
    outOfSampleArtifactId = value.outOfSample
      ? backtest(builder, value.outOfSample, `${context}:OOS`)
      : null,
    configArtifactId = value.selectedParameters
      ? builder.add(
          "CONFIG",
          value.selectedParameters,
          "selected parameters",
          context,
        )
      : null;
  return builder.add(
    "FOLD",
    {
      index: value.index,
      trainingStart: value.trainingStart,
      trainingEnd: value.trainingEnd,
      testStart: value.testStart,
      testEnd: value.testEnd,
      embargoCandles: value.embargoCandles,
      regime: value.regime,
      configArtifactId,
      inSample,
      outOfSampleArtifactId,
      outOfSampleScore: value.outOfSampleScore,
      parameterStability: value.parameterStability,
      robustnessScore: value.robustnessScore,
      overfittingRisk: value.overfittingRisk,
      exposure: value.exposure,
      lossAttribution: value.lossAttribution,
    },
    "validation fold",
    context,
  );
}
function report(builder: Builder, value: ExtendedValidationReport) {
  const methods = value.methods.map((method) => ({
      ...method,
      folds: method.folds.map((item) =>
        fold(
          builder,
          item,
          `${value.strategyId}:${method.method}:${item.index}`,
        ),
      ),
    })),
    windows = value.multiRegime.windows.map((window) => ({
      ...window,
      walkForward: {
        ...window.walkForward,
        inSample: window.walkForward.inSample
          ? {
              parameters: window.walkForward.inSample.parameters,
              veyrixScore: window.walkForward.inSample.veyrixScore,
              backtestArtifactId: backtest(
                builder,
                window.walkForward.inSample.result,
                `${value.strategyId}:window:${window.index}:IS`,
              ),
            }
          : null,
        outOfSampleArtifactId: window.walkForward.outOfSample
          ? backtest(
              builder,
              window.walkForward.outOfSample,
              `${value.strategyId}:window:${window.index}:OOS`,
            )
          : null,
        defaultThirtyDayArtifactId: window.walkForward.defaultThirtyDayResult
          ? backtest(
              builder,
              window.walkForward.defaultThirtyDayResult,
              `${value.strategyId}:window:${window.index}:default`,
            )
          : null,
        outOfSample: undefined,
        defaultThirtyDayResult: undefined,
      },
    }));
  return {
    ...value,
    methods,
    multiRegime: { ...value.multiRegime, windows },
    strategyName: undefined,
  };
}
export function normalizeResearchArena(
  arena: ExtendedValidationArena,
  runId: string,
) {
  const builder = new Builder(),
    strategies = arena.entries.map((entry) => report(builder, entry)),
    artifactIndex = builder.index(),
    standardDetail: NormalizedResearchDetail = {
      schemaVersion: "veyrix-standard-v1",
      researchRunId: runId,
      rankings: {
        performance: arena.performanceRanking.map((item) => item.strategyId),
        robustness: arena.robustnessRanking.map((item) => item.strategyId),
        research: arena.researchRanking.map((item) => item.strategyId),
      },
      strategies,
      artifactIndex,
    };
  return {
    standardDetail,
    artifacts: Object.fromEntries(
      [...builder.artifacts.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}
export function calculateNormalizedRootFingerprint(
  manifestFingerprint: string,
  summary: ResearchSummary,
  artifacts: Record<string, ResearchArtifact>,
) {
  const normalizedSummary = {
      ...summary,
      resultFingerprintPrefix: "",
      accessSource: "COMPUTED",
      persistenceStatus: "MEMORY_ONLY",
      sizes: { summaryBytes: 0, detailedBytes: 0, storedRecordBytes: 0 },
    },
    ordered = Object.values(artifacts)
      .sort((a, b) => a.artifactId.localeCompare(b.artifactId))
      .map((item) => [item.artifactId, item.contentHash]);
  return stableFingerprint({
    manifestFingerprint,
    summary: normalizedSummary,
    artifacts: ordered,
  });
}
export function hydrateStandardResult(detail: NormalizedResearchDetail) {
  return detail;
}
export function getArtifact(
  artifacts: Record<string, ResearchArtifact>,
  id: string,
) {
  if (!/^(FD|BT|EQ|DD|TR|BM|SN|CF|RG)-[a-f0-9]{64}$/.test(id)) return null;
  const artifact = artifacts[id];
  return artifact && verifyArtifact(artifact) ? artifact : null;
}
export function profileResearchResult(arena: ExtendedValidationArena) {
  const size = (value: unknown) => serializedBytes(value),
    rankings =
      size(arena.performanceRanking) +
      size(arena.robustnessRanking) +
      size(arena.researchRanking),
    entries = size(arena.entries),
    json = JSON.stringify(arena),
    occurrences = (token: string) =>
      (json.match(new RegExp(`"${token}"`, "g")) ?? []).length;
  return {
    totalBytes: size(arena),
    strategyArenasBytes: entries,
    rankingsBytes: rankings,
    rankingDuplicationPercent: entries ? (rankings / entries) * 100 : 0,
    equityCurveOccurrences: occurrences("equityCurve"),
    drawdownCurveOccurrences: occurrences("drawdownCurve"),
    foldOccurrences: occurrences("trainingStart"),
    sensitivityRunOccurrences: occurrences("veyrixScore"),
    configurationOccurrences: occurrences("selectedParameters"),
  };
}
