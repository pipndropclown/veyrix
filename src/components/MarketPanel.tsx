import { SectionHeader } from "./SectionHeader";
import type { MarketData } from "@/types/market";

interface MarketPanelProps {
  data: MarketData | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}
function currency(value: number | null, compact = false): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}
function updatedTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function MarketPanel({
  data,
  error,
  isLoading,
  isRefreshing,
}: MarketPanelProps) {
  const change = data
    ? `${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}%`
    : "—";
  return (
    <section className="panel market-panel">
      <SectionHeader
        eyebrow="Market"
        title="SOL / USDC"
        action={
          <span className={`status-pill ${error ? "unavailable" : ""}`}>
            <i />
            {error ?? (isRefreshing ? "Refreshing" : "Live market")}
          </span>
        }
      />
      {isLoading ? (
        <div className="market-loading" role="status">
          <span />
          <span />
          <small>Loading live SOL market data…</small>
        </div>
      ) : data ? (
        <>
          <div className="market-price-row">
            <strong>{currency(data.price)}</strong>
            <span className={data.change24h < 0 ? "negative" : ""}>
              {change} <small>24h</small>
            </span>
          </div>
          <div className="chart" aria-label="Market panel visual">
            <div className="chart-grid" />
            <svg viewBox="0 0 600 130" preserveAspectRatio="none" role="img">
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#61f2c2" stopOpacity=".24" />
                  <stop offset="100%" stopColor="#61f2c2" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                className="chart-area"
                d="M0,115 C35,110 48,76 78,87 S130,104 155,72 S203,64 230,82 S282,78 310,52 S365,66 390,45 S435,58 460,32 S520,50 548,20 S580,21 600,8 L600,130 L0,130 Z"
              />
              <path
                className="chart-line"
                d="M0,115 C35,110 48,76 78,87 S130,104 155,72 S203,64 230,82 S282,78 310,52 S365,66 390,45 S435,58 460,32 S520,50 548,20 S580,21 600,8"
              />
            </svg>
          </div>
          <div className="market-stats">
            <div>
              <span>24h high</span>
              <strong>{currency(data.high24h)}</strong>
            </div>
            <div>
              <span>24h low</span>
              <strong>{currency(data.low24h)}</strong>
            </div>
            <div>
              <span>24h volume</span>
              <strong>{currency(data.volume24h, true)}</strong>
            </div>
            <div>
              <span>Last updated</span>
              <strong>{updatedTime(data.lastUpdated)}</strong>
            </div>
          </div>
        </>
      ) : (
        <div className="market-error" role="alert">
          <strong>Market data unavailable</strong>
          <p>
            Live SOL pricing could not be retrieved. Veyrix will retry
            automatically.
          </p>
        </div>
      )}
    </section>
  );
}
