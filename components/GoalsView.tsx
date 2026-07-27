"use client";

import { useState } from "react";
import { Button, Card, Chip, Input } from "@heroui/react";
import { ActionButton, usePending } from "./ActionButton";
import { Check, ListPlus, Plus, RotateCcw, SlidersHorizontal, Target, X } from "lucide-react";
import { ProgressRing } from "./ProgressRing";
import { Tracker, Goal, Subtask, goalPct, subtaskPct } from "@/lib/tracker";

function SubtaskRow({
  goalId,
  t,
  color,
  tracker,
}: {
  goalId: string;
  t: Subtask;
  color: string;
  tracker: Tracker;
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(String(t.current ?? ""));
  const [target, setTarget] = useState(String(t.target ?? ""));
  const { pending, run } = usePending();
  const pct = subtaskPct(t);
  const hasTarget = typeof t.target === "number" && t.target > 0;

  const save = async () => {
    const ok = await run(() =>
      tracker.setSubtaskProgress(
        goalId,
        t.id,
        current === "" ? null : Number(current),
        target === "" ? null : Number(target)
      )
    );
    if (ok) setEditing(false);
  };

  return (
    <li className="py-1.5">
      <div className="flex items-center gap-1.5">
        <button
          className="min-w-0 flex-1 truncate text-left text-[13px]"
          onClick={() => setEditing((v) => !v)}
          title="Edit progress"
        >
          {t.title}
        </button>
        <span className="font-mono-n shrink-0 text-[11px] text-foreground/50">
          {hasTarget ? `${t.current ?? 0}/${t.target}` : "—"}
        </span>
        <ActionButton
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`Delete subtask ${t.title}`}
          onAction={() => tracker.deleteSubtask(goalId, t.id)}
        >
          <X className="h-3.5 w-3.5" />
        </ActionButton>
      </div>

      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color, transition: "width .3s ease" }}
        />
      </div>

      {editing && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="block text-[11px] text-foreground/60">
            Current
            <Input
              type="number"
              aria-label="Subtask current value"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="mt-0.5 w-full"
            />
          </label>
          <label className="block text-[11px] text-foreground/60">
            Target
            <Input
              type="number"
              aria-label="Subtask target value"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-0.5 w-full"
            />
          </label>
          <Button
            size="sm"
            variant="primary"
            onPress={() => void save()}
            isDisabled={pending}
            className={"w-full " + (pending ? "is-pending" : "")}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setEditing(false)} className="w-full">
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}

function AddSubtask({ goalId, tracker }: { goalId: string; tracker: Tracker }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const { pending, run } = usePending();

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    const ok = await run(() =>
      tracker.addSubtask(
        goalId,
        t,
        current === "" ? null : Number(current),
        target === "" ? null : Number(target)
      )
    );
    if (ok) {
      setTitle("");
      setCurrent("");
      setTarget("");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="mt-2" onPress={() => setOpen(true)}>
        <ListPlus className="h-4 w-4" /> Subtask
      </Button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Input
        aria-label="Subtask title"
        placeholder="Subtask title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <label className="block text-[11px] text-foreground/60">
        Current
        <Input
          type="number"
          aria-label="Subtask current value"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="mt-0.5 w-full"
        />
      </label>
      <label className="block text-[11px] text-foreground/60">
        Target
        <Input
          type="number"
          aria-label="Subtask target value"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="mt-0.5 w-full"
        />
      </label>
      <Button
        size="sm"
        variant="primary"
        onPress={() => void add()}
        isDisabled={pending}
        className={"w-full " + (pending ? "is-pending" : "")}
      >
        Add subtask
      </Button>
      <Button size="sm" variant="ghost" className="w-full" onPress={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

function GoalCard({ g, tracker }: { g: Goal; tracker: Tracker }) {
  const c = tracker.cat(g.catId);
  const pct = goalPct(g);
  const hasTarget = typeof g.target === "number" && g.target > 0;

  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(String(g.current ?? ""));
  const [target, setTarget] = useState(String(g.target ?? ""));

  const { pending, run } = usePending();
  const save = async () => {
    const ok = await run(() =>
      tracker.setGoalProgress(g.id, current === "" ? null : Number(current), target === "" ? null : Number(target))
    );
    if (ok) setEditing(false);
  };

  return (
    <Card>
      <Card.Content className="px-3 py-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={"font-display text-base font-semibold " + (g.done ? "text-foreground/45 line-through" : "")}>
              {g.title}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Chip size="sm" variant="soft" className="cursor-pointer" onClick={() => void tracker.cycleGoalCat(g.id)}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                <Chip.Label className="ml-1.5">{c.name}</Chip.Label>
              </Chip>
              {hasTarget && (
                <span className="font-mono-n text-xs text-foreground/50">
                  {g.current ?? 0} / {g.target}
                </span>
              )}
            </div>
          </div>
          {hasTarget && <ProgressRing pct={pct} color={c.color} size={48} />}
        </div>

        {hasTarget && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color, transition: "width .3s ease" }} />
          </div>
        )}

        {(g.subtasks?.length ?? 0) > 0 && (
          <ul className="mt-3 list-none divide-y divide-foreground/10 p-0">
            {(g.subtasks ?? []).map((t) => (
              <SubtaskRow key={t.id} goalId={g.id} t={t} color={c.color} tracker={tracker} />
            ))}
          </ul>
        )}

        <AddSubtask goalId={g.id} tracker={tracker} />

        {editing && (
          <div className="mt-3 flex flex-col gap-2">
            <label className="block text-[11px] text-foreground/60">
              Current
              <Input type="number" aria-label="Current value" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-0.5 w-full" />
            </label>
            <label className="block text-[11px] text-foreground/60">
              Target
              <Input type="number" aria-label="Target value" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-0.5 w-full" />
            </label>
            <Button size="sm" variant="primary" onPress={() => void save()} isDisabled={pending} className={"w-full " + (pending ? "is-pending" : "")}>Save</Button>
            <Button size="sm" variant="ghost" onPress={() => setEditing(false)} className="w-full">Cancel</Button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onPress={() => setEditing((v) => !v)}>
            {hasTarget ? <SlidersHorizontal className="h-4 w-4" /> : <Target className="h-4 w-4" />}
            {hasTarget ? "Update" : "Set target"}
          </Button>
          {g.done ? (
            <ActionButton size="sm" variant="outline" onAction={() => tracker.toggleGoalDone(g.id)}>
              <RotateCcw className="h-4 w-4" /> Reopen
            </ActionButton>
          ) : (
            <ActionButton size="sm" variant="primary" onAction={() => tracker.toggleGoalDone(g.id)}>
              <Check className="h-4 w-4" /> Done
            </ActionButton>
          )}
          <ActionButton size="sm" variant="ghost" isIconOnly aria-label="Delete goal" onAction={() => tracker.deleteGoal(g.id)} className="ml-auto">
            <X className="h-4 w-4" />
          </ActionButton>
        </div>
      </Card.Content>
    </Card>
  );
}

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-foreground/50">{children}</div>
  );
}

export default function GoalsView({ tracker, onAdd }: { tracker: Tracker; onAdd: () => void }) {
  const s = tracker.state!;
  const done = s.goals.filter((g) => g.done);
  const active = s.goals.filter((g) => !g.done);
  const todo = active.filter((g) => (g.current ?? 0) <= 0);
  const inProgress = active.filter((g) => (g.current ?? 0) > 0);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Goals</h2>
          <p className="mt-0.5 text-sm text-foreground/60">
            {todo.length} to do · {inProgress.length} in progress · {done.length} done
          </p>
        </div>
        <Button variant="primary" onPress={onAdd}>
          <Plus className="h-4 w-4" /> New goal
        </Button>
      </div>

      {active.length === 0 && done.length === 0 ? (
        <Card>
          <Card.Content className="p-8 text-center">
            <Target className="mx-auto mb-3 h-8 w-8 text-foreground/30" />
            <p className="text-foreground/60">No goals yet. Add one to start tracking progress.</p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <ColumnHeader>To do</ColumnHeader>
            <div className="space-y-3">
              {todo.length === 0 ? (
                <p className="px-1 text-sm text-foreground/40">Nothing to do.</p>
              ) : (
                todo.map((g) => <GoalCard key={g.id} g={g} tracker={tracker} />)
              )}
            </div>
          </div>
          <div>
            <ColumnHeader>In progress</ColumnHeader>
            <div className="space-y-3">
              {inProgress.length === 0 ? (
                <p className="px-1 text-sm text-foreground/40">Nothing in progress.</p>
              ) : (
                inProgress.map((g) => <GoalCard key={g.id} g={g} tracker={tracker} />)
              )}
            </div>
          </div>
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="mb-3 mt-6 text-[13px] uppercase tracking-wide text-foreground/40">Completed</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {done.map((g) => (
              <Card key={g.id}>
                <Card.Content className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-[15px] text-foreground/45 line-through">{g.title}</span>
                    <ActionButton
                      size="sm"
                      variant="outline"
                      isIconOnly
                      aria-label="Reopen goal"
                      onAction={() => tracker.toggleGoalDone(g.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label="Delete goal"
                      onAction={() => tracker.deleteGoal(g.id)}
                    >
                      <X className="h-4 w-4" />
                    </ActionButton>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
