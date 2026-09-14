import type { FuturesTrade, PaperPortfolioState, PaperTradeSource } from "@/types/trading";
import { paperTradingConfig } from "./tradingConfig.ts";

export const FUTURES_LEVERAGES = [1, 2, 3, 5] as const;
function rollDay(portfolio: PaperPortfolioState, timestamp: string): PaperPortfolioState {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return portfolio;
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return day === portfolio.tradingDay ? portfolio : { ...portfolio, tradingDay: day, dailyRealizedPnl: 0, tradingPausedForDay: false };
}
export function futuresPnl(trade: FuturesTrade, price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return (price - trade.entryPrice) * trade.quantitySol * (trade.side === "LONG" ? 1 : -1);
}
export function liquidationPrice(entry: number, leverage: number, side: "LONG" | "SHORT"): number {
  return side === "LONG" ? entry * (1 - 1 / leverage) : entry * (1 + 1 / leverage);
}
export function openFutures(portfolio: PaperPortfolioState, input: {
  side: "LONG" | "SHORT"; leverage: 1 | 2 | 3 | 5; marginUsdc: number;
  price: number; stopLoss: number | null; takeProfit: number | null;
  source?: PaperTradeSource; timestamp?: string;
}): { portfolio: PaperPortfolioState; error: string | null } {
  portfolio = rollDay(portfolio, input.timestamp ?? new Date().toISOString());
  const { side, leverage, marginUsdc, price, stopLoss, takeProfit } = input;
  if (!FUTURES_LEVERAGES.includes(leverage) || !Number.isFinite(price) || price <= 0 ||
      !Number.isFinite(marginUsdc) || marginUsdc <= 0 || marginUsdc > portfolio.availableUsdc)
    return { portfolio, error: "Enter valid margin within available virtual USDC and wait for a live price." };
  if ((portfolio.futuresTrades ?? []).some((trade) => trade.status === "OPEN"))
    return { portfolio, error: "Close the open simulated futures position first." };
  if (portfolio.tradingPausedForDay)
    return { portfolio, error: "New entries are paused by the virtual daily loss limit." };
  const validLevel = (level: number | null) => level === null || (Number.isFinite(level) && level > 0);
  if (!validLevel(stopLoss) || !validLevel(takeProfit) ||
      (stopLoss !== null && (side === "LONG" ? stopLoss >= price : stopLoss <= price)) ||
      (takeProfit !== null && (side === "LONG" ? takeProfit <= price : takeProfit >= price)))
    return { portfolio, error: "Stop loss and take profit must be on the correct side of entry." };
  const exposureUsdc = marginUsdc * leverage;
  const quantitySol = exposureUsdc / price;
  if (!Number.isFinite(exposureUsdc) || !Number.isFinite(quantitySol)) return { portfolio, error: "Invalid exposure." };
  const timestamp = input.timestamp ?? new Date().toISOString();
  const trade: FuturesTrade = {
    id: `FT-${timestamp.replace(/\D/g, "")}-${(portfolio.futuresTrades ?? []).length}`,
    side, leverage, marginUsdc, exposureUsdc, quantitySol, entryPrice: price,
    entryTimestamp: timestamp, stopLoss, takeProfit, liquidationPrice: liquidationPrice(price, leverage, side),
    source: input.source ?? "MANUAL", status: "OPEN", exitPrice: null, exitTimestamp: null,
    exitReason: null, realizedPnl: null,
  };
  return { portfolio: { ...portfolio, availableUsdc: portfolio.availableUsdc - marginUsdc,
    futuresTrades: [trade, ...(portfolio.futuresTrades ?? [])] }, error: null };
}
export function closeFutures(portfolio: PaperPortfolioState, price: number, timestamp = new Date().toISOString(), manual = false): PaperPortfolioState {
  portfolio = rollDay(portfolio, timestamp);
  const trade = (portfolio.futuresTrades ?? []).find((item) => item.status === "OPEN");
  if (!trade || !Number.isFinite(price) || price <= 0) return portfolio;
  const liquidated = trade.side === "LONG" ? price <= trade.liquidationPrice : price >= trade.liquidationPrice;
  const stopped = trade.stopLoss !== null && (trade.side === "LONG" ? price <= trade.stopLoss : price >= trade.stopLoss);
  const target = trade.takeProfit !== null && (trade.side === "LONG" ? price >= trade.takeProfit : price <= trade.takeProfit);
  if (!manual && !liquidated && !stopped && !target) return portfolio;
  const pnl = liquidated ? -trade.marginUsdc : Math.max(-trade.marginUsdc, futuresPnl(trade, price));
  const exitReason = liquidated ? "LIQUIDATION" : stopped ? "STOP_LOSS" : target ? "TAKE_PROFIT" : "MANUAL";
  const dailyRealizedPnl = portfolio.dailyRealizedPnl + pnl;
  return { ...portfolio, availableUsdc: portfolio.availableUsdc + trade.marginUsdc + pnl,
    realizedPnl: portfolio.realizedPnl + pnl, dailyRealizedPnl,
    tradingPausedForDay: portfolio.tradingPausedForDay || dailyRealizedPnl <= -(paperTradingConfig.startingBalanceUsd * paperTradingConfig.maxDailyLossPercent / 100),
    futuresTrades: (portfolio.futuresTrades ?? []).map((item) => item.id === trade.id ?
      { ...item, status: "CLOSED" as const, exitPrice: price, exitTimestamp: timestamp, exitReason, realizedPnl: pnl } : item) };
}
