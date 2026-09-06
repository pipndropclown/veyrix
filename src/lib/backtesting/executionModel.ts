import { calculatePositionRisk } from "../trading/riskEngine.ts";
import { backtestExecutionConfig } from "./backtestConfig.ts";
import type { BacktestExecutionConfig,BacktestRiskConfig,HistoricalCandle,IntrabarCollisionPolicy } from "@/types/backtesting";
import type { TradeExitReason } from "@/types/trading";
const safePercent=(value:number,fallback:number)=>Number.isFinite(value)&&value>=0&&value<100?value:fallback;
export function sanitizeExecutionConfig(config?:Readonly<BacktestExecutionConfig>):BacktestExecutionConfig{return{feePercentPerSide:safePercent(config?.feePercentPerSide??NaN,backtestExecutionConfig.feePercentPerSide),slippagePercent:safePercent(config?.slippagePercent??NaN,backtestExecutionConfig.slippagePercent),collisionPolicy:config?.collisionPolicy==="TARGET_FIRST"?"TARGET_FIRST":"STOP_FIRST"}}
export function calculateFee(notional:number,feePercent:number):number{if(!Number.isFinite(notional)||notional<0)return 0;return notional*safePercent(feePercent,0)/100}
export function adverseEntryPrice(idealPrice:number,slippagePercent:number):number{return idealPrice*(1+safePercent(slippagePercent,0)/100)}
export function adverseExitPrice(idealPrice:number,slippagePercent:number):number{return idealPrice*(1-safePercent(slippagePercent,0)/100)}
export interface EntryExecution{idealPrice:number;executedPrice:number;quantity:number;notional:number;fee:number;cashCost:number;slippageCost:number}
export function simulateLongEntry(capitalBudget:number,idealPrice:number,config:Readonly<BacktestExecutionConfig>):EntryExecution|null{
  const safe=sanitizeExecutionConfig(config);if(!Number.isFinite(capitalBudget)||capitalBudget<=0||!Number.isFinite(idealPrice)||idealPrice<=0)return null;
  const executedPrice=adverseEntryPrice(idealPrice,safe.slippagePercent),feeRate=safe.feePercentPerSide/100,quantity=capitalBudget/(executedPrice*(1+feeRate)),notional=quantity*executedPrice,fee=calculateFee(notional,safe.feePercentPerSide);
  const result={idealPrice,executedPrice,quantity,notional,fee,cashCost:notional+fee,slippageCost:quantity*(executedPrice-idealPrice)};
  return Object.values(result).every(Number.isFinite)&&quantity>0?result:null;
}
export interface ExitExecution{idealPrice:number;executedPrice:number;grossProceeds:number;fee:number;netProceeds:number;slippageCost:number}
export function simulateLongExit(quantity:number,idealPrice:number,config:Readonly<BacktestExecutionConfig>):ExitExecution|null{
  const safe=sanitizeExecutionConfig(config);if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(idealPrice)||idealPrice<=0)return null;
  const executedPrice=adverseExitPrice(idealPrice,safe.slippagePercent),grossProceeds=quantity*executedPrice,fee=calculateFee(grossProceeds,safe.feePercentPerSide),netProceeds=grossProceeds-fee;
  const result={idealPrice,executedPrice,grossProceeds,fee,netProceeds,slippageCost:quantity*(idealPrice-executedPrice)};
  return Object.values(result).every(Number.isFinite)&&netProceeds>=0?result:null;
}
export interface IntrabarRiskResult{reason:Extract<TradeExitReason,"STOP_LOSS"|"TAKE_PROFIT">;idealExitPrice:number;stopTouched:boolean;targetTouched:boolean;collision:boolean}
export function evaluateIntrabarRisk(entryPrice:number,candle:HistoricalCandle,risk:Readonly<BacktestRiskConfig>,policy:IntrabarCollisionPolicy):IntrabarRiskResult|null{
  const levels=calculatePositionRisk(entryPrice,risk);if(!levels)return null;
  const stopTouched=candle.low<=levels.stopLossPrice,targetTouched=candle.high>=levels.takeProfitPrice;if(!stopTouched&&!targetTouched)return null;
  const collision=stopTouched&&targetTouched,stopWins=stopTouched&&(!targetTouched||policy==="STOP_FIRST");
  return{reason:stopWins?"STOP_LOSS":"TAKE_PROFIT",idealExitPrice:stopWins?levels.stopLossPrice:levels.takeProfitPrice,stopTouched,targetTouched,collision};
}
