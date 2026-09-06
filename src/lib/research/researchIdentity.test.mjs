import assert from"node:assert/strict";import test from"node:test";import{canonicalize,createResearchRunId,researchVersions}from"./researchIdentity.ts";
const config=()=>({strategies:["momentum"],timeframe:"180D",anchor:"2026-09-01T00:00:00.000Z",validationMethod:"ALL",versions:{...researchVersions},execution:{feePercentPerSide:.1,slippagePercent:.05,collisionPolicy:"STOP_FIRST"},risk:{stopLossPercent:2,takeProfitPercent:4,positionSizePercent:10},validation:{embargoCandles:1,trainingCandles:120,testCandles:40},historical:{source:"Coinbase Exchange",pair:"SOL-USD",granularitySeconds:21600}});
test("equivalent configuration produces the same run ID",()=>assert.equal(createResearchRunId(config(),"data"),createResearchRunId(config(),"data")));
test("strategy change changes run ID",()=>{const b=config();b.strategies=["mean_reversion"];assert.notEqual(createResearchRunId(config(),"data"),createResearchRunId(b,"data"))});
test("fee change changes run ID",()=>{const b=config();b.execution.feePercentPerSide=.2;assert.notEqual(createResearchRunId(config(),"data"),createResearchRunId(b,"data"))});
test("validation version change changes run ID",()=>{const b=config();b.versions.validationModelVersion="next";assert.notEqual(createResearchRunId(config(),"data"),createResearchRunId(b,"data"))});
test("anchor change changes run ID",()=>{const b=config();b.anchor="2026-08-01T00:00:00.000Z";assert.notEqual(createResearchRunId(config(),"data"),createResearchRunId(b,"data"))});
test("canonical object key order does not alter ID",()=>assert.equal(canonicalize({b:2,a:{d:4,c:3}}),canonicalize({a:{c:3,d:4},b:2})));
test("invalid identity configuration fails safely",()=>assert.throws(()=>createResearchRunId({},""),/Invalid research identity/));
