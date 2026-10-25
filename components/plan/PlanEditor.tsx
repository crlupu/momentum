"use client";

import { FormEvent, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tracker, dateKey, goalStatus, uid } from "@/lib/tracker";
import {
  DEFAULT_DAYS,
  PLAN_ICONS,
  WEEKDAY,
  WEEKDAY_LONG,
  WEEK_ORDER,
  pickFor,
  planOf,
  refTitle,
  type DayPlan,
  type PlanIcon,
  type PlanRef,
  type PlanStep,
} from "@/lib/plan";
import { Modal } from "../Modal";
import { DialogActions } from "../DialogActions";
import { Input } from "../ui";
import { Segmented } from "../books/bits";
import { ChevronDown, ChevronRight, Plus, ReorderLines } from "../icons";
import { PlanGlyph, PlanTile } from "./bits";

const EMPTY: DayPlan = { days: DEFAULT_DAYS, steps: [] };
const ICON_NAME: Record<PlanIcon, string> = { book: "Read", gym: "Gym", video: "Video", learn: "Learn", task: "Task", target: "Focus" };

/**
 * The day plan: which weekdays it runs on, and its steps in order. Steps are
 * dragged into order by their grips; tapping one opens it, to say what it is
 * each day.
 */
export function PlanEditor({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const plan = planOf(s) ?? EMPTY;
  const [editing, setEditing] = useState<PlanStep | "new" | null>(null);
  // A new plan starts today: the days before it aren't counted as missed.
  const save = (p: DayPlan) => void tracker.setDayPlan({ ...p, since: p.since ?? dateKey() });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = plan.steps.map((x) => x.id);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    save({ ...plan, steps: arrayMove(plan.steps, from, to) });
  };
  const toggleDay = (d: number) => {
    const days = plan.days.includes(d) ? plan.days.filter((x) => x !== d) : [...plan.days, d].sort();
    save({ ...plan, days });
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="group-head">Plan days</h3>
        <div className="plan-days" role="group" aria-label="Plan days">
          {WEEK_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              className="plan-days__day"
              aria-pressed={plan.days.includes(d)}
              aria-label={WEEKDAY_LONG[d]}
              onClick={() => toggleDay(d)}
            >
              {WEEKDAY[d][0]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="group-head">Steps · in order</h3>
        <div className="card plan-steps">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="plan-steps__list">
                {plan.steps.map((st, i) => (
                  <StepItem key={st.id} tracker={tracker} plan={plan} step={st} n={i + 1} onOpen={() => setEditing(st)} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <button type="button" className="plan-steps__add" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            Add step
          </button>
        </div>
        <p className="plan-note">
          {plan.steps.length > 1 ? "Drag ≡ to reorder. " : ""}Tap a step to change what it is each day.
        </p>
      </section>

      {planOf(s) && (
        <button
          type="button"
          className="text-action plan-off"
          onClick={() => {
            if (window.confirm("Turn off the day plan? Its steps are deleted; your goals, books and workouts stay.")) void tracker.setDayPlan(null);
          }}
        >
          Turn off the day plan
        </button>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={!editing || editing === "new" ? "New step" : `Step ${plan.steps.findIndex((x) => x.id === editing.id) + 1}`}
        save={{ label: editing === "new" ? "Add" : "Save", form: "plan-step" }}
      >
        {editing && (
          <StepForm
            key={editing === "new" ? "new" : editing.id}
            tracker={tracker}
            plan={plan}
            step={editing === "new" ? null : editing}
            onDone={(next) => {
              if (next) {
                const steps = editing === "new" ? [...plan.steps, next] : plan.steps.map((x) => (x.id === next.id ? next : x));
                save({ ...plan, steps });
              }
              setEditing(null);
            }}
            onDelete={
              editing === "new"
                ? undefined
                : async () => {
                    setEditing(null);
                    return tracker.setDayPlan({ ...plan, since: plan.since ?? dateKey(), steps: plan.steps.filter((x) => x.id !== editing.id) });
                  }
            }
          />
        )}
      </Modal>
    </div>
  );
}

function StepItem({ tracker, plan, step, n, onOpen }: { tracker: Tracker; plan: DayPlan; step: PlanStep; n: number; onOpen: () => void }) {
  const s = tracker.state!;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const days = WEEK_ORDER.filter((d) => plan.days.includes(d));
  return (
    <li
      ref={setNodeRef}
      className={"plan-steps__row" + (isDragging ? " rd-row--dragging" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className="plan-steps__open" onClick={onOpen}>
        <span className="plan-steps__n">{n}</span>
        <PlanTile icon={step.icon} />
        <span className="plan-steps__text">
          <span className="plan-steps__name">{step.name}</span>
          {step.same ? (
            <span className="plan-steps__sub">Every day · {refTitle(s, step.pick) ?? "nothing picked"}</span>
          ) : (
            <span className="plan-steps__chips">
              {days.map((d) => {
                const t = refTitle(s, pickFor(step, d));
                return (
                  <span key={d} className={"plan-steps__chip" + (t ? "" : " is-skip")}>
                    <b>{WEEKDAY[d][0]}</b>
                    {t ?? "skip"}
                  </span>
                );
              })}
            </span>
          )}
        </span>
      </button>
      <button type="button" ref={setActivatorNodeRef} className="plan-steps__grip" aria-label={`Move ${step.name}`} {...attributes} {...listeners}>
        <ReorderLines aria-hidden />
      </button>
    </li>
  );
}

type Option = { ref: PlanRef; title: string; group: string };

/** What a step can point at: goals not done, books open or queued, workouts. */
function options(tracker: Tracker): Option[] {
  const s = tracker.state!;
  const goals = s.goals
    .filter((g) => goalStatus(g) === "active" || goalStatus(g) === "queued")
    .map((g) => ({ ref: { kind: "goal" as const, id: g.id }, title: g.title, group: "Goals" }));
  const books = s.books
    .filter((b) => b.status === "active" || b.status === "queued")
    .map((b) => ({ ref: { kind: "book" as const, id: b.id }, title: b.title, group: "Books" }));
  const workouts = s.workouts.map((w) => ({ ref: { kind: "workout" as const, id: w.id }, title: w.name, group: "Workouts" }));
  return [...goals, ...books, ...workouts];
}

const same = (a?: PlanRef | null, b?: PlanRef | null) => (!a && !b) || (!!a && !!b && a.kind === b.kind && a.id === b.id);

function StepForm({
  tracker,
  plan,
  step,
  onDone,
  onDelete,
}: {
  tracker: Tracker;
  plan: DayPlan;
  step: PlanStep | null;
  onDone: (s: PlanStep | null) => void;
  onDelete?: () => Promise<unknown>;
}) {
  const [name, setName] = useState(step?.name ?? "");
  const [icon, setIcon] = useState<PlanIcon>(step?.icon ?? "book");
  const [mode, setMode] = useState<"same" | "day">(step && !step.same ? "day" : "same");
  const [pick, setPick] = useState<PlanRef | null>(step?.pick ?? null);
  const [byDay, setByDay] = useState<Record<string, PlanRef | null>>(() => {
    const out: Record<string, PlanRef | null> = {};
    for (const d of plan.days) out[d] = step ? pickFor(step, d) ?? (step.same ? step.pick ?? null : null) : null;
    return out;
  });
  const [openDay, setOpenDay] = useState<number | null>(null);
  const opts = options(tracker);
  const days = WEEK_ORDER.filter((d) => plan.days.includes(d));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onDone({
      id: step?.id ?? uid(),
      name: name.trim() || ICON_NAME[icon],
      icon,
      same: mode === "same",
      pick: mode === "same" ? pick : null,
      byDay: mode === "day" ? byDay : {},
    });
  };

  return (
    <form id="plan-step" onSubmit={submit} className="flex flex-col gap-4">
      <Input aria-label="Step name" placeholder={ICON_NAME[icon]} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="plan-icons" role="radiogroup" aria-label="Icon">
        {PLAN_ICONS.map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={icon === x}
            aria-label={ICON_NAME[x]}
            className="plan-icons__icon"
            onClick={() => setIcon(x)}
          >
            <PlanGlyph icon={x} />
          </button>
        ))}
      </div>
      <Segmented
        label="What it is"
        value={mode}
        onChange={setMode}
        options={[
          { value: "same", label: "Same every day" },
          { value: "day", label: "Changes by day" },
        ]}
      />
      {mode === "same" ? (
        <div className="card plan-pick">
          <PickList opts={opts} value={pick} onPick={setPick} allowNone={false} />
        </div>
      ) : (
        <ul className="card plan-byday">
          {days.map((d) => {
            const v = byDay[d] ?? null;
            const open = openDay === d;
            return (
              <li key={d} className={open ? "is-open" : undefined}>
                <button type="button" className="plan-byday__row" aria-expanded={open} onClick={() => setOpenDay(open ? null : d)}>
                  <span className="plan-byday__day">{WEEKDAY[d]}</span>
                  <span className={"plan-byday__value" + (v ? "" : " is-skip")}>
                    {refTitle(tracker.state!, v) ?? "Nothing · step skipped"}
                  </span>
                  {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                </button>
                {open && (
                  <PickList
                    opts={opts}
                    value={v}
                    allowNone
                    onPick={(r) => {
                      setByDay((b) => ({ ...b, [d]: r }));
                      setOpenDay(null);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="plan-note">Pick a goal, book or workout; Today shows its next item.</p>
      <DialogActions del={onDelete && { what: name || "this step", onDelete }} />
    </form>
  );
}

function PickList({
  opts,
  value,
  onPick,
  allowNone,
}: {
  opts: Option[];
  value: PlanRef | null;
  onPick: (r: PlanRef | null) => void;
  allowNone: boolean;
}) {
  const groups = ["Goals", "Books", "Workouts"].map((g) => ({ g, items: opts.filter((o) => o.group === g) })).filter((x) => x.items.length);
  return (
    <div className="plan-picks" role="radiogroup">
      {groups.map(({ g, items }) => (
        <div key={g}>
          <p className="plan-picks__group">{g}</p>
          {items.map((o) => (
            <button key={o.ref.kind + o.ref.id} type="button" role="radio" aria-checked={same(value, o.ref)} className="plan-picks__opt" onClick={() => onPick(o.ref)}>
              <span className="plan-picks__radio" aria-hidden />
              {o.title}
            </button>
          ))}
        </div>
      ))}
      {allowNone && (
        <button type="button" role="radio" aria-checked={!value} className="plan-picks__opt" onClick={() => onPick(null)}>
          <span className="plan-picks__radio" aria-hidden />
          Nothing · skip the step
        </button>
      )}
      {!groups.length && <p className="plan-note">No goals, books or workouts yet. Add one in Education or Health.</p>}
    </div>
  );
}
