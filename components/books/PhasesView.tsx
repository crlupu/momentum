"use client";

import { Button } from "../ui";
import { Pencil, Plus } from "../icons";
import { Tracker, dateKey } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { StatusBadge, TrackDot, fmtDate, fmtDateAuto } from "./bits";
import { useFlow } from "./flowContext";

const FLAG_LABEL: Record<R.PhaseFlag, string> = {
  done: "Done",
  "on-track": "On track",
  "at-risk": "At risk",
  behind: "Behind",
  unknown: "No projection yet",
};

/**
 * The plan in blocks. Each phase shows how far through it is, when it will
 * be finished at the pace of the last fortnight, and its books by track.
 */
export function PhasesView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const flow = useFlow();
  const today = dateKey();
  const stats = R.phaseStats(s, today);
  const phases = [...s.readingPhases].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const unassigned = s.books.filter(
    (b) => !b.phaseId && (b.status === "queued" || b.status === "active" || b.status === "paused")
  ).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          {phases.length === 0
            ? "No phases yet. A phase is a block of the plan, e.g. Q4 2026, holding books from every track."
            : unassigned > 0
              ? `${unassigned} unfinished book${unassigned === 1 ? " isn't" : "s aren't"} in a phase.`
              : "Every unfinished book is in a phase."}
        </p>
        <span className="flex gap-2">
          {phases.length === 0 && (
            <Button size="sm" variant="ghost" onPress={() => flow.open({ kind: "import" })}>
              Import a plan
            </Button>
          )}
          <Button size="sm" variant="outline" onPress={() => flow.open({ kind: "phase", phaseId: null })}>
            <Plus className="h-3.5 w-3.5" /> New phase
          </Button>
        </span>
      </div>

      {phases.map((p) => {
        const st = stats.get(p.id)!;
        const pct = Math.round(st.completion * 100);
        const current = p.start <= today && today <= p.end;
        return (
          <section key={p.id} className={"rd-phase" + (current ? " rd-phase--current" : "")}>
            <header className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-semibold">{p.name}</h4>
                <p className="text-xs text-[var(--muted)]">
                  {fmtDate(p.start, true)} – {fmtDate(p.end, true)}
                  {current ? " · now" : ""}
                </p>
                {p.goal && <p className="mt-1 max-w-prose text-sm text-foreground/75">{p.goal}</p>}
              </div>
              <span className="flex items-center gap-1">
                <span className={`rd-flag rd-flag--${st.flag}`}>{FLAG_LABEL[st.flag]}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`Edit ${p.name}`}
                  onPress={() => flow.open({ kind: "phase", phaseId: p.id })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </span>
            </header>

            <div className="mt-2 flex items-center gap-2">
              <div className="book-card__meter flex-1" aria-hidden>
                <span style={{ width: `${pct}%`, background: "var(--accent)" }} />
              </div>
              <span className="font-mono-n text-sm font-bold">{pct}%</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {st.finished} of {st.books.length} books finished
              {st.projected &&
                ` · projected ${fmtDateAuto(st.projected)}${st.assumed ? " (at target pace)" : ""}`}
              {st.unsized > 0 &&
                (st.projected
                  ? ` · ${st.unsized} without a page count not projected`
                  : ` · page counts needed for a projection (${st.unsized} missing)`)}
            </p>

            {st.books.length > 0 && (
              <div className="rd-phase__tracks">
                {s.readingTracks
                  .map((t) => ({ t, books: st.books.filter((b) => b.trackId === t.id) }))
                  .filter((x) => x.books.length > 0)
                  .map(({ t, books }) => (
                    <div key={t.id}>
                      <h5 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
                        <TrackDot color={t.color} /> {t.name}
                      </h5>
                      <ul className="flex flex-col">
                        {books
                          .sort((a, b) => a.queueOrder - b.queueOrder)
                          .map((b) => (
                            <li key={b.id}>
                              <button
                                type="button"
                                className="rd-phase__book"
                                onClick={() => flow.open({ kind: "detail", bookId: b.id })}
                              >
                                <span className="min-w-0 truncate">{b.title}</span>
                                <StatusBadge status={b.status} />
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
