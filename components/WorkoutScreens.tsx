"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
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
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Modal } from "./Modal";
import { DialogActions } from "./DialogActions";
import { DeleteButton } from "./DeleteButton";
import { InsertRow } from "./InsertRow";
import { RepeatSelect } from "./RepeatSelect";
import { AddBlockRow, BlockSection } from "./WorkoutsView";
import { ChevronRight, Minus, Plus, ReorderLines } from "./icons";
import { usePending } from "./ActionButton";
import { Tracker, blockExercises, formatTarget, type Exercise, type ExerciseTarget, type Workout } from "@/lib/tracker";

/** Every workout, each a row that opens its page; New Workout at the end. */
export function WorkoutsList({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <ul className="group-list">
        {s.workouts.map((w) => (
          <li key={w.id}>
            <Link href={`/fitness?view=workout&id=${w.id}`} className="group-row">
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{w.name}</span>
                <span className="text-[13px] text-[var(--muted)]">
                  {w.exercises.length} {w.exercises.length === 1 ? "exercise" : "exercises"}
                </span>
              </span>
              <ChevronRight className="group-row__chev" aria-hidden />
            </Link>
          </li>
        ))}
        <li>
          <InsertRow label="New Workout" onPress={() => setCreating(true)} />
        </li>
      </ul>
      <Modal open={creating} onClose={() => setCreating(false)} title="New Workout">
        {creating && <NewWorkoutForm tracker={tracker} onDone={() => setCreating(false)} />}
      </Modal>
    </div>
  );
}

function NewWorkoutForm({ tracker, onDone }: { tracker: Tracker; onDone: () => void }) {
  const [name, setName] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onDone();
    await tracker.addWorkout(name);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <input
        aria-label="Workout name"
        placeholder="Workout name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="sheet-field"
        autoFocus
      />
      <DialogActions primary={{ label: "Add Workout", disabled: !name.trim() }} />
    </form>
  );
}

/**
 * One workout, edited: its name and how often it comes round, its
 * exercises (each a row with a dash to remove it, opened by a tap, dragged
 * into order by its handle), its blocks, and Delete Workout apart at the
 * bottom.
 */
export function WorkoutScreen({ tracker, workout, onDeleted }: { tracker: Tracker; workout: Workout; onDeleted: () => void }) {
  const [name, setName] = useState(workout.name);
  useEffect(() => setName(workout.name), [workout.name]);
  const [sheet, setSheet] = useState<Exercise | "new" | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const main = blockExercises(workout, undefined);
  const ids = main.map((e) => e.id);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void tracker.reorderExercises(workout.id, arrayMove(ids, from, to));
  };
  const saveName = () => {
    if (name.trim() && name.trim() !== workout.name) void tracker.renameWorkout(workout.id, name);
    else setName(workout.name);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="group-list">
        <label className="group-row">
          <span className="w-20 flex-none">Name</span>
          <input
            aria-label="Workout name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="row-input"
          />
        </label>
        <div className="group-row">
          <span className="flex-1">Repeat</span>
          <RepeatSelect tracker={tracker} kind="workout" item={workout} inline />
        </div>
      </div>

      <section>
        <h3 className="group-head">Exercises</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="group-list">
              {main.map((ex) => (
                <ExerciseLine key={ex.id} tracker={tracker} workout={workout} exercise={ex} onOpen={() => setSheet(ex)} />
              ))}
              <li>
                <InsertRow label="Add Exercise" onPress={() => setSheet("new")} />
              </li>
            </ul>
          </SortableContext>
        </DndContext>
        <p className="group-foot">Tap an exercise to change its target. Drag ≡ to reorder.</p>
      </section>

      <section>
        <h3 className="group-head">Blocks</h3>
        <div className="workout-blocks">
          {(workout.blocks ?? []).map((b) => (
            <BlockSection key={b.id} tracker={tracker} workout={workout} block={b} />
          ))}
          <AddBlockRow tracker={tracker} workout={workout} />
        </div>
      </section>

      <div className="group-list">
        <DeleteButton
          what={`the workout "${workout.name}"`}
          label="Delete Workout"
          fullWidth
          className="path-edit__delete"
          onDelete={async () => {
            onDeleted();
            return tracker.removeWorkout(workout.id);
          }}
        />
      </div>

      <Modal
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet === "new" ? "New Exercise" : sheet ? sheet.name : ""}
        save={{ label: sheet === "new" ? "Add" : "Save", form: "exercise-sheet" }}
      >
        {sheet && (
          <ExerciseSheet
            key={sheet === "new" ? "new" : sheet.id}
            tracker={tracker}
            workout={workout}
            exercise={sheet === "new" ? null : sheet}
            onDone={() => setSheet(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/** An exercise as a row: the dash removes it, the row opens it, the handle drags it. */
function ExerciseLine({
  tracker,
  workout,
  exercise,
  onOpen,
}: {
  tracker: Tracker;
  workout: Workout;
  exercise: Exercise;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id,
  });
  return (
    <li
      ref={setNodeRef}
      className={"group-row exercise-line" + (isDragging ? " is-dragging" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <DeleteButton
        iconOnly
        dash
        what={`the exercise "${exercise.name}"`}
        onDelete={() => tracker.removeExercise(workout.id, exercise.id)}
      />
      <button type="button" className="exercise-line__open" onClick={onOpen}>
        <span>{exercise.name}</span>
        <span className="text-[13px] text-[var(--muted)]">
          {exercise.target ? formatTarget(exercise.target) : "No target"}
          {exercise.oneArm ? " · one arm" : ""}
        </span>
      </button>
      <button type="button" ref={setActivatorNodeRef} className="rd-grip" aria-label={`Move ${exercise.name}`} {...attributes} {...listeners}>
        <ReorderLines className="h-6 w-6" />
      </button>
    </li>
  );
}

/**
 * Adding or editing an exercise: its name, sets with − and +, the rep
 * range, and whether it's done one arm at a time. Delete sits at the
 * bottom when editing.
 */
function ExerciseSheet({
  tracker,
  workout,
  exercise,
  onDone,
}: {
  tracker: Tracker;
  workout: Workout;
  exercise: Exercise | null;
  onDone: () => void;
}) {
  const t = exercise?.target;
  const [name, setName] = useState(exercise?.name ?? "");
  const [sets, setSets] = useState(t?.sets ?? 3);
  const [repsMin, setRepsMin] = useState(t?.repsMin ? String(t.repsMin) : "");
  const [repsMax, setRepsMax] = useState(t?.repsMax ? String(t.repsMax) : "");
  const [oneArm, setOneArm] = useState(!!exercise?.oneArm);
  const { pending, run } = usePending();

  const target = (): ExerciseTarget | null => {
    if (sets <= 0) return null;
    let lo = Number(repsMin) || undefined;
    let hi = Number(repsMax) || undefined;
    if (lo && hi && hi < lo) [lo, hi] = [hi, lo];
    if (!lo && hi) [lo, hi] = [hi, undefined];
    return { sets, ...(lo ? { repsMin: Math.round(lo) } : {}), ...(hi && hi !== lo ? { repsMax: Math.round(hi) } : {}) };
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pending) return;
    onDone();
    await run(() =>
      exercise
        ? tracker.updateExercise(workout.id, exercise.id, name, null, oneArm, { target: target() })
        : tracker.addExercise(workout.id, name, null, oneArm, { target: target() })
    );
  };

  return (
    <form id="exercise-sheet" onSubmit={submit} className="flex flex-col gap-5">
      <div className="group-list">
        <label className="group-row">
          <span className="w-20 flex-none">Name</span>
          <input
            aria-label="Exercise name"
            placeholder="Lat pulldown"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="row-input"
            autoFocus={!exercise}
          />
        </label>
      </div>

      <section>
        <h3 className="group-head">Target</h3>
        <div className="group-list">
          <div className="group-row">
            <span className="flex-1">Sets</span>
            <span className="font-mono-n w-6 text-center">{sets}</span>
            <span className="set-stepper">
              <button type="button" aria-label="Fewer sets" onClick={() => setSets((n) => Math.max(0, n - 1))}>
                <Minus aria-hidden />
              </button>
              <button type="button" aria-label="More sets" onClick={() => setSets((n) => Math.min(20, n + 1))}>
                <Plus aria-hidden />
              </button>
            </span>
          </div>
          <div className="group-row">
            <span className="flex-1">Reps</span>
            <input aria-label="Fewest reps" inputMode="numeric" placeholder="8" value={repsMin} onChange={(e) => setRepsMin(e.target.value.replace(/\D/g, ""))} className="mini-field" />
            <span className="text-[var(--muted)]">to</span>
            <input aria-label="Most reps" inputMode="numeric" placeholder="12" value={repsMax} onChange={(e) => setRepsMax(e.target.value.replace(/\D/g, ""))} className="mini-field" />
          </div>
        </div>
      </section>

      <section>
        <h3 className="group-head">Arms</h3>
        <div className="arm-choice" role="radiogroup" aria-label="Arms">
          <button type="button" role="radio" aria-checked={!oneArm} onClick={() => setOneArm(false)} className="arm-choice__opt">
            Both arms
            <span>counts once</span>
          </button>
          <button type="button" role="radio" aria-checked={oneArm} onClick={() => setOneArm(true)} className="arm-choice__opt">
            One arm
            <span>counts double</span>
          </button>
        </div>
      </section>

      {exercise && (
        <div className="group-list">
          <DeleteButton
            what={`the exercise "${exercise.name}"`}
            label="Delete Exercise"
            fullWidth
            className="path-edit__delete"
            onDelete={async () => {
              onDone();
              return tracker.removeExercise(workout.id, exercise.id);
            }}
          />
        </div>
      )}
    </form>
  );
}
