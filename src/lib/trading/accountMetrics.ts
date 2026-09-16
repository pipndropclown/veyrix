import { futuresPnl } from "./futuresEngine.ts";
import type { MarketId } from "@/lib/market/marketRegistry";
import type { PaperPortfolioState } from "@/types/trading";
export function calculateMultiMarketAccount(state:PaperPortfolioState,prices:Partial<Record<MarketId,number>>){
  const positions=Object.values(state.spotPositions??{}).filter(Boolean);
  const spotHoldingsValue=positions.reduce((sum,p)=>sum+p!.quantity*(prices[p!.marketId]??p!.averageEntryPrice),0);
  const openFutures=(state.futuresTrades??[]).filter(t=>t.status==="OPEN"),futuresMarginInUse=openFutures.reduce((s,t)=>s+t.marginUsdc,0),futuresExposure=openFutures.reduce((s,t)=>s+t.exposureUsdc,0),futuresUnrealizedPnl=openFutures.reduce((s,t)=>s+Math.max(-t.marginUsdc,futuresPnl(t,prices[t.marketId??"SOL"]??t.entryPrice)),0);
  const totalUnrealizedPnl=positions.reduce((s,p)=>s+((prices[p!.marketId]??p!.averageEntryPrice)-p!.averageEntryPrice)*p!.quantity,0)+futuresUnrealizedPnl;
  const completedTrades=(state.multiMarketSpotTrades??[]).filter(t=>t.status==="CLOSED").length+(state.futuresTrades??[]).filter(t=>t.status==="CLOSED").length;
  const wins=[...(state.multiMarketSpotTrades??[]),...(state.futuresTrades??[])].filter(t=>t.status==="CLOSED"&&(t.realizedPnl??0)>0).length;
  return{totalVirtualEquity:state.availableUsdc+spotHoldingsValue+futuresMarginInUse+futuresUnrealizedPnl,availableVirtualUsdc:state.availableUsdc,spotHoldingsValue,futuresMarginInUse,futuresExposure,totalUnrealizedPnl,totalRealizedPnl:state.realizedPnl,openPositions:positions.length+openFutures.length,completedTrades,liquidations:(state.futuresTrades??[]).filter(t=>t.exitReason==="LIQUIDATION").length,winRate:completedTrades?wins/completedTrades*100:0};
}
