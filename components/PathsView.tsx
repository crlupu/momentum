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
 * With `editable` (Library), New Path adds a path, and each path's Edit
 * opens it for organizing: renaming, moving and deleting it, reordering and
 * deleting its goals, adding one. Active only shows.
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
  // The path being edited, one at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
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
  // On Active, a path with nothing active is left out; in Library every path
  // shows, empty ones too, so they can be edited.
  const visible = editable ? sections : sections.filter((x) => x.shown.length > 0);
  const editingPath = pathForm?.id ? s.paths.find((p) => p.id === pathForm.id) : undefined;

  return (
    <div className="paths">
      {editable && (
        <div className="paths__bar">
          <button type="button" className="text-action" onClick={() => setPathForm({ id: null })}>
            <Plus aria-hidden /> New Path
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="card goal-list__empty p-4">{empty}</p>
      ) : (
        visible.map((sec) => {
          const editing = editingId === sec.id;
          const open = editing || !collapsed.includes(sec.id);
          const prog = pathProgress(sec.all);
          return (
            <section key={sec.id} className="path">
              <div className="path__headrow">
                <button
                  type="button"
                  className="path__head"
                  aria-expanded={open}
                  onClick={() => !editing && toggle(sec.id)}
                >
                  <span className="path__title">{sec.title}</span>
                  <span className="path__pct font-mono-n">{prog.pct}%</span>
                  {!editing && <ChevronRight className={"path__chev" + (open ? " is-open" : "")} aria-hidden />}
                </button>
                {editable && (
                  <button
                    type="button"
                    className="text-action text-action--sm"
                    aria-pressed={editing}
                    aria-label={editing ? `Done editing ${sec.title}` : `Edit ${sec.title}`}
                    onClick={() => setEditingId(editing ? null : sec.id)}
                  >
                    {editing ? "Done" : "Edit"}
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
                {editing ? (
                  <SectionEdit
                    tracker={tracker}
                    section={sec}
                    onAdd={() => setAddingTo(sec.id)}
                    onEditPath={() => setPathForm({ id: sec.id })}
                    onDeleted={() => setEditingId(null)}
                  />
                ) : (
                  open && (
                    <ul className="goal-list__rows">
                      {sec.shown.map((g) => (
                        <GoalRow key={g.id} tracker={tracker} goal={g} onOpen={onOpen} inTopic color={sec.color} />
                      ))}
                    </ul>
                  )
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
 * One path in Edit: its own actions (rename and colour, move, delete) for a
 * path you made, its goals with a handle to reorder them and a delete, and a
 * row to add a goal to it. A goal moves to another path from its Path row.
 */
function SectionEdit({
  tracker,
  section: sec,
  onAdd,
  onEditPath,
  onDeleted,
}: {
  tracker: Tracker;
  section: Section;
  onAdd: () => void;
  onEditPath: () => void;
  onDeleted: () => void;
}) {
  const s = tracker.state!;
  // Touch waits a moment before lifting a row, so scrolling past a handle doesn't pick it up.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  // Done goals are in History; they keep their place but aren't dragged here.
  const goals = sec.all.filter((g) => goalStatus(g) !== "done");
  const ids = goals.map((g) => g.id);
  const i = s.paths.findIndex((p) => p.id === sec.id);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void tracker.arrangeLearning([{ pathId: sec.id, goalIds: arrayMove(ids, from, to) }]);
  };

  return (
    <div className="path-edit">
      {sec.path && (
        <div className="path-edit__actions">
          <button type="button" className="text-action text-action--sm" onClick={onEditPath}>
            Rename or Recolor
          </button>
          <button
            type="button"
            className="text-action text-action--sm"
            disabled={i <= 0}
            onClick={() => void tracker.movePath(sec.id, -1)}
          >
            Move Up
          </button>
          <button
            type="button"
            className="text-action text-action--sm"
            disabled={i >= s.paths.length - 1}
            onClick={() => void tracker.movePath(sec.id, 1)}
          >
            Move Down
          </button>
          <DeleteButton
            what={`the path "${sec.title}" (its goals go back to General)`}
            label="Delete Path"
            onDelete={async () => {
              onDeleted();
              return tracker.deletePath(sec.id);
            }}
          />
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="paths-edit">
            {goals.map((g) => (
              <EditGoalRow key={g.id} tracker={tracker} goal={g} color={sec.color} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button type="button" className="path-edit__add" onClick={onAdd}>
        <Plus aria-hidden /> Add Goal
      </button>
    </div>
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
