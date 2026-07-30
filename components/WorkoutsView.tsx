"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, Input } from "./ui";
import { Plus, Pencil, ArrowUp, ArrowDown, Check, X, ChevronRight, CheckCircle2 } from "lucide-react";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { useConfigEditing } from "./ConfigCard";
import {
  Tracker,
  Workout,
  Exercise,
  dateKey,
  ActiveWorkout,
  activeWorkoutVolume,
  activeWorkoutSets,
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
  const { pending, run } = usePending();

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const ok = await run(() =>
      tracker.updateExercise(workout.id, exercise.id, name, num(weight))
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

function WorkoutEditor({ tracker, workout }: { tracker: Tracker; workout: Workout }) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(workout.name);
  const { pending, run } = usePending();
  // Its own flag, so an unrelated write doesn't disable it.
  const { pending: doneP, run: runDone } = usePending();


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
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const typed = { name, weight };
    // Clear straight away: the row is added optimistically, so waiting on the
    // save left the fields holding text that had already been committed.
    setName("");
    setWeight("");
    const ok = await run(() => tracker.addExercise(workout.id, typed.name, num(typed.weight)));
    if (!ok) {
      setName(typed.name);
      setWeight(typed.weight);
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
            {workout.exercises.length}{" "}
            {workout.exercises.length === 1 ? "exercise" : "exercises"}
            {doneToday > 0 && <span className="ml-2">· done {doneToday}× today</span>}
          </span>
          <span className="text-xs text-foreground/50">Start it from Fitness</span>
        </div>
    </div>
  );
}


/* ---------------------------- live workout ------------------------------- */

/** mm:ss while under an hour, then h:mm:ss. */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Ticks once a second while a workout is running. */
function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono-n tabular-nums" aria-label="Time elapsed">
      {formatElapsed(now - startedAt)}
    </span>
  );
}

/** A single recorded set: its weight is editable while the workout runs. */
function SetRow({
  tracker,
  exerciseId,
  index,
  weight,
  setId,
}: {
  tracker: Tracker;
  exerciseId: string;
  index: number;
  weight?: number;
  setId: string;
}) {
  const stored = weight?.toString() ?? "";
  const [value, setValue] = useState(stored);

  // Keep in step when the store changes underneath (e.g. another device).
  useEffect(() => setValue(stored), [stored]);

  const commit = () => {
    if (value === stored) return;
    const n = value.trim() === "" ? null : Number(value);
    tracker.setSetWeight(exerciseId, setId, n);
  };

  // Commit shortly after typing stops as well as on blur, so a weight is never
  // lost just because the field still had focus.
  useEffect(() => {
    if (value === stored) return;
    const id = setTimeout(commit, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, stored]);

  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-foreground/50">Set {index + 1}</span>
      <Input
        type="number"
        aria-label={`Weight for set ${index + 1}`}
        placeholder="kg"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        className="w-24"
      />
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`Remove set ${index + 1}`}
        onPress={() => tracker.removeSet(exerciseId, setId)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** The workout in progress. Nothing here is logged until it is finished. */
export function ActiveWorkoutPanel({
  tracker,
  active,
}: {
  tracker: Tracker;
  active: ActiveWorkout;
}) {
  const { pending, run } = usePending();
  const total = activeWorkoutVolume(active);
  const sets = activeWorkoutSets(active);

  return (
    <div className="card p-4 sm:p-5" style={{ borderColor: "var(--accent)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight">
          <span className="sec-dot" style={{ background: "var(--sec-fitness)" }} aria-hidden />
          <span className="truncate">{active.name}</span>
        </h3>
        <span className="shrink-0 text-sm text-foreground/70">
          <Elapsed startedAt={active.startedAt} />
        </span>
      </div>

      <div className="space-y-3">
        {active.exercises.map((e) => (
          <div key={e.exerciseId} className="border-b border-foreground/10 pb-3 last:border-b-0">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-[15px]">{e.name}</span>
              <span className="shrink-0 text-xs text-foreground/50">
                {e.sets.length} {e.sets.length === 1 ? "set" : "sets"}
              </span>
            </div>
            <div className="space-y-2">
              {e.sets.map((s, i) => (
                <SetRow
                  key={s.id}
                  tracker={tracker}
                  exerciseId={e.exerciseId}
                  setId={s.id}
                  index={i}
                  weight={s.weight}
                />
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onPress={() => tracker.addSet(e.exerciseId)}
            >
              <Plus className="h-3.5 w-3.5" /> Add set
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3">
        <span className="text-xs text-foreground/60">
          {sets} {sets === 1 ? "set" : "sets"} ·{" "}
          <span className="font-mono-n text-sm font-bold text-foreground">
            {total.toLocaleString()} kg
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Button variant="outline" isDisabled={pending} onPress={() => tracker.cancelWorkout()}>
            Cancel
          </Button>
          <Button
            className={"btn-success " + (pending ? "is-pending" : "")}
            isDisabled={pending || sets === 0}
            onPress={() => void run(() => tracker.finishWorkout())}
          >
            <CheckCircle2 className="h-4 w-4" /> Mark as done
          </Button>
        </span>
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
  editing,
}: {
  tracker: Tracker;
  workout: Workout;
  expanded: boolean;
  onToggle: () => void;
  editing: boolean;
}) {
  return (
    <div className="border-b border-foreground/10 last:border-b-0">
      <div className="cfg-row">
        {editing ? (
          <button
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={expanded}
          >
            <ChevronRight
              className={"h-3.5 w-3.5 shrink-0 transition-transform " + (expanded ? "rotate-90" : "")}
              aria-hidden
            />
            <span className="truncate text-[15px]">{workout.name}</span>
          </button>
        ) : (
          <span className="cfg-label">{workout.name}</span>
        )}
        <span className="cfg-meta">
          {workout.exercises.length}{" "}
          {workout.exercises.length === 1 ? "exercise" : "exercises"}
        </span>
        {editing && (
          <span className="cfg-actions">
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
        )}
      </div>

      {expanded && editing && (
        <div className="pb-3">
          <WorkoutEditor tracker={tracker} workout={workout} />
        </div>
      )}
    </div>
  );
}

export default function WorkoutsView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const editing = useConfigEditing();
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
    const typed = name;
    closeCreate();
    const ok = await run(() => tracker.addWorkout(typed));
    if (!ok) {
      setName(typed);
      setCreating(true);
    }
  };

  return (
    <div>
      {s.workouts.length === 0 && !creating ? (
        <p className="cfg-empty">No workouts yet.</p>
      ) : (
        <div className="mb-3">
          {s.workouts.map((w) => (
            <WorkoutRow
              key={w.id}
              tracker={tracker}
              workout={w}
              expanded={openId === w.id}
              editing={editing}
              onToggle={() => setOpenId(openId === w.id ? null : w.id)}
            />
          ))}
        </div>
      )}

      {editing && creating ? (
        <form onSubmit={addWorkout} className="cfg-add" onKeyDown={onEscape}>
          <Input
            aria-label="New workout name"
            placeholder="Push day…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-[8rem] flex-1"
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
      ) : editing ? (
        <Button variant="outline" className="cfg-add" onPress={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New workout
        </Button>
      ) : null}
    </div>
  );
}
