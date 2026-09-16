import "server-only";
import { recordPriceObservation } from "./priceHistory";
import { MARKET_REGISTRY, type MarketId } from "./marketRegistry";
import type { MarketData } from "@/types/market";
const REQUEST_TIMEOUT_MS=8000,MARKET_CACHE_MS=30000;
interface CoinbaseProductStats{open?:unknown;high?:unknown;low?:unknown;last?:unknown;volume?:unknown}
const cache=new Map<MarketId,{data:MarketData;expiresAt:number}>();
const pending=new Map<MarketId,Promise<MarketData>>();
const finiteNumber=(value:unknown)=>{const parsed=typeof value==="number"||typeof value==="string"?Number(value):Number.NaN;return Number.isFinite(parsed)?parsed:null};
async function fetchMarketData(marketId:MarketId):Promise<MarketData>{const market=MARKET_REGISTRY[marketId],requestedAt=Date.now();const response=await fetch(`https://api.exchange.coinbase.com/products/${market.providerProductId}/stats`,{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});if(!response.ok)throw new Error(`Market provider returned ${response.status}`);const stats=await response.json() as CoinbaseProductStats,price=finiteNumber(stats.last),open=finiteNumber(stats.open),high=finiteNumber(stats.high),low=finiteNumber(stats.low),baseVolume=finiteNumber(stats.volume);if(price===null||price<=0||open===null||open<=0||high===null||high<=0||low===null||low<=0||baseVolume===null||baseVolume<0)throw new Error("Market provider returned incomplete data");const lastUpdated=new Date(requestedAt).toISOString();const data:MarketData={marketId,symbol:market.displaySymbol.replaceAll(" ",""),sourcePair:market.providerDisplayPair,price,change24h:((price-open)/open)*100,high24h:high,low24h:low,volume24h:baseVolume*price,lastUpdated};recordPriceObservation({timestamp:lastUpdated,price},marketId);return data}
export async function getMarketData(marketId:MarketId):Promise<MarketData>{const now=Date.now(),hit=cache.get(marketId);if(hit&&hit.expiresAt>now)return hit.data;const existing=pending.get(marketId);if(existing)return existing;const request=fetchMarketData(marketId).then(data=>{cache.set(marketId,{data,expiresAt:Date.now()+MARKET_CACHE_MS});return data}).finally(()=>pending.delete(marketId));pending.set(marketId,request);return request}
export const getSolMarketData=()=>getMarketData("SOL");
