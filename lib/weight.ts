import { type WeightEntry, daysSinceEpoch, dateKey } from "./model";

/**
 * A weight-loss plan: checkpoints, each a date and the weight to be at by
 * then, the last of them the target. It starts from the weight when it was
 * set. Progress is read off the weekly median, which a day's swings with
 * water and glycogen move far less than any single weigh-in.
 */

/** A point on the way: this weight by this date. */
export type WeightCheckpoint = { date: string; kg: number };

export type WeightPlan = {
  /** When it was set, and the weight then. */
  startDate: string;
  startKg: number;
  /** The last checkpoint's, kept with the plan. */
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

/** Where the plan puts the weight on a day: straight lines from the start through each checkpoint. */
export function expectedOn(plan: WeightPlan, key: string): number {
  const pts = [{ date: plan.startDate, kg: plan.startKg }, ...plan.checkpoints.filter((c) => c.date > plan.startDate)];
  const d = daysSinceEpoch(key);
  if (d <= daysSinceEpoch(pts[0].date)) return pts[0].kg;
  for (let i = 1; i < pts.length; i++) {
    const a = daysSinceEpoch(pts[i - 1].date);
    const b = daysSinceEpoch(pts[i].date);
    if (d <= b) return pts[i - 1].kg + ((pts[i].kg - pts[i - 1].kg) * (d - a)) / Math.max(1, b - a);
  }
  return pts[pts.length - 1].kg;
}

export type CheckStatus = "reached" | "behind" | "pending" | "missed";

/**
 * How a checkpoint went, by the median of the week it falls in: at or under
 * its weight is reached, over it behind. One still to come is pending; one
 * past with no weigh-ins that week is missed. This week's median is a
 * reading so far, shown with its verdict.
 */
export function checkpointStatus(c: WeightCheckpoint, medians: WeekMedian[], today: string = dateKey()): { status: CheckStatus; median?: number } {
  const week = mondayOf(c.date);
  if (week > mondayOf(today)) return { status: "pending" };
  const m = medians.find((x) => x.week === week);
  if (!m) return { status: week === mondayOf(today) ? "pending" : "missed" };
  return { status: m.median <= c.kg ? "reached" : "behind", median: m.median };
}

export type PlanSummary = {
  /** The latest weekly median, or the start weight before any weigh-ins. */
  current: number;
  lost: number;
  toGo: number;
  /** 0–1: how much of the planned loss is done. */
  progress: number;
  /** kg a week still needed from the current median to the target. */
  neededPace: number | null;
  /** kg a week lost so far, from the start to the latest median. */
  actualPace: number | null;
  /** Where the plan says today's weight should be. */
  expectedNow: number;
  /** The next checkpoint from today on. */
  next?: WeightCheckpoint;
};

export function planSummary(plan: WeightPlan, weights: WeightEntry[], today: string = dateKey()): PlanSummary {
  const medians = weeklyMedians(weights.filter((w) => w.date >= mondayOf(plan.startDate)));
  const last = medians[medians.length - 1];
  const current = last?.median ?? plan.startKg;
  const total = plan.startKg - plan.targetKg;
  const lost = plan.startKg - current;
  const days = (a: string, b: string) => daysSinceEpoch(b) - daysSinceEpoch(a);
  const weeksLeft = Math.max(0, days(today, plan.targetDate) / 7);
  // The median stands for the middle of its week.
  const elapsed = last ? days(plan.startDate, addDays(last.week, 3)) / 7 : 0;
  return {
    current,
    lost: round1(lost),
    toGo: round1(Math.max(0, current - plan.targetKg)),
    progress: total > 0 ? Math.min(1, Math.max(0, lost / total)) : 0,
    neededPace: weeksLeft > 0 ? Math.max(0, current - plan.targetKg) / weeksLeft : null,
    actualPace: last && elapsed >= 1 ? lost / elapsed : null,
    expectedNow: round1(expectedOn(plan, today)),
    next: plan.checkpoints.find((c) => c.date >= today),
  };
}

/**
 * A plan from its checkpoints and where it starts. The last checkpoint is the
 * target. Undefined without a checkpoint after the start.
 */
export function makePlan(startDate: string, startKg: number, checkpoints: WeightCheckpoint[]): WeightPlan | undefined {
  const cs = checkpoints
    .filter((c) => c.date > startDate)
    .map((c) => ({ date: c.date, kg: round1(c.kg) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    // One per date: a later row for the same day wins.
    .filter((c, i, a) => a[i + 1]?.date !== c.date);
  const last = cs[cs.length - 1];
  if (!last) return undefined;
  return { startDate, startKg: round1(startKg), targetDate: last.date, targetKg: last.kg, checkpoints: cs };
}

/** A plan read from storage, or undefined when it isn't one. */
export function validPlan(v: unknown): WeightPlan | undefined {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Record<string, unknown>;
  const isKey = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const isKg = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;
  if (!isKey(p.startDate) || !isKg(p.startKg)) return undefined;
  const checkpoints: WeightCheckpoint[] = Array.isArray(p.checkpoints)
    ? (p.checkpoints as Record<string, unknown>[]).flatMap((c) =>
        !isKey(c.date)
          ? []
          : isKg(c.kg)
            ? [{ date: c.date, kg: c.kg }]
            : // Plans saved with a range take its middle.
              isKg(c.lo) && isKg(c.hi)
              ? [{ date: c.date, kg: (c.lo + c.hi) / 2 }]
              : []
      )
    : [];
  // The target as a checkpoint, for plans saved before it was one.
  if (isKey(p.targetDate) && isKg(p.targetKg) && !checkpoints.some((c) => c.date === p.targetDate)) {
    checkpoints.push({ date: p.targetDate, kg: p.targetKg });
  }
  return makePlan(p.startDate, p.startKg, checkpoints);
}
