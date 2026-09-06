import assert from"node:assert/strict";import test from"node:test";import{calculateValidationAgreement}from"./validationAnalytics.ts";
const method=(ret,profitable,beat,robust)=>({averageOutOfSampleReturnPercent:ret,profitableFoldPercent:profitable,matchedBenchmarkBeatRatePercent:beat,averageRobustnessScore:robust});
test("similar validation methods produce high agreement",()=>assert.ok(calculateValidationAgreement([method(1,60,50,70),method(1.1,62,52,72),method(.9,58,48,68)])>85));
test("conflicting validation results reduce agreement",()=>assert.ok(calculateValidationAgreement([method(5,100,100,90),method(-5,0,0,20)])<30));
test("missing method metrics are handled safely",()=>assert.equal(calculateValidationAgreement([method(1,50,50,50)]),null));
test("agreement stays inside zero to one hundred",()=>{assert.equal(calculateValidationAgreement([method(100,100,100,100),method(-100,0,0,0)]),0);assert.ok(calculateValidationAgreement([method(0,0,0,0),method(0,0,0,0)])<=100)});
test("one extreme method cannot dominate the complete weighting",()=>assert.ok(calculateValidationAgreement([method(1,60,60,70),method(1,60,60,70),method(20,60,60,70)])>=70));
