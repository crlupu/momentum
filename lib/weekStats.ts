/**
 * The week in numbers, for the dashboard: this week so far, Monday to today,
 * against the same days of last week, so a Wednesday is compared with last
 * Wednesday rather than with a whole week.
 */

import { addDays, weekOf } from "./plan";
import { dateKey, macroTotalsByDate, type TrackerState } from "./model";
import * as R from "./reading";

export type WeekSeries = {
  /** Monday to Sunday; days still to come are 0. */
  days: number[];
  /** This week so far. */
  total: number;
  /** The same days of last week. */
  before: number;
};

/** Which day of the week today is, Monday 0. */
export function todayIndex(today: string = dateKey()): number {
  return Math.round((Date.parse(today) - Date.parse(weekOf(today))) / 86400000);
}

/** A per-day series from dated values, this week and the same span last week. */
function series(entries: { date: string; v: number }[], today: string): WeekSeries {
  const week = weekOf(today);
  const t = todayIndex(today);
  const days = Array.from({ length: 7 }, () => 0);
  let before = 0;
  const lastFrom = addDays(week, -7);
  const lastTo = addDays(lastFrom, t);
  for (const e of entries) {
    if (e.date >= week && e.date <= today) days[Math.round((Date.parse(e.date) - Date.parse(week)) / 86400000)] += e.v;
    else if (e.date >= lastFrom && e.date <= lastTo) before += e.v;
  }
  return { days, total: days.reduce((a, b) => a + b, 0), before };
}

export function workoutsWeek(s: TrackerState, today = dateKey()): WeekSeries {
  return series(s.workoutSessions.map((x) => ({ date: x.date, v: 1 })), today);
}

export function liftedWeek(s: TrackerState, today = dateKey()): WeekSeries {
  return series(s.workoutSessions.map((x) => ({ date: x.date, v: x.total || 0 })), today);
}

export function pagesWeek(s: TrackerState, today = dateKey()): WeekSeries {
  return series(s.readingSessions.map((x) => ({ date: x.date, v: Math.max(0, x.pages) })), today);
}

export function focusWeek(s: TrackerState, today = dateKey()): WeekSeries & { sessions: number } {
  const list = s.focusSessions ?? [];
  const week = weekOf(today);
  return { ...series(list.map((x) => ({ date: x.date, v: x.minutes })), today), sessions: list.filter((x) => x.date >= week && x.date <= today).length };
}

export function caloriesWeek(s: TrackerState, today = dateKey()): WeekSeries & { logged: number; avg: number; onBudget: number } {
  const se = series(s.calories.map((c) => ({ date: c.date, v: c.kcal })), today);
  const t = todayIndex(today);
  const logged = se.days.slice(0, t + 1).filter((v) => v > 0);
  const budget = s.calorieBudget;
  return {
    ...se,
    logged: logged.length,
    avg: logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0,
    onBudget: budget ? logged.filter((v) => v <= budget).length : 0,
  };
}

export function proteinWeek(s: TrackerState, today = dateKey()): { logged: number; hit: number; avg: number } {
  const byDay = macroTotalsByDate(s.macros);
  const week = weekOf(today);
  const t = todayIndex(today);
  const vals = Array.from({ length: t + 1 }, (_, i) => byDay[addDays(week, i)]?.protein ?? 0).filter((v) => v > 0);
  const target = s.proteinTarget;
  return {
    logged: vals.length,
    hit: target ? vals.filter((v) => v >= target).length : 0,
    avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
  };
}

/** Learning sessions this week, per goal, most first. */
export function learningWeek(s: TrackerState, today = dateKey()): { total: number; before: number; goals: { title: string; n: number }[] } {
  const week = weekOf(today);
  const t = todayIndex(today);
  const lastFrom = addDays(week, -7);
  const lastTo = addDays(lastFrom, t);
  const log = s.learningLog ?? [];
  const now = log.filter((e) => e.date >= week && e.date <= today);
  const per = new Map<string, number>();
  for (const e of now) per.set(e.goalId, (per.get(e.goalId) ?? 0) + 1);
  const goals = [...per.entries()]
    .map(([id, n]) => ({ title: (s.goals.find((g) => g.id === id)?.title ?? "A goal").split(" · ")[0].trim(), n }))
    .sort((a, b) => b.n - a.n);
  return { total: now.length, before: log.filter((e) => e.date >= lastFrom && e.date <= lastTo).length, goals };
}

export function todosWeek(s: TrackerState, today = dateKey()): { done: number } {
  const week = weekOf(today);
  return { done: s.todos.filter((x) => x.done && x.doneDate && x.doneDate >= week && x.doneDate <= today).length };
}

/** Pages a day the open tracks ask for. */
export function readingTarget(s: TrackerState): number {
  return s.readingTracks.filter((t) => !t.archived && R.activeBooks(s, t.id).length > 0).reduce((a, t) => a + t.dailyTarget, 0);
}

/** "+1 vs last week", "−12% vs last week", "same as last week". */
export function compare(now: number, before: number, pct = false): string {
  if (before === 0 && now === 0) return "Nothing yet, nor last week";
  if (pct && before > 0) {
    const d = Math.round(((now - before) / before) * 100);
    return d === 0 ? "Same as last week" : `${d > 0 ? "+" : "−"}${Math.abs(d)}% vs last week`;
  }
  const d = Math.round((now - before) * 10) / 10;
  return d === 0 ? "Same as last week" : `${d > 0 ? "+" : "−"}${Math.abs(d).toLocaleString()} vs last week`;
}
