/**
 * Projects: personal projects tracked the way a Trello board tracks them.
 *
 * Each project is a board of cards in three columns — To do, Doing, Done.
 * Cards are kept in one list per project; a card's column is its `status`
 * and its place in the column is its place in that list among the cards of
 * the same status. That keeps a move between columns a single rewrite of the
 * list, and the order within each column survives every move.
 *
 * Learning goals (lib/tracker.ts, Goal) measure how far through something
 * you are; a project's progress is simply how many of its cards are done.
 */

export type CardStatus = "todo" | "doing" | "done";

export const COLUMNS: { id: CardStatus; title: string }[] = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];

/**
 * A label for cards, made for one project and belonging to it: "Backend",
 * "Bug", "Design". Colours come round the data palette in turn.
 */
export type ProjectTag = {
  id: string;
  name: string;
  color: string;
};

export type ProjectCard = {
  id: string;
  title: string;
  status: CardStatus;
  /** Its tags, by id, from the project's own list. */
  tagIds?: string[];
  /** Anything worth remembering about it. */
  note?: string;
  /** When it should be done by, as YYYY-MM-DD. */
  due?: string;
  /** When it reached Done, as epoch milliseconds. */
  doneAt?: number;
};

export type Project = {
  id: string;
  title: string;
  /** What it is, in a line. */
  note?: string;
  /** Where it lives: a repository, a design file. */
  link?: string;
  /** Saved by the first version, which gave projects a category; unused now. */
  catId?: string;
  /** The tags its cards can carry. */
  tags: ProjectTag[];
  /** Finished projects move out of the way, to their own view. */
  done?: boolean;
  doneDate?: string | null;
  createdAt: number;
  cards: ProjectCard[];
};

/** The colour for a project's next tag: round the palette, in order. */
export function nextTagColor(p: Project, palette: readonly string[]): string {
  return palette[p.tags.length % palette.length];
}

/** A card's tags, in the project's order, skipping any since deleted. */
export function cardTags(p: Project, c: ProjectCard): ProjectTag[] {
  const ids = new Set(c.tagIds ?? []);
  return p.tags.filter((t) => ids.has(t.id));
}

/** The cards of one column, in order. */
export function columnCards(p: Project, status: CardStatus): ProjectCard[] {
  return p.cards.filter((c) => c.status === status);
}

/** Cards done, of all cards. */
export function projectProgress(p: Project): { done: number; total: number; pct: number } {
  const total = p.cards.length;
  const done = p.cards.filter((c) => c.status === "done").length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * Rebuilds a project's card list from the columns' ids, in order. Used after
 * a drag, where both the column a card sits in and its place may change.
 * Cards not named anywhere keep their column and go last.
 */
export function arrangeCards(p: Project, cols: Record<CardStatus, string[]>): ProjectCard[] {
  const byId = new Map(p.cards.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const out: ProjectCard[] = [];
  for (const { id: status } of COLUMNS) {
    for (const id of cols[status] ?? []) {
      const c = byId.get(id);
      if (!c || seen.has(id)) continue;
      seen.add(id);
      out.push(c.status === status ? c : withStatus(c, status));
    }
  }
  return [...out, ...p.cards.filter((c) => !seen.has(c.id))];
}

/** A card moved to a column, its finish time set or cleared to match. */
export function withStatus(c: ProjectCard, status: CardStatus): ProjectCard {
  if (c.status === status) return c;
  return { ...c, status, doneAt: status === "done" ? Date.now() : undefined };
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const STATUSES: CardStatus[] = ["todo", "doing", "done"];

/** Projects as saved, tidied; absent in state saved before projects existed. */
export function migrateProjects(raw: unknown, uid: () => string): Project[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((p) => ({
    id: (p.id as string) ?? uid(),
    title: (p.title as string) ?? "",
    note: str(p.note),
    link: str(p.link),
    catId: str(p.catId),
    done: p.done === true ? true : undefined,
    doneDate: (p.doneDate as string) ?? null,
    createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
    tags: Array.isArray(p.tags)
      ? (p.tags as Array<Record<string, unknown>>)
          .filter((t) => typeof t.id === "string" && typeof t.name === "string")
          .map((t) => ({ id: t.id as string, name: t.name as string, color: (t.color as string) ?? "#646f7f" }))
      : [],
    cards: Array.isArray(p.cards)
      ? (p.cards as Array<Record<string, unknown>>).map((c) => ({
          id: (c.id as string) ?? uid(),
          title: (c.title as string) ?? "",
          status: STATUSES.includes(c.status as CardStatus) ? (c.status as CardStatus) : "todo",
          tagIds: Array.isArray(c.tagIds) && c.tagIds.length
            ? (c.tagIds as unknown[]).filter((x): x is string => typeof x === "string")
            : undefined,
          note: str(c.note),
          due: str(c.due),
          doneAt: typeof c.doneAt === "number" ? c.doneAt : undefined,
        }))
      : [],
  }));
}
