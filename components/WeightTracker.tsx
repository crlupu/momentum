"use client";

import { FormEvent, useState } from "react";
import { useWidth } from "./useWidth";
import { Button, Input, PanelHeader, AddButton } from "./ui";
import { fmtDate, fmtDateAuto } from "@/lib/dates";
import { usePending } from "./ActionButton";
import { Tracker, WeightEntry, dateKey } from "@/lib/tracker";
import { type WeightPlan, addDays, expectedOn, mondayOf, validPlan, weeklyMedians } from "@/lib/weight";
import Link from "next/link";
import { ChevronRight } from "./icons";

/** Section accent; follows the theme so it stays visible on dark. */
const ACCENT = "var(--chart-1)";
const GRID = "var(--chart-grid)";
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
function WeightChart({
  weights,
  plan,
  simple,
}: {
  weights: WeightEntry[];
  plan?: WeightPlan;
  /** Just the weight and the plan: no weekly medians. */
  simple?: boolean;
}) {
  const [box, measured] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const W = measured || 320;
  const H = 170;
  const pad = { l: 40, r: 12, t: 12, b: 24 };

  const days = lastNDays(DAYS);
  const byDate = new Map(weights.map((w) => [w.date, w.kg]));
  const series = days.map((d, i) => ({ i, date: dateKey(d), kg: byDate.get(dateKey(d)) }));
  const present = series.filter((p) => typeof p.kg === "number") as { i: number; date: string; kg: number }[];
  const medians = simple ? [] : weeklyMedians(weights).filter((m) => addDays(m.week, 6) >= series[0].date);
  // Where the plan puts each day of the window it covers.
  const planPts = plan
    ? series.filter((p) => p.date >= plan.startDate).map((p) => ({ i: p.i, kg: expectedOn(plan, p.date) }))
    : [];

  // Y range: fit the window, or a neutral placeholder when empty.
  let lo = 0;
  let hi = 1;
  if (present.length) {
    const kgs = [...present.map((p) => p.kg), ...medians.map((m) => m.median), ...planPts.map((p) => p.kg)];
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

        {planPts.length > 1 && (
          <polyline
            points={planPts.map((p) => `${x(p.i)},${y(p.kg)}`).join(" ")}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="1.5"
            strokeDasharray="2 4"
            strokeLinecap="round"
          />
        )}

        {/* Each week's median as a level line across the week's days. */}
        {medians.map((m) => {
          const a = series.findIndex((p) => p.date >= m.week);
          const end = addDays(m.week, 6);
          let b = -1;
          series.forEach((p, i) => { if (p.date <= end) b = i; });
          if (a < 0 || b < a) return null;
          return (
            <line
              key={m.week}
              x1={x(a) - (a === b ? 4 : 0)}
              x2={x(b) + (a === b ? 4 : 0)}
              y1={y(m.median)}
              y2={y(m.median)}
              stroke="var(--chart-2)"
              strokeWidth="2"
              strokeDasharray="5 3"
              opacity={0.9}
            />
          );
        })}

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
          (DAYS - 1 - i) % every === 0 && (i === DAYS - 1 || x(DAYS - 1) - x(i) >= 72) ? (
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
            transform: shown.i > DAYS / 2 ? "translateX(-100%)" : undefined }}
        >
          <div className="font-semibold">{shown.kg} kg</div>
          {plan && shown.date >= plan.startDate && (
            <div>
              plan {expectedOn(plan, shown.date).toFixed(1)} ·{" "}
              {(() => {
                const d = Math.round((shown.kg - expectedOn(plan, shown.date)) * 10) / 10;
                return d === 0 ? "±0" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`;
              })()}
            </div>
          )}
          <div>{fmtDateAuto(shown.date)}</div>
        </div>
      )}
    </div>
  );
}

export default function WeightTracker({ tracker, summary }: { tracker: Tracker; summary?: boolean }) {
  const s = tracker.state!;
  const data = s.weights;
  const latest = data.length ? data[data.length - 1] : null;
  const plan = validPlan(s.weightPlan);
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
      <PanelHeader title={summary ? "Weight" : "Weigh-ins"} color="var(--sec-fitness)">
        {latest && (
          <span>
            <span className="font-mono-n font-bold text-foreground">{latest.kg}</span> kg ·{" "}
            {fmtDateAuto(latest.date)}
          </span>
        )}
      </PanelHeader>

      <div className="card p-4 md:p-5">
        {/* Weighed in from the summary only: one place to add a weight. */}
        {summary && (
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
          <AddButton type="submit" aria-label="Add weight" isDisabled={pending} />
        </form>
        )}

        {summary ? (
          <>
            <WeightChart weights={data} plan={plan} simple />
            <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: LABEL }}>
              <span className="inline-block h-[2px] w-3" style={{ background: ACCENT }} aria-hidden />
              Weight
              {plan && (
                <>
                  <span className="ml-3 inline-block w-3 border-t-2 border-dotted" style={{ borderColor: "var(--muted)" }} aria-hidden />
                  Planned
                </>
              )}
            </div>
          </>
        ) : (
        <>
        <div className="mb-1 text-xs" style={{ color: LABEL }}>
          Last {DAYS} days
        </div>
        <WeightChart weights={data} plan={plan} />
        <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: LABEL }}>
          <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: "var(--chart-2)" }} aria-hidden />
          Weekly median
          {plan && (
            <>
              <span className="ml-3 inline-block w-3 border-t-2 border-dotted" style={{ borderColor: "var(--muted)" }} aria-hidden />
              Plan
            </>
          )}
        </div>

        <WeeklyMedians weights={data} />
        </>
        )}
      </div>
      {summary && (
        <Link href="/fitness?view=weight" className="drill-row card mt-3">
          <span>Weight, medians and plan</span>
          <ChevronRight aria-hidden />
        </Link>
      )}
    </div>
  );
}

/**
 * The median weigh-in of each of the last weeks, newest first, with the change
 * from the week before. Weeks run Monday to Sunday; the current one is a
 * median so far.
 */
function WeeklyMedians({ weights }: { weights: WeightEntry[] }) {
  const all = weeklyMedians(weights);
  if (all.length === 0) return null;
  const thisWeek = mondayOf(dateKey());
  const rows = all.slice(-8).reverse();
  return (
    <div className="mt-4">
      <div className="mb-1 text-[13px] font-semibold">Weekly median</div>
      <table className="rd-table">
        <thead>
          <tr>
            <th>Week of</th>
            <th className="text-right">Weigh-ins</th>
            <th className="text-right">Median</th>
            <th className="text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const prev = all[all.indexOf(m) - 1];
            const d = prev ? Math.round((m.median - prev.median) * 10) / 10 : null;
            return (
              <tr key={m.week}>
                <td>
                  {fmtDate(m.week)}
                  {m.week === thisWeek && <span className="ml-1 text-xs text-[var(--muted)]">· so far</span>}
                </td>
                <td className="text-right font-mono-n">{m.n}</td>
                <td className="text-right font-mono-n font-semibold">{m.median.toFixed(1)} kg</td>
                <td
                  className="text-right font-mono-n"
                  style={{ color: d == null || d === 0 ? "var(--muted)" : d < 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {d == null ? "–" : d === 0 ? "±0" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
