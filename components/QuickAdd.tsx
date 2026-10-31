"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";

import { usePending } from "./ActionButton";
import { useFlow } from "./books/flowContext";
import { PlanGlyph } from "./plan/bits";
import { InsertRow } from "./InsertRow";
import { WeeklyTaskForm } from "./WeeklyTasks";
import { Apple, BookOpen, Check, ChevronLeft, ChevronRight, Dumbbell, Minus, Play, Plus, Repeat, Scale, TaskDone } from "./icons";
import { Tracker, dateKey } from "@/lib/tracker";
import { daysBetween, nextOfGoal, planOf, stepsOn } from "@/lib/plan";
import * as R from "@/lib/reading";
import { routines } from "@/lib/routines";
import { categoryIcon, doneThisWeek, weeklyTasksOf } from "@/lib/weekly";
import type { TrackerState } from "@/lib/model";

/** What a logged thing was, and how to take it back for a few seconds. */
export type Toast = { text: string; undo?: Partial<TrackerState> };

type View = "menu" | "todo" | "weight" | "meal" | "weekly" | "books" | "workouts";

/**
 * The tab bar's +: log anything from any screen without leaving it. The
 * next step of today's plan first, one tap to start; then six quick adds,
 * each with a hint of what it'll log. The small ones (a to-do, a weight, a
 * meal, a weekly task) are a form in the sheet itself; pages and workouts
 * open where they're logged.
 */
export function QuickAdd({ tracker, open, onClose, onToast }: { tracker: Tracker; open: boolean; onClose: () => void; onToast: (t: Toast) => void }) {
  const [view, setView] = useState<View>("menu");
  const close = () => {
    onClose();
    setView("menu");
  };
  const titles: Record<View, string> = { menu: "Add", todo: "To-do", weight: "Weigh-in", meal: "Meal", weekly: "Weekly tasks", books: "Which book?", workouts: "Which workout?" };
  return (
    <Modal open={open} onClose={close} title={titles[view]}>
      {open && tracker.state && (
        <div className="quick">
          {view !== "menu" && (
            <button type="button" className="text-action quick__back" onClick={() => setView("menu")}>
              <ChevronLeft aria-hidden /> All
            </button>
          )}
          {view === "menu" && <Menu tracker={tracker} onView={setView} onClose={close} onToast={onToast} />}
          {view === "todo" && <TodoForm tracker={tracker} onDone={close} onToast={onToast} />}
          {view === "weight" && <WeightForm tracker={tracker} onDone={close} onToast={onToast} />}
          {view === "meal" && <MealForm tracker={tracker} onDone={close} onToast={onToast} />}
          {view === "weekly" && <WeeklyList tracker={tracker} />}
          {view === "books" && <BookPicker tracker={tracker} onClose={close} />}
          {view === "workouts" && <WorkoutPicker tracker={tracker} onClose={close} />}
        </div>
      )}
    </Modal>
  );
}

function Menu({ tracker, onView, onClose, onToast }: { tracker: Tracker; onView: (v: View) => void; onClose: () => void; onToast: (t: Toast) => void }) {
  const s = tracker.state!;
  const router = useRouter();
  const today = dateKey();
  const lastKg = [...s.weights].sort((a, b) => a.date.localeCompare(b.date)).pop()?.kg;
  const books = openBooks(s);
  const kcalToday = s.calories.filter((c) => c.date === today).reduce((a, c) => a + c.kcal, 0);
  const weekly = weeklyTasksOf(s);
  const startable = s.workouts.filter((w) => w.exercises.length > 0);
  // A workout under way goes straight back to it; otherwise which one first.
  const goWorkout = () => {
    if (!s.activeWorkout) return onView("workouts");
    onClose();
    router.push("/fitness?view=live");
  };
  const tiles: { key: AddKey; icon: ReactNode; title: string; hint?: string; onPress: () => void; disabled?: boolean }[] = [
    { key: "todo", icon: <TaskDone />, title: "To-do", onPress: () => onView("todo") },
    { key: "weight", icon: <Scale />, title: "Weigh-in", hint: lastKg ? `${lastKg} last` : undefined, onPress: () => onView("weight") },
    {
      key: "pages",
      icon: <BookOpen />,
      title: "Pages",
      hint: books.length ? (books.length === 1 ? shortTitle(books[0].title) : `${books.length} books open`) : "No book open",
      disabled: !books.length,
      // Which book first, then its page log.
      onPress: () => onView("books"),
    },
    { key: "workout", icon: <Dumbbell />, title: "Workout", hint: s.activeWorkout ? "Resume" : startable.length === 1 ? startable[0].name : `${startable.length} workouts`, disabled: !s.activeWorkout && !startable.length, onPress: goWorkout },
    { key: "meal", icon: <Apple />, title: "Meal", hint: s.calorieBudget ? `${Math.max(0, s.calorieBudget - kcalToday).toLocaleString()} left` : undefined, onPress: () => onView("meal") },
    {
      key: "weekly",
      icon: <Repeat />,
      title: "Weekly task",
      hint: weekly.length ? `${weekly.filter((t) => doneThisWeek(t, today) >= t.times).length} of ${weekly.length} done` : "Add one",
      onPress: () => onView("weekly"),
    },
  ];
  return (
    <>
      <NextStep tracker={tracker} onClose={onClose} onToast={onToast} />
      <ul className="quick__grid">
        {tiles.map((t) => (
          <li key={t.key}>
            <button type="button" className="quick__tile" disabled={t.disabled} onClick={t.onPress}>
              <span className="quick__icon" aria-hidden>
                {t.icon}
              </span>
              <span className="quick__title">{t.title}</span>
              {t.hint && <span className="quick__hint">{t.hint}</span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

type AddKey = "todo" | "weight" | "pages" | "workout" | "meal" | "weekly";

/** The books open now, the one the plan reads next first. */
function openBooks(s: TrackerState) {
  const all = R.liveTracks(s).flatMap((t) => R.activeBooks(s, t.id));
  const plan = planOf(s);
  const next = plan ? stepsOn(s, plan, dateKey()).find((x) => !x.done && (x.it?.kind === "track" || x.it?.kind === "book")) : undefined;
  const first = next?.it?.kind === "track" ? next.it.book?.id : next?.it?.kind === "book" ? next.it.item.id : undefined;
  return first ? [...all.filter((b) => b.id === first), ...all.filter((b) => b.id !== first)] : all;
}

/** Pages: which book, then its page log. */
function BookPicker({ tracker, onClose }: { tracker: Tracker; onClose: () => void }) {
  const s = tracker.state!;
  const flow = useFlow();
  const books = openBooks(s);
  return (
    <>
      <ul className="card quick__books">
        {books.map((b) => {
          const track = R.trackOf(s, b.trackId);
          return (
            <li key={b.id}>
              <button
                type="button"
                className="quick__book"
                onClick={() => {
                  onClose();
                  flow.open({ kind: "log", bookId: b.id });
                }}
              >
                <span className="quick__icon" aria-hidden>
                  <BookOpen />
                </span>
                <span className="quick__book-text">
                  <span className="quick__book-title">{b.title}</span>
                  <span className="quick__book-sub">
                    {track?.name ?? "No track"} · p. {b.read}
                    {b.pages > 0 ? ` of ${b.pages}` : ""}
                  </span>
                </span>
                <ChevronRight className="quick__chev" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {books.length > 1 && <p className="quick__note">The book your plan reads next comes first.</p>}
    </>
  );
}

/** Workouts: every one that can be started, the one due next first; a tap starts it. */
function WorkoutPicker({ tracker, onClose }: { tracker: Tracker; onClose: () => void }) {
  const s = tracker.state!;
  const router = useRouter();
  const today = dateKey();
  const next = nextWorkout(s, today);
  const startable = s.workouts.filter((w) => w.exercises.length > 0);
  const list = next ? [next, ...startable.filter((w) => w.id !== next.id)] : startable;
  const last = (id: string) => s.workoutSessions.filter((x) => x.workoutId === id).map((x) => x.date).sort().pop();
  const start = (id: string) => {
    onClose();
    void tracker.startWorkout(id);
    router.push("/fitness?view=live");
  };
  return (
    <>
      <ul className="card quick__books">
        {list.map((w) => {
          const d = last(w.id);
          const ago = d ? daysBetween(d, today) : null;
          return (
            <li key={w.id}>
              <button type="button" className={"quick__book" + (w === next ? " is-next" : "")} onClick={() => start(w.id)}>
                <span className="quick__icon" aria-hidden>
                  <Dumbbell />
                </span>
                <span className="quick__book-text">
                  <span className="quick__book-title">
                    {w.name}
                    {w === next && <span className="quick__upnext">Up next</span>}
                  </span>
                  <span className="quick__book-sub">
                    {w.exercises.length} exercise{w.exercises.length === 1 ? "" : "s"} ·{" "}
                    {ago == null ? "not done yet" : ago === 0 ? "done today" : `last ${ago} day${ago === 1 ? "" : "s"} ago`}
                  </span>
                </span>
                <ChevronRight className="quick__chev" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {list.length > 1 && <p className="quick__note">Tap one to start it. The one due next comes first.</p>}
    </>
  );
}

/** The next step of today's plan, one tap from done or started. */
function NextStep({ tracker, onClose, onToast }: { tracker: Tracker; onClose: () => void; onToast: (t: Toast) => void }) {
  const s = tracker.state!;
  const router = useRouter();
  const flow = useFlow();
  const { pending, run } = usePending();
  const plan = planOf(s);
  const today = dateKey();
  if (!plan) return null;
  const steps = stepsOn(s, plan, today);
  const i = steps.findIndex((x) => !x.done && x.it);
  if (i < 0) return null;
  const x = steps[i];
  const it = x.it!;
  let label = "Done";
  let act: () => void = () => {};
  let sub = `Step ${i + 1} of ${steps.length}`;
  if (it.kind === "workout") {
    label = "Start";
    sub += ` · ${it.item.exercises.length} exercises`;
    act = () => {
      onClose();
      if (!s.activeWorkout) void tracker.startWorkout(it.item.id);
      router.push("/fitness?view=live");
    };
  } else if (it.kind === "focus") {
    label = "Start";
    sub += ` · ${it.minutes} min`;
    act = () => {
      onClose();
      void tracker.startFocus({ minutes: it.minutes, projectId: it.project?.id, stepId: x.step.id, day: today });
      router.push("/");
    };
  } else if (it.kind === "track" || it.kind === "book") {
    const book = it.kind === "track" ? it.book : it.item;
    label = "Log pages";
    act = () => {
      onClose();
      if (book) flow.open({ kind: "log", bookId: book.id });
    };
  } else if (it.kind === "goal") {
    const nx = nextOfGoal(it.item);
    if (nx) sub += ` · ${nx.itemId ? nx.title : "a session"}`;
    act = () =>
      void run(async () => {
        const ok = await (nx?.itemId ? tracker.setItemDone(it.item.id, nx.itemId, true) : tracker.logSession(it.item.id));
        if (ok) {
          onToast({ text: `Done: ${nx?.itemId ? nx.title : it.item.title}` });
          onClose();
        }
        return ok;
      });
  } else if (it.kind === "weekly") {
    act = () =>
      void run(async () => {
        const ok = await tracker.toggleWeeklyTask(it.item.id, today);
        if (ok) {
          onToast({ text: `Done: ${it.item.title}` });
          onClose();
        }
        return ok;
      });
  }
  const title = it.kind === "workout" || it.kind === "track" ? it.item.name : it.kind === "focus" ? it.project?.title ?? "Just focus" : it.item.title;
  return (
    <div className="quick__next">
      <span className="quick__next-icon" aria-hidden>
        <PlanGlyph icon={x.icon} />
      </span>
      <span className="quick__next-text">
        <span className="quick__next-label">Next in your plan</span>
        <span className="quick__next-title">{title}</span>
        <span className="quick__next-sub">{sub}</span>
      </span>
      <button type="button" className="pill-link pill-link--primary" disabled={pending} onClick={act}>
        {label === "Start" ? <Play aria-hidden /> : label === "Done" ? <Check aria-hidden /> : null}
        {label}
      </button>
    </div>
  );
}

function TodoForm({ tracker, onDone, onToast }: { tracker: Tracker; onDone: () => void; onToast: (t: Toast) => void }) {
  const { pending, run } = usePending();
  const [title, setTitle] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const before = tracker.state!.todos;
    void run(async () => {
      const ok = await tracker.addTodo(title);
      if (ok) {
        onToast({ text: `Added: ${title.trim()}`, undo: { todos: before } });
        onDone();
      }
      return ok;
    });
  };
  return (
    <form onSubmit={submit} className="quick__form">
      <MacroField label="To-do" text unit="" ariaLabel="New to-do" placeholder="What needs doing?" value={title} onChange={setTitle} autoFocus />
      <button type="submit" className="pill-link pill-link--primary quick__save" disabled={pending || !title.trim()}>
        Add to-do
      </button>
    </form>
  );
}

function WeightForm({ tracker, onDone, onToast }: { tracker: Tracker; onDone: () => void; onToast: (t: Toast) => void }) {
  const s = tracker.state!;
  const { pending, run } = usePending();
  const last = [...s.weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const [kg, setKg] = useState(last ? String(last.kg) : "");
  const n = Number(kg.replace(",", "."));
  const nudge = (d: number) => setKg((v) => (Math.round(((Number(v.replace(",", ".")) || last?.kg || 0) + d) * 10) / 10).toFixed(1));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!(n > 0)) return;
    const before = s.weights;
    void run(async () => {
      const ok = await tracker.addWeight(n);
      if (ok) {
        onToast({ text: `Logged ${n} kg`, undo: { weights: before } });
        onDone();
      }
      return ok;
    });
  };
  const diff = last && n > 0 ? Math.round((n - last.kg) * 10) / 10 : null;
  return (
    <form onSubmit={submit} className="quick__form">
      {/* One wide field, − and + at its end for tenths. */}
      <MacroField label="Weight" unit="kg" ariaLabel="Weight in kg" value={kg} onChange={setKg} className="macro-field--big" autoFocus>
        <span className="macro-field__steps">
          <button type="button" onClick={() => nudge(-0.1)} aria-label="Less 0.1 kg">
            <Minus aria-hidden />
          </button>
          <button type="button" onClick={() => nudge(0.1)} aria-label="More 0.1 kg">
            <Plus aria-hidden />
          </button>
        </span>
      </MacroField>
      {diff != null && last && <p className="quick__note">{diff === 0 ? "Same as" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} from`} {last.date === dateKey() ? "earlier today" : "last time"}</p>}
      <button type="submit" className="pill-link pill-link--primary quick__save" disabled={pending || !(n > 0)}>
        Log {n > 0 ? `${n} kg` : "weight"}
      </button>
    </form>
  );
}

function MealForm({ tracker, onDone, onToast }: { tracker: Tracker; onDone: () => void; onToast: (t: Toast) => void }) {
  const s = tracker.state!;
  const { pending, run } = usePending();
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fiber, setFiber] = useState("");
  const [tagId, setTagId] = useState<string | undefined>(s.mealTags[0]?.id);
  // A comma is a decimal point too: phones in many locales type one.
  const num = (v: string) => Number(v.replace(",", ".")) || 0;
  const k = Math.round(num(kcal));
  const p = Math.round(num(protein) * 10) / 10;
  const f = Math.round(num(fiber) * 10) / 10;
  // Today's grams so far, against the targets when there are any.
  const today = dateKey();
  const sum = (key: "protein" | "fiber") => Math.round(s.macros.filter((m) => m.date === today).reduce((a, m) => a + (m[key] ?? 0), 0) * 10) / 10;
  const eaten = s.calories.filter((e) => e.date === today).reduce((a, e) => a + e.kcal, 0);
  const left = s.calorieBudget ? s.calorieBudget - eaten - k : null;
  const of = (n: number, target?: number) => (target ? `${n} / ${target} g` : `${n} g`);
  // The button says exactly what will be logged.
  const parts = [k > 0 ? `${k.toLocaleString()} kcal` : null, p > 0 ? `${p} g protein` : null, f > 0 ? `${f} g fibre` : null].filter(Boolean) as string[];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parts.length) return;
    const before = { calories: s.calories, macros: s.macros };
    void run(async () => {
      let ok = true;
      if (k > 0) ok = (await tracker.addCalories(k, tagId)) !== false && ok;
      if (p > 0 || f > 0) ok = (await tracker.addMacros(p || null, f || null)) !== false && ok;
      if (ok) {
        const tag = k > 0 ? s.mealTags.find((t) => t.id === tagId) : undefined;
        onToast({ text: `Logged ${parts.join(" \u00b7 ")}${tag ? ` \u00b7 ${tag.name}` : ""}`, undo: before });
        onDone();
      }
      return ok;
    });
  };
  return (
    <form onSubmit={submit} className="quick__form">
      {/* The same fields as Log a meal on Nutrition: calories large, protein and fibre under them. */}
      <div className="meal-log__fields">
        <MacroField label="Calories" unit="kcal" whole ariaLabel="Calories" value={kcal} onChange={setKcal} className="macro-field--big" autoFocus />
        <div className="meal-log__pair">
          <MacroField label="Protein" value={protein} onChange={setProtein} />
          <MacroField label="Fibre" value={fiber} onChange={setFiber} />
        </div>
      </div>
      <p className="quick__note">
        {[left != null ? (left >= 0 ? `${left.toLocaleString()} left today` : `${(-left).toLocaleString()} over today`) : null, `${of(sum("protein"), s.proteinTarget)} protein`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="meal-log__chips" role="radiogroup" aria-label="Meal">
        {s.mealTags.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={t.id === tagId} className="weekly-cat" onClick={() => setTagId(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <button type="submit" className="pill-link pill-link--primary quick__save" disabled={pending || !parts.length}>
        {parts.length ? `Log ${parts.join(" \u00b7 ")}` : "Log meal"}
      </button>
    </form>
  );
}

/**
 * The app's logging field: its label inside, "–" while empty, the unit at
 * the end, soft grey with a thin white ring while typing. Used for food on
 * Nutrition and in every Add sheet.
 */
export function MacroField({
  label,
  value,
  onChange,
  unit = "g",
  whole,
  text,
  placeholder = "–",
  ariaLabel,
  autoFocus,
  className = "",
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  /** Whole numbers only (kcal): the numeric keypad, no decimal point. */
  whole?: boolean;
  /** Words rather than a number (a to-do). */
  text?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  className?: string;
  /** Controls at the field's end, after the unit (− and + for a weight). */
  children?: ReactNode;
}) {
  return (
    <div className={"macro-field " + className}>
      <label className="macro-field__main">
        <span className="macro-field__label">{label}</span>
        <span className="macro-field__row">
          <input
            inputMode={text ? "text" : whole ? "numeric" : "decimal"}
            aria-label={ariaLabel ?? (unit === "g" ? `${label} in grams` : label)}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus={autoFocus}
          />
          {unit && <span aria-hidden>{unit}</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

/** This week's weekly tasks to tick, and an add; with none yet, straight to making one. */
function WeeklyList({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const { pending, run } = usePending();
  const today = dateKey();
  const none = weeklyTasksOf(s).length === 0;
  const [adding, setAdding] = useState(none);
  if (adding) return <WeeklyTaskForm tracker={tracker} onDone={() => setAdding(false)} />;
  return (
    <ul className="card quick__weekly">
      {weeklyTasksOf(s).map((t) => {
        const cat = s.categories.find((c) => c.id === t.catId);
        const on = t.ticks.includes(today);
        return (
          <li key={t.id} className="task-row task-row--area">
            <span className="area-tile" aria-hidden>
              <PlanGlyph icon={categoryIcon(cat)} />
            </span>
            <span className="task-row__text">
              <span className="task-row__title">{t.title}</span>
              <span className="task-row__sub">
                {doneThisWeek(t, today)} of {t.times} this week
              </span>
            </span>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={`${t.title}, done today`}
              disabled={pending}
              className={"check" + (on ? " check--on" : "")}
              onClick={() => void run(() => tracker.toggleWeeklyTask(t.id, today))}
            >
              <span className="check__ring">{on && <Check className="h-4 w-4" aria-hidden />}</span>
            </button>
          </li>
        );
      })}
      <li>
        <InsertRow label="Add weekly task" onPress={() => setAdding(true)} />
      </li>
    </ul>
  );
}

/** The workout due next, as Health's Up next picks it. */
function nextWorkout(s: TrackerState, today: string) {
  const startable = s.workouts.filter((w) => w.exercises.length > 0);
  if (!startable.length) return undefined;
  const lastDone = (id: string) => s.workoutSessions.filter((x) => x.workoutId === id).map((x) => x.date).sort().pop() ?? "";
  const due = routines(s, today)
    .filter((r) => r.kind === "workout" && !r.done)
    .map((r) => startable.find((w) => w.id === r.id))
    .filter((w): w is (typeof startable)[number] => !!w)
    .sort((a, b) => lastDone(a.id).localeCompare(lastDone(b.id)));
  return due[0] ?? startable[0];
}

/** A book's title without its subtitle, short enough for a hint. */
function shortTitle(t: string): string {
  return t.split(/\s*[:|—–]\s+|:\s*/)[0].trim() || t;
}
