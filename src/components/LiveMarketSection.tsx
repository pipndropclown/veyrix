"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityLog } from "./ActivityLog";
import { AutomationControlPanel } from "./AutomationControlPanel";
import { LiveCandlestickChart } from "./LiveCandlestickChart";
import { FuturesPaperPanel } from "./FuturesPaperPanel";
import { closeFuturesMarket, openFutures } from "@/lib/trading/futuresEngine";
import { MultiMarketSpotPanel } from "./MultiMarketSpotPanel";
import { OpenPositionsSummary } from "./OpenPositionsSummary";
import { closeMarketSpot,openMarketSpot } from "@/lib/trading/multiMarketSpotEngine";
import { MARKET_IDS,MARKET_REGISTRY,type MarketId } from "@/lib/market/marketRegistry";
import { evaluateMultiMarketAutomation } from "@/lib/trading/multiMarketAutomation";
import { MarketPanel } from "./MarketPanel";
import { PerformanceAnalyticsPanel } from "./PerformanceAnalyticsPanel";
import { MultiMarketPortfolioOverview } from "./MultiMarketPortfolioOverview";
import { AssetBreakdown } from "./AssetBreakdown";
import { MultiMarketHistory } from "./MultiMarketHistory";
import { ReadOnlyWalletPanel } from "./ReadOnlyWalletPanel";
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
  restoreAutomationSettings,
} from "@/lib/trading/automationEngine";
import { calculateMultiMarketAccount } from "@/lib/trading/accountMetrics";
import { unifiedTradeHistory } from "@/lib/trading/tradeHistory";
import {
  calculatePortfolioMetrics,
  createInitialPaperPortfolio,
  restorePaperPortfolio,
} from "@/lib/trading/paperPortfolio";
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
  const [selectedMarket,setSelectedMarket]=useState<MarketId>("SOL");
  const [marketData, setMarketData] = useState<MarketData | null>(null),
    [marketPrices,setMarketPrices]=useState<Partial<Record<MarketId,number>>>({}),
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
  const view = useRef({market:selectedMarket,timeframe:chartTimeframe});
  useEffect(()=>{view.current={market:selectedMarket,timeframe:chartTimeframe}},[selectedMarket,chartTimeframe]);
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
      const response = await fetch(`/api/market?symbol=${selectedMarket}`, { cache: "no-store" }),
        payload = (await response.json()) as MarketApiResponse;
      if (!response.ok || !payload.success) throw new Error();
      if(view.current.market!==selectedMarket)return;
      setPortfolio((current) => {
        const spot = current;
        return closeMarketSpot(closeFuturesMarket(spot,selectedMarket,payload.data.price,payload.data.lastUpdated),selectedMarket,payload.data.price,payload.data.lastUpdated,false);
      });
      setMarketPrices(current=>({...current,[selectedMarket]:payload.data.price}));
      setMarketData(payload.data);
      setMarketError(null);
    } catch {
      if(view.current.market===selectedMarket){setMarketData(null);setMarketError("Market data temporarily unavailable");}
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedMarket]);
  const fetchCandles = useCallback(
    async (timeframe: LiveTimeframe, marketId:MarketId=selectedMarket, updateChart=true) => {
      try {
        const response = await fetch(`/api/candles?symbol=${marketId}&timeframe=${timeframe}`, {
            cache: "no-store",
          }),
          payload = (await response.json()) as LiveCandleApiResponse;
        if (!response.ok || !payload.success) throw new Error();
        if (updateChart && timeframe === view.current.timeframe && marketId===view.current.market) {
          setCandles(payload.data.candles);
          setCandleError(null);
          setCandleLoading(false);
        }
        return payload.data.candles;
      } catch {
        if (updateChart && timeframe === view.current.timeframe && marketId===view.current.market) {
          setCandleError(
            "Chart candles are temporarily unavailable. Veyrix will retry.",
          );
          setCandleLoading(false);
        }
        return null;
      }
    },
    [selectedMarket],
  );
  useEffect(() => {
    if (!hydrated) return;
    const initial = window.setTimeout(() => void fetchMarket(), 0);
    const id = setInterval(() => void fetchMarket(true), MARKET_REFRESH_MS);
    return () => { window.clearTimeout(initial); clearInterval(id); };
  }, [fetchMarket, hydrated]);
  useEffect(()=>{if(!hydrated)return;const refresh=async()=>{const needed=new Set<MarketId>([...Object.keys(portfolio.spotPositions??{}) as MarketId[],...(portfolio.futuresTrades??[]).filter(t=>t.status==="OPEN").map(t=>t.marketId??"SOL"),automation.enabled?(automation.marketId??"SOL"):selectedMarket]);needed.delete(selectedMarket);await Promise.all([...needed].map(async marketId=>{try{const response=await fetch(`/api/market?symbol=${marketId}`,{cache:"no-store"}),payload=await response.json() as MarketApiResponse;if(response.ok&&payload.success){setMarketPrices(current=>({...current,[marketId]:payload.data.price}));setPortfolio(current=>closeMarketSpot(closeFuturesMarket(current,marketId,payload.data.price,payload.data.lastUpdated),marketId,payload.data.price,payload.data.lastUpdated,false))}}catch{}}))};const initial=window.setTimeout(()=>void refresh(),0),id=window.setInterval(()=>void refresh(),MARKET_REFRESH_MS);return()=>{clearTimeout(initial);clearInterval(id)}},[hydrated,portfolio.spotPositions,portfolio.futuresTrades,automation.enabled,automation.marketId,selectedMarket]);
  useEffect(() => {
    const initial = window.setTimeout(() => void fetchCandles(chartTimeframe), 0);
    const id = setInterval(
      () => void fetchCandles(chartTimeframe),
      LIVE_TIMEFRAMES[chartTimeframe].refreshMs,
    );
    return () => { window.clearTimeout(initial); clearInterval(id); };
  }, [chartTimeframe, fetchCandles]);
  useEffect(() => {
    if (!hydrated) return;
    const settings = automation;
    let cancelled=false;
    const evaluate = async () => {
      if (automationBusy.current) return;
      automationBusy.current = true;
      try {
        const data =
          await fetchCandles(settings.timeframe,settings.marketId??"SOL",false);
        if (cancelled || !data?.length) return;
        setPortfolio((current) => {
          const result = evaluateMultiMarketAutomation({
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
    return () => {cancelled=true;clearInterval(id)};
  }, [
    automation,
    chartTimeframe,
    fetchCandles,
    hydrated,
    selectedMarket,
  ]);
  const activeMarketData = marketData?.marketId===selectedMarket ? marketData : null;
  const marketPrice = activeMarketData?.price ?? null;
  const account = calculateMultiMarketAccount(portfolio,marketPrices);
  const metrics = calculatePortfolioMetrics(portfolio, marketPrices.SOL??null);
  const activeSpotTrade=(portfolio.multiMarketSpotTrades??[]).find(t=>t.marketId===selectedMarket&&t.status==="OPEN");
  const risk=activeSpotTrade&&activeSpotTrade.stopLoss!==null&&activeSpotTrade.takeProfit!==null?{entryPrice:activeSpotTrade.entryPrice,stopLossPrice:activeSpotTrade.stopLoss,takeProfitPrice:activeSpotTrade.takeProfit}:null;
  const analytics = calculatePerformanceAnalytics({
    startingBalance: metrics.startingBalance,
    currentPortfolioValue: account.totalVirtualEquity,
    unrealizedPnl: account.totalUnrealizedPnl,
    trades: unifiedTradeHistory(portfolio).map(t=>({...t,positionSizeUsdc:t.amountUsdc})),
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
          title={MARKET_REGISTRY[selectedMarket].displaySymbol}
          action={<span className="paper-only-chip">PAPER TRADING ONLY</span>}
        />
        <p className="guest-mode-note">Guest mode — your paper trading data is saved on this device. <a href="/auth/sign-up">Create an account to sync</a>.</p>
        <div className="period-selector" role="group" aria-label="Market selector">{MARKET_IDS.map(id=><button type="button" key={id} className={selectedMarket===id?"selected":""} onClick={()=>{setCandles([]);setCandleLoading(true);setSelectedMarket(id)}}>{MARKET_REGISTRY[id].displaySymbol}</button>)}</div>
        <small>Coinbase reference feed: {MARKET_REGISTRY[selectedMarket].providerDisplayPair} · paper settlement: virtual USDC</small>
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
            ["PAPER POSITION", portfolio.spotPositions?.[selectedMarket] ? `LONG ${selectedMarket}` : "FLAT"],
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
            marketLabel={selectedMarket}
            candles={candles}
            mode={chartMode}
            trades={[...(portfolio.multiMarketSpotTrades??[]).filter(trade=>trade.marketId===selectedMarket),...(portfolio.futuresTrades??[]).filter(trade=>(trade.marketId??"SOL")===selectedMarket)]}
            risk={tradingMode==="SPOT"?risk:null}
            currentPrice={marketPrice ?? candles.at(-1)?.close ?? null}
          />
        )}
        <small className="chart-source">
          Coinbase Exchange {MARKET_REGISTRY[selectedMarket].providerDisplayPair} public OHLC · latest candle may still be forming ·
          automation evaluates closed candles only
        </small>
      </section>
      <OpenPositionsSummary portfolio={portfolio} onSelect={(marketId,mode)=>{setCandles([]);setCandleLoading(true);setSelectedMarket(marketId);setTradingMode(mode)}}/>
      <MultiMarketPortfolioOverview portfolio={portfolio} prices={marketPrices} onReset={reset} />
      <AssetBreakdown portfolio={portfolio} prices={marketPrices} />
      {tradingMode==="SPOT"&&<RiskManagementPanel metrics={metrics} levels={risk} />}
      <div className="terminal-control-grid">
        <AutomationControlPanel
          settings={automation}
          status={automationStatus}
          position={portfolio.spotPositions?.[automation.marketId??"SOL"]?"LONG":"FLAT"}
          onChange={changeAutomation}
        />
        {tradingMode==="SPOT"?<MultiMarketSpotPanel key={selectedMarket} marketId={selectedMarket} portfolio={portfolio} price={marketPrice} onBuy={(input)=>{const result=openMarketSpot(portfolio,{marketId:selectedMarket,...input,price:marketPrice??NaN});if(!result.error)setPortfolio(result.portfolio);return result.error}} onSell={()=>setPortfolio(current=>closeMarketSpot(current,selectedMarket,marketPrice??NaN))}/>:<FuturesPaperPanel key={selectedMarket} prices={marketPrices} marketId={selectedMarket} portfolio={portfolio} price={marketPrice}
        autonomousEnabled={automation.enabled&&(automation.marketId??"SOL")===selectedMarket&&(automation.tradingMode??"SPOT")==="FUTURES"} onAutonomousChange={(enabled) => setAutomation(current=>({...current,enabled,marketId:selectedMarket,tradingMode:"FUTURES"}))}
        strategyId={automation.strategyId} onStrategyChange={(strategyId) => setAutomation((current) => ({ ...current, strategyId }))}
        onOpen={(input) => { const result = openFutures(portfolio, { ...input,marketId:selectedMarket, price: marketPrice ?? NaN }); if (!result.error) setPortfolio(result.portfolio); return result.error; }}
        onClose={() => setPortfolio((current) => closeFuturesMarket(current,selectedMarket, marketPrice ?? NaN, new Date().toISOString(), true))} />}
      </div>
      <div className="primary-grid">
        <MarketPanel
          data={activeMarketData}
          error={marketError}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
        />
        <ReadOnlyWalletPanel />
      </div>
      <div className="secondary-grid">
        <MultiMarketHistory portfolio={portfolio} />
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
