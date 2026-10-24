"use client";

import { FormEvent, useState } from "react";
import { Panel } from "./Panel";
import { Modal } from "./Modal";
import { DialogActions } from "./DialogActions";
import { Button, Input } from "./ui";
import { DeleteGlyph } from "./DeleteGlyph";
import { InsertRow } from "./InsertRow";
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
  checkDay,
  latestCheck,
  makePlan,
  mondayOf,
  planSummary,
  validPlan,
  weeklyMedians,
  weightOnOrBefore,
  type DayStatus,
} from "@/lib/weight";

const kg1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");

const DAY: Record<DayStatus, { label: string; cls: string }> = {
  ahead: { label: "Ahead", cls: "rd-flag--done" },
  "on-track": { label: "On track", cls: "rd-flag--on-track" },
  close: { label: "Close", cls: "rd-flag--at-risk" },
  behind: { label: "Behind", cls: "rd-flag--behind" },
};

const signed = (v: number) => (v === 0 ? "±0" : `${v > 0 ? "+" : "−"}${kg1(Math.abs(v))}`);

const STATUS: Record<CheckStatus, { label: string; cls: string }> = {
  reached: { label: "Reached", cls: "rd-flag--on-track" },
  behind: { label: "Behind", cls: "rd-flag--behind" },
  pending: { label: "To come", cls: "" },
  missed: { label: "No weigh-in", cls: "rd-flag--at-risk" },
};

/**
 * The weight-loss plan: checkpoints, each a weight by a date, the last the
 * target. How far along it is comes from the weekly median, and each
 * checkpoint is judged by the median of the week it falls in.
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
          <p className="text-[15px] text-[var(--muted)]">No plan yet. Set the weights to reach, each by a date.</p>
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
  const pace = (v: number | null) => (v == null ? "–" : `${v < 0 ? "+" : ""}${Math.abs(v).toFixed(2)}`);

  return (
    <div className="flex flex-col gap-4">
      <ul className="group-list">
        <li className="group-row">
          <span className="flex-1">Target</span>
          <span className="group-row__value">
            {kg1(plan.targetKg)} kg by {fmtDateAuto(plan.targetDate)}
          </span>
        </li>
        {sum.next && sum.next.date !== plan.targetDate && (
          <li className="group-row">
            <span className="flex-1">Next checkpoint</span>
            <span className="group-row__value">
              {kg1(sum.next.kg)} kg by {fmtDateAuto(sum.next.date)}
            </span>
          </li>
        )}
        <li className="group-row">
          <span className="flex-1">Pace needed</span>
          <span className="group-row__value">{pace(sum.neededPace)} kg / week</span>
        </li>
        <li className="group-row">
          <span className="flex-1">Pace so far</span>
          <span className="group-row__value">{pace(sum.actualPace)} kg / week</span>
        </li>
        <li className="group-row weight-plan__progress">
          <span className="flex w-full justify-between gap-2 text-[13px] text-[var(--muted)]">
            <span>{kg1(plan.startKg)} kg</span>
            <span>{Math.round(sum.progress * 100)}% of the way</span>
            <span>{kg1(plan.targetKg)} kg</span>
          </span>
          <span className="book-card__meter" aria-hidden>
            <span style={{ width: `${sum.progress * 100}%`, background: "var(--area-training)" }} />
          </span>
        </li>
      </ul>

      <DayStanding plan={plan} tracker={tracker} medians={medians} today={today} />

      <PlanChart plan={plan} medians={medians} today={today} />

      <section>
        <h3 className="group-head">Checkpoints</h3>
        <ul className="group-list">
          {plan.checkpoints.map((c) => {
            const st = checkpointStatus(c, medians, today);
            return (
              <li key={c.date} className="group-row">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{fmtDateAuto(c.date)}</span>
                  <span className="text-[13px] text-[var(--muted)]">
                    {st.median != null ? `week median ${kg1(st.median)} kg` : "no median yet"}
                  </span>
                </span>
                <span className="font-mono-n">{kg1(c.kg)} kg</span>
                <span className={`rd-flag ${STATUS[st.status].cls}`}>{STATUS[st.status].label}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * Today against the plan: the latest weigh-in beside where the plan puts its
 * day, and this week's median beside where the plan puts the middle of the
 * week, so a single day's swing can be read for what it is.
 */
function DayStanding({
  plan,
  tracker,
  medians,
  today,
}: {
  plan: WeightPlan;
  tracker: Tracker;
  medians: WeekMedian[];
  today: string;
}) {
  const day = latestCheck(plan, tracker.state!.weights);
  const wk = medians.find((m) => m.week === mondayOf(today));
  const week = wk ? checkDay(plan, addDays(wk.week, 3) < today ? addDays(wk.week, 3) : today, wk.median) : undefined;
  if (today < plan.startDate) {
    return <p className="text-[13px] text-[var(--muted)]">The plan starts {fmtDateAuto(plan.startDate)}.</p>;
  }
  return (
    <div className="day-standing">
      <div className="day-standing__row">
        <span className="day-standing__text">
          <span className="day-standing__label">
            {day && day.date !== today ? `Last weigh-in, ${fmtDateAuto(day.date)}` : "Today"}
          </span>
          {day ? (
            <span className="day-standing__figs font-mono-n">
              <strong>{kg1(day.kg)} kg</strong> · plan {kg1(day.expected)} · {signed(day.diff)}
            </span>
          ) : (
            <span className="day-standing__figs text-[var(--muted)]">
              No weigh-in yet · plan {kg1(checkDay(plan, today, 1).expected)} kg
            </span>
          )}
        </span>
        {day && <span className={`rd-flag ${DAY[day.status].cls}`}>{DAY[day.status].label}</span>}
      </div>
      {week && (
        <div className="day-standing__row">
          <span className="day-standing__text">
            <span className="day-standing__label">This week&apos;s median</span>
            <span className="day-standing__figs font-mono-n">
              <strong>{kg1(week.kg)} kg</strong> · plan {kg1(week.expected)} · {signed(week.diff)}
            </span>
          </span>
          <span className={`rd-flag ${DAY[week.status].cls}`}>{DAY[week.status].label}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The plan from start to target: dashed lines from the start through each
 * checkpoint, the checkpoints as rings, and the weekly medians on top, each
 * at the middle of its week.
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
  const line = [{ date: plan.startDate, kg: plan.startKg }, ...plan.checkpoints];

  const all = [...line.map((c) => c.kg), ...pts.map((p) => p.median)];
  const span = Math.max(...all) - Math.min(...all) || 2;
  const lo = Math.min(...all) - span * 0.1;
  const hi = Math.max(...all) + span * 0.1;
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
        <polyline
          points={line.map((c) => `${x(daysSinceEpoch(c.date))},${y(c.kg)}`).join(" ")}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {t >= d0 && t <= d1 && (
          <line x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" strokeWidth="1" />
        )}
        {plan.checkpoints.map((c) => (
          <circle
            key={c.date}
            cx={x(daysSinceEpoch(c.date))}
            cy={y(c.kg)}
            r={5}
            fill="var(--pane-bg)"
            stroke="var(--chart-2)"
            strokeWidth="2"
          >
            <title>{`${fmtDateAuto(c.date)}: ${kg1(c.kg)} kg`}</title>
          </circle>
        ))}
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
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "var(--chart-2)" }} /> Checkpoint
        </span>
      </div>
    </div>
  );
}

type Row = { date: string; kg: string };

/**
 * Just the checkpoints: a date and a weight each. The plan starts from the
 * latest weigh-in when it's first set, and keeps that start after.
 */
function PlanForm({ tracker, plan, onDone }: { tracker: Tracker; plan?: WeightPlan; onDone: () => void }) {
  const s = tracker.state!;
  const latest = s.weights[s.weights.length - 1];
  const [startDate, setStartDate] = useState(plan?.startDate ?? dateKey());
  const [startKgText, setStartKgText] = useState(
    plan ? String(plan.startKg) : latest ? String(latest.kg) : ""
  );
  const [rows, setRows] = useState<Row[]>(
    plan ? plan.checkpoints.map((c) => ({ date: c.date, kg: String(c.kg) })) : [{ date: addDays(startDate, 14), kg: "" }]
  );
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePending();

  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const startKg = num(startKgText);
  // A new start date takes the weight logged that day, or the last before it.
  const moveStart = (date: string) => {
    setStartDate(date);
    const w = date ? weightOnOrBefore(s.weights, date) : undefined;
    if (w) setStartKgText(String(w.kg));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!startDate || startKg == null) return setError("The plan needs a start date and weight.");
    const checkpoints: WeightCheckpoint[] = [];
    for (const r of rows) {
      if (!r.date && !r.kg) continue;
      const kg = num(r.kg);
      if (!r.date || kg == null) return setError("Each checkpoint needs a date and a weight.");
      if (r.date <= startDate) return setError(`Checkpoints come after the start, ${fmtDateAuto(startDate)}.`);
      checkpoints.push({ date: r.date, kg });
    }
    const next = makePlan(startDate, startKg, checkpoints);
    if (!next) return setError("Add at least one checkpoint.");
    const ok = await run(() => tracker.setWeightPlan(next));
    if (ok !== false) onDone();
  };

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <div className="mb-1 text-[13px] font-semibold">Start</div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Start date"
            value={startDate}
            onChange={(e) => moveStart(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Input
            type="text"
            inputMode="decimal"
            aria-label="Start weight in kg"
            placeholder="kg"
            value={startKgText}
            onChange={(e) => setStartKgText(e.target.value)}
            className="w-24 shrink-0"
          />
          {/* Lines up with the checkpoints' remove buttons. */}
          <span className="w-10 shrink-0" aria-hidden />
        </div>
      </div>
      <div className="-mb-1 text-[13px] font-semibold">
        Checkpoints <span className="font-normal text-[var(--muted)]">· the last is the target</span>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
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
              aria-label="Checkpoint weight in kg"
              placeholder="kg"
              value={r.kg}
              onChange={(e) => set(i, { kg: e.target.value })}
              className="w-24 shrink-0"
            />
            <button
              type="button"
              className="minus-delete"
              aria-label="Remove checkpoint"
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            >
              <span className="icon-disc icon-disc--danger"><DeleteGlyph /></span>
            </button>
          </li>
        ))}
      </ul>
      <div>
        <InsertRow
          label="Add checkpoint"
          onPress={() => setRows((rs) => [...rs, { date: addDays(rs[rs.length - 1]?.date || startDate, 14), kg: "" }])}
        />
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
