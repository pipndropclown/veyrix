import type { EquityPoint, PerformanceAnalytics } from "./analytics";
import type { MomentumStrategyConfig } from "./strategy";
import type { GenericStrategyResult,StrategyDefinition,StrategyId } from "./strategy";
import type { PaperTradingConfig, TradeExitReason } from "./trading";

export type BacktestTimeframe = "7D" | "14D" | "30D" | "60D" | "90D" | "180D" | "365D";
export type CandleInterval = "1 hour" | "6 hours";
export type IntrabarCollisionPolicy = "STOP_FIRST" | "TARGET_FIRST";
export interface HistoricalCandle { timestamp:string; open:number; high:number; low:number; close:number; volume:number; price:number; }
export interface HistoricalDataQuality{expectedApproximateCandles:number;actualValidCandles:number;missingIntervalCount:number;duplicateCountRemoved:number;invalidCandleCountRemoved:number;firstTimestamp:string|null;lastTimestamp:string|null;coveragePercent:number}
export interface HistoricalDataSet { source:"Coinbase Exchange"; sourcePair:"SOL-USD"; interval:CandleInterval; timeframe:BacktestTimeframe; fetchedAt:string; observations:HistoricalCandle[];quality:HistoricalDataQuality; }
export interface BacktestRiskConfig { stopLossPercent:number; takeProfitPercent:number; }
export interface BacktestExecutionConfig { feePercentPerSide:number; slippagePercent:number; collisionPolicy:IntrabarCollisionPolicy; }
export interface BacktestConfig { strategy:Readonly<MomentumStrategyConfig>; paperTrading:Readonly<PaperTradingConfig>; risk:Readonly<BacktestRiskConfig>; execution?:Readonly<BacktestExecutionConfig>; }
export interface BacktestTrade {
  id:string; executionId:string; pair:"SOL/USDC"; side:"BUY"; entryTimestamp:string; exitTimestamp:string|null;
  idealEntryPrice:number; executedEntryPrice:number; idealExitPrice:number|null; executedExitPrice:number|null;
  entryPrice:number; exitPrice:number|null; solQuantity:number; positionSizeUsdc:number; exitValueUsdc:number|null;
  entryFeeUsd:number; exitFeeUsd:number; totalFeesUsd:number; estimatedSlippageCostUsd:number; grossPnl:number|null;
  realizedPnl:number|null; pnlPercent:number|null; strategySignal:"BUY"; confidence:number; strategyReason:string;
  status:"OPEN"|"CLOSED"; exitReason:TradeExitReason|null;
}
export interface BacktestCostSummary { grossPnl:number; grossProfit:number; grossLoss:number; totalFees:number; estimatedSlippageCost:number; netPnl:number; }
export interface BenchmarkResult {
  initialBalance:number; finalBalance:number; netProfit:number; totalReturnPercent:number; maximumDrawdownDollars:number; maximumDrawdownPercent:number;
  firstPrice:number|null; lastPrice:number|null; quantity:number; entryFeeUsd:number; exitFeeUsd:number; estimatedSlippageCostUsd:number; equityCurve:EquityPoint[];
}
export interface BacktestResult {
  label:"BACKTEST"; periodStart:string|null; periodEnd:string|null; initialBalance:number; finalBalance:number; finalCashBalance:number; finalPositionValue:number;
  trades:BacktestTrade[]; analytics:PerformanceAnalytics; costs:BacktestCostSummary; benchmark:BenchmarkResult; strategyAlphaPercent:number;
  strategyEquityCurve:EquityPoint[];
  processedObservations:number; ignoredObservations:number; openPosition:boolean;
  strategyId:StrategyId;strategyName:string;latestDecision:GenericStrategyResult;
  matchedBenchmark:BenchmarkResult;returnVsFullSolPercent:number;returnVsMatchedExposurePercent:number;
}
export interface BacktestRequest{candles:readonly HistoricalCandle[];strategy:StrategyDefinition;config:Readonly<BacktestConfig>;normalized?:boolean}
export interface StrategyComparisonEntry{strategy:StrategyDefinition;result:BacktestResult;score:number}
export interface StrategyComparisonResult{entries:StrategyComparisonEntry[];benchmark:BenchmarkResult;matchedBenchmark:BenchmarkResult;winners:{highestReturn:StrategyId|null;lowestDrawdown:StrategyId|null;highestProfitFactor:StrategyId|null;highestExpectancy:StrategyId|null};shared:{candleCount:number;timeframe:string;startingBalance:number;feePercentPerSide:number;slippagePercent:number;stopLossPercent:number;takeProfitPercent:number;collisionPolicy:IntrabarCollisionPolicy};errors:Partial<Record<StrategyId,string>>}
export type HistoricalApiResponse={success:true;data:HistoricalDataSet}|{success:false;error:string};
