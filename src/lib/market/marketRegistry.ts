import type { LiveTimeframe } from "@/types/liveTrading";

export type MarketId = "BTC" | "ETH" | "SOL";
export interface MarketDefinition {
  id: MarketId;
  displaySymbol: string;
  baseAsset: MarketId;
  quoteAsset: "USDC";
  providerProductId: `${MarketId}-USD`;
  providerDisplayPair: `${MarketId}/USD`;
  pricePrecision: number;
  quantityPrecision: number;
  supportedTimeframes: readonly LiveTimeframe[];
  displayName: string;
}
const timeframes = ["1m", "5m", "15m", "30m", "1H", "4H", "12H", "1D"] as const;
export const MARKET_REGISTRY: Readonly<Record<MarketId, MarketDefinition>> = Object.freeze({
  BTC: { id: "BTC", displaySymbol: "BTC / USDC", baseAsset: "BTC", quoteAsset: "USDC", providerProductId: "BTC-USD", providerDisplayPair: "BTC/USD", pricePrecision: 2, quantityPrecision: 8, supportedTimeframes: timeframes, displayName: "Bitcoin" },
  ETH: { id: "ETH", displaySymbol: "ETH / USDC", baseAsset: "ETH", quoteAsset: "USDC", providerProductId: "ETH-USD", providerDisplayPair: "ETH/USD", pricePrecision: 2, quantityPrecision: 6, supportedTimeframes: timeframes, displayName: "Ethereum" },
  SOL: { id: "SOL", displaySymbol: "SOL / USDC", baseAsset: "SOL", quoteAsset: "USDC", providerProductId: "SOL-USD", providerDisplayPair: "SOL/USD", pricePrecision: 2, quantityPrecision: 6, supportedTimeframes: timeframes, displayName: "Solana" },
});
export const MARKET_IDS = Object.freeze(Object.keys(MARKET_REGISTRY) as MarketId[]);
export function isMarketId(value: unknown): value is MarketId { return typeof value === "string" && Object.hasOwn(MARKET_REGISTRY, value); }
export function getMarket(value: unknown): MarketDefinition | null { return isMarketId(value) ? MARKET_REGISTRY[value] : null; }
export function formatMarketPrice(id: MarketId, value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: MARKET_REGISTRY[id].pricePrecision, maximumFractionDigits: MARKET_REGISTRY[id].pricePrecision }).format(value); }
export function formatMarketQuantity(id: MarketId, value: number): string { return value.toFixed(MARKET_REGISTRY[id].quantityPrecision); }
