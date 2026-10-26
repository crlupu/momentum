"use client";

import { FormEvent, useState } from "react";
import { Panel } from "./Panel";
import { Modal } from "./Modal";
import { DialogActions } from "./DialogActions";
import { Button, Input } from "./ui";
import { DeleteGlyph } from "./DeleteGlyph";
import { InsertRow } from "./InsertRow";
import { CardMeter, SummaryCard } from "./SummaryCard";
import { usePending } from "./ActionButton";
import { fmtDateAuto } from "@/lib/dates";
import { Tracker, dateKey } from "@/lib/tracker";
import {
  type CheckStatus,
  type WeightCheckpoint,
  type WeightPlan,
  addDays,
  checkpointStatus,
  expectedOn,
  makePlan,
  mondayOf,
  planSummary,
  validPlan,
  weeklyMedians,
  weightOnOrBefore,
} from "@/lib/weight";

const kg1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");

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

  if (plan)
    return (
      <>
        <PlanBody plan={plan} tracker={tracker} today={today} onEdit={() => setEditing(true)} />
        <Modal open={editing} onClose={() => setEditing(false)} title="Weight plan">
          {editing && <PlanForm tracker={tracker} plan={plan} onDone={() => setEditing(false)} />}
        </Modal>
      </>
    );
  return (
    <Panel title="Plan">
      {!plan ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-[var(--muted)]">No plan yet. Set the weights to reach, each by a date.</p>
          <Button variant="primary" onPress={() => setEditing(true)}>
            Set a plan
          </Button>
        </div>
      ) : (
        null
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title="Weight plan">
        {editing && <PlanForm tracker={tracker} plan={plan} onDone={() => setEditing(false)} />}
      </Modal>
    </Panel>
  );
}

function PlanBody({ plan, tracker, today, onEdit }: { plan: WeightPlan; tracker: Tracker; today: string; onEdit: () => void }) {
  const weights = tracker.state!.weights.filter((w) => w.date >= mondayOf(plan.startDate));
  const medians = weeklyMedians(weights);
  const sum = planSummary(plan, tracker.state!.weights, today);
  const pace = (v: number | null) => (v == null ? "–" : `${v < 0 ? "+" : ""}${Math.abs(v).toFixed(2)}`);
  const slow = sum.neededPace != null && sum.actualPace != null && sum.actualPace < sum.neededPace;

  return (
    <div className="flex flex-col gap-4">
      <SummaryCard
        label="Plan"
        aside={`${Math.round(sum.progress * 100)}% of the way`}
        figure={kg1(plan.targetKg)}
        side={{ unit: "kg", hint: `by ${fmtDateAuto(plan.targetDate)} · from ${kg1(plan.startKg)}` }}
        band={{
          label: "Next",
          content: sum.next && sum.next.date !== plan.targetDate ? `${kg1(sum.next.kg)} kg by ${fmtDateAuto(sum.next.date)}` : "The target",
          action: "Edit plan",
          onPress: onEdit,
        }}
        figures={[
          { value: pace(sum.neededPace), label: "kg / week needed" },
          { value: pace(sum.actualPace), label: "kg / week so far", warn: slow },
          { value: expectedOn(plan, today).toFixed(1), label: "kg expected today" },
        ]}
      >
        <CardMeter value={sum.progress} accent />
      </SummaryCard>

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
                {st.status !== "pending" && <span className={`rd-flag ${STATUS[st.status].cls}`}>{STATUS[st.status].label}</span>}
              </li>
            );
          })}
        </ul>
      </section>
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
