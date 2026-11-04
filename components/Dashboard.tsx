"use client";

import { ReactNode, useMemo } from "react";
import Link from "next/link";
import { Tracker, dateKey, goalStatus, macroTotalsByDate, todoDueBy } from "@/lib/tracker";
import { planOf, stepsOn, weekdayOf, WEEKDAY_LONG, addDays, nextOfGoal } from "@/lib/plan";
import { dayRun, history } from "@/lib/habits";
import { routines } from "@/lib/routines";
import { columnCards } from "@/lib/projects";
import { addDays as addDaysW } from "@/lib/weight";
import { MEASURES, monthName, monthOf, lastTwo, cmText } from "@/lib/measurements";
import { usePending } from "./ActionButton";
import { PlanGlyph } from "./plan/bits";
import { FocusCard, PlanWelcome } from "./plan/PlanCard";
import { Check, ChevronRight } from "./icons";

/**
 * Today as a dashboard: the routine on top, its habits as a track across
 * the card that fills as they're kept, Done for the next one and Open for
 * the whole list; then a tile per page, two to a row, each with its one
 * figure and the line that explains it. A tile opens its page.
 */
export function Dashboard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  return (
    <div className="dashboard">
      <RoutineHero tracker={tracker} />
      <div className="dash-tiles">
        <EducationTile tracker={tracker} />
        <FitnessTile tracker={tracker} />
        <ProjectsTile tracker={tracker} />
        <NutritionTile tracker={tracker} />
        <WeightTile tracker={tracker} />
        <TodosTile tracker={tracker} />
        {s && <MeasurementsTile tracker={tracker} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- routine */

/**
 * The routine: today's count and run, the habits as round icons of one size
 * riding on a track that fills from the left as they're kept, and Done for
 * the next one. On a day the plan doesn't run, the next plan day instead.
 */
function RoutineHero({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const plan = planOf(s);
  const planned = plan && plan.steps.length > 0 ? plan : null;
  const steps = planned ? stepsOn(s, planned, today) : [];
  const h = useMemo(() => (planned ? history(s, planned, today) : []), [s, planned, today]);
  const { pending, run } = usePending();
  if (s.activeFocus) return <FocusCard tracker={tracker} plan={planned} />;
  if (!planned) return <PlanWelcome />;

  const n = steps.length;
  const done = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);
  const streak = dayRun(h);
  let nextDay = addDays(today, 1);
  for (let i = 0; i < 7 && !planned.days.includes(weekdayOf(nextDay)); i++) nextDay = addDays(nextDay, 1);

  return (
    <section className="momentum dash-routine" aria-label="Routine">
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
        ) : null}
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
        <ol className="habit-track" aria-label={`${done} of ${n} habits kept`}>
          <span className="habit-track__fill" style={{ inlineSize: `${(done / n) * 100}%` }} aria-hidden />
          {/* Kept on the left, under the fill; what's left after, in the plan's order. */}
          {[...steps].sort((p, q) => Number(q.done) - Number(p.done)).map((x) => (
            <li key={x.step.id} className="habit-track__slot" title={x.name}>
              <span className={"habit-track__dot" + (x.done ? " is-done" : x === next ? " is-next" : "")}>
                {x.done ? <Check aria-hidden /> : <PlanGlyph icon={x.icon} />}
              </span>
              <span className="sr-only">
                {x.name}, {x.done ? "kept" : "to do"}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="dash-routine__actions">
        {next && (
          <button
            type="button"
            className="pill-link pill-link--primary flex-1 justify-center"
            disabled={pending}
            onClick={() => void run(() => tracker.togglePlanStep(today, next.step.id))}
          >
            <Check aria-hidden /> Done
          </button>
        )}
        <Link href="/routine" className={"pill-link" + (next ? "" : " flex-1 justify-center")}>
          Open
        </Link>
      </div>
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
      wide
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
