import assert from"node:assert/strict";import test from"node:test";import{classifyMarketRegime}from"./regimeClassifier.ts";
const candles=prices=>prices.map((close,i)=>({timestamp:new Date(Date.UTC(2026,0,1,i*6)).toISOString(),open:close,high:close+.1,low:close-.1,close,price:close,volume:1}));
test("strong rising market classifies BULLISH",()=>assert.equal(classifyMarketRegime(candles([100,102,104,106])).regime,"BULLISH"));
test("strong falling market classifies BEARISH",()=>assert.equal(classifyMarketRegime(candles([100,98,96,94])).regime,"BEARISH"));
test("flat low-volatility market classifies SIDEWAYS",()=>assert.equal(classifyMarketRegime(candles([100,100.1,99.9,100])).regime,"SIDEWAYS"));
test("volatile market classifies HIGH_VOLATILITY",()=>assert.equal(classifyMarketRegime(candles([100,110,90,112,88])).regime,"HIGH_VOLATILITY"));
test("invalid regime data fails safely",()=>{const result=classifyMarketRegime([{timestamp:"bad",open:0,high:0,low:0,close:0,price:0,volume:-1}]);assert.equal(result.regime,"UNAVAILABLE");assert.equal(result.marketReturnPercent,null)});
test("regime classification is deterministic",()=>{const input=candles([100,103,101,108]);assert.deepEqual(classifyMarketRegime(input),classifyMarketRegime(input))});
