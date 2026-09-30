"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "../ui";
import { X } from "../icons";
import { DialogActions } from "../DialogActions";
import { usePending } from "../ActionButton";
import { Tracker, Book } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { BookSuggestion, coverUrl, searchBooks } from "@/lib/covers";
import { normaliseTitle } from "./Cover";
import { Field } from "./bits";
import { useFlow } from "./flowContext";

/**
 * Books already on the shelf whose titles contain what has been typed.
 *
 * Free and instant, because the whole shelf is already in memory — the
 * Firestore document is read once and kept there. So this can be shown while
 * the network search is still being waited on, and it is the answer to the
 * question the search often turns out to be asking: have I got this already.
 */
function shelfMatches(books: Book[], query: string, limit = 4): Book[] {
  const q = normaliseTitle(query);
  if (!q) return [];
  return books.filter((b) => normaliseTitle(b.title).includes(q)).slice(0, limit);
}

/** How much has to be typed before it is worth asking. */
const MIN_QUERY = 3;
/**
 * How long typing has to stop for before a request goes out.
 *
 * Long enough that a title typed at speed makes one request rather than
 * several. The wait is only felt when you stop, and Open Library is slow often
 * enough that a request fired mid-word is usually wasted anyway.
 */
const DEBOUNCE_MS = 700;
/**
 * How long a search is given before it is dropped.
 *
 * Open Library sometimes takes a very long time to answer. Without this the
 * list sat on "Searching…" for as long as it took, and an answer that finally
 * arrived half a minute later would drop a list over whatever had been typed
 * since. Better to give up and say so.
 */
const TIMEOUT_MS = 6000;

/**
 * Title suggestions while adding a book.
 *
 * Debounced and abortable, and never fired on a query shorter than a few
 * characters: this runs on keystrokes against an API whose owners ask not to
 * be crawled, so the point is to make one request per pause in typing rather
 * than one per letter. The abort matters as much as the debounce — without it
 * a slow answer to "har" could arrive after the answer to "harry" and replace
 * a good list with a stale one.
 */
function useTitleSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<BookSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      setTimedOut(false);
      return;
    }

    const controller = new AbortController();
    // Distinguishes our own timeout from the abort that happens when the
    // query changes: one is worth reporting, the other is routine.
    let expired = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    setSearching(true);
    setTimedOut(false);

    const debounce = setTimeout(() => {
      timeout = setTimeout(() => {
        expired = true;
        controller.abort();
      }, TIMEOUT_MS);

      searchBooks(q, controller.signal)
        .then((r) => {
          setResults(r);
          setSearching(false);
        })
        .catch((e) => {
          if (expired) {
            setResults([]);
            setSearching(false);
            setTimedOut(true);
          } else if ((e as Error)?.name !== "AbortError") {
            // A real failure. An abort is this effect being superseded.
            setResults([]);
            setSearching(false);
          }
        })
        .finally(() => clearTimeout(timeout));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounce);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, enabled]);

  return { results, searching, timedOut };
}

/**
 * Add a book, or edit one. The same fields either way, with the track, phase
 * and "read before" links that place it in the plan.
 */
export function BookForm({
  tracker,
  book,
  trackId,
  onClose,
}: {
  tracker: Tracker;
  book: Book | null;
  /** The track a new book goes in, when it is added from a track. */
  trackId?: string;
  onClose: () => void;
}) {
  const s = tracker.state!;
  const flow = useFlow();
  const shelf = s.books;
  const tracks = s.readingTracks.filter((t) => !t.archived || t.id === book?.trackId);
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [pages, setPages] = useState(book?.pages ? String(book.pages) : "");
  const [track, setTrack] = useState(book?.trackId ?? trackId ?? tracks[0]?.id ?? "");
  const [phase, setPhase] = useState(book?.phaseId ?? "");
  const [coverImage, setCoverImage] = useState(book?.coverImage ?? "");
  const [after, setAfter] = useState<string[]>(book?.after ?? []);
  const { pending, run } = usePending();

  // The cover from a chosen suggestion. Undefined means nothing was chosen, so
  // the new book is left to be looked up in the usual way.
  const [pickedCover, setPickedCover] = useState<string | null | undefined>(undefined);
  // The title as it was when a suggestion was taken. Searching again for it
  // would reopen the list underneath the answer just chosen.
  const [chosen, setChosen] = useState<string | null>(null);
  // Only when adding: an existing book's title is being corrected, not looked
  // for, and a list dropping open under it would be in the way.
  const suggesting = !book && chosen !== title.trim();
  const { results, searching, timedOut } = useTitleSearch(title, suggesting);

  // The shelf is searched first and shown straight away; the network search
  // fills in underneath when it arrives. A book already here is dropped from
  // the network results rather than listed twice.
  const mine = suggesting && title.trim().length >= MIN_QUERY ? shelfMatches(shelf, title) : [];
  const seen = new Set(mine.map((b) => normaliseTitle(b.title)));
  const remote = results.filter((r) => !seen.has(normaliseTitle(r.title)));

  /** Takes everything already known about a book on the shelf. */
  const chooseMine = (b: Book) => {
    setTitle(b.title);
    setChosen(b.title);
    if (b.author) setAuthor(b.author);
    if (b.pages && !pages.trim()) setPages(String(b.pages));
    // Undefined would send the new copy off to be looked up again for an
    // answer this one already has.
    setPickedCover(b.coverId ?? null);
  };

  const choose = (sg: BookSuggestion) => {
    setTitle(sg.title);
    setChosen(sg.title);
    if (sg.author) setAuthor(sg.author);
    // Only fills an empty length: a figure already typed is about the copy in
    // hand, which beats a median across editions.
    if (sg.pages && !pages.trim()) setPages(String(sg.pages));
    setPickedCover(sg.coverId ?? null);
  };

  // An open book moved into a full track is paused there. Said before saving
  // rather than discovered after.
  const bumps =
    !!book &&
    book.status === "active" &&
    track !== book.trackId &&
    (!track || R.wipBlockers(s, book.id, track).length > 0);

  // Where a book stands, changed from here rather than by buttons on its
  // page: pausing and dropping are rare, and finishing happens by reaching
  // the last page. Only the moves that make sense from where it is.
  const statusOptions: { value: R.BookStatus; label: string }[] = !book
    ? []
    : book.status === "active"
      ? [
          { value: "active", label: "Reading" },
          { value: "paused", label: "Paused" },
          { value: "dropped", label: "Dropped" },
        ]
      : book.status === "queued"
        ? [
            { value: "queued", label: "Up next" },
            { value: "dropped", label: "Dropped" },
          ]
        : book.status === "paused"
          ? [
              { value: "paused", label: "Paused" },
              { value: "dropped", label: "Dropped" },
            ]
          : book.status === "dropped"
            ? [
                { value: "dropped", label: "Dropped" },
                { value: "queued", label: "Back in the queue" },
              ]
            : [];
  const [status, setStatus] = useState<R.BookStatus | undefined>(book?.status);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    const input: R.BookInput = {
      title: t,
      author,
      pages: Number(pages) || 0,
      // Not asked for any more; kept as they were rather than wiped.
      edition: book?.edition,
      language: book?.language,
      tags: book?.tags,
      trackId: track,
      phaseId: phase || undefined,
      coverImage,
      after,
      note: book?.note,
      ...(book ? {} : { coverId: pickedCover }),
    };
    onClose();
    const ok = await run(() => (book ? tracker.updateBook(book.id, input) : tracker.addBook(input)));
    if (ok !== false && book && status && status !== book.status) {
      await run(() =>
        tracker.setBookStatus(book.id, status, { place: status === "paused" ? "top" : "end" })
      );
    }
  };

  const others = shelf
    .filter((b) => b.id !== book?.id && !after.includes(b.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="relative">
        <input
          aria-label="Title"
          placeholder="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            // Typing on past a chosen title means it wasn't the one.
            setChosen(null);
            setPickedCover(undefined);
          }}
          autoFocus={!book}
          className="w-full"
        />

        {suggesting &&
          title.trim().length >= MIN_QUERY &&
          (mine.length > 0 || remote.length > 0 || searching || timedOut) && (
          <ul className="book-suggest">
            {mine.map((b) => (
              <li key={`mine-${b.id}`}>
                <button type="button" className="book-suggest__row" onClick={() => chooseMine(b)}>
                  {b.coverId ? (
                    <img className="book-suggest__thumb" src={coverUrl(b.coverId, "S")} alt="" loading="lazy" />
                  ) : (
                    <span className="book-suggest__thumb book-suggest__thumb--none" aria-hidden />
                  )}
                  <span className="book-suggest__text">
                    <span className="book-suggest__title">{b.title}</span>
                    <span className="book-suggest__meta">
                      {[b.author, b.pages ? `${b.pages} pages` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="book-suggest__tag">On your shelf</span>
                </button>
              </li>
            ))}
            {remote.map((s) => (
              <li key={s.key}>
                <button type="button" className="book-suggest__row" onClick={() => choose(s)}>
                  {s.coverId ? (
                    <img className="book-suggest__thumb" src={coverUrl(s.coverId, "S")} alt="" loading="lazy" />
                  ) : (
                    <span className="book-suggest__thumb book-suggest__thumb--none" aria-hidden />
                  )}
                  <span className="book-suggest__text">
                    <span className="book-suggest__title">{s.title}</span>
                    <span className="book-suggest__meta">
                      {[s.author, s.year, s.pages ? `${s.pages} pages` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {searching && results.length === 0 && (
              <li className="book-suggest__note">Searching…</li>
            )}
            {timedOut && (
              <li className="book-suggest__note">
                Search timed out. Type a little more, or just fill it in yourself.
              </li>
            )}
          </ul>
        )}
      </div>
      <input
        aria-label="Author"
        placeholder="Author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        className="w-full"
      />
      <Field label="Pages">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Unknown"
          value={pages}
          onChange={(e) => setPages(e.target.value)}
          className="w-full"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Track">
          <select value={track} onChange={(e) => setTrack(e.target.value)}>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="">No track</option>
          </select>
        </Field>
        <Field label="Phase">
          <select value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">No phase</option>
            {s.readingPhases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {bumps && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {track
            ? "That track is already at its limit, so this book will be paused there."
            : "Without a track it won't show on Today, so it will be paused."}
        </p>
      )}

      <Field label="Read after">
        <div className="flex flex-col gap-1.5">
          {after.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {after.map((id) => {
                const b = shelf.find((x) => x.id === id);
                if (!b) return null;
                return (
                  <span key={id} className="cat-chip">
                    {b.title}
                    <button
                      type="button"
                      aria-label={`Remove ${b.title}`}
                      onClick={() => setAfter(after.filter((x) => x !== id))}
                      className="ml-1 text-[var(--muted)] hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <select
            aria-label="Add a book to read first"
            value=""
            onChange={(e) => e.target.value && setAfter([...after, e.target.value])}
          >
            <option value="">{after.length ? "Add another…" : "None — add a book to read first…"}</option>
            {others.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
      </Field>

      {statusOptions.length > 1 && (
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as R.BookStatus)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Cover image address (optional)" hint="Leave empty to use a cover found online, or a plain one">
        <input
          type="url"
          inputMode="url"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <DialogActions
        primary={{ label: book ? "Save" : "Add", disabled: pending || !title.trim() }}
        del={
          book && {
            what: `"${book.title}"`,
            onDelete: async () => {
              // Out of every dialog: the book's own page would be left
              // showing a book that is gone.
              onClose();
              flow.close();
              return tracker.removeBook(book.id);
            },
          }
        }
      />
    </form>
  );
}
