"use client";

import { Card } from "./ui";
import { Tracker, dateKey, workoutVolumeByDate, workoutMinutesByDate } from "@/lib/tracker";
import { StartWorkoutButton } from "./StartWorkoutButton";
import { ActiveWorkoutPanel } from "./WorkoutsView";

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
  const minsByDate = workoutMinutesByDate(s.workoutSessions);

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const values = days.map((d) => byDate[dateKey(d)] ?? 0);
  const minutes = days.map((d) => minsByDate[dateKey(d)] ?? 0);
  const max = Math.max(1, ...values);
  // Time has its own scale — minutes and kilos aren't comparable numbers.
  const maxMin = Math.max(1, ...minutes);
  const anyTime = minutes.some((m) => m > 0);

  const sessions = s.workoutSessions.length;
  const weekTotal = values.slice(7).reduce((a, b) => a + b, 0);
  const weekMinutes = minutes.slice(7).reduce((a, b) => a + b, 0);
  const best = Math.max(0, ...values);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
          Workout volume
        </h3>
        <StartWorkoutButton tracker={tracker} />
      </div>

      {s.activeWorkout && (
        <div className="mb-5">
          <ActiveWorkoutPanel tracker={tracker} active={s.activeWorkout} />
        </div>
      )}
      <Card>
        <Card.Content className="p-4 sm:p-5">
          {sessions === 0 ? (
            <p className="py-2 text-[15px] text-foreground/60">
              No workouts logged yet. Mark one as done on the Workouts page and its volume
              lands here.
            </p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <Stat value={`${weekTotal.toLocaleString()} kg`} label="this week" />
                <Stat value={weekMinutes ? `${weekMinutes} min` : "–"} label="time this week" />
                <Stat value={sessions} label="sessions logged" />
              </div>

              {anyTime && (
                <div className="mb-2 flex items-center justify-end gap-3 text-[11px]" style={{ color: LABEL }}>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2" style={{ background: "#4589ff" }} aria-hidden />
                    kg
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-[2px] w-4" style={{ background: "#ff7eb6" }} aria-hidden />
                    minutes
                  </span>
                </div>
              )}

              <div className="relative flex h-[120px] items-end gap-1">
                {/* Duration rides over the bars on its own scale. */}
                {anyTime && (
                  <svg
                    className="pointer-events-none absolute inset-x-0"
                    style={{ bottom: 28, height: 84 }}
                    viewBox="0 0 100 84"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <polyline
                      points={minutes
                        .map((m, i) => `${((i + 0.5) / 14) * 100},${84 - (m / maxMin) * 78}`)
                        .join(" ")}
                      fill="none"
                      stroke="#ff7eb6"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    {minutes.map((m, i) =>
                      m > 0 ? (
                        <circle
                          key={i}
                          cx={((i + 0.5) / 14) * 100}
                          cy={84 - (m / maxMin) * 78}
                          r="3"
                          fill="#ff7eb6"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null
                    )}
                  </svg>
                )}
                {days.map((d, i) => (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span
                      className="font-mono-n text-[10px] font-semibold"
                      style={{ color: values[i] ? "var(--foreground)" : "transparent" }}
                    >
                      {values[i] ? values[i].toLocaleString() : ""}
                    </span>
                    <div
                      className="w-full rounded-t"
                      title={
                        `${values[i].toLocaleString()} kg` +
                        (minutes[i] ? ` · ${minutes[i]} min` : "") +
                        ` on ${dateKey(d)}`
                      }
                      style={{
                        height: Math.max(2, (values[i] / max) * 84),
                        background: values[i] ? FILL : TRACK,
                      }}
                    />
                    <span
                      className="text-[9px] leading-none tabular-nums"
                      style={{ color: LABEL }}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px]" style={{ color: LABEL }}>
                kg lifted per day, with time trained overlaid
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
