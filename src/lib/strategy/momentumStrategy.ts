import type { PriceObservation } from "@/types/market";
import type { MomentumMetrics, MomentumStrategyConfig, StrategyResult } from "@/types/strategy";

export const momentumStrategyConfig: Readonly<MomentumStrategyConfig> = {
  minimumObservations: 6,
  lookbackObservations: 12,
  momentumThresholdPercent: 0.35,
  averageDeviationThresholdPercent: 0.15,
  minimumMovementPercent: 0.05,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validObservations(observations: readonly PriceObservation[]): PriceObservation[] {
  const unique = new Map<number, PriceObservation>();
  observations.forEach((observation) => {
    const timestamp = Date.parse(observation.timestamp);
    if (!Number.isFinite(timestamp) || !Number.isFinite(observation.price) || observation.price <= 0) return;
    unique.set(timestamp, { timestamp: new Date(timestamp).toISOString(), price: observation.price });
  });
  return [...unique.entries()].sort(([left], [right]) => left - right).map(([, observation]) => observation);
}

function percent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function emptyMetrics(observationCount: number): MomentumMetrics {
  return { observationCount, currentPrice: null, recentAverage: null, shortTermChangePercent: null, differenceFromAveragePercent: null, direction: "FLAT" };
}

export function evaluateMomentum(
  observations: readonly PriceObservation[],
  config: Readonly<MomentumStrategyConfig> = momentumStrategyConfig,
): StrategyResult {
  const window = validObservations(observations).slice(-config.lookbackObservations);
  if (window.length < config.minimumObservations) {
    return { signal: "HOLD", confidence: 0, reason: `Only ${window.length} of ${config.minimumObservations} required valid price observations are available.`, metrics: emptyMetrics(window.length) };
  }

  const first = window[0];
  const latest = window.at(-1);
  if (!first || !latest || first.price <= 0) {
    return { signal: "HOLD", confidence: 0, reason: "The observation window is invalid, so no momentum decision was made.", metrics: emptyMetrics(window.length) };
  }

  const recentAverage = window.reduce((sum, observation) => sum + observation.price, 0) / window.length;
  if (!Number.isFinite(recentAverage) || recentAverage <= 0) {
    return { signal: "HOLD", confidence: 0, reason: "A valid recent average could not be calculated, so no momentum decision was made.", metrics: emptyMetrics(window.length) };
  }

  const shortTermChangePercent = ((latest.price - first.price) / first.price) * 100;
  const differenceFromAveragePercent = ((latest.price - recentAverage) / recentAverage) * 100;
  const direction = shortTermChangePercent > config.minimumMovementPercent ? "UP" : shortTermChangePercent < -config.minimumMovementPercent ? "DOWN" : "FLAT";
  const metrics: MomentumMetrics = { observationCount: window.length, currentPrice: latest.price, recentAverage, shortTermChangePercent, differenceFromAveragePercent, direction };
  const isBuy = shortTermChangePercent >= config.momentumThresholdPercent && differenceFromAveragePercent >= config.averageDeviationThresholdPercent;
  const isSell = shortTermChangePercent <= -config.momentumThresholdPercent && differenceFromAveragePercent <= -config.averageDeviationThresholdPercent;

  if (isBuy || isSell) {
    const momentumStrength = clamp(Math.abs(shortTermChangePercent) / config.momentumThresholdPercent, 1, 2);
    const averageStrength = clamp(Math.abs(differenceFromAveragePercent) / config.averageDeviationThresholdPercent, 1, 2);
    const confidence = Math.round(clamp(20 + momentumStrength * 25 + averageStrength * 25, 0, 100));
    const signal = isBuy ? "BUY" : "SELL";
    const relativePosition = differenceFromAveragePercent >= 0 ? "above" : "below";
    return { signal, confidence, reason: `Short-term momentum is ${percent(shortTermChangePercent)}, and price is ${Math.abs(differenceFromAveragePercent).toFixed(2)}% ${relativePosition} the recent average.`, metrics };
  }

  const directionalStrength = Math.max(Math.abs(shortTermChangePercent) / config.momentumThresholdPercent, Math.abs(differenceFromAveragePercent) / config.averageDeviationThresholdPercent);
  const confidence = Math.round(clamp(65 - directionalStrength * 25, 25, 65));
  const reason = direction === "FLAT"
    ? `Momentum is nearly flat at ${percent(shortTermChangePercent)}, so the agent is waiting.`
    : `Short-term change is ${percent(shortTermChangePercent)} and price is ${percent(differenceFromAveragePercent)} from its recent average; both confirmation thresholds were not met.`;
  return { signal: "HOLD", confidence, reason, metrics };
}
