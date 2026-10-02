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
import { contrast } from "./color";
import * as R from "./reading";
import * as P from "./projects";
import * as O from "./ops";
import { applyPlan, type Plan } from "./planImport";
import { applyGoalPlan, type GoalPlan, type ImportOptions } from "./goalImport";
import { LOOKUP_VERSION, type BookLookup } from "./covers";
import type {
  BookStatus,
  BookQuote,
  ReadingPhase,
  ReadingSession,
  ReadingTrack,
  StatusChange,
} from "./reading";
import {
  CAT_COLORS,
  DEFAULT_STATE,
  KEY,
  activeWorkoutSets,
  activeWorkoutVolume,
  afterPaint,
  clean,
  dateKey,
  editSets,
  friendlyAuthError,
  isRecurringDone,
  lastPerformed,
  migrate,
  nextCategoryColor,
  pathGoals,
  positiveNumber,
  uid,
  withTopicCategory,
} from "./model";
import type {
  CalorieEntry,
  CardioEntry,
  Category,
  Completion,
  Exercise,
  Frequency,
  LoggedExercise,
  MacroEntry,
  Path,
  SetRecord,
  TrackerState,
  WorkoutBlock,
} from "./model";

export * from "./model";

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
  // The newest state the cloud is known to hold, and its stamp: what a failed
  // save falls back to. See commit.
  const confirmed = useRef<TrackerState | null>(null);
  const confirmedAt = useRef(0);
  // Saves on their way to the cloud, so signing out can let them land first.
  const inflight = useRef(new Set<Promise<unknown>>());
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
    confirmed.current = null;
    confirmedAt.current = 0;
    const ref = doc(fb.db, "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return; // our own write, not yet acked
        remoteSynced.current = true;
        if (snap.exists()) {
          const data = snap.data();
          const remoteUpdated = typeof data.updated === "number" ? data.updated : 0;
          if (data.state && remoteUpdated >= confirmedAt.current) {
            confirmed.current = migrate(data.state);
            confirmedAt.current = remoteUpdated;
          }
          if (data.state && remoteUpdated !== lastUpdated.current) {
            lastUpdated.current = remoteUpdated;
            setState(confirmed.current ?? migrate(data.state));
          }
        } else {
          // no cloud record yet — seed it from whatever is on screen
          const updated = Date.now();
          const seed = stateRef.current ?? DEFAULT_STATE;
          setDoc(ref, clean({ state: seed, updated }))
            .then(() => {
              lastUpdated.current = updated;
              confirmed.current = seed;
              confirmedAt.current = updated;
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
  // Written once changes pause rather than on each one: serialising the whole
  // state and storing it took tens of milliseconds on a phone, inside the tap.
  // Flushed when the page is hidden, so leaving the app never loses it.
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeCache = () => {
    if (cacheTimer.current) clearTimeout(cacheTimer.current);
    cacheTimer.current = null;
    const s = stateRef.current;
    if (!s) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ state: s, updated: lastUpdated.current }));
    } catch (e) {
      console.error("cache write failed", e);
    }
  };
  useEffect(() => {
    if (!loaded.current || !state) return;
    if (suppressPersist.current) {
      suppressPersist.current = false;
      if (cacheTimer.current) clearTimeout(cacheTimer.current);
      cacheTimer.current = null;
      return;
    }
    if (cacheTimer.current) clearTimeout(cacheTimer.current);
    cacheTimer.current = setTimeout(writeCache, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && cacheTimer.current) writeCache();
    };
    const onHide = () => {
      if (cacheTimer.current) writeCache();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Applies a change: on screen at once, then saved to the cloud behind it.
   *
   * Resolves as soon as the change is on screen — true, or false when it was
   * refused outright (no state yet, or the cloud copy not read yet) — not
   * when the save lands. Everything that awaits a write (a form clearing its
   * field, a dialog closing) used to wait out the network round trip, which
   * on a phone left the page looking frozen for seconds after every tap.
   *
   * Every save writes the whole state, so a newer one carries every change
   * before it. A failed save therefore only matters if nothing newer has been
   * made since: then the screen goes back to the last state the cloud is
   * known to hold, and the sync banner says why. When something newer is on
   * its way, that save decides.
   */
  const commit = async (fn: (s: TrackerState) => TrackerState): Promise<boolean> => {
    // The ref is kept in step by an effect, and a child's effect runs before
    // its parent's — so a write made from a child effect on the render that
    // first loaded the state found the ref still empty and was refused. The
    // render's own state is the right answer whenever the ref has not caught
    // up, and identical to it once it has.
    const base = stateRef.current ?? state;
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
    const fallback = { state: confirmed.current ?? base, at: confirmed.current ? confirmedAt.current : lastUpdated.current };

    // The ref is updated synchronously because React state only lands on the
    // next render, and a second write issued immediately after this one would
    // otherwise start from the stale state and undo this change.
    lastUpdated.current = updated;
    stateRef.current = next;
    setState(next);

    // The save starts once the change has been painted: preparing the
    // document is work proportional to all the data, and it no longer
    // delays the frame that shows the tap. Changes made within one frame
    // are sent as one — the newest state holds them all.
    const uid = userRef.current.uid;
    const save = afterPaint()
      .then(async (): Promise<boolean> => {
        if (stateRef.current !== next) return false; // superseded: the newer save sends it
        await setDoc(doc(fb.db, "users", uid), clean({ state: next, updated }));
        return true;
      })
      .then((sent) => {
        if (!sent) return;
        if (updated >= confirmedAt.current) {
          confirmed.current = next;
          confirmedAt.current = updated;
        }
        if (stateRef.current === next) setSyncError(null);
      })
      .catch((e) => {
        console.error("save failed", e);
        if (stateRef.current !== next) return; // a newer save carries this change
        // Put it back, so the screen never claims something was saved that wasn't.
        const back = confirmed.current ?? fallback.state;
        lastUpdated.current = confirmed.current ? confirmedAt.current : fallback.at;
        stateRef.current = back;
        setState(back);
        setSyncError("Couldn't save to the cloud. Your last change was not applied.");
      })
      .finally(() => inflight.current.delete(save));
    inflight.current.add(save);
    return true;
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
      // Let any save still on its way land first, then clear the screen
      // WITHOUT persisting the empty state anywhere.
      await Promise.allSettled([...inflight.current]);
      suppressPersist.current = true;
      await signOut(fb.auth);
      if (cacheTimer.current) clearTimeout(cacheTimer.current);
      cacheTimer.current = null;
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      lastUpdated.current = 0;
      remoteSynced.current = false;
      confirmed.current = null;
      confirmedAt.current = 0;
      setState(DEFAULT_STATE);
    },

    // ---- lookups ----
    cat: (id: string): Category =>
      state?.categories.find((c) => c.id === id) ?? { id: "", name: "–", color: "#a2a9b0" },

    categoryInUse: (id: string): boolean =>
      !!state?.recurring.some((r) => r.catId === id) || !!state?.goals.some((g) => g.catId === id),

    // ---- goals ----
    /** Adds a goal, optionally straight into a topic. */
    addGoal: (
      title: string,
      catId: string,
      current: number | null,
      target: number | null,
      pathId?: string | null,
      note?: string
    ) => commit((s) => O.addGoal(s, { title, catId, current, target, pathId, note })),

    /** The goal's link and note, saved together. Empty clears them. */
    setGoalDetails: (id: string, patch: { link?: string; note?: string }) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === id
            ? {
                ...g,
                ...("link" in patch ? { link: patch.link?.trim() || undefined } : {}),
                ...("note" in patch ? { note: patch.note?.trim() || undefined } : {}),
              }
            : g
        ),
      })),

    /**
     * Puts a goal in one topic — or none — taking it out of any other. A goal
     * belongs to one topic on this page.
     */
    /** Moves a goal into a topic (or out of any), taking the topic's category. */
    setGoalTopic: (goalId: string, pathId: string | null) =>
      commit((s) => ({
        ...s,
        goals: withTopicCategory(s.goals, s.paths.find((p) => p.id === pathId), [goalId]),
        paths: s.paths.map((p) => {
          const has = p.goalIds.includes(goalId);
          if (p.id === pathId) return has ? p : { ...p, goalIds: [...p.goalIds, goalId] };
          return has ? { ...p, goalIds: p.goalIds.filter((g) => g !== goalId) } : p;
        }),
      })),

    /** Moves a goal's own count by a step, clamped to 0 and its target. */
    stepGoal: (id: string, delta: number) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) => {
          if (g.id !== id) return g;
          const next = Math.max(0, (g.current ?? 0) + delta);
          return { ...g, current: g.target ? Math.min(next, g.target) : next };
        }),
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

    /** Replaces a goal's parts; an empty list removes them. */
    setGoalParts: (id: string, parts: Parameters<typeof O.setGoalParts>[2]) =>
      commit((s) => O.setGoalParts(s, id, parts)),

    /** Moves one part's count by a step. */
    stepPart: (goalId: string, partId: string, delta: number) =>
      commit((s) => O.stepPart(s, goalId, partId, delta)),

    updateGoal: (id: string, patch: { title?: string; catId?: string }) =>
      commit((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === id
            ? { ...g, title: patch.title?.trim() || g.title, catId: patch.catId ?? g.catId }
            : g
        ),
      })),

    // ---- paths ----
    addPath: (title: string, catId?: string, note?: string) =>
      commit((s) => {
        const t = title.trim();
        if (!t) return s;
        return {
          ...s,
          paths: [
            ...s.paths,
            { id: uid(), title: t, goalIds: [], ...(catId ? { catId } : {}), ...(note?.trim() ? { note: note.trim() } : {}) },
          ],
        };
      }),

    updatePath: (id: string, title: string, catId?: string, note?: string) =>
      commit((s) => {
        const t = title.trim();
        if (!t) return s;
        return {
          ...s,
          paths: s.paths.map((p) =>
            p.id === id ? { ...p, title: t, catId: catId || undefined, note: note?.trim() || undefined } : p
          ),
          // The topic's goals follow its category.
          goals: catId
            ? withTopicCategory(s.goals, { catId } as Path, s.paths.find((p) => p.id === id)?.goalIds ?? [])
            : s.goals,
        };
      }),

    /** Removes the path only. Its goals are goals in their own right and stay. */
    removePath: (id: string) =>
      commit((s) => ({ ...s, paths: s.paths.filter((p) => p.id !== id) })),

    /** Puts an existing goal on a path, at the end. Ignores one already on it. */
    addGoalToPath: (pathId: string, goalId: string) =>
      commit((s) => ({
        ...s,
        paths: s.paths.map((p) =>
          p.id === pathId && !p.goalIds.includes(goalId)
            ? { ...p, goalIds: [...p.goalIds, goalId] }
            : p
        ),
      })),

    /** Takes a goal off a path. The goal itself is untouched. */
    removeGoalFromPath: (pathId: string, goalId: string) =>
      commit((s) => ({
        ...s,
        paths: s.paths.map((p) =>
          p.id === pathId ? { ...p, goalIds: p.goalIds.filter((g) => g !== goalId) } : p
        ),
      })),

    moveGoalOnPath: (pathId: string, goalId: string, dir: -1 | 1) =>
      commit((s) => ({
        ...s,
        paths: s.paths.map((p) => {
          if (p.id !== pathId) return p;
          const i = p.goalIds.indexOf(goalId);
          const j = i + dir;
          if (i === -1 || j < 0 || j >= p.goalIds.length) return p;
          const next = [...p.goalIds];
          [next[i], next[j]] = [next[j], next[i]];
          return { ...p, goalIds: next };
        }),
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
      commit((s) => O.setGoalDone(s, id, !s.goals.find((g) => g.id === id)?.done)),

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

    deleteGoal: (id: string) =>
      commit((s) => ({
        ...s,
        goals: s.goals.filter((g) => g.id !== id),
        // Taken off any path too. pathGoals skips a missing id either way, but
        // leaving it would keep a dead step in the path's stored order and
        // bring it back if the id were ever reused.
        paths: s.paths.map((p) =>
          p.goalIds.includes(id) ? { ...p, goalIds: p.goalIds.filter((g) => g !== id) } : p
        ),
      })),

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

    /**
     * Turns a learning goal into a project: its name, description and link
     * carry over to a new, empty board, and the goal is removed. Returns the
     * new project's id at once, like addProject.
     */
    goalToProject: (goalId: string): string | null => {
      const base = stateRef.current ?? state;
      const g = base?.goals.find((x) => x.id === goalId);
      if (!g) return null;
      const id = uid();
      const now = Date.now();
      const project: P.Project = {
        id,
        title: g.title,
        note: g.note,
        link: g.link,
        done: g.done ? true : undefined,
        doneDate: g.done ? (g.doneDate ?? null) : null,
        createdAt: now,
        tags: [],
        cards: [],
      };
      void commit((s) => ({
        ...s,
        projects: [...s.projects, project],
        goals: s.goals.filter((x) => x.id !== goalId),
        paths: s.paths.map((p) =>
          p.goalIds.includes(goalId) ? { ...p, goalIds: p.goalIds.filter((x) => x !== goalId) } : p
        ),
      }));
      return id;
    },

    // ---- projects ----

    /**
     * Returns the new project's id at once, so the page can open its board
     * without waiting on the save: the project is on screen before the
     * write goes out, as with every change. A refused save takes it back
     * out, and the board page then returns to the list.
     */
    addProject: (fields: { title: string; note?: string; link?: string }): string => {
      const id = uid();
      void commit((s) => O.addProject(s, fields, id));
      return id;
    },

    updateProject: (id: string, fields: { title?: string; note?: string; link?: string }) =>
      commit((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === id
            ? {
                ...p,
                title: fields.title?.trim() || p.title,
                note: fields.note !== undefined ? fields.note.trim() || undefined : p.note,
                link: fields.link !== undefined ? fields.link.trim() || undefined : p.link,
              }
            : p
        ),
      })),

    setProjectDone: (id: string, done: boolean) =>
      commit((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === id ? { ...p, done: done ? true : undefined, doneDate: done ? dateKey() : null } : p
        ),
      })),

    deleteProject: (id: string) =>
      commit((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) })),

    addCard: (
      projectId: string,
      fields: { title: string; note?: string; tagIds?: string[] },
      status: P.CardStatus = "todo"
    ) => commit((s) => O.addCard(s, projectId, fields, status)),

    /**
     * Makes a tag for one project's cards and returns its id at once, so a
     * card being written can carry it straight away.
     */
    addProjectTag: (projectId: string, name: string): string => {
      const id = uid();
      void commit((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId
            ? { ...p, tags: [...p.tags, { id, name: name.trim(), color: P.nextTagColor(p, CAT_COLORS) }] }
            : p
        ),
      }));
      return id;
    },

    /** Deletes a tag and takes it off every card that had it. */
    deleteProjectTag: (projectId: string, tagId: string) =>
      commit((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                tags: p.tags.filter((t) => t.id !== tagId),
                cards: p.cards.map((c) =>
                  c.tagIds?.includes(tagId)
                    ? { ...c, tagIds: c.tagIds.filter((x) => x !== tagId).length ? c.tagIds.filter((x) => x !== tagId) : undefined }
                    : c
                ),
              }
            : p
        ),
      })),

    updateCard: (
      projectId: string,
      cardId: string,
      fields: { title?: string; note?: string; due?: string | null; status?: P.CardStatus; tagIds?: string[] }
    ) =>
      commit((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                cards: p.cards.map((c) => {
                  if (c.id !== cardId) return c;
                  const next = {
                    ...c,
                    title: fields.title?.trim() || c.title,
                    note: fields.note !== undefined ? fields.note.trim() || undefined : c.note,
                    due: fields.due !== undefined ? fields.due || undefined : c.due,
                    tagIds: fields.tagIds !== undefined ? (fields.tagIds.length ? fields.tagIds : undefined) : c.tagIds,
                  };
                  return fields.status ? P.withStatus(next, fields.status) : next;
                }),
              }
            : p
        ),
      })),

    /** Moves a card to the end of another column. */
    moveCard: (projectId: string, cardId: string, status: P.CardStatus) =>
      commit((s) => ({
        ...s,
        projects: s.projects.map((p) => {
          if (p.id !== projectId) return p;
          const c = p.cards.find((x) => x.id === cardId);
          if (!c || c.status === status) return p;
          return { ...p, cards: [...p.cards.filter((x) => x.id !== cardId), P.withStatus(c, status)] };
        }),
      })),

    /** Sets every column's cards and order at once, after a drag. */
    arrangeCards: (projectId: string, cols: Record<P.CardStatus, string[]>) =>
      commit((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === projectId ? { ...p, cards: P.arrangeCards(p, cols) } : p)),
      })),

    deleteCard: (projectId: string, cardId: string) =>
      commit((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, cards: p.cards.filter((c) => c.id !== cardId) } : p
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
            { date: today, catId: r.catId, groupId: r.groupId, taskId: r.id, at: Date.now() },
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
          t.id === id
            ? {
                ...t,
                done: !t.done,
                doneDate: !t.done ? dateKey() : null,
                doneAt: !t.done ? Date.now() : null,
              }
            : t
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
          at: Date.now(),
        };
        const cardio = [...s.cardio, entry].sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, cardio };
      }),

    removeCardio: (id: string) =>
      commit((s) => ({ ...s, cardio: s.cardio.filter((c) => c.id !== id) })),

    // ---- books ----
    // The reading plan's rules live in lib/reading.ts; these only wrap each
    // change in the confirmed write.
    addBook: (input: R.BookInput) => commit((s) => R.addBook(s, input)),
    updateBook: (id: string, input: R.BookInput) => commit((s) => R.updateBook(s, id, input)),
    addBooks: (
      list: { title: string; author?: string; pages?: number }[],
      trackId: string,
      phaseId?: string
    ) => commit((s) => R.addBooks(s, list, trackId, phaseId)),
    setBookStatus: (
      id: string,
      status: BookStatus,
      opts?: { reason?: string; place?: "top" | "end" }
    ) => commit((s) => R.setStatus(s, id, status, opts)),
    /**
     * Several status changes as one write, so a swap — pause one book, start
     * another — can't be half applied.
     */
    setBookStatuses: (
      changes: { id: string; status: BookStatus; place?: "top" | "end" }[]
    ) =>
      commit((s) =>
        changes.reduce((acc, c) => R.setStatus(acc, c.id, c.status, { place: c.place }), s)
      ),
    setCurrentPage: (id: string, page: number) => commit((s) => R.setCurrentPage(s, id, page)),
    logReading: (bookId: string, input: R.LogInput) =>
      commit((s) => R.logSession(s, bookId, input)),
    updateReadingSession: (
      id: string,
      patch: { date?: string; pages?: number; minutes?: number | null; note?: string | null }
    ) => commit((s) => R.updateSession(s, id, patch)),
    removeReadingSession: (id: string) => commit((s) => R.removeSession(s, id)),
    reorderQueue: (trackId: string, ids: string[]) =>
      commit((s) => R.reorderQueue(s, trackId, ids)),
    placeInQueue: (id: string, place: "top" | "end") =>
      commit((s) => R.placeInQueue(s, id, place)),
    dismissStall: (id: string) => commit((s) => R.dismissStall(s, id)),
    addQuote: (bookId: string, text: string, page?: number) =>
      commit((s) => R.addQuote(s, bookId, text, page)),
    removeQuote: (id: string) => commit((s) => R.removeQuote(s, id)),
    addTrack: (t: R.TrackInput) => commit((s) => R.addTrack(s, t)),
    updateTrack: (id: string, t: R.TrackInput) => commit((s) => R.updateTrack(s, id, t)),
    /** Deletes a track; its books are kept without one, moved, or deleted. */
    removeTrack: (id: string, then: R.TrackBooks) => commit((s) => R.removeTrack(s, id, then)),
    addPhase: (p: R.PhaseInput) => commit((s) => R.addPhase(s, p)),
    updatePhase: (id: string, p: R.PhaseInput) => commit((s) => R.updatePhase(s, id, p)),
    removePhase: (id: string) => commit((s) => R.removePhase(s, id)),

    /**
     * Records the result of a cover lookup — an id, or null for "looked and
     * there isn't one". Setting it back to undefined marks the book for
     * another look.
     */
    setBookCover: (id: string, coverId: string | null | undefined) =>
      commit((s) => ({
        ...s,
        books: s.books.map((b) =>
          // A plain cover chosen by hand is final; a new look starts afresh.
          b.id === id ? { ...b, coverId, lookup: coverId === undefined ? undefined : LOOKUP_VERSION } : b
        ),
      })),

    /**
     * Records everything one lookup found: the cover, and the author and
     * length when the book hasn't got them.
     *
     * Nothing already on the book is overwritten. An author or length was
     * either typed or filled in from an earlier lookup and corrected since,
     * and neither is something a guess from a title match should undo. The
     * length is the median across editions: a starting figure, there so the
     * plan can be projected, to be corrected against the copy in hand.
     */
    resolveBook: (id: string, found: BookLookup) =>
      commit((s) => ({
        ...s,
        books: s.books.map((b) =>
          b.id === id
            ? {
                ...b,
                // A cover already found stays unless this lookup found one.
                coverId: found.coverId ?? (typeof b.coverId === "string" ? b.coverId : null),
                lookup: found.complete === false ? b.lookup : LOOKUP_VERSION,
                ...(!b.author?.trim() && found.author ? { author: found.author } : {}),
                ...(!(b.pages > 0) && found.pages && found.pages > 0 ? { pages: Math.round(found.pages) } : {}),
                ...(!b.category && found.category ? { category: found.category } : {}),
              }
            : b
        ),
      })),

    removeBook: (id: string) => commit((s) => R.removeBook(s, id)),
    /** Reads a Markdown reading plan into tracks, phases and books. See lib/planImport.ts. */
    importPlan: (plan: Plan) => commit((s) => applyPlan(s, plan).state),

    /** Learning goals from a JSON or Markdown file. See lib/goalImport.ts. */
    importGoals: (plan: GoalPlan, opts: ImportOptions) => commit((s) => applyGoalPlan(s, plan, opts).state),

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
        const entry: CalorieEntry = {
          id: uid(),
          date: date || dateKey(),
          kcal: Math.round(kcal),
          at: Date.now(),
        };
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
    removeMacroEntry: (id: string) =>
      commit((s) => ({ ...s, macros: s.macros.filter((e) => e.id !== id) })),

    addMacros: (protein: number | null, fiber: number | null) =>
      commit((s) => {
        const p = protein != null && Number.isFinite(protein) && protein > 0 ? Math.round(protein) : undefined;
        const f = fiber != null && Number.isFinite(fiber) && fiber > 0 ? Math.round(fiber) : undefined;
        if (p === undefined && f === undefined) return s;
        const entry: MacroEntry = { id: uid(), date: dateKey(), at: Date.now() };
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

    addExercise: (
      workoutId: string,
      name: string,
      weight: number | null,
      oneArm = false,
      extra?: { seconds?: number | null; note?: string; blockId?: string }
    ) =>
      commit((s) => {
        const clean = name.trim();
        if (!clean) return s;
        const ex: Exercise = { id: uid(), name: clean };
        if (weight != null && Number.isFinite(weight) && weight > 0) ex.weight = weight;
        if (oneArm) ex.oneArm = true;
        if (extra?.seconds != null && extra.seconds > 0) ex.seconds = Math.round(extra.seconds);
        if (extra?.note?.trim()) ex.note = extra.note.trim();
        if (extra?.blockId) ex.blockId = extra.blockId;
        return {
          ...s,
          workouts: s.workouts.map((w) =>
            w.id === workoutId ? { ...w, exercises: [...w.exercises, ex] } : w
          ),
        };
      }),

    updateExercise: (
      workoutId: string,
      exerciseId: string,
      name: string,
      weight: number | null,
      oneArm = false,
      extra?: { seconds?: number | null; note?: string }
    ) =>
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
                          ...(oneArm ? { oneArm: true } : {}),
                          ...(extra?.seconds != null && extra.seconds > 0
                            ? { seconds: Math.round(extra.seconds) }
                            : {}),
                          ...(extra?.note?.trim() ? { note: extra.note.trim() } : {}),
                          ...(e.blockId ? { blockId: e.blockId } : {}),
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
    /** Adds a block. Its exercises are added to it afterwards, like any other. */
    addBlock: (workoutId: string, name: string, mode: "sets" | "circuit") =>
      commit((s) => {
        const clean = name.trim();
        if (!clean) return s;
        const block: WorkoutBlock =
          mode === "circuit"
            ? { id: uid(), name: clean, mode, rounds: 3, workSeconds: 40, restSeconds: 20 }
            : { id: uid(), name: clean, mode };
        return {
          ...s,
          workouts: s.workouts.map((w) =>
            w.id === workoutId ? { ...w, blocks: [...(w.blocks ?? []), block] } : w
          ),
        };
      }),

    updateBlock: (workoutId: string, blockId: string, patch: Partial<Omit<WorkoutBlock, "id">>) =>
      commit((s) => ({
        ...s,
        workouts: s.workouts.map((w) =>
          w.id !== workoutId
            ? w
            : {
                ...w,
                blocks: (w.blocks ?? []).map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
              }
        ),
      })),

    /**
     * Removes a block. Its exercises go back to the workout's main body rather
     * than being deleted with it — losing a list of movements because its
     * heading was removed would be a surprising way to lose them.
     */
    removeBlock: (workoutId: string, blockId: string) =>
      commit((s) => ({
        ...s,
        workouts: s.workouts.map((w) =>
          w.id !== workoutId
            ? w
            : {
                ...w,
                blocks: (w.blocks ?? []).filter((b) => b.id !== blockId),
                exercises: w.exercises.map((e) =>
                  e.blockId === blockId ? { ...e, blockId: undefined } : e
                ),
              }
        ),
      })),

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
            exercises: w.exercises.map((e) => {
              // Laid out as it was done last time, so the usual session is a
              // matter of ticking sets off rather than typing them in. The
              // numbers are a starting point: they are still editable, and
              // nothing counts until a set is marked done.
              const previous = lastPerformed(s.workoutSessions, e.id)?.sets ?? [];
              return {
                exerciseId: e.id,
                name: e.name,
                weight: e.weight,
                // Copied at the start with the rest, so changing the definition
                // mid-session cannot rewrite what is already being counted.
                oneArm: e.oneArm,
                seconds: e.seconds,
                note: e.note,
                blockId: e.blockId,
                sets: previous.map((set) => ({
                  id: uid(),
                  weight: set.weight,
                  reps: set.reps,
                  done: false,
                })),
              };
            }),
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
        // A circuit has no sets at all — its exercises are ticked off by the
        // clock — so a workout counts as performed if anything at all was
        // done, not only if a set was. Judging it by sets alone threw away
        // every timed workout ever finished.
        const anyDone = sets > 0 || a.exercises.some((e) => e.done);
        if (!anyDone) return { ...s, activeWorkout: null };
        // Elapsed time to the nearest minute, never recorded as zero.
        const minutes = Math.max(1, Math.round((Date.now() - a.startedAt) / 60000));
        // Only completed sets are recorded. Anything still planned when the
        // workout was finished simply wasn't performed.
        const exercises: LoggedExercise[] = a.exercises
          .map((e) => ({
            exerciseId: e.exerciseId,
            name: e.name,
            oneArm: e.oneArm,
            sets: e.sets.filter((x) => x.done).map((x) => ({ weight: x.weight, reps: x.reps })),
          }))
          // A timed exercise carries no sets but was still performed, so it is
          // kept on the record by having been marked done.
          .filter((e, i) => e.sets.length > 0 || a.exercises[i]?.done);
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
              at: Date.now(),
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
