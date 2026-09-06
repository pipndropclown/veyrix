import { evaluatePositionRisk } from "./riskEngine.ts";
import { appendActivity, appendExecutionId, calculatePortfolioMetrics, dailyLossLimitUsd } from "./paperPortfolio.ts";
import { paperTradingConfig } from "./tradingConfig.ts";
import type { ActivityItem } from "@/types";
import type { PaperEngineResult, PaperEvaluation, PaperPortfolioState, PaperTrade, TradeExitReason } from "@/types/trading";

function validEvaluation(evaluation: PaperEvaluation): boolean {
  return Number.isFinite(evaluation.price) && evaluation.price > 0 && Number.isFinite(Date.parse(evaluation.observationTimestamp))
    && Number.isFinite(evaluation.confidence) && evaluation.confidence >= 0 && evaluation.confidence <= 100
    && /^\d{4}-\d{2}-\d{2}$/.test(evaluation.tradingDay);
}

function event(id: string, timestamp: string, title: string, description: string, type: ActivityItem["type"]): ActivityItem {
  const time = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(timestamp));
  return { id, time, title, description, type };
}

function money(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
export function createExecutionId(evaluation: PaperEvaluation): string { return evaluation.executionId ?? `${evaluation.observationTimestamp}:${evaluation.signal}`; }

function rollTradingDay(portfolio: PaperPortfolioState, evaluation: PaperEvaluation): PaperPortfolioState {
  if (portfolio.tradingDay === evaluation.tradingDay) return portfolio;
  const reset = event(`${evaluation.tradingDay}:daily-reset`, evaluation.observationTimestamp, "Daily trading guard reset for new day", `Daily realized P&L and the ${paperTradingConfig.maxDailyLossPercent}% loss guard were reset for ${evaluation.tradingDay}.`, "system");
  return { ...portfolio, tradingDay: evaluation.tradingDay, dailyRealizedPnl: 0, tradingPausedForDay: false, activity: appendActivity(portfolio, [reset]) };
}

function closePosition(portfolio: PaperPortfolioState, evaluation: PaperEvaluation, executionId: string, openTrade: PaperTrade, reason: TradeExitReason): PaperEngineResult {
  const exitValue = portfolio.solBalance * evaluation.price;
  if (!Number.isFinite(exitValue)) return { portfolio, outcome: "SKIPPED", executionId };
  const realizedPnl = exitValue - openTrade.positionSizeUsdc;
  const pnlPercent = openTrade.positionSizeUsdc > 0 ? (realizedPnl / openTrade.positionSizeUsdc) * 100 : 0;
  if (!Number.isFinite(realizedPnl) || !Number.isFinite(pnlPercent)) return { portfolio, outcome: "SKIPPED", executionId };

  const dailyRealizedPnl = portfolio.dailyRealizedPnl + realizedPnl;
  const tradingPausedForDay = portfolio.tradingPausedForDay || dailyRealizedPnl <= -dailyLossLimitUsd();
  const closedTrade: PaperTrade = { ...openTrade, exitTimestamp: evaluation.observationTimestamp, exitPrice: evaluation.price, exitValueUsdc: exitValue, realizedPnl, pnlPercent, exitReason: reason, status: "CLOSED" };
  const label = reason === "STOP_LOSS" ? "Stop loss" : reason === "TAKE_PROFIT" ? "Take profit" : "Strategy signal";
  const events: ActivityItem[] = [
    event(`${executionId}:portfolio`, evaluation.observationTimestamp, "Portfolio updated", "Virtual SOL proceeds returned to available USDC.", "system"),
    event(`${executionId}:closed`, evaluation.observationTimestamp, `Trade closed — ${label}`, `${realizedPnl >= 0 ? "+" : ""}${money(realizedPnl)} realized P&L (${pnlPercent.toFixed(2)}%).`, "trade"),
    event(`${executionId}:executed`, evaluation.observationTimestamp, reason === "STRATEGY_SIGNAL" ? `Paper SELL executed at ${money(evaluation.price)}` : `Risk exit: ${label} triggered at ${money(evaluation.price)}`, `The entire ${portfolio.solBalance.toFixed(6)} SOL position was closed.`, "trade"),
  ];
  if (!portfolio.tradingPausedForDay && tradingPausedForDay) {
    events.unshift(event(`${executionId}:daily-limit`, evaluation.observationTimestamp, "Trading paused for the day", `Daily realized P&L reached ${money(dailyRealizedPnl)}, meeting the ${money(dailyLossLimitUsd())} loss limit.`, "system"));
  }

  return {
    portfolio: {
      ...portfolio, availableUsdc: Math.max(0, portfolio.availableUsdc + exitValue), solBalance: 0, averageSolEntryPrice: null,
      realizedPnl: portfolio.realizedPnl + realizedPnl, dailyRealizedPnl, tradingPausedForDay,
      completedTrades: portfolio.completedTrades + 1,
      winningTrades: portfolio.winningTrades + (realizedPnl > 0 ? 1 : 0), losingTrades: portfolio.losingTrades + (realizedPnl < 0 ? 1 : 0),
      trades: portfolio.trades.map((trade) => trade.id === openTrade.id ? closedTrade : trade),
      processedEvaluationIds: appendExecutionId(portfolio, executionId), activity: appendActivity(portfolio, events),
    },
    outcome: "EXECUTED", executionId,
  };
}

export function processPaperEvaluation(inputPortfolio: PaperPortfolioState, evaluation: PaperEvaluation): PaperEngineResult {
  const executionId = createExecutionId(evaluation);
  if (!validEvaluation(evaluation)) return { portfolio: inputPortfolio, outcome: "NO_ACTION", executionId };
  const portfolio = rollTradingDay(inputPortfolio, evaluation);
  if (portfolio.processedEvaluationIds.includes(executionId)) return { portfolio, outcome: "DUPLICATE", executionId };

  const openTrade = portfolio.trades.find((trade) => trade.status === "OPEN");
  if (openTrade && portfolio.solBalance > 0) {
    const risk = evaluatePositionRisk(openTrade, evaluation.price);
    if (risk?.shouldExit && risk.reason) return closePosition(portfolio, evaluation, executionId, openTrade, risk.reason);
    if (evaluation.signal === "SELL") return closePosition(portfolio, evaluation, executionId, openTrade, "STRATEGY_SIGNAL");
  }

  const processedEvaluationIds = appendExecutionId(portfolio, executionId);
  if (evaluation.signal === "HOLD") return { portfolio: { ...portfolio, processedEvaluationIds }, outcome: "NO_ACTION", executionId };

  if (evaluation.signal === "BUY") {
    const detected = event(`${executionId}:detected`, evaluation.observationTimestamp, "BUY signal detected", evaluation.reason, "signal");
    if (portfolio.solBalance > 0 || openTrade) {
      const skipped = event(`${executionId}:skipped`, evaluation.observationTimestamp, "BUY skipped — position already open", "Only one long SOL position is permitted; averaging in is disabled.", "system");
      return { portfolio: { ...portfolio, processedEvaluationIds, activity: appendActivity(portfolio, [skipped, detected]) }, outcome: "SKIPPED", executionId };
    }
    if (portfolio.tradingPausedForDay) {
      const skipped = event(`${executionId}:skipped`, evaluation.observationTimestamp, "BUY skipped — daily loss limit reached", `New entries are paused until the local trading day changes. Daily P&L: ${money(portfolio.dailyRealizedPnl)}.`, "system");
      return { portfolio: { ...portfolio, processedEvaluationIds, activity: appendActivity(portfolio, [skipped, detected]) }, outcome: "SKIPPED", executionId };
    }

    const totalValue = calculatePortfolioMetrics(portfolio, evaluation.price).totalPortfolioValue;
    const allocation = Math.min(portfolio.availableUsdc, totalValue * (paperTradingConfig.positionSizePercent / 100));
    const solQuantity = allocation / evaluation.price;
    if (!Number.isFinite(allocation) || allocation <= 0 || !Number.isFinite(solQuantity) || solQuantity <= 0) {
      const skipped = event(`${executionId}:skipped`, evaluation.observationTimestamp, "BUY skipped — invalid virtual allocation", "The simulated allocation was outside safe numeric bounds.", "system");
      return { portfolio: { ...portfolio, processedEvaluationIds, activity: appendActivity(portfolio, [skipped, detected]) }, outcome: "SKIPPED", executionId };
    }

    const trade: PaperTrade = {
      id: `PT-${evaluation.observationTimestamp.replace(/\D/g, "")}`, executionId, pair: "SOL/USDC", side: "BUY",
      entryTimestamp: evaluation.observationTimestamp, exitTimestamp: null, entryPrice: evaluation.price, exitPrice: null,
      solQuantity, positionSizeUsdc: allocation, exitValueUsdc: null, realizedPnl: null, pnlPercent: null, exitReason: null,
      strategySignal: "BUY", confidence: evaluation.confidence, strategyReason: evaluation.reason, status: "OPEN",
      source: evaluation.source ?? "AUTONOMOUS", strategyId: evaluation.strategyId ?? "momentum",
      strategyName: evaluation.strategyName ?? "Momentum Agent", automationTimeframe: evaluation.automationTimeframe ?? null,
      signalCandleTimestamp: evaluation.signalCandleTimestamp ?? evaluation.observationTimestamp, marketType: "SPOT",
    };
    const executed = event(`${executionId}:executed`, evaluation.observationTimestamp, `Paper BUY executed at ${money(evaluation.price)}`, `${solQuantity.toFixed(6)} virtual SOL purchased with ${money(allocation)}.`, "trade");
    return {
      portfolio: { ...portfolio, availableUsdc: Math.max(0, portfolio.availableUsdc - allocation), solBalance: solQuantity, averageSolEntryPrice: evaluation.price,
        trades: [trade, ...portfolio.trades], processedEvaluationIds, activity: appendActivity(portfolio, [executed, detected]) },
      outcome: "EXECUTED", executionId,
    };
  }

  const detected = event(`${executionId}:detected`, evaluation.observationTimestamp, "SELL signal detected", evaluation.reason, "signal");
  const skipped = event(`${executionId}:skipped`, evaluation.observationTimestamp, "SELL skipped — no open SOL position", "Short selling is disabled; the paper portfolio remains flat.", "system");
  return { portfolio: { ...portfolio, processedEvaluationIds, activity: appendActivity(portfolio, [skipped, detected]) }, outcome: "SKIPPED", executionId };
}
