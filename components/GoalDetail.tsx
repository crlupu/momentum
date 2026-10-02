"use client";

import { useEffect, useRef, useState } from "react";
import { DialogActions } from "./DialogActions";
import { Button } from "./ui";
import { ProgressRing } from "./ProgressRing";
import { Check, ExternalLink, Minus, Plus, RotateCcw } from "./icons";
import { Goal, Part, Tracker, goalPct, goalSummary, uid } from "@/lib/tracker";

/** A number field's value, or null when empty or not a number. */
function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Text edited where it's shown: it looks like the text until tapped, and is
 * saved when the field is left (or Return is pressed), and on closing the
 * sheet with the field still open.
 */
function useInline<T>(value: T, show: (v: T) => string, commit: (text: string) => void) {
  const [text, setText] = useState(show(value));
  const editing = useRef(false);
  // Follows the value while not being edited, so − and + show through.
  useEffect(() => {
    if (!editing.current) setText(show(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef({ text, commit, changed: false });
  latest.current = { text, commit, changed: text !== show(value) };
  useEffect(
    () => () => {
      if (editing.current && latest.current.changed) latest.current.commit(latest.current.text);
    },
    []
  );
  return {
    value: text,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onFocus: () => {
      editing.current = true;
    },
    onBlur: () => {
      editing.current = false;
      if (text !== show(value)) commit(text);
      else setText(show(value));
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Enter") e.currentTarget.blur();
    },
    reset: () => setText(show(value)),
  };
}

/** The goal's name, as the sheet's title, renamed by typing over it. */
export function GoalTitle({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const { reset, ...field } = useInline(g.title, (v) => v, (text) => {
    if (text.trim()) void tracker.updateGoal(g.id, { title: text });
    else reset();
  });
  // A text area that grows with the name, so a long one wraps as a title
  // does rather than scrolling out of sight. Return still finishes.
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [field.value]);
  return (
    <textarea
      ref={area}
      rows={1}
      aria-label="Goal name"
      className="inline-title"
      {...field}
      onChange={(e) => field.onChange({ target: { value: e.target.value.replace(/\n/g, " ") } })}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/**
 * One goal, opened: how far it is, and its count, or its parts, each edited
 * where it stands. Names, totals and counts are all typed over in place;
 * − and + move a count by one.
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
  const pct = g.done ? 100 : goalPct(g);
  const parts = g.parts ?? [];
  const summary = g.done ? "Done" : goalSummary(g) ?? "Give it a total to track how far along it is.";
  const widest = Math.max(1, g.target ?? 0, ...parts.map((p) => p.target));
  // A part being added: kept here until it has a name and a total.
  const [adding, setAdding] = useState(false);

  /** Rewrites the parts from the latest saved ones, so quick edits don't undo each other. */
  const writeParts = (fn: (list: Part[]) => Part[]) => {
    const now = tracker.state!.goals.find((x) => x.id === g.id)?.parts ?? [];
    return tracker.setGoalParts(g.id, fn(now));
  };
  const setOwnCount = (c: { current?: number | null; target?: number | null }) => {
    const now = tracker.state!.goals.find((x) => x.id === g.id) ?? g;
    return tracker.saveGoal(g.id, {
      title: now.title,
      catId: now.catId,
      current: c.current !== undefined ? c.current : now.current ?? null,
      target: c.target !== undefined ? c.target : now.target ?? null,
    });
  };

  return (
    <div className="goal-detail">
      <div className="goal-detail__summary">
        <ProgressRing pct={pct} color="var(--accent)" size={64} />
        <div className="min-w-0">
          <p className="goal-detail__pct">{g.target || parts.length || g.done ? `${pct}% complete` : "Open"}</p>
          <p className="goal-detail__sub">{summary}</p>
        </div>
      </div>

      <ul className="goal-parts">
        {parts.length === 0 ? (
          <li className="goal-counter">
            <span className="goal-counter__label">Progress</span>
            <Counter
              current={g.current ?? 0}
              total={g.target ?? null}
              widest={widest}
              what={g.title}
              onStep={(d) => tracker.stepGoal(g.id, d)}
              onCurrent={(n) => setOwnCount({ current: n })}
              onTotal={(n) => setOwnCount({ target: n })}
            />
          </li>
        ) : (
          parts.map((p) => (
            <PartRow
              key={p.id}
              part={p}
              widest={widest}
              onStep={(d) => tracker.stepPart(g.id, p.id, d)}
              onChange={(patch) => writeParts((list) => list.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))}
              onRemove={() => writeParts((list) => list.filter((x) => x.id !== p.id))}
            />
          ))
        )}
        {adding && (
          <NewPart
            onDone={(part) => {
              setAdding(false);
              if (part) void writeParts((list) => [...list, part]);
            }}
          />
        )}
      </ul>
      {!adding && (
        <button type="button" className="text-action self-start" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add a part
        </button>
      )}

      <LinkRow tracker={tracker} goal={g} />

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
 * A part: its name, typed over in place, and its count. Clearing the name
 * and leaving the field removes the part, as an emptied item does in
 * Reminders.
 */
function PartRow({
  part: p,
  widest,
  onStep,
  onChange,
  onRemove,
}: {
  part: Part;
  widest: number;
  onStep: (delta: number) => Promise<unknown>;
  onChange: (patch: Partial<Part>) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
}) {
  const { reset: _reset, ...name } = useInline(p.title, (v) => v, (text) => {
    if (text.trim()) void onChange({ title: text.trim() });
    else void onRemove();
  });
  return (
    <li className="goal-counter">
      <input aria-label="Part name" placeholder="Name" className="inline-field goal-counter__label" {...name} />
      <Counter
        current={p.current}
        total={p.target}
        widest={widest}
        what={p.title}
        onStep={onStep}
        onCurrent={(n) => onChange({ current: Math.min(p.target, Math.max(0, n ?? 0)) })}
        onTotal={(n) => (n && n > 0 ? onChange({ target: n, current: Math.min(p.current, n) }) : Promise.resolve())}
        totalRequired
      />
    </li>
  );
}

/** A part being added: a name and a total, saved once both are there. */
function NewPart({ onDone }: { onDone: (part: Part | null) => void }) {
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const row = useRef<HTMLLIElement>(null);
  const finish = () => {
    const t = num(total);
    onDone(title.trim() && t && t > 0 ? { id: uid(), title: title.trim(), current: 0, target: t } : null);
  };
  // Done when focus leaves the row altogether, not when it moves from the
  // name to the total.
  const onBlur = (e: React.FocusEvent) => {
    if (!row.current?.contains(e.relatedTarget as Node)) finish();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") finish();
  };
  return (
    <li ref={row} className="goal-counter" onBlur={onBlur}>
      <input
        autoFocus
        aria-label="New part name"
        placeholder="Name, e.g. Readings"
        className="inline-field goal-counter__label"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <input
        type="number"
        inputMode="numeric"
        aria-label="New part total"
        placeholder="Total"
        className="inline-field inline-number"
        style={{ inlineSize: "5ch" }}
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </li>
  );
}

/**
 * "− 4 of 30 +": − and + move the count by one, and both figures can be
 * typed over. Presses are never held back while a save is in flight, so
 * five quick taps count five. The figures are as wide as the widest total
 * on the sheet, so a column of counters lines up.
 */
function Counter({
  current,
  total,
  widest,
  what,
  onStep,
  onCurrent,
  onTotal,
  totalRequired,
}: {
  current: number;
  total: number | null;
  widest: number;
  what: string;
  onStep: (delta: number) => Promise<unknown>;
  onCurrent: (n: number | null) => Promise<unknown>;
  onTotal: (n: number | null) => Promise<unknown>;
  /** A part always has a total; a goal's own count can be cleared. */
  totalRequired?: boolean;
}) {
  const ch = `${Math.max(1, widest.toLocaleString().length) + 1}ch`;
  const { reset: resetCur, ...cur } = useInline(current, String, (text) => {
    const n = num(text);
    if (n != null && n >= 0) void onCurrent(total ? Math.min(n, total) : n);
    else resetCur();
  });
  const { reset: resetTot, ...tot } = useInline(total, (v) => (v == null ? "" : String(v)), (text) => {
    const n = num(text);
    if (n != null && n > 0) void onTotal(n);
    else if (!totalRequired && text.trim() === "") void onTotal(null);
    else resetTot();
  });
  return (
    <span className="stepper">
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`One less, ${what}`}
        isDisabled={current <= 0}
        onPress={() => void onStep(-1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="stepper__value font-mono-n">
        <input
          type="number"
          inputMode="decimal"
          aria-label={`Done, ${what}`}
          className="inline-field inline-number"
          style={{ inlineSize: ch }}
          {...cur}
        />
        <span className="stepper__total">of</span>
        <input
          type="number"
          inputMode="decimal"
          aria-label={`Total, ${what}`}
          placeholder="—"
          className="inline-field inline-number stepper__total"
          style={{ inlineSize: ch }}
          {...tot}
        />
      </span>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`One more, ${what}`}
        isDisabled={total != null && current >= total}
        onPress={() => void onStep(1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </span>
  );
}

/** Where the goal lives, typed in place, with a button to open it. */
function LinkRow({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const { reset: _reset, ...field } = useInline(g.link ?? "", (v) => v, (text) => {
    void tracker.setGoalDetails(g.id, { link: text });
  });
  const href = /^https?:\/\//i.test(field.value.trim()) ? field.value.trim() : null;
  return (
    <div className="goal-counter">
      <span className="goal-counter__label shrink-0">Link</span>
      <input
        type="url"
        aria-label="Link"
        placeholder="https://… the course"
        className="inline-field min-w-0 flex-1 text-end"
        {...field}
      />
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="goal-link" aria-label="Open link">
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      )}
    </div>
  );
}
