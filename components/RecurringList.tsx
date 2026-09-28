"use client";

import { Card, PanelHeader } from "./ui";
import { usePending } from "./ActionButton";
import { Check, Plus } from "./icons";
import { Tracker, dateKey, isRecurringDone } from "@/lib/tracker";

function RecurringCheckbox({ tracker, id, done, label }: { tracker: Tracker; id: string; done: boolean; label: string }) {
  const { pending, run } = usePending();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={pending}
      onClick={() => void run(() => tracker.toggleRecurring(id))}
      className={"check" + (done ? " check--on" : "")}
    >
      <span className="check__ring">
        {done && <Check className="h-4 w-4" aria-hidden />}
      </span>
    </button>
  );
}

export default function RecurringList({ tracker, onAdd }: { tracker: Tracker; onAdd: () => void }) {
  const s = tracker.state!;
  const today = dateKey();

  const groupName = (id?: string) => s.recurringGroups.find((g) => g.id === id)?.name ?? "";
  // Done for this period sinks to the bottom; within each half, alphabetical.
  const recurring = [...s.recurring].sort((a, b) => {
    const aDone = isRecurringDone(a, today);
    const bDone = isRecurringDone(b, today);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });

  return (
    <div>
      <PanelHeader title="Recurring" color="var(--sec-recurring)">
        <button type="button" className="text-action" onClick={onAdd}>
          <Plus className="h-5 w-5" aria-hidden /> New
        </button>
      </PanelHeader>

      <Card>
        <Card.Content className="px-3 py-3 md:px-4">

          {recurring.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-[var(--muted)]">No recurring tasks yet. Add one with New.</p>
          ) : (
            <ul
              className={
                "list-none p-0 " +
                (recurring.length > 5 ? "max-h-[17rem] overflow-y-auto pr-1 recurring-scroll" : "")
              }
            >
              {recurring.map((r) => {
                const c = tracker.cat(r.catId);
                const done = isRecurringDone(r, today);
                return (
                  <li key={r.id} className="task-row">
                    <RecurringCheckbox tracker={tracker} id={r.id} done={done} label={r.title} />
                    <span className={"task-row__title " + (done ? "is-done" : "")}>
                      {r.title}
                      {r.groupId && <span className="task-row__group">{groupName(r.groupId)}</span>}
                    </span>
                    <span className="task-row__cat">
                      <span className="cat-dot" style={{ background: c.color }} aria-hidden />
                      <span className="truncate">{c.name}</span>
                    </span>
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
