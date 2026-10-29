"use client";

import Link from "next/link";
import { Tracker, dateKey } from "@/lib/tracker";
import { useEffect, useState } from "react";
import {
  WEEKDAY_LONG,
  focusElapsed,
  focusMinutes,
  hours,
  leftoverDays,
  leftovers,
  stepsOn,
  summarizeWeek,
  weekNumber,
  weekOf,
  weekdayOf,
  type DayPlan,
  type GoalProgress,
} from "@/lib/plan";
import { columnCards } from "@/lib/projects";
import { Button } from "../ui";
import { CardMeter, SummaryCard, TILE_COLUMNS } from "../SummaryCard";
import { usePending } from "../ActionButton";
import { ReadingFlow } from "../books/flow";
import { useFlow } from "../books/flowContext";
import { Check, ChevronRight } from "../icons";
import { TodayFigures } from "../MomentumCard";
import { useShell } from "../AppShell";
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
  // Tiles are Today's size on every card: eight to a line, more only past eight.
  const cols = Math.max(n, TILE_COLUMNS);
  const left = leftovers(s, plan, today);
  const hasFocus = plan.steps.some((st) => (st.same ? [st.pick] : Object.values(st.byDay ?? {})).some((r) => r?.kind === "focus"));

  if (s.activeFocus) return <FocusCard tracker={tracker} plan={plan} />;
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
              Next · <span className="momentum__next-name">{next!.name}</span>
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
        {/* One row, the list below names them; past eight they shrink to fit. */}
        <ol className={"plan-card__tiles" + (cols > TILE_COLUMNS ? " is-compact" : "")} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, var(--tile-max)))` }}>
          {steps.map((x) => (
            <li key={x.step.id} className="plan-card__cell" title={x.name}>
              <span className={"momentum__tile" + (x.done ? " is-done" : x === next ? " is-next" : "")}>
                <PlanGlyph icon={x.icon} />
              </span>
              <span className="sr-only">
                {x.name}, {x.done ? "done" : "to do"}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {left.length > 0 ? (
        <a href="#leftovers" className="plan-card__week">
          <span className="plan-card__week-label">Earlier</span>
          <span className="plan-card__week-rings summary-card__band-text">
            {left.length} left from {leftoverDays(left.map((l) => l.day))}
          </span>
          <span className="plan-card__week-goals">
            Review
            <ChevronRight aria-hidden />
          </span>
        </a>
      ) : (
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
      )}
      <TodayFigures tracker={tracker} focus={hasFocus} />
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
        <ol className="plan-card__tiles" style={{ gridTemplateColumns: `repeat(${TILE_COLUMNS}, minmax(0, var(--tile-max)))` }} aria-hidden>
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

/** mm:ss, or h:mm:ss past the hour. */
function clock(ms: number): string {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

/**
 * While a focus block runs, Today's card is its timer, in the same anatomy:
 * the clock against the block's length, Pause and Finish, and Open for the
 * full screen once it's been tucked away. Finishing logs the
 * minutes; the step ticks itself once the block's time is in.
 */
export function FocusCard({ tracker, plan }: { tracker: Tracker; plan?: DayPlan | null }) {
  const s = tracker.state!;
  const f = s.activeFocus!;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (f.pausedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [f.pausedAt]);
  const { pending, run } = usePending();
  const { openFocus } = useShell();
  const ms = focusElapsed(f, now);
  const project = f.projectId ? s.projects.find((p) => p.id === f.projectId) : undefined;
  const doing = project ? columnCards(project, "doing")[0] : undefined;
  const today = dateKey();
  const steps = plan ? stepsOn(s, plan, f.day) : [];
  const at = steps.findIndex((x) => x.step.id === f.stepId);
  const weekMin = (s.focusSessions ?? []).filter((x) => x.date >= weekOf(today)).reduce((a, x) => a + x.minutes, 0);
  const running = Math.round(ms / 60000);

  return (
    <SummaryCard
      aria-label="Focus timer"
      label={`Focus · ${project?.title ?? "Just focus"}`}
      aside={f.pausedAt ? "Paused" : at >= 0 ? `Step ${at + 1} of ${steps.length}` : undefined}
      done={ms >= f.minutes * 60000}
      doneLabel="Time's in"
      figure={<span role="timer">{clock(ms)}</span>}
      detail={`of ${f.minutes} min`}
      line={doing ? `Doing: ${doing.title}` : f.day !== today ? `For ${WEEKDAY_LONG[weekdayOf(f.day)]}` : undefined}
      actions={
        <>
          <button type="button" className="hero__ghost" onClick={openFocus}>
            Open
          </button>
          {f.pausedAt ? (
            <button type="button" className="hero__ghost flex-1" disabled={pending} onClick={() => void run(() => tracker.resumeFocus())}>
              Resume
            </button>
          ) : (
            <button type="button" className="hero__ghost flex-1" disabled={pending} onClick={() => void run(() => tracker.pauseFocus())}>
              Pause
            </button>
          )}
          <Button variant="primary" isDisabled={pending} onPress={() => void run(() => tracker.finishFocus())}>
            <Check aria-hidden /> Finish
          </Button>
        </>
      }
      band={{
        label: "Discard",
        content: "Stop without logging the time",
        action: "Discard",
        onPress: () => {
          if (window.confirm("Discard this focus block? Its time isn't logged.")) void tracker.cancelFocus();
        },
      }}
      figures={[
        { value: focusMinutes(s, today) + (f.day === today ? running : 0), label: "min today" },
        { value: hours(weekMin + running), label: "this week" },
        { value: (s.focusSessions ?? []).filter((x) => x.date === today).length, label: "sessions today" },
      ]}
    >
      <CardMeter value={ms / (f.minutes * 60000)} accent />
    </SummaryCard>
  );
}
