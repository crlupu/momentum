"use client";

import { fmtDate } from "@/lib/dates";

import { memo } from "react";

import { Card } from "./ui";
import { Tracker, Completion, catCompletionsByDate, completionsByDate, dateKey } from "@/lib/tracker";

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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
  color,
}: {
  cells: (string | null)[];
  map: Record<string, number>;
  color: string;
}) {
  const shade = (n: number) => {
    if (n === 0) return "var(--default)";
    if (n === 1) return hexToRgba(color, 0.35);
    if (n === 2) return hexToRgba(color, 0.55);
    if (n <= 4) return hexToRgba(color, 0.8);
    return hexToRgba(color, 1);
  };
  const CELL = 32;
  const WD = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="overflow-x-auto pb-1">
      <div className="w-max">
        <div className="mb-1 grid gap-1" style={{ gridTemplateColumns: `repeat(7, ${CELL}px)` }}>
          {WD.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-medium text-[var(--muted)]">
              {d}
            </div>
          ))}
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(7, ${CELL}px)` }}>
          {cells.map((k, i) => {
            if (k === null) return <div key={`pad-${i}`} style={{ width: CELL, height: CELL }} />;
            const n = map[k] ?? 0;
            return (
              <div
                key={k}
                title={`${k} — ${n} done`}
                className="rounded-[6px]"
                style={{ width: CELL, height: CELL, background: shade(n) }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** One figure and its label. Neutral: the three figures are peers, and
 *  giving each its own colour would suggest they meant different things. */
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-[var(--r-control)] bg-[var(--default)] px-3 py-2.5">
      <div className="font-mono-n text-2xl font-bold">
        {value}
      </div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

/** Busier days climb the palette ramp instead of every bar being one colour. */
function rampStep(n: number, max: number): string {
  if (n <= 0) return "var(--default)";
  const step = Math.min(5, Math.max(1, Math.ceil((n / max) * 5)));
  return `var(--scale-${step})`;
}

/** Bars are filled with the fill-icon gradient, scaled by how busy the day was. */
function barFill(n: number): string {
  return n > 0 ? "var(--chart-1)" : "var(--default)";
}

/* Memoised: its only prop is the tracker, which is now a stable object, so
   this re-renders when the data changes rather than whenever the page does. */
const Charts = memo(function Charts({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const completions: Completion[] = s.completions;
  const allMap = completionsByDate(completions);
  const cells = buildMonthCells();

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const counts = days.map((d) => allMap[dateKey(d)] ?? 0);
  const max = Math.max(1, ...counts);

  const mPrefix = dateKey().slice(0, 7);
  const monthEntries = Object.entries(allMap).filter(([k]) => k.startsWith(mPrefix));
  const mTotal = monthEntries.reduce((a, [, n]) => a + n, 0);
  const best = monthEntries.reduce<[string, number] | null>(
    (b, e) => (!b || e[1] > b[1] ? (e as [string, number]) : b),
    null
  );
  const avg = monthEntries.length ? (mTotal / monthEntries.length).toFixed(1) : "0";

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
      <Card>
        <Card.Content className="p-4 md:p-5">
          <h2 className="mb-3 text-lg font-semibold">
            {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
          >
            <Stat value={mTotal} label="Completions" />
            <Stat
              value={best ? best[1] : "–"}
              label={best ? `Best day, ${fmtDate(best[0])}` : "Best day"}
            />
            <Stat value={avg} label="Average per active day" />
          </div>

          <h3 className="group-label mt-4 border-t border-[var(--separator)] pt-3">
            Each day, last 14 days
          </h3>
          <div className="flex h-[150px] items-end gap-1.5 pt-2">
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  className="font-mono-n text-[11px] font-semibold"
                  style={{ color: counts[i] ? "var(--foreground)" : "transparent" }}
                >
                  {counts[i] || ""}
                </span>
                <div
                  className="w-full max-w-[34px]"
                  style={{
                    height: Math.max(3, (counts[i] / max) * 110),
                    background: barFill(counts[i]),
                  }}
                />
                <span className="text-[11px] leading-none whitespace-nowrap tabular-nums text-[var(--muted)]">
                  <span className="md:hidden">{d.getDate()}</span>
                  <span className="hidden md:inline">
                    {d.getDate()}/{d.getMonth() + 1}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4 md:p-5">
          <h2 className="mb-1 text-lg font-semibold">
            Completions by category
          </h2>
          <p className="mb-4 text-[13px] text-[var(--muted)]">This month, one calendar per category</p>
          {perCat.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-[var(--muted)]">
              Check off some recurring tasks to see activity.
            </p>
          ) : (
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
              {perCat.map(({ c, map, total }) => (
                <div key={c.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="font-mono-n text-xs text-[var(--muted)]">{total}</span>
                  </div>
                  <Heatmap cells={cells} map={map} color={c.color} />
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

    </div>
  );
});

export default Charts;
