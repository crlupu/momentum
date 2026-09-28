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
  type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, AddButton } from "../ui";
import { ChevronDown, ChevronRight, GripVertical, Play, Settings, Unarchive } from "../icons";
import { Tracker, Book } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { Cover } from "./Cover";
import { Meter, ProgressText, StatusBadge, TrackDot } from "./bits";
import { useFlow } from "./flowContext";

/** How many of the queue show before the rest fold away under "Later". */
const UP_NEXT = 3;

/** Every track: what is open, what is next, and the rest of the queue. */
export function TracksView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const flow = useFlow();
  const live = R.liveTracks(s);
  const archived = s.readingTracks.filter((t) => t.archived);

  return (
    <div className="flex flex-col gap-4">
      <div className="rd-tracks">
        {live.map((t) => (
          <TrackQueue key={t.id} tracker={tracker} track={t} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AddButton label="New track" onPress={() => flow.open({ kind: "track", trackId: null })} />
      </div>
      {archived.length > 0 && (
        <div>
          <h4 className="group-label mb-1">
            Archived tracks
          </h4>
          <ul className="flex flex-col">
            {archived.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 border-b border-[var(--separator)] py-1.5">
                <span className="flex items-center gap-2 text-sm">
                  <TrackDot color={t.color} /> {t.name}
                  <span className="text-[var(--muted)]">
                    · {s.books.filter((b) => b.trackId === t.id).length} books
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => void tracker.updateTrack(t.id, { ...t, archived: false })}
                >
                  <Unarchive className="h-4 w-4" /> Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrackQueue({ tracker, track }: { tracker: Tracker; track: R.ReadingTrack }) {
  const s = tracker.state!;
  const flow = useFlow();
  const open = R.activeBooks(s, track.id);
  const queue = R.trackQueue(s, track.id);
  const [showLater, setShowLater] = useState(false);
  const shown = showLater ? queue : queue.slice(0, UP_NEXT);
  const later = queue.length - UP_NEXT;

  // Mouse and touch apart, so touch can have a short hold before a row lifts:
  // a finger scrolling the page past a handle shouldn't pick the row up.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = queue.map((b) => b.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void tracker.reorderQueue(track.id, arrayMove(ids, from, to));
  };

  return (
    <section className="rd-track" style={{ ["--track" as string]: track.color }} aria-label={track.name}>
      <header className="rd-track__head">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 font-semibold">
            <TrackDot color={track.color} />
            {track.name}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {open.length} of {track.wipLimit} open
            {track.dailyTarget > 0 ? ` · ${track.dailyTarget} pages a day` : ""}
            {track.slot ? ` · ${track.slot}` : ""}
          </span>
        </div>
        <span className="flex items-center gap-1">
          <AddButton
            size="sm"
            aria-label={`Add a book to ${track.name}`}
            onPress={() => flow.open({ kind: "edit", bookId: null, trackId: track.id })}
          />
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label={`${track.name} settings`}
            onPress={() => flow.open({ kind: "track", trackId: track.id })}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </span>
      </header>

      <h4 className="rd-sub">Reading</h4>
      {open.length === 0 ? (
        <p className="py-1 text-sm text-[var(--muted)]">Nothing open.</p>
      ) : (
        <ul className="flex flex-col">
          {open.map((b) => (
            <li key={b.id} className="rd-row">
              <button type="button" className="book-card__open" onClick={() => flow.open({ kind: "detail", bookId: b.id })} aria-label={`Open ${b.title}`}>
                <Cover book={b} size="sm" />
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <RowTitle book={b} />
                <Meter book={b} />
                <ProgressText book={b} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h4 className="rd-sub">Up next</h4>
      {queue.length === 0 ? (
        <p className="py-1 text-sm text-[var(--muted)]">The queue is empty.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col">
              {shown.map((b, i) => (
                <QueueRow key={b.id} book={b} first={i === 0} divider={showLater && i === UP_NEXT} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {later > 0 && (
        <button type="button" className="rd-later" onClick={() => setShowLater(!showLater)} aria-expanded={showLater}>
          {showLater ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {showLater ? "Hide later" : `Later (${later} more)`}
        </button>
      )}
    </section>
  );
}

function RowTitle({ book }: { book: Book }) {
  const flow = useFlow();
  return (
    <button type="button" className="book-card__title-btn" onClick={() => flow.open({ kind: "detail", bookId: book.id })}>
      <span className="book-card__title">{book.title}</span>
      {book.author && <span className="book-card__author">{book.author}</span>}
    </button>
  );
}

/** A waiting book, draggable by its handle into a new place in the queue. */
function QueueRow({ book, first, divider }: { book: Book; first: boolean; divider: boolean }) {
  const flow = useFlow();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: book.id });

  return (
    <li
      ref={setNodeRef}
      className={"rd-row rd-row--queue" + (isDragging ? " rd-row--dragging" : "") + (divider ? " rd-row--later" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="rd-grip"
        aria-label={`Move ${book.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <RowTitle book={book} />
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
          {book.status === "paused" && <StatusBadge status="paused" />}
          {book.status === "paused" && book.read > 0 && <span>page {book.read}</span>}
          {book.pages > 0 && <span>{book.pages} pages</span>}
          {book.note && <span className="truncate italic">{book.note}</span>}
        </span>
      </div>
      <Button
        size="sm"
        variant={first ? "outline" : "ghost"}
        isIconOnly
        aria-label={`${book.status === "paused" ? "Resume" : "Start"} ${book.title}`}
        onPress={() => flow.start(book.id)}
      >
        <Play className="h-4 w-4" />
      </Button>
    </li>
  );
}
