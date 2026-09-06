import { processPaperEvaluation } from "./paperEngine.ts";
import { localTradingDay } from "./paperPortfolio.ts";
import type { PaperPortfolioState } from "@/types/trading";

export type ManualTradeResult = ReturnType<typeof processPaperEvaluation> & {
  error: string | null;
};
export function manualBuy(
  portfolio: PaperPortfolioState,
  amountUsdc: number,
  price: number,
  timestamp = new Date().toISOString(),
): ManualTradeResult {
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0)
    return {
      portfolio,
      outcome: "SKIPPED",
      executionId: "manual-invalid",
      error: "Enter a valid virtual USDC amount.",
    };
  if (amountUsdc > portfolio.availableUsdc)
    return {
      portfolio,
      outcome: "SKIPPED",
      executionId: "manual-insufficient",
      error: "Insufficient virtual USDC.",
    };
  if (
    portfolio.solBalance > 0 ||
    portfolio.trades.some((trade) => trade.status === "OPEN")
  )
    return {
      portfolio,
      outcome: "SKIPPED",
      executionId: "manual-long",
      error: "Only one paper position may be open.",
    };
  if (!Number.isFinite(price) || price <= 0)
    return {
      portfolio,
      outcome: "SKIPPED",
      executionId: "manual-price",
      error: "Live SOL price is unavailable.",
    };
  const id = `manual-buy:${timestamp}`;
  const quantity = amountUsdc / price;
  const trade = {
    id: `PT-M-${timestamp.replace(/\D/g, "")}`,
    executionId: id,
    pair: "SOL/USDC" as const,
    side: "BUY" as const,
    entryTimestamp: timestamp,
    exitTimestamp: null,
    entryPrice: price,
    exitPrice: null,
    solQuantity: quantity,
    positionSizeUsdc: amountUsdc,
    exitValueUsdc: null,
    realizedPnl: null,
    pnlPercent: null,
    strategySignal: "BUY" as const,
    confidence: 100,
    strategyReason: "Manual paper trade confirmed by user.",
    status: "OPEN" as const,
    exitReason: null,
    source: "MANUAL" as const,
    strategyId: null,
    strategyName: null,
    automationTimeframe: null,
    signalCandleTimestamp: null,
    marketType: "SPOT" as const,
  };
  const event = {
    id: `${id}:executed`,
    time: new Date(timestamp).toLocaleTimeString("en-US", { hour12: false }),
    title: `Manual paper BUY executed at $${price.toFixed(2)}`,
    description: `${quantity.toFixed(6)} virtual SOL purchased with $${amountUsdc.toFixed(2)} virtual USDC.`,
    type: "trade" as const,
  };
  return {
    portfolio: {
      ...portfolio,
      availableUsdc: portfolio.availableUsdc - amountUsdc,
      solBalance: quantity,
      averageSolEntryPrice: price,
      trades: [trade, ...portfolio.trades],
      processedEvaluationIds: [...portfolio.processedEvaluationIds, id],
      activity: [event, ...portfolio.activity].slice(0, 50),
    },
    outcome: "EXECUTED",
    executionId: id,
    error: null,
  };
}
export function manualSellAll(
  portfolio: PaperPortfolioState,
  price: number,
  timestamp = new Date().toISOString(),
): ManualTradeResult {
  if (!Number.isFinite(price) || price <= 0)
    return {
      portfolio,
      outcome: "SKIPPED",
      executionId: "manual-price",
      error: "Live SOL price is unavailable.",
    };
  if (portfolio.solBalance <= 0)
    return {
      portfolio,
      outcome: "SKIPPED",
      executionId: "manual-flat",
      error: "No paper SOL position is open.",
    };
  const result = processPaperEvaluation(portfolio, {
    observationTimestamp: timestamp,
    price,
    signal: "SELL",
    confidence: 100,
    reason: "Manual SELL ALL confirmed by user.",
    tradingDay: localTradingDay(new Date(timestamp)),
    executionId: `manual-sell:${timestamp}`,
    source: "MANUAL",
  });
  return {
    ...result,
    error:
      result.outcome === "EXECUTED"
        ? null
        : "Manual paper exit could not be completed.",
  };
}

export function monitorPaperRisk(
  portfolio: PaperPortfolioState,
  price: number,
  timestamp = new Date().toISOString(),
) {
  return processPaperEvaluation(portfolio, {
    observationTimestamp: timestamp,
    price,
    signal: "HOLD",
    confidence: 0,
    reason: "Live stop-loss and take-profit monitoring.",
    tradingDay: localTradingDay(new Date(timestamp)),
    executionId: `risk:${timestamp}`,
  });
}
