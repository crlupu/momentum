/**
 * How dates and times are written across the app: "28 Sep", with the year
 * only when it isn't this one, and a 24-hour clock. One place, so a date
 * reads the same on every page.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "28 Sep", or "28 Sep 2026" when the year is asked for. From a YYYY-MM-DD key. */
export function fmtDate(key: string | undefined | null, withYear = false): string {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "28 Sep", with the year added only when it isn't this one. */
export function fmtDateAuto(key: string | undefined | null): string {
  if (!key) return "—";
  return fmtDate(key, key.slice(0, 4) !== String(new Date().getFullYear()));
}

/** "Sep", from a YYYY-MM or YYYY-MM-DD key. */
export function monthLabel(key: string): string {
  return MONTHS[Number(key.split("-")[1]) - 1];
}

/** "14:23", from epoch milliseconds. */
export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
