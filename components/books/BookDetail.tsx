"use client";

import { Button } from "../ui";
import { Pencil, Play } from "../icons";
import { Tracker, Book, categoryColor } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { Cover } from "./Cover";
import { Meter, StatusBadge, TrackChip, fmtDate, fmtDateAuto, fmtPace } from "./bits";
import { useFlow } from "./flowContext";
import { RepeatSelect } from "../RepeatSelect";

/** A book's own page: where it stands, what to do with it, and how it got there. */
export function BookDetail({ tracker, book }: { tracker: Tracker; book: Book }) {
  const s = tracker.state!;
  const flow = useFlow();
  const track = R.trackOf(s, book.trackId);
  const phase = s.readingPhases.find((p) => p.id === book.phaseId);
  const pace = R.bookPace(s, book);
  const prereqs = R.unmetPrerequisites(s, book);
  const endDate = book.status === "finished" ? book.doneDate : book.droppedDate;
  const taken =
    book.startedDate && book.status === "finished" && book.doneDate
      ? R.daysBetween(book.startedDate, book.doneDate) + 1
      : null;

  const pct = book.pages > 0 ? Math.round((book.read / book.pages) * 100) : null;
  // The last few sittings, newest first, with the pages each one covered:
  // walked back from the page the book is on now.
  const recent = (() => {
    let at = book.read;
    return [...R.bookSessions(s, book.id)]
      .reverse()
      .map((x) => {
        const to = at;
        at -= x.pages;
        return { ...x, from: Math.max(0, to - x.pages) + 1, to };
      })
      .slice(0, 4);
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="book-head">
        <Cover book={book} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {book.author && <span className="text-[15px] text-[var(--muted)]">{book.author}</span>}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={book.status} />
            <TrackChip track={track} />
            {phase && <span className="cat-chip">{phase.name}</span>}
          </div>
        </div>
      </div>

      {/* Where it stands, and the one thing to do next with it. */}
      <div className="book-progress">
        <div className="book-progress__line">
          <span className="book-progress__page">Page {book.read}</span>
          {book.pages > 0 && <span className="book-progress__of">of {book.pages}</span>}
          <span className="flex-1" />
          {pct != null && <span className="book-progress__pct font-mono-n">{pct}%</span>}
        </div>
        <Meter book={book} />
        {book.status === "active" && pace.perDay > 0 && (
          <p className="book-progress__pace">
            About {fmtPace(pace.perDay)} pages a day{pace.eta ? ` · done around ${fmtDateAuto(pace.eta)}` : ""}
          </p>
        )}
        {(book.status === "finished" || book.status === "dropped") && (
          <p className="book-progress__pace">
            {book.status === "finished" ? "Finished" : "Dropped"} {fmtDateAuto(endDate)}
            {taken ? ` · ${taken} day${taken === 1 ? "" : "s"}` : ""}
          </p>
        )}
        {book.status === "active" && (
          <Button variant="primary" className="w-full justify-center" onPress={() => flow.open({ kind: "log", bookId: book.id })}>
            Update page
          </Button>
        )}
        {(book.status === "queued" || book.status === "paused") && (
          <Button variant="primary" className="w-full justify-center" onPress={() => flow.start(book.id)}>
            <Play className="h-4 w-4" /> {book.status === "paused" ? "Resume" : "Start"}
          </Button>
        )}
        {book.status === "finished" && (
          <Button variant="primary" className="w-full justify-center" onPress={() => flow.start(book.id)}>
            Reopen
          </Button>
        )}
        {book.status === "dropped" && (
          <Button
            variant="primary"
            className="w-full justify-center"
            onPress={() => void tracker.setBookStatus(book.id, "queued", { place: "end" })}
          >
            Back in the queue
          </Button>
        )}
      </div>

      {recent.length > 0 && (
        <section>
          <h3 className="group-head">Recent reading</h3>
          <ul className="group-list">
            {recent.map((x) => (
              <li key={x.id} className="group-row">
                <span className="flex-1">{fmtDateAuto(x.date)}</span>
                <span className="group-row__value font-mono-n">
                  pp. {x.from}–{x.to} · {x.pages}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="group-head">Details</h3>
        <div className="group-list">
          {/* How often it comes round in Recurring on Today while it's being read. */}
          <div className="group-row">
            <span className="flex-1">Repeat</span>
            <RepeatSelect tracker={tracker} kind="book" item={book} inline />
          </div>
          <div className="group-row">
            <span className="flex-1">Started</span>
            <span className="group-row__value">{fmtDateAuto(book.startedDate)}</span>
          </div>
          {book.category && (
            <div className="group-row">
              <span className="flex-1">Category</span>
              <span className="group-row__value">
                <span className="cat-dot" style={{ background: categoryColor(book.category) }} aria-hidden /> {book.category}
              </span>
            </div>
          )}
        </div>
      </section>
      {book.dropReason && (
        <p className="text-sm text-foreground/70">Dropped because: {book.dropReason}</p>
      )}
      {prereqs.length > 0 && book.status !== "finished" && (
        <p className="text-xs text-[var(--muted)]">
          Meant to be read after: {prereqs.map((b) => b.title).join(", ")}
        </p>
      )}

      <Button variant="outline" className="self-start" onPress={() => flow.open({ kind: "edit", bookId: book.id })}>
        <Pencil className="h-4 w-4" /> Edit book
      </Button>

      {(book.statusLog ?? []).length > 0 && (
        <ol className="flex flex-col gap-1 text-sm">
          {[...(book.statusLog ?? [])].reverse().map((c, i) => (
            <li
              key={i}
              className="flex justify-between gap-2 border-b border-[var(--separator)] py-1.5"
            >
              <span>{R.STATUS_LABEL[c.status]}</span>
              <span className="text-[var(--muted)]">{fmtDate(c.date, true)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
