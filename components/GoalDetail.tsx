"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { DialogActions } from "./DialogActions";
import { Button, Input } from "./ui";
import { usePending } from "./ActionButton";
import { CatPicker } from "./Forms";
import { ProgressRing } from "./ProgressRing";
import { Check, ExternalLink, Minus, Plus, RotateCcw } from "./icons";
import { Goal, Tracker, goalPct } from "@/lib/tracker";

/** A number field's value, or null when empty or not a number. */
function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * One goal, opened: how far it is, its details, and what can be done with it.
 *
 * A goal with a count (videos, pages, modules) is moved along with − and +;
 * one without is simply done or not, with Mark as done.
 */
export function GoalDetail({
  tracker,
  goal: g,
  onClose,
}: {
  tracker: Tracker;
  goal: Goal;
  onClose: () => void;
}) {
  const s = tracker.state!;
  const pct = g.done ? 100 : goalPct(g);
  const summary = g.done
    ? "Done"
    : g.target
      ? `${(g.current ?? 0).toLocaleString()} of ${g.target.toLocaleString()}`
      : "No count yet. Add one in Details to track how far along it is.";

  return (
    <div className="goal-detail">
      <div className="goal-detail__summary">
        <ProgressRing pct={pct} color="var(--accent)" size={64} />
        <div className="min-w-0">
          <p className="goal-detail__pct">{g.target || g.done ? `${pct}% complete` : "Open"}</p>
          <p className="goal-detail__sub">{summary}</p>
        </div>
      </div>

      {/* The count is the control, with − and + beside it. */}
      {!!g.target && !g.done && (
        <div className="goal-counter">
          <span className="goal-counter__label">Progress</span>
          <Stepper
            value={g.current ?? 0}
            total={g.target}
            onStep={(d) => tracker.stepGoal(g.id, d)}
            what={g.title}
          />
        </div>
      )}

      <AfterFirstFrame>
        <Details tracker={tracker} goal={g} />
      </AfterFirstFrame>

      <DialogActions
        del={{
          what: `the goal "${g.title}"`,
          onDelete: async () => {
            onClose();
            return tracker.deleteGoal(g.id);
          },
        }}
        primary={{
          label: g.done ? (
            <>
              <RotateCcw className="h-4 w-4" /> Reopen
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Mark as done
            </>
          ),
          onPress: () => {
            void tracker.toggleGoalDone(g.id);
            if (!g.done) onClose();
          },
        }}
      />
    </div>
  );
}

/**
 * "3 of 10" between a − and a +.
 *
 * Presses are never held back while a save is in flight: the change is on
 * screen at once and each write starts from the one before, so tapping + five
 * times quickly counts five. Locking the buttons until the round trip ended
 * made + ignore taps and − flash to disabled and back on every press.
 *
 * The figure is as wide as the largest it can be, so the buttons don't shift
 * as the count gains a digit.
 */
function Stepper({
  value,
  total,
  onStep,
  what,
}: {
  value: number;
  total: number;
  onStep: (delta: number) => Promise<unknown>;
  what: string;
}) {
  const digits = total.toLocaleString().length;
  return (
    <span className="stepper">
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`One less, ${what}`}
        isDisabled={value <= 0}
        onPress={() => void onStep(-1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="stepper__value font-mono-n" style={{ minInlineSize: `${digits * 2 + 3.5}ch` }}>
        {value.toLocaleString()}
        <span className="stepper__total"> of {total.toLocaleString()}</span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`One more, ${what}`}
        isDisabled={value >= total}
        onPress={() => void onStep(1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </span>
  );
}

/**
 * Renders its children one frame after the sheet opens. The details form is
 * the heaviest part of the sheet and sits below the fold on a phone; drawn
 * with the rest, it held back the frame that shows the sheet at all. The
 * slide-in covers the gap.
 */
function AfterFirstFrame({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready ? <>{children}</> : <div className="goal-section goal-section--pending" aria-hidden />;
}

/** Name, description, category, count and link. */
function Details({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const s = tracker.state!;
  const [name, setName] = useState(g.title);
  const [current, setCurrent] = useState(g.current != null ? String(g.current) : "");
  const [target, setTarget] = useState(g.target != null ? String(g.target) : "");
  // − and + change the count from above; the fields follow, so they never
  // hold a figure that Save would write back over the newer one.
  useEffect(() => setCurrent(g.current != null ? String(g.current) : ""), [g.current]);
  useEffect(() => setTarget(g.target != null ? String(g.target) : ""), [g.target]);
  const [link, setLink] = useState(g.link ?? "");
  const [note, setNote] = useState(g.note ?? "");
  const { pending, run } = usePending();

  const dirty =
    name.trim() !== g.title ||
    num(current) !== (g.current ?? null) ||
    num(target) !== (g.target ?? null) ||
    link.trim() !== (g.link ?? "") ||
    note.trim() !== (g.note ?? "");

  const save = async () => {
    await run(async () => {
      await tracker.saveGoal(g.id, {
        title: name,
        catId: g.catId,
        current: num(current),
        target: num(target),
      });
      return tracker.setGoalDetails(g.id, { link, note });
    });
  };

  // Saved as it's typed, a moment after the last key, and on closing: there
  // is no Save to find, and closing with ✕ never loses an edit. A name
  // cleared to nothing waits until it has one again.
  const latest = useRef({ dirty, save, named: !!name.trim() });
  latest.current = { dirty, save, named: !!name.trim() };
  useEffect(() => {
    if (!dirty || !name.trim()) return;
    const t = setTimeout(() => void save(), 600);
    return () => clearTimeout(t);
  }, [name, current, target, link, note]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      const l = latest.current;
      if (l.dirty && l.named) void l.save();
    },
    []
  );

  const href = link.trim() && /^https?:\/\//i.test(link.trim()) ? link.trim() : null;

  return (
    <section className="goal-section" aria-labelledby="goal-details">
      <h3 id="goal-details" className="group-label" style={{ paddingInline: 0 }}>Details</h3>
      <div className="goal-fields">
        <label className="goal-field">
          <span>Name</span>
          <Input aria-label="Goal name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="goal-field">
          <span>Description</span>
          <textarea
            aria-label="Description"
            rows={4}
            placeholder="Details: what it covers, why, where you left off…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <CatPicker tracker={tracker} catId={g.catId} setCatId={(id) => void tracker.updateGoal(g.id, { catId: id })} />

        {/* Each number labelled: once filled, a placeholder no longer says
            which is which. */}
        <div className="grid grid-cols-2 gap-2">
          <label className="goal-field">
            <span>Done so far</span>
            <Input type="number" inputMode="decimal" placeholder="e.g. 3" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="goal-field">
            <span>Total (pages, videos…)</span>
            <Input type="number" inputMode="decimal" placeholder="e.g. 12" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        </div>

        <label className="goal-field">
          <span>Link</span>
          <span className="flex gap-2">
            <Input
              type="url"
              aria-label="Link"
              placeholder="https://… the course or repository"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="flex-1"
            />
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="goal-link"
                aria-label="Open link"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
          </span>
        </label>


      </div>
    </section>
  );
}
