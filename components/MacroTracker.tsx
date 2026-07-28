"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { Plus } from "lucide-react";
import { usePending } from "./ActionButton";
import { Tracker, dateKey, macroTotalsByDate } from "@/lib/tracker";

const LABEL = "var(--muted)";
const TRACK = "var(--default)";

/** Protein reads teal→blue, fibre green→teal, so the two series stay apart. */
const PROTEIN = "var(--grad-teal-up)";
const FIBER = "var(--grad-success)";
const PROTEIN_SOLID = "#08bdba";
const FIBER_SOLID = "#42be65";

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function Legend({ color, name }: { color: string; name: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 shrink-0"
        style={{ background: color }}
        aria-hidden
      />
      <span className="text-xs" style={{ color: LABEL }}>
        {name}
      </span>
    </span>
  );
}

/** Today's total against its target, shown as a thin meter. */
function TargetMeter({
  label,
  value,
  target,
  fill,
  solid,
}: {
  label: string;
  value: number;
  target?: number;
  fill: string;
  solid: string;
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono-n text-xl font-bold" style={{ color: solid }}>
          {value}
        </span>
        <span className="text-xs" style={{ color: LABEL }}>
          {target ? `/ ${target} g ${label}` : `g ${label}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: TRACK }}>
        {target ? (
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundImage: fill, transition: "width .3s ease" }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function MacroTracker({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [protein, setProtein] = useState("");
  const [fiber, setFiber] = useState("");

  const totals = macroTotalsByDate(s.macros);
  const today = dateKey();
  const todayTotals = totals[today] ?? { protein: 0, fiber: 0 };

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const series = days.map((d) => totals[dateKey(d)] ?? { protein: 0, fiber: 0 });
  // One shared scale, so the two bars stay comparable day to day.
  const max = Math.max(1, ...series.map((v) => Math.max(v.protein, v.fiber)));

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const p = protein.trim() === "" ? null : Number(protein);
    const f = fiber.trim() === "" ? null : Number(fiber);
    if (p == null && f == null) return;
    const ok = await run(() => tracker.addMacros(p, f));
    if (ok) {
      setProtein("");
      setFiber("");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="sec-dot" style={{ background: PROTEIN }} aria-hidden />
          Protein &amp; fibre
        </h2>
        <span className="flex shrink-0 items-center gap-3">
          <Legend color={PROTEIN_SOLID} name="protein" />
          <Legend color={FIBER_SOLID} name="fibre" />
        </span>
      </div>

      <div className="card p-4 sm:p-5">
        <form onSubmit={submit} className="mb-4 flex gap-2">
          <Input
            type="number"
            aria-label="Protein in grams"
            placeholder="protein g…"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            aria-label="Fibre in grams"
            placeholder="fibre g…"
            value={fiber}
            onChange={(e) => setFiber(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            isIconOnly
            aria-label="Add"
            isDisabled={pending}
            className={pending ? "is-pending" : ""}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="mb-1 flex gap-4">
          <TargetMeter
            label="protein"
            value={todayTotals.protein}
            target={s.proteinTarget}
            fill={PROTEIN}
            solid={PROTEIN_SOLID}
          />
          <TargetMeter
            label="fibre"
            value={todayTotals.fiber}
            target={s.fiberTarget}
            fill={FIBER}
            solid={FIBER_SOLID}
          />
        </div>

        {s.macros.length === 0 ? (
          <p className="px-1 py-2 text-[15px]" style={{ color: LABEL }}>
            Log protein or fibre to see both plotted here.
          </p>
        ) : (
          <div className="flex h-[120px] items-end gap-1 pt-3">
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                {/* the two series share a day column, side by side */}
                <div className="flex h-[84px] w-full items-end justify-center gap-[2px]">
                  <div
                    className="w-full max-w-[9px] rounded-t"
                    title={`${series[i].protein} g protein`}
                    style={{
                      height: Math.max(2, (series[i].protein / max) * 84),
                      // one shorthand only: setting `background` alongside
                      // `backgroundImage` clears the gradient
                      background: series[i].protein ? PROTEIN : TRACK,
                    }}
                  />
                  <div
                    className="w-full max-w-[9px] rounded-t"
                    title={`${series[i].fiber} g fibre`}
                    style={{
                      height: Math.max(2, (series[i].fiber / max) * 84),
                      background: series[i].fiber ? FIBER : TRACK,
                    }}
                  />
                </div>
                <span
                  className={"text-[9px] " + (i % 2 ? "hidden sm:inline" : "")}
                  style={{ color: LABEL }}
                >
                  {d.getDate()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
