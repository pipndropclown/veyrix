import { futuresPnl } from "../trading/futuresEngine.ts";
import { unifiedTradeHistory } from "../trading/tradeHistory.ts";
import type { EquityPoint } from "@/types/analytics";
import type { PaperAgent, PaperLabState } from "@/types/agents";
import type { MarketId } from "@/lib/market/marketRegistry";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
export interface AgentPerformance {
  agentId: string; totalTrades: number; completedTrades: number; winningTrades: number; losingTrades: number;
  winRate: number | null; grossProfit: number; grossLoss: number; netRealizedPnl: number; unrealizedPnl: number; totalPnl: number;
  averageWin: number | null; averageLoss: number | null; largestWin: number | null; largestLoss: number | null;
  profitFactor: number | null; expectancy: number | null; maximumDrawdown: number; currentWinLossStreak: number;
  averageHoldingTimeMs: number | null; allocatedCapital: number; futuresMargin: number; returnOnAllocatedCapital: number | null;
  returnOnMargin: number | null; equityCurve: EquityPoint[]; score: number | null; scoreStatus: "READY" | "INSUFFICIENT DATA";
}
export function calculateAgentPerformance(agentId: string, state: PaperLabState, prices: Partial<Record<MarketId, number>>): AgentPerformance {
  const all = unifiedTradeHistory(state.portfolio).filter(t => t.source === "AUTONOMOUS" && "agentId" in t && t.agentId === agentId);
  const closed = all.filter(t => t.status === "CLOSED" && finite(t.realizedPnl) && t.exitTimestamp && Number.isFinite(Date.parse(t.exitTimestamp)))
    .sort((a, b) => Date.parse(a.exitTimestamp!) - Date.parse(b.exitTimestamp!) || a.id.localeCompare(b.id));
  const open = all.filter(t => t.status === "OPEN");
  const pnls = closed.map(t => t.realizedPnl!);
  const wins = pnls.filter(p => p > 0), losses = pnls.filter(p => p < 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0), grossLoss = -losses.reduce((a, b) => a + b, 0);
  const netRealizedPnl = pnls.reduce((a, b) => a + b, 0);
  const unrealizedPnl = open.reduce((sum, t) => {
    const price = prices[t.marketId as MarketId] ?? t.entryPrice;
    if (t.mode === "FUTURES") return sum + Math.max(-t.marginUsdc!, futuresPnl(t as never, price));
    return sum + (price - t.entryPrice) * t.quantity;
  }, 0);
  const equityCurve: EquityPoint[] = [];
  let equity = 0, peak = 0, maximumDrawdown = 0;
  for (const trade of closed) {
    equity += trade.realizedPnl!; peak = Math.max(peak, equity);
    maximumDrawdown = Math.max(maximumDrawdown, peak - equity);
    equityCurve.push({ timestamp: trade.exitTimestamp!, equity, tradeId: trade.id });
  }
  const amounts = closed.map(t => t.mode === "FUTURES" ? t.marginUsdc! : t.amountUsdc);
  const allocatedCapital = amounts.reduce((a, b) => a + b, 0);
  const averageWin = wins.length ? grossProfit / wins.length : null;
  const averageLoss = losses.length ? -grossLoss / losses.length : null;
  const expectancy = closed.length ? netRealizedPnl / closed.length : null;
  let streak = 0;
  for (let i = pnls.length - 1; i >= 0; i--) {
    if (pnls[i] === 0 || (streak > 0 && pnls[i] < 0) || (streak < 0 && pnls[i] > 0)) break;
    streak += pnls[i] > 0 ? 1 : -1;
  }
  const durations = closed.flatMap(t => { const d = Date.parse(t.exitTimestamp!) - Date.parse(t.entryTimestamp); return Number.isFinite(d) && d >= 0 ? [d] : []; });
  const sufficient = closed.length >= 5;
  let score: number | null = null;
  if (sufficient) {
    const allocatedReturn = allocatedCapital ? netRealizedPnl / allocatedCapital : 0;
    const r = Math.min(100, Math.max(0, 50 + allocatedReturn * 500));
    const d = Math.min(100, Math.max(0, 100 - (allocatedCapital ? maximumDrawdown / (allocatedCapital / closed.length) * 100 : 0)));
    const p = grossLoss ? Math.min(100, grossProfit / grossLoss * 50) : grossProfit ? 100 : 0;
    const e = Math.min(100, Math.max(0, 50 + (allocatedCapital ? expectancy! / (allocatedCapital / closed.length) * 1000 : 0)));
    const n = Math.min(100, closed.length / 20 * 100);
    score = Math.round(r * .25 + d * .25 + p * .2 + e * .2 + n * .1);
  }
  const margins = closed.filter(t => t.mode === "FUTURES").reduce((sum, t) => sum + t.marginUsdc!, 0);
  return { agentId, totalTrades: all.length, completedTrades: closed.length, winningTrades: wins.length, losingTrades: losses.length,
    winRate: closed.length ? wins.length / closed.length * 100 : null, grossProfit, grossLoss, netRealizedPnl, unrealizedPnl, totalPnl: netRealizedPnl + unrealizedPnl,
    averageWin, averageLoss, largestWin: wins.length ? Math.max(...wins) : null, largestLoss: losses.length ? Math.min(...losses) : null,
    profitFactor: grossLoss ? grossProfit / grossLoss : null, expectancy, maximumDrawdown, currentWinLossStreak: streak,
    averageHoldingTimeMs: durations.length === closed.length && closed.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    allocatedCapital, futuresMargin: margins, returnOnAllocatedCapital: allocatedCapital ? netRealizedPnl / allocatedCapital * 100 : null,
    returnOnMargin: margins ? pnls.filter((_, i) => closed[i].mode === "FUTURES").reduce((a, b) => a + b, 0) / margins * 100 : null,
    equityCurve, score, scoreStatus: sufficient ? "READY" : "INSUFFICIENT DATA" };
}
export function allAgentProfiles(state: PaperLabState): PaperAgent[] { return [...state.agents.agents, ...state.agents.archived]; }
export function aggregateAgentPerformance(state: PaperLabState, prices: Partial<Record<MarketId, number>>) {
  const profiles = allAgentProfiles(state).map(agent => ({ agent, performance: calculateAgentPerformance(agent.id, state, prices) }));
  const active = state.agents.agents.filter(a => a.enabled);
  const totalAuto = unifiedTradeHistory(state.portfolio).filter(t => t.source === "AUTONOMOUS");
  const performed = profiles.filter(x => x.performance.completedTrades > 0);
  const worstDrawdown = profiles.reduce((max, x) => Math.max(max, x.performance.maximumDrawdown), 0);
  const capitalDeployed = Object.values(state.portfolio.spotPositions ?? {}).reduce((sum, p) => sum + (p ? p.quantity * p.averageEntryPrice : 0), 0)
    + (state.portfolio.futuresTrades ?? []).filter(t => t.status === "OPEN").reduce((sum, t) => sum + t.marginUsdc, 0);
  return { activeAgents: active.length, totalAutonomousTrades: totalAuto.length, combinedRealizedPnl: profiles.reduce((s, x) => s + x.performance.netRealizedPnl, 0),
    combinedUnrealizedPnl: profiles.reduce((s, x) => s + x.performance.unrealizedPnl, 0), bestAgent: performed.sort((a, b) => b.performance.netRealizedPnl - a.performance.netRealizedPnl)[0]?.agent ?? null,
    worstDrawdown, capitalDeployed, profiles };
}
