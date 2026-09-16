"use client";
import { useState } from "react";
import { EquityCurveChart } from "./EquityCurveChart";
import { MultiEquityCurveChart } from "./MultiEquityCurveChart";
import { SectionHeader } from "./SectionHeader";
import { runBacktest } from "@/lib/backtesting/backtestEngine";
import { compareStrategies } from "@/lib/backtesting/strategyArena";
import { backtestExecutionConfig } from "@/lib/backtesting/backtestConfig";
import { getTimeframeDefinition } from "@/lib/backtesting/marketCandles";
import {
  strategyList,
  strategyRegistry,
} from "@/lib/strategy/strategyRegistry";
import { momentumStrategyConfig } from "@/lib/strategy/momentumStrategy";
import { paperTradingConfig } from "@/lib/trading/tradingConfig";
import type {
  BacktestResult,
  BacktestTimeframe,
  HistoricalApiResponse,
  StrategyComparisonResult,
} from "@/types/backtesting";
import type { StrategyId } from "@/types/strategy";
import { MARKET_IDS, MARKET_REGISTRY, type MarketId } from "@/lib/market/marketRegistry";
const usd = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(v),
  pct = (v: number | null) => (v === null ? "N/A" : `${v.toFixed(2)}%`),
  signed = (v: number) => `${v >= 0 ? "+" : "−"}${usd(Math.abs(v))}`;
const sharedConfig = {
  strategy: momentumStrategyConfig,
  paperTrading: paperTradingConfig,
  risk: paperTradingConfig,
  execution: backtestExecutionConfig,
};
const winnerName = (arena: StrategyComparisonResult, id: StrategyId | null) =>
  arena.entries.find((e) => e.strategy.id === id)?.strategy.name ?? "N/A";
function SignalInspector({ result }: { result: BacktestResult }) {
  return (
    <section className="panel signal-inspector">
      <SectionHeader
        eyebrow="Latest backtest decision"
        title="Signal inspector"
      />
      <div className="inspector-head">
        <strong
          className={`signal-${result.latestDecision.signal.toLowerCase()}`}
        >
          {result.latestDecision.signal}
        </strong>
        <span>{result.latestDecision.confidence}% confidence</span>
      </div>
      <p>{result.latestDecision.reason}</p>
      <dl>
        {Object.entries(result.latestDecision.metrics).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll(/([A-Z])/g, " $1")}</dt>
            <dd>
              {typeof value === "number" ? value.toFixed(3) : (value ?? "N/A")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
function SingleResults({ result, marketId }: { result: BacktestResult; marketId: MarketId }) {

  const a = result.analytics,
    stats = [
      ["Final balance", usd(result.finalBalance)],
      ["Return", pct(a.totalReturnPercent)],
      ["Net P&L", signed(a.netProfit)],
      ["Trades", String(a.completedTrades)],
      ["Win rate", pct(a.winRate)],
      ["Profit factor", a.profitFactor?.toFixed(2) ?? "N/A"],
      [
        "Expectancy",
        a.expectancyDollars === null ? "N/A" : signed(a.expectancyDollars),
      ],
      ["Max drawdown", pct(a.maximumDrawdownPercent)],
      ["Fees", usd(result.costs.totalFees)],
      ["Slippage", usd(result.costs.estimatedSlippageCost)],
    ];
  return (
    <>
      <div className="backtest-stats">
        {stats.map(([l, v]) => (
          <div key={l}>
            <span>{l}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <section className="comparison-panel panel">
        <SectionHeader
          eyebrow="Same period and costs"
          title="Strategy vs benchmarks"
        />
        <div className="comparison-grid benchmark-comparison-grid">
          <div>
            <span>{result.strategyName}</span>
            <strong>{pct(a.totalReturnPercent)}</strong>
            <small>
              {signed(a.netProfit)} · DD {pct(a.maximumDrawdownPercent)}
            </small>
          </div>
          <div>
            <span>Buy &amp; Hold — Full Exposure</span>
            <strong>{pct(result.benchmark.totalReturnPercent)}</strong>
            <small>
              {signed(result.benchmark.netProfit)} · DD{" "}
              {pct(result.benchmark.maximumDrawdownPercent)}
            </small>
          </div>
          <div>
            <span>Buy &amp; Hold — 10% Exposure</span>
            <strong>{pct(result.matchedBenchmark.totalReturnPercent)}</strong>
            <small>
              {signed(result.matchedBenchmark.netProfit)} · DD{" "}
              {pct(result.matchedBenchmark.maximumDrawdownPercent)}
            </small>
          </div>
          <div className="alpha-card">
            <span>Return vs Full {marketId}</span>
            <strong>{pct(result.returnVsFullSolPercent)}</strong>
            <small>Simple return difference.</small>
          </div>
          <div className="alpha-card">
            <span>Return vs Matched Exposure</span>
            <strong>{pct(result.returnVsMatchedExposurePercent)}</strong>
            <small>Simple return difference.</small>
          </div>
        </div>
      </section>
      <section className="panel backtest-chart">
        <SectionHeader
          eyebrow="Strategy vs Full Buy & Hold"
          title="Equity curve"
        />
        <EquityCurveChart
          points={result.strategyEquityCurve}
          comparisonPoints={result.benchmark.equityCurve}
          emptyMessage="No equity data."
        />
      </section>
      <SignalInspector result={result} />
      <section className="panel trades-panel">
        <SectionHeader
          eyebrow="Isolated simulated history"
          title="Backtest trades"
          action={
            <span className="paper-count">
              {result.trades.length} simulated
            </span>
          }
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entry</th>
                <th>Exit</th>
                <th>Net P&amp;L</th>
                <th>Fees</th>
                <th>Slippage</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.length ? (
                result.trades.map((t) => (
                  <tr key={t.id}>
                    <td>{usd(t.executedEntryPrice)}</td>
                    <td>
                      {t.executedExitPrice === null
                        ? "Open"
                        : usd(t.executedExitPrice)}
                    </td>
                    <td>
                      {t.realizedPnl === null
                        ? "Unrealized"
                        : signed(t.realizedPnl)}
                    </td>
                    <td>{usd(t.totalFeesUsd)}</td>
                    <td>{usd(t.estimatedSlippageCostUsd)}</td>
                    <td>{t.exitReason ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-table">
                    No qualifying trades.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function ArenaResults({ arena, marketId }: { arena: StrategyComparisonResult; marketId: MarketId }) {
  const colors = ["#61f2c2", "#72a8ff", "#d58cff"];
  return (
    <>
      <section className="panel leaderboard">
        <SectionHeader
          eyebrow="Identical candles and execution assumptions"
          title="Strategy leaderboard"
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Score</th>
                <th>Final Balance</th>
                <th>Return</th>
                <th>Net P&amp;L</th>
                <th>Trades</th>
                <th>Win Rate</th>
                <th>Profit Factor</th>
                <th>Expectancy</th>
                <th>Max DD</th>
                <th>Vs Hold</th>
              </tr>
            </thead>
            <tbody>
              {arena.entries.map((e) => (
                <tr key={e.strategy.id}>
                  <td>
                    <strong>{e.strategy.name}</strong>
                  </td>
                  <td>{e.score.toFixed(1)}</td>
                  <td>{usd(e.result.finalBalance)}</td>
                  <td>{pct(e.result.analytics.totalReturnPercent)}</td>
                  <td>{signed(e.result.analytics.netProfit)}</td>
                  <td>{e.result.analytics.completedTrades}</td>
                  <td>{pct(e.result.analytics.winRate)}</td>
                  <td>
                    {e.result.analytics.profitFactor?.toFixed(2) ?? "N/A"}
                  </td>
                  <td>
                    {e.result.analytics.expectancyDollars === null
                      ? "N/A"
                      : signed(e.result.analytics.expectancyDollars)}
                  </td>
                  <td>{pct(e.result.analytics.maximumDrawdownPercent)}</td>
                  <td>{pct(e.result.strategyAlphaPercent)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Buy &amp; Hold {marketId}</strong>
                </td>
                <td>N/A</td>
                <td>{usd(arena.benchmark.finalBalance)}</td>
                <td>{pct(arena.benchmark.totalReturnPercent)}</td>
                <td>{signed(arena.benchmark.netProfit)}</td>
                <td>N/A</td>
                <td>N/A</td>
                <td>N/A</td>
                <td>N/A</td>
                <td>{pct(arena.benchmark.maximumDrawdownPercent)}</td>
                <td>0.00%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div className="winner-grid">
        {[
          ["Highest Return", winnerName(arena, arena.winners.highestReturn)],
          ["Lowest Drawdown", winnerName(arena, arena.winners.lowestDrawdown)],
          [
            "Highest Profit Factor",
            winnerName(arena, arena.winners.highestProfitFactor),
          ],
          [
            "Highest Expectancy",
            winnerName(arena, arena.winners.highestExpectancy),
          ],
        ].map(([l, v]) => (
          <div key={l}>
            <span>{l}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <SectionHeader
          eyebrow="Veyrix Score (Experimental)"
          title="Multi-strategy equity curves"
        />
        <MultiEquityCurveChart
          series={[
            ...arena.entries.map((e, i) => ({
              name: e.strategy.name,
              color: colors[i],
              points: e.result.strategyEquityCurve,
            })),
            {
              name: `Buy & Hold ${marketId}`,
              color: "#e9bf70",
              points: arena.benchmark.equityCurve,
            },
          ]}
        />
        <p className="analytics-note">
          Score weights: return 35%, drawdown 25%, profit factor 20%, expectancy
          20%; every component is clamped to 0–100.
        </p>
      </section>
    </>
  );
}
export function BacktestPanel() {
  const [mode, setMode] = useState<"single" | "compare">("single"),
    [marketId, setMarketId] = useState<MarketId>("SOL"),
    [timeframe, setTimeframe] = useState<BacktestTimeframe>("7D"),
    [strategyId, setStrategyId] = useState<StrategyId>("momentum"),
    [result, setResult] = useState<BacktestResult | null>(null),
    [arena, setArena] = useState<StrategyComparisonResult | null>(null),
    [running, setRunning] = useState(false),
    [error, setError] = useState<string | null>(null),
    definition = getTimeframeDefinition(timeframe);
  async function run() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/historical?symbol=${marketId}&timeframe=${timeframe}`, {
          cache: "no-store",
        }),
        payload = (await response.json()) as HistoricalApiResponse;
      if (!response.ok || !payload.success) throw new Error();
      if (mode === "compare") {
        setArena(compareStrategies(payload.data.observations, sharedConfig));
        setResult(null);
      } else {
        setResult(
          runBacktest({
            candles: payload.data.observations,
            strategy: strategyRegistry[strategyId],
            config: sharedConfig,
          }),
        );
        setArena(null);
      }
    } catch {
      setError("Historical simulation could not run.");
    } finally {
      setRunning(false);
    }
  }
  return (
    <section className="backtest-section" aria-busy={running}>
      <SectionHeader
        eyebrow="Multi-strategy simulation laboratory"
        title="Backtesting"
        action={
          <button className="run-button" onClick={run} disabled={running}>
            {running
              ? "RUNNING…"
              : mode === "compare"
                ? "COMPARE STRATEGIES"
                : "RUN BACKTEST"}
          </button>
        }
      />
      <div className="lab-controls">
        <select disabled={running} aria-label="Research market" value={marketId} onChange={(event) => { setMarketId(event.target.value as MarketId); setResult(null); setArena(null); }}>{MARKET_IDS.map((id) => <option key={id} value={id}>{MARKET_REGISTRY[id].displaySymbol}</option>)}</select>
        <div className="period-selector">
          {(["single", "compare"] as const).map((v) => (
            <button
              key={v}
              className={mode === v ? "selected" : ""}
              onClick={() => setMode(v)}
              aria-pressed={mode === v}
            >
              {v === "single" ? "SINGLE STRATEGY" : "COMPARE STRATEGIES"}
            </button>
          ))}
        </div>
        <select
          aria-label="Backtest strategy"
          value={strategyId}
          onChange={(e) => setStrategyId(e.target.value as StrategyId)}
          disabled={mode === "compare"}
        >
          {strategyList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="period-selector">
          {(["7D", "14D", "30D"] as const).map((v) => (
            <button
              key={v}
              className={timeframe === v ? "selected" : ""}
              onClick={() => setTimeframe(v)}
              aria-pressed={timeframe === v}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="strategy-description">
        <strong>
          {mode === "compare"
            ? "Fair comparison"
            : strategyRegistry[strategyId].name}
        </strong>
        <span>
          {mode === "compare"
            ? "All agents receive the same immutable candles, capital, costs, and risk limits."
            : strategyRegistry[strategyId].description}
        </span>
        <small>
          {mode === "compare"
            ? "$10,000 · 10% sizing · 2% stop · 4% target"
            : JSON.stringify(strategyRegistry[strategyId].configuration)}
        </small>
      </div>
      <div className="backtest-banner">
        <strong>BACKTEST</strong>
        <span>
          {timeframe} · {definition.interval} OHLC · Fee 0.10% / side · Slippage
          0.05% · STOP_FIRST
        </span>
      </div>
      {error && <p className="backtest-error">{error}</p>}
      {result && <SingleResults result={result} marketId={marketId} />}{" "}
      {arena && <ArenaResults arena={arena} marketId={marketId} />}{" "}
      {!result && !arena && !error && (
        <div className="backtest-empty">
          Select a strategy or comparison mode, then run the isolated
          simulation.
        </div>
      )}
      <aside className="assumptions">
        <strong>Simulation only</strong>
        <span>
          Historical results do not predict future performance. All strategies
          are long-only and use identical Coinbase candles, fees, slippage,
          position sizing, stops, targets, and STOP_FIRST collision handling. No
          real trades are executed.
        </span>
      </aside>
    </section>
  );
}
