"use client";

import { useState } from "react";
import { Check, ChevronDown, School } from "./icons";
import { CardTiles, SummaryCard, type CardFigure } from "./SummaryCard";
import { dateKey } from "@/lib/tracker";
import { weekOf } from "@/lib/plan";

/** Learning's figures: goals under way, books open, sessions this week. */
export function learningFigures(tracker: Tracker): CardFigure[] {
  const s = tracker.state!;
  const from = weekOf(dateKey());
  return [
    { value: s.goals.filter((g) => goalStatus(g) === "active").length, label: "goals active" },
    { value: s.books.filter((b) => b.status === "active").length, label: "books open" },
    { value: (s.learningLog ?? []).filter((e) => e.date >= from).length, label: "sessions this week" },
  ];
}
import { usePending } from "./ActionButton";
import { Button } from "./ui";
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
 * The next thing to do on each active goal. The first opens Education as its
 * hero card, with the screen's one blue action; the others follow as rows,
 * ticked from here, at most three before the rest wait behind one row.
 * Tapping a row opens its goal.
 */
export function NextSteps({ tracker, onOpen }: { tracker: Tracker; onOpen: (goalId: string) => void }) {
  const s = tracker.state!;
  const [all, setAll] = useState(false);
  const steps = s.goals
    .filter((g) => goalStatus(g) === "active")
    .map(stepOf)
    .filter((x): x is Step => !!x);
  if (steps.length === 0) return null;
  const [first, ...rest] = steps;
  const shown = all ? rest : rest.slice(0, SHOWN);
  const more = rest.length - SHOWN;

  return (
    <>
    <NextHero tracker={tracker} step={first} onOpen={onOpen} />
    {rest.length > 0 && (
    <section>
      <h2 className="panel-head__title next-steps__head">Then</h2>
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
    )}
    </>
  );
}

/** The first next step, as the tab's hero: what it is, where it's from, and Mark done. */
function NextHero({ tracker, step, onOpen }: { tracker: Tracker; step: Step; onOpen: (id: string) => void }) {
  const { pending, run } = usePending();
  const tick = () =>
    void run(() =>
      step.item ? tracker.setItemDone(step.goal.id, step.item.id, true) : tracker.stepGoal(step.goal.id, 1)
    );
  const [from, count] = step.item ? [step.goal.title, step.sub.slice(step.goal.title.length + 3)] : [step.goal.title, step.sub];
  // The goal's entries around the next one: two before, the next, two after.
  const all = [step.goal.items ?? [], ...(step.goal.parts ?? []).map((p) => p.items ?? [])].flat();
  const at = step.item ? all.findIndex((i) => i.id === step.item!.id) : -1;
  const around =
    at < 0
      ? []
      : all.slice(Math.max(0, Math.min(at - 2, all.length - 5)), Math.max(0, Math.min(at - 2, all.length - 5)) + 5).map((i) => ({
          key: i.id,
          icon: <School aria-hidden />,
          label: i.title,
          title: i.title,
          state: (i.done ? "done" : i.id === step.item!.id ? "next" : "todo") as "done" | "next" | "todo",
        }));
  return (
    <SummaryCard
      aria-label="Next step"
      label="Next step"
      aside={count}
      title={step.title}
      line={from}
      actions={
        <>
          <Button variant="primary" isDisabled={pending} onPress={tick}>
            <Check aria-hidden /> Mark done
          </Button>
          <button type="button" className="hero__ghost" onClick={() => onOpen(step.goal.id)}>
            Open
          </button>
        </>
      }
      figures={learningFigures(tracker)}
    >
      {around.length > 1 && <CardTiles items={around} />}
    </SummaryCard>
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
