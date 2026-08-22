"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button, Input } from "./ui";
import { Pencil, Plus, Check, X, Palette } from "./icons";
import { DeleteButton } from "./DeleteButton";
import { useConfigEditing, useSetConfigEditing } from "./ConfigCard";
import { Modal } from "./Modal";
import { ActionButton, usePending } from "./ActionButton";
import { readableText } from "@/lib/color";
import { Tracker, Frequency, FREQUENCIES, FREQ_LABEL, FREQ_ORDER, RecurringTask, caloriesLeftThisWeek, CAT_COLORS, nextCategoryColor } from "@/lib/tracker";

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
            <span className="inline-block h-2.5 w-2.5" style={{ background: c.color }} aria-hidden />
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
    // Closed on the press, not on the round trip. The write is applied
    // locally before it is sent, and Firestore does not resolve a write while
    // offline at all, so waiting on it left the dialog open indefinitely over
    // a goal that was already in the list.
    onDone();
    await run(() =>
      tracker.addGoal(
        t,
        catId || s.categories[0]?.id,
        current === "" ? null : Number(current),
        target === "" ? null : Number(target)
      )
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input aria-label="Goal title" placeholder="e.g. Read Atomic Habits" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <CatPicker tracker={tracker} catId={catId} setCatId={setCatId} />
      <div className="flex gap-3">
        <label className="flex-1 text-xs text-foreground/50">
          Current
          <Input type="number" step="any" inputMode="decimal" aria-label="Current value" placeholder="132" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-0.5" />
        </label>
        <label className="flex-1 text-xs text-foreground/50">
          Target
          <Input type="number" step="any" inputMode="decimal" aria-label="Target value" placeholder="396" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-0.5" />
        </label>
      </div>
      <Button type="submit" variant="primary" className="mt-1" isDisabled={pending}>
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
    onDone();
    await run(() => tracker.addRecurring(t, catId || s.categories[0]?.id, freq, groupId));
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

      <Button type="submit" variant="primary" className="mt-1" isDisabled={pending}>
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
    onDone();
    await run(() => tracker.updateRecurring(task.id, { title: t, catId, freq, groupId }));
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
          className="flex-1"
          isDisabled={pending}
        >
          Save changes
        </Button>
        <DeleteButton
          what={`the recurring task "${task.title}"`}
          onDelete={async () => {
            onDone();
            return tracker.deleteRecurring(task.id);
          }}
        />
      </div>
    </form>
  );
}

export function CategoriesCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const editing = useConfigEditing();
  const [newCat, setNewCat] = useState("");
  // Which category is being renamed, and the name being typed for it.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(CAT_COLORS[0]);
  // The colour a new category will be given. Starts on the next unused preset,
  // which is what it would have been assigned anyway.
  const [newColor, setNewColor] = useState(() => nextCategoryColor(s.categories));
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = newCat.trim();
    if (!n || pending) return;
    // Cleared on the press, not on the network, and put back if refused.
    setNewCat("");
    const ok = await run(() => tracker.addCategory(n, newColor));
    if (ok === false) setNewCat(n);
    else setNewColor(nextCategoryColor([...s.categories, { color: newColor }]));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !editId || !editName.trim()) return;
    // Closed on the press. The row keeps what was typed, so a refused write
    // reopens the editor with the draft intact.
    const id = editId;
    setEditId(null);
    const ok = await run(() => tracker.updateCategory(id, editName, editColor));
    if (ok === false) setEditId(id);
  };

  return (
    <div>
      <ul
        className={
          "list-none divide-y divide-foreground/10 p-0 " +
          (s.categories.length > 5 ? "max-h-[250px] overflow-y-auto pr-1 recurring-scroll" : "")
        }
      >
        {s.categories.map((c) =>
          editId === c.id ? (
            <li key={c.id} className="py-2">
              <form onSubmit={save} className="flex items-center gap-2">
                <Input
                  aria-label={`Rename ${c.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-0 flex-1"
                  autoFocus
                />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isIconOnly
                  aria-label="Save name"
                  isDisabled={pending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  aria-label="Cancel"
                  onPress={() => setEditId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            </li>
          ) : (
            <li key={c.id} className="cfg-row">
              <span className="cfg-dot" style={{ background: c.color }} aria-hidden />
              <span className="cfg-label">{c.name}</span>
              {editing && (
                <span className="cfg-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    isIconOnly
                    aria-label={`Edit ${c.name}`}
                    onPress={() => {
                      setEditId(c.id);
                      setEditName(c.name);
                      setEditColor(c.color);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
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
                </span>
              )}
            </li>
          )
        )}
      </ul>
      {editing && (
      <form onSubmit={submit} className="cfg-add">
        <Input aria-label="New category name" placeholder="New category…" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="min-w-0 flex-1" />
        <ColorPicker value={newColor} onChange={setNewColor} />
        <Button
          type="submit"
          variant="primary"
          isIconOnly
          aria-label="Add"
          isDisabled={pending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      )}
    </div>
  );
}

export function GroupsCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const editing = useConfigEditing();
  const [newGroup, setNewGroup] = useState("");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = newGroup.trim();
    if (!n || pending) return;
    setNewGroup("");
    const ok = await run(() => tracker.addGroup(n));
    if (ok === false) setNewGroup(n);
  };

  return (
    <div>
      {s.recurringGroups.length === 0 ? (
        <p className="cfg-empty">
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
              <li key={g.id} className="cfg-row">
                <span className="cfg-label">{g.name}</span>
                <span className="cfg-meta font-mono-n">
                  {count} task{count === 1 ? "" : "s"}
                </span>
                {editing && (
                <span className="cfg-actions">
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
                </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
      <form onSubmit={submit} className="cfg-add">
        <Input aria-label="New group name" placeholder="New group…" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className="min-w-[8rem] flex-1" />
        <Button
          type="submit"
          variant="primary"
          isIconOnly
          aria-label="Add"
          isDisabled={pending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      )}
    </div>
  );
}

export function RecurringManageCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const editing = useConfigEditing();
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
        <p className="cfg-empty">No recurring tasks yet.</p>
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
              <li key={r.id} className="cfg-row">
                <span className="cfg-dot" style={{ background: c.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{r.title}</span>
                  <span className="block text-[11px] text-foreground/50">
                    {c.name} · {FREQ_LABEL[r.freq]}
                    {r.groupId ? ` · ${groupName(r.groupId)}` : ""}
                  </span>
                </span>
                {editing && (
                  <span className="cfg-actions">
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
                  </span>
                )}
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
  const configuring = useConfigEditing();
  const setEditing = useSetConfigEditing();
  const [protein, setProtein] = useState(String(s.proteinTarget ?? ""));
  const [fiber, setFiber] = useState(String(s.fiberTarget ?? ""));
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const p = protein.trim() === "" ? null : Number(protein);
    const f = fiber.trim() === "" ? null : Number(fiber);
    setEditing(false);
    // Two writes, and the pair is only saved if both land. Reporting the
    // second's result alone would call a half-saved pair a success.
    const ok = await run(async () => {
      const a = await tracker.setProteinTarget(p);
      const b = await tracker.setFiberTarget(f);
      return a !== false && b !== false;
    });
    if (ok === false) setEditing(true);
    return ok;
  };

  if (!configuring) {
    const none = !s.proteinTarget && !s.fiberTarget;
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {none ? (
            <p className="text-[15px] text-foreground/60">No daily targets set.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="font-mono-n text-2xl font-bold leading-none">
                  {s.proteinTarget ?? "–"}
                  <span className="ml-1 text-sm font-medium text-foreground/60">g / day</span>
                </div>
                <div className="mt-1.5 text-[13px] text-foreground/60">protein</div>
              </div>
              <div>
                <div className="font-mono-n text-2xl font-bold leading-none">
                  {s.fiberTarget ?? "–"}
                  <span className="ml-1 text-sm font-medium text-foreground/60">g / day</span>
                </div>
                <div className="mt-1.5 text-[13px] text-foreground/60">fibre</div>
              </div>
            </div>
          )}
        </div>

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
          className="flex-1"
          isDisabled={pending}
        >
          Save targets
        </Button>
      </div>
    </form>
  );
}

/** Meal tags: the sections that make up each day's calorie bar. */
export function MealTagsCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const editing = useConfigEditing();
  const [name, setName] = useState("");
  const [color, setColor] = useState(CAT_COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(CAT_COLORS[0]);
  const { pending, run } = usePending();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !name.trim()) return;
    const n = name;
    setName("");
    const ok = await run(() => tracker.addMealTag(n, color));
    if (ok === false) setName(n);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !editId || !editName.trim()) return;
    // Closed on the press. Waiting for the write meant the row sat in its
    // editor with the button dead, looking as though Save had done nothing —
    // and offline, where a write is never acknowledged, it never closed at all.
    const id = editId;
    setEditId(null);
    const ok = await run(() => tracker.updateMealTag(id, editName, editColor));
    if (ok === false) setEditId(id);
  };

  return (
    <div>
      {s.mealTags.length === 0 ? (
        <p className="cfg-empty">No meal tags. Calorie entries are logged untagged.</p>
      ) : (
        <ul className="mb-3 list-none divide-y divide-foreground/10 p-0">
          {s.mealTags.map((m) =>
            editId === m.id ? (
              <li key={m.id} className="py-2">
                <form onSubmit={save} className="flex items-center gap-2">
                  <Input
                    aria-label="Tag name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-w-0 flex-1"
                    autoFocus
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <Button type="submit" size="sm" variant="primary" isIconOnly aria-label="Save tag" isDisabled={pending}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" isIconOnly aria-label="Cancel" onPress={() => setEditId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              </li>
            ) : (
              <li key={m.id} className="cfg-row">
                <span className="cfg-dot" style={{ background: m.color }} aria-hidden />
                <span className="cfg-label">{m.name}</span>
                {editing && (
                  <span className="cfg-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      isIconOnly
                      aria-label={`Edit ${m.name}`}
                      onPress={() => {
                        setEditId(m.id);
                        setEditName(m.name);
                        setEditColor(m.color);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <DeleteButton
                      what={`the meal tag "${m.name}"`}
                      iconOnly
                      onDelete={() => tracker.removeMealTag(m.id)}
                    />
                  </span>
                )}
              </li>
            )
          )}
        </ul>
      )}

      {editing && (
      <form onSubmit={add} className="cfg-add">
        <Input
          aria-label="New meal tag"
          placeholder="Breakfast…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1"
        />
        <ColorPicker value={color} onChange={setColor} />
        <Button
          type="submit"
          variant="primary"
          isIconOnly
          aria-label="Add meal tag"
          isDisabled={pending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      )}
    </div>
  );
}

/**
 * Colour choice, as a swatch that opens a palette.
 *
 * The grid used to sit on its own line, which pushed the name field and the
 * add button onto a line of their own and made a three-control row into two.
 * Behind a swatch it costs one slot, and the swatch doubles as the answer:
 * the button *is* the current colour, so the row shows the choice without
 * anything having to be opened.
 *
 * Presets only. A hex field would allow colours that vanish against the
 * background or collide with a category's, and these only ever need to be
 * told apart from each other.
 */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  // A popover has to be dismissable without choosing, or picking the wrong
  // colour would be the only way out of it.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <span className="relative shrink-0" ref={box}>
      <button
        type="button"
        aria-label="Choose colour"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="cfg-swatch-btn flex items-center justify-center"
        style={{ background: value, border: "1px solid var(--default)" }}
      >
        <Palette className="h-4 w-4" style={{ color: readableText(value) }} aria-hidden />
      </button>

      {open && (
        // Right-aligned: the swatch sits near the right edge of a narrow card,
        // and a left-aligned panel would hang off it.
        <div
          className="absolute right-0 top-full z-50 mt-1 w-max p-2 shadow-lg"
          style={{ background: "var(--surface-secondary)", border: "1px solid var(--default)" }}
        >
          <div className="grid grid-cols-5 gap-1.5">
            {CAT_COLORS.map((c) => {
              const selected = value === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use colour ${c}`}
                  aria-pressed={selected}
                  // Choosing is the whole errand, so it closes on the press
                  // rather than waiting to be dismissed.
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  className={"cfg-swatch" + (selected ? " cfg-swatch--on" : "")}
                  style={{ background: c }}
                >
                  {selected && (
                    <Check className="h-3.5 w-3.5" style={{ color: readableText(c) }} aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}

export function CalorieBudgetCard({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const configuring = useConfigEditing();
  const setEditing = useSetConfigEditing();
  const [value, setValue] = useState(String(s.calorieBudget ?? ""));
  const { pending, run } = usePending();

  const budget = s.calorieBudget;
  const left = caloriesLeftThisWeek(s.calories, budget);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const n = value.trim() === "" ? null : Number(value);
    // Saving is the end of the errand, so the form gives way to the figure it
    // just set rather than waiting for the gear to be pressed again. Closed on
    // the press, not on the network; the card stays mounted and keeps what was
    // typed, so a refused write can reopen it with the draft intact.
    setEditing(false);
    const ok = await run(() => tracker.setCalorieBudget(n));
    if (ok === false) setEditing(true);
    return ok;
  };

  if (!configuring) {
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
          className="flex-1"
          isDisabled={pending}
        >
          Save budget
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-foreground/50">
        Leave empty to remove the budget. The top bar shows what&apos;s left for the week.
      </p>
    </form>
  );
}
