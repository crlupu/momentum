"use client";

import { FormEvent, useState } from "react";
import { Tracker, dateKey, uid } from "@/lib/tracker";
import {
  addDays,
  leftFromLastWeek,
  progressOf,
  planOf,
  refTitle,
  streak,
  suggestions,
  summarizeWeek,
  weekNumber,
  weekOf,
  type GoalProgress,
  type PlanIcon,
  type WeekGoal,
} from "@/lib/plan";
import { usePending } from "../ActionButton";
import { Button, Input } from "../ui";
import { Modal } from "../Modal";
import { DialogActions } from "../DialogActions";
import { EmptyState } from "../EmptyState";
import { Check, ChevronDown, ChevronRight, Minus, Plus, Target, X } from "../icons";
import { PlanTile, WeekRings } from "./bits";

const iconOf = (g: WeekGoal): PlanIcon =>
  g.mode === "once" ? "task" : g.ref?.kind === "book" ? "book" : g.ref?.kind === "workout" ? "gym" : "learn";

/**
 * This week: its goals with how far each has got and whether it's on pace,
 * the plan days as rings, and the weeks before it, done or not.
 */
export function WeekView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const today = dateKey();
  const week = weekOf(today);
  const sum = summarizeWeek(s, week, today);
  const [editing, setEditing] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const open = sum.goals.filter((g) => !g.done);
  const done = sum.goals.filter((g) => g.done);
  const behind = open.filter((g) => g.pace === "behind").length;
  const onPace = open.filter((g) => g.pace === "on").length;
  const daysLeft = 7 - sum.days.findIndex((d) => d.day === today);

  return (
    <div className="flex flex-col gap-6">
      <p className="week-dates">
        {fmt(week)} – {fmt(addDays(week, 6))} · {daysLeft === 1 ? "last day" : `${daysLeft} days left`}
      </p>
      <section className={"momentum week-hero" + (sum.done ? " momentum--done" : "")} aria-label="This week">
        <div className="momentum__top">
          {sum.done && (
            <div className="momentum__head">
              <p className="eyebrow">Week {weekNumber(week)}</p>
              <span className="momentum__badge">
                <Check aria-hidden />
                Week done
              </span>
            </div>
          )}
          <div>
            <p className="momentum__count">
              {sum.goals.length ? (
                <>
                  <span className="font-mono-n momentum__headline">{`${sum.goalsDone} of ${sum.goals.length}`}</span>
                  <span className="momentum__detail">week goals</span>
                </>
              ) : (
                <>
                  <span className="font-mono-n momentum__headline">{`${sum.daysDone} of ${sum.daysPlanned}`}</span>
                  <span className="momentum__detail">plan days</span>
                </>
              )}
            </p>
            <p className="momentum__detail momentum__next">
              {sum.done
                ? "Every goal and every plan day, done."
                : [
                    onPace ? `${onPace} on pace` : null,
                    behind ? <span key="b" className="week-hero__behind">{behind} behind</span> : null,
                    sum.daysPlanned ? `plan days ${sum.daysDone} of ${sum.daysPlanned}` : null,
                  ]
                    .filter(Boolean)
                    .flatMap((x, i) => (i ? [" · ", x] : [x]))}
            </p>
          </div>
          <WeekRings days={sum.days} today={today} size={40} />
        </div>
      </section>

      <section>
        <div className="panel-head">
          <h2 className="panel-head__title">To finish this week</h2>
          {sum.goals.length > 0 && (
            <div className="panel-head__side">
              <button type="button" className="text-action" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
          )}
        </div>
        {sum.goals.length === 0 ? (
          <EmptyState
            icon={<Target />}
            title="No goals for this week"
            action={
              <Button variant="primary" onPress={() => setEditing(true)}>
                Set week goals
              </Button>
            }
          >
            What the week should add up to. Your day plan suggests a start.
          </EmptyState>
        ) : (
          <ul className="card week-goals">
            {open.map((g) => (
              <GoalRow key={g.goal.id} tracker={tracker} week={week} p={g} />
            ))}
            {done.length > 0 && (
              <li>
                <button type="button" className="done-fold" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
                  <span className="done-fold__mark" aria-hidden>
                    <Check />
                  </span>
                  <span className="flex-1 truncate">
                    {done.length} done{done.length === 1 ? ` · ${done[0].label}` : ""}
                  </span>
                  {showDone ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                </button>
              </li>
            )}
            {showDone && done.map((g) => <GoalRow key={g.goal.id} tracker={tracker} week={week} p={g} />)}
          </ul>
        )}
      </section>

      <History tracker={tracker} week={week} />

      <Modal open={editing} onClose={() => setEditing(false)} title={`Week ${weekNumber(week)} goals`} save={{ label: "Save", form: "week-goals" }}>
        {editing && <GoalsForm tracker={tracker} week={week} onDone={() => setEditing(false)} />}
      </Modal>
    </div>
  );
}

function fmt(key: string) {
  return new Date(key + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function GoalRow({ tracker, week, p }: { tracker: Tracker; week: string; p: GoalProgress }) {
  const { pending, run } = usePending();
  const g = p.goal;
  const toggle = () => {
    const list = tracker.state!.weekGoals?.[week] ?? [];
    void run(() => tracker.setWeekGoals(week, list.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x))));
  };
  const pct = g.mode === "page" ? Math.max(0, (p.value - (g.from ?? 0)) / Math.max(1, g.target - (g.from ?? 0))) : p.value / p.target;
  return (
    <li className={"week-goal" + (p.done ? " is-done" : "")}>
      <div className="week-goal__main">
        <PlanTile icon={iconOf(g)} />
        <span className="week-goal__text">
          <span className="week-goal__label">{p.label}</span>
          <span className="week-goal__sub">{p.sub}</span>
        </span>
        {g.mode === "once" ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={p.done}
            aria-label={p.label}
            disabled={pending}
            onClick={toggle}
            className={"check" + (p.done ? " check--on" : "")}
          >
            <span className="check__ring">{p.done && <Check className="h-4 w-4" aria-hidden />}</span>
          </button>
        ) : (
          <span className="week-goal__side">
            <span className="week-goal__count font-mono-n">{p.count}</span>
            {p.done ? (
              <span className="week-goal__pace is-done">Done</span>
            ) : p.pace ? (
              <span className={"week-goal__pace is-" + p.pace}>{p.pace === "on" ? "On pace" : "Behind"}</span>
            ) : null}
          </span>
        )}
      </div>
      {g.mode !== "once" && (
        <span className={"week-goal__bar" + (p.pace === "behind" ? " is-behind" : "") + (p.done ? " is-done" : "")} aria-hidden>
          <span style={{ inlineSize: `${Math.min(1, pct) * 100}%` }} />
        </span>
      )}
    </li>
  );
}

/** The last four weeks and this one: done, or how many goals were. */
function History({ tracker, week }: { tracker: Tracker; week: string }) {
  const s = tracker.state!;
  const today = dateKey();
  const weeks = [-4, -3, -2, -1, 0].map((i) => addDays(week, i * 7));
  const rows = weeks.map((w) => ({ w, sum: summarizeWeek(s, w, today) }));
  if (rows.slice(0, 4).every((r) => !r.sum.goals.length && !r.sum.daysPlanned)) return null;
  const n = streak(s, today);
  return (
    <section>
      <div className="panel-head">
        <h2 className="panel-head__title">Weeks{n > 1 ? ` · ${n} in a row` : ""}</h2>
      </div>
      <ol className="card week-history">
        {rows.map(({ w, sum }) => {
          const current = w === week;
          const empty = !sum.goals.length && !sum.daysPlanned;
          return (
            <li key={w} className={"week-history__w" + (sum.done ? " is-done" : "") + (current && !sum.done ? " is-current" : "")}>
              <span className="week-history__cell">
                {sum.done ? <Check aria-hidden /> : empty ? "–" : sum.goals.length ? `${sum.goalsDone}/${sum.goals.length}` : `${sum.daysDone}/${sum.daysPlanned}`}
              </span>
              <span className="week-history__label">W{weekNumber(w)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const key = (g: WeekGoal) => (g.ref ? `${g.ref.kind}:${g.ref.id}` : `once:${(g.title ?? "").toLowerCase()}`);

/**
 * The week's goals: those set, each with its target to nudge or remove;
 * what the plan suggests and last week left unfinished, to add; and a
 * one-off of your own.
 */
function GoalsForm({ tracker, week, onDone }: { tracker: Tracker; week: string; onDone: () => void }) {
  const s = tracker.state!;
  const today = dateKey();
  const plan = planOf(s);
  const [list, setList] = useState<WeekGoal[]>(() => s.weekGoals?.[week] ?? []);
  const [text, setText] = useState("");
  const { pending, run } = usePending();
  const have = new Set(list.map(key));
  const offered = [
    ...leftFromLastWeek(s, week, today).map((g) => ({ goal: g, why: "Left from last week" })),
    ...suggestions(s, week).map((x) => ({ goal: x.goal, why: x.why })),
  ].filter((x, i, all) => !have.has(key(x.goal)) && all.findIndex((y) => key(y.goal) === key(x.goal)) === i);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const extra = text.trim() ? [{ id: uid(), mode: "once" as const, title: text.trim(), target: 1 }] : [];
    const ok = await run(() => tracker.setWeekGoals(week, [...list, ...extra]));
    if (ok !== false) onDone();
  };
  const nudge = (id: string, by: number) =>
    setList((l) => l.map((g) => (g.id === id ? { ...g, target: Math.max(g.mode === "page" ? (g.from ?? 0) + 1 : 1, g.target + by) } : g)));

  return (
    <form id="week-goals" onSubmit={submit} className="flex flex-col gap-4">
      <p className="plan-note">What this week should add up to. Counted goals fill from activity; one-offs you tick.</p>
      {list.length > 0 && (
        <section>
          <h3 className="group-head">This week</h3>
          <ul className="card week-edit">
            {list.map((g) => {
              const p = progressOf(s, g, week, plan, today);
              const step = g.mode === "page" ? 10 : 1;
              return (
                <li key={g.id} className="week-edit__row">
                  <PlanTile icon={iconOf(g)} />
                  <span className="week-goal__text">
                    <span className="week-goal__label">{p.label}</span>
                    <span className="week-goal__sub">{p.sub}</span>
                  </span>
                  {g.mode !== "once" && (
                    <span className="week-edit__stepper">
                      <button type="button" aria-label="Less" onClick={() => nudge(g.id, -step)}>
                        <Minus aria-hidden />
                      </button>
                      <button type="button" aria-label="More" onClick={() => nudge(g.id, step)}>
                        <Plus aria-hidden />
                      </button>
                    </span>
                  )}
                  <button type="button" className="week-edit__remove" aria-label={`Remove ${p.label}`} onClick={() => setList((l) => l.filter((x) => x.id !== g.id))}>
                    <X aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {offered.length > 0 && (
        <section>
          <h3 className="group-head">Suggested</h3>
          <ul className="card week-edit">
            {offered.map(({ goal, why }) => {
              const p = progressOf(s, goal, week, plan, today);
              return (
                <li key={key(goal)} className="week-edit__row">
                  <PlanTile icon={iconOf(goal)} />
                  <span className="week-goal__text">
                    <span className="week-goal__label">{p.label}</span>
                    <span className="week-goal__sub">{goal.ref ? `${refTitle(s, goal.ref)} · ${why}` : why}</span>
                  </span>
                  <button type="button" className="week-edit__add" onClick={() => setList((l) => [...l, goal])}>
                    <Plus aria-hidden />
                    Add
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section>
        <h3 className="group-head">Your own</h3>
        <Input aria-label="A goal for this week" placeholder="A goal for this week" value={text} onChange={(e) => setText(e.target.value)} />
      </section>
      <DialogActions primary={{ label: "Save", disabled: pending }} />
    </form>
  );
}
