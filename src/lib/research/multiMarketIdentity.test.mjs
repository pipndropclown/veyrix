import assert from "node:assert/strict";import test from "node:test";import{createResearchRunId}from"./researchIdentity.ts";
const base={strategies:["momentum"],timeframe:"180D",anchor:"2026-01-01T00:00:00Z",validationMethod:"ALL",versions:{},execution:{},risk:{},validation:{},historical:{source:"Coinbase Exchange",pair:"SOL-USD",granularitySeconds:21600}};
test("research identity includes market",()=>assert.notEqual(createResearchRunId({...base,marketId:"BTC"},"same"),createResearchRunId({...base,marketId:"ETH"},"same")));
test("legacy SOL research identity remains readable",()=>assert.match(createResearchRunId(base,"same"),/^VRX-/));
