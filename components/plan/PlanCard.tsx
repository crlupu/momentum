"use client";

import Link from "next/link";
import { Tracker, dateKey } from "@/lib/tracker";
import { useEffect, useMemo, useState } from "react";
import {
  WEEKDAY_LONG,
  focusElapsed,
  focusMinutes,
  hours,
  stepsOn,
  weekOf,
  weekdayOf,
  type DayPlan,
} from "@/lib/plan";
import { columnCards } from "@/lib/projects";
import { Button } from "../ui";
import { CardMeter, SummaryCard, TILE_COLUMNS } from "../SummaryCard";
import { usePending } from "../ActionButton";
import { Check } from "../icons";
import { useShell } from "../AppShell";
import { chain, dayRun, history, longestRun, type ChainDay } from "@/lib/habits";
import { fmtDate } from "@/lib/dates";

/**
 * Today's card when there is a day plan, read as habits: how many of today's
 * are kept and which is next, the last four weeks as a chain (every habit
 * kept, some, none, rest days apart, today ringed), and two runs: plan days
 * in a row with a habit kept, and the longest run one habit has going. On a
 * day the plan doesn't run, the same card says it's a rest day.
 */
export function PlanCard({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const s = tracker.state!;
  const today = dateKey();
  const steps = stepsOn(s, plan, today);
  const h = useMemo(() => history(s, plan, today), [s, plan, today]);
  const days = useMemo(() => chain(s, plan, today), [s, plan, today]);
  const n = steps.length;
  const done = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);
  const allDone = n > 0 && !next;
  const run = dayRun(h);
  const best = longestRun(h, plan);

  if (s.activeFocus) return <FocusCard tracker={tracker} plan={plan} />;

  return (
    <section className={"momentum plan-card habit-card" + (allDone ? " momentum--done" : "")} aria-label="Today's habits">
      <div className="momentum__top">
        <div className="momentum__head">
          <p className="eyebrow">{n ? "Today" : "Rest day"}</p>
          {allDone ? (
            <span className="momentum__badge">
              <Check aria-hidden />
              All kept
            </span>
          ) : next ? (
            <span className="plan-card__next">
              Next: <span className="momentum__next-name">{next.name}</span>
            </span>
          ) : null}
        </div>
        <p className="momentum__count">
          {n ? (
            <>
              <span className="font-mono-n momentum__headline">{`${done} of ${n}`}</span>
              <span className="momentum__detail">habits</span>
            </>
          ) : (
            <span className="momentum__detail habit-card__rest">Nothing on today. A rest day never breaks a run.</span>
          )}
        </p>
        <HabitChain days={days} today={today} />
      </div>
      <div className="habit-card__figures">
        <div className="habit-card__figure">
          <span className="habit-card__value">{run} {run === 1 ? "day" : "days"}</span>
          <span className="habit-card__label">with a habit kept, in a row</span>
        </div>
        <div className="habit-card__figure">
          <span className="habit-card__value">{best ? `${best.days} ${best.days === 1 ? "day" : "days"}` : "None yet"}</span>
          <span className="habit-card__label">{best ? `longest run going, ${best.name}` : "longest run going"}</span>
        </div>
      </div>
    </section>
  );
}

const CHAIN_WORD: Record<ChainDay["state"], string> = {
  all: "every habit kept",
  some: "some habits kept",
  none: "none kept",
  rest: "rest day",
  future: "still to come",
};

/** Four weeks, Monday to Sunday, a square a day: white all kept, grey some, faint none; rest days outlined. */
function HabitChain({ days, today }: { days: ChainDay[]; today: string }) {
  return (
    <div className="habit-chain">
      <div className="habit-chain__grid" role="img" aria-label={chainLabel(days)}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="habit-chain__head" aria-hidden>
            {d}
          </span>
        ))}
        {days.map((d) => (
          <span
            key={d.day}
            className={"habit-chain__day is-" + d.state + (d.day === today ? " is-today" : "")}
            title={`${fmtDate(d.day)}: ${CHAIN_WORD[d.state]}${d.total ? `, ${d.done} of ${d.total}` : ""}`}
          />
        ))}
      </div>
      <div className="habit-chain__key" aria-hidden>
        <span><i className="is-all" />All kept</span>
        <span><i className="is-some" />Some</span>
        <span><i className="is-none" />None</span>
        <span><i className="is-rest" />Rest</span>
      </div>
    </div>
  );
}

function chainLabel(days: ChainDay[]): string {
  const past = days.filter((d) => d.state !== "future" && d.state !== "rest");
  const all = past.filter((d) => d.state === "all").length;
  const some = past.filter((d) => d.state === "some").length;
  return `Last four weeks: ${all} days with every habit kept, ${some} with some, of ${past.length} plan days.`;
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
      label={`Focus: ${project?.title ?? "Just focus"}`}
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
          {/* One word: Pause, white while paused; tapped again, it carries on. */}
          <button
            type="button"
            className="hero__ghost flex-1"
            aria-pressed={!!f.pausedAt}
            disabled={pending}
            onClick={() => void run(() => (f.pausedAt ? tracker.resumeFocus() : tracker.pauseFocus()))}
          >
            Pause
          </button>
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
