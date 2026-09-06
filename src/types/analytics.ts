export interface AnalyticsTrade {
  id: string;
  status: "OPEN" | "CLOSED";
  entryTimestamp: string;
  exitTimestamp: string | null;
  positionSizeUsdc: number;
  realizedPnl: number | null;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  tradeId: string | null;
}

export interface DrawdownPoint extends EquityPoint {
  runningPeak: number;
  drawdownDollars: number;
  drawdownPercent: number;
}

export interface PerformanceAnalytics {
  startingBalance: number;
  currentPortfolioValue: number;
  netProfit: number;
  totalReturnPercent: number;
  realizedPnl: number;
  unrealizedPnl: number;
  completedTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number | null;
  lossRate: number | null;
  averageWinningTrade: number | null;
  averageLosingTrade: number | null;
  largestWinningTrade: number | null;
  largestLosingTrade: number | null;
  averagePnlPerTrade: number | null;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  expectancyDollars: number | null;
  /** Dollar expectancy divided by average capital allocated per completed trade. */
  expectancyPercent: number | null;
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  currentDrawdownDollars: number;
  currentDrawdownPercent: number;
  maximumDrawdownDollars: number;
  maximumDrawdownPercent: number;
  currentWinningStreak: number;
  currentLosingStreak: number;
  longestWinningStreak: number;
  longestLosingStreak: number;
  averageWinLossRatio: number | null;
  averageHoldingDurationMs: number | null;
  longestHoldingDurationMs: number | null;
  shortestHoldingDurationMs: number | null;
}
