"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "./ui";
import { Play, X } from "lucide-react";
import { Tracker } from "@/lib/tracker";
import { ActiveWorkoutPanel } from "./WorkoutsView";

/** mm:ss while under an hour, then h:mm:ss. */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
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

/**
 * Starting and running a workout, in the Fitness section. Building workouts
 * and their exercises stays in Configuration.
 */
export default function WorkoutSessionCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [picking, setPicking] = useState(false);

  if (s.activeWorkout) {
    return (
      <div>
        <h3 className="font-display mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="sec-dot" style={{ background: "var(--grad-success)" }} aria-hidden />
          Workout
          <span className="ml-auto text-sm font-medium text-foreground/60">
            <Elapsed startedAt={s.activeWorkout.startedAt} />
          </span>
        </h3>
        <ActiveWorkoutPanel tracker={tracker} active={s.activeWorkout} />
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-display mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
        <span className="sec-dot" style={{ background: "var(--grad-primary)" }} aria-hidden />
        Workout
      </h3>
      <Card>
        <Card.Content className="p-4 sm:p-5">
          {s.workouts.length === 0 ? (
            <p className="text-[15px] text-foreground/60">
              No workouts yet. Build one in Configuration, then start it here.
            </p>
          ) : !picking ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] text-foreground/60">Ready when you are.</span>
              <Button variant="primary" onPress={() => setPicking(true)}>
                <Play className="h-4 w-4" /> Start workout
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  Which workout?
                </span>
                <Button size="sm" variant="ghost" isIconOnly aria-label="Cancel" onPress={() => setPicking(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {s.workouts.map((w) => (
                  <Button
                    key={w.id}
                    variant="outline"
                    className="justify-start"
                    isDisabled={w.exercises.length === 0}
                    onPress={() => {
                      setPicking(false);
                      void tracker.startWorkout(w.id);
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {w.name}
                    <span className="ml-auto text-xs text-foreground/50">
                      {w.exercises.length}{" "}
                      {w.exercises.length === 1 ? "exercise" : "exercises"}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
