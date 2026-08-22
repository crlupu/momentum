"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "./ui";
import { Check, Play, X } from "./icons";
import { ActiveExercise, WorkoutBlock, Tracker, exerciseSeconds } from "@/lib/tracker";

/** One thing the timer is doing: working at an exercise, or resting after it. */
type Step = {
  kind: "work" | "rest";
  exercise: ActiveExercise;
  seconds: number;
  round: number;
  /** Position among the work steps, for "3 of 7". */
  index: number;
};

/**
 * Lays the whole block out in advance — every exercise, every round, with the
 * rests between — so the timer only ever has to count down and move on. The
 * last rest is dropped: resting after the final exercise is just stopping.
 */
function buildSteps(block: WorkoutBlock, exercises: ActiveExercise[]): Step[] {
  const rounds = Math.max(1, block.rounds ?? 1);
  const rest = block.restSeconds ?? 0;
  const steps: Step[] = [];
  for (let r = 0; r < rounds; r++) {
    exercises.forEach((e, i) => {
      steps.push({
        kind: "work",
        exercise: e,
        seconds: exerciseSeconds({ id: e.exerciseId, name: e.name, seconds: e.seconds }, block),
        round: r + 1,
        index: i,
      });
      const isLast = r === rounds - 1 && i === exercises.length - 1;
      if (rest > 0 && !isLast) {
        steps.push({ kind: "rest", exercise: e, seconds: rest, round: r + 1, index: i });
      }
    });
  }
  return steps;
}

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : String(s);
}

/**
 * Runs a timed block.
 *
 * The countdown is worked out from a start timestamp rather than by
 * decrementing a counter each tick: a phone throttles timers in a backgrounded
 * tab, and a counter would simply lose the seconds it was not ticked for —
 * putting the screen in a pocket mid-set would leave the clock behind. Reading
 * the difference from a fixed instant is right whenever it is next read.
 */
export function CircuitPlayer({
  tracker,
  block,
  exercises,
}: {
  tracker: Tracker;
  block: WorkoutBlock;
  exercises: ActiveExercise[];
}) {
  const steps = buildSteps(block, exercises);
  const [at, setAt] = useState(0);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(steps[0]?.seconds ?? 0);
  const endsAt = useRef<number>(0);

  const step = steps[at];
  const workSteps = steps.filter((s) => s.kind === "work").length;
  /**
   * Whether the block is finished, taken from its exercises rather than from a
   * flag here: the last round marks each one done, and reading that survives
   * the component being re-rendered by anything else on the page.
   */
  const finished = exercises.length > 0 && exercises.every((e) => e.done);
  // Steps behind the current one, plus the one in progress once it is over.
  // Counting only what is strictly behind left the last step uncounted, so a
  // finished block read 20 of 21 and never reached the end.
  const workDone = finished
    ? workSteps
    : steps.slice(0, at).filter((s) => s.kind === "work").length;

  /** A short buzz at each change, so the phone can be face down in a pocket. */
  const buzz = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined") navigator.vibrate?.(pattern);
  };

  const goTo = useCallback(
    (i: number) => {
      setAt(i);
      setLeft(steps[i]?.seconds ?? 0);
      endsAt.current = Date.now() + (steps[i]?.seconds ?? 0) * 1000;
    },
    // steps is rebuilt each render but its shape only changes with the block
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [block.id, exercises.length]
  );

  useEffect(() => {
    if (!running || !step) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining > 0) return;

      // The step is over. Mark a finished exercise off on the last round, so
      // the workout's record reflects what was actually performed.
      if (step.kind === "work" && step.round === Math.max(1, block.rounds ?? 1)) {
        void tracker.setExerciseDone(step.exercise.exerciseId, true);
      }
      if (at + 1 >= steps.length) {
        setRunning(false);
        buzz([80, 60, 80, 60, 160]);
        return;
      }
      buzz(steps[at + 1].kind === "work" ? [30, 40, 60] : 30);
      goTo(at + 1);
    }, 200);
    return () => clearInterval(id);
  }, [running, at, step, steps, goTo, block.rounds, tracker]);

  const start = () => {
    endsAt.current = Date.now() + left * 1000;
    setRunning(true);
    buzz(30);
  };

  if (!step) {
    return (
      <p className="py-2 text-[15px] text-foreground/60">
        No exercises in this block yet.
      </p>
    );
  }

  /**
   * A finished block folds away to its name and a tick.
   *
   * Once it is done there is nothing left to read in it, and a workout of two
   * blocks would otherwise keep a spent clock and a list of seven exercises on
   * screen above the one still to do. Pressing it opens it again, for a round
   * more or to correct a mis-tap.
   */
  if (finished) {
    return (
      <button
        type="button"
        className="circuit circuit--done"
        onClick={() => {
          void Promise.all(
            exercises.map((e) => tracker.setExerciseDone(e.exerciseId, false))
          ).then(() => goTo(0));
        }}
      >
        <span className="circuit__done-tick" aria-hidden>
          <Check className="h-4 w-4" />
        </span>
        <span className="circuit__done-name">{block.name}</span>
        <span className="circuit__done-meta">
          {workSteps} of {workSteps} · done
        </span>
      </button>
    );
  }

  const resting = step.kind === "rest";
  const rounds = Math.max(1, block.rounds ?? 1);
  const pct = step.seconds > 0 ? ((step.seconds - left) / step.seconds) * 100 : 0;

  return (
    <div className={"circuit" + (resting ? " circuit--rest" : "")}>
      <div className="circuit__top">
        <span className="circuit__phase">
          {block.name} · {resting ? "Rest" : "Work"}
        </span>
        <span className="circuit__count">
          Round {step.round}/{rounds} · {workDone}/{workSteps}
        </span>
      </div>

      <p className="circuit__name">{resting ? `Next: ${steps[at + 1]?.exercise.name ?? "—"}` : step.exercise.name}</p>
      {!resting && step.exercise.note && <p className="circuit__note">{step.exercise.note}</p>}

      <p className="circuit__clock">{mmss(left)}</p>
      <span className="circuit__bar" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </span>

      <div className="circuit__actions">
        {running ? (
          <Button variant="outline" onPress={() => setRunning(false)}>
            Pause
          </Button>
        ) : (
          <Button variant="primary" onPress={start}>
            <Play className="h-4 w-4" /> {left === step.seconds ? "Start" : "Resume"}
          </Button>
        )}
        <Button
          variant="outline"
          isDisabled={at + 1 >= steps.length}
          onPress={() => {
            buzz(20);
            goTo(at + 1);
          }}
        >
          Skip
        </Button>
        <Button
          variant="ghost"
          isIconOnly
          aria-label="Start the block again"
          onPress={() => {
            setRunning(false);
            goTo(0);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* The whole block, so it can be read ahead of time rather than only one
          exercise at a time. */}
      <ul className="circuit__list">
        {exercises.map((e, i) => (
          <li key={e.exerciseId} className={i === step.index ? "is-now" : ""}>
            <span className="circuit__tick" aria-hidden>
              {e.done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <span className="font-mono-n text-xs text-foreground/50">
              {mmss(exerciseSeconds({ id: e.exerciseId, name: e.name, seconds: e.seconds }, block))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CircuitPlayer;
