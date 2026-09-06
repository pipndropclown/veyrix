import { calculateDrawdown,calculatePerformanceAnalytics } from "../analytics/performanceAnalytics.ts";
import { strategyRegistry } from "../strategy/strategyRegistry.ts";
import { evaluateMomentum } from "../strategy/momentumStrategy.ts";
import { runBuyAndHoldBenchmark,runExposureMatchedBenchmark,calculateReturnDifference } from "./benchmarkEngine.ts";
import { evaluateIntrabarRisk,sanitizeExecutionConfig,simulateLongEntry,simulateLongExit } from "./executionModel.ts";
import { normalizeHistoricalCandles } from "./marketCandles.ts";
import type { BacktestConfig,BacktestRequest,BacktestResult,BacktestTrade,HistoricalCandle } from "@/types/backtesting";
import type { PriceObservation } from "@/types/market";
import type { EquityPoint } from "@/types/analytics";
import type { TradeExitReason } from "@/types/trading";
import type { GenericStrategyResult,StrategyDefinition } from "@/types/strategy";

const LEGACY_ZERO_COSTS={feePercentPerSide:0,slippagePercent:0,collisionPolicy:"STOP_FIRST"} as const;
function asCandles(input:readonly (HistoricalCandle|PriceObservation)[]):unknown[]{
  return input.map(value=>"open" in value?value:{timestamp:value.timestamp,open:value.price,high:value.price,low:value.price,close:value.price,volume:0,price:value.price});
}
const safeHold=(reason:string):GenericStrategyResult=>({signal:"HOLD",confidence:0,reason,metrics:{}});
function safeEvaluate(strategy:StrategyDefinition,history:readonly PriceObservation[]):GenericStrategyResult{try{const observations=strategy.maximumObservations&&strategy.maximumObservations>0?history.slice(-strategy.maximumObservations):history,value=strategy.evaluate(observations);if(!value||!["BUY","SELL","HOLD"].includes(value.signal)||!Number.isFinite(value.confidence)||value.confidence<0||value.confidence>100||typeof value.reason!=="string"||!value.metrics||typeof value.metrics!=="object")return safeHold("Strategy returned an invalid decision.");return value}catch{return safeHold("Strategy evaluation failed safely.")}}
export function runBacktest(request:BacktestRequest):BacktestResult;
export function runBacktest(input:readonly (HistoricalCandle|PriceObservation)[],config:Readonly<BacktestConfig>,strategy?:StrategyDefinition):BacktestResult;
export function runBacktest(inputOrRequest:readonly (HistoricalCandle|PriceObservation)[]|BacktestRequest,maybeConfig?:Readonly<BacktestConfig>,maybeStrategy?:StrategyDefinition):BacktestResult{
  const objectRequest=!Array.isArray(inputOrRequest),input=objectRequest?(inputOrRequest as BacktestRequest).candles:inputOrRequest as readonly (HistoricalCandle|PriceObservation)[],config=objectRequest?(inputOrRequest as BacktestRequest).config:maybeConfig!;
  const legacyMomentum:StrategyDefinition={...strategyRegistry.momentum,configuration:config.strategy,minimumObservations:config.strategy.minimumObservations,maximumObservations:config.strategy.lookbackObservations,evaluate:observations=>{const result=evaluateMomentum(observations,config.strategy);return{...result,metrics:{...result.metrics}}}};
  const strategyDefinition=objectRequest?(inputOrRequest as BacktestRequest).strategy:(maybeStrategy??legacyMomentum);
  const legacyCloseOnlyInput=input.every(value=>!("open" in value));
  const trusted=objectRequest&&(inputOrRequest as BacktestRequest).normalized===true;
  const normalized=trusted?{candles:[...(input as readonly HistoricalCandle[])],ignored:0}:normalizeHistoricalCandles(asCandles(input)),candles=normalized.candles,execution=sanitizeExecutionConfig(config.execution??LEGACY_ZERO_COSTS);
  const startingBalance=Number.isFinite(config.paperTrading.startingBalanceUsd)&&config.paperTrading.startingBalanceUsd>=0?config.paperTrading.startingBalanceUsd:0;
  const allocationPercent=Number.isFinite(config.paperTrading.positionSizePercent)?Math.min(100,Math.max(0,config.paperTrading.positionSizePercent)):0;
  let cash=startingBalance,openTrade:BacktestTrade|null=null,latestDecision=safeHold("No valid observations.");const trades:BacktestTrade[]=[],history:PriceObservation[]=[],strategyEquityCurve:EquityPoint[]=[];
  if(candles[0])strategyEquityCurve.push({timestamp:candles[0].timestamp,equity:startingBalance,tradeId:null});
  const close=(trade:BacktestTrade,candle:HistoricalCandle,reason:TradeExitReason,idealExitPrice:number):void=>{
    const exit=simulateLongExit(trade.solQuantity,idealExitPrice,execution);if(!exit)return;
    const grossPnl=trade.solQuantity*(idealExitPrice-trade.idealEntryPrice),totalFees=trade.entryFeeUsd+exit.fee,slippageCost=trade.estimatedSlippageCostUsd+exit.slippageCost,realizedPnl=exit.netProceeds-trade.positionSizeUsdc;
    if(![grossPnl,totalFees,slippageCost,realizedPnl].every(Number.isFinite))return;cash=Math.max(0,cash+exit.netProceeds);
    trades.push({...trade,exitTimestamp:candle.timestamp,idealExitPrice,executedExitPrice:exit.executedPrice,exitPrice:exit.executedPrice,exitValueUsdc:exit.netProceeds,exitFeeUsd:exit.fee,totalFeesUsd:totalFees,estimatedSlippageCostUsd:slippageCost,grossPnl,realizedPnl,pnlPercent:trade.positionSizeUsdc>0?realizedPnl/trade.positionSizeUsdc*100:0,status:"CLOSED",exitReason:reason});openTrade=null;
  };
  for(const candle of candles){
    history.push({timestamp:candle.timestamp,price:candle.close});latestDecision=safeEvaluate(strategyDefinition,history);
    if(openTrade){const risk=evaluateIntrabarRisk(openTrade.executedEntryPrice,candle,config.risk,execution.collisionPolicy);if(risk)close(openTrade,candle,risk.reason,legacyCloseOnlyInput?candle.close:risk.idealExitPrice);else if(latestDecision.signal==="SELL")close(openTrade,candle,"STRATEGY_SIGNAL",candle.close);}
    else if(latestDecision.signal==="BUY"&&config.paperTrading.maxOpenPositions>=1&&allocationPercent>0){
      const equity=cash,allocation=Math.min(cash,equity*allocationPercent/100),entry=simulateLongEntry(allocation,candle.close,execution);
      if(entry){cash=Math.max(0,cash-entry.cashCost);openTrade={id:`BT-${strategyDefinition.id}-${candle.timestamp.replace(/\D/g,"")}`,executionId:`backtest:${strategyDefinition.id}:${candle.timestamp}:BUY`,pair:"SOL/USDC",side:"BUY",entryTimestamp:candle.timestamp,exitTimestamp:null,idealEntryPrice:entry.idealPrice,executedEntryPrice:entry.executedPrice,idealExitPrice:null,executedExitPrice:null,entryPrice:entry.executedPrice,exitPrice:null,solQuantity:entry.quantity,positionSizeUsdc:entry.cashCost,exitValueUsdc:null,entryFeeUsd:entry.fee,exitFeeUsd:0,totalFeesUsd:entry.fee,estimatedSlippageCostUsd:entry.slippageCost,grossPnl:null,realizedPnl:null,pnlPercent:null,strategySignal:"BUY",confidence:latestDecision.confidence,strategyReason:latestDecision.reason,status:"OPEN",exitReason:null};}
    }
    const marked=cash+(openTrade?openTrade.solQuantity*candle.close:0);strategyEquityCurve.push({timestamp:candle.timestamp,equity:Number.isFinite(marked)&&marked>=0?marked:cash,tradeId:null});
  }
  if(openTrade)trades.push(openTrade);const lastPrice=candles.at(-1)?.close??0,positionValue=openTrade?openTrade.solQuantity*lastPrice:0,unrealized=openTrade?positionValue-openTrade.positionSizeUsdc:0,finalBalance=Math.max(0,cash+positionValue);
  const baseAnalytics=calculatePerformanceAnalytics({startingBalance,currentPortfolioValue:finalBalance,unrealizedPnl:unrealized,trades,startTimestamp:candles[0]?.timestamp}),strategyDrawdown=calculateDrawdown(strategyEquityCurve);
  const analytics={...baseAnalytics,equityCurve:strategyEquityCurve,drawdownCurve:strategyDrawdown.curve,currentDrawdownDollars:strategyDrawdown.currentDollars,currentDrawdownPercent:strategyDrawdown.currentPercent,maximumDrawdownDollars:strategyDrawdown.maximumDollars,maximumDrawdownPercent:strategyDrawdown.maximumPercent};
  const closed=trades.filter(trade=>trade.status==="CLOSED"),gross=closed.reduce((sum,trade)=>sum+(trade.grossPnl??0),0),totalFees=trades.reduce((sum,trade)=>sum+trade.totalFeesUsd,0),slippage=trades.reduce((sum,trade)=>sum+trade.estimatedSlippageCostUsd,0);
  const benchmark=runBuyAndHoldBenchmark(candles,startingBalance,execution);
  const matchedBenchmark=runExposureMatchedBenchmark(candles,startingBalance,allocationPercent,execution);
  return{label:"BACKTEST",periodStart:candles[0]?.timestamp??null,periodEnd:candles.at(-1)?.timestamp??null,initialBalance:startingBalance,finalBalance,finalCashBalance:cash,finalPositionValue:positionValue,trades,analytics,costs:{grossPnl:gross,grossProfit:closed.reduce((s,t)=>s+Math.max(0,t.grossPnl??0),0),grossLoss:Math.abs(closed.reduce((s,t)=>s+Math.min(0,t.grossPnl??0),0)),totalFees,estimatedSlippageCost:slippage,netPnl:closed.reduce((s,t)=>s+(t.realizedPnl??0),0)},benchmark,matchedBenchmark,strategyAlphaPercent:calculateReturnDifference(analytics.totalReturnPercent,benchmark.totalReturnPercent),returnVsFullSolPercent:calculateReturnDifference(analytics.totalReturnPercent,benchmark.totalReturnPercent),returnVsMatchedExposurePercent:calculateReturnDifference(analytics.totalReturnPercent,matchedBenchmark.totalReturnPercent),strategyEquityCurve,processedObservations:candles.length,ignoredObservations:normalized.ignored,openPosition:openTrade!==null,strategyId:strategyDefinition.id,strategyName:strategyDefinition.name,latestDecision};
}
