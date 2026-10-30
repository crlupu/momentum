"use client";

import { fmtDate } from "@/lib/dates";

import { memo, useState } from "react";

import { Card, PanelHeader } from "./ui";
import { CardBars, SummaryCard } from "./SummaryCard";
import { Tracker, Completion, catCompletionsByDate, completionsByDate, dateKey } from "@/lib/tracker";
import { routineCompletions } from "@/lib/routines";

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// Current calendar month laid out as week columns (Mon-first rows); null = pad.
function buildMonthCells(): (string | null)[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(dateKey(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function Heatmap({
  cells,
  map,
}: {
  cells: (string | null)[];
  map: Record<string, number>;
}) {
  // Shades of the text colour, not a category's hue: colour is kept for the
  // next step and the primary action.
  const mix = (pct: number) => `color-mix(in srgb, var(--foreground) ${pct}%, transparent)`;
  const shade = (n: number) => {
    if (n === 0) return "var(--default)";
    if (n === 1) return mix(30);
    if (n === 2) return mix(50);
    if (n <= 4) return mix(75);
    return mix(100);
  };
  const WD = ["M", "T", "W", "T", "F", "S", "S"];
  // Fluid: the month fills the card's width up to a calendar's comfortable
  // size, square days, the date small in each.
  const cols = { gridTemplateColumns: "repeat(7, minmax(0, 1fr))" };
  return (
    <div className="heatmap">
      <div className="mb-1 grid gap-1" style={cols}>
        {WD.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-medium text-[var(--muted)]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid gap-1" style={cols}>
        {cells.map((k, i) => {
          if (k === null) return <div key={`pad-${i}`} className="heatmap__day" />;
          const n = map[k] ?? 0;
          return (
            <div key={k} title={`${k} — ${n} done`} className={"heatmap__day" + (n >= 3 ? " is-full" : "")} style={{ background: shade(n) }}>
              <span className="heatmap__date">{Number(k.slice(8))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One figure and its label. Neutral: the three figures are peers, and
 *  giving each its own colour would suggest they meant different things. */



/* Memoised: its only prop is the tracker, which is now a stable object, so
   this re-renders when the data changes rather than whenever the page does. */
const Charts = memo(function Charts({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  // The old hand-kept ticks, then the routines done since.
  const completions: Completion[] = [...s.completions, ...routineCompletions(s)];
  const allMap = completionsByDate(completions);
  const cells = buildMonthCells();

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const counts = days.map((d) => allMap[dateKey(d)] ?? 0);

  const mPrefix = dateKey().slice(0, 7);
  const monthEntries = Object.entries(allMap).filter(([k]) => k.startsWith(mPrefix));
  const mTotal = monthEntries.reduce((a, [, n]) => a + n, 0);
  const best = monthEntries.reduce<[string, number] | null>(
    (b, e) => (!b || e[1] > b[1] ? (e as [string, number]) : b),
    null
  );
  const avg = monthEntries.length ? (mTotal / monthEntries.length).toFixed(1) : "0";

  const monthAll: Record<string, number> = {};
  for (const [k, n] of monthEntries) monthAll[k] = n;
  const [catPick, setCatPick] = useState<string | null>(null);

  const perCat = s.categories
    .map((c) => {
      const full = catCompletionsByDate(completions, c.id);
      const map: Record<string, number> = {};
      for (const [k, n] of Object.entries(full)) if (k.startsWith(mPrefix)) map[k] = n;
      const total = Object.values(map).reduce((a, n) => a + n, 0);
      return { c, map, total };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {/* The month in Today's anatomy: one figure, the last 14 days as bars, three figures. */}
      <SummaryCard
        aria-label="This month"
        label={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        aside="Last 14 days"
        figure={mTotal}
        detail={mTotal === 1 ? "completion" : "completions"}
        figures={[
          { value: best ? best[1] : "–", label: best ? `best, ${fmtDate(best[0])}` : "best day" },
          { value: avg, label: "per active day" },
          { value: counts[counts.length - 1], label: "today" },
        ]}
      >
        <CardBars values={counts} labels={days.map((d) => String(d.getDate()))} highlight={counts.length - 1} height={72} />
      </SummaryCard>

      <section>
        <PanelHeader title="By category · this month" />
        <Card>
          <Card.Content className="p-4 md:p-5">
            {perCat.length === 0 ? (
              <p className="px-1 py-2 text-[15px] text-[var(--muted)]">
                Check off some recurring tasks to see activity.
              </p>
            ) : (
              (() => {
                // One calendar, as Fitness shows one month: all categories
                // together, or one picked from the chips above it.
                const picked = perCat.find((x) => x.c.id === catPick);
                const map = picked ? picked.map : monthAll;
                return (
                  <>
                    <div className="cat-chips" role="radiogroup" aria-label="Category">
                      <button type="button" role="radio" aria-checked={!picked} className="cat-chip" onClick={() => setCatPick(null)}>
                        All <span className="font-mono-n text-[var(--muted)]">{mTotal}</span>
                      </button>
                      {perCat.map(({ c, total }) => (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={picked?.c.id === c.id}
                          className="cat-chip"
                          onClick={() => setCatPick(c.id)}
                        >
                          {c.name} <span className="font-mono-n text-[var(--muted)]">{total}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Heatmap cells={cells} map={map} />
                    </div>
                  </>
                );
              })()
            )}
          </Card.Content>
        </Card>
      </section>
    </div>
  );
});

export default Charts;
