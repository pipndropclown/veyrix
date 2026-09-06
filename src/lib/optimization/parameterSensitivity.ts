import { calculateVeyrixScore } from "../analytics/veyrixScore.ts";import { runBacktest } from "../backtesting/backtestEngine.ts";import { normalizeHistoricalCandles } from "../backtesting/marketCandles.ts";import { createParameterizedStrategy,defaultParameters,generateParameterGrid,parameterSchemas } from "./parameterSchemas.ts";
import type { SensitivityInput,SensitivityReport,SensitivityRun } from "@/types/robustness";
const same=(a:Readonly<Record<string,number>>,b:Readonly<Record<string,number>>)=>Object.keys(a).every(k=>a[k]===b[k]);
export function calculateParameterStability(best:Pick<SensitivityRun,"parameters"|"veyrixScore"|"result">,runs:readonly SensitivityRun[],strategyId:SensitivityInput["strategyId"]):{score:number;neighborCount:number}{
 const schema=parameterSchemas[strategyId],neighbors=runs.filter(run=>run!==best&&schema.parameters.every(p=>Math.abs(run.parameters[p.key]-best.parameters[p.key])<=p.step+1e-10));
 if(!neighbors.length)return{score:0,neighborCount:0};const returnDelta=neighbors.reduce((s,n)=>s+Math.abs(n.result.analytics.totalReturnPercent-best.result.analytics.totalReturnPercent),0)/neighbors.length,scoreDelta=neighbors.reduce((s,n)=>s+Math.abs(n.veyrixScore-best.veyrixScore),0)/neighbors.length;
 return{score:Math.max(0,Math.min(100,(Math.max(0,100-returnDelta*10)+Math.max(0,100-scoreDelta))/2)),neighborCount:neighbors.length};
}
export function runParameterSensitivity({candles:input,strategyId,config}:SensitivityInput):SensitivityReport{
 const candles=Object.freeze(normalizeHistoricalCandles(input).candles.map(c=>Object.freeze({...c}))),runs=generateParameterGrid(strategyId).map(parameters=>{const result=runBacktest({candles,strategy:createParameterizedStrategy(strategyId,parameters),config,normalized:true});return{parameters,result,veyrixScore:calculateVeyrixScore(result.analytics).total}});
 const highestReturn=runs.length?runs.reduce((a,b)=>b.result.analytics.totalReturnPercent>a.result.analytics.totalReturnPercent?b:a):null,highestScore=runs.length?runs.reduce((a,b)=>b.veyrixScore>a.veyrixScore?b:a):null,lowestDrawdown=runs.length?runs.reduce((a,b)=>b.result.analytics.maximumDrawdownPercent<a.result.analytics.maximumDrawdownPercent?b:a):null;
 const defaults=defaultParameters(strategyId),defaultRun=runs.find(run=>same(run.parameters,defaults))??null,stability=highestScore?calculateParameterStability(highestScore,runs,strategyId):{score:0,neighborCount:0};
 return{strategyId,runs,defaultRun,highestReturn,highestScore,lowestDrawdown,parameterStability:stability.score,neighborCount:stability.neighborCount};
}
