import "server-only";

import { recordPriceObservation } from "./priceHistory";
import type { MarketData } from "@/types/market";

const COINBASE_STATS_URL = "https://api.exchange.coinbase.com/products/SOL-USD/stats";
const REQUEST_TIMEOUT_MS = 8_000;
const MARKET_CACHE_MS = 30_000;

interface CoinbaseProductStats {
  open?: unknown;
  high?: unknown;
  low?: unknown;
  last?: unknown;
  volume?: unknown;
}

interface MarketCache {
  data: MarketData;
  expiresAt: number;
}

let cache: MarketCache | null = null;
let pendingRequest: Promise<MarketData> | null = null;

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchSolMarketData(): Promise<MarketData> {
  const requestedAt = Date.now();
  const response = await fetch(COINBASE_STATS_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Market provider returned ${response.status}`);

  const stats = (await response.json()) as CoinbaseProductStats;
  const price = finiteNumber(stats.last);
  const open = finiteNumber(stats.open);
  const high = finiteNumber(stats.high);
  const low = finiteNumber(stats.low);
  const baseVolume = finiteNumber(stats.volume);
  if (price === null || open === null || open === 0 || high === null || low === null || baseVolume === null) {
    throw new Error("Market provider returned incomplete data");
  }

  const lastUpdated = new Date(requestedAt).toISOString();
  const data: MarketData = {
    symbol: "SOL/USDC",
    sourcePair: "SOL/USD",
    price,
    change24h: ((price - open) / open) * 100,
    high24h: high,
    low24h: low,
    volume24h: baseVolume * price,
    lastUpdated,
  };

  recordPriceObservation({ timestamp: lastUpdated, price });
  return data;
}

export async function getSolMarketData(): Promise<MarketData> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  if (pendingRequest) return pendingRequest;

  pendingRequest = fetchSolMarketData()
    .then((data) => {
      cache = { data, expiresAt: Date.now() + MARKET_CACHE_MS };
      return data;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}
