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
import { byRoutineOrder, routines, type RoutineKind } from "@/lib/routines";
import {
  DEFAULT_DAYS,
  addDays,
  askOf,
  resolve,
  stepsOn,
  weekOf,
  PLAN_ICONS,
  WEEKDAY,
  WEEKDAY_LONG,
  WEEK_ORDER,
  nextOfGoal,
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
import { Check, ChevronDown, ChevronRight, Plus, ReorderLines, Search } from "../icons";
import * as R from "@/lib/reading";
import { columnCards, projectFinished } from "@/lib/projects";
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

      <PlanWeekGrid tracker={tracker} plan={plan} onOpen={setEditing} />
      {plan.steps.length === 0 && <FromRoutines tracker={tracker} onUse={save} days={plan.days} />}

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

/**
 * On a wide screen, the plan as the week: rows are steps, columns are the
 * plan days, each cell what the step is that day. Today's column shows
 * what's done and what's next. A cell opens its step.
 */
function PlanWeekGrid({ tracker, plan, onOpen }: { tracker: Tracker; plan: DayPlan; onOpen: (s: PlanStep) => void }) {
  const s = tracker.state!;
  const today = dateKey();
  const week = weekOf(today);
  const days = WEEK_ORDER.filter((d) => plan.days.includes(d));
  if (!plan.steps.length || !days.length) return null;
  const todaySteps = stepsOn(s, plan, today);
  const nextId = todaySteps.find((x) => !x.done)?.step.id;
  const dateOf = (d: number) => addDays(week, (d + 6) % 7);
  return (
    <section className="plan-grid-wrap" aria-label="The week">
      <h3 className="group-head">The week</h3>
      <div className="card plan-grid" style={{ gridTemplateColumns: `8.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <span />
        {days.map((d) => (
          <span key={d} className={"plan-grid__day" + (dateOf(d) === today ? " is-today" : "")}>
            {dateOf(d) === today ? "Today" : WEEKDAY[d]}
          </span>
        ))}
        {plan.steps.map((st, i) => (
          <PlanGridRow key={st.id} st={st} i={i}>
            {days.map((d) => {
              const r = pickFor(st, d);
              const isToday = dateOf(d) === today;
              const t = todaySteps.find((x) => x.step.id === st.id);
              const state = isToday && t ? (t.done ? " is-done" : st.id === nextId ? " is-next" : "") : "";
              const title = refTitle(s, r);
              return (
                <button key={d} type="button" className={"plan-grid__cell" + state + (title ? "" : " is-skip")} onClick={() => onOpen(st)}>
                  <span className="plan-grid__title">{title ?? "Skipped"}</span>
                  {title && <span className="plan-grid__ask">{askOf(s, resolve(s, r))}</span>}
                </button>
              );
            })}
          </PlanGridRow>
        ))}
      </div>
    </section>
  );
}

function PlanGridRow({ st, i, children }: { st: PlanStep; i: number; children: React.ReactNode }) {
  return (
    <>
      <span className="plan-grid__step">
        <span className="plan-grid__n">{i + 1}</span>
        <PlanTile icon={st.icon} />
        <span className="plan-grid__name">{st.name}</span>
      </span>
      {children}
    </>
  );
}

const KIND_STEP: Record<RoutineKind, { name: string; icon: PlanIcon }> = {
  book: { name: "Read", icon: "book" },
  workout: { name: "Gym", icon: "gym" },
  goal: { name: "Learn", icon: "learn" },
};

/**
 * An empty plan, with routines already set up: one tap turns them into
 * steps, daily ones first, each the same every day, to rename, reorder and
 * vary by day after.
 */
function FromRoutines({ tracker, onUse, days }: { tracker: Tracker; onUse: (p: DayPlan) => void; days: number[] }) {
  const list = routines(tracker.state!).sort((a, b) => Number(a.freq !== "daily") - Number(b.freq !== "daily") || byRoutineOrder({ ...a, done: false }, { ...b, done: false }));
  if (!list.length) return null;
  const use = () =>
    onUse({
      days,
      // A book routine becomes its track's step, once per track.
      steps: list
        .map((r) => {
          const book = r.kind === "book" ? tracker.state!.books.find((b) => b.id === r.id) : undefined;
          const pick: PlanRef = book?.trackId ? { kind: "track", id: book.trackId } : { kind: r.kind, id: r.id };
          return { id: uid(), name: KIND_STEP[r.kind].name, icon: KIND_STEP[r.kind].icon, same: true, pick, byDay: {} };
        })
        .filter((st, i, all) => all.findIndex((x) => x.pick.kind === st.pick.kind && x.pick.id === st.pick.id) === i),
    });
  return (
    <section className="card plan-start">
      <p className="plan-start__title">Start from your routines</p>
      <p className="plan-note">
        {list.length} routine{list.length === 1 ? "" : "s"} become steps, daily ones first: {list.slice(0, 3).map((r) => r.title).join(", ")}
        {list.length > 3 ? "…" : ""}. Reorder them and change them by day after.
      </p>
      <div>
        <button type="button" className="pill-link pill-link--primary" onClick={use}>
          Use my {list.length} routine{list.length === 1 ? "" : "s"}
        </button>
      </div>
    </section>
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

type Kind = "goal" | "track" | "workout" | "focus";
const KINDS: { kind: Kind; label: string; icon: PlanIcon }[] = [
  { kind: "goal", label: "Goals", icon: "learn" },
  { kind: "track", label: "Reading", icon: "book" },
  { kind: "workout", label: "Gym", icon: "gym" },
  { kind: "focus", label: "Focus", icon: "target" },
];
const KIND_OF = (r: PlanRef | null | undefined): Kind => (!r ? "goal" : r.kind === "book" ? "track" : (r.kind as Kind));
const MINUTES = [25, 50, 90, 120];

const same = (a?: PlanRef | null, b?: PlanRef | null) =>
  (!a && !b) || (!!a && !!b && a.kind === b.kind && a.id === b.id);

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
  const [icon, setIcon] = useState<PlanIcon>(step?.icon ?? "learn");
  const [mode, setMode] = useState<"same" | "day">(step && !step.same ? "day" : "same");
  const [pick, setPick] = useState<PlanRef | null>(step?.pick ?? null);
  const [byDay, setByDay] = useState<Record<string, PlanRef | null>>(() => {
    const out: Record<string, PlanRef | null> = {};
    for (const d of plan.days) out[d] = step ? pickFor(step, d) ?? (step.same ? step.pick ?? null : null) : null;
    return out;
  });
  const [openDay, setOpenDay] = useState<number | null>(null);
  const days = WEEK_ORDER.filter((d) => plan.days.includes(d));
  // A new step takes its kind's icon until one is chosen.
  const [iconSet, setIconSet] = useState(!!step);
  const follow = (r: PlanRef | null) => {
    if (!iconSet && r) setIcon(KINDS.find((k) => k.kind === KIND_OF(r))!.icon);
  };

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
            onClick={() => {
              setIcon(x);
              setIconSet(true);
            }}
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
        <Picker
          tracker={tracker}
          value={pick}
          allowNone={false}
          onPick={(r) => {
            setPick(r);
            follow(r);
          }}
        />
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
                    {v ? (
                      <>
                        <span className="plan-byday__title">{refTitle(tracker.state!, v) ?? "Gone"}</span>
                        <span className="plan-byday__kind">
                          {KINDS.find((k) => k.kind === KIND_OF(v))!.label}
                          {v.kind === "focus" ? ` · ${v.minutes} min` : ""}
                        </span>
                      </>
                    ) : (
                      "Nothing · step skipped"
                    )}
                  </span>
                  {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                </button>
                {open && (
                  <div className="plan-byday__pick">
                    <Picker
                      tracker={tracker}
                      value={v}
                      allowNone
                      onPick={(r, close = true) => {
                        setByDay((b) => ({ ...b, [d]: r }));
                        follow(r);
                        if (close) setOpenDay(null);
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <DialogActions del={onDelete && { what: name || "this step", onDelete }} />
    </form>
  );
}

/**
 * What a step points at, in two taps: the kind first (Goals, Reading, Gym,
 * Focus), then a short list of only that kind. Goals are the active ones,
 * grouped by category, with queued ones behind a link and a search when
 * the list is long; reading is by track; focus is a length of time, on a
 * project or on nothing in particular.
 */
function Picker({
  tracker,
  value,
  onPick,
  allowNone,
}: {
  tracker: Tracker;
  value: PlanRef | null;
  /** `close` false: a change that keeps the list open (a focus length). */
  onPick: (r: PlanRef | null, close?: boolean) => void;
  allowNone: boolean;
}) {
  const s = tracker.state!;
  const [kind, setKind] = useState<Kind>(KIND_OF(value));
  const [query, setQuery] = useState("");
  const [queued, setQueued] = useState(false);
  const [minutes, setMinutes] = useState(value?.kind === "focus" ? value.minutes ?? 50 : 50);
  const [custom, setCustom] = useState(!MINUTES.includes(value?.kind === "focus" ? value.minutes ?? 50 : 50));

  const choose = (r: PlanRef) => onPick(r);
  const Opt = ({ r, title, sub, dot }: { r: PlanRef; title: string; sub?: string; dot?: string }) => (
    <button type="button" role="radio" aria-checked={same(value, r)} className="plan-opt" onClick={() => choose(r)}>
      {dot && <span className="plan-opt__dot" style={{ background: dot }} aria-hidden />}
      <span className="plan-opt__text">
        <span className="plan-opt__title">{title}</span>
        {sub && <span className="plan-opt__sub">{sub}</span>}
      </span>
      <span className="plan-opt__mark" aria-hidden>
        <Check />
      </span>
    </button>
  );

  let body: React.ReactNode = null;
  if (kind === "goal") {
    const q = query.trim().toLowerCase();
    const all = s.goals.filter((g) => goalStatus(g) === "active" || (queued && goalStatus(g) === "queued"));
    const found = q ? all.filter((g) => g.title.toLowerCase().includes(q)) : all;
    const groups = [...s.categories.map((c) => ({ id: c.id, name: c.name, color: c.color })), { id: "", name: "Other", color: "var(--faint)" }]
      .map((c) => ({ c, goals: found.filter((g) => (s.categories.some((x) => x.id === g.catId) ? g.catId === c.id : c.id === "")) }))
      .filter((x) => x.goals.length);
    const queuedCount = s.goals.filter((g) => goalStatus(g) === "queued").length;
    const activeCount = s.goals.filter((g) => goalStatus(g) === "active").length;
    body = (
      <>
        {all.length > 5 && (
          <label className="plan-search">
            <Search aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${all.length} goals`} aria-label="Search goals" />
          </label>
        )}
        {groups.map(({ c, goals }) => (
          <section key={c.id || "other"}>
            <p className="plan-group">
              <span className="plan-group__dot" style={{ background: c.color }} aria-hidden />
              {c.name}
              <span className="plan-group__n">{goals.length}</span>
            </p>
            <div className="card plan-opts">
              {goals.map((g) => {
                const n = nextOfGoal(g);
                return <Opt key={g.id} r={{ kind: "goal", id: g.id }} title={g.title} sub={goalStatus(g) === "queued" ? "Queued" : n ? `Next: ${n.itemId ? `${n.title} · ${n.of}` : `session ${n.of}`}` : "All done"} />;
              })}
            </div>
          </section>
        ))}
        {!groups.length && <p className="plan-note">{q ? "No goal matches." : "No active goals. Set one to Active in Education."}</p>}
        <p className="plan-picker__foot">
          <span>{queued ? "Active and queued" : `Only active goals · ${activeCount}`}</span>
          {queuedCount > 0 && (
            <button type="button" className="text-action" onClick={() => setQueued((v) => !v)}>
              {queued ? "Hide queued" : `Show ${queuedCount} queued`}
            </button>
          )}
        </p>
      </>
    );
  } else if (kind === "track") {
    const tracks = R.liveTracks(s);
    body = tracks.length ? (
      <div className="card plan-opts">
        {tracks.map((t) => {
          const open = R.activeBooks(s, t.id).length;
          return (
            <Opt
              key={t.id}
              r={{ kind: "track", id: t.id }}
              title={t.name}
              dot={t.color}
              sub={`${t.dailyTarget > 0 ? `${t.dailyTarget} pages a day` : "No daily pages"} · ${open} open`}
            />
          );
        })}
      </div>
    ) : (
      <p className="plan-note">No reading tracks yet. Make one in Education › Library.</p>
    );
  } else if (kind === "workout") {
    body = s.workouts.length ? (
      <div className="card plan-opts">
        {s.workouts.map((w) => (
          <Opt key={w.id} r={{ kind: "workout", id: w.id }} title={w.name} sub={`${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"}`} />
        ))}
      </div>
    ) : (
      <p className="plan-note">No workouts yet. Add one in Health.</p>
    );
  } else {
    const projects = s.projects.filter((p) => !projectFinished(p));
    const setLength = (m: number) => {
      setMinutes(m);
      if (value?.kind === "focus") onPick({ ...value, minutes: m }, false);
    };
    body = (
      <>
        <p className="plan-group">How long</p>
        <div className="plan-minutes" role="radiogroup" aria-label="How long">
          {MINUTES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={!custom && minutes === m} onClick={() => (setCustom(false), setLength(m))}>
              {m} min
            </button>
          ))}
          <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)}>
            Other
          </button>
        </div>
        {custom && (
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Minutes"
            placeholder="Minutes"
            value={String(minutes)}
            onChange={(e) => {
              const m = Math.max(5, Math.min(600, Math.round(Number(e.target.value) || 0)));
              if (m) setLength(m);
            }}
          />
        )}
        <p className="plan-group">On</p>
        <div className="card plan-opts">
          <Opt r={{ kind: "focus", id: "", minutes }} title="Just focus" sub="Time on whatever matters most" />
          {projects.map((p) => {
            const doing = columnCards(p, "doing")[0];
            return <Opt key={p.id} r={{ kind: "focus", id: p.id, minutes }} title={p.title} sub={doing ? `Project · Doing: ${doing.title}` : "Project"} />;
          })}
        </div>
        <p className="plan-note">Focus is your main work. Start it from Today as a timer; the step ticks itself when the time is in.</p>
      </>
    );
  }

  return (
    <div className="plan-picker">
      <div className="plan-kinds" role="tablist" aria-label="What it points at">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" role="tab" aria-selected={kind === k.kind} className="plan-kinds__kind" onClick={() => setKind(k.kind)}>
            <PlanGlyph icon={k.icon} />
            {k.label}
          </button>
        ))}
      </div>
      {body}
      {allowNone && (
        <div className="card plan-opts">
          <button type="button" role="radio" aria-checked={!value} className="plan-opt" onClick={() => onPick(null)}>
            <span className="plan-opt__text">
              <span className="plan-opt__title">Nothing</span>
              <span className="plan-opt__sub">Skip the step this day</span>
            </span>
            <span className="plan-opt__mark" aria-hidden>
              <Check />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
