import { dateKey } from "./model";
import { addDays, PLAN_ICONS, type PlanIcon } from "./plan";
import type { Category, TrackerState, WeeklyTask } from "./model";

/** The weekly tasks, cleaned: a title, a category, 1–7 times a week. */
export function weeklyTasksOf(s: TrackerState): WeeklyTask[] {
  const list = s.weeklyTasks as unknown;
  if (!Array.isArray(list)) return [];
  return list
    .filter((t): t is WeeklyTask => !!t && typeof t === "object" && typeof (t as WeeklyTask).id === "string")
    .map((t) => ({
      ...t,
      title: typeof t.title === "string" ? t.title : "",
      times: Math.min(7, Math.max(1, Math.round(Number(t.times) || 1))),
      ticks: Array.isArray(t.ticks) ? t.ticks.filter((d) => typeof d === "string") : [],
    }));
}

/** A category's icon: the one it was given, or a guess from its name. */
export function categoryIcon(c: Category | undefined): PlanIcon {
  if (c?.icon && (PLAN_ICONS as readonly string[]).includes(c.icon)) return c.icon;
  const n = c?.name ?? "";
  if (/video|talk|watch|youtube/i.test(n)) return "video";
  if (/learn|study|course|school/i.test(n)) return "learn";
  if (/gym|fit|train|sport|health/i.test(n)) return "gym";
  if (/read|book/i.test(n)) return "book";
  if (/focus|deep/i.test(n)) return "target";
  return "task";
}

/** The Monday of a day's week. */
function mondayOf(day: string): string {
  const wd = (new Date(day + "T12:00:00").getDay() + 6) % 7;
  return addDays(day, -wd);
}

/** How many times it's been done in the week of a day. */
export function doneThisWeek(t: WeeklyTask, day: string = dateKey()): number {
  const from = mondayOf(day);
  const to = addDays(from, 6);
  return new Set(t.ticks.filter((d) => d >= from && d <= to)).size;
}

/** The ticks with one day flipped; ticks older than a year go. */
export function toggledWeeklyTick(t: WeeklyTask, day: string): string[] {
  const cut = addDays(day, -366);
  const kept = t.ticks.filter((d) => d >= cut);
  return kept.includes(day) ? kept.filter((d) => d !== day) : [...kept, day].sort();
}
