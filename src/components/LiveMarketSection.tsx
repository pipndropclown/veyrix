"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityLog } from "./ActivityLog";
import { AgentDashboard } from "./AgentDashboard";
import { LiveCandlestickChart } from "./LiveCandlestickChart";
import { FuturesPaperPanel } from "./FuturesPaperPanel";
import { closeFuturesMarket, openFutures } from "@/lib/trading/futuresEngine";
import { MultiMarketSpotPanel } from "./MultiMarketSpotPanel";
import { OpenPositionsSummary } from "./OpenPositionsSummary";
import { closeMarketSpot,openMarketSpot } from "@/lib/trading/multiMarketSpotEngine";
import { MARKET_IDS,MARKET_REGISTRY,type MarketId } from "@/lib/market/marketRegistry";
import { MarketPanel } from "./MarketPanel";
import { PerformanceAnalyticsPanel } from "./PerformanceAnalyticsPanel";
import { MultiMarketPortfolioOverview } from "./MultiMarketPortfolioOverview";
import { AssetBreakdown } from "./AssetBreakdown";
import { MultiMarketHistory } from "./MultiMarketHistory";
import { ReadOnlyWalletPanel } from "./ReadOnlyWalletPanel";
import { RiskManagementPanel } from "./RiskManagementPanel";
import { SectionHeader } from "./SectionHeader";
import { calculatePerformanceAnalytics } from "@/lib/analytics/performanceAnalytics";
import { LIVE_TIMEFRAMES, LIVE_TIMEFRAME_IDS } from "@/lib/market/liveCandles";
import { AUTOMATION_STORAGE_KEY } from "@/lib/trading/automationEngine";
import { calculateMultiMarketAccount } from "@/lib/trading/accountMetrics";
import { unifiedTradeHistory } from "@/lib/trading/tradeHistory";
import {
  calculatePortfolioMetrics,
  createInitialPaperPortfolio,
} from "@/lib/trading/paperPortfolio";
import { PAPER_PORTFOLIO_STORAGE_KEY } from "@/lib/trading/tradingConfig";
import type { MarketApiResponse, MarketData } from "@/types/market";
import type {
  ChartMode,
  LiveCandleApiResponse,
  LiveTimeframe,
} from "@/types/liveTrading";
import type { HistoricalCandle } from "@/types/backtesting";
import type { PaperPortfolioState } from "@/types/trading";
import type { AgentConfig, PaperLabState } from "@/types/agents";
import { emptyAgentStore, createAgent, setAgentEnabled, editAgent, deleteAgent } from "@/lib/agents/agentModel";
import { restorePaperLab, serializePaperLab } from "@/lib/agents/agentPersistence";
import { AGENT_STORAGE_KEY } from "@/lib/agents/agentModel";
import { claimPaperController } from "@/lib/agents/browserController";
import { fetchSharedCandles, fetchSharedMarket } from "@/lib/agents/candleScheduler";
import { candleGroupKey, evaluateAgentBatch, groupEnabledAgents } from "@/lib/agents/agentEngine";
export function LiveMarketSection() {
  const [tradingMode, setTradingMode] = useState<"SPOT" | "FUTURES">("SPOT");
  const [selectedMarket,setSelectedMarket]=useState<MarketId>("SOL");
  const [marketData, setMarketData] = useState<MarketData | null>(null),
    [marketPrices,setMarketPrices]=useState<Partial<Record<MarketId,number>>>({}),
    [marketError, setMarketError] = useState<string | null>(null),
    [isLoading, setIsLoading] = useState(true),
    [isRefreshing, setIsRefreshing] = useState(false);
  const [portfolio,setPortfolio]=useState<PaperPortfolioState>(createInitialPaperPortfolio),[agentStore,setAgentStore]=useState(emptyAgentStore()),[controllerAvailable,setControllerAvailable]=useState(false),[agentError,setAgentError]=useState<string|null>(null),[hydrated,setHydrated]=useState(false);
  const [chartTimeframe,setChartTimeframe]=useState<LiveTimeframe>("15m"),[chartMode,setChartMode]=useState<ChartMode>("CANDLESTICK"),[candles,setCandles]=useState<HistoricalCandle[]>([]),[candleError,setCandleError]=useState<string|null>(null),[candleLoading,setCandleLoading]=useState(true);
  const labRef=useRef<PaperLabState>({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()}),controllerRef=useRef<ReturnType<typeof claimPaperController>|null>(null),schedulerBusy=useRef(false),view=useRef({market:selectedMarket,timeframe:chartTimeframe});
  useEffect(()=>{view.current={market:selectedMarket,timeframe:chartTimeframe}},[selectedMarket,chartTimeframe]);
  const commitLab=useCallback((next:PaperLabState)=>{const lease=controllerRef.current;if(!lease?.owns()||agentError)return false;try{localStorage.setItem(AGENT_STORAGE_KEY,JSON.stringify(next.agents));localStorage.setItem(PAPER_PORTFOLIO_STORAGE_KEY,serializePaperLab(next));}catch{setAgentError("Paper account storage is full or unavailable. Trading is paused until the saved account can be checked.");return false;}labRef.current=next;setPortfolio(next.portfolio);setAgentStore(next.agents);return true},[agentError]);
  useEffect(()=>{
    let live=true,lease:ReturnType<typeof claimPaperController>|null=null,heartbeat=0;
    const start=window.setTimeout(()=>{
      lease=claimPaperController(localStorage);controllerRef.current=lease;setControllerAvailable(lease.owns());
      try{const pv=localStorage.getItem(PAPER_PORTFOLIO_STORAGE_KEY),av=localStorage.getItem(AGENT_STORAGE_KEY),legacy=localStorage.getItem(AUTOMATION_STORAGE_KEY),restored=restorePaperLab({portfolioValue:pv?JSON.parse(pv):null,agentValue:av?JSON.parse(av):null,legacyAutomation:legacy?JSON.parse(legacy):null});if(!live)return;labRef.current=restored.state;setPortfolio(restored.state.portfolio);setAgentStore(restored.state.agents);setAgentError(restored.error);setHydrated(true);if(!restored.error&&lease.owns()&&(!pv||!restored.state.agents.migratedV13)){localStorage.setItem(PAPER_PORTFOLIO_STORAGE_KEY,serializePaperLab(restored.state));localStorage.setItem(AGENT_STORAGE_KEY,JSON.stringify(restored.state.agents));}}
      catch{if(live){setAgentError("Saved paper account could not be restored. Existing browser data has been preserved.");setHydrated(true)}}
      heartbeat=window.setInterval(()=>setControllerAvailable(Boolean(lease?.owns())),1000);
    },0);
    const onStorage=(event:StorageEvent)=>{if(event.key!==PAPER_PORTFOLIO_STORAGE_KEY||!event.newValue)return;try{const restored=restorePaperLab({portfolioValue:JSON.parse(event.newValue)});labRef.current=restored.state;setPortfolio(restored.state.portfolio);setAgentStore(restored.state.agents);}catch{setAgentError("Paper account changed in another tab but could not be restored.")}};
    window.addEventListener("storage",onStorage);
    return()=>{live=false;clearTimeout(start);if(heartbeat)clearInterval(heartbeat);window.removeEventListener("storage",onStorage);lease?.release();controllerRef.current=null};
  },[]);  const fetchCandles=useCallback(async(timeframe:LiveTimeframe,marketId:MarketId=selectedMarket,updateChart=true)=>{try{const data=await fetchSharedCandles(marketId,timeframe,async()=>{const r=await fetch(`/api/candles?symbol=${marketId}&timeframe=${timeframe}`,{cache:"no-store"});return await r.json() as LiveCandleApiResponse});if(updateChart&&timeframe===view.current.timeframe&&marketId===view.current.market){setCandles(data);setCandleError(null);setCandleLoading(false)}return data}catch{if(updateChart&&timeframe===view.current.timeframe&&marketId===view.current.market){setCandleError("Chart candles are temporarily unavailable. Veyrix will retry.");setCandleLoading(false)}return null}},[selectedMarket]);
  useEffect(()=>{if(!hydrated||agentError||!controllerAvailable)return;let stopped=false;const tick=async()=>{if(schedulerBusy.current||!controllerRef.current?.owns())return;schedulerBusy.current=true;try{const current=labRef.current,agentGroups=groupEnabledAgents(current.agents.agents),groups=[...new Set([...agentGroups,candleGroupKey(view.current.market,view.current.timeframe)])],markets=new Set<MarketId>([view.current.market,...current.agents.agents.filter(a=>a.enabled).map(a=>a.marketId),...Object.keys(current.portfolio.spotPositions??{}) as MarketId[],...(current.portfolio.futuresTrades??[]).filter(t=>t.status==="OPEN").map(t=>t.marketId??"SOL")]),[candleResults,priceResults]=await Promise.all([Promise.all(groups.map(async key=>{const [market,timeframe]=key.split(":") as [MarketId,LiveTimeframe];return [key,await fetchCandles(timeframe,market,key===candleGroupKey(view.current.market,view.current.timeframe))] as const})),Promise.all([...markets].map(async market=>{try{return [market,await fetchSharedMarket(market,async()=>{const r=await fetch(`/api/market?symbol=${market}`,{cache:"no-store"}),p=await r.json() as MarketApiResponse;if(!r.ok||!p.success)throw new Error("Market unavailable");return p.data})] as const}catch{return null}}))]),data=new Map(candleResults.flatMap(([key,c])=>c?[[key,c] as const]:[])),quotes=Object.fromEntries(priceResults.filter((x):x is NonNullable<typeof x>=>x!==null).map(([id,d])=>[id,d.price])) as Partial<Record<MarketId,number>>;if(stopped)return;setMarketPrices(old=>({...old,...quotes}));const selected=priceResults.find(x=>x?.[0]===view.current.market);if(selected){setMarketData(selected[1]);setMarketError(null)}else setMarketError("Market data temporarily unavailable");setIsLoading(false);setIsRefreshing(false);if(controllerRef.current?.owns()){const result=evaluateAgentBatch({state:labRef.current,candles:data,prices:quotes,now:Date.now()});if(serializePaperLab(result.state)!==serializePaperLab(labRef.current))commitLab(result.state)}}catch{setIsLoading(false);setIsRefreshing(false)}finally{schedulerBusy.current=false}};void tick();const timer=window.setInterval(()=>void tick(),5000);return()=>{stopped=true;clearInterval(timer)}},[hydrated,controllerAvailable,agentError,agentStore,selectedMarket,chartTimeframe,fetchCandles,commitLab]);
  useEffect(()=>{if(!hydrated)return;const initial=window.setTimeout(()=>void fetchCandles(chartTimeframe),0);const timer=window.setInterval(()=>void fetchCandles(chartTimeframe),LIVE_TIMEFRAMES[chartTimeframe].refreshMs);return()=>{clearTimeout(initial);clearInterval(timer)}},[hydrated,chartTimeframe,fetchCandles]);  const activeMarketData = marketData?.marketId===selectedMarket ? marketData : null;
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
  const reset = () => {
      if (!controllerAvailable||agentError) return;
      if (
        !confirm(
          "Reset the paper account to $10,000 virtual USDC and erase all simulated trades?",
        )
      )
        return;
      const next={portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()};
      if(commitLab(next))localStorage.removeItem(AUTOMATION_STORAGE_KEY);
    },
    lastAction =
      portfolio.activity.find((item) => item.type === "trade")?.title ??
      "Waiting";
  // Local dates and persisted account state must not differ from prerendered HTML.
  if (!hydrated) {
    return <section className="terminal-section" role="status">Loading paper trading terminal...</section>;
  }
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
            ["RUNNING AGENTS", String(agentStore.agents.filter(agent=>agent.enabled).length)],
            ["AGENTS", String(agentStore.agents.length)],
            ["PAPER POSITION", portfolio.spotPositions?.[selectedMarket] ? `LONG ${selectedMarket}` : "FLAT"],
            ["LAST ACTION", lastAction],
            ["PAPER MODE", "SIMULATED"],
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
          agents evaluate closed candles only
        </small>
      </section>
      <OpenPositionsSummary portfolio={portfolio} onSelect={(marketId,mode)=>{setCandles([]);setCandleLoading(true);setSelectedMarket(marketId);setTradingMode(mode)}}/>
      <MultiMarketPortfolioOverview portfolio={portfolio} prices={marketPrices} onReset={reset} />
      <AssetBreakdown portfolio={portfolio} prices={marketPrices} />
      {tradingMode==="SPOT"&&<RiskManagementPanel metrics={metrics} levels={risk} />}
      <AgentDashboard state={{portfolio,agents:agentStore}} prices={marketPrices} controllerAvailable={controllerAvailable&&!agentError} error={agentError} onCreate={(config:AgentConfig)=>{const next={...labRef.current,agents:createAgent(labRef.current.agents,config,crypto.randomUUID(),new Date().toISOString(),false,labRef.current.portfolio.availableUsdc)};commitLab(next)}} onEdit={(id,config)=>commitLab(editAgent(labRef.current,id,config,labRef.current.portfolio.availableUsdc))} onToggle={(id,enabled)=>commitLab({...labRef.current,agents:setAgentEnabled(labRef.current.agents,id,enabled)})} onDelete={(id,leave)=>commitLab(deleteAgent(labRef.current,id,leave))} onReset={reset}/>
      <div className="terminal-control-grid">
        {tradingMode==="SPOT"?<MultiMarketSpotPanel key={selectedMarket} marketId={selectedMarket} portfolio={portfolio} price={marketPrice} onBuy={(input)=>{if(!controllerAvailable||agentError)return "Paper account is read-only in this tab.";const result=openMarketSpot(labRef.current.portfolio,{marketId:selectedMarket,...input,price:marketPrice??NaN});if(!result.error)commitLab({...labRef.current,portfolio:result.portfolio});return result.error}} onSell={()=>{if(controllerAvailable&&!agentError)commitLab({...labRef.current,portfolio:closeMarketSpot(labRef.current.portfolio,selectedMarket,marketPrice??NaN)})}}/>:<FuturesPaperPanel key={selectedMarket} prices={marketPrices} marketId={selectedMarket} portfolio={portfolio} price={marketPrice}
        onOpen={(input) => { if(!controllerAvailable||agentError)return "Paper account is read-only in this tab.";const result = openFutures(labRef.current.portfolio, { ...input,marketId:selectedMarket, price: marketPrice ?? NaN }); if (!result.error) commitLab({...labRef.current,portfolio:result.portfolio}); return result.error; }}
        onClose={() => {if(controllerAvailable&&!agentError)commitLab({...labRef.current,portfolio:closeFuturesMarket(labRef.current.portfolio,selectedMarket, marketPrice ?? NaN, new Date().toISOString(), true)})}} />}
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
