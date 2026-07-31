"use client";

import { memo } from "react";

import { Card } from "./ui";
import {
  Tracker,
  dateKey,
  workoutVolumeByDate,
  workoutMinutesByDate,
  CAT_COLORS,
  UNTAGGED_COLOR,
} from "@/lib/tracker";
import { StartWorkoutButton } from "./StartWorkoutButton";
import { ActiveWorkoutPanel } from "./WorkoutsView";

const LABEL = "var(--muted)";
const TRACK = "var(--default)";
/** Each workout keeps one colour, so a bar says which workout it was. */
function workoutColor(workoutId: string, order: string[]): string {
  const i = order.indexOf(workoutId);
  return i === -1 ? UNTAGGED_COLOR : CAT_COLORS[i % CAT_COLORS.length];
}

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Total weight lifted per day, where each completed workout contributes the
 * sum of its exercise weights.
 */
/* Memoised: its only prop is the tracker, which is now a stable object, so
   this re-renders when the data changes rather than whenever the page does. */
const WorkoutVolumeChart = memo(function WorkoutVolumeChart({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const byDate = workoutVolumeByDate(s.workoutSessions);
  const minsByDate = workoutMinutesByDate(s.workoutSessions);

  // Colours are assigned by the workout's position in the list, so they stay
  // put as sessions accumulate.
  const order = s.workouts.map((w) => w.id);
  const sessionsByDate: Record<string, typeof s.workoutSessions> = {};
  for (const w of s.workoutSessions) (sessionsByDate[w.date] ??= []).push(w);

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const values = days.map((d) => byDate[dateKey(d)] ?? 0);
  const minutes = days.map((d) => minsByDate[dateKey(d)] ?? 0);
  const max = Math.max(1, ...values);
  // Time has its own scale — minutes and kilos aren't comparable numbers.
  const maxMin = Math.max(1, ...minutes);
  // Only the days actually trained. The line joins these and ends at the last
  // one, rather than running along the floor through every rest day.
  const trained = minutes
    .map((m, i) => ({ i, m }))
    .filter((p) => p.m > 0);
  const anyTime = trained.length > 0;

  // Only name the workouts that appear in the window, in bar order.
  const seen = new Map<string, string>();
  for (const d of days) {
    for (const w of sessionsByDate[dateKey(d)] ?? []) {
      if (!seen.has(w.workoutId)) seen.set(w.workoutId, w.name);
    }
  }
  const shown = [...seen].map(([id, name]) => ({ id, name }));

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
        <Card.Content className="p-4 md:p-5">
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


              {/* No flex gap here: the line above is positioned as a fraction of
                  this row's width, so a column's centre has to be exactly
                  (i + 0.5) / 14 of it. A gap would push every bar off its own
                  point, by more and more towards the right-hand end. The bars
                  are separated by their own padding instead. */}
              <div className="relative flex h-[120px] items-end">
                {/* Duration rides over the bars on its own scale, and only
                    joins the days actually trained — a day with no workout is
                    a gap in the record, not a zero to draw a line down to. */}
                {anyTime && (
                  <>
                    {/* width must be set explicitly. An <svg> is a replaced
                        element, so left:0 + right:0 alone does not stretch it —
                        it falls back to its intrinsic size, which for this
                        viewBox at 84px tall is 100px. The line was being drawn
                        into the leftmost 100px of the row, putting today's
                        point over a date ten days earlier. */}
                    <svg
                      className="pointer-events-none absolute inset-x-0 w-full"
                      style={{ bottom: 28, height: 84 }}
                      viewBox="0 0 100 84"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <polyline
                        points={trained
                          .map((p) => `${((p.i + 0.5) / 14) * 100},${84 - (p.m / maxMin) * 78}`)
                          .join(" ")}
                        fill="none"
                        stroke="#ff8389"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    {/* The markers are plain elements rather than <circle>s:
                        the stretched viewBox above would squash a circle into a
                        wide ellipse, which read as sitting over the wrong day. */}
                    <div
                      className="pointer-events-none absolute inset-x-0"
                      style={{ bottom: 28, height: 84 }}
                      aria-hidden
                    >
                      {trained.map((p) => (
                        <span
                          key={p.i}
                          className="absolute block h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full"
                          style={{
                            left: `${((p.i + 0.5) / 14) * 100}%`,
                            bottom: (p.m / maxMin) * 78,
                            background: "#ff8389",
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
                {days.map((d, i) => (
                  <div
                    key={i}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1 px-[2px]"
                  >
                    <span
                      className="font-mono-n text-[10px] font-semibold"
                      style={{ color: values[i] ? "var(--foreground)" : "transparent" }}
                    >
                      {values[i] ? values[i].toLocaleString() : ""}
                    </span>
                    <div
                      className="flex w-full flex-col-reverse overflow-hidden"
                      style={{
                        height: Math.max(2, (values[i] / max) * 84),
                        background: values[i] ? undefined : TRACK,
                      }}
                    >
                      {(sessionsByDate[dateKey(d)] ?? []).map((w) => (
                        <div
                          key={w.id}
                          title={
                            `${w.name}: ${w.total.toLocaleString()} kg` +
                            (w.minutes ? ` · ${w.minutes} min` : "") +
                            ` on ${w.date}`
                          }
                          style={{
                            height: `${(w.total / (values[i] || 1)) * 100}%`,
                            background: workoutColor(w.workoutId, order),
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="text-[9px] leading-none tabular-nums"
                      style={{ color: LABEL }}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
                style={{ color: LABEL }}
              >
                {shown.map((w) => (
                  <span key={w.id} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2"
                      style={{ background: workoutColor(w.id, order) }}
                      aria-hidden
                    />
                    {w.name}
                  </span>
                ))}
                {anyTime && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-[2px] w-4" style={{ background: "#ff8389" }} aria-hidden />
                    minutes
                  </span>
                )}
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
});

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      className="px-3 py-2.5"
      style={{ background: "var(--surface-secondary)" }}
    >
      <div className="font-mono-n text-xl font-semibold" style={{ color: "var(--accent)" }}>
        {value}
      </div>
      <div className="text-xs text-foreground/60">{label}</div>
    </div>
  );
}

export default WorkoutVolumeChart;
