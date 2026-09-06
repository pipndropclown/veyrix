import type { BacktestConfig,BacktestResult,HistoricalCandle } from "./backtesting";import type { StrategyDefinition,StrategyId } from "./strategy";
export interface ParameterDefinition{key:string;displayName:string;defaultValue:number;minimum:number;maximum:number;step:number;values:readonly number[]}
export interface StrategyParameterSchema{strategyId:StrategyId;parameters:readonly ParameterDefinition[];validate(values:Readonly<Record<string,number>>):boolean;createStrategy(values:Readonly<Record<string,number>>):StrategyDefinition}
export interface SensitivityRun{parameters:Record<string,number>;result:BacktestResult;veyrixScore:number}
export interface SensitivityReport{strategyId:StrategyId;runs:SensitivityRun[];defaultRun:SensitivityRun|null;highestReturn:SensitivityRun|null;highestScore:SensitivityRun|null;lowestDrawdown:SensitivityRun|null;parameterStability:number;neighborCount:number}
export type OverfittingRisk="LOW"|"MODERATE"|"HIGH"|"UNAVAILABLE";
export interface WalkForwardReport{strategyId:StrategyId;splitIndex:number;inSampleCandles:number;outOfSampleCandles:number;selectedParameters:Record<string,number>|null;inSample:SensitivityRun|null;outOfSample:BacktestResult|null;outOfSampleScore:number|null;returnDecayPercent:number|null;scoreDecay:number|null;parameterStability:number|null;overfittingRisk:OverfittingRisk;robustnessScore:number|null;defaultThirtyDayResult:BacktestResult|null}
export interface RobustnessArenaEntry{strategyId:StrategyId;strategyName:string;report:WalkForwardReport}
export interface RobustnessArenaResult{entries:RobustnessArenaEntry[];ranked:RobustnessArenaEntry[];candleCount:number}
export interface SensitivityInput{candles:readonly HistoricalCandle[];strategyId:StrategyId;config:Readonly<BacktestConfig>}
