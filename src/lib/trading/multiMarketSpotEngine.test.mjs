import assert from "node:assert/strict";import test from "node:test";import {createInitialPaperPortfolio,restorePaperPortfolio} from "./paperPortfolio.ts";import {openMarketSpot,closeMarketSpot,marketSpotPnl} from "./multiMarketSpotEngine.ts";
const open=(p,id,amount=1000,price=100)=>openMarketSpot(p,{marketId:id,amountUsdc:amount,price,timestamp:"2026-01-01T00:00:00Z"});
for(const id of ["BTC","ETH","SOL"])test(`${id} Spot opens`,()=>{const r=open(createInitialPaperPortfolio("2026-01-01"),id);assert.equal(r.error,null);assert.ok(r.portfolio.spotPositions[id])});
test("BTC does not block ETH and shared USDC is reserved once",()=>{let p=open(createInitialPaperPortfolio("2026-01-01"),"BTC").portfolio;p=open(p,"ETH",500,50).portfolio;assert.equal(p.availableUsdc,8500);assert.ok(p.spotPositions.BTC&&p.spotPositions.ETH)});
test("duplicate BTC Spot is blocked",()=>{const p=open(createInitialPaperPortfolio(),"BTC").portfolio;assert.ok(open(p,"BTC").error)});
test("closing BTC preserves ETH and isolates P&L",()=>{let p=open(createInitialPaperPortfolio("2026-01-01"),"BTC").portfolio;p=open(p,"ETH").portfolio;p=closeMarketSpot(p,"BTC",110,"2026-01-01T01:00:00Z");assert.ok(!p.spotPositions.BTC&&p.spotPositions.ETH);assert.equal(p.availableUsdc,9100);assert.equal(marketSpotPnl(p,"ETH",120),200)});
test("legacy SOL trade maps to SOL market",()=>{const p=createInitialPaperPortfolio();p.availableUsdc=9000;p.solBalance=10;p.averageSolEntryPrice=100;p.trades=[{id:"old",executionId:"old",pair:"SOL/USDC",side:"BUY",entryTimestamp:"2026-01-01T00:00:00Z",exitTimestamp:null,entryPrice:100,exitPrice:null,solQuantity:10,positionSizeUsdc:1000,exitValueUsdc:null,realizedPnl:null,pnlPercent:null,strategySignal:"BUY",confidence:100,strategyReason:"legacy",status:"OPEN",exitReason:null}];const r=restorePaperPortfolio(p);assert.equal(r.spotPositions.SOL.marketId,"SOL");assert.equal(r.multiMarketSpotTrades[0].marketId,"SOL")});

import {manualBuy} from './manualPaperTrading.ts';
import {openFutures} from './futuresEngine.ts';
test('migrated SOL settles once and remains closed after reload',()=>{
 const legacy=manualBuy(createInitialPaperPortfolio('2026-01-01'),1000,100,'2026-01-01T00:00:00Z').portfolio;
 const migrated=restorePaperPortfolio(legacy,'2026-01-01');
 assert.equal(migrated.multiMarketSpotTrades[0].stopLoss,98);
 const closed=closeMarketSpot(migrated,'SOL',110,'2026-01-01T01:00:00Z');
 const restored=restorePaperPortfolio(JSON.parse(JSON.stringify(closed)),'2026-01-01');
 assert.equal(restored.availableUsdc,10100);assert.equal(restored.solBalance,0);assert.equal(restored.spotPositions.SOL,undefined);
 assert.equal(closeMarketSpot(restored,'SOL',110).availableUsdc,10100);
});
test('multi-market realized daily loss and pause survive reload and block both modes',()=>{
 let p=open(createInitialPaperPortfolio('2026-01-01'),'BTC').portfolio;
 p=closeMarketSpot(p,'BTC',60,'2026-01-01T01:00:00Z');
 p=restorePaperPortfolio(JSON.parse(JSON.stringify(p)),'2026-01-01');
 assert.equal(p.dailyRealizedPnl,-400);assert.equal(p.tradingPausedForDay,true);
 assert.ok(open(p,'ETH').error);
 assert.ok(openFutures(p,{marketId:'ETH',side:'LONG',leverage:2,marginUsdc:100,price:100,stopLoss:null,takeProfit:null,timestamp:'2026-01-01T02:00:00Z'}).error);
 assert.equal(p.availableUsdc,9600);
});
test('spot daily pause clears on the next trading day',()=>{
 let p=open(createInitialPaperPortfolio('2026-01-01'),'BTC').portfolio;
 p=closeMarketSpot(p,'BTC',60,'2026-01-01T01:00:00Z');
 const r=openMarketSpot(p,{marketId:'ETH',amountUsdc:500,price:50,timestamp:'2026-01-02T12:00:00Z'});
 assert.equal(r.error,null);assert.equal(r.portfolio.dailyRealizedPnl,0);
});
test('all market spot positions and shared balance survive JSON restoration',()=>{
 let p=createInitialPaperPortfolio('2026-01-01');for(const id of ['BTC','ETH','SOL'])p=open(p,id).portfolio;
 const restored=restorePaperPortfolio(JSON.parse(JSON.stringify(p)),'2026-01-01');
 assert.equal(restored.availableUsdc,7000);assert.deepEqual(Object.keys(restored.spotPositions).sort(),['BTC','ETH','SOL']);
});
test('restoration rebuilds holdings from validated trade records',()=>{
 const p=open(createInitialPaperPortfolio('2026-01-01'),'BTC').portfolio;p.spotPositions={};
 assert.equal(restorePaperPortfolio(p).spotPositions.BTC.quantity,10);
});
test('invalid spot quantity is rejected on restoration',()=>{
 const p=open(createInitialPaperPortfolio('2026-01-01'),'BTC').portfolio;p.multiMarketSpotTrades[0].quantity=-10;
 assert.deepEqual(restorePaperPortfolio(p).spotPositions,{});
});
