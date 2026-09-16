"use client";
import { useState } from "react";
import { futuresPnl, liquidationPrice } from "@/lib/trading/futuresEngine";
import type { FuturesTrade, PaperPortfolioState } from "@/types/trading";
import type { StrategyId } from "@/types/strategy";
import { formatMarketPrice,formatMarketQuantity,MARKET_REGISTRY,type MarketId } from "@/lib/market/marketRegistry";
import { calculateMultiMarketAccount } from "@/lib/trading/accountMetrics";

const usd = (value: number) => `$${value.toFixed(2)}`;
export function FuturesPaperPanel({ marketId,prices,portfolio, price, onOpen, onClose, autonomousEnabled, onAutonomousChange, strategyId, onStrategyChange }: {
  marketId:MarketId; prices:Partial<Record<MarketId,number>>;
  portfolio: PaperPortfolioState; price: number | null;
  autonomousEnabled: boolean; onAutonomousChange(enabled: boolean): void;
  strategyId: StrategyId; onStrategyChange(id: StrategyId): void;
  onOpen(input: { side: "LONG" | "SHORT"; leverage: 1 | 2 | 3 | 5; marginUsdc: number; stopLoss: number | null; takeProfit: number | null }): string | null;
  onClose(): void;
}) {
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [leverage, setLeverage] = useState<1 | 2 | 3 | 5>(1);
  const [margin, setMargin] = useState("1000");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const position = (portfolio.futuresTrades ?? []).find((trade) => trade.status === "OPEN"&&(trade.marketId??"SOL")===marketId);
  const amount = Number(margin);
  const account=calculateMultiMarketAccount(portfolio,prices);
  const parseLevel = (value: string) => value.trim() === "" ? null : Number(value);
  return <section className="panel manual-panel futures-panel">
    <div className="futures-banner"><strong>SIMULATED FUTURES</strong><span>NO REAL FUNDS OR BORROWING</span></div>
    <h2>Futures paper terminal · {MARKET_REGISTRY[marketId].displaySymbol}</h2>
    <p>One shared virtual account. Margin is reserved from available USDC; exposure is simulated.</p>
    <label className="futures-auto-toggle"><input type="checkbox" checked={autonomousEnabled} onChange={(event) => onAutonomousChange(event.target.checked)} /> Autonomous futures signals (uses the market, timeframe, allocation, leverage, and risk settings in Automation)</label>
    <label>Autonomous strategy <select value={strategyId} onChange={(event) => onStrategyChange(event.target.value as StrategyId)}><option value="momentum">Momentum Agent</option><option value="moving_average">Moving Average Agent</option><option value="mean_reversion">Mean Reversion Agent</option></select></label>
    <small>BUY opens a simulated long; SELL opens a simulated short. New closed candles only. Risk exits continue while automation is off.</small>
    <div className="futures-stats">
      <div><span>Total virtual equity</span><strong>{usd(account.totalVirtualEquity)}</strong></div>
      <div><span>Available virtual collateral</span><strong>{usd(portfolio.availableUsdc)}</strong></div>
      <div><span>Margin in use</span><strong>{usd(account.futuresMarginInUse)}</strong></div>
      <div><span>Futures exposure</span><strong>{usd(account.futuresExposure)}</strong></div>
    </div>
    {position ? <div className="futures-position">
      <h3>Open {position.side} · {position.leverage}x · {position.source}</h3>
      <p>Entry {formatMarketPrice(marketId,position.entryPrice)} · Current {price ? formatMarketPrice(marketId,price) : "Unavailable"} · Liquidation {formatMarketPrice(marketId,position.liquidationPrice)}</p>
      <p>Quantity {formatMarketQuantity(marketId,position.quantitySol)} {marketId}</p>
      <p>Margin {usd(position.marginUsdc)} · Exposure {usd(position.exposureUsdc)} · Unrealized P&amp;L {usd(Math.max(-position.marginUsdc, futuresPnl(position, price ?? position.entryPrice)))}</p>
      <p>Stop loss {position.stopLoss ? usd(position.stopLoss) : "None"} · Take profit {position.takeProfit ? usd(position.takeProfit) : "None"}</p>
      <button type="button" disabled={!price} onClick={() => { if (window.confirm("Close this SIMULATED FUTURES position? No real funds move.")) onClose(); }}>CLOSE SIMULATED POSITION</button>
    </div> : <>
      <div className="futures-fields">
        <label>Position side<select value={side} onChange={(event) => setSide(event.target.value as "LONG" | "SHORT")}><option>LONG</option><option>SHORT</option></select></label>
        <label>Leverage<select value={leverage} onChange={(event) => setLeverage(Number(event.target.value) as 1 | 2 | 3 | 5)}>{[1, 2, 3, 5].map((value) => <option key={value} value={value}>{value}x</option>)}</select></label>
        <label>Margin (virtual USDC)<input type="number" min="0.01" step="0.01" value={margin} onChange={(event) => setMargin(event.target.value)} /></label>
        <label>Stop loss (optional)<input type="number" min="0" step="any" value={stop} onChange={(event) => setStop(event.target.value)} /></label>
        <label>Take profit (optional)<input type="number" min="0" step="any" value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      </div>
      <div className="futures-stats">
        <div><span>Current SOL price / estimated entry</span><strong>{price ? usd(price) : "Unavailable"}</strong></div>
        <div><span>Position exposure</span><strong>{Number.isFinite(amount) ? usd(amount * leverage) : "—"}</strong></div>
        <div><span>Estimated liquidation</span><strong>{price ? usd(liquidationPrice(price, leverage, side)) : "—"}</strong></div>
        <div><span>Order source</span><strong>MANUAL</strong></div>
      </div>
      <button type="button" disabled={!price || !Number.isFinite(amount) || amount <= 0 || amount > portfolio.availableUsdc} onClick={() => {
        if (!window.confirm(`Open ${side} ${leverage}x SIMULATED FUTURES with ${usd(amount)} virtual margin? NO REAL FUNDS OR BORROWING.`)) return;
        setError(onOpen({ side, leverage, marginUsdc: amount, stopLoss: parseLevel(stop), takeProfit: parseLevel(target) }));
      }}>OPEN SIMULATED {side}</button>
    </>}
    {error && <p role="alert" className="backtest-error">{error}</p>}
    <h3>Futures history</h3>
    <div className="table-wrap"><table><thead><tr><th>Side</th><th>Source</th><th>Entry</th><th>Exit</th><th>Margin</th><th>Exposure</th><th>P&amp;L</th><th>Status / reason</th></tr></thead><tbody>
      {(portfolio.futuresTrades ?? []).filter(t=>(t.marketId??"SOL")===marketId).length ? (portfolio.futuresTrades ?? []).filter(t=>(t.marketId??"SOL")===marketId).map((trade: FuturesTrade) => <tr key={trade.id}><td>{trade.side} {trade.leverage}x</td><td>{trade.source}</td><td>{formatMarketPrice(marketId,trade.entryPrice)}</td><td>{trade.exitPrice ? formatMarketPrice(marketId,trade.exitPrice) : "—"}</td><td>{usd(trade.marginUsdc)}</td><td>{usd(trade.exposureUsdc)}</td><td>{trade.realizedPnl === null ? "—" : usd(trade.realizedPnl)}</td><td>{trade.status} {trade.exitReason ?? ""}</td></tr>) : <tr><td colSpan={8}>No simulated futures trades yet.</td></tr>}
    </tbody></table></div>
  </section>;
}
