import type { EquityPoint } from "@/types/analytics";
export interface EquitySeries {
  name: string;
  color: string;
  points: EquityPoint[];
}
export function MultiEquityCurveChart({ series }: { series: EquitySeries[] }) {
  const visible = series.filter((item) => item.points.length > 1),
    values = visible.flatMap((item) => item.points.map((p) => p.equity));
  if (!values.length)
    return <div className="analytics-empty">No comparison equity data.</div>;
  const width = 800,
    height = 220,
    left = 58,
    right = 14,
    top = 12,
    bottom = 28,
    low = Math.min(...values),
    high = Math.max(...values),
    range = high - low || 1,
    y = (v: number) => top + ((high - v) / range) * (height - top - bottom);
  return (
    <div className="multi-chart">
      <div className="chart-legend">
        {visible.map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Strategy equity comparison"
      >
        {[0, 0.5, 1].map((r) => (
          <g key={r}>
            <line
              x1={left}
              x2={width - right}
              y1={top + r * (height - top - bottom)}
              y2={top + r * (height - top - bottom)}
              className="equity-gridline"
            />
            <text
              x={left - 7}
              y={top + r * (height - top - bottom) + 4}
              textAnchor="end"
            >
              ${Math.round(high - r * range).toLocaleString()}
            </text>
          </g>
        ))}
        {visible.map((item) => {
          const x = (i: number) =>
              left +
              (i / Math.max(1, item.points.length - 1)) *
                (width - left - right),
            path = item.points
              .map(
                (point, i) =>
                  `${i ? "L" : "M"}${x(i).toFixed(1)},${y(point.equity).toFixed(1)}`,
              )
              .join(" ");
          return (
            <path
              key={item.name}
              d={path}
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}
