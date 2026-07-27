"use client";

import { Button, Card } from "@heroui/react";
import { ActionButton, usePending } from "./ActionButton";
import { Check, Plus, X } from "lucide-react";
import { Tracker, FREQ_LABEL, FREQ_ORDER, dateKey, isRecurringDone, streak } from "@/lib/tracker";

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}

function Circle({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full border"
        style={{ borderColor: color, background: hexToRgba(color, 0.12) }}
      >
        <span className="font-mono-n text-[13px] font-medium" style={{ color }}>
          {value}
        </span>
      </div>
      <span className="text-center text-[10px] leading-tight text-foreground/60">{label}</span>
    </div>
  );
}

function RecurringCheckbox({ tracker, id, done }: { tracker: Tracker; id: string; done: boolean }) {
  const { pending, run } = usePending();
  return (
    <button
      aria-label={done ? "Mark not done" : "Mark done"}
      disabled={pending}
      onClick={() => void run(() => tracker.toggleRecurring(id))}
      className={
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors " +
        (done ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25 bg-transparent") +
        (pending ? " is-pending is-pending-box" : "")
      }
    >
      {done && <Check className="h-4 w-4" strokeWidth={3} />}
    </button>
  );
}

export default function RecurringList({ tracker, onAdd }: { tracker: Tracker; onAdd: () => void }) {
  const s = tracker.state!;
  const today = dateKey();

  const doneCount = s.recurring.filter((r) => isRecurringDone(r, today)).length;
  const notDone = s.recurring.length - doneCount;
  const total = s.recurring.length;
  const strk = streak(s.completions);

  const recurring = [...s.recurring].sort(
    (a, b) => FREQ_ORDER[a.freq] - FREQ_ORDER[b.freq] || a.title.localeCompare(b.title)
  );

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-lg font-bold tracking-tight">Recurring</h2>
        <Button variant="primary" onPress={onAdd}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <Card>
        <Card.Content className="px-3 py-3 sm:px-4">
          <div className="mb-4 grid grid-cols-4 gap-1">
            <Circle value={doneCount} label="done today" color="#17C964" />
            <Circle value={notDone} label="not done" color="#EAB308" />
            <Circle value={total} label="total" color="#8A94A3" />
            <Circle value={strk} label="day streak" color="#7828C8" />
          </div>

          {recurring.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">None yet — add one with the button above.</p>
          ) : (
            <ul
              className={
                "list-none p-0 " +
                (recurring.length > 5 ? "max-h-[290px] overflow-y-auto pr-1 recurring-scroll" : "")
              }
            >
              {recurring.map((r) => {
                const c = tracker.cat(r.catId);
                const done = isRecurringDone(r, today);
                return (
                  <li key={r.id} className="flex items-center gap-2 border-b border-foreground/10 px-1 py-3 last:border-b-0">
                    <span className={"flex-1 text-[15px] " + (done ? "text-foreground/45 line-through" : "")}>{r.title}</span>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                    <span className="text-[11px] text-foreground/60">{FREQ_LABEL[r.freq]}</span>
                    <ActionButton size="sm" variant="ghost" isIconOnly aria-label={`Delete ${r.title}`} onAction={() => tracker.deleteRecurring(r.id)}>
                      <X className="h-4 w-4" />
                    </ActionButton>
                    <RecurringCheckbox tracker={tracker} id={r.id} done={done} />
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
