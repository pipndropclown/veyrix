import type { ActivityItem, Signal } from "@/types";
import type { LiveTimeframe } from "./liveTrading";
import type { StrategyId } from "./strategy";

export interface PaperTradingConfig {
  startingBalanceUsd: number;
  positionSizePercent: number;
  maxOpenPositions: number;
  allowShortSelling: false;
  allowLeverage: false;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxDailyLossPercent: number;
}

export type TradeExitReason = "STOP_LOSS" | "TAKE_PROFIT" | "STRATEGY_SIGNAL";
export type PaperTradeSource = "MANUAL" | "AUTONOMOUS";

export interface PaperTrade {
  id: string;
  executionId: string;
  pair: "SOL/USDC";
  side: "BUY";
  entryTimestamp: string;
  exitTimestamp: string | null;
  entryPrice: number;
  exitPrice: number | null;
  solQuantity: number;
  positionSizeUsdc: number;
  exitValueUsdc: number | null;
  realizedPnl: number | null;
  pnlPercent: number | null;
  strategySignal: "BUY";
  confidence: number;
  strategyReason: string;
  status: "OPEN" | "CLOSED";
  exitReason: TradeExitReason | null;
  source?: PaperTradeSource;
  strategyId?: StrategyId | null;
  strategyName?: string | null;
  automationTimeframe?: LiveTimeframe | null;
  signalCandleTimestamp?: string | null;
  marketType?: "SPOT";
}

export interface PaperPortfolioState {
  version: 1;
  availableUsdc: number;
  solBalance: number;
  averageSolEntryPrice: number | null;
  realizedPnl: number;
  completedTrades: number;
  winningTrades: number;
  losingTrades: number;
  trades: PaperTrade[];
  processedEvaluationIds: string[];
  activity: ActivityItem[];
  tradingDay: string;
  dailyRealizedPnl: number;
  tradingPausedForDay: boolean;
}

export interface PaperPortfolioMetrics {
  state: "FLAT" | "LONG";
  startingBalance: number;
  availableUsdc: number;
  solBalance: number;
  averageSolEntryPrice: number | null;
  currentPrice: number | null;
  solPositionValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  totalPortfolioValue: number;
  totalReturnPercent: number;
  completedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  tradingDay: string;
  dailyRealizedPnl: number;
  dailyLossLimit: number;
  dailyLossRemaining: number;
  tradingPausedForDay: boolean;
}

export interface PaperEvaluation {
  observationTimestamp: string;
  price: number;
  signal: Signal;
  confidence: number;
  reason: string;
  tradingDay: string;
  executionId?: string;
  source?: PaperTradeSource;
  strategyId?: StrategyId | null;
  strategyName?: string | null;
  automationTimeframe?: LiveTimeframe | null;
  signalCandleTimestamp?: string | null;
}

export interface PaperEngineResult {
  portfolio: PaperPortfolioState;
  outcome: "EXECUTED" | "SKIPPED" | "NO_ACTION" | "DUPLICATE";
  executionId: string;
}
