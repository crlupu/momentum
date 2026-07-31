"use client";

import { Card } from "./ui";
import { RotateCcw } from "lucide-react";
import { Button } from "./ui";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { memo, useLayoutEffect, useRef, useState } from "react";
import { Tracker, SetRecord } from "@/lib/tracker";
import { readableText } from "@/lib/color";

/** "60×10" — compact, because a session's breakdown lists many of them. */
function formatSet(set: SetRecord): string {
  if (set.weight != null && set.reps != null) return `${set.weight}×${set.reps}`;
  if (set.weight != null) return `${set.weight}kg`;
  return set.reps != null ? `×${set.reps}` : "–";
}

type Entry = {
  key: string;
  kind: "To-do" | "Goal" | "Recurring" | "Workout";
  title: string;
  /** Second line, e.g. the set-by-set breakdown of a workout. */
  detail?: string;
  date: string;
  color: string;
  todoId?: string;
  /** What the confirmation dialog calls this entry. */
  what: string;
  /** Removes the entry outright — it is not a soft delete. */
  onDelete: () => Promise<unknown>;
};

const KIND_COLOR: Record<Entry["kind"], string> = {
  "To-do": "#33b1ff",
  Goal: "#0f62fe",
  Recurring: "#491d8b",
  Workout: "#8a3ffc",
};

function RestoreTodo({ tracker, id }: { tracker: Tracker; id: string }) {
  const { pending, run } = usePending();
  return (
    <Button
      size="sm"
      variant="outline"
      isIconOnly
      aria-label="Move back to the to-do list"
      isDisabled={pending}
      className={pending ? "is-pending" : ""}
      onPress={() => void run(() => tracker.toggleTodo(id))}
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  );
}

/** How many entries are visible before the list starts scrolling. */
const ROWS_BEFORE_SCROLL = 10;

/**
 * Caps a list at the height of its first n rows. Measured rather than assumed:
 * entries wrap onto a second line at narrow widths, so a fixed row height would
 * show the wrong number of them. The list also starts hidden inside a collapsed
 * section on phones, where everything measures zero — hence the visibility
 * guard and the observer that re-measures once it is shown.
 */
function useRowCap(count: number) {
  const ref = useRef<HTMLUListElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const ul = ref.current;
    if (!ul) return;

    const measure = () => {
      // Hidden elements report zero, which would cap the list shut.
      if (ul.offsetParent === null) return;
      const rows = Array.from(ul.children) as HTMLElement[];
      if (rows.length <= ROWS_BEFORE_SCROLL) {
        setMaxHeight(undefined);
        return;
      }
      const last = rows[ROWS_BEFORE_SCROLL - 1];
      const height = last.offsetTop + last.offsetHeight - rows[0].offsetTop;
      if (height > 0) setMaxHeight(height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(ul);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [count]);

  return { ref, maxHeight };
}

/* Memoised: its only prop is the tracker, which is now a stable object, so
   this re-renders when the data changes rather than whenever the page does. */
const CompletionLog = memo(function CompletionLog({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;

  const entries: Entry[] = [];

  for (const t of s.todos) {
    if (t.done && t.doneDate)
      entries.push({
        key: `todo-${t.id}`,
        kind: "To-do",
        title: t.title,
        date: t.doneDate,
        color: KIND_COLOR["To-do"],
        todoId: t.id,
        what: `the to-do "${t.title}"`,
        onDelete: () => tracker.deleteTodo(t.id),
      });
  }

  for (const g of s.goals) {
    if (g.done && g.doneDate)
      entries.push({
        key: `goal-${g.id}`,
        kind: "Goal",
        title: g.title,
        date: g.doneDate,
        color: KIND_COLOR.Goal,
        what: `the goal "${g.title}"`,
        onDelete: () => tracker.deleteGoal(g.id),
      });
  }

  s.completions.forEach((c, i) => {
    const task = c.taskId ? s.recurring.find((r) => r.id === c.taskId) : undefined;
    const group = c.groupId ? s.recurringGroups.find((g) => g.id === c.groupId) : undefined;
    const label = task?.title ?? group?.name ?? tracker.cat(c.catId).name;
    const title = group ? `${label}${task ? "" : " (group)"}` : label;
    entries.push({
      key: `comp-${c.date}-${i}`,
      kind: "Recurring",
      title,
      date: c.date,
      color: KIND_COLOR.Recurring,
      what: `the "${title}" completion on ${c.date}`,
      onDelete: () => tracker.removeCompletion(c),
    });
  });

  // Finished workouts only reach the log once they've been marked as done.
  s.workoutSessions.forEach((w) => {
    const parts = [
      w.sets ? `${w.sets} ${w.sets === 1 ? "set" : "sets"}` : null,
      `${w.total.toLocaleString()} kg`,
      w.minutes ? `${w.minutes} min` : null,
    ].filter(Boolean);
    const summary = parts.join(" · ");
    // Sessions logged before per-set detail existed simply have none.
    const breakdown = (w.exercises ?? [])
      .map((e) => `${e.name} ${e.sets.map(formatSet).join(", ")}`)
      .join(" · ");
    entries.push({
      key: `workout-${w.id}`,
      kind: "Workout",
      title: `${w.name} — ${summary}`,
      detail: breakdown || undefined,
      date: w.date,
      color: KIND_COLOR.Workout,
      what: `the ${w.name} session on ${w.date}`,
      onDelete: () => tracker.removeWorkoutSession(w.id),
    });
  });

  entries.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  const { ref: listRef, maxHeight } = useRowCap(entries.length);

  const fmt = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div>
      <Card>
        <Card.Content className="p-4 md:p-5">
          {entries.length === 0 ? (
            <p className="py-1 text-[15px] text-foreground/60">
              Nothing finished yet. Completed to-dos, goals and recurring tasks show up here.
            </p>
          ) : (
            <ul
              ref={listRef}
              className="recurring-scroll list-none divide-y divide-foreground/10 overflow-y-auto p-0 pr-1"
              style={{ maxHeight }}
            >
              {entries.map((e) => (
                <li key={e.key} className="flex items-center gap-2.5 py-2.5">
                  <span
                    className="shrink-0 px-2 py-[3px] text-[10px] font-semibold leading-none"
                    style={{ background: e.color, color: readableText(e.color) }}
                  >
                    {e.kind}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[15px]">
                    {e.title}
                    {e.detail && (
                      <span className="mt-0.5 block text-xs text-foreground/50">{e.detail}</span>
                    )}
                  </span>
                  <span className="font-mono-n shrink-0 text-xs text-foreground/50">
                    {fmt(e.date)}
                  </span>
                  {e.todoId && <RestoreTodo tracker={tracker} id={e.todoId} />}
                  <DeleteButton what={e.what} iconOnly onDelete={e.onDelete} />
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>
    </div>
  );
});

export default CompletionLog;
