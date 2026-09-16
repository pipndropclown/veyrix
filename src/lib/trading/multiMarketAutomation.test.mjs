import assert from "node:assert/strict";import test from "node:test";import {createInitialPaperPortfolio} from "./paperPortfolio.ts";import {evaluateMultiMarketAutomation} from "./multiMarketAutomation.ts";import {DEFAULT_AUTOMATION} from "./automationEngine.ts";import {automationCandleId} from "../market/liveCandles.ts";
const now=Date.UTC(2026,0,2),candles=(rising=true)=>Array.from({length:8},(_,i)=>{const p=rising?100+i:108-i;return{timestamp:new Date(now-(9-i)*3600000).toISOString(),open:p,high:p+1,low:p-1,close:p,volume:10}}),settings=(marketId,mode="SPOT")=>({...DEFAULT_AUTOMATION,enabled:true,marketId,tradingMode:mode,timeframe:"1H",allocationPercent:10});
test("BTC autonomous evaluation uses BTC context",()=>{const r=evaluateMultiMarketAutomation({portfolio:createInitialPaperPortfolio("2026-01-01"),settings:settings("BTC"),candles:candles(),now});assert.ok(r.portfolio.spotPositions.BTC);assert.ok(!r.portfolio.spotPositions.ETH)});
test("ETH autonomous evaluation can open short futures",()=>{const r=evaluateMultiMarketAutomation({portfolio:createInitialPaperPortfolio("2026-01-01"),settings:settings("ETH","FUTURES"),candles:candles(false),now});assert.equal(r.portfolio.futuresTrades[0].marketId,"ETH");assert.equal(r.portfolio.futuresTrades[0].side,"SHORT")});
test("SOL autonomous regression remains market-specific",()=>{const r=evaluateMultiMarketAutomation({portfolio:createInitialPaperPortfolio("2026-01-01"),settings:settings("SOL"),candles:candles(),now});assert.ok(r.portfolio.spotPositions.SOL)});
test("execution identity includes market mode strategy timeframe candle",()=>assert.match(automationCandleId("momentum","15m","2026-01-01T00:00:00Z","BTC","FUTURES"),/^BTC:FUTURES:momentum:15m:/));
test("BTC processed candle does not block ETH",()=>{const timestamp="2026-01-01T00:00:00Z";assert.notEqual(automationCandleId("momentum","15m",timestamp,"BTC","SPOT"),automationCandleId("momentum","15m",timestamp,"ETH","SPOT"))});
test("only configured autonomous market executes",()=>{const r=evaluateMultiMarketAutomation({portfolio:createInitialPaperPortfolio("2026-01-01"),settings:settings("ETH"),candles:candles(),now});assert.deepEqual(Object.keys(r.portfolio.spotPositions),["ETH"])});
test("chart timeframe remains independent from automation",()=>assert.equal(settings("BTC").timeframe,"1H"));

test('legacy SOL execution ID prevents replay after migration',()=>{
 const data=candles(),s=settings('SOL');s.processedCandleIds=[automationCandleId(s.strategyId,s.timeframe,data.at(-1).timestamp)];
 assert.equal(evaluateMultiMarketAutomation({portfolio:createInitialPaperPortfolio(),settings:s,candles:data,now}).outcome,'DUPLICATE');
});
test('zero autonomous risk percentages disable optional stops and targets',()=>{
 const s={...settings('BTC'),stopLossPercent:0,takeProfitPercent:0};const r=evaluateMultiMarketAutomation({portfolio:createInitialPaperPortfolio(),settings:s,candles:candles(),now});
 assert.equal(r.outcome,'EXECUTED');assert.equal(r.portfolio.multiMarketSpotTrades[0].stopLoss,null);assert.equal(r.portfolio.multiMarketSpotTrades[0].takeProfit,null);
});
test('autonomous duplicate and disabled evaluations cannot spend shared funds',()=>{
 const r=evaluateMultiMarketAutomation({portfolio:createInitialPaperPortfolio(),settings:settings('BTC'),candles:candles(),now});
 assert.equal(evaluateMultiMarketAutomation({portfolio:r.portfolio,settings:r.settings,candles:candles(),now}).outcome,'DUPLICATE');
 assert.equal(evaluateMultiMarketAutomation({portfolio:r.portfolio,settings:{...settings('ETH'),enabled:false},candles:candles(),now}).portfolio.availableUsdc,r.portfolio.availableUsdc);
});
