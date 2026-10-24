"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../ui";
import { Modal } from "../Modal";
import { usePending } from "../ActionButton";
import { DialogActions } from "../DialogActions";
import { Tracker, dateKey, uid, type Book } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { FlowContext, useFlow as useFlowFromContext, type Dialog, type Flow } from "./flowContext";
import { BookDetail } from "./BookDetail";
import { BookForm } from "./BookForm";
import { BulkAddForm, ImportPlanForm, PhaseForm, TrackForm } from "./forms";
import { Minus, Plus } from "../icons";

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
          <DialogActions
            primary={{
              label: "Start anyway",
              onPress: () => {
                close();
                flow.startAnyway(d.bookId);
              },
            }}
          />
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
          <DialogActions
            primary={{
              label: "Mark finished",
              onPress: () => {
                close();
                if (book) void flow.finish(book.id);
              },
            }}
          />
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
          <DialogActions
            primary={{
              label: "Start",
              disabled: !book,
              onPress: () => {
                close();
                if (book) flow.start(book.id);
              },
            }}
          />
        </Modal>
      );
    }

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

/** Pages to jump ahead by, one tap each. */
const JUMPS = [5, 15, 20, 30];

/**
 * The page you're on, and nothing else: the current page to start from,
 * − and + to nudge it, a few jumps ahead in one tap, and Save. Pages since
 * the last update are logged as read today; a page behind the current one
 * corrects it, without logging anything.
 */
function LogForm({ tracker, book }: { tracker: Tracker; book: Book }) {
  const { close, checkEnd } = useFlowFromContext();
  const [value, setValue] = useState(String(book.read));
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePending();

  const cap = (n: number) => Math.max(0, book.pages > 0 ? Math.min(n, book.pages) : n);
  const v = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(v) && v >= 0;
  const page = valid ? cap(v) : book.read;
  const diff = page - book.read;
  const set = (n: number) => {
    setValue(String(cap(n)));
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    if (page === book.read) {
      setError(`Already on page ${book.read}.`);
      return;
    }
    close();
    const ok = await run(() =>
      page > book.read
        ? tracker.logReading(book.id, { id: uid(), date: dateKey(), toPage: page })
        : tracker.setCurrentPage(book.id, page)
    );
    if (ok) checkEnd(book.id);
  };

  return (
    <form onSubmit={submit} className="log-sheet">
      <p className="log-sheet__book">{book.title}</p>
      <div className="log-sheet__dial">
        <button type="button" className="log-sheet__step" aria-label="One page back" onClick={() => set(page - 1)}>
          <Minus aria-hidden />
        </button>
        <label className="log-sheet__field">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={book.pages > 0 ? book.pages : undefined}
            aria-label="Page you're on"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onFocus={(e) => e.currentTarget.select()}
            className="log-sheet__input"
          />
          <span className="log-sheet__of">
            {book.pages > 0 ? `of ${book.pages} · ` : ""}was {book.read}
          </span>
        </label>
        <button type="button" className="log-sheet__step" aria-label="One page forward" onClick={() => set(page + 1)}>
          <Plus aria-hidden />
        </button>
      </div>
      <div className="log-sheet__jumps">
        {JUMPS.map((n) => (
          <button key={n} type="button" className="log-sheet__jump" onClick={() => set(book.read + n)}>
            +{n}
          </button>
        ))}
      </div>
      <p className={"log-sheet__note" + (diff > 0 ? " is-up" : "")} aria-live="polite">
        {error ??
          (diff > 0
            ? `+${diff} page${diff === 1 ? "" : "s"}${book.pages > 0 ? ` · ${Math.round((page / book.pages) * 100)}%` : ""}`
            : diff < 0
              ? `Back ${-diff} page${diff === -1 ? "" : "s"}: a correction, nothing is logged`
              : "\u00a0")}
      </p>
      <DialogActions primary={{ label: "Save", disabled: pending || !valid || diff === 0 }} />
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
            variant="outline"
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
      </div>
    </div>
  );
}

