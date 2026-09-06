"use client";
import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { strategyList } from "@/lib/strategy/strategyRegistry";
import type {
  BacktestTimeframe,
  HistoricalDataQuality,
} from "@/types/backtesting";
import type {
  ExtendedValidationArena,
  ExtendedValidationReport,
  ValidationMethod,
  ValidationMethodMetrics,
} from "@/types/extendedValidation";
import type { StrategyId } from "@/types/strategy";
const pct = (value: number | null) =>
    value === null ? "N/A" : `${value.toFixed(2)}%`,
  num = (value: number | null) => (value === null ? "N/A" : value.toFixed(1)),
  labels: Record<ValidationMethod, string> = {
    ROLLING_OVERLAPPING: "Rolling",
    NON_OVERLAPPING: "Non-Overlapping",
    EXPANDING_WALK_FORWARD: "Expanding",
  };
function Quality({ quality }: { quality: HistoricalDataQuality }) {
  return (
    <div className="quality-grid">
      <div>
        <span>Coverage</span>
        <strong>{pct(quality.coveragePercent)}</strong>
      </div>
      <div>
        <span>Valid candles</span>
        <strong>
          {quality.actualValidCandles} / ~{quality.expectedApproximateCandles}
        </strong>
      </div>
      <div>
        <span>Missing intervals</span>
        <strong>{quality.missingIntervalCount}</strong>
      </div>
      <div>
        <span>Duplicates removed</span>
        <strong>{quality.duplicateCountRemoved}</strong>
      </div>
      <div>
        <span>Invalid removed</span>
        <strong>{quality.invalidCandleCountRemoved}</strong>
      </div>
    </div>
  );
}
function MethodTable({ methods }: { methods: ValidationMethodMetrics[] }) {
  return (
    <section className="panel leaderboard">
      <SectionHeader
        eyebrow="Out-of-sample evidence"
        title="Validation methods"
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Folds</th>
              <th>Profitable</th>
              <th>Avg OOS</th>
              <th>Worst</th>
              <th>Veyrix Score</th>
              <th>Matched Beat</th>
              <th>Full Beat</th>
              <th>Avg DD</th>
              <th>High Overfit</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((method) => (
              <tr key={method.method}>
                <td>
                  <strong>{labels[method.method]}</strong>
                </td>
                <td>{method.numberOfFolds}</td>
                <td>{pct(method.profitableFoldPercent)}</td>
                <td>{pct(method.averageOutOfSampleReturnPercent)}</td>
                <td>{pct(method.worstOutOfSampleReturnPercent)}</td>
                <td>{num(method.averageVeyrixScore)}</td>
                <td>{pct(method.matchedBenchmarkBeatRatePercent)}</td>
                <td>{pct(method.fullBenchmarkBeatRatePercent)}</td>
                <td>{pct(method.averageMaximumDrawdownPercent)}</td>
                <td>{pct(method.highOverfittingFoldPercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Report({ report }: { report: ExtendedValidationReport }) {
  return (
    <>
      <div className="extended-summary">
        <div>
          <span>Research Score</span>
          <strong>{num(report.researchScore)}</strong>
        </div>
        <div>
          <span>Validation Confidence</span>
          <strong>{report.validationConfidence}</strong>
        </div>
        <div>
          <span>Agreement</span>
          <strong>{num(report.validationAgreementScore)}</strong>
        </div>
        <div>
          <span>Multi-Regime Score</span>
          <strong>{num(report.multiRegime.multiRegimeRobustnessScore)}</strong>
        </div>
        <div>
          <span>Profitable OOS</span>
          <strong>{pct(report.averageProfitableFoldPercent)}</strong>
        </div>
        <div>
          <span>Matched Beat Rate</span>
          <strong>{pct(report.averageMatchedBeatRatePercent)}</strong>
        </div>
        <div>
          <span>Market Exposure</span>
          <strong>{pct(report.averageExposurePercent)}</strong>
        </div>
        <div>
          <span>Parameter Drift</span>
          <strong>{report.parameterDrift.classification}</strong>
        </div>
      </div>
      <MethodTable methods={report.methods} />
      <section className="panel duration-panel">
        <SectionHeader
          eyebrow={`${report.regimeDurations.length} chronological blocks`}
          title="Regime-duration analysis"
        />
        <div className="window-cards">
          {report.regimeDurations.map((duration, index) => (
            <details key={`${duration.startTimestamp}-${index}`}>
              <summary>
                <span>{duration.regime}</span>
                <strong>{duration.durationDays.toFixed(1)} days</strong>
                <span>Market {pct(duration.marketReturnPercent)}</span>
                <span>Strategy {pct(duration.strategyReturnPercent)}</span>
              </summary>
              <p>
                {duration.numberOfTrades} trades · benchmark{" "}
                {pct(duration.benchmarkReturnPercent)} · volatility{" "}
                {pct(duration.volatilityPercent)}
              </p>
            </details>
          ))}
        </div>
      </section>
      <section className="panel failure-panel">
        <SectionHeader
          eyebrow="Lowest out-of-sample returns"
          title="Worst-fold analysis"
        />
        <div className="window-cards">
          {report.worstFolds.map((fold, index) => (
            <details key={`${fold.dates}-${index}`}>
              <summary>
                <span>{fold.dates.replace("/", " — ")}</span>
                <strong>{fold.regime}</strong>
                <span>Return {pct(fold.strategyReturnPercent)}</span>
                <span>DD {pct(fold.maximumDrawdownPercent)}</span>
              </summary>
              <p>
                {fold.explanations.join(" ") ||
                  "No deterministic failure explanation available."}
              </p>
              <small>
                {fold.trades} trades · {fold.losingTrades} losses · fees $
                {fold.lossAttribution.feesPaidUsd.toFixed(2)} · slippage $
                {fold.lossAttribution.estimatedSlippageCostUsd.toFixed(2)} ·
                exposure {pct(fold.exposure.averageExposurePercent)}
              </small>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
function Ranking({
  title,
  entries,
  value,
}: {
  title: string;
  entries: ExtendedValidationReport[];
  value: (report: ExtendedValidationReport) => string;
}) {
  return (
    <section className="panel ranking-panel">
      <SectionHeader eyebrow="Separate evidence dimension" title={title} />
      {entries.map((entry, index) => (
        <div key={entry.strategyId}>
          <span>
            #{index + 1} {entry.strategyName}
          </span>
          <strong>{value(entry)}</strong>
        </div>
      ))}
    </section>
  );
}
function Arena({ arena }: { arena: ExtendedValidationArena }) {
  return (
    <div className="ranking-grid">
      <Ranking
        title="Performance ranking"
        entries={arena.performanceRanking}
        value={(entry) =>
          pct(
            entry.methods.reduce(
              (sum, method) =>
                sum + (method.averageOutOfSampleReturnPercent ?? 0),
              0,
            ) / 3,
          )
        }
      />
      <Ranking
        title="Robustness ranking"
        entries={arena.robustnessRanking}
        value={(entry) => num(entry.multiRegime.multiRegimeRobustnessScore)}
      />
      <Ranking
        title="Research confidence ranking"
        entries={arena.researchRanking}
        value={(entry) => num(entry.researchScore)}
      />
    </div>
  );
}
export function ExtendedValidationLab() {
  const [timeframe, setTimeframe] =
      useState<Extract<BacktestTimeframe, "90D" | "180D" | "365D">>("180D"),
    [strategyId, setStrategyId] = useState<StrategyId>("momentum"),
    [method, setMethod] = useState<ValidationMethod>("NON_OVERLAPPING"),
    [quality, setQuality] = useState<HistoricalDataQuality | null>(null),
    [single, setSingle] = useState<ValidationMethodMetrics | null>(null),
    [report, setReport] = useState<ExtendedValidationReport | null>(null),
    [arena, setArena] = useState<ExtendedValidationArena | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function run(action: "method" | "report" | "arena") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeframe, strategyId, method, action }),
        }),
        payload = await response.json();
      if (!response.ok || !payload.success) throw new Error();
      setQuality(payload.quality);
      setSingle(payload.kind === "method" ? payload.data : null);
      setReport(payload.kind === "report" ? payload.data : null);
      setArena(payload.kind === "arena" ? payload.data : null);
    } catch {
      setError("Extended validation could not run.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="extended-validation-section" aria-busy={busy}>
      <SectionHeader
        eyebrow="Independent and embargoed evidence"
        title="Extended validation lab"
      />
      <div className="robust-controls">
        <div className="period-selector">
          {(["90D", "180D", "365D"] as const).map((value) => (
            <button
              key={value}
              className={timeframe === value ? "selected" : ""}
              onClick={() => setTimeframe(value)}
              aria-pressed={timeframe === value}
            >
              {value}
            </button>
          ))}
        </div>
        <select
          aria-label="Extended validation strategy"
          value={strategyId}
          onChange={(event) => setStrategyId(event.target.value as StrategyId)}
        >
          {strategyList.map((strategy) => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Validation method"
          value={method}
          onChange={(event) =>
            setMethod(event.target.value as ValidationMethod)
          }
        >
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button disabled={busy} onClick={() => run("method")}>
          RUN VALIDATION
        </button>
        <button disabled={busy} onClick={() => run("report")}>
          COMPARE METHODS
        </button>
        <button disabled={busy} onClick={() => run("arena")}>
          COMPARE STRATEGIES
        </button>
      </div>
      {busy && (
        <p className="research-running" role="status">
          Running historical simulation and validating future-only folds.
        </p>
      )}
      {error && <p className="backtest-error">{error}</p>}
      {quality && <Quality quality={quality} />}{" "}
      {single && <MethodTable methods={[single]} />}{" "}
      {report && <Report report={report} />} {arena && <Arena arena={arena} />}{" "}
      {!single && !report && !arena && !error && (
        <div className="backtest-empty">
          Choose history, strategy, and validation method. Extended calculations
          run server-side against one cached dataset.
        </div>
      )}
      <aside className="assumptions">
        <strong>Validation methods</strong>
        <span>
          Rolling uses overlapping 30-day windows. Non-overlapping uses
          independent 30-day training and 10-day test blocks. Expanding
          walk-forward grows training while test blocks remain future-only. A
          one-candle embargo separates optimization and evaluation. Results
          remain historical paper simulations.
        </span>
      </aside>
    </section>
  );
}
