/**
 * Reading plans written in Markdown, read into tracks and books.
 *
 * The shape it understands is the one a plan is naturally written in:
 *
 *   | Track | Daily target | Slot |            a table of tracks
 *   | Technical | ~20 pages | 12:15 iPad block |
 *   Rule: one active book per track.         the open-book limit
 *   ## Foundations                           any heading: a new section
 *   **Technical**                            the track the list below is in
 *   1. Title — Author *(note)*               a book, in reading order
 *      - *Optional:* Title — Author          an optional extra after it
 *   ## Slow lane (continuous)                a track's own list
 *   ## Dropped                               books given up on
 *   - Title — Author *(reason)*
 *
 * Importing is repeatable: tracks are matched by name and books
 * by title, so pasting an edited plan again updates what is there instead of
 * adding it twice, and a book's progress is never touched.
 */

import { BOOK_COLORS, bookColor, dateKey, uid, type Book, type TrackerState } from "./model";
import * as R from "./reading";

export type PlanBook = {
  title: string;
  author?: string;
  edition?: string;
  note?: string;
  track: string;
  status: "queued" | "active" | "dropped";
  optional?: boolean;
};

export type Plan = {
  tracks: { name: string; dailyTarget?: number }[];
  books: PlanBook[];
  wipLimit?: number;
  /** Lines that looked like books but couldn't be read as one. */
  skipped: string[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, " ").trim();

/** Strips emphasis and code marks, which are formatting rather than text. */
const plain = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/^\*|\*$/g, "").trim();

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/**
 * One list line: "Title — Author *(note)*". The note in trailing italics is
 * kept as the book's note; "(2nd ed.)" in the title becomes its edition; a
 * note that starts "finish" or "in progress" means the book is open now.
 */
function parseBookLine(raw: string): Omit<PlanBook, "track"> | null {
  let text = raw.trim();
  let optional = false;
  const opt = text.match(/^\*?\s*optional\s*:?\s*\*?\s*:?\s*/i);
  if (opt) {
    optional = true;
    text = text.slice(opt[0].length);
  }

  let note: string | undefined;
  const italic = text.match(/\s*[*_]\(?([^*_]+?)\)?[*_]\s*$/);
  if (italic) {
    note = italic[1].trim();
    text = text.slice(0, italic.index).trim();
  } else {
    const bracket = text.match(/\s+\(([^()]*(?:finish|progress|skim|optional|history|outdated)[^()]*)\)\s*$/i);
    if (bracket) {
      note = bracket[1].trim();
      text = text.slice(0, bracket.index).trim();
    }
  }

  const parts = text.split(/\s+[—–]\s+|\s+-\s+/);
  let title = plain(parts[0] ?? "");
  const author = parts.length > 1 ? plain(parts.slice(1).join(" — ")) : undefined;
  if (!title) return null;

  let edition: string | undefined;
  const ed = title.match(/\s*\((\d+(?:st|nd|rd|th))\s+ed(?:ition)?\.?\)\s*/i);
  if (ed) {
    edition = ed[1];
    title = title.replace(ed[0], " ").trim();
  }

  const open = !!note && /^(finish|in progress|reading|current)/i.test(note);
  return {
    title,
    author: author || undefined,
    edition,
    note: optional ? ["Optional", note].filter(Boolean).join(" — ") : note,
    status: open ? "active" : "queued",
    optional: optional || undefined,
  };
}

export function parsePlan(md: string): Plan {
  const plan: Plan = { tracks: [], books: [], skipped: [] };
  const lines = md.split(/\r?\n/);

  let track: string | null = null;
  let dropped = false;
  let tableCols: string[] | null = null;

  const isTrack = (name: string) => plan.tracks.some((t) => norm(t.name) === norm(name));

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const trimmed = line.trim();
    if (!trimmed || /^-{3,}$/.test(trimmed)) {
      tableCols = trimmed ? null : tableCols;
      continue;
    }

    // The tracks table.
    if (trimmed.startsWith("|")) {
      const cells = trimmed.replace(/^\||\|$/g, "").split("|").map((c) => plain(c.trim()));
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      if (!tableCols) {
        tableCols = cells.map((c) => c.toLowerCase());
        continue;
      }
      const col = (re: RegExp) => tableCols!.findIndex((c) => re.test(c));
      const nameAt = Math.max(0, col(/track|lane|name/));
      const targetAt = col(/target|pages|daily/);
      const name = cells[nameAt];
      if (name) {
        const n = targetAt >= 0 ? cells[targetAt]?.match(/\d+/) : null;
        plan.tracks.push({
          name,
          dailyTarget: n ? Number(n[0]) : undefined,
        });
      }
      continue;
    }
    tableCols = null;

    const rule = trimmed.match(/\b(\d+|one|two|three|four|five)\s+(?:active|open)\s+books?\s+per\s+track/i);
    if (rule) {
      plan.wipLimit = WORDS[rule[1].toLowerCase()] ?? Number(rule[1]);
      continue;
    }

    // Headings: a track's own list, the dropped list, or a section of the plan.
    const h = trimmed.match(/^(#{2,6})\s+(.*)$/);
    if (h) {
      const text = plain(h[2]);
      dropped = /^dropped\b/i.test(text);
      track = null;
      if (dropped) continue;
      const paren = text.match(/\(([^)]*)\)\s*$/);
      const bare = paren ? text.slice(0, paren.index).trim() : text;
      if (isTrack(bare) || (paren && /continuous|ongoing|always/i.test(paren[1]))) {
        track = bare;
        if (!isTrack(bare)) plan.tracks.push({ name: bare });
        continue;
      }
      continue;
    }
    if (trimmed.startsWith("# ")) continue;

    // A section's "**Goal:**" line describes it; there is nothing to keep.
    if (/^\*\*goal:?\*\*|^goal:/i.test(trimmed)) continue;

    // "**Technical**" on its own line: the track for the list that follows.
    const label = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
    if (label) {
      track = plain(label[1]).replace(/:$/, "");
      if (!isTrack(track)) plan.tracks.push({ name: track });
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const item = numbered ? numbered[1] : bullet ? bullet[2] : null;
    if (item == null) continue;

    const book = parseBookLine(item);
    if (!book) {
      plan.skipped.push(trimmed);
      continue;
    }
    if (dropped) {
      // A dropped book belongs to no track: it is out of every queue.
      plan.books.push({ ...book, status: "dropped", track: "" });
      continue;
    }
    // An indented bullet under a numbered book is an extra, e.g. optional.
    const nested = !!bullet && bullet[1].length > 0;
    if (!track) {
      plan.skipped.push(trimmed);
      continue;
    }
    plan.books.push({
      ...book,
      optional: book.optional || (nested ? true : undefined),
      track,
    });
  }
  return plan;
}

export type PlanPreview = {
  tracksNew: string[];
  tracksUpdated: string[];
  booksNew: number;
  booksMatched: string[];
  open: string[];
  dropped: string[];
  /** Open books the plan doesn't name as current, paused to keep the limit. */
  paused: string[];
};

/**
 * Applies a plan to the state, and says what it did.
 *
 * Tracks keep their colour. A book already on the shelf is
 * moved into the plan's track and place in the queue with its
 * progress intact. Each track's queue becomes the plan's order, with any
 * books the plan doesn't mention after it. A book the plan says is open is
 * opened, and any other open book in its track that the plan doesn't name
 * is paused, so the track keeps to its limit.
 */
export function applyPlan(s0: TrackerState, plan: Plan): { state: TrackerState; preview: PlanPreview } {
  const today = dateKey();
  const preview: PlanPreview = {
    tracksNew: [],
    tracksUpdated: [],
    booksNew: 0,
    booksMatched: [],
    open: [],
    dropped: [],
    paused: [],
  };
  let s = { ...s0 };

  // Tracks.
  const trackIds = new Map<string, string>();
  let tracks = [...s.readingTracks];
  for (const t of plan.tracks) {
    const found = tracks.find((x) => norm(x.name) === norm(t.name));
    if (found) {
      preview.tracksUpdated.push(found.name);
      tracks = tracks.map((x) =>
        x.id === found.id
          ? {
              ...x,
              archived: undefined,
              dailyTarget: t.dailyTarget ?? x.dailyTarget,
              wipLimit: plan.wipLimit ?? x.wipLimit,
            }
          : x
      );
      trackIds.set(norm(t.name), found.id);
    } else {
      const used = new Set(tracks.map((x) => x.color));
      const id = uid() + tracks.length;
      tracks.push({
        id,
        name: t.name,
        color: BOOK_COLORS.find((c) => !used.has(c)) ?? BOOK_COLORS[tracks.length % BOOK_COLORS.length],
        wipLimit: plan.wipLimit ?? 1,
        dailyTarget: t.dailyTarget ?? 0,
        restDays: 1,
      });
      preview.tracksNew.push(t.name);
      trackIds.set(norm(t.name), id);
    }
  }
  s.readingTracks = tracks;

  // Books, in plan order.
  const log = (b: Book, status: R.BookStatus) => [...(b.statusLog ?? []), { status, date: today }];
  let books = [...s.books];
  const planned = new Set<string>();
  /** The books the plan names as being read now. */
  const planOpen = new Set<string>();
  const order = new Map<string, number>();
  plan.books.forEach((pb, i) => {
    const droppedHere = pb.status === "dropped";
    const trackId = droppedHere ? "" : (trackIds.get(norm(pb.track)) ?? tracks[0]?.id);
    const existing = books.find((b) => norm(b.title) === norm(pb.title) && !planned.has(b.id));
    let book: Book;
    if (existing) {
      preview.booksMatched.push(existing.title);
      book = {
        ...existing,
        trackId,
        author: existing.author?.trim() ? existing.author : pb.author,
        edition: existing.edition ?? pb.edition,
        note: existing.note ?? pb.note,
        tags: pb.optional ? [...new Set([...(existing.tags ?? []), "optional"])] : existing.tags,
      };
    } else {
      preview.booksNew++;
      const last = books[books.length - 1];
      const choices = BOOK_COLORS.filter((c) => c !== (last ? bookColor(last) : null));
      book = {
        id: uid() + i,
        title: pb.title,
        author: pb.author,
        edition: pb.edition,
        note: pb.note,
        pages: 0,
        read: 0,
        base: 0,
        color: choices[i % choices.length],
        trackId,
        status: "queued",
        queueOrder: 0,
        tags: pb.optional ? ["optional"] : undefined,
        statusLog: [{ status: "queued", date: today }],
      };
      books.push(book);
    }
    if (pb.status === "dropped" && book.status !== "finished" && book.status !== "dropped") {
      book = { ...book, status: "dropped", droppedDate: today, dropReason: pb.note, statusLog: log(book, "dropped") };
      preview.dropped.push(book.title);
    }
    if (pb.status === "active" && (book.status === "queued" || book.status === "paused")) {
      book = { ...book, status: "active", startedDate: book.startedDate ?? today, statusLog: log(book, "active") };
    }
    planned.add(book.id);
    if (pb.status === "active") planOpen.add(book.id);
    order.set(book.id, i);
    books = books.map((b) => (b.id === book.id ? book : b));
  });

  // Each track's queue in plan order, the rest after it; and other open
  // books in a track the plan opens a book in are paused.
  const openedIn = new Set(books.filter((b) => planOpen.has(b.id)).map((b) => b.trackId));
  const offset = plan.books.length + 1;
  books = books.map((b) => {
    const planOrder = order.get(b.id);
    let next: Book = { ...b, queueOrder: planOrder ?? offset + b.queueOrder };
    if (b.status === "active" && !planOpen.has(b.id) && openedIn.has(b.trackId)) {
      next = { ...next, status: "paused", pausedDate: today, statusLog: log(b, "paused") };
      preview.paused.push(b.title);
    }
    return next;
  });
  s.books = books;
  preview.open = books.filter((b) => b.status === "active" && planned.has(b.id)).map((b) => b.title);

  return { state: s, preview };
}

/**
 * The format, as a worked example — shown in the import dialog to copy,
 * so it always matches what parsePlan reads.
 */
export const PLAN_FORMAT = `| Track | Daily target | Slot |
|---|---|---|
| Technical | 20 pages | 12:15 iPad block |
| Non-technical | 30 pages | Evening |

Rule: one active book per track.

## Up next
**Technical**
1. Effective Java (3rd ed.) — Joshua Bloch *(finish)*
2. Designing Data-Intensive Applications — Martin Kleppmann
   - *Optional:* Database Internals — Alex Petrov

**Non-technical**
1. Atomic Habits — James Clear

3. Fundamentals of Software Architecture — Mark Richards

## Slow lane (continuous)
1. Gödel, Escher, Bach — Douglas Hofstadter

## Dropped
- Clean Code — Robert C. Martin *(outdated)*`;
