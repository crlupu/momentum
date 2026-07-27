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
  // A gradient needs a per-instance id, or several rings on one page collide.
  const gid = `ring-${Math.round(pct)}-${size}-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${pct}% complete`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4589ff" />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor="#8a3ffc" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" className="text-foreground/10" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={`url(#${gid})`}
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
