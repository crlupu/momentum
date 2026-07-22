"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Checkbox, Chip, Input } from "@heroui/react";
import { ArrowRight, Plus, X } from "lucide-react";
import { CatChip } from "./CatChip";
import { Tracker, Task, dateKey, streak } from "@/lib/tracker";

function Gauge({ pct }: { pct: number }) {
  const LEN = 188.5;
  return (
    <div className="text-center shrink-0">
      <svg width="150" height="90" viewBox="0 0 150 90" aria-label="Completion gauge">
        <path
          d="M15 80 A60 60 0 0 1 135 80"
          fill="none"
          stroke="currentColor"
          className="text-foreground/10"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M15 80 A60 60 0 0 1 135 80"
          fill="none"
          stroke="#F5A524"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={LEN * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset .25s ease" }}
        />
        <text
          x="75"
          y="72"
          textAnchor="middle"
          className="fill-foreground font-mono-n"
          fontSize="24"
          fontWeight="600"
        >
          {pct}%
        </text>
      </svg>
      <div className="text-xs text-foreground/60 -mt-1">completed today</div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-foreground/[0.04] px-3 py-2.5">
      <div className="font-mono-n text-2xl font-semibold" style={{ color: "#F5A524" }}>
        {value}
      </div>
      <div className="text-xs text-foreground/60">{label}</div>
    </div>
  );
}

function TaskRow({
  task,
  tracker,
  carried,
}: {
  task: Task;
  tracker: Tracker;
  carried?: boolean;
}) {
  const c = tracker.cat(task.catId);
  return (
    <li className="flex items-center gap-3 border-b border-foreground/10 px-1 py-3 last:border-b-0">
      <Checkbox
        aria-label={task.done ? "Mark not done" : "Mark done"}
        isSelected={task.done}
        onChange={() => tracker.toggleTask(task.id)}
      />
      <span
        className={"flex-1 text-base " + (task.done ? "text-foreground/45 line-through" : "")}
      >
        {task.title}
      </span>
      <CatChip category={c} />
      {carried && (
        <Button size="sm" variant="tertiary" onPress={() => tracker.moveTaskToToday(task.id)}>
          <ArrowRight className="h-4 w-4" /> today
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label="Delete task"
        onPress={() => tracker.deleteTask(task.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}

export default function TodayView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState(s.categories[0]?.id ?? "");
  const [newCat, setNewCat] = useState("");

  const tk = dateKey();
  const todays = s.tasks.filter((t) => t.date === tk);
  const carried = s.tasks.filter((t) => t.date < tk && !t.done);
  const done = todays.filter((t) => t.done).length;
  const pct = todays.length ? Math.round((done / todays.length) * 100) : 0;
  const ordered = [...todays.filter((t) => !t.done), ...todays.filter((t) => t.done)];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    tracker.addTask(t, catId || s.categories[0]?.id);
    setTitle("");
  };

  const submitCat = (e: FormEvent) => {
    e.preventDefault();
    const n = newCat.trim();
    if (!n) return;
    tracker.addCategory(n);
    setNewCat("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <Card.Content className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Gauge pct={pct} />
            <div className="grid flex-1 min-w-[200px] grid-cols-3 gap-2.5">
              <Stat value={done} label="done" />
              <Stat value={todays.length - done} label="remaining" />
              <Stat value={streak(s.tasks)} label="day streak" />
            </div>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Today&apos;s tasks
          </h2>

          <form onSubmit={submit} className="mb-1 flex flex-wrap gap-2">
            <Input
              aria-label="Task title"
              placeholder="Add a task…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-[180px] flex-1"
            />
            <Button type="submit" variant="primary">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>

          <div className="mb-1 flex flex-wrap gap-1.5">
            {s.categories.map((c) => (
              <CatChip
                key={c.id}
                category={c}
                onPress={() => setCatId(c.id)}
                selected={catId === c.id}
              />
            ))}
          </div>

          {ordered.length === 0 ? (
            <p className="px-1 py-3 text-[15px] text-foreground/60">
              Nothing yet. Add your first task for today.
            </p>
          ) : (
            <ul className="mt-2 list-none p-0">
              {ordered.map((t) => (
                <TaskRow key={t.id} task={t} tracker={tracker} />
              ))}
            </ul>
          )}

          {carried.length > 0 && (
            <>
              <div className="mb-1 mt-4 text-[13px] uppercase tracking-wide text-foreground/60">
                Carried over
              </div>
              <ul className="list-none p-0">
                {carried.map((t) => (
                  <TaskRow key={t.id} task={t} tracker={tracker} carried />
                ))}
              </ul>
            </>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Categories
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {s.categories.map((c) => (
              <Chip key={c.id} size="sm" variant="soft">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden
                />
                <Chip.Label className="ml-1.5">{c.name}</Chip.Label>
                <button
                  aria-label={`Delete category ${c.name}`}
                  className="ml-1 text-foreground/50 hover:text-foreground"
                  onClick={() => {
                    if (!tracker.deleteCategory(c.id))
                      alert("This category is in use. Remove or reassign its items first.");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Chip>
            ))}
          </div>
          <form onSubmit={submitCat} className="mt-3 flex gap-2">
            <Input
              aria-label="New category name"
              placeholder="New category…"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary">
              Add category
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
