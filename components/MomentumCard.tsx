"use client";

import Link from "next/link";
import { Tracker, caloriesLeftThisWeek, dateKey } from "@/lib/tracker";
import { byRoutineOrder, routines, type Routine, type RoutineKind } from "@/lib/routines";
import { todoDueBy } from "@/lib/model";
import { BookOpen, Check, Dumbbell, School } from "./icons";

/** Past two rows of tiles they'd be too many to read; a bar reads better. */
const MAX_TILES = 16;

const KIND: Record<RoutineKind, { Icon: typeof School; one: string; many: string; a: string }> = {
  goal: { Icon: School, one: "goal", many: "goals", a: "a goal" },
  book: { Icon: BookOpen, one: "book", many: "books", a: "a book" },
  workout: { Icon: Dumbbell, one: "workout", many: "workouts", a: "a workout" },
};

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "Two books, three goals and a workout": what the day was made of. */
function madeOf(units: Routine[]): string {
  const parts = (["book", "goal", "workout"] as const)
    .map((k) => [k, units.filter((u) => u.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${(WORDS[n] ?? String(n)).toLowerCase()} ${n === 1 ? KIND[k].one : KIND[k].many}`);
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

/**
 * The day's momentum: how many of today's routines are done.
 *
 * A dark hero card: the count in large figures, then one tile per routine
 * carrying its kind — done ones white, the next one outlined blue (the app's
 * one accent: what comes next), the rest faint — so it shows what the day is
 * made of, not just how much. Below, the figures from the other sections
 * that change daily, each a link to the page that holds them.
 */
export function MomentumCard({ tracker }: { tracker: Tracker }) {
  const st = tracker.state;
  if (!st) return null;

  const today = dateKey();
  // The routines: active goals, books being read and workouts, each due
  // once in its period.
  // Done first, then what's left in the list's order: the first of those
  // is the next one, as it is at the top of Routines.
  const units = routines(st, today).sort(byRoutineOrder);
  const ordered = [...units.filter((u) => u.done), ...units.filter((u) => !u.done)];
  const done = units.filter((u) => u.done).length;
  const total = units.length;
  const pct = total ? done / total : 0;
  const left = total - done;

  const openTodos = st.todos.filter((t) => !t.done && todoDueBy(t, today)).length;
  const latestWeight = st.weights.length ? st.weights[st.weights.length - 1].kg : null;
  const kcalToday = st.calories.filter((e) => e.date === today).reduce((a, e) => a + e.kcal, 0);
  const kcalLeft = caloriesLeftThisWeek(st.calories, st.calorieBudget);

  const allDone = total > 0 && left === 0;
  const next = ordered[done];

  return (
    <section className={"momentum" + (allDone ? " momentum--done" : "")} aria-label="Today's momentum">
      {total === 0 ? (
        // Day one: what to do first, rather than a count of nothing. The
        // Start rows below say how.
        <div className="momentum__top">
          <div>
            <p className="eyebrow">Day one</p>
            <p className="momentum__start">Start with one thing.</p>
            <p className="momentum__detail">
              Each goal, book or workout becomes a routine here, with its tile on this card.
            </p>
          </div>
          <ol className="momentum__tiles" aria-hidden>
            {(["goal", "book", "workout"] as const).map((k, i) => {
              const { Icon } = KIND[k];
              return (
                <li key={k} className={"momentum__tile" + (i === 0 ? " is-next" : "")}>
                  <Icon />
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="momentum__top">
          <div className="momentum__head">
            <p className="eyebrow">Today</p>
            {allDone && (
              <span className="momentum__badge">
                <Check aria-hidden />
                All done
              </span>
            )}
          </div>
          <div>
            <p className="momentum__count">
              <span className="font-mono-n momentum__headline">{`${done} of ${total}`}</span>
              {!allDone && <span className="momentum__detail">{left} to go</span>}
            </p>
            <p className="momentum__detail momentum__next">
              {allDone ? (
                madeOf(units)
              ) : (
                <>
                  Next · <span className="momentum__next-name">{next!.title}</span>, {KIND[next!.kind].a}
                </>
              )}
            </p>
          </div>
          {total <= MAX_TILES ? (
            <ol className="momentum__tiles" aria-label={`${done} of ${total} routines done`}>
              {ordered.map((u, i) => {
                const { Icon } = KIND[u.kind];
                return (
                  <li
                    key={u.key}
                    className={"momentum__tile" + (u.done ? " is-done" : i === done ? " is-next" : "")}
                    title={u.title}
                  >
                    <Icon aria-hidden />
                    <span className="sr-only">
                      {u.title}, {u.done ? "done" : "to do"}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="momentum__bar" role="img" aria-label={`${Math.round(pct * 100)}% of today's routines done`}>
              <span style={{ inlineSize: `${pct * 100}%` }} />
            </div>
          )}
        </div>
      )}

      <ul className="momentum__figures">
        <Figure label="To do" value={openTodos.toLocaleString()} href="#todo" />
        <Figure
          label={
            kcalLeft == null
              ? "kcal today"
              : kcalLeft >= 0
                ? `kcal · ${compact(kcalLeft)} left`
                : `kcal · ${compact(Math.abs(kcalLeft))} over`
          }
          value={kcalToday.toLocaleString()}
          href="/nutrition"
          warn={kcalLeft != null && kcalLeft < 0}
        />
        <Figure label="kg, latest" value={latestWeight != null ? `${latestWeight}` : "–"} href="/fitness" />
      </ul>
    </section>
  );
}

/** 9,340 → "9.3k": the week's remainder, short enough for the label's one line. */
function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

function Figure({
  label,
  value,
  href,
  warn,
}: {
  label: string;
  value: string;
  href: string;
  warn?: boolean;
}) {
  return (
    <li>
      <Link href={href} className="momentum__figure">
        <span className={"font-mono-n momentum__value" + (warn ? " is-warn" : "")}>{value}</span>
        <span className="momentum__label">{label}</span>
      </Link>
    </li>
  );
}
