import type { PriceObservation } from "@/types/market";
import type { MarketId } from "./marketRegistry";

const MAX_OBSERVATIONS = 50;

declare global {
  var veyrixSolPriceHistory: PriceObservation[] | undefined;
}

const history = globalThis.veyrixSolPriceHistory ?? [];
globalThis.veyrixSolPriceHistory = history;
const histories: Record<MarketId, PriceObservation[]> = { SOL: history, BTC: [], ETH: [] };

export function recordPriceObservation(observation: PriceObservation, marketId: MarketId = "SOL"): void {
  const history = histories[marketId];
  if (!Number.isFinite(observation.price) || observation.price <= 0 || !Number.isFinite(Date.parse(observation.timestamp))) return;

  const latest = history.at(-1);
  if (latest?.timestamp === observation.timestamp && latest.price === observation.price) return;

  history.push(observation);
  if (history.length > MAX_OBSERVATIONS) {
    history.splice(0, history.length - MAX_OBSERVATIONS);
  }
}

export function getRecentPriceObservations(marketId: MarketId = "SOL"): PriceObservation[] {
  return histories[marketId].slice();
}
