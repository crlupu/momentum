"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button, Input, AddButton } from "./ui";
import { Check, X, Palette } from "./icons";
import { RowActions } from "./RowActions";
import { DialogActions } from "./DialogActions";
import { useConfigEditing, useSetConfigEditing } from "./ConfigCard";
import { usePending } from "./ActionButton";
import { MenuSelect } from "./Menu";
import { readableText } from "@/lib/color";
import { Tracker, caloriesLeftThisWeek, CAT_COLORS, nextCategoryColor } from "@/lib/tracker";

export function CatPicker({
  tracker,
  catId,
  setCatId }: {
  tracker: Tracker;
  catId: string;
  setCatId: (id: string) => void;
}) {
  const s = tracker.state!;
  return (
    <div>
      <div className="mb-1.5 text-xs text-[var(--muted)]">Category</div>
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

/**
 * A new goal: a course, a project, anything tracked to completion. Starts in
 * a topic when opened from one; the count is optional, since most goals are
 * measured by their steps instead.
 */
export function GoalForm({
  tracker,
  onDone,
  pathId = null,
}: {
  tracker: Tracker;
  onDone: () => void;
  /** The topic to start in, when added from one. */
  pathId?: string | null;
}) {
  const s = tracker.state!;
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState(s.categories[0]?.id ?? "");
  // The path it starts in: the one it was added from, or General.
  const [topic, setTopic] = useState(pathId ?? "");
  const [note, setNote] = useState("");
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
        null,
        null,
        topic || null,
        note
      )
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input aria-label="Goal name" placeholder="e.g. Kubernetes course" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <label className="text-xs text-[var(--muted)]">
        Description
        <textarea
          aria-label="Description"
          rows={3}
          placeholder="Details: what it covers, why, where you left off… (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full text-base text-foreground"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
        Path
        <MenuSelect
          label="Path"
          className="menu-select--field"
          value={topic}
          onChange={setTopic}
          options={[
            ...s.paths.map((p) => ({ value: p.id, label: p.title })),
            { value: "", label: "General" },
          ]}
        />
      </label>
      <CatPicker tracker={tracker} catId={catId} setCatId={setCatId} />
      <DialogActions primary={{ label: "Add", disabled: pending }} />
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
                  <RowActions
                    name={c.name}
                    onEdit={() => {
                      setEditId(c.id);
                      setEditName(c.name);
                      setEditColor(c.color);
                    }}
                    del={{ what: `the category "${c.name}"`, onDelete: async () => {
                      if (tracker.categoryInUse(c.id)) {
                        alert("This category is in use. Remove or reassign its items first.");
                        return false;
                      }
                      return tracker.deleteCategory(c.id);
                    } }}
                  />
                </span>
              )}
            </li>
          )
        )}
      </ul>
      {editing && (
      <form onSubmit={submit} className="cfg-add">
        <Input aria-label="New category name" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="min-w-0 flex-1" />
        <ColorPicker value={newColor} onChange={setNewColor} />
        <AddButton type="submit" aria-label="Add" isDisabled={pending} />
      </form>
      )}
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
    if (!s.proteinTarget && !s.fiberTarget) return <p className="text-[15px] text-[var(--muted)]">No daily targets set.</p>;
    return (
      <ValueRows
        rows={[
          ["Protein", s.proteinTarget ? `${s.proteinTarget} g a day` : "None"],
          ["Fibre", s.fiberTarget ? `${s.fiberTarget} g a day` : "None"],
        ]}
      />
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="flex gap-3">
        <label className="block flex-1 text-[11px] text-[var(--muted)]">
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
        <label className="block flex-1 text-[11px] text-[var(--muted)]">
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
        <ul className={(editing ? "mb-3 " : "") + "list-none divide-y divide-foreground/10 p-0"}>
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
                    <RowActions
                    name={m.name}
                    onEdit={() => {
                        setEditId(m.id);
                        setEditName(m.name);
                        setEditColor(m.color);
                      }}
                    del={{ what: `the meal tag "${m.name}"`, onDelete: () => tracker.removeMealTag(m.id) }}
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
          placeholder="Breakfast"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1"
        />
        <ColorPicker value={color} onChange={setColor} />
        <AddButton type="submit" aria-label="Add meal tag" isDisabled={pending} />
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
        style={{ background: value }}
      >
        <Palette className="h-4 w-4" style={{ color: readableText(value) }} aria-hidden />
      </button>

      {open && (
        // Right-aligned: the swatch sits near the right edge of a narrow card,
        // and a left-aligned panel would hang off it.
        <div
          className="absolute right-0 top-full z-50 mt-2 w-max rounded-[var(--r-card)] p-2.5"
          style={{ background: "var(--overlay)", boxShadow: "var(--lift-shadow)" }}
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
    if (!budget) return <p className="text-[15px] text-[var(--muted)]">No daily budget set.</p>;
    return (
      <ValueRows
        rows={[
          ["Daily budget", `${budget.toLocaleString()} kcal`],
          ["Per week", `${(budget * 7).toLocaleString()} kcal`],
          ...(left != null ? ([["Left this week", `${left.toLocaleString()} kcal`]] as [string, string][]) : []),
        ]}
      />
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="block text-[11px] text-[var(--muted)]">
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
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Leave empty to remove the budget. The top bar shows what&apos;s left for the week.
      </p>
    </form>
  );
}

/** Settings as iOS lists them: a name, and its value on the right. */
function ValueRows({ rows }: { rows: [string, string][] }) {
  return (
    <ul className="value-rows">
      {rows.map(([k, v]) => (
        <li key={k}>
          <span>{k}</span>
          <span className="value-rows__v font-mono-n">{v}</span>
        </li>
      ))}
    </ul>
  );
}
