import { average,clamp,validStrategyObservations } from "./strategyUtils.ts";
import type { GenericStrategyResult,MeanReversionConfig } from "@/types/strategy";import type { PriceObservation } from "@/types/market";
export const meanReversionConfig:Readonly<MeanReversionConfig>={lookbackPeriod:12,buyDeviationPercent:-1,sellDeviationPercent:0};
export function evaluateMeanReversion(observations:readonly PriceObservation[],config:Readonly<MeanReversionConfig>=meanReversionConfig):GenericStrategyResult{
 const values=validStrategyObservations(observations);if(config.lookbackPeriod<=0||values.length<config.lookbackPeriod)return{signal:"HOLD",confidence:0,reason:`Only ${values.length} of ${config.lookbackPeriod} required observations are available.`,metrics:{observationCount:values.length,rollingAverage:null,currentPrice:null,deviationPercent:null}};
 const window=values.slice(-config.lookbackPeriod),current=window.at(-1)!.price,rollingAverage=average(window.map(v=>v.price))!,deviation=(current-rollingAverage)/rollingAverage*100,signal=deviation<=config.buyDeviationPercent?"BUY":deviation>=config.sellDeviationPercent?"SELL":"HOLD",magnitude=Math.abs(deviation);
 const confidence=Math.round(signal==="BUY"?clamp(50+(magnitude-Math.abs(config.buyDeviationPercent))*20):signal==="SELL"?clamp(50+magnitude*15):clamp(45-magnitude*15,20,50));
 return{signal,confidence,reason:signal==="BUY"?`Price is ${Math.abs(deviation).toFixed(2)}% below its rolling average.`:signal==="SELL"?`Price has returned to or above its rolling average (${deviation.toFixed(2)}%).`:`Price remains ${Math.abs(deviation).toFixed(2)}% below average without reaching the -1.00% entry threshold.`,metrics:{observationCount:values.length,rollingAverage,currentPrice:current,deviationPercent:deviation}};
}
