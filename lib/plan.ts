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
import { columnCards, type Project } from "./projects";

/**
 * What a step points at. A reading step points at a track (the book it has
 * open is today's); "book" is the old form, read as its track. A focus step
 * is time: `minutes` on a project (`id`), or on nothing in particular ("").
 */
export type PlanKind = "goal" | "book" | "workout" | "track" | "focus";
export type PlanRef = { kind: PlanKind; id: string; minutes?: number };

/** A stretch of focused work, logged when it ends. */
export type FocusSession = { id: string; date: string; minutes: number; projectId?: string; stepId?: string; at: number };

/** The focus block under way: its clock, paused time included. */
export type ActiveFocus = {
  startedAt: number;
  /** Time spent paused, in milliseconds, before the current pause. */
  pausedMs: number;
  /** Set while paused. */
  pausedAt?: number;
  minutes: number;
  projectId?: string;
  stepId?: string;
  /** The plan day the block is for. */
  day: string;
};
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
  if (r.kind === "focus")
    return { kind: "focus", id: typeof r.id === "string" ? r.id : "", minutes: typeof r.minutes === "number" && r.minutes > 0 ? r.minutes : 50 };
  return (r.kind === "goal" || r.kind === "book" || r.kind === "workout" || r.kind === "track") && typeof r.id === "string"
    ? { kind: r.kind, id: r.id }
    : null;
}

/** An old book step reads as its book's track, so Today follows the track. */
function asTrack(s: TrackerState, r: PlanRef | null): PlanRef | null {
  if (r?.kind !== "book") return r;
  const b = s.books.find((x) => x.id === r.id);
  return b && R.trackOf(s, b.trackId) ? { kind: "track", id: b.trackId! } : r;
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
        for (const [k, v] of Object.entries(x.byDay as Record<string, unknown>)) byDay[k] = asTrack(s, ref(v));
      return {
        id: x.id as string,
        name: typeof x.name === "string" && x.name.trim() ? x.name : "Step",
        icon: (PLAN_ICONS as readonly string[]).includes(x.icon as string) ? (x.icon as PlanIcon) : "task",
        same: x.same !== false,
        pick: asTrack(s, ref(x.pick)),
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

/* ---------------------------------------------------------------- swaps */

/**
 * This week's exchanges: a step on a day pointing at something else than the
 * plan says (a workout swapped with another day's), by week, then by
 * "day:stepId". They last the week; the plan itself is untouched.
 */
export type PlanSwaps = Record<string, Record<string, PlanRef>>;

export function swapsOf(s: TrackerState): PlanSwaps {
  const t = s.planSwaps as unknown;
  return t && typeof t === "object" ? (t as PlanSwaps) : {};
}

const slot = (day: string, stepId: string) => `${day}:${stepId}`;

/** What a step points at on a given day: this week's swap if there is one, else the plan. */
export function pickOn(s: TrackerState, step: PlanStep, day: string): PlanRef | null {
  const swapped = swapsOf(s)[weekOf(day)]?.[slot(day, step.id)];
  return swapped !== undefined ? ref(swapped) : pickFor(step, weekdayOf(day));
}

/** Whether a step's pick on a day comes from a swap. */
export function isSwapped(s: TrackerState, step: PlanStep, day: string): boolean {
  return swapsOf(s)[weekOf(day)]?.[slot(day, step.id)] !== undefined;
}

/** The same thing: kind and id, and for focus its length too. */
export function sameRef(a: PlanRef | null | undefined, b: PlanRef | null | undefined): boolean {
  return !!a && !!b && a.kind === b.kind && a.id === b.id && (a.kind !== "focus" || (a.minutes ?? 0) === (b.minutes ?? 0));
}

export type SwapOption = { day: string; stepId: string; ref: PlanRef; title: string; icon: PlanIcon };

/**
 * What a step can be exchanged with: any other activity in this week's plan,
 * that day's or another's, of any kind, not done yet and not the same thing.
 */
export function swapOptions(s: TrackerState, plan: DayPlan, day: string, stepId: string): SwapOption[] {
  const step = plan.steps.find((x) => x.id === stepId);
  const mine = step ? pickOn(s, step, day) : null;
  const out: SwapOption[] = [];
  for (const d of weekDays(weekOf(day))) {
    for (const x of stepsOn(s, plan, d)) {
      if ((d === day && x.step.id === stepId) || x.done || !x.ref || !x.it || sameRef(x.ref, mine)) continue;
      out.push({ day: d, stepId: x.step.id, ref: x.ref, title: refTitle(s, x.ref) ?? x.name, icon: x.icon });
    }
  }
  return out;
}

/**
 * The step a swapped-in pick comes from, for its name and icon: the one
 * whose plan holds it this week. A row keeps "Gym" and its dumbbell only
 * while it holds a workout from the plan's Gym step.
 */
function donorOf(s: TrackerState, plan: DayPlan, step: PlanStep, day: string, r: PlanRef | null): PlanStep {
  if (!r || !isSwapped(s, step, day)) return step;
  const days = weekDays(weekOf(day)).map(weekdayOf);
  if (days.some((wd) => sameRef(pickFor(step, wd), r))) return step;
  return plan.steps.find((o) => o.id !== step.id && days.some((wd) => sameRef(pickFor(o, wd), r))) ?? step;
}

/**
 * The swaps with two slots' picks exchanged for their week. A slot that ends
 * up on what the plan says loses its swap; weeks older than a month go.
 */
export function withSwap(s: TrackerState, plan: DayPlan, a: { day: string; stepId: string }, b: { day: string; stepId: string }): PlanSwaps {
  const stepA = plan.steps.find((x) => x.id === a.stepId);
  const stepB = plan.steps.find((x) => x.id === b.stepId);
  const cut = addDays(weekOf(dateKey()), -28);
  const next: PlanSwaps = {};
  for (const [w, m] of Object.entries(swapsOf(s))) if (w >= cut) next[w] = { ...m };
  if (!stepA || !stepB) return next;
  const ra = pickOn(s, stepA, a.day);
  const rb = pickOn(s, stepB, b.day);
  const put = (step: PlanStep, day: string, r: PlanRef | null) => {
    const w = weekOf(day);
    const m = { ...(next[w] ?? {}) };
    const planned = pickFor(step, weekdayOf(day));
    if (sameRef(r, planned)) delete m[slot(day, step.id)];
    else if (r) m[slot(day, step.id)] = r;
    if (Object.keys(m).length) next[w] = m;
    else delete next[w];
  };
  put(stepA, a.day, rb);
  put(stepB, b.day, ra);
  return next;
}

/** The slot a swapped step was exchanged with this week, to undo it. */
export function swapPartner(s: TrackerState, plan: DayPlan, day: string, stepId: string): { day: string; stepId: string } | null {
  const step = plan.steps.find((x) => x.id === stepId);
  const now = step ? pickOn(s, step, day) : null;
  const planned = step ? pickFor(step, weekdayOf(day)) : null;
  if (!now || !planned) return null;
  for (const [k, r] of Object.entries(swapsOf(s)[weekOf(day)] ?? {})) {
    const [d, id] = [k.slice(0, 10), k.slice(11)];
    if (d === day && id === stepId) continue;
    const other = plan.steps.find((x) => x.id === id);
    // The partner now holds this slot's planned pick, and planned this one's.
    if (other && sameRef(r, planned) && sameRef(pickFor(other, weekdayOf(d)), now)) return { day: d, stepId: id };
  }
  return null;
}

export function pickFor(step: PlanStep, weekday: number): PlanRef | null {
  return step.same ? step.pick ?? null : step.byDay?.[String(weekday)] ?? null;
}

export type Resolved =
  | { kind: "goal"; item: Goal }
  | { kind: "book"; item: Book }
  | { kind: "workout"; item: Workout }
  /** A track, with the book it has open, if any. */
  | { kind: "track"; item: R.ReadingTrack; book?: Book }
  | { kind: "focus"; minutes: number; project?: Project };

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
  if (r.kind === "track") {
    const t = R.trackOf(s, r.id);
    return t ? { kind: "track", item: t, book: R.activeBooks(s, t.id)[0] } : null;
  }
  if (r.kind === "focus") {
    const project = r.id ? s.projects.find((p) => p.id === r.id) : undefined;
    return { kind: "focus", minutes: r.minutes ?? 50, project };
  }
  const w = s.workouts.find((x) => x.id === r.id);
  return w ? { kind: "workout", item: w } : null;
}

export function refTitle(s: TrackerState, r: PlanRef | null | undefined): string | null {
  const it = resolve(s, r);
  if (!it) return null;
  if (it.kind === "workout") return it.item.name;
  if (it.kind === "track") return it.item.name;
  if (it.kind === "focus") return it.project?.title ?? "Just focus";
  return it.item.title;
}

/** Focus minutes logged on a day, on a project or (with none given) on anything. */
export function focusMinutes(s: TrackerState, day: string, projectId?: string): number {
  return (s.focusSessions ?? [])
    .filter((f) => f.date === day && (!projectId || f.projectId === projectId))
    .reduce((a, f) => a + f.minutes, 0);
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
  if (it.kind === "focus") {
    const doing = it.project ? columnCards(it.project, "doing")[0] : undefined;
    return `${it.minutes} min${doing ? ` · Doing: ${doing.title}` : ""}`;
  }
  if (it.kind === "track") {
    const b = it.book;
    if (!b) return "No book open";
    const daily = it.item.dailyTarget;
    if (daily > 0) return `${daily} pages · to p. ${b.pages > 0 ? Math.min(b.pages, b.read + daily) : b.read + daily}`;
    return b.pages > 0 ? `p. ${b.read} of ${b.pages}` : `p. ${b.read}`;
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
  if (r.kind === "track") {
    const ids = new Set(s.books.filter((b) => b.trackId === r.id).map((b) => b.id));
    return s.readingSessions.some((e) => ids.has(e.bookId) && e.date === day) || s.books.some((b) => ids.has(b.id) && b.touched === day);
  }
  if (r.kind === "focus") return focusMinutes(s, day, r.id || undefined) >= (r.minutes ?? 50);
  return s.workoutSessions.some((e) => e.workoutId === r.id && e.date === day);
}

export type DayStep = {
  step: PlanStep;
  /** The step's name and icon, or, when this week's swap brought in another step's pick, that step's. */
  name: string;
  icon: PlanIcon;
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
    const r = pickOn(s, step, day);
    // A day can skip a step: nothing picked for it that day.
    if (!step.same && !r) continue;
    const auto = !!r && activityOn(s, r, day);
    const donor = donorOf(s, plan, step, day, r);
    out.push({ step, name: donor.name, icon: donor.icon, ref: r, it: resolve(s, r), done: auto || ticks.includes(step.id), auto });
  }
  return out;
}

/** Everything the plan points at on any day, as routine keys ("kind:id"): a track stands for its books. */
export function plannedKeys(plan: DayPlan | null, s?: TrackerState): Set<string> {
  const out = new Set<string>();
  if (!plan) return out;
  for (const st of plan.steps) {
    const refs = st.same ? [st.pick] : Object.values(st.byDay ?? {});
    for (const r of refs) {
      if (!r) continue;
      if (r.kind === "track" && s) for (const b of s.books) if (b.trackId === r.id) out.add(`book:${b.id}`);
      out.add(`${r.kind}:${r.id}`);
    }
  }
  return out;
}

/* ------------------------------------------------------------ leftovers */

export function planSkipsOf(s: TrackerState): Record<string, string[]> {
  const t = s.planSkips as unknown;
  return t && typeof t === "object" ? (t as Record<string, string[]>) : {};
}

/** How far back a step not done waits to be caught up. */
/** How many plan days back leftovers reach: older misses go quietly, the week view keeps them. */
export const LEFTOVER_DAYS = 2;

export type Leftover = { day: string; x: DayStep };

/** Steps not done on the plan days before today, newest first, unless skipped. */
export function leftovers(s: TrackerState, plan: DayPlan, today: string = dateKey()): Leftover[] {
  const skips = planSkipsOf(s);
  const out: Leftover[] = [];
  // The last plan days, not calendar days: Monday still sees Friday.
  let planDays = 0;
  for (let i = 1; i <= 7 && planDays < LEFTOVER_DAYS; i++) {
    const day = addDays(today, -i);
    const steps = stepsOn(s, plan, day);
    if (!steps.length) continue;
    planDays++;
    const skipped = skips[day] ?? [];
    for (const x of steps) if (!x.done && !skipped.includes(x.step.id)) out.push({ day, x });
  }
  return out;
}

/** "Mon", "Fri–Mon": the days leftovers come from, oldest first. */
export function leftoverDays(days: string[]): string {
  const u = [...new Set(days)].sort();
  if (!u.length) return "";
  const first = WEEKDAY[weekdayOf(u[0])];
  return u.length === 1 ? first : `${first}\u2013${WEEKDAY[weekdayOf(u[u.length - 1])]}`;
}

/** The skips with some (day, step) pairs added; older ones pruned. */
export function withSkips(s: TrackerState, pairs: { day: string; stepId: string }[]): Record<string, string[]> {
  const cut = addDays(dateKey(), -60);
  const next: Record<string, string[]> = {};
  for (const [d, ids] of Object.entries(planSkipsOf(s))) if (d >= cut && Array.isArray(ids) && ids.length) next[d] = [...ids];
  for (const { day, stepId } of pairs) next[day] = [...new Set([...(next[day] ?? []), stepId])];
  return next;
}

/* ---------------------------------------------------------------- focus */

/** Milliseconds a focus block has run, pauses left out. */
export function focusElapsed(f: ActiveFocus, now: number = Date.now()): number {
  return Math.max(0, (f.pausedAt ?? now) - f.startedAt - f.pausedMs);
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

/** 90 → "1.5 h", 45 → "45 min". */
export function hours(minutes: number): string {
  return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10} h` : `${minutes} min`;
}

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
  else if (g.ref?.kind === "track") {
    const ids = new Set(s.books.filter((b) => b.trackId === g.ref!.id).map((b) => b.id));
    value = s.readingSessions.filter((e) => ids.has(e.bookId) && inWeek(e.date, week)).reduce((a, e) => a + e.pages, 0);
  } else if (g.ref?.kind === "focus")
    value = (s.focusSessions ?? []).filter((f) => inWeek(f.date, week) && (!g.ref!.id || f.projectId === g.ref!.id)).reduce((a, f) => a + f.minutes, 0);
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
    : g.ref?.kind === "book" || g.ref?.kind === "track" ? `${g.target} pages`
    : g.ref?.kind === "focus" ? `${hours(g.target)} of focus`
    : `${g.target} session${g.target === 1 ? "" : "s"}`;
  const count =
    g.mode === "once" ? (done ? "Done" : "To do")
    : g.mode === "page" ? `p. ${value} of ${g.target}`
    : g.ref?.kind === "focus" ? `${hours(Math.min(value, g.target))} of ${hours(g.target)}`
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
    const counts = new Map<string, { ref: PlanRef; days: number[]; minutes: number }>();
    for (const day of weekDays(week)) {
      const wd = weekdayOf(day);
      if (!plan.days.includes(wd)) continue;
      for (const st of plan.steps) {
        const r = pickOn(s, st, day);
        if (!r) continue;
        const k = `${r.kind}:${r.id}`;
        const c = counts.get(k) ?? { ref: r, days: [], minutes: 0 };
        c.days.push(wd);
        c.minutes += r.minutes ?? 0;
        counts.set(k, c);
      }
    }
    for (const [k, { ref: r, days, minutes }] of counts) {
      const it = resolve(s, r);
      if (!it) continue;
      const when = days.length === plan.days.length ? "every plan day" : days.map((d) => WEEKDAY[d]).join(", ");
      if (it.kind === "focus") {
        out.push({ key: k, goal: { id: uid(), mode: "count", ref: { kind: "focus", id: r.id }, target: minutes }, label: `${hours(minutes)} of focus`, why: when });
      } else if (it.kind === "track") {
        const pages = (it.item.dailyTarget || 20) * days.length;
        out.push({ key: k, goal: { id: uid(), mode: "count", ref: r, target: pages }, label: `${pages} pages`, why: `${it.item.dailyTarget || 20} pages × ${days.length}` });
      } else if (it.kind === "book") {
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
