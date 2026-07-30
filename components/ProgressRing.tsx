"use client";

export function ProgressRing({
  pct,
  color,
  size = 56,
}: {
  pct: number;
  color: string;
  size?: number;
}) {
  const stroke = size >= 48 ? 5 : 4;
  const r = size / 2 - stroke;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${pct}% complete`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" className="text-foreground/10" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: "stroke-dashoffset .3s ease" }}
      />
      <text
        x={cx}
        y={cx}
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-foreground font-mono-n"
        fontSize={size >= 48 ? 14 : 11}
        fontWeight="600"
      >
        {pct}%
      </text>
    </svg>
  );
}
