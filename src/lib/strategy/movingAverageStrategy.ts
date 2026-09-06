import { average,clamp,validStrategyObservations } from "./strategyUtils.ts";
import type { GenericStrategyResult,MovingAverageConfig } from "@/types/strategy";
import type { PriceObservation } from "@/types/market";
export const movingAverageConfig:Readonly<MovingAverageConfig>={fastPeriod:5,slowPeriod:12};
const empty=(count:number):GenericStrategyResult=>({signal:"HOLD",confidence:0,reason:`Only ${count} valid observations are available; a crossover needs 13.`,metrics:{observationCount:count,fastMa:null,slowMa:null,previousFastMa:null,previousSlowMa:null,separationPercent:null,recentMovementPercent:null,previousRelationship:null}});
export function evaluateMovingAverage(observations:readonly PriceObservation[],config:Readonly<MovingAverageConfig>=movingAverageConfig):GenericStrategyResult{
 const values=validStrategyObservations(observations),minimum=config.slowPeriod+1;if(config.fastPeriod<=0||config.slowPeriod<=config.fastPeriod||values.length<minimum)return empty(values.length);
 const prices=values.map(v=>v.price),current=prices.at(-1)!,previous=prices.at(-2)!,fast=average(prices.slice(-config.fastPeriod))!,slow=average(prices.slice(-config.slowPeriod))!,prevFast=average(prices.slice(0,-1).slice(-config.fastPeriod))!,prevSlow=average(prices.slice(0,-1).slice(-config.slowPeriod))!;
 const separation=(fast-slow)/slow*100,recentMovement=(current-previous)/previous*100,previousRelationship=prevFast===prevSlow?"EQUAL":prevFast>prevSlow?"ABOVE":"BELOW",buy=prevFast<=prevSlow&&fast>slow,sell=prevFast>=prevSlow&&fast<slow;
 const confidence=Math.round(clamp(45+Math.min(30,Math.abs(separation)*60)+Math.min(25,Math.abs(recentMovement)*15)));const signal=buy?"BUY":sell?"SELL":"HOLD";
 return{signal,confidence:signal==="HOLD"?Math.min(confidence,65):confidence,reason:signal==="BUY"?`Fast SMA crossed above slow SMA (${fast.toFixed(2)} vs ${slow.toFixed(2)}).`:signal==="SELL"?`Fast SMA crossed below slow SMA (${fast.toFixed(2)} vs ${slow.toFixed(2)}).`:`No new crossover: fast SMA ${fast.toFixed(2)}, slow SMA ${slow.toFixed(2)}.`,metrics:{observationCount:values.length,fastMa:fast,slowMa:slow,previousFastMa:prevFast,previousSlowMa:prevSlow,separationPercent:separation,recentMovementPercent:recentMovement,previousRelationship}};
}
