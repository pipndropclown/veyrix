import type { PerformanceAnalytics } from "@/types/analytics";
const clamp=(value:number,min=0,max=100)=>Math.min(max,Math.max(min,value));
export interface VeyrixScoreComponents{returnScore:number;drawdownScore:number;profitFactorScore:number;expectancyScore:number;total:number}
export function calculateVeyrixScore(metrics:Pick<PerformanceAnalytics,"totalReturnPercent"|"maximumDrawdownPercent"|"profitFactor"|"expectancyPercent">):VeyrixScoreComponents{
 const returnScore=clamp((Number.isFinite(metrics.totalReturnPercent)?metrics.totalReturnPercent:0)+20,0,40)/40*100;
 const drawdownScore=100-clamp(Number.isFinite(metrics.maximumDrawdownPercent)?metrics.maximumDrawdownPercent:20,0,20)/20*100;
 const profitFactorScore=metrics.profitFactor!==null&&Number.isFinite(metrics.profitFactor)?clamp(metrics.profitFactor,0,3)/3*100:0;
 const expectancyScore=metrics.expectancyPercent!==null&&Number.isFinite(metrics.expectancyPercent)?clamp(metrics.expectancyPercent+2,0,4)/4*100:0;
 return{returnScore,drawdownScore,profitFactorScore,expectancyScore,total:clamp(returnScore*.35+drawdownScore*.25+profitFactorScore*.2+expectancyScore*.2)};
}
