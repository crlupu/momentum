"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { DialogActions } from "./DialogActions";
import { Button } from "./ui";
import { usePending } from "./ActionButton";
import { ProgressRing } from "./ProgressRing";
import { Check, ChevronDown, ChevronRight, ExternalLink, Minus, Plus } from "./icons";
import { DeleteGlyph } from "./DeleteGlyph";
import { RepeatSelect } from "./RepeatSelect";
import { MenuSelect } from "./Menu";
import { GENERAL, pathOfGoal } from "@/lib/paths";
import { Goal, GoalItem, GoalStatus, Part, Tracker, findItem, goalPct, goalStatus, goalSummary, minimumReached, uid } from "@/lib/tracker";
import { goalLog, otherActiveInTopic } from "@/lib/ops";
import { fmtDateAuto } from "@/lib/dates";

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
  // The name is typed over in place; renaming isn't a second Edit button.
  return (
    <span className="inline-title-wrap">
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
    </span>
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
  const status = goalStatus(g);
  const alsoActive = otherActiveInTopic(tracker.state!, g.id);
  const pct = g.done ? 100 : goalPct(g);
  const parts = g.parts ?? [];
  const summary = g.done ? "Done" : goalSummary(g) ?? "Give it a total to track how far along it is.";
  const widest = Math.max(1, g.target ?? 0, ...parts.map((p) => p.target));
  const [editing, setEditing] = useState(false);
  const log = goalLog(tracker.state!, g.id);
  const last = log[log.length - 1];
  /** + logs a session; − takes a mistaken + back. */
  const step = (d: number, partId?: string) =>
    d > 0 ? tracker.logSession(g.id, partId, uid()) : tracker.stepBack(g.id, partId);
  // The part just added, whose name is selected to be typed over.
  const [focusId, setFocusId] = useState<string | null>(null);
  // Parts whose checklists are showing. A part being worked on opens first.
  const [openParts, setOpenParts] = useState<string[]>(() => {
    const first = parts.find((p) => p.items?.length && p.current < p.target);
    return first ? [first.id] : [];
  });
  // A checklist just started: its first entry opens ready to be named.
  const pendingFocus = useRef<string | null>(null);

  /** Rewrites the parts from the latest saved ones, so quick edits don't undo each other. */
  const writeParts = (fn: (list: Part[]) => Part[]) => {
    const now = tracker.state!.goals.find((x) => x.id === g.id)?.parts ?? [];
    return tracker.setGoalParts(g.id, fn(now));
  };
  // The first entry, saved at once; the checklist opens in Edit on its name.
  const startChecklist = () => {
    const id = uid();
    void tracker.setGoalItems(g.id, [{ id, title: "Item 1" }]);
    pendingFocus.current = id;
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
      {g.note && <Description text={g.note} />}
      <div className="goal-detail__summary">
        <ProgressRing pct={pct} color="var(--accent)" size={64} />
        <div className="min-w-0">
          <p className="goal-detail__pct">{g.target || parts.length || g.done ? `${pct}% complete` : "Open"}</p>
          {minimumReached(g) && <p className="min-badge">Minimum reached</p>}
          <p className="goal-detail__sub">{summary}</p>
          {last && <p className="goal-detail__sub">Last session: {fmtDateAuto(last.date)}</p>}
        </div>
      </div>

      {status !== "done" && <NextItem tracker={tracker} goal={g} />}

      {/* A checklist counts itself: ticks instead of − and +. */}
      {g.items?.length ? (
        <Checklist tracker={tracker} goal={g} startOn={pendingFocus} />
      ) : (
      /* The parts, as an iOS list: counted with − and + as they stand,
          and renamed, resized or deleted in Edit, which a new part opens. */
      <section className="goal-steps" aria-label="Parts">
        <div className="goal-steps__head">
          <h3 className="group-label">{parts.length ? "Parts" : "Progress"}</h3>
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
            <>
            <StepRow
              name="Completed"
              current={g.current ?? 0}
              total={g.target ?? null}
              widest={widest}
              editing={editing}
              onStep={(d) => step(d)}
              onCurrent={(n) => setOwnCount({ current: n })}
              onTotal={(n) => setOwnCount({ target: n })}
              minimum={g.minimum}
              onMinimum={(n) => tracker.setGoalMinimum(g.id, n)}
            />
            </>
          ) : (
            parts.map((p) => (
              <Fragment key={p.id}>
              <StepRow
                counted={!!p.items?.length}
                open={openParts.includes(p.id)}
                onOpen={() => setOpenParts((o) => (o.includes(p.id) ? o.filter((x) => x !== p.id) : [...o, p.id]))}
                name={p.title}
                current={p.current}
                total={p.target}
                widest={widest}
                editing={editing}
                focus={focusId === p.id}
                onStep={(d) => step(d, p.id)}
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
                minimum={p.minimum}
                onMinimum={(n) =>
                  writeParts((list) =>
                    list.map((x) => {
                      if (x.id !== p.id) return x;
                      const { minimum: _m, ...rest } = x;
                      return n != null ? { ...rest, minimum: n } : rest;
                    })
                  )
                }
              />
              {p.items?.length && (openParts.includes(p.id) || editing) ? (
                <ChecklistRows
                  tracker={tracker}
                  goal={g}
                  partId={p.id}
                  items={p.items}
                  editing={editing}
                  focusId={focusId}
                  onFocus={setFocusId}
                />
              ) : null}
              </Fragment>
            ))
          )}
          {/* A goal is a count or a checklist: videos, talks, each ticked
              when finished. Goals don't hold other goals. */}
          {parts.length === 0 && (
            <li>
              <button type="button" className="step-add" onClick={startChecklist}>
                <span className="step-add__icon" aria-hidden>
                  <Plus />
                </span>
                Add Checklist
              </button>
            </li>
          )}
        </ul>
      </section>
      )}

      {status === "active" && alsoActive.length > 0 && (
        <p className="goal-status__note" role="status">
          {alsoActive.map((x) => x.title).join(", ")} {alsoActive.length === 1 ? "is" : "are"} already active.
        </p>
      )}

      {/* Where it stands, its category, how often it comes round, and where it lives. */}
      <h3 className="group-label goal-detail__head">Details</h3>
      <div className="step-list">
        {/* Where it stands. Two active in a topic is allowed; it's only
            pointed out. */}
        <div className="step-row">
          <span className="step-row__name flex-none">Status</span>
          <MenuSelect<GoalStatus>
            label="Status"
            value={status}
            onChange={(v) => void tracker.setGoalStatus(g.id, v)}
            options={[
              { value: "queued", label: "Queued" },
              { value: "active", label: "Active" },
              { value: "done", label: "Done" },
              { value: "dropped", label: "Dropped" },
            ]}
          />
        </div>
        <PathRow tracker={tracker} goal={g} />
        <CategoryRow tracker={tracker} goal={g} />
        <div className="step-row">
          <span className="step-row__name flex-none">Repeat</span>
          <RepeatSelect tracker={tracker} kind="goal" item={g} />
        </div>
        <LinkRow tracker={tracker} goal={g} />
      </div>

      <DialogActions
        del={{
          what: `the goal "${g.title}"`,
          onDelete: async () => {
            onClose();
            return tracker.deleteGoal(g.id);
          },
        }}
      />
    </div>
  );
}

/**
 * The next thing to do on the goal: its first unticked entry, with where it
 * lives and Mark done. A goal that only counts shows the next one of its
 * count instead.
 */
function NextItem({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const { pending, run } = usePending();
  const all = [...(g.items ?? []), ...(g.parts ?? []).flatMap((p) => p.items ?? [])];
  const item = all.find((i) => !i.done);
  if (item) {
    const n = all.filter((i) => i.done).length + 1;
    return (
      <div className="next-item goal-next">
        <p className="goal-next__label">
          Next · {n} of {all.length}
        </p>
        <p className="next-item__title">{item.title}</p>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="next-item__link">
            {item.url.replace(/^https?:\/\/(www\.)?/, "")}
            <ExternalLink aria-hidden />
          </a>
        )}
        <Button
          variant="primary"
          className="btn-l w-full justify-center"
          isDisabled={pending}
          onPress={() => void run(() => tracker.setItemDone(g.id, item.id, true))}
        >
          Mark done
        </Button>
      </div>
    );
  }
  if (!all.length && !g.parts?.length && g.target && (g.current ?? 0) < g.target) {
    return (
      <div className="next-item goal-next">
        <p className="goal-next__label">Next</p>
        <p className="next-item__title">
          {(g.current ?? 0) + 1} of {g.target}
        </p>
        <Button
          variant="primary"
          className="w-full justify-center"
          isDisabled={pending}
          onPress={() => void run(() => tracker.logSession(g.id, undefined, uid()))}
        >
          Log one
        </Button>
      </div>
    );
  }
  return null;
}

/**
 * One part. As it stands: its name and "− 4 of 30 +". In Edit: a red delete
 * button, and its name, done count and total as text fields.
 */
function StepRow({
  counted,
  open,
  onOpen,
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
  minimum,
  onMinimum,
}: {
  /** Counted by its checklist: no − and +, and its figures aren't typed. */
  counted?: boolean;
  /** Whether its checklist is showing, and the tap that shows or hides it. */
  open?: boolean;
  onOpen?: () => void;
  name: string;
  current: number;
  total: number | null;
  /** Enough to count as covered: a marker on the bar, set in Edit. */
  minimum?: number;
  onMinimum: (n: number | null) => Promise<unknown>;
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
  const { reset: resetMin, ...minField } = useInline(minimum ?? null, (v) => (v == null ? "" : String(v)), (text) => {
    const n = num(text);
    if (text.trim() === "" || n === 0) void onMinimum(null);
    else if (n != null && n > 0 && (total == null || n <= total)) void onMinimum(n);
    else resetMin();
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
            <DeleteGlyph />
          </button>
        )}
        {onName ? (
          <input ref={nameRef} aria-label="Part name" placeholder="Name" className="step-field step-field--name" {...nameField} />
        ) : (
          <span className="step-row__name">{name}</span>
        )}
        {counted ? (
          <span className="step-row__of">
            {current} of {total}
          </span>
        ) : (
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
        )}
        {total != null && (
          <label className="step-row__min">
            <span>Minimum</span>
            <input
              type="number"
              inputMode="decimal"
              aria-label={`Minimum, ${name}`}
              placeholder="None"
              className="step-field step-field--num"
              {...minField}
            />
          </label>
        )}
      </li>
    );
  }

  const digits = Math.max(1, widest.toLocaleString().length);
  if (counted) {
    return (
      <li className="step-row part-row">
        <button type="button" className="part-row__open" aria-expanded={open} onClick={onOpen}>
          <span className="step-row__label">
            <span className="step-row__name">{name}</span>
            {total != null && total > 0 && (
              <span className="step-bar" aria-hidden>
                <span className="step-bar__fill" style={{ width: `${Math.min(100, (current / total) * 100)}%` }} />
                {minimum != null && minimum < total && (
                  <span
                    className={"step-bar__min" + (current >= minimum ? " is-met" : "")}
                    style={{ left: `${(minimum / total) * 100}%` }}
                  />
                )}
              </span>
            )}
          </span>
          <span className="part-row__count font-mono-n">
            {current.toLocaleString()}
            <span className="stepper__total"> of {total?.toLocaleString()}</span>
          </span>
          <ChevronDown className={"part-row__chevron" + (open ? " is-open" : "")} aria-hidden />
        </button>
      </li>
    );
  }
  return (
    <li className="step-row">
      <span className="step-row__label">
        <span className="step-row__name">{name}</span>
        {/* How far, with the minimum marked when there is one. */}
        {total != null && total > 0 && (
          <span className="step-bar" aria-hidden>
            <span className="step-bar__fill" style={{ width: `${Math.min(100, (current / total) * 100)}%` }} />
            {minimum != null && minimum < total && (
              <span
                className={"step-bar__min" + (current >= minimum ? " is-met" : "")}
                style={{ left: `${(minimum / total) * 100}%` }}
              />
            )}
          </span>
        )}
        {minimum != null && (
          <span className="sr-only">
            Minimum {minimum}
            {current >= minimum ? ", reached" : ""}
          </span>
        )}
      </span>
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

/**
 * A goal's checklist: each entry ticked when finished, its name opening
 * where it lives. A tick is a session; unticking takes it back. In Edit,
 * entries are renamed, given a link, deleted or added.
 */
function Checklist({
  tracker,
  goal: g,
  startOn,
}: {
  tracker: Tracker;
  goal: Goal;
  startOn: React.MutableRefObject<string | null>;
}) {
  const items = g.items ?? [];
  const done = items.filter((i) => i.done).length;
  const [editing, setEditing] = useState(() => !!startOn.current);
  const [focusId, setFocusId] = useState<string | null>(() => startOn.current);
  useEffect(() => {
    startOn.current = null;
  }, [startOn]);
  return (
    <section className="goal-steps" aria-label="Checklist">
      <div className="goal-steps__head">
        <h3 className="group-label">
          {editing ? "Checklist" : "Still to do"} <span className="checklist__count">{done} of {items.length} done</span>
        </h3>
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
        <ChecklistRows tracker={tracker} goal={g} items={items} editing={editing} focusId={focusId} onFocus={setFocusId} skipFirst={!g.done} />
      </ul>
    </section>
  );
}

/** How many entries still to do a checklist shows before "Show N more". */
const STILL_SHOWN = 5;

/**
 * A checklist's rows, the goal's or a part's: one per entry, then, in Edit,
 * Add Item. Changes are written from the latest saved list, so quick edits
 * don't undo each other.
 */
function ChecklistRows({
  tracker,
  goal: g,
  partId,
  items,
  editing,
  focusId,
  onFocus,
  skipFirst,
}: {
  tracker: Tracker;
  goal: Goal;
  partId?: string;
  items: GoalItem[];
  editing: boolean;
  focusId: string | null;
  onFocus: (id: string | null) => void;
  /** Leave out the first entry still to do: it's shown as the next item. */
  skipFirst?: boolean;
}) {
  const write = (fn: (list: GoalItem[]) => GoalItem[]) => {
    const now = tracker.state!.goals.find((x) => x.id === g.id);
    const list = (partId ? now?.parts?.find((p) => p.id === partId)?.items : now?.items) ?? [];
    return tracker.setGoalItems(g.id, fn(list), partId);
  };
  const add = () => {
    const id = uid();
    void write((list) => [...list, { id, title: `Item ${list.length + 1}`, done: false }]);
    onFocus(id);
  };
  // Ticked entries fold into one row, outside Edit, so what's left leads.
  const [showDone, setShowDone] = useState(false);
  // A long list shows its next few; the rest are a tap away.
  const [showAll, setShowAll] = useState(false);
  const doneCount = items.filter((i) => i.done).length;
  // The goal's next entry is in its card above, so the list starts after it.
  const left = items.filter((i) => !i.done).slice(skipFirst ? 1 : 0);
  const capped = !editing && !showDone && !showAll && left.length > STILL_SHOWN;
  const shown = editing ? items : showDone ? items.filter((i) => i.done || left.includes(i)) : capped ? left.slice(0, STILL_SHOWN) : left;
  return (
    <>
      {shown.map((i) => (
        <ItemRow
          key={i.id}
          item={i}
          nested={!!partId}
          editing={editing}
          focus={focusId === i.id}
          onToggle={() => tracker.setItemDone(g.id, i.id, !i.done)}
          onChange={(patch) => write((list) => list.map((x) => (x.id === i.id ? { ...x, ...patch } : x)))}
          onDelete={() => write((list) => list.filter((x) => x.id !== i.id))}
        />
      ))}
      {capped && (
        <li className={partId ? "item-row--nested" : undefined}>
          <button type="button" className="done-fold" onClick={() => setShowAll(true)}>
            <span className="flex-1">Show {left.length - STILL_SHOWN} more</span>
            <ChevronDown aria-hidden />
          </button>
        </li>
      )}
      {!editing && doneCount > 0 && (
        <li className={partId ? "item-row--nested" : undefined}>
          <button type="button" className="done-fold" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            <span className="done-fold__mark" aria-hidden>
              <Check />
            </span>
            <span className="flex-1">{doneCount} done</span>
            {showDone ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          </button>
        </li>
      )}
      {editing && (
        <li className={partId ? "item-row--nested" : undefined}>
          <button type="button" className="step-add" onClick={add}>
            <span className="step-add__icon" aria-hidden>
              <Plus />
            </span>
            Add Item
          </button>
        </li>
      )}
    </>
  );
}

/** One checklist entry: its tick and its name, or, in Edit, its name and link as fields. */
function ItemRow({
  item: i,
  nested,
  editing,
  focus,
  onToggle,
  onChange,
  onDelete,
}: {
  item: GoalItem;
  /** One of a part's entries, set in under the part. */
  nested?: boolean;
  editing: boolean;
  focus: boolean;
  onToggle: () => Promise<unknown>;
  onChange: (patch: { title?: string; url?: string }) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const { reset: resetName, ...nameField } = useInline(i.title, (v) => v, (text) => {
    if (text.trim()) void onChange({ title: text.trim() });
    else resetName();
  });
  const { reset: _resetUrl, ...urlField } = useInline(i.url ?? "", (v) => v, (text) => {
    // "youtu.be/…" typed without its scheme is still a link.
    const t = text.trim();
    void onChange({ url: t && !/^https?:\/\//i.test(t) ? `https://${t}` : t });
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
      <li className={"step-row step-row--editing item-row--editing" + (nested ? " item-row--nested" : "")}>
        <button type="button" className="step-delete" aria-label={`Delete ${i.title}`} onClick={() => void onDelete()}>
          <DeleteGlyph />
        </button>
        <span className="item-row__fields">
          <input ref={nameRef} aria-label="Item name" placeholder="Name" className="step-field step-field--name" {...nameField} />
          <input
            type="url"
            inputMode="url"
            aria-label={`Link, ${i.title}`}
            placeholder="Link"
            className="step-field step-field--name"
            {...urlField}
          />
        </span>
      </li>
    );
  }

  return (
    <li className={"step-row item-row" + (i.done ? " is-done" : "") + (nested ? " item-row--nested" : "")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={i.done}
        aria-label={i.title}
        onClick={() => void onToggle()}
        className={"check" + (i.done ? " check--on" : "")}
      >
        <span className="check__ring">{i.done && <Check className="h-4 w-4" aria-hidden />}</span>
      </button>
      {i.url ? (
        <a href={i.url} target="_blank" rel="noopener noreferrer" className="item-row__name item-row__link">
          <span className="item-row__text">{i.title}</span>
          <ExternalLink className="item-row__open" aria-hidden />
        </a>
      ) : (
        <span className="item-row__name">{i.title}</span>
      )}
    </li>
  );
}

/**
 * The goal's description, under its name, line breaks kept. Set through
 * Claude; read here. A long one (a chapter list) folds to a few lines with
 * More, as App Store text does.
 */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 280 || text.split("\n").length > 6;
  return (
    <div className="goal-desc">
      <p className={"goal-desc__text" + (long && !open ? " is-folded" : "")}>{text}</p>
      {long && (
        <button type="button" className="goal-desc__more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}

/** The path the goal sits in, General if none. Picking one moves it there, at the end. */
function PathRow({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const s = tracker.state!;
  return (
    <div className="step-row">
      <span className="step-row__name flex-none">Path</span>
      <MenuSelect
        label="Path"
        value={pathOfGoal(s, g.id)}
        onChange={(v) => void tracker.moveGoalToPath(g.id, v)}
        options={[
          ...s.paths.map((p) => ({ value: p.id, label: p.title })),
          { value: GENERAL, label: "General" },
        ]}
      />
    </div>
  );
}

/** The goal's category, picked from the ones there are. */
function CategoryRow({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const cats = tracker.state!.categories;
  return (
    <div className="step-row">
      <span className="step-row__name flex-none">Category</span>
      <MenuSelect
        label="Category"
        value={cats.some((c) => c.id === g.catId) ? g.catId : ""}
        onChange={(v) => v && void tracker.setGoalCategory(g.id, v)}
        options={[
          ...(cats.some((c) => c.id === g.catId) ? [] : [{ value: "", label: "None" }]),
          ...cats.map((c) => ({ value: c.id, label: c.name, color: c.color })),
        ]}
      />
    </div>
  );
}

/** Where the goal lives, typed in place, with a button to open it. */
function LinkRow({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const { reset: _reset, ...field } = useInline(g.link ?? "", (v) => v, (text) => {
    void tracker.setGoalDetails(g.id, { link: text });
  });
  const href = /^https?:\/\//i.test(field.value.trim()) ? field.value.trim() : null;
  return (
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
  );
}
