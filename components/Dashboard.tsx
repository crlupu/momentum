"use client";

import {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Tracker, dateKey, todoDueBy } from "@/lib/tracker";
import {
  planOf,
  stepsOn,
  weekdayOf,
  WEEKDAY,
  WEEKDAY_LONG,
  addDays,
  refTitle,
  weekOf,
  weekStatus,
  leftovers,
  leftoverDays,
  type DayPlan,
  type PlanIcon,
} from "@/lib/plan";
import { dayRun, history, runWords, stepRun } from "@/lib/habits";
import { validPlan } from "@/lib/weight";
import {
  MEASURES,
  monthName,
  monthOf,
  lastTwo,
  cmText,
} from "@/lib/measurements";
import {
  caloriesWeek,
  weightWeek,
  compare,
  focusWeek,
  learningWeek,
  pctText,
  topicsWeek,
  liftedWeek,
  pagesWeek,
  proteinWeek,
  todayIndex,
  todosWeek,
  workoutsWeek,
} from "@/lib/weekStats";
import { usePending } from "./ActionButton";
import { PlanGlyph, toneOf } from "./plan/bits";
import { FocusCard, PlanWelcome } from "./plan/PlanCard";
import { Check, ChevronDown, ChevronRight } from "./icons";
import type { Tone } from "./sections";

/**
 * Today as a dashboard: the routine on top, its habits as a track across
 * the card that fills as they're kept, Done for the next one and Open for
 * the whole list; then a tile per page, two to a row, each with its one
 * figure and the line that explains it. A tile opens its page.
 */
export function Dashboard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const plan = planOf(s);
  const planned = plan && plan.steps.length > 0 ? plan : null;
  const steps = planned ? stepsOn(s, planned, today) : [];
  return (
    <div className="dashboard">
      <div className="dashboard__routine">
        <RoutineHero tracker={tracker} />
      </div>
      {/* On an iPad the day's habits stand beside the tiles, always open. */}
      {planned && steps.length > 0 && (
        <section className="dashboard__habits" aria-label="Today's habits">
          <div className="panel-head">
            <h2 className="panel-head__title">Today&rsquo;s habits</h2>
            <div className="panel-head__side">
              <Link href="/plan" className="text-action">
                Edit plan
              </Link>
            </div>
          </div>
          <HabitList tracker={tracker} plan={planned} />
        </section>
      )}
      <div className="dash-tiles">
        {planned && <WeekTile tracker={tracker} plan={planned} />}
        <WorkoutsTile tracker={tracker} />
        <LiftedTile tracker={tracker} />
        <LearningTile tracker={tracker} />
        <WeightTile tracker={tracker} />
        <ReadTile tracker={tracker} />
        <KcalTodayTile tracker={tracker} />
        <KcalAverageTile tracker={tracker} />
        <CaloriesTile tracker={tracker} />
        <FocusTile tracker={tracker} />
        <ProteinTile tracker={tracker} />
        <TodosTile tracker={tracker} />
        {s && <MeasurementsTile tracker={tracker} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- routine */

/** The activity alone: "Course · Module" reads as the course. */
const activityName = (t: string) => t.split(" · ")[0].trim() || t;

/**
 * Today's habits as rows: what's left first in the plan's order, kept ones
 * after, muted. Each has what it is today and its run, and a tick; the name
 * goes to the Routine page, where each opens into its actions. `onTicked`
 * runs after a tick lands (the phone's card closes itself then).
 */
function HabitList({
  tracker,
  plan,
  onTicked,
}: {
  tracker: Tracker;
  plan: DayPlan;
  onTicked?: (stepId: string) => void;
}) {
  const s = tracker.state!;
  const today = dateKey();
  const steps = stepsOn(s, plan, today).sort(
    (a, b) => Number(a.done) - Number(b.done),
  );
  const h = useMemo(() => history(s, plan, today), [s, plan, today]);
  const { pending, run } = usePending();
  return (
    <ul className="habit-list">
      {steps.map((x) => {
        const streak = stepRun(h, x.step.id);
        const what = refTitle(s, x.ref);
        return (
          <li
            key={x.step.id}
            className={"habit-list__row" + (x.done ? " is-done" : "")}
          >
            <Link href="/routine" className="habit-list__open">
              <span
                className={`habit-list__tile tone-${toneOf(x.icon)}`}
                aria-hidden
              >
                <PlanGlyph icon={x.icon} />
              </span>
              <span className="habit-list__text">
                <span className="habit-list__name">{x.name}</span>
                <span className="habit-list__sub">
                  {[
                    what ? activityName(what) : null,
                    streak > 0 ? runWords(streak) : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </span>
            </Link>
            <button
              type="button"
              role="checkbox"
              aria-checked={x.done}
              aria-label={`${x.name}, done today`}
              className={"check" + (x.done ? " check--on" : "")}
              disabled={pending}
              onClick={() =>
                void run(async () => {
                  const ok = await tracker.togglePlanStep(today, x.step.id);
                  if (!x.done) onTicked?.(x.step.id);
                  return ok;
                })
              }
            >
              <span className="check__ring">
                {x.done && <Check className="h-4 w-4" aria-hidden />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The routine: today's count and run, and the habits as round icons of one
 * size on a track that fills from the left as they're kept, the next one's
 * icon brighter. On a phone the track opens into today's habits; ticking one
 * closes it again, the new tick glowing for a moment on the track.
 */
function RoutineHero({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const plan = planOf(s);
  const planned = plan && plan.steps.length > 0 ? plan : null;
  const steps = planned ? stepsOn(s, planned, today) : [];
  const h = useMemo(
    () => (planned ? history(s, planned, today) : []),
    [s, planned, today],
  );
  const [open, setOpen] = useState(false);
  const [glow, setGlow] = useState<string | null>(null);
  // Each habit's place on the track, so a re-order glides instead of jumping.
  const slots = useRef(new Map<string, HTMLSpanElement>());
  const places = useRef(new Map<string, number>());
  // Habits kept since the last render: only these get the tick's pop.
  const keptBefore = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!glow) return;
    const id = window.setTimeout(() => setGlow(null), 1400);
    return () => window.clearTimeout(id);
  }, [glow]);
  const trackKey = steps.map((x) => `${x.step.id}:${x.done ? 1 : 0}`).join(",");
  useLayoutEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    slots.current.forEach((el, id) => {
      const left = el.offsetLeft;
      next.set(id, left);
      const was = places.current.get(id);
      if (reduce || was == null || was === left) return;
      el.animate(
        [
          { transform: `translateX(${was - left}px)` },
          { transform: "translateX(0)" },
        ],
        {
          duration: 520,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });
    places.current = next;
    // A habit just kept: its tick pops in.
    const kept = new Set(steps.filter((x) => x.done).map((x) => x.step.id));
    if (keptBefore.current && !reduce)
      kept.forEach((id) => {
        if (keptBefore.current!.has(id)) return;
        slots.current
          .get(id)
          ?.querySelector("svg")
          ?.animate(
            [
              { opacity: 0, transform: "scale(0.4)" },
              { opacity: 1, transform: "scale(1)" },
            ],
            { duration: 360, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
          );
      });
    keptBefore.current = kept;
  }, [trackKey]);
  if (s.activeFocus) return <FocusCard tracker={tracker} plan={planned} />;
  if (!planned) return <PlanWelcome />;

  const n = steps.length;
  const done = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);
  const streak = dayRun(h);
  let nextDay = addDays(today, 1);
  for (let i = 0; i < 7 && !planned.days.includes(weekdayOf(nextDay)); i++)
    nextDay = addDays(nextDay, 1);
  // Kept on the left, under the fill; what's left after, in the plan's order.
  const ordered = [...steps].sort((p, q) => Number(q.done) - Number(p.done));

  return (
    <section
      className={"momentum dash-routine" + (open ? " is-open" : "")}
      aria-label="Routine"
    >
      <div className="momentum__head">
        <p className="eyebrow">{n ? "Routine" : "Rest day"}</p>
        {next ? (
          <span className="plan-card__next">
            Next: <span className="momentum__next-name">{next.name}</span>
          </span>
        ) : n ? (
          <span className="momentum__badge">
            <Check aria-hidden />
            All kept
          </span>
        ) : (
          <Link href="/routine" className="plan-card__next">
            Routine
          </Link>
        )}
      </div>
      <p className="momentum__count">
        {n ? (
          <>
            <span className="font-mono-n momentum__headline">{`${done} of ${n}`}</span>
            <span className="momentum__detail">
              habits
              {streak > 0
                ? `, ${streak} day${streak === 1 ? "" : "s"} in a row`
                : ""}
            </span>
          </>
        ) : (
          <span className="momentum__detail habit-card__rest">
            Back on {WEEKDAY_LONG[weekdayOf(nextDay)]}. A rest day never breaks
            a run.
          </span>
        )}
      </p>
      {n > 0 && (
        <button
          type="button"
          className="habit-track"
          aria-expanded={open}
          aria-label={`${done} of ${n} habits kept. ${open ? "Hide" : "Show"} today's habits`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="habit-track__rail">
            <span
              className="habit-track__fill"
              style={{ inlineSize: `${(done / n) * 100}%` }}
              aria-hidden
            />
            {ordered.map((x) => (
              <span
                key={x.step.id}
                ref={(el) => {
                  if (el) slots.current.set(x.step.id, el);
                  else slots.current.delete(x.step.id);
                }}
                className="habit-track__slot"
                title={x.name}
                aria-hidden
              >
                <span
                  className={
                    "habit-track__dot" +
                    (x.done ? " is-done" : x === next ? " is-next" : "") +
                    (glow === x.step.id ? " is-glow" : "")
                  }
                >
                  {x.done ? <Check /> : <PlanGlyph icon={x.icon} />}
                </span>
              </span>
            ))}
          </span>
          <ChevronDown className="habit-track__chev" aria-hidden />
        </button>
      )}
      <LeftoverFold tracker={tracker} plan={planned} />
      {open && n > 0 && (
        <div className="dash-routine__list">
          <HabitList
            tracker={tracker}
            plan={planned}
            onTicked={(id) => {
              setOpen(false);
              setGlow(id);
            }}
          />
        </div>
      )}
    </section>
  );
}

/**
 * What's left from this week's earlier plan days, folded to one line under
 * the track: opened, a row each with its day and a tick that marks it kept
 * on that day, so it leaves the list. Gone when nothing's left.
 */
function LeftoverFold({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const s = tracker.state!;
  const list = leftovers(s, plan);
  const [open, setOpen] = useState(false);
  const { pending, run } = usePending();
  if (!list.length) return null;
  const ordered = [...list].sort((a, b) => a.day.localeCompare(b.day));
  return (
    <div className={"dash-left" + (open ? " is-open" : "")}>
      <button
        type="button"
        className="dash-left__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dash-left__count font-mono-n">{list.length}</span>
        <span className="dash-left__text">
          left from earlier{" "}
          <span className="dash-left__days">
            {leftoverDays(list.map((l) => l.day))}
          </span>
        </span>
        <ChevronDown className="dash-left__chev" aria-hidden />
      </button>
      {open && (
        <ul className="habit-list dash-left__list">
          {ordered.map((l) => {
            const what = refTitle(s, l.x.ref);
            const dayName = WEEKDAY[weekdayOf(l.day)];
            return (
              <li key={l.day + l.x.step.id} className="habit-list__row">
                <span className="dash-left__day">{dayName}</span>
                <Link href="/routine#leftovers" className="habit-list__open">
                  <span
                    className={`habit-list__tile tone-${toneOf(l.x.icon)}`}
                    aria-hidden
                  >
                    <PlanGlyph icon={l.x.icon} />
                  </span>
                  <span className="habit-list__text">
                    <span className="habit-list__name">{l.x.name}</span>
                    {what && (
                      <span className="habit-list__sub">
                        {activityName(what)}
                      </span>
                    )}
                  </span>
                </Link>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  aria-label={`${l.x.name}, done on ${WEEKDAY_LONG[weekdayOf(l.day)]}`}
                  className="check"
                  disabled={pending}
                  onClick={() =>
                    void run(() => tracker.togglePlanStep(l.day, l.x.step.id))
                  }
                >
                  <span className="check__ring" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- tiles */

/** A change from last week: green when it's the way you want, red when not, grey when neither. */
type Delta = { text: string; up: boolean; good: boolean | null };

function DeltaChip({ d }: { d: Delta }) {
  return (
    <span className={"dash-delta" + (d.good == null ? "" : d.good ? " is-good" : " is-bad")}>
      <span aria-hidden>{d.up ? "\u2191" : "\u2193"}</span>
      <span className="sr-only">{d.up ? "up" : "down"} </span>
      {d.text}
      <span className="sr-only"> on last week</span>
    </span>
  );
}

/** Monday to today, as the tiles say it: "Mon–Thu", or "Mon" on a Monday. */
function soFar(): string {
  const t = todayIndex();
  return t === 0 ? "Mon" : `Mon\u2013${WEEKDAY[weekdayOf(dateKey())]}`;
}

/**
 * The change from last week as a percentage chip. `want` says which way is
 * good; null when neither is.
 */
function change(now: number, before: number, want: "up" | "down" | null): Delta | undefined {
  if (!before || !now || now === before) return undefined;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return undefined;
  const up = pct > 0;
  return { text: `${Math.abs(pct)}%`, up, good: want == null ? null : up === (want === "up") };
}

/** Whether the weight plan is to lose: less is good. Null without a plan. */
function losing(s: NonNullable<Tracker["state"]>): boolean | null {
  const plan = validPlan(s.weightPlan);
  const last = s.weights[s.weights.length - 1];
  if (!plan) return null;
  return plan.targetKg < (last?.kg ?? plan.startKg);
}

function Tile({
  href,
  icon,
  label,
  figure,
  unit,
  line,
  badge,
  wide,
  fill,
  tone,
  delta,
  figureNote,
  beside,
  children,
}: {
  /** The last tile of an odd row: spans the row while tiles go two across. */
  fill?: boolean;
  /** The area's colour: its icon chip, label, bars and badge. */
  tone?: Tone;
  href: string;
  icon: ReactNode;
  label: string;
  figure: ReactNode;
  unit?: string;
  line?: ReactNode;
  badge?: string;
  /** The change from last week, in the badge's place. */
  delta?: Delta;
  /** Under the figure: what it covers, "Mon–Thu". */
  figureNote?: string;
  /** Last week's figure, small beside this week's. */
  beside?: { value: ReactNode; label: string };
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "dash-tile" +
        (wide ? " is-wide" : "") +
        (fill ? " is-fill" : "") +
        (tone ? ` tone-${tone}` : "")
      }
    >
      <span className="dash-tile__head">
        <span className="dash-tile__label">
          <span className="dash-tile__icon" aria-hidden>
            {icon}
          </span>
          {label}
        </span>
        {delta ? (
          <DeltaChip d={delta} />
        ) : badge ? (
          <span className="dash-tile__badge">{badge}</span>
        ) : (
          <ChevronRight className="dash-tile__chev" aria-hidden />
        )}
      </span>
      {beside ? (
        <span className="dash-pair">
          <span className="dash-pair__now">
            <span className="dash-tile__figure">
              <span className="dash-tile__value">{figure}</span>
              {unit && <span className="dash-tile__unit">{unit}</span>}
            </span>
            {figureNote && <span className="dash-pair__note">{figureNote}</span>}
          </span>
          <span className="dash-pair__before">
            <span className="dash-pair__value">{beside.value}</span>
            <span className="dash-pair__note">{beside.label}</span>
          </span>
        </span>
      ) : (
        <span className="dash-tile__figure">
          <span className="dash-tile__value">{figure}</span>
          {unit && <span className="dash-tile__unit">{unit}</span>}
        </span>
      )}
      {line && <span className="dash-tile__line">{line}</span>}
      {children}
    </Link>
  );
}

/**
 * This week, a line per plan day: a segment per habit, white where it was
 * kept, and the day's count at the end; today's name bright. Opens the Week page.
 */
function WeekTile({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const s = tracker.state!;
  const today = dateKey();
  const days = weekStatus(s, plan, weekOf(today));
  const planned = days.filter((d) => d.planned);
  const now = days.find((d) => d.day === today);
  const short = (d: string) => WEEKDAY[weekdayOf(d)];
  return (
    <Link href="/week" className="dash-tile is-wide dash-week tone-habit">
      <span className="dash-tile__head">
        <span className="dash-tile__label">
          <span className="dash-tile__icon" aria-hidden>
            <PlanGlyph icon="task" />
          </span>
          This week
        </span>
        <span className="dash-week__today">
          {now?.planned
            ? `${short(today)}, ${now.done} of ${now.total}`
            : "Rest day"}
        </span>
      </span>
      <ol className="dash-week__days">
        {planned.map((d) => (
          <li
            key={d.day}
            className={
              "dash-week__day" +
              (d.day === today ? " is-today" : "") +
              (d.day > today ? " is-ahead" : "")
            }
          >
            <span className="dash-week__name">{short(d.day)}</span>
            <span className="dash-week__segs" aria-hidden>
              {Array.from({ length: d.total }, (_, k) => (
                <span
                  key={k}
                  className={"dash-week__seg" + (k < d.done ? " is-done" : "")}
                />
              ))}
            </span>
            <span className="dash-week__count">
              {d.done}/{d.total}
              <span className="sr-only"> habits kept</span>
            </span>
          </li>
        ))}
      </ol>
    </Link>
  );
}

/* ------------------------------------------------- this week's numbers */

/** Monday to Sunday as small bars: days so far bright, today's letter bright, days ahead faint. */
function DayBars({ days, label, avg }: { days: number[]; label: string; /** Drawn as a dashed line across the bars. */ avg?: number }) {
  const t = todayIndex();
  const hi = Math.max(1, ...days);
  return (
    <span className="day-mini" role="img" aria-label={label}>
      <span className="day-mini__bars">
        {days.map((v, i) => (
          <span
            key={i}
            className={
              "day-mini__bar" +
              (i <= t && v > 0 ? " is-on" : "") +
              (i === t ? " is-today" : "")
            }
            style={{
              blockSize: `${v > 0 ? Math.max(12, (v / hi) * 100) : 10}%`,
            }}
          />
        ))}
        {avg ? <span className="day-mini__avg" style={{ insetBlockEnd: `${Math.min(100, (avg / hi) * 100)}%` }} aria-hidden /> : null}
      </span>
      <span className="day-mini__days" aria-hidden>
        {"MTWTFSS".split("").map((d, i) => (
          <span key={i} className={i === t ? "is-today" : undefined}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

function WorkoutsTile({ tracker }: { tracker: Tracker }) {
  const w = workoutsWeek(tracker.state!);
  return (
    <Tile
      tone="fit"
      href="/fitness?view=training"
      icon={<PlanGlyph icon="gym" />}
      label="Workouts"
      figure={w.total}
      unit="this week"
      line={compare(w.total, w.before)}
    >
      <DayBars days={w.days} label={`Workouts by day: ${w.days.join(", ")}`} />
    </Tile>
  );
}

function LiftedTile({ tracker }: { tracker: Tracker }) {
  const w = liftedWeek(tracker.state!);
  return (
    <Tile
      tone="fit"
      href="/fitness?view=training"
      icon={<PlanGlyph icon="gym" />}
      label="Lifted"
      figure={Math.round(w.total).toLocaleString()}
      unit="kg"
      line={compare(w.total, w.before, true)}
    >
      <DayBars
        days={w.days}
        label={`Kilograms lifted by day: ${w.days.map((v) => Math.round(v)).join(", ")}`}
      />
    </Tile>
  );
}

/**
 * Learning as percentages: how far all topics moved this week, then a row
 * per topic that moved, its bar grey up to where it stood on Monday and
 * blue for this week's part; under them, all topics together.
 */
function LearningTile({ tracker }: { tracker: Tracker }) {
  const t = topicsWeek(tracker.state!);
  const l = learningWeek(tracker.state!);
  const moved = t.moved.slice(0, 3);
  return (
    <Tile
      tone="learn"
      href="/education"
      icon={<PlanGlyph icon="learn" />}
      label="Learning"
      wide
      figure={
        t.all.gain > 0
          ? `+${pctText(t.all.gain)}`
          : moved.length
            ? `${l.total}`
            : pctText(t.all.pct)
      }
      unit={
        t.all.gain > 0
          ? "on your topics this week"
          : moved.length
            ? l.total === 1
              ? "step this week"
              : "steps this week"
            : "of your topics done"
      }
      line={moved.length ? undefined : compare(l.total, l.before)}
    >
      {moved.length > 0 && (
        <span className="dash-learn">
          {moved.map((m) => (
            <span key={m.id} className="dash-learn__topic">
              <span className="dash-learn__row">
                <span className="dash-learn__title">{m.title}</span>
                <span className="dash-learn__gain">+{pctText(m.gain)}</span>
                <span className="dash-learn__pct">{pctText(m.pct)}</span>
              </span>
              <span className="dash-learn__bar" aria-hidden>
                <span
                  className="dash-learn__was"
                  style={{ inlineSize: `${Math.max(0, m.pct - m.gain)}%` }}
                />
                <span
                  className="dash-learn__new"
                  style={{ inlineSize: `${Math.max(1.5, m.gain)}%` }}
                />
              </span>
            </span>
          ))}
          {tracker.state!.paths.length > 0 && (
            <span className="dash-learn__all">
              <span>All topics</span>
              <span className="dash-learn__all-n">
                {pctText(t.all.pct)} done
              </span>
            </span>
          )}
        </span>
      )}
    </Tile>
  );
}

/** Pages read, Monday to today, against the same days last week. */
function ReadTile({ tracker }: { tracker: Tracker }) {
  const w = pagesWeek(tracker.state!);
  return (
    <Tile
      tone="read"
      href="/education"
      icon={<PlanGlyph icon="book" />}
      label="Read"
      figure={w.total}
      unit="pages"
      figureNote={soFar()}
      beside={{ value: w.before, label: "last week" }}
      delta={change(w.total, w.before, "up")}
    />
  );
}

function FocusTile({ tracker }: { tracker: Tracker }) {
  const w = focusWeek(tracker.state!);
  const h = Math.round((w.total / 60) * 10) / 10;
  return (
    <Tile
      tone="focus"
      href="/progress"
      icon={<PlanGlyph icon="target" />}
      label="Focus"
      figure={h}
      unit="h this week"
      line={`${w.sessions} session${w.sessions === 1 ? "" : "s"}`}
    >
      <DayBars
        days={w.days}
        label={`Focus minutes by day: ${w.days.join(", ")}`}
      />
    </Tile>
  );
}

/** Calories eaten today: what's left of the budget, and a meter filling toward it. */
function KcalTodayTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const w = caloriesWeek(s);
  const today = w.days[todayIndex()] ?? 0;
  const budget = s.calorieBudget;
  const left = budget ? budget - today : 0;
  return (
    <Tile
      tone="food"
      href="/nutrition"
      icon={<PlanGlyph icon="target" />}
      label="Eaten today"
      figure={today.toLocaleString()}
      unit="kcal"
      line={
        budget
          ? left >= 0
            ? `${left.toLocaleString()} left of ${budget.toLocaleString()}`
            : `${(-left).toLocaleString()} over ${budget.toLocaleString()}`
          : today
            ? "No budget set"
            : "Nothing logged yet"
      }
    >
      {budget ? (
        <span className="dash-tile__meter" aria-hidden>
          <span style={{ inlineSize: `${Math.min(100, (today / budget) * 100)}%` }} />
        </span>
      ) : null}
    </Tile>
  );
}

/** This week's calories a day, over the days logged, with a bar per day and the average dashed across them. */
function KcalAverageTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const w = caloriesWeek(s);
  return (
    <Tile
      tone="food"
      href="/nutrition"
      icon={<PlanGlyph icon="target" />}
      label="Daily average"
      figure={w.avg ? w.avg.toLocaleString() : "–"}
      unit="kcal"
      line={
        s.calorieBudget
          ? `${soFar()}, budget ${s.calorieBudget.toLocaleString()}`
          : `${w.logged} day${w.logged === 1 ? "" : "s"} logged`
      }
    >
      <DayBars days={w.days} avg={w.avg} label={`Calories by day: ${w.days.join(", ")}; average ${w.avg}`} />
    </Tile>
  );
}

/** Calories eaten, Monday to today, against last week by the same day. */
function CaloriesTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const w = caloriesWeek(s);
  const day = WEEKDAY[weekdayOf(dateKey())];
  const diff = w.total - w.before;
  return (
    <Tile
      tone="food"
      wide
      href="/nutrition"
      icon={<PlanGlyph icon="target" />}
      label="Calories so far"
      figure={w.total ? w.total.toLocaleString() : "–"}
      unit="kcal"
      figureNote={soFar()}
      beside={{ value: w.before ? w.before.toLocaleString() : "–", label: "last week" }}
      delta={change(w.total, w.before, losing(s) ? "down" : null)}
      line={
        w.total && w.before && diff !== 0
          ? `${Math.abs(diff).toLocaleString()} ${diff < 0 ? "fewer" : "more"} than by ${day} last week`
          : undefined
      }
    />
  );
}

function ProteinTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const p = proteinWeek(s);
  return s.proteinTarget ? (
    <Tile
      tone="food"
      href="/nutrition"
      icon={<PlanGlyph icon="target" />}
      label="Protein"
      figure={p.hit}
      unit={`of ${p.logged} day${p.logged === 1 ? "" : "s"}`}
      line={`at ${s.proteinTarget} g, ${p.avg} g avg`}
    />
  ) : (
    <Tile
      tone="food"
      href="/nutrition"
      icon={<PlanGlyph icon="target" />}
      label="Protein"
      figure={p.avg}
      unit="g avg a day"
      line={`${p.logged} day${p.logged === 1 ? "" : "s"} logged`}
    />
  );
}

function TodosTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const open = s.todos.filter((t) => !t.done && todoDueBy(t, today));
  const w = todosWeek(s);
  return (
    <Tile
      tone="todo"
      href="/todos"
      icon={<PlanGlyph icon="task" />}
      label="To-dos"
      figure={w.done}
      unit="done this week"
      line={open.length ? `${open.length} for today` : "Nothing due today"}
    />
  );
}

/** The median weigh-in this week against last week's. */
function WeightTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const w = weightWeek(s);
  const d = w.now != null && w.before != null ? Math.round((w.now - w.before) * 10) / 10 : null;
  return (
    <Tile
      tone="body"
      href="/fitness?view=weight"
      icon={<PlanGlyph icon="target" />}
      label="Weight"
      figure={w.now != null ? w.now.toFixed(1) : "–"}
      unit="kg"
      figureNote={w.n ? (w.n === 1 ? "1 weigh-in" : `median of ${w.n}`) : "none yet"}
      beside={{ value: w.before != null ? w.before.toFixed(1) : "–", label: "last week" }}
      delta={
        d == null
          ? undefined
          : { text: d === 0 ? "±0 kg" : `${Math.abs(d).toFixed(1)} kg`, up: d > 0, good: d === 0 ? null : losing(s) == null ? null : (d < 0) === losing(s) }
      }
    />
  );
}

function MeasurementsTile({ tracker }: { tracker: Tracker }) {
  const list = tracker.state!.measurements ?? [];
  const today = dateKey();
  const month = monthOf(today);
  const due = !list.some((m) => m.month === month);
  const lead = MEASURES.find((k) => lastTwo(list, k).now);
  const now = lead ? lastTwo(list, lead).now : undefined;
  return (
    <Tile
      tone="body"
      href="/fitness?view=measurements"
      icon={<PlanGlyph icon="target" />}
      label="Measurements"
      figure={now ? cmText(now.v) : "–"}
      unit={now ? `cm ${lead}` : undefined}
      line={
        due
          ? `Log ${monthName(month, today)}`
          : `${monthName(month, today)} logged`
      }
      badge={due ? "Due" : undefined}
    />
  );
}
