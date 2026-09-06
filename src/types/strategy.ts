import type { Signal } from "@/types";
import type { PriceObservation } from "./market";
export type StrategyId="momentum"|"moving_average"|"mean_reversion";
export interface GenericStrategyResult{signal:Signal;confidence:number;reason:string;metrics:Record<string,number|string|null>}
export interface StrategyDefinition{readonly id:StrategyId;readonly name:string;readonly description:string;readonly minimumObservations:number;readonly maximumObservations?:number;readonly configuration:Readonly<Record<string,number|string>>;evaluate(observations:readonly PriceObservation[]):GenericStrategyResult}
export interface MovingAverageConfig{fastPeriod:number;slowPeriod:number}
export interface MeanReversionConfig{lookbackPeriod:number;buyDeviationPercent:number;sellDeviationPercent:number}

export interface MomentumStrategyConfig {
  minimumObservations: number;
  lookbackObservations: number;
  momentumThresholdPercent: number;
  averageDeviationThresholdPercent: number;
  minimumMovementPercent: number;
}

export interface MomentumMetrics {
  observationCount: number;
  currentPrice: number | null;
  recentAverage: number | null;
  shortTermChangePercent: number | null;
  differenceFromAveragePercent: number | null;
  direction: "UP" | "DOWN" | "FLAT";
}

export interface StrategyResult {
  signal: Signal;
  confidence: number;
  reason: string;
  metrics: MomentumMetrics;
}
