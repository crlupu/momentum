"use client";

import { InsertRow } from "./InsertRow";
import { IconButton } from "./IconButton";
import { FormEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from "react";
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
import { Button, Input } from "./ui";
import {
  ReorderLines,
  Check,
  X,
  ChevronRight,
  CheckCircle2,
  Dumbbell,
  MoreHorizontal,
  OneArm,
  Hourglass,
  Plus,
  Trash2,
  Undo } from "./icons";
import { ActionMenu } from "./Menu";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { RowActions } from "./RowActions";
import { CardTiles, SummaryCard } from "./SummaryCard";
import { CircuitPlayer } from "./CircuitPlayer";
import {
  Tracker,
  Workout,
  WorkoutBlock,
  blockExercises,
  Exercise,
  ExerciseTarget,
  formatTarget,
  ActiveWorkout,
  ActiveSet,
  ActiveExercise,
  DEFAULT_REST,
  SetRecord,
  activeWorkoutVolume,
  activeWorkoutSets,
  activeWorkoutPlannedSets,
  lastPerformed } from "@/lib/tracker";

/* --------------------------------- blocks -------------------------------- */

/** A block's heading, its timings if it is a circuit, and its exercises. */
export function BlockSection({
  tracker,
  workout,
  block }: {
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
        blockId: block.id })
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

      <SortableExercises tracker={tracker} workout={workout} exercises={mine} />

      {adding ? (
        <form onSubmit={add} className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Add an exercise to ${block.name}`}
              placeholder="Push-ups"
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
        <InsertRow label={`Add to ${block.name}`} onPress={() => setAdding(true)} />
      )}
    </div>
  );
}

/** Creates a block. Its exercises are added to it afterwards. */
export function AddBlockRow({ tracker, workout }: { tracker: Tracker; workout: Workout }) {
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
      <InsertRow label="Add block" onPress={() => setOpen(true)} />
    );
  }

  return (
    <form onSubmit={add} className="flex w-full flex-col gap-2">
      <Input
        aria-label="Block name"
        placeholder="Warm-up"
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

type TargetDraft = { sets: string; repsMin: string; repsMax: string };

function targetDraft(t?: ExerciseTarget): TargetDraft {
  return {
    sets: t ? String(t.sets) : "",
    repsMin: t?.repsMin ? String(t.repsMin) : "",
    repsMax: t?.repsMax ? String(t.repsMax) : "",
  };
}

/** The draft as a target, or null to clear it: no sets, no target. */
function readTarget(d: TargetDraft): ExerciseTarget | null {
  const n = (v: string) => {
    const x = Number(v.replace(",", "."));
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  const sets = n(d.sets);
  if (!sets) return null;
  let repsMin = n(d.repsMin);
  let repsMax = n(d.repsMax);
  if (repsMin && repsMax && repsMax < repsMin) [repsMin, repsMax] = [repsMax, repsMin];
  if (!repsMin && repsMax) [repsMin, repsMax] = [repsMax, undefined];
  return {
    sets: Math.round(sets),
    ...(repsMin ? { repsMin: Math.round(repsMin) } : {}),
    ...(repsMax && repsMax !== repsMin ? { repsMax: Math.round(repsMax) } : {}),
  };
}

/** The recommendation, written the way it's said: sets × reps–reps. */
function TargetFields({ value, onChange }: { value: TargetDraft; onChange: (v: TargetDraft) => void }) {
  const field = (key: keyof TargetDraft, label: string, placeholder: string, width: string) => (
    <Input
      type="text"
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      value={value[key]}
      onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      className={`${width} shrink-0 text-center`}
    />
  );
  return (
    <div className="target-fields">
      <span className="target-fields__label">Target</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {field("sets", "Recommended sets", "sets", "w-14")}
        <span className="text-[var(--muted)]">×</span>
        {field("repsMin", "Fewest reps", "reps", "w-14")}
        <span className="text-[var(--muted)]">–</span>
        {field("repsMax", "Most reps", "max", "w-14")}
      </div>
    </div>
  );
}

/**
 * One list of a workout's exercises (the main body, or a block), reordered
 * by dragging a row's ≡ handle.
 */
function SortableExercises({
  tracker,
  workout,
  exercises }: {
  tracker: Tracker;
  workout: Workout;
  exercises: Exercise[];
}) {
  // Touch waits a moment before lifting a row, so scrolling past a handle doesn't pick it up.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = exercises.map((e) => e.id);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void tracker.reorderExercises(workout.id, arrayMove(ids, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div>
          {exercises.map((ex) => (
            <ExerciseRow key={ex.id} tracker={tracker} workout={workout} exercise={ex} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function ExerciseRow({
  tracker,
  workout,
  exercise }: {
  tracker: Tracker;
  workout: Workout;
  exercise: Exercise;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id,
  });
  const dragStyle = { transform: CSS.Transform.toString(transform), transition };
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [oneArm, setOneArm] = useState(!!exercise.oneArm);
  const [target, setTarget] = useState(() => targetDraft(exercise.target));
  const { pending, run } = usePending();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    // Closed on the press rather than on the network. The editor keeps what
    // was typed, so if the write is refused it reopens with the draft intact.
    setEditing(false);
    const ok = await run(() =>
      tracker.updateExercise(workout.id, exercise.id, name, null, oneArm, { target: readTarget(target) })
    );
    if (!ok) setEditing(true);
  };

  if (editing) {
    return (
      <form
        ref={setNodeRef}
        style={dragStyle}
        onSubmit={save}
        className="flex flex-wrap items-center gap-2 border-b border-foreground/10 py-2 last:border-b-0"
      >
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
            setTarget(targetDraft(exercise.target));
            setEditing(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        <TargetFields value={target} onChange={setTarget} />
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
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={"exercise-row group flex items-center gap-3 border-b border-foreground/10 py-2.5 last:border-b-0" + (isDragging ? " is-dragging" : "")}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px]">{exercise.name}</span>
        {exercise.target && (
          <span className="truncate font-mono-n text-xs text-[var(--muted)]">{formatTarget(exercise.target)}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <RowActions
                    name={exercise.name}
                    onEdit={() => setEditing(true)}
                    del={{ what: `the exercise "${exercise.name}"`, onDelete: () => tracker.removeExercise(workout.id, exercise.id) }}
                  />
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="rd-grip"
          aria-label={`Move ${exercise.name}`}
          {...attributes}
          {...listeners}
        >
          <ReorderLines className="h-6 w-6" />
        </button>
      </span>
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
export function Elapsed({ startedAt }: { startedAt: number }) {
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
  inputMode = "decimal" }: {
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
 * One set in the live workout, as a row of the exercise's table: its
 * number, last time's figures for reference, this time's weight and reps,
 * complete and remove. Completing it locks the figures.
 */
function SetRow({
  tracker,
  exerciseId,
  index,
  set,
  previous,
  onRemove,
  nudge,
  rest }: {
  tracker: Tracker;
  exerciseId: string;
  index: number;
  set: ActiveSet;
  /** The same set number from the last time this exercise was performed. */
  previous?: SetRecord;
  /** Swiped away (or removed from the hidden button). */
  onRemove: () => void;
  /** Peek left once to show the red behind it: the first-time hint. */
  nudge?: boolean;
  /** The next set to do, while the rest before it runs. */
  rest?: LastSet;
}) {
  const [tapped, tap] = useTapFeedback();
  const done = !!set.done;
  // While resting the row itself fills, "Resting" in place of its numbers;
  // full, the numbers come back outlined: ready. A tap shows them early.
  const now = useNow(!!rest);
  const [peeked, setPeeked] = useState<number | null>(null);
  const fill = rest ? Math.min(1, Math.max(0, now - rest.at) / (rest.rest * 1000)) : 0;
  const resting = !!rest && fill < 1 && peeked !== rest.at;
  const ready = !!rest && fill >= 1;

  const complete = () => {
    tap();
    void tracker.setSetDone(exerciseId, set.id, true);
  };

  return (
    <SwipeToDelete label={`Remove set ${index + 1}`} onDelete={onRemove} nudge={nudge}>
    <div className={["set-line", done ? "is-done" : "", tapped ? "is-tapped" : "", resting ? "is-resting" : "", ready ? "is-ready" : ""].filter(Boolean).join(" ")}>
      {resting && <span className="set-line__fill" style={{ inlineSize: `${fill * 100}%` }} aria-hidden />}
      <span className="set-line__no">{index + 1}</span>
      {resting ? (
        <button
          type="button"
          className="set-line__resting"
          role="progressbar"
          aria-label={`Resting before set ${index + 1}; tap to show its numbers`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fill * 100)}
          onClick={() => setPeeked(rest!.at)}
        >
          <Hourglass aria-hidden />
          Resting
        </button>
      ) : (
        <>
      {/* Last time's numbers: reference only, never editable. */}
      <span className="set-line__prev" aria-label={`Last time: ${formatSet(previous ?? {})}`}>
        {previous ? `${previous.weight ?? "–"} × ${previous.reps ?? "–"}` : "–"}
      </span>
      <NumberField
        label={`Weight for set ${index + 1}`}
        placeholder={previous?.weight != null ? String(previous.weight) : "kg"}
        value={set.weight}
        locked={done}
        onCommit={(n) => tracker.setSetWeight(exerciseId, set.id, n)}
      />
      <NumberField
        label={`Reps for set ${index + 1}`}
        placeholder={previous?.reps != null ? String(previous.reps) : "reps"}
        inputMode="numeric"
        value={set.reps}
        locked={done}
        onCommit={(n) => tracker.setSetReps(exerciseId, set.id, n)}
      />
        </>
      )}
      <IconButton
        label={done ? `Reopen set ${index + 1}` : `Complete set ${index + 1}`}
        pressed={done}
        onPress={() => (done ? void tracker.setSetDone(exerciseId, set.id, false) : complete())}
      >
        <span className={"icon-disc set-done" + (done ? " is-on" : "")}>
          <Check />
        </span>
      </IconButton>
    </div>
    </SwipeToDelete>
  );
}

const SWIPE_HINT_KEY = "momentum:swipe-set-hint";

/**
 * A row that deletes when swiped left past a third of its width, red with a
 * bin showing through as it goes. Vertical drags stay scrolls. For keyboards
 * and screen readers, a visually hidden button does the same.
 */
function SwipeToDelete({ label, onDelete, nudge, children }: { label: string; onDelete: () => void; nudge?: boolean; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragging = useRef(false);
  const width = useRef(1);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (leaving || (e.pointerType === "mouse" && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragging.current = false;
    width.current = e.currentTarget.offsetWidth || 1;
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!dragging.current) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) return void (start.current = null);
      if (mx > -10 || Math.abs(mx) < Math.abs(my)) return;
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    setDx(Math.min(0, mx));
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    if (!dragging.current) return;
    if (-dx > width.current / 3) {
      setLeaving(true);
      setDx(-width.current);
      window.setTimeout(onDelete, 180);
    } else setDx(0);
  };
  // A drag shouldn't also press what it started on.
  const click = (e: ReactMouseEvent) => {
    if (dragging.current) {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = false;
    }
  };

  const reach = Math.min(1, -dx / (width.current / 3));
  return (
    <div className={"swipe-row" + (nudge ? " is-nudging" : "")}>
      <div className="swipe-row__behind" style={{ opacity: dx ? 0.35 + reach * 0.65 : undefined }} aria-hidden>
        <Trash2 style={{ transform: `scale(${0.8 + reach * 0.3})` }} />
      </div>
      <div
        className="swipe-row__face"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: start.current ? "none" : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={click}
      >
        {children}
      </div>
      <button type="button" className="sr-only" onClick={onDelete}>
        {label}
      </button>
    </div>
  );
}

/**
 * One exercise inside the live workout: its name and target, then a table
 * of sets. Once marked done it collapses to a plain record of what was
 * lifted, a line per set, with nothing left to type into.
 */
function ExerciseBlock({
  tracker,
  exercise: e,
  history,
  lastSet }: {
  tracker: Tracker;
  exercise: ActiveExercise;
  history: { date: string; sets: SetRecord[] } | null;
  /** The workout's most recently completed set, for the rest clock. */
  lastSet: LastSet | null;
}) {
  const [tapped, tap] = useTapFeedback();
  const done = !!e.done;
  const doneCount = e.sets.filter((s) => s.done).length;
  const empty = e.sets.length === 0;
  // The set last swiped away, kept a few seconds for Undo.
  const [removed, setRemoved] = useState<{ set: ActiveSet; index: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const id = window.setTimeout(() => setRemoved(null), 5000);
    return () => window.clearTimeout(id);
  }, [removed]);
  // Until the first swipe, the last open set peeks to show the gesture.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    try {
      setHint(!localStorage.getItem(SWIPE_HINT_KEY));
    } catch {}
  }, []);
  const remove = (set: ActiveSet, index: number) => {
    setRemoved({ set, index });
    void tracker.removeSet(e.exerciseId, set.id);
    if (hint) {
      setHint(false);
      try {
        localStorage.setItem(SWIPE_HINT_KEY, "1");
      } catch {}
    }
  };
  const lastOpen = [...e.sets].reverse().find((x) => !x.done);
  // The rest shows on the next set to do: its row fills while it runs.
  const nextIndex = e.sets.findIndex((x) => !x.done);
  const undo = removed && (
    <div className="set-undo" role="status">
      <span>Set {removed.index + 1} removed</span>
      <button
        type="button"
        className="pill-link"
        onClick={() => {
          void tracker.restoreSet(e.exerciseId, removed.set, removed.index);
          setRemoved(null);
        }}
      >
        <Undo aria-hidden /> Undo
      </button>
    </div>
  );

  const finish = () => {
    tap();
    void tracker.setExerciseDone(e.exerciseId, true);
  };

  return (
    <div
      id={`ex-${e.exerciseId}`}
      className={["exercise", done ? "exercise--done" : "", tapped ? "is-tapped" : ""].filter(Boolean).join(" ")}
    >
      <div className="exercise__head">
        <span className="exercise__name">{e.name}</span>
        {/* Done one side at a time: the kg are for one arm. */}
        {e.oneArm && (
          <span className="one-arm-tag" role="img" aria-label="One arm" title="One arm">
            <OneArm aria-hidden />
          </span>
        )}
        {e.target && (
          <span className="exercise__target" aria-label={`Recommended: ${formatTarget(e.target)}`}>
            {formatTarget(e.target)}
          </span>
        )}
        {/* Reopen sits here once done; finishing is the button under the sets. */}
        {!empty && done && (
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
        )}
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
          {!empty && (
            <div className="set-line set-line--head" aria-hidden>
              <span>Set</span>
              <span>Previous</span>
              <span>kg</span>
              <span>Reps</span>
              <span>Done</span>
            </div>
          )}
          {e.sets.map((s, i) => (
            <div key={s.id} className="set-slot">
              {removed?.index === i && undo}
              <SetRow
                tracker={tracker}
                exerciseId={e.exerciseId}
                set={s}
                index={i}
                previous={history?.sets[i]}
                onRemove={() => remove(s, i)}
                nudge={hint && s === lastOpen}
                rest={i === nextIndex && lastSet && lastSet.rest > 0 ? lastSet : undefined}
              />
            </div>
          ))}
          {removed && removed.index >= e.sets.length && undo}
          {/* The next set, waiting: tapping it adds a copy of the last one. */}
          <button type="button" className="set-add" onClick={() => void tracker.addSet(e.exerciseId)}>
            <span className="set-add__label">Add new set</span>
            <span className="icon-disc set-add__plus" aria-hidden>
              <Plus />
            </span>
          </button>
          {!empty && (
            <button type="button" className="exercise__finish" onClick={finish}>
              <Check aria-hidden /> Finish {e.name}
            </button>
          )}
          {!empty && (
            <p className="exercise__count">
              <span>
                {doneCount} of {e.sets.length} done
              </span>
              {lastSet && !lastSet.rest && <SinceLastSet last={lastSet} />}
            </p>
          )}
          {hint && e.sets.length > 0 && <p className="swipe-hint">Swipe a set left to delete it</p>}
        </>
      )}
    </div>
  );
}

type LastSet = { at: number; set: number; name: string; rest: number };

/**
 * The workout's most recently completed set, if any, with the rest its
 * exercise asks for, read from the definition so a change made mid-session
 * applies at once.
 */
function lastSetOf(active: ActiveWorkout, definition?: Workout): LastSet | null {
  let last: LastSet | null = null;
  for (const e of active.exercises) {
    const rest = definition?.exercises.find((d) => d.id === e.exerciseId)?.restSeconds ?? DEFAULT_REST;
    e.sets.forEach((x, i) => {
      if (x.done && x.doneAt && (!last || x.doneAt > last.at)) last = { at: x.doneAt, set: i + 1, name: e.name, rest };
    });
  }
  return last;
}

/** The time, ticking once a second while on. */
function useNow(on = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

/** With the rest off: how long since the last set, counting up. */
function SinceLastSet({ last }: { last: LastSet }) {
  const now = useNow();
  return (
    <span className="exercise__rest" role="timer" aria-label={`Since set ${last.set} of ${last.name}`}>
      Rest <span className="font-mono-n tabular-nums">{formatElapsed(now - last.at)}</span>
    </span>
  );
}


/**
 * The workout so far, without a clock (the title has it, and the rest
 * runs under the sets): sets done, an exercise per tile, the figures.
 */
function WorkoutProgress({ active }: { active: ActiveWorkout }) {
  const setsDone = active.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const setsPlanned = active.exercises.reduce((a, e) => a + e.sets.length, 0);
  const exDone = active.exercises.filter((e) => e.sets.length > 0 && e.sets.every((x) => x.done)).length;
  const current = active.exercises.find((e) => e.sets.some((x) => !x.done));
  return (
    <SummaryCard
      className="since-set-card"
      aria-label="Workout progress"
      label="Workout"
      aside={current ? `Now · ${current.name}` : undefined}
      done={setsPlanned > 0 && setsDone === setsPlanned}
      doneLabel="Every set done"
      figure={`${setsDone} of ${setsPlanned}`}
      detail="sets"
      figures={[
        { value: exDone, label: `of ${active.exercises.length} done` },
        { value: setsPlanned - setsDone, label: "sets to go" },
      ]}
    >
      {active.exercises.length > 1 && (
        <CardTiles
          items={active.exercises.slice(0, 8).map((e) => {
            const all = e.sets.length > 0 && e.sets.every((x) => x.done);
            return {
              key: e.exerciseId,
              icon: <Dumbbell aria-hidden />,
              title: e.name,
              state: (all ? "done" : e === current ? "next" : "todo") as "done" | "next" | "todo",
            };
          })}
        />
      )}
    </SummaryCard>
  );
}

/** Beside the live workout's title: its clock and its menu. */
export function LiveActions({ tracker, active }: { tracker: Tracker; active: ActiveWorkout }) {
  return (
    <span className="live-actions">
      <span className="live-workout__clock">
        <Elapsed startedAt={active.startedAt} />
      </span>
      <ActionMenu
        label="Workout options"
        className="live-workout__more"
        items={[{ label: "Cancel workout", danger: true, onSelect: () => void tracker.cancelWorkout() }]}
      >
        <MoreHorizontal aria-hidden />
      </ActionMenu>
    </span>
  );
}

/** The workout in progress. Nothing here is logged until it is finished. */
export function ActiveWorkoutPanel({
  tracker,
  active }: {
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
      exercises: active.exercises.filter((e) => e.blockId === block.id) }))
    .filter((c) => c.exercises.length > 0);
  const circuitIds = new Set(circuits.flatMap((c) => c.exercises.map((e) => e.exerciseId)));
  const plain = active.exercises.filter((e) => !circuitIds.has(e.exerciseId));
  // The exercise being worked on: the first not marked done, until another
  // is picked from the chips. Only that one is on screen; the next one after
  // it waits under "Up next".
  const [picked, setPicked] = useState<string | null>(null);
  const currentIdx = plain.findIndex((e) => !e.done);
  const shown = plain.find((e) => e.exerciseId === picked) ?? plain[currentIdx] ?? plain[plain.length - 1];
  const shownIdx = shown ? plain.indexOf(shown) : -1;
  const upNext = shownIdx >= 0 ? plain.slice(shownIdx + 1).find((e) => !e.done) ?? plain.find((e, i) => i !== shownIdx && !e.done) : undefined;

  return (
    <div className="live-workout">
      {plain.length > 1 && (
        <div className="live-workout__chips" role="list" aria-label="Exercises">
          {plain.map((e, i) => {
            const d = e.sets.filter((x) => x.done).length;
            return (
              <button
                key={e.exerciseId}
                type="button"
                role="listitem"
                aria-pressed={i === shownIdx}
                className={"live-chip" + (i === shownIdx ? " is-current" : "") + (e.done ? " is-done" : "")}
                onClick={() => setPicked(e.exerciseId)}
              >
                {e.oneArm && <OneArm className="live-chip__hand" aria-label="One arm" />}
                {e.name} · {d}/{e.sets.length}
              </button>
            );
          })}
        </div>
      )}

      <WorkoutProgress active={active} />

      {/* Circuit blocks are run by the clock rather than filled in by hand, so
          they get the timer instead of set rows. */}
      {circuits.map(({ block, exercises }) => (
        <div key={block.id} className="mb-3">
          <CircuitPlayer tracker={tracker} block={block} exercises={exercises} />
        </div>
      ))}

      {shown && (
        <ExerciseBlock
          key={shown.exerciseId}
          tracker={tracker}
          exercise={shown}
          history={lastPerformed(sessions, shown.exerciseId)}
          lastSet={lastSetOf(active, definition)}
        />
      )}

      {upNext && (
        <button
          type="button"
          className="live-next"
          onClick={() => setPicked(upNext.exerciseId)}
        >
          <span className="flex min-w-0 flex-1 flex-col text-start">
            <span className="live-next__label">Up next</span>
            <span className="live-next__name">
              {upNext.name}
              {upNext.oneArm && <OneArm className="live-chip__hand" aria-label="One arm" />}
            </span>
          </span>
          {upNext.target && <span className="live-next__target">{formatTarget(upNext.target)}</span>}
          <ChevronRight className="group-row__chev" aria-hidden />
        </button>
      )}

      <div className="live-workout__foot live-workout__dock">
        {/* The running time leads, so it stays in view however far down. */}
        <span className="live-workout__tally">
          <span className="live-workout__time">
            <Elapsed startedAt={active.startedAt} />
          </span>
          <span>
            {sets} of {planned} {planned === 1 ? "set" : "sets"} · {total.toLocaleString()} kg
          </span>
        </span>
        <Button
          variant="primary"
          // Enabled once anything has been done. A circuit is ticked off by
          // the clock and never records a set, so requiring one left the
          // button dead for the whole of a timed workout.
          isDisabled={pending || (sets === 0 && !active.exercises.some((e) => e.done))}
          onPress={() => void run(() => tracker.finishWorkout())}
        >
          Finish workout
        </Button>
      </div>
    </div>
  );
}
