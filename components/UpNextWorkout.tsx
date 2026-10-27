"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui";
import { ChevronDown, Play } from "./icons";
import { Modal } from "./Modal";
import { Elapsed } from "./WorkoutsView";
import { Tracker, dateKey, activeWorkoutSets, activeWorkoutPlannedSets } from "@/lib/tracker";
import { REPEAT_LABEL, repeatOf, routines } from "@/lib/routines";
import { daysBetween } from "@/lib/reading";
import { weekOf } from "@/lib/plan";
import { CardTiles, SummaryCard, type CardFigure } from "./SummaryCard";
import { Dumbbell } from "./icons";

/** The week's training, as the card's figures: workouts, kg lifted, cardio. */
function weekFigures(tracker: Tracker): CardFigure[] {
  const s = tracker.state!;
  const from = weekOf(dateKey());
  const sessions = s.workoutSessions.filter((x) => x.date >= from);
  const kg = sessions.reduce((a, x) => a + (x.total || 0), 0);
  const cardio = s.cardio.filter((c) => c.date >= from).reduce((a, c) => a + c.minutes, 0);
  return [
    { value: sessions.length, label: "workouts", href: "/fitness?view=workouts" },
    { value: kg.toLocaleString(), label: "kg lifted", href: "/fitness?view=training" },
    { value: cardio, label: "min cardio", href: "/fitness?view=training" },
  ];
}

/**
 * What to train today, at the top of Fitness: the workout that's due (one
 * not done yet this period, the one waiting longest first), started in one
 * tap; the arrow picks another. Starting one opens the live workout, a
 * screen of its own. While a workout is under way, this shows it, with the
 * way back in.
 */
export function UpNextWorkout({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const start = (id: string) => {
    void tracker.startWorkout(id);
    router.push("/fitness?view=live");
  };
  if (s.activeWorkout) {
    const a = s.activeWorkout;
    return (
      <SummaryCard
        label="In progress"
        aside={
          <span className="font-mono-n">
            <Elapsed startedAt={a.startedAt} />
          </span>
        }
        title={a.name}
        line={`${activeWorkoutSets(a)} of ${activeWorkoutPlannedSets(a)} sets done`}
        actions={
          <Link href="/fitness?view=live" className="pill-link pill-link--primary flex-1">
            <Play className="h-4 w-4" /> Resume
          </Link>
        }
        figures={weekFigures(tracker)}
      />
    );
  }

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
    <>
    <SummaryCard
      label={due.length ? "Up next" : "All done for now"}
      aside={`${next.exercises.length} ${next.exercises.length === 1 ? "exercise" : "exercises"}`}
      title={next.name}
      line={
        <>
          {freq !== "off" ? `${REPEAT_LABEL[freq]} · ` : ""}
          {ago == null ? "not done yet" : ago === 0 ? "done today" : `last done ${ago} day${ago === 1 ? "" : "s"} ago`}
        </>
      }
      actions={
        <>
          <Button variant="primary" onPress={() => start(next.id)}>
            <Play className="h-4 w-4" /> Start {next.name}
          </Button>
          {startable.length > 1 && (
            <button type="button" className="hero__ghost" aria-label="Choose another workout" onClick={() => setChoosing(true)}>
              Others <ChevronDown aria-hidden />
            </button>
          )}
        </>
      }
      band={{ label: "Workouts", content: `${s.workouts.length} saved`, action: "Open", href: "/fitness?view=workouts" }}
      figures={weekFigures(tracker)}
    >
      <CardTiles
        items={next.exercises.slice(0, 8).map((e) => ({ key: e.id, icon: <Dumbbell aria-hidden />, label: e.name, state: "todo" as const, title: e.name }))}
      />
    </SummaryCard>

      <Modal open={choosing} onClose={() => setChoosing(false)} title="Start a workout">
        <ul className="group-list">
          {startable.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="group-row"
                onClick={() => {
                  setChoosing(false);
                  start(w.id);
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
    </>
  );
}
