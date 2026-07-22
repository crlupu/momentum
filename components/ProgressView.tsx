"use client";

import { Card } from "@heroui/react";
import { Tracker, BoardCard, dateKey } from "@/lib/tracker";

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

// completions per date for a specific category
function catCompletionsByDate(board: BoardCard[], catId: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of board)
    if (c.status === "done" && c.doneDate && c.catId === catId)
      map[c.doneDate] = (map[c.doneDate] ?? 0) + 1;
  return map;
}

function allCompletionsByDate(board: BoardCard[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of board)
    if (c.status === "done" && c.doneDate) map[c.doneDate] = (map[c.doneDate] ?? 0) + 1;
  return map;
}

// Cells for the current calendar month, laid out as week columns (Mon-first
// rows). Leading/trailing padding days are null.
function buildMonthCells(): (string | null)[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Mon = 0
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
    if (n === 0) return "rgba(127,127,127,0.10)";
    if (n === 1) return hexToRgba(color, 0.35);
    if (n === 2) return hexToRgba(color, 0.55);
    if (n <= 4) return hexToRgba(color, 0.8);
    return hexToRgba(color, 1);
  };
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid w-max grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 12px)" }}>
        {cells.map((k, i) => {
          if (k === null) return <div key={`pad-${i}`} className="h-3 w-3" />;
          const n = map[k] ?? 0;
          return (
            <div
              key={k}
              title={`${k} — ${n} done`}
              className="h-3 w-3 rounded-[2px]"
              style={{ background: shade(n) }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-foreground/[0.04] px-3 py-2.5">
      <div className="font-mono-n text-2xl font-semibold" style={{ color: "#F5A524" }}>
        {value}
      </div>
      <div className="text-xs text-foreground/60">{label}</div>
    </div>
  );
}

export default function ProgressView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const allMap = allCompletionsByDate(s.board);
  const cells = buildMonthCells();

  // daily bars, last 14 days
  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const counts = days.map((d) => allMap[dateKey(d)] ?? 0);
  const max = Math.max(1, ...counts);

  // month totals
  const mPrefix = dateKey().slice(0, 7);
  const monthEntries = Object.entries(allMap).filter(([k]) => k.startsWith(mPrefix));
  const mTotal = monthEntries.reduce((a, [, n]) => a + n, 0);
  const best = monthEntries.reduce<[string, number] | null>(
    (b, e) => (!b || e[1] > b[1] ? (e as [string, number]) : b),
    null
  );
  const avg = monthEntries.length ? (mTotal / monthEntries.length).toFixed(1) : "0";

  // per-category maps + totals for THIS MONTH (only categories with completions)
  const perCat = s.categories
    .map((c) => {
      const full = catCompletionsByDate(s.board, c.id);
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
            Daily — last 14 days
          </h2>
          <div className="flex h-[150px] items-end gap-1.5 pt-2">
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="font-mono-n text-[11px] font-semibold" style={{ color: "#F5A524" }}>
                  {counts[i] || ""}
                </span>
                <div
                  className="w-full max-w-[34px] rounded-t-md"
                  style={{
                    height: Math.max(3, (counts[i] / max) * 110),
                    background: counts[i] ? "#F5A524" : "rgba(127,127,127,0.15)",
                  }}
                />
                <span className="text-[10px] text-foreground/50 whitespace-nowrap">
                  {d.getDate()}/{d.getMonth() + 1}
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
              Complete some tasks to see per-category activity.
            </p>
          ) : (
            <div className="space-y-5">
              {perCat.map(({ c, map, total }) => (
                <div key={c.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
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

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <Stat value={mTotal} label="tasks completed" />
            <Stat value={best ? `${best[1]} (${best[0].slice(8)})` : "–"} label="best day" />
            <Stat value={avg} label="avg / active day" />
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
