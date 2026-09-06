import assert from "node:assert/strict";
import test from "node:test";
import { processPaperEvaluation } from "./paperEngine.ts";
import { createInitialPaperPortfolio, restorePaperPortfolio } from "./paperPortfolio.ts";
import { calculatePositionRisk, evaluatePositionRisk } from "./riskEngine.ts";

const at = (day, minute = 0) => `${day}T00:${String(minute).padStart(2, "0")}:00.000Z`;
const evaluation = (signal, price, day = "2026-01-01", minute = 0) => ({ observationTimestamp: at(day, minute), tradingDay: day, price, signal, confidence: 80, reason: `${signal} test` });
const buy = () => processPaperEvaluation(createInitialPaperPortfolio("2026-01-01"), evaluation("BUY", 100)).portfolio;

test("risk levels use configured 2% stop and 4% target", () => {
  assert.deepEqual(calculatePositionRisk(100), { entryPrice: 100, stopLossPrice: 98, takeProfitPrice: 104 });
});

test("stop loss triggers at or below its level independently of strategy", () => {
  const trade = buy().trades[0];
  assert.equal(evaluatePositionRisk(trade, 98)?.reason, "STOP_LOSS");
  const result = processPaperEvaluation(buy(), evaluation("BUY", 98, "2026-01-01", 1));
  assert.equal(result.portfolio.trades[0].exitReason, "STOP_LOSS");
  assert.equal(result.portfolio.solBalance, 0);
});

test("take profit triggers at or above its level independently of strategy", () => {
  const result = processPaperEvaluation(buy(), evaluation("HOLD", 104, "2026-01-01", 1));
  assert.equal(result.portfolio.trades[0].exitReason, "TAKE_PROFIT");
  assert.equal(result.portfolio.realizedPnl, 40);
});

test("stop loss has priority over strategy SELL", () => {
  const result = processPaperEvaluation(buy(), evaluation("SELL", 97, "2026-01-01", 1));
  assert.equal(result.portfolio.trades[0].exitReason, "STOP_LOSS");
});

test("strategy SELL inside risk levels records strategy exit", () => {
  const result = processPaperEvaluation(buy(), evaluation("SELL", 101, "2026-01-01", 1));
  assert.equal(result.portfolio.trades[0].exitReason, "STRATEGY_SIGNAL");
});

test("a risk exit cannot execute twice for the same observation", () => {
  const first = processPaperEvaluation(buy(), evaluation("HOLD", 98, "2026-01-01", 1));
  const duplicate = processPaperEvaluation(first.portfolio, evaluation("HOLD", 98, "2026-01-01", 1));
  assert.equal(duplicate.outcome, "DUPLICATE");
  assert.equal(duplicate.portfolio.completedTrades, 1);
});

test("daily loss threshold pauses new entries", () => {
  const nearLimit = { ...buy(), dailyRealizedPnl: -290 };
  const stopped = processPaperEvaluation(nearLimit, evaluation("HOLD", 98, "2026-01-01", 1)).portfolio;
  assert.equal(stopped.dailyRealizedPnl, -310);
  assert.equal(stopped.tradingPausedForDay, true);
  const skipped = processPaperEvaluation(stopped, evaluation("BUY", 100, "2026-01-01", 2));
  assert.equal(skipped.outcome, "SKIPPED");
  assert.equal(skipped.portfolio.trades.length, 1);
});

test("paused trading still permits an existing position to close", () => {
  const pausedLong = { ...buy(), tradingPausedForDay: true, dailyRealizedPnl: -300 };
  const result = processPaperEvaluation(pausedLong, evaluation("SELL", 101, "2026-01-01", 1));
  assert.equal(result.outcome, "EXECUTED");
  assert.equal(result.portfolio.solBalance, 0);
});

test("daily guard resets when the local trading day changes", () => {
  const paused = { ...createInitialPaperPortfolio("2026-01-01"), tradingPausedForDay: true, dailyRealizedPnl: -300 };
  const result = processPaperEvaluation(paused, evaluation("HOLD", 100, "2026-01-02"));
  assert.equal(result.portfolio.tradingDay, "2026-01-02");
  assert.equal(result.portfolio.dailyRealizedPnl, 0);
  assert.equal(result.portfolio.tradingPausedForDay, false);
  assert.equal(result.portfolio.activity[0].title, "Daily trading guard reset for new day");
});

test("V0.4 persisted trades migrate to strategy exit reasons", () => {
  const closed = processPaperEvaluation(buy(), evaluation("SELL", 101, "2026-01-01", 1)).portfolio;
  const legacyTrades = closed.trades.map((trade) => {
    const legacyTrade = { ...trade };
    delete legacyTrade.exitReason;
    return legacyTrade;
  });
  const legacy = { ...closed, trades: legacyTrades, tradingDay: undefined, dailyRealizedPnl: undefined, tradingPausedForDay: undefined };
  const restored = restorePaperPortfolio(legacy, "2026-01-01");
  assert.equal(restored.trades[0].exitReason, "STRATEGY_SIGNAL");
  assert.equal(restored.dailyRealizedPnl, 10);
});
