"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { Pencil, Plus } from "lucide-react";
import { DeleteButton } from "./DeleteButton";
import { Modal } from "./Modal";
import { ActionButton, usePending } from "./ActionButton";
import { Tracker, Frequency, FREQUENCIES, FREQ_LABEL, FREQ_ORDER, RecurringTask, caloriesLeftThisWeek } from "@/lib/tracker";

function GroupPicker({
  tracker,
  groupId,
  setGroupId,
}: {
  tracker: Tracker;
  groupId: string;
  setGroupId: (id: string) => void;
}) {
  const s = tracker.state!;
  return (
    <div>
      <div className="mb-1.5 text-xs text-foreground/50">
        Group (optional) — doing one task in a group covers the rest
      </div>
      <select
        aria-label="Group"
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="h-11 w-full px-3 text-base"
      >
        <option value="">No group</option>
        {s.recurringGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      {s.recurringGroups.length === 0 && (
        <p className="mt-1.5 text-xs text-foreground/45">
          Create groups in the Groups section below.
        </p>
      )}
    </div>
  );
}

function CatPicker({
  tracker,
  catId,
  setCatId,
}: {
  tracker: Tracker;
  catId: string;
  setCatId: (id: string) => void;
}) {
  const s = tracker.state!;
  return (
    <div>
      <div className="mb-1.5 text-xs text-foreground/50">Category</div>
      <div className="flex flex-wrap gap-2">
        {s.categories.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant="outline"
            className={catId === c.id ? "pill-selected" : ""}
            onPress={() => setCatId(c.id)}
          >
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
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    const ok = await run(() =>
      tracker.addGoal(
        t,
        catId || s.categories[0]?.id,
        current === "" ? null : Number(current),
        target === "" ? null : Number(target)
      )
    );
    if (ok) onDone(); // close only when the database confirmed the write
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
      <Button type="submit" variant="primary" className={"mt-1 " + (pending ? "is-pending" : "")} isDisabled={pending}>
        Add goal
      </Button>
    </form>
  );
}

export function RecurringForm({ tracker, onDone }: { tracker: Tracker; onDone: () => void }) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState(s.categories[0]?.id ?? "");
  const [freq, setFreq] = useState<Frequency>("daily");
  const [groupId, setGroupId] = useState("");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    const ok = await run(() => tracker.addRecurring(t, catId || s.categories[0]?.id, freq, groupId));
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input aria-label="Task title" placeholder="e.g. Morning workout" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <CatPicker tracker={tracker} catId={catId} setCatId={setCatId} />
      <div>
        <div className="mb-1.5 text-xs text-foreground/50">Frequency</div>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <Button
              key={f}
              size="sm"
              variant="outline"
              className={freq === f ? "pill-selected" : ""}
              onPress={() => setFreq(f)}
            >
              {FREQ_LABEL[f]}
            </Button>
          ))}
        </div>
      </div>
      <GroupPicker tracker={tracker} groupId={groupId} setGroupId={setGroupId} />

      <Button type="submit" variant="primary" className={"mt-1 " + (pending ? "is-pending" : "")} isDisabled={pending}>
        Add recurring task
      </Button>
    </form>
  );
}

export function RecurringEditForm({
  tracker,
  task,
  onDone,
}: {
  tracker: Tracker;
  task: RecurringTask;
  onDone: () => void;
}) {
  const s = tracker.state!;
  const [title, setTitle] = useState(task.title);
  const [catId, setCatId] = useState(task.catId);
  const [freq, setFreq] = useState<Frequency>(task.freq);
  const [groupId, setGroupId] = useState(task.groupId ?? "");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    const ok = await run(() =>
      tracker.updateRecurring(task.id, { title: t, catId, freq, groupId })
    );
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input aria-label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <CatPicker tracker={tracker} catId={catId} setCatId={setCatId} />
      <div>
        <div className="mb-1.5 text-xs text-foreground/50">Frequency</div>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <Button
              key={f}
              size="sm"
              variant="outline"
              className={freq === f ? "pill-selected" : ""}
              onPress={() => setFreq(f)}
            >
              {FREQ_LABEL[f]}
            </Button>
          ))}
        </div>
      </div>
      <GroupPicker tracker={tracker} groupId={groupId} setGroupId={setGroupId} />

      <div className="mt-1 flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          className={"flex-1 " + (pending ? "is-pending" : "")}
          isDisabled={pending}
        >
          Save changes
        </Button>
        <DeleteButton
          what={`the recurring task "${task.title}"`}
          onDelete={async () => {
            const ok = await tracker.deleteRecurring(task.id);
            if (ok) onDone();
            return ok;
          }}
        />
      </div>
    </form>
  );
}

export function CategoriesCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [newCat, setNewCat] = useState("");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = newCat.trim();
    if (!n || pending) return;
    const ok = await run(() => tracker.addCategory(n));
    if (ok) setNewCat("");
  };

  return (
    <div>
      <ul
        className={
          "list-none divide-y divide-foreground/10 p-0 " +
          (s.categories.length > 5 ? "max-h-[250px] overflow-y-auto pr-1 recurring-scroll" : "")
        }
      >
        {s.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
            <span className="flex-1 truncate text-[15px]">{c.name}</span>
            <DeleteButton
              what={`the category "${c.name}"`}
              iconOnly
              onDelete={async () => {
                if (tracker.categoryInUse(c.id)) {
                  alert("This category is in use. Remove or reassign its items first.");
                  return false;
                }
                return tracker.deleteCategory(c.id);
              }}
            />
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input aria-label="New category name" placeholder="New category…" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="flex-1" />
        <Button
          type="submit"
          variant="primary"
          isIconOnly
          aria-label="Add"
          className={pending ? "is-pending" : ""}
          isDisabled={pending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

export function GroupsCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [newGroup, setNewGroup] = useState("");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = newGroup.trim();
    if (!n || pending) return;
    const ok = await run(() => tracker.addGroup(n));
    if (ok) setNewGroup("");
  };

  return (
    <div>
      {s.recurringGroups.length === 0 ? (
        <p className="py-1 text-[15px] text-foreground/60">
          No groups yet. Tasks in a group cover each other — e.g. Legs / Push / Pull day.
        </p>
      ) : (
        <ul
          className={
            "list-none divide-y divide-foreground/10 p-0 " +
            (s.recurringGroups.length > 5 ? "max-h-[250px] overflow-y-auto pr-1 recurring-scroll" : "")
          }
        >
          {s.recurringGroups.map((g) => {
            const count = s.recurring.filter((r) => r.groupId === g.id).length;
            return (
              <li key={g.id} className="flex items-center gap-2 py-2">
                <span className="flex-1 truncate text-[15px]">{g.name}</span>
                <span className="font-mono-n shrink-0 text-xs text-foreground/50">
                  {count} task{count === 1 ? "" : "s"}
                </span>
                <DeleteButton
                  what={`the group "${g.name}"`}
                  iconOnly
                  onDelete={async () => {
                    if (tracker.groupInUse(g.id)) {
                      alert("This group is in use. Move its tasks out of the group first.");
                      return false;
                    }
                    return tracker.deleteGroup(g.id);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input aria-label="New group name" placeholder="New group…" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className="flex-1" />
        <Button
          type="submit"
          variant="primary"
          isIconOnly
          aria-label="Add"
          className={pending ? "is-pending" : ""}
          isDisabled={pending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

export function RecurringManageCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [editTask, setEditTask] = useState<RecurringTask | null>(null);
  const groupName = (id?: string) => s.recurringGroups.find((g) => g.id === id)?.name ?? "";

  const tasks = [...s.recurring].sort(
    (a, b) =>
      FREQ_ORDER[a.freq] - FREQ_ORDER[b.freq] ||
      groupName(a.groupId).localeCompare(groupName(b.groupId)) ||
      a.title.localeCompare(b.title)
  );

  return (
    <div>
      {tasks.length === 0 ? (
        <p className="py-1 text-[15px] text-foreground/60">No recurring tasks yet.</p>
      ) : (
        <ul
          className={
            "list-none divide-y divide-foreground/10 p-0 " +
            (tasks.length > 5 ? "max-h-[290px] overflow-y-auto pr-1 recurring-scroll" : "")
          }
        >
          {tasks.map((r) => {
            const c = tracker.cat(r.catId);
            return (
              <li key={r.id} className="flex items-center gap-2 py-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{r.title}</span>
                  <span className="block text-[11px] text-foreground/50">
                    {c.name} · {FREQ_LABEL[r.freq]}
                    {r.groupId ? ` · ${groupName(r.groupId)}` : ""}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  aria-label={`Edit ${r.title}`}
                  onPress={() => setEditTask(r)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <DeleteButton
                  what={`the recurring task "${r.title}"`}
                  iconOnly
                  onDelete={() => tracker.deleteRecurring(r.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!editTask} onClose={() => setEditTask(null)} title="Edit recurring task">
        {editTask && (
          <RecurringEditForm tracker={tracker} task={editTask} onDone={() => setEditTask(null)} />
        )}
      </Modal>
    </div>
  );
}

/**
 * Daily targets for protein and fibre. Both are optional — leaving a field
 * empty clears that target, and the tracker simply stops showing its meter.
 */
export function MacroTargetsCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [editing, setEditing] = useState(false);
  const [protein, setProtein] = useState(String(s.proteinTarget ?? ""));
  const [fiber, setFiber] = useState(String(s.fiberTarget ?? ""));
  const { pending, run } = usePending();

  const startEditing = () => {
    setProtein(String(s.proteinTarget ?? ""));
    setFiber(String(s.fiberTarget ?? ""));
    setEditing(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const p = protein.trim() === "" ? null : Number(protein);
    const f = fiber.trim() === "" ? null : Number(fiber);
    const ok = await run(async () => {
      await tracker.setProteinTarget(p);
      await tracker.setFiberTarget(f);
    });
    if (ok) setEditing(false);
  };

  if (!editing) {
    const none = !s.proteinTarget && !s.fiberTarget;
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {none ? (
            <p className="text-[15px] text-foreground/60">No daily targets set.</p>
          ) : (
            <div className="flex gap-6">
              <div>
                <div className="font-mono-n text-2xl font-bold leading-none">
                  {s.proteinTarget ?? "–"}
                  <span className="ml-1 text-sm font-medium text-foreground/60">g</span>
                </div>
                <div className="mt-1.5 text-[13px] text-foreground/60">protein / day</div>
              </div>
              <div>
                <div className="font-mono-n text-2xl font-bold leading-none">
                  {s.fiberTarget ?? "–"}
                  <span className="ml-1 text-sm font-medium text-foreground/60">g</span>
                </div>
                <div className="mt-1.5 text-[13px] text-foreground/60">fibre / day</div>
              </div>
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label={none ? "Set protein and fibre targets" : "Edit protein and fibre targets"}
          onPress={startEditing}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="flex gap-3">
        <label className="block flex-1 text-[11px] text-foreground/60">
          Protein / day (g)
          <Input
            type="number"
            aria-label="Daily protein target in grams"
            placeholder="e.g. 140"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="mt-0.5 w-full"
            autoFocus
          />
        </label>
        <label className="block flex-1 text-[11px] text-foreground/60">
          Fibre / day (g)
          <Input
            type="number"
            aria-label="Daily fibre target in grams"
            placeholder="e.g. 30"
            value={fiber}
            onChange={(e) => setFiber(e.target.value)}
            className="mt-0.5 w-full"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          className={"flex-1 " + (pending ? "is-pending" : "")}
          isDisabled={pending}
        >
          Save
        </Button>
        <Button variant="secondary" className="btn-invert" isDisabled={pending} onPress={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CalorieBudgetCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(s.calorieBudget ?? ""));
  const { pending, run } = usePending();

  const budget = s.calorieBudget;
  const left = caloriesLeftThisWeek(s.calories, budget);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const n = value.trim() === "" ? null : Number(value);
    const ok = await run(() => tracker.setCalorieBudget(n));
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {budget ? (
              <>
                <div className="font-mono-n text-2xl font-bold leading-none">
                  {budget}
                  <span className="ml-1 text-sm font-medium text-foreground/60">kcal / day</span>
                </div>
                <div className="mt-1.5 text-[13px] text-foreground/60">
                  {budget * 7} kcal per week
                </div>
              </>
            ) : (
              <p className="text-[15px] text-foreground/60">No daily budget set.</p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            aria-label={budget ? "Edit calorie budget" : "Set calorie budget"}
            onPress={() => {
              setValue(String(budget ?? ""));
              setEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        {left != null && (
          <div className="mt-3 border-t border-foreground/10 pt-3 text-[13px] text-foreground/60">
            <span className="font-mono-n font-semibold text-foreground">{left}</span> kcal left this
            week
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="block text-[11px] text-foreground/60">
        Daily budget
        <Input
          type="number"
          aria-label="Daily calorie budget"
          placeholder="e.g. 1800"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-0.5 w-full"
          autoFocus
        />
      </label>
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          className={"flex-1 " + (pending ? "is-pending" : "")}
          isDisabled={pending}
        >
          Save
        </Button>
        <Button
          variant="secondary"
          className="btn-invert"
          isDisabled={pending}
          onPress={() => {
            setValue(String(budget ?? ""));
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-foreground/50">
        Leave empty to remove the budget. The top bar shows what&apos;s left for the week.
      </p>
    </form>
  );
}
