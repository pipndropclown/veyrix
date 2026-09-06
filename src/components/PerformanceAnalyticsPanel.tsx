import { EquityCurveChart } from "./EquityCurveChart";
import { SectionHeader } from "./SectionHeader";
import type { PerformanceAnalytics } from "@/types/analytics";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
const signedUsd = (value: number) =>
  `${value >= 0 ? "+" : "−"}${usd(Math.abs(value))}`;
const pct = (value: number | null, signed = false) =>
  value === null
    ? "Unavailable"
    : `${signed && value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const number = (value: number | null) =>
  value === null ? "Unavailable" : value.toFixed(2);
const duration = (value: number | null) =>
  value === null
    ? "Unavailable"
    : value < 3_600_000
      ? `${Math.round(value / 60_000)}m`
      : `${(value / 3_600_000).toFixed(1)}h`;

export function PerformanceAnalyticsPanel({
  analytics,
}: {
  analytics: PerformanceAnalytics;
}) {
  const cards = [
    [
      "Total return",
      pct(analytics.totalReturnPercent, true),
      analytics.totalReturnPercent,
    ],
    ["Net profit", signedUsd(analytics.netProfit), analytics.netProfit],
    ["Win rate", pct(analytics.winRate), null],
    ["Profit factor", number(analytics.profitFactor), null],
    [
      "Expectancy",
      analytics.expectancyDollars === null
        ? "Unavailable"
        : signedUsd(analytics.expectancyDollars),
      analytics.expectancyDollars,
    ],
    [
      "Max drawdown",
      pct(analytics.maximumDrawdownPercent),
      -analytics.maximumDrawdownPercent,
    ],
  ] as const;
  const details = [
    ["Starting balance", usd(analytics.startingBalance)],
    ["Current portfolio", usd(analytics.currentPortfolioValue)],
    ["Realized P&L", signedUsd(analytics.realizedPnl)],
    ["Unrealized P&L", signedUsd(analytics.unrealizedPnl)],
    [
      "Completed / W / L / BE",
      `${analytics.completedTrades} / ${analytics.winningTrades} / ${analytics.losingTrades} / ${analytics.breakEvenTrades}`,
    ],
    ["Loss rate", pct(analytics.lossRate)],
    [
      "Average win",
      analytics.averageWinningTrade === null
        ? "Unavailable"
        : usd(analytics.averageWinningTrade),
    ],
    [
      "Average loss",
      analytics.averageLosingTrade === null
        ? "Unavailable"
        : signedUsd(analytics.averageLosingTrade),
    ],
    [
      "Largest win",
      analytics.largestWinningTrade === null
        ? "Unavailable"
        : usd(analytics.largestWinningTrade),
    ],
    [
      "Largest loss",
      analytics.largestLosingTrade === null
        ? "Unavailable"
        : signedUsd(analytics.largestLosingTrade),
    ],
    [
      "Average P&L",
      analytics.averagePnlPerTrade === null
        ? "Unavailable"
        : signedUsd(analytics.averagePnlPerTrade),
    ],
    ["Avg win / loss", number(analytics.averageWinLossRatio)],
    [
      "Current W / L streak",
      `${analytics.currentWinningStreak} / ${analytics.currentLosingStreak}`,
    ],
    [
      "Longest W / L streak",
      `${analytics.longestWinningStreak} / ${analytics.longestLosingStreak}`,
    ],
    ["Average holding", duration(analytics.averageHoldingDurationMs)],
    [
      "Holding range",
      analytics.shortestHoldingDurationMs === null
        ? "Unavailable"
        : `${duration(analytics.shortestHoldingDurationMs)} – ${duration(analytics.longestHoldingDurationMs)}`,
    ],
  ];
  return (
    <section className="analytics-section">
      <SectionHeader
        eyebrow="Live paper account"
        title="Performance analytics"
        action={<span className="paper-count">REALIZED + OPEN P&amp;L</span>}
      />
      <div className="analytics-key-grid">
        {cards.map(([label, value, trend]) => (
          <article className="analytics-card" key={label}>
            <span>{label}</span>
            <strong
              className={
                trend === null ? "" : trend >= 0 ? "positive" : "negative"
              }
            >
              {value}
            </strong>
          </article>
        ))}
      </div>
      <div className="analytics-layout">
        <section className="panel analytics-chart-panel">
          <SectionHeader
            eyebrow="Closed trades only"
            title="Realized equity curve"
          />
          <EquityCurveChart
            points={analytics.equityCurve}
            emptyMessage="No completed trades yet. The realized equity curve starts when a paper trade closes."
          />
        </section>
        <section className="panel analytics-detail-panel">
          <SectionHeader
            eyebrow="Trade-derived statistics"
            title="Detailed performance"
          />
          <dl>
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="analytics-note">
            Expectancy % = dollar expectancy ÷ average capital allocated per
            completed trade. Break-even trades reset both streaks.
          </p>
        </section>
      </div>
    </section>
  );
}
