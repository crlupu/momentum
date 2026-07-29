"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { Plus, Pencil, ArrowUp, ArrowDown, Check, X, CheckCircle2, ChevronRight } from "lucide-react";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import {
  Tracker,
  Workout,
  Exercise,
  dateKey,
  workoutVolume,
  exerciseVolume,
  DEFAULT_SETS,
  DEFAULT_REPS,
} from "@/lib/tracker";

/** "70 kg", or a dash when the movement carries no weight. */
function formatWeight(w?: number): string {
  return typeof w === "number" ? `${w} kg` : "–";
}

/* ------------------------------ exercise row ----------------------------- */

function ExerciseRow({
  tracker,
  workout,
  exercise,
  index,
  count,
}: {
  tracker: Tracker;
  workout: Workout;
  exercise: Exercise;
  index: number;
  count: number;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [weight, setWeight] = useState(exercise.weight?.toString() ?? "");
  const [sets, setSets] = useState(String(exercise.sets ?? DEFAULT_SETS));
  const [reps, setReps] = useState(String(exercise.reps ?? DEFAULT_REPS));
  const { pending, run } = usePending();

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const ok = await run(() =>
      tracker.updateExercise(workout.id, exercise.id, name, num(weight), num(sets), num(reps))
    );
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2 border-b border-foreground/10 py-2 last:border-b-0">
        <Input
          aria-label="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[8rem] flex-1"
          autoFocus
        />
        <Input
          type="number"
          aria-label="Sets"
          placeholder="sets"
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          className="w-[4.5rem]"
        />
        <Input
          type="number"
          aria-label="Reps"
          placeholder="reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="w-[4.5rem]"
        />
        <Input
          type="number"
          aria-label="Weight in kg"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-[4.5rem]"
        />
        <Button
          type="submit"
          size="sm"
          variant="primary"
          isIconOnly
          aria-label="Save exercise"
          isDisabled={pending}
          className={pending ? "is-pending" : ""}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Cancel"
          onPress={() => {
            setName(exercise.name);
            setWeight(exercise.weight?.toString() ?? "");
            setSets(String(exercise.sets ?? DEFAULT_SETS));
            setReps(String(exercise.reps ?? DEFAULT_REPS));
            setEditing(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-3 border-b border-foreground/10 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-[15px]">{exercise.name}</span>
      <span className="font-mono-n shrink-0 text-xs tabular-nums text-foreground/60">
        {exercise.sets ?? DEFAULT_SETS} × {exercise.reps ?? DEFAULT_REPS}
      </span>
      <span
        className="font-mono-n shrink-0 text-[15px] font-semibold tabular-nums"
        title={`${exerciseVolume(exercise)} kg of volume`}
      >
        {formatWeight(exercise.weight)}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`Move ${exercise.name} up`}
          isDisabled={index === 0}
          onPress={() => tracker.moveExercise(workout.id, exercise.id, -1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`Move ${exercise.name} down`}
          isDisabled={index === count - 1}
          onPress={() => tracker.moveExercise(workout.id, exercise.id, 1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label={`Edit ${exercise.name}`}
          onPress={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <DeleteButton
          what={`the exercise "${exercise.name}"`}
          iconOnly
          onDelete={() => tracker.removeExercise(workout.id, exercise.id)}
        />
      </span>
    </div>
  );
}

/* -------------------------------- workout -------------------------------- */

function WorkoutEditor({ tracker, workout }: { tracker: Tracker; workout: Workout }) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  // Sets and reps start at the common default so most entries are one field.
  const [sets, setSets] = useState(String(DEFAULT_SETS));
  const [reps, setReps] = useState(String(DEFAULT_REPS));
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(workout.name);
  const { pending, run } = usePending();
  // Its own flag, so an unrelated write doesn't disable it.
  const { pending: doneP, run: runDone } = usePending();

  const total = workoutVolume(workout);
  const doneToday = tracker
    .state!.workoutSessions.filter((x) => x.workoutId === workout.id && x.date === dateKey())
    .length;

  const closeAdd = () => {
    setName("");
    setWeight("");
    setSets(String(DEFAULT_SETS));
    setReps(String(DEFAULT_REPS));
    setAdding(false);
  };

  const onEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeAdd();
  };

  const addExercise = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !name.trim()) return;
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const ok = await run(() =>
      tracker.addExercise(workout.id, name, num(weight), num(sets), num(reps))
    );
    if (ok) {
      // Stay open, keeping sets and reps — they rarely change between exercises.
      setName("");
      setWeight("");
    }
  };

  return (
    <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          {renaming ? (
            <form
              className="flex flex-1 items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await run(() => tracker.renameWorkout(workout.id, title));
                if (ok) setRenaming(false);
              }}
            >
              <Input
                aria-label="Workout name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" size="sm" variant="primary" isIconOnly aria-label="Save name">
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                isIconOnly
                aria-label="Cancel rename"
                onPress={() => {
                  setTitle(workout.name);
                  setRenaming(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <>
              {/* the list row above already shows the name and delete */}
              <Button size="sm" variant="outline" onPress={() => setRenaming(true)}>
                <Pencil className="h-3.5 w-3.5" /> Rename
              </Button>
            </>
          )}
        </div>

        {workout.exercises.length === 0 ? (
          <p className="py-2 text-[15px] text-foreground/60">
            No exercises yet. Add the first one below.
          </p>
        ) : (
          <div>
            {/* column headings, so the weight column reads as a column */}
            <div className="flex items-center gap-3 border-b border-foreground/10 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
              <span className="flex-1">Exercise</span>
              <span>Sets × reps</span>
              <span>Weight</span>
              <span className="w-[132px]" aria-hidden />
            </div>
            {workout.exercises.map((ex, i) => (
              <ExerciseRow
                key={ex.id}
                tracker={tracker}
                workout={workout}
                exercise={ex}
                index={i}
                count={workout.exercises.length}
              />
            ))}
          </div>
        )}

        {adding ? (
          <form onSubmit={addExercise} className="mt-3 flex flex-wrap gap-2" onKeyDown={onEscape}>
            <Input
              aria-label={`Add an exercise to ${workout.name}`}
              placeholder="Bench press…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-[8rem] flex-1"
              autoFocus
            />
            <Input
              type="number"
              aria-label="Sets"
              placeholder="sets"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              className="w-[4.5rem]"
            />
            <Input
              type="number"
              aria-label="Reps"
              placeholder="reps"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-[4.5rem]"
            />
            <Input
              type="number"
              aria-label="Weight in kg"
              placeholder="kg"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-[4.5rem]"
            />
            <Button
              type="submit"
              variant="primary"
              isIconOnly
              aria-label="Add exercise"
              isDisabled={pending}
              className={pending ? "is-pending" : ""}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              isIconOnly
              aria-label="Done adding exercises"
              onPress={closeAdd}
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <Button variant="outline" className="mt-3" onPress={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add exercise
          </Button>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3">
          <span className="text-xs text-foreground/60">
            Volume{" "}
            <span className="font-mono-n text-sm font-bold text-foreground">
              {total.toLocaleString()} kg
            </span>
            {doneToday > 0 && (
              <span className="ml-2">
                · done {doneToday}× today
              </span>
            )}
          </span>
          <Button
            className={"btn-success " + (doneP ? "is-pending" : "")}
            isDisabled={doneP || workout.exercises.length === 0}
            onPress={() => void runDone(() => tracker.completeWorkout(workout.id))}
          >
            <CheckCircle2 className="h-4 w-4" /> Mark as done
          </Button>
        </div>
    </div>
  );
}

/* --------------------------------- view ---------------------------------- */

/** One row in the configuration list: title, then edit and delete. */
function WorkoutRow({
  tracker,
  workout,
  expanded,
  onToggle,
}: {
  tracker: Tracker;
  workout: Workout;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-foreground/10 last:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <ChevronRight
            className={"h-4 w-4 shrink-0 transition-transform " + (expanded ? "rotate-90" : "")}
            aria-hidden
          />
          <span className="truncate text-[15px]">{workout.name}</span>
          <span className="shrink-0 text-xs text-foreground/50">
            {workout.exercises.length}
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            aria-label={`Edit ${workout.name}`}
            onPress={onToggle}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <DeleteButton
            what={`the workout "${workout.name}"`}
            iconOnly
            onDelete={() => tracker.removeWorkout(workout.id)}
          />
        </span>
      </div>

      {expanded && (
        <div className="pb-3">
          <WorkoutEditor tracker={tracker} workout={workout} />
        </div>
      )}
    </div>
  );
}

export default function WorkoutsView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { pending, run } = usePending();

  const closeCreate = () => {
    setName("");
    setCreating(false);
  };

  const onEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeCreate();
  };

  const addWorkout = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !name.trim()) return;
    const ok = await run(() => tracker.addWorkout(name));
    if (ok) closeCreate();
  };

  return (
    <div>
      {s.workouts.length === 0 && !creating ? (
        <p className="mb-3 text-[15px] text-foreground/60">
          No workouts yet.
        </p>
      ) : (
        <div className="mb-3">
          {s.workouts.map((w) => (
            <WorkoutRow
              key={w.id}
              tracker={tracker}
              workout={w}
              expanded={openId === w.id}
              onToggle={() => setOpenId(openId === w.id ? null : w.id)}
            />
          ))}
        </div>
      )}

      {creating ? (
        <form onSubmit={addWorkout} className="flex gap-2" onKeyDown={onEscape}>
          <Input
            aria-label="New workout name"
            placeholder="Push day…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button
            type="submit"
            variant="primary"
            isDisabled={pending}
            className={pending ? "is-pending" : ""}
          >
            <Check className="h-4 w-4" /> Create
          </Button>
          <Button variant="outline" isIconOnly aria-label="Cancel" onPress={closeCreate}>
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <Button variant="outline" onPress={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New workout
        </Button>
      )}
    </div>
  );
}
