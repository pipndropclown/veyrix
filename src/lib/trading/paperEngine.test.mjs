import assert from "node:assert/strict";
import test from "node:test";
import { processPaperEvaluation } from "./paperEngine.ts";
import { calculatePortfolioMetrics, createInitialPaperPortfolio, restorePaperPortfolio } from "./paperPortfolio.ts";

const time = (minute) => new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString();
const evaluation = (signal, price, minute = 0) => ({ observationTimestamp: time(minute), price, signal, confidence: 80, reason: `${signal} test signal`, tradingDay: "2026-01-01" });
const buy = (price = 100) => processPaperEvaluation(createInitialPaperPortfolio(), evaluation("BUY", price)).portfolio;

test("starting portfolio is exactly 10,000 USDC and flat", () => {
  const portfolio = createInitialPaperPortfolio();
  assert.equal(portfolio.availableUsdc, 10_000);
  assert.equal(portfolio.solBalance, 0);
  assert.equal(portfolio.realizedPnl, 0);
});

test("BUY from flat deducts 10%, receives SOL, and opens one trade", () => {
  const portfolio = buy(100);
  assert.equal(portfolio.availableUsdc, 9_000);
  assert.equal(portfolio.solBalance, 10);
  assert.equal(portfolio.trades.length, 1);
  assert.equal(portfolio.trades[0].status, "OPEN");
});

test("BUY while long does not execute another trade", () => {
  const result = processPaperEvaluation(buy(), evaluation("BUY", 101, 1));
  assert.equal(result.outcome, "SKIPPED");
  assert.equal(result.portfolio.trades.length, 1);
  assert.equal(result.portfolio.solBalance, 10);
});

test("SELL while long closes the entire position and calculates profit", () => {
  const portfolio = processPaperEvaluation(buy(100), evaluation("SELL", 110, 1)).portfolio;
  assert.equal(portfolio.solBalance, 0);
  assert.equal(portfolio.availableUsdc, 10_100);
  assert.equal(portfolio.trades[0].status, "CLOSED");
  assert.equal(portfolio.trades[0].realizedPnl, 100);
  assert.equal(portfolio.trades[0].pnlPercent, 10);
});

test("profitable trade updates realized P&L and wins", () => {
  const portfolio = processPaperEvaluation(buy(100), evaluation("SELL", 105, 1)).portfolio;
  assert.equal(portfolio.realizedPnl, 50);
  assert.equal(portfolio.winningTrades, 1);
  assert.equal(portfolio.losingTrades, 0);
});

test("losing trade updates realized P&L and losses", () => {
  const portfolio = processPaperEvaluation(buy(100), evaluation("SELL", 90, 1)).portfolio;
  assert.equal(portfolio.realizedPnl, -100);
  assert.equal(portfolio.winningTrades, 0);
  assert.equal(portfolio.losingTrades, 1);
});

test("SELL while flat performs no trade", () => {
  const result = processPaperEvaluation(createInitialPaperPortfolio(), evaluation("SELL", 100));
  assert.equal(result.outcome, "SKIPPED");
  assert.equal(result.portfolio.solBalance, 0);
  assert.equal(result.portfolio.trades.length, 0);
});

test("HOLD performs no transaction", () => {
  const result = processPaperEvaluation(createInitialPaperPortfolio(), evaluation("HOLD", 100));
  assert.equal(result.outcome, "NO_ACTION");
  assert.equal(result.portfolio.availableUsdc, 10_000);
  assert.equal(result.portfolio.trades.length, 0);
});

test("duplicate strategy evaluation cannot execute twice", () => {
  const first = processPaperEvaluation(createInitialPaperPortfolio(), evaluation("BUY", 100));
  const duplicate = processPaperEvaluation(first.portfolio, evaluation("BUY", 100));
  assert.equal(duplicate.outcome, "DUPLICATE");
  assert.strictEqual(duplicate.portfolio, first.portfolio);
  assert.equal(duplicate.portfolio.trades.length, 1);
});

test("malformed balances safely reset and metrics stay finite", () => {
  const malformed = { ...createInitialPaperPortfolio(), availableUsdc: Number.NaN, solBalance: -1 };
  const restored = restorePaperPortfolio(malformed);
  assert.equal(restored.availableUsdc, 10_000);
  assert.equal(restored.solBalance, 0);
  Object.values(calculatePortfolioMetrics(restored, Number.POSITIVE_INFINITY)).forEach((value) => {
    if (typeof value === "number") assert.ok(Number.isFinite(value) && value >= 0);
  });
});

test("win rate uses completed trades", () => {
  let portfolio = processPaperEvaluation(buy(100), evaluation("SELL", 110, 1)).portfolio;
  portfolio = processPaperEvaluation(portfolio, evaluation("BUY", 100, 2)).portfolio;
  portfolio = processPaperEvaluation(portfolio, evaluation("SELL", 90, 3)).portfolio;
  const metrics = calculatePortfolioMetrics(portfolio, 90);
  assert.equal(metrics.completedTrades, 2);
  assert.equal(metrics.winRate, 50);
});

test("unrealized P&L marks an open position to market", () => {
  const metrics = calculatePortfolioMetrics(buy(100), 110);
  assert.equal(metrics.solPositionValue, 1_100);
  assert.equal(metrics.unrealizedPnl, 100);
  assert.equal(metrics.unrealizedPnlPercent, 10);
  assert.equal(metrics.totalPortfolioValue, 10_100);
});
