"use client";

import Link from "next/link";
import { Tracker, caloriesLeftThisWeek, dateKey } from "@/lib/tracker";
import { routines } from "@/lib/routines";
import { todoDueBy } from "@/lib/model";
import { Check } from "./icons";

/** Past this many routines the segments would be slivers; a bar reads better. */
const MAX_SEGMENTS = 14;

/**
 * The day's momentum: how many of today's routines are done.
 *
 * A dark hero card: the count in large figures, then one segment per
 * routine — done ones white, the next one blue (the app's one accent: what
 * comes next), the rest faint. Grey circles and a square sit behind it, the
 * identity's shapes. Below, the figures from the other sections that change
 * daily, each a link to the page that holds them.
 */
export function MomentumCard({ tracker }: { tracker: Tracker }) {
  const st = tracker.state;
  if (!st) return null;

  const today = dateKey();
  // The routines: active goals, books being read and workouts, each due
  // once in its period.
  const units = routines(st, today);
  const done = units.filter((u) => u.done).length;
  const total = units.length;
  const pct = total ? done / total : 0;
  const left = total - done;

  const openTodos = st.todos.filter((t) => !t.done && todoDueBy(t, today)).length;
  const latestWeight = st.weights.length ? st.weights[st.weights.length - 1].kg : null;
  const kcalToday = st.calories.filter((e) => e.date === today).reduce((a, e) => a + e.kcal, 0);
  const kcalLeft = caloriesLeftThisWeek(st.calories, st.calorieBudget);

  const allDone = total > 0 && left === 0;

  return (
    <section className={"momentum" + (allDone ? " momentum--done" : "")} aria-label="Today's momentum">
      <span className="momentum__shape momentum__shape--circle" aria-hidden />
      <span className="momentum__shape momentum__shape--square" aria-hidden />
      <span className="momentum__shape momentum__shape--low" aria-hidden />
      {total === 0 ? (
        // Day one: what to do first, rather than a count of nothing. The
        // Start rows below say how.
        <div className="momentum__top">
          <div>
            <p className="eyebrow">Day one</p>
            <p className="momentum__start">Start with one thing.</p>
            <p className="momentum__detail">
              Each goal, book or workout becomes a routine here, with its segment on this card.
            </p>
          </div>
          <div className="momentum__segments" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={"momentum__seg" + (i === 0 ? " is-next" : "")} />
            ))}
          </div>
        </div>
      ) : (
        <div className="momentum__top">
          {allDone && (
            <div className="momentum__head">
              <p className="eyebrow">Today</p>
              <span className="momentum__badge">
                <Check aria-hidden />
                All done
              </span>
            </div>
          )}
          <p className="momentum__count">
            <span className="font-mono-n momentum__headline">{`${done} of ${total}`}</span>
            {!allDone && <span className="momentum__detail">done · {left} to go</span>}
          </p>
          {allDone && <p className="momentum__detail">Every routine is ticked off. See you tomorrow.</p>}
          {total <= MAX_SEGMENTS ? (
            <div
              className="momentum__segments"
              role="img"
              aria-label={`${done} of ${total} routines done`}
            >
              {units.map((_, i) => (
                <span
                  key={i}
                  className={"momentum__seg" + (i < done ? " is-done" : i === done ? " is-next" : "")}
                />
              ))}
            </div>
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
