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
export type Task = {
  id: string;
  title: string;
  catId: string;
  date: string;
  done: boolean;
  doneDate: string | null;
};
export type BoardStatus = "planned" | "progress" | "done";
export type BoardCard = { id: string; title: string; catId: string; status: BoardStatus };

export type TrackerState = {
  categories: Category[];
  tasks: Task[];
  board: BoardCard[];
};

export const CAT_COLORS = [
  "#F5A524", "#17C964", "#006FEE", "#7828C8",
  "#F31260", "#66AAF9", "#F97316", "#0EA5E9",
];

const KEY = "momentum:v1";

const DEFAULT_STATE: TrackerState = {
  categories: [
    { id: "c1", name: "Work", color: "#006FEE" },
    { id: "c2", name: "Pressio", color: "#17C964" },
    { id: "c3", name: "Learning", color: "#7828C8" },
    { id: "c4", name: "Gym", color: "#F31260" },
    { id: "c5", name: "Personal", color: "#F5A524" },
  ],
  tasks: [],
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
  const remoteApplied = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) instant paint from localStorage cache
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setState(raw ? (JSON.parse(raw) as TrackerState) : DEFAULT_STATE);
    } catch {
      setState(DEFAULT_STATE);
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 2) auth state
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const fb = getFirebase();
    if (!fb) {
      setAuthReady(true);
      return;
    }
    // Complete any redirect-based sign-in and surface its errors.
    getRedirectResult(fb.auth).catch((e) =>
      setAuthError(friendlyAuthError((e as { code?: string }).code ?? ""))
    );
    return onAuthStateChanged(fb.auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  // 3) live Firestore sync while signed in
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const fb = getFirebase();
    if (!fb) return;
    const ref = doc(fb.db, "users", user.uid);
    return onSnapshot(ref, (snap) => {
      if (snap.metadata.hasPendingWrites) return; // ignore our own echo
      if (snap.exists()) {
        const data = snap.data().state as TrackerState | undefined;
        if (data) {
          remoteApplied.current = true;
          setState(data);
        }
      } else {
        setDoc(ref, { state: stateRef.current ?? DEFAULT_STATE, updated: Date.now() }).catch(
          (e) => console.error("seed failed", e)
        );
      }
    });
  }, [user]);

  // 4) persist: localStorage always; Firestore (debounced) when signed in
  useEffect(() => {
    if (!loaded.current || !state) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("cache write failed", e);
    }
    if (remoteApplied.current) {
      remoteApplied.current = false; // came FROM Firestore — don't echo back
      return;
    }
    if (isFirebaseConfigured && user) {
      const fb = getFirebase();
      if (!fb) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setDoc(doc(fb.db, "users", user.uid), { state, updated: Date.now() }).catch((e) =>
          console.error("sync write failed", e)
        );
      }, 400);
    }
  }, [state, user]);

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
        // User dismissed the popup: stay quiet.
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          return;
        }
        // Popups unavailable (some iOS Safari setups): fall back to redirect.
        if (
          code === "auth/popup-blocked" ||
          code === "auth/operation-not-supported-in-this-environment"
        ) {
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

    // ---- data ----
    cat: (id: string): Category =>
      state?.categories.find((c) => c.id === id) ?? { id: "", name: "–", color: "#8A94A3" },

    addTask: (title: string, catId: string) =>
      update((s) => ({
        ...s,
        tasks: [
          ...s.tasks,
          { id: uid(), title, catId, date: dateKey(), done: false, doneDate: null },
        ],
      })),

    toggleTask: (id: string) =>
      update((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, done: !t.done, doneDate: !t.done ? dateKey() : null } : t
        ),
      })),

    deleteTask: (id: string) =>
      update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),

    moveTaskToToday: (id: string) =>
      update((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, date: dateKey() } : t)),
      })),

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
        state?.tasks.some((t) => t.catId === id) ||
        state?.board.some((b) => b.catId === id)
      )
        return false;
      update((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
      return true;
    },

    addCard: (title: string, status: BoardStatus) =>
      update((s) => ({
        ...s,
        board: [...s.board, { id: uid(), title, catId: s.categories[0]?.id ?? "", status }],
      })),

    moveCard: (id: string, dir: -1 | 1) =>
      update((s) => {
        const order: BoardStatus[] = ["planned", "progress", "done"];
        return {
          ...s,
          board: s.board.map((b) => {
            if (b.id !== id) return b;
            const i = order.indexOf(b.status) + dir;
            return i < 0 || i > 2 ? b : { ...b, status: order[i] };
          }),
        };
      }),

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

export function completionsByDate(tasks: Task[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of tasks)
    if (t.done && t.doneDate) map[t.doneDate] = (map[t.doneDate] ?? 0) + 1;
  return map;
}

export function streak(tasks: Task[]): number {
  const map = completionsByDate(tasks);
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
