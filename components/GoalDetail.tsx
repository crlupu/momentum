"use client";

import { useEffect, useRef, useState } from "react";
import { DialogActions } from "./DialogActions";
import { Button } from "./ui";
import { usePending } from "./ActionButton";
import { Check, ChevronDown, ChevronRight, ExternalLink, Plus, Repeat } from "./icons";
import { DeleteGlyph } from "./DeleteGlyph";
import { RepeatSelect } from "./RepeatSelect";
import { MenuSelect } from "./Menu";
import { GENERAL, pathOfGoal } from "@/lib/paths";
import { Goal, GoalItem, GoalStatus, Tracker, dateKey, goalStatus, uid } from "@/lib/tracker";
import { goalLastActive, goalLog, otherActiveInTopic } from "@/lib/ops";
import * as R from "@/lib/reading";
import { fmtDateAuto } from "@/lib/dates";

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
 * One goal, opened: when it was last worked on and how often lately, what's
 * next on it, its checklist, and its details. A goal is a habit kept up, so
 * there is no total, percentage or deadline.
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
  const log = goalLog(tracker.state!, g.id);
  const last = goalLastActive(tracker.state!, g.id);
  // Days worked on it in the last four weeks: how well the habit is kept.
  const since = R.addDays(dateKey(), -27);
  const recent = new Set([...log.map((e) => e.date), ...(g.routineTicks ?? [])].filter((d) => d >= since)).size;
  // A checklist just started: its first entry opens ready to be named.
  const pendingFocus = useRef<string | null>(null);
  // The first entry, saved at once; the checklist opens in Edit on its name.
  const startChecklist = () => {
    const id = uid();
    void tracker.setGoalItems(g.id, [{ id, title: "Item 1" }]);
    pendingFocus.current = id;
  };

  return (
    <div className="goal-detail">
      {g.note && <Description text={g.note} />}
      <div className="goal-detail__summary">
        <span className="goal-row__blank goal-detail__icon" aria-hidden>
          <Repeat />
        </span>
        <div className="min-w-0">
          <p className="goal-detail__pct goal-detail__pct--line">
            {status === "done" ? "Done" : status === "dropped" ? "Dropped" : last ? `Last worked on ${fmtDateAuto(last)}` : "Not started yet"}
          </p>
          <p className="goal-detail__sub">
            {recent === 0 ? "No days in the last 4 weeks" : `${recent} day${recent === 1 ? "" : "s"} in the last 4 weeks`}
          </p>
        </div>
      </div>

      {status !== "done" && <NextItem tracker={tracker} goal={g} />}

      {/* A checklist is what to work through next; without one, a session
          is logged as it happens. */}
      {g.items?.length ? (
        <Checklist tracker={tracker} goal={g} startOn={pendingFocus} />
      ) : (
        <section className="goal-steps" aria-label="Checklist">
          <ul className="step-list">
            <li>
              <button type="button" className="step-add" onClick={startChecklist}>
                <span className="step-add__icon" aria-hidden>
                  <Plus />
                </span>
                Add Checklist
              </button>
            </li>
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
    return (
      <div className="next-item goal-next">
        <p className="goal-next__label">Next</p>
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
  return (
    <div className="next-item goal-next">
      <p className="goal-next__label">Today</p>
      <p className="next-item__title">A session on it</p>
      <Button
        variant="primary"
        className="btn-l w-full justify-center"
        isDisabled={pending}
        onPress={() => void run(() => tracker.logSession(g.id, undefined, uid()))}
      >
        Log a session
      </Button>
    </div>
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
          {editing ? "Checklist" : "Still to do"}
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
