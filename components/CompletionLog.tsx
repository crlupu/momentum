"use client";

import { Card } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { Button } from "@heroui/react";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { Tracker } from "@/lib/tracker";
import { readableText } from "@/lib/color";

type Entry = {
  key: string;
  kind: "To-do" | "Goal" | "Recurring";
  title: string;
  date: string;
  color: string;
  todoId?: string;
};

const KIND_COLOR: Record<Entry["kind"], string> = {
  "To-do": "#357de8",
  Goal: "#22a06b",
  Recurring: "#af59e1",
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

export default function CompletionLog({ tracker }: { tracker: Tracker }) {
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
      });
  }

  s.completions.forEach((c, i) => {
    const task = c.taskId ? s.recurring.find((r) => r.id === c.taskId) : undefined;
    const group = c.groupId ? s.recurringGroups.find((g) => g.id === c.groupId) : undefined;
    const label = task?.title ?? group?.name ?? tracker.cat(c.catId).name;
    entries.push({
      key: `comp-${c.date}-${i}`,
      kind: "Recurring",
      title: group ? `${label}${task ? "" : " (group)"}` : label,
      date: c.date,
      color: KIND_COLOR.Recurring,
    });
  });

  entries.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

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
      <h2 className="font-display mb-4 text-xl font-bold tracking-tight">Log</h2>
      <Card>
        <Card.Content className="p-4 sm:p-5">
          {entries.length === 0 ? (
            <p className="py-1 text-[15px] text-foreground/60">
              Nothing finished yet. Completed to-dos, goals and recurring tasks show up here.
            </p>
          ) : (
            <ul className="recurring-scroll max-h-[420px] list-none divide-y divide-foreground/10 overflow-y-auto p-0 pr-1">
              {entries.map((e) => (
                <li key={e.key} className="flex items-center gap-2.5 py-2.5">
                  <span
                    className="shrink-0 rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none"
                    style={{ background: e.color, color: readableText(e.color) }}
                  >
                    {e.kind}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[15px]">{e.title}</span>
                  <span className="font-mono-n shrink-0 text-xs text-foreground/50">
                    {fmt(e.date)}
                  </span>
                  {e.todoId && (
                    <>
                      <RestoreTodo tracker={tracker} id={e.todoId} />
                      <DeleteButton
                        what={`the to-do "${e.title}"`}
                        iconOnly
                        onDelete={() => tracker.deleteTodo(e.todoId!)}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
