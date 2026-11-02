"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Tracker, dateKey } from "@/lib/tracker";
import {
  MEASURES,
  MEASURE_HOW,
  MEASURE_LABEL,
  cmText,
  firstOf,
  lastTwo,
  monthName,
  monthOf,
  monthShort,
  signed,
  type Measure,
  type Measurement,
} from "@/lib/measurements";
import { SummaryCard } from "./SummaryCard";
import { MacroField } from "./QuickAdd";
import { Modal } from "./Modal";
import { DialogActions } from "./DialogActions";
import { usePending } from "./ActionButton";
import { ChevronRight } from "./icons";

/** One measurement's months as a line: grey, the latest month a blue dot. */
function MonthLine({ list, k, wide }: { list: Measurement[]; k: Measure; wide?: boolean }) {
  const pts = list.filter((m) => m[k] != null).slice(-12);
  if (pts.length < 2) return null;
  const W = wide ? 350 : 140;
  const H = wide ? 44 : 34;
  const vs = pts.map((m) => m[k]!);
  const lo = Math.min(...vs);
  const span = Math.max(...vs) - lo || 1;
  const xy = vs.map((v, i) => [(i / (vs.length - 1)) * W, H - 4 - ((v - lo) / span) * (H - 8)]);
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg width={wide ? "100%" : W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={wide ? "weight-spark" : "flex-none"} aria-hidden>
      <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeOpacity={wide ? 1 : 0.55} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {!wide && <circle cx={lx} cy={ly} r="3" fill="var(--accent)" />}
    </svg>
  );
}

/**
 * Measurements on Health: the waist as the figure (it moves most with fat
 * loss) with its change since the first month, its line, the three with the
 * change from the month before, and Log for this month. Once the current
 * month has nothing, it says the month is due.
 */
export function MeasurementsCard({ tracker, onPage }: { tracker: Tracker; /** On its own page: no History link back to it. */ onPage?: boolean }) {
  const list = tracker.state!.measurements ?? [];
  const today = dateKey();
  const month = monthOf(today);
  const [open, setOpen] = useState(false);
  const logged = list.some((m) => m.month === month);
  const lead: Measure = lastTwo(list, "waist").now ? "waist" : (MEASURES.find((k) => lastTwo(list, k).now) ?? "waist");
  const shown = lastTwo(list, lead);
  const since = firstOf(list, lead);
  const sheet = (
    <Modal open={open} onClose={() => setOpen(false)} title={`${monthName(month, today)} measurements`}>
      {open && <MeasureForm tracker={tracker} month={month} onDone={() => setOpen(false)} />}
    </Modal>
  );

  if (!list.length)
    return (
      <div className="card p-4 md:p-5">
        <p className="empty-state__title">Measure once a month</p>
        <p className="empty-state__text">Waist, chest and arm, in centimetres. Weight says how much; these say where.</p>
        <button type="button" className="pill-link pill-link--primary mt-3" onClick={() => setOpen(true)}>
          Log
        </button>
        {sheet}
      </div>
    );

  return (
    <>
      <SummaryCard
        label="Measurements"
        aside={<span className={"weight-now__badge" + (logged ? " is-on-track" : "")}>{logged ? `${monthName(month, today)} logged` : `${monthName(month, today)} due`}</span>}
        figure={shown.now ? cmText(shown.now.v) : "–"}
        side={{
          unit: `cm ${MEASURE_LABEL[lead].toLowerCase()}`,
          hint: since && shown.now && since.month !== shown.now.month ? `${signed(shown.now.v - since.v)} since ${monthName(since.month, today)}` : undefined,
        }}
        actions={
          <>
            <button type="button" className="pill-link pill-link--primary flex-1 justify-center" onClick={() => setOpen(true)}>
              Log
            </button>
            {!onPage && (
              <Link href="/fitness?view=measurements" className="pill-link">
                History
              </Link>
            )}
          </>
        }
        figures={MEASURES.map((k) => {
          const t = lastTwo(list, k);
          return {
            value: t.now ? `${cmText(t.now.v)} cm` : "–",
            label: t.now && t.before ? `${MEASURE_LABEL[k]}, ${signed(t.now.v - t.before.v)}` : MEASURE_LABEL[k],
            href: onPage ? undefined : "/fitness?view=measurements",
          };
        })}
      >
        <MonthLine list={list} k={lead} wide />
      </SummaryCard>
      {sheet}
    </>
  );
}

/**
 * A month's three fields, last month's figures as the placeholders. An empty
 * field leaves that measurement as it is; clearing a saved one removes it.
 */
function MeasureForm({ tracker, month, onDone }: { tracker: Tracker; month: string; onDone: () => void }) {
  const list = tracker.state!.measurements ?? [];
  const own = list.find((m) => m.month === month);
  const before = [...list].reverse().find((m) => m.month < month);
  const [vals, setVals] = useState<Record<Measure, string>>(() => ({
    waist: own?.waist != null ? String(own.waist) : "",
    chest: own?.chest != null ? String(own.chest) : "",
    arm: own?.arm != null ? String(own.arm) : "",
  }));
  const { pending, run } = usePending();
  const num = (t: string) => {
    const n = Number(t.replace(",", "."));
    return t.trim() && Number.isFinite(n) && n > 0 ? n : null;
  };
  const any = MEASURES.some((k) => num(vals[k]) != null || (own?.[k] != null && !vals[k].trim()));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(
      MEASURES.map((k) => [k, num(vals[k]) ?? (own?.[k] != null && !vals[k].trim() ? null : undefined)])
    );
    const ok = await run(() => tracker.setMeasurements(month, values));
    if (ok) onDone();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-[13px] text-[var(--muted)]">
        Same spot each month: waist {MEASURE_HOW.waist}; chest {MEASURE_HOW.chest}; arm {MEASURE_HOW.arm}.
      </p>
      <div className="measure-fields">
        {MEASURES.map((k, i) => (
          <MacroField
            key={k}
            label={MEASURE_LABEL[k]}
            unit="cm"
            ariaLabel={`${MEASURE_LABEL[k]} in cm`}
            value={vals[k]}
            placeholder={before?.[k] != null ? cmText(before[k]!) : "–"}
            onChange={(v) => setVals((x) => ({ ...x, [k]: v }))}
            autoFocus={i === 0}
          />
        ))}
      </div>
      <p className="text-[12px] text-[var(--muted)]">
        {before ? `Greyed figures are ${monthName(before.month, dateKey())}'s. ` : ""}Leave one empty to skip it.
      </p>
      <DialogActions primary={{ label: "Save", disabled: pending || !any }} />
    </form>
  );
}

/**
 * The measurements page: a line per measurement with its latest figure, then
 * every month in a table with the change from the month before. A month
 * opens to be corrected.
 */
export function MeasurementsPage({ tracker }: { tracker: Tracker }) {
  const list = tracker.state!.measurements ?? [];
  const today = dateKey();
  const [editing, setEditing] = useState<string | null>(null);
  const months = [...list].reverse();
  return (
    <div className="flex flex-col gap-5">
      <MeasurementsCard tracker={tracker} onPage />
      {list.length > 0 && (
        <>
          <ul className="card measure-lines">
            {MEASURES.map((k) => {
              const t = lastTwo(list, k);
              const f = firstOf(list, k);
              return (
                <li key={k} className="measure-line">
                  <span className="measure-line__text">
                    <span className="measure-line__name">{MEASURE_LABEL[k]}</span>
                    <span className="measure-line__value">
                      {t.now ? cmText(t.now.v) : "–"}
                      <span className="measure-line__unit"> cm</span>
                    </span>
                    {t.now && f && f.month !== t.now.month && (
                      <span className="measure-line__since">
                        {signed(t.now.v - f.v)} since {monthName(f.month, today)}
                      </span>
                    )}
                  </span>
                  <MonthLine list={list} k={k} />
                </li>
              );
            })}
          </ul>
          <section>
            <h2 className="group-head">Every month</h2>
            <div className="card measure-table" role="table" aria-label="Measurements by month">
              <div className="measure-table__row measure-table__row--head" role="row">
                <span role="columnheader">Month</span>
                {MEASURES.map((k) => (
                  <span key={k} role="columnheader">
                    {MEASURE_LABEL[k]}
                  </span>
                ))}
                <span aria-hidden />
              </div>
              {months.map((m) => {
                const prev = list.filter((x) => x.month < m.month);
                return (
                  <button key={m.month} type="button" role="row" className="measure-table__row" onClick={() => setEditing(m.month)}>
                    <span role="cell">{monthShort(m.month)}</span>
                    {MEASURES.map((k) => {
                      const p = [...prev].reverse().find((x) => x[k] != null)?.[k];
                      return (
                        <span key={k} role="cell" className="font-mono-n">
                          {m[k] != null ? cmText(m[k]!) : "–"}
                          {m[k] != null && p != null && <span className="measure-table__delta"> {signed(m[k]! - p)}</span>}
                        </span>
                      );
                    })}
                    <ChevronRight className="rd-link__chevron" aria-hidden />
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `${monthName(editing, today)} measurements` : ""}>
        {editing && <MeasureForm tracker={tracker} month={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
