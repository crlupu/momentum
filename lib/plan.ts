/**
 * The day plan and the week.
 *
 * A day plan is one ordered list of steps for the days it runs on (by
 * default Monday to Friday): Read, Gym, Video… Each step points at a goal,
 * book or workout, either the same one every day or a different one per
 * weekday, and shows that one's next item. A step is done on a day when
 * there was activity on what it points at that day, or when it was ticked by
 * hand.
 *
 * Each week also has its own short list of week goals: what the week should
 * add up to (3 sessions on a goal, read to p. 200, 4 workouts, a one-off).
 * The week is done when every goal is and every plan day was completed.
 */

import { dateKey, daysSinceEpoch, goalStatus, uid, type Book, type Goal, type TrackerState, type Workout } from "./model";
import * as R from "./reading";

export type PlanKind = "goal" | "book" | "workout";
export type PlanRef = { kind: PlanKind; id: string };
export const PLAN_ICONS = ["book", "gym", "video", "learn", "task", "target"] as const;
export type PlanIcon = (typeof PLAN_ICONS)[number];

export type PlanStep = {
  id: string;
  name: string;
  icon: PlanIcon;
  /** True: `pick` every plan day. False: `byDay`, by weekday (0 Sunday … 6 Saturday). */
  same: boolean;
  pick?: PlanRef | null;
  byDay?: Partial<Record<string, PlanRef | null>>;
};

export type DayPlan = {
  /** The weekdays it runs on, 0 Sunday … 6 Saturday. */
  days: number[];
  steps: PlanStep[];
  /** The day it was made: days before it had no plan, so they aren't counted as missed. */
  since?: string;
};

/** How a week goal counts: sessions or workouts done, a page reached, or a tick. */
export type WeekGoalMode = "count" | "page" | "once";

export type WeekGoal = {
  id: string;
  mode: WeekGoalMode;
  /** What it counts. Absent for a one-off. */
  ref?: PlanRef;
  /** One-offs: what it is. */
  title?: string;
  /** Sessions or workouts for "count", the page for "page"; 1 for "once". */
  target: number;
  /** "page": where the book was when the goal was set, for pace. */
  from?: number;
  /** "once": ticked. */
  done?: boolean;
};

export const DEFAULT_DAYS = [1, 2, 3, 4, 5];
export const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Monday first, the order the week is shown in. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/* ------------------------------------------------------------------ dates */

function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayOf(key: string): number {
  return fromKey(key).getDay();
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** The Monday of the week a day is in: the week's key. */
export function weekOf(key: string): string {
  return addDays(key, -((weekdayOf(key) + 6) % 7));
}

/** The seven days of a week, Monday first. */
export function weekDays(week: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week, i));
}

/** ISO week number, for "Week 44". */
export function weekNumber(week: string): number {
  const d = fromKey(week);
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round(((thursday.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

/* ------------------------------------------------------------- sanitising */

function ref(v: unknown): PlanRef | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return (r.kind === "goal" || r.kind === "book" || r.kind === "workout") && typeof r.id === "string"
    ? { kind: r.kind, id: r.id }
    : null;
}

/** The plan as saved, made safe to read; null when there is none. */
export function planOf(s: TrackerState): DayPlan | null {
  const p = s.dayPlan as unknown as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== "object" || !Array.isArray(p.steps)) return null;
  const days = Array.isArray(p.days) ? (p.days as unknown[]).filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6) : DEFAULT_DAYS;
  const steps = (p.steps as Array<Record<string, unknown>>)
    .filter((x) => x && typeof x.id === "string")
    .map((x) => {
      const byDay: Record<string, PlanRef | null> = {};
      if (x.byDay && typeof x.byDay === "object")
        for (const [k, v] of Object.entries(x.byDay as Record<string, unknown>)) byDay[k] = ref(v);
      return {
        id: x.id as string,
        name: typeof x.name === "string" && x.name.trim() ? x.name : "Step",
        icon: (PLAN_ICONS as readonly string[]).includes(x.icon as string) ? (x.icon as PlanIcon) : "task",
        same: x.same !== false,
        pick: ref(x.pick),
        byDay,
      };
    });
  const since = typeof p.since === "string" ? p.since : undefined;
  return steps.length || days.length ? { days: [...new Set(days)].sort(), steps, since } : null;
}

export function planTicksOf(s: TrackerState): Record<string, string[]> {
  const t = s.planTicks as unknown;
  return t && typeof t === "object" ? (t as Record<string, string[]>) : {};
}

export function weekGoalsOf(s: TrackerState, week: string): WeekGoal[] {
  const all = s.weekGoals as unknown as Record<string, unknown> | undefined;
  const list = all && typeof all === "object" ? all[week] : undefined;
  if (!Array.isArray(list)) return [];
  return (list as Array<Record<string, unknown>>)
    .filter((g) => g && typeof g.id === "string" && (g.mode === "count" || g.mode === "page" || g.mode === "once"))
    .map((g) => ({
      id: g.id as string,
      mode: g.mode as WeekGoalMode,
      ref: ref(g.ref) ?? undefined,
      title: typeof g.title === "string" ? g.title : undefined,
      target: typeof g.target === "number" && g.target > 0 ? g.target : 1,
      from: typeof g.from === "number" ? g.from : undefined,
      done: g.done === true,
    }));
}

/* ------------------------------------------------------- what a step is */

export function pickFor(step: PlanStep, weekday: number): PlanRef | null {
  return step.same ? step.pick ?? null : step.byDay?.[String(weekday)] ?? null;
}

export type Resolved =
  | { kind: "goal"; item: Goal }
  | { kind: "book"; item: Book }
  | { kind: "workout"; item: Workout };

export function resolve(s: TrackerState, r: PlanRef | null | undefined): Resolved | null {
  if (!r) return null;
  if (r.kind === "goal") {
    const g = s.goals.find((x) => x.id === r.id);
    return g ? { kind: "goal", item: g } : null;
  }
  if (r.kind === "book") {
    const b = s.books.find((x) => x.id === r.id);
    return b ? { kind: "book", item: b } : null;
  }
  const w = s.workouts.find((x) => x.id === r.id);
  return w ? { kind: "workout", item: w } : null;
}

export function refTitle(s: TrackerState, r: PlanRef | null | undefined): string | null {
  const it = resolve(s, r);
  if (!it) return null;
  return it.kind === "workout" ? it.item.name : it.item.title;
}

/** A goal's next item: its first unticked entry, or one more on its count. */
export function nextOfGoal(g: Goal): { itemId?: string; title: string; of: string } | null {
  const all = [g.items ?? [], ...(g.parts ?? []).map((p) => p.items ?? [])].flat();
  const item = all.find((i) => !i.done);
  if (item) return { itemId: item.id, title: item.title, of: `${all.filter((i) => i.done).length + 1} of ${all.length}` };
  if (all.length === 0 && g.target && (g.current ?? 0) < g.target)
    return { title: `${(g.current ?? 0) + 1} of ${g.target}`, of: `${(g.current ?? 0) + 1} of ${g.target}` };
  return null;
}

/** What the step asks of today, in a line: "Lesson 13", "20 pages · to p. 152", "5 exercises". */
export function askOf(s: TrackerState, it: Resolved | null): string {
  if (!it) return "Nothing picked";
  if (it.kind === "goal") {
    const n = nextOfGoal(it.item);
    return n ? (n.itemId ? `${n.title} · ${n.of}` : `Session ${n.of}`) : "All done";
  }
  if (it.kind === "book") {
    const b = it.item;
    const daily = R.trackOf(s, b.trackId)?.dailyTarget ?? 0;
    if (daily > 0) {
      const to = b.pages > 0 ? Math.min(b.pages, b.read + daily) : b.read + daily;
      return `${daily} pages · to p. ${to}`;
    }
    return b.pages > 0 ? `p. ${b.read} of ${b.pages}` : `p. ${b.read}`;
  }
  const n = it.item.exercises.length;
  return `${n} exercise${n === 1 ? "" : "s"}`;
}

/* ------------------------------------------------------------- activity */

/** Activity on what a ref points at, by day: sessions, pages, workouts. */
function activityOn(s: TrackerState, r: PlanRef, day: string): boolean {
  if (r.kind === "goal") return (s.learningLog ?? []).some((e) => e.goalId === r.id && e.date === day);
  if (r.kind === "book")
    return s.readingSessions.some((e) => e.bookId === r.id && e.date === day) || s.books.find((b) => b.id === r.id)?.touched === day;
  return s.workoutSessions.some((e) => e.workoutId === r.id && e.date === day);
}

export type DayStep = {
  step: PlanStep;
  ref: PlanRef | null;
  it: Resolved | null;
  done: boolean;
  /** Done by activity, which a tick can't undo. */
  auto: boolean;
};

/** A day's steps, in order: those with something picked that day, or picked for every day. */
export function stepsOn(s: TrackerState, plan: DayPlan, day: string): DayStep[] {
  const wd = weekdayOf(day);
  if (!plan.days.includes(wd) || (plan.since && day < plan.since)) return [];
  const ticks = planTicksOf(s)[day] ?? [];
  const out: DayStep[] = [];
  for (const step of plan.steps) {
    const r = pickFor(step, wd);
    // A day can skip a step: nothing picked for it that day.
    if (!step.same && !r) continue;
    const auto = !!r && activityOn(s, r, day);
    out.push({ step, ref: r, it: resolve(s, r), done: auto || ticks.includes(step.id), auto });
  }
  return out;
}

/** Everything the plan points at on any day, as "kind:id". */
export function plannedKeys(plan: DayPlan | null): Set<string> {
  const out = new Set<string>();
  if (!plan) return out;
  for (const st of plan.steps) {
    const refs = st.same ? [st.pick] : Object.values(st.byDay ?? {});
    for (const r of refs) if (r) out.add(`${r.kind}:${r.id}`);
  }
  return out;
}

/** The plan with one day's hand tick on a step flipped; older ticks pruned. */
export function toggledPlanTick(s: TrackerState, day: string, stepId: string): Record<string, string[]> {
  const all = planTicksOf(s);
  const cut = addDays(day, -60);
  const next: Record<string, string[]> = {};
  for (const [d, ids] of Object.entries(all)) if (d >= cut && Array.isArray(ids) && ids.length) next[d] = ids;
  const now = next[day] ?? [];
  next[day] = now.includes(stepId) ? now.filter((x) => x !== stepId) : [...now, stepId];
  if (!next[day].length) delete next[day];
  return next;
}

/* ----------------------------------------------------------------- week */

export type DayStatus = { day: string; planned: boolean; done: number; total: number };

export function weekStatus(s: TrackerState, plan: DayPlan | null, week: string): DayStatus[] {
  return weekDays(week).map((day) => {
    const steps = plan ? stepsOn(s, plan, day) : [];
    return { day, planned: steps.length > 0, done: steps.filter((x) => x.done).length, total: steps.length };
  });
}

export type GoalProgress = {
  goal: WeekGoal;
  label: string;
  sub: string;
  value: number;
  target: number;
  done: boolean;
  /** For counted goals still open: ahead or behind the days gone. */
  pace?: "on" | "behind";
  /** "2 of 3", "p. 160 of 200". */
  count: string;
};

function inWeek(day: string, week: string) {
  return day >= week && day <= addDays(week, 6);
}

/** How far a week goal has got, from activity in that week. */
export function progressOf(s: TrackerState, g: WeekGoal, week: string, plan: DayPlan | null, today: string): GoalProgress {
  const it = resolve(s, g.ref);
  const name = refTitle(s, g.ref) ?? "Gone";
  let value = 0;
  if (g.mode === "once") value = g.done ? 1 : 0;
  else if (g.mode === "page") value = it?.kind === "book" ? it.item.read : 0;
  else if (g.ref?.kind === "goal")
    value = (s.learningLog ?? []).filter((e) => e.goalId === g.ref!.id && inWeek(e.date, week)).reduce((a, e) => a + Math.max(0, e.amount), 0);
  else if (g.ref?.kind === "workout") value = s.workoutSessions.filter((e) => e.workoutId === g.ref!.id && inWeek(e.date, week)).length;
  else if (g.ref?.kind === "book")
    value = s.readingSessions.filter((e) => e.bookId === g.ref!.id && inWeek(e.date, week)).reduce((a, e) => a + e.pages, 0);
  const done = value >= g.target;

  // Pace: where it should be by now, over the week's plan days (or all
  // seven when there's no plan), counting today as half gone.
  let pace: GoalProgress["pace"];
  if (!done && g.mode !== "once" && today >= week && today <= addDays(week, 6)) {
    const days = weekDays(week).filter((d) => !plan || plan.days.includes(weekdayOf(d)));
    const total = days.length || 7;
    const gone = days.filter((d) => d < today).length;
    const start = g.mode === "page" ? g.from ?? 0 : 0;
    const expected = start + ((g.target - start) * gone) / total;
    pace = value + 1e-9 >= Math.floor(expected) ? "on" : "behind";
  }

  const label =
    g.mode === "once" ? g.title || "One-off"
    : g.mode === "page" ? `Read to p. ${g.target}`
    : g.ref?.kind === "workout" ? `${g.target} workout${g.target === 1 ? "" : "s"}`
    : g.ref?.kind === "book" ? `${g.target} pages`
    : `${g.target} session${g.target === 1 ? "" : "s"}`;
  const count =
    g.mode === "once" ? (done ? "Done" : "To do")
    : g.mode === "page" ? `p. ${value} of ${g.target}`
    : `${Math.min(value, g.target)} of ${g.target}`;
  return { goal: g, label, sub: g.mode === "once" ? "One-off" : name, value, target: g.target, done, pace, count };
}

export type WeekSummary = {
  week: string;
  days: DayStatus[];
  goals: GoalProgress[];
  goalsDone: number;
  daysDone: number;
  daysPlanned: number;
  done: boolean;
};

export function summarizeWeek(s: TrackerState, week: string, today: string = dateKey()): WeekSummary {
  const plan = planOf(s);
  const days = weekStatus(s, plan, week);
  const goals = weekGoalsOf(s, week).map((g) => progressOf(s, g, week, plan, today));
  const planned = days.filter((d) => d.planned);
  const daysDone = planned.filter((d) => d.done === d.total).length;
  const goalsDone = goals.filter((g) => g.done).length;
  const has = goals.length > 0 || planned.length > 0;
  return { week, days, goals, goalsDone, daysDone, daysPlanned: planned.length, done: has && goalsDone === goals.length && daysDone === planned.length };
}

/** Weeks in a row done, ending with the last finished week (or this one, if done). */
export function streak(s: TrackerState, today: string = dateKey()): number {
  let week = weekOf(today);
  let n = 0;
  if (summarizeWeek(s, week, today).done) n++;
  for (let i = 0; i < 104; i++) {
    week = addDays(week, -7);
    const w = summarizeWeek(s, week, today);
    if (!w.done) break;
    n++;
  }
  return n;
}

/* ---------------------------------------------------------- suggestions */

export type Suggestion = { key: string; goal: WeekGoal; label: string; why: string };

/** Week goals the plan implies: one per thing it points at, counted over its days. */
export function suggestions(s: TrackerState, week: string): Suggestion[] {
  const plan = planOf(s);
  const out: Suggestion[] = [];
  if (plan) {
    const counts = new Map<string, { ref: PlanRef; days: number[] }>();
    for (const day of weekDays(week)) {
      const wd = weekdayOf(day);
      if (!plan.days.includes(wd)) continue;
      for (const st of plan.steps) {
        const r = pickFor(st, wd);
        if (!r) continue;
        const k = `${r.kind}:${r.id}`;
        const c = counts.get(k) ?? { ref: r, days: [] };
        c.days.push(wd);
        counts.set(k, c);
      }
    }
    for (const [k, { ref: r, days }] of counts) {
      const it = resolve(s, r);
      if (!it) continue;
      const when = days.length === plan.days.length ? "every plan day" : days.map((d) => WEEKDAY[d]).join(", ");
      if (it.kind === "book") {
        const daily = R.trackOf(s, it.item.trackId)?.dailyTarget || 20;
        const to = it.item.pages > 0 ? Math.min(it.item.pages, it.item.read + daily * days.length) : it.item.read + daily * days.length;
        const g: WeekGoal = { id: uid(), mode: "page", ref: r, target: to, from: it.item.read };
        out.push({ key: k, goal: g, label: `Read to p. ${to}`, why: `${daily} pages × ${days.length}` });
      } else if (it.kind === "workout") {
        out.push({ key: k, goal: { id: uid(), mode: "count", ref: r, target: days.length }, label: `${days.length} workout${days.length === 1 ? "" : "s"}`, why: when });
      } else if (goalStatus(it.item) !== "done") {
        out.push({ key: k, goal: { id: uid(), mode: "count", ref: r, target: days.length }, label: `${days.length} session${days.length === 1 ? "" : "s"}`, why: when });
      }
    }
  }
  return out;
}

/** Last week's goals left unfinished, offered again (never carried silently). */
export function leftFromLastWeek(s: TrackerState, week: string, today: string = dateKey()): WeekGoal[] {
  const last = addDays(week, -7);
  const plan = planOf(s);
  return weekGoalsOf(s, last)
    .filter((g) => !progressOf(s, g, last, plan, today).done)
    .map((g) => ({ ...g, id: uid(), ...(g.mode === "once" ? { done: false } : {}) }));
}

export function daysBetween(a: string, b: string): number {
  return daysSinceEpoch(b) - daysSinceEpoch(a);
}
