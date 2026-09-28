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
  // The label keeps clear of the ring: it fits within 70% of the space
  // inside it, so "100%" steps down a size rather than touching the stroke.
  // A small ring that has closed shows a check instead, which reads at a
  // size where "100%" would not.
  const label = `${pct}%`;
  const inner = 2 * (r - stroke / 2);
  const fontSize = Math.min(size >= 48 ? 13 : 11, (inner * 0.7) / (label.length * 0.66));
  const check = pct >= 100 && size < 48;
  const k = inner * 0.22;
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
      {check ? (
        <path
          d={`M${cx - k * 1.1} ${cx + k * 0.05} L${cx - k * 0.3} ${cx + k * 0.85} L${cx + k * 1.15} ${cx - k * 0.75}`}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <text
          x={cx}
          y={cx}
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-foreground font-mono-n"
          fontSize={fontSize}
          fontWeight="700"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
