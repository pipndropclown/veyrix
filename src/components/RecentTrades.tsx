import { SectionHeader } from "./SectionHeader";
import type { PaperTrade, TradeExitReason } from "@/types/trading";
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
const exitLabel = (reason: TradeExitReason | null) =>
  reason === "STOP_LOSS"
    ? "Stop Loss"
    : reason === "TAKE_PROFIT"
      ? "Take Profit"
      : reason === "STRATEGY_SIGNAL"
        ? "Strategy"
        : "—";
export function RecentTrades({ trades }: { trades: PaperTrade[] }) {
  return (
    <section className="panel trades-panel">
      <SectionHeader
        eyebrow="Shared manual + autonomous history"
        title="Paper trade history"
        action={<span className="paper-count">{trades.length} simulated</span>}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date / time</th>
              <th>Pair</th>
              <th>Source</th>
              <th>Strategy / TF</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Size</th>
              <th>P&amp;L</th>
              <th>Exit reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.length ? (
              trades.slice(0, 20).map((trade) => (
                <tr key={trade.id}>
                  <td>
                    <span className="trade-time">
                      {new Date(trade.entryTimestamp).toLocaleTimeString(
                        "en-US",
                        { hour12: false },
                      )}
                    </span>
                    <small>
                      {new Date(trade.entryTimestamp).toLocaleDateString()}
                    </small>
                  </td>
                  <td>
                    <strong>{trade.pair}</strong>
                    <small>SPOT BUY</small>
                  </td>
                  <td>{trade.source ?? "AUTONOMOUS"}</td>
                  <td>
                    {trade.strategyName ?? "Manual"}
                    <small>
                      {trade.automationTimeframe ?? "User initiated"}
                    </small>
                  </td>
                  <td>{usd(trade.entryPrice)}</td>
                  <td>
                    {trade.status === "OPEN" ? "—" : usd(trade.exitPrice ?? 0)}
                  </td>
                  <td>{usd(trade.positionSizeUsdc)}</td>
                  <td
                    className={
                      trade.realizedPnl === null || trade.realizedPnl >= 0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {trade.realizedPnl === null
                      ? "—"
                      : `${trade.realizedPnl >= 0 ? "+" : "−"}${usd(Math.abs(trade.realizedPnl))}`}
                  </td>
                  <td>{exitLabel(trade.exitReason)}</td>
                  <td>
                    <span
                      className={`trade-status ${trade.status.toLowerCase()}`}
                    >
                      {trade.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-table" colSpan={10}>
                  No paper trades yet. Enable automation and wait for a
                  qualifying closed-candle signal, or place a confirmed manual
                  paper trade.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
