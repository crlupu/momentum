"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tracker, dateKey } from "@/lib/tracker";
import {
  WEEKDAY,
  WEEKDAY_LONG,
  isSwapped,
  leftoverDays,
  leftovers,
  swapOptions,
  swapPartner,
  nextOfGoal,
  refTitle,
  resolve,
  stepsOn,
  weekdayOf,
  type DayPlan,
  type DayStep,
  type PlanRef,
} from "@/lib/plan";
import type { TrackerState } from "@/lib/model";
import { usePending } from "../ActionButton";
import { Modal } from "../Modal";
import { GoalDetail, GoalTitle } from "../GoalDetail";
import { ReadingFlow } from "../books/flow";
import { useFlow } from "../books/flowContext";
import { Check, ChevronDown, Play, Swap } from "../icons";
import { doneThisWeek } from "@/lib/weekly";

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
        {/* Today first; what earlier days left waits under it, folded. */}
        <Leftovers tracker={tracker} plan={plan} onOpenGoal={setOpenGoal} />
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

/**
 * Steps not done on the last two plan days: one folded row under today's
 * plan, opened to review them by day, each tickable for its day or skipped,
 * a step or a day at a time.
 */
function Leftovers({ tracker, plan, onOpenGoal }: { tracker: Tracker; plan: DayPlan; onOpenGoal: (id: string) => void }) {
  const list = leftovers(tracker.state!, plan);
  const { pending, run } = usePending();
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const days = [...new Set(list.map((l) => l.day))].sort();
  const skip = (ls: typeof list) => void run(() => tracker.skipPlanSteps(ls.map((l) => ({ day: l.day, stepId: l.x.step.id }))));
  return (
    <section id="leftovers" className="scroll-mt-20">
      <div className="card leftovers">
        <button type="button" className="leftovers__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="leftovers__count font-mono-n">{list.length}</span>
          <span className="leftovers__text">
            <span className="leftovers__title">Left from earlier</span>
            <span className="leftovers__sub">From {leftoverDays(days)}</span>
          </span>
          <span className="leftovers__action">
            {open ? "Hide" : "Review"}
            <ChevronDown className={open ? "rotate-180" : undefined} aria-hidden />
          </span>
        </button>
        {open &&
          days.map((d) => {
            const ofDay = list.filter((l) => l.day === d);
            return (
              <div key={d} className="leftovers__day">
                <div className="leftovers__day-head">
                  <span>{WEEKDAY_LONG[weekdayOf(d)]}</span>
                  <button type="button" className="text-action" disabled={pending} onClick={() => skip(ofDay)}>
                    Skip day
                  </button>
                </div>
                <ol className="plan-steps-today">
                  {ofDay.map((l) => (
                    <StepRow key={l.day + l.x.step.id} tracker={tracker} plan={plan} x={l.x} day={l.day} dayLabel={WEEKDAY[weekdayOf(l.day)]} onOpenGoal={onOpenGoal} />
                  ))}
                </ol>
              </div>
            );
          })}
      </div>
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
            <PlanGlyph icon={x.icon} />
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
          aria-label={`${x.name}: ${title}${dayLabel ? `, ${dayLabel}` : ""}`}
          className={"check" + (x.done ? " check--on" : "")}
          disabled={pending}
          title={x.auto ? "Done: logged that day. Tap to unmark." : undefined}
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
  // Done from Left from earlier, it counts for its own day: ticked there, and
  // today lends it the activity, so today's step isn't done by it as well.
  // (Focus blocks already log to their step's day.)
  const leftover = day !== dateKey();
  const credit = () => (leftover ? tracker.creditLeftover(day, x.step.id) : Promise.resolve(true));
  // Any activity can trade places with another in this week's plan.
  const swap = (
    <>
      <button type="button" className="pill-link pill-link--icon" aria-label="Swap" title="Swap with another activity" onClick={() => setSwapping(true)}>
        <Swap aria-hidden />
      </button>
      <Modal open={swapping} onClose={() => setSwapping(false)} title={`Swap ${refTitle(tracker.state!, x.ref) ?? x.name}`}>
        {swapping && <SwapSheet tracker={tracker} plan={plan} x={x} day={day} onDone={() => setSwapping(false)} />}
      </Modal>
    </>
  );

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
            onClick={() =>
              void run(async () => {
                await credit();
                return nx.itemId ? tracker.setItemDone(it.item.id, nx.itemId, true) : tracker.logSession(it.item.id);
              })
            }
          >
            <Check aria-hidden /> <span className="pill-link__text">{nx.itemId ? `Done: ${nx.title}` : "Log a session"}</span>
          </button>
        )}
        <button type="button" className="pill-link" onClick={() => onOpenGoal(it.item.id)}>
          Open
        </button>
        {swap}
      </div>
    );
  }
  if (it.kind === "track" || it.kind === "book") {
    const book = it.kind === "track" ? it.book : it.item;
    return (
      <div className="plan-row__actions">
        {book ? (
          <>
            <button
              type="button"
              className="pill-link pill-link--primary"
              onClick={() => {
                void credit();
                flow.open({ kind: "log", bookId: book.id });
              }}
            >
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
        {swap}
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
            void credit();
            void tracker.startWorkout(it.item.id);
            router.push("/fitness?view=live");
          }}
        >
          <Play aria-hidden /> Start {it.item.name}
        </button>
        <Link href={`/fitness?view=workout&id=${it.item.id}`} className="pill-link">
          Open
        </Link>
        {swap}
      </div>
    );
  }
  if (it.kind === "weekly") {
    // Done for the day it's on; it counts toward the task's week.
    const n = doneThisWeek(it.item, day);
    return (
      <div className="plan-row__actions">
        <button
          type="button"
          className="pill-link pill-link--primary"
          disabled={pending}
          onClick={() => void run(() => tracker.toggleWeeklyTask(it.item.id, day))}
        >
          <Check aria-hidden /> <span className="pill-link__text">Done for {leftover ? WEEKDAY[weekdayOf(day)] : "today"}</span>
        </button>
        <span className="plan-row__note">
          {n} of {it.item.times} this week
        </span>
        {swap}
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
          <span className="pill-link__text">Open {it.project.title}</span>
        </Link>
      )}
      {swap}
    </div>
  );
}

/**
 * Exchange an activity with any other in this week's plan, for this week
 * only: a workout with another day's, reading with a goal, two steps of the
 * same day. Each takes the other's place; next week the plan is as it was.
 * A swapped step can be swapped back.
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
  const when = (d: string) => (d === day ? "Same day" : d < day ? "Earlier this week" : "Later this week");
  // The options by day, the step's own day first.
  const days = [...new Set(options.map((o) => o.day))].sort((a, b) => (a === day ? -1 : b === day ? 1 : a.localeCompare(b)));
  return (
    <div className="flex flex-col gap-4">
      <p className="plan-note">Trades places with another activity of this week&rsquo;s plan, for this week only. Next week the plan is as it was.</p>
      {partner && (
        <button type="button" className="pill-link" disabled={pending} onClick={() => swap(partner)}>
          <Swap aria-hidden /> Swap back{partner.day === day ? "" : ` with ${WEEKDAY_LONG[weekdayOf(partner.day)]}`}
        </button>
      )}
      {options.length ? (
        days.map((d) => (
          <section key={d} className="plan-opts-day">
            <h3 className="plan-opts-day__head">
              {WEEKDAY_LONG[weekdayOf(d)]}
              <span className="plan-opts-day__when"> · {when(d)}</span>
            </h3>
            <div className="card plan-opts">
              {options
                .filter((o) => o.day === d)
                .map((o) => (
                  <button key={o.day + o.stepId} type="button" className="plan-opt" disabled={pending} onClick={() => swap(o)}>
                    <span className="area-tile" aria-hidden>
                      <PlanGlyph icon={o.icon} />
                    </span>
                    <span className="plan-opt__text">
                      <span className="plan-opt__title">{o.title}</span>
                      <span className="plan-opt__sub">{optionSub(s, o.ref)}</span>
                    </span>
                    <Swap className="plan-opt__swap" aria-hidden />
                  </button>
                ))}
            </div>
          </section>
        ))
      ) : (
        <p className="plan-note">Nothing else left in this week&rsquo;s plan to swap with.</p>
      )}
    </div>
  );
}

/** A line under a swap option saying what it is. */
function optionSub(s: TrackerState, r: PlanRef): string {
  const it = resolve(s, r);
  if (!it) return "";
  if (it.kind === "workout") return `Workout · ${it.item.exercises.length} exercise${it.item.exercises.length === 1 ? "" : "s"}`;
  if (it.kind === "track") return it.book ? `Reading · ${it.book.title}` : "Reading";
  if (it.kind === "book") return "Reading";
  if (it.kind === "focus") return `Focus · ${it.minutes} min`;
  return s.categories.find((c) => c.id === it.item.catId)?.name ?? "Goal";
}
