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
 * This week's plan days. Small (in Today's band): a group of thin upright
 * bars per day, one per step, across the width. Big (the rest-day card, the
 * Week page): a row per day, its name, a line split into its steps and the
 * count. Either way two colours: done (the card's ink) and not yet (grey).
 */
export function DayMarks({ days, today, big }: { days: DayStatus[]; today: string; big?: boolean }) {
  const planned = days.filter((d) => d.planned);
  const full = planned.filter((d) => d.done === d.total);
  const label = `${full.length} of ${planned.length} plan days finished this week`;
  const steps = (d: DayStatus, cls: string) => (
    <span className={cls} aria-hidden>
      {Array.from({ length: d.total }, (_, k) => (
        <span key={k} className={"day-bars__step" + (k < d.done ? " is-done" : "")} />
      ))}
    </span>
  );
  if (big)
    return (
      <ol className="day-lines" aria-label={label}>
        {planned.map((d) => {
          const wd = new Date(d.day + "T12:00:00").getDay();
          const done = d.done === d.total;
          return (
            <li key={d.day} className={"day-lines__day" + (done ? " is-done" : "") + (d.day === today ? " is-today" : "")}>
              <span className="day-lines__name">{WEEKDAY[wd]}</span>
              {steps(d, "day-lines__steps")}
              <span className="day-lines__count">
                {d.done}/{d.total}
                <span className="sr-only"> done{done ? ", finished" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    );
  return (
    <ol className="day-bars" aria-label={label}>
      {planned.map((d) => {
        const wd = new Date(d.day + "T12:00:00").getDay();
        const done = d.done === d.total;
        return (
          <li key={d.day} className={"day-bars__day" + (done ? " is-done" : "")} title={`${WEEKDAY[wd]} · ${d.done} of ${d.total}`}>
            {steps(d, "day-bars__steps")}
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
