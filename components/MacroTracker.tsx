"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { Plus } from "lucide-react";
import { usePending } from "./ActionButton";
import { Tracker, dateKey, macroTotalsByDate } from "@/lib/tracker";

const LABEL = "var(--muted)";
const TRACK = "var(--default)";

/** Protein reads teal→blue, fibre green→teal, so the two series stay apart. */
const PROTEIN = "var(--sec-nutrition)";
const FIBER = "var(--signal)";
const PROTEIN_SOLID = "#33b1ff";
const FIBER_SOLID = "#a7f0ba";

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

/**
 * Today's total against its target. Laid out in fixed rows — name, figure,
 * detail, bar — so nothing wraps in a narrow column and both meters keep
 * their bars on the same line.
 */
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
  const pct = target ? Math.round((value / target) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span
        className="font-mono-n text-2xl font-bold leading-none"
        style={{ color: solid }}
      >
        {target ? `${pct}%` : value}
      </span>
      <span className="mt-1 truncate text-xs tabular-nums" style={{ color: LABEL }}>
        {target ? `${value} / ${target} g` : `${value} g logged`}
      </span>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden"
        style={{ background: TRACK }}
      >
        {target ? (
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, pct)}%`,
              backgroundImage: fill,
              transition: "width .3s ease",
            }}
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

  // With both targets set the chart switches to percentage of target, which is
  // the only way the two series are comparable: 30 g of fibre is a full day,
  // 30 g of protein is barely a fifth of one.
  const asPercent = !!(s.proteinTarget && s.fiberTarget);
  const someTarget = !!(s.proteinTarget || s.fiberTarget);
  const pctSeries = series.map((v) => ({
    protein: s.proteinTarget ? (v.protein / s.proteinTarget) * 100 : 0,
    fiber: s.fiberTarget ? (v.fiber / s.fiberTarget) * 100 : 0,
  }));
  const plotted = asPercent ? pctSeries : series;
  // Keep 100% on the scale so a full day always reaches the reference line,
  // and let overshoot extend above it.
  const max = asPercent
    ? Math.max(100, ...pctSeries.map((v) => Math.max(v.protein, v.fiber)))
    : Math.max(1, ...series.map((v) => Math.max(v.protein, v.fiber)));

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const p = protein.trim() === "" ? null : Number(protein);
    const f = fiber.trim() === "" ? null : Number(fiber);
    if (p == null && f == null) return;
    const typed = { protein, fiber };
    setProtein("");
    setFiber("");
    const ok = await run(() => tracker.addMacros(p, f));
    if (!ok) {
      setProtein(typed.protein);
      setFiber(typed.fiber);
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

      <div className="card p-4 md:p-5">
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
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="mb-1 flex items-stretch gap-5">
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

        {asPercent ? (
          s.macros.length > 0 && (
            <p className="mt-3 text-[11px]" style={{ color: LABEL }}>
              % of daily target
            </p>
          )
        ) : (
          <p className="mt-3 text-[11px]" style={{ color: LABEL }}>
            {someTarget
              ? "Showing grams. Set both targets in Configuration to compare them as % of target."
              : "Showing grams. Set daily targets in Configuration to see % of target."}
          </p>
        )}

        {s.macros.length === 0 ? (
          <p className="px-1 py-2 text-[15px]" style={{ color: LABEL }}>
            Log protein or fibre to see both plotted here.
          </p>
        ) : (
          <div className="relative flex h-[120px] items-end gap-1 pt-3">
            {/* 100% reference line, drawn at the height a full day reaches */}
            {asPercent && (
              <div
                className="pointer-events-none absolute inset-x-0 flex items-center gap-2"
                style={{ bottom: 17 + (100 / max) * 84 }}
                aria-hidden
              >
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                <span className="text-[9px]" style={{ color: LABEL }}>
                  100%
                </span>
              </div>
            )}
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                {/* the two series share a day column, side by side */}
                <div className="flex h-[84px] w-full items-end justify-center gap-[2px]">
                  <div
                    className="w-full max-w-[9px]"
                    title={
                      asPercent
                        ? `${Math.round(pctSeries[i].protein)}% of protein target (${series[i].protein} g)`
                        : `${series[i].protein} g protein`
                    }
                    style={{
                      height: Math.max(2, Math.min(1, plotted[i].protein / max) * 84),
                      // one shorthand only: setting `background` alongside
                      // `backgroundImage` clears the gradient
                      background: series[i].protein ? PROTEIN : TRACK,
                    }}
                  />
                  <div
                    className="w-full max-w-[9px]"
                    title={
                      asPercent
                        ? `${Math.round(pctSeries[i].fiber)}% of fibre target (${series[i].fiber} g)`
                        : `${series[i].fiber} g fibre`
                    }
                    style={{
                      height: Math.max(2, Math.min(1, plotted[i].fiber / max) * 84),
                      background: series[i].fiber ? FIBER : TRACK,
                    }}
                  />
                </div>
                <span
                  className="text-[9px] leading-none tabular-nums"
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
