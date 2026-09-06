import { SectionHeader } from "./SectionHeader";
import { paperTradingConfig } from "@/lib/trading/tradingConfig";
import type { PositionRiskLevels } from "@/lib/trading/riskEngine";
import type { PaperPortfolioMetrics } from "@/types/trading";

interface RiskManagementPanelProps {
  metrics: PaperPortfolioMetrics;
  levels: PositionRiskLevels | null;
}
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

export function RiskManagementPanel({
  metrics,
  levels,
}: RiskManagementPanelProps) {
  return (
    <section className="panel risk-panel">
      <SectionHeader
        eyebrow="Paper safeguards"
        title="Risk management"
        action={
          <span
            className={`risk-status ${metrics.tradingPausedForDay ? "paused" : ""}`}
          >
            <i />
            {metrics.tradingPausedForDay
              ? "Paused — daily loss limit"
              : "Active"}
          </span>
        }
      />
      <div className="risk-grid">
        <div>
          <span>Stop loss</span>
          <strong>{paperTradingConfig.stopLossPercent}%</strong>
        </div>
        <div>
          <span>Take profit</span>
          <strong>{paperTradingConfig.takeProfitPercent}%</strong>
        </div>
        <div>
          <span>Max daily loss</span>
          <strong>{paperTradingConfig.maxDailyLossPercent}%</strong>
          <small>{usd(metrics.dailyLossLimit)} fixed reference limit</small>
        </div>
        <div>
          <span>Daily realized P&amp;L</span>
          <strong
            className={metrics.dailyRealizedPnl >= 0 ? "positive" : "negative"}
          >
            {usd(metrics.dailyRealizedPnl)}
          </strong>
          <small>{metrics.tradingDay}</small>
        </div>
        <div>
          <span>Daily loss remaining</span>
          <strong>{usd(metrics.dailyLossRemaining)}</strong>
        </div>
        <div>
          <span>Position risk</span>
          <strong>{levels ? "Monitoring" : "No open position"}</strong>
          <small>
            {levels
              ? `Stop ${usd(levels.stopLossPrice)} · Target ${usd(levels.takeProfitPrice)}`
              : "Entry guard remains active"}
          </small>
        </div>
      </div>
    </section>
  );
}
