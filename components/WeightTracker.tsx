"use client";

import { FormEvent, useState } from "react";
import { useWidth } from "./useWidth";
import { Input, PanelHeader, AddButton } from "./ui";
import { fmtDate, fmtDateAuto } from "@/lib/dates";
import { usePending } from "./ActionButton";
import { Tracker, WeightEntry, dateKey } from "@/lib/tracker";
import { type WeightPlan, addDays, expectedOn, latestCheck, mondayOf, planSummary, validPlan, weeklyMedians } from "@/lib/weight";
import { SummaryCard, type CardFigure } from "./SummaryCard";

/** Section accent; follows the theme so it stays visible on dark. */
const ACCENT = "var(--chart-1)";
const GRID = "var(--chart-grid)";
const LABEL = "var(--muted)";

/** The windows the chart can show; "all" runs from the first weigh-in. */
const RANGES = [
  { id: "30", label: "30D", days: 30 },
  { id: "90", label: "90D", days: 90 },
  { id: "all", label: "All", days: 0 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

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
  days: DAYS,
}: {
  weights: WeightEntry[];
  plan?: WeightPlan;
  /** How many days back the chart reaches, ending today. */
  days: number;
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
  const medians = weeklyMedians(weights).filter((m) => addDays(m.week, 6) >= series[0].date);
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
            r={hover === p.i ? 5 : DAYS > 60 ? 2.5 : 4}
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

const STANDING = { ahead: "Ahead of plan", "on-track": "On plan", close: "Close to plan", behind: "Behind plan" } as const;

/** The plan's standing as the card's badge. */
function Standing({ weights, plan }: { weights: WeightEntry[]; plan?: WeightPlan }) {
  const check = plan && weights.length ? latestCheck(plan, weights) : undefined;
  return check ? <span className={"weight-now__badge is-" + check.status}>{STANDING[check.status]}</span> : null;
}

/** "−0.2 kg this week", down in green, up in the warning colour. */
function WeekChange({ weights }: { weights: WeightEntry[] }) {
  const latest = weights[weights.length - 1];
  const weekAgo = [...weights].reverse().find((w) => w.date <= addDays(latest.date, -7));
  const d = weekAgo ? Math.round((latest.kg - weekAgo.kg) * 10) / 10 : null;
  if (d == null) return <>kg</>;
  return (
    <>
      kg ·{" "}
      <span className={"weight-change " + (d < 0 ? "is-down" : d > 0 ? "is-up" : "")}>
        {d === 0 ? "±0" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`} this week
      </span>
    </>
  );
}

/**
 * Where the plan says today's weight should be, and how far the latest
 * weigh-in is from it: below (or at) in green, above in the warning colour.
 */
function PlanToday({ weights, plan }: { weights: WeightEntry[]; plan?: WeightPlan }) {
  if (!plan || !weights.length) return null;
  const want = Math.round(expectedOn(plan, dateKey()) * 10) / 10;
  const d = Math.round((weights[weights.length - 1].kg - want) * 10) / 10;
  return (
    <>
      Plan for today: <span className="weight-plan-today">{want.toFixed(1)} kg</span>
      {" · "}
      <span className={"weight-change " + (d <= 0 ? "is-down" : "is-up")}>
        {d === 0 ? "right on it" : `${Math.abs(d).toFixed(1)} ${d < 0 ? "below" : "above"}`}
      </span>
    </>
  );
}

/** What's moving: the week's median, weigh-ins this week, the plan's pace. */
function weightFigures(weights: WeightEntry[], plan?: WeightPlan): CardFigure[] {
  const median = weeklyMedians(weights).slice(-1)[0];
  const week = mondayOf(dateKey());
  const out: CardFigure[] = [
    { value: median ? median.median.toFixed(1) : "–", label: "median" },
    { value: weights.filter((w) => w.date >= week).length, label: "weigh-ins this week" },
  ];
  if (plan) {
    const sum = planSummary(plan, weights);
    out.push({ value: sum.neededPace != null ? sum.neededPace.toFixed(2) : "–", label: "kg / week needed" });
  } else out.push({ value: fmtDateAuto(weights[weights.length - 1].date), label: "last weigh-in" });
  return out;
}

/**
 * The last fortnight's weigh-ins as a small line, no axes: the shape of the
 * trend at a glance beside the number.
 */
function Sparkline({ weights, wide }: { weights: WeightEntry[]; wide?: boolean }) {
  const pts = weights.slice(-14);
  if (pts.length < 2) return null;
  const W = wide ? 350 : 112;
  const H = wide ? 44 : 36;
  const kgs = pts.map((w) => w.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const span = hi - lo || 1;
  const line = pts.map((w, i) => `${(i / (pts.length - 1)) * W},${H - 3 - ((w.kg - lo) / span) * (H - 6)}`).join(" ");
  return (
    <svg width={wide ? "100%" : W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={wide ? "weight-spark" : "flex-none"} aria-hidden>
      <polyline points={line} fill="none" stroke={wide ? "currentColor" : "var(--chart-1)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Weight. The summary (on Health) is the latest number beside a sparkline,
 * with the field to weigh in; the full card (on the Weight page) adds how far
 * it has come and the chart, over 30 days, 90 or all of it.
 */
export default function WeightTracker({ tracker, summary }: { tracker: Tracker; summary?: boolean }) {
  const s = tracker.state!;
  const data = s.weights;
  const latest = data.length ? data[data.length - 1] : null;
  const plan = validPlan(s.weightPlan);
  const [kg, setKg] = useState("");
  const [range, setRange] = useState<RangeId>("30");

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kg);
    if (!Number.isFinite(v) || v <= 0 || pending) return;
    const ok = await run(() => tracker.addWeight(v));
    if (ok) setKg("");
  };

  // Weighed in from the summary only: one place to add a weight.
  const weighIn = (
    <form onSubmit={submit} className="weight-form">
      <Input
        type="number"
        step="0.1"
        aria-label="Weight in kg"
        placeholder="Weight, kg"
        value={kg}
        onChange={(e) => setKg(e.target.value)}
        className="flex-1"
      />
      <AddButton type="submit" aria-label="Add weight" isDisabled={pending} />
    </form>
  );

  if (summary) {
    return (
      <div>
        {!latest && <PanelHeader title="Weight" color="var(--sec-fitness)" />}
        {latest ? (
          <SummaryCard
            label="Weight"
            aside={<Standing weights={data} plan={plan} />}
            figure={latest.kg}
            detail={<WeekChange weights={data} />}
            line={plan ? <PlanToday weights={data} plan={plan} /> : undefined}
            band={{
              label: "Plan",
              content: plan ? `${plan.targetKg} kg by ${fmtDateAuto(plan.targetDate)}` : "No plan yet",
              action: plan ? "Open" : "Set one",
              href: "/fitness?view=weight",
            }}
            figures={weightFigures(data, plan)}
            actions={weighIn}
          >
            <Sparkline weights={data} wide />
          </SummaryCard>
        ) : (
          <div className="card p-4 md:p-5">
            <p className="empty-state__title">Log your first weigh-in</p>
            <p className="empty-state__text">The trend and the plan start from it.</p>
            <div className="mt-3">{weighIn}</div>
          </div>
        )}
      </div>
    );
  }

  const first = data[0];
  const days =
    range === "all"
      ? first
        ? Math.max(14, Math.round((Date.now() - new Date(first.date + "T12:00:00").getTime()) / 86400000) + 1)
        : 30
      : RANGES.find((r) => r.id === range)!.days;
  const since = latest ? [...data].find((w) => w.date >= dateKey(new Date(Date.now() - (days - 1) * 86400000))) : undefined;
  const moved = latest && since && since.date !== latest.date ? Math.round((latest.kg - since.kg) * 10) / 10 : null;
  return (
    <SummaryCard
      label="Weight"
      aside={<Standing weights={data} plan={plan} />}
      figure={latest ? latest.kg : "–"}
      line={latest && plan ? <PlanToday weights={data} plan={plan} /> : undefined}
      detail={
        latest ? (
          moved != null && since ? (
            <>
              kg · {moved === 0 ? "±0" : `${moved > 0 ? "+" : "−"}${Math.abs(moved).toFixed(1)}`} since {fmtDateAuto(since.date)}
            </>
          ) : (
            "kg"
          )
        ) : (
          "No weigh-ins yet. Log the first from Health."
        )
      }
      figures={latest ? weightFigures(data, plan) : undefined}
    >
      <div>
      <div className="segmented my-4" role="tablist" aria-label="Chart range">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={"segmented__item" + (range === r.id ? " is-on" : "")}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <WeightChart weights={data} plan={plan} days={days} />
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
      </div>
    </SummaryCard>
  );
}

/**
 * The median weigh-in of each of the last weeks, newest first, with the change
 * from the week before. Weeks run Monday to Sunday; the current one is a
 * median so far.
 */
export function WeeklyMedians({ weights }: { weights: WeightEntry[] }) {
  const all = weeklyMedians(weights);
  if (all.length === 0) return null;
  const thisWeek = mondayOf(dateKey());
  const rows = all.slice(-8).reverse();
  return (
    <section>
      <h3 className="group-head">Weekly medians</h3>
      <ul className="group-list weight-medians">
        {rows.map((m) => {
          const prev = all[all.indexOf(m) - 1];
          const d = prev ? Math.round((m.median - prev.median) * 10) / 10 : null;
          return (
            <li key={m.week} className="group-row">
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{m.week === thisWeek ? "This week" : fmtDate(m.week)}</span>
                <span className="text-[13px] text-[var(--muted)]">
                  {m.n} weigh-in{m.n === 1 ? "" : "s"}
                  {m.week === thisWeek ? " so far" : ""}
                </span>
              </span>
              <span className="font-mono-n font-semibold">{m.median.toFixed(1)}</span>
              <span
                className="weight-medians__change font-mono-n"
                style={{ color: d == null || d === 0 ? "var(--muted)" : d < 0 ? "var(--success)" : "var(--warning)" }}
              >
                {d == null ? "–" : d === 0 ? "±0" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
