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
  const [editing, setEditing] = useState(false);
  // The step just added, whose name is selected to be typed over.
  const [focusId, setFocusId] = useState<string | null>(null);

  /** Rewrites the parts from the latest saved ones, so quick edits don't undo each other. */
  const writeParts = (fn: (list: Part[]) => Part[]) => {
    const now = tracker.state!.goals.find((x) => x.id === g.id)?.parts ?? [];
    return tracker.setGoalParts(g.id, fn(now));
  };
  // Saved at once, so it's there the moment it's tapped; Edit opens on its
  // name, ready to be typed over. A goal's own count becomes its first step,
  // so nothing counted so far is lost.
  const addStep = () => {
    const id = uid();
    const now = tracker.state!.goals.find((x) => x.id === g.id) ?? g;
    void writeParts((list) => {
      const first =
        list.length === 0 && now.target
          ? [{ id: uid(), title: "Progress", current: now.current ?? 0, target: now.target }]
          : [];
      return [...list, ...first, { id, title: `Step ${list.length + first.length + 1}`, current: 0, target: 1 }];
    });
    setEditing(true);
    setFocusId(id);
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

      {/* The steps, as an iOS list: counted with − and + as they stand,
          and renamed, resized or deleted in Edit, which a new step opens. */}
      <section className="goal-steps" aria-label="Steps">
        <div className="goal-steps__head">
          <h3 className="group-label">{parts.length ? "Steps" : "Progress"}</h3>
          <button
            type="button"
            className="text-action"
            aria-pressed={editing}
            onClick={() => {
              setEditing((v) => !v);
              setFocusId(null);
            }}
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <ul className="step-list">
          {parts.length === 0 ? (
            <StepRow
              name="Completed"
              current={g.current ?? 0}
              total={g.target ?? null}
              widest={widest}
              editing={editing}
              onStep={(d) => tracker.stepGoal(g.id, d)}
              onCurrent={(n) => setOwnCount({ current: n })}
              onTotal={(n) => setOwnCount({ target: n })}
            />
          ) : (
            parts.map((p) => (
              <StepRow
                key={p.id}
                name={p.title}
                current={p.current}
                total={p.target}
                widest={widest}
                editing={editing}
                focus={focusId === p.id}
                onStep={(d) => tracker.stepPart(g.id, p.id, d)}
                onName={(title) => writeParts((list) => list.map((x) => (x.id === p.id ? { ...x, title } : x)))}
                onCurrent={(n) =>
                  writeParts((list) =>
                    list.map((x) => (x.id === p.id ? { ...x, current: Math.min(x.target, Math.max(0, n ?? 0)) } : x))
                  )
                }
                onTotal={(n) =>
                  n && n > 0
                    ? writeParts((list) =>
                        list.map((x) => (x.id === p.id ? { ...x, target: n, current: Math.min(x.current, n) } : x))
                      )
                    : Promise.resolve()
                }
                onDelete={() => writeParts((list) => list.filter((x) => x.id !== p.id))}
              />
            ))
          )}
          <li>
            <button type="button" className="step-add" onClick={addStep}>
              <span className="step-add__icon" aria-hidden>
                <Plus />
              </span>
              Add Step
            </button>
          </li>
        </ul>
      </section>

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
 * One step. As it stands: its name and "− 4 of 30 +". In Edit: a red delete
 * button, and its name, done count and total as text fields.
 */
function StepRow({
  name,
  current,
  total,
  widest,
  editing,
  focus,
  onStep,
  onName,
  onCurrent,
  onTotal,
  onDelete,
}: {
  name: string;
  current: number;
  total: number | null;
  widest: number;
  editing: boolean;
  focus?: boolean;
  onStep: (delta: number) => Promise<unknown>;
  /** Absent for a goal's own count, whose row is always "Progress". */
  onName?: (title: string) => Promise<unknown>;
  onCurrent: (n: number | null) => Promise<unknown>;
  onTotal: (n: number | null) => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
}) {
  const { reset: resetName, ...nameField } = useInline(name, (v) => v, (text) => {
    if (text.trim() && onName) void onName(text.trim());
    else resetName();
  });
  const { reset: resetCur, ...curField } = useInline(current, String, (text) => {
    const n = num(text);
    if (n != null && n >= 0) void onCurrent(total ? Math.min(n, total) : n);
    else resetCur();
  });
  const { reset: resetTot, ...totField } = useInline(total, (v) => (v == null ? "" : String(v)), (text) => {
    const n = num(text);
    if (n != null && n > 0) void onTotal(n);
    else if (!onDelete && text.trim() === "") void onTotal(null);
    else resetTot();
  });
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus && editing) {
      nameRef.current?.focus();
      nameRef.current?.select();
    }
  }, [focus, editing]);

  if (editing) {
    return (
      <li className="step-row step-row--editing">
        {onDelete && (
          <button type="button" className="step-delete" aria-label={`Delete ${name}`} onClick={() => void onDelete()}>
            <Minus aria-hidden />
          </button>
        )}
        {onName ? (
          <input ref={nameRef} aria-label="Step name" placeholder="Name" className="step-field step-field--name" {...nameField} />
        ) : (
          <span className="step-row__name">{name}</span>
        )}
        <span className="step-row__figures">
          <input
            type="number"
            inputMode="decimal"
            aria-label={`Done, ${name}`}
            className="step-field step-field--num"
            {...curField}
          />
          <span className="step-row__of">of</span>
          <input
            type="number"
            inputMode="decimal"
            aria-label={`Total, ${name}`}
            placeholder="—"
            className="step-field step-field--num"
            {...totField}
          />
        </span>
      </li>
    );
  }

  const digits = Math.max(1, widest.toLocaleString().length);
  return (
    <li className="step-row">
      <span className="step-row__name">{name}</span>
      <span className="stepper">
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`One less, ${name}`}
          isDisabled={current <= 0}
          onPress={() => void onStep(-1)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="stepper__value font-mono-n" style={{ minInlineSize: `${digits * 2 + 3.5}ch` }}>
          {current.toLocaleString()}
          {total != null && <span className="stepper__total"> of {total.toLocaleString()}</span>}
        </span>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`One more, ${name}`}
          isDisabled={total != null && current >= total}
          onPress={() => void onStep(1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </span>
    </li>
  );
}

/** Where the goal lives, typed in place, with a button to open it. */
function LinkRow({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const { reset: _reset, ...field } = useInline(g.link ?? "", (v) => v, (text) => {
    void tracker.setGoalDetails(g.id, { link: text });
  });
  const href = /^https?:\/\//i.test(field.value.trim()) ? field.value.trim() : null;
  return (
    <div className="step-list">
      <div className="step-row">
      <span className="step-row__name flex-none">Link</span>
      <input
        type="url"
        aria-label="Link"
        placeholder="Add a link"
        className="inline-field min-w-0 flex-1 text-end"
        {...field}
      />
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="goal-link" aria-label="Open link">
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      )}
      </div>
    </div>
  );
}
