"use client";

import { Card } from "./ui";
import { RotateCcw } from "./icons";
import { Button } from "./ui";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { memo, useState } from "react";
import { Tracker, SetRecord, dateKey } from "@/lib/tracker";
import { readableText } from "@/lib/color";
import { fmtDateAuto, fmtTime } from "@/lib/dates";

/** "60×10" — compact, because a session's breakdown lists many of them. */
function formatSet(set: SetRecord): string {
  const body =
    set.weight != null && set.reps != null
      ? `${set.weight}×${set.reps}`
      : set.weight != null
        ? `${set.weight}kg`
        : set.reps != null
          ? `×${set.reps}`
          : "–";
  // Marked, or a one-arm set would read as half the work it was.
  return set.oneArm ? `${body}/arm` : body;
}

type Entry = {
  key: string;
  kind: "To-do" | "Goal" | "Recurring" | "Workout" | "Cardio" | "Calories" | "Macros";
  title: string;
  /** Second line, e.g. the set-by-set breakdown of a workout. */
  detail?: string;
  date: string;
  /**
   * When it happened, as epoch milliseconds. Absent on anything recorded
   * before timestamps existed, which sorts to the end of its own day rather
   * than being given a made-up time.
   */
  at?: number;
  color: string;
  todoId?: string;
  /** What the confirmation dialog calls this entry. */
  what: string;
  /** Removes the entry outright — it is not a soft delete. */
  onDelete: () => Promise<unknown>;
};

/** Each kind's dot, from the data palette (--data-* in globals.css). */
const KIND_COLOR: Record<Entry["kind"], string> = {
  "To-do": "#11779d",
  Goal: "#2168e4",
  Recurring: "#127c72",
  Workout: "#ce352a",
  Cardio: "#b75014",
  Calories: "#97640c",
  Macros: "#64761c",
};

function RestoreTodo({ tracker, id }: { tracker: Tracker; id: string }) {
  const { pending, run } = usePending();
  return (
    <Button
      size="sm"
      variant="ghost"
      isIconOnly
      aria-label="Move back to the to-do list"
      isDisabled={pending}
      onPress={() => void run(() => tracker.toggleTodo(id))}
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  );
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
        at: t.doneAt ?? undefined,
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
        at: g.doneAt ?? undefined,
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
      at: c.at,
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
      at: w.at,
      color: KIND_COLOR.Workout,
      what: `the ${w.name} session on ${w.date}`,
      onDelete: () => tracker.removeWorkoutSession(w.id),
    });
  });

  // Every calorie entry, not a daily total: the log is a record of things
  // done, and a total is not something that was done at a moment.
  s.calories.forEach((c) => {
    const tag = c.tagId ? s.mealTags.find((m) => m.id === c.tagId) : undefined;
    entries.push({
      key: `kcal-${c.id}`,
      kind: "Calories",
      title: `${c.kcal.toLocaleString()} kcal${tag ? ` — ${tag.name}` : ""}`,
      date: c.date,
      at: c.at,
      color: tag?.color || KIND_COLOR.Calories,
      what: `the ${c.kcal} kcal entry on ${c.date}`,
      onDelete: () => tracker.removeCalorieEntry(c.id),
    });
  });

  s.macros.forEach((m) => {
    const parts = [
      m.protein ? `${m.protein} g protein` : null,
      m.fiber ? `${m.fiber} g fibre` : null,
    ].filter(Boolean);
    // An entry with neither is nothing to show.
    if (!parts.length) return;
    entries.push({
      key: `macro-${m.id}`,
      kind: "Macros",
      title: parts.join(" · "),
      date: m.date,
      at: m.at,
      color: KIND_COLOR.Macros,
      what: `the ${parts.join(" and ")} entry on ${m.date}`,
      onDelete: () => tracker.removeMacroEntry(m.id),
    });
  });

  // Cardio is logged on its own, not as part of a session.
  s.cardio.forEach((c) => {
    entries.push({
      key: `cardio-${c.id}`,
      kind: "Cardio",
      title: `Cardio — ${c.minutes} min`,
      date: c.date,
      at: c.at,
      color: KIND_COLOR.Cardio,
      what: `the ${c.minutes} min cardio on ${c.date}`,
      onDelete: () => tracker.removeCardio(c.id),
    });
  });

  // Newest day first, and within a day the latest thing first. Anything
  // without a timestamp falls to the bottom of its day: it is known to have
  // happened that day and nothing more, and guessing a time would order it
  // against entries that actually know theirs.
  entries.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.at ?? -Infinity) - (a.at ?? -Infinity) ||
      a.title.localeCompare(b.title)
  );

  // A week of days at a time: the log is its own page now, so it
  // scrolls with the page rather than in a box of its own, and "Show
  // earlier" brings in more.
  const [daysShown, setDaysShown] = useState(7);
  const byDay: { date: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const last = byDay[byDay.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else byDay.push({ date: e.date, items: [e] });
  }
  const visible = byDay.slice(0, daysShown);

  const today = dateKey();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  })();
  const dayLabel = (k: string) => {
    if (k === today) return "Today";
    if (k === yesterday) return "Yesterday";
    const [y, m, d] = k.split("-").map(Number);
    const wd = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short" });
    return `${wd} ${fmtDateAuto(k)}`;
  };

  return (
    <div>
      <Card>
        <Card.Content className="p-4 md:p-5">
          {entries.length === 0 ? (
            <p className="py-1 text-[15px] text-[var(--muted)]">
              Nothing finished yet. Completed to-dos, goals and recurring tasks show up here.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {visible.map((day) => (
                <section key={day.date}>
                  <h3 className="log-day">
                    <span>{dayLabel(day.date)}</span>
                    <span className="text-[var(--muted)]">{day.items.length}</span>
                  </h3>
                  <ul className="list-none divide-y divide-foreground/10 p-0">
                    {day.items.map((e) => (
                      <li key={e.key} className="flex items-center gap-2.5 py-2.5">
                        <span className="log-kind">
                          <span className="cat-dot" style={{ background: e.color }} aria-hidden />
                          {e.kind}
                        </span>
                        <span className="min-w-0 flex-1 break-words text-[15px]">
                          {e.title}
                          {e.detail && (
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">{e.detail}</span>
                          )}
                        </span>
                        {e.at != null && (
                          <span className="font-mono-n shrink-0 text-xs text-[var(--muted)]">{fmtTime(e.at)}</span>
                        )}
                        {e.todoId && <RestoreTodo tracker={tracker} id={e.todoId} />}
                        <DeleteButton what={e.what} iconOnly bare onDelete={e.onDelete} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {byDay.length > daysShown && (
                <Button variant="outline" size="sm" className="self-start" onPress={() => setDaysShown(daysShown + 7)}>
                  Show earlier
                </Button>
              )}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
});

export default CompletionLog;
