"use client";

import { useState } from "react";
import { Button, Card, Chip, Input } from "./ui";
import { ActionButton, usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ListPlus,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Target,
} from "lucide-react";
import { ProgressRing } from "./ProgressRing";
import { Tracker, Goal, Subtask, goalPct, goalHasProgress, goalIsDerived, subtaskPct } from "@/lib/tracker";

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
  const [name, setName] = useState(t.title);
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
        target === "" ? null : Number(target),
        name
      )
    );
    if (ok) setEditing(false);
  };

  return (
    <li className="py-1.5">
      <div className="flex items-center gap-1.5">
        <button
          className="min-w-0 flex-1 break-words text-left text-[13px]"
          onClick={() => setEditing((v) => !v)}
          title="Edit progress"
        >
          {t.title}
        </button>
        <span className="font-mono-n shrink-0 text-[11px] text-foreground/50">
          {hasTarget ? `${t.current ?? 0}/${t.target}` : "—"}
        </span>
      </div>

      <div className="mt-1 h-1.5 w-full overflow-hidden bg-foreground/10">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: "width .3s ease",
          }}
        />
      </div>

      {editing && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="block text-[11px] text-foreground/60">
            Name
            <Input
              aria-label="Subtask name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-0.5 w-full"
            />
          </label>
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
          <DeleteButton
            what={`the subtask "${t.title}"`}
            fullWidth
            onDelete={() => tracker.deleteSubtask(goalId, t.id)}
          />
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

function GoalCard({
  g,
  tracker,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  g: Goal;
  tracker: Tracker;
  onMove?: (dir: -1 | 1) => Promise<unknown>;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const c = tracker.cat(g.catId);
  const pct = goalPct(g);
  const hasOwnTarget = typeof g.target === "number" && g.target > 0;
  const showProgress = goalHasProgress(g);
  const derived = goalIsDerived(g);

  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(g.title);
  const [catId, setCatId] = useState(g.catId);
  const [current, setCurrent] = useState(String(g.current ?? ""));
  const [target, setTarget] = useState(String(g.target ?? ""));

  const { pending, run } = usePending();

  /** Leaves edit mode and discards any unsaved field changes. */
  const closeEditor = () => {
    setName(g.title);
    setCatId(g.catId);
    setCurrent(String(g.current ?? ""));
    setTarget(String(g.target ?? ""));
    setExpanded(false);
  };

  const save = async () => {
    await run(() =>
      tracker.saveGoal(g.id, {
        title: name,
        catId,
        current: current === "" ? null : Number(current),
        target: target === "" ? null : Number(target),
      })
    );
  };

  return (
    <Card>
      <Card.Content className="px-3 py-3 md:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div
              className={
                "font-display text-base font-semibold " +
                (g.done ? "text-foreground/45 line-through" : "")
              }
            >
              {g.pinned && (
                <Pin className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-foreground/45" aria-label="Pinned" />
              )}
              {g.title}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Chip size="sm" color={c.color}>
                {c.name}
              </Chip>
              {derived ? (
                <span className="text-xs text-foreground/50">from subtasks</span>
              ) : (
                hasOwnTarget && (
                  <span className="font-mono-n text-xs text-foreground/50">
                    {g.current ?? 0} / {g.target}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label={expanded ? "Close editing" : "Edit goal"}
              className={expanded ? "pill-selected" : ""}
              onPress={() => (expanded ? closeEditor() : setExpanded(true))}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {showProgress && <ProgressRing pct={pct} color={c.color} size={48} />}
          </div>
        </div>

        {showProgress && (
          <div className="mt-3 h-2 w-full overflow-hidden bg-foreground/10">
            <div
              className="h-full"
              style={{
                width: `${pct}%`,
                background: c.color,
                transition: "width .3s ease",
              }}
            />
          </div>
        )}

        {(g.subtasks?.length ?? 0) > 0 && (
          <ul className="mt-3 list-none divide-y divide-foreground/10 p-0">
            {(g.subtasks ?? []).map((t) => (
              <SubtaskRow key={t.id} goalId={g.id} t={t} color={c.color} tracker={tracker} />
            ))}
          </ul>
        )}

        {/* Adding a subtask sits directly under the list it belongs to. */}
        {expanded && <AddSubtask goalId={g.id} tracker={tracker} />}

        {expanded && (
          <div className="mt-3 border-t border-foreground/10 pt-3">
            <label className="block text-[11px] text-foreground/60">
              Name
              <Input
                aria-label="Goal name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-0.5 w-full"
              />
            </label>

            <div className="mt-2">
              <div className="mb-1 text-[11px] text-foreground/60">Category</div>
              <div className="flex flex-wrap gap-1.5">
                {tracker.state!.categories.map((cat) => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant="outline"
                    className={catId === cat.id ? "pill-selected" : ""}
                    onPress={() => setCatId(cat.id)}
                  >
                    <span
                      className="inline-block h-2 w-2"
                      style={{ background: cat.color }}
                      aria-hidden
                    />
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-foreground/60">
                Current
                <Input
                  type="number"
                  aria-label="Current value"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="mt-0.5 w-full"
                />
              </label>
              <label className="block text-[11px] text-foreground/60">
                Target
                <Input
                  type="number"
                  aria-label="Target value"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-0.5 w-full"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onPress={() => void save()}
                isDisabled={pending}
                className={"flex-1 " + (pending ? "is-pending" : "")}
              >
                Save changes
              </Button>
              <Button size="sm" variant="secondary" className="btn-invert" onPress={closeEditor} isDisabled={pending}>
                Close
              </Button>
            </div>

            {/* separator between saving and the goal's other actions */}
            <div className="mt-3 flex items-center gap-2 border-t border-foreground/10 pt-3">
              {g.done ? (
                <ActionButton
                  size="sm"
                  variant="secondary"
                  onAction={() => tracker.toggleGoalDone(g.id)}
                >
                  <RotateCcw className="h-4 w-4" /> Reopen
                </ActionButton>
              ) : (
                <ActionButton
                  size="sm"
                  variant="primary"
                  className="btn-success"
                  onAction={() => tracker.toggleGoalDone(g.id)}
                >
                  <Check className="h-4 w-4" /> Mark as done
                </ActionButton>
              )}

              <div className="ml-auto flex items-center gap-1">
                <ActionButton
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={g.pinned ? "Unpin goal" : "Pin goal to the top"}
                  className={g.pinned ? "pill-selected" : ""}
                  onAction={() => tracker.toggleGoalPin(g.id)}
                >
                  {g.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </ActionButton>
                {onMove && (
                  <>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label="Move goal up"
                      isDisabled={!canMoveUp}
                      onAction={() => onMove(-1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label="Move goal down"
                      isDisabled={!canMoveDown}
                      onAction={() => onMove(1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </ActionButton>
                  </>
                )}
                <DeleteButton
                  what={`the goal "${g.title}"`}
                  iconOnly
                  onDelete={() => tracker.deleteGoal(g.id)}
                />
              </div>
            </div>
          </div>
        )}
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

  /** Swaps a goal with its neighbour inside its own column. */
  const makeMove = (list: Goal[]) => (id: string) => async (dir: -1 | 1) => {
    const i = list.findIndex((g) => g.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    // pinned items always sort above unpinned ones, so a swap across that
    // boundary would simply be undone by the sort
    if (!!list[i].pinned !== !!list[j].pinned) return false;
    const all = [...s.goals];
    const a = all.findIndex((g) => g.id === list[i].id);
    const b = all.findIndex((g) => g.id === list[j].id);
    [all[a], all[b]] = [all[b], all[a]];
    return tracker.reorderGoals(all.map((g) => g.id));
  };
  const done = s.goals.filter((g) => g.done);
  const active = s.goals.filter((g) => !g.done);
  const pinnedFirst = (list: Goal[]) =>
    [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const todo = pinnedFirst(active.filter((g) => goalPct(g) <= 0));
  const inProgress = pinnedFirst(active.filter((g) => goalPct(g) > 0));

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-sm text-foreground/60">
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <ColumnHeader>To do</ColumnHeader>
            <div className="space-y-3">
              {todo.length === 0 ? (
                <p className="px-1 text-sm text-foreground/40">Nothing to do.</p>
              ) : (
                todo.map((g, i) => (
                  <GoalCard
                    key={g.id}
                    g={g}
                    tracker={tracker}
                    onMove={makeMove(todo)(g.id)}
                    canMoveUp={i > 0}
                    canMoveDown={i < todo.length - 1}
                  />
                ))
              )}
            </div>
          </div>
          <div>
            <ColumnHeader>In progress</ColumnHeader>
            <div className="space-y-3">
              {inProgress.length === 0 ? (
                <p className="px-1 text-sm text-foreground/40">Nothing in progress.</p>
              ) : (
                inProgress.map((g, i) => (
                  <GoalCard
                    key={g.id}
                    g={g}
                    tracker={tracker}
                    onMove={makeMove(inProgress)(g.id)}
                    canMoveUp={i > 0}
                    canMoveDown={i < inProgress.length - 1}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="mb-3 mt-6 text-[13px] uppercase tracking-wide text-foreground/40">Completed</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {done.map((g) => (
              <Card key={g.id}>
                <Card.Content className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 break-words text-[15px] text-foreground/45 line-through">{g.title}</span>
                    <ActionButton
                      size="sm"
                      variant="outline"
                      isIconOnly
                      aria-label="Reopen goal"
                      onAction={() => tracker.toggleGoalDone(g.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </ActionButton>
                    <DeleteButton what={`the goal "${g.title}"`} iconOnly onDelete={() => tracker.deleteGoal(g.id)} />
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
