"use client";

import { FormEvent, useState } from "react";
import { Panel } from "./Panel";
import { Modal } from "./Modal";
import { DialogActions } from "./DialogActions";
import { Button, Input, AddButton, Stat } from "./ui";
import { X } from "./icons";
import { useWidth } from "./useWidth";
import { usePending } from "./ActionButton";
import { fmtDate, fmtDateAuto } from "@/lib/dates";
import { Tracker, dateKey, daysSinceEpoch } from "@/lib/tracker";
import {
  type CheckStatus,
  type WeightCheckpoint,
  type WeightPlan,
  type WeekMedian,
  addDays,
  checkpointStatus,
  evenCheckpoints,
  expectedOn,
  mondayOf,
  planSummary,
  round1,
  validPlan,
  weeklyMedians,
} from "@/lib/weight";

const kg1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");

const STATUS: Record<CheckStatus, { label: string; cls: string }> = {
  ahead: { label: "Ahead", cls: "rd-flag--done" },
  "on-track": { label: "On track", cls: "rd-flag--on-track" },
  behind: { label: "Behind", cls: "rd-flag--behind" },
  pending: { label: "To come", cls: "" },
  missed: { label: "No weigh-in", cls: "rd-flag--at-risk" },
};

/**
 * The weight-loss plan: the target and how far along it is by the weekly
 * median, the plan drawn against the medians, and its checkpoints, each
 * judged by the median of the week it falls in.
 */
export default function WeightPlanCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const plan = validPlan(s.weightPlan);
  const [editing, setEditing] = useState(false);
  const today = dateKey();

  return (
    <Panel title="Weight plan" onEdit={plan ? () => setEditing(true) : undefined}>
      {!plan ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-[var(--muted)]">
            No plan yet. Set a target weight and date, with checkpoints on the way.
          </p>
          <Button variant="primary" onPress={() => setEditing(true)}>
            Set a plan
          </Button>
        </div>
      ) : (
        <PlanBody plan={plan} tracker={tracker} today={today} />
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title="Weight plan">
        {editing && <PlanForm tracker={tracker} plan={plan} onDone={() => setEditing(false)} />}
      </Modal>
    </Panel>
  );
}

function PlanBody({ plan, tracker, today }: { plan: WeightPlan; tracker: Tracker; today: string }) {
  const weights = tracker.state!.weights.filter((w) => w.date >= mondayOf(plan.startDate));
  const medians = weeklyMedians(weights);
  const sum = planSummary(plan, tracker.state!.weights, today);
  const thisWeek = medians.find((m) => m.week === mondayOf(today));
  const pace = (v: number | null) => (v == null ? "–" : `${v < 0 ? "+" : ""}${Math.abs(v).toFixed(2)}`);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[13px] text-[var(--muted)]">Target for {fmtDateAuto(plan.targetDate)}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono-n text-3xl font-bold" style={{ color: "var(--accent)" }}>
            {kg1(plan.targetKg)} kg
          </span>
          <span className="text-[15px] text-[var(--muted)]">from {kg1(plan.startKg)} kg</span>
        </div>
        <div className="book-card__meter mt-3" aria-label={`${Math.round(sum.progress * 100)}% of the way`}>
          <span style={{ width: `${sum.progress * 100}%`, background: "var(--accent)" }} />
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          {Math.round(sum.progress * 100)}% of the way, by the latest weekly median ({kg1(sum.current)} kg)
        </div>
      </div>

      <div className="stat-grid stat-grid--4">
        <Stat value={`${kg1(Math.max(0, sum.lost))} kg`} label="Lost" />
        <Stat value={`${kg1(sum.toGo)} kg`} label="To go" />
        <Stat value={pace(sum.neededPace)} label="kg/week needed" />
        <Stat value={pace(sum.actualPace)} label="kg/week so far" />
      </div>

      <p className="text-[13px] text-[var(--muted)]">
        The plan puts today at <span className="font-mono-n font-semibold text-foreground">{kg1(sum.expectedNow)} kg</span>
        {thisWeek ? (
          <>
            {"; this week's median is "}
            <span className="font-mono-n font-semibold text-foreground">{kg1(thisWeek.median)} kg</span>
            {` (${thisWeek.n} weigh-in${thisWeek.n === 1 ? "" : "s"})`}
          </>
        ) : (
          "; no weigh-in this week yet"
        )}
        . Average pace planned: {plan.startKg > plan.targetKg ? "~" : ""}
        {sum.plannedPace.toFixed(2)} kg/week.
      </p>

      <PlanChart plan={plan} medians={medians} today={today} />

      {plan.checkpoints.length > 0 && (
        <table className="rd-table">
          <thead>
            <tr>
              <th>Checkpoint</th>
              <th className="text-right">Range</th>
              <th className="text-right">Week median</th>
              <th className="text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {plan.checkpoints.map((c) => {
              const st = checkpointStatus(c, medians, today);
              return (
                <tr key={c.date}>
                  <td>{fmtDateAuto(c.date)}</td>
                  <td className="text-right font-mono-n">
                    {kg1(c.lo)}–{kg1(c.hi)} kg
                  </td>
                  <td className="text-right font-mono-n">{st.median != null ? `${kg1(st.median)} kg` : "–"}</td>
                  <td className="text-right">
                    <span className={`rd-flag ${STATUS[st.status].cls}`}>{STATUS[st.status].label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * The plan from start to target: its straight line dashed, each checkpoint's
 * range as a band at its date, and the weekly medians on top, each at the
 * middle of its week.
 */
function PlanChart({ plan, medians, today }: { plan: WeightPlan; medians: WeekMedian[]; today: string }) {
  const [box, measured] = useWidth();
  const W = measured || 320;
  const H = 190;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const d0 = daysSinceEpoch(plan.startDate);
  const d1 = Math.max(d0 + 1, daysSinceEpoch(plan.targetDate));
  const pts = medians
    .map((m) => ({ ...m, day: daysSinceEpoch(addDays(m.week, 3)) }))
    .filter((m) => m.day >= d0 - 3 && m.day <= d1 + 3);

  const all = [
    plan.startKg,
    plan.targetKg,
    ...plan.checkpoints.flatMap((c) => [c.lo, c.hi]),
    ...pts.map((p) => p.median),
  ];
  const span = Math.max(...all) - Math.min(...all) || 2;
  const lo = Math.min(...all) - span * 0.08;
  const hi = Math.max(...all) + span * 0.08;
  const x = (day: number) => pad.l + ((Math.min(d1, Math.max(d0, day)) - d0) / (d1 - d0)) * (W - pad.l - pad.r);
  const y = (kg: number) => H - pad.b - ((kg - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [0, 0.5, 1].map((f) => lo + f * (hi - lo));
  const t = daysSinceEpoch(today);
  const months: { day: number; label: string }[] = [];
  for (let d = plan.startDate; daysSinceEpoch(d) <= d1; d = addDays(d, 1)) {
    if (d.endsWith("-01") || d === plan.startDate) months.push({ day: daysSinceEpoch(d), label: fmtDate(d) });
  }
  // Labels at least 48px apart, so they don't run into each other.
  const labels = months.filter((m, i, a) => i === 0 || x(m.day) - x(a[i - 1].day) >= 48);

  return (
    <div ref={box}>
      <svg width={W} height={H} className="block" role="img" aria-label="Weight plan and weekly medians">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
            <text x={pad.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fill="var(--muted)" fontSize="11">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {plan.checkpoints.map((c) => (
          <rect
            key={c.date}
            x={x(daysSinceEpoch(c.date)) - 5}
            width={10}
            y={y(c.hi)}
            height={Math.max(2, y(c.lo) - y(c.hi))}
            rx={3}
            fill="var(--chart-2)"
            opacity={0.35}
          >
            <title>{`${fmtDateAuto(c.date)}: ${kg1(c.lo)}–${kg1(c.hi)} kg`}</title>
          </rect>
        ))}
        <line
          x1={x(d0)}
          y1={y(plan.startKg)}
          x2={x(d1)}
          y2={y(plan.targetKg)}
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {t >= d0 && t <= d1 && (
          <line x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" strokeWidth="1" />
        )}
        {pts.length > 1 && (
          <polyline
            points={pts.map((p) => `${x(p.day)},${y(p.median)}`).join(" ")}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {pts.map((p) => (
          <circle key={p.week} cx={x(p.day)} cy={y(p.median)} r={4} fill="var(--chart-1)" stroke="var(--pane-bg)" strokeWidth="2">
            <title>{`Week of ${fmtDateAuto(p.week)}: ${kg1(p.median)} kg`}</title>
          </circle>
        ))}
        {labels.map((m, i) => (
          <text
            key={m.day}
            x={x(m.day)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : "middle"}
            fill="var(--muted)"
            fontSize="11"
          >
            {m.label}
          </text>
        ))}
      </svg>
      <div className="rd-legend mt-1 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--chart-1)" }} /> Weekly median
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-3 border-t border-dashed" style={{ borderColor: "var(--muted)" }} /> Plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2 rounded-sm opacity-50" style={{ background: "var(--chart-2)" }} /> Checkpoint range
        </span>
      </div>
    </div>
  );
}

type Row = { date: string; lo: string; hi: string };

function PlanForm({ tracker, plan, onDone }: { tracker: Tracker; plan?: WeightPlan; onDone: () => void }) {
  const s = tracker.state!;
  const latest = s.weights[s.weights.length - 1];
  const [startDate, setStartDate] = useState(plan?.startDate ?? dateKey());
  const [startKg, setStartKg] = useState(plan ? String(plan.startKg) : latest ? String(latest.kg) : "");
  const [targetDate, setTargetDate] = useState(plan?.targetDate ?? "");
  const [targetKg, setTargetKg] = useState(plan ? String(plan.targetKg) : "");
  const [rows, setRows] = useState<Row[]>(
    (plan?.checkpoints ?? []).map((c) => ({ date: c.date, lo: String(c.lo), hi: String(c.hi) }))
  );
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePending();

  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const base = () => {
    const sk = num(startKg);
    const tk = num(targetKg);
    if (!startDate || !targetDate || sk == null || tk == null) return null;
    if (targetDate <= startDate) return null;
    return { startDate, startKg: sk, targetDate, targetKg: tk };
  };

  const fill = () => {
    const b = base();
    if (!b) return setError("Fill in the start and target first, with the target after the start.");
    setError(null);
    setRows(evenCheckpoints(b).map((c) => ({ date: c.date, lo: String(c.lo), hi: String(c.hi) })));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const b = base();
    if (!b) return setError("A start and a target, each with a date and a weight; the target after the start.");
    const checkpoints: WeightCheckpoint[] = [];
    for (const r of rows) {
      if (!r.date && !r.lo && !r.hi) continue;
      const lo = num(r.lo);
      const hi = num(r.hi) ?? lo;
      if (!r.date || lo == null || hi == null) return setError("Each checkpoint needs a date and a weight range.");
      checkpoints.push({ date: r.date, lo: round1(Math.min(lo, hi)), hi: round1(Math.max(lo, hi)) });
    }
    checkpoints.sort((a, c) => a.date.localeCompare(c.date));
    const ok = await run(() => tracker.setWeightPlan({ ...b, checkpoints }));
    if (ok !== false) onDone();
  };

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const b = base();

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[11px] text-[var(--muted)]">
          Start date
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-0.5 w-full" />
        </label>
        <label className="block text-[11px] text-[var(--muted)]">
          Start weight (kg)
          <Input type="number" step="0.1" inputMode="decimal" value={startKg} onChange={(e) => setStartKg(e.target.value)} className="mt-0.5 w-full" />
        </label>
        <label className="block text-[11px] text-[var(--muted)]">
          Target date
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-0.5 w-full" />
        </label>
        <label className="block text-[11px] text-[var(--muted)]">
          Target weight (kg)
          <Input type="number" step="0.1" inputMode="decimal" value={targetKg} onChange={(e) => setTargetKg(e.target.value)} className="mt-0.5 w-full" />
        </label>
      </div>
      {b && (
        <p className="-mt-2 text-xs text-[var(--muted)]">
          {kg1(round1(b.startKg - b.targetKg))} kg over {Math.round((daysSinceEpoch(b.targetDate) - daysSinceEpoch(b.startDate)) / 7)} weeks:
          ~{((b.startKg - b.targetKg) / ((daysSinceEpoch(b.targetDate) - daysSinceEpoch(b.startDate)) / 7)).toFixed(2)} kg/week.
        </p>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold">Checkpoints</span>
          <button type="button" className="text-action" onClick={fill}>
            Fill every 2 weeks
          </button>
        </div>
        {rows.length === 0 && (
          <p className="text-xs text-[var(--muted)]">
            Optional: dates with the range to be in by then. Each is checked against that week&apos;s median.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Input
                type="date"
                aria-label="Checkpoint date"
                value={r.date}
                onChange={(e) => set(i, { date: e.target.value })}
                className="min-w-0 flex-1"
              />
              <Input
                type="text"
                inputMode="decimal"
                aria-label="Lowest weight"
                placeholder="from"
                value={r.lo}
                onChange={(e) => set(i, { lo: e.target.value })}
                className="w-[4.5rem] shrink-0"
              />
              <span className="text-[var(--muted)]">–</span>
              <Input
                type="text"
                inputMode="decimal"
                aria-label="Highest weight"
                placeholder="to"
                value={r.hi}
                onChange={(e) => set(i, { hi: e.target.value })}
                className="w-[4.5rem] shrink-0"
              />
              <Button
                variant="ghost"
                isIconOnly
                className="shrink-0"
                aria-label="Remove checkpoint"
                onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <AddButton
            secondary
            label="Add checkpoint"
            onPress={() => {
              const last = rows[rows.length - 1]?.date || startDate;
              const date = last ? addDays(last, 14) : "";
              const e = b && date ? expectedOn({ ...b, checkpoints: [] }, date) : null;
              setRows((rs) => [
                ...rs,
                { date, lo: e != null ? String(round1(e - 0.75)) : "", hi: e != null ? String(round1(e + 0.75)) : "" },
              ]);
            }}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <DialogActions
        primary={{ label: "Save plan", disabled: pending }}
        del={
          plan && {
            what: "the weight plan",
            onDelete: async () => {
              onDone();
              return tracker.setWeightPlan(null);
            },
          }
        }
      />
    </form>
  );
}
