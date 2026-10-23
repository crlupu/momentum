import { type Goal, type Path, type TrackerState, goalStatus, uid } from "./model";

/**
 * Learning paths: sections of the Learning list, each holding goals in the
 * order they're meant to be taken. A goal in no path is in General, the
 * default path, which is never stored: it is simply what's left.
 */

export const GENERAL = "general";

/** A goal's items done and in all: its checklist or count, or 1 for a goal with neither. */
export function goalUnits(g: Goal): { done: number; total: number } {
  const total = g.target && g.target > 0 ? g.target : 1;
  if (goalStatus(g) === "done") return { done: total, total };
  return { done: g.target && g.target > 0 ? Math.min(total, g.current ?? 0) : 0, total };
}

/**
 * How far a path is: every item of every goal in it, added up, so a goal of
 * 26 steps weighs more than one of 8. Dropped goals don't count.
 */
export function pathProgress(goals: Goal[]): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  for (const g of goals) {
    if (goalStatus(g) === "dropped") continue;
    const u = goalUnits(g);
    done += u.done;
    total += u.total;
  }
  return { done, total, pct: total ? Math.floor((done / total) * 100) : 0 };
}

/** A path's goals in its order. */
export function goalsOf(s: TrackerState, path: Path): Goal[] {
  return path.goalIds.map((id) => s.goals.find((g) => g.id === id)).filter((g): g is Goal => !!g);
}

/** The goals in General: in no path, in the goals' own order. */
export function generalGoals(s: TrackerState): Goal[] {
  const placed = new Set(s.paths.flatMap((p) => p.goalIds));
  return s.goals.filter((g) => !placed.has(g.id));
}

/** Where a goal is: its path's id, or GENERAL. */
export function pathOfGoal(s: TrackerState, goalId: string): string {
  return s.paths.find((p) => p.goalIds.includes(goalId))?.id ?? GENERAL;
}

export function createPath(s: TrackerState, title: string): { state: TrackerState; id: string } {
  const id = uid();
  const t = title.trim();
  if (!t) return { state: s, id };
  return { state: { ...s, paths: [...s.paths, { id, title: t, goalIds: [] }] }, id };
}

export function editPath(s: TrackerState, id: string, patch: { title?: string }): TrackerState {
  return {
    ...s,
    paths: s.paths.map((p) => (p.id === id && patch.title?.trim() ? { ...p, title: patch.title.trim() } : p)),
  };
}

/** Deletes a path. Its goals aren't touched: they go back to General. */
export function deletePath(s: TrackerState, id: string): TrackerState {
  return { ...s, paths: s.paths.filter((p) => p.id !== id) };
}

/** Moves a path one place up or down the list. */
export function movePath(s: TrackerState, id: string, by: -1 | 1): TrackerState {
  const i = s.paths.findIndex((p) => p.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= s.paths.length) return s;
  const paths = [...s.paths];
  [paths[i], paths[j]] = [paths[j], paths[i]];
  return { ...s, paths };
}

/** Moves a goal to the end of a path, or to General. */
export function moveGoalToPath(s: TrackerState, goalId: string, pathId: string): TrackerState {
  const out = s.paths.map((p) => ({ ...p, goalIds: p.goalIds.filter((g) => g !== goalId) }));
  return {
    ...s,
    paths: pathId === GENERAL ? out : out.map((p) => (p.id === pathId ? { ...p, goalIds: [...p.goalIds, goalId] } : p)),
  };
}

/**
 * Lays the list out as it was arranged by dragging: each path's goals in the
 * given order, General's too. Goals the arrangement didn't show (finished
 * ones, say) keep their path, after the ones shown.
 */
export function arrangeLearning(s: TrackerState, layout: { pathId: string; goalIds: string[] }[]): TrackerState {
  const shown = new Set(layout.flatMap((l) => l.goalIds));
  const paths = s.paths.map((p) => {
    const ids = layout.find((l) => l.pathId === p.id)?.goalIds ?? [];
    return { ...p, goalIds: [...ids, ...p.goalIds.filter((id) => !shown.has(id))] };
  });
  // General's order is the goals' own order: the arranged ones first.
  const order = layout.flatMap((l) => l.goalIds);
  const byId = new Map(s.goals.map((g) => [g.id, g]));
  const goals = [
    ...order.map((id) => byId.get(id)).filter((g): g is Goal => !!g),
    ...s.goals.filter((g) => !shown.has(g.id)),
  ];
  return { ...s, paths, goals };
}
