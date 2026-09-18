import type { MarketId } from "@/lib/market/marketRegistry";
import type { LiveTimeframe } from "./liveTrading";
import type { StrategyId } from "./strategy";
import type { Signal } from "./index";
import type { PaperPortfolioState } from "./trading";

export interface AgentConfig {
  name: string;
  marketId: MarketId;
  mode: "SPOT" | "FUTURES";
  strategyId: StrategyId;
  timeframe: LiveTimeframe;
  allocation: { unit: "USDC" | "PERCENT"; value: number };
  stopLossPercent: number;
  takeProfitPercent: number;
  leverage: 1 | 2 | 3 | 5;
}
export interface AgentEvent {
  timestamp: string;
  candleId: string;
  signal: Signal | null;
  action: string;
}
export interface PaperAgent extends AgentConfig {
  id: string;
  enabled: boolean;
  createdAt: string;
  lastEvaluation: string | null;
  lastSignal: Signal | null;
  lastAction: string;
  processedCandleIds: string[];
  recentEvents: AgentEvent[];
  deletedAt?: string;
}
export interface AgentStore {
  version: 1;
  migratedV13: boolean;
  agents: PaperAgent[];
  archived: PaperAgent[];
}
export interface PaperLabState { portfolio: PaperPortfolioState; agents: AgentStore; }
export interface AgentOwnership {
  /** Historical identity is retained even after an agent is deleted. */
  agentId?: string;
  agentName?: string;
  agentDetached?: boolean;
}
