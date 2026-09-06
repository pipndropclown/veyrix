"use client";
import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { runParameterSensitivity } from "@/lib/optimization/parameterSensitivity";
import {
  runRobustnessArena,
  runWalkForward,
} from "@/lib/optimization/walkForward";
import { parameterSchemas } from "@/lib/optimization/parameterSchemas";
import { strategyList } from "@/lib/strategy/strategyRegistry";
import { momentumStrategyConfig } from "@/lib/strategy/momentumStrategy";
import { paperTradingConfig } from "@/lib/trading/tradingConfig";
import { backtestExecutionConfig } from "@/lib/backtesting/backtestConfig";
import type { HistoricalApiResponse } from "@/types/backtesting";
import type {
  RobustnessArenaResult,
  SensitivityReport,
  WalkForwardReport,
} from "@/types/robustness";
import type { StrategyId } from "@/types/strategy";
const config = {
    strategy: momentumStrategyConfig,
    paperTrading: paperTradingConfig,
    risk: paperTradingConfig,
    execution: backtestExecutionConfig,
  },
  pct = (v: number | null) => (v === null ? "N/A" : `${v.toFixed(2)}%`),
  usd = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(v),
  params = (v: Record<string, number> | null) =>
    v
      ? Object.entries(v)
          .map(([k, x]) => `${k}: ${x}`)
          .join(" · ")
      : "N/A";
export function RobustnessLab() {
  const [strategyId, setStrategyId] = useState<StrategyId>("momentum"),
    [sensitivity, setSensitivity] = useState<SensitivityReport | null>(null),
    [walk, setWalk] = useState<WalkForwardReport | null>(null),
    [arena, setArena] = useState<RobustnessArenaResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function candles() {
    const response = await fetch("/api/historical?timeframe=30D", {
        cache: "no-store",
      }),
      payload = (await response.json()) as HistoricalApiResponse;
    if (!response.ok || !payload.success) throw new Error();
    return payload.data.observations;
  }
  async function execute(kind: "sensitivity" | "walk" | "arena") {
    setBusy(true);
    setError(null);
    try {
      const data = await candles();
      if (kind === "sensitivity") {
        setSensitivity(
          runParameterSensitivity({ candles: data, strategyId, config }),
        );
        setWalk(null);
        setArena(null);
      } else if (kind === "walk") {
        setWalk(runWalkForward(data, strategyId, config));
        setSensitivity(null);
        setArena(null);
      } else {
        setArena(runRobustnessArena(data, config));
        setSensitivity(null);
        setWalk(null);
      }
    } catch {
      setError("Robustness analysis could not run.");
    } finally {
      setBusy(false);
    }
  }
  const schema = parameterSchemas[strategyId];
  return (
    <section className="robustness-section" aria-busy={busy}>
      <SectionHeader
        eyebrow="30D · backtest-only research"
        title="Strategy robustness lab"
      />
      <div className="robust-controls">
        <select
          aria-label="Robustness strategy"
          value={strategyId}
          onChange={(e) => setStrategyId(e.target.value as StrategyId)}
        >
          {strategyList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button onClick={() => execute("sensitivity")} disabled={busy}>
          RUN SENSITIVITY
        </button>
        <button onClick={() => execute("walk")} disabled={busy}>
          RUN WALK-FORWARD
        </button>
        <button onClick={() => execute("arena")} disabled={busy}>
          COMPARE ROBUSTNESS
        </button>
      </div>
      {busy && (
        <p className="research-running" role="status">
          Validating strategy robustness. This may take a moment.
        </p>
      )}
      <div className="parameter-schema">
        {schema.parameters.map((p) => (
          <div key={p.key}>
            <span>{p.displayName}</span>
            <strong>
              {p.minimum} → {p.maximum}
            </strong>
            <small>
              Default {p.defaultValue} · Step {p.step}
            </small>
          </div>
        ))}
      </div>
      {error && <p className="backtest-error">{error}</p>}
      {sensitivity && (
        <>
          <div className="robust-summary">
            <div>
              <span>Default configuration</span>
              <strong>
                {pct(
                  sensitivity.defaultRun?.result.analytics.totalReturnPercent ??
                    null,
                )}
              </strong>
            </div>
            <div>
              <span>Highest return</span>
              <strong>
                {pct(
                  sensitivity.highestReturn?.result.analytics
                    .totalReturnPercent ?? null,
                )}
              </strong>
              <small>
                {params(sensitivity.highestReturn?.parameters ?? null)}
              </small>
            </div>
            <div>
              <span>Highest Veyrix Score</span>
              <strong>
                {sensitivity.highestScore?.veyrixScore.toFixed(1) ?? "N/A"}
              </strong>
              <small>
                {params(sensitivity.highestScore?.parameters ?? null)}
              </small>
            </div>
            <div>
              <span>Lowest drawdown</span>
              <strong>
                {pct(
                  sensitivity.lowestDrawdown?.result.analytics
                    .maximumDrawdownPercent ?? null,
                )}
              </strong>
            </div>
            <div>
              <span>Parameter Stability</span>
              <strong>{sensitivity.parameterStability.toFixed(1)}</strong>
              <small>
                Experimental · {sensitivity.neighborCount} neighbors
              </small>
            </div>
          </div>
          <section className="panel sensitivity-grid">
            <SectionHeader
              eyebrow="Parameter combinations"
              title="Sensitivity grid"
            />
            <div className="sensitivity-cells">
              {sensitivity.runs.map((run, i) => (
                <div key={i}>
                  <span>{params(run.parameters)}</span>
                  <strong>{run.veyrixScore.toFixed(1)}</strong>
                  <small>{pct(run.result.analytics.totalReturnPercent)}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      {walk && (
        <>
          <div className="robust-summary">
            <div>
              <span>Default 30D return</span>
              <strong>
                {pct(
                  walk.defaultThirtyDayResult?.analytics.totalReturnPercent ??
                    null,
                )}
              </strong>
            </div>
            <div>
              <span>Parameter Stability</span>
              <strong>{walk.parameterStability?.toFixed(1) ?? "N/A"}</strong>
            </div>
            <div>
              <span>Overfitting Risk</span>
              <strong className={`risk-${walk.overfittingRisk.toLowerCase()}`}>
                {walk.overfittingRisk}
              </strong>
            </div>
            <div>
              <span>Robustness Score</span>
              <strong>{walk.robustnessScore?.toFixed(1) ?? "N/A"}</strong>
            </div>
          </div>
          <div className="walk-grid">
            <section className="panel">
              <SectionHeader
                eyebrow={`IN-SAMPLE · ${walk.inSampleCandles} candles`}
                title="Tuned on first 70%"
              />
              <p>{params(walk.selectedParameters)}</p>
              <dl>
                <div>
                  <dt>Return</dt>
                  <dd>
                    {pct(
                      walk.inSample?.result.analytics.totalReturnPercent ??
                        null,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Net P&amp;L</dt>
                  <dd>
                    {walk.inSample
                      ? usd(walk.inSample.result.analytics.netProfit)
                      : "N/A"}
                  </dd>
                </div>
                <div>
                  <dt>Win rate</dt>
                  <dd>
                    {pct(walk.inSample?.result.analytics.winRate ?? null)}
                  </dd>
                </div>
                <div>
                  <dt>Profit factor</dt>
                  <dd>
                    {walk.inSample?.result.analytics.profitFactor?.toFixed(2) ??
                      "N/A"}
                  </dd>
                </div>
                <div>
                  <dt>Expectancy</dt>
                  <dd>
                    {walk.inSample?.result.analytics.expectancyDollars == null
                      ? "N/A"
                      : usd(walk.inSample.result.analytics.expectancyDollars)}
                  </dd>
                </div>
                <div>
                  <dt>Max drawdown</dt>
                  <dd>
                    {pct(
                      walk.inSample?.result.analytics.maximumDrawdownPercent ??
                        null,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Veyrix Score</dt>
                  <dd>{walk.inSample?.veyrixScore.toFixed(1) ?? "N/A"}</dd>
                </div>
              </dl>
            </section>
            <section className="panel">
              <SectionHeader
                eyebrow={`OUT-OF-SAMPLE · ${walk.outOfSampleCandles} candles`}
                title="Frozen parameters"
              />
              <p>Parameters were not optimized using these candles.</p>
              <dl>
                <div>
                  <dt>Return</dt>
                  <dd>
                    {pct(
                      walk.outOfSample?.analytics.totalReturnPercent ?? null,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Net P&amp;L</dt>
                  <dd>
                    {walk.outOfSample
                      ? usd(walk.outOfSample.analytics.netProfit)
                      : "N/A"}
                  </dd>
                </div>
                <div>
                  <dt>Win rate</dt>
                  <dd>{pct(walk.outOfSample?.analytics.winRate ?? null)}</dd>
                </div>
                <div>
                  <dt>Profit factor</dt>
                  <dd>
                    {walk.outOfSample?.analytics.profitFactor?.toFixed(2) ??
                      "N/A"}
                  </dd>
                </div>
                <div>
                  <dt>Expectancy</dt>
                  <dd>
                    {walk.outOfSample?.analytics.expectancyDollars == null
                      ? "N/A"
                      : usd(walk.outOfSample.analytics.expectancyDollars)}
                  </dd>
                </div>
                <div>
                  <dt>Max drawdown</dt>
                  <dd>
                    {pct(
                      walk.outOfSample?.analytics.maximumDrawdownPercent ??
                        null,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Veyrix Score</dt>
                  <dd>{walk.outOfSampleScore?.toFixed(1) ?? "N/A"}</dd>
                </div>
                <div>
                  <dt>Return decay</dt>
                  <dd>{pct(walk.returnDecayPercent)}</dd>
                </div>
                <div>
                  <dt>Score decay</dt>
                  <dd>{walk.scoreDecay?.toFixed(1) ?? "N/A"}</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      )}
      {arena && (
        <section className="panel leaderboard">
          <SectionHeader
            eyebrow="Ranked by Veyrix Robustness Score"
            title="Robustness arena"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Strategy</th>
                  <th>Default 30D</th>
                  <th>Best IS</th>
                  <th>OOS return</th>
                  <th>Stability</th>
                  <th>Risk</th>
                  <th>Robustness</th>
                </tr>
              </thead>
              <tbody>
                {arena.ranked.map((e, i) => (
                  <tr key={e.strategyId}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{e.strategyName}</strong>
                    </td>
                    <td>
                      {pct(
                        e.report.defaultThirtyDayResult?.analytics
                          .totalReturnPercent ?? null,
                      )}
                    </td>
                    <td>
                      {pct(
                        e.report.inSample?.result.analytics
                          .totalReturnPercent ?? null,
                      )}
                    </td>
                    <td>
                      {pct(
                        e.report.outOfSample?.analytics.totalReturnPercent ??
                          null,
                      )}
                    </td>
                    <td>{e.report.parameterStability?.toFixed(1) ?? "N/A"}</td>
                    <td>{e.report.overfittingRisk}</td>
                    <td>{e.report.robustnessScore?.toFixed(1) ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <aside className="assumptions">
        <strong>Experimental robustness research</strong>
        <span>
          Parameter optimization can overfit. Chronological out-of-sample
          testing reduces but does not eliminate that risk. Thirty days is a
          small sample. All results are simulations, and historical performance
          does not predict future results.
        </span>
      </aside>
    </section>
  );
}
