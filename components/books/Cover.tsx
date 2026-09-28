"use client";

import { useEffect, useRef, useState } from "react";
import { readableText } from "@/lib/color";
import { Tracker, Book, bookColor } from "@/lib/tracker";
import { coverUrl, lookupBook } from "@/lib/covers";

/** Loose comparison for matching titles typed by hand against stored ones. */
export function normaliseTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The cover.
 *
 * A real one if Open Library had it, otherwise one built from what is already
 * known: the book's colour, a darker band down the binding edge, and its
 * initials. The drawn cover is also what shows when the image fails — offline,
 * or a cover id that no longer resolves — so a book never appears as a broken
 * image.
 */
export function Cover({ book, size = "md" }: { book: Book; size?: "sm" | "md" }) {
  const colour = bookColor(book);
  const ink = readableText(colour);
  const [broken, setBroken] = useState(false);

  // A new cover deserves a fresh attempt, whatever happened to the last one.
  useEffect(() => setBroken(false), [book.coverId, book.coverImage]);
  const sizeClass = size === "sm" ? " book-cover--sm" : "";

  const initials = book.title
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const src = book.coverImage || (book.coverId ? coverUrl(book.coverId, "M") : null);
  if (src && !broken) {
    return (
      <img
        className={"book-cover book-cover--art" + sizeClass}
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span className={"book-cover" + sizeClass} style={{ background: colour, color: ink }} aria-hidden>
      <span className="book-cover__spine" />
      <span className="book-cover__initials">{initials}</span>
    </span>
  );
}

/**
 * Looks up the cover — and the author, where one is missing — for books that
 * have never been looked up.
 *
 * One at a time and once per book: Open Library ask not to have their cover
 * API crawled, and a lookup that finds nothing records null so the question is
 * not asked again on every load. A lookup that fails outright — offline, a bad
 * response — records nothing, leaving the book to be tried again later rather
 * than marking a book as having no cover when it may well have one.
 */
export function useCoverLookup(tracker: Tracker, books: Book[]) {
  // Tried this session. Without it a failed lookup would be retried in a loop,
  // since nothing about the book changes to stop it.
  const tried = useRef<Set<string>>(new Set());
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const next = books.find(
      (b) => b.coverId === undefined && !b.coverImage && !tried.current.has(b.id)
    );
    if (!next || busy.current) return;

    busy.current = true;
    tried.current.add(next.id);

    // Another copy of the same book already resolved is as good an answer as
    // the API's, and costs nothing. Only a book that was actually looked up
    // counts — one still waiting has nothing to give.
    const known = books.find(
      (b) =>
        b.id !== next.id &&
        b.coverId !== undefined &&
        normaliseTitle(b.title) === normaliseTitle(next.title)
    );
    if (known) {
      void tracker.resolveBook(next.id, known.coverId ?? null, known.author);
      busy.current = false;
      return;
    }

    // Deliberately not cancelled when this effect re-runs. The books array is
    // a new reference on every state change, so the effect re-runs constantly
    // — cancelling on cleanup threw away the answer to a lookup that had
    // already been made, and the book was never resolved. Only unmounting
    // stops it, and the write is harmless either way.
    lookupBook(next.title, next.author)
      .then(({ coverId, author }) => {
        if (alive.current) void tracker.resolveBook(next.id, coverId, author);
      })
      .catch(() => {
        // Left unresolved on purpose: a reload will try again.
      })
      .finally(() => {
        busy.current = false;
      });
  }, [books, tracker]);
}
