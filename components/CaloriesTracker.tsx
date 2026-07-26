"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Input } from "@heroui/react";
import { Tracker, dateKey } from "@/lib/tracker";

const BAR = "#F97316";

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return dateKey(d);
}

export default function CaloriesTracker({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [kcal, setKcal] = useState("");

  // daily totals
  const totals: Record<string, number> = {};
  for (const e of s.calories) totals[e.date] = (totals[e.date] ?? 0) + e.kcal;

  const today = dateKey();
  const todayTotal = totals[today] ?? 0;

  // current-week average per logged day
  const weekStart = mondayOfThisWeek();
  const weekDays = Object.entries(totals).filter(([d]) => d >= weekStart && d <= today);
  const weekSum = weekDays.reduce((a, [, v]) => a + v, 0);
  const weekAvg = weekDays.length ? Math.round(weekSum / weekDays.length) : 0;

  // last 14 days of totals as bars
  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const counts = days.map((d) => totals[dateKey(d)] ?? 0);
  const max = Math.max(1, ...counts);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kcal);
    if (!Number.isFinite(v) || v <= 0) return;
    tracker.addCalories(v);
    setKcal("");
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-lg font-bold tracking-tight">Calories</h2>
        <span className="font-mono-n text-sm text-foreground/60">{todayTotal} kcal today</span>
      </div>

      <Card>
        <Card.Content className="px-3 py-3 sm:px-4">
          <form onSubmit={submit} className="mb-3 flex gap-2">
            <Input
              type="number"
              aria-label="Calories to add"
              placeholder="add kcal…"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="primary">Add</Button>
          </form>

          <div className="mb-1 flex items-baseline gap-2">
            <span className="font-mono-n text-xl font-semibold" style={{ color: BAR }}>{weekAvg}</span>
            <span className="text-xs text-foreground/60">avg kcal/day · this week</span>
          </div>

          {s.calories.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">Add entries to see daily totals.</p>
          ) : (
            <div className="flex h-[120px] items-end gap-1 pt-1">
              {days.map((d, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="font-mono-n text-[9px] font-semibold" style={{ color: BAR }}>
                    {counts[i] || ""}
                  </span>
                  <div
                    className="w-full max-w-[22px] rounded-t"
                    style={{
                      height: Math.max(2, (counts[i] / max) * 84),
                      background: counts[i] ? BAR : "rgba(127,127,127,0.15)",
                    }}
                  />
                  <span className="text-[9px] text-foreground/50 whitespace-nowrap">{d.getDate()}</span>
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
