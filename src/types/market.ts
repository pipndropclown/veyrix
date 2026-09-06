export interface PriceObservation {
  timestamp: string;
  price: number;
}

export interface MarketData {
  symbol: "SOL/USDC";
  sourcePair: "SOL/USD";
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
