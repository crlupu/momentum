"use client";

import { FormEvent, useState } from "react";
import { Button, Chip, Input } from "@heroui/react";
import { X } from "lucide-react";
import { Tracker, Frequency, FREQUENCIES, FREQ_LABEL } from "@/lib/tracker";

function CatPicker({ tracker, catId, setCatId }: { tracker: Tracker; catId: string; setCatId: (id: string) => void }) {
  const s = tracker.state!;
  return (
    <div>
      <div className="mb-1.5 text-xs text-foreground/50">Category</div>
      <div className="flex flex-wrap gap-2">
        {s.categories.map((c) => (
          <Button key={c.id} size="sm" variant={catId === c.id ? "primary" : "outline"} onPress={() => setCatId(c.id)}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
            {c.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function GoalForm({ tracker, onDone }: { tracker: Tracker; onDone: () => void }) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState(s.categories[0]?.id ?? "");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    tracker.addGoal(t, catId || s.categories[0]?.id, current === "" ? null : Number(current), target === "" ? null : Number(target));
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input aria-label="Goal title" placeholder="e.g. Read Atomic Habits" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <CatPicker tracker={tracker} catId={catId} setCatId={setCatId} />
      <div className="flex gap-3">
        <label className="flex-1 text-xs text-foreground/50">
          Current
          <Input type="number" aria-label="Current value" placeholder="132" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-0.5" />
        </label>
        <label className="flex-1 text-xs text-foreground/50">
          Target
          <Input type="number" aria-label="Target value" placeholder="396" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-0.5" />
        </label>
      </div>
      <Button type="submit" variant="primary" className="mt-1">Add goal</Button>
    </form>
  );
}

export function RecurringForm({ tracker, onDone }: { tracker: Tracker; onDone: () => void }) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState(s.categories[0]?.id ?? "");
  const [freq, setFreq] = useState<Frequency>("daily");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    tracker.addRecurring(t, catId || s.categories[0]?.id, freq);
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input aria-label="Task title" placeholder="e.g. Morning workout" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <CatPicker tracker={tracker} catId={catId} setCatId={setCatId} />
      <div>
        <div className="mb-1.5 text-xs text-foreground/50">Frequency</div>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <Button key={f} size="sm" variant={freq === f ? "primary" : "outline"} onPress={() => setFreq(f)}>
              {FREQ_LABEL[f]}
            </Button>
          ))}
        </div>
      </div>
      <Button type="submit" variant="primary" className="mt-1">Add recurring task</Button>
    </form>
  );
}

export function CategoriesCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [newCat, setNewCat] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = newCat.trim();
    if (!n) return;
    tracker.addCategory(n);
    setNewCat("");
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {s.categories.map((c) => (
          <Chip key={c.id} size="sm" variant="soft">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
            <Chip.Label className="ml-1.5">{c.name}</Chip.Label>
            <button
              aria-label={`Delete category ${c.name}`}
              className="ml-1 text-foreground/50 hover:text-foreground"
              onClick={() => {
                if (!tracker.deleteCategory(c.id)) alert("This category is in use. Remove or reassign its items first.");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Chip>
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input aria-label="New category name" placeholder="New category…" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="flex-1" />
        <Button type="submit" variant="secondary">Add</Button>
      </form>
    </div>
  );
}
