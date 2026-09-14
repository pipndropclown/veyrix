"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityLog } from "./ActivityLog";
import { AutomationControlPanel } from "./AutomationControlPanel";
import { LiveCandlestickChart } from "./LiveCandlestickChart";
import { FuturesPaperPanel } from "./FuturesPaperPanel";
import { closeFutures, openFutures } from "@/lib/trading/futuresEngine";
import { closedCandles } from "@/lib/market/liveCandles";
import { getStrategy } from "@/lib/strategy/strategyRegistry";
import { ManualPaperTradePanel } from "./ManualPaperTradePanel";
import { MarketPanel } from "./MarketPanel";
import { PerformanceAnalyticsPanel } from "./PerformanceAnalyticsPanel";
import { PortfolioOverview } from "./PortfolioOverview";
import { ReadOnlyWalletPanel } from "./ReadOnlyWalletPanel";
import { RecentTrades } from "./RecentTrades";
import { RiskManagementPanel } from "./RiskManagementPanel";
import { SectionHeader } from "./SectionHeader";
import { calculatePerformanceAnalytics } from "@/lib/analytics/performanceAnalytics";
import {
  LIVE_TIMEFRAMES,
  LIVE_TIMEFRAME_IDS,
  nextCandleClose,
} from "@/lib/market/liveCandles";
import {
  AUTOMATION_STORAGE_KEY,
  DEFAULT_AUTOMATION,
  evaluateAutomation,
  restoreAutomationSettings,
} from "@/lib/trading/automationEngine";
import {
  manualBuy,
  manualSellAll,
  monitorPaperRisk,
} from "@/lib/trading/manualPaperTrading";
import {
  calculatePortfolioMetrics,
  createInitialPaperPortfolio,
  restorePaperPortfolio,
} from "@/lib/trading/paperPortfolio";
import { calculatePositionRisk } from "@/lib/trading/riskEngine";
import { PAPER_PORTFOLIO_STORAGE_KEY } from "@/lib/trading/tradingConfig";
import type { MarketApiResponse, MarketData } from "@/types/market";
import type {
  AutomationSettings,
  AutomationStatus,
  ChartMode,
  LiveCandleApiResponse,
  LiveTimeframe,
} from "@/types/liveTrading";
import type { HistoricalCandle } from "@/types/backtesting";
import type { PaperPortfolioState } from "@/types/trading";
const MARKET_REFRESH_MS = 30000;
const emptyStatus = (timeframe: LiveTimeframe): AutomationStatus => ({
  signal: null,
  lastEvaluatedCandle: null,
  lastEvaluationTime: null,
  lastExecution: null,
  nextExpectedClose: nextCandleClose(timeframe),
});
export function LiveMarketSection() {
  const [tradingMode, setTradingMode] = useState<"SPOT" | "FUTURES">("SPOT");
  const [futuresAutonomousEnabled, setFuturesAutonomousEnabled] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null),
    [marketError, setMarketError] = useState<string | null>(null),
    [isLoading, setIsLoading] = useState(true),
    [isRefreshing, setIsRefreshing] = useState(false);
  const [portfolio, setPortfolio] = useState<PaperPortfolioState>(
      createInitialPaperPortfolio,
    ),
    [automation, setAutomation] =
      useState<AutomationSettings>(DEFAULT_AUTOMATION),
    [automationStatus, setAutomationStatus] = useState<AutomationStatus>(() =>
      emptyStatus("15m"),
    ),
    [hydrated, setHydrated] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<LiveTimeframe>("15m"),
    [chartMode, setChartMode] = useState<ChartMode>("CANDLESTICK"),
    [candles, setCandles] = useState<HistoricalCandle[]>([]),
    [candleError, setCandleError] = useState<string | null>(null),
    [candleLoading, setCandleLoading] = useState(true);
  const automationBusy = useRef(false);
  const futuresAutoLastSeen = useRef<string | null>(null);
  const futuresStrategyId = automation.strategyId;
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(PAPER_PORTFOLIO_STORAGE_KEY),
          settings = localStorage.getItem(AUTOMATION_STORAGE_KEY);
        setPortfolio(
          saved
            ? restorePaperPortfolio(JSON.parse(saved))
            : createInitialPaperPortfolio(),
        );
        setAutomation(
          settings
            ? restoreAutomationSettings(JSON.parse(settings))
            : { ...DEFAULT_AUTOMATION },
        );
      } catch {
        setPortfolio(createInitialPaperPortfolio());
        setAutomation({ ...DEFAULT_AUTOMATION });
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(
        PAPER_PORTFOLIO_STORAGE_KEY,
        JSON.stringify(portfolio),
      );
  }, [hydrated, portfolio]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(AUTOMATION_STORAGE_KEY, JSON.stringify(automation));
  }, [hydrated, automation]);
  const fetchMarket = useCallback(async (background = false) => {
    if (background) setIsRefreshing(true);
    try {
      const response = await fetch("/api/market", { cache: "no-store" }),
        payload = (await response.json()) as MarketApiResponse;
      if (!response.ok || !payload.success) throw new Error();
      setPortfolio((current) => {
        const spot = current.solBalance > 0
          ? monitorPaperRisk(current, payload.data.price, payload.data.lastUpdated).portfolio
          : current;
        return closeFutures(spot, payload.data.price, payload.data.lastUpdated);
      });
      setMarketData(payload.data);
      setMarketError(null);
    } catch {
      setMarketError("Market data temporarily unavailable");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  const fetchCandles = useCallback(
    async (timeframe: LiveTimeframe) => {
      try {
        const response = await fetch(`/api/candles?timeframe=${timeframe}`, {
            cache: "no-store",
          }),
          payload = (await response.json()) as LiveCandleApiResponse;
        if (!response.ok || !payload.success) throw new Error();
        if (timeframe === chartTimeframe) {
          setCandles(payload.data.candles);
          setCandleError(null);
          setCandleLoading(false);
        }
        return payload.data.candles;
      } catch {
        if (timeframe === chartTimeframe) {
          setCandleError(
            "Chart candles are temporarily unavailable. Veyrix will retry.",
          );
          setCandleLoading(false);
        }
        return null;
      }
    },
    [chartTimeframe],
  );
  useEffect(() => {
    if (!hydrated) return;
    const initial = window.setTimeout(() => void fetchMarket(), 0);
    const id = setInterval(() => void fetchMarket(true), MARKET_REFRESH_MS);
    return () => { window.clearTimeout(initial); clearInterval(id); };
  }, [fetchMarket, hydrated]);
  useEffect(() => {
    const initial = window.setTimeout(() => void fetchCandles(chartTimeframe), 0);
    const id = setInterval(
      () => void fetchCandles(chartTimeframe),
      LIVE_TIMEFRAMES[chartTimeframe].refreshMs,
    );
    return () => { window.clearTimeout(initial); clearInterval(id); };
  }, [chartTimeframe, fetchCandles]);
  useEffect(() => {
    if (!hydrated || tradingMode !== "SPOT") return;
    const settings = automation;
    const evaluate = async () => {
      if (automationBusy.current) return;
      automationBusy.current = true;
      try {
        const data =
          settings.timeframe === chartTimeframe
            ? candles
            : await fetchCandles(settings.timeframe);
        if (!data?.length) return;
        setPortfolio((current) => {
          const result = evaluateAutomation({
            portfolio: current,
            settings,
            candles: data,
          });
          setAutomation(result.settings);
          if (result.outcome !== "DUPLICATE")
            setAutomationStatus(result.status);
          return result.portfolio;
        });
      } finally {
        automationBusy.current = false;
      }
    };
    void evaluate();
    const id = setInterval(
      () => void evaluate(),
      Math.min(30000, LIVE_TIMEFRAMES[settings.timeframe].refreshMs),
    );
    return () => clearInterval(id);
  }, [
    automation,
    candles,
    chartTimeframe,
    fetchCandles,
    hydrated,
    tradingMode,
  ]);
  useEffect(() => {
    if (!hydrated || tradingMode !== "FUTURES" || !futuresAutonomousEnabled || !candles.length) return;
    const latest = closedCandles(candles, chartTimeframe, Date.now()).at(-1);
    if (!latest) return;
    const id = `${futuresStrategyId}:${chartTimeframe}:${latest.timestamp}`;
    if (futuresAutoLastSeen.current === null) { futuresAutoLastSeen.current = id; return; }
    if (futuresAutoLastSeen.current === id) return;
    futuresAutoLastSeen.current = id;
    setPortfolio((current) => {
      if ((current.futuresProcessedCandleIds ?? []).includes(id)) return current;
      const ids = [...(current.futuresProcessedCandleIds ?? []), id].slice(-200);
      const observations = closedCandles(candles, chartTimeframe, Date.now()).map((candle) => ({ timestamp: candle.timestamp, price: candle.close }));
      const decision = getStrategy(futuresStrategyId).evaluate(observations);
      const base = { ...current, futuresProcessedCandleIds: ids };
      if (decision.signal === "HOLD" || (current.futuresTrades ?? []).some((trade) => trade.status === "OPEN")) return base;
      return openFutures(base, { side: decision.signal === "BUY" ? "LONG" : "SHORT", leverage: 1,
        marginUsdc: Math.min(base.availableUsdc, Math.round(base.availableUsdc * 0.1 * 100) / 100),
        price: latest.close, stopLoss: null, takeProfit: null, source: "AUTONOMOUS", timestamp: latest.timestamp }).portfolio;
    });
  }, [hydrated, tradingMode, futuresAutonomousEnabled, candles, chartTimeframe, futuresStrategyId]);
  const marketPrice = marketData?.price ?? null;
  const metrics = calculatePortfolioMetrics(portfolio, marketPrice);
  const risk = portfolio.averageSolEntryPrice === null
    ? null
    : calculatePositionRisk(portfolio.averageSolEntryPrice);
  const analytics = calculatePerformanceAnalytics({
    startingBalance: metrics.startingBalance,
    currentPortfolioValue: metrics.totalPortfolioValue,
    unrealizedPnl: metrics.unrealizedPnl,
    trades: portfolio.trades,
  });
  const changeAutomation = (settings: AutomationSettings) => {
      setAutomation(settings);
      setAutomationStatus({
        ...emptyStatus(settings.timeframe),
        signal: automationStatus.signal,
      });
    },
    reset = () => {
      if (
        !confirm(
          "Reset the paper account to $10,000 virtual USDC and erase all simulated trades?",
        )
      )
        return;
      localStorage.removeItem(PAPER_PORTFOLIO_STORAGE_KEY);
      setPortfolio(createInitialPaperPortfolio());
    },
    lastAction =
      portfolio.activity.find((item) => item.type === "trade")?.title ??
      "Waiting";
  return (
    <>
      <section className="terminal-section">
        <SectionHeader
          eyebrow="Live paper trading terminal"
          title="SOL / USDC"
          action={<span className="paper-only-chip">PAPER TRADING ONLY</span>}
        />
        <p className="guest-mode-note">Guest mode — your paper trading data is saved on this device. <a href="/auth/sign-up">Create an account to sync</a>.</p>
        <div className="period-selector trading-mode-selector" role="group" aria-label="Trading mode">
          <button type="button" className={tradingMode === "SPOT" ? "selected" : ""} aria-pressed={tradingMode === "SPOT"} onClick={() => setTradingMode("SPOT")}>SPOT PAPER</button>
          <button type="button" className={tradingMode === "FUTURES" ? "selected" : ""} aria-pressed={tradingMode === "FUTURES"} onClick={() => setTradingMode("FUTURES")}>FUTURES PAPER</button>
        </div>
        {tradingMode === "FUTURES" && <p className="futures-banner"><strong>SIMULATED FUTURES</strong> · NO REAL FUNDS OR BORROWING</p>}
        <div className="terminal-status">
          {[
            ["MARKET", marketError ? "UNAVAILABLE" : "LIVE"],
            ["CHART", chartTimeframe],
            ["AUTOMATION", automation.enabled ? "RUNNING" : "STOPPED"],
            ["STRATEGY", automation.strategyId.replaceAll("_", " ")],
            ["PAPER POSITION", metrics.state === "LONG" ? "LONG SOL" : "FLAT"],
            ["LAST ACTION", lastAction],
            [
              "NEXT EVALUATION",
              new Date(
                nextCandleClose(automation.timeframe),
              ).toLocaleTimeString(),
            ],
          ].map(([key, value]) => (
            <div key={key}>
              <span>{key}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="chart-toolbar">
          <div
            className="period-selector"
            role="group"
            aria-label="Chart timeframe"
          >
            {LIVE_TIMEFRAME_IDS.map((id) => (
              <button
                type="button"
                key={id}
                className={chartTimeframe === id ? "selected" : ""}
                aria-pressed={chartTimeframe === id}
                onClick={() => { setCandleLoading(true); setChartTimeframe(id); }}
              >
                {id}
              </button>
            ))}
          </div>
          <div
            className="period-selector"
            role="group"
            aria-label="Chart style"
          >
            {(["CANDLESTICK", "LINE"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={chartMode === mode ? "selected" : ""}
                aria-pressed={chartMode === mode}
                onClick={() => setChartMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        {candleLoading ? (
          <div className="chart-loading" role="status">
            Loading live market candles…
          </div>
        ) : candleError ? (
          <div className="market-error" role="alert">
            <strong>Chart unavailable</strong>
            <p>{candleError}</p>
          </div>
        ) : (
          <LiveCandlestickChart
            candles={candles}
            mode={chartMode}
            trades={portfolio.trades}
            risk={risk}
            currentPrice={marketData?.price ?? candles.at(-1)?.close ?? null}
          />
        )}
        <small className="chart-source">
          Coinbase Exchange public OHLC · latest candle may still be forming ·
          automation evaluates closed candles only
        </small>
      </section>
      <PortfolioOverview metrics={metrics} riskLevels={risk} onReset={reset} />
      {tradingMode === "SPOT" ? <><RiskManagementPanel metrics={metrics} levels={risk} />
      <div className="terminal-control-grid">
        <AutomationControlPanel
          settings={automation}
          status={automationStatus}
          position={metrics.state}
          onChange={changeAutomation}
        />
        <ManualPaperTradePanel
          portfolio={portfolio}
          price={marketData?.price ?? null}
          automationEnabled={automation.enabled}
          onBuy={(amount) => {
            const result = manualBuy(
              portfolio,
              amount,
              marketData?.price ?? NaN,
            );
            if (!result.error) setPortfolio(result.portfolio);
            return result.error;
          }}
          onSell={() => {
            const result = manualSellAll(portfolio, marketData?.price ?? NaN);
            if (!result.error) setPortfolio(result.portfolio);
            return result.error;
          }}
        />
      </div>
      </> : <FuturesPaperPanel portfolio={portfolio} price={marketData?.price ?? null}
        autonomousEnabled={futuresAutonomousEnabled} onAutonomousChange={(enabled) => { futuresAutoLastSeen.current = null; setFuturesAutonomousEnabled(enabled); }}
        strategyId={automation.strategyId} onStrategyChange={(strategyId) => { futuresAutoLastSeen.current = null; setAutomation((current) => ({ ...current, strategyId })); }}
        onOpen={(input) => { const result = openFutures(portfolio, { ...input, price: marketData?.price ?? NaN }); if (!result.error) setPortfolio(result.portfolio); return result.error; }}
        onClose={() => setPortfolio((current) => closeFutures(current, marketData?.price ?? NaN, new Date().toISOString(), true))} />}
      <div className="primary-grid">
        <MarketPanel
          data={marketData}
          error={marketError}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
        />
        <ReadOnlyWalletPanel />
      </div>
      <div className="secondary-grid">
        <RecentTrades trades={portfolio.trades} />
        <ActivityLog
          activity={portfolio.activity.slice(0, 15)}
          isLoading={!hydrated}
        />
      </div>
      <PerformanceAnalyticsPanel analytics={analytics} />
      <aside className="product-clarity">
        <strong>Simulation boundary</strong>
        <span>
          Automation entries require a new closed candle. Turning automation off
          blocks strategy entries and exits, while stop-loss and take-profit
          monitoring remains active. On restart Veyrix evaluates only the latest
          safe closed candle; it never replays a backlog. Connected wallet funds
          never enter the paper account.
        </span>
      </aside>
    </>
  );
}
