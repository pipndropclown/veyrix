import assert from"node:assert/strict";import test from"node:test";import{buildFailureProfile}from"./researchReport.ts";import{strategy}from"./researchReportFixtures.mjs";
test("stop-loss losses aggregate",()=>assert.equal(buildFailureProfile(strategy()).stopLossUsd,80));
test("strategy-exit losses aggregate",()=>assert.equal(buildFailureProfile(strategy()).strategySignalLossUsd,20));
test("fee attribution aggregates",()=>assert.equal(buildFailureProfile(strategy()).feesUsd,10));
test("slippage attribution aggregates",()=>assert.equal(buildFailureProfile(strategy()).slippageUsd,5));
test("worst regime is identified",()=>assert.equal(buildFailureProfile(strategy()).weakestRegime,"BEARISH"));
test("worst fold remains the first retained sorted failure",()=>assert.equal(buildFailureProfile(strategy()).worstFold.strategyReturnPercent,-2));
test("failure wording avoids unsupported causation",()=>{const text=buildFailureProfile(strategy()).statements.join(" ").toLowerCase();assert.doesNotMatch(text,/caused|because of|will/)});
