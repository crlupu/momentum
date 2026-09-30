"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AddButton, Button, Input } from "./ui";
import { ActionButton, usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { CatPicker } from "./Forms";
import { Modal } from "./Modal";
import { ProgressRing } from "./ProgressRing";
import { Check, ExternalLink, Kanban, Minus, Pin, PinOff, Plus, ReorderLines, RotateCcw } from "./icons";
import {
  Goal,
  Subtask,
  Tracker,
  goalPct,
  goalStepsDone,
  goalTopic,
  subtaskDone,
} from "@/lib/tracker";

/** A number field's value, or null when empty or not a number. */
function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * One goal, opened: how far it is, its steps, its details, and what can be
 * done with it.
 *
 * Steps are the everyday part, so they come first and every one is directly
 * actionable — a round checkbox to tick it, and − / + for a counted step.
 * Renaming, recounting and reordering steps is a mode, behind Edit, as in
 * any iOS list.
 */
export function GoalDetail({
  tracker,
  goal: g,
  onClose,
}: {
  tracker: Tracker;
  goal: Goal;
  onClose: () => void;
}) {
  const s = tracker.state!;
  const steps = g.subtasks ?? [];
  const pct = g.done ? 100 : goalPct(g);
  const count = goalStepsDone(g);
  const topic = goalTopic(g.id, s.paths);
  const [editingSteps, setEditingSteps] = useState(false);

  const summary = g.done
    ? "Done"
    : steps.length > 0
      ? `${count.done} of ${count.total} ${count.total === 1 ? "step" : "steps"} done`
      : g.target
        ? `${(g.current ?? 0).toLocaleString()} of ${g.target.toLocaleString()}`
        : "Add steps to track it, or give it a count in Details.";

  return (
    <div className="goal-detail">
      <div className="goal-detail__summary">
        <ProgressRing pct={pct} color="var(--accent)" size={64} />
        <div className="min-w-0">
          <p className="goal-detail__pct">{pct}% complete</p>
          <p className="goal-detail__sub">{summary}</p>
          {topic && <p className="goal-detail__sub">In {topic.title}</p>}
        </div>
      </div>

      {/* A goal measured by its own count, not by steps: the count is the
          control, with − and + beside it. */}
      {steps.length === 0 && !!g.target && !g.done && (
        <div className="goal-counter">
          <span className="goal-counter__label">Progress</span>
          <Stepper
            value={g.current ?? 0}
            total={g.target}
            onStep={(d) => tracker.stepGoal(g.id, d)}
            what={g.title}
          />
        </div>
      )}

      <section className="goal-section" aria-labelledby="goal-steps">
        <div className="goal-section__head">
          <h3 id="goal-steps" className="group-label">
            Steps{steps.length > 0 ? ` · ${count.done} of ${count.total}` : ""}
          </h3>
          {steps.length > 0 && (
            <button
              type="button"
              className="text-action"
              aria-pressed={editingSteps}
              onClick={() => setEditingSteps((v) => !v)}
            >
              {editingSteps ? "Done" : "Edit"}
            </button>
          )}
        </div>
        <StepList tracker={tracker} goal={g} editing={editingSteps} />
        {!editingSteps && <AddStep tracker={tracker} goalId={g.id} first={steps.length === 0} />}
      </section>

      <AfterFirstFrame>
        <Details tracker={tracker} goal={g} />
      </AfterFirstFrame>

      <div className="goal-detail__actions">
        <ActionButton
          variant="primary"
          onAction={async () => {
            const r = await tracker.toggleGoalDone(g.id);
            if (!g.done) onClose();
            return r;
          }}
        >
          {g.done ? (
            <>
              <RotateCcw className="h-4 w-4" /> Reopen
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Mark as done
            </>
          )}
        </ActionButton>
        <ActionButton variant="ghost" onAction={() => tracker.toggleGoalPin(g.id)}>
          {g.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          {g.pinned ? "Unpin" : "Pin to top"}
        </ActionButton>
        <MoveToProjects tracker={tracker} goal={g} onClose={onClose} />
        <span className="ml-auto">
          <DeleteButton
            what={`the goal "${g.title}"`}
            label="Delete"
            size="md"
            bare
            onDelete={async () => {
              onClose();
              return tracker.deleteGoal(g.id);
            }}
          />
        </span>
      </div>
    </div>
  );
}

/**
 * Turns a goal into a project, for things that turned out to be work to
 * build rather than material to get through. Asks first, since the goal
 * leaves Learning; then opens the new board.
 */
function MoveToProjects({ tracker, goal: g, onClose }: { tracker: Tracker; goal: Goal; onClose: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const steps = g.subtasks?.length ?? 0;

  // The new board opens straight away; the save carries on behind it.
  const move = () => {
    const id = tracker.goalToProject(g.id);
    setOpen(false);
    if (id) {
      onClose();
      router.push(`/projects?p=${id}`);
    }
  };

  return (
    <>
      <Button variant="ghost" onPress={() => setOpen(true)}>
        <Kanban className="h-4 w-4" /> Move to Projects
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Move to Projects">
        <p className="mb-1 text-[15px]">
          Make <span className="font-semibold">{g.title}</span> a project?
        </p>
        <p className="mb-4 text-sm text-[var(--muted)]">
          {steps > 0
            ? `Its ${steps} ${steps === 1 ? "step becomes a card" : "steps become cards"} on the board: finished ones in Done, started ones in Doing, the rest in To do. `
            : "It gets an empty board to add cards to. "}
          It leaves Learning.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onPress={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onPress={move}>
            Move
          </Button>
        </div>
      </Modal>
    </>
  );
}

/**
 * "3 of 10" between a − and a +.
 *
 * Presses are never held back while a save is in flight: the change is on
 * screen at once and each write starts from the one before, so tapping + five
 * times quickly counts five. Locking the buttons until the round trip ended
 * made + ignore taps and − flash to disabled and back on every press.
 *
 * The figure is as wide as the largest it can be, so the buttons don't shift
 * as the count gains a digit.
 */
function Stepper({
  value,
  total,
  onStep,
  what,
}: {
  value: number;
  total: number;
  onStep: (delta: number) => Promise<unknown>;
  what: string;
}) {
  const digits = total.toLocaleString().length;
  return (
    <span className="stepper">
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`One less, ${what}`}
        isDisabled={value <= 0}
        onPress={() => void onStep(-1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="stepper__value font-mono-n" style={{ minInlineSize: `${digits * 2 + 3.5}ch` }}>
        {value.toLocaleString()}
        <span className="stepper__total"> of {total.toLocaleString()}</span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`One more, ${what}`}
        isDisabled={value >= total}
        onPress={() => void onStep(1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </span>
  );
}

/** The goal's steps: tick them off, or, while editing, rename and reorder. */
function StepList({ tracker, goal: g, editing }: { tracker: Tracker; goal: Goal; editing: boolean }) {
  const steps = g.subtasks ?? [];
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  if (steps.length === 0) return null;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = steps.map((t) => t.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void tracker.reorderSubtasks(g.id, arrayMove(ids, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={steps.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="step-list">
          {steps.map((t) => (
            <StepRow key={t.id} tracker={tracker} goalId={g.id} step={t} editing={editing} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function StepRow({
  tracker,
  goalId,
  step: t,
  editing,
}: {
  tracker: Tracker;
  goalId: string;
  step: Subtask;
  editing: boolean;
}) {
  const done = subtaskDone(t);
  const { pending, run } = usePending();
  const [name, setName] = useState(t.title);
  const [total, setTotal] = useState(t.target ? String(t.target) : "");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: t.id, disabled: !editing });

  // Saved when a field loses focus, so editing a list of steps is typing and
  // tabbing, with no Save button per row.
  const save = () => {
    const title = name.trim() || t.title;
    const target = num(total);
    const current = target ? Math.min(t.current ?? 0, target) : null;
    if (title === t.title && (target ?? undefined) === t.target) return;
    void tracker.setSubtaskProgress(goalId, t.id, current, target, title);
  };

  return (
    <li
      ref={setNodeRef}
      className={"step-row" + (isDragging ? " is-dragging" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {editing ? (
        <>
          <Input
            aria-label="Step name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            className="step-row__name-input"
          />
          <Input
            type="number"
            inputMode="numeric"
            aria-label={`Count for ${t.title}`}
            placeholder="Count"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            onBlur={save}
            className="step-row__count-input"
          />
          <DeleteButton
            what={`the step "${t.title}"`}
            iconOnly
            bare
            onDelete={() => tracker.deleteSubtask(goalId, t.id)}
          />
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="rd-grip"
            aria-label={`Move ${t.title}`}
            {...attributes}
            {...listeners}
          >
            <ReorderLines className="h-6 w-6" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={t.title}
            disabled={pending}
            onClick={() => void run(() => tracker.toggleSubtask(goalId, t.id))}
            className={"check" + (done ? " check--on" : "")}
          >
            <span className="check__ring">{done && <Check className="h-4 w-4" aria-hidden />}</span>
          </button>
          <span className={"step-row__title" + (done ? " is-done" : "")}>{t.title}</span>
          {t.target ? (
            <Stepper
              value={t.current ?? 0}
              total={t.target}
              onStep={(d) => tracker.stepSubtask(goalId, t.id, d)}
              what={t.title}
            />
          ) : null}
        </>
      )}
    </li>
  );
}

/**
 * Adds a step. The field keeps focus afterwards, so a course's lessons can be
 * typed in one after another. A count is optional: "Videos, 24".
 */
function AddStep({ tracker, goalId, first }: { tracker: Tracker; goalId: string; first: boolean }) {
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    setTitle("");
    setCount("");
    await run(() => tracker.addSubtask(goalId, t, null, num(count)));
  };

  return (
    <form onSubmit={submit} className="add-step">
      <Input
        aria-label="New step"
        placeholder={first ? "First step, e.g. Module 1" : "Add a step…"}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="add-step__name"
      />
      <Input
        type="number"
        inputMode="numeric"
        aria-label="Count, optional"
        placeholder="Count"
        value={count}
        onChange={(e) => setCount(e.target.value)}
        className="add-step__count"
      />
      <AddButton type="submit" aria-label="Add step" isDisabled={pending || !title.trim()} />
    </form>
  );
}

/**
 * Renders its children one frame after the sheet opens. The details form is
 * the heaviest part of the sheet and sits below the fold on a phone; drawn
 * with the rest, it held back the frame that shows the sheet at all. The
 * slide-in covers the gap.
 */
function AfterFirstFrame({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready ? <>{children}</> : <div className="goal-section goal-section--pending" aria-hidden />;
}

/** Name, description, topic, category, count and link. */
function Details({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const s = tracker.state!;
  const topic = goalTopic(g.id, s.paths);
  const [name, setName] = useState(g.title);
  const [current, setCurrent] = useState(g.current != null ? String(g.current) : "");
  const [target, setTarget] = useState(g.target != null ? String(g.target) : "");
  const [link, setLink] = useState(g.link ?? "");
  const [note, setNote] = useState(g.note ?? "");
  const { pending, run } = usePending();

  const dirty =
    name.trim() !== g.title ||
    num(current) !== (g.current ?? null) ||
    num(target) !== (g.target ?? null) ||
    link.trim() !== (g.link ?? "") ||
    note.trim() !== (g.note ?? "");

  const save = async () => {
    await run(async () => {
      await tracker.saveGoal(g.id, {
        title: name,
        catId: g.catId,
        current: num(current),
        target: num(target),
      });
      return tracker.setGoalDetails(g.id, { link, note });
    });
  };

  const href = link.trim() && /^https?:\/\//i.test(link.trim()) ? link.trim() : null;

  return (
    <section className="goal-section" aria-labelledby="goal-details">
      <h3 id="goal-details" className="group-label">Details</h3>
      <div className="goal-fields">
        <label className="goal-field">
          <span>Name</span>
          <Input aria-label="Goal name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="goal-field">
          <span>Description</span>
          <textarea
            aria-label="Description"
            rows={4}
            placeholder="Details: what it covers, why, where you left off…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className="goal-field">
          <span>Topic</span>
          <select
            value={topic?.id ?? ""}
            onChange={(e) => void tracker.setGoalTopic(g.id, e.target.value || null)}
          >
            <option value="">No topic</option>
            {s.paths.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </label>

        {/* In a topic, the category is the topic's; changed there. */}
        {topic?.catId ? (
          <div className="goal-field">
            <span>Category</span>
            <span className="goal-field__value">
              <span className="cat-dot" style={{ background: tracker.cat(topic.catId).color }} aria-hidden />
              {tracker.cat(topic.catId).name}
              <span className="goal-field__hint">from {topic.title}</span>
            </span>
          </div>
        ) : (
          <CatPicker tracker={tracker} catId={g.catId} setCatId={(id) => void tracker.updateGoal(g.id, { catId: id })} />
        )}

        {(g.subtasks?.length ?? 0) === 0 && (
          <div className="goal-field">
            <span>Count, if it has one (pages, videos)</span>
            <div className="flex gap-2">
              <Input type="number" inputMode="decimal" aria-label="Done so far" placeholder="Done so far" value={current} onChange={(e) => setCurrent(e.target.value)} className="flex-1" />
              <Input type="number" inputMode="decimal" aria-label="Total" placeholder="Total" value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1" />
            </div>
          </div>
        )}

        <label className="goal-field">
          <span>Link</span>
          <span className="flex gap-2">
            <Input
              type="url"
              aria-label="Link"
              placeholder="https://… the course or repository"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="flex-1"
            />
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="goal-link"
                aria-label="Open link"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
          </span>
        </label>


        {dirty && (
          <div>
            <Button variant="primary" onPress={() => void save()} isDisabled={pending || !name.trim()}>
              Save changes
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
