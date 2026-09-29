"use client";

import { useState } from "react";
import { Button, Input } from "./ui";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { Segmented } from "./books/bits";
import { Tracker } from "@/lib/tracker";
import { COLUMNS, type CardStatus, type ProjectCard } from "@/lib/projects";

/**
 * One card, opened: which column it's in, its name, due date and note.
 *
 * The column switch applies at once — it's the phone's way to move a card
 * without dragging it — while the text fields wait for Save, so a half-typed
 * name is never written.
 */
export function CardSheet({
  tracker,
  projectId,
  card: c,
  onClose,
}: {
  tracker: Tracker;
  projectId: string;
  card: ProjectCard;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(c.title);
  const [due, setDue] = useState(c.due ?? "");
  const [note, setNote] = useState(c.note ?? "");
  const { pending, run } = usePending();

  const dirty = title.trim() !== c.title || due !== (c.due ?? "") || note.trim() !== (c.note ?? "");

  const save = async () => {
    if (!title.trim()) return;
    onClose();
    await run(() => tracker.updateCard(projectId, c.id, { title, due: due || null, note }));
  };

  return (
    <div className="goal-fields">
      <div className="goal-field">
        <span>Column</span>
        <Segmented<CardStatus>
          label="Column"
          value={c.status}
          onChange={(status) => void tracker.moveCard(projectId, c.id, status)}
          options={COLUMNS.map((col) => ({ value: col.id, label: col.title }))}
        />
      </div>

      <label className="goal-field">
        <span>Name</span>
        <Input aria-label="Card name" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

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

      <label className="goal-field">
        <span>Note</span>
        <textarea
          aria-label="Note"
          rows={3}
          placeholder="Details, links, what done looks like"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onPress={() => void save()} isDisabled={pending || !dirty || !title.trim()}>
          Save card
        </Button>
        <DeleteButton
          what={`the card "${c.title}"`}
          label="Delete card"
          size="md"
          bare
          onDelete={async () => {
            onClose();
            return tracker.deleteCard(projectId, c.id);
          }}
        />
      </div>
    </div>
  );
}
