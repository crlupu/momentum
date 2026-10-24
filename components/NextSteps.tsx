"use client";

import { useState } from "react";
import { Check, ChevronDown } from "./icons";
import { usePending } from "./ActionButton";
import { Tracker, goalStatus, type Goal, type GoalItem } from "@/lib/tracker";

/** How many steps show before the rest wait behind "Show more". */
const SHOWN = 3;

type Step = {
  key: string;
  goal: Goal;
  /** The checklist entry to tick, or none for a goal that only counts. */
  item?: GoalItem;
  title: string;
  sub: string;
};

/** A goal's next step: its first unticked entry, or one more on its count. */
function stepOf(g: Goal): Step | null {
  const lists = [g.items ?? [], ...(g.parts ?? []).map((p) => p.items ?? [])];
  const all = lists.flat();
  const item = all.find((i) => !i.done);
  if (item) {
    const done = all.filter((i) => i.done).length;
    return { key: item.id, goal: g, item, title: item.title, sub: `${g.title} · ${done + 1} of ${all.length}` };
  }
  if (all.length === 0 && g.target && (g.current ?? 0) < g.target) {
    return { key: g.id, goal: g, title: g.title, sub: `${(g.current ?? 0) + 1} of ${g.target}` };
  }
  return null;
}

/**
 * The next thing to do on each active goal, one row each, ticked from here.
 * At most three show, so the list never takes over the screen; the rest
 * wait behind one row. Tapping a row opens its goal.
 */
export function NextSteps({ tracker, onOpen }: { tracker: Tracker; onOpen: (goalId: string) => void }) {
  const s = tracker.state!;
  const [all, setAll] = useState(false);
  const steps = s.goals
    .filter((g) => goalStatus(g) === "active")
    .map(stepOf)
    .filter((x): x is Step => !!x);
  if (steps.length === 0) return null;
  const shown = all ? steps : steps.slice(0, SHOWN);
  const more = steps.length - SHOWN;

  return (
    <section>
      <h2 className="panel-head__title next-steps__head">Next steps</h2>
      <ul className="group-list">
        {shown.map((st) => (
          <StepRow key={st.key} tracker={tracker} step={st} onOpen={onOpen} />
        ))}
        {more > 0 && (
          <li>
            <button type="button" className="next-steps__more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              <span className="flex-1">{all ? "Show fewer" : `Show ${more} more`}</span>
              <ChevronDown className={all ? "rotate-180" : undefined} aria-hidden />
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

function StepRow({ tracker, step, onOpen }: { tracker: Tracker; step: Step; onOpen: (id: string) => void }) {
  const { pending, run } = usePending();
  const tick = () =>
    void run(() =>
      step.item ? tracker.setItemDone(step.goal.id, step.item.id, true) : tracker.stepGoal(step.goal.id, 1)
    );
  return (
    <li className="next-step">
      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        aria-label={`Mark ${step.title} done`}
        disabled={pending}
        onClick={tick}
        className="check"
      >
        <span className="check__ring">{pending && <Check className="h-4 w-4" aria-hidden />}</span>
      </button>
      <button type="button" className="next-step__open" onClick={() => onOpen(step.goal.id)}>
        <span className="next-step__title">{step.title}</span>
        <span className="next-step__sub">{step.sub}</span>
      </button>
    </li>
  );
}
