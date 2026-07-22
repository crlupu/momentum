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
import { Check, GripVertical, Plus, Repeat, RotateCcw, Target, X } from "lucide-react";
import { Tracker, BoardStatus, BoardCard, FREQ_LABEL, FREQ_ORDER } from "@/lib/tracker";

const COLUMNS: { status: BoardStatus; label: string }[] = [
  { status: "planned", label: "Planned" },
  { status: "progress", label: "In progress" },
  { status: "done", label: "Done" },
];

function ProgressRing({
  current,
  target,
  color,
}: {
  current: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
  const r = 15;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" aria-label={`${pct}% complete`}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="currentColor" className="text-foreground/10" strokeWidth="4" />
      <circle
        cx="21"
        cy="21"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        transform="rotate(-90 21 21)"
        style={{ transition: "stroke-dashoffset .25s ease" }}
      />
      <text
        x="21"
        y="21"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-foreground font-mono-n"
        fontSize="11"
        fontWeight="600"
      >
        {pct}
      </text>
    </svg>
  );
}

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
  const hasTarget = typeof b.target === "number" && b.target > 0;

  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(String(b.current ?? ""));
  const [target, setTarget] = useState(String(b.target ?? ""));

  const saveProgress = () => {
    tracker.setCardProgress(
      b.id,
      current === "" ? null : Number(current),
      target === "" ? null : Number(target)
    );
    setEditing(false);
  };

  return (
    <div
      className={
        "relative rounded-lg border border-foreground/10 bg-card p-3 shadow-sm " +
        (dragging ? "opacity-90 shadow-lg ring-2 ring-primary/40" : "")
      }
    >
      {hasTarget && !editing && (
        <button
          className="absolute right-2 top-2"
          aria-label="Edit progress"
          onClick={() => setEditing(true)}
        >
          <ProgressRing current={b.current ?? 0} target={b.target ?? 1} color={c.color} />
        </button>
      )}

      <div className="mb-2 flex items-start gap-1.5 pr-11">
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

      <div className="mb-2.5 flex flex-wrap items-center gap-2 pl-[22px]">
        <Chip
          size="sm"
          variant="soft"
          className="cursor-pointer"
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
        {hasTarget && (
          <span className="font-mono-n text-[11px] text-foreground/50">
            {b.current ?? 0} / {b.target}
          </span>
        )}
      </div>

      {editing && (
        <div className="mb-2.5 flex flex-wrap items-end gap-2 pl-[22px]">
          <label className="text-[11px] text-foreground/60">
            Current
            <Input
              type="number"
              aria-label="Current value"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="mt-0.5 h-9 w-24"
            />
          </label>
          <label className="text-[11px] text-foreground/60">
            Target
            <Input
              type="number"
              aria-label="Target value"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-0.5 h-9 w-24"
            />
          </label>
          <Button size="sm" variant="primary" onPress={saveProgress}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 pl-[22px]">
        {done ? (
          <Button size="md" variant="outline" onPress={() => tracker.setCardStatus(b.id, "progress")}>
            <RotateCcw className="h-4 w-4" /> Reopen
          </Button>
        ) : (
          <Button size="md" variant="primary" onPress={() => tracker.setCardStatus(b.id, "done")}>
            <Check className="h-4 w-4" /> Done
          </Button>
        )}
        {!hasTarget && !editing && (
          <Button size="md" variant="outline" isIconOnly aria-label="Set progress target" onPress={() => setEditing(true)}>
            <Target className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="md"
          variant="ghost"
          isIconOnly
          aria-label="Delete card"
          onPress={() => tracker.deleteCard(b.id)}
          className="ml-auto"
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
