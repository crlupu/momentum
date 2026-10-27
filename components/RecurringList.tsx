"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "./AppShell";
import { Panel } from "./Panel";
import { Card } from "./ui";
import { usePending } from "./ActionButton";
import { BookOpen, Check, ChevronDown, ChevronRight, Dumbbell, School } from "./icons";
import { Tracker, dateKey } from "@/lib/tracker";
import { REPEAT_LABEL, byRoutineOrder, routines, type Routine } from "@/lib/routines";
import { ReadingFlow } from "./books/flow";
import { InsertRow } from "./InsertRow";
import { WeeklyTaskRow, WeeklyTaskSheet } from "./WeeklyTasks";
import { doneThisWeek, weeklyTasksOf } from "@/lib/weekly";

function RoutineCheckbox({ tracker, r }: { tracker: Tracker; r: Routine }) {
  const { pending, run } = usePending();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={r.done}
      aria-label={r.title}
      // Done by activity: a session logged, pages read, the workout finished.
      // Only that takes it back, so the box holds.
      disabled={pending || r.auto}
      title={r.auto ? "Done: logged this period" : undefined}
      onClick={() => void run(() => tracker.toggleRoutine(r.kind, r.id))}
      className={"check" + (r.done ? " check--on" : "")}
    >
      <span className="check__ring">{r.done && <Check className="h-4 w-4" aria-hidden />}</span>
    </button>
  );
}

/** Each kind of routine is an area, with its colour and icon. */
const AREA = {
  goal: { cls: "area--learning", Icon: School },
  book: { cls: "area--reading", Icon: BookOpen },
  workout: { cls: "area--training", Icon: Dumbbell },
} as const;

function AreaTile({ kind }: { kind: Routine["kind"] }) {
  const { cls, Icon } = AREA[kind];
  return (
    <span className={"area-tile " + cls} aria-hidden>
      <Icon />
    </span>
  );
}

/**
 * The recurring list, kept by itself: active goals, books being read and
 * workouts, each ticked as soon as there's activity on it in its period.
 * How often each comes round is set on the goal, book or workout.
 */
export default function RecurringList({
  tracker,
  exclude,
  title = "Routines",
}: {
  tracker: Tracker;
  /** With a day plan: what it already covers ("kind:id"), left out here. */
  exclude?: Set<string>;
  title?: string;
}) {
  const s = tracker.state!;
  const list = routines(s, dateKey())
    .filter((r) => !exclude?.has(r.key))
    .sort(byRoutineOrder);

  // Weekly tasks, unless the plan already holds them; one that has had its
  // times this week folds away with what's done.
  const today = dateKey();
  const weekly = weeklyTasksOf(s).filter((t) => !exclude?.has(`weekly:${t.id}`));
  const weeklyFull = (t: (typeof weekly)[number]) => doneThisWeek(t, today) >= t.times;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const editingTask = editing && editing !== "new" ? weekly.find((t) => t.id === editing) ?? weeklyTasksOf(s).find((t) => t.id === editing) : undefined;

  // What's left shows; what's done folds into one row, opened on request.
  const [showDone, setShowDone] = useState(false);
  const doneCount = list.filter((r) => r.done).length + weekly.filter(weeklyFull).length;
  const shown = showDone ? list : list.filter((r) => !r.done);
  const shownWeekly = showDone ? weekly : weekly.filter((t) => !weeklyFull(t));

  if (list.length === 0 && weekly.length === 0 && !exclude) return <StartHere />;

  return (
    <ReadingFlow tracker={tracker}>
    <Panel title={title} bare>
      <Card>
        <Card.Content className="px-3 py-3 md:px-4">
            <ul
              // The whole list, no box of its own to scroll: what's done
              // folds away below, so it stays short.
              className="routine-list list-none p-0"
            >
              {shownWeekly.map((t) => (
                <WeeklyTaskRow key={`weekly:${t.id}`} tracker={tracker} task={t} onEdit={() => setEditing(t.id)} />
              ))}
              {shown.map((r) => (
                <li key={r.key} className="task-row task-row--area">
                  <AreaTile kind={r.kind} />
                  <span className="task-row__text">
                    <span className={"task-row__title " + (r.done ? "is-done" : "")}>{r.title}</span>
                    <span className="task-row__sub">
                      {REPEAT_LABEL[r.freq]}
                      <span aria-hidden> · </span>
                      {(() => {
                        // A book's page in place of its category: the tile
                        // already says it's reading.
                        const book = r.kind === "book" ? s.books.find((b) => b.id === r.id) : undefined;
                        return book ? (
                          <span className="font-mono-n whitespace-nowrap">
                            p. {book.read}
                            {book.pages > 0 ? ` of ${book.pages}` : ""}
                          </span>
                        ) : (
                          // The category in words: the tile already marks the kind, and
                          // colour is kept for what's next.
                          <>{r.cat.name}</>
                        );
                      })()}
                    </span>
                  </span>
                  <RoutineCheckbox tracker={tracker} r={r} />
                </li>
              ))}
            </ul>
          {doneCount > 0 && (
            <button
              type="button"
              className="done-fold"
              aria-expanded={showDone}
              onClick={() => setShowDone((v) => !v)}
            >
              <span className="done-fold__mark" aria-hidden>
                <Check />
              </span>
              <span className="flex-1">{doneCount} done</span>
              {showDone ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
            </button>
          )}
          <InsertRow label="Add weekly task" onPress={() => setEditing("new")} />
        </Card.Content>
      </Card>
      <WeeklyTaskSheet tracker={tracker} task={editingTask} open={editing !== null} onClose={() => setEditing(null)} />
    </Panel>
    </ReadingFlow>
  );
}

const START = [
  { kind: "goal", title: "Set a goal", sub: "Something to learn, counted or as a checklist" },
  { kind: "book", title: "Start a book", sub: "Pages a day, tracked as you read" },
  { kind: "workout", title: "Add a workout", sub: "Exercises with sets and reps" },
] as const;

/**
 * Day one: no routines yet, so the list is the three ways to make one, each
 * opening where it's made.
 */
function StartHere() {
  const { openGoal } = useShell();
  const router = useRouter();
  const go = (kind: Routine["kind"]) =>
    kind === "goal" ? openGoal() : router.push(kind === "book" ? "/education?view=library" : "/fitness?view=workouts");
  return (
    <Panel title="Start here" bare>
      <ul className="card hub-list">
        {START.map((r) => (
          <li key={r.kind}>
            <button type="button" className="hub-row" onClick={() => go(r.kind)}>
              <AreaTile kind={r.kind} />
              <span className="hub-row__text">
                <span className="hub-row__title">{r.title}</span>
                <span className="hub-row__sub">{r.sub}</span>
              </span>
              <ChevronRight className="rd-link__chevron" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
