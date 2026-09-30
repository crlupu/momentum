"use client";

import { FormEvent, useState } from "react";
import { Button } from "../ui";
import { Check, ChevronRight, Clock, Flame, Play, Tune, Warning } from "../icons";
import { usePending } from "../ActionButton";
import { Tracker, Book, dateKey, uid } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { Cover } from "./Cover";
import { Meter, ProgressText, TrackDot, fmtDateAuto, fmtPace } from "./bits";
import { useFlow } from "./flowContext";

/**
 * The day's reading: each track's open books, how much of its target has
 * been read today, and a way to log a sitting without opening anything.
 */
export function TodayView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const tracks = R.liveTracks(s);
  const units = R.readingUnits(s, today);
  const pagesToday = R.pagesOn(s, today);

  if (tracks.length === 0) {
    return <p className="text-[15px] text-[var(--muted)]">No tracks. Add one from Tracks.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--muted)]">
        <span className="font-mono-n text-sm font-bold text-foreground">{pagesToday}</span> pages today
        {units.length > 0 && (
          <>
            {" · "}
            <span className="font-mono-n text-sm font-bold text-foreground">
              {units.filter((u) => u.done).length}
            </span>{" "}
            of {units.length} tracks done
          </>
        )}
      </p>
      <div className="rd-today">
        {tracks.map((t) => (
          <TrackToday key={t.id} tracker={tracker} track={t} today={today} />
        ))}
      </div>
    </div>
  );
}

function TrackToday({
  tracker,
  track,
  today,
}: {
  tracker: Tracker;
  track: R.ReadingTrack;
  today: string;
}) {
  const s = tracker.state!;
  const flow = useFlow();
  const open = R.activeBooks(s, track.id);
  const read = R.pagesOn(s, today, track.id);
  const met = R.trackMet(track, read);
  const streak = R.trackStreak(s, track, today);
  const next = R.nextInQueue(s, track.id);
  const pct = track.dailyTarget > 0 ? Math.min(100, (read / track.dailyTarget) * 100) : 0;

  return (
    <section
      className={"rd-track" + (met ? " rd-track--done" : "")}
      style={{ ["--track" as string]: track.color }}
      aria-label={track.name}
    >
      <header className="rd-track__head">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 font-semibold">
            <TrackDot color={track.color} />
            {track.name}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
            {track.slot && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {track.slot}
              </span>
            )}
            {streak > 0 && (
              <span className="flex items-center gap-1" title="Days in a row the target was met">
                <Flame className="h-3.5 w-3.5" /> {streak} day{streak === 1 ? "" : "s"}
              </span>
            )}
          </span>
        </div>
        {track.dailyTarget > 0 ? (
          <span className={"rd-target" + (met ? " rd-target--done" : "")}>
            {met && <Check className="h-3.5 w-3.5" />}
            <span className="font-mono-n font-bold">{read}</span>
            <span className="opacity-70">/ {track.dailyTarget} pages</span>
          </span>
        ) : (
          <span className="text-xs text-[var(--muted)]">
            {read} pages · no target
          </span>
        )}
      </header>
      {track.dailyTarget > 0 && (
        <div className="rd-track__bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      {open.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="text-sm text-[var(--muted)]">Nothing open.</span>
          {next && (
            <Button size="sm" variant="outline" onPress={() => flow.start(next.id)}>
              <Play className="h-3.5 w-3.5" /> Start {next.title}
            </Button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col">
          {open.map((b) => (
            <OpenBook key={b.id} tracker={tracker} book={b} track={track} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * An open book with its quick update: type the page you're on and the pages
 * since the last update are logged as read. A number with a plus in front,
 * "+25", is taken as pages read instead.
 */
function OpenBook({
  tracker,
  book,
  track,
  today,
}: {
  tracker: Tracker;
  book: Book;
  track: R.ReadingTrack;
  today: string;
}) {
  const s = tracker.state!;
  const flow = useFlow();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePending();
  const pace = R.bookPace(s, book, today);
  const stalled = R.isStalled(s, book, today);
  const last = R.lastProgress(s, book);

  const parsed = (() => {
    const v = value.trim();
    const m = v.match(/^\+\s*(\d+)$/);
    if (m) return { pages: Number(m[1]) };
    if (/^\d+$/.test(v)) return { toPage: Number(v) };
    return null;
  })();

  // What the typed page comes to, before it's saved.
  const preview = (() => {
    if (!parsed) return null;
    if (parsed.pages != null) return parsed.pages > 0 ? `${parsed.pages} pages read` : null;
    const to = book.pages > 0 ? Math.min(parsed.toPage!, book.pages) : parsed.toPage!;
    const d = to - book.read;
    if (d > 0) return `${d} page${d === 1 ? "" : "s"} read`;
    if (d < 0) return `Moves back ${-d} pages — a correction, nothing is logged`;
    return null;
  })();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed || pending) return;
    const input: R.LogInput = { id: uid(), date: today, ...parsed };
    const predicted = R.logSession(s, book.id, input);
    if (predicted === s) {
      setError(parsed.toPage != null ? `Already on page ${book.read}` : "Nothing to log");
      return;
    }
    const ok = await run(() => tracker.logReading(book.id, input));
    if (!ok) return;
    setValue("");
    flow.checkEnd(book.id);
  };

  return (
    <li className="rd-open">
      {/* The whole book is one row that opens it, marked with a chevron. */}
      <button
        type="button"
        className="rd-link"
        onClick={() => flow.open({ kind: "detail", bookId: book.id })}
      >
        <Cover book={book} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 flex-col">
            <span className="book-card__title">{book.title}</span>
            {book.author && <span className="book-card__author">{book.author}</span>}
          </span>
          <Meter book={book} />
          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
            <ProgressText book={book} />
            {pace.perDay > 0 && (
              <span className="text-xs text-[var(--muted)]">
                {fmtPace(pace.perDay)}/day{pace.eta ? ` · done ~${fmtDateAuto(pace.eta)}` : ""}
              </span>
            )}
          </span>
        </span>
        <ChevronRight className="rd-link__chevron" aria-hidden />
      </button>

      <form onSubmit={submit} className="rd-quick">
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          aria-label={`${book.title}: the page you're on (or +pages read)`}
          placeholder="Page you're on"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" isDisabled={pending || !parsed}>
          Update
        </Button>
        <Button
          variant="ghost"
          isIconOnly
          aria-label="Update with details"
          onPress={() => flow.open({ kind: "log", bookId: book.id })}
        >
          <Tune className="h-5 w-5" />
        </Button>
      </form>
      {error ? (
        <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : (
        preview && <p className="rd-derived rd-derived--quick is-counted">{preview}</p>
      )}

      {stalled && (
        <div className="rd-stall" role="status">
          <p className="flex items-center gap-1.5 text-sm">
            <Warning className="h-4 w-4 shrink-0" />
            No progress for {last ? R.daysBetween(last, today) : R.STALL_DAYS} days.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onPress={() => flow.open({ kind: "page", bookId: book.id, skim: true })}>
              Skim to next useful chapter
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => void tracker.setBookStatus(book.id, "paused", { place: "end" })}
            >
              Pause, move later
            </Button>
            <Button size="sm" variant="outline" onPress={() => flow.open({ kind: "drop", bookId: book.id })}>
              Drop
            </Button>
            <Button size="sm" variant="ghost" onPress={() => void tracker.dismissStall(book.id)}>
              Keep going
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
