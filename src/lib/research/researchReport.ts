import type {
  ExtendedValidationReport,
  ValidationConfidence,
} from "@/types/extendedValidation";
import type { MarketRegime, RegimeAggregate } from "@/types/multiRegime";
import type { ResearchSummary } from "@/types/research";
import type {
  ConclusionDrift,
  EvidenceCard,
  FailureProfile,
  PerformanceQuality,
  RegimeStory,
  ResearchReport,
  ResearchReportInput,
  ResearchSnapshot,
  StrategyScorecard,
  StrategyVerdict,
} from "@/types/researchReport";
import type { StrategyId } from "@/types/strategy";

const regimes: Exclude<MarketRegime, "UNAVAILABLE">[] = [
  "BULLISH",
  "BEARISH",
  "SIDEWAYS",
  "HIGH_VOLATILITY",
];
const strategyNames: Record<StrategyId, string> = {
  momentum: "Momentum",
  moving_average: "Moving Average",
  mean_reversion: "Mean Reversion",
};
const reportName = (report: ExtendedValidationReport) =>
  report.strategyName ?? strategyNames[report.strategyId];
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const average = (values: (number | null | undefined)[]) => {
  const usable = values.filter(finite);
  return usable.length
    ? usable.reduce((sum, value) => sum + value, 0) / usable.length
    : null;
};
const fmt = (value: number | null, suffix = "%") =>
  value === null ? "unavailable" : `${value.toFixed(2)}${suffix}`;
const entries = (detail: ResearchReportInput["detail"]) =>
  detail.strategies as ExtendedValidationReport[];
const oos = (report: ExtendedValidationReport) =>
  average(
    report.methods.map((method) => method.averageOutOfSampleReturnPercent),
  );
const drawdown = (report: ExtendedValidationReport) => {
  const values = report.methods
    .map((method) => method.averageMaximumDrawdownPercent)
    .filter(finite);
  return values.length ? Math.max(...values) : null;
};
const highRisk = (report: ExtendedValidationReport) =>
  average(report.methods.map((method) => method.highOverfittingFoldPercent));

export function classifyPerformanceQuality(
  value: number | null,
  profitable: number | null,
  matched: number | null,
): PerformanceQuality {
  if (!finite(value) || !finite(profitable) || !finite(matched))
    return "UNAVAILABLE";
  if (value > 0 && profitable >= 55 && matched >= 50) return "STRONG";
  if (value >= 0 || profitable >= 45 || matched >= 45) return "MODERATE";
  return "WEAK";
}
export function classifyStrategyVerdict(input: {
  oosReturn: number | null;
  profitableRate: number | null;
  matchedBeatRate: number | null;
  robustness: number | null;
  overfittingRate: number | null;
  confidence: ValidationConfidence;
  reliability: string;
  regimeReturns: (number | null)[];
}): StrategyVerdict {
  const values = [
    input.oosReturn,
    input.profitableRate,
    input.matchedBeatRate,
    input.robustness,
    input.overfittingRate,
  ];
  if (
    values.some((value) => !finite(value)) ||
    input.confidence === "UNAVAILABLE"
  )
    return "INCONCLUSIVE";
  const available = input.regimeReturns.filter(finite),
    dependent =
      available.some((value) => value > 0) &&
      available.some((value) => value < 0) &&
      Math.max(...available) - Math.min(...available) >= 1;
  if (
    (input.oosReturn! < 0 &&
      input.profitableRate! < 40 &&
      input.matchedBeatRate! < 40) ||
    input.robustness! < 35
  )
    return "WEAK";
  if (dependent) return "REGIME_DEPENDENT";
  if (
    input.oosReturn! > 0 &&
    input.profitableRate! >= 55 &&
    input.matchedBeatRate! >= 50 &&
    input.robustness! >= 60 &&
    input.overfittingRate! <= 30 &&
    ["MODERATE", "HIGHER"].includes(input.confidence) &&
    ["STRONG", "PROMISING"].includes(input.reliability)
  )
    return "PROMISING";
  return "INCONCLUSIVE";
}
function story(report: ExtendedValidationReport): RegimeStory[] {
  return regimes.map((regime) => {
    const item = report.multiRegime.regimes.find(
        (value) => value.regime === regime,
      ),
      periods = item?.windows ?? 0,
      returnValue = item?.averageOutOfSampleReturnPercent ?? null,
      comparison = null;
    return {
      regime,
      averageOosReturnPercent: returnValue,
      periods,
      matchedBenchmarkComparison:
        comparison === null
          ? "UNAVAILABLE"
          : comparison >= 0
            ? "OUTPERFORMED"
            : "UNDERPERFORMED",
      confidence: periods >= 2 ? "AVAILABLE" : "INSUFFICIENT_DATA",
    };
  });
}
function scorecard(
  report: ExtendedValidationReport,
  summary: ResearchSummary,
): StrategyScorecard {
  const historical = oos(report),
    profitable = report.averageProfitableFoldPercent,
    matched = report.averageMatchedBeatRatePercent,
    robustness = report.multiRegime.multiRegimeRobustnessScore,
    risk = highRisk(report),
    regimeReturns = report.multiRegime.regimes.map(
      (item) => item.averageOutOfSampleReturnPercent,
    ),
    verdict = classifyStrategyVerdict({
      oosReturn: historical,
      profitableRate: profitable,
      matchedBeatRate: matched,
      robustness,
      overfittingRate: risk,
      confidence: report.validationConfidence,
      reliability: report.reliability,
      regimeReturns,
    });
  return {
    strategyId: report.strategyId,
    strategyName: reportName(report),
    historicalOosReturnPercent: historical,
    matchedBenchmarkBeatRatePercent: matched,
    profitableOosPercent: profitable,
    maximumDrawdownPercent: drawdown(report),
    robustnessScore: robustness,
    temporalScore:
      summary.topStrategy === report.strategyId
        ? summary.temporalResearchScore
        : null,
    researchScore: report.researchScore,
    validationConfidence: report.validationConfidence,
    temporalReliability: report.reliability,
    performanceQuality: classifyPerformanceQuality(
      historical,
      profitable,
      matched,
    ),
    evidenceQuality: report.validationConfidence,
    verdict,
  };
}
export function buildFailureProfile(
  report: ExtendedValidationReport,
): FailureProfile {
  const folds = report.worstFolds,
    stopLossUsd = folds.reduce(
      (sum, fold) => sum + fold.lossAttribution.byExitReason.STOP_LOSS,
      0,
    ),
    strategySignalLossUsd = folds.reduce(
      (sum, fold) => sum + fold.lossAttribution.byExitReason.STRATEGY_SIGNAL,
      0,
    ),
    takeProfitLossUsd = folds.reduce(
      (sum, fold) => sum + fold.lossAttribution.byExitReason.TAKE_PROFIT,
      0,
    ),
    feesUsd = folds.reduce(
      (sum, fold) => sum + fold.lossAttribution.feesPaidUsd,
      0,
    ),
    slippageUsd = folds.reduce(
      (sum, fold) => sum + fold.lossAttribution.estimatedSlippageCostUsd,
      0,
    ),
    grossLoss =
      Math.abs(stopLossUsd) +
      Math.abs(strategySignalLossUsd) +
      Math.abs(takeProfitLossUsd),
    costShare = grossLoss
      ? Math.min(100, ((feesUsd + slippageUsd) / grossLoss) * 100)
      : null,
    worstFold = folds[0] ?? null,
    available = report.multiRegime.regimes.filter(
      (item): item is RegimeAggregate =>
        finite(item.averageOutOfSampleReturnPercent),
    ),
    weakest = available.length
      ? [...available].sort(
          (a, b) =>
            a.averageOutOfSampleReturnPercent! -
            b.averageOutOfSampleReturnPercent!,
        )[0].regime
      : "UNAVAILABLE",
    benchmarkGap = average(
      report.methods.map((method) => {
        const value = method.matchedBenchmarkBeatRatePercent;
        return finite(value) ? 50 - value : null;
      }),
    ),
    statements: string[] = [];
  if (
    Math.abs(stopLossUsd) >= Math.abs(strategySignalLossUsd) &&
    Math.abs(stopLossUsd) > 0
  )
    statements.push(
      "Most realized losses in the retained worst folds were associated with stop-loss exits.",
    );
  else if (Math.abs(strategySignalLossUsd) > 0)
    statements.push(
      "Most realized losses in the retained worst folds were associated with strategy-signal exits.",
    );
  if (weakest !== "UNAVAILABLE")
    statements.push(
      `Historical OOS performance was weakest during ${weakest.toLowerCase().replace("_", " ")} periods.`,
    );
  if (costShare !== null)
    statements.push(
      `Simulated fees and slippage represented ${costShare.toFixed(1)}% of gross losses in the retained worst folds.`,
    );
  if ((report.averageMatchedBeatRatePercent ?? 50) < 50)
    statements.push(
      "The strategy beat matched exposure in fewer than half of evaluated folds.",
    );
  return {
    strategyId: report.strategyId,
    stopLossUsd,
    strategySignalLossUsd,
    takeProfitLossUsd,
    feesUsd,
    slippageUsd,
    transactionCostSharePercent: costShare,
    worstFold,
    weakestRegime: weakest,
    longestLosingStreak: null,
    benchmarkUnderperformancePercent: benchmarkGap,
    statements,
  };
}
function evidence(
  report: ExtendedValidationReport,
  summary: ResearchSummary,
): EvidenceCard {
  const independent =
    report.methods.find((method) => method.method === "NON_OVERLAPPING")
      ?.numberOfFolds ?? 0;
  return {
    historyDays: report.historyDays,
    coveragePercent: report.dataQuality.coveragePercent,
    independentOosFolds: independent,
    validationMethods: report.methods.length,
    observedRegimes: report.multiRegime.regimes.filter(
      (item) => item.windows > 0,
    ).length,
    crossMethodAgreement: report.validationAgreementScore,
    anchorConsistency: summary.anchorConsistency,
    datasetQualityPercent: report.dataQuality.coveragePercent,
    researchScore: report.researchScore,
    validationConfidence: report.validationConfidence,
  };
}
const winner = (
  reports: ExtendedValidationReport[],
  metric: (report: ExtendedValidationReport) => number | null,
  highest = true,
) => {
  const valid = reports
    .map((report) => ({ id: report.strategyId, value: metric(report) }))
    .filter((item): item is { id: StrategyId; value: number } =>
      finite(item.value),
    );
  if (!valid.length) return null;
  valid.sort((a, b) => (highest ? b.value - a.value : a.value - b.value));
  return valid[0].id;
};
function suggestionsFor(
  report: ExtendedValidationReport,
  profile: FailureProfile,
) {
  const result: string[] = [];
  if (profile.weakestRegime === "SIDEWAYS")
    result.push(
      "Test backtest-only filters designed to reduce entries during sideways conditions.",
    );
  if ((profile.transactionCostSharePercent ?? 0) >= 25)
    result.push(
      "Test lower-turnover parameter regions against the same frozen evaluation folds.",
    );
  if (report.parameterDrift.classification === "HIGH")
    result.push(
      "Investigate wider parameter-stability regions across historical windows.",
    );
  if ((report.averageMatchedBeatRatePercent ?? 100) < 50)
    result.push(
      "Investigate whether limited market exposure explains matched-benchmark underperformance.",
    );
  if (!result.length)
    result.push(
      "Repeat the same frozen methodology on a later historical anchor to test conclusion stability.",
    );
  return result;
}
export function generateResearchReport(
  input: ResearchReportInput,
): ResearchReport {
  const reports = entries(input.detail);
  if (!reports.length)
    throw new Error("Stored research detail has no strategies");
  const cards = reports.map((report) => scorecard(report, input.summary)),
    performanceId = input.detail.rankings.performance[0] ?? null,
    robustId = input.detail.rankings.robustness[0] ?? null,
    researchId = input.detail.rankings.research[0] ?? null,
    byId = (id: StrategyId | null) =>
      reports.find((report) => report.strategyId === id) ?? null,
    performance = byId(performanceId),
    robust = byId(robustId),
    research = byId(researchId),
    strategyEntries = reports.map((report, index) => {
      const failure = buildFailureProfile(report);
      return {
        scorecard: cards[index],
        regimes: story(report),
        failure,
        suggestions: suggestionsFor(report, failure),
      };
    }),
    allRegimes = strategyEntries.flatMap((entry) =>
      entry.regimes
        .filter(
          (item) =>
            item.confidence === "AVAILABLE" &&
            finite(item.averageOosReturnPercent),
        )
        .map((item) => ({ ...item, strategyId: entry.scorecard.strategyId })),
    ),
    bestRegime = allRegimes.length
      ? [...allRegimes].sort(
          (a, b) => b.averageOosReturnPercent! - a.averageOosReturnPercent!,
        )[0]
      : null,
    weakRegime = allRegimes.length
      ? [...allRegimes].sort(
          (a, b) => a.averageOosReturnPercent! - b.averageOosReturnPercent!,
        )[0]
      : null,
    primaryFailure =
      strategyEntries.find(
        (entry) => entry.scorecard.strategyId === performanceId,
      )?.failure.statements[0] ??
      "No supported primary failure statement was available.",
    evidenceLeader = research ?? reports[0],
    evidenceCard = evidence(evidenceLeader, input.summary),
    performanceCard = cards.find((card) => card.strategyId === performanceId),
    positive =
      performanceCard?.historicalOosReturnPercent !== null &&
      performanceCard?.historicalOosReturnPercent !== undefined &&
      performanceCard.historicalOosReturnPercent > 0,
    overall = performanceCard
      ? `${performanceCard.strategyName} ranked first on historical OOS return and ${positive ? "produced positive" : "did not produce positive"} aggregate simulated OOS performance (${fmt(performanceCard.historicalOosReturnPercent)}).`
      : "No performance leader was available.",
    benchmark = performanceCard
      ? `${performanceCard.strategyName} beat the 10% exposure-matched benchmark in ${fmt(performanceCard.matchedBenchmarkBeatRatePercent)} of evaluated folds.`
      : "Matched-benchmark evidence was unavailable.",
    executive = `${overall} ${robust ? `${reportName(robust)} ranked first on robustness.` : "Robustness ranking was unavailable."} ${research ? `${reportName(research)} had the strongest research-evidence score.` : "Evidence ranking was unavailable."} ${benchmark} Evidence confidence was ${evidenceCard.validationConfidence.toLowerCase()}.`,
    strongBoth = cards.find(
      (card) =>
        card.performanceQuality === "STRONG" &&
        card.evidenceQuality === "HIGHER",
    ),
    conclusion = strongBoth
      ? `Stored simulated evidence favors ${strongBoth.strategyName}, which combined strong historical performance quality with higher evidence quality in this run. This does not predict future results.`
      : `This run does not identify a strategy with both strong historical performance quality and higher evidence quality. ${performanceCard?.strategyName ?? "The leading strategy"} should therefore be treated as a research result, not an investment recommendation.`,
    categoryWinners = {
      bestHistoricalReturn: performanceId,
      bestRobustness: robustId,
      bestEvidence: researchId,
      lowestDrawdown: winner(reports, drawdown, false),
      bestBullishRegime: winner(
        reports,
        (report) =>
          report.multiRegime.regimes.find(
            (item) => item.regime === "BULLISH" && item.windows >= 2,
          )?.averageOutOfSampleReturnPercent ?? null,
      ),
      bestBearishRegime: winner(
        reports,
        (report) =>
          report.multiRegime.regimes.find(
            (item) => item.regime === "BEARISH" && item.windows >= 2,
          )?.averageOutOfSampleReturnPercent ?? null,
      ),
      bestSidewaysRegime: winner(
        reports,
        (report) =>
          report.multiRegime.regimes.find(
            (item) => item.regime === "SIDEWAYS" && item.windows >= 2,
          )?.averageOutOfSampleReturnPercent ?? null,
      ),
      bestMatchedBenchmarkBeatRate: winner(
        reports,
        (report) => report.averageMatchedBeatRatePercent,
      ),
    };
  return {
    schemaVersion: "veyrix-report-v1",
    runId: input.summary.researchRunId,
    title: `Veyrix Strategy Research Report — ${input.summary.anchor.slice(0, 10)}`,
    generatedFromStoredData: true,
    historicalRange: {
      start: input.manifest.historicalStart,
      end: input.manifest.historicalEnd,
      days: evidenceCard.historyDays,
    },
    executiveSummary: executive,
    sections: {
      overallResult: overall,
      performanceLeader: performance
        ? `${reportName(performance)} ranked first by aggregate historical OOS return.`
        : "N/A",
      robustnessLeader: robust
        ? `${reportName(robust)} ranked first by Multi-Regime Robustness Score.`
        : "N/A",
      evidenceLeader: research
        ? `${reportName(research)} ranked first by Research Score.`
        : "N/A",
      benchmarkResult: benchmark,
      bestRegime: bestRegime
        ? `${bestRegime.strategyId} had the highest supported average OOS return in ${bestRegime.regime.toLowerCase().replace("_", " ")} periods (${fmt(bestRegime.averageOosReturnPercent)}).`
        : "Insufficient regime data.",
      weakestRegime: weakRegime
        ? `${weakRegime.strategyId} had the lowest supported average OOS return in ${weakRegime.regime.toLowerCase().replace("_", " ")} periods (${fmt(weakRegime.averageOosReturnPercent)}).`
        : "Insufficient regime data.",
      primaryFailureMode: primaryFailure,
      evidenceQuality: `${evidenceCard.validationConfidence} confidence from ${evidenceCard.independentOosFolds} independent OOS folds, ${evidenceCard.observedRegimes} observed regimes, and ${evidenceCard.coveragePercent.toFixed(1)}% dataset coverage.`,
    },
    categoryWinners,
    strategies: strategyEntries,
    evidence: evidenceCard,
    conclusion,
    nextExperiments: [
      ...new Set(strategyEntries.flatMap((entry) => entry.suggestions)),
    ],
    assumptions: [
      `Historical ${input.manifest.candleInterval} Coinbase ${input.manifest.source} candles.`,
      `Simulated fee ${input.manifest.executionAssumptions.feePercentPerSide}% per side and slippage ${input.manifest.executionAssumptions.slippagePercent}%.`,
      `Position size ${input.manifest.riskSettings.positionSizePercent}%, stop loss ${input.manifest.riskSettings.stopLossPercent}%, take profit ${input.manifest.riskSettings.takeProfitPercent}%.`,
    ],
    disclaimer:
      "Historical paper simulations do not predict future performance. No real trades, wallets, funds, leverage, margin, short selling, or investment advice are involved.",
  };
}
export function createResearchSnapshot(
  report: ResearchReport,
  input: ResearchReportInput,
): ResearchSnapshot {
  return {
    schemaVersion: "veyrix-snapshot-v1",
    runId: report.runId,
    historicalPeriod: `${report.historicalRange.start}/${report.historicalRange.end}`,
    rankings: input.detail.rankings,
    headlineMetrics: {
      averageOosReturnPercent: input.summary.averageOosReturnPercent,
      matchedBenchmarkBeatRatePercent:
        input.summary.matchedBenchmarkBeatRatePercent,
      researchScore: input.summary.researchScore,
      multiRegimeRobustness: input.summary.multiRegimeRobustness,
    },
    verdicts: Object.fromEntries(
      report.strategies.map((item) => [
        item.scorecard.strategyId,
        item.scorecard.verdict,
      ]),
    ),
    researchConfidence: report.evidence.validationConfidence,
    benchmarkResult: report.sections.benchmarkResult,
    simulationDisclaimer: report.disclaimer,
  };
}
export function calculateConclusionDrift(
  summaries: readonly ResearchSummary[],
): ConclusionDrift {
  if (summaries.length < 3) return "INSUFFICIENT_DATA";
  const ordered = [...summaries].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    ),
    changes =
      ordered
        .slice(1)
        .filter(
          (item, index) => item.topStrategy !== ordered[index].topStrategy,
        ).length /
      (ordered.length - 1),
    robustnessChanges =
      ordered
        .slice(1)
        .filter(
          (item, index) =>
            item.robustnessLeader !== ordered[index].robustnessLeader,
        ).length /
      (ordered.length - 1),
    evidenceChanges =
      ordered
        .slice(1)
        .filter(
          (item, index) =>
            item.researchEvidenceLeader !==
            ordered[index].researchEvidenceLeader,
        ).length /
      (ordered.length - 1),
    matched = ordered
      .map((item) => item.matchedBenchmarkBeatRatePercent)
      .filter(finite),
    range = matched.length ? Math.max(...matched) - Math.min(...matched) : 0,
    reliabilityChanges =
      ordered
        .slice(1)
        .filter(
          (item, index) =>
            item.temporalReliability !== ordered[index].temporalReliability,
        ).length /
      (ordered.length - 1);
  if (
    changes === 0 &&
    robustnessChanges === 0 &&
    evidenceChanges === 0 &&
    range <= 15 &&
    reliabilityChanges === 0
  )
    return "STABLE";
  if (
    changes <= 0.5 &&
    robustnessChanges <= 0.5 &&
    evidenceChanges <= 0.5 &&
    range <= 30 &&
    reliabilityChanges <= 0.5
  )
    return "CHANGING";
  return "HIGHLY_VARIABLE";
}
export function researchReportToMarkdown(report: ResearchReport) {
  const lines = [
    `# ${report.title}`,
    "",
    `Run ID: ${report.runId}`,
    `Historical range: ${report.historicalRange.start} to ${report.historicalRange.end}`,
    "",
    "## Executive Summary",
    "",
    report.executiveSummary,
    "",
    "## Strategy Scorecards",
    "",
  ];
  for (const item of report.strategies)
    lines.push(
      `### ${item.scorecard.strategyName}`,
      `- Historical OOS return: ${fmt(item.scorecard.historicalOosReturnPercent)}`,
      `- Matched benchmark beat rate: ${fmt(item.scorecard.matchedBenchmarkBeatRatePercent)}`,
      `- Performance quality: ${item.scorecard.performanceQuality}`,
      `- Evidence quality: ${item.scorecard.evidenceQuality}`,
      `- Verdict: ${item.scorecard.verdict}`,
      "",
    );
  lines.push(
    "## Benchmark Comparison",
    "",
    report.sections.benchmarkResult,
    "",
    "## Regime Performance",
    "",
    report.sections.bestRegime,
    report.sections.weakestRegime,
    "",
    "## Robustness and Validation Evidence",
    "",
    report.sections.robustnessLeader,
    report.sections.evidenceQuality,
    "",
    "## Failure Analysis",
    "",
    report.sections.primaryFailureMode,
    "",
    "## Conclusion",
    "",
    report.conclusion,
    "",
    "## Next Experiments",
    "",
  );
  for (const suggestion of report.nextExperiments)
    lines.push(`- ${suggestion}`);
  lines.push("", "## Simulation Disclaimer", "", report.disclaimer, "");
  return lines.join("\n");
}
