"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ChevronRight, ReorderLines } from "../icons";
import { Tracker, dateKey, type Book } from "@/lib/tracker";
import type { TrackerState } from "@/lib/model";
import * as R from "@/lib/reading";
import { StatusBadge, TrackDot, fmtDate, fmtDateAuto } from "./bits";
import { useFlow } from "./flowContext";
import { InsertRow } from "../InsertRow";

/**
 * The plan in blocks. Each phase shows how far through it is, when it will
 * be finished at the pace of the last fortnight, and its books by track.
 */
export function PhasesView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const flow = useFlow();
  const today = dateKey();
  const stats = R.phaseStats(s, today);
  const phases = [...s.readingPhases].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const unassigned = s.books.filter(
    (b) => !b.phaseId && (b.status === "queued" || b.status === "active" || b.status === "paused")
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {phases.length === 0 && (
        <p className="text-[15px] text-[var(--muted)]">
          No phases yet. A phase is a block of the plan, e.g. Q4 2026, holding books from every track.
        </p>
      )}

      {phases.map((p) => (
        <PhaseCard key={p.id} tracker={tracker} phase={p} st={stats.get(p.id)!} today={today} />
      ))}

      <section>
        <h3 className="group-head">{phases.length ? "Later" : "Plan"}</h3>
        <ul className="group-list">
          <li>
            <InsertRow label="New phase" onPress={() => flow.open({ kind: "phase", phaseId: null })} />
          </li>
          {phases.length === 0 && (
            <li>
              <InsertRow label="Import a plan" onPress={() => flow.open({ kind: "import" })} />
            </li>
          )}
        </ul>
        {phases.length > 0 && (
          <p className="group-foot">
            {unassigned > 0
              ? `${unassigned} unfinished book${unassigned === 1 ? " isn't" : "s aren't"} in a phase.`
              : "Every unfinished book is in a phase."}
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * One phase: its dates and aim, time gone against pages read, a verdict in
 * words, each track's standing, and its books by track.
 */
function PhaseCard({
  tracker,
  phase: p,
  st,
  today,
}: {
  tracker: Tracker;
  phase: R.ReadingPhase;
  st: R.PhaseStats;
  today: string;
}) {
  const flow = useFlow();
  const read = Math.round(st.completion * 100);
  const current = p.start <= today && today <= p.end;
  const span = Math.max(1, R.daysBetween(p.start, p.end));
  const time = today < p.start ? 0 : today > p.end ? 100 : Math.round((R.daysBetween(p.start, today) / span) * 100);
  const verdict = phaseVerdict(tracker.state!, p, st, today);

  return (
    <>
    <section className="phase-card">
      <div className="phase-card__head">
        <h2 className="phase-card__name">{p.name}</h2>
        {current && <span className="phase-card__now">Now</span>}
        <span className="flex-1" />
        <button type="button" className="text-action text-action--sm" onClick={() => flow.open({ kind: "phase", phaseId: p.id })}>
          Edit
        </button>
      </div>
      <p className="phase-card__sub">
        {fmtDate(p.start, true)} – {fmtDate(p.end, true)}
        {p.goal ? ` · ${p.goal}` : ""}
      </p>
      <div className="phase-bars">
        <span>Time</span>
        <span className="phase-bars__track" aria-hidden>
          <span className="phase-bars__fill is-time" style={{ width: `${time}%` }} />
        </span>
        <span className="font-mono-n">{time}%</span>
        <span>Read</span>
        <span className="phase-bars__track" aria-hidden>
          <span className="phase-bars__fill" style={{ width: `${read}%` }} />
        </span>
        <span className="font-mono-n">{read}%</span>
      </div>
      {verdict && <p className={"phase-card__verdict " + verdict.tone}>{verdict.text}</p>}
    </section>
    {/* The phase's books, a group per track, outside the card: each track's
        pace sits beside its name. */}
    {st.books.length > 0 && <PhaseBooks tracker={tracker} books={st.books} phase={p} today={today} />}
    </>
  );
}

/**
 * The phase in words, measured the way its tracks are: pages read against an
 * even pace from the phase's first day to its last, so the verdict and each
 * track's "N pages ahead" always agree. The last fortnight's pace only adds
 * a warning when, kept up, it would finish after the phase ends.
 */
function phaseVerdict(s: TrackerState, p: R.ReadingPhase, st: R.PhaseStats, today: string): { tone: string; text: string } | null {
  if (st.flag === "done") return { tone: "is-done", text: "Done." };
  if (st.flag === "unknown" || today < p.start) return null;
  const rows = R.phaseTrackPace(s, p, today);
  const delta = rows.reduce((a, r) => a + r.delta, 0);
  const left = rows.reduce((a, r) => a + (r.planned - r.actual), 0);
  const daysLeft = Math.max(1, R.daysBetween(today, p.end));
  const perDay = Math.ceil(left / daysLeft);
  const n = (v: number) => v.toLocaleString();
  const pages = (v: number) => `${n(Math.abs(v))} page${Math.abs(v) === 1 ? "" : "s"}`;
  if (today > p.end) return { tone: "is-behind", text: `Past its end with ${pages(left)} to go.` };
  const late = st.projected && st.projected > p.end;
  const slowing = late ? ` At the last two weeks\u2019 pace it ends around ${fmtDateAuto(st.projected!)}; ${n(perDay)} pages a day finishes on time.` : "";
  if (delta >= 0) {
    return late
      ? { tone: "is-behind", text: `${delta ? `${pages(delta)} ahead` : "On pace"}, but slowing.${slowing}` }
      : { tone: "is-ahead", text: delta ? `On pace \u00b7 ${pages(delta)} ahead.` : "On pace." };
  }
  return { tone: "is-behind", text: `${pages(delta)} behind. ${n(perDay)} pages a day catches up by ${fmtDateAuto(p.end)}.` };
}

/** A track's standing in the phase: pages ahead of or behind an even pace. */
function paceText(r: ReturnType<typeof R.phaseTrackPace>[number], started: boolean): { text: string; tone: string } {
  const n = (v: number) => v.toLocaleString();
  if (!started) return { text: `${n(r.planned)} pages planned`, tone: "" };
  if (r.delta === 0) return { text: "On pace", tone: "" };
  return {
    text: `${n(Math.abs(r.delta))} page${Math.abs(r.delta) === 1 ? "" : "s"} ${r.delta > 0 ? "ahead" : "behind"}`,
    tone: r.delta > 0 ? " is-ahead" : " is-behind",
  };
}

/**
 * A phase's books, by track, in reading order. "Reorder" turns the rows into
 * handles, as on Tracks: drag a book up or down within its track. Only this
 * phase's books trade places, so the rest of the track's queue stays put.
 */
function PhaseBooks({
  tracker,
  books,
  phase,
  today,
}: {
  tracker: Tracker;
  books: Book[];
  phase: R.ReadingPhase;
  today: string;
}) {
  const s = tracker.state!;
  const [reordering, setReordering] = useState(false);
  const pace = new Map(R.phaseTrackPace(s, phase, today).map((r) => [r.track.id, r]));
  const started = today >= phase.start;
  const groups = s.readingTracks
    .map((t) => ({ t, books: books.filter((b) => b.trackId === t.id).sort((a, b) => a.queueOrder - b.queueOrder) }))
    .filter((x) => x.books.length > 0);
  const canReorder = groups.some((g) => g.books.length > 1);

  return (
    <div className="phase-books">
      {reordering && <p className="phase-books__hint">Drag a book to its new place.</p>}
      <div className="rd-phase__tracks">
        {groups.map(({ t, books: list }, i) => (
          <div key={t.id}>
            <h3 className="group-head flex items-center gap-1.5">
              <TrackDot color={t.color} /> {t.name}
              {pace.get(t.id) && (() => {
                const v = paceText(pace.get(t.id)!, started);
                return <span className={"phase-books__pace" + v.tone}>{v.text}</span>;
              })()}
              {/* Reorder sits with the lists it changes, on the first label. */}
              {i === 0 && canReorder && (
                <button
                  type="button"
                  className="text-action phase-books__reorder"
                  aria-pressed={reordering}
                  onClick={() => setReordering((v) => !v)}
                >
                  {reordering ? "Done" : "Reorder"}
                </button>
              )}
            </h3>
            <TrackList tracker={tracker} books={list} reordering={reordering} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackList({ tracker, books, reordering }: { tracker: Tracker; books: Book[]; reordering: boolean }) {
  // Touch waits a moment before lifting a row, so scrolling past a handle
  // doesn't pick it up.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = books.map((b) => b.id);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void tracker.reorderAmong(arrayMove(ids, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="group-list">
          {books.map((b) => (
            <PhaseBookRow key={b.id} book={b} reordering={reordering} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function PhaseBookRow({ book, reordering }: { book: Book; reordering: boolean }) {
  const flow = useFlow();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: book.id, disabled: !reordering });
  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "rd-row--dragging" : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {reordering ? (
        <div className="rd-phase__book">
          <span className="min-w-0 flex-1 truncate">{book.title}</span>
          <StatusBadge status={book.status} />
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="rd-grip"
            aria-label={`Move ${book.title}`}
            {...attributes}
            {...listeners}
          >
            <ReorderLines className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="rd-phase__book"
          onClick={() => flow.open({ kind: "detail", bookId: book.id })}
        >
          <span className="min-w-0 flex-1 truncate">{book.title}</span>
          <StatusBadge status={book.status} />
          <ChevronRight className="rd-link__chevron" aria-hidden />
        </button>
      )}
    </li>
  );
}
