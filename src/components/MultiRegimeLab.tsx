"use client";
import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import {
  runMultiRegimeAnalysis,
  runMultiRegimeArena,
} from "@/lib/optimization/multiRegimeAnalysis";
import { strategyList } from "@/lib/strategy/strategyRegistry";
import { momentumStrategyConfig } from "@/lib/strategy/momentumStrategy";
import { paperTradingConfig } from "@/lib/trading/tradingConfig";
import { backtestExecutionConfig } from "@/lib/backtesting/backtestConfig";
import type {
  BacktestTimeframe,
  HistoricalApiResponse,
} from "@/types/backtesting";
import type { MultiRegimeArena, MultiRegimeReport } from "@/types/multiRegime";
import type { StrategyId } from "@/types/strategy";
const config = {
    strategy: momentumStrategyConfig,
    paperTrading: paperTradingConfig,
    risk: paperTradingConfig,
    execution: backtestExecutionConfig,
  },
  pct = (value: number | null) =>
    value === null ? "N/A" : `${value.toFixed(2)}%`,
  score = (value: number | null) => (value === null ? "N/A" : value.toFixed(1)),
  parameters = (value: Record<string, number> | null) =>
    value
      ? Object.entries(value)
          .map(([key, item]) => `${key}: ${item}`)
          .join(" · ")
      : "N/A",
  date = (value: string) =>
    new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
function Summary({ report }: { report: MultiRegimeReport }) {
  const analytics = report.analytics;
  return (
    <>
      <div className="multi-summary">
        <div>
          <span>Reliability</span>
          <strong className={`reliability-${report.reliability.toLowerCase()}`}>
            {report.reliability}
          </strong>
        </div>
        <div>
          <span>Multi-Regime Score</span>
          <strong>{score(report.multiRegimeRobustnessScore)}</strong>
        </div>
        <div>
          <span>Cross-Window Consistency</span>
          <strong>{score(analytics.crossWindowConsistency)}</strong>
        </div>
        <div>
          <span>Profitable OOS Windows</span>
          <strong>{pct(analytics.profitableWindowPercent)}</strong>
        </div>
        <div>
          <span>Matched Benchmark Beat Rate</span>
          <strong>{pct(analytics.matchedBenchmarkBeatRatePercent)}</strong>
        </div>
        <div>
          <span>Parameter Drift</span>
          <strong>{report.parameterDrift.classification}</strong>
          <small>
            Temporal stability {score(report.parameterDrift.temporalStability)}
          </small>
        </div>
      </div>
      <section className="panel window-explorer">
        <SectionHeader
          eyebrow={`${report.windows.length} overlapping windows`}
          title="Rolling-window explorer"
        />
        <div className="window-cards">
          {report.windows.map((window) => (
            <details key={window.index}>
              <summary>
                <span>
                  {date(window.startTimestamp)} — {date(window.endTimestamp)}
                </span>
                <strong>{window.regime}</strong>
                <span>OOS {pct(window.outOfSampleReturnPercent)}</span>
                <span>Robustness {score(window.robustnessScore)}</span>
              </summary>
              <dl>
                <div>
                  <dt>Market return</dt>
                  <dd>{pct(window.marketReturnPercent)}</dd>
                </div>
                <div>
                  <dt>Volatility</dt>
                  <dd>{pct(window.realizedVolatilityPercent)}</dd>
                </div>
                <div>
                  <dt>Selected parameters</dt>
                  <dd>{parameters(window.selectedParameters)}</dd>
                </div>
                <div>
                  <dt>IS return</dt>
                  <dd>{pct(window.inSampleReturnPercent)}</dd>
                </div>
                <div>
                  <dt>OOS return</dt>
                  <dd>{pct(window.outOfSampleReturnPercent)}</dd>
                </div>
                <div>
                  <dt>Full SOL</dt>
                  <dd>{pct(window.fullBenchmarkReturnPercent)}</dd>
                </div>
                <div>
                  <dt>Matched exposure</dt>
                  <dd>{pct(window.matchedBenchmarkReturnPercent)}</dd>
                </div>
                <div>
                  <dt>Overfitting risk</dt>
                  <dd>{window.overfittingRisk}</dd>
                </div>
              </dl>
            </details>
          ))}
        </div>
      </section>
      <section className="panel drift-panel">
        <SectionHeader
          eyebrow="Across rolling windows"
          title="Parameter drift"
        />
        <p>
          <strong>{report.parameterDrift.classification}</strong> ·{" "}
          {report.parameterDrift.uniqueConfigurations} unique configurations ·
          modal configuration used{" "}
          {pct(report.parameterDrift.modalConfigurationPercent)} ·{" "}
          {report.parameterDrift.consecutiveChanges} consecutive changes.
        </p>
        <small>
          {parameters(report.parameterDrift.mostFrequentParameters)}
        </small>
      </section>
    </>
  );
}
function Arena({ arena }: { arena: MultiRegimeArena }) {
  const regimes = [
    "BULLISH",
    "BEARISH",
    "SIDEWAYS",
    "HIGH_VOLATILITY",
  ] as const;
  return (
    <>
      <section className="panel leaderboard">
        <SectionHeader
          eyebrow="Ranked by Multi-Regime Robustness Score"
          title="Multi-regime arena"
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Windows</th>
                <th>Profitable OOS</th>
                <th>Avg OOS</th>
                <th>Worst OOS</th>
                <th>Avg Robustness</th>
                <th>Consistency</th>
                <th>Matched Beat</th>
                <th>Score</th>
                <th>Reliability</th>
              </tr>
            </thead>
            <tbody>
              {arena.ranked.map((report) => (
                <tr key={report.strategyId}>
                  <td>
                    <strong>{report.strategyName}</strong>
                  </td>
                  <td>{report.analytics.numberOfWindows}</td>
                  <td>{pct(report.analytics.profitableWindowPercent)}</td>
                  <td>
                    {pct(report.analytics.averageOutOfSampleReturnPercent)}
                  </td>
                  <td>{pct(report.analytics.worstOutOfSampleReturnPercent)}</td>
                  <td>{score(report.analytics.averageRobustnessScore)}</td>
                  <td>{score(report.analytics.crossWindowConsistency)}</td>
                  <td>
                    {pct(report.analytics.matchedBenchmarkBeatRatePercent)}
                  </td>
                  <td>{score(report.multiRegimeRobustnessScore)}</td>
                  <td>{report.reliability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel regime-matrix">
        <SectionHeader
          eyebrow="Average out-of-sample return"
          title="Regime performance matrix"
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Strategy</th>
                {regimes.map((regime) => (
                  <th key={regime}>{regime.replace("_", " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {arena.entries.map((report) => (
                <tr key={report.strategyId}>
                  <td>
                    <strong>{report.strategyName}</strong>
                  </td>
                  {regimes.map((regime) => {
                    const item = report.regimes.find(
                      (entry) => entry.regime === regime,
                    );
                    return (
                      <td key={regime}>
                        {item?.windows
                          ? pct(item.averageOutOfSampleReturnPercent)
                          : "Insufficient data"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export function MultiRegimeLab() {
  const [history, setHistory] =
      useState<Extract<BacktestTimeframe, "60D" | "90D">>("90D"),
    [strategyId, setStrategyId] = useState<StrategyId>("momentum"),
    [report, setReport] = useState<MultiRegimeReport | null>(null),
    [arena, setArena] = useState<MultiRegimeArena | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function execute(compare: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/historical?timeframe=${history}`, {
          cache: "no-store",
        }),
        payload = (await response.json()) as HistoricalApiResponse;
      if (!response.ok || !payload.success) throw new Error();
      const days = history === "90D" ? 90 : 60;
      if (compare) {
        setArena(runMultiRegimeArena(payload.data.observations, config, days));
        setReport(null);
      } else {
        setReport(
          runMultiRegimeAnalysis({
            candles: payload.data.observations,
            strategyId,
            config,
            historyDays: days,
          }),
        );
        setArena(null);
      }
    } catch {
      setError("Multi-regime analysis could not run.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="multi-regime-section" aria-busy={busy}>
      <SectionHeader
        eyebrow="Rolling 30D windows · 10D step"
        title="Multi-regime analysis"
      />
      <div className="robust-controls">
        <div className="period-selector">
          {(["60D", "90D"] as const).map((value) => (
            <button
              key={value}
              className={history === value ? "selected" : ""}
              onClick={() => setHistory(value)}
              aria-pressed={history === value}
            >
              {value}
            </button>
          ))}
        </div>
        <select
          aria-label="Multi-regime strategy"
          value={strategyId}
          onChange={(event) => setStrategyId(event.target.value as StrategyId)}
        >
          {strategyList.map((strategy) => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </option>
          ))}
        </select>
        <button onClick={() => execute(false)} disabled={busy}>
          RUN MULTI-REGIME ANALYSIS
        </button>
        <button onClick={() => execute(true)} disabled={busy}>
          COMPARE ALL STRATEGIES
        </button>
      </div>
      {busy && (
        <p className="research-running" role="status">
          Running historical simulation across market regimes.
        </p>
      )}
      {error && <p className="backtest-error">{error}</p>}
      {report && <Summary report={report} />} {arena && <Arena arena={arena} />}{" "}
      {!report && !arena && !error && (
        <div className="backtest-empty">
          Select 60D or 90D history, then inspect one strategy or compare the
          full arena.
        </div>
      )}
      <aside className="assumptions">
        <strong>Overlapping historical simulations</strong>
        <span>
          Longer history improves coverage but does not predict future
          performance. Rolling windows overlap and are not independent samples.
          Regimes and reliability labels are experimental heuristics.
          Optimization can still overfit, and simulations omit variable
          liquidity and latency. No real trades are executed.
        </span>
      </aside>
    </section>
  );
}
