import { calculateDrawdown } from "../analytics/performanceAnalytics.ts";
import { normalizeHistoricalCandles } from "./marketCandles.ts";
import { sanitizeExecutionConfig,simulateLongEntry,simulateLongExit } from "./executionModel.ts";
import type { BacktestExecutionConfig,BenchmarkResult,HistoricalCandle } from "@/types/backtesting";
import type { EquityPoint } from "@/types/analytics";
export function runBuyAndHoldBenchmark(input:readonly HistoricalCandle[],initialBalance:number,execution?:Readonly<BacktestExecutionConfig>):BenchmarkResult{
  const candles=normalizeHistoricalCandles(input).candles,safeInitial=Number.isFinite(initialBalance)&&initialBalance>=0?initialBalance:0,config=sanitizeExecutionConfig(execution),first=candles[0],last=candles.at(-1);
  const empty={initialBalance:safeInitial,finalBalance:safeInitial,netProfit:0,totalReturnPercent:0,maximumDrawdownDollars:0,maximumDrawdownPercent:0,firstPrice:null,lastPrice:null,quantity:0,entryFeeUsd:0,exitFeeUsd:0,estimatedSlippageCostUsd:0,equityCurve:[]};
  if(!first||!last||safeInitial<=0)return empty;const entry=simulateLongEntry(safeInitial,first.close,config);if(!entry)return empty;
  const baseline:EquityPoint={timestamp:first.timestamp,equity:safeInitial,tradeId:null};
  const curve:EquityPoint[]=[baseline,...candles.map(candle=>{const exit=simulateLongExit(entry.quantity,candle.close,config);return{timestamp:candle.timestamp,equity:exit?.netProceeds??0,tradeId:null}})];
  const finalExit=simulateLongExit(entry.quantity,last.close,config);if(!finalExit)return empty;const drawdown=calculateDrawdown(curve),finalBalance=finalExit.netProceeds;
  return{initialBalance:safeInitial,finalBalance,netProfit:finalBalance-safeInitial,totalReturnPercent:safeInitial>0?(finalBalance-safeInitial)/safeInitial*100:0,maximumDrawdownDollars:drawdown.maximumDollars,maximumDrawdownPercent:drawdown.maximumPercent,firstPrice:first.close,lastPrice:last.close,quantity:entry.quantity,entryFeeUsd:entry.fee,exitFeeUsd:finalExit.fee,estimatedSlippageCostUsd:entry.slippageCost+finalExit.slippageCost,equityCurve:curve};
}
export function calculateReturnDifference(strategyReturnPercent:number,benchmarkReturnPercent:number):number{return Number.isFinite(strategyReturnPercent)&&Number.isFinite(benchmarkReturnPercent)?strategyReturnPercent-benchmarkReturnPercent:0}
export function runExposureMatchedBenchmark(input:readonly HistoricalCandle[],initialBalance:number,allocationPercent:number,execution?:Readonly<BacktestExecutionConfig>):BenchmarkResult{
 const safeInitial=Number.isFinite(initialBalance)&&initialBalance>=0?initialBalance:0,percent=Number.isFinite(allocationPercent)?Math.min(100,Math.max(0,allocationPercent)):0,allocation=safeInitial*percent/100,cash=safeInitial-allocation;
 const invested=runBuyAndHoldBenchmark(input,allocation,execution);return{...invested,initialBalance:safeInitial,finalBalance:cash+invested.finalBalance,netProfit:invested.netProfit,totalReturnPercent:safeInitial>0?invested.netProfit/safeInitial*100:0,equityCurve:invested.equityCurve.map(point=>({...point,equity:cash+point.equity})),maximumDrawdownDollars:invested.maximumDrawdownDollars,maximumDrawdownPercent:safeInitial>0?invested.maximumDrawdownDollars/safeInitial*100:0};
}
