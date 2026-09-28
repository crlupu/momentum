"use client";

import { FormEvent, useState } from "react";
import { useWidth } from "./useWidth";
import { Button, Input, PanelHeader } from "./ui";
import { fmtDate, fmtDateAuto } from "@/lib/dates";
import { Plus } from "./icons";
import { usePending } from "./ActionButton";
import { Tracker, WeightEntry, dateKey } from "@/lib/tracker";

/** Section accent; follows the theme so it stays visible on dark. */
const ACCENT = "var(--sec-weight)";
const GRID = "var(--border)";
const LABEL = "var(--muted)";

/** The window the chart shows. */
const DAYS = 30;

function lastNDays(n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

/**
 * The last month's weigh-ins. Drawn at the width it is given and a fixed
 * height, so the text stays the same size on a phone and a desktop. Days
 * without an entry are gaps the line passes over.
 */
function WeightChart({ weights }: { weights: WeightEntry[] }) {
  const [box, measured] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const W = measured || 320;
  const H = 170;
  const pad = { l: 40, r: 12, t: 12, b: 24 };

  const days = lastNDays(DAYS);
  const byDate = new Map(weights.map((w) => [w.date, w.kg]));
  const series = days.map((d, i) => ({ i, date: dateKey(d), kg: byDate.get(dateKey(d)) }));
  const present = series.filter((p) => typeof p.kg === "number") as { i: number; date: string; kg: number }[];

  // Y range: fit the window, or a neutral placeholder when empty.
  let lo = 0;
  let hi = 1;
  if (present.length) {
    const kgs = present.map((p) => p.kg);
    const min = Math.min(...kgs);
    const max = Math.max(...kgs);
    const span = max - min || 2;
    lo = min - span * 0.2;
    hi = max + span * 0.2;
  }

  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (DAYS - 1);
  const y = (kg: number) => H - pad.b - ((kg - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const gridYs = [0, 0.5, 1].map((f) => pad.t + f * (H - pad.t - pad.b));
  const pts = present.map((p) => `${x(p.i)},${y(p.kg)}`).join(" ");
  // A date label every few days, as many as fit, always ending on today.
  const every = Math.max(1, Math.ceil(DAYS / Math.max(2, Math.floor((W - pad.l) / 44))));
  const shown = hover != null ? present.find((p) => p.i === hover) : undefined;

  return (
    <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} className="block" role="img" aria-label={`Weight over the last ${DAYS} days`}>
        {gridYs.map((yy, idx) => (
          <g key={idx}>
            <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke={GRID} strokeWidth="1" />
            {present.length > 0 && (
              <text x={pad.l - 8} y={yy} dy="0.32em" textAnchor="end" fill={LABEL} fontSize="11">
                {(hi - ((yy - pad.t) / (H - pad.t - pad.b)) * (hi - lo)).toFixed(1)}
              </text>
            )}
          </g>
        ))}

        {present.length > 1 && (
          <polyline
            points={pts}
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {present.map((p) => (
          <circle
            key={p.date}
            cx={x(p.i)}
            cy={y(p.kg)}
            r={hover === p.i ? 5 : 4}
            fill={ACCENT}
            stroke="var(--pane-bg)"
            strokeWidth="2"
          />
        ))}

        {series.map((p, i) =>
          (DAYS - 1 - i) % every === 0 ? (
            <text
              key={p.date}
              x={x(i)}
              y={H - 6}
              // The last label ends at the edge rather than running past it.
              textAnchor={i === DAYS - 1 ? "end" : "middle"}
              fill={LABEL}
              fontSize="11"
            >
              {fmtDate(p.date)}
            </text>
          ) : null
        )}

        {/* Hover targets: a column per day with an entry, far wider than
            the dot, so it can be found with a finger. */}
        {present.map((p) => (
          <rect
            key={`hit-${p.date}`}
            x={x(p.i) - (W - pad.l - pad.r) / (DAYS - 1) / 2}
            y={pad.t}
            width={(W - pad.l - pad.r) / (DAYS - 1)}
            height={H - pad.t - pad.b}
            fill="transparent"
            onMouseEnter={() => setHover(p.i)}
            onClick={() => setHover(hover === p.i ? null : p.i)}
          />
        ))}
      </svg>
      {shown && (
        <div
          className="chart-tip"
          style={{
            left: x(shown.i),
            top: Math.max(0, y(shown.kg) - 52),
            transform: shown.i > DAYS / 2 ? "translateX(-100%)" : undefined,
          }}
        >
          <div className="font-semibold">{shown.kg} kg</div>
          <div>{fmtDateAuto(shown.date)}</div>
        </div>
      )}
    </div>
  );
}

export default function WeightTracker({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const data = s.weights;
  const latest = data.length ? data[data.length - 1] : null;
  const [kg, setKg] = useState("");

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kg);
    if (!Number.isFinite(v) || v <= 0 || pending) return;
    const ok = await run(() => tracker.addWeight(v));
    if (ok) setKg("");
  };

  return (
    <div>
      <PanelHeader title="Weight" color="var(--sec-fitness)">
        {latest && (
          <span>
            <span className="font-mono-n font-bold text-foreground">{latest.kg}</span> kg ·{" "}
            {fmtDateAuto(latest.date)}
          </span>
        )}
      </PanelHeader>

      <div className="card p-4 md:p-5">
        <form onSubmit={submit} className="mb-3 flex gap-2">
          <Input
            type="number"
            step="0.1"
            aria-label="Weight in kg"
            placeholder="Weight today (kg)…"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            isIconOnly
            aria-label="Add"
            isDisabled={pending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="mb-1 text-xs" style={{ color: LABEL }}>
          Last {DAYS} days
        </div>
        <WeightChart weights={data} />
      </div>
    </div>
  );
}
