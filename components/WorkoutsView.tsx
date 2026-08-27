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
import { CircuitPlayer } from "./CircuitPlayer";
import {
  Tracker,
  Workout,
  WorkoutBlock,
  blockExercises,
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

/* --------------------------------- blocks -------------------------------- */

/** A block's heading, its timings if it is a circuit, and its exercises. */
function BlockSection({
  tracker,
  workout,
  block,
}: {
  tracker: Tracker;
  workout: Workout;
  block: WorkoutBlock;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [secs, setSecs] = useState("");
  const [note, setNote] = useState("");
  const { pending, run } = usePending();
  const mine = blockExercises(workout, block.id);
  const circuit = block.mode === "circuit";

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pending) return;
    const typed = { name, secs, note };
    setName("");
    setSecs("");
    setNote("");
    const ok = await run(() =>
      tracker.addExercise(workout.id, typed.name, null, false, {
        seconds: num(typed.secs),
        note: typed.note,
        blockId: block.id,
      })
    );
    if (!ok) {
      setName(typed.name);
      setSecs(typed.secs);
      setNote(typed.note);
    }
  };

  return (
    <div className="cfg-block">
      <div className="cfg-block__head">
        <span className="cfg-block__name">{block.name}</span>
        <span className="cfg-block__mode">{circuit ? "circuit" : "sets"}</span>
        <DeleteButton
          what={`the block "${block.name}"`}
          iconOnly
          bare
          onDelete={() => tracker.removeBlock(workout.id, block.id)}
        />
      </div>

      {circuit && (
        <div className="cfg-block__timing">
          {(
            [
              ["rounds", "Rounds", block.rounds ?? 3],
              ["workSeconds", "Work s", block.workSeconds ?? 40],
              ["restSeconds", "Rest s", block.restSeconds ?? 20],
            ] as const
          ).map(([key, label, value]) => (
            <label key={key} className="cfg-block__field">
              {label}
              <Input
                type="number"
                inputMode="numeric"
                aria-label={`${block.name} ${label}`}
                value={String(value)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0) {
                    void tracker.updateBlock(workout.id, block.id, { [key]: n });
                  }
                }}
              />
            </label>
          ))}
        </div>
      )}

      {mine.map((ex) => (
        <ExerciseRow
          key={ex.id}
          tracker={tracker}
          workout={workout}
          exercise={ex}
          index={workout.exercises.indexOf(ex)}
          count={workout.exercises.length}
        />
      ))}

      {adding ? (
        <form onSubmit={add} className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Add an exercise to ${block.name}`}
              placeholder="Push-ups…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1"
              autoFocus
            />
            {/* Blank means the block's own work interval; a figure here is for
                a movement that runs longer or shorter than the rest. */}
            <Input
              type="number"
              inputMode="numeric"
              aria-label="Seconds"
              placeholder="secs"
              value={secs}
              onChange={(e) => setSecs(e.target.value)}
              className="w-16 shrink-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              aria-label="Cue"
              placeholder="Cue (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="primary" isIconOnly aria-label="Add exercise to block" isDisabled={pending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="outline" isIconOnly aria-label="Done adding" onPress={() => setAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" className="mt-2" onPress={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add to {block.name}
        </Button>
      )}
    </div>
  );
}

/** Creates a block. Its exercises are added to it afterwards. */
function AddBlockRow({ tracker, workout }: { tracker: Tracker; workout: Workout }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"sets" | "circuit">("circuit");
  const { pending, run } = usePending();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pending) return;
    const typed = name;
    setName("");
    setOpen(false);
    const ok = await run(() => tracker.addBlock(workout.id, typed, mode));
    if (!ok) {
      setName(typed);
      setOpen(true);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onPress={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add block
      </Button>
    );
  }

  return (
    <form onSubmit={add} className="flex w-full flex-col gap-2">
      <Input
        aria-label="Block name"
        placeholder="Warm-up…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className={mode === "circuit" ? "pill-selected" : ""}
          onPress={() => setMode("circuit")}
        >
          Timed circuit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={mode === "sets" ? "pill-selected" : ""}
          onPress={() => setMode("sets")}
        >
          Sets
        </Button>
        <span className="ml-auto flex gap-2">
          <Button type="submit" variant="primary" isIconOnly aria-label="Add block" isDisabled={pending}>
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="outline" isIconOnly aria-label="Cancel block" onPress={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </span>
      </div>
    </form>
  );
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
  const [oneArm, setOneArm] = useState(!!exercise.oneArm);
  const { pending, run } = usePending();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    // Closed on the press rather than on the network. The editor keeps what
    // was typed, so if the write is refused it reopens with the draft intact.
    setEditing(false);
    const ok = await run(() =>
      tracker.updateExercise(workout.id, exercise.id, name, null, oneArm)
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
            setOneArm(!!exercise.oneArm);
            setEditing(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        {/* Its own line: a label reading "one arm" does not abbreviate into
            the row above. */}
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
      <span className="min-w-0 flex-1 truncate text-[15px]">{exercise.name}</span>
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
  const [adding, setAdding] = useState(false);
  const [newOneArm, setNewOneArm] = useState(false);
  const { pending, run } = usePending();

  const doneToday = tracker
    .state!.workoutSessions.filter((x) => x.workoutId === workout.id && x.date === dateKey())
    .length;

  const closeAdd = () => {
    setName("");
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
    const typed = { name, oneArm: newOneArm };
    // Clear straight away: the row is added optimistically, so waiting on the
    // save left the fields holding text that had already been committed.
    setName("");
    setNewOneArm(false);
    // No weight: a set takes its numbers from the last time the exercise was
    // performed, so asking for one here was asking for a figure nothing read.
    const ok = await run(() =>
      tracker.addExercise(workout.id, typed.name, null, typed.oneArm)
    );
    if (!ok) {
      setName(typed.name);
      setNewOneArm(typed.oneArm);
    }
  };

  return (
    <div>
        {workout.exercises.length === 0 && (workout.blocks ?? []).length === 0 ? (
          <p className="py-2 text-[15px] text-foreground/60">
            No exercises yet. Add the first one below.
          </p>
        ) : (
          <div>
            {/* The main body first — exercises in no block — then each block
                under its own heading. */}
            {blockExercises(workout, undefined).map((ex) => (
              <ExerciseRow
                key={ex.id}
                tracker={tracker}
                workout={workout}
                exercise={ex}
                index={workout.exercises.indexOf(ex)}
                count={workout.exercises.length}
              />
            ))}

            {(workout.blocks ?? []).map((b) => (
              <BlockSection key={b.id} tracker={tracker} workout={workout} block={b} />
            ))}
          </div>
        )}

        {/* Both add controls share a row with a gap. They were siblings in
            flow, so the two buttons sat against each other with nothing
            between them. Each form takes the full width, pushing the other
            control onto its own line while it is open. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
        <AddBlockRow tracker={tracker} workout={workout} />

        {/* The add row never wraps: the cancel button belongs beside the field
            it cancels, not stranded on a line of its own. The name field
            carries min-w-0 so it is what gets squeezed. */}
        {adding ? (
          <form onSubmit={addExercise} className="flex w-full items-center gap-2" onKeyDown={onEscape}>
            <Input
              aria-label={`Add an exercise to ${workout.name}`}
              placeholder="Bench press…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1"
              autoFocus
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
          <Button variant="outline" onPress={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add exercise
          </Button>
        )}
        </div>

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
  const decimal = inputMode === "decimal";
  const stored = value?.toString() ?? "";
  const [text, setText] = useState(stored);

  // Keep in step when the store changes underneath (e.g. another device).
  useEffect(() => setText(stored), [stored]);

  const commit = () => {
    if (text === stored) return;
    const cleaned = text.trim().replace(",", ".");
    if (cleaned === "") return onCommit(null);
    const n = Number(cleaned);
    // A half-typed "12." parses as 12, which would be committed as the weight
    // if typing paused there. Only a number that is actually finished counts.
    if (!Number.isFinite(n) || cleaned.endsWith(".")) return;
    // Reps are whole. Anything after the separator is dropped rather than
    // rounded: 8.5 repetitions is not a thing that happened, and 8 is the
    // half of it that certainly did.
    onCommit(decimal ? n : Math.floor(n));
  };

  useEffect(() => {
    if (text === stored) return;
    const id = setTimeout(commit, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, stored]);

  return (
    <Input
      /*
       * Text, not number.
       *
       * A number input drops whatever it cannot parse, and what it can parse
       * depends on the keyboard: a Romanian or German phone offers a comma as
       * the decimal key, and "12,5" arrived as "125" — ten times the weight,
       * silently. It also reports a half-typed "12." as "12", so pausing
       * mid-number committed the wrong figure.
       *
       * Holding the raw text and parsing it here accepts either separator and
       * knows when a number is unfinished. inputMode still asks the phone for
       * the numeric keypad, so nothing changes about what is easy to type.
       */
      type="text"
      inputMode={inputMode}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      disabled={locked}
      onChange={(e) => {
        const raw = e.target.value;
        // Digits and at most one separator, in both fields. Refusing the
        // separator outright in the reps field looked tidier but was worse:
        // React restores the rejected keystroke, so "8,5" arrived as "8"
        // then "85" — a tenfold error, silently. Better to let it be typed
        // and drop the fraction when it is read.
        if (/^[0-9]*[.,]?[0-9]*$/.test(raw)) setText(raw);
      }}
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

  // The definition holds the blocks; the live copy only knows which block each
  // exercise came from, so they are paired back up here.
  const definition = tracker.state!.workouts.find((w) => w.id === active.workoutId);
  const circuits = (definition?.blocks ?? [])
    .filter((b) => b.mode === "circuit")
    .map((block) => ({
      block,
      exercises: active.exercises.filter((e) => e.blockId === block.id),
    }))
    .filter((c) => c.exercises.length > 0);
  const circuitIds = new Set(circuits.flatMap((c) => c.exercises.map((e) => e.exerciseId)));
  const plain = active.exercises.filter((e) => !circuitIds.has(e.exerciseId));

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

      {/* Circuit blocks are run by the clock rather than filled in by hand, so
          they get the timer instead of set rows. Anything not in a circuit
          block — including every workout that has no blocks at all — is
          unchanged. */}
      {circuits.map(({ block, exercises }) => (
        <div key={block.id} className="mb-3">
          <CircuitPlayer tracker={tracker} block={block} exercises={exercises} />
        </div>
      ))}

      <div className="space-y-3">
        {plain.map((e) => (
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
            // Enabled once anything has been done. A circuit is ticked off by
            // the clock and never records a set, so requiring one left the
            // button dead for the whole of a timed workout.
            isDisabled={pending || (sets === 0 && !active.exercises.some((e) => e.done))}
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
  // Renaming happens here, on the name already shown, rather than on a second
  // copy of it inside the editor below.
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(workout.name);
  const { run } = usePending();

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setRenaming(false);
    const ok = await run(() => tracker.renameWorkout(workout.id, title));
    if (ok === false) setRenaming(true);
  };

  return (
    <div className="border-b border-foreground/10 last:border-b-0">
      <div className="cfg-row">
        {renaming ? (
          <form onSubmit={saveName} className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              aria-label="Workout name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1"
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
        ) : editing ? (
          <>
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
            <span className="cfg-meta">
              {workout.exercises.length}{" "}
              {workout.exercises.length === 1 ? "exercise" : "exercises"}
            </span>
            <span className="cfg-actions">
              {/* The pencil renames. Opening the workout is the row itself,
                  which the chevron already says. */}
              <Button
                size="sm"
                variant="outline"
                isIconOnly
                aria-label={`Rename ${workout.name}`}
                onPress={() => {
                  setTitle(workout.name);
                  setRenaming(true);
                }}
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
        ) : (
          <>
            <span className="cfg-label">{workout.name}</span>
            <span className="cfg-meta">
              {workout.exercises.length}{" "}
              {workout.exercises.length === 1 ? "exercise" : "exercises"}
            </span>
          </>
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
