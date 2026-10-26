"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tracker, dateKey } from "@/lib/tracker";
import {
  WEEKDAY,
  WEEKDAY_LONG,
  isSwapped,
  leftovers,
  swapOptions,
  swapPartner,
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
import { Check, ChevronDown, Play, Swap } from "../icons";

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
                <StepRow key={x.step.id} tracker={tracker} plan={plan} x={x} n={i + 1} day={today} suggested={x === next} onOpenGoal={setOpenGoal} />
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
            plan={plan}
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
  plan,
  x,
  n,
  day,
  dayLabel,
  suggested,
  onOpenGoal,
}: {
  tracker: Tracker;
  plan: DayPlan;
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
          {/* One line: what it is. The tile says the kind; the actions say the rest. */}
          <span className="plan-row__text">
            <span className="plan-row__title">
              {title}
              {running ? " · running" : ""}
              {isSwapped(s, x.step, day) && <Swap className="plan-row__swapped" aria-label="swapped this week" />}
            </span>
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
      {shown && !x.done && <StepActions tracker={tracker} plan={plan} x={x} day={day} onOpenGoal={onOpenGoal} running={running} />}
    </li>
  );
}

/** What a step can be done with, by kind: tick the next entry, log pages, start the workout or the focus timer. */
function StepActions({
  tracker,
  plan,
  x,
  day,
  onOpenGoal,
  running,
}: {
  tracker: Tracker;
  plan: DayPlan;
  x: DayStep;
  day: string;
  onOpenGoal: (id: string) => void;
  running: boolean;
}) {
  const [swapping, setSwapping] = useState(false);
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
        <button type="button" className="pill-link pill-link--icon" aria-label="Swap" title="Swap with another day" onClick={() => setSwapping(true)}>
          <Swap aria-hidden />
        </button>
        <Modal open={swapping} onClose={() => setSwapping(false)} title={`Swap ${it.item.name}`}>
          {swapping && <SwapSheet tracker={tracker} plan={plan} x={x} day={day} onDone={() => setSwapping(false)} />}
        </Modal>
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

/**
 * Exchange a workout with one from another day of this week's plan, for this
 * week only: today takes that day's workout and that day takes today's. Next
 * week the plan is as it was. A swapped step can be swapped back.
 */
function SwapSheet({ tracker, plan, x, day, onDone }: { tracker: Tracker; plan: DayPlan; x: DayStep; day: string; onDone: () => void }) {
  const s = tracker.state!;
  const { pending, run } = usePending();
  const options = swapOptions(s, plan, day, x.step.id);
  const partner = isSwapped(s, x.step, day) ? swapPartner(s, plan, day, x.step.id) : null;
  const swap = (b: { day: string; stepId: string }) =>
    void run(async () => {
      const ok = await tracker.swapPlanSteps({ day, stepId: x.step.id }, b);
      onDone();
      return ok;
    });
  return (
    <div className="flex flex-col gap-4">
      <p className="plan-note">Swaps with another day of this week&rsquo;s plan, for this week only. Next week the plan is as it was.</p>
      {partner && (
        <button type="button" className="pill-link" disabled={pending} onClick={() => swap(partner)}>
          <Swap aria-hidden /> Swap back with {WEEKDAY_LONG[weekdayOf(partner.day)]}
        </button>
      )}
      {options.length ? (
        <div className="card plan-opts">
          {options.map((o) => {
            const w = s.workouts.find((y) => y.id === o.ref.id);
            return (
              <button key={o.day + o.stepId} type="button" className="plan-opt" disabled={pending} onClick={() => swap(o)}>
                <span className="plan-opt__day">{WEEKDAY[weekdayOf(o.day)]}</span>
                <span className="plan-opt__text">
                  <span className="plan-opt__title">{o.title}</span>
                  <span className="plan-opt__sub">
                    {w ? `${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"} · ` : ""}
                    {o.day < day ? "earlier this week" : "later this week"}
                  </span>
                </span>
                <Swap className="plan-opt__swap" aria-hidden />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="plan-note">No other workout left in this week&rsquo;s plan to swap with.</p>
      )}
    </div>
  );
}
