"use client";

import { useEffect, useRef, useState } from "react";
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

export type CalorieEntry = { id: string; date: string; kcal: number };

/** One exercise inside a workout, with the weight it's performed at. */
export type Exercise = {
  id: string;
  name: string;
  /** Working weight in kg. Left out for bodyweight movements. */
  weight?: number;
};

/** One set performed during a live workout, at whatever weight was used. */
export type ActiveSet = { id: string; weight?: number };

export type ActiveExercise = {
  exerciseId: string;
  /** Copied at start, so renaming or deleting mid-session can't break it. */
  name: string;
  /** The exercise's usual weight, used as the default for new sets. */
  weight?: number;
  sets: ActiveSet[];
};

/** A workout in progress. At most one runs at a time. */
export type ActiveWorkout = {
  workoutId: string;
  name: string;
  startedAt: number;
  exercises: ActiveExercise[];
};

/** Volume of a live workout: every set counts the weight it was done at. */
export function activeWorkoutVolume(a: ActiveWorkout): number {
  return a.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + (set.weight ?? 0), 0),
    0
  );
}

/** How many sets have been recorded so far. */
export function activeWorkoutSets(a: ActiveWorkout): number {
  return a.exercises.reduce((n, e) => n + e.sets.length, 0);
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
};

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
  calories: CalorieEntry[];
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

export const CAT_COLORS = [
  "#0f62fe", "#8a3ffc", "#ee5396", "#009d9a",
  "#1192e8", "#24a148", "#ff832b", "#6929c4",
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
  { id: "c2", name: "Pressio", color: "#009d9a" },
  { id: "c3", name: "Learning", color: "#8a3ffc" },
  { id: "c4", name: "Gym", color: "#ee5396" },
  { id: "c5", name: "Personal", color: "#1192e8" },
];

/** Colours from every earlier theme → their IBM-palette replacements. */
const LEGACY_CATEGORY_COLORS: Record<string, string> = {
  // roles: Work / Pressio / Learning / Gym / Personal, era by era
  // HeroUI originals
  "#006fee": "#0f62fe", "#17c964": "#009d9a", "#7828c8": "#8a3ffc",
  "#f31260": "#ee5396", "#f5a524": "#1192e8",
  // Atlassian era
  "#357de8": "#0f62fe", "#22a06b": "#009d9a", "#af59e1": "#8a3ffc",
  "#ae2e24": "#ee5396", "#c75300": "#1192e8",
  // green-brand era
  "#2180e6": "#0f62fe", "#1ea97b": "#009d9a", "#264b04": "#8a3ffc",
  "#72c613": "#ee5396", "#c8efc1": "#1192e8",
  // Neo Retro era
  "#a6a9be": "#0f62fe", "#1e3a1e": "#009d9a", "#0e0e0e": "#8a3ffc",
  "#e0761b": "#ee5396", "#b8c2c2": "#1192e8",
};

const DEFAULT_STATE: TrackerState = {
  categories: DEFAULT_CATEGORIES,
  goals: [],
  recurring: [],
  recurringGroups: [],
  todos: [],
  completions: [],
  weights: [],
  calories: [],
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

  const calories: CalorieEntry[] = Array.isArray(s.calories)
    ? (s.calories as CalorieEntry[])
    : [];

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
    calories,
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
    try {
      await setDoc(doc(fb.db, "users", userRef.current.uid), clean({ state: next, updated }));
      lastUpdated.current = updated;
      // Update the ref synchronously: React state lands on the next render, so a
      // second write issued immediately after this one would otherwise start
      // from the stale state and undo this change.
      stateRef.current = next;
      setState(next);
      setSyncError(null);
      return true;
    } catch (e) {
      console.error("save failed", e);
      setSyncError("Couldn't save to the cloud. Your change was not applied.");
      return false;
    }
  };

  return {
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
      state?.categories.find((c) => c.id === id) ?? { id: "", name: "–", color: "#8d8d8d" },

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
    addCategory: (name: string) =>
      commit((s) => ({
        ...s,
        categories: [
          ...s.categories,
          { id: uid(), name, color: nextCategoryColor(s.categories) },
        ],
      })),

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

    setCalorieBudget: (kcal: number | null) =>
      commit((s) => ({
        ...s,
        calorieBudget: kcal != null && Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : undefined,
      })),

    // ---- calories ----
    addCalories: (kcal: number) =>
      commit((s) => {
        if (!Number.isFinite(kcal) || kcal <= 0) return s;
        return { ...s, calories: [...s.calories, { id: uid(), date: dateKey(), kcal: Math.round(kcal) }] };
      }),

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

    /** Records another set, defaulting to the weight of the previous one. */
    addSet: (exerciseId: string) =>
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
                    sets: [
                      ...e.sets,
                      { id: uid(), weight: e.sets[e.sets.length - 1]?.weight ?? e.weight },
                    ],
                  }
            ),
          },
        };
      }),

    removeSet: (exerciseId: string, setId: string) =>
      commit((s) => {
        if (!s.activeWorkout) return s;
        return {
          ...s,
          activeWorkout: {
            ...s.activeWorkout,
            exercises: s.activeWorkout.exercises.map((e) =>
              e.exerciseId !== exerciseId
                ? e
                : { ...e, sets: e.sets.filter((x) => x.id !== setId) }
            ),
          },
        };
      }),

    setSetWeight: (exerciseId: string, setId: string, weight: number | null) =>
      commit((s) => {
        if (!s.activeWorkout) return s;
        const w = weight != null && Number.isFinite(weight) && weight > 0 ? weight : undefined;
        return {
          ...s,
          activeWorkout: {
            ...s.activeWorkout,
            exercises: s.activeWorkout.exercises.map((e) =>
              e.exerciseId !== exerciseId
                ? e
                : {
                    ...e,
                    sets: e.sets.map((x) => (x.id === setId ? { ...x, weight: w } : x)),
                  }
            ),
          },
        };
      }),

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
            },
          ],
        };
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
  };
}

export type Tracker = ReturnType<typeof useTracker>;

/** Minutes trained per date, summing every session logged that day. */
export function workoutMinutesByDate(sessions: WorkoutSession[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of sessions) if (s.minutes) map[s.date] = (map[s.date] ?? 0) + s.minutes;
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
