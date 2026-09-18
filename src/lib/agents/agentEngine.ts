import { closedCandles } from "../market/liveCandles.ts";
import { getStrategy } from "../strategy/strategyRegistry.ts";
import { closeFuturesMarket, openFutures } from "../trading/futuresEngine.ts";
import { closeMarketSpot, openMarketSpot } from "../trading/multiMarketSpotEngine.ts";
import type { HistoricalCandle } from "@/types/backtesting";
import type { AgentEvent, PaperLabState } from "@/types/agents";
import type { MarketId } from "@/lib/market/marketRegistry";
import type { LiveTimeframe } from "@/types/liveTrading";

export type CandleDatasets = ReadonlyMap<string, readonly HistoricalCandle[]>;
export const candleGroupKey = (marketId: MarketId, timeframe: LiveTimeframe) => `${marketId}:${timeframe}`;
export function groupEnabledAgents(agents: PaperLabState["agents"]["agents"]) {
  return [...new Set(agents.filter(a => a.enabled).map(a => candleGroupKey(a.marketId, a.timeframe)))].sort();
}
export function agentCandleId(agent: { id: string; marketId: MarketId; mode: string; strategyId: string; timeframe: LiveTimeframe }, timestamp: string) {
  return `${agent.id}:${agent.marketId}:${agent.mode}:${agent.strategyId}:${agent.timeframe}:${new Date(timestamp).toISOString()}`;
}

function recordEvent(state: PaperLabState, agentId: string, event: AgentEvent) {
  const agent = state.agents.agents.find(a => a.id === agentId),name = agent?.name ?? "Deleted agent";
  const portfolio = { ...state.portfolio, activity: [{ id: `agent:${agentId}:${event.candleId}`, agentId, agentName: name, time: event.timestamp, title: `${name} ${agent?.marketId ?? ""} ${agent?.timeframe ?? ""} ${event.action}`.trim(), description: `${event.signal ?? "HOLD"} signal; closed candle ${event.candleId.split(":").at(-1)}`, type: event.action.includes("opened") || event.action.includes("closed") ? "trade" as const : "signal" as const }, ...state.portfolio.activity].slice(0, 50) };
  return { ...state, portfolio, agents: { ...state.agents, agents: state.agents.agents.map(a => a.id === agentId ? { ...a, lastEvaluation: event.timestamp, lastSignal: event.signal, lastAction: event.action, processedCandleIds: [...a.processedCandleIds, event.candleId].slice(-500), recentEvents: [...a.recentEvents, event].slice(-30) } : a) } };
}
function riskMonitor(state: PaperLabState, prices: Partial<Record<MarketId, number>>, now: string) {
  let portfolio = state.portfolio;
  for (const marketId of ["BTC", "ETH", "SOL"] as const) {
    const price = prices[marketId];
    if (!Number.isFinite(price) || price! <= 0) continue;
    portfolio = closeMarketSpot(portfolio, marketId, price!, now, false);
    portfolio = closeFuturesMarket(portfolio, marketId, price!, now, false);
  }
  return { ...state, portfolio };
}

/** One ordered batch shares each fetched dataset and the just-updated capital balance. */
export function evaluateAgentBatch(input: { state: PaperLabState; candles: CandleDatasets; prices: Partial<Record<MarketId, number>>; now: number }) {
  const timestamp = new Date(input.now).toISOString();
  let state = riskMonitor(input.state, input.prices, timestamp);
  const outcomes: { agentId: string; outcome: string }[] = [];
  const ordered = state.agents.agents.filter(a => a.enabled).slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  for (const snapshot of ordered) {
    const agent = state.agents.agents.find(a => a.id === snapshot.id);
    if (!agent?.enabled) continue;
    const data = input.candles.get(candleGroupKey(agent.marketId, agent.timeframe));
    if (!data?.length) continue;
    const latest = closedCandles(data, agent.timeframe, input.now).at(-1);
    if (!latest) continue;
    const id = agentCandleId(agent, latest.timestamp);
    if (agent.processedCandleIds.includes(id)) { outcomes.push({ agentId: agent.id, outcome: "DUPLICATE" }); continue; }
    const decision = getStrategy(agent.strategyId).evaluate(closedCandles(data, agent.timeframe, input.now).map(c => ({ timestamp: c.timestamp, price: c.close })));
    const history = agent.mode === "SPOT" ? [...(state.portfolio.multiMarketSpotTrades ?? []), ...state.portfolio.trades.filter(t=>t.status==="OPEN").map(t=>({...t,marketId:"SOL",agentId:undefined}))] : state.portfolio.futuresTrades ?? [];
    const own = history.find(t => t.status === "OPEN" && (t.marketId ?? "SOL") === agent.marketId && "agentId" in t && t.agentId === agent.id && !("agentDetached" in t && t.agentDetached));
    const occupied = history.find(t => t.status === "OPEN" && (t.marketId ?? "SOL") === agent.marketId);
    let action = "NO ACTION";
    const wantsEntry = agent.mode === "SPOT" ? decision.signal === "BUY" : decision.signal !== "HOLD";
    if (own) {
      const exits = agent.mode === "SPOT" ? decision.signal === "SELL" : (own as { side: "LONG" | "SHORT" }).side === "LONG" ? decision.signal === "SELL" : decision.signal === "BUY";
      if (exits) {
        state = { ...state, portfolio: agent.mode === "SPOT" ? closeMarketSpot(state.portfolio, agent.marketId, latest.close, timestamp) : closeFuturesMarket(state.portfolio, agent.marketId, latest.close, timestamp, true) };
        action = `${agent.marketId} ${agent.mode} position closed`;
      }
    } else if (wantsEntry && occupied) {
      action = "ENTRY SKIPPED — POSITION ALREADY OPEN";
    } else if (wantsEntry) {
      const requested = agent.allocation.unit === "USDC" ? agent.allocation.value : state.portfolio.availableUsdc * agent.allocation.value / 100;
      if (!Number.isFinite(requested) || requested <= 0 || requested > state.portfolio.availableUsdc) {
        action = "ENTRY SKIPPED — INSUFFICIENT VIRTUAL CAPITAL";
      } else if (state.portfolio.tradingPausedForDay) {
        action = "ENTRY SKIPPED — DAILY LOSS LIMIT";
      } else if (agent.mode === "SPOT") {
        const result = openMarketSpot(state.portfolio, { marketId: agent.marketId, amountUsdc: requested, price: latest.close, source: "AUTONOMOUS", timestamp, stopLoss: agent.stopLossPercent ? latest.close * (1 - agent.stopLossPercent / 100) : null, takeProfit: agent.takeProfitPercent ? latest.close * (1 + agent.takeProfitPercent / 100) : null, agentId: agent.id, agentName: agent.name });
        state = { ...state, portfolio: result.portfolio };
        action = result.error ? "ENTRY SKIPPED — POSITION ALREADY OPEN" : `${agent.marketId} Spot position opened`;
      } else {
        const side = decision.signal === "BUY" ? "LONG" : "SHORT";
        const result = openFutures(state.portfolio, { marketId: agent.marketId, side, leverage: agent.leverage, marginUsdc: requested, price: latest.close, source: "AUTONOMOUS", timestamp, stopLoss: agent.stopLossPercent ? latest.close * (side === "LONG" ? 1 - agent.stopLossPercent / 100 : 1 + agent.stopLossPercent / 100) : null, takeProfit: agent.takeProfitPercent ? latest.close * (side === "LONG" ? 1 + agent.takeProfitPercent / 100 : 1 - agent.takeProfitPercent / 100) : null, agentId: agent.id, agentName: agent.name });
        state = { ...state, portfolio: result.portfolio };
        action = result.error ? result.error.includes("position") ? "ENTRY SKIPPED — POSITION ALREADY OPEN" : "ENTRY SKIPPED — INSUFFICIENT VIRTUAL CAPITAL" : `${agent.marketId} Futures ${side} opened`;
      }
    }
    state = recordEvent(state, agent.id, { timestamp, candleId: id, signal: decision.signal, action });
    outcomes.push({ agentId: agent.id, outcome: action });
  }
  return { state, outcomes };
}
