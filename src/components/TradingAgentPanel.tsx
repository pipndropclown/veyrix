import { SectionHeader } from "./SectionHeader";
import type { StrategyResult } from "@/types/strategy";

interface TradingAgentPanelProps {
  strategy: StrategyResult | null;
  isLoading: boolean;
}
function currency(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}
function percentage(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function TradingAgentPanel({
  strategy,
  isLoading,
}: TradingAgentPanelProps) {
  const signal = strategy?.signal ?? "HOLD";
  const confidence = strategy?.confidence ?? 0;
  const reason = isLoading
    ? "Waiting for the latest SOL price observation."
    : (strategy?.reason ??
      "Live market data is unavailable, so no strategy decision was made.");
  const signalClass =
    signal === "BUY"
      ? "buy-signal"
      : signal === "SELL"
        ? "sell-signal"
        : "hold-signal";
  return (
    <section className="panel agent-panel">
      <SectionHeader
        eyebrow="Trading agent"
        title="Momentum Agent"
        action={
          <span className="status-pill active">
            <i />
            Decision only
          </span>
        }
      />
      <div className="signal-block">
        <div>
          <span>Current signal</span>
          <strong className={signalClass}>{signal}</strong>
        </div>
        <div className="confidence">
          <span>{confidence}%</span>
          <small>Rule confidence</small>
        </div>
      </div>
      <div className="confidence-track">
        <span style={{ width: `${confidence}%` }} />
      </div>
      <div className="strategy-metrics">
        <div>
          <span>Recent change</span>
          <strong>
            {percentage(strategy?.metrics.shortTermChangePercent ?? null)}
          </strong>
        </div>
        <div>
          <span>Recent average</span>
          <strong>{currency(strategy?.metrics.recentAverage ?? null)}</strong>
        </div>
        <div>
          <span>From average</span>
          <strong>
            {percentage(strategy?.metrics.differenceFromAveragePercent ?? null)}
          </strong>
        </div>
      </div>
      <div className="reasoning">
        <div className="reasoning-icon">✦</div>
        <div>
          <span>Strategy reason</span>
          <p>{reason}</p>
        </div>
      </div>
      <div className="agent-footer">
        <span>
          <i className="pulse" />
          {strategy?.metrics.observationCount ?? 0} observations
        </span>
        <span>Paper execution only</span>
      </div>
    </section>
  );
}
