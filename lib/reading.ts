/**
 * Reading tracks: the plan a shelf of books is read to.
 *
 * Books run in parallel lanes ("tracks"), each with its own ordered queue, a
 * limit on how many books are open at once, a daily page target and a time
 * of day. Phases group books across tracks into blocks of the plan. Every
 * reading session is logged, so progress, pace, streaks and projections are
 * all worked out from the log rather than stored alongside it.
 *
 * Everything here is pure: state in, state out. The tracker hook wraps each
 * change in its confirmed write, and the components call the selectors.
 */

import {
  BOOK_COLORS,
  bookColor,
  currentColor,
  dateKey,
  uid,
  type Book,
  type TrackerState,
} from "./tracker";

/* ================================ Types ================================ */

/**
 * Where a book is in the plan.
 *
 * queued → active → finished is the normal run. Paused and dropped can be
 * reached from anything not yet finished. A paused book stays in its track's
 * queue with its progress, to be picked up again; a dropped one leaves the
 * queue for good but stays in the history.
 */
export type BookStatus = "queued" | "active" | "paused" | "finished" | "dropped";

export const STATUS_LABEL: Record<BookStatus, string> = {
  queued: "Queued",
  active: "Reading",
  paused: "Paused",
  finished: "Finished",
  dropped: "Dropped",
};

export type StatusChange = { status: BookStatus; date: string };

/** A lane of reading. */
export type ReadingTrack = {
  id: string;
  name: string;
  color: string;
  /** How many books may be open at once in this track. */
  wipLimit: number;
  /** Pages a day. Zero means the track sets no target. */
  dailyTarget: number;
  /** When in the day this track is read, e.g. "Evening". Shown on Today. */
  slot?: string;
  /** Days a week the target can be missed without breaking the streak. */
  restDays: number;
  /** Hidden everywhere but the track list, with its books left alone. */
  archived?: boolean;
};

/** A block of the plan, e.g. "Phase 1: Q4 2026". */
export type ReadingPhase = {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
  /** What the phase is for, in a sentence. */
  goal?: string;
};

/** One sitting: the pages read, on a day. */
export type ReadingSession = {
  id: string;
  bookId: string;
  date: string;
  pages: number;
  minutes?: number;
  /** The key idea from this sitting, if one was written down. */
  note?: string;
  at: number;
};

/** A passage kept from a book. */
export type BookQuote = {
  id: string;
  bookId: string;
  text: string;
  page?: number;
  date: string;
  at: number;
};

/* ============================== Defaults =============================== */

export const DEFAULT_TRACKS: ReadingTrack[] = [
  {
    id: "track-technical",
    name: "Technical",
    color: "#2168e4",
    wipLimit: 1,
    dailyTarget: 20,
    slot: "12:15 iPad block",
    restDays: 1,
  },
  {
    id: "track-nontechnical",
    name: "Non-technical",
    color: "#b75014",
    wipLimit: 1,
    dailyTarget: 30,
    slot: "Evening",
    restDays: 1,
  },
  {
    id: "track-slow",
    name: "Slow lane",
    color: "#b23bb2",
    wipLimit: 1,
    dailyTarget: 10,
    slot: "Morning coffee",
    restDays: 1,
  },
];

/* ============================== Dates ================================== */

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function fromDayNumber(n: number): string {
  const d = new Date(n * 86400000);
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

export function addDays(key: string, n: number): string {
  return fromDayNumber(dayNumber(key) + n);
}

/** Whole days from a to b; positive when b is later. */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** Monday of the week a date falls in. */
function mondayOf(key: string): string {
  const n = dayNumber(key);
  // 1970-01-01 was a Thursday, so day 0 is three days after a Monday.
  return fromDayNumber(n - ((n + 3) % 7));
}

const isDateKey = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/* ============================= Migration =============================== */

const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const STATUSES: BookStatus[] = ["queued", "active", "paused", "finished", "dropped"];

/**
 * Brings saved reading data up to the current shape.
 *
 * Books shelved before tracks existed are put in the first track, with a
 * status read off their progress: finished if they reached the end, reading
 * if they were started, queued otherwise. Everything read so far becomes the
 * book's base, the part of its progress no session accounts for, so nothing
 * shown changes.
 */
export function migrateReading(
  s: Record<string, unknown>,
  rawBooks: Book[]
): Pick<
  TrackerState,
  "books" | "readingTracks" | "readingPhases" | "readingSessions" | "bookQuotes"
> {
  const readingTracks: ReadingTrack[] = Array.isArray(s.readingTracks)
    ? (s.readingTracks as Array<Record<string, unknown>>).map((t) => ({
        id: (t.id as string) ?? uid(),
        name: (t.name as string) ?? "Track",
        color: currentColor(t.color as string | undefined) ?? BOOK_COLORS[0],
        wipLimit: Math.max(1, Math.round(num(t.wipLimit, 1))),
        dailyTarget: Math.max(0, Math.round(num(t.dailyTarget, 0))),
        slot: (t.slot as string) || undefined,
        restDays: Math.min(6, Math.max(0, Math.round(num(t.restDays, 1)))),
        archived: t.archived === true ? true : undefined,
      }))
    : DEFAULT_TRACKS;

  const readingPhases: ReadingPhase[] = Array.isArray(s.readingPhases)
    ? (s.readingPhases as ReadingPhase[]).filter((p) => p && p.id)
    : [];

  const readingSessions: ReadingSession[] = Array.isArray(s.readingSessions)
    ? (s.readingSessions as ReadingSession[]).filter(
        (x) => x && x.id && x.bookId && isDateKey(x.date) && Number.isFinite(x.pages)
      )
    : [];

  const bookQuotes: BookQuote[] = Array.isArray(s.bookQuotes)
    ? (s.bookQuotes as BookQuote[]).filter((q) => q && q.id && q.bookId)
    : [];

  const trackIds = new Set(readingTracks.map((t) => t.id));
  const firstTrack = (readingTracks.find((t) => !t.archived) ?? readingTracks[0])?.id ?? "";
  const phaseIds = new Set(readingPhases.map((p) => p.id));

  const books: Book[] = rawBooks.map((b, i) => {
    const pages = Math.max(0, Math.round(num(b.pages)));
    const read = Math.max(0, Math.round(num(b.read)));
    const hasStatus = STATUSES.includes(b.status as BookStatus);
    const status: BookStatus = hasStatus
      ? (b.status as BookStatus)
      : pages > 0 && read >= pages
        ? "finished"
        : read > 0
          ? "active"
          : "queued";
    return {
      ...b,
      color: currentColor(b.color),
      pages,
      read,
      trackId: b.trackId && trackIds.has(b.trackId) ? b.trackId : firstTrack,
      status,
      queueOrder: num(b.queueOrder, i),
      // A book from before sessions has all its progress in the base.
      base: typeof b.base === "number" && Number.isFinite(b.base) ? b.base : read,
      phaseId: b.phaseId && phaseIds.has(b.phaseId) ? b.phaseId : undefined,
      after: Array.isArray(b.after) ? b.after.filter((x) => typeof x === "string") : undefined,
      tags: Array.isArray(b.tags) ? b.tags.filter((x) => typeof x === "string") : undefined,
    };
  });

  return { books, readingTracks, readingPhases, readingSessions, bookQuotes };
}

/* ============================== Selectors ============================== */

export function trackOf(s: TrackerState, id: string): ReadingTrack | undefined {
  return s.readingTracks.find((t) => t.id === id);
}

export function liveTracks(s: TrackerState): ReadingTrack[] {
  return s.readingTracks.filter((t) => !t.archived);
}

export function bookSessions(s: TrackerState, bookId: string): ReadingSession[] {
  return s.readingSessions
    .filter((x) => x.bookId === bookId)
    .sort((a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1));
}

export function activeBooks(s: TrackerState, trackId: string): Book[] {
  return s.books
    .filter((b) => b.trackId === trackId && b.status === "active")
    .sort((a, b) => a.queueOrder - b.queueOrder);
}

/** A track's queue: what is waiting, paused books included, in reading order. */
export function trackQueue(s: TrackerState, trackId: string): Book[] {
  return s.books
    .filter((b) => b.trackId === trackId && (b.status === "queued" || b.status === "paused"))
    .sort((a, b) => a.queueOrder - b.queueOrder);
}

export function nextInQueue(s: TrackerState, trackId: string): Book | undefined {
  return trackQueue(s, trackId)[0];
}

/** Pages logged on a day, for one track or for everything. */
export function pagesOn(s: TrackerState, date: string, trackId?: string): number {
  const inTrack = trackId
    ? new Set(s.books.filter((b) => b.trackId === trackId).map((b) => b.id))
    : null;
  return s.readingSessions
    .filter((x) => x.date === date && (!inTrack || inTrack.has(x.bookId)))
    .reduce((a, x) => a + x.pages, 0);
}

/** Pages logged per day for a track. */
export function trackDaily(s: TrackerState, trackId: string): Map<string, number> {
  const inTrack = new Set(s.books.filter((b) => b.trackId === trackId).map((b) => b.id));
  const m = new Map<string, number>();
  for (const x of s.readingSessions) {
    if (inTrack.has(x.bookId)) m.set(x.date, (m.get(x.date) ?? 0) + x.pages);
  }
  return m;
}

export function trackMet(track: ReadingTrack, pages: number): boolean {
  return track.dailyTarget > 0 && pages >= track.dailyTarget;
}

/**
 * The tracks that count in the day's done / not done tally: every live track
 * with a target and a book open. A track with nothing open has nothing to be
 * done, so it isn't counted as missed.
 */
export function readingUnits(
  s: TrackerState,
  today: string = dateKey()
): { trackId: string; done: boolean }[] {
  if (!Array.isArray(s.readingTracks)) return [];
  return liveTracks(s)
    .filter((t) => t.dailyTarget > 0 && activeBooks(s, t.id).length > 0)
    .map((t) => ({ trackId: t.id, done: trackMet(t, pagesOn(s, today, t.id)) }));
}

/**
 * Days in a row the target was met, ending today.
 *
 * Today only counts once met: an evening track is not broken at breakfast. A
 * missed day is forgiven while the week (Monday to Sunday) still has rest
 * days left; forgiven days don't add to the count, they just don't end it.
 */
export function trackStreak(s: TrackerState, track: ReadingTrack, today: string = dateKey()): number {
  if (track.dailyTarget <= 0) return 0;
  const daily = trackDaily(s, track.id);
  if (daily.size === 0) return 0;
  const first = [...daily.keys()].sort()[0];
  const met = (d: string) => (daily.get(d) ?? 0) >= track.dailyTarget;

  let d = met(today) ? today : addDays(today, -1);
  let streak = 0;
  const rest = new Map<string, number>();
  while (d >= first) {
    if (met(d)) streak++;
    else {
      const wk = mondayOf(d);
      const used = rest.get(wk) ?? 0;
      if (used >= track.restDays) break;
      rest.set(wk, used + 1);
    }
    d = addDays(d, -1);
  }
  return streak;
}

/** The longest streak between two dates, by the same rules. */
export function longestStreak(
  s: TrackerState,
  track: ReadingTrack,
  from: string,
  to: string
): number {
  if (track.dailyTarget <= 0) return 0;
  const daily = trackDaily(s, track.id);
  if (daily.size === 0) return 0;
  // Counted from the first day anything was logged: the empty days before it
  // would otherwise use up that week's rest days, and today isn't a miss
  // until it is over.
  const first = [...daily.keys()].sort()[0];
  const today = dateKey();
  let best = 0;
  let cur = 0;
  const rest = new Map<string, number>();
  for (let d = first > from ? first : from; d <= to; d = addDays(d, 1)) {
    const met = (daily.get(d) ?? 0) >= track.dailyTarget;
    if (!met && d === today) continue;
    if (met) {
      cur++;
      best = Math.max(best, cur);
    } else {
      const wk = mondayOf(d);
      const used = rest.get(wk) ?? 0;
      if (used < track.restDays) rest.set(wk, used + 1);
      else cur = 0;
    }
  }
  return best;
}

export function remainingPages(b: Book): number {
  return b.pages > 0 ? Math.max(0, b.pages - b.read) : 0;
}

/**
 * Average pages a day over the last fortnight, and when the book will be
 * finished at that rate.
 *
 * A book started less than two weeks ago is averaged over the days since it
 * started, or a strong first week would read as half its real pace.
 */
export function bookPace(
  s: TrackerState,
  b: Book,
  today: string = dateKey()
): { perDay: number; eta: string | null } {
  const from = addDays(today, -13);
  const sessions = s.readingSessions.filter((x) => x.bookId === b.id);
  const recent = sessions.filter((x) => x.date >= from && x.date <= today);
  const pages = recent.reduce((a, x) => a + x.pages, 0);
  const firstDay = [b.startedDate, ...sessions.map((x) => x.date)]
    .filter(isDateKey)
    .sort()[0];
  const window = firstDay ? Math.min(14, Math.max(1, daysBetween(firstDay, today) + 1)) : 14;
  const perDay = pages / window;
  const left = remainingPages(b);
  const eta =
    b.status !== "finished" && b.pages > 0 && left > 0 && perDay > 0
      ? addDays(today, Math.ceil(left / perDay))
      : null;
  return { perDay, eta };
}

/** Pages an hour, from the sessions that had a duration. */
export function readingSpeed(s: TrackerState, bookId?: string): number | null {
  const timed = s.readingSessions.filter(
    (x) => (!bookId || x.bookId === bookId) && x.minutes && x.minutes > 0
  );
  const mins = timed.reduce((a, x) => a + (x.minutes ?? 0), 0);
  if (mins === 0) return null;
  return (timed.reduce((a, x) => a + x.pages, 0) / mins) * 60;
}

/** The last day anything moved on this book. */
export function lastProgress(s: TrackerState, b: Book): string | undefined {
  const dates = [b.touched, b.startedDate, ...s.readingSessions.filter((x) => x.bookId === b.id).map((x) => x.date)];
  return dates.filter(isDateKey).sort().pop();
}

export const STALL_DAYS = 7;

/**
 * An open book that hasn't moved for a week, and hasn't been waved off in
 * that time. Waving it off only quiets it for a week: a book still untouched
 * after that is worth asking about again.
 */
export function isStalled(s: TrackerState, b: Book, today: string = dateKey()): boolean {
  if (b.status !== "active") return false;
  const last = lastProgress(s, b);
  if (!last || daysBetween(last, today) < STALL_DAYS) return false;
  if (b.stallDismissed && daysBetween(b.stallDismissed, today) < STALL_DAYS) return false;
  return true;
}

/** Books meant to be read before this one that haven't been finished. */
export function unmetPrerequisites(s: TrackerState, b: Book): Book[] {
  return (b.after ?? [])
    .map((id) => s.books.find((x) => x.id === id))
    .filter((x): x is Book => !!x && x.status !== "finished" && x.status !== "dropped");
}

/**
 * The books that would have to give way for this one to be opened in a
 * track: the open ones, when the track is already at its limit.
 */
export function wipBlockers(s: TrackerState, bookId: string, trackId: string): Book[] {
  const track = trackOf(s, trackId);
  if (!track) return [];
  const open = activeBooks(s, trackId).filter((b) => b.id !== bookId);
  return open.length >= track.wipLimit ? open : [];
}

export type PhaseFlag = "done" | "on-track" | "at-risk" | "behind" | "unknown";

export type PhaseStats = {
  books: Book[];
  /** 0 to 1, weighted by pages. */
  completion: number;
  finished: number;
  projected: string | null;
  flag: PhaseFlag;
  /** A track's pace was taken from its target, having nothing logged lately. */
  assumed: boolean;
  /** Books left out of the projection for want of a page count. */
  unsized: number;
};

/** How far the reading has gone in a track over the last fortnight. */
function trackPace(s: TrackerState, track: ReadingTrack, today: string): number {
  const from = addDays(today, -13);
  const inTrack = new Set(s.books.filter((b) => b.trackId === track.id).map((b) => b.id));
  const pages = s.readingSessions
    .filter((x) => inTrack.has(x.bookId) && x.date >= from && x.date <= today)
    .reduce((a, x) => a + x.pages, 0);
  return pages / 14;
}

/** How far through a book, counting a finished one as complete. */
function bookFraction(b: Book): number {
  if (b.status === "finished") return 1;
  if (b.pages <= 0) return 0;
  return Math.min(1, b.read / b.pages);
}

/**
 * Completion and a projected end date for every phase.
 *
 * Tracks read one book after another, so a phase's books are read after the
 * earlier phases' books in the same track: the projection for a track is
 * everything left in it up to and including this phase, at the pace it has
 * been read over the last fortnight. The phase ends when its slowest track
 * does. A track with nothing logged lately is projected at its daily target
 * instead, which is flagged, since it is a hope rather than a measurement.
 */
export function phaseStats(s: TrackerState, today: string = dateKey()): Map<string, PhaseStats> {
  const phases = [...s.readingPhases].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const carried = new Map<string, number>();
  const out = new Map<string, PhaseStats>();

  const known = s.books.filter((b) => b.pages > 0).map((b) => b.pages).sort((a, b) => a - b);
  const typical = known.length ? known[Math.floor(known.length / 2)] : 300;

  for (const p of phases) {
    const books = s.books.filter((b) => b.phaseId === p.id && b.status !== "dropped");
    let weight = 0;
    let done = 0;
    for (const b of books) {
      const w = b.pages > 0 ? b.pages : typical;
      weight += w;
      done += w * bookFraction(b);
    }
    const completion = weight > 0 ? done / weight : 0;
    const finished = books.filter((b) => b.status === "finished").length;
    const unsized = books.filter((b) => b.status !== "finished" && b.pages <= 0).length;

    let days = 0;
    let assumed = false;
    let projectable = true;
    for (const t of s.readingTracks) {
      const left = books
        .filter((b) => b.trackId === t.id && b.status !== "finished")
        .reduce((a, b) => a + remainingPages(b), 0);
      const total = (carried.get(t.id) ?? 0) + left;
      carried.set(t.id, total);
      if (left === 0) continue;
      let pace = trackPace(s, t, today);
      if (pace <= 0) {
        pace = t.dailyTarget;
        assumed = true;
      }
      if (pace <= 0) {
        projectable = false;
        continue;
      }
      days = Math.max(days, Math.ceil(total / pace));
    }

    const remaining = books.some((b) => b.status !== "finished");
    // Nothing left has a length yet: there is nothing to project from, and
    // a projection of "today" would read as done.
    const sized = books.some((b) => b.status !== "finished" && b.pages > 0);
    let projected: string | null = null;
    let flag: PhaseFlag;
    if (books.length > 0 && !remaining) flag = "done";
    else if (books.length === 0 || !projectable || !sized) flag = "unknown";
    else {
      projected = addDays(today, days);
      if (today > p.end) flag = "behind";
      else if (projected <= p.end) flag = "on-track";
      else if (daysBetween(p.end, projected) <= 14) flag = "at-risk";
      else flag = "behind";
    }
    out.set(p.id, { books, completion, finished, projected, flag, assumed, unsized });
  }
  return out;
}

/* ============================== Changes ================================ */

/** Recomputes a book's progress from its base and its sessions. */
function recalc(s: TrackerState, bookId: string): TrackerState {
  const logged = s.readingSessions
    .filter((x) => x.bookId === bookId)
    .reduce((a, x) => a + x.pages, 0);
  return {
    ...s,
    books: s.books.map((b) => {
      if (b.id !== bookId) return b;
      const raw = Math.max(0, b.base + logged);
      return { ...b, read: b.pages > 0 ? Math.min(raw, b.pages) : raw };
    }),
  };
}

function patchBook(s: TrackerState, id: string, fn: (b: Book) => Book): TrackerState {
  return { ...s, books: s.books.map((b) => (b.id === id ? fn(b) : b)) };
}

/** After everything else in the track's queue. */
function queueEnd(s: TrackerState, trackId: string, except?: string): number {
  const orders = s.books
    .filter((b) => b.trackId === trackId && b.id !== except)
    .map((b) => b.queueOrder);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

function queueTop(s: TrackerState, trackId: string, except?: string): number {
  const orders = s.books
    .filter((b) => b.trackId === trackId && b.id !== except)
    .map((b) => b.queueOrder);
  return orders.length ? Math.min(...orders) - 1 : 0;
}

export type BookInput = {
  title: string;
  author?: string;
  pages?: number;
  edition?: string;
  language?: string;
  tags?: string[];
  trackId: string;
  phaseId?: string;
  coverId?: string | null;
  coverImage?: string;
  after?: string[];
  note?: string;
};

const clean = (v?: string) => {
  const t = v?.trim();
  return t ? t : undefined;
};

const cleanTags = (tags?: string[]) => {
  const out = [...new Set((tags ?? []).map((t) => t.trim()).filter(Boolean))];
  return out.length ? out : undefined;
};

const pageCount = (v?: number) => (v && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

/** A new book, queued at the end of its track. */
export function addBook(s: TrackerState, input: BookInput, id: string = uid()): TrackerState {
  const title = input.title.trim();
  if (!title) return s;
  // Random, but never the same as the book it will stand next to — two
  // identical spines side by side look like one wide book.
  const last = s.books[s.books.length - 1];
  const lastColor = last ? bookColor(last) : null;
  const choices = BOOK_COLORS.filter((c) => c !== lastColor);
  const color = choices[Math.floor(Math.random() * choices.length)];
  const today = dateKey();
  const book: Book = {
    id,
    title,
    author: clean(input.author),
    pages: pageCount(input.pages),
    read: 0,
    base: 0,
    color,
    trackId: input.trackId,
    status: "queued",
    queueOrder: queueEnd(s, input.trackId),
    phaseId: input.phaseId || undefined,
    edition: clean(input.edition),
    language: clean(input.language),
    tags: cleanTags(input.tags),
    coverImage: clean(input.coverImage),
    after: input.after?.length ? input.after : undefined,
    note: clean(input.note),
    statusLog: [{ status: "queued", date: today }],
    // Only when it came from a chosen suggestion. Left absent otherwise,
    // which is what marks it for a lookup.
    ...(input.coverId !== undefined ? { coverId: input.coverId } : {}),
  };
  return { ...s, books: [...s.books, book] };
}

/**
 * Edits a book's details. Moving it to another track keeps its progress; a
 * waiting book joins the end of the new track's queue.
 */
export function updateBook(s: TrackerState, id: string, input: BookInput): TrackerState {
  const title = input.title.trim();
  if (!title) return s;
  const today = dateKey();
  const after = input.after?.filter((x) => x !== id) ?? [];
  const next = patchBook(s, id, (b) => {
    const author = clean(input.author);
    const moved = b.trackId !== input.trackId;
    // An open book moved into a track that is already at its limit is paused
    // there rather than pushing the track over it.
    const bumped = moved && b.status === "active" && wipBlockers(s, id, input.trackId).length > 0;
    return {
      ...b,
      ...(bumped
        ? {
            status: "paused" as const,
            pausedDate: today,
            statusLog: [...(b.statusLog ?? []), { status: "paused" as const, date: today }],
          }
        : {}),
      title,
      author,
      pages: pageCount(input.pages),
      edition: clean(input.edition),
      language: clean(input.language),
      tags: cleanTags(input.tags),
      coverImage: clean(input.coverImage),
      phaseId: input.phaseId || undefined,
      after: after.length ? after : undefined,
      note: clean(input.note),
      trackId: input.trackId,
      queueOrder: moved ? queueEnd(s, input.trackId, id) : b.queueOrder,
      // A change of title or author is a change of book as far as the cover
      // is concerned, so it goes to be looked up again rather than keeping
      // the old book's picture.
      ...(title !== b.title || author !== b.author ? { coverId: undefined } : {}),
    };
  });
  // Shortening a book below where it had been read to would leave it past
  // the end; recalculating clamps it.
  return recalc(next, id);
}

/** Removes a book, with everything logged against it. */
export function removeBook(s: TrackerState, id: string): TrackerState {
  return {
    ...s,
    books: s.books
      .filter((b) => b.id !== id)
      .map((b) => (b.after?.includes(id) ? { ...b, after: b.after.filter((x) => x !== id) } : b)),
    readingSessions: s.readingSessions.filter((x) => x.bookId !== id),
    bookQuotes: s.bookQuotes.filter((q) => q.bookId !== id),
  };
}

/**
 * Moves a book to a new status, noting the day.
 *
 * Starting a book stamps its start date the first time only, so a book that
 * was paused and picked up again keeps the day it was really begun.
 */
export function setStatus(
  s: TrackerState,
  id: string,
  status: BookStatus,
  opts: { reason?: string; place?: "top" | "end" } = {}
): TrackerState {
  const today = dateKey();
  const book = s.books.find((b) => b.id === id);
  if (!book || book.status === status) return s;
  return patchBook(s, id, (b) => {
    const next: Book = {
      ...b,
      status,
      statusLog: [...(b.statusLog ?? []), { status, date: today }],
      stallDismissed: undefined,
    };
    if (status === "active") next.startedDate = b.startedDate ?? today;
    if (status === "paused") next.pausedDate = today;
    if (status === "finished") next.doneDate = today;
    else next.doneDate = undefined;
    if (status === "dropped") {
      next.droppedDate = today;
      next.dropReason = clean(opts.reason);
    } else {
      next.droppedDate = undefined;
      next.dropReason = undefined;
    }
    if (opts.place === "top") next.queueOrder = queueTop(s, b.trackId, b.id);
    if (opts.place === "end") next.queueOrder = queueEnd(s, b.trackId, b.id);
    return next;
  });
}

export type LogInput = {
  id: string;
  date: string;
  /** Pages read in this sitting… */
  pages?: number;
  /** …or the page reached, from which the pages are worked out. */
  toPage?: number;
  minutes?: number;
  note?: string;
};

/**
 * Logs a sitting.
 *
 * Given the page reached, the pages read are the difference. A page behind
 * where the book already stands is a correction rather than a sitting, so it
 * moves the book back without logging negative reading. Pages past the end
 * are cut off at the end.
 */
export function logSession(s: TrackerState, bookId: string, input: LogInput): TrackerState {
  const book = s.books.find((b) => b.id === bookId);
  if (!book) return s;
  let pages =
    input.toPage != null && Number.isFinite(input.toPage)
      ? Math.round(input.toPage) - book.read
      : Math.round(input.pages ?? 0);

  if (input.toPage != null && pages < 0) return setCurrentPage(s, bookId, input.toPage);
  if (book.pages > 0) pages = Math.min(pages, book.pages - book.read);
  if (!Number.isFinite(pages) || pages <= 0) return s;

  const session: ReadingSession = {
    id: input.id,
    bookId,
    date: input.date,
    pages,
    at: Date.now(),
    ...(input.minutes && input.minutes > 0 ? { minutes: Math.round(input.minutes) } : {}),
    ...(clean(input.note) ? { note: clean(input.note) } : {}),
  };
  const next: TrackerState = {
    ...patchBook(s, bookId, (b) => ({
      ...b,
      touched: input.date > (b.touched ?? "") ? input.date : b.touched,
      startedDate: b.startedDate ?? input.date,
      stallDismissed: undefined,
    })),
    readingSessions: [...s.readingSessions, session],
  };
  return recalc(next, bookId);
}

export function updateSession(
  s: TrackerState,
  id: string,
  patch: { date?: string; pages?: number; minutes?: number | null; note?: string | null }
): TrackerState {
  const session = s.readingSessions.find((x) => x.id === id);
  if (!session) return s;
  const next: TrackerState = {
    ...s,
    readingSessions: s.readingSessions.map((x) => {
      if (x.id !== id) return x;
      const out: ReadingSession = { ...x };
      if (patch.date && isDateKey(patch.date)) out.date = patch.date;
      if (patch.pages != null && Number.isFinite(patch.pages) && patch.pages > 0)
        out.pages = Math.round(patch.pages);
      if (patch.minutes !== undefined)
        out.minutes = patch.minutes && patch.minutes > 0 ? Math.round(patch.minutes) : undefined;
      if (patch.note !== undefined) out.note = clean(patch.note ?? undefined);
      return out;
    }),
  };
  return recalc(next, session.bookId);
}

export function removeSession(s: TrackerState, id: string): TrackerState {
  const session = s.readingSessions.find((x) => x.id === id);
  if (!session) return s;
  return recalc(
    { ...s, readingSessions: s.readingSessions.filter((x) => x.id !== id) },
    session.bookId
  );
}

/**
 * Puts a book at a page without logging it as read: a correction, or a jump
 * past chapters skimmed. The base absorbs the difference, so the sessions
 * stay what was actually read.
 */
export function setCurrentPage(s: TrackerState, bookId: string, page: number): TrackerState {
  const book = s.books.find((b) => b.id === bookId);
  if (!book || !Number.isFinite(page)) return s;
  const target = Math.max(0, Math.round(book.pages > 0 ? Math.min(page, book.pages) : page));
  const today = dateKey();
  return recalc(
    patchBook(s, bookId, (b) => ({
      ...b,
      base: b.base + (target - b.read),
      touched: today,
      stallDismissed: undefined,
    })),
    bookId
  );
}

/** Orders a track's queue as given. Books not listed keep their place after. */
export function reorderQueue(s: TrackerState, trackId: string, ids: string[]): TrackerState {
  const rank = new Map(ids.map((id, i) => [id, i]));
  const rest = trackQueue(s, trackId).filter((b) => !rank.has(b.id));
  rest.forEach((b, i) => rank.set(b.id, ids.length + i));
  return {
    ...s,
    books: s.books.map((b) =>
      b.trackId === trackId && rank.has(b.id) ? { ...b, queueOrder: rank.get(b.id)! } : b
    ),
  };
}

/** Moves a waiting book to the front or the back of its track's queue. */
export function placeInQueue(s: TrackerState, id: string, place: "top" | "end"): TrackerState {
  const book = s.books.find((b) => b.id === id);
  if (!book) return s;
  const order = place === "top" ? queueTop(s, book.trackId, id) : queueEnd(s, book.trackId, id);
  return patchBook(s, id, (b) => ({ ...b, queueOrder: order }));
}

export function dismissStall(s: TrackerState, bookId: string): TrackerState {
  return patchBook(s, bookId, (b) => ({ ...b, stallDismissed: dateKey() }));
}

/* ---- tracks ---- */

export type TrackInput = Omit<ReadingTrack, "id">;

function normaliseTrack(t: TrackInput): TrackInput {
  return {
    name: t.name.trim() || "Track",
    color: t.color,
    wipLimit: Math.max(1, Math.round(t.wipLimit || 1)),
    dailyTarget: Math.max(0, Math.round(t.dailyTarget || 0)),
    slot: clean(t.slot),
    restDays: Math.min(6, Math.max(0, Math.round(t.restDays || 0))),
    archived: t.archived ? true : undefined,
  };
}

export function addTrack(s: TrackerState, t: TrackInput): TrackerState {
  return { ...s, readingTracks: [...s.readingTracks, { id: uid(), ...normaliseTrack(t) }] };
}

export function updateTrack(s: TrackerState, id: string, t: TrackInput): TrackerState {
  return {
    ...s,
    readingTracks: s.readingTracks.map((x) => (x.id === id ? { id, ...normaliseTrack(t) } : x)),
  };
}

/* ---- phases ---- */

export type PhaseInput = Omit<ReadingPhase, "id">;

function normalisePhase(p: PhaseInput): PhaseInput {
  const [start, end] = p.start <= p.end ? [p.start, p.end] : [p.end, p.start];
  return { name: p.name.trim() || "Phase", start, end, goal: clean(p.goal) };
}

export function addPhase(s: TrackerState, p: PhaseInput): TrackerState {
  if (!isDateKey(p.start) || !isDateKey(p.end)) return s;
  return { ...s, readingPhases: [...s.readingPhases, { id: uid(), ...normalisePhase(p) }] };
}

export function updatePhase(s: TrackerState, id: string, p: PhaseInput): TrackerState {
  if (!isDateKey(p.start) || !isDateKey(p.end)) return s;
  return {
    ...s,
    readingPhases: s.readingPhases.map((x) => (x.id === id ? { id, ...normalisePhase(p) } : x)),
  };
}

/** Removes a phase. Its books stay, unassigned. */
export function removePhase(s: TrackerState, id: string): TrackerState {
  return {
    ...s,
    readingPhases: s.readingPhases.filter((p) => p.id !== id),
    books: s.books.map((b) => (b.phaseId === id ? { ...b, phaseId: undefined } : b)),
  };
}

/* ---- quotes ---- */

export function addQuote(
  s: TrackerState,
  bookId: string,
  text: string,
  page?: number
): TrackerState {
  const t = text.trim();
  if (!t) return s;
  const q: BookQuote = {
    id: uid(),
    bookId,
    text: t,
    date: dateKey(),
    at: Date.now(),
    ...(page && Number.isFinite(page) && page > 0 ? { page: Math.round(page) } : {}),
  };
  return { ...s, bookQuotes: [...s.bookQuotes, q] };
}

export function removeQuote(s: TrackerState, id: string): TrackerState {
  return { ...s, bookQuotes: s.bookQuotes.filter((q) => q.id !== id) };
}

/* ---- bulk add ---- */

/**
 * Reads one "Title – Author" per line. Any dash with spaces round it splits
 * the two, as does " by "; a line with neither is a title alone. A trailing
 * page count in brackets, "(320)" or "(320 pages)", is taken as the length.
 */
export function parseBookList(text: string): { title: string; author?: string; pages?: number }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((line) => {
      let rest = line;
      let pages: number | undefined;
      const m = rest.match(/\s*\((\d{1,5})(?:\s*(?:pages|pp|p)\.?)?\)\s*$/i);
      if (m) {
        pages = Number(m[1]);
        rest = rest.slice(0, m.index).trim();
      }
      const split = rest.match(/^(.*?)\s+(?:[–—-]|by)\s+(.+)$/i);
      if (split) return { title: split[1].trim(), author: split[2].trim(), pages };
      return { title: rest, pages };
    })
    .filter((b) => b.title);
}

export function addBooks(
  s: TrackerState,
  list: { title: string; author?: string; pages?: number }[],
  trackId: string,
  phaseId?: string
): TrackerState {
  return list.reduce(
    (acc, b) => addBook(acc, { title: b.title, author: b.author, pages: b.pages, trackId, phaseId }),
    s
  );
}
