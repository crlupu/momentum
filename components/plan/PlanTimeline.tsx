"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tracker, dateKey } from "@/lib/tracker";
import {
  WEEKDAY,
  askOf,
  leftovers,
  nextOfGoal,
  refTitle,
  stepsOn,
  weekdayOf,
  type DayPlan,
  type DayStep,
} from "@/lib/plan";
import { usePending } from "../ActionButton";
import { Modal } from "../Modal";
import { GoalDetail, GoalTitle } from "../GoalDetail";
import { ReadingFlow } from "../books/flow";
import { useFlow } from "../books/flowContext";
import { Check, ChevronDown, Play } from "../icons";

const LEFTOVERS_SHOWN = 3;
import { PlanGlyph } from "./bits";

/**
 * Today's steps, in the plan's order, each with its own tick: any can be done
 * first. The plan suggests one, the first not done, marked Suggested next
 * and opened up with its actions; tapping another row opens its actions too.
 * Above them, what earlier plan days left undone, to catch up or let go.
 */
export function PlanTimeline({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const today = dateKey();
  const steps = stepsOn(tracker.state!, plan, today);
  const [openGoal, setOpenGoal] = useState<string | null>(null);
  const goal = openGoal ? tracker.state!.goals.find((g) => g.id === openGoal) : undefined;
  const next = steps.find((x) => !x.done);

  return (
    <ReadingFlow tracker={tracker}>
      <div className="flex flex-col gap-6">
        <Leftovers tracker={tracker} plan={plan} onOpenGoal={setOpenGoal} />
        {steps.length > 0 && (
          <section>
            <div className="panel-head">
              <h2 className="panel-head__title">
                Today&rsquo;s plan · {steps.filter((x) => x.done).length} of {steps.length}
              </h2>
              <div className="panel-head__side">
                <Link href="/plan" className="text-action">
                  Edit plan
                </Link>
              </div>
            </div>
            <ol className="card plan-steps-today">
              {steps.map((x, i) => (
                <StepRow key={x.step.id} tracker={tracker} x={x} n={i + 1} day={today} suggested={x === next} onOpenGoal={setOpenGoal} />
              ))}
            </ol>
          </section>
        )}
      </div>
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

/** Steps not done on the plan days before today: tick to count them for their day, or let them go. */
function Leftovers({ tracker, plan, onOpenGoal }: { tracker: Tracker; plan: DayPlan; onOpenGoal: (id: string) => void }) {
  const list = leftovers(tracker.state!, plan);
  const { pending, run } = usePending();
  const [all, setAll] = useState(false);
  if (!list.length) return null;
  // A few at a time, so a missed day doesn't push today's plan off the screen.
  const shown = all ? list : list.slice(0, LEFTOVERS_SHOWN);
  return (
    <section id="leftovers" className="scroll-mt-20">
      <div className="panel-head">
        <h2 className="panel-head__title">Left from earlier · {list.length}</h2>
        <div className="panel-head__side">
          <button
            type="button"
            className="text-action"
            disabled={pending}
            onClick={() => void run(() => tracker.skipPlanSteps(list.map((l) => ({ day: l.day, stepId: l.x.step.id }))))}
          >
            Skip all
          </button>
        </div>
      </div>
      <ol className="card plan-steps-today">
        {shown.map((l) => (
          <StepRow
            key={l.day + l.x.step.id}
            tracker={tracker}
            x={l.x}
            day={l.day}
            dayLabel={WEEKDAY[weekdayOf(l.day)]}
            onOpenGoal={onOpenGoal}
          />
        ))}
        {list.length > LEFTOVERS_SHOWN && (
          <li>
            <button type="button" className="next-steps__more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              <span className="flex-1">{all ? "Show fewer" : `Show ${list.length - LEFTOVERS_SHOWN} more`}</span>
              <ChevronDown className={all ? "rotate-180" : undefined} aria-hidden />
            </button>
          </li>
        )}
      </ol>
    </section>
  );
}

function StepRow({
  tracker,
  x,
  n,
  day,
  dayLabel,
  suggested,
  onOpenGoal,
}: {
  tracker: Tracker;
  x: DayStep;
  /** Today's steps are numbered; leftovers carry their day instead. */
  n?: number;
  day: string;
  dayLabel?: string;
  suggested?: boolean;
  onOpenGoal: (id: string) => void;
}) {
  const s = tracker.state!;
  const { pending, run } = usePending();
  const [open, setOpen] = useState(false);
  const shown = open || (suggested && !x.done);
  const title = refTitle(s, x.ref) ?? (x.ref ? "Gone" : "Nothing picked");
  const running = s.activeFocus?.stepId === x.step.id && s.activeFocus.day === day;

  return (
    <li className={"plan-row" + (x.done ? " is-done" : "") + (suggested && !x.done ? " is-next" : "")}>
      <div className="plan-row__main">
        <button type="button" className="plan-row__open" aria-expanded={!!shown} onClick={() => setOpen((v) => !v)}>
          <span className="plan-row__n">{dayLabel ?? n}</span>
          <span className="area-tile plan-row__tile" aria-hidden>
            <PlanGlyph icon={x.step.icon} />
          </span>
          <span className="plan-row__text">
            <span className="plan-row__label">
              {suggested && !x.done ? "Suggested next · " : ""}
              {x.step.name}
              {running ? " · running" : ""}
            </span>
            <span className="plan-row__title">{title}</span>
            <span className="plan-row__meta">{askOf(s, x.it)}</span>
          </span>
        </button>
        {dayLabel && !x.done && (
          <button
            type="button"
            className="plan-row__skip"
            disabled={pending}
            onClick={() => void run(() => tracker.skipPlanSteps([{ day, stepId: x.step.id }]))}
          >
            Skip
          </button>
        )}
        <button
          type="button"
          role="checkbox"
          aria-checked={x.done}
          aria-label={`${x.step.name}: ${title}${dayLabel ? `, ${dayLabel}` : ""}`}
          className={"check" + (x.done ? " check--on" : "")}
          disabled={pending || x.auto}
          title={x.auto ? "Done: logged that day" : undefined}
          onClick={() => void run(() => tracker.togglePlanStep(day, x.step.id))}
        >
          <span className="check__ring">{x.done && <Check className="h-4 w-4" aria-hidden />}</span>
        </button>
      </div>
      {shown && !x.done && <StepActions tracker={tracker} x={x} day={day} onOpenGoal={onOpenGoal} running={running} />}
    </li>
  );
}

/** What a step can be done with, by kind: tick the next entry, log pages, start the workout or the focus timer. */
function StepActions({
  tracker,
  x,
  day,
  onOpenGoal,
  running,
}: {
  tracker: Tracker;
  x: DayStep;
  day: string;
  onOpenGoal: (id: string) => void;
  running: boolean;
}) {
  const router = useRouter();
  const flow = useFlow();
  const { pending, run } = usePending();
  const it = x.it;

  if (!it)
    return (
      <div className="plan-row__actions">
        <Link href="/plan" className="pill-link">
          Pick what it is
        </Link>
      </div>
    );

  if (it.kind === "goal") {
    const nx = nextOfGoal(it.item);
    return (
      <div className="plan-row__actions">
        {nx && (
          <button
            type="button"
            className="pill-link pill-link--primary"
            disabled={pending}
            onClick={() => void run(() => (nx.itemId ? tracker.setItemDone(it.item.id, nx.itemId, true) : tracker.logSession(it.item.id)))}
          >
            <Check aria-hidden /> {nx.itemId ? `Done: ${nx.title}` : "Log a session"}
          </button>
        )}
        <button type="button" className="pill-link" onClick={() => onOpenGoal(it.item.id)}>
          Open
        </button>
      </div>
    );
  }
  if (it.kind === "track" || it.kind === "book") {
    const book = it.kind === "track" ? it.book : it.item;
    return (
      <div className="plan-row__actions">
        {book ? (
          <>
            <button type="button" className="pill-link pill-link--primary" onClick={() => flow.open({ kind: "log", bookId: book.id })}>
              Log pages
            </button>
            <button type="button" className="pill-link" onClick={() => flow.open({ kind: "detail", bookId: book.id })}>
              Open
            </button>
          </>
        ) : (
          <Link href={`/education?track=${it.kind === "track" ? it.item.id : ""}`} className="pill-link">
            Open the track
          </Link>
        )}
      </div>
    );
  }
  if (it.kind === "workout") {
    return (
      <div className="plan-row__actions">
        <button
          type="button"
          className="pill-link pill-link--primary"
          onClick={() => {
            void tracker.startWorkout(it.item.id);
            router.push("/fitness?view=live");
          }}
        >
          <Play aria-hidden /> Start {it.item.name}
        </button>
        <Link href={`/fitness?view=workout&id=${it.item.id}`} className="pill-link">
          Open
        </Link>
      </div>
    );
  }
  // Focus: a timer, on Today's card while it runs.
  return (
    <div className="plan-row__actions">
      {running ? (
        <button type="button" className="pill-link pill-link--primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Running · see the card
        </button>
      ) : (
        <button
          type="button"
          className="pill-link pill-link--primary"
          disabled={pending}
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            void run(() => tracker.startFocus({ minutes: it.minutes, projectId: it.project?.id, stepId: x.step.id, day }));
          }}
        >
          <Play aria-hidden /> Start focus
        </button>
      )}
      {it.project && (
        <Link href={`/projects?p=${it.project.id}`} className="pill-link">
          Open {it.project.title}
        </Link>
      )}
    </div>
  );
}
