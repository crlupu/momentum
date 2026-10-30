"use client";

import { FormEvent, useState } from "react";
import { Modal } from "./Modal";
import { Input } from "./ui";
import { usePending } from "./ActionButton";
import { Check, Minus, Plus } from "./icons";
import { PlanGlyph } from "./plan/bits";
import { Tracker, dateKey } from "@/lib/tracker";
import { categoryIcon, doneThisWeek } from "@/lib/weekly";
import type { WeeklyTask } from "@/lib/model";

/** Done so far this week as dots: two a week is two dots. */
function WeekDots({ done, of }: { done: number; of: number }) {
  return (
    <span className="week-dots" aria-label={`${done} of ${of} this week`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < done ? "is-on" : undefined} />
      ))}
    </span>
  );
}

/**
 * A weekly task in This week: its category's icon, how far the
 * week has got, and a tick for today. Tapping its name opens it to edit.
 */
export function WeeklyTaskRow({ tracker, task, onEdit }: { tracker: Tracker; task: WeeklyTask; onEdit: () => void }) {
  const s = tracker.state!;
  const { pending, run } = usePending();
  const cat = s.categories.find((c) => c.id === task.catId);
  const today = dateKey();
  const doneToday = task.ticks.includes(today);
  const n = doneThisWeek(task, today);
  const full = n >= task.times;
  return (
    <li className="task-row task-row--area">
      <span className="area-tile" aria-hidden>
        <PlanGlyph icon={categoryIcon(cat)} />
      </span>
      <button type="button" className="task-row__text weekly-row__open" onClick={onEdit}>
        <span className={"task-row__title" + (full ? " is-done" : "")}>{task.title}</span>
        <span className="task-row__sub">
          {cat?.name ?? "Weekly"}
          <span aria-hidden> · </span>
          {task.times === 1 ? "weekly" : `${n} of ${task.times} this week`}
          {task.times > 1 && <WeekDots done={n} of={task.times} />}
        </span>
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={doneToday}
        aria-label={`${task.title}, done today`}
        disabled={pending}
        onClick={() => void run(() => tracker.toggleWeeklyTask(task.id, today))}
        className={"check" + (doneToday ? " check--on" : "")}
      >
        <span className="check__ring">{doneToday && <Check className="h-4 w-4" aria-hidden />}</span>
      </button>
    </li>
  );
}

/** Add a weekly task, or edit one: a title, its category and times a week. */
export function WeeklyTaskSheet({ tracker, task, open, onClose }: { tracker: Tracker; task?: WeeklyTask; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={task ? "Weekly task" : "New weekly task"}>
      {open && <WeeklyTaskForm key={task?.id ?? "new"} tracker={tracker} task={task} onDone={onClose} />}
    </Modal>
  );
}

export function WeeklyTaskForm({ tracker, task, onDone }: { tracker: Tracker; task?: WeeklyTask; onDone: () => void }) {
  const s = tracker.state!;
  const { pending, run } = usePending();
  const [title, setTitle] = useState(task?.title ?? "");
  const [catId, setCatId] = useState(task?.catId ?? s.categories[0]?.id ?? "");
  const [times, setTimes] = useState(task?.times ?? 1);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !catId) return;
    void run(async () => {
      const ok = task ? await tracker.updateWeeklyTask(task.id, { title, catId, times }) : await tracker.addWeeklyTask(title, catId, times);
      if (ok) onDone();
      return ok;
    });
  };
  return (
    <form onSubmit={submit} className="weekly-form">
      <Input aria-label="Title" placeholder="Watch one conference talk" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!task} />
      <div>
        <p className="weekly-form__label">Category, its icon on the plan</p>
        <div className="weekly-form__cats" role="radiogroup" aria-label="Category">
          {s.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === catId}
              className="weekly-cat"
              onClick={() => setCatId(c.id)}
            >
              <PlanGlyph icon={categoryIcon(c)} />
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="weekly-form__times">
        <span>
          <span className="weekly-form__times-title">Times a week</span>
          <span className="weekly-form__label">Ticked once a day, at most</span>
        </span>
        <span className="weekly-form__count font-mono-n">{times}</span>
        <span className="set-stepper">
          <button type="button" aria-label="Fewer" disabled={times <= 1} onClick={() => setTimes((t) => Math.max(1, t - 1))}>
            <Minus aria-hidden />
          </button>
          <button type="button" aria-label="More" disabled={times >= 7} onClick={() => setTimes((t) => Math.min(7, t + 1))}>
            <Plus aria-hidden />
          </button>
        </span>
      </div>
      <button type="submit" className="pill-link pill-link--primary weekly-form__save" disabled={pending || !title.trim() || !catId}>
        {task ? "Save" : "Add weekly task"}
      </button>
      {task && (
        <button
          type="button"
          className="text-action weekly-form__delete"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete "${task.title}"?`)) void run(async () => { const ok = await tracker.deleteWeeklyTask(task.id); if (ok) onDone(); return ok; });
          }}
        >
          Delete weekly task
        </button>
      )}
    </form>
  );
}
