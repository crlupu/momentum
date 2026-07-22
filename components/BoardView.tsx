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
import { ChevronLeft, ChevronRight, GripVertical, Plus, X } from "lucide-react";
import { Tracker, BoardStatus, BoardCard } from "@/lib/tracker";

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
        <div className={"flex-1 text-[15px] " + (b.status === "done" ? "text-foreground/45 line-through" : "")}>
          {b.title}
        </div>
      </div>
      <div className="flex items-center gap-2 pl-[22px]">
        <span className="mr-auto">
          <Chip
            size="sm"
            variant="soft"
            className="cursor-pointer"
            onClick={() => tracker.cycleCardCat(b.id)}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
            <Chip.Label className="ml-1.5">{c.name}</Chip.Label>
          </Chip>
        </span>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Move to previous column"
          isDisabled={b.status === "planned"}
          onPress={() => tracker.moveCard(b.id, -1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Move to next column"
          isDisabled={b.status === "done"}
          onPress={() => tracker.moveCard(b.id, 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
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
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((b) => (
              <SortableCard key={b.id} b={b} tracker={tracker} />
            ))}
          </SortableContext>
        </div>

        <form onSubmit={submit} className="mt-1 flex gap-1.5">
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

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeCardId = String(active.id);
    const overId = String(over.id);
    const moving = board.find((b) => b.id === activeCardId);
    if (!moving) return;

    // Resolve the target column.
    let targetStatus: BoardStatus;
    const overCard = board.find((b) => b.id === overId);
    if (overId.startsWith("col:")) targetStatus = overId.slice(4) as BoardStatus;
    else if (overCard) targetStatus = overCard.status;
    else return;

    // Group cards per column, preserving order.
    const cols: Record<BoardStatus, BoardCard[]> = {
      planned: cardsByStatus("planned"),
      progress: cardsByStatus("progress"),
      done: cardsByStatus("done"),
    };
    // Remove the moving card from its current column.
    cols[moving.status] = cols[moving.status].filter((c) => c.id !== activeCardId);
    // Insert into the target column at the hovered position (or end).
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
      onDragStart={onDragStart}
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
