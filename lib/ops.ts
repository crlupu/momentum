/**
 * Changes to goals and projects as plain functions of the state, so the app
 * and the Claude connector (app/api/mcp) make them the same way. Books have
 * theirs in lib/reading.ts.
 */
import { NOTE_MAX, dateKey, goalStarted, goalStatus, uid, withTopicCategory, type LearningEntry, type Goal, type GoalStatus, type Part, type Path, type TrackerState } from "./model";
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
    learningLog: (s.learningLog ?? []).filter((e) => e.goalId !== id),
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

/* ---- the learning log ---- */

/**
 * Moves a count (the goal's own, or one part's) by `amount`, kept within 0
 * and its total. Returns the state and how far it really moved.
 */
function moveCount(s: TrackerState, goalId: string, partId: string | undefined, amount: number): { state: TrackerState; moved: number } {
  let moved = 0;
  const goals = s.goals.map((g) => {
    if (g.id !== goalId) return g;
    if (partId) {
      return {
        ...g,
        parts: g.parts?.map((p) => {
          if (p.id !== partId) return p;
          const next = Math.min(p.target, Math.max(0, p.current + amount));
          moved = next - p.current;
          return { ...p, current: next };
        }),
      };
    }
    const cur = g.current ?? 0;
    let next = Math.max(0, cur + amount);
    if (g.target) next = Math.min(next, g.target);
    moved = next - cur;
    return { ...g, current: next };
  });
  return { state: { ...s, goals }, moved };
}

/**
 * A session: moves the count on and logs it, with an optional note. Nothing
 * is logged when the count can't move (already at its total).
 */
export function logSession(
  s: TrackerState,
  e: { id?: string; goalId: string; partId?: string; amount?: number; note?: string; date?: string }
): TrackerState {
  const { state, moved } = moveCount(s, e.goalId, e.partId, e.amount ?? 1);
  if (moved === 0) return s;
  const entry: LearningEntry = {
    id: e.id ?? uid(),
    date: e.date ?? dateKey(),
    at: Date.now(),
    goalId: e.goalId,
    ...(e.partId ? { partId: e.partId } : {}),
    amount: moved,
    ...(e.note?.trim() ? { note: e.note.trim().slice(0, NOTE_MAX) } : {}),
  };
  return { ...state, learningLog: [...(state.learningLog ?? []), entry] };
}

/** Sets or clears an entry's note. */
export function setLogNote(s: TrackerState, id: string, note: string): TrackerState {
  const n = note.trim().slice(0, NOTE_MAX);
  return {
    ...s,
    learningLog: (s.learningLog ?? []).map((e) => {
      if (e.id !== id) return e;
      const { note: _old, ...rest } = e;
      return n ? { ...rest, note: n } : rest;
    }),
  };
}

/** Deletes an entry, and takes its amount back off the count it moved. */
export function deleteLogEntry(s: TrackerState, id: string): TrackerState {
  const e = (s.learningLog ?? []).find((x) => x.id === id);
  if (!e) return s;
  const { state } = moveCount(s, e.goalId, e.partId, -e.amount);
  return { ...state, learningLog: (state.learningLog ?? []).filter((x) => x.id !== id) };
}

/**
 * − on a count: takes back the latest entry for that count when it was
 * logged today and has no note (a tap made by mistake); otherwise just
 * lowers the count, as a correction, leaving the log as it is.
 */
export function stepBack(s: TrackerState, goalId: string, partId?: string): TrackerState {
  const last = [...(s.learningLog ?? [])]
    .reverse()
    .find((e) => e.goalId === goalId && (e.partId ?? undefined) === (partId ?? undefined));
  if (last && last.date === dateKey() && !last.note && last.amount === 1) return deleteLogEntry(s, last.id);
  return moveCount(s, goalId, partId, -1).state;
}

/** A goal's sessions, oldest first. */
export function goalLog(s: TrackerState, goalId: string): LearningEntry[] {
  return (s.learningLog ?? []).filter((e) => e.goalId === goalId).sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
}

/**
 * Logs how a goal's counts changed between two states, without moving them
 * again: one entry per count that moved, the note on the first. For changes
 * made elsewhere (the connector), so they read back like any session.
 */
export function logChanges(before: TrackerState, after: TrackerState, goalId: string, note?: string): TrackerState {
  const a = before.goals.find((g) => g.id === goalId);
  const b = after.goals.find((g) => g.id === goalId);
  if (!a || !b) return after;
  const moves: { partId?: string; amount: number }[] = [];
  if (b.parts?.length) {
    for (const p of b.parts) {
      const was = a.parts?.find((x) => x.id === p.id)?.current ?? 0;
      if (p.current !== was) moves.push({ partId: p.id, amount: p.current - was });
    }
  } else if ((b.current ?? 0) !== (a.current ?? 0)) {
    moves.push({ amount: (b.current ?? 0) - (a.current ?? 0) });
  }
  if (!moves.length) return after;
  const now = Date.now();
  const entries: LearningEntry[] = moves.map((m, i) => ({
    id: uid(),
    date: dateKey(),
    at: now + i,
    goalId,
    ...(m.partId ? { partId: m.partId } : {}),
    amount: m.amount,
    ...(i === 0 && note?.trim() ? { note: note.trim().slice(0, NOTE_MAX) } : {}),
  }));
  return { ...after, learningLog: [...(after.learningLog ?? []), ...entries] };
}
