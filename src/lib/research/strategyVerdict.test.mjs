import assert from"node:assert/strict";import test from"node:test";import{classifyStrategyVerdict}from"./researchReport.ts";
const base={oosReturn:2,profitableRate:65,matchedBeatRate:60,robustness:75,overfittingRate:10,confidence:"HIGHER",reliability:"PROMISING",regimeReturns:[2,1,.5]};
test("strong historical and evidence metrics produce PROMISING",()=>assert.equal(classifyStrategyVerdict(base),"PROMISING"));
test("opposing regime results produce REGIME_DEPENDENT",()=>assert.equal(classifyStrategyVerdict({...base,oosReturn:.5,profitableRate:50,regimeReturns:[3,-2,0]}),"REGIME_DEPENDENT"));
test("weak performance produces WEAK",()=>assert.equal(classifyStrategyVerdict({...base,oosReturn:-2,profitableRate:20,matchedBeatRate:20}),"WEAK"));
test("mixed evidence produces INCONCLUSIVE",()=>assert.equal(classifyStrategyVerdict({...base,oosReturn:.1,profitableRate:50,matchedBeatRate:50,robustness:50,confidence:"MODERATE"}),"INCONCLUSIVE"));
test("verdict is deterministic",()=>assert.equal(classifyStrategyVerdict(base),classifyStrategyVerdict(base)));
test("missing metrics fail safely",()=>assert.equal(classifyStrategyVerdict({...base,oosReturn:null}),"INCONCLUSIVE"));
