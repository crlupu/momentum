"use client";

import { FormEvent, useState } from "react";

import { Button, Card, Input } from "./ui";
import { Modal } from "./Modal";
import { DeleteButton } from "./DeleteButton";
import { usePending } from "./ActionButton";
import { ArrowDown, ArrowUp, Check, ChevronRight, Pencil, Plus, X } from "./icons";
import { Tracker, Goal, Path, goalPct, pathGoals, pathPct } from "@/lib/tracker";

/** Add a path, or edit one. */
function PathForm({
  tracker,
  path,
  onClose,
}: {
  tracker: Tracker;
  path: Path | null;
  onClose: () => void;
}) {
  const s = tracker.state!;
  const [title, setTitle] = useState(path?.title ?? "");
  const [note, setNote] = useState(path?.note ?? "");
  const [catId, setCatId] = useState(path?.catId ?? s.categories[0]?.id ?? "");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    onClose();
    await run(() =>
      path ? tracker.updatePath(path.id, t, catId, note) : tracker.addPath(t, catId, note)
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        aria-label="Path title"
        placeholder="e.g. Become a software architect"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <Input
        aria-label="What it is for"
        placeholder="What it is for (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {s.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s.categories.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant="outline"
              className={catId === c.id ? "pill-selected" : ""}
              onPress={() => setCatId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onPress={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isDisabled={pending || !title.trim()}>
          {path ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Chooses which goals are on a path.
 *
 * Every goal is listed with a checkbox showing whether it is on the path, so
 * the dialog says what the path currently holds rather than only offering what
 * it does not — and a goal put on by mistake comes off in the same place it
 * went on. Checking appends to the end of the order; the order itself is
 * changed on the path.
 *
 * Goals are chosen from the ones that already exist rather than created here:
 * a goal on a path is an ordinary goal, and a second way to make one would
 * mean two kinds differing only in where they were typed.
 */
function ChooseGoalsDialog({
  tracker,
  path,
  onClose,
}: {
  tracker: Tracker;
  path: Path;
  onClose: () => void;
}) {
  const s = tracker.state!;
  const { run } = usePending();

  const toggle = (goalId: string, on: boolean) =>
    void run(() =>
      on ? tracker.addGoalToPath(path.id, goalId) : tracker.removeGoalFromPath(path.id, goalId)
    );

  return (
    <div className="flex flex-col gap-3">
      {s.goals.length === 0 ? (
        <p className="text-[15px] text-foreground/60">
          No goals yet. Add one in the section below, then put it on this path.
        </p>
      ) : (
        <ul className="max-h-[50vh] list-none divide-y divide-foreground/10 overflow-y-auto p-0">
          {s.goals.map((g) => {
            const on = path.goalIds.includes(g.id);
            return (
              <li key={g.id}>
                <label className="path-pick">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggle(g.id, e.target.checked)}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{g.title}</span>
                  <span className="font-mono-n shrink-0 text-xs text-foreground/50">
                    {g.done ? "done" : `${goalPct(g)}%`}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex justify-end">
        <Button variant="outline" onPress={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** One step of a path: a goal, with where it sits and how far along it is. */
function StepRow({
  tracker,
  path,
  goal,
  index,
  last,
}: {
  tracker: Tracker;
  path: Path;
  goal: Goal;
  index: number;
  last: boolean;
}) {
  const pct = goal.done ? 100 : goalPct(goal);
  const { run } = usePending();

  return (
    <li className="path-step">
      <span className={"path-step__no" + (goal.done ? " path-step__no--done" : "")}>
        {goal.done ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
      </span>

      <span className="min-w-0 flex-1">
        <span className={"block truncate text-[15px]" + (goal.done ? " text-foreground/45" : "")}>
          {goal.title}
        </span>
        <span className="path-step__meter" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
      </span>

      <span className="font-mono-n shrink-0 text-xs text-foreground/50">{pct}%</span>

      <span className="cfg-actions">
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label={`Move ${goal.title} earlier`}
          isDisabled={index === 0}
          onPress={() => void run(() => tracker.moveGoalOnPath(path.id, goal.id, -1))}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label={`Move ${goal.title} later`}
          isDisabled={last}
          onPress={() => void run(() => tracker.moveGoalOnPath(path.id, goal.id, 1))}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        {/* Takes the goal off the path. It is not a delete: the goal carries on
            existing in the goals list, which is why this is not a bin. */}
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`Take ${goal.title} off this path`}
          onPress={() => void run(() => tracker.removeGoalFromPath(path.id, goal.id))}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </span>
    </li>
  );
}

function PathCard({ tracker, path }: { tracker: Tracker; path: Path }) {
  const s = tracker.state!;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);

  const goals = pathGoals(path, s.goals);
  const pct = pathPct(path, s.goals);
  const doneCount = goals.filter((g) => g.done || goalPct(g) >= 100).length;
  const cat = s.categories.find((c) => c.id === path.catId);

  return (
    <Card>
      <Card.Content className="p-4">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronRight
              className={"mt-1 h-4 w-4 shrink-0 transition-transform " + (open ? "rotate-90" : "")}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold leading-tight">{path.title}</span>
              {path.note && (
                <span className="mt-0.5 block text-xs text-foreground/50">{path.note}</span>
              )}
              <span className="mt-1 block text-xs text-foreground/50">
                {goals.length === 0
                  ? "No goals yet"
                  : `${doneCount} of ${goals.length} goals complete`}
                {cat && ` · ${cat.name}`}
              </span>
            </span>
          </button>

          <span className="font-mono-n shrink-0 text-lg font-bold tabular-nums">{pct}%</span>
        </div>

        <div className="path-meter" aria-hidden>
          <span
            style={{ width: `${pct}%`, background: cat?.color || "var(--accent)" }}
          />
        </div>

        {open && (
          <>
            {goals.length > 0 && (
              <ul className="mt-3 list-none divide-y divide-foreground/10 p-0">
                {goals.map((g, i) => (
                  <StepRow
                    key={g.id}
                    tracker={tracker}
                    path={path}
                    goal={g}
                    index={i}
                    last={i === goals.length - 1}
                  />
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onPress={() => setPicking(true)}>
                <Plus className="h-3.5 w-3.5" /> Choose goals
              </Button>
              <Button
                size="sm"
                variant="outline"
                isIconOnly
                aria-label={`Edit ${path.title}`}
                onPress={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <span className="ml-auto">
                <DeleteButton
                  what={`the path "${path.title}"`}
                  iconOnly
                  bare
                  onDelete={() => tracker.removePath(path.id)}
                />
              </span>
            </div>
          </>
        )}

        <Modal open={editing} onClose={() => setEditing(false)} title="Edit path">
          <PathForm tracker={tracker} path={path} onClose={() => setEditing(false)} />
        </Modal>
        <Modal open={picking} onClose={() => setPicking(false)} title="Goals on this path">
          <ChooseGoalsDialog tracker={tracker} path={path} onClose={() => setPicking(false)} />
        </Modal>
      </Card.Content>
    </Card>
  );
}

export function PathsView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
          Paths
        </h3>
        <Button size="sm" variant="outline" onPress={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> New path
        </Button>
      </div>

      {s.paths.length === 0 ? (
        <p className="py-1 text-[15px] text-foreground/60">
          No paths yet. A path is a long undertaking made of goals — becoming a software architect,
          say — and shows how far through it you are.
        </p>
      ) : (
        <div className="space-y-3">
          {s.paths.map((p) => (
            <PathCard key={p.id} tracker={tracker} path={p} />
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New path">
        <PathForm tracker={tracker} path={null} onClose={() => setAdding(false)} />
      </Modal>
    </div>
  );
}

export default PathsView;
