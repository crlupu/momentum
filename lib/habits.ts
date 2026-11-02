/**
 * Habits: the day plan's steps, read as habits kept up day after day.
 *
 * Everything here is worked out from what the plan already records (each
 * day's steps and whether they got done), so nothing new is stored. A day
 * the plan doesn't run on is a rest day: it is drawn apart and never breaks
 * a run. Today never breaks a run either while it's still going: a run
 * counts up to yesterday until today's step is done.
 */

import { addDays, stepsOn, weekOf, type DayPlan, type DayStep } from "./plan";
import type { TrackerState } from "./model";

/** How a day went: every habit kept, some, none, a rest day, or not yet come. */
export type ChainDay = { day: string; state: "all" | "some" | "none" | "rest" | "future"; done: number; total: number };

/** How far back runs are looked for. */
const LOOKBACK = 120;

/** Each day's steps, from `today` back LOOKBACK days, newest first. */
export function history(s: TrackerState, plan: DayPlan, today: string): { day: string; steps: DayStep[] }[] {
  const out: { day: string; steps: DayStep[] }[] = [];
  for (let i = 0; i < LOOKBACK; i++) {
    const day = addDays(today, -i);
    if (plan.since && day < plan.since) break;
    out.push({ day, steps: stepsOn(s, plan, day) });
  }
  return out;
}

/** The last `weeks` weeks, Monday to Sunday, this week last. */
export function chain(s: TrackerState, plan: DayPlan, today: string, weeks = 4): ChainDay[] {
  const start = addDays(weekOf(today), -7 * (weeks - 1));
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const day = addDays(start, i);
    if (day > today) return { day, state: "future" as const, done: 0, total: 0 };
    const steps = stepsOn(s, plan, day);
    const total = steps.length;
    const done = steps.filter((x) => x.done).length;
    const state = total === 0 ? "rest" : done === total ? "all" : done > 0 ? "some" : "none";
    return { day, state, done, total };
  });
}

/**
 * Plan days in a row with at least one habit kept, back from today: rest days
 * are passed over, and today counts only once something is done.
 */
export function dayRun(h: { day: string; steps: DayStep[] }[]): number {
  let n = 0;
  for (const [i, d] of h.entries()) {
    if (!d.steps.length) continue;
    const kept = d.steps.some((x) => x.done);
    if (kept) n++;
    else if (i === 0) continue;
    else break;
  }
  return n;
}

/**
 * Days in a row one habit was kept, back from today: days it wasn't on are
 * passed over, and today counts only once it's done.
 */
export function stepRun(h: { day: string; steps: DayStep[] }[], stepId: string): number {
  let n = 0;
  for (const [i, d] of h.entries()) {
    const x = d.steps.find((y) => y.step.id === stepId);
    if (!x) continue;
    if (x.done) n++;
    else if (i === 0) continue;
    else break;
  }
  return n;
}

/** The longest run going among the plan's habits, with the habit's name. */
export function longestRun(h: { day: string; steps: DayStep[] }[], plan: DayPlan): { name: string; days: number } | null {
  let best: { name: string; days: number } | null = null;
  for (const st of plan.steps) {
    const days = stepRun(h, st.id);
    if (days > 0 && (!best || days > best.days)) best = { name: st.name, days };
  }
  return best;
}

/** "9 days running", "1 day running". A habit with no run going says nothing about it. */
export function runWords(days: number): string {
  return `${days} day${days === 1 ? "" : "s"} running`;
}
