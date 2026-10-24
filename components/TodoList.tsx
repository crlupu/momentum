"use client";

import { FormEvent, useState } from "react";
import { Card, PanelHeader } from "./ui";
import { Check, ChevronDown, ChevronRight, Plus } from "./icons";
import { usePending } from "./ActionButton";
import { Tracker } from "@/lib/tracker";
import { dateKey, todoDueBy, type TodoItem, type TrackerState } from "@/lib/model";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Mon", from a YYYY-MM-DD key. */
const weekday = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};

/** Planned days first, earliest first, then the undated, each by title. */
const byPlan = (a: TodoItem, b: TodoItem) =>
  (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
  a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

/** "Kafka 101 · Readings": what a tied to-do waits for, or nothing. */
function stepOf(s: TrackerState, t: TodoItem): string | null {
  if (!t.goalId) return null;
  const g = s.goals.find((x) => x.id === t.goalId);
  if (!g) return null;
  const part = t.partId ? g.parts?.find((p) => p.id === t.partId) : undefined;
  return part ? `${g.title} · ${part.title}` : g.title;
}

function TodoRow({ tracker, t, day, today }: { tracker: Tracker; t: TodoItem; day?: boolean; today: string }) {
  const s = tracker.state!;
  const step = stepOf(s, t);
  const late = t.date && t.date < today ? `from ${weekday(t.date)}` : null;
  const meta = [day && t.date ? weekday(t.date) : late, step ? `ticks with ${step}` : null].filter(Boolean);
  return (
    <li className="task-row">
      <TodoCheckbox tracker={tracker} id={t.id} done={t.done} label={t.title} />
      <span className="task-row__title">
        {t.title}
        {meta.length > 0 && <span className="task-row__meta">{meta.join(" · ")}</span>}
      </span>
    </li>
  );
}

function TodoCheckbox({ tracker, id, done, label }: { tracker: Tracker; id: string; done: boolean; label: string }) {
  const { pending, run } = usePending();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={pending}
      onClick={() => void run(() => tracker.toggleTodo(id))}
      className={"check" + (done ? " check--on" : "")}
    >
      <span className="check__ring">
        {done && <Check className="h-4 w-4" aria-hidden />}
      </span>
    </button>
  );
}

export default function TodoList({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const { pending, run } = usePending();

  const [showLater, setShowLater] = useState(false);
  const today = dateKey();

  // Finished items move to the log, so this stays a list of what's left:
  // today's, anything left over from earlier days, and the undated.
  const left = s.todos.filter((t) => !t.done);
  const open = left.filter((t) => todoDueBy(t, today)).sort(byPlan);
  const later = left.filter((t) => !todoDueBy(t, today)).sort(byPlan);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    const ok = await run(() => tracker.addTodo(t));
    if (ok) setTitle("");
  };

  return (
    <div id="todo" className="scroll-mt-20">
      <PanelHeader title="To do" color="var(--sec-todos)" />

      <Card>
        <Card.Content className="px-3 py-3 md:px-4">
          {/* The add is the list's first row: type and press return. */}
          <form onSubmit={submit} className="todo-add">
            <span className="todo-add__mark" aria-hidden>
              <Plus />
            </span>
            <input
              aria-label="New to-do"
              placeholder="New to-do"
              enterKeyHint="done"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="todo-add__input"
            />
            {title.trim() && (
              <button type="submit" className="todo-add__go" disabled={pending}>
                Add
              </button>
            )}
          </form>

          {open.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-[var(--muted)]">Nothing to do today.</p>
          ) : (
            <ul
              className={
                "list-none p-0 " +
                (open.length > 5 ? "max-h-[17rem] overflow-y-auto pr-1 recurring-scroll" : "")
              }
            >
              {open.map((t) => (
                <TodoRow key={t.id} tracker={tracker} t={t} today={today} />
              ))}
            </ul>
          )}

          {later.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                className="todo-later"
                aria-expanded={showLater}
                onClick={() => setShowLater((v) => !v)}
              >
                {showLater ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                Later · {later.length}
              </button>
              {showLater && (
                <ul className="list-none p-0">
                  {later.map((t) => (
                    <TodoRow key={t.id} tracker={tracker} t={t} day today={today} />
                  ))}
                </ul>
              )}
            </div>
          )}

        </Card.Content>
      </Card>
    </div>
  );
}
