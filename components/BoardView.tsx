"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Chip, Input } from "@heroui/react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Tracker, BoardStatus } from "@/lib/tracker";

const COLUMNS: { status: BoardStatus; label: string }[] = [
  { status: "planned", label: "Planned" },
  { status: "progress", label: "In progress" },
  { status: "done", label: "Done" },
];

function Column({
  status,
  label,
  tracker,
}: {
  status: BoardStatus;
  label: string;
  tracker: Tracker;
}) {
  const [title, setTitle] = useState("");
  const items = tracker.state!.board.filter((b) => b.status === status);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    tracker.addCard(t, status);
    setTitle("");
  };

  return (
    <Card>
      <Card.Content className="p-3.5">
        <h3 className="font-display mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-foreground/60">
          {label}
          <span className="font-mono-n" style={{ color: "#F5A524" }}>
            {items.length}
          </span>
        </h3>

        {items.map((b) => {
          const c = tracker.cat(b.catId);
          return (
            <div
              key={b.id}
              className="mb-2.5 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3"
            >
              <div
                className={
                  "mb-2 text-[15px] " + (status === "done" ? "text-foreground/45 line-through" : "")
                }
              >
                {b.title}
              </div>
              <div className="flex items-center gap-2">
                <span className="mr-auto">
                  <Chip
                    size="sm"
                    variant="soft"
                    className="cursor-pointer"
                    onClick={() => tracker.cycleCardCat(b.id)}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    <Chip.Label className="ml-1.5">{c.name}</Chip.Label>
                  </Chip>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  aria-label="Move left"
                  isDisabled={status === "planned"}
                  onPress={() => tracker.moveCard(b.id, -1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  aria-label="Move right"
                  isDisabled={status === "done"}
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
        })}

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
  return (
    <div className="grid gap-3.5 md:grid-cols-3">
      {COLUMNS.map((c) => (
        <Column key={c.status} {...c} tracker={tracker} />
      ))}
    </div>
  );
}
