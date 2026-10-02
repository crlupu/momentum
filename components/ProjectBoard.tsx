"use client";

import { useMemo, useState } from "react";
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
import { AddButton } from "./ui";
import { Modal } from "./Modal";
import { CardSheet, NewCardForm } from "./CardSheet";
import { TagChip } from "./TagPicker";
import { CalendarEvent, Notes } from "./icons";
import { dateKey, Tracker } from "@/lib/tracker";
import { fmtDateAuto } from "@/lib/dates";
import { COLUMNS, cardTags, type CardStatus, type Project, type ProjectCard } from "@/lib/projects";

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
  const [adding, setAdding] = useState<CardStatus | null>(null);

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
              project={p}
              status={col.id}
              title={col.title}
              cards={cols[col.id].map((id) => byId.get(id)).filter(Boolean) as ProjectCard[]}
              onOpen={setOpenId}
              onAdd={() => setAdding(col.id)}
            />
          ))}
        </div>
        <DragOverlay>{active ? <CardFace project={p} card={active} lifted /> : null}</DragOverlay>
      </DndContext>

      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""}>
        {opened && (
          <CardSheet key={opened.id} tracker={tracker} project={p} card={opened} onClose={() => setOpenId(null)} />
        )}
      </Modal>

      <Modal
        open={!!adding}
        onClose={() => setAdding(null)}
        title={adding ? `New card in ${COLUMNS.find((c) => c.id === adding)!.title}` : ""}
      >
        {adding && (
          <NewCardForm key={adding} tracker={tracker} project={p} status={adding} onDone={() => setAdding(null)} />
        )}
      </Modal>
    </>
  );
}

function Column({
  project,
  status,
  title,
  cards,
  onOpen,
  onAdd,
}: {
  project: Project;
  status: CardStatus;
  title: string;
  cards: ProjectCard[];
  onOpen: (id: string) => void;
  onAdd: () => void;
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
            <SortableCard key={c.id} project={project} card={c} onOpen={onOpen} />
          ))}
          {cards.length === 0 && <li className="board-col__empty">Drop cards here</li>}
        </ul>
      </SortableContext>
      <div className="board-col__foot">
        <AddButton size="sm" secondary label="Add card" onPress={onAdd} />
      </div>
    </section>
  );
}

function SortableCard({
  project,
  card: c,
  onOpen,
}: {
  project: Project;
  card: ProjectCard;
  onOpen: (id: string) => void;
}) {
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
        aria-label={c.title}
      >
        <CardBody project={project} card={c} />
      </button>
    </li>
  );
}

/** The card as it follows the pointer while dragged. */
function CardFace({ project, card, lifted }: { project: Project; card: ProjectCard; lifted?: boolean }) {
  return (
    <div className={"board-card" + (lifted ? " is-lifted" : "")}>
      <CardBody project={project} card={card} />
    </div>
  );
}

function CardBody({ project, card: c }: { project: Project; card: ProjectCard }) {
  const today = dateKey();
  const late = c.due && c.status !== "done" && c.due < today;
  const soon = c.due && c.status !== "done" && c.due === today;
  const tags = cardTags(project, c);
  return (
    <>
      {tags.length > 0 && (
        <span className="board-card__tags">
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </span>
      )}
      <span className={"board-card__title" + (c.status === "done" ? " is-done" : "")}>{c.title}</span>
      {(c.due || c.note) && (
        <span className="board-card__meta">
          {c.due && (
            <span className={"board-card__due" + (late ? " is-late" : soon ? " is-today" : "")}>
              <CalendarEvent aria-hidden />
              {c.due === today ? "Today" : fmtDateAuto(c.due)}
            </span>
          )}
          {c.note && <Notes className="board-card__note" aria-label="Has a description" />}
        </span>
      )}
    </>
  );
}
