"use client";

import { Card } from "./ui";
import { Tracker, dateKey, workoutVolumeByDate } from "@/lib/tracker";

const LABEL = "var(--muted)";
const TRACK = "var(--default)";
const FILL = "var(--grad-primary)";

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Total weight lifted per day, where each completed workout contributes the
 * sum of its exercise weights.
 */
export default function WorkoutVolumeChart({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const byDate = workoutVolumeByDate(s.workoutSessions);

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const values = days.map((d) => byDate[dateKey(d)] ?? 0);
  const max = Math.max(1, ...values);

  const sessions = s.workoutSessions.length;
  const weekTotal = values.slice(7).reduce((a, b) => a + b, 0);
  const best = Math.max(0, ...values);

  return (
    <div>
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
        Workout volume
      </h3>
      <Card>
        <Card.Content className="p-4 sm:p-5">
          {sessions === 0 ? (
            <p className="py-2 text-[15px] text-foreground/60">
              No workouts logged yet. Mark one as done on the Workouts page and its total
              weight lands here.
            </p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <Stat value={`${weekTotal} kg`} label="this week" />
                <Stat value={`${best} kg`} label="best day" />
                <Stat value={sessions} label="sessions logged" />
              </div>

              <div className="flex h-[120px] items-end gap-1">
                {days.map((d, i) => (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span
                      className="font-mono-n text-[10px] font-semibold"
                      style={{ color: values[i] ? "var(--foreground)" : "transparent" }}
                    >
                      {values[i] || ""}
                    </span>
                    <div
                      className="w-full rounded-t"
                      title={`${values[i]} kg on ${dateKey(d)}`}
                      style={{
                        height: Math.max(2, (values[i] / max) * 84),
                        background: values[i] ? FILL : TRACK,
                      }}
                    />
                    <span
                      className={"text-[9px] " + (i % 2 ? "hidden sm:inline" : "")}
                      style={{ color: LABEL }}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px]" style={{ color: LABEL }}>
                kg lifted per day · sum of each completed workout&apos;s exercise weights
              </p>
            </>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: "color-mix(in srgb, #4589ff 14%, transparent)" }}
    >
      <div className="font-mono-n text-xl font-semibold" style={{ color: "#4589ff" }}>
        {value}
      </div>
      <div className="text-xs text-foreground/60">{label}</div>
    </div>
  );
}
