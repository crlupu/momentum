"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AddButton, Input } from "./ui";
import { Modal } from "./Modal";
import { CardSheet } from "./CardSheet";
import { CalendarEvent, Notes } from "./icons";
import { dateKey, Tracker } from "@/lib/tracker";
import { fmtDateAuto } from "@/lib/dates";
import { COLUMNS, type CardStatus, type Project, type ProjectCard } from "@/lib/projects";

type Cols = Record<CardStatus, string[]>;

const colsOf = (p: Project): Cols => ({
  todo: p.cards.filter((c) => c.status === "todo").map((c) => c.id),
  doing: p.cards.filter((c) => c.status === "doing").map((c) => c.id),
  done: p.cards.filter((c) => c.status === "done").map((c) => c.id),
});

const isColumn = (id: string): id is CardStatus => COLUMNS.some((c) => c.id === id);

/**
 * A project's board: To do, Doing and Done, side by side.
 *
 * Cards are dragged between and within columns. While a drag is under way
 * the board works on its own copy of the columns, so a card can cross into
 * another column and find its place there before anything is written; the
 * arrangement is saved once, when it's dropped. On a phone the columns sit
 * in a row you swipe through, each most of the screen wide, and a card is
 * picked up with a short press so a swipe still scrolls.
 */
export function ProjectBoard({ tracker, project: p }: { tracker: Tracker; project: Project }) {
  const [drag, setDrag] = useState<Cols | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const base = useMemo(() => colsOf(p), [p]);
  const cols = drag ?? base;
  const byId = useMemo(() => new Map(p.cards.map((c) => [c.id, c])), [p.cards]);
  const opened = openId ? byId.get(openId) : undefined;
  const active = activeId ? byId.get(activeId) : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnOf = (id: string, from: Cols): CardStatus | undefined =>
    isColumn(id) ? id : (Object.keys(from) as CardStatus[]).find((k) => from[k].includes(id));

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setDrag(base);
  };

  // Crossing into another column: move the card there now, where the
  // pointer is, so the column opens a gap for it.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    // Over the lower half of a card: the gap opens after it, not before.
    const dragged = active.rect.current.translated;
    const below = !!dragged && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2;
    setDrag((prev) => {
      const now = prev ?? base;
      const from = columnOf(id, now);
      const to = columnOf(overId, now);
      if (!from || !to || from === to) return prev;
      const target = now[to].filter((x) => x !== id);
      const i = target.indexOf(overId);
      const at = isColumn(overId) || i < 0 ? target.length : i + (below ? 1 : 0);
      target.splice(at, 0, id);
      return { ...now, [from]: now[from].filter((x) => x !== id), [to]: target };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const now = drag ?? base;
    setActiveId(null);
    setDrag(null);
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    const col = columnOf(id, now);
    if (!col) return;
    let next = now;
    if (!isColumn(overId) && now[col].includes(overId) && overId !== id) {
      const list = now[col];
      next = { ...now, [col]: arrayMove(list, list.indexOf(id), list.indexOf(overId)) };
    }
    const changed = COLUMNS.some(({ id: k }) => next[k].join() !== base[k].join());
    if (changed) void tracker.arrangeCards(p.id, next);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDrag(null);
        }}
      >
        <div className="board">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              tracker={tracker}
              projectId={p.id}
              status={col.id}
              title={col.title}
              cards={cols[col.id].map((id) => byId.get(id)).filter(Boolean) as ProjectCard[]}
              onOpen={setOpenId}
            />
          ))}
        </div>
        <DragOverlay>{active ? <CardFace card={active} lifted /> : null}</DragOverlay>
      </DndContext>

      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""}>
        {opened && (
          <CardSheet key={opened.id} tracker={tracker} projectId={p.id} card={opened} onClose={() => setOpenId(null)} />
        )}
      </Modal>
    </>
  );
}

function Column({
  tracker,
  projectId,
  status,
  title,
  cards,
  onOpen,
}: {
  tracker: Tracker;
  projectId: string;
  status: CardStatus;
  title: string;
  cards: ProjectCard[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section className={"board-col board-col--" + status} aria-label={title}>
      <header className="board-col__head">
        <h3 className="board-col__title">{title}</h3>
        <span className="board-col__count font-mono-n">{cards.length}</span>
      </header>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className={"board-col__cards" + (isOver ? " is-over" : "")}>
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} onOpen={onOpen} />
          ))}
          {cards.length === 0 && <li className="board-col__empty">Drop cards here</li>}
        </ul>
      </SortableContext>
      <AddCard tracker={tracker} projectId={projectId} status={status} />
    </section>
  );
}

function SortableCard({ card: c, onOpen }: { card: ProjectCard; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "is-placeholder" : undefined}
    >
      <button
        type="button"
        className="board-card"
        onClick={() => onOpen(c.id)}
        {...attributes}
        {...listeners}
        aria-roledescription="card"
      >
        <CardBody card={c} />
      </button>
    </li>
  );
}

/** The card as it follows the pointer while dragged. */
function CardFace({ card, lifted }: { card: ProjectCard; lifted?: boolean }) {
  return (
    <div className={"board-card" + (lifted ? " is-lifted" : "")}>
      <CardBody card={card} />
    </div>
  );
}

function CardBody({ card: c }: { card: ProjectCard }) {
  const today = dateKey();
  const late = c.due && c.status !== "done" && c.due < today;
  const soon = c.due && c.status !== "done" && c.due === today;
  return (
    <>
      <span className={"board-card__title" + (c.status === "done" ? " is-done" : "")}>{c.title}</span>
      {(c.due || c.note) && (
        <span className="board-card__meta">
          {c.due && (
            <span className={"board-card__due" + (late ? " is-late" : soon ? " is-today" : "")}>
              <CalendarEvent aria-hidden />
              {c.due === today ? "Today" : fmtDateAuto(c.due)}
            </span>
          )}
          {c.note && <Notes className="board-card__note" aria-label="Has a note" />}
        </span>
      )}
    </>
  );
}

/** "Add card" at the foot of a column: a button that becomes a field. */
function AddCard({ tracker, projectId, status }: { tracker: Tracker; projectId: string; status: CardStatus }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    // The field stays open and focused, so a list of cards is typed in a row.
    void tracker.addCard(projectId, t, status);
  };

  if (!open) {
    return (
      <div className="board-col__foot">
        <AddButton size="sm" label="Add card" onPress={() => setOpen(true)} />
      </div>
    );
  }
  return (
    <form className="board-col__foot add-step" onSubmit={submit}>
      <Input
        aria-label={`New card in ${COLUMNS.find((c) => c.id === status)!.title}`}
        placeholder="Card name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
        autoFocus
        className="add-step__name"
      />
      <AddButton type="submit" aria-label="Add card" isDisabled={!title.trim()} />
    </form>
  );
}
