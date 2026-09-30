"use client";

import { Button } from "../ui";
import { Pencil, Play } from "../icons";
import { Tracker, Book } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { Cover } from "./Cover";
import { Meter, ProgressText, StatusBadge, TrackChip, fmtDate, fmtDateAuto, fmtPace } from "./bits";
import { useFlow } from "./flowContext";

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <Cover book={book} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {book.author && <span className="text-sm text-foreground/70">{book.author}</span>}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={book.status} />
            <TrackChip track={track} />
            {phase && <span className="cat-chip">{phase.name}</span>}
            {book.category && <span className="cat-chip">{book.category}</span>}
          </div>
          <Meter book={book} />
          <ProgressText book={book} />
        </div>
      </div>

      <dl className="rd-facts">
        <div>
          <dt>Started</dt>
          <dd>{fmtDateAuto(book.startedDate)}</dd>
        </div>
        {book.status === "finished" || book.status === "dropped" ? (
          <div>
            <dt>{book.status === "finished" ? "Finished" : "Dropped"}</dt>
            <dd>
              {fmtDateAuto(endDate)}
              {taken ? ` · ${taken} day${taken === 1 ? "" : "s"}` : ""}
            </dd>
          </div>
        ) : (
          <div>
            <dt>Pace (14 days)</dt>
            <dd>
              {fmtPace(pace.perDay)} pages/day
              {pace.eta ? ` · done ~${fmtDateAuto(pace.eta)}` : ""}
            </dd>
          </div>
        )}
      </dl>
      {book.dropReason && (
        <p className="text-sm text-foreground/70">Dropped because: {book.dropReason}</p>
      )}
      {prereqs.length > 0 && book.status !== "finished" && (
        <p className="text-xs text-[var(--muted)]">
          Meant to be read after: {prereqs.map((b) => b.title).join(", ")}
        </p>
      )}

      {/* Two actions, laid out like a pop-up's footer: Edit, and the one
          thing to do next with the book where it stands. Pausing and
          dropping are in Edit, as its status; finishing is reaching the
          last page. */}
      <div className="dialog-actions">
        <div className="dialog-actions__side">
          <Button variant="outline" onPress={() => flow.open({ kind: "edit", bookId: book.id })}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
        <div className="dialog-actions__main">
          {book.status === "active" && (
            <Button variant="primary" onPress={() => flow.open({ kind: "log", bookId: book.id })}>
              Update page
            </Button>
          )}
          {(book.status === "queued" || book.status === "paused") && (
            <Button variant="primary" onPress={() => flow.start(book.id)}>
              <Play className="h-4 w-4" /> {book.status === "paused" ? "Resume" : "Start"}
            </Button>
          )}
          {book.status === "finished" && (
            <Button variant="primary" onPress={() => flow.start(book.id)}>
              Reopen
            </Button>
          )}
          {book.status === "dropped" && (
            <Button
              variant="primary"
              onPress={() => void tracker.setBookStatus(book.id, "queued", { place: "end" })}
            >
              Back in the queue
            </Button>
          )}
        </div>
      </div>

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
