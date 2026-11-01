/**
 * Body measurements: waist, chest and arm, once a month, in centimetres.
 *
 * One entry per month ("2026-10"), each measurement optional, so a month can
 * hold just the waist. Logging a month again corrects it. A month is due
 * when the current one has nothing yet.
 */

export const MEASURES = ["waist", "chest", "arm"] as const;
export type Measure = (typeof MEASURES)[number];
export const MEASURE_LABEL: Record<Measure, string> = { waist: "Waist", chest: "Chest", arm: "Arm" };
/** Where to put the tape, the same spot each month. */
export const MEASURE_HOW: Record<Measure, string> = {
  waist: "at the navel, relaxed, after breathing out",
  chest: "at the nipples, arms down",
  arm: "flexed, at the widest",
};

export type Measurement = {
  /** YYYY-MM */
  month: string;
  /** The day it was logged, YYYY-MM-DD. */
  date: string;
  waist?: number;
  chest?: number;
  arm?: number;
};

export type MeasureValues = Partial<Record<Measure, number | null>>;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const cm = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0 && v < 400;
const round = (v: number) => Math.round(v * 10) / 10;

/** The month of a YYYY-MM-DD day. */
export const monthOf = (day: string) => day.slice(0, 7);

/** Saved measurements, cleaned: valid months only, one entry each, oldest first. */
export function migrateMeasurements(raw: unknown): Measurement[] {
  if (!Array.isArray(raw)) return [];
  const byMonth = new Map<string, Measurement>();
  for (const r of raw as Array<Record<string, unknown>>) {
    if (!r || typeof r.month !== "string" || !MONTH.test(r.month)) continue;
    const m: Measurement = { month: r.month, date: typeof r.date === "string" ? r.date : `${r.month}-01` };
    for (const k of MEASURES) if (cm(r[k])) m[k] = round(r[k] as number);
    if (MEASURES.some((k) => m[k] != null)) byMonth.set(m.month, m);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Logs a month: each value given replaces that measurement, null clears it,
 * and one left out stays. A month left with nothing is removed.
 */
export function withMonth(list: Measurement[], month: string, values: MeasureValues, today: string): Measurement[] {
  if (!MONTH.test(month)) return list;
  const old = list.find((m) => m.month === month);
  const next: Measurement = { ...(old ?? { month }), month, date: today };
  for (const k of MEASURES) {
    const v = values[k];
    if (v === null) delete next[k];
    else if (cm(v)) next[k] = round(v);
  }
  const rest = list.filter((m) => m.month !== month);
  return (MEASURES.some((k) => next[k] != null) ? [...rest, next] : rest).sort((a, b) => a.month.localeCompare(b.month));
}

/** The latest figure of one measurement, with its month, and the one before it. */
export function lastTwo(list: Measurement[], k: Measure): { now?: { month: string; v: number }; before?: { month: string; v: number } } {
  const has = list.filter((m) => m[k] != null);
  const at = (m?: Measurement) => (m ? { month: m.month, v: m[k]! } : undefined);
  return { now: at(has[has.length - 1]), before: at(has[has.length - 2]) };
}

/** The first figure of one measurement. */
export function firstOf(list: Measurement[], k: Measure): { month: string; v: number } | undefined {
  const m = list.find((x) => x[k] != null);
  return m ? { month: m.month, v: m[k]! } : undefined;
}

/** "+0.5", "−1.5", "±0". */
export function signed(d: number): string {
  const r = round(d);
  return r === 0 ? "±0" : `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1).replace(/\.0$/, "")}`;
}

/** A figure as it reads: "84", "36.5". */
export const cmText = (v: number) => (Math.round(v * 10) / 10).toString();

/** "November", or "November 2027" outside this year. */
export function monthName(month: string, today: string): string {
  const [y, m] = month.split("-").map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long" });
  return month.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${y}`;
}

/** "Oct", for tables. */
export function monthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
