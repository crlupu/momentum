"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "../ui";
import { ImageOff, X } from "../icons";
import { DeleteButton } from "../DeleteButton";
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
  const [edition, setEdition] = useState(book?.edition ?? "");
  const [language, setLanguage] = useState(book?.language ?? "");
  const [tags, setTags] = useState((book?.tags ?? []).join(", "));
  const [track, setTrack] = useState(book?.trackId ?? trackId ?? tracks[0]?.id ?? "");
  const [phase, setPhase] = useState(book?.phaseId ?? "");
  const [coverImage, setCoverImage] = useState(book?.coverImage ?? "");
  const [after, setAfter] = useState<string[]>(book?.after ?? []);
  const [note, setNote] = useState(book?.note ?? "");
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
    R.wipBlockers(s, book.id, track).length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || !track || pending) return;
    const input: R.BookInput = {
      title: t,
      author,
      pages: Number(pages) || 0,
      edition,
      language,
      tags: tags.split(","),
      trackId: track,
      phaseId: phase || undefined,
      coverImage,
      after,
      note,
      ...(book ? {} : { coverId: pickedCover }),
    };
    onClose();
    await run(() => (book ? tracker.updateBook(book.id, input) : tracker.addBook(input)));
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
      <div className="grid grid-cols-3 gap-2">
        <Field label="Pages">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Unknown"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
          />
        </Field>
        <Field label="Edition">
          <input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="e.g. 2nd" />
        </Field>
        <Field label="Language">
          <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. EN" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Track">
          <select value={track} onChange={(e) => setTrack(e.target.value)}>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
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
          That track is already at its limit, so this book will be paused there.
        </p>
      )}
      <Field label="Note">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. skim dated chapters" />
      </Field>
      <Field label="Tags" hint="Separated by commas">
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. architecture, ddd" />
      </Field>

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

      <Field label="Cover image address (optional)" hint="Leave empty to use Open Library's cover or a drawn one">
        <input
          type="url"
          inputMode="url"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      {book && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onPress={() => flow.replace({ kind: "page", bookId: book.id })}>
            Update current page…
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={() => void tracker.setBookCover(book.id, undefined)}
          >
            Find cover
          </Button>
          {book.coverId && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => void tracker.setBookCover(book.id, null)}
            >
              <ImageOff className="h-3.5 w-3.5" /> Use plain cover
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {book ? (
          <DeleteButton
            what={`"${book.title}"`}
            bare
            iconOnly
            onDelete={async () => {
              // Out of every dialog: the book's own page would be left
              // showing a book that is gone.
              onClose();
              flow.close();
              return tracker.removeBook(book.id);
            }}
          />
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button variant="outline" onPress={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isDisabled={pending || !title.trim() || !track}>
            {book ? "Save" : "Add"}
          </Button>
        </span>
      </div>
    </form>
  );
}
