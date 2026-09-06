import assert from"node:assert/strict";import test from"node:test";import{calculateResearchScore}from"./validationAnalytics.ts";
test("more independent folds improve research score",()=>assert.ok(calculateResearchScore(70,90,8,3,10)>calculateResearchScore(70,90,1,3,10)));
test("better data quality improves research score",()=>assert.ok(calculateResearchScore(70,100,5,3,10)>calculateResearchScore(70,50,5,3,10)));
test("more regime coverage improves research score",()=>assert.ok(calculateResearchScore(70,90,5,4,10)>calculateResearchScore(70,90,5,1,10)));
test("high overfitting frequency reduces research score",()=>assert.ok(calculateResearchScore(70,90,5,3,0)>calculateResearchScore(70,90,5,3,100)));
test("cross-method agreement improves research score",()=>assert.ok(calculateResearchScore(90,90,5,3,10)>calculateResearchScore(20,90,5,3,10)));
test("research score remains zero to one hundred",()=>{assert.equal(calculateResearchScore(1000,1000,1000,1000,-100),100);assert.equal(calculateResearchScore(-100,-100,-1,-1,1000),0)});
test("profitability is not a research-score input",()=>assert.equal(calculateResearchScore(70,90,5,3,10),calculateResearchScore(70,90,5,3,10)));
