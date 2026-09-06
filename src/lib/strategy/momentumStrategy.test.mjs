import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMomentum } from "./momentumStrategy.ts";

function observations(prices) {
  return prices.map((price, index) => ({ timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(), price }));
}

test("rising prices generate BUY", () => {
  assert.equal(evaluateMomentum(observations([100, 100.1, 100.2, 100.3, 100.5, 100.8])).signal, "BUY");
});

test("falling prices generate SELL", () => {
  assert.equal(evaluateMomentum(observations([100.8, 100.5, 100.3, 100.2, 100.1, 100])).signal, "SELL");
});

test("flat prices generate HOLD", () => {
  assert.equal(evaluateMomentum(observations([100, 100, 100, 100, 100, 100])).signal, "HOLD");
});

test("insufficient history generates HOLD", () => {
  const result = evaluateMomentum(observations([100, 101, 102]));
  assert.equal(result.signal, "HOLD");
  assert.equal(result.confidence, 0);
});

test("confidence is always clamped between 0 and 100", () => {
  [[100, 150, 200, 250, 300, 500], [500, 300, 250, 200, 150, 100], [100, 100, 100, 100, 100, 100]].forEach((prices) => {
    const { confidence } = evaluateMomentum(observations(prices));
    assert.ok(confidence >= 0 && confidence <= 100);
  });
});

test("invalid and duplicate observations do not inflate history", () => {
  const duplicate = { timestamp: "2026-01-01T00:00:00.000Z", price: 101 };
  const result = evaluateMomentum([duplicate, duplicate, { timestamp: "invalid", price: 100 }, { timestamp: "2026-01-01T00:01:00.000Z", price: 0 }]);
  assert.equal(result.signal, "HOLD");
  assert.equal(result.metrics.observationCount, 1);
});
