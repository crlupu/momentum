"use client";

import Link from "next/link";
import { Tracker, caloriesLeftThisWeek, dateKey, recurringUnits } from "@/lib/tracker";
import { readingUnits } from "@/lib/reading";

const RING = 88;
const STROKE = 10;

/**
 * The day's momentum: how much of today's routine is done, as one ring.
 *
 * The one large piece of colour in the app. It fills in ultraviolet as routines
 * and reading targets are ticked off, and closes when the day is done.
 * Below it, the figures from the other sections that change daily, each a
 * link to the page that holds them.
 */
export function MomentumCard({ tracker }: { tracker: Tracker }) {
  const st = tracker.state;
  if (!st) return null;

  const today = dateKey();
  const units = [...recurringUnits(st.recurring, today), ...readingUnits(st, today)];
  const done = units.filter((u) => u.done).length;
  const total = units.length;
  const pct = total ? done / total : 0;
  const left = total - done;

  const openTodos = st.todos.filter((t) => !t.done).length;
  const latestWeight = st.weights.length ? st.weights[st.weights.length - 1].kg : null;
  const kcalToday = st.calories.filter((e) => e.date === today).reduce((a, e) => a + e.kcal, 0);
  const kcalLeft = caloriesLeftThisWeek(st.calories, st.calorieBudget);

  const r = RING / 2 - STROKE / 2;
  const circ = 2 * Math.PI * r;

  const headline =
    total === 0
      ? "No routines yet"
      : left === 0
        ? "All done today"
        : `${done} of ${total} done`;
  const detail =
    total === 0
      ? "Add a recurring task and it will count here."
      : left === 0
        ? "Every routine and reading target is ticked off."
        : `${left} ${left === 1 ? "routine" : "routines"} left today`;

  return (
    <section className="momentum card" aria-label="Today's momentum">
      <div className="momentum__top">
        <svg
          className="momentum__ring"
          width={RING}
          height={RING}
          viewBox={`0 0 ${RING} ${RING}`}
          role="img"
          aria-label={total ? `${Math.round(pct * 100)}% of today's routines done` : "No routines"}
        >
          <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="var(--accent-track)" strokeWidth={STROKE} />
          <circle
            className="ring-progress"
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            opacity={pct > 0 ? 1 : 0}
          />
          <text
            x="50%"
            y="50%"
            dominantBaseline="central"
            textAnchor="middle"
            className="font-mono-n"
            fontSize="22"
            fontWeight="700"
            fill="var(--foreground)"
          >
            {total ? `${Math.round(pct * 100)}%` : "–"}
          </text>
        </svg>
        <div className="min-w-0">
          <p className="momentum__headline">{headline}</p>
          <p className="momentum__detail">{detail}</p>
        </div>
      </div>

      <ul className="momentum__figures">
        <Figure label="To do" value={openTodos.toLocaleString()} href="#todo" />
        <Figure
          label={
            kcalLeft == null
              ? "kcal today"
              : kcalLeft >= 0
                ? `kcal · ${kcalLeft.toLocaleString()} left`
                : `kcal · ${Math.abs(kcalLeft).toLocaleString()} over`
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
