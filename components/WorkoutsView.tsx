"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Input } from "./ui";
import { Plus, Pencil, ArrowUp, ArrowDown, Check, X, CheckCircle2 } from "lucide-react";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { Tracker, Workout, Exercise, dateKey } from "@/lib/tracker";

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
  const { pending, run } = usePending();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const w = weight.trim() === "" ? null : Number(weight);
    const ok = await run(() => tracker.updateExercise(workout.id, exercise.id, name, w));
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-2 border-b border-foreground/10 py-2 last:border-b-0">
        <Input
          aria-label="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
          autoFocus
        />
        <Input
          type="number"
          aria-label="Weight in kg"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-24"
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
      <span className="font-mono-n shrink-0 text-[15px] font-semibold tabular-nums">
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

function WorkoutCard({ tracker, workout }: { tracker: Tracker; workout: Workout }) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(workout.name);
  const { pending, run } = usePending();

  const total = workout.exercises.reduce((sum, e) => sum + (e.weight ?? 0), 0);
  const doneToday = tracker
    .state!.workoutSessions.filter((x) => x.workoutId === workout.id && x.date === dateKey())
    .length;

  const closeAdd = () => {
    setName("");
    setWeight("");
    setAdding(false);
  };

  const onEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeAdd();
  };

  const addExercise = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !name.trim()) return;
    const w = weight.trim() === "" ? null : Number(weight);
    const ok = await run(() => tracker.addExercise(workout.id, name, w));
    if (ok) {
      // Stay open with the fields cleared — exercises are usually added in a run.
      setName("");
      setWeight("");
    }
  };

  return (
    <Card>
      <Card.Content className="p-4 sm:p-5">
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
              <h2 className="font-display min-w-0 flex-1 truncate text-lg font-bold tracking-tight">
                {workout.name}
              </h2>
              <span className="flex shrink-0 items-center gap-1">
                <span className="mr-1 text-xs text-foreground/50">
                  {workout.exercises.length}{" "}
                  {workout.exercises.length === 1 ? "exercise" : "exercises"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  aria-label={`Rename ${workout.name}`}
                  onPress={() => setRenaming(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <DeleteButton
                  what={`the workout "${workout.name}"`}
                  iconOnly
                  onDelete={() => tracker.removeWorkout(workout.id)}
                />
              </span>
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
          <form onSubmit={addExercise} className="mt-3 flex gap-2" onKeyDown={onEscape}>
            <Input
              aria-label={`Add an exercise to ${workout.name}`}
              placeholder="Bench press…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Input
              type="number"
              aria-label="Weight in kg"
              placeholder="kg"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-24"
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
            Total{" "}
            <span className="font-mono-n text-sm font-bold text-foreground">{total} kg</span>
            {doneToday > 0 && (
              <span className="ml-2">
                · done {doneToday}× today
              </span>
            )}
          </span>
          <Button
            className={"btn-success " + (pending ? "is-pending" : "")}
            isDisabled={pending || workout.exercises.length === 0}
            onPress={() => void run(() => tracker.completeWorkout(workout.id))}
          >
            <CheckCircle2 className="h-4 w-4" /> Mark as done
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

/* --------------------------------- view ---------------------------------- */

export default function WorkoutsView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
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
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="sec-dot" style={{ background: "var(--grad-primary)" }} aria-hidden />
            Workouts
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {s.workouts.length} {s.workouts.length === 1 ? "workout" : "workouts"}
          </p>
        </div>
        {!creating && (
          <Button variant="primary" onPress={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New workout
          </Button>
        )}
      </div>

      {creating ? (
        <Card>
          <Card.Content className="p-4 sm:p-5">
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
          </Card.Content>
        </Card>
      ) : null}

      {s.workouts.length === 0 ? (
        <Card>
          <Card.Content className="p-6">
            <p className="text-[15px] text-foreground/60">
              No workouts yet. Use “New workout” above — then add exercises to it, each with
              its working weight.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {s.workouts.map((w) => (
            <WorkoutCard key={w.id} tracker={tracker} workout={w} />
          ))}
        </div>
      )}
    </div>
  );
}
