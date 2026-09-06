import assert from"node:assert/strict";import test from"node:test";import{calculateConclusionDrift}from"./researchReport.ts";import{reportInput}from"./researchReportFixtures.mjs";
const summary=(day,top="momentum",beat=55,reliability="STABLE")=>({...reportInput().summary,createdAt:`2026-01-0${day}T00:00:00Z`,topStrategy:top,matchedBenchmarkBeatRatePercent:beat,temporalReliability:reliability});
test("same leaders across runs are STABLE",()=>assert.equal(calculateConclusionDrift([summary(1),summary(2),summary(3)]),"STABLE"));
test("some ranking changes are CHANGING",()=>assert.equal(calculateConclusionDrift([summary(1),summary(2,"moving_average"),summary(3,"moving_average")]),"CHANGING"));
test("frequent contradictory conclusions are HIGHLY_VARIABLE",()=>assert.equal(calculateConclusionDrift([summary(1,"momentum",10),summary(2,"moving_average",90,"UNSTABLE"),summary(3,"mean_reversion",5)]),"HIGHLY_VARIABLE"));
test("fewer than three runs is INSUFFICIENT_DATA",()=>assert.equal(calculateConclusionDrift([summary(1),summary(2)]),"INSUFFICIENT_DATA"));
