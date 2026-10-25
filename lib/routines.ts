import {
  type Book,
  type Category,
  type Completion,
  type Goal,
  type TrackerState,
  dateKey,
  goalStatus,
  periodKey,
} from "./model";

/**
 * Routines: what comes round again, kept without being kept by hand. Every
 * active goal, every book being read and every workout is one, repeating
 * daily, weekly or monthly, and it is done for the period as soon as there
 * is activity on it: a session logged on the goal, pages read, the workout
 * finished. A tick covers what happens away from the app.
 */

export type Repeat = "daily" | "weekly" | "monthly";
/** What an item can be set to: a repeat, or left out of the routines. */
export type RepeatSetting = Repeat | "off";
export type RoutineKind = "goal" | "book" | "workout";

export const REPEAT_LABEL: Record<RepeatSetting, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  off: "Off",
};
export const REPEAT_OPTIONS: RepeatSetting[] = ["daily", "weekly", "monthly", "off"];

/** What each kind repeats at until it's set: books are read daily, the rest weekly. */
export const DEFAULT_REPEAT: Record<RoutineKind, Repeat> = {
  goal: "weekly",
  book: "daily",
  workout: "weekly",
};

/** The fields a goal, book or workout carries for its routine. */
export type RoutineFields = {
  /** How often it comes round. Absent means its kind's default. */
  repeat?: RepeatSetting;
  /** Days it was ticked by hand, YYYY-MM-DD. */
  routineTicks?: string[];
};

export type Routine = {
  /** Unique across kinds: "goal:abc". */
  key: string;
  kind: RoutineKind;
  id: string;
  title: string;
  freq: Repeat;
  cat: { id: string; name: string; color: string };
  done: boolean;
  /** Done by activity, which a tick can't undo. */
  auto: boolean;
};

export function repeatOf(kind: RoutineKind, item: RoutineFields): RepeatSetting {
  const r = item.repeat;
  return r === "daily" || r === "weekly" || r === "monthly" || r === "off" ? r : DEFAULT_REPEAT[kind];
}

const FIXED: Record<"book" | "workout", { name: string; color: string; match: RegExp }> = {
  book: { name: "Books", color: "#8b6cd9", match: /book|read/i },
  workout: { name: "Workouts", color: "#e0703a", match: /workout|fitness|gym|training|sport/i },
};

/** Books and workouts sit in a category of that name when there is one. */
function fixedCat(categories: Category[], kind: "book" | "workout") {
  const f = FIXED[kind];
  const c = categories.find((x) => f.match.test(x.name));
  return c ? { id: c.id, name: c.name, color: c.color } : { id: kind, name: f.name, color: f.color };
}

function goalCat(categories: Category[], g: Goal) {
  const c = categories.find((x) => x.id === g.catId);
  return c ? { id: c.id, name: c.name, color: c.color } : { id: "", name: "No category", color: "var(--muted)" };
}

/** Every day there was activity on an item, ticks included. */
function activity(s: TrackerState, kind: RoutineKind, id: string, item: RoutineFields): string[] {
  const days = [...(item.routineTicks ?? [])];
  if (kind === "goal") {
    for (const e of s.learningLog ?? []) if (e.goalId === id) days.push(e.date);
  } else if (kind === "book") {
    for (const r of s.readingSessions) if (r.bookId === id) days.push(r.date);
    const touched = (item as Book).touched;
    if (touched) days.push(touched);
  } else {
    for (const w of s.workoutSessions) if (w.workoutId === id) days.push(w.date);
  }
  return days;
}

type Item = { kind: RoutineKind; id: string; title: string; fields: RoutineFields; cat: Routine["cat"] };

function items(s: TrackerState, all: boolean): Item[] {
  const out: Item[] = [];
  for (const g of s.goals) {
    if (!all && goalStatus(g) !== "active") continue;
    out.push({ kind: "goal", id: g.id, title: g.title, fields: g as RoutineFields, cat: goalCat(s.categories, g) });
  }
  const bookCat = fixedCat(s.categories, "book");
  for (const b of s.books) {
    if (!all && b.status !== "active") continue;
    out.push({ kind: "book", id: b.id, title: b.title, fields: b as RoutineFields, cat: bookCat });
  }
  const workoutCat = fixedCat(s.categories, "workout");
  for (const w of s.workouts) {
    out.push({ kind: "workout", id: w.id, title: w.name, fields: w as RoutineFields, cat: workoutCat });
  }
  return out;
}

const FREQ_ORDER: Record<Repeat, number> = { daily: 0, weekly: 1, monthly: 2 };
const KIND_ORDER: Record<RoutineKind, number> = { goal: 0, book: 1, workout: 2 };

/**
 * The order routines are shown in: what's left first, then by how often,
 * kind and title. The first not done is the next one.
 */
export function byRoutineOrder(a: Routine, b: Routine): number {
  return (
    Number(a.done) - Number(b.done) ||
    FREQ_ORDER[a.freq] - FREQ_ORDER[b.freq] ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );
}

/** Today's routines, in kind order: goals, then books, then workouts. */
export function routines(s: TrackerState, today: string = dateKey()): Routine[] {
  const out: Routine[] = [];
  for (const it of items(s, false)) {
    const freq = repeatOf(it.kind, it.fields);
    if (freq === "off") continue;
    const now = periodKey(freq, today);
    const inPeriod = (d: string) => periodKey(freq, d) === now;
    const ticked = (it.fields.routineTicks ?? []).some(inPeriod);
    const logged = activity(s, it.kind, it.id, { ...it.fields, routineTicks: [] }).some(inPeriod);
    out.push({
      key: `${it.kind}:${it.id}`,
      kind: it.kind,
      id: it.id,
      title: it.title,
      freq,
      cat: it.cat,
      done: ticked || logged,
      auto: logged,
    });
  }
  return out;
}

/**
 * What a tick does to an item's ticks: one today when it isn't done for the
 * period, and none for the period when it is.
 */
export function toggledTicks(item: RoutineFields, kind: RoutineKind, today: string = dateKey()): string[] | undefined {
  const freq = repeatOf(kind, item);
  if (freq === "off") return item.routineTicks;
  const now = periodKey(freq, today);
  const ticks = item.routineTicks ?? [];
  const has = ticks.some((d) => periodKey(freq, d) === now);
  const next = has ? ticks.filter((d) => periodKey(freq, d) !== now) : [...ticks, today];
  return next.length ? next : undefined;
}

/**
 * Routines as completions, for the charts: one on the first day of activity
 * in each period an item was done. Only after the last hand-kept completion,
 * so the days the old recurring tasks covered aren't counted twice.
 */
export function routineCompletions(s: TrackerState): Completion[] {
  const since = s.completions.reduce((m, c) => (c.date > m ? c.date : m), "");
  const out: Completion[] = [];
  for (const it of items(s, true)) {
    const freq = repeatOf(it.kind, it.fields);
    if (freq === "off") continue;
    const first = new Map<string, string>();
    for (const d of activity(s, it.kind, it.id, it.fields)) {
      if (d <= since) continue;
      const p = periodKey(freq, d);
      const was = first.get(p);
      if (!was || d < was) first.set(p, d);
    }
    for (const date of first.values()) out.push({ date, catId: it.cat.id, taskId: `${it.kind}:${it.id}` });
  }
  return out;
}


/** Changes one goal, book or workout's routine fields. */
export function patchRoutineItem(
  s: TrackerState,
  kind: RoutineKind,
  id: string,
  fn: (item: RoutineFields) => RoutineFields
): TrackerState {
  const apply = <T extends RoutineFields & { id: string }>(list: T[]): T[] =>
    list.map((x) => (x.id === id ? { ...x, ...fn(x) } : x));
  if (kind === "goal") return { ...s, goals: apply(s.goals) };
  if (kind === "book") return { ...s, books: apply(s.books) };
  return { ...s, workouts: apply(s.workouts) };
}
