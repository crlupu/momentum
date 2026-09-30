/**
 * Changes to goals and projects as plain functions of the state, so the app
 * and the Claude connector (app/api/mcp) make them the same way. Books have
 * theirs in lib/reading.ts.
 */
import { dateKey, uid, type TrackerState } from "./model";
import { withStatus, type CardStatus } from "./projects";

const count = (n: number | null | undefined, min: number) =>
  n != null && Number.isFinite(n) && n >= min ? n : undefined;

/** Adds a goal, optionally straight into a topic, whose category it then takes. */
export function addGoal(
  s: TrackerState,
  g: { title: string; catId: string; current?: number | null; target?: number | null; pathId?: string | null; note?: string },
  id: string = uid()
): TrackerState {
  return {
    ...s,
    goals: [
      ...s.goals,
      {
        id,
        title: g.title.trim(),
        catId: (g.pathId && s.paths.find((p) => p.id === g.pathId)?.catId) || g.catId,
        current: count(g.current, 0),
        // A target of 0 is no target.
        target: g.target != null && g.target > 0 ? count(g.target, 0) : undefined,
        done: false,
        doneDate: null,
        note: g.note?.trim() || undefined,
      },
    ],
    paths: g.pathId
      ? s.paths.map((p) => (p.id === g.pathId ? { ...p, goalIds: [...p.goalIds, id] } : p))
      : s.paths,
  };
}

/** Marks a goal done, or open again. */
export function setGoalDone(s: TrackerState, id: string, done: boolean): TrackerState {
  return {
    ...s,
    goals: s.goals.map((g) =>
      g.id === id && g.done !== done
        ? { ...g, done, doneDate: done ? dateKey() : null, doneAt: done ? Date.now() : null }
        : g
    ),
  };
}

/** Sets a goal's count: how far along, and of how many. */
export function setGoalCount(
  s: TrackerState,
  id: string,
  c: { current?: number; target?: number }
): TrackerState {
  return {
    ...s,
    goals: s.goals.map((g) => {
      if (g.id !== id) return g;
      const target = c.target !== undefined ? (c.target > 0 ? c.target : undefined) : g.target;
      const current = c.current !== undefined ? Math.max(0, c.current) : g.current;
      return { ...g, target, current: target && current != null ? Math.min(current, target) : current };
    }),
  };
}

export function addProject(
  s: TrackerState,
  f: { title: string; note?: string; link?: string },
  id: string = uid()
): TrackerState {
  return {
    ...s,
    projects: [
      ...s.projects,
      {
        id,
        title: f.title.trim(),
        note: f.note?.trim() || undefined,
        link: f.link?.trim() || undefined,
        createdAt: Date.now(),
        tags: [],
        cards: [],
      },
    ],
  };
}

export function addCard(
  s: TrackerState,
  projectId: string,
  f: { title: string; note?: string; tagIds?: string[] },
  status: CardStatus = "todo",
  id: string = uid()
): TrackerState {
  return {
    ...s,
    projects: s.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            cards: [
              ...p.cards,
              {
                id,
                title: f.title.trim(),
                status,
                note: f.note?.trim() || undefined,
                tagIds: f.tagIds?.length ? f.tagIds : undefined,
                doneAt: status === "done" ? Date.now() : undefined,
              },
            ],
          }
        : p
    ),
  };
}

/** Moves a card to another column, at the end of it. */
export function moveCard(s: TrackerState, projectId: string, cardId: string, status: CardStatus): TrackerState {
  return {
    ...s,
    projects: s.projects.map((p) => {
      if (p.id !== projectId) return p;
      const card = p.cards.find((c) => c.id === cardId);
      if (!card || card.status === status) return p;
      return { ...p, cards: [...p.cards.filter((c) => c.id !== cardId), withStatus(card, status)] };
    }),
  };
}
