"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tracker, dateKey } from "@/lib/tracker";
import { askOf, nextOfGoal, refTitle, stepsOn, type DayPlan, type DayStep } from "@/lib/plan";
import { usePending } from "../ActionButton";
import { Button } from "../ui";
import { Modal } from "../Modal";
import { GoalDetail, GoalTitle } from "../GoalDetail";
import { ReadingFlow } from "../books/flow";
import { useFlow } from "../books/flowContext";
import { Check } from "../icons";

/**
 * Today's steps as a timeline: a line joins them in the plan's order, done
 * ones filled, the next ringed in blue and opened up with Mark done and
 * Open, the rest hollow. Each says what it asks of today.
 */
export function PlanTimeline({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const steps = stepsOn(tracker.state!, plan, dateKey());
  const [openGoal, setOpenGoal] = useState<string | null>(null);
  if (steps.length === 0) return null;
  const nextIdx = steps.findIndex((x) => !x.done);
  const goal = openGoal ? tracker.state!.goals.find((g) => g.id === openGoal) : undefined;

  return (
    <ReadingFlow tracker={tracker}>
      <section>
        <div className="panel-head">
          <h2 className="panel-head__title">Today&rsquo;s plan</h2>
          <div className="panel-head__side">
            <Link href="/plan" className="text-action">
              Edit plan
            </Link>
          </div>
        </div>
        <ol className="card plan-line">
          {steps.map((x, i) => (
            <StepRow
              key={x.step.id}
              tracker={tracker}
              x={x}
              n={i + 1}
              state={x.done ? "done" : i === nextIdx ? "next" : "todo"}
              prevDone={i > 0 && steps[i - 1].done}
              first={i === 0}
              last={i === steps.length - 1}
              onOpenGoal={setOpenGoal}
            />
          ))}
        </ol>
      </section>
      <Modal
        open={!!goal}
        onClose={() => setOpenGoal(null)}
        title={goal?.title ?? ""}
        titleNode={goal && <GoalTitle key={goal.id} tracker={tracker} goal={goal} />}
        wide
      >
        {goal && <GoalDetail key={goal.id} tracker={tracker} goal={goal} onClose={() => setOpenGoal(null)} />}
      </Modal>
    </ReadingFlow>
  );
}

function StepRow({
  tracker,
  x,
  n,
  state,
  prevDone,
  first,
  last,
  onOpenGoal,
}: {
  tracker: Tracker;
  x: DayStep;
  n: number;
  state: "done" | "next" | "todo";
  prevDone: boolean;
  first: boolean;
  last: boolean;
  onOpenGoal: (id: string) => void;
}) {
  const s = tracker.state!;
  const router = useRouter();
  const flow = useFlow();
  const { pending, run } = usePending();
  const today = dateKey();
  const title = refTitle(s, x.ref) ?? (x.ref ? "Gone" : "Nothing picked");

  // Doing it here: a goal's next entry ticked (or a session logged), which
  // is activity and so ticks the step; anything else is ticked by hand.
  const markDone = () =>
    void run(() => {
      if (x.it?.kind === "goal") {
        const nx = nextOfGoal(x.it.item);
        if (nx?.itemId) return tracker.setItemDone(x.it.item.id, nx.itemId, true);
        if (nx) return tracker.logSession(x.it.item.id);
      }
      return tracker.togglePlanStep(today, x.step.id);
    });
  const open = () => {
    if (!x.it) return router.push("/plan");
    if (x.it.kind === "goal") return onOpenGoal(x.it.item.id);
    if (x.it.kind === "book") return flow.open({ kind: "detail", bookId: x.it.item.id });
    router.push(`/fitness?view=workout&id=${x.it.item.id}`);
  };

  return (
    <li className={"plan-line__row is-" + state}>
      <span className="plan-line__rail" aria-hidden={false}>
        <span className={"plan-line__seg" + (first ? " is-none" : prevDone ? " is-done" : "")} />
        <button
          type="button"
          role="checkbox"
          aria-checked={x.done}
          aria-label={`${x.step.name}: ${title}`}
          className="plan-line__dot"
          disabled={pending || x.auto}
          title={x.auto ? "Done: logged today" : undefined}
          onClick={() => void run(() => tracker.togglePlanStep(today, x.step.id))}
        >
          {x.done && <Check aria-hidden />}
        </button>
        <span className={"plan-line__seg plan-line__seg--grow" + (last ? " is-none" : x.done ? " is-done" : "")} />
      </span>
      <div className="plan-line__body">
        <p className="plan-line__label">
          {n} · {x.step.name}
        </p>
        <p className="plan-line__title">{title}</p>
        <p className="plan-line__meta">{askOf(s, x.it)}</p>
        {state === "next" && (
          <div className="plan-line__actions">
            <Button variant="primary" isDisabled={pending} onPress={markDone}>
              <Check aria-hidden />
              Mark done
            </Button>
            <button type="button" className="pill-link" onClick={open}>
              Open
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
