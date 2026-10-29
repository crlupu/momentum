"use client";

import { PanelHeader } from "./ui";
import { Tracker, dateKey, macroTotalsByDate } from "@/lib/tracker";

const LABEL = "var(--muted)";
const TRACK = "var(--default)";

/** Protein reads teal→blue, fibre green→teal, so the two series stay apart. */
const PROTEIN = "var(--chart-1)";
const FIBER = "var(--chart-2)";
// The same colour for a series everywhere it appears — legend, figure, meter
// and bars — so the legend actually keys the chart. Both are mid-tones that
// read on either theme's surface.
const PROTEIN_SOLID = PROTEIN;
const FIBER_SOLID = FIBER;

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function Legend({ color, name }: { color: string; name: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
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
 * Protein and fibre. `today` is the add fields alone (today's grams are
 * the Nutrition card's figures); `trends` the last two weeks as bars.
 */
/** Protein and fibre over the last two weeks; they are logged with the meal, in Nutrition's one card. */
export default function MacroTracker({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;

  const totals = macroTotalsByDate(s.macros);

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const series = days.map((d) => totals[dateKey(d)] ?? { protein: 0, fiber: 0 });

  // With both targets set the chart switches to percentage of target, which is
  // the only way the two series are comparable: 30 g of fibre is a full day,
  // 30 g of protein is barely a fifth of one.
  const asPercent = !!(s.proteinTarget && s.fiberTarget);
  const someTarget = !!(s.proteinTarget || s.fiberTarget);
  const pctSeries = series.map((v) => ({
    protein: s.proteinTarget ? (v.protein / s.proteinTarget) * 100 : 0,
    fiber: s.fiberTarget ? (v.fiber / s.fiberTarget) * 100 : 0 }));
  const plotted = asPercent ? pctSeries : series;
  // Keep 100% on the scale so a full day always reaches its reference line,
  // and let overshoot extend above it.
  const max = asPercent
    ? Math.max(100, ...pctSeries.map((v) => Math.max(v.protein, v.fiber)))
    : Math.max(1, ...series.map((v) => Math.max(v.protein, v.fiber)));

  return (
    <section aria-label="Protein and fibre, last two weeks">
      <PanelHeader title="Protein & fibre · two weeks" color="var(--sec-nutrition)">
        <Legend color={PROTEIN_SOLID} name="Protein" />
        <Legend color={FIBER_SOLID} name="Fibre" />
      </PanelHeader>
      <div className="card p-4 md:p-5">
        {asPercent ? (
          s.macros.length > 0 && (
            <p className="mt-3 text-[11px]" style={{ color: LABEL }}>
              % of daily target
            </p>
          )
        ) : (
          <p className="mt-3 text-[11px]" style={{ color: LABEL }}>
            {someTarget
              ? "Showing grams. Set both targets in Settings to compare them as % of target."
              : "Showing grams. Set daily targets in Settings to see % of target."}
          </p>
        )}

        {s.macros.length === 0 ? (
          <p className="px-1 py-2 text-[15px]" style={{ color: LABEL }}>
            Log protein or fibre to see both plotted here.
          </p>
        ) : (
          // In percent, the day columns stop short of a right-hand strip that
          // holds the line labels, so a day over 100% can't draw over them.
          <div className={"relative flex h-[120px] items-end gap-1 pt-3" + (asPercent ? " pr-10" : "")}>
            {/* Reference lines at 50% and 100%, drawn at the heights those
                days reach: halfway is worth seeing at a glance as well. */}
            {asPercent &&
              [50, 100].map((p) => (
                <div
                  key={p}
                  className="pointer-events-none absolute inset-x-0 flex items-center gap-2"
                  style={{ bottom: 17 + (p / max) * 84 }}
                  aria-hidden
                >
                  <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                  <span className="w-8 shrink-0 text-right text-[11px]" style={{ color: LABEL }}>
                    {p}%
                  </span>
                </div>
              ))}
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
                      background: series[i].protein ? PROTEIN : TRACK }}
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
                      background: series[i].fiber ? FIBER : TRACK }}
                  />
                </div>
                <span
                  className="text-[11px] leading-none tabular-nums"
                  style={{ color: LABEL }}
                >
                  {d.getDate()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
