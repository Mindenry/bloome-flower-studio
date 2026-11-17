import { formatMoney } from "@/lib/money";
import type { Locale } from "@/lib/i18n/config";

export function RevenueChart({
  data,
  locale,
  height = 180,
}: {
  data: Array<{ day: string; revenue: number; orders: number }>;
  locale: Locale;
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-muted">No data for this period.</p>;
  }
  const max = Math.max(1, ...data.map((point) => point.revenue));
  const width = 720;
  const padding = { top: 12, right: 8, bottom: 22, left: 8 };
  const chartHeight = height - padding.top - padding.bottom;
  const step = data.length > 1 ? (width - padding.left - padding.right) / (data.length - 1) : 0;

  const points = data.map((point, index) => {
    const x = padding.left + index * step;
    const y = padding.top + chartHeight - (point.revenue / max) * chartHeight;
    return { ...point, x, y };
  });

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${padding.top + chartHeight} L${points[0].x.toFixed(1)},${padding.top + chartHeight} Z`;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full" role="img" aria-label="Revenue trend">
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#81917B" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#81917B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartHeight * ratio}
            y2={padding.top + chartHeight * ratio}
            stroke="#EAE8E1"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#revenueFill)" />
        <path d={line} fill="none" stroke="#596B55" strokeWidth="1.8" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.day}>
            <circle cx={point.x} cy={point.y} r="2.6" fill="#fff" stroke="#596B55" strokeWidth="1.4">
              <title>{`${point.day} · ${formatMoney(point.revenue, { locale })} · ${point.orders} orders`}</title>
            </circle>
            {(data.length <= 10 || index % Math.ceil(data.length / 7) === 0) ? (
              <text
                x={point.x}
                y={height - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#85867F"
              >
                {point.day.slice(5)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <div className="flex justify-between border-t border-line pt-3 text-[11px] text-muted">
        <span>{data.reduce((sum, point) => sum + point.orders, 0)} orders</span>
        <span>{formatMoney(data.reduce((sum, point) => sum + point.revenue, 0), { locale })}</span>
      </div>
    </div>
  );
}

export function CategoryBars({
  data,
  locale,
}: {
  data: Array<{ name: string; revenue: number }>;
  locale: Locale;
}) {
  if (data.length === 0) return <p className="py-6 text-center text-xs text-muted">No sales yet.</p>;
  const max = Math.max(1, ...data.map((row) => row.revenue));
  return (
    <ul className="space-y-3">
      {data.map((row) => (
        <li key={row.name}>
          <div className="flex items-center justify-between gap-3 text-[12px]">
            <span className="truncate">{row.name}</span>
            <span className="shrink-0 text-muted">{formatMoney(row.revenue, { locale })}</span>
          </div>
          <div className="mt-1 h-1.5 bg-[#f1efe8]">
            <div className="h-full bg-primary" style={{ width: `${Math.round((row.revenue / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
