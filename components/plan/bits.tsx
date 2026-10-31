"use client";

import { BookOpen, Dumbbell, School, TaskDone, Target, Video } from "../icons";
import { WEEKDAY, type DayStatus, type PlanIcon } from "@/lib/plan";

const ICON: Record<PlanIcon, typeof BookOpen> = {
  book: BookOpen,
  gym: Dumbbell,
  video: Video,
  learn: School,
  task: TaskDone,
  target: Target,
};

export function PlanGlyph({ icon, className }: { icon: PlanIcon; className?: string }) {
  const Icon = ICON[icon] ?? TaskDone;
  return <Icon className={className} aria-hidden />;
}

/** A step's icon in the grey leading tile rows use. */
export function PlanTile({ icon }: { icon: PlanIcon }) {
  return (
    <span className="area-tile" aria-hidden>
      <PlanGlyph icon={icon} />
    </span>
  );
}

/**
 * This week's plan days across the full width, like the live workout's set
 * bars: each day a group of thin bars, one per step, done or not yet (two
 * colours, the card's ink and grey); the day's letter underneath, lit once
 * every step is done.
 */
export function DayMarks({ days, today, big }: { days: DayStatus[]; today: string; big?: boolean }) {
  const planned = days.filter((d) => d.planned);
  const full = planned.filter((d) => d.done === d.total);
  return (
    <ol className={"day-bars" + (big ? " day-bars--big" : "")} aria-label={`${full.length} of ${planned.length} plan days finished this week`}>
      {planned.map((d) => {
        const wd = new Date(d.day + "T12:00:00").getDay();
        const done = d.done === d.total;
        const state = done ? "is-done" : d.day === today ? "is-today" : d.day < today ? "is-past" : "is-ahead";
        return (
          <li key={d.day} className={"day-bars__day " + state} title={`${WEEKDAY[wd]} · ${d.done} of ${d.total}`}>
            <span className="day-bars__steps" aria-hidden>
              {Array.from({ length: d.total }, (_, k) => (
                <span key={k} className={"day-bars__step" + (k < d.done ? " is-done" : "")} />
              ))}
            </span>
            <span className="day-bars__label" aria-hidden>
              {WEEKDAY[wd][0]}
            </span>
            <span className="sr-only">
              {WEEKDAY[wd]}, {d.done} of {d.total} done{done ? ", finished" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
