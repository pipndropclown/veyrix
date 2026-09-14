import { paperTradingConfig } from "./tradingConfig.ts";
import { futuresPnl } from "./futuresEngine.ts";
import type { ActivityItem } from "@/types";
import type { FuturesTrade, PaperPortfolioMetrics, PaperPortfolioState, PaperTrade } from "@/types/trading";

const MAX_EXECUTION_IDS = 200;
const MAX_ACTIVITY_ITEMS = 50;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function nonNegative(value: unknown): value is number { return finite(value) && value >= 0; }

export function localTradingDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTrade(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const trade = value as Record<string, unknown>;
  return {
    ...trade,
    exitReason: trade.exitReason !== undefined ? trade.exitReason : trade.status === "CLOSED" ? "STRATEGY_SIGNAL" : null,
    source: trade.source === "MANUAL" ? "MANUAL" : "AUTONOMOUS",
    strategyId: trade.source === "MANUAL" ? null : (trade.strategyId ?? "momentum"),
    strategyName: trade.source === "MANUAL" ? null : (trade.strategyName ?? "Momentum Agent"),
    automationTimeframe: trade.automationTimeframe ?? null,
    signalCandleTimestamp: trade.signalCandleTimestamp ?? trade.entryTimestamp,
    marketType: "SPOT",
  };
}

function isTrade(value: unknown): value is PaperTrade {
  if (!value || typeof value !== "object") return false;
  const trade = value as Partial<PaperTrade>;
  const validExitReason = trade.exitReason === null || trade.exitReason === "STOP_LOSS" || trade.exitReason === "TAKE_PROFIT" || trade.exitReason === "STRATEGY_SIGNAL";
  return typeof trade.id === "string" && typeof trade.executionId === "string" && trade.pair === "SOL/USDC" && trade.side === "BUY"
    && typeof trade.entryTimestamp === "string" && Number.isFinite(Date.parse(trade.entryTimestamp))
    && (trade.exitTimestamp === null || (typeof trade.exitTimestamp === "string" && Number.isFinite(Date.parse(trade.exitTimestamp))))
    && finite(trade.entryPrice) && trade.entryPrice > 0
    && (trade.exitPrice === null || (finite(trade.exitPrice) && trade.exitPrice > 0))
    && nonNegative(trade.solQuantity) && nonNegative(trade.positionSizeUsdc)
    && (trade.exitValueUsdc === null || nonNegative(trade.exitValueUsdc))
    && (trade.realizedPnl === null || finite(trade.realizedPnl))
    && (trade.pnlPercent === null || finite(trade.pnlPercent))
    && trade.strategySignal === "BUY" && nonNegative(trade.confidence) && trade.confidence <= 100
    && typeof trade.strategyReason === "string" && (trade.status === "OPEN" || trade.status === "CLOSED")
    && validExitReason && (trade.status === "OPEN" ? trade.exitReason === null : trade.exitReason !== null);
}

function isActivity(value: unknown): value is ActivityItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ActivityItem>;
  return typeof item.id === "string" && typeof item.time === "string" && typeof item.title === "string" && typeof item.description === "string" && ["signal", "analysis", "trade", "system"].includes(item.type ?? "");
}

function realizedPnlForDay(trades: PaperTrade[], futuresTrades: FuturesTrade[], tradingDay: string): number {
  const spot = trades.reduce((total, trade) => {
    if (trade.status !== "CLOSED" || !trade.exitTimestamp || localTradingDay(new Date(trade.exitTimestamp)) !== tradingDay) return total;
    return total + (trade.realizedPnl ?? 0);
  }, 0);
  return spot + futuresTrades.reduce((total, trade) => trade.status === "CLOSED" && trade.exitTimestamp && localTradingDay(new Date(trade.exitTimestamp)) === tradingDay ? total + (trade.realizedPnl ?? 0) : total, 0);
}

export function dailyLossLimitUsd(): number {
  return paperTradingConfig.startingBalanceUsd * (paperTradingConfig.maxDailyLossPercent / 100);
}

export function createInitialPaperPortfolio(tradingDay = localTradingDay(new Date())): PaperPortfolioState {
  return { version: 1, availableUsdc: paperTradingConfig.startingBalanceUsd, solBalance: 0, averageSolEntryPrice: null, realizedPnl: 0, completedTrades: 0, winningTrades: 0, losingTrades: 0, trades: [], futuresTrades: [], futuresProcessedCandleIds: [], processedEvaluationIds: [], activity: [], tradingDay, dailyRealizedPnl: 0, tradingPausedForDay: false };
}

export function restorePaperPortfolio(value: unknown, currentDay = localTradingDay(new Date())): PaperPortfolioState {
  if (!value || typeof value !== "object") return createInitialPaperPortfolio(currentDay);
  const raw = value as Partial<PaperPortfolioState>;
  const trades = Array.isArray(raw.trades) ? raw.trades.map(normalizeTrade) : [];
  const validPosition = nonNegative(raw.solBalance) && (raw.solBalance === 0 ? raw.averageSolEntryPrice === null : finite(raw.averageSolEntryPrice) && raw.averageSolEntryPrice > 0);
  if (raw.version !== 1 || !nonNegative(raw.availableUsdc) || !validPosition || !finite(raw.realizedPnl)
    || !Number.isInteger(raw.completedTrades) || (raw.completedTrades ?? -1) < 0
    || !Number.isInteger(raw.winningTrades) || (raw.winningTrades ?? -1) < 0
    || !Number.isInteger(raw.losingTrades) || (raw.losingTrades ?? -1) < 0
    || !trades.every(isTrade)
    || !Array.isArray(raw.processedEvaluationIds) || !raw.processedEvaluationIds.every((id) => typeof id === "string")
    || !Array.isArray(raw.activity) || !raw.activity.every(isActivity)) return createInitialPaperPortfolio(currentDay);

  const typedTrades = trades as PaperTrade[];
  const futuresTrades = Array.isArray(raw.futuresTrades) && raw.futuresTrades.every((trade) =>
    trade && typeof trade.id === "string" && ["LONG", "SHORT"].includes(trade.side) && [1, 2, 3, 5].includes(trade.leverage)
    && finite(trade.marginUsdc) && trade.marginUsdc > 0 && finite(trade.entryPrice) && trade.entryPrice > 0
    && finite(trade.quantitySol) && trade.quantitySol > 0 && ["OPEN", "CLOSED"].includes(trade.status))
    && raw.futuresTrades.filter((trade) => trade.status === "OPEN").length <= 1 ? raw.futuresTrades : [];
  const openTrades = typedTrades.filter((trade) => trade.status === "OPEN");
  const closedTrades = typedTrades.filter((trade) => trade.status === "CLOSED");
  const wins = closedTrades.filter((trade) => (trade.realizedPnl ?? 0) > 0).length;
  const losses = closedTrades.filter((trade) => (trade.realizedPnl ?? 0) < 0).length;
  const solBalance = nonNegative(raw.solBalance) ? raw.solBalance : 0;
  const openTrade = openTrades[0];
  const positionMatches = !openTrade || (Math.abs(openTrade.solQuantity - solBalance) < 1e-10 && openTrade.entryPrice === raw.averageSolEntryPrice);
  if (openTrades.length > paperTradingConfig.maxOpenPositions || (solBalance === 0) !== (openTrades.length === 0) || !positionMatches
    || raw.completedTrades !== closedTrades.length || raw.winningTrades !== wins || raw.losingTrades !== losses) return createInitialPaperPortfolio(currentDay);

  const storedDay = typeof raw.tradingDay === "string" && DAY_PATTERN.test(raw.tradingDay) ? raw.tradingDay : currentDay;
  const derivedDailyPnl = realizedPnlForDay(typedTrades, futuresTrades, storedDay);
  const hasValidDailyState = finite(raw.dailyRealizedPnl) && Math.abs(raw.dailyRealizedPnl - derivedDailyPnl) < 1e-8 && typeof raw.tradingPausedForDay === "boolean";
  return {
    ...(raw as PaperPortfolioState),
    trades: typedTrades,
    futuresTrades,
    futuresProcessedCandleIds: Array.isArray(raw.futuresProcessedCandleIds) ? raw.futuresProcessedCandleIds.filter((id): id is string => typeof id === "string").slice(-200) : [],
    processedEvaluationIds: raw.processedEvaluationIds.slice(-MAX_EXECUTION_IDS),
    activity: raw.activity.slice(0, MAX_ACTIVITY_ITEMS),
    tradingDay: storedDay,
    dailyRealizedPnl: hasValidDailyState ? raw.dailyRealizedPnl as number : derivedDailyPnl,
    tradingPausedForDay: hasValidDailyState ? raw.tradingPausedForDay as boolean : derivedDailyPnl <= -dailyLossLimitUsd(),
  };
}

export function calculatePortfolioMetrics(state: PaperPortfolioState, marketPrice: number | null): PaperPortfolioMetrics {
  const candidate = finite(marketPrice) && marketPrice > 0 ? marketPrice : null;
  const usablePrice = candidate !== null && Number.isFinite(state.solBalance * candidate) ? candidate : null;
  const markPrice = usablePrice ?? state.averageSolEntryPrice ?? 0;
  const solPositionValue = state.solBalance * markPrice;
  const costBasis = state.solBalance * (state.averageSolEntryPrice ?? 0);
  const unrealizedPnl = state.solBalance > 0 ? solPositionValue - costBasis : 0;
  const openFutures = (state.futuresTrades ?? []).filter((trade) => trade.status === "OPEN");
  const futuresMarginInUse = openFutures.reduce((sum, trade) => sum + trade.marginUsdc, 0);
  const futuresExposure = openFutures.reduce((sum, trade) => sum + trade.exposureUsdc, 0);
  const futuresUnrealizedPnl = openFutures.reduce((sum, trade) => sum + Math.max(-trade.marginUsdc, futuresPnl(trade, usablePrice ?? trade.entryPrice)), 0);
  const totalPortfolioValue = state.availableUsdc + solPositionValue + futuresMarginInUse + futuresUnrealizedPnl;
  const lossLimit = dailyLossLimitUsd();
  return {
    state: state.solBalance > 0 ? "LONG" : "FLAT", startingBalance: paperTradingConfig.startingBalanceUsd,
    availableUsdc: state.availableUsdc, solBalance: state.solBalance, averageSolEntryPrice: state.averageSolEntryPrice,
    currentPrice: usablePrice, solPositionValue, unrealizedPnl, unrealizedPnlPercent: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0,
    realizedPnl: state.realizedPnl, totalPortfolioValue, futuresMarginInUse, futuresExposure, futuresUnrealizedPnl,
    totalReturnPercent: ((totalPortfolioValue - paperTradingConfig.startingBalanceUsd) / paperTradingConfig.startingBalanceUsd) * 100,
    completedTrades: state.completedTrades, winningTrades: state.winningTrades, losingTrades: state.losingTrades,
    winRate: state.completedTrades > 0 ? (state.winningTrades / state.completedTrades) * 100 : 0,
    tradingDay: state.tradingDay, dailyRealizedPnl: state.dailyRealizedPnl, dailyLossLimit: lossLimit,
    dailyLossRemaining: Math.max(0, lossLimit - Math.max(0, -state.dailyRealizedPnl)), tradingPausedForDay: state.tradingPausedForDay,
  };
}

export function appendActivity(state: PaperPortfolioState, events: ActivityItem[]): ActivityItem[] { return [...events, ...state.activity].slice(0, MAX_ACTIVITY_ITEMS); }
export function appendExecutionId(state: PaperPortfolioState, executionId: string): string[] { return [...state.processedEvaluationIds, executionId].slice(-MAX_EXECUTION_IDS); }
