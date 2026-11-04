"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Tracker, dateKey, goalStatus, macroTotalsByDate, todoDueBy } from "@/lib/tracker";
import { planOf, stepsOn, weekdayOf, WEEKDAY, WEEKDAY_LONG, addDays, nextOfGoal, refTitle, weekOf, weekStatus, type DayPlan } from "@/lib/plan";
import { dayRun, history, runWords, stepRun } from "@/lib/habits";
import { routines } from "@/lib/routines";
import { columnCards } from "@/lib/projects";
import { addDays as addDaysW } from "@/lib/weight";
import { MEASURES, monthName, monthOf, lastTwo, cmText } from "@/lib/measurements";
import { usePending } from "./ActionButton";
import { PlanGlyph } from "./plan/bits";
import { FocusCard, PlanWelcome } from "./plan/PlanCard";
import { Check, ChevronDown, ChevronRight } from "./icons";

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
        <FitnessTile tracker={tracker} />
        <ProjectsTile tracker={tracker} />
        <NutritionTile tracker={tracker} />
        <WeightTile tracker={tracker} />
        <TodosTile tracker={tracker} />
        <EducationTile tracker={tracker} />
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
function HabitList({ tracker, plan, onTicked }: { tracker: Tracker; plan: DayPlan; onTicked?: (stepId: string) => void }) {
  const s = tracker.state!;
  const today = dateKey();
  const steps = stepsOn(s, plan, today).sort((a, b) => Number(a.done) - Number(b.done));
  const h = useMemo(() => history(s, plan, today), [s, plan, today]);
  const { pending, run } = usePending();
  return (
    <ul className="habit-list">
      {steps.map((x) => {
        const streak = stepRun(h, x.step.id);
        const what = refTitle(s, x.ref);
        return (
          <li key={x.step.id} className={"habit-list__row" + (x.done ? " is-done" : "")}>
            <Link href="/routine" className="habit-list__open">
              <span className="habit-list__tile" aria-hidden>
                <PlanGlyph icon={x.icon} />
              </span>
              <span className="habit-list__text">
                <span className="habit-list__name">{x.name}</span>
                <span className="habit-list__sub">
                  {[what ? activityName(what) : null, streak > 0 ? runWords(streak) : null].filter(Boolean).join(", ")}
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
              <span className="check__ring">{x.done && <Check className="h-4 w-4" aria-hidden />}</span>
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
  const h = useMemo(() => (planned ? history(s, planned, today) : []), [s, planned, today]);
  const [open, setOpen] = useState(false);
  const [glow, setGlow] = useState<string | null>(null);
  useEffect(() => {
    if (!glow) return;
    const id = window.setTimeout(() => setGlow(null), 1400);
    return () => window.clearTimeout(id);
  }, [glow]);
  if (s.activeFocus) return <FocusCard tracker={tracker} plan={planned} />;
  if (!planned) return <PlanWelcome />;

  const n = steps.length;
  const done = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);
  const streak = dayRun(h);
  let nextDay = addDays(today, 1);
  for (let i = 0; i < 7 && !planned.days.includes(weekdayOf(nextDay)); i++) nextDay = addDays(nextDay, 1);
  // Kept on the left, under the fill; what's left after, in the plan's order.
  const ordered = [...steps].sort((p, q) => Number(q.done) - Number(p.done));

  return (
    <section className={"momentum dash-routine" + (open ? " is-open" : "")} aria-label="Routine">
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
              habits{streak > 0 ? `, ${streak} day${streak === 1 ? "" : "s"} in a row` : ""}
            </span>
          </>
        ) : (
          <span className="momentum__detail habit-card__rest">Back on {WEEKDAY_LONG[weekdayOf(nextDay)]}. A rest day never breaks a run.</span>
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
            <span className="habit-track__fill" style={{ inlineSize: `${(done / n) * 100}%` }} aria-hidden />
            {ordered.map((x) => (
              <span key={x.step.id} className="habit-track__slot" title={x.name} aria-hidden>
                <span className={"habit-track__dot" + (x.done ? " is-done" : x === next ? " is-next" : "") + (glow === x.step.id ? " is-glow" : "")}>
                  {x.done ? <Check /> : <PlanGlyph icon={x.icon} />}
                </span>
              </span>
            ))}
          </span>
          <ChevronDown className="habit-track__chev" aria-hidden />
        </button>
      )}
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

/* --------------------------------------------------------------- tiles */

function Tile({
  href,
  icon,
  label,
  figure,
  unit,
  line,
  badge,
  wide,
  children,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  figure: ReactNode;
  unit?: string;
  line?: ReactNode;
  badge?: string;
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={"dash-tile" + (wide ? " is-wide" : "")}>
      <span className="dash-tile__head">
        <span className="dash-tile__label">
          <span className="dash-tile__icon" aria-hidden>
            {icon}
          </span>
          {label}
        </span>
        {badge ? <span className="dash-tile__badge">{badge}</span> : <ChevronRight className="dash-tile__chev" aria-hidden />}
      </span>
      <span className="dash-tile__figure">
        <span className="dash-tile__value">{figure}</span>
        {unit && <span className="dash-tile__unit">{unit}</span>}
      </span>
      {line && <span className="dash-tile__line">{line}</span>}
      {children}
    </Link>
  );
}

/**
 * This week, a line per plan day: a segment per habit, white where it was
 * kept, and the day's count at the end; today's name bright; days the plan
 * doesn't run named underneath as rest. Opens the Week page.
 */
function WeekTile({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const s = tracker.state!;
  const today = dateKey();
  const days = weekStatus(s, plan, weekOf(today));
  const planned = days.filter((d) => d.planned);
  const rest = days.filter((d) => !d.planned);
  const now = days.find((d) => d.day === today);
  const short = (d: string) => WEEKDAY[weekdayOf(d)];
  return (
    <Link href="/week" className="dash-tile is-wide dash-week">
      <span className="dash-tile__head">
        <span className="dash-tile__label">
          <span className="dash-tile__icon" aria-hidden>
            <PlanGlyph icon="task" />
          </span>
          This week
        </span>
        <span className="dash-week__today">{now?.planned ? `${short(today)}, ${now.done} of ${now.total}` : "Rest day"}</span>
      </span>
      <ol className="dash-week__days">
        {planned.map((d) => (
          <li key={d.day} className={"dash-week__day" + (d.day === today ? " is-today" : "") + (d.day > today ? " is-ahead" : "")}>
            <span className="dash-week__name">{short(d.day)}</span>
            <span className="dash-week__segs" aria-hidden>
              {Array.from({ length: d.total }, (_, k) => (
                <span key={k} className={"dash-week__seg" + (k < d.done ? " is-done" : "")} />
              ))}
            </span>
            <span className="dash-week__count">
              {d.done}/{d.total}
              <span className="sr-only"> habits kept</span>
            </span>
          </li>
        ))}
      </ol>
      {rest.length > 0 && <span className="dash-tile__line">{rest.map((d) => short(d.day)).join(", ")}: rest</span>}
    </Link>
  );
}

function EducationTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const active = s.goals.filter((g) => goalStatus(g) === "active");
  const withNext = active.map((g) => ({ g, nx: nextOfGoal(g) })).find((x) => x.nx?.itemId);
  const open = s.books.filter((b) => b.status === "active").length;
  const books = `${open} book${open === 1 ? "" : "s"} open`;
  return (
    <Tile
      href="/education"
      icon={<PlanGlyph icon="learn" />}
      label="Education"
      figure={withNext ? withNext.nx!.title : open ? books : "Nothing open"}
      line={withNext ? `${withNext.g.title.split(" · ")[0]}, ${books}` : `${active.length} goal${active.length === 1 ? "" : "s"} active`}
    />
  );
}

function FitnessTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  if (s.activeWorkout)
    return <Tile href="/fitness?view=live" icon={<PlanGlyph icon="gym" />} label="Fitness" figure={s.activeWorkout.name} line="In progress" badge="Now" />;
  const startable = s.workouts.filter((w) => w.exercises.length > 0);
  const lastDone = (id: string) => s.workoutSessions.filter((x) => x.workoutId === id).map((x) => x.date).sort().pop();
  const due = routines(s, today)
    .filter((r) => r.kind === "workout" && !r.done)
    .map((r) => startable.find((w) => w.id === r.id))
    .filter((w): w is (typeof startable)[number] => !!w)
    .sort((a, b) => (lastDone(a.id) ?? "").localeCompare(lastDone(b.id) ?? ""));
  const next = due[0] ?? startable[0];
  if (!next) return <Tile href="/fitness" icon={<PlanGlyph icon="gym" />} label="Fitness" figure="No workouts" line="Make one in Fitness" />;
  const last = lastDone(next.id);
  const ago = last ? Math.round((Date.parse(today) - Date.parse(last)) / 86400000) : null;
  return (
    <Tile
      href="/fitness"
      icon={<PlanGlyph icon="gym" />}
      label="Fitness"
      figure={next.name}
      line={`${due.length ? "Up next" : "All done"}, ${ago == null ? "not done yet" : ago === 0 ? "done today" : `last ${ago} day${ago === 1 ? "" : "s"} ago`}`}
    />
  );
}

function ProjectsTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const doing = s.projects.flatMap((p) => columnCards(p, "doing").map(() => p));
  const names = [...new Set(doing.map((p) => p.title))];
  return (
    <Tile
      href="/projects"
      icon={<PlanGlyph icon="task" />}
      label="Projects"
      figure={doing.length}
      unit="doing"
      line={names.length ? names.join(", ") : `${s.projects.length} project${s.projects.length === 1 ? "" : "s"}`}
    />
  );
}

function NutritionTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const kcal = s.calories.filter((c) => c.date === today).reduce((a, c) => a + c.kcal, 0);
  const protein = Math.round(macroTotalsByDate(s.macros)[today]?.protein ?? 0);
  const budget = s.calorieBudget;
  const over = budget ? kcal > budget : false;
  return (
    <Tile
      href="/nutrition"
      icon={<PlanGlyph icon="target" />}
      label="Nutrition"
      figure={(budget ? Math.abs(budget - kcal) : kcal).toLocaleString()}
      unit={budget ? (over ? "kcal over" : "kcal left") : "kcal"}
      line={s.proteinTarget ? `${protein} of ${s.proteinTarget} g protein` : `${protein} g protein`}
    >
      {budget ? (
        <span className="dash-tile__meter" aria-hidden>
          <span style={{ inlineSize: `${Math.min(100, (kcal / budget) * 100)}%` }} />
        </span>
      ) : null}
    </Tile>
  );
}

function WeightTile({ tracker }: { tracker: Tracker }) {
  const w = tracker.state!.weights;
  const latest = w[w.length - 1];
  if (!latest) return <Tile href="/fitness?view=weight" icon={<PlanGlyph icon="gym" />} label="Weight" figure="–" unit="kg" line="No weigh-ins yet" />;
  const weekAgo = [...w].reverse().find((x) => x.date <= addDaysW(latest.date, -7));
  const d = weekAgo ? Math.round((latest.kg - weekAgo.kg) * 10) / 10 : null;
  const pts = w.slice(-14);
  const lo = Math.min(...pts.map((p) => p.kg));
  const span = Math.max(...pts.map((p) => p.kg)) - lo || 1;
  return (
    <Tile
      href="/fitness?view=weight"
      icon={<PlanGlyph icon="target" />}
      label="Weight"
      figure={latest.kg.toFixed(1)}
      unit="kg"
      line={d == null ? "Latest weigh-in" : `${d === 0 ? "±0" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`} vs last week`}
    >
      {pts.length > 1 && (
        <svg className="dash-tile__spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
          <polyline
            points={pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${21 - ((p.kg - lo) / span) * 18}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </Tile>
  );
}

function TodosTile({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const open = s.todos.filter((t) => !t.done && todoDueBy(t, today));
  const overdue = open.filter((t) => t.date && t.date < today);
  return (
    <Tile
      href="/todos"
      icon={<PlanGlyph icon="task" />}
      label="To-dos"
      figure={open.length}
      unit="for today"
      line={overdue.length ? `${overdue.length} overdue, ${overdue[0].title}` : open[0]?.title ?? "Nothing due"}
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
      href="/fitness?view=measurements"
      icon={<PlanGlyph icon="target" />}
      label="Measurements"
      figure={now ? cmText(now.v) : "–"}
      unit={now ? `cm ${lead}` : undefined}
      line={due ? `Log ${monthName(month, today)}` : `${monthName(month, today)} logged`}
      badge={due ? "Due" : undefined}
    />
  );
}
