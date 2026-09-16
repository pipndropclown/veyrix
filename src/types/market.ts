export interface PriceObservation {
  timestamp: string;
  price: number;
}

export interface MarketData {
  marketId: import("@/lib/market/marketRegistry").MarketId;
  symbol: string;
  sourcePair: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastUpdated: string;
}

export type MarketApiResponse =
  | { success: true; data: MarketData; observations: PriceObservation[]; strategy: StrategyResult; activity: ActivityItem[] }
  | { success: false; error: string };
import type { ActivityItem } from "@/types";
import type { StrategyResult } from "@/types/strategy";
