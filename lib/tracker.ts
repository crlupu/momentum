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

export type RecurringTask = {
  id: string;
  title: string;
  catId: string;
  freq: Frequency;
  lastDone: string | null;
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
};

export type Completion = { date: string; catId: string };

export type WeightEntry = { date: string; kg: number };

export type TrackerState = {
  categories: Category[];
  goals: Goal[];
  recurring: RecurringTask[];
  completions: Completion[];
  weights: WeightEntry[];
};

export const CAT_COLORS = [
  "#F5A524", "#17C964", "#006FEE", "#7828C8",
  "#F31260", "#66AAF9", "#F97316", "#0EA5E9",
];

const KEY = "momentum:v1";

const DEFAULT_CATEGORIES: Category[] = [
  { id: "c1", name: "Work", color: "#006FEE" },
  { id: "c2", name: "Pressio", color: "#17C964" },
  { id: "c3", name: "Learning", color: "#7828C8" },
  { id: "c4", name: "Gym", color: "#F31260" },
  { id: "c5", name: "Personal", color: "#F5A524" },
];

const DEFAULT_STATE: TrackerState = {
  categories: DEFAULT_CATEGORIES,
  goals: [],
  recurring: [],
  completions: [],
  weights: [],
};

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

export function goalPct(g: Goal): number {
  if (!g.target || g.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((g.current ?? 0) / g.target) * 100)));
}

function migrate(raw: unknown): TrackerState {
  const s = (raw ?? {}) as Record<string, unknown>;
  const categories = Array.isArray(s.categories)
    ? (s.categories as Category[])
    : DEFAULT_CATEGORIES;

  const recurring: RecurringTask[] = Array.isArray(s.recurring)
    ? (s.recurring as Array<Record<string, unknown>>).map((r) => ({
        id: (r.id as string) ?? uid(),
        title: r.title as string,
        catId: r.catId as string,
        freq: (r.freq as Frequency) ?? "daily",
        lastDone: (r.lastDone as string) ?? null,
      }))
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
  }));

  const completions: Completion[] = Array.isArray(s.completions)
    ? (s.completions as Completion[])
    : [];

  const weights: WeightEntry[] = Array.isArray(s.weights)
    ? (s.weights as WeightEntry[])
    : [];

  return { categories, goals, recurring, completions, weights };
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

  const loaded = useRef(false);
  const stateRef = useRef<TrackerState | null>(null);
  const userRef = useRef<User | null>(null);
  const remoteApplied = useRef(false);
  const initialLoad = useRef(true);
  const lastUpdated = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const fb = getFirebase();
    if (!fb) return;
    const ref = doc(fb.db, "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return;
        if (snap.exists()) {
          const data = snap.data();
          const remoteUpdated = typeof data.updated === "number" ? data.updated : 0;
          if (remoteUpdated > lastUpdated.current && data.state) {
            remoteApplied.current = true;
            lastUpdated.current = remoteUpdated;
            setState(migrate(data.state));
          } else if (remoteUpdated < lastUpdated.current && stateRef.current) {
            setDoc(ref, { state: stateRef.current, updated: lastUpdated.current }).catch((e) =>
              console.error("sync write failed", e)
            );
          }
        } else {
          const updated = lastUpdated.current || Date.now();
          lastUpdated.current = updated;
          setDoc(ref, { state: stateRef.current ?? DEFAULT_STATE, updated }).catch((e) =>
            console.error("seed failed", e)
          );
        }
      },
      (err) => console.error("snapshot error", err)
    );
  }, [user]);

  useEffect(() => {
    if (!loaded.current || !state) return;
    const fromRemote = remoteApplied.current;
    if (fromRemote) remoteApplied.current = false;
    if (!fromRemote) {
      if (initialLoad.current) initialLoad.current = false;
      else lastUpdated.current = Date.now();
    }
    const payload = { state, updated: lastUpdated.current };
    try {
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (e) {
      console.error("cache write failed", e);
    }
    if (!fromRemote && isFirebaseConfigured && userRef.current) {
      const fb = getFirebase();
      if (!fb) return;
      const uidStr = userRef.current.uid;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setDoc(doc(fb.db, "users", uidStr), payload).catch((e) =>
          console.error("sync write failed", e)
        );
      }, 250);
    }
  }, [state]);

  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (isFirebaseConfigured && userRef.current && stateRef.current) {
        const fb = getFirebase();
        if (fb)
          setDoc(doc(fb.db, "users", userRef.current.uid), {
            state: stateRef.current,
            updated: lastUpdated.current,
          }).catch(() => {});
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const update = (fn: (s: TrackerState) => TrackerState) =>
    setState((s) => (s ? fn(s) : s));

  return {
    state,

    firebaseConfigured: isFirebaseConfigured,
    user,
    authReady,
    authError,
    clearAuthError: () => setAuthError(null),
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
      await signOut(fb.auth);
      setState(DEFAULT_STATE);
    },

    cat: (id: string): Category =>
      state?.categories.find((c) => c.id === id) ?? { id: "", name: "–", color: "#8A94A3" },

    // ---- goals ----
    addGoal: (title: string, catId: string, current: number | null, target: number | null) =>
      update((s) => ({
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

    setGoalProgress: (id: string, current: number | null, target: number | null) =>
      update((s) => ({
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
      update((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === id ? { ...g, done: !g.done, doneDate: !g.done ? dateKey() : null } : g
        ),
      })),

    cycleGoalCat: (id: string) =>
      update((s) => ({
        ...s,
        goals: s.goals.map((g) => {
          if (g.id !== id) return g;
          const i = s.categories.findIndex((c) => c.id === g.catId);
          const next = s.categories[(i + 1) % s.categories.length];
          return { ...g, catId: next?.id ?? g.catId };
        }),
      })),

    deleteGoal: (id: string) =>
      update((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),

    // ---- recurring ----
    addRecurring: (title: string, catId: string, freq: Frequency) =>
      update((s) => ({
        ...s,
        recurring: [...s.recurring, { id: uid(), title, catId, freq, lastDone: null }],
      })),

    toggleRecurring: (id: string) =>
      update((s) => {
        const today = dateKey();
        const r = s.recurring.find((x) => x.id === id);
        if (!r) return s;
        if (isRecurringDone(r, today)) {
          const dd = r.lastDone;
          let removed = false;
          const completions = s.completions.filter((c) => {
            if (!removed && c.date === dd && c.catId === r.catId) {
              removed = true;
              return false;
            }
            return true;
          });
          return {
            ...s,
            recurring: s.recurring.map((x) => (x.id === id ? { ...x, lastDone: null } : x)),
            completions,
          };
        }
        return {
          ...s,
          recurring: s.recurring.map((x) => (x.id === id ? { ...x, lastDone: today } : x)),
          completions: [...s.completions, { date: today, catId: r.catId }],
        };
      }),

    deleteRecurring: (id: string) =>
      update((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== id) })),

    // ---- weight log (one entry per day, upsert) ----
    addWeight: (kg: number) =>
      update((s) => {
        if (!Number.isFinite(kg) || kg <= 0) return s;
        const today = dateKey();
        const exists = s.weights.some((w) => w.date === today);
        const weights = exists
          ? s.weights.map((w) => (w.date === today ? { ...w, kg } : w))
          : [...s.weights, { date: today, kg }];
        weights.sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, weights };
      }),

    deleteWeight: (date: string) =>
      update((s) => ({ ...s, weights: s.weights.filter((w) => w.date !== date) })),

    // ---- categories ----
    addCategory: (name: string) =>
      update((s) => ({
        ...s,
        categories: [
          ...s.categories,
          { id: uid(), name, color: CAT_COLORS[s.categories.length % CAT_COLORS.length] },
        ],
      })),

    deleteCategory: (id: string): boolean => {
      if (
        state?.recurring.some((r) => r.catId === id) ||
        state?.goals.some((g) => g.catId === id)
      )
        return false;
      update((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
      return true;
    },
  };
}

export type Tracker = ReturnType<typeof useTracker>;

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
