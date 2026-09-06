import { paperTradingConfig } from "./tradingConfig.ts";
import type { PaperTrade, TradeExitReason } from "@/types/trading";

export interface PositionRiskLevels {
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

export interface RiskEvaluation extends PositionRiskLevels {
  shouldExit: boolean;
  reason: Extract<TradeExitReason, "STOP_LOSS" | "TAKE_PROFIT"> | null;
  triggerPrice: number | null;
  currentPrice: number;
}

export function calculatePositionRisk(entryPrice: number, config: Readonly<{ stopLossPercent: number; takeProfitPercent: number }> = paperTradingConfig): PositionRiskLevels | null {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  if (!Number.isFinite(config.stopLossPercent) || config.stopLossPercent < 0 || config.stopLossPercent >= 100 || !Number.isFinite(config.takeProfitPercent) || config.takeProfitPercent < 0) return null;
  return {
    entryPrice,
    stopLossPrice: entryPrice * (1 - config.stopLossPercent / 100),
    takeProfitPrice: entryPrice * (1 + config.takeProfitPercent / 100),
  };
}

export function evaluatePositionRisk(openTrade: PaperTrade, currentPrice: number, config: Readonly<{ stopLossPercent: number; takeProfitPercent: number }> = paperTradingConfig): RiskEvaluation | null {
  const levels = calculatePositionRisk(openTrade.entryPrice, config);
  if (!levels || openTrade.status !== "OPEN" || !Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  if (currentPrice <= levels.stopLossPrice) {
    return { ...levels, shouldExit: true, reason: "STOP_LOSS", triggerPrice: levels.stopLossPrice, currentPrice };
  }
  if (currentPrice >= levels.takeProfitPrice) {
    return { ...levels, shouldExit: true, reason: "TAKE_PROFIT", triggerPrice: levels.takeProfitPrice, currentPrice };
  }
  return { ...levels, shouldExit: false, reason: null, triggerPrice: null, currentPrice };
}
