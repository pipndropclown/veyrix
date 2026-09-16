import { mergeHistoricalChunks } from "../backtesting/marketCandles.ts";
import type { MarketId } from "./marketRegistry";
export function normalizeMarketDataset(marketId:MarketId,raw:unknown){return{marketId,candles:mergeHistoricalChunks([raw]).candles}}
export function combineMarketDatasets(...sets:{marketId:MarketId;candles:unknown[]}[]){if(new Set(sets.map(s=>s.marketId)).size>1)throw new Error("Market datasets cannot mix");return sets.flatMap(s=>s.candles)}
