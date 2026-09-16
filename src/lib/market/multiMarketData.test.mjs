import assert from "node:assert/strict";import test from "node:test";import {aggregateCandles} from "./liveCandles.ts";import {combineMarketDatasets,normalizeMarketDataset} from "./marketDataset.ts";import {requestedMarket} from "./marketRequest.ts";
const row=(t,p)=>[t,p-1,p+1,p,p+.5,10];
for(const id of ["BTC","ETH","SOL"])test(`${id} candle normalization`,()=>{const d=normalizeMarketDataset(id,[row(1,100)]);assert.equal(d.marketId,id);assert.equal(d.candles.length,1);assert.equal(d.candles[0].close,100.5)});
test("market-specific aggregation remains isolated",()=>{const d=normalizeMarketDataset("BTC",[row(60,100),row(120,101)]);assert.equal(aggregateCandles(d.candles,120).length,2)});
test("market datasets cannot mix",()=>assert.throws(()=>combineMarketDatasets({marketId:"BTC",candles:[]},{marketId:"ETH",candles:[]})));
test("unsupported market API query is rejected",()=>assert.equal(requestedMarket("https://x/api/candles?symbol=DOGE"),null));
test("missing symbol maps to legacy SOL",()=>assert.equal(requestedMarket("https://x/api/market"),"SOL"));


import {recordPriceObservation,getRecentPriceObservations} from './priceHistory.ts';
test('live strategy observation histories do not mix markets',()=>{
 const timestamp='2026-01-01T00:00:00Z';recordPriceObservation({timestamp,price:60000},'BTC');recordPriceObservation({timestamp,price:3000},'ETH');recordPriceObservation({timestamp,price:100},'SOL');
 assert.equal(getRecentPriceObservations('BTC').at(-1).price,60000);assert.equal(getRecentPriceObservations('ETH').at(-1).price,3000);assert.equal(getRecentPriceObservations().at(-1).price,100);
});
