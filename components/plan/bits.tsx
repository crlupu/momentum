"use client";

import { BookOpen, Check, Dumbbell, School, TaskDone, Target, Video } from "../icons";
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
 * One day as a ring: how many of its steps are done. Full is a white disc
 * with a tick; today, unfinished, glows blue; a day with no plan is a dot.
 */
export function DayRing({ status, today, size = 34 }: { status: DayStatus; today?: boolean; size?: number }) {
  const sw = size >= 30 ? 3.5 : 2.5;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const full = status.planned && status.done === status.total;
  const p = status.planned ? status.done / status.total : 0;
  if (!status.planned) {
    return (
      <span className="day-ring day-ring--off" style={{ inlineSize: size, blockSize: size }} aria-hidden>
        <span />
      </span>
    );
  }
  return (
    <span className={"day-ring" + (full ? " is-full" : "") + (today ? " is-today" : "")} style={{ inlineSize: size, blockSize: size }} aria-hidden>
      <svg className="day-ring__svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {full && <circle cx={size / 2} cy={size / 2} r={r - sw / 2 - 1.5} className="day-ring__disc" />}
        <circle cx={size / 2} cy={size / 2} r={r} className="day-ring__track" strokeWidth={sw} />
        {p > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className="day-ring__fill"
            strokeWidth={sw}
            strokeDasharray={`${c * p} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {full && <Check className="day-ring__check" />}
    </span>
  );
}

/** The week's days as rings, Monday first, today marked. */
/**
 * This week's plan days, a short bar each filled by how much of the day got
 * done: white once every step is, blue for today so far, grey for the rest.
 * The day's letter sits under its bar.
 */
export function DayMarks({ days, today }: { days: DayStatus[]; today: string }) {
  const planned = days.filter((d) => d.planned);
  const full = planned.filter((d) => d.done === d.total);
  return (
    <ol className="day-bars" aria-label={`${full.length} of ${planned.length} plan days finished this week`}>
      {planned.map((d) => {
        const wd = new Date(d.day + "T12:00:00").getDay();
        const done = d.done === d.total;
        const state = done ? "is-done" : d.day === today ? "is-today" : d.day < today ? "is-past" : "is-ahead";
        return (
          <li key={d.day} className={"day-bars__day " + state} title={`${WEEKDAY[wd]} · ${d.done} of ${d.total}`}>
            <span className="day-bars__bar" aria-hidden>
              <span style={{ blockSize: `${(d.done / d.total) * 100}%` }} />
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

export function WeekRings({
  days,
  today,
  size = 34,
  labels = true,
}: {
  days: DayStatus[];
  today?: string;
  size?: number;
  labels?: boolean;
}) {
  const shown = days.filter((d) => d.planned || [1, 2, 3, 4, 5].includes(new Date(d.day + "T12:00:00").getDay()));
  return (
    <ol className="week-rings" aria-label={`${days.filter((d) => d.planned && d.done === d.total).length} of ${days.filter((d) => d.planned).length} plan days complete`}>
      {shown.map((d) => {
        const wd = new Date(d.day + "T12:00:00").getDay();
        return (
          <li key={d.day} className={d.day === today ? "is-today" : undefined}>
            <DayRing status={d} today={d.day === today} size={size} />
            {labels && <span className="week-rings__label">{WEEKDAY[wd][0]}</span>}
          </li>
        );
      })}
    </ol>
  );
}
