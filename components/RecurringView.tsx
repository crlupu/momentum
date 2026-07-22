"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Chip, Input } from "@heroui/react";
import { Repeat, X } from "lucide-react";
import {
  Tracker,
  Frequency,
  FREQUENCIES,
  FREQ_LABEL,
  FREQ_ORDER,
  dateKey,
  streak,
} from "@/lib/tracker";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-foreground/[0.04] px-3 py-2.5">
      <div className="font-mono-n text-2xl font-semibold" style={{ color: "#F5A524" }}>
        {value}
      </div>
      <div className="text-xs text-foreground/60">{label}</div>
    </div>
  );
}

export default function RecurringView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState(s.categories[0]?.id ?? "");
  const [freq, setFreq] = useState<Frequency>("daily");
  const [newCat, setNewCat] = useState("");

  const today = dateKey();
  const doneToday = s.board.filter((b) => b.status === "done" && b.doneDate === today).length;

  const recurring = [...s.recurring].sort((a, b) => FREQ_ORDER[a.freq] - FREQ_ORDER[b.freq]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    tracker.addRecurring(t, catId || s.categories[0]?.id, freq);
    setTitle("");
  };

  const submitCat = (e: FormEvent) => {
    e.preventDefault();
    const n = newCat.trim();
    if (!n) return;
    tracker.addCategory(n);
    setNewCat("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <Card.Content className="p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2.5">
            <Stat value={doneToday} label="done today" />
            <Stat value={streak(s.board)} label="day streak" />
            <Stat value={s.recurring.length} label="recurring" />
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-1 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            New recurring task
          </h2>
          <p className="mb-3 text-xs text-foreground/50">
            Added to the board under Planned, and re-added on its schedule.
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input
              aria-label="Task title"
              placeholder="What should recur?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div>
              <div className="mb-1.5 text-xs text-foreground/50">Category</div>
              <div className="flex flex-wrap gap-2">
                {s.categories.map((c) => (
                  <Button
                    key={c.id}
                    size="md"
                    variant={catId === c.id ? "primary" : "outline"}
                    onPress={() => setCatId(c.id)}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    {c.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs text-foreground/50">Frequency</div>
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <Button
                    key={f}
                    size="md"
                    variant={freq === f ? "primary" : "outline"}
                    onPress={() => setFreq(f)}
                  >
                    {FREQ_LABEL[f]}
                  </Button>
                ))}
              </div>
            </div>

            <Button type="submit" variant="primary" className="mt-1 self-start">
              Add recurring task
            </Button>
          </form>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Your recurring tasks
          </h2>
          {recurring.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">None yet.</p>
          ) : (
            <ul className="list-none p-0">
              {recurring.map((r) => {
                const c = tracker.cat(r.catId);
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 border-b border-foreground/10 px-1 py-3 last:border-b-0"
                  >
                    <Repeat className="h-4 w-4 shrink-0 text-foreground/40" aria-hidden />
                    <span className="flex-1 text-[15px]">{r.title}</span>
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    <span className="text-xs text-foreground/60">{FREQ_LABEL[r.freq]}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label={`Delete recurring task ${r.title}`}
                      onPress={() => tracker.deleteRecurring(r.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-4 sm:p-5">
          <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Categories
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {s.categories.map((c) => (
              <Chip key={c.id} size="sm" variant="soft">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden
                />
                <Chip.Label className="ml-1.5">{c.name}</Chip.Label>
                <button
                  aria-label={`Delete category ${c.name}`}
                  className="ml-1 text-foreground/50 hover:text-foreground"
                  onClick={() => {
                    if (!tracker.deleteCategory(c.id))
                      alert("This category is in use. Remove or reassign its items first.");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Chip>
            ))}
          </div>
          <form onSubmit={submitCat} className="mt-3 flex gap-2">
            <Input
              aria-label="New category name"
              placeholder="New category…"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary">
              Add category
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
