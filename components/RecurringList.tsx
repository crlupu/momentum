"use client";

import { Button, Card, Chip } from "@heroui/react";
import { Check, Plus, X } from "lucide-react";
import { Tracker, FREQ_LABEL, FREQ_ORDER, dateKey, isRecurringDone, streak } from "@/lib/tracker";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-foreground/[0.04] px-3 py-2.5">
      <div className="font-mono-n text-2xl font-semibold" style={{ color: "#F5A524" }}>{value}</div>
      <div className="text-xs text-foreground/60">{label}</div>
    </div>
  );
}

export default function RecurringList({ tracker, onAdd }: { tracker: Tracker; onAdd: () => void }) {
  const s = tracker.state!;
  const today = dateKey();
  const doneToday = s.completions.filter((c) => c.date === today).length;
  const recurring = [...s.recurring].sort(
    (a, b) => FREQ_ORDER[a.freq] - FREQ_ORDER[b.freq] || a.title.localeCompare(b.title)
  );

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-2xl font-bold tracking-tight">Recurring tasks</h2>
        <Button variant="outline" onPress={onAdd}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <Stat value={doneToday} label="done today" />
            <Stat value={streak(s.completions)} label="day streak" />
            <Stat value={s.recurring.length} label="recurring" />
          </div>

          {recurring.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">None yet — add one with the button above.</p>
          ) : (
            <ul className="list-none p-0">
              {recurring.map((r) => {
                const c = tracker.cat(r.catId);
                const done = isRecurringDone(r, today);
                return (
                  <li key={r.id} className="flex items-center gap-3 border-b border-foreground/10 px-1 py-3 last:border-b-0">
                    <button
                      aria-label={done ? "Mark not done" : "Mark done"}
                      onClick={() => tracker.toggleRecurring(r.id)}
                      className={
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors " +
                        (done ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25 bg-transparent")
                      }
                    >
                      {done && <Check className="h-4 w-4" strokeWidth={3} />}
                    </button>
                    <span className={"flex-1 text-[15px] " + (done ? "text-foreground/45 line-through" : "")}>{r.title}</span>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                    <span className="text-xs text-foreground/60">{FREQ_LABEL[r.freq]}</span>
                    <Button size="sm" variant="ghost" isIconOnly aria-label={`Delete ${r.title}`} onPress={() => tracker.deleteRecurring(r.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
