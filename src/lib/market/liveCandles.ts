import { normalizeHistoricalCandles } from "../backtesting/marketCandles.ts";
import type { HistoricalCandle } from "@/types/backtesting";
import type {
  LiveTimeframe,
  LiveTimeframeDefinition,
} from "@/types/liveTrading";

export const LIVE_TIMEFRAMES: Readonly<
  Record<LiveTimeframe, LiveTimeframeDefinition>
> = {
  "1m": {
    id: "1m",
    label: "1m",
    seconds: 60,
    providerGranularitySeconds: 60,
    aggregationFactor: 1,
    refreshMs: 15_000,
  },
  "5m": {
    id: "5m",
    label: "5m",
    seconds: 300,
    providerGranularitySeconds: 300,
    aggregationFactor: 1,
    refreshMs: 20_000,
  },
  "15m": {
    id: "15m",
    label: "15m",
    seconds: 900,
    providerGranularitySeconds: 900,
    aggregationFactor: 1,
    refreshMs: 30_000,
  },
  "30m": {
    id: "30m",
    label: "30m",
    seconds: 1800,
    providerGranularitySeconds: 900,
    aggregationFactor: 2,
    refreshMs: 30_000,
  },
  "1H": {
    id: "1H",
    label: "1H",
    seconds: 3600,
    providerGranularitySeconds: 3600,
    aggregationFactor: 1,
    refreshMs: 45_000,
  },
  "4H": {
    id: "4H",
    label: "4H",
    seconds: 14400,
    providerGranularitySeconds: 3600,
    aggregationFactor: 4,
    refreshMs: 60_000,
  },
  "12H": {
    id: "12H",
    label: "12H",
    seconds: 43200,
    providerGranularitySeconds: 21600,
    aggregationFactor: 2,
    refreshMs: 60_000,
  },
  "1D": {
    id: "1D",
    label: "1D",
    seconds: 86400,
    providerGranularitySeconds: 86400,
    aggregationFactor: 1,
    refreshMs: 60_000,
  },
};

export const LIVE_TIMEFRAME_IDS = Object.keys(
  LIVE_TIMEFRAMES,
) as LiveTimeframe[];
export function isLiveTimeframe(value: unknown): value is LiveTimeframe {
  return typeof value === "string" && value in LIVE_TIMEFRAMES;
}
export function candleDirection(
  candle: Pick<HistoricalCandle, "open" | "close">,
): "BULLISH" | "BEARISH" | "NEUTRAL" {
  return candle.close > candle.open
    ? "BULLISH"
    : candle.close < candle.open
      ? "BEARISH"
      : "NEUTRAL";
}

export function aggregateCandles(
  values: readonly unknown[],
  targetSeconds: number,
): HistoricalCandle[] {
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) return [];
  const source = normalizeHistoricalCandles(values).candles;
  const buckets = new Map<number, HistoricalCandle[]>();
  for (const candle of source) {
    const seconds = Math.floor(Date.parse(candle.timestamp) / 1000);
    const bucket = Math.floor(seconds / targetSeconds) * targetSeconds;
    const items = buckets.get(bucket) ?? [];
    items.push(candle);
    buckets.set(bucket, items);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, items]) => {
      const ordered = items.sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );
      const first = ordered[0],
        last = ordered.at(-1)!;
      const high = Math.max(...ordered.map((item) => item.high));
      const low = Math.min(...ordered.map((item) => item.low));
      const volume = ordered.reduce((sum, item) => sum + item.volume, 0);
      return {
        timestamp: new Date(bucket * 1000).toISOString(),
        open: first.open,
        high,
        low,
        close: last.close,
        volume,
        price: last.close,
      };
    });
}

export function closedCandles(
  candles: readonly HistoricalCandle[],
  timeframe: LiveTimeframe,
  now = Date.now(),
): HistoricalCandle[] {
  const seconds = LIVE_TIMEFRAMES[timeframe].seconds;
  return candles.filter(
    (candle) => Date.parse(candle.timestamp) + seconds * 1000 <= now,
  );
}

export function automationCandleId(
  strategyId: string,
  timeframe: LiveTimeframe,
  timestamp: string,
  marketId?: string,
  mode?: string,
): string {
  const legacy=`${strategyId}:${timeframe}:${new Date(timestamp).toISOString()}`;
  return marketId&&mode?`${marketId}:${mode}:${legacy}`:legacy;
}

export function nextCandleClose(
  timeframe: LiveTimeframe,
  now = Date.now(),
): string {
  const span = LIVE_TIMEFRAMES[timeframe].seconds * 1000;
  return new Date((Math.floor(now / span) + 1) * span).toISOString();
}
