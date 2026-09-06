import type { EquityPoint } from "@/types/analytics";

interface Props {
  points: EquityPoint[];
  emptyMessage: string;
  comparisonPoints?: EquityPoint[];
  primaryLabel?: string;
  comparisonLabel?: string;
}
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export function EquityCurveChart({
  points,
  emptyMessage,
  comparisonPoints = [],
  primaryLabel = "Momentum Agent",
  comparisonLabel = "Buy & Hold SOL",
}: Props) {
  if (points.length <= 1)
    return <div className="analytics-empty">{emptyMessage}</div>;
  const width = 800,
    height = 210,
    left = 58,
    top = 14,
    right = 14,
    bottom = 32;
  const values = [...points, ...comparisonPoints].map((point) => point.equity);
  const low = Math.min(...values),
    high = Math.max(...values),
    range = high - low || Math.max(1, high * 0.01);
  const x = (index: number) =>
    left + (index / Math.max(1, points.length - 1)) * (width - left - right);
  const y = (value: number) =>
    top + ((high - value) / range) * (height - top - bottom);
  const path = points
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.equity).toFixed(1)}`,
    )
    .join(" ");
  const comparisonX = (index: number) =>
    left +
    (index / Math.max(1, comparisonPoints.length - 1)) * (width - left - right);
  const comparisonPath = comparisonPoints
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${comparisonX(index).toFixed(1)},${y(point.equity).toFixed(1)}`,
    )
    .join(" ");
  return (
    <div className="equity-chart">
      {comparisonPoints.length > 0 && (
        <div className="chart-legend">
          <span>
            <i />
            {primaryLabel}
          </span>
          <span>
            <i className="benchmark-dot" />
            {comparisonLabel}
          </span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Equity comparison beginning at ${money(points[0].equity)}`}
        preserveAspectRatio="none"
      >
        {[0, 0.5, 1].map((ratio) => {
          const rowY = top + ratio * (height - top - bottom);
          return (
            <g key={ratio}>
              <line
                x1={left}
                x2={width - right}
                y1={rowY}
                y2={rowY}
                className="equity-gridline"
              />
              <text x={left - 8} y={rowY + 4} textAnchor="end">
                {money(high - ratio * range)}
              </text>
            </g>
          );
        })}
        <path d={path} className="equity-line" />
        {comparisonPath && (
          <path d={comparisonPath} className="equity-line benchmark-line" />
        )}
        <circle
          cx={x(points.length - 1)}
          cy={y(points.at(-1)!.equity)}
          r="3"
          className="equity-dot"
        />
        <text x={left} y={height - 8}>
          {new Date(points[0].timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </text>
        <text x={width - right} y={height - 8} textAnchor="end">
          {new Date(points.at(-1)!.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </text>
      </svg>
    </div>
  );
}
