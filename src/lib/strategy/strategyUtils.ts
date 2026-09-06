import type { PriceObservation } from "@/types/market";
export const clamp=(value:number,min=0,max=100)=>Math.min(max,Math.max(min,value));
export function validStrategyObservations(observations:readonly PriceObservation[]):PriceObservation[]{const unique=new Map<number,PriceObservation>();for(const item of observations){const time=Date.parse(item.timestamp);if(Number.isFinite(time)&&Number.isFinite(item.price)&&item.price>0)unique.set(time,{timestamp:new Date(time).toISOString(),price:item.price})}return[...unique.entries()].sort(([a],[b])=>a-b).map(([,v])=>v)}
export const average=(values:readonly number[])=>values.length?values.reduce((sum,v)=>sum+v,0)/values.length:null;
