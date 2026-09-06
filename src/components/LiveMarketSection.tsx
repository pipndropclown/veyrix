"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityLog } from "./ActivityLog";
import { AutomationControlPanel } from "./AutomationControlPanel";
import { LiveCandlestickChart } from "./LiveCandlestickChart";
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
  useEffect(() => {
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
    void fetchMarket();
    const id = setInterval(() => void fetchMarket(true), MARKET_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchMarket]);
  useEffect(() => {
    setCandleLoading(true);
    void fetchCandles(chartTimeframe);
    const id = setInterval(
      () => void fetchCandles(chartTimeframe),
      LIVE_TIMEFRAMES[chartTimeframe].refreshMs,
    );
    return () => clearInterval(id);
  }, [chartTimeframe, fetchCandles]);
  useEffect(() => {
    if (!hydrated) return;
    const evaluate = async () => {
      if (automationBusy.current) return;
      automationBusy.current = true;
      try {
        const data =
          automation.timeframe === chartTimeframe
            ? candles
            : await fetchCandles(automation.timeframe);
        if (!data?.length) return;
        setPortfolio((current) => {
          const result = evaluateAutomation({
            portfolio: current,
            settings: automation,
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
      Math.min(30000, LIVE_TIMEFRAMES[automation.timeframe].refreshMs),
    );
    return () => clearInterval(id);
  }, [
    automation.enabled,
    automation.strategyId,
    automation.timeframe,
    candles,
    chartTimeframe,
    fetchCandles,
    hydrated,
  ]);
  useEffect(() => {
    if (!hydrated || !marketData) return;
    setPortfolio((current) =>
      current.solBalance > 0
        ? monitorPaperRisk(current, marketData.price, marketData.lastUpdated)
            .portfolio
        : current,
    );
  }, [hydrated, marketData]);
  const metrics = useMemo(
      () => calculatePortfolioMetrics(portfolio, marketData?.price ?? null),
      [portfolio, marketData?.price],
    ),
    risk = useMemo(
      () =>
        portfolio.averageSolEntryPrice === null
          ? null
          : calculatePositionRisk(portfolio.averageSolEntryPrice),
      [portfolio.averageSolEntryPrice],
    ),
    analytics = useMemo(
      () =>
        calculatePerformanceAnalytics({
          startingBalance: metrics.startingBalance,
          currentPortfolioValue: metrics.totalPortfolioValue,
          unrealizedPnl: metrics.unrealizedPnl,
          trades: portfolio.trades,
        }),
      [metrics, portfolio.trades],
    );
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
                onClick={() => setChartTimeframe(id)}
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
      <RiskManagementPanel metrics={metrics} levels={risk} />
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
