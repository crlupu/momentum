"use client";

import { FormEvent, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card, Chip, Input } from "@heroui/react";
import { Check, GripVertical, Plus, Repeat, RotateCcw, X } from "lucide-react";
import { Tracker, BoardStatus, BoardCard, FREQ_LABEL, FREQ_ORDER } from "@/lib/tracker";

const COLUMNS: { status: BoardStatus; label: string }[] = [
  { status: "planned", label: "Planned" },
  { status: "progress", label: "In progress" },
  { status: "done", label: "Done" },
];

function CardBody({
  b,
  tracker,
  dragging,
  handleProps,
}: {
  b: BoardCard;
  tracker: Tracker;
  dragging?: boolean;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const c = tracker.cat(b.catId);
  const freq = tracker.freqOf(b);
  const done = b.status === "done";
  return (
    <div
      className={
        "rounded-lg border border-foreground/10 bg-card p-3 shadow-sm " +
        (dragging ? "opacity-90 shadow-lg ring-2 ring-primary/40" : "")
      }
    >
      <div className="mb-2 flex items-start gap-1.5">
        <button
          aria-label="Drag to move"
          className="mt-0.5 cursor-grab touch-none text-foreground/30 hover:text-foreground/60 active:cursor-grabbing"
          {...handleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className={"flex-1 text-[15px] " + (done ? "text-foreground/45 line-through" : "")}>
          {b.title}
        </div>
      </div>
      <div className="flex items-center gap-2 pl-[22px]">
        <Chip
          size="sm"
          variant="soft"
          className="mr-auto cursor-pointer"
          onClick={() => tracker.cycleCardCat(b.id)}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
          <Chip.Label className="ml-1.5">{c.name}</Chip.Label>
        </Chip>
        {freq && (
          <span className="flex items-center gap-1 text-[11px] text-foreground/50">
            <Repeat className="h-3 w-3" />
            {FREQ_LABEL[freq]}
          </span>
        )}
        {done ? (
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            aria-label="Reopen (mark not done)"
            onPress={() => tracker.setCardStatus(b.id, "progress")}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            isIconOnly
            aria-label="Mark done"
            onPress={() => tracker.setCardStatus(b.id, "done")}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label="Delete card"
          onPress={() => tracker.deleteCard(b.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SortableCard({ b, tracker }: { b: BoardCard; tracker: Tracker }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: b.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="mb-2.5"
    >
      <CardBody b={b} tracker={tracker} handleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
      {children}
    </div>
  );
}

function Column({
  status,
  label,
  cards,
  tracker,
}: {
  status: BoardStatus;
  label: string;
  cards: BoardCard[];
  tracker: Tracker;
}) {
  const [title, setTitle] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    tracker.addCard(t, status);
    setTitle("");
  };

  // In progress splits into recurring (sorted by frequency) then other tasks.
  let ordered = cards;
  let split: { recurring: BoardCard[]; other: BoardCard[] } | null = null;
  if (status === "progress") {
    const recurring = cards
      .filter((c) => tracker.freqOf(c) !== null)
      .sort((a, b) => FREQ_ORDER[tracker.freqOf(a)!] - FREQ_ORDER[tracker.freqOf(b)!]);
    const other = cards.filter((c) => tracker.freqOf(c) === null);
    split = { recurring, other };
    ordered = [...recurring, ...other];
  }

  return (
    <Card className={isOver ? "ring-2 ring-primary/40" : ""}>
      <Card.Content className="p-3.5">
        <h3 className="font-display mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-foreground/60">
          {label}
          <span className="font-mono-n" style={{ color: "#F5A524" }}>
            {cards.length}
          </span>
        </h3>

        <div ref={setNodeRef} className="min-h-[8px]">
          <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {split ? (
              <>
                <SubHeader>Recurring</SubHeader>
                {split.recurring.length === 0 ? (
                  <p className="mb-2 px-1 text-xs text-foreground/40">Nothing recurring here.</p>
                ) : (
                  split.recurring.map((b) => <SortableCard key={b.id} b={b} tracker={tracker} />)
                )}
                <div className="my-3 h-px bg-foreground/10" />
                <SubHeader>Other</SubHeader>
                {split.other.length === 0 ? (
                  <p className="mb-2 px-1 text-xs text-foreground/40">No other tasks.</p>
                ) : (
                  split.other.map((b) => <SortableCard key={b.id} b={b} tracker={tracker} />)
                )}
              </>
            ) : (
              ordered.map((b) => <SortableCard key={b.id} b={b} tracker={tracker} />)
            )}
          </SortableContext>
        </div>

        <form onSubmit={submit} className="mt-2 flex gap-1.5">
          <Input
            aria-label={`Add card to ${label}`}
            placeholder="Add…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" isIconOnly aria-label="Add card">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </Card.Content>
    </Card>
  );
}

export default function BoardView({ tracker }: { tracker: Tracker }) {
  const board = tracker.state!.board;
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const cardsByStatus = (st: BoardStatus) => board.filter((b) => b.status === st);
  const activeCard = board.find((b) => b.id === activeId) ?? null;

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeCardId = String(active.id);
    const overId = String(over.id);
    const moving = board.find((b) => b.id === activeCardId);
    if (!moving) return;

    let targetStatus: BoardStatus;
    const overCard = board.find((b) => b.id === overId);
    if (overId.startsWith("col:")) targetStatus = overId.slice(4) as BoardStatus;
    else if (overCard) targetStatus = overCard.status;
    else return;

    const cols: Record<BoardStatus, BoardCard[]> = {
      planned: cardsByStatus("planned"),
      progress: cardsByStatus("progress"),
      done: cardsByStatus("done"),
    };
    cols[moving.status] = cols[moving.status].filter((c) => c.id !== activeCardId);
    const target = cols[targetStatus];
    let index = target.length;
    if (overCard && overCard.id !== activeCardId) {
      const i = target.findIndex((c) => c.id === overCard.id);
      if (i >= 0) index = i;
    }
    target.splice(index, 0, { ...moving, status: targetStatus });

    tracker.setBoard([...cols.planned, ...cols.progress, ...cols.done]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-3.5 md:grid-cols-3">
        {COLUMNS.map((c) => (
          <Column
            key={c.status}
            status={c.status}
            label={c.label}
            cards={cardsByStatus(c.status)}
            tracker={tracker}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <CardBody b={activeCard} tracker={tracker} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
