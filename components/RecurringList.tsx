"use client";

import { Button, Card } from "./ui";
import { usePending } from "./ActionButton";
import { Check, Plus } from "lucide-react";
import { Tracker, dateKey, isRecurringDone } from "@/lib/tracker";

function RecurringCheckbox({ tracker, id, done }: { tracker: Tracker; id: string; done: boolean }) {
  const { pending, run } = usePending();
  return (
    <button
      aria-label={done ? "Mark not done" : "Mark done"}
      disabled={pending}
      onClick={() => void run(() => tracker.toggleRecurring(id))}
      className="-m-2 flex shrink-0 items-center justify-center p-2"
    >
      <span
        className={
          "flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 transition-colors " +
          (done ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30 bg-transparent") +
          (pending ? " is-pending" : "")
        }
      >
        {done && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
      </span>
    </button>
  );
}

export default function RecurringList({ tracker, onAdd }: { tracker: Tracker; onAdd: () => void }) {
  const s = tracker.state!;
  const today = dateKey();

  const groupName = (id?: string) => s.recurringGroups.find((g) => g.id === id)?.name ?? "";
  const recurring = [...s.recurring].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="sec-dot" style={{ background: "var(--sec-recurring)" }} aria-hidden />
          Recurring
        </h2>
        <Button variant="primary" onPress={onAdd}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <Card>
        <Card.Content className="px-3 py-3 sm:px-4">

          {recurring.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">None yet — add one with the button above.</p>
          ) : (
            <ul
              className={
                "list-none p-0 " +
                (recurring.length > 5 ? "max-h-[228px] overflow-y-auto pr-1 recurring-scroll" : "")
              }
            >
              {recurring.map((r) => {
                const c = tracker.cat(r.catId);
                const done = isRecurringDone(r, today);
                return (
                  <li key={r.id} className="flex items-center gap-1.5 border-b border-foreground/10 px-1 py-3 last:border-b-0">
                    <span className={"flex-1 min-w-0 text-[15px] " + (done ? "text-foreground/45 line-through" : "")}>
                      <span className="truncate">{r.title}</span>
                      {r.groupId && (
                        <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/60">
                          {groupName(r.groupId)}
                        </span>
                      )}
                    </span>
                    <span className="flex w-16 shrink-0 items-center gap-1.5 text-[11px] text-foreground/60">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: c.color }}
                        aria-hidden
                      />
                      <span className="truncate">{c.name}</span>
                    </span>
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
