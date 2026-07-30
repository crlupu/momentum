"use client";

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
            <div key={i} className="text-center text-[10px] font-medium text-foreground/40">
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
                className="-[6px]"
                style={{ width: CELL, height: CELL, background: shade(n) }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div
      className="px-3 py-2.5"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <div className="font-mono-n text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-foreground/60">{label}</div>
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
  return n > 0 ? "var(--sec-charts)" : "var(--default)";
}

export default function Charts({ tracker }: { tracker: Tracker }) {
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
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
          >
            <Stat value={mTotal} label="completions" color="var(--sec-goals)" />
            <Stat
              value={best ? `${best[1]} (${best[0].slice(8)})` : "–"}
              label="best day"
              color="var(--sec-charts)"
            />
            <Stat value={avg} label="avg / active day" color="var(--sec-log)" />
          </div>

          <div className="mt-4 border-t border-foreground/10 pt-3 text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
            Daily — last 14 days
          </div>
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
                <span className="text-[10px] leading-none whitespace-nowrap tabular-nums text-foreground/50">
                  <span className="sm:hidden">{d.getDate()}</span>
                  <span className="hidden sm:inline">
                    {d.getDate()}/{d.getMonth() + 1}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-1 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Completions by category
          </h2>
          <p className="mb-4 text-xs text-foreground/50">This month · each category tracked separately</p>
          {perCat.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">
              Check off some recurring tasks to see activity.
            </p>
          ) : (
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
              {perCat.map(({ c, map, total }) => (
                <div key={c.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5" style={{ background: c.color }} aria-hidden />
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="font-mono-n text-xs text-foreground/50">{total}</span>
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
}
