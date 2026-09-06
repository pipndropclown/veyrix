import type { AnalyticsTrade, DrawdownPoint, EquityPoint, PerformanceAnalytics } from "@/types/analytics";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

interface ValidTrade { id: string; pnl: number; entryMs: number | null; exitMs: number; positionSize: number | null; }

function validClosedTrades(trades: readonly unknown[]): ValidTrade[] {
  return trades.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const trade = value as Partial<AnalyticsTrade>;
    const exitMs = typeof trade.exitTimestamp === "string" ? Date.parse(trade.exitTimestamp) : Number.NaN;
    if (trade.status !== "CLOSED" || typeof trade.id !== "string" || !finite(trade.realizedPnl) || !Number.isFinite(exitMs)) return [];
    const entryMs = typeof trade.entryTimestamp === "string" ? Date.parse(trade.entryTimestamp) : Number.NaN;
    return [{ id: trade.id, pnl: trade.realizedPnl, entryMs: Number.isFinite(entryMs) && entryMs <= exitMs ? entryMs : null, exitMs, positionSize: finite(trade.positionSizeUsdc) && trade.positionSizeUsdc > 0 ? trade.positionSizeUsdc : null }];
  }).sort((left, right) => left.exitMs - right.exitMs || left.id.localeCompare(right.id));
}

export function buildEquityCurve(startingBalance: number, trades: readonly unknown[], startTimestamp?: string): EquityPoint[] {
  const safeStart = finite(startingBalance) && startingBalance >= 0 ? startingBalance : 0;
  const closed = validClosedTrades(trades);
  const requestedStart = startTimestamp ? Date.parse(startTimestamp) : Number.NaN;
  const firstTime = Number.isFinite(requestedStart) ? requestedStart : (closed[0]?.entryMs ?? closed[0]?.exitMs ?? 0);
  let equity = safeStart;
  return [{ timestamp: new Date(firstTime).toISOString(), equity, tradeId: null }, ...closed.map((trade) => {
    equity += trade.pnl;
    return { timestamp: new Date(trade.exitMs).toISOString(), equity, tradeId: trade.id };
  })];
}

export function calculateDrawdown(equityCurve: readonly EquityPoint[]): { curve: DrawdownPoint[]; currentDollars: number; currentPercent: number; maximumDollars: number; maximumPercent: number } {
  let peak = 0;
  let maximumDollars = 0;
  let maximumPercent = 0;
  const curve = equityCurve.flatMap((point) => {
    if (!finite(point.equity) || point.equity < 0 || !Number.isFinite(Date.parse(point.timestamp))) return [];
    peak = Math.max(peak, point.equity);
    const drawdownDollars = Math.max(0, peak - point.equity);
    const drawdownPercent = peak > 0 ? (drawdownDollars / peak) * 100 : 0;
    maximumDollars = Math.max(maximumDollars, drawdownDollars);
    maximumPercent = Math.max(maximumPercent, drawdownPercent);
    return [{ ...point, runningPeak: peak, drawdownDollars, drawdownPercent }];
  });
  const current = curve.at(-1);
  return { curve, currentDollars: current?.drawdownDollars ?? 0, currentPercent: current?.drawdownPercent ?? 0, maximumDollars, maximumPercent };
}

export function calculatePerformanceAnalytics(input: { startingBalance: number; currentPortfolioValue: number; unrealizedPnl: number; trades: readonly unknown[]; startTimestamp?: string }): PerformanceAnalytics {
  const startingBalance = finite(input.startingBalance) && input.startingBalance >= 0 ? input.startingBalance : 0;
  const currentPortfolioValue = finite(input.currentPortfolioValue) && input.currentPortfolioValue >= 0 ? input.currentPortfolioValue : startingBalance;
  const unrealizedPnl = finite(input.unrealizedPnl) ? input.unrealizedPnl : 0;
  const trades = validClosedTrades(Array.isArray(input.trades) ? input.trades : []);
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const breakEvenTrades = trades.length - wins.length - losses.length;
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const realizedPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const averageWin = wins.length ? grossProfit / wins.length : null;
  const averageLoss = losses.length ? -grossLoss / losses.length : null;
  const winRateFraction = trades.length ? wins.length / trades.length : null;
  const lossRateFraction = trades.length ? losses.length / trades.length : null;
  const expectancyDollars = winRateFraction === null || lossRateFraction === null ? null : winRateFraction * (averageWin ?? 0) - lossRateFraction * Math.abs(averageLoss ?? 0);
  const allocations = trades.flatMap((trade) => trade.positionSize === null ? [] : [trade.positionSize]);
  const averageAllocation = allocations.length === trades.length && trades.length ? allocations.reduce((sum, value) => sum + value, 0) / allocations.length : null;
  const durations = trades.flatMap((trade) => trade.entryMs === null ? [] : [trade.exitMs - trade.entryMs]);
  let currentWinningStreak = 0, currentLosingStreak = 0, longestWinningStreak = 0, longestLosingStreak = 0;
  for (const trade of trades) {
    if (trade.pnl > 0) { currentWinningStreak += 1; currentLosingStreak = 0; longestWinningStreak = Math.max(longestWinningStreak, currentWinningStreak); }
    else if (trade.pnl < 0) { currentLosingStreak += 1; currentWinningStreak = 0; longestLosingStreak = Math.max(longestLosingStreak, currentLosingStreak); }
    else { currentWinningStreak = 0; currentLosingStreak = 0; }
  }
  const equityCurve = buildEquityCurve(startingBalance, input.trades, input.startTimestamp);
  const drawdown = calculateDrawdown(equityCurve);
  return {
    startingBalance, currentPortfolioValue, netProfit: currentPortfolioValue - startingBalance,
    totalReturnPercent: startingBalance > 0 ? ((currentPortfolioValue - startingBalance) / startingBalance) * 100 : 0,
    realizedPnl, unrealizedPnl, completedTrades: trades.length, winningTrades: wins.length, losingTrades: losses.length, breakEvenTrades,
    winRate: trades.length ? (wins.length / trades.length) * 100 : null, lossRate: trades.length ? (losses.length / trades.length) * 100 : null,
    averageWinningTrade: averageWin, averageLosingTrade: averageLoss, largestWinningTrade: wins.length ? Math.max(...wins.map((trade) => trade.pnl)) : null,
    largestLosingTrade: losses.length ? Math.min(...losses.map((trade) => trade.pnl)) : null, averagePnlPerTrade: trades.length ? realizedPnl / trades.length : null,
    grossProfit, grossLoss, profitFactor: trades.length && grossLoss > 0 ? grossProfit / grossLoss : null,
    expectancyDollars, expectancyPercent: expectancyDollars !== null && averageAllocation ? (expectancyDollars / averageAllocation) * 100 : null,
    equityCurve, drawdownCurve: drawdown.curve, currentDrawdownDollars: drawdown.currentDollars, currentDrawdownPercent: drawdown.currentPercent,
    maximumDrawdownDollars: drawdown.maximumDollars, maximumDrawdownPercent: drawdown.maximumPercent,
    currentWinningStreak, currentLosingStreak, longestWinningStreak, longestLosingStreak,
    averageWinLossRatio: averageWin !== null && averageLoss !== null && averageLoss !== 0 ? averageWin / Math.abs(averageLoss) : null,
    averageHoldingDurationMs: durations.length === trades.length && trades.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    longestHoldingDurationMs: durations.length === trades.length && trades.length ? Math.max(...durations) : null,
    shortestHoldingDurationMs: durations.length === trades.length && trades.length ? Math.min(...durations) : null,
  };
}
