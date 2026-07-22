"use client";

import { Card } from "@heroui/react";
import { Tracker, completionsByDate, dateKey } from "@/lib/tracker";

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const HEAT = ["rgba(245,165,36,0.10)", "#F9D08A", "#F7B94E", "#F5A524", "#D98A0B"];
const heatColor = (n: number) =>
  n === 0 ? HEAT[0] : n === 1 ? HEAT[1] : n === 2 ? HEAT[2] : n <= 4 ? HEAT[3] : HEAT[4];

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
  const map = completionsByDate(s.tasks);

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const counts = days.map((d) => map[dateKey(d)] ?? 0);
  const max = Math.max(1, ...counts);

  const dow = (new Date().getDay() + 6) % 7;
  const totalCells = 19 * 7 + dow + 1;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = offsetDate(totalCells - 1 - i);
    const k = dateKey(d);
    return { k, n: map[k] ?? 0 };
  });

  const mPrefix = dateKey().slice(0, 7);
  const monthEntries = Object.entries(map).filter(([k]) => k.startsWith(mPrefix));
  const mTotal = monthEntries.reduce((a, [, n]) => a + n, 0);
  const best = monthEntries.reduce<[string, number] | null>(
    (b, e) => (!b || e[1] > b[1] ? (e as [string, number]) : b),
    null
  );
  const avg = monthEntries.length ? (mTotal / monthEntries.length).toFixed(1) : "0";

  const catCounts: Record<string, number> = {};
  for (const t of s.tasks)
    if (t.done && t.doneDate?.startsWith(mPrefix))
      catCounts[t.catId] = (catCounts[t.catId] ?? 0) + 1;
  const catRows = s.categories
    .map((c) => ({ c, n: catCounts[c.id] ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const cmax = Math.max(1, ...catRows.map((r) => r.n));

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
          <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Monthly — completions
          </h2>
          <div className="overflow-x-auto pb-1.5">
            <div
              className="grid w-max grid-flow-col gap-[3px]"
              style={{ gridTemplateRows: "repeat(7, 14px)" }}
            >
              {cells.map(({ k, n }) => (
                <div
                  key={k}
                  title={`${k} — ${n} done`}
                  className="h-3.5 w-3.5 rounded-[3px]"
                  style={{ background: heatColor(n) }}
                />
              ))}
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-foreground/60">
            less
            {HEAT.map((c, i) => (
              <span key={i} className="inline-block h-3.5 w-3.5 rounded-[3px]" style={{ background: c }} />
            ))}
            more
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
          >
            <Stat value={mTotal} label="tasks completed" />
            <Stat value={best ? `${best[1]} (${best[0].slice(8)})` : "–"} label="best day" />
            <Stat value={avg} label="avg / active day" />
          </div>

          <div className="mb-1 mt-4 text-[13px] uppercase tracking-wide text-foreground/60">
            By category
          </div>
          {catRows.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">
              Complete some tasks to see the breakdown.
            </p>
          ) : (
            catRows.map(({ c, n }) => (
              <div key={c.id} className="my-2 flex items-center gap-2.5">
                <span className="w-[110px] shrink-0 truncate text-[13px] text-foreground/70">
                  {c.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-md bg-foreground/[0.08]">
                  <div
                    className="h-full rounded-md"
                    style={{ width: `${(n / cmax) * 100}%`, background: c.color }}
                  />
                </div>
                <span className="font-mono-n w-[30px] text-right text-xs font-semibold">{n}</span>
              </div>
            ))
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
