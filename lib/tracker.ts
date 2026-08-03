"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebase, isFirebaseConfigured } from "./firebase";

export type Category = { id: string; name: string; color: string };

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly";
export const FREQUENCIES: Frequency[] = ["daily", "weekly", "biweekly", "monthly"];
export const FREQ_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};
export const FREQ_ORDER: Record<Frequency, number> = {
  daily: 0, weekly: 1, biweekly: 2, monthly: 3,
};

/** A set of interchangeable recurring tasks: doing one covers the whole set. */
export type RecurringGroup = { id: string; name: string };

export type RecurringTask = {
  id: string;
  title: string;
  catId: string;
  freq: Frequency;
  lastDone: string | null;
  groupId?: string;
};

/** A step inside a goal, with its own optional current/target. */
export type Subtask = {
  id: string;
  title: string;
  current?: number;
  target?: number;
};

// A goal is a progress-tracked objective (e.g. "Read Atomic Habits" 132/396).
export type Goal = {
  id: string;
  title: string;
  catId: string;
  current?: number;
  target?: number;
  done: boolean;
  doneDate?: string | null;
  subtasks?: Subtask[];
  /** Pinned goals stay at the top of their column. */
  pinned?: boolean;
};

/** A one-off task: just a title and a tick. */
export type TodoItem = {
  id: string;
  title: string;
  done: boolean;
  doneDate?: string | null;
};

export type Completion = {
  date: string;
  catId: string;
  /** Set when the completion came from a group — one entry per group, not per task. */
  groupId?: string;
  /** Which task was actually ticked. */
  taskId?: string;
};

export type WeightEntry = { date: string; kg: number };

/**
 * A stretch of cardio, in minutes. Kept separate from workout sessions because
 * it carries no volume: it is time spent, not weight moved, and averaging the
 * two into one number would describe neither.
 *
 * Several a day are allowed — a bike before lifting and a walk after are two
 * efforts, not one — so each has an id and the day's total is their sum.
 */
export type CardioEntry = { id: string; date: string; minutes: number };

/** A meal category — breakfast, coffee, and so on — with its own colour. */
export type MealTag = { id: string; name: string; color: string };

export type CalorieEntry = {
  id: string;
  date: string;
  kcal: number;
  /** Which meal it belonged to. Absent on entries logged before tags. */
  tagId?: string;
};

/** Seeded the first time a device runs a build that has tags. */
const DEFAULT_MEAL_TAGS: MealTag[] = [
  { id: "mt1", name: "Breakfast", color: "#0f62fe" },
  { id: "mt2", name: "Lunch", color: "#33b1ff" },
  { id: "mt3", name: "Dinner", color: "#8a3ffc" },
  { id: "mt4", name: "Snack", color: "#ff8389" },
  { id: "mt5", name: "Coffee", color: "#491d8b" },
];

/** Colour shown for entries with no tag, or whose tag has been deleted. */
export const UNTAGGED_COLOR = "#a2a9b0";

/** One exercise inside a workout, with the weight it's performed at. */
export type Exercise = {
  id: string;
  name: string;
  /** Working weight in kg. Left out for bodyweight movements. */
  weight?: number;
};

/** The numbers that describe a single set. Shared by live and logged sets. */
export type SetRecord = { weight?: number; reps?: number };

/**
 * One set inside a live workout. A set is planned first and performed second:
 * `done` is what separates the two, and only done sets count towards volume.
 */
export type ActiveSet = SetRecord & { id: string; done?: boolean };

export type ActiveExercise = {
  exerciseId: string;
  /** Copied at start, so renaming or deleting mid-session can't break it. */
  name: string;
  /** The exercise's usual weight, used as the default for new sets. */
  weight?: number;
  sets: ActiveSet[];
  /**
   * Finished for this session. The sets stop being editable and are shown as
   * a plain record of what was lifted.
   */
  done?: boolean;
};

/** A workout in progress. At most one runs at a time. */
export type ActiveWorkout = {
  workoutId: string;
  name: string;
  startedAt: number;
  exercises: ActiveExercise[];
};

/**
 * Load moved by one set: weight × reps. Sets recorded before reps existed
 * count their weight once, so old sessions keep the total they were logged at.
 */
export function setLoad(set: SetRecord): number {
  const reps = set.reps != null && set.reps > 0 ? set.reps : 1;
  return (set.weight ?? 0) * reps;
}

/** Volume of a live workout. Only sets marked done count — planned ones don't. */
export function activeWorkoutVolume(a: ActiveWorkout): number {
  return a.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => (set.done ? s + setLoad(set) : s), 0),
    0
  );
}

/** How many sets have actually been completed. */
export function activeWorkoutSets(a: ActiveWorkout): number {
  return a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

/** How many sets are on the board, done or not. */
export function activeWorkoutPlannedSets(a: ActiveWorkout): number {
  return a.exercises.reduce((n, e) => n + e.sets.length, 0);
}

/**
 * Rewrites one exercise's set list inside the live workout, leaving the rest of
 * the state alone. Every set mutation below is the same three levels of
 * spreading, so it lives here once rather than five times.
 */
function editSets(
  s: TrackerState,
  exerciseId: string,
  fn: (sets: ActiveSet[]) => ActiveSet[]
): TrackerState {
  if (!s.activeWorkout) return s;
  return {
    ...s,
    activeWorkout: {
      ...s.activeWorkout,
      exercises: s.activeWorkout.exercises.map((e) =>
        e.exerciseId === exerciseId ? { ...e, sets: fn(e.sets) } : e
      ),
    },
  };
}

/** A weight or rep count, or undefined when the field was left empty. */
function positiveNumber(v: number | null | undefined): number | undefined {
  return v != null && Number.isFinite(v) && v > 0 ? v : undefined;
}

/** A named workout — "Push day", "Legs" — holding an ordered exercise list. */
export type Workout = {
  id: string;
  name: string;
  exercises: Exercise[];
};

/**
 * A completed workout. The total is a snapshot of the summed exercise weights
 * at the moment it was marked done, so later weight changes don't rewrite past
 * sessions.
 */
export type WorkoutSession = {
  id: string;
  workoutId: string;
  /** Name at the time, kept so the history survives a rename or delete. */
  name: string;
  date: string;
  total: number;
  /** Sets performed. Absent on sessions logged before live tracking. */
  sets?: number;
  /** Elapsed time in whole minutes, from start to finish. */
  minutes?: number;
  /**
   * What was actually performed, exercise by exercise. Absent on sessions
   * logged before per-set detail was kept, which is why every reader of it
   * has to cope with it being missing.
   */
  exercises?: LoggedExercise[];
};

/** One exercise as performed in a finished session. */
export type LoggedExercise = {
  exerciseId: string;
  name: string;
  sets: SetRecord[];
};

/**
 * The last time an exercise was actually performed, with the numbers used.
 * Sessions are only ever appended, so the newest match is the last one found.
 */
export function lastPerformed(
  sessions: WorkoutSession[],
  exerciseId: string
): { date: string; sets: SetRecord[] } | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const e = sessions[i].exercises?.find((x) => x.exerciseId === exerciseId);
    if (e && e.sets.length > 0) return { date: sessions[i].date, sets: e.sets };
  }
  return null;
}

/** A protein / fibre log entry. Either field may be omitted. */
export type MacroEntry = {
  id: string;
  date: string;
  protein?: number;
  fiber?: number;
};

export type TrackerState = {
  categories: Category[];
  goals: Goal[];
  recurring: RecurringTask[];
  recurringGroups: RecurringGroup[];
  todos: TodoItem[];
  completions: Completion[];
  weights: WeightEntry[];
  cardio: CardioEntry[];
  calories: CalorieEntry[];
  mealTags: MealTag[];
  /** Daily calorie budget, used to work out what's left for the week. */
  calorieBudget?: number;
  macros: MacroEntry[];
  workouts: Workout[];
  workoutSessions: WorkoutSession[];
  /** The workout currently under way, if any. */
  activeWorkout?: ActiveWorkout | null;
  /** Daily protein target, in grams. */
  proteinTarget?: number;
  /** Daily fibre target, in grams. */
  fiberTarget?: number;
};

/* The full chromatic range of the palette, plus its one usable neutral. */
/**
 * The colours a category or meal tag can be given. Carbon values throughout,
 * ordered by hue so the grid reads as a spectrum rather than a jumble, and
 * running light and dark within each family so neighbours stay distinguishable
 * on a small dot.
 *
 * The original seven are all still here and in the same form, so anything
 * already using one still matches a preset and shows as selected.
 */
export const CAT_COLORS = [
  "#0f62fe", "#78a9ff", "#0072c3", "#33b1ff", "#08bdba",
  "#007d79", "#24a148", "#42be65", "#a7f0ba", "#f1c21b",
  "#ff832b", "#ba4e00", "#da1e28", "#ff8389", "#ee5396",
  "#9f1853", "#8a3ffc", "#be95ff", "#491d8b", "#a2a9b0",
];

/** Picks a colour no existing category is already using. */
export function nextCategoryColor(existing: { color: string }[]): string {
  const used = new Set(existing.map((c) => c.color.toLowerCase()));
  const free = CAT_COLORS.find((c) => !used.has(c.toLowerCase()));
  if (free) return free;
  // Palette exhausted — cycle through it again rather than generating new hues,
  // so every category stays on the brand palette even when they repeat.
  return CAT_COLORS[existing.length % CAT_COLORS.length];
}

const KEY = "momentum:v1";

const DEFAULT_CATEGORIES: Category[] = [
  { id: "c1", name: "Work", color: "#0f62fe" },
  { id: "c2", name: "Pressio", color: "#a7f0ba" },
  { id: "c3", name: "Learning", color: "#8a3ffc" },
  { id: "c4", name: "Gym", color: "#ff8389" },
  { id: "c5", name: "Personal", color: "#33b1ff" },
];

/** Colours from every earlier theme → their current-palette replacements.
 *  Roles run Work / Pressio / Learning / Gym / Personal, era by era. Targets
 *  are retargeted whenever the palette changes, so a value saved under any
 *  past theme lands on a colour the palette still contains. */
const LEGACY_CATEGORY_COLORS: Record<string, string> = {
  // HeroUI originals
  "#006fee": "#0f62fe", "#17c964": "#a7f0ba", "#7828c8": "#8a3ffc",
  "#f31260": "#ff8389", "#f5a524": "#33b1ff",
  // Atlassian era
  "#357de8": "#0f62fe", "#22a06b": "#a7f0ba", "#af59e1": "#8a3ffc",
  "#ae2e24": "#ff8389", "#c75300": "#33b1ff",
  // green-brand era
  "#2180e6": "#0f62fe", "#1ea97b": "#a7f0ba", "#264b04": "#8a3ffc",
  "#72c613": "#ff8389", "#c8efc1": "#33b1ff",
  // Neo Retro era
  "#a6a9be": "#0f62fe", "#1e3a1e": "#a7f0ba", "#0e0e0e": "#8a3ffc",
  "#e0761b": "#ff8389", "#b8c2c2": "#33b1ff",
  // Carbon era, before the palette was cut to thirteen colours
  "#009d9a": "#a7f0ba", "#ee5396": "#ff8389", "#1192e8": "#33b1ff",
  "#08bdba": "#33b1ff", "#ff7eb6": "#ff8389", "#ff832b": "#491d8b",
  "#24a148": "#a7f0ba", "#6929c4": "#491d8b", "#6f6f6f": "#a2a9b0",
  "#4589ff": "#0f62fe", "#42be65": "#a7f0ba", "#fa4d56": "#ff8389",
  "#a56eff": "#491d8b", "#da1e28": "#ff8389", "#f1c21b": "#a7f0ba",
  "#161616": "#121619", "#c6c6c6": "#a2a9b0", "#33b1ff": "#33b1ff",
};

const DEFAULT_STATE: TrackerState = {
  categories: DEFAULT_CATEGORIES,
  goals: [],
  recurring: [],
  recurringGroups: [],
  todos: [],
  completions: [],
  weights: [],
  cardio: [],
  calories: [],
  mealTags: DEFAULT_MEAL_TAGS,
  macros: [],
  workouts: [],
  workoutSessions: [],
  activeWorkout: null,
};

/** Monday-based start of the current week, as a YYYY-MM-DD key. */
export function weekStart(d: Date = new Date()): string {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dateKey(x);
}

/** Calories left in the current week: budget x 7 minus everything logged. */
export function caloriesLeftThisWeek(
  calories: CalorieEntry[],
  budget?: number
): number | null {
  if (!budget || budget <= 0) return null;
  const from = weekStart();
  const logged = calories
    .filter((e) => e.date >= from && e.date <= dateKey())
    .reduce((a, e) => a + e.kcal, 0);
  return budget * 7 - logged;
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function dateKey(d: Date = new Date()): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function daysSinceEpoch(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function periodKey(freq: Frequency, key: string): string {
  switch (freq) {
    case "daily":
      return key;
    case "weekly":
      return "w" + Math.floor(daysSinceEpoch(key) / 7);
    case "biweekly":
      return "b" + Math.floor(daysSinceEpoch(key) / 14);
    case "monthly":
      return key.slice(0, 7);
  }
}

export function isRecurringDone(r: RecurringTask, today: string = dateKey()): boolean {
  return !!r.lastDone && periodKey(r.freq, r.lastDone) === periodKey(r.freq, today);
}

/**
 * Counting units for stats: an ungrouped task counts once, and a whole group
 * counts once (doing any member covers the group).
 */
export function recurringUnits(
  recurring: RecurringTask[],
  today: string = dateKey()
): { key: string; done: boolean }[] {
  const seen = new Set<string>();
  const units: { key: string; done: boolean }[] = [];
  for (const r of recurring) {
    const key = r.groupId ?? r.id;
    if (seen.has(key)) continue;
    seen.add(key);
    units.push({ key, done: isRecurringDone(r, today) });
  }
  return units;
}

export function subtaskPct(t: Subtask): number {
  if (!t.target || t.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((t.current ?? 0) / t.target) * 100)));
}

/** Subtasks that actually carry a target (i.e. have a percentage of their own). */
function measuredSubtasks(g: Goal): Subtask[] {
  return (g.subtasks ?? []).filter((t) => typeof t.target === "number" && t.target > 0);
}

/** True when there is any percentage to show at all. */
export function goalHasProgress(g: Goal): boolean {
  return measuredSubtasks(g).length > 0 || (typeof g.target === "number" && g.target > 0);
}

/** True when the shown percentage comes from subtasks rather than the goal itself. */
export function goalIsDerived(g: Goal): boolean {
  return measuredSubtasks(g).length > 0;
}

/**
 * A goal's percentage.
 * - No subtasks, or no subtask carries a target → the goal's own current/target.
 * - At least one subtask carries a target → the combined total across those
 *   subtasks (all progress summed over all targets), so a small subtask being
 *   part-done can't inflate the whole goal.
 *
 * Floored, so the figure never claims more progress than has actually happened
 * and only reaches 100% when everything really is finished.
 */
export function goalPct(g: Goal): number {
  const measured = measuredSubtasks(g);
  if (measured.length > 0) {
    const current = measured.reduce((a, t) => a + Math.min(t.current ?? 0, t.target ?? 0), 0);
    const target = measured.reduce((a, t) => a + (t.target ?? 0), 0);
    if (target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.floor((current / target) * 100)));
  }
  if (!g.target || g.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor(((g.current ?? 0) / g.target) * 100)));
}

function migrate(raw: unknown): TrackerState {
  const s = (raw ?? {}) as Record<string, unknown>;
  const categories = Array.isArray(s.categories)
    ? (s.categories as Category[]).map((c) => ({
        ...c,
        // Colours saved before the rebrand are moved onto the palette;
        // anything the user picked themselves is left untouched.
        color: LEGACY_CATEGORY_COLORS[c.color?.toLowerCase()] ?? c.color,
      }))
    : DEFAULT_CATEGORIES;

  const recurring: RecurringTask[] = Array.isArray(s.recurring)
    ? (s.recurring as Array<Record<string, unknown>>).map((r) => ({
        id: (r.id as string) ?? uid(),
        title: r.title as string,
        catId: r.catId as string,
        freq: (r.freq as Frequency) ?? "daily",
        lastDone: (r.lastDone as string) ?? null,
        groupId: (r.groupId as string) ?? undefined,
      }))
    : [];

  const recurringGroups: RecurringGroup[] = Array.isArray(s.recurringGroups)
    ? (s.recurringGroups as RecurringGroup[])
    : [];

  // Goals come from `goals`, or the older `board`/`tasks` shapes.
  const rawGoals: Array<Record<string, unknown>> = Array.isArray(s.goals)
    ? (s.goals as Array<Record<string, unknown>>)
    : Array.isArray(s.board)
    ? (s.board as Array<Record<string, unknown>>)
    : Array.isArray(s.tasks)
    ? (s.tasks as Array<Record<string, unknown>>)
    : [];
  const goals: Goal[] = rawGoals.map((g) => ({
    id: (g.id as string) ?? uid(),
    title: g.title as string,
    catId: g.catId as string,
    current: typeof g.current === "number" ? g.current : undefined,
    target: typeof g.target === "number" ? g.target : undefined,
    done: typeof g.done === "boolean" ? g.done : g.status === "done",
    doneDate: (g.doneDate as string) ?? null,
    pinned: g.pinned === true ? true : undefined,
    subtasks: Array.isArray(g.subtasks)
      ? (g.subtasks as Array<Record<string, unknown>>).map((t) => ({
          id: (t.id as string) ?? uid(),
          title: t.title as string,
          current: typeof t.current === "number" ? t.current : undefined,
          target: typeof t.target === "number" ? t.target : undefined,
        }))
      : [],
  }));

  const todos: TodoItem[] = Array.isArray(s.todos)
    ? (s.todos as Array<Record<string, unknown>>).map((t) => ({
        id: (t.id as string) ?? uid(),
        title: t.title as string,
        done: !!t.done,
        doneDate: (t.doneDate as string) ?? null,
      }))
    : [];

  const completions: Completion[] = Array.isArray(s.completions)
    ? (s.completions as Completion[])
    : [];

  const weights: WeightEntry[] = Array.isArray(s.weights)
    ? (s.weights as WeightEntry[])
    : [];

  // Added after cardio tracking existed only as workout minutes, so older
  // saved state has no key at all.
  const cardio: CardioEntry[] = Array.isArray(s.cardio) ? (s.cardio as CardioEntry[]) : [];

  const calories: CalorieEntry[] = Array.isArray(s.calories)
    ? (s.calories as CalorieEntry[])
    : [];

  // Absent means this state predates tags, so seed the defaults. An empty
  // array means the reader deleted them all, which we leave alone.
  const mealTags: MealTag[] = Array.isArray(s.mealTags)
    ? (s.mealTags as MealTag[])
    : DEFAULT_MEAL_TAGS;

  // Added after the first release, so older saved state has no macros key.
  const macros: MacroEntry[] = Array.isArray(s.macros) ? (s.macros as MacroEntry[]) : [];

  const workoutSessions: WorkoutSession[] = Array.isArray(s.workoutSessions)
    ? (s.workoutSessions as WorkoutSession[])
    : [];

  const activeWorkout =
    s.activeWorkout && typeof s.activeWorkout === "object"
      ? (s.activeWorkout as ActiveWorkout)
      : null;

  const workouts: Workout[] = Array.isArray(s.workouts)
    ? (s.workouts as Workout[]).map((w) => ({
        ...w,
        exercises: Array.isArray(w.exercises) ? w.exercises : [],
      }))
    : [];

  const positive = (v: unknown) => {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return {
    // Anything this build doesn't recognise is carried through untouched.
    // Without this, a device running an older bundle would parse a document
    // containing newer fields, drop them, and then write the pruned state back
    // — silently deleting that data for every other device.
    ...(s as Partial<TrackerState>),
    categories,
    goals,
    recurring,
    recurringGroups,
    todos,
    completions,
    weights,
    cardio,
    calories,
    mealTags,
    calorieBudget:
      typeof s.calorieBudget === "number" && s.calorieBudget > 0 ? s.calorieBudget : undefined,
    macros,
    workouts,
    workoutSessions,
    activeWorkout,
    proteinTarget: positive(s.proteinTarget),
    fiberTarget: positive(s.fiberTarget),
  };
}

/** Strips `undefined` values — Firestore rejects them outright. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function friendlyAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/missing-password":
      return "Enter a password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/email-already-in-use":
      return "An account with that email already exists — sign in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/unauthorized-domain":
      return "This site's domain isn't authorized in Firebase. Add it under Authentication → Settings → Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function useTracker() {
  const [state, setState] = useState<TrackerState | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loaded = useRef(false);
  const stateRef = useRef<TrackerState | null>(null);
  const userRef = useRef<User | null>(null);
  const lastUpdated = useRef(0);
  // true once this signed-in user's cloud doc has been read at least once
  const remoteSynced = useRef(false);
  // skips caching a state change (used for the sign-out reset)
  const suppressPersist = useRef(false);

  // ---- load cached copy for first paint ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const rawState = parsed && parsed.state ? parsed.state : parsed ?? DEFAULT_STATE;
      lastUpdated.current = parsed && typeof parsed.updated === "number" ? parsed.updated : 0;
      setState(migrate(rawState));
    } catch {
      setState(DEFAULT_STATE);
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // ---- auth ----
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const fb = getFirebase();
    if (!fb) {
      setAuthReady(true);
      return;
    }
    getRedirectResult(fb.auth).catch((e) =>
      setAuthError(friendlyAuthError((e as { code?: string }).code ?? ""))
    );
    return onAuthStateChanged(fb.auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  // ---- live cloud subscription: the database is the source of truth ----
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const fb = getFirebase();
    if (!fb) return;
    remoteSynced.current = false;
    const ref = doc(fb.db, "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return; // our own write, not yet acked
        remoteSynced.current = true;
        if (snap.exists()) {
          const data = snap.data();
          const remoteUpdated = typeof data.updated === "number" ? data.updated : 0;
          if (data.state && remoteUpdated !== lastUpdated.current) {
            lastUpdated.current = remoteUpdated;
            setState(migrate(data.state));
          }
        } else {
          // no cloud record yet — seed it from whatever is on screen
          const updated = Date.now();
          setDoc(ref, clean({ state: stateRef.current ?? DEFAULT_STATE, updated }))
            .then(() => {
              lastUpdated.current = updated;
              setSyncError(null);
            })
            .catch((e) => {
              console.error("seed failed", e);
              setSyncError("Couldn't create your cloud record.");
            });
        }
      },
      (err) => {
        console.error("snapshot error", err);
        setSyncError("Can't read your data from the cloud.");
      }
    );
  }, [user]);

  // ---- cache to localStorage for fast first paint (never the source of truth) ----
  useEffect(() => {
    if (!loaded.current || !state) return;
    if (suppressPersist.current) {
      suppressPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify({ state, updated: lastUpdated.current }));
    } catch (e) {
      console.error("cache write failed", e);
    }
  }, [state]);

  /**
   * Applies a change by WRITING IT TO THE DATABASE FIRST. The on-screen state is
   * only updated once the write is acknowledged, so the UI always reflects what
   * is actually stored. Resolves true on success, false on failure.
   */
  const commit = async (fn: (s: TrackerState) => TrackerState): Promise<boolean> => {
    const base = stateRef.current;
    if (!base) return false;
    const next = fn(base);

    // Local-only mode (Firebase not configured, or signed out): commit directly.
    if (!isFirebaseConfigured || !userRef.current) {
      lastUpdated.current = Date.now();
      stateRef.current = next;
      setState(next);
      return true;
    }

    const fb = getFirebase();
    if (!fb) return false;

    // Don't write until we've read the cloud copy, or we could clobber it.
    if (!remoteSynced.current) {
      setSyncError("Still connecting to the cloud — try again in a moment.");
      return false;
    }

    const updated = Date.now();
    const prevState = base;
    const prevUpdated = lastUpdated.current;

    // Apply locally first, then write. Waiting for the round trip before
    // touching state made every edit feel a network hop slow.
    // The ref is updated synchronously because React state only lands on the
    // next render, and a second write issued immediately after this one would
    // otherwise start from the stale state and undo this change.
    lastUpdated.current = updated;
    stateRef.current = next;
    setState(next);

    try {
      await setDoc(doc(fb.db, "users", userRef.current.uid), clean({ state: next, updated }));
      setSyncError(null);
      return true;
    } catch (e) {
      console.error("save failed", e);
      // Put it back, so the screen never claims something was saved that wasn't.
      lastUpdated.current = prevUpdated;
      stateRef.current = prevState;
      setState(prevState);
      setSyncError("Couldn't save to the cloud. Your change was not applied.");
      return false;
    }
  };

  /**
   * The returned object is memoised on the five values that actually drive the
   * UI. Previously it was a fresh literal with some sixty inline functions on
   * every render, so its identity changed constantly and every consumer
   * re-rendered whenever anything in page.tsx moved — opening a modal,
   * collapsing a section, the desktop media query resolving. React.memo on a
   * child was inert against it.
   *
   * Safe to memoise because the mutating closures read through stateRef rather
   * than capturing state, and the three that do read state directly (catOf,
   * catInUse, groupInUse) have it as a dependency here.
   */
  return useMemo(() => ({
    state,

    // ---- auth ----
    firebaseConfigured: isFirebaseConfigured,
    user,
    authReady,
    authError,
    syncError,
    clearAuthError: () => setAuthError(null),
    clearSyncError: () => setSyncError(null),

    signIn: async (email: string, password: string) => {
      const fb = getFirebase();
      if (!fb) return;
      setAuthError(null);
      try {
        await signInWithEmailAndPassword(fb.auth, email, password);
      } catch (e) {
        setAuthError(friendlyAuthError((e as { code?: string }).code ?? ""));
      }
    },
    signUp: async (email: string, password: string) => {
      const fb = getFirebase();
      if (!fb) return;
      setAuthError(null);
      try {
        await createUserWithEmailAndPassword(fb.auth, email, password);
      } catch (e) {
        setAuthError(friendlyAuthError((e as { code?: string }).code ?? ""));
      }
    },
    signInWithGoogle: async () => {
      const fb = getFirebase();
      if (!fb) return;
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(fb.auth, provider);
      } catch (e) {
        const code = (e as { code?: string }).code ?? "";
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
          try {
            await signInWithRedirect(fb.auth, provider);
          } catch (e2) {
            setAuthError(friendlyAuthError((e2 as { code?: string }).code ?? ""));
          }
          return;
        }
        setAuthError(friendlyAuthError(code));
      }
    },
    signOutUser: async () => {
      const fb = getFirebase();
      if (!fb) return;
      // Every change is already written, so nothing to flush. Clear the screen
      // WITHOUT persisting the empty state anywhere.
      suppressPersist.current = true;
      await signOut(fb.auth);
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      lastUpdated.current = 0;
      remoteSynced.current = false;
      setState(DEFAULT_STATE);
    },

    // ---- lookups ----
    cat: (id: string): Category =>
      state?.categories.find((c) => c.id === id) ?? { id: "", name: "–", color: "#a2a9b0" },

    categoryInUse: (id: string): boolean =>
      !!state?.recurring.some((r) => r.catId === id) || !!state?.goals.some((g) => g.catId === id),

    // ---- goals ----
    addGoal: (title: string, catId: string, current: number | null, target: number | null) =>
      commit((s) => ({
        ...s,
        goals: [
          ...s.goals,
          {
            id: uid(),
            title,
            catId,
            current: current != null && Number.isFinite(current) && current >= 0 ? current : undefined,
            target: target != null && Number.isFinite(target) && target > 0 ? target : undefined,
            done: false,
            doneDate: null,
          },
        ],
      })),

    /** Saves every editable field of a goal in a single write. */
    saveGoal: (
      id: string,
      patch: { title?: string; catId?: string; current: number | null; target: number | null }
    ) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === id
            ? {
                ...g,
                title: patch.title?.trim() || g.title,
                catId: patch.catId ?? g.catId,
                current:
                  patch.current != null && Number.isFinite(patch.current) && patch.current >= 0
                    ? patch.current
                    : undefined,
                target:
                  patch.target != null && Number.isFinite(patch.target) && patch.target > 0
                    ? patch.target
                    : undefined,
              }
            : g
        ),
      })),

    updateGoal: (id: string, patch: { title?: string; catId?: string }) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === id
            ? { ...g, title: patch.title?.trim() || g.title, catId: patch.catId ?? g.catId }
            : g
        ),
      })),

    setGoalProgress: (id: string, current: number | null, target: number | null) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === id
            ? {
                ...g,
                current: current != null && Number.isFinite(current) && current >= 0 ? current : undefined,
                target: target != null && Number.isFinite(target) && target > 0 ? target : undefined,
              }
            : g
        ),
      })),

    toggleGoalDone: (id: string) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === id ? { ...g, done: !g.done, doneDate: !g.done ? dateKey() : null } : g
        ),
      })),

    cycleGoalCat: (id: string) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) => {
          if (g.id !== id) return g;
          const i = s.categories.findIndex((c) => c.id === g.catId);
          const next = s.categories[(i + 1) % s.categories.length];
          return { ...g, catId: next?.id ?? g.catId };
        }),
      })),

    deleteGoal: (id: string) => commit((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),

    toggleGoalPin: (id: string) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) => (g.id === id ? { ...g, pinned: g.pinned ? undefined : true } : g)),
      })),

    /** Reorders goals to match the given list of ids. */
    reorderGoals: (ids: string[]) =>
      commit((s) => {
        const byId = new Map(s.goals.map((g) => [g.id, g]));
        const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof s.goals;
        const missing = s.goals.filter((g) => !ids.includes(g.id));
        return { ...s, goals: [...ordered, ...missing] };
      }),

    // ---- subtasks ----
    addSubtask: (goalId: string, title: string, current: number | null, target: number | null) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === goalId
            ? {
                ...g,
                subtasks: [
                  ...(g.subtasks ?? []),
                  {
                    id: uid(),
                    title,
                    current:
                      current != null && Number.isFinite(current) && current >= 0 ? current : undefined,
                    target: target != null && Number.isFinite(target) && target > 0 ? target : undefined,
                  },
                ],
              }
            : g
        ),
      })),

    setSubtaskProgress: (
      goalId: string,
      subtaskId: string,
      current: number | null,
      target: number | null,
      title?: string
    ) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === goalId
            ? {
                ...g,
                subtasks: (g.subtasks ?? []).map((t) =>
                  t.id === subtaskId
                    ? {
                        ...t,
                        title: title?.trim() || t.title,
                        current:
                          current != null && Number.isFinite(current) && current >= 0
                            ? current
                            : undefined,
                        target:
                          target != null && Number.isFinite(target) && target > 0 ? target : undefined,
                      }
                    : t
                ),
              }
            : g
        ),
      })),

    deleteSubtask: (goalId: string, subtaskId: string) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === goalId
            ? { ...g, subtasks: (g.subtasks ?? []).filter((t) => t.id !== subtaskId) }
            : g
        ),
      })),

    // ---- recurring ----
    addRecurring: (title: string, catId: string, freq: Frequency, groupId?: string) =>
      commit((s) => ({
        ...s,
        recurring: [
          ...s.recurring,
          {
            id: uid(),
            title,
            catId,
            freq,
            groupId: groupId || undefined,
            // members of a group share their done-state
            lastDone: groupId
              ? s.recurring.find((r) => r.groupId === groupId)?.lastDone ?? null
              : null,
          },
        ],
      })),

    toggleRecurring: (id: string) =>
      commit((s) => {
        const today = dateKey();
        const r = s.recurring.find((x) => x.id === id);
        if (!r) return s;

        // Doing any member of a group covers every member of that group.
        const members = r.groupId ? s.recurring.filter((x) => x.groupId === r.groupId) : [r];
        const memberIds = new Set(members.map((m) => m.id));

        if (isRecurringDone(r, today)) {
          // Un-tick: clear the whole group and drop its single completion.
          const doneDate = r.lastDone;
          let removed = false;
          const completions = s.completions.filter((c) => {
            if (removed || c.date !== doneDate) return true;
            const isThisUnit = r.groupId
              ? c.groupId === r.groupId
              : !c.groupId && (c.taskId === r.id || (c.taskId === undefined && c.catId === r.catId));
            if (isThisUnit) {
              removed = true;
              return false;
            }
            return true;
          });
          return {
            ...s,
            recurring: s.recurring.map((x) =>
              memberIds.has(x.id) ? { ...x, lastDone: null } : x
            ),
            completions,
          };
        }

        // Tick: mark every member done, log ONE completion for the unit.
        return {
          ...s,
          recurring: s.recurring.map((x) =>
            memberIds.has(x.id) ? { ...x, lastDone: today } : x
          ),
          completions: [
            ...s.completions,
            { date: today, catId: r.catId, groupId: r.groupId, taskId: r.id },
          ],
        };
      }),

    updateRecurring: (
      id: string,
      patch: { title?: string; catId?: string; freq?: Frequency; groupId?: string }
    ) =>
      commit((s) => {
        const groupId = patch.groupId || undefined;
        const prev = s.recurring.find((r) => r.id === id);
        const joining = groupId && groupId !== prev?.groupId;
        const groupLastDone = joining
          ? s.recurring.find((r) => r.groupId === groupId)?.lastDone ?? null
          : undefined;

        return {
          ...s,
          recurring: s.recurring.map((r) =>
            r.id === id
              ? {
                  ...r,
                  title: patch.title?.trim() || r.title,
                  catId: patch.catId ?? r.catId,
                  freq: patch.freq ?? r.freq,
                  groupId,
                  lastDone: groupLastDone !== undefined ? groupLastDone : r.lastDone,
                }
              : r
          ),
        };
      }),

    deleteRecurring: (id: string) =>
      commit((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== id) })),

    // ---- categories ----
    /** Adds a category. Without a colour it takes the next unused preset. */
    addCategory: (name: string, color?: string) =>
      commit((s) => ({
        ...s,
        categories: [
          ...s.categories,
          { id: uid(), name, color: color || nextCategoryColor(s.categories) },
        ],
      })),

    /**
     * Changes a category's name and colour. The id is left alone, so
     * everything already filed under it keeps its filing.
     */
    updateCategory: (id: string, name: string, color?: string) =>
      commit((s) => {
        const n = name.trim();
        if (!n) return s;
        return {
          ...s,
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, name: n, color: color || c.color } : c
          ),
        };
      }),

    deleteCategory: (id: string) =>
      commit((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) })),

    // ---- to-dos ----
    addTodo: (title: string) =>
      commit((s) => ({
        ...s,
        todos: [...s.todos, { id: uid(), title: title.trim(), done: false, doneDate: null }],
      })),

    toggleTodo: (id: string) =>
      commit((s) => ({
        ...s,
        todos: s.todos.map((t) =>
          t.id === id ? { ...t, done: !t.done, doneDate: !t.done ? dateKey() : null } : t
        ),
      })),

    deleteTodo: (id: string) =>
      commit((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) })),

    // ---- recurring groups ----
    groupInUse: (id: string): boolean => !!state?.recurring.some((r) => r.groupId === id),

    addGroup: (name: string) =>
      commit((s) => ({
        ...s,
        recurringGroups: [...s.recurringGroups, { id: uid(), name: name.trim() }],
      })),

    deleteGroup: (id: string) =>
      commit((s) => ({
        ...s,
        recurringGroups: s.recurringGroups.filter((g) => g.id !== id),
      })),

    // ---- weight ----
    addWeight: (kg: number) =>
      commit((s) => {
        if (!Number.isFinite(kg) || kg <= 0) return s;
        const today = dateKey();
        const exists = s.weights.some((w) => w.date === today);
        const weights = exists
          ? s.weights.map((w) => (w.date === today ? { ...w, kg } : w))
          : [...s.weights, { date: today, kg }];
        weights.sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, weights };
      }),

    /**
     * Logs a stretch of cardio against today. Adds rather than replaces, so a
     * second effort in the same day is recorded as its own entry instead of
     * overwriting the first.
     */
    addCardio: (minutes: number) =>
      commit((s) => {
        if (!Number.isFinite(minutes) || minutes <= 0) return s;
        const entry: CardioEntry = {
          id: uid(),
          date: dateKey(),
          minutes: Math.round(minutes),
        };
        const cardio = [...s.cardio, entry].sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, cardio };
      }),

    removeCardio: (id: string) =>
      commit((s) => ({ ...s, cardio: s.cardio.filter((c) => c.id !== id) })),

    setCalorieBudget: (kcal: number | null) =>
      commit((s) => ({
        ...s,
        calorieBudget: kcal != null && Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : undefined,
      })),

    // ---- calories ----
    /**
     * Logs calories. `date` allows an entry to be put on an earlier day —
     * yesterday's dinner remembered this morning — and defaults to today.
     * Entries stay sorted by date so a backdated one lands in its own day
     * rather than at the end of the list.
     */
    addCalories: (kcal: number, tagId?: string, date?: string) =>
      commit((s) => {
        if (!Number.isFinite(kcal) || kcal <= 0) return s;
        const entry: CalorieEntry = { id: uid(), date: date || dateKey(), kcal: Math.round(kcal) };
        if (tagId) entry.tagId = tagId;
        // Appended, so array order is the order things were eaten that day.
        // A stable sort keeps that order within each day while moving a
        // backdated entry back among its own.
        const calories = [...s.calories, entry].sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, calories };
      }),

    updateCalorieEntry: (id: string, kcal: number, tagId?: string) =>
      commit((s) => {
        if (!Number.isFinite(kcal) || kcal <= 0) return s;
        return {
          ...s,
          calories: s.calories.map((e) =>
            e.id !== id ? e : { id: e.id, date: e.date, kcal: Math.round(kcal), ...(tagId ? { tagId } : {}) }
          ),
        };
      }),

    removeCalorieEntry: (id: string) =>
      commit((s) => ({ ...s, calories: s.calories.filter((e) => e.id !== id) })),

    addMealTag: (name: string, color: string) =>
      commit((s) => {
        const clean = name.trim();
        if (!clean) return s;
        return { ...s, mealTags: [...s.mealTags, { id: uid(), name: clean, color }] };
      }),

    updateMealTag: (id: string, name: string, color: string) =>
      commit((s) => {
        const clean = name.trim();
        if (!clean) return s;
        return {
          ...s,
          mealTags: s.mealTags.map((m) => (m.id === id ? { ...m, name: clean, color } : m)),
        };
      }),

    /** Entries keep their tag id; they simply fall back to the untagged colour. */
    removeMealTag: (id: string) =>
      commit((s) => ({ ...s, mealTags: s.mealTags.filter((m) => m.id !== id) })),

    // ---- protein and fibre ----
    /** Logs protein and/or fibre for today. Either value may be left out. */
    addMacros: (protein: number | null, fiber: number | null) =>
      commit((s) => {
        const p = protein != null && Number.isFinite(protein) && protein > 0 ? Math.round(protein) : undefined;
        const f = fiber != null && Number.isFinite(fiber) && fiber > 0 ? Math.round(fiber) : undefined;
        if (p === undefined && f === undefined) return s;
        const entry: MacroEntry = { id: uid(), date: dateKey() };
        if (p !== undefined) entry.protein = p;
        if (f !== undefined) entry.fiber = f;
        return { ...s, macros: [...s.macros, entry] };
      }),

    setProteinTarget: (grams: number | null) =>
      commit((s) => ({
        ...s,
        proteinTarget:
          grams != null && Number.isFinite(grams) && grams > 0 ? Math.round(grams) : undefined,
      })),

    // ---- workouts ----
    addWorkout: (name: string) =>
      commit((s) => {
        const clean = name.trim();
        if (!clean) return s;
        return { ...s, workouts: [...s.workouts, { id: uid(), name: clean, exercises: [] }] };
      }),

    renameWorkout: (workoutId: string, name: string) =>
      commit((s) => {
        const clean = name.trim();
        if (!clean) return s;
        return {
          ...s,
          workouts: s.workouts.map((w) => (w.id === workoutId ? { ...w, name: clean } : w)),
        };
      }),

    removeWorkout: (workoutId: string) =>
      commit((s) => ({ ...s, workouts: s.workouts.filter((w) => w.id !== workoutId) })),

    addExercise: (workoutId: string, name: string, weight: number | null) =>
      commit((s) => {
        const clean = name.trim();
        if (!clean) return s;
        const ex: Exercise = { id: uid(), name: clean };
        if (weight != null && Number.isFinite(weight) && weight > 0) ex.weight = weight;
        return {
          ...s,
          workouts: s.workouts.map((w) =>
            w.id === workoutId ? { ...w, exercises: [...w.exercises, ex] } : w
          ),
        };
      }),

    updateExercise: (workoutId: string, exerciseId: string, name: string, weight: number | null) =>
      commit((s) => {
        const clean = name.trim();
        if (!clean) return s;
        return {
          ...s,
          workouts: s.workouts.map((w) =>
            w.id !== workoutId
              ? w
              : {
                  ...w,
                  exercises: w.exercises.map((e) =>
                    e.id !== exerciseId
                      ? e
                      : {
                          id: e.id,
                          name: clean,
                          ...(weight != null && Number.isFinite(weight) && weight > 0
                            ? { weight }
                            : {}),
                        }
                  ),
                }
          ),
        };
      }),

    removeExercise: (workoutId: string, exerciseId: string) =>
      commit((s) => ({
        ...s,
        workouts: s.workouts.map((w) =>
          w.id === workoutId
            ? { ...w, exercises: w.exercises.filter((e) => e.id !== exerciseId) }
            : w
        ),
      })),

    moveExercise: (workoutId: string, exerciseId: string, dir: -1 | 1) =>
      commit((s) => ({
        ...s,
        workouts: s.workouts.map((w) => {
          if (w.id !== workoutId) return w;
          const i = w.exercises.findIndex((e) => e.id === exerciseId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= w.exercises.length) return w;
          const next = [...w.exercises];
          [next[i], next[j]] = [next[j], next[i]];
          return { ...w, exercises: next };
        }),
      })),

    /** Begins a workout. Nothing is logged until it is finished. */
    startWorkout: (workoutId: string) =>
      commit((s) => {
        const w = s.workouts.find((x) => x.id === workoutId);
        if (!w || s.activeWorkout) return s;
        return {
          ...s,
          activeWorkout: {
            workoutId,
            name: w.name,
            startedAt: Date.now(),
            exercises: w.exercises.map((e) => ({
              exerciseId: e.id,
              name: e.name,
              weight: e.weight,
              sets: [],
            })),
          },
        };
      }),

    /**
     * Adds a set to work on. It starts out not done: performing it is the
     * separate step below. The numbers are seeded from the set before it, or —
     * for the first set of an exercise — from the last time it was performed,
     * so the common case is press, press, done.
     */
    addSet: (exerciseId: string) =>
      commit((s) => {
        if (!s.activeWorkout) return s;
        const ex = s.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
        if (!ex) return s;
        const previous = ex.sets[ex.sets.length - 1];
        const history = lastPerformed(s.workoutSessions, exerciseId)?.sets ?? [];
        const seed: SetRecord = previous
          ? { weight: previous.weight, reps: previous.reps }
          : history[0] ?? { weight: ex.weight };
        return editSets(s, exerciseId, (sets) => [...sets, { id: uid(), ...seed, done: false }]);
      }),

    /**
     * Copies a set to the end of the list as a fresh, undone one — for the
     * usual case of doing the same thing again.
     */
    duplicateSet: (exerciseId: string, setId: string) =>
      commit((s) =>
        editSets(s, exerciseId, (sets) => {
          const source = sets.find((x) => x.id === setId);
          if (!source) return sets;
          return [
            ...sets,
            { id: uid(), weight: source.weight, reps: source.reps, done: false },
          ];
        })
      ),

    removeSet: (exerciseId: string, setId: string) =>
      commit((s) => editSets(s, exerciseId, (sets) => sets.filter((x) => x.id !== setId))),

    setSetWeight: (exerciseId: string, setId: string, weight: number | null) =>
      commit((s) =>
        editSets(s, exerciseId, (sets) =>
          sets.map((x) => (x.id === setId ? { ...x, weight: positiveNumber(weight) } : x))
        )
      ),

    setSetReps: (exerciseId: string, setId: string, reps: number | null) =>
      commit((s) =>
        editSets(s, exerciseId, (sets) =>
          sets.map((x) =>
            x.id === setId ? { ...x, reps: positiveNumber(reps ? Math.round(reps) : null) } : x
          )
        )
      ),

    /**
     * Marks a whole exercise finished. Every set it holds is completed with
     * it: saying the exercise is done is saying its sets were performed, and
     * leaving one behind would drop that work from the session's volume.
     * Reopening only reopens the exercise — the sets stay as they were, so
     * nothing has to be re-entered to correct a single number.
     */
    setExerciseDone: (exerciseId: string, done: boolean) =>
      commit((s) => {
        if (!s.activeWorkout) return s;
        return {
          ...s,
          activeWorkout: {
            ...s.activeWorkout,
            exercises: s.activeWorkout.exercises.map((e) =>
              e.exerciseId !== exerciseId
                ? e
                : {
                    ...e,
                    done,
                    sets: done ? e.sets.map((x) => ({ ...x, done: true })) : e.sets,
                  }
            ),
          },
        };
      }),

    /**
     * The second step: the set has been performed. Only now does it count
     * towards the workout's volume, and only now can it be logged.
     */
    setSetDone: (exerciseId: string, setId: string, done: boolean) =>
      commit((s) =>
        editSets(s, exerciseId, (sets) =>
          sets.map((x) => (x.id === setId ? { ...x, done } : x))
        )
      ),

    /** Abandons the workout without logging anything. */
    cancelWorkout: () => commit((s) => ({ ...s, activeWorkout: null })),

    /**
     * Finishes the workout: only now does it reach the chart and the log.
     * The total is the summed weight of every set actually performed.
     */
    finishWorkout: () =>
      commit((s) => {
        const a = s.activeWorkout;
        if (!a) return s;
        const total = activeWorkoutVolume(a);
        const sets = activeWorkoutSets(a);
        if (sets === 0) return { ...s, activeWorkout: null };
        // Elapsed time to the nearest minute, never recorded as zero.
        const minutes = Math.max(1, Math.round((Date.now() - a.startedAt) / 60000));
        // Only completed sets are recorded. Anything still planned when the
        // workout was finished simply wasn't performed.
        const exercises: LoggedExercise[] = a.exercises
          .map((e) => ({
            exerciseId: e.exerciseId,
            name: e.name,
            sets: e.sets
              .filter((x) => x.done)
              .map((x) => ({ weight: x.weight, reps: x.reps })),
          }))
          .filter((e) => e.sets.length > 0);
        return {
          ...s,
          activeWorkout: null,
          workoutSessions: [
            ...s.workoutSessions,
            {
              id: uid(),
              workoutId: a.workoutId,
              name: a.name,
              date: dateKey(),
              total,
              sets,
              minutes,
              exercises,
            },
          ],
        };
      }),

    /**
     * Removes a recurring completion from the log. Completions carry no id, so
     * the match is on their fields — and only the first one goes, or ticking
     * the same task twice in a day would lose both.
     */
    removeCompletion: (target: Completion) =>
      commit((s) => {
        const i = s.completions.findIndex(
          (c) =>
            c.date === target.date &&
            c.catId === target.catId &&
            c.taskId === target.taskId &&
            c.groupId === target.groupId
        );
        if (i === -1) return s;
        return { ...s, completions: s.completions.filter((_, j) => j !== i) };
      }),

    /** Removes a logged session — for undoing a mistaken tap. */
    removeWorkoutSession: (sessionId: string) =>
      commit((s) => ({
        ...s,
        workoutSessions: s.workoutSessions.filter((x) => x.id !== sessionId),
      })),

    setFiberTarget: (grams: number | null) =>
      commit((s) => ({
        ...s,
        fiberTarget:
          grams != null && Number.isFinite(grams) && grams > 0 ? Math.round(grams) : undefined,
      })),
  }), [state, user, authReady, authError, syncError]);
}

export type Tracker = ReturnType<typeof useTracker>;

/** Minutes trained per date, summing every session logged that day. */
export function workoutMinutesByDate(sessions: WorkoutSession[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of sessions) if (s.minutes) map[s.date] = (map[s.date] ?? 0) + s.minutes;
  return map;
}

/** Cardio minutes per date, summing every effort logged that day. */
export function cardioMinutesByDate(entries: CardioEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of entries) if (c.minutes) map[c.date] = (map[c.date] ?? 0) + c.minutes;
  return map;
}

/** Total lifted weight per date, summing every session logged that day. */
export function workoutVolumeByDate(sessions: WorkoutSession[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of sessions) map[s.date] = (map[s.date] ?? 0) + s.total;
  return map;
}

/** Totals protein and fibre per date, for the combined chart. */
export function macroTotalsByDate(
  macros: MacroEntry[]
): Record<string, { protein: number; fiber: number }> {
  const map: Record<string, { protein: number; fiber: number }> = {};
  for (const m of macros) {
    const day = (map[m.date] ??= { protein: 0, fiber: 0 });
    day.protein += m.protein ?? 0;
    day.fiber += m.fiber ?? 0;
  }
  return map;
}

export function completionsByDate(completions: Completion[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of completions) map[c.date] = (map[c.date] ?? 0) + 1;
  return map;
}

export function catCompletionsByDate(completions: Completion[], catId: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of completions) if (c.catId === catId) map[c.date] = (map[c.date] ?? 0) + 1;
  return map;
}

export function streak(completions: Completion[]): number {
  const map = completionsByDate(completions);
  let s = 0;
  const d = new Date();
  if (!map[dateKey(d)]) d.setDate(d.getDate() - 1);
  for (;;) {
    const k = dateKey(d);
    if (map[k]) {
      s++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return s;
}
