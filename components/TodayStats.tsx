"use client";

import { Tracker, caloriesLeftThisWeek, dateKey, recurringUnits } from "@/lib/tracker";
import { readingUnits } from "@/lib/reading";

type Stat = { key: string; value: string; label: string; negative?: boolean };

/** Today's figures, worked out once for both layouts. */
function todayStats(tracker: Tracker): Stat[] | null {
  const st = tracker.state;
  if (!st) return null;

  const today = dateKey();
  // Reading tracks count alongside recurring tasks: a track is done for the
  // day once its page target is met.
  const units = [...recurringUnits(st.recurring, today), ...readingUnits(st, today)];
  const done = units.filter((u) => u.done).length;

  const openTodos = st.todos.filter((t) => !t.done).length;
  const latestWeight = st.weights.length ? st.weights[st.weights.length - 1].kg : null;
  const kcalToday = st.calories
    .filter((e) => e.date === today)
    .reduce((a, e) => a + e.kcal, 0);
  const kcalLeft = caloriesLeftThisWeek(st.calories, st.calorieBudget);
  const n = (v: number) => v.toLocaleString();

  const stats: Stat[] = [
    { key: "done", value: `${done}/${units.length}`, label: "Done today" },
    { key: "todo", value: n(openTodos), label: "To do" },
    { key: "kg", value: latestWeight != null ? `${latestWeight}` : "–", label: "kg" },
    { key: "kcal", value: n(kcalToday), label: "kcal today" },
  ];
  if (kcalLeft != null) {
    stats.push({
      key: "left",
      value: n(kcalLeft),
      label: kcalLeft >= 0 ? "kcal left this week" : "kcal over this week",
      negative: kcalLeft < 0,
    });
  }
  return stats;
}

/**
 * Today at a glance: routines done, to-dos open, weight, calories.
 *
 * Two layouts of the same figures. On a phone they are a row under the page
 * title that scrolls sideways; on a desktop, a short list in the sidebar.
 * Neutral throughout — the only colour is red, and only when the week's
 * calories have gone over.
 */
export function TodayStats({
  tracker,
  layout,
  className,
}: {
  tracker: Tracker;
  layout: "strip" | "list";
  className?: string;
}) {
  const stats = todayStats(tracker);
  if (!stats) return null;

  if (layout === "list") {
    return (
      <dl className={["today-list", className].filter(Boolean).join(" ")}>
        {stats.map((s) => (
          <div key={s.key} className="today-list__row">
            <dt>{s.label}</dt>
            <dd className={"font-mono-n" + (s.negative ? " is-negative" : "")}>
              {s.negative ? s.value.replace("-", "−") : s.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl
      className={["today-strip", className].filter(Boolean).join(" ")}
      aria-label="Today"
    >
      {stats.map((s) => (
        // The figure is drawn above its label (column-reverse), but the
        // label comes first in the markup, as a <dl> requires.
        <div key={s.key} className="today-strip__item">
          <dt>{s.label}</dt>
          <dd className={"font-mono-n" + (s.negative ? " is-negative" : "")}>
            {s.negative ? s.value.replace("-", "−") : s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
