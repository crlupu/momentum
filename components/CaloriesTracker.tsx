"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "@heroui/react";
import { Plus } from "lucide-react";
import { usePending } from "./ActionButton";
import { Tracker, dateKey } from "@/lib/tracker";

const CARD = "#f5883f"; // orange block
const INK = "#1a1206"; // dark ink on the block

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return dateKey(d);
}

export default function CaloriesTracker({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [kcal, setKcal] = useState("");

  const totals: Record<string, number> = {};
  for (const e of s.calories) totals[e.date] = (totals[e.date] ?? 0) + e.kcal;

  const today = dateKey();
  const todayTotal = totals[today] ?? 0;

  const weekStart = mondayOfThisWeek();
  const weekDays = Object.entries(totals).filter(([d]) => d >= weekStart && d <= today);
  const weekSum = weekDays.reduce((a, [, v]) => a + v, 0);
  const weekAvg = weekDays.length ? Math.round(weekSum / weekDays.length) : 0;

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const counts = days.map((d) => totals[dateKey(d)] ?? 0);
  const max = Math.max(1, ...counts);

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kcal);
    if (!Number.isFinite(v) || v <= 0 || pending) return;
    const ok = await run(() => tracker.addCalories(v));
    if (ok) setKcal("");
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-lg font-bold tracking-tight">Calories</h2>
        <span className="font-mono-n text-sm text-foreground/60">{todayTotal} kcal today</span>
      </div>

      <div className="rounded-[22px] p-4 sm:p-5" style={{ background: CARD, color: INK }}>
        <form onSubmit={submit} className="mb-3 flex gap-2">
          <Input
            type="number"
            aria-label="Calories to add"
            placeholder="add kcal…"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            isIconOnly
            aria-label="Add"
            isDisabled={pending}
            className={pending ? "is-pending" : ""}
            style={{ background: INK, color: CARD }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-mono-n text-xl font-bold">{weekAvg}</span>
          <span className="text-xs" style={{ color: "rgba(0,0,0,0.6)" }}>avg kcal/day · this week</span>
        </div>

        {s.calories.length === 0 ? (
          <p className="px-1 py-2 text-[15px]" style={{ color: "rgba(0,0,0,0.6)" }}>
            Add entries to see daily totals.
          </p>
        ) : (
          <div className="flex h-[120px] items-end gap-1 pt-1">
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="font-mono-n text-[9px] font-bold">{counts[i] || ""}</span>
                <div
                  className="w-full max-w-[22px] rounded-t"
                  style={{
                    height: Math.max(2, (counts[i] / max) * 84),
                    background: counts[i] ? INK : "rgba(0,0,0,0.18)",
                  }}
                />
                <span className="text-[9px]" style={{ color: "rgba(0,0,0,0.55)" }}>{d.getDate()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
