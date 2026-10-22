import { type WeightEntry, daysSinceEpoch, dateKey } from "./model";

/**
 * A weight-loss plan: where it starts, where it's aimed, and checkpoints on
 * the way, each a range rather than a number, since a day's weight swings
 * with water and glycogen. Progress is read off the weekly median, which
 * those swings move far less than any single weigh-in.
 */

/** A point on the way: by this date, somewhere in lo–hi kg. */
export type WeightCheckpoint = { date: string; lo: number; hi: number };

export type WeightPlan = {
  startDate: string;
  startKg: number;
  targetDate: string;
  targetKg: number;
  checkpoints: WeightCheckpoint[];
};

export type WeekMedian = {
  /** The Monday the week starts on, YYYY-MM-DD. */
  week: string;
  median: number;
  /** Weigh-ins it was taken from. */
  n: number;
};

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** A date key moved by n days. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

/** The Monday of the week a day falls in. Weeks run Monday to Sunday. */
export function mondayOf(key: string): string {
  // Day 0 of the epoch was a Thursday: +3 makes Monday 0.
  const dow = (daysSinceEpoch(key) + 3) % 7;
  return addDays(key, -dow);
}

/** Each week's median weigh-in, oldest first. Weeks with none are left out. */
export function weeklyMedians(weights: WeightEntry[]): WeekMedian[] {
  const byWeek = new Map<string, number[]>();
  for (const w of weights) {
    const k = mondayOf(w.date);
    byWeek.set(k, [...(byWeek.get(k) ?? []), w.kg]);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, kgs]) => ({ week, median: round1(median(kgs)), n: kgs.length }));
}

export const round1 = (v: number) => Math.round(v * 10) / 10;

/** Where the plan's straight line puts the weight on a day. */
export function expectedOn(plan: WeightPlan, key: string): number {
  const total = daysSinceEpoch(plan.targetDate) - daysSinceEpoch(plan.startDate);
  if (total <= 0) return plan.targetKg;
  const t = Math.min(1, Math.max(0, (daysSinceEpoch(key) - daysSinceEpoch(plan.startDate)) / total));
  return plan.startKg + (plan.targetKg - plan.startKg) * t;
}

/** The weekly median for the week a day falls in, if it was weighed that week. */
export function medianForWeekOf(medians: WeekMedian[], key: string): WeekMedian | undefined {
  const k = mondayOf(key);
  return medians.find((m) => m.week === k);
}

export type CheckStatus = "ahead" | "on-track" | "behind" | "pending" | "missed";

/**
 * How a checkpoint went, by the median of the week it falls in: under its
 * range is ahead, in it on track, over it behind. A checkpoint still to come
 * is pending; one past with no weigh-ins that week is missed.
 */
export function checkpointStatus(c: WeightCheckpoint, medians: WeekMedian[], today: string = dateKey()): { status: CheckStatus; median?: number } {
  const week = mondayOf(c.date);
  if (week > mondayOf(today)) return { status: "pending" };
  const m = medians.find((x) => x.week === week);
  // This week's median is a reading so far, shown with its verdict.
  if (!m) return { status: week === mondayOf(today) ? "pending" : "missed" };
  return { status: statusOf(c, m.median), median: m.median };
}

function statusOf(c: WeightCheckpoint, kg: number): CheckStatus {
  return kg < c.lo ? "ahead" : kg > c.hi ? "behind" : "on-track";
}

export type PlanSummary = {
  /** The latest weekly median, or the start weight before any weigh-ins. */
  current: number;
  lost: number;
  toGo: number;
  /** 0–1: how much of the planned loss is done. */
  progress: number;
  /** kg a week the plan asks for, start to target. */
  plannedPace: number;
  /** kg a week still needed from the current median to the target. */
  neededPace: number | null;
  /** kg a week lost so far, from the start to the latest median. */
  actualPace: number | null;
  /** Where the straight line says today's weight should be. */
  expectedNow: number;
  weeksLeft: number;
};

export function planSummary(plan: WeightPlan, weights: WeightEntry[], today: string = dateKey()): PlanSummary {
  const medians = weeklyMedians(weights.filter((w) => w.date >= mondayOf(plan.startDate)));
  const last = medians[medians.length - 1];
  const current = last?.median ?? plan.startKg;
  const total = plan.startKg - plan.targetKg;
  const lost = plan.startKg - current;
  const days = (a: string, b: string) => daysSinceEpoch(b) - daysSinceEpoch(a);
  const planWeeks = days(plan.startDate, plan.targetDate) / 7;
  const weeksLeft = Math.max(0, days(today, plan.targetDate) / 7);
  // The median stands for the middle of its week.
  const elapsed = last ? days(plan.startDate, addDays(last.week, 3)) / 7 : 0;
  return {
    current,
    lost: round1(lost),
    toGo: round1(Math.max(0, current - plan.targetKg)),
    progress: total > 0 ? Math.min(1, Math.max(0, lost / total)) : 0,
    plannedPace: planWeeks > 0 ? total / planWeeks : 0,
    neededPace: weeksLeft > 0 ? Math.max(0, current - plan.targetKg) / weeksLeft : null,
    actualPace: last && elapsed >= 1 ? lost / elapsed : null,
    expectedNow: round1(expectedOn(plan, today)),
    weeksLeft,
  };
}

/**
 * Checkpoints every two weeks from the start to the target, each a band of
 * ±0.75 kg around the straight line, ending on the target date.
 */
export function evenCheckpoints(plan: Omit<WeightPlan, "checkpoints">): WeightCheckpoint[] {
  const out: WeightCheckpoint[] = [];
  const p = { ...plan, checkpoints: [] };
  // The last one lands on the target date itself, so none closer than a
  // week before it.
  for (let d = addDays(plan.startDate, 14); addDays(d, 7) <= plan.targetDate; d = addDays(d, 14)) {
    const e = expectedOn(p, d);
    out.push({ date: d, lo: round1(e - 0.75), hi: round1(e + 0.75) });
  }
  out.push({ date: plan.targetDate, lo: round1(plan.targetKg - 0.5), hi: round1(plan.targetKg + 1) });
  return out;
}

/** A plan read from storage, or undefined when it isn't one. */
export function validPlan(v: unknown): WeightPlan | undefined {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Record<string, unknown>;
  const isKey = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const isKg = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;
  if (!isKey(p.startDate) || !isKey(p.targetDate) || !isKg(p.startKg) || !isKg(p.targetKg)) return undefined;
  const checkpoints = Array.isArray(p.checkpoints)
    ? (p.checkpoints as Record<string, unknown>[])
        .filter((c) => isKey(c.date) && isKg(c.lo) && isKg(c.hi))
        .map((c) => ({ date: c.date as string, lo: Math.min(c.lo as number, c.hi as number), hi: Math.max(c.lo as number, c.hi as number) }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  return { startDate: p.startDate, startKg: p.startKg, targetDate: p.targetDate, targetKg: p.targetKg, checkpoints };
}
