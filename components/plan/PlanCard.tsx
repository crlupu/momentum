"use client";

import Link from "next/link";
import { Tracker, dateKey } from "@/lib/tracker";
import { WEEKDAY_LONG, stepsOn, summarizeWeek, weekNumber, weekOf, weekdayOf, type DayPlan, type GoalProgress } from "@/lib/plan";
import { usePending } from "../ActionButton";
import { ReadingFlow } from "../books/flow";
import { useFlow } from "../books/flowContext";
import { Check, ChevronRight } from "../icons";
import { TodayFigures } from "../MomentumCard";
import { PlanGlyph, WeekRings } from "./bits";

/**
 * Today's card when there is a day plan: the day's count, one tile per step
 * in the plan's order (done white, the next ringed blue), and a band with
 * the week's days as rings and its goals, opening the week. On a day the
 * plan doesn't run, the week leads instead.
 */
export function PlanCard({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const s = tracker.state!;
  const today = dateKey();
  const steps = stepsOn(s, plan, today);
  const week = summarizeWeek(s, weekOf(today), today);
  const n = steps.length;
  const done = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);
  const allDone = n > 0 && !next;
  const weekday = WEEKDAY_LONG[weekdayOf(today)];

  if (n === 0) return <RestDayCard tracker={tracker} weekday={weekday} />;

  return (
    <section className={"momentum plan-card" + (allDone ? " momentum--done" : "")} aria-label="Today's plan">
      <div className="momentum__top">
        <div className="momentum__head">
          <p className="eyebrow">{weekday}</p>
          {allDone ? (
            <span className="momentum__badge">
              <Check aria-hidden />
              All done
            </span>
          ) : (
            <span className="plan-card__next">
              Next · <span className="momentum__next-name">{next!.step.name}</span>
            </span>
          )}
        </div>
        <div>
          <p className="momentum__count">
            <span className="font-mono-n momentum__headline">{`${done} of ${n}`}</span>
            {!allDone && <span className="momentum__detail">{n - done} to go</span>}
          </p>
          {allDone && <p className="momentum__detail momentum__next">Every step is done. See you tomorrow.</p>}
        </div>
        <ol className="plan-card__tiles" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(n, 5), 8)}, minmax(0, 1fr))` }}>
          {steps.map((x) => (
            <li key={x.step.id} className="plan-card__cell">
              <span className={"momentum__tile" + (x.done ? " is-done" : x === next ? " is-next" : "")}>
                <PlanGlyph icon={x.step.icon} />
              </span>
              <span className={"plan-card__label" + (x === next ? " is-next" : "")}>{x.step.name}</span>
              <span className="sr-only">{x.done ? "done" : "to do"}</span>
            </li>
          ))}
        </ol>
      </div>
      <Link href="/week" className="plan-card__week">
        <span className="plan-card__week-label">Week {weekNumber(week.week)}</span>
        <span className="plan-card__week-rings">
          <WeekRings days={week.days} today={today} size={20} labels={false} />
        </span>
        <span className="plan-card__week-goals">
          {week.goals.length ? `${week.goalsDone} of ${week.goals.length} goals` : "Set goals"}
          <ChevronRight aria-hidden />
        </span>
      </Link>
      <TodayFigures tracker={tracker} />
    </section>
  );
}

/** A day the plan doesn't run on: the week, and what's left to finish it. */
function RestDayCard({ tracker, weekday }: { tracker: Tracker; weekday: string }) {
  const s = tracker.state!;
  const today = dateKey();
  const week = summarizeWeek(s, weekOf(today), today);
  const left = week.goals.filter((g) => !g.done);
  return (
    <section className={"momentum plan-card" + (week.done ? " momentum--done" : "")} aria-label="This week">
      <div className="momentum__top">
        <div className="momentum__head">
          <p className="eyebrow">{weekday} · No plan today</p>
          {week.done && (
            <span className="momentum__badge">
              <Check aria-hidden />
              Week done
            </span>
          )}
        </div>
        <div>
          <p className="momentum__count">
            {week.goals.length ? (
              <>
                <span className="font-mono-n momentum__headline">{`${week.goalsDone} of ${week.goals.length}`}</span>
                <span className="momentum__detail">week goals</span>
              </>
            ) : (
              <>
                <span className="font-mono-n momentum__headline">{`${week.daysDone} of ${week.daysPlanned}`}</span>
                <span className="momentum__detail">plan days</span>
              </>
            )}
          </p>
          <p className="momentum__detail plan-card__line">
            {week.done
              ? "Every goal and every plan day, done."
              : left.length === 1
                ? <>One left: <span className="plan-card__strong">{left[0].label}</span>, {left[0].count}.</>
                : left.length > 1
                  ? `${left.length} goals left this week.`
                  : "Weekends are rest days. Turn them on in the plan to give them steps."}
          </p>
        </div>
        <WeekRings days={week.days} today={today} size={30} />
        <div className="plan-card__actions">
          {left.length === 1 && left[0].goal.ref ? (
            <ReadingFlow tracker={tracker}>
              <FinishAction tracker={tracker} p={left[0]} />
            </ReadingFlow>
          ) : null}
          <Link href="/week" className={"pill-link" + (left.length === 1 && left[0].goal.ref ? "" : " pill-link--primary")}>
            Open the week
          </Link>
        </div>
      </div>
      <TodayFigures tracker={tracker} />
    </section>
  );
}

/** The one thing that would finish the week, one tap away: pages, a session, the workout. */
function FinishAction({ tracker, p }: { tracker: Tracker; p: GoalProgress }) {
  const flow = useFlow();
  const { pending, run } = usePending();
  const r = p.goal.ref!;
  if (r.kind === "book")
    return (
      <button type="button" className="pill-link pill-link--primary" onClick={() => flow.open({ kind: "log", bookId: r.id })}>
        Log pages
      </button>
    );
  if (r.kind === "workout")
    return (
      <Link href={`/fitness?view=workout&id=${r.id}`} className="pill-link pill-link--primary">
        Start workout
      </Link>
    );
  return (
    <button type="button" className="pill-link pill-link--primary" disabled={pending} onClick={() => void run(() => tracker.logSession(r.id))}>
      Log a session
    </button>
  );
}

/**
 * Day one, with nothing yet: what a day plan is, five empty numbered tiles
 * and the one way in.
 */
export function PlanWelcome() {
  return (
    <section className="momentum plan-card plan-welcome" aria-label="Day plan">
      <div className="momentum__top">
        <div>
          <p className="eyebrow">Day plan</p>
          <p className="momentum__start">
            Plan your workday,
            <br />
            once.
          </p>
          <p className="momentum__detail">
            The same steps every workday, in order. Read, gym, a video: each can be one thing, or a different one each day.
          </p>
        </div>
        <ol className="plan-card__tiles" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }} aria-hidden>
          {[1, 2, 3, 4, 5].map((n) => (
            <li key={n} className="plan-card__cell">
              <span className={"plan-welcome__ghost" + (n === 1 ? " is-next" : "")}>{n}</span>
            </li>
          ))}
        </ol>
        <div className="plan-card__actions">
          <Link href="/plan" className="pill-link pill-link--primary">
            Make a plan
          </Link>
        </div>
      </div>
    </section>
  );
}
