import "server-only";
import { aggregateCandles, LIVE_TIMEFRAMES } from "./liveCandles";
import { mergeHistoricalChunks } from "@/lib/backtesting/marketCandles";
import type { LiveCandleSet, LiveTimeframe } from "@/types/liveTrading";

const PRODUCT = "SOL-USD";
const MAX_PROVIDER_CANDLES = 300;
const DISPLAY_CANDLES = 180;
const cache = new Map<string, { expiresAt: number; data: LiveCandleSet }>();

export async function getLiveCandles(
  timeframe: LiveTimeframe,
  now = Date.now(),
): Promise<LiveCandleSet> {
  const definition = LIVE_TIMEFRAMES[timeframe];
  const cacheKey = `${timeframe}:${Math.floor(now / Math.min(definition.refreshMs, 30_000))}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.data;
  const sourceCount = Math.min(
    MAX_PROVIDER_CANDLES,
    DISPLAY_CANDLES * definition.aggregationFactor,
  );
  const end = new Date(now);
  const start = new Date(
    now - sourceCount * definition.providerGranularitySeconds * 1000,
  );
  const url = new URL(
    `https://api.exchange.coinbase.com/products/${PRODUCT}/candles`,
  );
  url.searchParams.set(
    "granularity",
    String(definition.providerGranularitySeconds),
  );
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Veyrix-Paper-Terminal/1.1",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok)
    throw new Error(`Candle provider returned ${response.status}`);
  const raw: unknown = await response.json();
  if (!Array.isArray(raw) || raw.length > MAX_PROVIDER_CANDLES)
    throw new Error("Candle provider returned malformed data");
  const normalized = mergeHistoricalChunks([raw]).candles;
  const candles = (
    definition.aggregationFactor > 1
      ? aggregateCandles(normalized, definition.seconds)
      : normalized
  ).slice(-DISPLAY_CANDLES);
  if (!candles.length) throw new Error("No valid candles available");
  const data: LiveCandleSet = {
    pair: PRODUCT,
    source: "Coinbase Exchange",
    timeframe,
    intervalSeconds: definition.seconds,
    fetchedAt: new Date(now).toISOString(),
    candles,
  };
  cache.set(cacheKey, {
    expiresAt: now + Math.min(definition.refreshMs, 30_000),
    data,
  });
  return data;
}
