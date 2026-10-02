/**
 * Changes to goals and projects as plain functions of the state, so the app
 * and the Claude connector (app/api/mcp) make them the same way. Books have
 * theirs in lib/reading.ts.
 */
import { dateKey, goalStarted, goalStatus, uid, withTopicCategory, type Goal, type GoalStatus, type Part, type Path, type TrackerState } from "./model";
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
        status: "queued",
        doneDate: null,
        note: g.note?.trim() || undefined,
      },
    ],
    paths: g.pathId
      ? s.paths.map((p) => (p.id === g.pathId ? { ...p, goalIds: [...p.goalIds, id] } : p))
      : s.paths,
  };
}

/** Marks a goal done, or open again: active if any of it is counted, else queued. */
export function setGoalDone(s: TrackerState, id: string, done: boolean): TrackerState {
  const g = s.goals.find((x) => x.id === id);
  if (!g) return s;
  return setGoalStatus(s, id, done ? "done" : goalStarted({ ...g, done: false }) ? "active" : "queued");
}

/**
 * Sets a goal's status, keeping `done` and the date it was done in step. A
 * goal leaving done loses its done date; one dropped keeps everything else.
 */
export function setGoalStatus(s: TrackerState, id: string, status: GoalStatus): TrackerState {
  return {
    ...s,
    goals: s.goals.map((g) => {
      if (g.id !== id || goalStatus(g) === status) return g;
      const done = status === "done";
      return {
        ...g,
        status,
        done,
        doneDate: done ? dateKey() : null,
        doneAt: done ? Date.now() : null,
      };
    }),
  };
}

/** Renames a goal, or changes its link or description. Empty clears a link or description. */
export function editGoal(
  s: TrackerState,
  id: string,
  e: { title?: string; link?: string; description?: string }
): TrackerState {
  return {
    ...s,
    goals: s.goals.map((g) =>
      g.id === id
        ? {
            ...g,
            ...(e.title?.trim() ? { title: e.title.trim() } : {}),
            ...(e.link !== undefined ? { link: e.link.trim() || undefined } : {}),
            ...(e.description !== undefined ? { note: e.description.trim() || undefined } : {}),
          }
        : g
    ),
  };
}

/** Adds an empty topic; returns the state and the new topic's id. */
export function addTopic(s: TrackerState, title: string, catId?: string): { state: TrackerState; id: string } {
  const id = uid();
  const topic: Path = { id, title: title.trim(), goalIds: [], ...(catId ? { catId } : {}) };
  return { state: { ...s, paths: [...s.paths, topic] }, id };
}

/**
 * Moves a goal into a topic, at its end, or out of every topic (null). It
 * keeps its progress, parts, status and phases; it takes the new topic's
 * category, as every goal in a topic does.
 */
export function moveGoalToTopic(s: TrackerState, goalId: string, topicId: string | null): TrackerState {
  const topic = topicId ? s.paths.find((p) => p.id === topicId) : undefined;
  return {
    ...s,
    goals: withTopicCategory(s.goals, topic, [goalId]),
    paths: s.paths.map((p) => {
      const has = p.goalIds.includes(goalId);
      if (p.id === topicId) return has ? p : { ...p, goalIds: [...p.goalIds, goalId] };
      return has ? { ...p, goalIds: p.goalIds.filter((g) => g !== goalId) } : p;
    }),
  };
}

/** Puts a topic's goals in the given order; any it holds but the list leaves out keep their place at the end. */
export function reorderTopic(s: TrackerState, topicId: string, ids: string[]): TrackerState {
  return {
    ...s,
    paths: s.paths.map((p) => {
      if (p.id !== topicId) return p;
      const kept = ids.filter((id) => p.goalIds.includes(id));
      return { ...p, goalIds: [...kept, ...p.goalIds.filter((id) => !kept.includes(id))] };
    }),
  };
}

/** Deletes a goal, taking it out of its topic too. */
export function removeGoal(s: TrackerState, id: string): TrackerState {
  return {
    ...s,
    goals: s.goals.filter((g) => g.id !== id),
    paths: s.paths.map((p) => (p.goalIds.includes(id) ? { ...p, goalIds: p.goalIds.filter((g) => g !== id) } : p)),
  };
}

/** A topic's goals that still exist. Only an empty topic can be deleted. */
export function topicGoalCount(s: TrackerState, topicId: string): number {
  const p = s.paths.find((x) => x.id === topicId);
  return p ? p.goalIds.filter((id) => s.goals.some((g) => g.id === id)).length : 0;
}

/** Renames a topic. */
export function renameTopic(s: TrackerState, topicId: string, title: string): TrackerState {
  const t = title.trim();
  return t ? { ...s, paths: s.paths.map((p) => (p.id === topicId ? { ...p, title: t } : p)) } : s;
}

/** Deletes a topic, but only an empty one: a topic with goals is left as it is. */
export function removeTopic(s: TrackerState, topicId: string): TrackerState {
  if (topicGoalCount(s, topicId) > 0) return s;
  return { ...s, paths: s.paths.filter((p) => p.id !== topicId) };
}

/** Puts a goal in up to two phases ([] for none). Unknown phases are skipped. */
export function setGoalPhases(s: TrackerState, id: string, phaseIds: string[]): TrackerState {
  const valid = [...new Set(phaseIds)].filter((p) => s.readingPhases.some((x) => x.id === p)).slice(0, 2);
  return {
    ...s,
    goals: s.goals.map((g) => (g.id === id ? { ...g, phaseIds: valid.length ? valid : undefined } : g)),
  };
}

/** The other active goals in the goal's topic, for a gentle "already active" note. */
export function otherActiveInTopic(s: TrackerState, id: string): Goal[] {
  const topic = s.paths.find((p) => p.goalIds.includes(id));
  if (!topic) return [];
  return topic.goalIds
    .filter((gid) => gid !== id)
    .map((gid) => s.goals.find((g) => g.id === gid))
    .filter((g): g is Goal => !!g && goalStatus(g) === "active");
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

/**
 * Replaces a goal's parts. Each needs a title and a total above 0; counts are
 * kept within 0 and the total. An empty list removes them.
 */
export function setGoalParts(
  s: TrackerState,
  id: string,
  parts: Array<{ id?: string; title: string; current?: number; target: number }>
): TrackerState {
  const clean: Part[] = parts
    .filter((p) => p.title.trim() && Number.isFinite(p.target) && p.target > 0)
    .map((p) => ({
      id: p.id ?? uid(),
      title: p.title.trim(),
      target: p.target,
      current: Math.min(p.target, Math.max(0, p.current ?? 0)),
    }));
  return {
    ...s,
    goals: s.goals.map((g) => (g.id === id ? { ...g, parts: clean.length ? clean : undefined } : g)),
  };
}

/** Moves one part's count by a step, kept within 0 and its total. */
export function stepPart(s: TrackerState, goalId: string, partId: string, delta: number): TrackerState {
  return {
    ...s,
    goals: s.goals.map((g) =>
      g.id === goalId && g.parts
        ? {
            ...g,
            parts: g.parts.map((p) =>
              p.id === partId ? { ...p, current: Math.min(p.target, Math.max(0, p.current + delta)) } : p
            ),
          }
        : g
    ),
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
