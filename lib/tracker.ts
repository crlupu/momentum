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
export const FREQ_DAYS: Record<Frequency, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30,
};
export const FREQ_ORDER: Record<Frequency, number> = {
  daily: 0, weekly: 1, biweekly: 2, monthly: 3,
};

export type RecurringTask = {
  id: string;
  title: string;
  catId: string;
  freq: Frequency;
  nextDue: string; // YYYY-MM-DD
};

export type BoardStatus = "planned" | "progress" | "done";
export type BoardCard = {
  id: string;
  title: string;
  catId: string;
  status: BoardStatus;
  recurringId?: string;
  doneDate?: string | null;
  current?: number;
  target?: number;
};

export type TrackerState = {
  categories: Category[];
  recurring: RecurringTask[];
  board: BoardCard[];
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
  recurring: [],
  board: [],
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

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dateKey(dt);
}

// Normalize any stored shape (including the old "tasks" model) to the current one.
function migrate(raw: unknown): TrackerState {
  const s = (raw ?? {}) as Record<string, unknown>;
  const categories = Array.isArray(s.categories)
    ? (s.categories as Category[])
    : DEFAULT_CATEGORIES;
  const recurring = Array.isArray(s.recurring) ? (s.recurring as RecurringTask[]) : [];
  let board: BoardCard[] = Array.isArray(s.board) ? (s.board as BoardCard[]) : [];

  // Old model: convert per-day tasks into board cards.
  if (Array.isArray(s.tasks)) {
    for (const t of s.tasks as Array<Record<string, unknown>>) {
      board.push({
        id: (t.id as string) ?? uid(),
        title: t.title as string,
        catId: t.catId as string,
        status: t.done ? "done" : "planned",
        doneDate: t.done ? ((t.doneDate as string) ?? null) : null,
      });
    }
  }

  board = board.map((c) => ({
    id: c.id,
    title: c.title,
    catId: c.catId,
    status: c.status ?? "planned",
    recurringId: c.recurringId,
    doneDate: c.doneDate ?? null,
    current: typeof c.current === "number" ? c.current : undefined,
    target: typeof c.target === "number" ? c.target : undefined,
  }));

  return { categories, recurring, board };
}

// On load, materialize any recurring tasks that are due into Planned.
function regenerate(s: TrackerState): TrackerState {
  const today = dateKey();
  const board = [...s.board];
  const recurring = s.recurring.map((r) => {
    if ((r.nextDue || today) > today) return r;
    const hasActive = board.some((b) => b.recurringId === r.id && b.status !== "done");
    if (!hasActive) {
      board.push({
        id: uid(),
        title: r.title,
        catId: r.catId,
        status: "planned",
        recurringId: r.id,
        doneDate: null,
      });
    }
    let nextDue = r.nextDue || today;
    while (nextDue <= today) nextDue = addDays(nextDue, FREQ_DAYS[r.freq]);
    return { ...r, nextDue };
  });
  return { ...s, board, recurring };
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
      // Support both the { state, updated } wrapper and the old bare state.
      const rawState = parsed && parsed.state ? parsed.state : parsed ?? DEFAULT_STATE;
      lastUpdated.current =
        parsed && typeof parsed.updated === "number" ? parsed.updated : 0;
      setState(regenerate(migrate(rawState)));
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

  // Live Firestore sync. The newest copy wins, decided by `updated` timestamp,
  // so a fresh local change is never clobbered by a stale remote snapshot.
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
            // Remote is newer (e.g. another device) — apply it.
            remoteApplied.current = true;
            lastUpdated.current = remoteUpdated;
            setState(migrate(data.state));
          } else if (remoteUpdated < lastUpdated.current && stateRef.current) {
            // Local is newer — push it up so remote catches up.
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

  // Persist on every data change: localStorage synchronously (survives reload),
  // Firestore debounced. Only real data changes bump the timestamp.
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

  // Flush any pending write when the page is hidden/closed.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (isFirebaseConfigured && userRef.current && stateRef.current) {
        const fb = getFirebase();
        if (fb) {
          setDoc(doc(fb.db, "users", userRef.current.uid), {
            state: stateRef.current,
            updated: lastUpdated.current,
          }).catch(() => {});
        }
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

    // ---- auth ----
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

    // ---- lookups ----
    cat: (id: string): Category =>
      state?.categories.find((c) => c.id === id) ?? { id: "", name: "–", color: "#8A94A3" },

    freqOf: (card: BoardCard): Frequency | null => {
      if (!card.recurringId) return null;
      const r = state?.recurring.find((x) => x.id === card.recurringId);
      return r ? r.freq : null;
    },

    // ---- recurring ----
    addRecurring: (title: string, catId: string, freq: Frequency) =>
      update((s) => {
        const rid = uid();
        return {
          ...s,
          recurring: [
            ...s.recurring,
            { id: rid, title, catId, freq, nextDue: addDays(dateKey(), FREQ_DAYS[freq]) },
          ],
          board: [
            ...s.board,
            { id: uid(), title, catId, status: "planned", recurringId: rid, doneDate: null },
          ],
        };
      }),

    deleteRecurring: (id: string) =>
      update((s) => ({
        ...s,
        recurring: s.recurring.filter((r) => r.id !== id),
        board: s.board.filter((b) => !(b.recurringId === id && b.status !== "done")),
      })),

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
        state?.board.some((b) => b.catId === id)
      )
        return false;
      update((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
      return true;
    },

    // ---- board ----
    addCard: (title: string, status: BoardStatus) =>
      update((s) => ({
        ...s,
        board: [
          ...s.board,
          { id: uid(), title, catId: s.categories[0]?.id ?? "", status, doneDate: null },
        ],
      })),

    // Replace whole board (used by drag & drop); stamps doneDate on transitions.
    setBoard: (next: BoardCard[]) =>
      update((s) => {
        const prev = new Map(s.board.map((c) => [c.id, c]));
        const stamped = next.map((c) => {
          const p = prev.get(c.id);
          if (c.status === "done" && (!p || p.status !== "done"))
            return { ...c, doneDate: dateKey() };
          if (c.status !== "done" && p && p.status === "done")
            return { ...c, doneDate: null };
          return c;
        });
        return { ...s, board: stamped };
      }),

    setCardStatus: (id: string, status: BoardStatus) =>
      update((s) => ({
        ...s,
        board: s.board.map((c) =>
          c.id === id
            ? {
                ...c,
                status,
                doneDate:
                  status === "done"
                    ? dateKey()
                    : c.status === "done"
                    ? null
                    : c.doneDate ?? null,
              }
            : c
        ),
      })),

    setCardProgress: (id: string, current: number | null, target: number | null) =>
      update((s) => ({
        ...s,
        board: s.board.map((c) =>
          c.id === id
            ? {
                ...c,
                current:
                  current != null && Number.isFinite(current) && current >= 0
                    ? current
                    : undefined,
                target:
                  target != null && Number.isFinite(target) && target > 0 ? target : undefined,
              }
            : c
        ),
      })),

    cycleCardCat: (id: string) =>
      update((s) => ({
        ...s,
        board: s.board.map((b) => {
          if (b.id !== id) return b;
          const i = s.categories.findIndex((c) => c.id === b.catId);
          const next = s.categories[(i + 1) % s.categories.length];
          return { ...b, catId: next?.id ?? b.catId };
        }),
      })),

    deleteCard: (id: string) =>
      update((s) => ({ ...s, board: s.board.filter((b) => b.id !== id) })),
  };
}

export type Tracker = ReturnType<typeof useTracker>;

// ---- derived stats (computed from completed board cards) ----
export function completionsByDate(board: BoardCard[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of board)
    if (c.status === "done" && c.doneDate) map[c.doneDate] = (map[c.doneDate] ?? 0) + 1;
  return map;
}

export function catCompletionsByDate(board: BoardCard[], catId: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of board)
    if (c.status === "done" && c.doneDate && c.catId === catId)
      map[c.doneDate] = (map[c.doneDate] ?? 0) + 1;
  return map;
}

export function streak(board: BoardCard[]): number {
  const map = completionsByDate(board);
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
