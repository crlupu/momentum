"use client";

import { useState } from "react";
import { useWidth } from "../useWidth";
import { Tracker, dateKey } from "@/lib/tracker";
import { PanelHeader } from "../ui";
import * as R from "@/lib/reading";
import { Segmented, StatusBadge, TrackDot, fmtDateAuto, monthLabel } from "./bits";
import { useFlow } from "./flowContext";

/** Finished and dropped books, the reading charts, and a year in review. */
export function HistoryView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const flow = useFlow();
  const [track, setTrack] = useState("");
  const [year, setYear] = useState("");
  const [showDropped, setShowDropped] = useState(false);

  const done = s.books.filter(
    (b) => b.status === "finished" || (showDropped && b.status === "dropped"),
  );
  const endOf = (b: (typeof done)[number]) =>
    (b.status === "finished" ? b.doneDate : b.droppedDate) ?? "";
  const years = [
    ...new Set([
      ...s.books.map((b) => b.doneDate?.slice(0, 4)).filter(Boolean),
      ...s.readingSessions.map((x) => x.date.slice(0, 4)),
      dateKey().slice(0, 4),
    ] as string[]),
  ].sort((a, b) => (a < b ? 1 : -1));

  const list = done
    .filter((b) => (!track || b.trackId === track) && (!year || endOf(b).startsWith(year)))
    .sort((a, b) => (endOf(a) < endOf(b) ? 1 : -1));

  return (
    <div className="flex flex-col gap-8">
      <section>
        <PanelHeader title="Finished" color="var(--sec-books)">
          <select aria-label="Track" value={track} onChange={(e) => setTrack(e.target.value)}>
            <option value="">All tracks</option>
            {s.readingTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={showDropped}
              onChange={(e) => setShowDropped(e.target.checked)}
              className="h-4 w-4"
            />
            Include dropped
          </label>
        </PanelHeader>
        <div className="card p-4 md:p-5">
          {list.length === 0 ? (
            <p className="text-[15px] text-[var(--muted)]">
              Nothing finished{year ? ` in ${year}` : ""} yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="rd-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th className="text-right">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => {
                    const t = R.trackOf(s, b.trackId);
                    const end = endOf(b);
                    const days =
                      b.startedDate && end ? R.daysBetween(b.startedDate, end) + 1 : null;
                    return (
                      <tr key={b.id}>
                        <td>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 text-left hover:underline"
                            onClick={() => flow.open({ kind: "detail", bookId: b.id })}
                          >
                            {t && <TrackDot color={t.color} />}
                            <span className="font-semibold">{b.title}</span>
                          </button>
                          {b.status === "dropped" && (
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                              <StatusBadge status="dropped" />
                              {b.dropReason}
                            </span>
                          )}
                        </td>
                        <td>{fmtDateAuto(b.startedDate)}</td>
                        <td>{fmtDateAuto(end)}</td>
                        <td className="text-right font-mono-n">{days ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <PagesPerWeek tracker={tracker} />
      <FinishedPerMonth tracker={tracker} />
      <YearSummary tracker={tracker} years={years} />
    </div>
  );
}

/* ================================ Charts ================================ */

type Segment = { id: string; name: string; value: number; color: string };
type Column = { key: string; label: string; title: string; segments: Segment[] };

/** Clean axis steps: a top that is 1, 2 or 5 times a power of ten, in three or four ticks. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((st) => st >= rough) ?? pow * 10;
  const whole = Math.max(1, Math.round(step));
  const ticks = [];
  for (let v = 0; v <= max + whole - 1e-9; v += whole) ticks.push(v);
  return ticks;
}

/**
 * Columns, stacked when there is more than one series. Each has a hover
 * target the full height of its slot, and the figures are also in a table
 * underneath for anyone who would rather read them.
 */
function ColumnChart({
  columns,
  legend,
  unit,
  label,
}: {
  columns: Column[];
  legend: { name: string; color: string }[] | null;
  unit: string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, measured] = useWidth();
  const W = measured || 640;
  const H = 180;
  const left = 36;
  const bottom = 22;
  const top = 8;
  const plotH = H - top - bottom;
  const band = (W - left) / columns.length;
  const barW = Math.min(24, band * 0.6);
  const totals = columns.map((c) => c.segments.reduce((a, x) => a + x.value, 0));
  const ticks = niceTicks(Math.max(...totals, 0));
  const max = ticks[ticks.length - 1] || 1;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const GAP = 2;

  return (
    <figure className="rd-chart" aria-label={label}>
      {legend && (
        <div className="rd-legend">
          {legend.map((l) => (
            <span key={l.name} className="flex items-center gap-1.5">
              <TrackDot color={l.color} size={10} /> {l.name}
            </span>
          ))}
        </div>
      )}
      <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          role="img"
          aria-label={label}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={W} y1={y(t)} y2={y(t)} className="rd-chart__grid" />
              <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="rd-chart__tick">
                {t.toLocaleString()}
              </text>
            </g>
          ))}
          {columns.map((c, i) => {
            const cx = left + band * i + band / 2;
            let acc = 0;
            const segs = c.segments.filter((x) => x.value > 0);
            return (
              <g key={c.key}>
                {segs.map((x, j) => {
                  const y0 = y(acc);
                  acc += x.value;
                  const y1 = y(acc);
                  const last = j === segs.length - 1;
                  // The gap comes off the top of every segment but the last,
                  // so the stack keeps its true height.
                  const h = Math.max(0, y0 - y1 - (last ? 0 : GAP));
                  const r = last ? Math.min(4, h) : 0;
                  const x0 = cx - barW / 2;
                  const yt = y1 + (last ? 0 : GAP);
                  const d = r
                    ? `M${x0},${yt + h} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x0 + barW - r} Q${x0 + barW},${yt} ${x0 + barW},${yt + r} V${yt + h} Z`
                    : `M${x0},${yt + h} V${yt} H${x0 + barW} V${yt + h} Z`;
                  return (
                    <path
                      key={x.id}
                      d={d}
                      fill={x.color}
                      opacity={hover == null || hover === i ? 1 : 0.45}
                    />
                  );
                })}
                {/* Too tight for every label on a phone: every other one, kept
                    in step with the latest so it is always named. */}
                {(band >= 34 || (columns.length - 1 - i) % 2 === 0) && (
                  <text x={cx} y={H - 6} textAnchor="middle" className="rd-chart__tick">
                    {c.label}
                  </text>
                )}
                <rect
                  x={left + band * i}
                  y={top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>
        {hover != null && (
          <div
            className="chart-tip"
            style={{
              left: `${((left + band * hover + band / 2) / W) * 100}%`,
              transform: hover > columns.length / 2 ? "translateX(-100%)" : undefined,
            }}
          >
            <div className="font-semibold">{columns[hover].title}</div>
            {columns[hover].segments.length > 1 &&
              columns[hover].segments.map((x) => (
                <div key={x.id} className="flex items-center gap-1.5">
                  <TrackDot color={x.color} /> {x.name}: {x.value.toLocaleString()}
                </div>
              ))}
            <div>
              {columns[hover].segments.length > 1 ? "Total: " : ""}
              {totals[hover].toLocaleString()} {unit}
            </div>
          </div>
        )}
      </div>
      <details className="mt-1 text-xs text-[var(--muted)]">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="rd-table mt-1">
          <thead>
            <tr>
              <th />
              {columns[0]?.segments.length > 1 &&
                columns[0].segments.map((x) => (
                  <th key={x.id} className="text-right">
                    {x.name}
                  </th>
                ))}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c, i) => (
              <tr key={c.key}>
                <td>{c.title}</td>
                {c.segments.length > 1 &&
                  c.segments.map((x) => (
                    <td key={x.id} className="text-right font-mono-n">
                      {x.value}
                    </td>
                  ))}
                <td className="text-right font-mono-n">{totals[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Pages logged each week for the last twelve, stacked by track. */
function PagesPerWeek({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const tracks = s.readingTracks.filter(
    (t) => !t.archived || s.books.some((b) => b.trackId === t.id),
  );
  const trackOfBook = new Map(s.books.map((b) => [b.id, b.trackId]));
  // Monday of this week, then eleven before it.
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const thisMonday = dateKey(d);
  const weeks = Array.from({ length: 12 }, (_, i) => R.addDays(thisMonday, (i - 11) * 7));

  const columns: Column[] = weeks.map((w) => {
    const end = R.addDays(w, 6);
    const inWeek = s.readingSessions.filter((x) => x.date >= w && x.date <= end && x.date <= today);
    const [, m, day] = w.split("-").map(Number);
    return {
      key: w,
      label: `${day}/${m}`,
      title: `Week of ${fmtDateAuto(w)}`,
      segments: tracks.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        value: inWeek
          .filter((x) => trackOfBook.get(x.bookId) === t.id)
          .reduce((a, x) => a + x.pages, 0),
      })),
    };
  });
  const any = columns.some((c) => c.segments.some((x) => x.value > 0));

  return (
    <section>
      <PanelHeader title="Pages per week" color="var(--sec-books)" />
      <div className="card p-4 md:p-5">
        {any ? (
          <ColumnChart
            label="Pages read per week, by track, last 12 weeks"
            columns={columns}
            legend={
              tracks.length > 1 ? tracks.map((t) => ({ name: t.name, color: t.color })) : null
            }
            unit="pages"
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Log some reading and it shows up here, week by week.
          </p>
        )}
      </div>
    </section>
  );
}

/** Books finished each month for the last twelve. */
function FinishedPerMonth({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const columns: Column[] = months.map((m) => ({
    key: m,
    label: monthLabel(`${m}-01`),
    title: `${monthLabel(`${m}-01`)} ${m.slice(0, 4)}`,
    segments: [
      {
        id: "finished",
        name: "Finished",
        color: "var(--accent)",
        value: s.books.filter((b) => b.status === "finished" && b.doneDate?.startsWith(m)).length,
      },
    ],
  }));
  const any = columns.some((c) => c.segments[0].value > 0);
  return (
    <section>
      <PanelHeader title="Books finished per month" color="var(--sec-books)" />
      <div className="card p-4 md:p-5">
        {any ? (
          <ColumnChart
            label="Books finished per month, last 12 months"
            columns={columns}
            legend={null}
            unit="books"
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">No books finished in the last year yet.</p>
        )}
      </div>
    </section>
  );
}

/** A year in review: books and pages by track, and best streaks. */
function YearSummary({ tracker, years }: { tracker: Tracker; years: string[] }) {
  const s = tracker.state!;
  const [year, setYear] = useState(years[0] ?? dateKey().slice(0, 4));
  const from = `${year}-01-01`;
  const today = dateKey();
  const to = `${year}-12-31` < today ? `${year}-12-31` : today;
  const trackOfBook = new Map(s.books.map((b) => [b.id, b.trackId]));
  const sessions = s.readingSessions.filter((x) => x.date.startsWith(year));

  const rows = s.readingTracks
    .map((t) => ({
      t,
      books: s.books.filter(
        (b) => b.trackId === t.id && b.status === "finished" && b.doneDate?.startsWith(year),
      ).length,
      pages: sessions
        .filter((x) => trackOfBook.get(x.bookId) === t.id)
        .reduce((a, x) => a + x.pages, 0),
      streak: R.longestStreak(s, t, from, to),
    }))
    .filter((r) => r.books || r.pages || !r.t.archived);

  return (
    <section>
      <PanelHeader title="Year in review" color="var(--sec-books)">
        {years.length > 1 && (
          <Segmented
            label="Year"
            size="sm"
            value={year}
            onChange={setYear}
            options={years.slice(0, 4).map((y) => ({ value: y, label: y }))}
          />
        )}
      </PanelHeader>
      <div className="card p-4 md:p-5">
        <div className="overflow-x-auto">
          <table className="rd-table">
            <thead>
              <tr>
                <th>Track</th>
                <th className="text-right">Books</th>
                <th className="text-right">Pages</th>
                <th className="text-right">Longest streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.t.id}>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <TrackDot color={r.t.color} /> {r.t.name}
                    </span>
                  </td>
                  <td className="text-right font-mono-n">{r.books}</td>
                  <td className="text-right font-mono-n">{r.pages.toLocaleString()}</td>
                  <td className="text-right font-mono-n">{r.streak ? `${r.streak} d` : "—"}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>All</td>
                <td className="text-right font-mono-n">{rows.reduce((a, r) => a + r.books, 0)}</td>
                <td className="text-right font-mono-n">
                  {rows.reduce((a, r) => a + r.pages, 0).toLocaleString()}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Pages count page updates; progress entered before those existed isn&apos;t dated.
        </p>
      </div>
    </section>
  );
}
