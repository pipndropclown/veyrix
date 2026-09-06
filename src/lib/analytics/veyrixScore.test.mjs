import assert from"node:assert/strict";import test from"node:test";import{calculateVeyrixScore}from"./veyrixScore.ts";
const score=(changes={})=>calculateVeyrixScore({totalReturnPercent:0,maximumDrawdownPercent:5,profitFactor:1,expectancyPercent:0,...changes}).total;
test("higher return improves score",()=>assert.ok(score({totalReturnPercent:5})>score()));
test("higher drawdown reduces score",()=>assert.ok(score({maximumDrawdownPercent:10})<score()));
test("better profit factor improves score",()=>assert.ok(score({profitFactor:2})>score()));
test("better expectancy improves score",()=>assert.ok(score({expectancyPercent:1})>score()));
test("extreme metrics are clamped",()=>assert.equal(score({totalReturnPercent:1e9,maximumDrawdownPercent:-1,profitFactor:1e9,expectancyPercent:1e9}),100));
test("missing metrics are safe",()=>assert.ok(Number.isFinite(score({profitFactor:null,expectancyPercent:null}))));
test("score always remains 0 to 100",()=>{for(const v of [-Infinity,-100,0,100,Infinity]){const s=score({totalReturnPercent:v,maximumDrawdownPercent:v,profitFactor:v,expectancyPercent:v});assert.ok(s>=0&&s<=100)}});
