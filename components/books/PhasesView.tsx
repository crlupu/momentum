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
import { Panel } from "../Panel";
import { Button, AddButton } from "../ui";
import { ChevronRight, ReorderLines } from "../icons";
import { Tracker, dateKey, type Book } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { StatusBadge, TrackDot, fmtDate, fmtDateAuto } from "./bits";
import { useFlow } from "./flowContext";

const FLAG_LABEL: Record<R.PhaseFlag, string> = {
  done: "Done",
  "on-track": "On track",
  "at-risk": "At risk",
  behind: "Behind",
  unknown: "No projection yet" };

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          {phases.length === 0
            ? "No phases yet. A phase is a block of the plan, e.g. Q4 2026, holding books from every track."
            : unassigned > 0
              ? `${unassigned} unfinished book${unassigned === 1 ? " isn't" : "s aren't"} in a phase.`
              : "Every unfinished book is in a phase."}
        </p>
        <span className="flex gap-2">
          {phases.length === 0 && (
            <Button size="sm" variant="ghost" onPress={() => flow.open({ kind: "import" })}>
              Import a plan
            </Button>
          )}
          <AddButton secondary label="New phase" onPress={() => flow.open({ kind: "phase", phaseId: null })} />
        </span>
      </div>

      {phases.map((p) => {
        const st = stats.get(p.id)!;
        const pct = Math.round(st.completion * 100);
        const current = p.start <= today && today <= p.end;
        return (
          <Panel
            key={p.id}
            title={p.name}
            subtitle={`${fmtDate(p.start, true)} – ${fmtDate(p.end, true)}${current ? " · now" : ""}`}
            actions={<span className={`rd-flag rd-flag--${st.flag}`}>{FLAG_LABEL[st.flag]}</span>}
            onEdit={() => flow.open({ kind: "phase", phaseId: p.id })}
            bodyClassName={current ? "rd-phase--current" : undefined}
          >
            {p.goal && <p className="mb-2 max-w-prose text-sm text-foreground/75">{p.goal}</p>}
            <div className="flex items-center gap-2">
              <div className="book-card__meter flex-1" aria-hidden>
                <span style={{ width: `${pct}%`, background: "var(--accent)" }} />
              </div>
              <span className="font-mono-n text-sm font-bold">{pct}%</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {st.finished} of {st.books.length} books finished
              {st.projected &&
                ` · projected ${fmtDateAuto(st.projected)}${st.assumed ? " (at target pace)" : ""}`}
              {st.unsized > 0 &&
                (st.projected
                  ? ` · ${st.unsized} without a page count not projected`
                  : ` · page counts needed for a projection (${st.unsized} missing)`)}
            </p>

            <PaceRows tracker={tracker} phase={p} today={today} />

            {st.books.length > 0 && <PhaseBooks tracker={tracker} books={st.books} />}
          </Panel>
        );
      })}
    </div>
  );
}

/**
 * Each track's standing in the phase: pages ahead of or behind reading the
 * phase's books at an even pace, with the figures it comes from.
 */
function PaceRows({ tracker, phase, today }: { tracker: Tracker; phase: R.ReadingPhase; today: string }) {
  const rows = R.phaseTrackPace(tracker.state!, phase, today);
  if (rows.length === 0) return null;
  const started = today >= phase.start;
  const n = (v: number) => v.toLocaleString();
  return (
    <ul className="pace-list" aria-label="Pages ahead or behind, by track">
      {rows.map((r) => {
        const verdict = !started
          ? `${n(r.planned)} pages planned`
          : r.delta === 0
            ? "On pace"
            : `${n(Math.abs(r.delta))} page${Math.abs(r.delta) === 1 ? "" : "s"} ${r.delta > 0 ? "ahead" : "behind"}`;
        const tone = !started || r.delta === 0 ? "" : r.delta > 0 ? " is-ahead" : " is-behind";
        return (
          <li key={r.track.id} className="pace-row">
            <TrackDot color={r.track.color} />
            <span className="pace-row__text">
              <span className="pace-row__name">{r.track.name}</span>
              <span className="pace-row__sub">
                {started
                  ? `${n(r.actual)} of ${n(r.planned)} · plan ${n(r.expected)}`
                  : `${n(r.actual)} of ${n(r.planned)} read so far`}
                {r.unsized > 0 && ` · ${r.unsized} without a page count`}
              </span>
            </span>
            <span className={"pace-row__verdict" + tone}>{verdict}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A phase's books, by track, in reading order. "Reorder" turns the rows into
 * handles, as on Tracks: drag a book up or down within its track. Only this
 * phase's books trade places, so the rest of the track's queue stays put.
 */
function PhaseBooks({ tracker, books }: { tracker: Tracker; books: Book[] }) {
  const s = tracker.state!;
  const [reordering, setReordering] = useState(false);
  const groups = s.readingTracks
    .map((t) => ({ t, books: books.filter((b) => b.trackId === t.id).sort((a, b) => a.queueOrder - b.queueOrder) }))
    .filter((x) => x.books.length > 0);
  const canReorder = groups.some((g) => g.books.length > 1);

  return (
    <div className="mt-3">
      {canReorder && (
        <div className="rd-sub-row">
          <span className="text-xs text-[var(--muted)]">{reordering ? "Drag a book to its new place" : ""}</span>
          <button
            type="button"
            className="text-action"
            aria-pressed={reordering}
            onClick={() => setReordering((v) => !v)}
          >
            {reordering ? "Done" : "Reorder"}
          </button>
        </div>
      )}
      <div className="rd-phase__tracks">
        {groups.map(({ t, books: list }) => (
          <div key={t.id}>
            <h5 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
              <TrackDot color={t.color} /> {t.name}
            </h5>
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
        <ul className="flex flex-col">
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
