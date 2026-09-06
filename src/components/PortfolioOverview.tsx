import { SectionHeader } from "./SectionHeader";
import type { PositionRiskLevels } from "@/lib/trading/riskEngine";
import type { PaperPortfolioMetrics } from "@/types/trading";

interface PortfolioOverviewProps {
  metrics: PaperPortfolioMetrics;
  riskLevels: PositionRiskLevels | null;
  onReset: () => void;
}
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
const signedUsd = (value: number) =>
  `${value >= 0 ? "+" : "−"}${usd(Math.abs(value))}`;
const percent = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;

export function PortfolioOverview({
  metrics,
  riskLevels,
  onReset,
}: PortfolioOverviewProps) {
  const cards = [
    {
      label: "Starting balance",
      value: usd(metrics.startingBalance),
      detail: "Virtual USDC",
    },
    {
      label: "Portfolio value",
      value: usd(metrics.totalPortfolioValue),
      detail: metrics.state,
      featured: true,
    },
    {
      label: "Available USDC",
      value: usd(metrics.availableUsdc),
      detail: "Virtual balance",
    },
    {
      label: "SOL position value",
      value: usd(metrics.solPositionValue),
      detail: `${metrics.solBalance.toFixed(6)} SOL`,
    },
    {
      label: "Realized P&L",
      value: signedUsd(metrics.realizedPnl),
      detail: "Closed trades",
      trend: metrics.realizedPnl,
    },
    {
      label: "Unrealized P&L",
      value: signedUsd(metrics.unrealizedPnl),
      detail: `${percent(metrics.unrealizedPnlPercent)} open`,
      trend: metrics.unrealizedPnl,
    },
    {
      label: "Total return",
      value: percent(metrics.totalReturnPercent),
      detail: "Mark-to-market",
      trend: metrics.totalReturnPercent,
    },
    {
      label: "Completed trades",
      value: String(metrics.completedTrades),
      detail: `${metrics.winningTrades} wins · ${metrics.losingTrades} losses`,
    },
    {
      label: "Win rate",
      value: `${metrics.winRate.toFixed(1)}%`,
      detail: metrics.completedTrades
        ? `${metrics.winningTrades} of ${metrics.completedTrades}`
        : "No closed trades",
    },
  ];
  const position = [
    ["Position", metrics.state],
    [
      "Entry",
      metrics.averageSolEntryPrice === null
        ? "—"
        : usd(metrics.averageSolEntryPrice),
    ],
    [
      "Current price",
      metrics.currentPrice === null ? "Waiting…" : usd(metrics.currentPrice),
    ],
    ["SOL quantity", metrics.solBalance.toFixed(6)],
    ["Position value", usd(metrics.solPositionValue)],
    [
      "Unrealized",
      `${signedUsd(metrics.unrealizedPnl)} (${percent(metrics.unrealizedPnlPercent)})`,
    ],
    ["Stop loss", riskLevels ? usd(riskLevels.stopLossPrice) : "—"],
    ["Take profit", riskLevels ? usd(riskLevels.takeProfitPrice) : "—"],
  ];

  return (
    <section className="portfolio-section">
      <SectionHeader
        eyebrow="Paper portfolio"
        title="Portfolio overview"
        action={
          <button className="reset-button" type="button" onClick={onReset}>
            Reset paper account
          </button>
        }
      />
      <div className="metric-grid paper-metrics">
        {cards.map((card) => (
          <article
            className={`metric-card ${card.featured ? "featured" : ""}`}
            key={card.label}
          >
            <div className="metric-top">
              <span>{card.label}</span>
              {card.featured && <span className="spark">↗</span>}
            </div>
            <strong
              className={
                card.trend === undefined
                  ? ""
                  : card.trend >= 0
                    ? "positive"
                    : "negative"
              }
            >
              {card.value}
            </strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>
      <div className="position-strip risk-position-strip">
        {position.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
