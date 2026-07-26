"use client";

import { SlidersHorizontal } from "lucide-react";
import { Tracker, dateKey, isRecurringDone, streak } from "@/lib/tracker";

function CornerIcon() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10">
      <SlidersHorizontal className="h-4 w-4" />
    </div>
  );
}

export default function HeroCards({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;

  const active = s.goals.filter((g) => !g.done);
  const todo = active.filter((g) => (g.current ?? 0) <= 0).length;
  const inProgress = active.filter((g) => (g.current ?? 0) > 0).length;
  const doneGoals = s.goals.filter((g) => g.done).length;

  const today = dateKey();
  const doneToday = s.recurring.filter((r) => isRecurringDone(r, today)).length;
  const notDone = s.recurring.length - doneToday;
  const total = s.recurring.length;
  const strk = streak(s.completions);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Goals — yellow block */}
      <div className="relative overflow-hidden rounded-[24px] p-5" style={{ background: "#e2f04a", color: "#1a1a0e" }}>
        <div className="flex items-start justify-between">
          <span className="font-display text-lg font-bold">Goals</span>
          <CornerIcon />
        </div>
        <div className="mt-6 flex items-end justify-between">
          <div className="space-y-3">
            <div>
              <div className="font-mono-n text-2xl font-bold leading-none">{todo}</div>
              <div className="mt-1 text-xs font-semibold opacity-70">To do</div>
            </div>
            <div>
              <div className="font-mono-n text-2xl font-bold leading-none">{inProgress}</div>
              <div className="mt-1 text-xs font-semibold opacity-70">In progress</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono-n text-6xl font-extrabold leading-none">{doneGoals}</div>
            <div className="mt-1 text-xs font-semibold opacity-70">Completed</div>
          </div>
        </div>
      </div>

      {/* Recurring — orange block */}
      <div className="relative overflow-hidden rounded-[24px] p-5" style={{ background: "#f5843a", color: "#1a1206" }}>
        <div className="flex items-start justify-between">
          <span className="font-display text-lg font-bold">Recurring</span>
          <CornerIcon />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="rounded-full bg-black/15 px-4 py-1.5 font-mono-n text-2xl font-bold">{strk}</div>
          <span className="text-sm font-semibold opacity-80">day streak</span>
        </div>
        <div className="mt-4 space-y-2 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#0f6b41" }} /> Done today
            <span className="ml-auto font-bold">{doneToday}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-black/45" /> Not done
            <span className="ml-auto font-bold">{notDone}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-black/25" /> Total
            <span className="ml-auto font-bold">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
