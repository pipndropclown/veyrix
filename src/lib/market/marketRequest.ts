import { isMarketId,type MarketId } from "./marketRegistry.ts";
export function requestedMarket(url:string,defaultMarket:MarketId="SOL"):MarketId|null{const value=new URL(url).searchParams.get("symbol")??defaultMarket;return isMarketId(value)?value:null}
