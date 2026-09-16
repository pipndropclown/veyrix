import assert from "node:assert/strict";
import test from "node:test";
import { getMarket, MARKET_IDS, MARKET_REGISTRY } from "./marketRegistry.ts";
test("supported market lookup is centralized",()=>assert.deepEqual(MARKET_IDS,["BTC","ETH","SOL"]));
test("unsupported market is rejected",()=>assert.equal(getMarket("DOGE"),null));
test("online Coinbase USD reference product IDs are registered",()=>assert.deepEqual(MARKET_IDS.map(id=>MARKET_REGISTRY[id].providerProductId),["BTC-USD","ETH-USD","SOL-USD"]));
test("all markets have valid price precision",()=>MARKET_IDS.forEach(id=>assert.ok(MARKET_REGISTRY[id].pricePrecision>=0&&MARKET_REGISTRY[id].pricePrecision<=8)));
test("all markets have valid quantity precision",()=>MARKET_IDS.forEach(id=>assert.ok(MARKET_REGISTRY[id].quantityPrecision>=1&&MARKET_REGISTRY[id].quantityPrecision<=8)));

test('prototype property names are not supported markets',()=>{for(const name of ['constructor','toString','__proto__'])assert.equal(getMarket(name),null)});
