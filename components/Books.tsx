"use client";

import { FormEvent, useState } from "react";
import { Check, Plus } from "lucide-react";

import { Button, Input } from "./ui";
import { Modal } from "./Modal";
import { DeleteButton } from "./DeleteButton";
import { usePending } from "./ActionButton";
import { readableText } from "@/lib/color";
import { Tracker, Book, bookProgress, bookColor } from "@/lib/tracker";

/**
 * A stand-in cover.
 *
 * There is no artwork to show and asking for a cover image would be asking for
 * a chore, so the cover is built from what is already known: the book's colour,
 * a spine down the left edge, and its initials large enough to tell one from
 * another at a glance across a grid.
 */
function Cover({ book }: { book: Book }) {
  const colour = bookColor(book);
  const ink = readableText(colour);
  const initials = book.title
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <span className="book-cover" style={{ background: colour, color: ink }} aria-hidden>
      <span className="book-cover__spine" />
      <span className="book-cover__initials">{initials}</span>
    </span>
  );
}

/** Logs a reading session: pages read now, added to what was read before. */
function AddPagesForm({
  tracker,
  book,
  onClose,
}: {
  tracker: Tracker;
  book: Book;
  onClose: () => void;
}) {
  const [n, setN] = useState("");
  const { pending, run } = usePending();
  const left = Math.max(0, book.pages - book.read);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0 || pending) return;
    onClose();
    await run(() => tracker.addPagesRead(book.id, v));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        type="number"
        inputMode="numeric"
        aria-label="Pages read now"
        placeholder="Pages read now"
        value={n}
        onChange={(e) => setN(e.target.value)}
        autoFocus
      />
      <p className="text-xs text-foreground/50">
        {book.pages > 0
          ? `On page ${book.read} of ${book.pages} — ${left} to go.`
          : `${book.read} pages read so far.`}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onPress={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isDisabled={pending || n.trim() === ""}>
          Add
        </Button>
      </div>
    </form>
  );
}

/** Add a book, or edit one. The same fields either way. */
function BookForm({
  tracker,
  book,
  onClose,
}: {
  tracker: Tracker;
  book: Book | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
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
        await tracker.updateBook(book.id, t, n, author);
        return tracker.setBookProgress(book.id, Number(read) || 0);
      }
      return tracker.addBook(t, n, author);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        aria-label="Title"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={!book}
      />
      <Input
        aria-label="Author"
        placeholder="Author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <div className="flex gap-2">
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

/** One book: cover, title, author, how far through, and a way to log more. */
function BookCard({
  book,
  onEdit,
  onAddPages,
}: {
  book: Book;
  onEdit: () => void;
  onAddPages: () => void;
}) {
  const pct = Math.round(bookProgress(book) * 100);
  const done = book.pages > 0 && book.read >= book.pages;
  const colour = bookColor(book);

  return (
    <div className={"book-card" + (done ? " book-card--done" : "")}>
      {/* A finished book is marked twice over: the tick says so outright, and
          the tinted background says it at a glance down a long grid, where a
          small corner mark is easy to miss. */}
      {done && (
        <span className="book-card__tick" aria-hidden>
          <Check className="h-3.5 w-3.5" />
        </span>
      )}

      <button type="button" className="book-card__open" onClick={onEdit} aria-label={`Edit ${book.title}`}>
        <Cover book={book} />
      </button>

      <div className="book-card__body">
        <button type="button" className="book-card__title-btn" onClick={onEdit}>
          <span className="book-card__title">{book.title}</span>
          {book.author && <span className="book-card__author">{book.author}</span>}
        </button>

        <div className="book-card__meter" aria-hidden>
          <span style={{ width: `${pct}%`, background: colour }} />
        </div>

        <div className="book-card__foot">
          <span className="book-card__count">
            {book.pages > 0 ? (
              <>
                <span className="font-mono-n font-bold text-foreground">{book.read}</span>
                {" / "}
                {book.pages} pages · {pct}%
              </>
            ) : (
              <>
                <span className="font-mono-n font-bold text-foreground">{book.read}</span> pages read
              </>
            )}
          </span>
          {!done && (
            <Button size="sm" variant="outline" onPress={onAddPages}>
              <Plus className="h-3.5 w-3.5" /> Pages
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Books({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [logging, setLogging] = useState<Book | null>(null);

  const finished = s.books.filter((b) => b.pages > 0 && b.read >= b.pages).length;
  const pagesRead = s.books.reduce((n, b) => n + Math.min(b.read, b.pages || b.read), 0);

  // The dialogs are handed the book from state rather than the one captured
  // when they opened, so an edit made in one is reflected in the other.
  const live = (b: Book | null) => (b ? s.books.find((x) => x.id === b.id) ?? null : null);
  const editingBook = live(editing);
  const loggingBook = live(logging);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
          Reading
        </h3>
        <Button size="sm" variant="outline" onPress={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add book
        </Button>
      </div>

      {s.books.length === 0 ? (
        <p className="py-2 text-[15px] text-foreground/60">
          No books yet. Add one and it appears here, filling up as you read.
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

          <div className="book-grid">
            {s.books.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                onEdit={() => setEditing(b)}
                onAddPages={() => setLogging(b)}
              />
            ))}
          </div>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add book">
        <BookForm tracker={tracker} book={null} onClose={() => setAdding(false)} />
      </Modal>
      <Modal
        open={!!editingBook}
        onClose={() => setEditing(null)}
        title={editingBook?.title ?? "Book"}
      >
        {editingBook && (
          <BookForm tracker={tracker} book={editingBook} onClose={() => setEditing(null)} />
        )}
      </Modal>
      <Modal open={!!loggingBook} onClose={() => setLogging(null)} title="Add pages">
        {loggingBook && (
          <AddPagesForm tracker={tracker} book={loggingBook} onClose={() => setLogging(null)} />
        )}
      </Modal>
    </div>
  );
}

export default Books;
