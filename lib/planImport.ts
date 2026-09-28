/**
 * Reading plans written in Markdown, read into tracks, phases and books.
 *
 * The shape it understands is the one a plan is naturally written in:
 *
 *   | Track | Daily target | Slot |            a table of tracks
 *   | Technical | ~20 pages | 12:15 iPad block |
 *   Rule: one active book per track.         the open-book limit
 *   ## Phase 1 — Foundations (Q4 2026)       a phase, dated by quarter
 *   **Goal:** …                              what the phase is for
 *   **Technical**                            the track the list below is in
 *   1. Title — Author *(note)*               a book, in reading order
 *      - *Optional:* Title — Author          an optional extra after it
 *   ## Slow lane (continuous)                a track's own list, no phase
 *   ## Dropped                               books given up on
 *   - Title — Author *(reason)*
 *
 * Importing is repeatable: tracks and phases are matched by name and books
 * by title, so pasting an edited plan again updates what is there instead of
 * adding it twice, and a book's progress is never touched.
 */

import { BOOK_COLORS, bookColor, dateKey, uid, type Book, type TrackerState } from "./tracker";
import * as R from "./reading";

export type PlanBook = {
  title: string;
  author?: string;
  edition?: string;
  note?: string;
  track: string;
  phase?: string;
  status: "queued" | "active" | "dropped";
  optional?: boolean;
};

export type Plan = {
  tracks: { name: string; dailyTarget?: number; slot?: string }[];
  phases: { name: string; start: string; end: string; goal?: string }[];
  books: PlanBook[];
  wipLimit?: number;
  /** Lines that looked like books but couldn't be read as one. */
  skipped: string[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, " ").trim();

/** Strips emphasis and code marks, which are formatting rather than text. */
const plain = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/^\*|\*$/g, "").trim();

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function quarterDates(q: number, y: number): [string, string] {
  const start = new Date(y, (q - 1) * 3, 1);
  const end = new Date(y, q * 3, 0);
  return [dateKey(start), dateKey(end)];
}

/**
 * The dates in a phase heading's brackets: "Q4 2026", "H1 2027", "2027", or
 * two explicit dates. Null when there is nothing to go on.
 */
function parseWhen(text: string): [string, string] | null {
  let m = text.match(/\bQ([1-4])\s*(\d{4})\b/i);
  if (m) return quarterDates(Number(m[1]), Number(m[2]));
  m = text.match(/\bH([12])\s*(\d{4})\b/i);
  if (m) {
    const y = Number(m[2]);
    return m[1] === "1" ? [`${y}-01-01`, `${y}-06-30`] : [`${y}-07-01`, `${y}-12-31`];
  }
  m = text.match(/(\d{4}-\d{2}-\d{2})\s*(?:–|—|-|to)\s*(\d{4}-\d{2}-\d{2})/);
  if (m) return [m[1], m[2]];
  m = text.match(/^\s*(\d{4})\s*$/);
  if (m) return [`${m[1]}-01-01`, `${m[1]}-12-31`];
  return null;
}

/**
 * One list line: "Title — Author *(note)*". The note in trailing italics is
 * kept as the book's note; "(2nd ed.)" in the title becomes its edition; a
 * note that starts "finish" or "in progress" means the book is open now.
 */
function parseBookLine(raw: string): Omit<PlanBook, "track" | "phase"> | null {
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
  const plan: Plan = { tracks: [], phases: [], books: [], skipped: [] };
  const lines = md.split(/\r?\n/);

  let phase: Plan["phases"][number] | null = null;
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
      const slotAt = col(/slot|time|when/);
      const name = cells[nameAt];
      if (name) {
        const n = targetAt >= 0 ? cells[targetAt]?.match(/\d+/) : null;
        plan.tracks.push({
          name,
          dailyTarget: n ? Number(n[0]) : undefined,
          slot: slotAt >= 0 && cells[slotAt] ? cells[slotAt] : undefined,
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

    // Headings: a phase, a track's own list, or the dropped list.
    const h = trimmed.match(/^(#{2,6})\s+(.*)$/);
    if (h) {
      const text = plain(h[2]);
      dropped = /^dropped\b/i.test(text);
      phase = null;
      track = null;
      if (dropped) continue;
      const paren = text.match(/\(([^)]*)\)\s*$/);
      const bare = paren ? text.slice(0, paren.index).trim() : text;
      const when = paren ? parseWhen(paren[1]) : null;
      if (isTrack(bare) || (paren && /continuous|ongoing|always/i.test(paren[1]))) {
        track = bare;
        if (!isTrack(bare)) plan.tracks.push({ name: bare });
        continue;
      }
      let dates = when;
      if (!dates) {
        // Undated: the quarter after the phase before, or this one.
        const prev = plan.phases[plan.phases.length - 1];
        const from = prev ? R.addDays(prev.end, 1) : dateKey();
        const [y, m] = from.split("-").map(Number);
        dates = [from, dateKey(new Date(y, m + 2, 0))];
      }
      phase = { name: bare, start: dates[0], end: dates[1] };
      plan.phases.push(phase);
      continue;
    }
    if (trimmed.startsWith("# ")) continue;

    const goal = trimmed.match(/^\*\*goal:?\*\*:?\s*(.*)$/i) ?? trimmed.match(/^goal:\s*(.*)$/i);
    if (goal) {
      if (phase) phase.goal = plain(goal[1]);
      continue;
    }

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
      plan.books.push({ ...book, status: "dropped", track: plan.tracks[0]?.name ?? "Technical" });
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
      phase: phase?.name,
    });
  }
  return plan;
}

export type PlanPreview = {
  tracksNew: string[];
  tracksUpdated: string[];
  phasesNew: number;
  phasesUpdated: number;
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
 * Tracks keep their colour; phases their id. A book already on the shelf is
 * moved into the plan's track, phase and place in the queue with its
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
    phasesNew: 0,
    phasesUpdated: 0,
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
              slot: t.slot ?? x.slot,
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
        slot: t.slot,
        restDays: 1,
      });
      preview.tracksNew.push(t.name);
      trackIds.set(norm(t.name), id);
    }
  }
  s.readingTracks = tracks;

  // Phases.
  const phaseIds = new Map<string, string>();
  let phases = [...s.readingPhases];
  for (const p of plan.phases) {
    const found = phases.find((x) => norm(x.name) === norm(p.name));
    if (found) {
      phases = phases.map((x) => (x.id === found.id ? { ...x, start: p.start, end: p.end, goal: p.goal ?? x.goal } : x));
      phaseIds.set(norm(p.name), found.id);
      preview.phasesUpdated++;
    } else {
      const id = uid() + phases.length;
      phases.push({ id, name: p.name, start: p.start, end: p.end, goal: p.goal });
      phaseIds.set(norm(p.name), id);
      preview.phasesNew++;
    }
  }
  s.readingPhases = phases;

  // Books, in plan order.
  const log = (b: Book, status: R.BookStatus) => [...(b.statusLog ?? []), { status, date: today }];
  let books = [...s.books];
  const planned = new Set<string>();
  /** The books the plan names as being read now. */
  const planOpen = new Set<string>();
  const order = new Map<string, number>();
  plan.books.forEach((pb, i) => {
    const trackId = trackIds.get(norm(pb.track)) ?? tracks[0]?.id;
    const phaseId = pb.phase ? phaseIds.get(norm(pb.phase)) : undefined;
    const existing = books.find((b) => norm(b.title) === norm(pb.title) && !planned.has(b.id));
    let book: Book;
    if (existing) {
      preview.booksMatched.push(existing.title);
      book = {
        ...existing,
        trackId,
        phaseId: phaseId ?? existing.phaseId,
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
        phaseId,
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
