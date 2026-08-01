"use client";

import { useState } from "react";
import { Button } from "./ui";
import { Play } from "lucide-react";
import { Modal } from "./Modal";
import { Tracker } from "@/lib/tracker";

/**
 * Starts a workout. Lives beside the training chart rather than in a
 * section of its own — picking which workout happens in a dialog, so nothing
 * on the page shifts until one is running.
 */
export function StartWorkoutButton({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [open, setOpen] = useState(false);

  // While one is running the live panel is already on screen.
  if (s.activeWorkout) return null;

  const startable = s.workouts.filter((w) => w.exercises.length > 0);

  return (
    <>
      <Button
        size="sm"
        variant="primary"
        isDisabled={startable.length === 0}
        onPress={() => {
          // With a single workout there is nothing to choose.
          if (startable.length === 1) void tracker.startWorkout(startable[0].id);
          else setOpen(true);
        }}
      >
        <Play className="h-3.5 w-3.5" /> Start workout
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Start a workout">
        <div className="flex flex-col gap-2">
          {startable.map((w) => (
            <Button
              key={w.id}
              variant="outline"
              className="justify-start"
              onPress={() => {
                setOpen(false);
                void tracker.startWorkout(w.id);
              }}
            >
              <Play className="h-3.5 w-3.5" />
              {w.name}
              <span className="ml-auto text-xs text-foreground/50">
                {w.exercises.length} {w.exercises.length === 1 ? "exercise" : "exercises"}
              </span>
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}
