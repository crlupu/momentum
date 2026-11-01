"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Play, Plus } from "../icons";
import { useFlow } from "../books/flowContext";
import { dateKey, type Tracker } from "@/lib/tracker";
import {
  WEEKDAY, WEEKDAY_LONG, addDays, leftovers, nextOfGoal, planOf, refTitle, stepsOn, weekOf, weekStatus, weekdayOf,
  type DayPlan, type DayStep, type Leftover,
} from "@/lib/plan";
import { doneThisWeek, weeklyTasksOf, categoryIcon } from "@/lib/weekly";
import { Button, CheckButton, Disclosure, Empty, Label, Row, Strip, Tile, usePending } from "./parts";

/**
 * Today, rebuilt (Hallmark, app scope). It leads with the plan as a
 * timeline: done steps shrink, the next opens in place with its action, the
 * rest wait. The figures sit as type under the title. Everything else is a
 * list panel or a disclosure row: what's left from earlier, the to-dos, this
 * week's weekly tasks, and the week as one line per day.
 */
export function TodayV2({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const plan = planOf(s);
  const steps = plan ? stepsOn(s, plan, today) : [];
  const done = steps.filter((x) => x.done).length;
  const open = s.todos.filter((t) => !t.done).length;
  const kcal = s.calories.filter((c) => c.date === today).reduce((a, c) => a + c.kcal, 0);
  const kg = [...s.weights].sort((a, b) => a.date.localeCompare(b.date)).pop()?.kg;
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="v2-page">
      <header className="v2-head">
        <span className="v2-kicker">{date}</span>
        <h1 className="v2-title">Today</h1>
        <Strip
          items={[
            ...(steps.length ? [{ value: `${done} of ${steps.length}`, label: "steps" }] : []),
            { value: open, label: "to do" },
            { value: kcal.toLocaleString(), label: "kcal" },
            ...(kg ? [{ value: kg, label: "kg, latest" }] : []),
          ]}
        />
      </header>
      <div className="v2-cols">
        <div className="v2-col">
          {!plan ? <NoPlan /> : steps.length ? <Timeline tracker={tracker} plan={plan} steps={steps} /> : <RestDay tracker={tracker} plan={plan} />}
        </div>
        <div className="v2-col">
          {plan && <WeekLine tracker={tracker} plan={plan} />}
          {plan && <Leftovers tracker={tracker} plan={plan} />}
          <Todos tracker={tracker} />
          <Weekly tracker={tracker} />
        </div>
      </div>
    </div>
  );
}

function NoPlan() {
  return (
    <section className="v2-panel">
      <Empty
        title="No day plan yet"
        line="The steps you want to do each day, in order: read, train, learn. Today then walks you through them."
        action={
          <Link href="/plan" className="v2-btn v2-btn--primary">
            Make a day plan
          </Link>
        }
      />
    </section>
  );
}

/** A day off: the next plan day's steps, so the week ahead is in view. */
function RestDay({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const s = tracker.state!;
  let day = addDays(dateKey(), 1);
  for (let i = 0; i < 7 && !plan.days.includes(weekdayOf(day)); i++) day = addDays(day, 1);
  const next = stepsOn(s, plan, day);
  return (
    <section className="v2-section">
      <Label action={<Link href="/plan">Edit plan</Link>}>No plan today. {WEEKDAY_LONG[weekdayOf(day)]}&rsquo;s plan</Label>
      <ul className="v2-panel">
        {next.map((x) => (
          <Row key={x.step.id} tile={<Tile icon={x.icon} />} title={refTitle(s, x.ref) ?? x.name} sub={x.name} />
        ))}
      </ul>
    </section>
  );
}

function Timeline({ tracker, plan, steps }: { tracker: Tracker; plan: DayPlan; steps: DayStep[] }) {
  const s = tracker.state!;
  const today = dateKey();
  const next = steps.find((x) => !x.done);
  const [opened, setOpened] = useState<string | null>(null);
  const { pending, run } = usePending();
  return (
    <section className="v2-section" aria-label="Today's plan">
      <Label action={<Link href="/plan">Edit plan</Link>}>Today&rsquo;s plan</Label>
      <ol className="v2-tl">
        {steps.map((x, i) => {
          const isNext = x === next;
          const shown = !x.done && (opened ? opened === x.step.id : isNext);
          const title = refTitle(s, x.ref) ?? (x.ref ? "Gone" : "Nothing picked");
          return (
            <li key={x.step.id}>
              <div className={"v2-step" + (x.done ? " is-done" : "") + (isNext ? " is-next" : "")}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={x.done}
                  aria-label={`${x.name}: ${title}`}
                  className="v2-step__mark"
                  disabled={pending}
                  title={x.auto ? "Done by what you logged today. Tap to unmark." : undefined}
                  onClick={() => void run(() => tracker.togglePlanStep(today, x.step.id))}
                >
                  <span>{x.done ? <Check aria-hidden /> : i + 1}</span>
                </button>
                <button type="button" className="v2-step__open" aria-expanded={shown} onClick={() => setOpened(shown ? "" : x.step.id)}>
                  <span className="v2-step__name">{x.done || isNext ? x.name : title}</span>
                  {!x.done && !isNext && x.name !== title && <span className="v2-step__sub">{x.name}</span>}
                </button>
                <span />
              </div>
              {shown && <NowCard tracker={tracker} plan={plan} x={x} day={today} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The opened step: what it is, and the one thing that does it. */
function NowCard({ tracker, plan: _plan, x, day }: { tracker: Tracker; plan: DayPlan; x: DayStep; day: string }) {
  const router = useRouter();
  const flow = useFlow();
  const { pending, run } = usePending();
  const s = tracker.state!;
  const it = x.it;
  const leftover = day !== dateKey();
  const credit = () => (leftover ? tracker.creditLeftover(day, x.step.id) : Promise.resolve(true));
  const title = refTitle(s, x.ref) ?? x.name;
  let sub = "";
  let actions: React.ReactNode = null;

  if (!it) {
    actions = (
      <Link href="/plan" className="v2-btn">
        Pick what it is
      </Link>
    );
  } else if (it.kind === "goal") {
    const nx = nextOfGoal(it.item);
    sub = nx ? (nx.itemId ? `Next: ${nx.title}` : nx.of) : "";
    actions = nx && (
      <Button
        kind="primary"
        working={pending}
        onClick={() => void run(async () => (await credit(), nx.itemId ? tracker.setItemDone(it.item.id, nx.itemId, true) : tracker.logSession(it.item.id)))}
      >
        <Check aria-hidden /> {nx.itemId ? "Mark done" : "Log a session"}
      </Button>
    );
  } else if (it.kind === "track" || it.kind === "book") {
    const book = it.kind === "track" ? it.book : it.item;
    sub = book ? `p. ${book.read} of ${book.pages || "?"}` : "No book open in this track";
    actions = book ? (
      <>
        <Button kind="primary" onClick={() => (void credit(), flow.open({ kind: "log", bookId: book.id }))}>
          Log pages
        </Button>
        <Button onClick={() => flow.open({ kind: "detail", bookId: book.id })}>Open</Button>
      </>
    ) : (
      <Link href="/education" className="v2-btn">
        Open the track
      </Link>
    );
  } else if (it.kind === "workout") {
    const last = s.workoutSessions.filter((w) => w.workoutId === it.item.id).map((w) => w.date).sort().pop();
    sub = `${it.item.exercises.length} exercises${last ? `, last done ${WEEKDAY_LONG[weekdayOf(last)]}` : ""}`;
    actions = (
      <>
        <Button kind="primary" onClick={() => (void credit(), void tracker.startWorkout(it.item.id), router.push("/fitness?view=live"))}>
          <Play aria-hidden /> Start {it.item.name}
        </Button>
        <Link href={`/fitness?view=workout&id=${it.item.id}`} className="v2-btn">
          Open
        </Link>
      </>
    );
  } else if (it.kind === "weekly") {
    sub = `${doneThisWeek(it.item, day)} of ${it.item.times} this week`;
    actions = (
      <Button kind="primary" working={pending} onClick={() => void run(() => tracker.toggleWeeklyTask(it.item.id, day))}>
        <Check aria-hidden /> Done for {leftover ? WEEKDAY[weekdayOf(day)] : "today"}
      </Button>
    );
  } else {
    const running = s.activeFocus?.stepId === x.step.id && s.activeFocus.day === day;
    sub = `${it.minutes} minutes${it.project ? `, ${it.project.title}` : ""}`;
    actions = running ? (
      <Button kind="primary" disabled>
        Running
      </Button>
    ) : (
      <Button kind="primary" working={pending} onClick={() => void run(() => tracker.startFocus({ minutes: it.minutes, projectId: it.project?.id, stepId: x.step.id, day }))}>
        <Play aria-hidden /> Start focus
      </Button>
    );
  }

  return (
    <div className="v2-now">
      <div>
        <div className="v2-now__title">{title}</div>
        {sub && <div className="v2-now__sub">{sub}</div>}
      </div>
      <div className="v2-actions">{actions}</div>
    </div>
  );
}

/** This week's plan days, a segmented line each. */
function WeekLine({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const days = weekStatus(tracker.state!, plan, weekOf(dateKey())).filter((d) => d.planned);
  if (!days.length) return null;
  const full = days.filter((d) => d.done === d.total).length;
  return (
    <section className="v2-section">
      <Label action={<Link href="/week">Open</Link>}>
        This week, {full} of {days.length} plan days
      </Label>
      <div className="v2-lead">
        <ol className="v2-weekline" style={{ ["--days" as string]: days.length }} aria-label={`${full} of ${days.length} plan days finished`}>
          {days.map((d) => (
            <li key={d.day} className={d.done === d.total ? "is-done" : undefined} title={`${d.done} of ${d.total}`}>
              <span className="v2-segs" aria-hidden>
                {Array.from({ length: d.total }, (_, k) => (
                  <i key={k} className={k < d.done ? "d" : undefined} />
                ))}
              </span>
              <span>{WEEKDAY[weekdayOf(d.day)]}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Leftovers({ tracker, plan }: { tracker: Tracker; plan: DayPlan }) {
  const s = tracker.state!;
  const list = leftovers(s, plan);
  const { pending, run } = usePending();
  if (!list.length) return null;
  const days = [...new Set(list.map((l) => l.day))].sort();
  const span = days.length === 1 ? WEEKDAY_LONG[weekdayOf(days[0])] : `${WEEKDAY_LONG[weekdayOf(days[0])]} to ${WEEKDAY_LONG[weekdayOf(days[days.length - 1])]}`;
  const skip = (ls: Leftover[]) => void run(() => tracker.skipPlanSteps(ls.map((l) => ({ day: l.day, stepId: l.x.step.id }))));
  return (
    <Disclosure title="Left from earlier" sub={span} count={list.length}>
      <ul className="v2-panel">
        {list.map((l) => (
          <Row
            key={l.day + l.x.step.id}
            tile={<Tile icon={l.x.icon} />}
            title={refTitle(s, l.x.ref) ?? l.x.name}
            sub={WEEKDAY_LONG[weekdayOf(l.day)]}
            trail={
              <>
                <Button kind="quiet" small disabled={pending} onClick={() => skip([l])}>
                  Skip
                </Button>
                <CheckButton on={false} label={`Done on ${WEEKDAY_LONG[weekdayOf(l.day)]}`} disabled={pending} onToggle={() => void run(() => tracker.togglePlanStep(l.day, l.x.step.id))} />
              </>
            }
          />
        ))}
      </ul>
    </Disclosure>
  );
}

function Todos({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const { pending, run } = usePending();
  const open = s.todos.filter((t) => !t.done);
  const done = s.todos.filter((t) => t.done);
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    void run(async () => {
      const ok = await tracker.addTodo(title);
      if (ok !== false) setTitle("");
    });
  };
  return (
    <section className="v2-section">
      <Label>To do</Label>
      <form className="v2-inline" onSubmit={add}>
        <input id="v2-todo-new" aria-label="New to-do" placeholder="New to-do" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button kind="icon" type="submit" aria-label="Add to-do" disabled={!title.trim() || pending} style={{ inlineSize: 36, minHeight: 36 }}>
          <Plus aria-hidden />
        </Button>
      </form>
      {open.length > 0 && (
        <ul className="v2-panel">
          {open.map((t) => (
            <Row
              key={t.id}
              title={t.title}
              trail={<CheckButton on={false} label={`Done: ${t.title}`} onToggle={() => void tracker.toggleTodo(t.id)} />}
            />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <Disclosure title="Done" count={done.length}>
          <ul className="v2-panel">
            {done.map((t) => (
              <Row
                key={t.id}
                done
                title={t.title}
                trail={
                  <>
                    <Button kind="quiet" small onClick={() => void tracker.deleteTodo(t.id)}>
                      Delete
                    </Button>
                    <CheckButton on label={`Reopen: ${t.title}`} onToggle={() => void tracker.toggleTodo(t.id)} />
                  </>
                }
              />
            ))}
          </ul>
        </Disclosure>
      )}
    </section>
  );
}

function Weekly({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const tasks = weeklyTasksOf(s);
  return (
    <section className="v2-section">
      <Label>Also this week</Label>
      <ul className="v2-panel">
        {tasks.length === 0 ? (
          <li>
            <Empty title="No weekly tasks yet" line="Something to do a few times a week, like calling home." />
          </li>
        ) : (
          tasks.map((t) => {
            const on = t.ticks.includes(today);
            const n = doneThisWeek(t, today);
            const cat = s.categories.find((c) => c.id === t.catId);
            return (
              <Row
                key={t.id}
                tile={<Tile icon={categoryIcon(cat)} />}
                title={t.title}
                sub={`${n} of ${t.times} this week`}
                done={n >= t.times && !on}
                trail={<CheckButton on={on} label={`${t.title}, done today`} onToggle={() => void tracker.toggleWeeklyTask(t.id, today)} />}
              />
            );
          })
        )}
      </ul>
    </section>
  );
}
