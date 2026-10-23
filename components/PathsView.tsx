"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GoalRow } from "./GoalsView";
import { ProgressRing } from "./ProgressRing";
import { Modal } from "./Modal";
import { DialogActions } from "./DialogActions";
import { DeleteButton } from "./DeleteButton";
import { ActionMenu } from "./Menu";
import { ChevronRight, Plus, ReorderLines } from "./icons";
import { GoalForm } from "./Forms";
import { Tracker, goalPct, goalStatus, type Goal, type GoalStatus, type Path } from "@/lib/tracker";
import { GENERAL, PATH_COLORS, generalGoals, goalsOf, pathProgress } from "@/lib/paths";

const COLLAPSED_KEY = "momentum:paths-collapsed";

type Section = { id: string; title: string; color: string; path?: Path; all: Goal[]; shown: Goal[] };

/**
 * Learning as paths: a section per path, in the paths' order, then General,
 * where every goal in no path sits. A section's header folds it; its bar adds
 * up every item of every goal in it.
 *
 * With `editable`, Edit turns the list into iOS edit mode: every section
 * open, a handle on each goal to drag it within its path or into another,
 * a ⋯ on each path for renaming, moving and deleting it.
 */
export function PathsView({
  tracker,
  statuses,
  editable,
  onOpen,
  empty,
}: {
  tracker: Tracker;
  /** Which goals to show. The bars count every goal in the path. */
  statuses: GoalStatus[];
  editable?: boolean;
  onOpen: (id: string) => void;
  empty: string;
}) {
  const s = tracker.state!;
  const [editing, setEditing] = useState(false);
  const [pathForm, setPathForm] = useState<{ id: string | null } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  // Which paths are folded, per device. Only a convenience.
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(v)) setCollapsed(v.filter((x) => typeof x === "string"));
    } catch {}
  }, []);
  const toggle = (id: string) => {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {}
  };

  const show = (g: Goal) => statuses.includes(goalStatus(g));
  const sections: Section[] = [
    ...s.paths.map((p) => {
      const all = goalsOf(s, p);
      return { id: p.id, title: p.title, color: p.color ?? "var(--accent)", path: p, all, shown: all.filter(show) };
    }),
    (() => {
      const all = generalGoals(s);
      return { id: GENERAL, title: "General", color: "var(--accent)", all, shown: all.filter(show) };
    })(),
  ];
  // Browsing, a path with nothing to show here is left out; organizing, every path is there to drop into.
  const visible = editing ? sections : sections.filter((x) => x.shown.length > 0);
  const editingPath = pathForm?.id ? s.paths.find((p) => p.id === pathForm.id) : undefined;

  return (
    <div className="paths">
      {editable && (
        <div className="paths__bar">
          <button type="button" className="text-action" onClick={() => setPathForm({ id: null })}>
            <Plus aria-hidden /> New Path
          </button>
          <button
            type="button"
            className="text-action"
            aria-pressed={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      )}

      {editing ? (
        <>
          <p className="paths__hint">
            Drag a goal by its handle to reorder it, or into another path. Tap ⋯ to rename, move or delete a path;
            its goals go back to General.
          </p>
          <EditList tracker={tracker} sections={sections} onEditPath={(id) => setPathForm({ id })} />
        </>
      ) : visible.length === 0 ? (
        <p className="card goal-list__empty p-4">{empty}</p>
      ) : (
        visible.map((sec) => {
          const open = !collapsed.includes(sec.id);
          const prog = pathProgress(sec.all);
          return (
            <section key={sec.id} className="path">
              <div className="path__headrow">
                <button
                  type="button"
                  className="path__head"
                  aria-expanded={open}
                  onClick={() => toggle(sec.id)}
                >
                  <span className="path__title">{sec.title}</span>
                  <span className="path__pct font-mono-n">{prog.pct}%</span>
                  <ChevronRight className={"path__chev" + (open ? " is-open" : "")} aria-hidden />
                </button>
                {editable && (
                  <button
                    type="button"
                    className="text-action text-action--sm path__add"
                    aria-label={`Add a goal to ${sec.title}`}
                    onClick={() => setAddingTo(sec.id)}
                  >
                    <Plus aria-hidden />
                  </button>
                )}
              </div>
              <div className="card path__card">
                <div className="path__summary">
                  <div className="progress-track h-1">
                    <div className="progress-fill" style={{ width: `${prog.pct}%`, background: sec.color }} />
                  </div>
                  <span className="path__figure">
                    {prog.done} of {prog.total} items · {sec.all.filter((g) => goalStatus(g) !== "dropped").length}{" "}
                    {sec.all.length === 1 ? "goal" : "goals"}
                  </span>
                </div>
                {open && (
                  <ul className="goal-list__rows">
                    {sec.shown.map((g) => (
                      <GoalRow key={g.id} tracker={tracker} goal={g} onOpen={onOpen} inTopic color={sec.color} />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })
      )}

      <Modal open={!!addingTo} onClose={() => setAddingTo(null)} title="New Goal">
        {addingTo && (
          <GoalForm
            key={addingTo}
            tracker={tracker}
            pathId={addingTo === GENERAL ? null : addingTo}
            onDone={() => setAddingTo(null)}
          />
        )}
      </Modal>
      <Modal open={!!pathForm} onClose={() => setPathForm(null)} title={editingPath ? "Edit Path" : "New Path"}>
        {pathForm && (
          <PathForm key={pathForm.id ?? "new"} tracker={tracker} path={editingPath} onDone={() => setPathForm(null)} />
        )}
      </Modal>
    </div>
  );
}

/**
 * Every path open, as one list a goal can be dragged through: each path's
 * header is a fixed row in it, so where a goal is dropped, under which
 * header, is the path it joins.
 */
function EditList({
  tracker,
  sections,
  onEditPath,
}: {
  tracker: Tracker;
  sections: Section[];
  onEditPath: (id: string) => void;
}) {
  const s = tracker.state!;
  // Touch waits a moment before lifting a row, so scrolling past a handle doesn't pick it up.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  // Done goals are in History; they keep their path but aren't dragged here.
  const rows: string[] = sections.flatMap((sec) => [
    `h:${sec.id}`,
    ...sec.all.filter((g) => goalStatus(g) !== "done").map((g) => g.id),
  ]);
  const byId = new Map(s.goals.map((g) => [g.id, g]));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = rows.indexOf(String(active.id));
    let to = rows.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    // Nothing goes above the first header.
    if (to === 0) to = 1;
    const next = arrayMove(rows, from, to);
    const layout: { pathId: string; goalIds: string[] }[] = [];
    for (const id of next) {
      if (id.startsWith("h:")) layout.push({ pathId: id.slice(2), goalIds: [] });
      else layout[layout.length - 1]?.goalIds.push(id);
    }
    void tracker.arrangeLearning(layout);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={rows} strategy={verticalListSortingStrategy}>
        <ul className="paths-edit">
          {rows.map((id) => {
            if (id.startsWith("h:")) {
              const sec = sections.find((x) => x.id === id.slice(2))!;
              const i = s.paths.findIndex((p) => p.id === sec.id);
              return (
                <HeaderRow
                  key={id}
                  id={id}
                  title={sec.title}
                  general={sec.id === GENERAL}
                  menu={
                    sec.path && (
                      <ActionMenu
                        label={`${sec.title} actions`}
                        className="path__more"
                        items={[
                          { label: "Rename or Recolor…", onSelect: () => onEditPath(sec.id) },
                          { label: "Move Up", disabled: i <= 0, onSelect: () => void tracker.movePath(sec.id, -1) },
                          {
                            label: "Move Down",
                            disabled: i >= s.paths.length - 1,
                            onSelect: () => void tracker.movePath(sec.id, 1),
                          },
                          "separator",
                          { label: "Delete Path", danger: true, onSelect: () => void tracker.deletePath(sec.id) },
                        ]}
                      >
                        <svg viewBox="0 0 26 26" width="26" height="26" aria-hidden>
                          <circle cx="13" cy="13" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          <circle cx="8" cy="13" r="1.6" fill="currentColor" />
                          <circle cx="13" cy="13" r="1.6" fill="currentColor" />
                          <circle cx="18" cy="13" r="1.6" fill="currentColor" />
                        </svg>
                      </ActionMenu>
                    )
                  }
                  empty={sec.all.filter((g) => goalStatus(g) !== "done").length === 0}
                />
              );
            }
            const g = byId.get(id)!;
            const sec = sections.find((x) => x.all.some((y) => y.id === id))!;
            return <EditGoalRow key={id} tracker={tracker} goal={g} color={sec.color} />;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function HeaderRow({
  id,
  title,
  general,
  menu,
  empty,
}: {
  id: string;
  title: string;
  general: boolean;
  menu: React.ReactNode;
  empty: boolean;
}) {
  // A fixed row: it can be dropped beside, never dragged.
  const { setNodeRef, transform, transition } = useSortable({ id, disabled: true });
  return (
    <li ref={setNodeRef} className="paths-edit__head" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <span className="path__title">
        {title}
        {general && <span className="path__badge">Default</span>}
      </span>
      {menu}
      {empty && <span className="paths-edit__empty">Drop goals here</span>}
    </li>
  );
}

function EditGoalRow({ tracker, goal: g, color }: { tracker: Tracker; goal: Goal; color: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: g.id,
  });
  const st = goalStatus(g);
  return (
    <li
      ref={setNodeRef}
      className={"paths-edit__goal" + (isDragging ? " is-dragging" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <DeleteButton iconOnly what={`the goal "${g.title}"`} onDelete={() => tracker.deleteGoal(g.id)} />
      <span className="flex-none" aria-hidden>
        <ProgressRing pct={g.done ? 100 : goalPct(g)} color={color} size={36} />
      </span>
      <span className="paths-edit__text">
        <span className="goal-row__title">{g.title}</span>
        <span className="goal-row__meta">
          {st[0].toUpperCase() + st.slice(1)}
          {g.target ? ` · ${g.current ?? 0} of ${g.target}` : ""}
        </span>
      </span>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="rd-grip"
        aria-label={`Move ${g.title}`}
        {...attributes}
        {...listeners}
      >
        <ReorderLines className="h-6 w-6" />
      </button>
    </li>
  );
}

/** A path's name and colour. */
function PathForm({ tracker, path, onDone }: { tracker: Tracker; path?: Path; onDone: () => void }) {
  const [title, setTitle] = useState(path?.title ?? "");
  const [color, setColor] = useState(path?.color ?? PATH_COLORS[5]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onDone();
    if (path) await tracker.editPath(path.id, { title, color });
    else await tracker.createPath(title, color);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <input
        aria-label="Path name"
        placeholder="Path name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="path-form__name"
        autoFocus
      />
      <div className="path-form__colors" role="radiogroup" aria-label="Colour">
        {PATH_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={c}
            className="path-form__swatch"
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      {!path && <p className="text-xs text-[var(--muted)]">Then, in Edit, drag goals into it from General.</p>}
      <DialogActions primary={{ label: path ? "Save" : "Add Path", disabled: !title.trim() }} />
    </form>
  );
}
