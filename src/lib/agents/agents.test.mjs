import assert from "node:assert/strict";
import test from "node:test";
import { createInitialPaperPortfolio, restorePaperPortfolio } from "../trading/paperPortfolio.ts";
import { openMarketSpot } from "../trading/multiMarketSpotEngine.ts";
import { openFutures, closeFuturesMarket } from "../trading/futuresEngine.ts";
import { defaultAgentName, createAgent, deleteAgent, editAgent, emptyAgentStore, migrateLegacyAutomation, setAgentEnabled, validateAgentConfig } from "./agentModel.ts";
import { evaluateAgentBatch, agentCandleId, groupEnabledAgents } from "./agentEngine.ts";
import { fetchSharedCandles, clearSharedMarketCacheForTests } from "./candleScheduler.ts";
import { aggregateAgentPerformance, calculateAgentPerformance } from "./agentPerformance.ts";
import { automationCandleId } from "../market/liveCandles.ts";
import { restorePaperLab, serializePaperLab } from "./agentPersistence.ts";
import { DEFAULT_AUTOMATION } from "../trading/automationEngine.ts";
import { filterTradeHistory } from "../trading/tradeHistory.ts";
import { claimPaperController } from "./browserController.ts";

const now = Date.UTC(2026, 0, 2, 12), stamp = (n=now)=>new Date(n).toISOString();
const cfg = (marketId="BTC", mode="SPOT", overrides={}) => ({ name:defaultAgentName({marketId,mode,strategyId:"momentum"}),marketId,mode,strategyId:"momentum",timeframe:"1H",allocation:{unit:"USDC",value:1000},stopLossPercent:3,takeProfitPercent:6,leverage:mode==="FUTURES"?2:1,...overrides });
const add = (state,c=cfg(),id=`a${state.agents.agents.length+1}`,enabled=true)=>({...state,agents:createAgent(state.agents,c,id,stamp(),enabled, state.portfolio.availableUsdc)});
const candles = (rise=true, start=now-9*3600000)=>Array.from({length:8},(_,i)=>{const close=rise?100+i:108-i;return {timestamp:stamp(start+i*3600000),open:close,high:close+1,low:close-1,close,volume:10}});
const datasets=(map={})=>new Map(Object.entries(map));
const batch=(state,prices={BTC:108,ETH:108,SOL:108},data=candles(),time=now)=>evaluateAgentBatch({state,candles:datasets({"BTC:1H":data,"ETH:1H":data,"SOL:1H":data,"BTC:15m":data}),prices,now:time});

test("migrated candles remain consumed after reload without suppressing another agent", () => {
 for (const [marketId, mode, oldFormat] of [["BTC", "SPOT", false], ["ETH", "FUTURES", false], ["SOL", "SPOT", true]]) {
  const timestamp = candles().at(-1).timestamp;
  const id = oldFormat ? automationCandleId("momentum", "1H", timestamp) : automationCandleId("momentum", "1H", timestamp, marketId, mode);
  const legacy = {...DEFAULT_AUTOMATION, enabled:true, marketId, tradingMode:mode, timeframe:"1H", processedCandleIds:[id]};
  let state = migrateLegacyAutomation({portfolio:createInitialPaperPortfolio(), agents:emptyAgentStore()}, legacy, stamp());
  state = restorePaperLab({portfolioValue:JSON.parse(serializePaperLab(state))}).state;
  state = add(state, cfg(marketId, mode), "independent");
  const result = batch(state);
  assert.equal(result.outcomes.find(x => x.agentId === "legacy-v13").outcome, "DUPLICATE");
  assert.match(result.outcomes.find(x => x.agentId === "independent").outcome, /opened/);
 }
});

test("automation deployed capital excludes manual, unassigned, and detached positions", () => {
 let state = add({portfolio:createInitialPaperPortfolio(), agents:emptyAgentStore()}, cfg(), "spot", false);
 state = add(state, cfg("ETH", "FUTURES"), "future", false);
 state.portfolio = openMarketSpot(state.portfolio, {marketId:"BTC", amountUsdc:1000, price:100, source:"AUTONOMOUS", agentId:"spot", timestamp:stamp()}).portfolio;
 state.portfolio = openMarketSpot(state.portfolio, {marketId:"ETH", amountUsdc:200, price:100, timestamp:stamp()}).portfolio;
 state.portfolio = openMarketSpot(state.portfolio, {marketId:"SOL", amountUsdc:300, price:100, source:"AUTONOMOUS", timestamp:stamp()}).portfolio;
 state.portfolio = openFutures(state.portfolio, {marketId:"ETH", side:"LONG", leverage:2, marginUsdc:500, price:100, source:"AUTONOMOUS", agentId:"future", stopLoss:null, takeProfit:null, timestamp:stamp()}).portfolio;
 state.portfolio = openFutures(state.portfolio, {marketId:"BTC", side:"LONG", leverage:2, marginUsdc:400, price:100, source:"MANUAL", stopLoss:null, takeProfit:null, timestamp:stamp()}).portfolio;
 assert.equal(aggregateAgentPerformance(state, {}).capitalDeployed, 1500);
 state = deleteAgent(state, "spot", true);
 assert.equal(aggregateAgentPerformance(state, {}).capitalDeployed, 500);
});

test("one completed trade has a drawable equity curve beginning at zero", () => {
 const state = add({portfolio:createInitialPaperPortfolio(), agents:emptyAgentStore()}, cfg("BTC", "FUTURES"), "curve", false);
 assert.deepEqual(calculateAgentPerformance("curve", state, {}).equityCurve, []);
 state.portfolio = openFutures(state.portfolio, {marketId:"BTC", side:"LONG", leverage:2, marginUsdc:1000, price:100, source:"AUTONOMOUS", agentId:"curve", stopLoss:null, takeProfit:null, timestamp:stamp()}).portfolio;
 state.portfolio = closeFuturesMarket(state.portfolio, "BTC", 110, stamp(now + 3600000), true);
 const performance = calculateAgentPerformance("curve", state, {});
 assert.equal(performance.equityCurve.length, 2);
 assert.deepEqual(performance.equityCurve[0], {timestamp:stamp(), equity:0, tradeId:null});
 assert.equal(performance.equityCurve[1].equity, performance.netRealizedPnl);
});

test("agent config accepts Spot and Futures, rejects unsupported market, leverage, and allocation",()=>{
 assert.equal(validateAgentConfig(cfg()),null);assert.equal(validateAgentConfig(cfg("ETH","FUTURES")),null);
 assert.match(validateAgentConfig(cfg("DOGE")),/market/i);assert.match(validateAgentConfig(cfg("BTC","FUTURES",{leverage:4})),/leverage/i);assert.match(validateAgentConfig(cfg("BTC","SPOT",{allocation:{unit:"USDC",value:0}})),/allocation/i);
});
test("rename, pause, and flat-agent delete work without changing identity",()=>{
 let s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()});s={...s,agents:editAgent(s,"a1",{...s.agents.agents[0],name:"Renamed"}).agents};assert.equal(s.agents.agents[0].name,"Renamed");s={...s,agents:setAgentEnabled(s.agents,"a1",false)};assert.equal(s.agents.agents[0].enabled,false);s=deleteAgent(s,"a1");assert.equal(s.agents.agents.length,0);assert.equal(s.agents.archived[0].id,"a1");
});
test("V1.3 automation migration retains settings and processed candle ids exactly once",()=>{
 const legacy={...DEFAULT_AUTOMATION,enabled:true,marketId:"SOL",tradingMode:"SPOT",strategyId:"momentum",timeframe:"15m",allocationPercent:17,leverage:1,processedCandleIds:["SOL:SPOT:momentum:15m:x"]};let state=migrateLegacyAutomation({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},legacy,stamp());assert.equal(state.agents.agents.length,1);const agent=state.agents.agents[0];assert.equal(agent.marketId,"SOL");assert.equal(agent.allocation.value,17);assert.equal(agent.enabled,true);assert.deepEqual(agent.processedCandleIds,legacy.processedCandleIds);state=migrateLegacyAutomation(state,legacy,stamp());assert.equal(state.agents.agents.length,1);
});
test("migration preserves legacy SOL open ownership and restore does not duplicate history",()=>{
 const p=openMarketSpot(createInitialPaperPortfolio(),{marketId:"SOL",amountUsdc:100,price:100,source:"AUTONOMOUS",timestamp:stamp()}).portfolio;
 const automation={...DEFAULT_AUTOMATION,enabled:true,marketId:"SOL",tradingMode:"SPOT",allocationPercent:10};const migrated=migrateLegacyAutomation({portfolio:p,agents:emptyAgentStore()},automation,stamp());assert.equal(migrated.portfolio.multiMarketSpotTrades[0].agentId,"legacy-v13");const restored=restorePaperPortfolio(JSON.parse(serializePaperLab(migrated)));assert.equal(restored.spotPositions.SOL.agentId,"legacy-v13");
});
test("browser restart persists agents, pause state, processed candle IDs and ownership",()=>{
 let s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()});const r=batch(s);s=r.state;const roundtrip=restorePaperLab({portfolioValue:JSON.parse(serializePaperLab(s))});assert.equal(roundtrip.error,null);assert.equal(roundtrip.state.agents.agents[0].processedCandleIds.length,1);assert.equal(roundtrip.state.portfolio.spotPositions.BTC.agentId,"a1");assert.equal(roundtrip.state.agents.agents[0].enabled,true);
});
test("only one tab controls an account while a valid browser lease exists",()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},first=claimPaperController(storage,now,"tab-a"),second=claimPaperController(storage,now,"tab-b");assert.equal(first.owns(),true);assert.equal(second.owns(),false);first.release();second.release();
});
test("grouping fetches one shared market/timeframe data set and agent IDs remain isolated",async()=>{
 let s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},cfg("BTC","SPOT"),"one");s=add(s,cfg("BTC","SPOT"),"two");s=add(s,cfg("ETH","SPOT"),"eth");assert.deepEqual(groupEnabledAgents(s.agents.agents),["BTC:1H","ETH:1H"]);assert.notEqual(agentCandleId(s.agents.agents[0],stamp()),agentCandleId(s.agents.agents[1],stamp()));
 clearSharedMarketCacheForTests();let calls=0;const fetcher=async()=>{calls++;return{success:true,data:{candles:candles()}}};await Promise.all([fetchSharedCandles("BTC","1H",fetcher),fetchSharedCandles("BTC","1H",fetcher)]);assert.equal(calls,1);await fetchSharedCandles("ETH","1H",fetcher);assert.equal(calls,2);
});
test("BTC 15m evaluation cannot trigger ETH or BTC 1H; same candle is independently consumed by two agents",()=>{
 let s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},cfg("BTC","SPOT",{timeframe:"15m"}),"btc15");s=add(s,cfg("ETH","SPOT"),"eth1h");s=add(s,cfg("BTC","SPOT"),"btc1h");const data=candles();const r=evaluateAgentBatch({state:s,candles:datasets({"BTC:15m":data}),prices:{BTC:108},now});assert.equal(r.state.agents.agents[0].processedCandleIds.length,1);assert.equal(r.state.agents.agents[1].processedCandleIds.length,0);assert.equal(r.state.agents.agents[2].processedCandleIds.length,0);
 const same=evaluateAgentBatch({state:s,candles:datasets({"BTC:1H":data}),prices:{BTC:108},now});assert.equal(same.state.agents.agents[1].processedCandleIds.length,0);assert.equal(same.state.agents.agents[2].processedCandleIds.length,1);const again=evaluateAgentBatch({state:same.state,candles:datasets({"BTC:1H":data}),prices:{BTC:108},now});assert.equal(again.state.agents.agents[2].processedCandleIds.length,1);
});
test("same market/mode conflict skips second agent, while ETH and cross-mode agents coexist",()=>{
 let s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},cfg("BTC","SPOT"),"btc-a");s=add(s,cfg("BTC","SPOT"),"btc-b");s=add(s,cfg("ETH","SPOT"),"eth");s=add(s,cfg("BTC","FUTURES"),"future");const r=batch(s);assert.equal(r.state.portfolio.multiMarketSpotTrades.filter(t=>t.marketId==="BTC").length,1);assert.equal(r.state.portfolio.spotPositions.ETH.agentId,"eth");assert.equal(r.state.portfolio.futuresTrades[0].agentId,"future");assert.match(r.state.agents.agents.find(a=>a.id==="btc-b").lastAction,/POSITION ALREADY OPEN/);assert.ok(r.state.portfolio.availableUsdc>=0);
});
test("manual position blocks an agent, and insufficient shared virtual capital cannot go negative",()=>{
 let p=openMarketSpot(createInitialPaperPortfolio(),{marketId:"BTC",amountUsdc:100,price:100,timestamp:stamp()}).portfolio;let s=add({portfolio:p,agents:emptyAgentStore()},cfg("BTC","SPOT"),"blocked");let r=batch(s);assert.match(r.state.agents.agents[0].lastAction,/POSITION ALREADY OPEN/);
 s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},cfg("BTC","SPOT",{allocation:{unit:"USDC",value:10000}}),"all");s=add(s,cfg("ETH","SPOT",{allocation:{unit:"USDC",value:1000}}),"extra");r=batch(s);assert.equal(r.state.portfolio.availableUsdc,0);assert.match(r.state.agents.agents.find(a=>a.id==="extra").lastAction,/INSUFFICIENT VIRTUAL CAPITAL/);
});
test("manual positions, futures margin, and released capital remain consistent",()=>{
 const opened=openFutures(createInitialPaperPortfolio(),{marketId:"ETH",side:"LONG",leverage:2,marginUsdc:1000,price:100,stopLoss:null,takeProfit:null,source:"AUTONOMOUS",agentId:"f",agentName:"Future",timestamp:stamp()});assert.equal(opened.portfolio.availableUsdc,9000);assert.equal(opened.portfolio.futuresTrades[0].agentId,"f");const closed=closeFuturesMarket(opened.portfolio,"ETH",110,stamp(now+1000),true);assert.ok(closed.availableUsdc>9000);assert.ok(closed.availableUsdc<11000);assert.equal(closed.futuresTrades[0].status,"CLOSED");
});
test("pause blocks strategy entry and exit while stop-loss protection remains active",()=>{
 let s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},cfg("BTC","SPOT"),"paused",false);let r=batch(s);assert.equal(r.state.portfolio.spotPositions.BTC,undefined);
 const opened=openMarketSpot(s.portfolio,{marketId:"BTC",amountUsdc:1000,price:100,source:"AUTONOMOUS",agentId:"paused",agentName:"Agent",stopLoss:95,takeProfit:120,timestamp:stamp()});s={...s,portfolio:opened.portfolio};const down=candles(false);r=evaluateAgentBatch({state:s,candles:datasets({"BTC:1H":down}),prices:{BTC:94},now});assert.equal(r.state.portfolio.spotPositions.BTC,undefined);assert.equal(r.state.portfolio.multiMarketSpotTrades[0].exitReason,"STOP_LOSS");
});
test("paused Futures agents retain stop, target, and liquidation protection",()=>{
 for(const [price,sl,tp,reason] of [[94,95,120,"STOP_LOSS"],[121,80,120,"TAKE_PROFIT"],[40,null,null,"LIQUIDATION"]]){let p=createInitialPaperPortfolio();p=openFutures(p,{marketId:"BTC",side:"LONG",leverage:2,marginUsdc:1000,price:100,stopLoss:sl,takeProfit:tp,source:"AUTONOMOUS",agentId:"risk",timestamp:stamp()}).portfolio;const s=add({portfolio:p,agents:emptyAgentStore()},cfg("BTC","FUTURES"),"risk",false),r=evaluateAgentBatch({state:s,candles:datasets(),prices:{BTC:price},now});assert.equal(r.state.portfolio.futuresTrades[0].exitReason,reason);assert.ok(r.state.portfolio.availableUsdc>=0)}
});
test("deleting an agent with an open position requires explicit detach and leaves the position open",()=>{
 let s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},cfg(),"owned",false);s={...s,portfolio:openMarketSpot(s.portfolio,{marketId:"BTC",amountUsdc:1000,price:100,source:"AUTONOMOUS",agentId:"owned",agentName:"BTC Momentum",timestamp:stamp()}).portfolio};assert.throws(()=>deleteAgent(s,"owned"),/explicitly leave/);const removed=deleteAgent(s,"owned",true);assert.equal(removed.portfolio.spotPositions.BTC.agentDetached,true);assert.equal(removed.portfolio.spotPositions.BTC.agentId,"owned");assert.equal(removed.portfolio.multiMarketSpotTrades[0].status,"OPEN");
});
test("history can filter an agent independently of market, mode, and source",()=>{
 let s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},cfg(),"filter",false);s={...s,portfolio:openMarketSpot(s.portfolio,{marketId:"ETH",amountUsdc:100,price:100,source:"AUTONOMOUS",agentId:"filter",agentName:"ETH Momentum",timestamp:stamp()}).portfolio};const rows=filterTradeHistory(s.portfolio,{market:"ETH",mode:"SPOT",source:"AUTONOMOUS"});assert.equal(rows.length,1);assert.equal(rows[0].agentId,"filter");
});
test("agent analytics calculate wins, losses, drawdown, streak, holding time, and score sufficiency",()=>{
 const s=add({portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()},cfg(),"stats",false);const base=(id,pnl,when)=>({id,agentId:"stats",agentName:"Stats",source:"AUTONOMOUS",marketId:"BTC",mode:"SPOT",amountUsdc:100,quantity:1,entryTimestamp:stamp(when-3600000),exitTimestamp:stamp(when),entryPrice:100,exitPrice:100+pnl,realizedPnl:pnl,status:"CLOSED"});s.portfolio.multiMarketSpotTrades=[base("1",10,now-5000),base("2",-5,now-4000),base("3",20,now-3000),base("4",-10,now-2000),base("5",15,now-1000)];const p=calculateAgentPerformance("stats",s,{BTC:100});assert.equal(p.totalTrades,5);assert.equal(p.completedTrades,5);assert.equal(p.winningTrades,3);assert.equal(p.losingTrades,2);assert.equal(p.grossProfit,45);assert.equal(p.grossLoss,15);assert.equal(p.netRealizedPnl,30);assert.equal(p.averageWin,15);assert.equal(p.averageLoss,-7.5);assert.equal(p.largestWin,20);assert.equal(p.largestLoss,-10);assert.equal(p.profitFactor,3);assert.equal(p.expectancy,6);assert.equal(p.maximumDrawdown,10);assert.equal(p.currentWinLossStreak,1);assert.equal(p.averageHoldingTimeMs,3600000);assert.ok(p.score>=0&&p.score<=100);assert.equal(calculateAgentPerformance("missing",s,{}).scoreStatus,"INSUFFICIENT DATA");
});
test("six enabled agents are allowed but a seventh is paused/rejected when enabled",()=>{
 let s={portfolio:createInitialPaperPortfolio(),agents:emptyAgentStore()};for(let i=0;i<6;i++)s=add(s,cfg(["BTC","ETH","SOL"][i%3]),`limit${i}`);assert.throws(()=>createAgent(s.agents,cfg(),"seventh",stamp(),true),/6 running/);assert.equal(s.agents.agents.length,6);
});
