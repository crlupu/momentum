"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Input, PanelHeader, AddButton } from "./ui";
import { Check } from "./icons";
import { usePending } from "./ActionButton";
import { Tracker } from "@/lib/tracker";

function TodoCheckbox({ tracker, id, done, label }: { tracker: Tracker; id: string; done: boolean; label: string }) {
  const { pending, run } = usePending();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={pending}
      onClick={() => void run(() => tracker.toggleTodo(id))}
      className={"check" + (done ? " check--on" : "")}
    >
      <span className="check__ring">
        {done && <Check className="h-4 w-4" aria-hidden />}
      </span>
    </button>
  );
}

export default function TodoList({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const { pending, run } = usePending();

  // Finished items move to the log, so this stays a list of what's left.
  const open = [...s.todos]
    .filter((t) => !t.done)
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    const ok = await run(() => tracker.addTodo(t));
    if (ok) setTitle("");
  };

  return (
    <div id="todo" className="scroll-mt-20">
      <PanelHeader title="To do" color="var(--sec-todos)" />

      <Card>
        <Card.Content className="px-3 py-3 md:px-4">
          <form onSubmit={submit} className="mb-3 flex gap-2">
            <Input
              aria-label="New to-do"
              placeholder="Add a to-do…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
            <AddButton type="submit" aria-label="Add to-do" isDisabled={pending} />
          </form>

          {open.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-[var(--muted)]">Nothing to do. Add a to-do above.</p>
          ) : (
            <ul
              className={
                "list-none p-0 " +
                (open.length > 5 ? "max-h-[17rem] overflow-y-auto pr-1 recurring-scroll" : "")
              }
            >
              {open.map((t) => (
                <li key={t.id} className="task-row">
                  <TodoCheckbox tracker={tracker} id={t.id} done={t.done} label={t.title} />
                  <span className="task-row__title">{t.title}</span>
                </li>
              ))}
            </ul>
          )}

        </Card.Content>
      </Card>
    </div>
  );
}
