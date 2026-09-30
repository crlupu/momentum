"use client";

import { FormEvent, useState } from "react";
import { Button } from "../ui";
import { Check, Pause, Pencil, Play, Quote, Lightbulb, X } from "../icons";
import { DeleteButton } from "../DeleteButton";
import { usePending } from "../ActionButton";
import { Tracker, Book, dateKey } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { Cover } from "./Cover";
import {
  Field,
  Meter,
  ProgressText,
  Segmented,
  StatusBadge,
  TrackChip,
  fmtDate,
  fmtDateAuto,
  fmtPace,
} from "./bits";
import { useFlow } from "./flowContext";

/** A book's own page: where it stands, what to do with it, and everything logged. */
export function BookDetail({ tracker, book }: { tracker: Tracker; book: Book }) {
  const s = tracker.state!;
  const flow = useFlow();
  const track = R.trackOf(s, book.trackId);
  const phase = s.readingPhases.find((p) => p.id === book.phaseId);
  const [tab, setTab] = useState<"sessions" | "notes" | "timeline">("sessions");
  const pace = R.bookPace(s, book);
  const speed = R.readingSpeed(s, book.id);
  const sessions = R.bookSessions(s, book.id);
  const prereqs = R.unmetPrerequisites(s, book);
  const endDate = book.status === "finished" ? book.doneDate : book.droppedDate;
  const taken =
    book.startedDate && book.status === "finished" && book.doneDate
      ? R.daysBetween(book.startedDate, book.doneDate) + 1
      : null;

  const meta = [
    book.category,
    book.edition && `${book.edition} edition`,
    book.language,
    ...(book.tags ?? []),
  ].filter(Boolean);

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
          </div>
          {meta.length > 0 && (
            <span className="text-xs text-[var(--muted)]">{meta.join(" · ")}</span>
          )}
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
        {speed != null && (
          <div>
            <dt>Speed</dt>
            <dd>{Math.round(speed)} pages/hour</dd>
          </div>
        )}
      </dl>
      {book.note && book.status !== "dropped" && (
        <p className="text-sm text-foreground/75">
          <span className="text-[var(--muted)]">Note: </span>
          {book.note}
        </p>
      )}
      {book.dropReason && (
        <p className="text-sm text-foreground/70">Dropped because: {book.dropReason}</p>
      )}
      {prereqs.length > 0 && book.status !== "finished" && (
        <p className="text-xs text-[var(--muted)]">
          Meant to be read after: {prereqs.map((b) => b.title).join(", ")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {book.status === "active" && (
          <>
            <Button
              size="sm"
              variant="primary"
              onPress={() => flow.open({ kind: "log", bookId: book.id })}
            >
              Update page
            </Button>
            <Button size="sm" variant="outline" onPress={() => void flow.finish(book.id)}>
              <Check className="h-3.5 w-3.5" /> Finish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => void tracker.setBookStatus(book.id, "paused", { place: "top" })}
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          </>
        )}
        {(book.status === "queued" || book.status === "paused") && (
          <Button size="sm" variant="primary" onPress={() => flow.start(book.id)}>
            <Play className="h-3.5 w-3.5" /> {book.status === "paused" ? "Resume" : "Start"}
          </Button>
        )}
        {book.status === "finished" && (
          <Button size="sm" variant="outline" onPress={() => flow.start(book.id)}>
            Reopen
          </Button>
        )}
        {book.status === "dropped" && (
          <Button
            size="sm"
            variant="outline"
            onPress={() => void tracker.setBookStatus(book.id, "queued", { place: "end" })}
          >
            Back to the queue
          </Button>
        )}
        {book.status !== "finished" && book.status !== "dropped" && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => flow.open({ kind: "drop", bookId: book.id })}
          >
            Drop
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onPress={() => flow.open({ kind: "edit", bookId: book.id })}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </div>

      <Segmented
        label="Show"
        size="sm"
        value={tab}
        onChange={setTab}
        options={[
          { value: "sessions", label: `Sessions (${sessions.length})` },
          { value: "notes", label: "Notes & quotes" },
          { value: "timeline", label: "Timeline" },
        ]}
      />

      {tab === "sessions" && <Sessions tracker={tracker} sessions={sessions} />}
      {tab === "notes" && <Notes tracker={tracker} book={book} />}
      {tab === "timeline" && (
        <ol className="flex flex-col gap-1 text-sm">
          {(book.statusLog ?? []).length === 0 && (
            <li className="text-[var(--muted)]">Nothing yet.</li>
          )}
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

/** Every sitting, newest first, each editable. Editing one moves the book's page. */
function Sessions({ tracker, sessions }: { tracker: Tracker; sessions: R.ReadingSession[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  // The latest ten; a book read over months has a long log behind it.
  const [all, setAll] = useState(false);
  if (sessions.length === 0)
    return <p className="text-sm text-[var(--muted)]">No sessions logged yet.</p>;
  const newest = [...sessions].reverse();
  const shown = all ? newest : newest.slice(0, 10);
  return (
    <>
      <ul className="flex flex-col">
        {shown.map((x) =>
          editing === x.id ? (
            <li key={x.id} className="border-b border-[var(--separator)] py-2">
              <SessionEdit tracker={tracker} session={x} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={x.id}
              className="flex items-start gap-2 border-b border-[var(--separator)] py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-mono-n font-bold">{x.pages}</span> pages
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {fmtDateAuto(x.date)}
                    {x.minutes ? ` · ${x.minutes} min` : ""}
                  </span>
                </div>
                {x.note && <p className="mt-0.5 text-sm text-foreground/75">{x.note}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label="Edit session"
                onPress={() => setEditing(x.id)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <DeleteButton
                what={`the ${x.pages}-page session on ${fmtDate(x.date)}`}
                bare
                iconOnly
                onDelete={() => tracker.removeReadingSession(x.id)}
              />
            </li>
          ),
        )}
      </ul>
      {newest.length > shown.length && (
        <Button size="sm" variant="ghost" className="mt-1 self-start" onPress={() => setAll(true)}>
          Show all {newest.length}
        </Button>
      )}
    </>
  );
}

function SessionEdit({
  tracker,
  session,
  onDone,
}: {
  tracker: Tracker;
  session: R.ReadingSession;
  onDone: () => void;
}) {
  const [date, setDate] = useState(session.date);
  const [pages, setPages] = useState(String(session.pages));
  const [minutes, setMinutes] = useState(session.minutes ? String(session.minutes) : "");
  const [note, setNote] = useState(session.note ?? "");
  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = Number(pages);
    if (!Number.isFinite(p) || p <= 0 || pending) return;
    onDone();
    await run(() =>
      tracker.updateReadingSession(session.id, {
        date,
        pages: p,
        minutes: Number(minutes) || null,
        note: note || null,
      }),
    );
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Date">
          <input
            type="date"
            value={date}
            max={dateKey()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Pages">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
          />
        </Field>
        <Field label="Minutes">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
      </div>
      <input
        aria-label="Key idea"
        placeholder="Key idea"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full"
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onPress={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" variant="primary" isDisabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

/** Key ideas from sessions and saved quotes, oldest first, with a way to add a quote. */
function Notes({ tracker, book }: { tracker: Tracker; book: Book }) {
  const s = tracker.state!;
  const [text, setText] = useState("");
  const [page, setPage] = useState("");
  const { pending, run } = usePending();

  const items = [
    ...s.readingSessions
      .filter((x) => x.bookId === book.id && x.note)
      .map((x) => ({
        kind: "idea" as const,
        id: x.id,
        date: x.date,
        at: x.at,
        text: x.note!,
        page: undefined,
      })),
    ...s.bookQuotes
      .filter((q) => q.bookId === book.id)
      .map((q) => ({
        kind: "quote" as const,
        id: q.id,
        date: q.date,
        at: q.at,
        text: q.text,
        page: q.page,
      })),
  ].sort((a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || pending) return;
    const ok = await run(() => tracker.addQuote(book.id, text, Number(page) || undefined));
    if (ok) {
      setText("");
      setPage("");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          No notes yet. Key ideas written after a session, and quotes saved here, collect in this
          list.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((n) => (
          <li key={n.id} className={"rd-note" + (n.kind === "quote" ? " rd-note--quote" : "")}>
            <span className="rd-note__icon" aria-hidden>
              {n.kind === "quote" ? (
                <Quote className="h-4 w-4" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{n.text}</p>
              <p className="text-xs text-[var(--muted)]">
                {fmtDateAuto(n.date)}
                {n.page ? ` · p. ${n.page}` : ""}
              </p>
            </div>
            {n.kind === "quote" ? (
              <DeleteButton
                what="this quote"
                bare
                iconOnly
                onDelete={() => tracker.removeQuote(n.id)}
              />
            ) : (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label="Remove key idea"
                onPress={() => void tracker.updateReadingSession(n.id, { note: null })}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          aria-label="Quote"
          rows={2}
          placeholder="Save a quote…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full"
        />
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            aria-label="Page"
            placeholder="Page"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className="w-24"
          />
          <Button type="submit" size="sm" variant="outline" isDisabled={pending || !text.trim()}>
            <Quote className="h-3.5 w-3.5" /> Save quote
          </Button>
        </div>
      </form>
    </div>
  );
}
