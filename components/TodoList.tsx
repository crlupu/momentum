"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Input } from "./ui";
import { Check, Plus } from "lucide-react";
import { usePending } from "./ActionButton";
import { Tracker } from "@/lib/tracker";

function TodoCheckbox({ tracker, id, done }: { tracker: Tracker; id: string; done: boolean }) {
  const { pending, run } = usePending();
  return (
    <button
      aria-label={done ? "Mark not done" : "Mark done"}
      disabled={pending}
      onClick={() => void run(() => tracker.toggleTodo(id))}
      className="-m-2 flex shrink-0 items-center justify-center p-2"
    >
      <span
        className={
          "flex h-[17px] w-[17px] items-center justify-center border-2 transition-colors " +
          (done ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30 bg-transparent")
        }
      >
        {done && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
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
    <div>
      <h2 className="font-display mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
        <span className="sec-dot" style={{ background: "var(--sec-todos)" }} aria-hidden />
        To do
      </h2>

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
            <Button
              type="submit"
              variant="primary"
              isIconOnly
              aria-label="Add to-do"
              isDisabled={pending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          {open.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">Nothing to do — add something below.</p>
          ) : (
            <ul
              className={
                "list-none p-0 " +
                (open.length > 5 ? "max-h-[228px] overflow-y-auto pr-1 recurring-scroll" : "")
              }
            >
              {open.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 border-b border-foreground/10 px-1 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 break-words text-[15px]">{t.title}</span>
                  <TodoCheckbox tracker={tracker} id={t.id} done={t.done} />
                </li>
              ))}
            </ul>
          )}

        </Card.Content>
      </Card>
    </div>
  );
}
