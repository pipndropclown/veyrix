import type { MarketId } from "@/lib/market/marketRegistry";
import type { MultiMarketSpotTrade, PaperPortfolioState, PaperTradeSource } from "@/types/trading";
import { localTradingDay, dailyLossLimitUsd } from "./paperPortfolio.ts";
function rollDay(portfolio:PaperPortfolioState,timestamp:string):PaperPortfolioState { const day=localTradingDay(new Date(timestamp));return portfolio.tradingDay===day?portfolio:{...portfolio,tradingDay:day,dailyRealizedPnl:0,tradingPausedForDay:false}; }
export function openMarketSpot(portfolio:PaperPortfolioState,input:{marketId:MarketId;amountUsdc:number;price:number;source?:PaperTradeSource;stopLoss?:number|null;takeProfit?:number|null;timestamp?:string;agentId?:string;agentName?:string}){
  portfolio=rollDay(portfolio,input.timestamp??new Date().toISOString());
  if(portfolio.tradingPausedForDay)return{portfolio,error:"New entries are paused by the virtual daily loss limit."};
  if(portfolio.spotPositions?.[input.marketId])return{portfolio,error:`${input.marketId} Spot already has an open position.`};
  if(!Number.isFinite(input.amountUsdc)||input.amountUsdc<=0||input.amountUsdc>portfolio.availableUsdc||!Number.isFinite(input.price)||input.price<=0)return{portfolio,error:"Enter a valid amount within available virtual USDC."};
  if((input.stopLoss!=null&&(!Number.isFinite(input.stopLoss)||input.stopLoss<=0||input.stopLoss>=input.price))||(input.takeProfit!=null&&(!Number.isFinite(input.takeProfit)||input.takeProfit<=input.price)))return{portfolio,error:"Stop loss and take profit must be on the correct side of entry."};
  const timestamp=input.timestamp??new Date().toISOString(),quantity=input.amountUsdc/input.price,id=`SP-${input.marketId}-${timestamp.replace(/\D/g,"")}-${(portfolio.multiMarketSpotTrades??[]).length}`;
  if(!Number.isFinite(quantity)||quantity<=0)return{portfolio,error:"Invalid simulated quantity."};
  const ownership=input.source==="AUTONOMOUS"&&input.agentId?{agentId:input.agentId,agentName:input.agentName??"Paper agent"}:{};
  const trade:MultiMarketSpotTrade={...ownership,id,marketId:input.marketId,mode:"SPOT",side:"BUY",source:input.source??"MANUAL",entryTimestamp:timestamp,exitTimestamp:null,entryPrice:input.price,exitPrice:null,quantity,amountUsdc:input.amountUsdc,realizedPnl:null,status:"OPEN",exitReason:null,stopLoss:input.stopLoss??null,takeProfit:input.takeProfit??null};
  return{portfolio:{...portfolio,availableUsdc:portfolio.availableUsdc-input.amountUsdc,spotPositions:{...(portfolio.spotPositions??{}),[input.marketId]:{...ownership,marketId:input.marketId,quantity,averageEntryPrice:input.price,entryTimestamp:timestamp,tradeId:id}},multiMarketSpotTrades:[trade,...(portfolio.multiMarketSpotTrades??[])]},error:null};
}
export function closeMarketSpot(portfolio:PaperPortfolioState,marketId:MarketId,price:number,timestamp=new Date().toISOString(),manual=true):PaperPortfolioState{
  portfolio=rollDay(portfolio,timestamp);
  const position=portfolio.spotPositions?.[marketId],trade=(portfolio.multiMarketSpotTrades??[]).find(t=>t.id===position?.tradeId);if(!position||!trade||!Number.isFinite(price)||price<=0)return portfolio;
  const stopped=trade.stopLoss!==null&&price<=trade.stopLoss,target=trade.takeProfit!==null&&price>=trade.takeProfit;if(!manual&&!stopped&&!target)return portfolio;
  const proceeds=position.quantity*price,pnl=proceeds-trade.amountUsdc,next={...(portfolio.spotPositions??{})};delete next[marketId];
  if(!Number.isFinite(proceeds)||!Number.isFinite(pnl))return portfolio;
  const legacy=portfolio.trades.find(t=>t.id===trade.id&&t.status==="OPEN");
  const dailyRealizedPnl=portfolio.dailyRealizedPnl+pnl;
  return{...portfolio,
    ...(legacy?{solBalance:0,averageSolEntryPrice:null,completedTrades:portfolio.completedTrades+1,winningTrades:portfolio.winningTrades+(pnl>0?1:0),losingTrades:portfolio.losingTrades+(pnl<0?1:0),trades:portfolio.trades.map(t=>t.id===legacy.id?{...t,status:"CLOSED" as const,exitTimestamp:timestamp,exitPrice:price,exitValueUsdc:proceeds,realizedPnl:pnl,pnlPercent:pnl/trade.amountUsdc*100,exitReason:stopped?"STOP_LOSS" as const:target?"TAKE_PROFIT" as const:"STRATEGY_SIGNAL" as const}:t)}:{}),
    tradingPausedForDay:portfolio.tradingPausedForDay||dailyRealizedPnl<=-dailyLossLimitUsd(),availableUsdc:portfolio.availableUsdc+proceeds,realizedPnl:portfolio.realizedPnl+pnl,dailyRealizedPnl:portfolio.dailyRealizedPnl+pnl,spotPositions:next,multiMarketSpotTrades:(portfolio.multiMarketSpotTrades??[]).map(t=>t.id===trade.id?{...t,status:"CLOSED" as const,exitTimestamp:timestamp,exitPrice:price,realizedPnl:pnl,exitReason:stopped?"STOP_LOSS":target?"TAKE_PROFIT":"MANUAL"}:t)};
}
export const marketSpotPnl=(portfolio:PaperPortfolioState,marketId:MarketId,price:number)=>{const p=portfolio.spotPositions?.[marketId];return p?(price-p.averageEntryPrice)*p.quantity:0};
