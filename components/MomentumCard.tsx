"use client";

import Link from "next/link";
import { Tracker, caloriesLeftThisWeek, dateKey } from "@/lib/tracker";
import { routines } from "@/lib/routines";
import { todoDueBy } from "@/lib/model";

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

  const headline = total === 0 ? "No routines yet" : left === 0 ? "All done" : `${done} of ${total}`;
  const detail =
    total === 0
      ? "Active goals, books and workouts count here."
      : left === 0
        ? "Every routine is ticked off."
        : `done · ${left} to go`;

  return (
    <section className="momentum" aria-label="Today's momentum">
      <span className="momentum__shape momentum__shape--circle" aria-hidden />
      <span className="momentum__shape momentum__shape--square" aria-hidden />
      <span className="momentum__shape momentum__shape--low" aria-hidden />
      <div className="momentum__top">
        <p className="momentum__count">
          <span className="font-mono-n momentum__headline">{headline}</span>
          {total > 0 && <span className="momentum__detail">{detail}</span>}
        </p>
        {total === 0 && <p className="momentum__detail">{detail}</p>}
        {total > 0 &&
          (total <= MAX_SEGMENTS ? (
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
          ))}
      </div>

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
