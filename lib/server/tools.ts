/**
 * What Claude can do with Momentum through the connector: read an overview,
 * and add or update books, goals and project cards. Every change goes
 * through the same functions the app uses (lib/reading.ts, lib/ops.ts, the
 * importers), so the result is what the app itself would have made.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dateKey, goalStatus, goalTopic, minimumReached, uid, type GoalStatus, type TrackerState } from "../model";
import * as R from "../reading";
import * as O from "../ops";
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

function overview(s: TrackerState, section: string) {
  const out: Record<string, unknown> = {};
  if (section === "all" || section === "books") {
    out.tracks = s.readingTracks.filter((t) => !t.archived).map((t) => ({ id: t.id, name: t.name, pagesPerDay: t.dailyTarget }));
    out.phases = [...s.readingPhases]
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.name.localeCompare(b.name)))
      .map((p) => ({
        id: p.id,
        name: p.name,
        start: p.start,
        end: p.end,
        goal: p.goal,
        books: s.books.filter((b) => b.phaseId === p.id).length,
      }));
    out.books = s.books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author || undefined,
      status: b.status,
      page: b.read,
      pages: b.pages || undefined,
      track: s.readingTracks.find((t) => t.id === b.trackId)?.name,
      phase: s.readingPhases.find((p) => p.id === b.phaseId)?.name,
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
      phases: g.phaseIds?.map((id) => s.readingPhases.find((p) => p.id === id)?.name).filter(Boolean),
      progress: g.parts?.length
        ? undefined
        : g.target
          ? `${g.current ?? 0}/${g.target}${g.minimum != null ? ` (min ${g.minimum})` : ""}`
          : undefined,
      parts: g.parts?.map((p) => `${p.title} ${p.current}/${p.target}${p.minimum != null ? ` (min ${p.minimum})` : ""}`),
      ...(minimumReached(g) ? { minimum_reached: true } : {}),
      description: g.note,
      link: g.link,
      ...sessionsOf(s, g.id),
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

const COLUMN = z.enum(["todo", "doing", "done"]);


/** A goal's last session date and its notes, oldest first (the last ten). */
function sessionsOf(s: TrackerState, goalId: string) {
  const log = O.goalLog(s, goalId);
  if (!log.length) return {};
  const notes = log.filter((e) => e.note).slice(-10).map((e) => `${e.date}: ${e.note}`);
  return { last_session: log[log.length - 1].date, ...(notes.length ? { notes } : {}) };
}

/** ", in Phase 1 — Foundations" for a goal's phases, or nothing. */
function phaseList(s: TrackerState, ids: string[] | undefined): string {
  const names = (ids ?? []).map((id) => s.readingPhases.find((p) => p.id === id)?.name).filter(Boolean);
  return names.length ? `, in ${names.join(" and ")}` : "";
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
        "Reads the user's Momentum data: reading tracks and books (with status and current page), learning topics and goals, and projects with their cards. Call this first to find the names and ids the other tools take.",
      inputSchema: { section: z.enum(["all", "books", "learning", "projects"]).default("all") },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ section }: { section: string }) => overview(await readState(), section))
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
              phaseId: untrack ? undefined : b.phaseId,
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
    "remove_phase",
    {
      title: "Remove a reading phase",
      description:
        "Removes one reading phase, such as a duplicate left by an earlier plan import. Its books stay where they are, just without a phase. Take the name or id from the overview's phases.",
      inputSchema: {
        phase: z.string().describe("Phase name or id"),
      },
    },
    safe(async (a: { phase: string }) =>
      change((s) => {
        const p = pick(s.readingPhases, a.phase, (x) => x.name, "phase");
        const freed = s.books.filter((b) => b.phaseId === p.id).length;
        return {
          state: R.removePhase(s, p.id),
          result: `Removed phase "${p.name}" (${p.start} to ${p.end})${freed ? `; ${freed} book${freed === 1 ? "" : "s"} left without a phase` : ""}.`,
        };
      })
    )
  );

  server.registerTool(
    "add_goals",
    {
      title: "Add learning goals",
      description:
        "Adds learning goals, optionally into a topic (created if it doesn't exist). A goal can have a count to track (current of target: pages, videos, modules). A goal whose title is already in the topic is updated instead of duplicated.",
      inputSchema: {
        topic: z.string().optional(),
        goals: z
          .array(
            z.object({
              title: z.string(),
              description: z.string().optional(),
              link: z.string().optional(),
              current: z.number().min(0).optional(),
              target: z.number().positive().optional(),
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
        "Updates one learning goal: its name, description or link, its topic (moving keeps everything the goal has), its count (current, target), its parts, or its status: queued, active, done or dropped ('done' true/false still works as a shortcut). Two active goals in one topic are allowed; the result notes it. phases puts it in up to two reading phases (the ones books use), by name or id; [] clears them. Parts (a course's readings, problem sets, project…) each have their own count; a goal with parts takes its progress from them. Passing parts replaces the whole list ([] removes them); a part named like an existing one keeps its id. A count (or part) can have a minimum, enough to count as covered; the result says when every minimum is reached. Any count that moves (current, or a part's current) is logged as a session for today, with note if given; the app shows them under the goal's Sessions.",
      inputSchema: {
        goal: z.string().describe("Title or id"),
        current: z.number().min(0).optional(),
        target: z.number().min(0).optional().describe("0 removes the count"),
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
        phases: jsonArray(z.array(z.string()).max(2)).optional().describe("Up to two phase names or ids; [] clears"),
        parts: jsonArray(
          z.array(
            z.object({
              title: z.string().min(1),
              target: z.number().positive(),
              current: z.number().min(0).optional(),
              minimum: z.number().min(0).optional().describe("Enough to count as covered, at most target; 0 clears"),
            })
          )
        ).optional(),
        minimum: z
          .number()
          .min(0)
          .optional()
          .describe("For a goal without parts: enough to count as covered, at most its target; 0 clears"),
        note: z.string().max(200).optional().describe("A line about the session, kept with the count change it logs"),
      },
    },
    safe(async (a: {
      goal: string;
      current?: number;
      target?: number;
      done?: boolean;
      status?: GoalStatus;
      title?: string;
      description?: string;
      link?: string;
      topic?: string;
      phases?: string[];
      parts?: { title: string; target: number; current?: number; minimum?: number }[];
      minimum?: number;
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
        if (a.current !== undefined || a.target !== undefined) next = O.setGoalCount(next, g.id, a);
        if (a.parts !== undefined) {
          const had = g.parts ?? [];
          next = O.setGoalParts(
            next,
            g.id,
            a.parts.map((p) => {
              const old = had.find((x) => x.title.toLowerCase() === p.title.trim().toLowerCase());
              if (p.minimum && p.minimum > p.target)
                throw new Error(`${p.title}: a minimum can't pass its total (${p.target}).`);
              return {
                id: old?.id,
                title: p.title,
                target: p.target,
                current: p.current ?? old?.current ?? 0,
                minimum: p.minimum === 0 ? null : p.minimum ?? old?.minimum,
              };
            })
          );
        }
        if (a.minimum !== undefined) {
          const total = next.goals.find((x) => x.id === g.id)?.target;
          if (a.minimum && total && a.minimum > total) throw new Error(`A minimum can't pass the total (${total}).`);
          next = O.setGoalMinimum(next, g.id, a.minimum || null);
        }
        // Count changes are sessions: logged like a +1 in the app.
        next = O.logChanges(s, next, g.id, a.note);
        if (a.done !== undefined) next = O.setGoalDone(next, g.id, a.done);
        if (a.status) next = O.setGoalStatus(next, g.id, a.status);
        if (a.phases !== undefined)
          next = O.setGoalPhases(next, g.id, a.phases.map((x) => pick(next.readingPhases, x, (p) => p.name, "phase").id));
        const after = next.goals.find((x) => x.id === g.id)!;
        const min = (m?: number) => (m != null ? ` (min ${m})` : "");
        const reached = minimumReached(after);
        const progress =
          (after.parts?.length
            ? `, ${after.parts.map((p) => `${p.title} ${p.current}/${p.target}${min(p.minimum)}`).join(", ")}`
            : after.target
              ? `, ${after.current ?? 0}/${after.target}${min(after.minimum)}`
              : "") + (reached ? ", minimum reached" : "");
        const topic = goalTopic(g.id, next.paths)?.title;
        return {
          state: next,
          result: `${after.title}${topic ? ` (${topic})` : ""}: ${goalStatus(after)}${progress}${phaseList(next, after.phaseIds)}.${alsoActive(next, g.id)}`,
        };
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
    "import_reading_plan",
    {
      title: "Import a reading plan",
      description: `Reads a whole reading plan — tracks, phases and books in order — in Momentum's Markdown format, the same the app's Import plan takes. Books already on the shelf are moved into place with their progress kept. The format:\n\n${PLAN_FORMAT}`,
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
