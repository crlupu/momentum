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
  // Four characters ("100%") need a step down to stay inside the ring.
  const fontSize = size >= 48 ? (pct >= 100 ? 12 : 13) : 11;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% complete`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--accent-track)" strokeWidth={stroke} />
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
        className="ring-progress"
      />
      <text
        x={cx}
        y={cx}
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-foreground font-mono-n"
        fontSize={fontSize}
        fontWeight="700"
        letterSpacing={pct >= 100 ? -0.4 : 0}
      >
        {pct}%
      </text>
    </svg>
  );
}
