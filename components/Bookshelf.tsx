"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";

import { Button, Input } from "./ui";
import { Modal } from "./Modal";
import { DeleteButton } from "./DeleteButton";
import { usePending } from "./ActionButton";
import { Tracker, Book, bookProgress, bookColor } from "@/lib/tracker";

/** Every spine is the same width; only the height carries meaning now. */
const SPINE_WIDTH = 34;

/*
 * Spine height is the book's length. The scale is absolute rather than
 * relative to the longest book on the shelf: a height should mean the same
 * number of pages today as it did last month, and shelving one doorstopper
 * should not shrink everything already there.
 *
 * Clamped at both ends, so a pamphlet still has a spine you can read a title
 * on and a thousand-pager still fits the slot. Between them it is linear —
 * the point is to see at a glance which books are the long ones, not to read
 * a page count off a ruler.
 */
const SHORT_PAGES = 100;
const LONG_PAGES = 800;
const MIN_HEIGHT = 101;
const MAX_HEIGHT = 179;

function spineHeight(pages: number): number {
  // A book with no length recorded gets the shortest spine rather than none.
  if (!pages || pages <= 0) return MIN_HEIGHT;
  const t = (pages - SHORT_PAGES) / (LONG_PAGES - SHORT_PAGES);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(MIN_HEIGHT + clamped * (MAX_HEIGHT - MIN_HEIGHT));
}

/**
 * One book, stood on its end.
 *
 * The fill is a hard-stopped gradient rather than a child element, so the
 * unread part and the read part are one surface: the title sits over the join
 * without being clipped by it, which is what lets a part-read book still be
 * legible end to end.
 */
function Spine({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const pct = Math.round(bookProgress(book) * 100);
  const done = pct >= 100;

  return (
    <span className="book-slot">
      <button
      type="button"
      onClick={onOpen}
      className="book-spine"
      style={{
        height: spineHeight(book.pages),
        width: SPINE_WIDTH,
        // The read part in the book's own colour, the rest grey.
        background: `linear-gradient(to top, ${bookColor(book)} ${pct}%, var(--book-unread) ${pct}%)`,
      }}
      aria-label={`${book.title}, ${book.read} of ${book.pages} pages read`}
      title={`${book.title} — ${book.read}/${book.pages} pages`}
    >
      <span className={"book-spine__title" + (done ? " book-spine__title--done" : "")}>
        {book.title}
      </span>
      </button>
    </span>
  );
}

/** Add a book, or edit one. The same three fields either way. */
function BookForm({
  tracker,
  book,
  onClose,
}: {
  tracker: Tracker;
  /** The book being edited, or null when adding. */
  book: Book | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [pages, setPages] = useState(book ? String(book.pages || "") : "");
  const [read, setRead] = useState(book ? String(book.read || "") : "");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    const n = Number(pages) || 0;
    onClose();
    await run(async () => {
      if (book) {
        await tracker.updateBook(book.id, t, n);
        return tracker.setBookProgress(book.id, Number(read) || 0);
      }
      return tracker.addBook(t, n);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        aria-label="Title"
        placeholder="Title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={!book}
      />
      <div className="flex gap-2">
        {/* Progress first: on an existing book it is the field being come back
            to, while the length was settled when it was added. Only shown when
            editing — a book being added has not been read yet, and asking
            would be one more field to skip past every time. */}
        {book && (
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Pages read"
            placeholder="Pages read"
            value={read}
            onChange={(e) => setRead(e.target.value)}
            className="min-w-0 flex-1"
          />
        )}
        <Input
          type="number"
          inputMode="numeric"
          aria-label="Total pages"
          placeholder="Number of pages"
          value={pages}
          onChange={(e) => setPages(e.target.value)}
          className="min-w-0 flex-1"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {book ? (
          <DeleteButton
            what={`"${book.title}"`}
            bare
            iconOnly
            onDelete={async () => {
              onClose();
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
          <Button type="submit" variant="primary" isDisabled={pending || !title.trim()}>
            {book ? "Save" : "Add"}
          </Button>
        </span>
      </div>
    </form>
  );
}

/**
 * The shelf.
 *
 * Books wrap into rows, and each one carries its own length of shelf along its
 * bottom edge. Neighbouring books' shelves meet to form a continuous board
 * under each row, which is why the books sit flush and are separated by their
 * own margins rather than by a gap in the row — a gap would break the board.
 */
export function Bookshelf({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);

  const finished = s.books.filter((b) => b.pages > 0 && b.read >= b.pages).length;
  const pagesRead = s.books.reduce((n, b) => n + Math.min(b.read, b.pages || b.read), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
          Bookshelf
        </h3>
        <Button size="sm" variant="outline" onPress={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add book
        </Button>
      </div>

      {s.books.length === 0 ? (
        <p className="py-2 text-[15px] text-foreground/60">
          No books yet. Add one and it appears on the shelf, filling up as you read.
        </p>
      ) : (
        <>
          <div className="mb-3 flex gap-3 text-xs text-foreground/60">
            <span>
              <span className="font-mono-n text-sm font-bold text-foreground">{finished}</span> of{" "}
              {s.books.length} finished
            </span>
            <span>
              <span className="font-mono-n text-sm font-bold text-foreground">
                {pagesRead.toLocaleString()}
              </span>{" "}
              pages read
            </span>
          </div>

          <div className="bookshelf">
            {s.books.map((b) => (
              <Spine key={b.id} book={b} onOpen={() => setEditing(b)} />
            ))}
          </div>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add book">
        <BookForm tracker={tracker} book={null} onClose={() => setAdding(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.title ?? "Book"}>
        {editing && (
          <BookForm
            tracker={tracker}
            book={editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

export default Bookshelf;
