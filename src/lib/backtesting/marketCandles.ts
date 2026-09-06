import type { BacktestTimeframe,CandleInterval,HistoricalCandle } from "@/types/backtesting";
export const COINBASE_MAX_CANDLES_PER_REQUEST=300;
export interface TimeframeDefinition{timeframe:BacktestTimeframe;days:number;granularitySeconds:3600|21600;interval:CandleInterval;expectedMaximumCandles:number}
const definitions:Record<"7D"|"14D"|"30D",TimeframeDefinition>={
  "7D":{timeframe:"7D",days:7,granularitySeconds:3600,interval:"1 hour",expectedMaximumCandles:169},
  "14D":{timeframe:"14D",days:14,granularitySeconds:21600,interval:"6 hours",expectedMaximumCandles:57},
  "30D":{timeframe:"30D",days:30,granularitySeconds:21600,interval:"6 hours",expectedMaximumCandles:121},
};
const historicalDefinitions:Record<BacktestTimeframe,TimeframeDefinition>={...definitions,"60D":{timeframe:"60D",days:60,granularitySeconds:21600,interval:"6 hours",expectedMaximumCandles:241},"90D":{timeframe:"90D",days:90,granularitySeconds:21600,interval:"6 hours",expectedMaximumCandles:361},"180D":{timeframe:"180D",days:180,granularitySeconds:21600,interval:"6 hours",expectedMaximumCandles:721},"365D":{timeframe:"365D",days:365,granularitySeconds:21600,interval:"6 hours",expectedMaximumCandles:1461}};
export function isBacktestTimeframe(value:unknown):value is BacktestTimeframe{return value==="7D"||value==="14D"||value==="30D"||value==="60D"||value==="90D"||value==="180D"||value==="365D"}
export function getTimeframeDefinition(value:unknown):TimeframeDefinition{return definitions[value==="14D"||value==="30D"?value:"7D"]}
export function getHistoricalTimeframeDefinition(value:unknown):TimeframeDefinition{return historicalDefinitions[isBacktestTimeframe(value)?value:"7D"]}
export interface HistoricalRequestRange{start:Date;end:Date;expectedMaximumCandles:number}
export function buildHistoricalRequestRanges(start:Date,end:Date,granularitySeconds:number):HistoricalRequestRange[]{
  const startMs=start.getTime(),endMs=end.getTime(),stepMs=granularitySeconds*1000,maxSpan=stepMs*(COINBASE_MAX_CANDLES_PER_REQUEST-1);if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs>=endMs||!Number.isFinite(stepMs)||stepMs<=0)return[];
  const ranges:HistoricalRequestRange[]=[];let cursor=startMs;while(cursor<endMs){const rangeEnd=Math.min(endMs,cursor+maxSpan),count=Math.floor((rangeEnd-cursor)/stepMs)+1;ranges.push({start:new Date(cursor),end:new Date(rangeEnd),expectedMaximumCandles:count});if(rangeEnd===endMs)break;cursor=rangeEnd}return ranges;
}
export interface HistoricalMergeResult{candles:HistoricalCandle[];ignored:number;duplicatesRemoved:number;invalidRemoved:number}
export function mergeHistoricalChunks(chunks:readonly unknown[]):HistoricalMergeResult{const flattened:unknown[]=[];let malformed=0;for(const chunk of chunks){if(Array.isArray(chunk))flattened.push(...chunk);else malformed++}const parsed:HistoricalCandle[]=[];let invalid=malformed;for(const value of flattened){let candle:HistoricalCandle|null=null;if(Array.isArray(value))candle=normalizeCoinbaseCandle(value);else candle=normalizeHistoricalCandles([value]).candles[0]??null;if(candle)parsed.push(candle);else invalid++}const unique=new Map<number,HistoricalCandle>();let duplicates=0;for(const candle of parsed){const time=Date.parse(candle.timestamp);if(unique.has(time)){duplicates++;continue}unique.set(time,candle)}const candles=[...unique.entries()].sort(([a],[b])=>a-b).map(([,candle])=>candle);return{candles,ignored:invalid+duplicates,duplicatesRemoved:duplicates,invalidRemoved:invalid}}
export function calculateHistoricalDataQuality(candles:readonly HistoricalCandle[],expectedApproximateCandles:number,granularitySeconds:number,duplicatesRemoved=0,invalidRemoved=0){const sorted=normalizeHistoricalCandles(candles).candles;let missing=0;for(let index=1;index<sorted.length;index++){const intervals=Math.round((Date.parse(sorted[index].timestamp)-Date.parse(sorted[index-1].timestamp))/(granularitySeconds*1000));if(intervals>1)missing+=intervals-1}const expected=Number.isFinite(expectedApproximateCandles)&&expectedApproximateCandles>0?Math.floor(expectedApproximateCandles):0,coverage=expected?Math.min(100,sorted.length/expected*100):0;return{expectedApproximateCandles:expected,actualValidCandles:sorted.length,missingIntervalCount:missing,duplicateCountRemoved:Math.max(0,duplicatesRemoved),invalidCandleCountRemoved:Math.max(0,invalidRemoved),firstTimestamp:sorted[0]?.timestamp??null,lastTimestamp:sorted.at(-1)?.timestamp??null,coveragePercent:Number.isFinite(coverage)?coverage:0}}
export function normalizeCoinbaseCandle(value:unknown):HistoricalCandle|null{
  if(!Array.isArray(value)||value.length<6)return null;
  const [seconds,low,high,open,close,volume]=value.slice(0,6).map(Number);
  if(![seconds,low,high,open,close,volume].every(Number.isFinite)||seconds<=0||low<=0||high<=0||open<=0||close<=0||volume<0)return null;
  if(low>high||open<low||open>high||close<low||close>high)return null;
  const timestamp=new Date(seconds*1000);if(!Number.isFinite(timestamp.getTime()))return null;
  return{timestamp:timestamp.toISOString(),open,high,low,close,volume,price:close};
}
export function normalizeHistoricalCandles(values:readonly unknown[]):{candles:HistoricalCandle[];ignored:number}{
  const unique=new Map<number,HistoricalCandle>();let ignored=0;
  for(const value of values){let parsed:HistoricalCandle|null=null;
    if(Array.isArray(value))parsed=normalizeCoinbaseCandle(value);
    else if(value&&typeof value==="object"){const raw=value as Partial<HistoricalCandle>;const timestamp=typeof raw.timestamp==="string"?Date.parse(raw.timestamp):NaN;const close=typeof raw.close==="number"?raw.close:raw.price;
      if(Number.isFinite(timestamp)&&[raw.open,raw.high,raw.low,close].every(price=>typeof price==="number"&&Number.isFinite(price)&&price>0)&&typeof raw.volume==="number"&&Number.isFinite(raw.volume)&&raw.volume>=0&&raw.low!<=raw.high!&&raw.open!>=raw.low!&&raw.open!<=raw.high!&&close!>=raw.low!&&close!<=raw.high!)parsed={timestamp:new Date(timestamp).toISOString(),open:raw.open!,high:raw.high!,low:raw.low!,close:close!,volume:raw.volume,price:close!};}
    if(!parsed){ignored++;continue}const time=Date.parse(parsed.timestamp);if(unique.has(time)){ignored++;continue}unique.set(time,parsed);
  }
  return{candles:[...unique.entries()].sort(([a],[b])=>a-b).map(([,candle])=>candle),ignored};
}
