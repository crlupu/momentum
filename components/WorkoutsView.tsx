"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, Input } from "./ui";
import {
  Plus,
  Pencil,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  ChevronRight,
  CheckCircle2,
  Copy,
} from "./icons";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { useConfigEditing } from "./ConfigCard";
import {
  Tracker,
  Workout,
  Exercise,
  dateKey,
  ActiveWorkout,
  ActiveSet,
  ActiveExercise,
  SetRecord,
  activeWorkoutVolume,
  activeWorkoutSets,
  activeWorkoutPlannedSets,
  lastPerformed,
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
  const [oneArm, setOneArm] = useState(!!exercise.oneArm);
  const { pending, run } = usePending();

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    // Closed on the press rather than on the network. The editor keeps what
    // was typed, so if the write is refused it reopens with the draft intact.
    setEditing(false);
    const ok = await run(() =>
      tracker.updateExercise(workout.id, exercise.id, name, num(weight), oneArm)
    );
    if (!ok) setEditing(true);
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
          step="any"
          inputMode="decimal"
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
            setOneArm(!!exercise.oneArm);
            setEditing(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        {/* Its own line: the row above is a name, a weight and two buttons,
            and a label reading "one arm" does not abbreviate usefully. */}
        <label className="exercise-onearm">
          <input
            type="checkbox"
            checked={oneArm}
            onChange={(e) => setOneArm(e.target.checked)}
          />
          One arm — counts double
        </label>
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-3 border-b border-foreground/10 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-[15px]">
        {exercise.name}
        {exercise.oneArm && <span className="exercise-tag">1 arm</span>}
      </span>
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
  const [newOneArm, setNewOneArm] = useState(false);
  const [title, setTitle] = useState(workout.name);
  const { pending, run } = usePending();

  const doneToday = tracker
    .state!.workoutSessions.filter((x) => x.workoutId === workout.id && x.date === dateKey())
    .length;

  const closeAdd = () => {
    setName("");
    setWeight("");
    setNewOneArm(false);
    setAdding(false);
  };

  const onEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeAdd();
  };

  const addExercise = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !name.trim()) return;
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const typed = { name, weight, oneArm: newOneArm };
    // Clear straight away: the row is added optimistically, so waiting on the
    // save left the fields holding text that had already been committed.
    setName("");
    setWeight("");
    setNewOneArm(false);
    const ok = await run(() =>
      tracker.addExercise(workout.id, typed.name, num(typed.weight), typed.oneArm)
    );
    if (!ok) {
      setName(typed.name);
      setWeight(typed.weight);
      setNewOneArm(typed.oneArm);
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

        {/* The add row never wraps: the cancel button belongs beside the field
            it cancels, not stranded on a line of its own. The name field
            carries min-w-0 so it is what gets squeezed. */}
        {adding ? (
          <form onSubmit={addExercise} className="mt-3 flex items-center gap-2" onKeyDown={onEscape}>
            <Input
              aria-label={`Add an exercise to ${workout.name}`}
              placeholder="Bench press…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1"
              autoFocus
            />
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              aria-label="Weight in kg"
              placeholder="kg"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-16 shrink-0"
            />
            <Button
              type="submit"
              variant="primary"
              isIconOnly
              className="shrink-0"
              aria-label="Add exercise"
              isDisabled={pending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              isIconOnly
              className="shrink-0"
              aria-label="Done adding exercises"
              onPress={closeAdd}
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : null}
        {adding ? (
          <label className="exercise-onearm">
            <input
              type="checkbox"
              checked={newOneArm}
              onChange={(e) => setNewOneArm(e.target.checked)}
            />
            One arm — counts double
          </label>
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

/** "60 kg × 10 reps", with whichever half is missing left out. */
function formatSet(set: SetRecord): string {
  const parts: string[] = [];
  if (set.weight != null) parts.push(`${set.weight} kg`);
  if (set.reps != null) parts.push(`${set.reps} reps`);
  return parts.length ? parts.join(" × ") : "–";
}

/**
 * A number field that writes through to the store rather than holding a draft:
 * it commits shortly after typing stops as well as on blur, so a value is never
 * lost just because the field still had focus when the phone locked.
 */
function NumberField({
  label,
  value,
  onCommit,
  placeholder,
  locked,
  inputMode = "decimal",
}: {
  label: string;
  value?: number;
  onCommit: (n: number | null) => void;
  placeholder: string;
  locked?: boolean;
  inputMode?: "decimal" | "numeric";
}) {
  const stored = value?.toString() ?? "";
  const [text, setText] = useState(stored);

  // Keep in step when the store changes underneath (e.g. another device).
  useEffect(() => setText(stored), [stored]);

  const commit = () => {
    if (text === stored) return;
    onCommit(text.trim() === "" ? null : Number(text));
  };

  useEffect(() => {
    if (text === stored) return;
    const id = setTimeout(commit, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, stored]);

  return (
    <Input
      type="number"
      // A number input without a step accepts whole numbers only, so 12.5 kg
      // was a step mismatch and the browser refused it. Reps are counted, so
      // they keep the whole-number step; a weight is measured and does not.
      step={inputMode === "decimal" ? "any" : "1"}
      inputMode={inputMode}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      disabled={locked}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      className="min-w-0 flex-1"
    />
  );
}

/**
 * Fires the tap animation on an element and buzzes the phone. The feedback is
 * meant to read as the press itself landing rather than as a celebration
 * afterwards, so it is short and it is over before the finger is clear.
 */
function useTapFeedback(): [boolean, () => void] {
  const [tapped, setTapped] = useState(false);
  useEffect(() => {
    if (!tapped) return;
    const id = setTimeout(() => setTapped(false), 320);
    return () => clearTimeout(id);
  }, [tapped]);
  return [
    tapped,
    () => {
      setTapped(true);
      if (typeof navigator !== "undefined") navigator.vibrate?.(18);
    },
  ];
}

/**
 * One set in the live workout. A set is planned first and performed second, so
 * the row carries its own numbers, last session's numbers for reference, and a
 * single button that turns the first into the second.
 */
function SetRow({
  tracker,
  exerciseId,
  index,
  set,
  previous,
}: {
  tracker: Tracker;
  exerciseId: string;
  index: number;
  set: ActiveSet;
  /** The same set number from the last time this exercise was performed. */
  previous?: SetRecord;
}) {
  const [tapped, tap] = useTapFeedback();
  const done = !!set.done;

  const complete = () => {
    tap();
    void tracker.setSetDone(exerciseId, set.id, true);
  };

  const className = ["set-row", done ? "set-row--done" : "", tapped ? "is-tapped" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="set-row__head">
        <span className="set-row__index">Set {index + 1}</span>

        {/* Last time's numbers: reference only, never editable. */}
        <span className="set-row__prev" aria-label={`Last time: ${formatSet(previous ?? {})}`}>
          {previous ? `last · ${formatSet(previous)}` : "no history"}
        </span>
      </div>

      <div className="set-row__body">
        <NumberField
          label={`Weight for set ${index + 1}`}
          placeholder="kg"
          value={set.weight}
          locked={done}
          onCommit={(n) => tracker.setSetWeight(exerciseId, set.id, n)}
        />
        <span className="set-row__times" aria-hidden>
          ×
        </span>
        <NumberField
          label={`Reps for set ${index + 1}`}
          placeholder="reps"
          inputMode="numeric"
          value={set.reps}
          locked={done}
          onCommit={(n) => tracker.setSetReps(exerciseId, set.id, n)}
        />

        <span className="set-row__actions">
          <span className="set-row__do">
            {done ? (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                className="set-row__undo"
                aria-label={`Reopen set ${index + 1}`}
                onPress={() => void tracker.setSetDone(exerciseId, set.id, false)}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                isIconOnly
                className="btn-success"
                aria-label={`Complete set ${index + 1}`}
                onPress={complete}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            aria-label={`Duplicate set ${index + 1}`}
            onPress={() => void tracker.duplicateSet(exerciseId, set.id)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label={`Remove set ${index + 1}`}
            onPress={() => void tracker.removeSet(exerciseId, set.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>
    </div>
  );
}

/**
 * One exercise inside the live workout. While it is being worked through it
 * shows an editable row per set; once marked done it collapses to a plain
 * record of what was lifted, a line per set, with nothing left to type into.
 */
function ExerciseBlock({
  tracker,
  exercise: e,
  history,
}: {
  tracker: Tracker;
  exercise: ActiveExercise;
  history: { date: string; sets: SetRecord[] } | null;
}) {
  const [tapped, tap] = useTapFeedback();
  const done = !!e.done;
  const doneCount = e.sets.filter((s) => s.done).length;
  const empty = e.sets.length === 0;

  const finish = () => {
    tap();
    void tracker.setExerciseDone(e.exerciseId, true);
  };

  return (
    <div
      className={["exercise", done ? "exercise--done" : "", tapped ? "is-tapped" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px]">{e.name}</span>
        <span className="shrink-0 text-xs text-foreground/50">
          {empty ? "no sets" : `${doneCount}/${e.sets.length} done`}
        </span>
        {/* Only offered once there is something to finish. */}
        {!empty &&
          (done ? (
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              className="exercise__reopen shrink-0"
              aria-label={`Reopen ${e.name}`}
              onPress={() => void tracker.setExerciseDone(e.exerciseId, false)}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="shrink-0" onPress={finish}>
              <Check className="h-3.5 w-3.5" /> Done
            </Button>
          ))}
      </div>

      {done ? (
        <ul className="exercise__record">
          {e.sets.map((s, i) => (
            <li key={s.id}>
              <span className="exercise__record-index">{i + 1}</span>
              <span className="exercise__record-value">{formatSet(s)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="space-y-2">
            {e.sets.map((s, i) => (
              <SetRow
                key={s.id}
                tracker={tracker}
                exerciseId={e.exerciseId}
                set={s}
                index={i}
                previous={history?.sets[i]}
              />
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onPress={() => void tracker.addSet(e.exerciseId)}
          >
            <Plus className="h-3.5 w-3.5" /> Add set
          </Button>
        </>
      )}
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
  const planned = activeWorkoutPlannedSets(active);
  const sessions = tracker.state!.workoutSessions;

  return (
    <div className="card p-4 md:p-5" style={{ borderColor: "var(--accent)" }}>
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
          <ExerciseBlock
            key={e.exerciseId}
            tracker={tracker}
            exercise={e}
            history={lastPerformed(sessions, e.exerciseId)}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3">
        <span className="text-xs text-foreground/60">
          {sets} of {planned} {planned === 1 ? "set" : "sets"} ·{" "}
          <span className="font-mono-n text-sm font-bold text-foreground">
            {total.toLocaleString()} kg
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Button variant="outline" isDisabled={pending} onPress={() => tracker.cancelWorkout()}>
            Cancel
          </Button>
          <Button
            className="btn-success"
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
