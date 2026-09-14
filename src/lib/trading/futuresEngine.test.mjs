import assert from "node:assert/strict";
import test from "node:test";
import { closeFutures, futuresPnl, openFutures } from "./futuresEngine.ts";
import { calculatePortfolioMetrics, createInitialPaperPortfolio, restorePaperPortfolio } from "./paperPortfolio.ts";

const open = (side, leverage = 5) => openFutures(createInitialPaperPortfolio(), { side, leverage, marginUsdc: 1000, price: 100, stopLoss: null, takeProfit: null, timestamp: "2026-01-01T00:00:00.000Z" }).portfolio;

test("leverage changes actual virtual quantity, P&L and shared equity", () => {
  const state = open("LONG");
  const position = state.futuresTrades[0];
  assert.equal(state.availableUsdc, 9000);
  assert.equal(position.exposureUsdc, 5000);
  assert.equal(position.quantitySol, 50);
  assert.equal(futuresPnl(position, 110), 500);
  assert.equal(calculatePortfolioMetrics(state, 110).totalPortfolioValue, 10500);
  assert.equal(closeFutures(state, 110, "2026-01-01T00:01:00.000Z", true).availableUsdc, 10500);
});
test("short profits on a falling price and liquidates at margin loss", () => {
  const state = open("SHORT");
  assert.equal(futuresPnl(state.futuresTrades[0], 90), 500);
  const closed = closeFutures(state, 125);
  assert.equal(closed.availableUsdc, 9000);
  assert.equal(closed.futuresTrades[0].exitReason, "LIQUIDATION");
  assert.equal(closed.futuresTrades[0].realizedPnl, -1000);
});
test("old spot account restores with empty futures history", () => {
  const old = createInitialPaperPortfolio();
  delete old.futuresTrades;
  const restored = restorePaperPortfolio(old);
  assert.deepEqual(restored.futuresTrades, []);
  assert.equal(restored.availableUsdc, 10000);
});
test("futures margin cannot spend collateral already reserved", () => {
  const state = open("LONG");
  const result = openFutures(state, { side: "SHORT", leverage: 2, marginUsdc: 1000, price: 100, stopLoss: null, takeProfit: null, timestamp: "2026-01-01T00:01:00.000Z" });
  assert.ok(result.error);
  assert.equal(result.portfolio, state);
});
test("stop and target exits settle the marked virtual P&L", () => {
  const state = openFutures(createInitialPaperPortfolio("2026-01-01"), { side: "LONG", leverage: 2, marginUsdc: 1000, price: 100, stopLoss: 90, takeProfit: 120, timestamp: "2026-01-01T00:00:00.000Z" }).portfolio;
  assert.equal(closeFutures(state, 105, "2026-01-01T00:01:00.000Z"), state);
  const stopped = closeFutures(state, 90, "2026-01-01T00:02:00.000Z");
  assert.equal(stopped.futuresTrades[0].exitReason, "STOP_LOSS");
  assert.equal(stopped.availableUsdc, 9800);
  const target = closeFutures(state, 120, "2026-01-01T00:02:00.000Z");
  assert.equal(target.futuresTrades[0].exitReason, "TAKE_PROFIT");
  assert.equal(target.availableUsdc, 10400);
});
test("futures history survives account restore with reserved margin intact", () => {
  const state = open("LONG");
  const restored = restorePaperPortfolio(JSON.parse(JSON.stringify(state)), "2026-01-01");
  assert.equal(restored.availableUsdc, 9000);
  assert.equal(restored.futuresTrades[0].status, "OPEN");
  assert.equal(calculatePortfolioMetrics(restored, 100).totalPortfolioValue, 10000);
});
