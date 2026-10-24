"use client";

import { useState } from "react";
import { Button } from "./ui";
import { ChevronDown, Play } from "./icons";
import { Modal } from "./Modal";
import { ActiveWorkoutPanel } from "./WorkoutsView";
import { Tracker, dateKey } from "@/lib/tracker";
import { REPEAT_LABEL, repeatOf, routines } from "@/lib/routines";
import { daysBetween } from "@/lib/reading";

/**
 * What to train today, at the top of Fitness: the workout that's due (one
 * not done yet this period, the one waiting longest first), started in one
 * tap; the arrow picks another. While a workout is under way, it shows that
 * instead.
 */
export function UpNextWorkout({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [choosing, setChoosing] = useState(false);
  if (s.activeWorkout) return <ActiveWorkoutPanel tracker={tracker} active={s.activeWorkout} />;

  const today = dateKey();
  const startable = s.workouts.filter((w) => w.exercises.length > 0);
  if (startable.length === 0) return null;
  const lastDone = (id: string) =>
    s.workoutSessions
      .filter((x) => x.workoutId === id)
      .map((x) => x.date)
      .sort()
      .pop();
  const due = routines(s, today)
    .filter((r) => r.kind === "workout" && !r.done)
    .map((r) => startable.find((w) => w.id === r.id))
    .filter((w): w is (typeof startable)[number] => !!w)
    .sort((a, b) => (lastDone(a.id) ?? "").localeCompare(lastDone(b.id) ?? ""));
  const next = due[0] ?? startable[0];
  const last = lastDone(next.id);
  const ago = last ? daysBetween(last, today) : null;
  const freq = repeatOf("workout", next);

  return (
    <section className="up-next">
      <p className="up-next__label">{due.length ? "Up next" : "All done for now"}</p>
      <div className="up-next__head">
        <h2 className="up-next__name">{next.name}</h2>
        <span className="up-next__meta">
          {next.exercises.length} {next.exercises.length === 1 ? "exercise" : "exercises"}
        </span>
      </div>
      <p className="up-next__meta">
        {freq !== "off" ? `${REPEAT_LABEL[freq]} · ` : ""}
        {ago == null ? "not done yet" : ago === 0 ? "done today" : `last done ${ago} day${ago === 1 ? "" : "s"} ago`}
      </p>
      <div className="up-next__actions">
        <Button variant="primary" className="flex-1 justify-center" onPress={() => void tracker.startWorkout(next.id)}>
          <Play className="h-4 w-4" /> Start {next.name}
        </Button>
        {startable.length > 1 && (
          <button type="button" className="up-next__pick" aria-label="Choose another workout" onClick={() => setChoosing(true)}>
            <ChevronDown aria-hidden />
          </button>
        )}
      </div>

      <Modal open={choosing} onClose={() => setChoosing(false)} title="Start a workout">
        <ul className="group-list">
          {startable.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="group-row"
                onClick={() => {
                  setChoosing(false);
                  void tracker.startWorkout(w.id);
                }}
              >
                <span className="flex-1">{w.name}</span>
                <span className="group-row__value">
                  {w.exercises.length} {w.exercises.length === 1 ? "exercise" : "exercises"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}
