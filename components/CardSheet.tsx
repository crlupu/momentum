"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { usePending } from "./ActionButton";
import { DialogActions } from "./DialogActions";
import { Segmented } from "./books/bits";
import { TagPicker } from "./TagPicker";
import { Tracker } from "@/lib/tracker";
import { COLUMNS, type CardStatus, type Project, type ProjectCard } from "@/lib/projects";

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * A new card: its name, a description and its tags, added to the column
 * whose "Add card" opened it.
 */
export function NewCardForm({
  tracker,
  project,
  status,
  onDone,
}: {
  tracker: Tracker;
  project: Project;
  status: CardStatus;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onDone();
    void tracker.addCard(project.id, { title, note, tagIds }, status);
  };

  return (
    <form onSubmit={submit} className="goal-fields">
      <label className="goal-field">
        <span>Name</span>
        <Input
          aria-label="Card name"
          placeholder="What needs doing"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </label>

      <label className="goal-field">
        <span>Description</span>
        <textarea
          aria-label="Description"
          rows={3}
          placeholder="Details, links, what done looks like (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="goal-field">
        <span>Tags</span>
        <TagPicker tracker={tracker} project={project} selected={tagIds} onChange={setTagIds} />
      </div>

      <DialogActions primary={{ label: "Add", disabled: !title.trim() }} />
    </form>
  );
}

/**
 * One card, opened: which column it's in, its name, tags, due date and
 * description.
 *
 * The column switch applies at once — it's the phone's way to move a card
 * without dragging it — while the rest waits for Save, so a half-typed name
 * is never written.
 */
export function CardSheet({
  tracker,
  project,
  card: c,
  onClose,
}: {
  tracker: Tracker;
  project: Project;
  card: ProjectCard;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(c.title);
  const [due, setDue] = useState(c.due ?? "");
  const [note, setNote] = useState(c.note ?? "");
  const [tagIds, setTagIds] = useState<string[]>(c.tagIds ?? []);
  const { pending, run } = usePending();

  const dirty =
    title.trim() !== c.title ||
    due !== (c.due ?? "") ||
    note.trim() !== (c.note ?? "") ||
    !sameIds(tagIds, c.tagIds ?? []);

  const save = async () => {
    if (!title.trim()) return;
    onClose();
    await run(() => tracker.updateCard(project.id, c.id, { title, due: due || null, note, tagIds }));
  };

  return (
    <div className="goal-fields">
      <div className="goal-field">
        <span>Column</span>
        <Segmented<CardStatus>
          label="Column"
          value={c.status}
          onChange={(status) => void tracker.moveCard(project.id, c.id, status)}
          options={COLUMNS.map((col) => ({ value: col.id, label: col.title }))}
        />
      </div>

      <label className="goal-field">
        <span>Name</span>
        <Input aria-label="Card name" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="goal-field">
        <span>Description</span>
        <textarea
          aria-label="Description"
          rows={3}
          placeholder="Details, links, what done looks like"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="goal-field">
        <span>Tags</span>
        <TagPicker tracker={tracker} project={project} selected={tagIds} onChange={setTagIds} />
      </div>

      <label className="goal-field">
        <span>Due</span>
        <span className="flex items-center gap-2">
          <Input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} className="flex-1" />
          {due && (
            <button type="button" className="text-action" onClick={() => setDue("")}>
              Clear
            </button>
          )}
        </span>
      </label>

      <DialogActions
        primary={{ label: "Save", onPress: () => void save(), disabled: pending || !dirty || !title.trim() }}
        del={{
          what: `the card "${c.title}"`,
          onDelete: async () => {
            onClose();
            return tracker.deleteCard(project.id, c.id);
          },
        }}
      />
    </div>
  );
}
