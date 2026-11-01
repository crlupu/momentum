"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Apple, BookOpen, ChevronLeft, Dumbbell, Repeat, Scale, TaskDone } from "../icons";
import { dateKey, type Tracker } from "@/lib/tracker";
import { routines } from "@/lib/routines";
import { daysBetween } from "@/lib/plan";
import { Button, Row, Sheet, Tile, usePending } from "./parts";

type View = "menu" | "todo" | "weight" | "meal" | "workout";
const TITLES: Record<View, string> = { menu: "Add", todo: "New to-do", weight: "Weigh-in", meal: "Log a meal", workout: "Which workout?" };

/**
 * The +: log anything from anywhere. Six keys; the small things are a form
 * in the sheet, a workout is picked from a list and starts. Pages and weekly
 * tasks open their own screens until those are rebuilt.
 */
export function AddSheet({ tracker, open, onClose }: { tracker: Tracker; open: boolean; onClose: () => void }) {
  const [view, setView] = useState<View>("menu");
  const close = () => {
    onClose();
    setView("menu");
  };
  if (!tracker.state) return null;
  return (
    <Sheet open={open} title={TITLES[view]} onClose={close}>
      {view !== "menu" && (
        <Button kind="quiet" small onClick={() => setView("menu")} style={{ justifySelf: "start" }}>
          <ChevronLeft aria-hidden /> All
        </Button>
      )}
      {view === "menu" && <Menu tracker={tracker} onView={setView} onClose={close} />}
      {view === "todo" && <TodoForm tracker={tracker} onDone={close} />}
      {view === "weight" && <WeightForm tracker={tracker} onDone={close} />}
      {view === "meal" && <MealForm tracker={tracker} onDone={close} />}
      {view === "workout" && <WorkoutPicker tracker={tracker} onDone={close} />}
    </Sheet>
  );
}

function Key({ icon, title, hint, onPress, disabled }: { icon: ReactNode; title: string; hint?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <li>
      <button type="button" className="v2-key" disabled={disabled} onClick={onPress}>
        <span className="v2-key__icon" aria-hidden>
          {icon}
        </span>
        <span className="v2-key__title">{title}</span>
        <span className="v2-key__hint">{hint ?? " "}</span>
      </button>
    </li>
  );
}

function Menu({ tracker, onView, onClose }: { tracker: Tracker; onView: (v: View) => void; onClose: () => void }) {
  const s = tracker.state!;
  const router = useRouter();
  const today = dateKey();
  const lastKg = [...s.weights].sort((a, b) => a.date.localeCompare(b.date)).pop()?.kg;
  const eaten = s.calories.filter((c) => c.date === today).reduce((a, c) => a + c.kcal, 0);
  const startable = s.workouts.filter((w) => w.exercises.length > 0);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <ul className="v2-keys">
      <Key icon={<TaskDone />} title="To-do" onPress={() => onView("todo")} />
      <Key icon={<Scale />} title="Weigh-in" hint={lastKg ? `${lastKg} last` : undefined} onPress={() => onView("weight")} />
      <Key icon={<BookOpen />} title="Pages" hint="Pick a book" onPress={() => go("/books")} />
      <Key
        icon={<Dumbbell />}
        title="Workout"
        hint={s.activeWorkout ? "Resume" : `${startable.length} workouts`}
        disabled={!s.activeWorkout && !startable.length}
        onPress={() => (s.activeWorkout ? go("/fitness?view=live") : onView("workout"))}
      />
      <Key icon={<Apple />} title="Meal" hint={s.calorieBudget ? `${Math.max(0, s.calorieBudget - eaten).toLocaleString()} left` : undefined} onPress={() => onView("meal")} />
      <Key icon={<Repeat />} title="Weekly task" hint="This week" onPress={() => go("/")} />
    </ul>
  );
}

function TodoForm({ tracker, onDone }: { tracker: Tracker; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const { pending, run } = usePending();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    void run(async () => {
      const ok = await tracker.addTodo(title);
      if (ok !== false) onDone();
    });
  };
  return (
    <form className="v2-form" onSubmit={submit}>
      <label className="v2-field">
        <span className="v2-field__label">To-do</span>
        <input id="v2-add-todo" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call the bank" />
      </label>
      <Button kind="primary" type="submit" disabled={!title.trim()} working={pending}>
        Add to-do
      </Button>
    </form>
  );
}

function WeightForm({ tracker, onDone }: { tracker: Tracker; onDone: () => void }) {
  const [kg, setKg] = useState("");
  const { pending, run } = usePending();
  const n = Number(kg.replace(",", "."));
  const valid = n > 20 && n < 400;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    void run(async () => {
      const ok = await tracker.addWeight(n);
      if (ok !== false) onDone();
    });
  };
  return (
    <form className="v2-form" onSubmit={submit}>
      <label className="v2-field">
        <span className="v2-field__label">Weight</span>
        <span className="v2-field__row">
          <input id="v2-add-kg" autoFocus inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="–" />
          <span className="v2-field__unit">kg</span>
        </span>
      </label>
      <Button kind="primary" type="submit" disabled={!valid} working={pending}>
        {valid ? `Log ${n} kg` : "Log"}
      </Button>
    </form>
  );
}

function MealForm({ tracker, onDone }: { tracker: Tracker; onDone: () => void }) {
  const s = tracker.state!;
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fiber, setFiber] = useState("");
  const [tagId, setTagId] = useState<string | undefined>(s.mealTags[0]?.id);
  const { pending, run } = usePending();
  const k = Math.round(Number(kcal) || 0);
  const p = Number(protein.replace(",", ".")) || 0;
  const f = Number(fiber.replace(",", ".")) || 0;
  const parts = [k > 0 ? `${k.toLocaleString()} kcal` : null, p > 0 ? `${p} g protein` : null, f > 0 ? `${f} g fibre` : null].filter(Boolean) as string[];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parts.length) return;
    void run(async () => {
      let ok = true;
      if (k > 0) ok = (await tracker.addCalories(k, tagId)) !== false && ok;
      if (p > 0 || f > 0) ok = (await tracker.addMacros(p || null, f || null)) !== false && ok;
      if (ok) onDone();
    });
  };
  const field = (id: string, label: string, unit: string, v: string, set: (x: string) => void, big?: boolean) => (
    <label className={"v2-field" + (big ? " v2-field--big" : "")}>
      <span className="v2-field__label">{label}</span>
      <span className="v2-field__row">
        <input id={id} inputMode={big ? "numeric" : "decimal"} value={v} onChange={(e) => set(e.target.value)} placeholder="–" autoFocus={big} />
        <span className="v2-field__unit">{unit}</span>
      </span>
    </label>
  );
  return (
    <form className="v2-form" onSubmit={submit}>
      {field("v2-add-kcal", "Calories", "kcal", kcal, setKcal, true)}
      <div className="v2-pair">
        {field("v2-add-protein", "Protein", "g", protein, setProtein)}
        {field("v2-add-fiber", "Fibre", "g", fiber, setFiber)}
      </div>
      {s.mealTags.length > 0 && (
        <div className="v2-chips" role="radiogroup" aria-label="Meal">
          {s.mealTags.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={t.id === tagId} className="v2-chip" onClick={() => setTagId(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      <Button kind="primary" type="submit" disabled={!parts.length} working={pending}>
        {parts.length ? `Log ${parts.join(", ")}` : "Log meal"}
      </Button>
    </form>
  );
}

/** Every workout that can start, the one due first; a tap starts it. */
function WorkoutPicker({ tracker, onDone }: { tracker: Tracker; onDone: () => void }) {
  const s = tracker.state!;
  const router = useRouter();
  const today = dateKey();
  const startable = s.workouts.filter((w) => w.exercises.length > 0);
  const last = (id: string) => s.workoutSessions.filter((x) => x.workoutId === id).map((x) => x.date).sort().pop();
  const due = routines(s, today)
    .filter((r) => r.kind === "workout" && !r.done)
    .map((r) => startable.find((w) => w.id === r.id))
    .filter((w): w is (typeof startable)[number] => !!w)
    .sort((a, b) => (last(a.id) ?? "").localeCompare(last(b.id) ?? ""))[0];
  const list = due ? [due, ...startable.filter((w) => w.id !== due.id)] : startable;
  return (
    <ul className="v2-panel">
      {list.map((w) => {
        const d = last(w.id);
        const ago = d ? daysBetween(d, today) : null;
        return (
          <Row
            key={w.id}
            tile={<Tile icon="gym" />}
            title={w === due ? `${w.name}, up next` : w.name}
            sub={`${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"}, ${ago == null ? "not done yet" : ago === 0 ? "done today" : `last ${ago} day${ago === 1 ? "" : "s"} ago`}`}
            trail={
              <Button
                kind={w === due ? "primary" : "secondary"}
                small
                onClick={() => {
                  onDone();
                  void tracker.startWorkout(w.id);
                  router.push("/fitness?view=live");
                }}
              >
                Start
              </Button>
            }
          />
        );
      })}
    </ul>
  );
}
