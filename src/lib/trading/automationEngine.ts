import {
  automationCandleId,
  closedCandles,
  LIVE_TIMEFRAMES,
  nextCandleClose,
} from "../market/liveCandles.ts";
import { getStrategy } from "../strategy/strategyRegistry.ts";
import { processPaperEvaluation } from "./paperEngine.ts";
import { appendActivity, localTradingDay } from "./paperPortfolio.ts";
import type { HistoricalCandle } from "@/types/backtesting";
import type {
  AutomationSettings,
  AutomationStatus,
  LiveTimeframe,
} from "@/types/liveTrading";
import type { PaperPortfolioState } from "@/types/trading";
import type { ActivityItem } from "@/types";

export const AUTOMATION_STORAGE_KEY = "veyrix.automation.v1";
const MAX_AUTOMATION_IDS = 500;
export const DEFAULT_AUTOMATION: AutomationSettings = {
  version: 1,
  enabled: false,
  strategyId: "momentum",
  timeframe: "15m",
  lastProcessedCandleId: null,
  processedCandleIds: [],
};

export function restoreAutomationSettings(value: unknown): AutomationSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_AUTOMATION };
  const raw = value as Partial<AutomationSettings>;
  const ids = Array.isArray(raw.processedCandleIds)
    ? raw.processedCandleIds
        .filter((id): id is string => typeof id === "string")
        .slice(-MAX_AUTOMATION_IDS)
    : [];
  const strategies = ["momentum", "moving_average", "mean_reversion"];
  const timeframes = Object.keys(LIVE_TIMEFRAMES);
  if (
    raw.version !== 1 ||
    typeof raw.enabled !== "boolean" ||
    !strategies.includes(raw.strategyId ?? "") ||
    !timeframes.includes(raw.timeframe ?? "")
  )
    return { ...DEFAULT_AUTOMATION };
  return {
    version: 1,
    enabled: raw.enabled,
    strategyId: raw.strategyId!,
    timeframe: raw.timeframe!,
    lastProcessedCandleId:
      typeof raw.lastProcessedCandleId === "string"
        ? raw.lastProcessedCandleId
        : null,
    processedCandleIds: ids,
  } as AutomationSettings;
}

function activity(
  id: string,
  timestamp: string,
  title: string,
  description: string,
  type: ActivityItem["type"],
): ActivityItem {
  return {
    id,
    time: new Date(timestamp).toLocaleTimeString("en-US", { hour12: false }),
    title,
    description,
    type,
  };
}

export interface AutomationEvaluationResult {
  portfolio: PaperPortfolioState;
  settings: AutomationSettings;
  status: AutomationStatus;
  outcome:
    | "EXECUTED"
    | "SKIPPED"
    | "NO_ACTION"
    | "DUPLICATE"
    | "DISABLED"
    | "NO_CLOSED_CANDLE";
}

export function evaluateAutomation(input: {
  portfolio: PaperPortfolioState;
  settings: AutomationSettings;
  candles: readonly HistoricalCandle[];
  now?: number;
}): AutomationEvaluationResult {
  const now = input.now ?? Date.now();
  const baseStatus: AutomationStatus = {
    signal: null,
    lastEvaluatedCandle: null,
    lastEvaluationTime: null,
    lastExecution: null,
    nextExpectedClose: nextCandleClose(input.settings.timeframe, now),
  };
  if (!input.settings.enabled)
    return {
      portfolio: input.portfolio,
      settings: input.settings,
      status: baseStatus,
      outcome: "DISABLED",
    };
  const available = closedCandles(input.candles, input.settings.timeframe, now);
  const latest = available.at(-1);
  if (!latest)
    return {
      portfolio: input.portfolio,
      settings: input.settings,
      status: baseStatus,
      outcome: "NO_CLOSED_CANDLE",
    };
  const id = automationCandleId(
    input.settings.strategyId,
    input.settings.timeframe,
    latest.timestamp,
  );
  if (input.settings.processedCandleIds.includes(id))
    return {
      portfolio: input.portfolio,
      settings: input.settings,
      status: { ...baseStatus, lastEvaluatedCandle: latest.timestamp },
      outcome: "DUPLICATE",
    };
  const strategy = getStrategy(input.settings.strategyId);
  const observations = available.map((candle) => ({
    timestamp: candle.timestamp,
    price: candle.close,
  }));
  const decision = strategy.evaluate(observations);
  const execution = processPaperEvaluation(input.portfolio, {
    observationTimestamp: latest.timestamp,
    price: latest.close,
    signal: decision.signal,
    confidence: decision.confidence,
    reason: decision.reason,
    tradingDay: localTradingDay(new Date(latest.timestamp)),
    executionId: id,
    source: "AUTONOMOUS",
    strategyId: strategy.id,
    strategyName: strategy.name,
    automationTimeframe: input.settings.timeframe,
    signalCandleTimestamp: latest.timestamp,
  });
  const event = activity(
    `${id}:candle`,
    latest.timestamp,
    `${input.settings.timeframe} candle closed`,
    `${strategy.name} evaluated: ${decision.signal} — ${decision.reason}`,
    "analysis",
  );
  const portfolio = {
    ...execution.portfolio,
    activity: appendActivity(execution.portfolio, [event]),
  };
  const settings = {
    ...input.settings,
    lastProcessedCandleId: id,
    processedCandleIds: [...input.settings.processedCandleIds, id].slice(
      -MAX_AUTOMATION_IDS,
    ),
  };
  return {
    portfolio,
    settings,
    status: {
      signal: decision,
      lastEvaluatedCandle: latest.timestamp,
      lastEvaluationTime: new Date(now).toISOString(),
      lastExecution:
        execution.outcome === "EXECUTED"
          ? `${decision.signal} @ $${latest.close.toFixed(2)}`
          : `${decision.signal} — ${execution.outcome}`,
      nextExpectedClose: nextCandleClose(input.settings.timeframe, now),
    },
    outcome: execution.outcome,
  };
}

export function chartTimeframeDoesNotChangeAutomation(
  settings: AutomationSettings,
  _chartTimeframe: LiveTimeframe,
): AutomationSettings {
  void _chartTimeframe;
  return settings;
}
