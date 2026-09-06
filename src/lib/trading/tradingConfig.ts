import type { PaperTradingConfig } from "@/types/trading";

export const PAPER_PORTFOLIO_STORAGE_KEY = "veyrix.paper-portfolio.v1";

export const paperTradingConfig: Readonly<PaperTradingConfig> = {
  startingBalanceUsd: 10_000,
  positionSizePercent: 10,
  maxOpenPositions: 1,
  allowShortSelling: false,
  allowLeverage: false,
  stopLossPercent: 2,
  takeProfitPercent: 4,
  maxDailyLossPercent: 3,
};
