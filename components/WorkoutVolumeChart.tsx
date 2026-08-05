"use client";

import { FormEvent, memo, useState } from "react";

import { Card, Input, Button } from "./ui";
import {
  Tracker,
  dateKey,
  workoutVolumeByDate,
  workoutMinutesByDate,
  cardioMinutesByDate,
  CAT_COLORS,
  UNTAGGED_COLOR,
} from "@/lib/tracker";
import { Plus } from "./icons";
import { usePending } from "./ActionButton";
import { Modal } from "./Modal";
import { StartWorkoutButton } from "./StartWorkoutButton";
import { ActiveWorkoutPanel } from "./WorkoutsView";

const LABEL = "var(--muted)";
const TRACK = "var(--default)";
/* The two time lines. Both are time, so they share a scale; they need to be
   told apart at a glance, hence warm for lifting and cool for cardio. */
const LIFT_LINE = "#ff8389";
const CARDIO_LINE = "#42be65";
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
  const cardioByDate = cardioMinutesByDate(s.cardio);

  // Colours are assigned by the workout's position in the list, so they stay
  // put as sessions accumulate.
  const order = s.workouts.map((w) => w.id);
  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const keys = days.map(dateKey);

  const values = keys.map((k) => byDate[k] ?? 0);
  const minutes = keys.map((k) => minsByDate[k] ?? 0);
  const cardio = keys.map((k) => cardioByDate[k] ?? 0);

  const sessions = s.workoutSessions.length;
  const weekTotal = values.slice(7).reduce((a, b) => a + b, 0);
  const weekMinutes = minutes.slice(7).reduce((a, b) => a + b, 0);
  const weekCardio = cardio.slice(7).reduce((a, b) => a + b, 0);

  /**
   * One chart per workout that was actually done in the window, in the order
   * the workouts are configured, then cardio. A workout with nothing in the
   * last fortnight is left out rather than given an empty chart to explain.
   */
  const charts: ChartSpec[] = [];
  for (const w of s.workouts) {
    const mine = s.workoutSessions.filter((x) => x.workoutId === w.id);
    if (!mine.length) continue;
    const vol = keys.map((k) =>
      mine.filter((x) => x.date === k).reduce((a, x) => a + x.total, 0)
    );
    if (!vol.some((v) => v > 0)) continue;
    const mins = keys.map((k) =>
      mine.filter((x) => x.date === k).reduce((a, x) => a + (x.minutes ?? 0), 0)
    );
    charts.push({
      id: w.id,
      name: w.name,
      colour: workoutColor(w.id, order),
      values: vol,
      unit: "kg",
      minutes: mins,
      lineColour: LIFT_LINE,
      lineLabel: "minutes",
      tooltip: (i) =>
        `${w.name}: ${vol[i].toLocaleString()} kg` +
        (mins[i] ? ` · ${mins[i]} min` : "") +
        ` on ${keys[i]}`,
    });
  }
  // Cardio belongs to no workout, so it gets a chart of its own. Its bars are
  // minutes — there is no weight to plot — so it carries no second line.
  if (cardio.some((m) => m > 0)) {
    charts.push({
      id: "cardio",
      name: "Cardio",
      colour: CARDIO_LINE,
      values: cardio,
      unit: "min",
      minutes: null,
      lineColour: CARDIO_LINE,
      lineLabel: "minutes",
      tooltip: (i) => `Cardio: ${cardio[i]} min on ${keys[i]}`,
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
          Training
        </h3>
        {/* Both controls sit with the chart they feed rather than in a section
            of their own. */}
        <div className="flex items-center gap-2">
          <CardioButton tracker={tracker} />
          <StartWorkoutButton tracker={tracker} />
        </div>
      </div>

      {s.activeWorkout && (
        <div className="mb-5">
          <ActiveWorkoutPanel tracker={tracker} active={s.activeWorkout} />
        </div>
      )}
      {sessions === 0 && s.cardio.length === 0 ? (
        <Card>
          <Card.Content className="p-4 md:p-5">
            <p className="py-2 text-[15px] text-foreground/60">
              Nothing logged yet. Finish a workout and its volume lands here; add cardio
              minutes above and they join it.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <>
          <Card>
            <Card.Content className="p-4 md:p-5">
              {/* Four across is too tight on a phone, so they wrap two by two. */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat value={`${weekTotal.toLocaleString()} kg`} label="this week" />
                <Stat value={weekMinutes ? `${weekMinutes} min` : "–"} label="lifting this week" />
                <Stat value={weekCardio ? `${weekCardio} min` : "–"} label="cardio this week" />
                <Stat value={sessions} label="sessions logged" />
              </div>
            </Card.Content>
          </Card>

          {/* A chart each, rather than one stack. Push and Pull move different
              amounts of weight, and stacked into one bar neither one's shape
              was readable. Each is scaled to its own heaviest day, so a light
              workout still fills its chart — which means heights compare
              within a chart but never between two. */}
          {charts.map((c) => (
            <div key={c.id} className="mt-3">
              <DayChart
                title={c.name}
                colour={c.colour}
                days={days}
                values={c.values}
                unit={c.unit}
                minutes={c.minutes}
                lineColour={c.lineColour}
                lineLabel={c.lineLabel}
                tooltip={c.tooltip}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
});

/**
 * Logs cardio minutes against today. The field lives in a dialog rather than
 * in the header: inline it crowded the row on a phone, and this is a thing
 * done once after the gym rather than a control worth standing permanent
 * duty beside the chart.
 */
function CardioButton({ tracker }: { tracker: Tracker }) {
  const [open, setOpen] = useState(false);
  const [mins, setMins] = useState("");
  const { pending, run } = usePending();

  const close = () => {
    setMins("");
    setOpen(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(mins);
    if (!Number.isFinite(n) || n <= 0) return;

    // Close first. The write is applied locally before it is sent, so by the
    // time the round trip finishes the entry is already on the chart behind
    // the dialog — waiting for the network left it sitting open for seconds
    // on a slow connection, looking like the button had not worked.
    close();
    const ok = await run(() => tracker.addCardio(n));
    // A refused write is rolled back, so put the dialog back with the number
    // still in it rather than losing what was typed. The reason why is shown
    // by the sync banner on the page.
    if (ok === false) {
      setMins(String(n));
      setOpen(true);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onPress={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add cardio
      </Button>

      <Modal open={open} onClose={close} title="Add cardio">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Cardio minutes today"
            placeholder="minutes…"
            value={mins}
            onChange={(e) => setMins(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-foreground/50">Logged against today.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onPress={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isDisabled={pending || mins.trim() === ""}
            >
              Add
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Everything one chart needs. Cardio fills this in too, with no second line. */
type ChartSpec = {
  id: string;
  name: string;
  /** Bar colour. Cardio borrows the line colour it used to be drawn in. */
  colour: string;
  values: number[];
  unit: string;
  /** Minutes to overlay, or null where the bars are already the time. */
  minutes: number[] | null;
  lineColour: string;
  lineLabel: string;
  tooltip: (i: number) => string;
};

/**
 * A fortnight of one thing, a bar per day, scaled to its own heaviest day so
 * a light workout still fills its chart. That means bar heights can be read
 * against each other within a chart and never between two of them, which is
 * why each carries its own figures above the bars.
 */
function DayChart({
  title,
  colour,
  days,
  values,
  unit,
  minutes,
  lineColour,
  lineLabel,
  tooltip,
}: {
  title: string;
  colour: string;
  days: Date[];
  values: number[];
  unit: string;
  minutes: number[] | null;
  lineColour: string;
  lineLabel: string;
  tooltip: (i: number) => string;
}) {
  const max = Math.max(1, ...values);
  const overlay = minutes ?? [];
  const maxMin = Math.max(1, ...overlay);
  // Only the days it happened on. The line joins those and stops at the last,
  // rather than running along the floor through every rest day.
  const points = overlay.map((m, i) => ({ i, m })).filter((pt) => pt.m > 0);
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <Card>
      <Card.Content className="p-4 md:p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0" style={{ background: colour }} aria-hidden />
            <span className="truncate text-[15px] font-semibold">{title}</span>
          </span>
          <span className="font-mono-n shrink-0 text-xs" style={{ color: LABEL }}>
            {total.toLocaleString()} {unit}
          </span>
        </div>

        {/* No flex gap here: the line above is positioned as a fraction of this
            row's width, so a column's centre has to be exactly (i + 0.5) / 14
            of it. A gap would push every bar off its own point, by more and
            more towards the right-hand end. The bars are separated by their
            own padding instead. */}
        <div className="relative flex h-[104px] items-end">
          {points.length > 0 && <TimeLine points={points} max={maxMin} color={lineColour} />}
          {days.map((d, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1 px-[2px]">
              <span
                className="font-mono-n text-[10px] font-semibold"
                style={{ color: values[i] ? "var(--foreground)" : "transparent" }}
              >
                {values[i] ? values[i].toLocaleString() : ""}
              </span>
              <div
                className="w-full"
                title={values[i] ? tooltip(i) : undefined}
                style={{
                  height: Math.max(2, (values[i] / max) * 68),
                  background: values[i] ? colour : TRACK,
                }}
              />
              <span className="text-[9px] leading-none tabular-nums" style={{ color: LABEL }}>
                {d.getDate()}
              </span>
            </div>
          ))}
        </div>

        {points.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: LABEL }}>
            <span className="inline-block h-[2px] w-4" style={{ background: lineColour }} aria-hidden />
            {lineLabel}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

/**
 * One time series drawn over the bars: a line through the days it happened on,
 * with a marker at each. Both the lifting and cardio lines are this, sharing a
 * scale so their heights can be compared against each other.
 */
function TimeLine({
  points,
  max,
  color,
}: {
  points: { i: number; m: number }[];
  /** Top of the shared scale, in minutes. */
  max: number;
  color: string;
}) {
  if (points.length === 0) return null;
  const y = (m: number) => 84 - (m / max) * 78;
  return (
    <>
      {/* width must be set explicitly. An <svg> is a replaced element, so
          left:0 + right:0 alone does not stretch it — it falls back to its
          intrinsic size, which for this viewBox at 84px tall is 100px. The
          line was being drawn into the leftmost 100px of the row, putting
          today's point over a date ten days earlier. */}
      <svg
        className="pointer-events-none absolute inset-x-0 w-full"
        style={{ bottom: 28, height: 84 }}
        viewBox="0 0 100 84"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          points={points.map((p) => `${((p.i + 0.5) / 14) * 100},${y(p.m)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* The markers are plain elements rather than <circle>s: the stretched
          viewBox above would squash a circle into a wide ellipse, which read
          as sitting over the wrong day. */}
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{ bottom: 28, height: 84 }}
        aria-hidden
      >
        {points.map((p) => (
          <span
            key={p.i}
            className="absolute block h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full"
            style={{
              left: `${((p.i + 0.5) / 14) * 100}%`,
              bottom: (p.m / max) * 78,
              background: color,
            }}
          />
        ))}
      </div>
    </>
  );
}

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
