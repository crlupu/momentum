/**
 * What Claude can do with Momentum through the connector: read an overview
 * and the workouts (with sets, reps and weights lifted), and add or update books, goals and project cards. Every change goes
 * through the same functions the app uses (lib/reading.ts, lib/ops.ts, the
 * importers), so the result is what the app itself would have made.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  dateKey,
  findItem,
  goalStatus,
  goalTopic,
  isDateKey,
  goalSummary,
  uid,
  type GoalItem,
  type GoalStatus,
  exerciseSeconds,
  type SetRecord,
  type TrackerState,
} from "../model";
import * as R from "../reading";
import * as O from "../ops";
import { goalLastActive } from "../ops";
import { makePlan, validPlan } from "../weight";
import { patchRoutineItem, routines, type RepeatSetting, type RoutineKind } from "../routines";
import { projectFinished, type CardStatus } from "../projects";
import { applyGoalPlan, type PlanGoal } from "../goalImport";
import { PLAN_FORMAT, applyPlan, parsePlan } from "../planImport";
import { change, readState } from "./store";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Finds one thing by id or by name: an exact name first, then a unique
 * partial one. Ambiguity is an error naming the candidates, so Claude can
 * ask rather than guess.
 */
function pick<T extends { id: string }>(items: T[], ref: string, name: (t: T) => string, what: string): T {
  const byId = items.find((t) => t.id === ref);
  if (byId) return byId;
  const q = norm(ref);
  const exact = items.filter((t) => norm(name(t)) === q);
  if (exact.length === 1) return exact[0];
  const partial = exact.length ? exact : items.filter((t) => norm(name(t)).includes(q));
  if (partial.length === 1) return partial[0];
  if (!partial.length) throw new Error(`No ${what} matches "${ref}".`);
  throw new Error(`"${ref}" matches several ${what}s: ${partial.map(name).join("; ")}. Say which.`);
}

/** An array, also accepted as JSON text (see update_goal). */
const jsonArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }, schema);

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 1) }] });

/** Runs a tool, turning a thrown error into a message Claude can act on. */
const safe =
  <A,>(fn: (a: A) => Promise<unknown>) =>
  async (a: A) => {
    try {
      return text(await fn(a));
    } catch (e) {
      return { ...text(e instanceof Error ? e.message : String(e)), isError: true };
    }
  };

/** "[x] Lecture 1 <https://…>": an entry as the overview lists it. */
const itemLine = (i: GoalItem) => `[${i.done ? "x" : " "}] ${i.title}${i.url ? ` <${i.url}>` : ""}`;

function overview(s: TrackerState, section: string) {
  const out: Record<string, unknown> = {};
  if (section === "all" || section === "books") {
    out.tracks = s.readingTracks.filter((t) => !t.archived).map((t) => ({ id: t.id, name: t.name, pagesPerDay: t.dailyTarget, ...(t.note ? { description: t.note } : {}) }));
    // A waiting book's place in its track's queue, 1 being next up.
    const queuePos = new Map<string, number>();
    for (const t of s.readingTracks) R.trackQueue(s, t.id).forEach((b, i) => queuePos.set(b.id, i + 1));
    out.books = s.books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author || undefined,
      status: b.status,
      queue: queuePos.get(b.id),
      page: b.read,
      pages: b.pages || undefined,
      track: s.readingTracks.find((t) => t.id === b.trackId)?.name,
      category: b.category,
    }));
  }
  if (section === "all" || section === "learning") {
    out.topics = s.paths.map((p) => ({ id: p.id, name: p.title }));
    out.goals = s.goals.map((g) => ({
      id: g.id,
      title: g.title,
      topic: goalTopic(g.id, s.paths)?.title,
      status: goalStatus(g),
      ...(goalSummary(g) ? { next: goalSummary(g)!.replace(/^Next: /, "") } : {}),
      ...(goalLastActive(s, g.id) ? { last_worked_on: goalLastActive(s, g.id) } : {}),
      checklist: g.items?.map(itemLine),
      ...(g.parts?.some((p) => p.items?.length)
        ? { part_checklists: Object.fromEntries(g.parts.filter((p) => p.items?.length).map((p) => [p.title, p.items!.map(itemLine)])) }
        : {}),
      description: g.note,
      link: g.link,
      ...sessionsOf(s, g.id),
    }));
  }
  if (section === "all" || section === "todos") {
    out.todos = s.todos
      .filter((t) => !t.done)
      .map((t) => {
        const g = t.goalId ? s.goals.find((x) => x.id === t.goalId) : undefined;
        return {
          id: t.id,
          title: t.title,
          ...(t.date ? { date: t.date } : {}),
          ...(g ? { ticks_with: g.title + (t.partId ? ` · ${g.parts?.find((p) => p.id === t.partId)?.title ?? ""}` : "") } : {}),
        };
      });
  }
  if (section === "all" || section === "recurring") {
    out.categories = s.categories.map((c) => c.name);
    // Kept by themselves: every active goal, book being read and workout,
    // done for its period once there's activity on it.
    out.recurring = routines(s).map((r) => ({
      kind: r.kind,
      id: r.id,
      title: r.title,
      frequency: r.freq,
      category: r.cat.name,
      done_this_period: r.done,
    }));
  }
  if (section === "all" || section === "projects") {
    out.projects = s.projects.map((p) => ({
      id: p.id,
      title: p.title,
      finished: projectFinished(p),
      cards: p.cards.map((c) => ({ id: c.id, title: c.title, column: c.status })),
    }));
  }
  return out;
}

/** "3 × 10 @ 60 kg" when every set matches, otherwise each set listed. */
function setsSummary(sets: SetRecord[], oneArm?: boolean): string {
  const one = (x: SetRecord) =>
    `${x.reps ?? "?"}${x.weight != null ? ` @ ${x.weight} kg` : ""}`;
  const side = oneArm ? " (per side)" : "";
  if (!sets.length) return "done (timed)";
  const first = one(sets[0]);
  if (sets.every((x) => one(x) === first)) return `${sets.length} × ${first}${side}`;
  return sets.map(one).join(", ") + side;
}

/**
 * Workouts as planned plus what was last lifted. A definition carries only
 * the working weight; sets and reps exist only in logged sessions, so each
 * exercise also reports its most recent sessions with every set.
 */
export function workoutsView(s: TrackerState, ref: string | undefined, history: number) {
  const list = ref ? [pick(s.workouts, ref, (w) => w.name, "workout")] : s.workouts;
  return list.map((w) => {
    const done = s.workoutSessions.filter((x) => x.workoutId === w.id);
    const last = done[done.length - 1];
    return {
      id: w.id,
      name: w.name,
      sessions_logged: done.length,
      ...(last ? { last_session: { date: last.date, minutes: last.minutes, volume_kg: last.total } } : {}),
      ...(w.blocks?.length
        ? {
            blocks: w.blocks.map((b) => ({
              name: b.name,
              mode: b.mode,
              ...(b.mode === "circuit" ? { rounds: b.rounds, work_seconds: b.workSeconds, rest_seconds: b.restSeconds } : {}),
            })),
          }
        : {}),
      exercises: w.exercises.map((e) => {
        const block = w.blocks?.find((b) => b.id === e.blockId);
        const recent: { date: string; sets: SetRecord[] }[] = [];
        for (let i = s.workoutSessions.length - 1; i >= 0 && recent.length < history; i--) {
          const le = s.workoutSessions[i].exercises?.find((x) => x.exerciseId === e.id);
          if (le) recent.push({ date: s.workoutSessions[i].date, sets: le.sets });
        }
        return {
          name: e.name,
          ...(block ? { block: block.name } : {}),
          ...(e.weight != null ? { working_weight_kg: e.weight } : { working_weight_kg: "bodyweight" }),
          ...(e.oneArm ? { one_arm: true } : {}),
          ...(block?.mode === "circuit" || e.seconds ? { seconds: exerciseSeconds(e, block) } : {}),
          ...(e.note ? { note: e.note } : {}),
          ...(recent.length
            ? {
                last_performed: recent.map((r) => ({
                  date: r.date,
                  summary: setsSummary(r.sets, e.oneArm),
                  sets: r.sets.map((x) => ({ reps: x.reps, weight_kg: x.weight })),
                })),
              }
            : { last_performed: "never logged" }),
        };
      }),
    };
  });
}

const COLUMN = z.enum(["todo", "doing", "done"]);


/**
 * Writes a goal's whole checklist. Entries already there are matched by link,
 * then by title, and keep their id and tick; ticks that change are logged as
 * sessions, as in the app. A goal's first checklist carries its progress
 * over without logging it again: ticks as given, or the first entries up to
 * its count when none is given.
 */
function writeChecklist(
  s: TrackerState,
  goalId: string,
  list: { title: string; url?: string; done?: boolean }[],
  note?: string,
  partId?: string
): TrackerState {
  const g = s.goals.find((x) => x.id === goalId)!;
  const owner = partId ? g.parts?.find((p) => p.id === partId) : g;
  const had = owner?.items ?? [];
  if (!list.length) return O.setGoalItems(s, goalId, [], partId);
  if (!had.length) {
    const given = list.some((i) => i.done !== undefined);
    const carry = given ? 0 : Math.min(owner?.current ?? 0, list.length);
    return O.setGoalItems(
      s,
      goalId,
      list.map((i, n) => ({ title: i.title, url: i.url, done: given ? i.done === true : n < carry })),
      partId
    );
  }
  const used = new Set<string>();
  const key = (u?: string) => (u ?? "").trim().toLowerCase().replace(/\/+$/, "");
  const match = (i: { title: string; url?: string }) => {
    const free = had.filter((h) => !used.has(h.id));
    const found =
      (i.url && free.find((h) => h.url && key(h.url) === key(i.url))) ||
      free.find((h) => norm(h.title) === norm(i.title));
    if (found) used.add(found.id);
    return found;
  };
  const rows = list.map((i) => ({ i, old: match(i) }));
  // The list as written, ticks as they were; then each tick that changes, as a session.
  let next = O.setGoalItems(
    s,
    goalId,
    rows.map(({ i, old }) => ({ id: old?.id ?? uid(), title: i.title, url: i.url, done: old?.done ?? false, doneDate: old?.doneDate })),
    partId
  );
  const after = next.goals.find((x) => x.id === goalId)!;
  const items = (partId ? after.parts?.find((p) => p.id === partId)?.items : after.items) ?? [];
  let first = true;
  rows.forEach(({ i }, n) => {
    if (i.done === undefined || items[n].done === i.done) return;
    next = O.setItemDone(next, goalId, items[n].id, i.done, first ? note : undefined);
    first = false;
  });
  return next;
}

/** A goal's last session date and its notes, oldest first (the last ten). */
function sessionsOf(s: TrackerState, goalId: string) {
  const log = O.goalLog(s, goalId);
  if (!log.length) return {};
  const notes = log.filter((e) => e.note).slice(-10).map((e) => `${e.date}: ${e.note}`);
  return { last_session: log[log.length - 1].date, ...(notes.length ? { notes } : {}) };
}

/** " Also active in Rust ramp up: The Rust Book." when the goal shares its topic with other active goals. */
function alsoActive(s: TrackerState, id: string): string {
  const g = s.goals.find((x) => x.id === id);
  if (!g || goalStatus(g) !== "active") return "";
  const others = O.otherActiveInTopic(s, id);
  return others.length ? ` Also active in ${goalTopic(id, s.paths)?.title}: ${others.map((x) => x.title).join(", ")}.` : "";
}

export function registerTools(server: McpServer) {
  server.registerTool(
    "momentum_overview",
    {
      title: "Momentum overview",
      description:
        "Reads the user's Momentum data: reading tracks and books (with status and current page), learning topics and goals, open to-dos (with the day they're planned for and the goal step that ticks them), recurring tasks (automatic: active goals, books being read and workouts, with frequency, category and whether done this period), and projects with their cards. Call this first to find the names and ids the other tools take.",
      inputSchema: { section: z.enum(["all", "books", "learning", "todos", "recurring", "projects"]).default("all") },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ section }: { section: string }) => overview(await readState(), section))
  );

  server.registerTool(
    "workouts",
    {
      title: "Workouts",
      description:
        "Reads the user's workout plans (Push, Pull, Legs…): each workout's blocks and exercises with working weight, one-arm flag, timed seconds and notes, plus the most recent logged sessions for every exercise with each set's reps and weight. Sets and reps live only in logged sessions, so last_performed is where they come from.",
      inputSchema: {
        workout: z.string().optional().describe("Workout name or id; all workouts when left out"),
        history: z.number().int().min(1).max(10).default(1).describe("How many recent sessions to show per exercise"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ workout, history }: { workout?: string; history: number }) =>
      workoutsView(await readState(), workout, history)
    )
  );

  server.registerTool(
    "add_books",
    {
      title: "Add books",
      description:
        "Adds books to the end of a reading track's queue. The track is named as in the overview; without one, the first track is used. Covers, categories and missing page counts are looked up by the app afterwards.",
      inputSchema: {
        books: z
          .array(
            z.object({
              title: z.string(),
              author: z.string().optional(),
              pages: z.number().int().positive().optional(),
              track: z.string().optional().describe("Track name or id"),
            })
          )
          .min(1),
      },
    },
    safe(async ({ books }: { books: { title: string; author?: string; pages?: number; track?: string }[] }) =>
      change((s) => {
        let next = s;
        const added: string[] = [];
        for (const b of books) {
          const live = next.readingTracks.filter((t) => !t.archived);
          const track = b.track ? pick(live, b.track, (t) => t.name, "track") : live[0];
          next = R.addBook(next, { title: b.title, author: b.author, pages: b.pages, trackId: track?.id ?? "" });
          added.push(`${b.title}${track ? ` → ${track.name}` : ""}`);
        }
        return { state: next, result: `Added ${added.length}: ${added.join("; ")}` };
      })
    )
  );

  server.registerTool(
    "update_book",
    {
      title: "Update a book",
      description:
        "Updates one book: the page the user is on (the pages since the last update count as read today; a lower page corrects it), or pages read, its status, its track, or its page count. Status 'finished' marks it read; 'paused' and 'dropped' set it aside; 'queued' puts it back in its queue.",
      inputSchema: {
        book: z.string().describe("Title or id"),
        page: z.number().int().min(0).optional().describe("The page the user is on now"),
        pages_read: z.number().int().positive().optional().describe("Pages read, when that's the number given"),
        status: z.enum(["queued", "active", "paused", "finished", "dropped"]).optional(),
        track: z
          .string()
          .optional()
          .describe('Move it to this track (name or id); an empty string takes it off every track'),
        total_pages: z.number().int().positive().optional(),
      },
    },
    safe(
      async (a: {
        book: string;
        page?: number;
        pages_read?: number;
        status?: R.BookStatus;
        track?: string;
        total_pages?: number;
      }) =>
        change((s) => {
          const b = pick(s.books, a.book, (x) => x.title, "book");
          let next = s;
          const did: string[] = [];
          // An empty track means "no track"; it only counts as a change when
          // the book is on one.
          const untrack = a.track !== undefined && a.track.trim() === "" && b.trackId !== "";
          if (a.track || a.total_pages || untrack) {
            const track = a.track?.trim() ? pick(next.readingTracks, a.track, (t) => t.name, "track") : undefined;
            next = R.updateBook(next, b.id, {
              title: b.title,
              author: b.author,
              pages: a.total_pages ?? b.pages,
              edition: b.edition,
              language: b.language,
              tags: b.tags,
              trackId: untrack ? "" : (track?.id ?? b.trackId),
              coverImage: b.coverImage,
              after: b.after,
              note: b.note,
            });
            if (track) did.push(`moved to ${track.name}`);
            if (untrack) did.push("taken off its track");
            if (a.total_pages) did.push(`${a.total_pages} pages`);
          }
          const cur = next.books.find((x) => x.id === b.id)!;
          if (a.page != null) {
            if (a.page < cur.read) {
              next = R.setCurrentPage(next, b.id, a.page);
              did.push(`corrected to page ${a.page}`);
            } else if (a.page > cur.read) {
              next = R.logSession(next, b.id, { id: uid(), date: dateKey(), toPage: a.page });
              did.push(`on page ${a.page} (${a.page - cur.read} read today)`);
            }
          } else if (a.pages_read) {
            next = R.logSession(next, b.id, { id: uid(), date: dateKey(), pages: a.pages_read });
            did.push(`${a.pages_read} pages read today`);
          }
          if (a.status) {
            next = R.setStatus(next, b.id, a.status, { place: "end" });
            did.push(`status ${a.status}`);
          }
          const after = next.books.find((x) => x.id === b.id)!;
          const end = after.pages > 0 && after.read >= after.pages && after.status !== "finished";
          return {
            state: next,
            result: `${b.title}: ${did.join(", ") || "nothing to change"}.${end ? " It's at its last page: ask whether to mark it finished." : ""}`,
          };
        })
    )
  );

  server.registerTool(
    "add_goals",
    {
      title: "Add learning goals",
      description:
        "Adds learning goals, optionally into a topic (created if it doesn't exist). A goal is a habit kept up (a course worked on, a subject practised), not a total to reach; give it a checklist afterwards with update_goal for what to work through next. A goal whose title is already in the topic is updated instead of duplicated.",
      inputSchema: {
        topic: z.string().optional(),
        goals: z
          .array(
            z.object({
              title: z.string(),
              description: z.string().optional(),
              link: z.string().optional(),
            })
          )
          .min(1),
      },
    },
    safe(async ({ topic, goals }: { topic?: string; goals: PlanGoal[] }) =>
      change((s) => {
        const named = topic ? s.paths.find((p) => norm(p.title) === norm(topic))?.title ?? topic : undefined;
        const { state, preview } = applyGoalPlan(
          s,
          { topics: [{ name: named, goals }] },
          { into: "file", fallbackCatId: s.categories[0]?.id ?? "" }
        );
        return { state, result: preview };
      })
    )
  );

  server.registerTool(
    "update_goal",
    {
      title: "Update a goal",
      description:
        "Updates one learning goal: its name, description or link, its topic (moving keeps everything the goal has), or its status: queued, active, done or dropped ('done' true/false still works as a shortcut). Two active goals in one topic are allowed; the result notes it. Goals are habits, with no count, percentage or deadline. session: true logs a session on it for today, with note if given. checklist is what to work through next (videos, talks, lessons), each with a title and an optional link. Passing checklist replaces the whole list ([] removes it): an entry with the same link, or else the same title, as an existing one keeps it and its tick unless done is given; a tick or untick given here is logged like one made in the app. To tick entries one at a time, use check_items.",
      inputSchema: {
        goal: z.string().describe("Title or id"),
        done: z.boolean().optional(),
        status: z.enum(["queued", "active", "done", "dropped"]).optional(),
        title: z.string().min(1).optional().describe("A new name"),
        description: z.string().optional().describe("Its description; empty clears"),
        link: z.string().optional().describe("Where it lives, e.g. the course page; empty clears"),
        topic: z
          .string()
          .optional()
          .describe("Moves it to this topic, by name or id, made if it doesn't exist; empty takes it out of every topic"),
        // Arrays are also taken as JSON text: clients holding the tool list
        // from before a field existed send an array they don't know the type
        // of as a string.
        checklist: jsonArray(
          z.array(
            z.object({
              title: z.string().min(1),
              url: z.string().optional().describe("Where it lives: an http(s) link"),
              done: z.boolean().optional(),
            })
          )
        )
          .optional()
          .describe("The whole checklist, in order; [] removes it"),
        session: z.boolean().optional().describe("true logs a session on it for today"),
        note: z.string().max(200).optional().describe("A line about the session or the ticks"),
      },
    },
    safe(async (a: {
      goal: string;
      done?: boolean;
      status?: GoalStatus;
      title?: string;
      description?: string;
      link?: string;
      topic?: string;
      checklist?: { title: string; url?: string; done?: boolean }[];
      session?: boolean;
      note?: string;
    }) =>
      change((s) => {
        const g = pick(s.goals, a.goal, (x) => x.title, "goal");
        let next = s;
        if (a.title !== undefined || a.description !== undefined || a.link !== undefined)
          next = O.editGoal(next, g.id, { title: a.title, description: a.description, link: a.link });
        if (a.topic !== undefined) {
          let topicId: string | null = null;
          if (a.topic.trim()) {
            const found = next.paths.find((p) => p.id === a.topic || norm(p.title) === norm(a.topic!));
            if (found) topicId = found.id;
            else {
              const made = O.addTopic(next, a.topic);
              next = made.state;
              topicId = made.id;
            }
          }
          next = O.moveGoalToTopic(next, g.id, topicId);
        }
        if (a.checklist !== undefined) next = writeChecklist(next, g.id, a.checklist, a.note);
        if (a.session) next = O.logSession(next, { goalId: g.id, note: a.note });
        if (a.done !== undefined) next = O.setGoalDone(next, g.id, a.done);
        if (a.status) next = O.setGoalStatus(next, g.id, a.status);
        const after = next.goals.find((x) => x.id === g.id)!;
        const last = goalLastActive(next, g.id);
        const nextUp = goalSummary(after);
        const topic = goalTopic(g.id, next.paths)?.title;
        return {
          state: next,
          result: `${after.title}${topic ? ` (${topic})` : ""}: ${goalStatus(after)}${last ? `, last worked on ${last}` : ""}${nextUp ? `, ${nextUp.replace(/^Next: /, "next: ")}` : ""}.${alsoActive(next, g.id)}`,
        };
      })
    )
  );

  server.registerTool(
    "check_items",
    {
      title: "Tick checklist entries",
      description:
        "Ticks (or, with done: false, unticks) entries on a goal's checklist or its parts' checklists, by title or id; a unique part of a title is enough. Each tick is logged as a session for today, like a tick in the app, with note on the first; unticking takes its session back.",
      inputSchema: {
        goal: z.string().describe("Title or id"),
        items: jsonArray(z.array(z.string()).min(1)).describe("Entry titles or ids"),
        done: z.boolean().optional().describe("false unticks; default true"),
        note: z.string().max(200).optional().describe("A line about the session"),
      },
    },
    safe(async (a: { goal: string; items: string[]; done?: boolean; note?: string }) =>
      change((s) => {
        const g = pick(s.goals, a.goal, (x) => x.title, "goal");
        const all = [...(g.items ?? []), ...(g.parts ?? []).flatMap((p) => p.items ?? [])];
        if (!all.length) throw new Error(`${g.title} has no checklist. Give it one with update_goal's checklist.`);
        const done = a.done ?? true;
        const ids = [...new Set(a.items.map((ref) => pick(all, ref, (x) => x.title, `entry of ${g.title}`).id))];
        let next = s;
        ids.forEach((id, n) => (next = O.setItemDone(next, g.id, id, done, n === 0 ? a.note : undefined)));
        const after = next.goals.find((x) => x.id === g.id)!;
        const names = ids.map((id) => findItem(after, id)!.item.title);
        const progress = after.parts?.length
          ? after.parts.map((p) => `${p.title} ${p.current}/${p.target}`).join(", ")
          : `${after.current ?? 0}/${after.target ?? 0}`;
        return {
          state: next,
          result: `${done ? "Ticked" : "Unticked"} ${names.join("; ")}. ${after.title}: ${goalStatus(after)}, ${progress}.`,
        };
      })
    )
  );

  server.registerTool(
    "update_track",
    {
      title: "Update a reading track",
      description:
        "Changes a reading track's description (what it's for and how to read it, shown under its name), its name, or its pages-a-day target. Empty description clears it.",
      inputSchema: {
        track: z.string().describe("Name or id"),
        description: z.string().max(400).optional(),
        name: z.string().min(1).optional(),
        pages_per_day: z.number().int().min(0).optional(),
      },
    },
    safe(async (a: { track: string; description?: string; name?: string; pages_per_day?: number }) =>
      change((s) => {
        const tr = pick(s.readingTracks, a.track, (x) => x.name, "track");
        const next = R.updateTrack(s, tr.id, {
          ...tr,
          ...(a.name !== undefined ? { name: a.name } : {}),
          ...(a.description !== undefined ? { note: a.description } : {}),
          ...(a.pages_per_day !== undefined ? { dailyTarget: a.pages_per_day } : {}),
        });
        const after = next.readingTracks.find((x) => x.id === tr.id)!;
        return {
          state: next,
          result: `${after.name}: ${after.dailyTarget} pages a day${after.note ? `. ${after.note}` : ""}`,
        };
      })
    )
  );

  server.registerTool(
    "reorder_track",
    {
      title: "Reorder a reading track",
      description:
        "Sets the reading order of one track's queue (queued and paused books), touching no other track. Listed books go first, in the order given; waiting books left out keep their relative order after them. The active book stays open.",
      inputSchema: {
        track: z.string().describe("Track name or id"),
        books: jsonArray(
          z
            .array(
              z.object({
                book: z.string().describe("Title or id"),
              })
            )
            .min(1)
        ),
      },
    },
    safe(async (a: { track: string; books: { book: string }[] }) =>
      change((s) => {
        const tr = pick(s.readingTracks, a.track, (x) => x.name, "track");
        const inTrack = s.books.filter((b) => b.trackId === tr.id && b.status !== "dropped" && b.status !== "finished");
        const ids: string[] = [];
        for (const e of a.books) {
          const b = pick(inTrack, e.book, (x) => x.title, `book in ${tr.name}`);
          if (ids.includes(b.id)) throw new Error(`"${b.title}" is listed twice.`);
          ids.push(b.id);
        }
        let next: TrackerState = s;
        const waiting = new Set(R.trackQueue(next, tr.id).map((b) => b.id));
        next = R.reorderQueue(next, tr.id, ids.filter((id) => waiting.has(id)));
        const queue = R.trackQueue(next, tr.id).map((b, i) => `${i + 1}. ${b.title}`);
        return { state: next, result: `${tr.name} queue:\n${queue.join("\n")}` };
      })
    )
  );

  server.registerTool(
    "remove_goal",
    {
      title: "Delete a goal",
      description: "Deletes one learning goal for good, with its progress and parts, and takes it out of its topic.",
      inputSchema: { goal: z.string().describe("Title or id") },
    },
    safe(async (a: { goal: string }) =>
      change((s) => {
        const g = pick(s.goals, a.goal, (x) => x.title, "goal");
        const topic = goalTopic(g.id, s.paths)?.title;
        return { state: O.removeGoal(s, g.id), result: `Deleted "${g.title}"${topic ? ` from ${topic}` : ""}.` };
      })
    )
  );

  server.registerTool(
    "update_topic",
    {
      title: "Rename or delete a topic",
      description:
        "Renames a learning topic, or deletes it. Only an empty topic can be deleted: move or delete its goals first.",
      inputSchema: {
        topic: z.string().describe("Name or id"),
        name: z.string().min(1).optional().describe("Its new name"),
        delete: z.boolean().optional(),
      },
    },
    safe(async (a: { topic: string; name?: string; delete?: boolean }) =>
      change((s) => {
        const p = pick(s.paths, a.topic, (x) => x.title, "topic");
        if (a.delete) {
          const n = O.topicGoalCount(s, p.id);
          if (n > 0) throw new Error(`"${p.title}" still holds ${n} goal${n === 1 ? "" : "s"}; move or delete them first.`);
          return { state: O.removeTopic(s, p.id), result: `Deleted the topic "${p.title}".` };
        }
        if (!a.name?.trim()) throw new Error("Give a new name, or delete: true.");
        return { state: O.renameTopic(s, p.id, a.name), result: `Renamed "${p.title}" to "${a.name.trim()}".` };
      })
    )
  );

  server.registerTool(
    "add_cards",
    {
      title: "Add project cards",
      description:
        "Adds cards to a project's board, in To do unless a column is given. With create_project, a project that doesn't exist yet is made.",
      inputSchema: {
        project: z.string().describe("Project title or id"),
        create_project: z.boolean().default(false),
        cards: z
          .array(z.object({ title: z.string(), description: z.string().optional(), column: COLUMN.optional() }))
          .min(1),
      },
    },
    safe(
      async (a: {
        project: string;
        create_project: boolean;
        cards: { title: string; description?: string; column?: CardStatus }[];
      }) =>
        change((s) => {
          let next = s;
          let p = (() => {
            try {
              return pick(next.projects, a.project, (x) => x.title, "project");
            } catch (e) {
              if (!a.create_project || next.projects.some((x) => norm(x.title).includes(norm(a.project)))) throw e;
              return null;
            }
          })();
          if (!p) {
            const id = uid();
            next = O.addProject(next, { title: a.project }, id);
            p = next.projects.find((x) => x.id === id)!;
          }
          for (const c of a.cards) next = O.addCard(next, p.id, { title: c.title, note: c.description }, c.column ?? "todo");
          return { state: next, result: `Added ${a.cards.length} card${a.cards.length === 1 ? "" : "s"} to ${p.title}.` };
        })
    )
  );

  server.registerTool(
    "move_card",
    {
      title: "Move a project card",
      description: "Moves a card to another column: todo, doing or done. A project is finished when all its cards are done.",
      inputSchema: { project: z.string(), card: z.string().describe("Card title or id"), column: COLUMN },
    },
    safe(async (a: { project: string; card: string; column: CardStatus }) =>
      change((s) => {
        const p = pick(s.projects, a.project, (x) => x.title, "project");
        const c = pick(p.cards, a.card, (x) => x.title, "card");
        return { state: O.moveCard(s, p.id, c.id, a.column), result: `${c.title} → ${a.column}.` };
      })
    )
  );

  server.registerTool(
    "add_todos",
    {
      title: "Add to-dos",
      description:
        "Adds to-dos to the Today page. Each can be planned for a day (YYYY-MM-DD; it shows on Today from that day, under Later before it) and tied to a learning goal, optionally one of its parts: logging a step on that goal (or part) then ticks it, one to-do per step, earliest planned first.",
      inputSchema: {
        todos: jsonArray(
          z
            .array(
              z.object({
                title: z.string().min(1),
                date: z.string().optional().describe("YYYY-MM-DD"),
                goal: z.string().optional().describe("Goal title or id whose step ticks it"),
                part: z.string().optional().describe("Part title or id, when the goal has parts"),
              })
            )
            .min(1)
        ),
      },
    },
    safe(async (a: { todos: { title: string; date?: string; goal?: string; part?: string }[] }) =>
      change((s) => {
        const items = a.todos.map((t) => {
          if (t.date && !isDateKey(t.date)) throw new Error(`"${t.date}" isn't a YYYY-MM-DD date.`);
          if (!t.goal) {
            if (t.part) throw new Error(`"${t.title}": a part needs its goal.`);
            return { title: t.title, date: t.date };
          }
          const g = pick(s.goals, t.goal, (x) => x.title, "goal");
          const part = t.part ? pick(g.parts ?? [], t.part, (x) => x.title, `part of ${g.title}`) : undefined;
          return { title: t.title, date: t.date, goalId: g.id, partId: part?.id };
        });
        return {
          state: O.addTodos(s, items),
          result: `Added ${items.length} to-do${items.length === 1 ? "" : "s"}.`,
        };
      })
    )
  );

  server.registerTool(
    "remove_todos",
    {
      title: "Remove to-dos",
      description: "Deletes open to-dos, by title or id. Done ones stay in the log.",
      inputSchema: { todos: jsonArray(z.array(z.string()).min(1)) },
    },
    safe(async (a: { todos: string[] }) =>
      change((s) => {
        const open = s.todos.filter((t) => !t.done);
        const ids = new Set(a.todos.map((r) => pick(open, r, (x) => x.title, "open to-do").id));
        return {
          state: { ...s, todos: s.todos.filter((t) => !ids.has(t.id)) },
          result: `Removed ${ids.size} to-do${ids.size === 1 ? "" : "s"}.`,
        };
      })
    )
  );

  server.registerTool(
    "set_repeat",
    {
      title: "Set how often something recurs",
      description:
        "Recurring tasks are automatic: every active goal, book being read and workout is one, done for its period once there's activity on it (a goal session, pages read, the workout finished). This sets how often one comes round — daily, weekly or monthly — or 'off' to leave it out. Find items by id or exact title.",
      inputSchema: {
        kind: z.enum(["goal", "book", "workout"]),
        item: z.string().min(1).describe("Id or title"),
        repeat: z.enum(["daily", "weekly", "monthly", "off"]),
      },
    },
    safe(async (a: { kind: RoutineKind; item: string; repeat: RepeatSetting }) =>
      change((s) => {
        const list: { id: string; title: string }[] =
          a.kind === "goal" ? s.goals : a.kind === "book" ? s.books : s.workouts.map((w) => ({ id: w.id, title: w.name }));
        const hit = list.find((x) => x.id === a.item) ?? list.find((x) => norm(x.title) === norm(a.item));
        if (!hit) throw new Error(`No ${a.kind} called "${a.item}".`);
        return {
          state: patchRoutineItem(s, a.kind, hit.id, () => ({ repeat: a.repeat })),
          result: `${hit.title}: ${a.repeat === "off" ? "not recurring" : a.repeat}.`,
        };
      })
    )
  );

  server.registerTool(
    "set_weight_plan",
    {
      title: "Set the weight-loss plan",
      description:
        "Sets the weight-loss plan shown under Health: checkpoints, each a date and the weight (kg) to be at by then; the last is the target. It starts from start_kg on start_date, by default the latest weigh-in and today (or the current plan's start). Checkpoints are judged by the weekly median weigh-in (weeks Monday to Sunday). Replaces any plan there is.",
      inputSchema: {
        checkpoints: jsonArray(
          z
            .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kg: z.number().positive() }))
            .min(1)
        ),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        start_kg: z.number().positive().optional(),
      },
    },
    safe(async (a: { checkpoints: { date: string; kg: number }[]; start_date?: string; start_kg?: number }) =>
      change((s) => {
        const was = validPlan(s.weightPlan);
        const startDate = a.start_date ?? was?.startDate ?? dateKey();
        const startKg = a.start_kg ?? was?.startKg ?? s.weights[s.weights.length - 1]?.kg;
        if (startKg == null) throw new Error("No weigh-in to start from: pass start_kg.");
        const plan = makePlan(startDate, startKg, a.checkpoints);
        if (!plan) throw new Error(`Checkpoints must come after the start, ${startDate}.`);
        return {
          state: { ...s, weightPlan: plan },
          result: `Plan set: ${plan.startKg} kg on ${plan.startDate} to ${plan.targetKg} kg by ${plan.targetDate}, with ${plan.checkpoints.length} checkpoint${plan.checkpoints.length === 1 ? "" : "s"}.`,
        };
      })
    )
  );

  server.registerTool(
    "import_reading_plan",
    {
      title: "Import a reading plan",
      description: `Reads a whole reading plan — tracks and books in order — in Momentum's Markdown format, the same the app's Import plan takes. Books already on the shelf are moved into place with their progress kept. The format:\n\n${PLAN_FORMAT}`,
      inputSchema: { markdown: z.string() },
    },
    safe(async ({ markdown }: { markdown: string }) => {
      const plan = parsePlan(markdown);
      if (!plan.tracks.length && !plan.books.length) throw new Error("No tracks or books could be read; check the format.");
      return change((s) => {
        const { state, preview } = applyPlan(s, plan);
        return { state, result: plan.skipped.length ? { ...preview, skipped: plan.skipped } : preview };
      });
    })
  );
}
