"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../ui";
import { Modal } from "../Modal";
import { usePending } from "../ActionButton";
import { Tracker, dateKey, uid, type Book } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { FlowContext, useFlow as useFlowFromContext, type Dialog, type Flow } from "./flowContext";
import { BookDetail } from "./BookDetail";
import { BookForm } from "./BookForm";
import { BulkAddForm, ImportPlanForm, PhaseForm, TrackForm } from "./forms";
import { Field, Segmented } from "./bits";

/** The book has reached its last page but hasn't been marked finished. */
function atEnd(b: Book | undefined): boolean {
  return !!b && b.pages > 0 && b.read >= b.pages && b.status !== "finished" && b.status !== "dropped";
}

/**
 * Holds the reading views' dialogs and the steps that chain them together:
 * starting a book past a track's limit, reaching the last page, finishing and
 * being offered the next book.
 */
export function ReadingFlow({ tracker, children }: { tracker: Tracker; children: ReactNode }) {
  const [stack, setStack] = useState<Dialog[]>([]);
  // A book whose progress just moved, waiting for the state to catch up so
  // its new page can be checked against its length.
  const [endCheck, setEndCheck] = useState<string | null>(null);
  const s = tracker.state!;

  const open = useCallback((d: Dialog) => setStack((st) => [...st, d]), []);
  const replace = useCallback((d: Dialog) => setStack((st) => [...st.slice(0, -1), d]), []);
  const close = useCallback(() => setStack((st) => st.slice(0, -1)), []);

  useEffect(() => {
    if (!endCheck) return;
    const b = s.books.find((x) => x.id === endCheck);
    setEndCheck(null);
    if (atEnd(b)) open({ kind: "finish", bookId: endCheck });
  }, [endCheck, s.books, open]);

  const flow: Flow = useMemo(() => {
    const startChecked = (bookId: string) => {
      const b = s.books.find((x) => x.id === bookId);
      if (!b) return;
      // A book in no track would open where Today can't show it: it gets a
      // track first, in its Edit.
      if (!R.trackOf(s, b.trackId)) open({ kind: "edit", bookId });
      else if (R.wipBlockers(s, bookId, b.trackId).length > 0) open({ kind: "wip", bookId });
      else void tracker.setBookStatus(bookId, "active");
    };
    return {
      open,
      replace,
      close,
      start: (bookId) => {
        const b = s.books.find((x) => x.id === bookId);
        if (!b) return;
        if (R.unmetPrerequisites(s, b).length > 0) open({ kind: "deps", bookId });
        else startChecked(bookId);
      },
      finish: async (bookId) => {
        const b = s.books.find((x) => x.id === bookId);
        if (!b) return;
        const after = R.setStatus(s, bookId, "finished");
        const ok = await tracker.setBookStatus(bookId, "finished");
        if (!ok) return;
        const next = R.nextInQueue(after, b.trackId);
        const track = R.trackOf(after, b.trackId);
        const room = track && R.activeBooks(after, b.trackId).length < track.wipLimit;
        if (next && room) open({ kind: "next", bookId: next.id, finishedTitle: b.title });
      },
      checkEnd: (bookId) => setEndCheck(bookId),
      startAnyway: startChecked,
    };
  }, [s, tracker, open, replace, close]);

  const top = stack[stack.length - 1];
  const book = top && "bookId" in top && top.bookId ? s.books.find((b) => b.id === top.bookId) : undefined;

  return (
    <FlowContext.Provider value={flow}>
      {children}
      {top && (
        <DialogFor
          dialog={top}
          book={book}
          tracker={tracker}
          flow={flow}
        />
      )}
    </FlowContext.Provider>
  );
}

function DialogFor({
  dialog: d,
  book,
  tracker,
  flow,
}: {
  dialog: Dialog;
  book: Book | undefined;
  tracker: Tracker;
  flow: Flow;
}) {
  const s = tracker.state!;
  const { close } = flow;

  switch (d.kind) {
    case "detail":
      return (
        <Modal open onClose={close} title={book?.title ?? "Book"} wide>
          {book ? <BookDetail tracker={tracker} book={book} /> : <Gone />}
        </Modal>
      );

    case "edit":
      return (
        <Modal open onClose={close} title={d.bookId ? "Edit book" : "Add book"}>
          <BookForm tracker={tracker} book={book ?? null} trackId={d.trackId} onClose={close} />
        </Modal>
      );

    case "log":
      return (
        <Modal open onClose={close} title="Update page">
          {book ? <LogForm tracker={tracker} book={book} /> : <Gone />}
        </Modal>
      );

    case "idea":
      return (
        <Modal open onClose={() => { close(); flow.checkEnd(d.bookId); }} title="Key idea">
          <IdeaForm tracker={tracker} sessionId={d.sessionId} pages={d.pages} bookId={d.bookId} />
        </Modal>
      );

    case "deps": {
      const first = book ? R.unmetPrerequisites(s, book) : [];
      return (
        <Modal open onClose={close} title="Read something first?">
          <p className="mb-2 text-[15px]">
            <span className="font-semibold">{book?.title}</span> is meant to be read after:
          </p>
          <ul className="mb-4 list-disc pl-5 text-[15px]">
            {first.map((b) => (
              <li key={b.id}>
                {b.title} <span className="text-[var(--muted)]">({R.STATUS_LABEL[b.status].toLowerCase()})</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onPress={close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                close();
                flow.startAnyway(d.bookId);
              }}
            >
              Start anyway
            </Button>
          </div>
        </Modal>
      );
    }

    case "wip":
      return (
        <Modal open onClose={close} title="Track is full">
          {book ? <WipChoice tracker={tracker} book={book} /> : <Gone />}
        </Modal>
      );

    case "finish":
      return (
        <Modal open onClose={close} title="Last page">
          <p className="mb-4 text-[15px]">
            You&apos;ve reached the end of <span className="font-semibold">{book?.title}</span>. Mark it
            finished?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onPress={close}>
              Not yet
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                close();
                if (book) void flow.finish(book.id);
              }}
            >
              Mark finished
            </Button>
          </div>
        </Modal>
      );

    case "next": {
      const track = book ? R.trackOf(s, book.trackId) : undefined;
      return (
        <Modal open onClose={close} title="What's next?">
          <p className="mb-1 text-[15px]">
            Finished <span className="font-semibold">{d.finishedTitle}</span>.
          </p>
          <p className="mb-4 text-[15px]">
            Next in {track?.name ?? "this track"}:{" "}
            <span className="font-semibold">{book?.title ?? "—"}</span>. Start it now?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onPress={close}>
              Skip
            </Button>
            <Button
              variant="primary"
              isDisabled={!book}
              onPress={() => {
                close();
                if (book) flow.start(book.id);
              }}
            >
              Start
            </Button>
          </div>
        </Modal>
      );
    }

    case "drop":
      return (
        <Modal open onClose={close} title="Drop book">
          {book ? <DropForm tracker={tracker} book={book} /> : <Gone />}
        </Modal>
      );

    case "page":
      // Setting the page counts the difference as read, like any update; only
      // skimming ahead moves the book without it.
      return d.skim ? (
        <Modal open onClose={close} title="Skim ahead">
          {book ? <PageForm tracker={tracker} book={book} skim /> : <Gone />}
        </Modal>
      ) : (
        <Modal open onClose={close} title="Update page">
          {book ? <LogForm tracker={tracker} book={book} /> : <Gone />}
        </Modal>
      );

    case "bulk":
      return (
        <Modal open onClose={close} title="Add several books">
          <BulkAddForm tracker={tracker} trackId={d.trackId} onClose={close} />
        </Modal>
      );

    case "import":
      return (
        <Modal open onClose={close} title="Import a reading plan" wide>
          <ImportPlanForm tracker={tracker} onClose={close} />
        </Modal>
      );

    case "track": {
      const track = d.trackId ? R.trackOf(s, d.trackId) : undefined;
      return (
        <Modal open onClose={close} title={track ? "Edit track" : "New track"}>
          <TrackForm tracker={tracker} track={track ?? null} onClose={close} />
        </Modal>
      );
    }

    case "phase": {
      const phase = d.phaseId ? s.readingPhases.find((p) => p.id === d.phaseId) : undefined;
      return (
        <Modal open onClose={close} title={phase ? "Edit phase" : "New phase"}>
          <PhaseForm tracker={tracker} phase={phase ?? null} onClose={close} />
        </Modal>
      );
    }
  }
}

/** Shown if a dialog outlives its book — deleted on another device, say. */
function Gone() {
  return <p className="text-[15px] text-[var(--muted)]">This book is no longer on the shelf.</p>;
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}

/**
 * Updates a book to the page you're on. The pages read are the difference
 * from where it stood, shown as the page is typed so a slip is caught before
 * it's saved; that difference is what's logged as today's reading.
 *
 * Two ways out of counting: pages skimmed can be marked as not read, and a
 * page behind the current one is a correction, which moves the book back
 * without logging anything. Entering pages read instead of a page is there
 * for when that's the number to hand.
 */
function LogForm({ tracker, book }: { tracker: Tracker; book: Book }) {
  const { close, replace, checkEnd } = useFlowFromContext();
  const [mode, setMode] = useState<"page" | "pages">("page");
  const [value, setValue] = useState("");
  const [skimmed, setSkimmed] = useState(false);
  const [date, setDate] = useState(dateKey());
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePending();

  const v = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(v) && v >= 0;
  const cap = (n: number) => (book.pages > 0 ? Math.min(n, book.pages) : n);
  const diff = valid && mode === "page" ? cap(v) - book.read : 0;
  const counts = mode === "pages" || (diff > 0 && !skimmed);

  let derived = "";
  if (valid) {
    if (mode === "pages") derived = `Takes you to page ${cap(book.read + v)}`;
    else if (diff > 0) derived = skimmed ? `Moves ahead ${diff} pages, not counted as read` : `${diff} page${diff === 1 ? "" : "s"} read`;
    else if (diff < 0) derived = `Moves back ${-diff} pages — a correction, nothing is logged`;
    else derived = `Already on page ${book.read}`;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;

    // Skimmed, or moved back: the book goes to the page, nothing is logged.
    if (mode === "page" && !counts) {
      if (diff === 0) {
        setError(`Already on page ${book.read}.`);
        return;
      }
      close();
      const ok = await run(() => tracker.setCurrentPage(book.id, v));
      if (ok) checkEnd(book.id);
      return;
    }

    const input: R.LogInput = {
      id: uid(),
      date,
      ...(mode === "page" ? { toPage: v } : { pages: v }),
      minutes: Number(minutes) || undefined,
    };
    const predicted = R.logSession(tracker.state!, book.id, input);
    if (predicted === tracker.state) {
      setError(mode === "page" ? `Already on page ${book.read}.` : "Nothing to log.");
      return;
    }
    const ok = await run(() => tracker.logReading(book.id, input));
    if (!ok) return;
    const logged = predicted.readingSessions.find((x) => x.id === input.id);
    if (logged) replace({ kind: "idea", bookId: book.id, sessionId: logged.id, pages: logged.pages });
    else {
      close();
      checkEnd(book.id);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label={mode === "page" ? "Page you're on" : "Pages read"}>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={mode === "page" && book.pages > 0 ? book.pages : undefined}
          placeholder={mode === "page" ? `Now on ${book.read}${book.pages > 0 ? ` of ${book.pages}` : ""}` : "e.g. 25"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          autoFocus
          className="w-full rd-page-input"
        />
      </Field>
      <p className={"rd-derived" + (valid && counts && (mode === "pages" || diff > 0) ? " is-counted" : "")}>
        {error ? <span style={{ color: "var(--danger)" }}>{error}</span> : derived || "\u00a0"}
      </p>

      {mode === "page" && diff > 0 && (
        <label className="rd-skim">
          <input type="checkbox" checked={skimmed} onChange={(e) => setSkimmed(e.target.checked)} />
          Skimmed — don&apos;t count these pages as read
        </label>
      )}

      {counts && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <input type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value || dateKey())} />
          </Field>
          <Field label="Minutes (optional)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-action"
          onClick={() => {
            setMode(mode === "page" ? "pages" : "page");
            setValue("");
            setSkimmed(false);
            setError(null);
          }}
        >
          {mode === "page" ? "Enter pages read instead" : "Enter the page you're on"}
        </button>
        <span className="flex gap-2">
          <Button variant="outline" onPress={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isDisabled={pending || !valid}>
            Save
          </Button>
        </span>
      </div>
    </form>
  );
}

/** Offered after a sitting is logged: one line on what it was about. Skippable. */
export function IdeaForm({
  tracker,
  sessionId,
  pages,
  bookId,
  inline,
  onDone,
}: {
  tracker: Tracker;
  sessionId: string;
  pages: number;
  bookId: string;
  /** Drawn under a row on Today rather than in a dialog. */
  inline?: boolean;
  onDone?: () => void;
}) {
  const flow = useFlowFromContext();
  const [note, setNote] = useState("");
  const { pending, run } = usePending();
  const done = () => {
    if (onDone) onDone();
    else {
      flow.close();
      flow.checkEnd(bookId);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return done();
    const ok = await run(() => tracker.updateReadingSession(sessionId, { note }));
    if (ok) done();
  };

  if (inline) {
    return (
      <form onSubmit={submit} className="rd-idea">
        <input
          aria-label="Key idea from this session"
          placeholder={`Key idea from these ${pages} pages? (optional)`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit" size="sm" variant="primary" isDisabled={pending || !note.trim()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onPress={done}>
          Skip
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-[15px]">
        Logged {pages} page{pages === 1 ? "" : "s"}. Anything worth keeping from them?
      </p>
      <input
        aria-label="Key idea"
        placeholder="One line (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        autoFocus
        className="w-full"
      />
      <Actions>
        <Button variant="outline" onPress={done}>
          Skip
        </Button>
        <Button type="submit" variant="primary" isDisabled={pending || !note.trim()}>
          Save
        </Button>
      </Actions>
    </form>
  );
}

/** Starting a book in a track that is already at its limit. */
function WipChoice({ tracker, book }: { tracker: Tracker; book: Book }) {
  const { close } = useFlowFromContext();
  const s = tracker.state!;
  const track = R.trackOf(s, book.trackId);
  const open = R.wipBlockers(s, book.id, book.trackId);
  const { pending, run } = usePending();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px]">
        {track?.name} allows {track?.wipLimit === 1 ? "one open book" : `${track?.wipLimit} open books`} at
        a time. To start <span className="font-semibold">{book.title}</span>:
      </p>
      <div className="flex flex-col gap-2">
        {open.map((b) => (
          <Button
            key={b.id}
            variant="primary"
            isDisabled={pending}
            className="w-full justify-start"
            onPress={() => {
              close();
              void run(() =>
                tracker.setBookStatuses([
                  { id: b.id, status: "paused", place: "top" },
                  { id: book.id, status: "active" },
                ])
              );
            }}
          >
            Pause “{b.title}” and start this
          </Button>
        ))}
        <Button
          variant="outline"
          isDisabled={pending}
          className="w-full justify-start"
          onPress={() => {
            close();
            void run(() => tracker.placeInQueue(book.id, "top"));
          }}
        >
          Finish current first — put this next in line
        </Button>
        <Button variant="ghost" className="w-full justify-start" onPress={close}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DropForm({ tracker, book }: { tracker: Tracker; book: Book }) {
  const { close } = useFlowFromContext();
  const [reason, setReason] = useState("");
  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    close();
    await run(() => tracker.setBookStatus(book.id, "dropped", { reason }));
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-[15px]">
        <span className="font-semibold">{book.title}</span> leaves its queue but stays in your history.
      </p>
      <input
        aria-label="Reason"
        placeholder="Reason (optional), e.g. outdated"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
        className="w-full"
      />
      <Actions>
        <Button variant="outline" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" isDisabled={pending}>
          Drop
        </Button>
      </Actions>
    </form>
  );
}

/**
 * Puts a book at a page without counting the pages as read: to correct a
 * mistake, or to jump past chapters that weren't worth reading closely.
 */
function PageForm({ tracker, book, skim }: { tracker: Tracker; book: Book; skim?: boolean }) {
  const { close, checkEnd } = useFlowFromContext();
  const [value, setValue] = useState(String(book.read || ""));
  const { pending, run } = usePending();
  const v = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(v) && v >= 0;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    close();
    const ok = await run(() => tracker.setCurrentPage(book.id, v));
    if (ok) checkEnd(book.id);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">
        {skim
          ? "Jump to the next chapter worth reading. Skimmed pages don't count toward today's target."
          : "Moves the book to this page without logging a session."}
      </p>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={book.pages > 0 ? book.pages : undefined}
        aria-label="Page"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        autoFocus
        className="w-full"
      />
      <p className="text-xs text-[var(--muted)]">
        Now on page {book.read}
        {book.pages > 0 ? ` of ${book.pages}` : ""}.
      </p>
      <Actions>
        <Button variant="outline" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isDisabled={pending || !valid}>
          Set
        </Button>
      </Actions>
    </form>
  );
}

