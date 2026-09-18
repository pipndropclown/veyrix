import { LIVE_TIMEFRAMES } from "../market/liveCandles.ts";
import type { HistoricalCandle } from "@/types/backtesting";
import type { LiveCandleApiResponse } from "@/types/liveTrading";
import type { MarketId } from "@/lib/market/marketRegistry";
import type { LiveTimeframe } from "@/types/liveTrading";
const candleCache = new Map<string, { until: number; data: HistoricalCandle[] }>();
const candleInflight = new Map<string, Promise<HistoricalCandle[]>>();
const priceCache = new Map<string, { until: number; data: unknown }>();
const priceInflight = new Map<string, Promise<unknown>>();
export function fetchSharedCandles(marketId: MarketId, timeframe: LiveTimeframe, fetcher: () => Promise<LiveCandleApiResponse>, now = Date.now()) {
  const key = `${marketId}:${timeframe}`, cached = candleCache.get(key);
  if (cached && cached.until > now) return Promise.resolve(cached.data);
  const pending = candleInflight.get(key); if (pending) return pending;
  const task = fetcher().then(payload => { if (!payload.success) throw new Error(payload.error); candleCache.set(key, { until: Date.now() + Math.max(5000, LIVE_TIMEFRAMES[timeframe].refreshMs), data: payload.data.candles }); return payload.data.candles; }).finally(() => candleInflight.delete(key));
  candleInflight.set(key, task); return task;
}
export function fetchSharedMarket<T>(marketId: MarketId, fetcher: () => Promise<T>, now = Date.now()): Promise<T> {
  const cached = priceCache.get(marketId); if (cached && cached.until > now) return Promise.resolve(cached.data as T);
  const pending = priceInflight.get(marketId); if (pending) return pending as Promise<T>;
  const task = fetcher().then(data => { priceCache.set(marketId, { until: Date.now() + 25_000, data }); return data; }).finally(() => priceInflight.delete(marketId));
  priceInflight.set(marketId, task); return task;
}
export function clearSharedMarketCacheForTests() { candleCache.clear(); candleInflight.clear(); priceCache.clear(); priceInflight.clear(); }
