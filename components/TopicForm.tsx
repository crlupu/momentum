"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { DialogActions } from "./DialogActions";
import { CatPicker } from "./Forms";
import { usePending } from "./ActionButton";
import { Path, Tracker } from "@/lib/tracker";

/**
 * A topic's name, what it's for and its category, which every goal in it
 * shares. Only an empty topic can be deleted.
 */
export function TopicForm({
  tracker,
  topic,
  onDone,
}: {
  tracker: Tracker;
  topic?: Path;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(topic?.title ?? "");
  const [note, setNote] = useState(topic?.note ?? "");
  const [catId, setCatId] = useState(topic?.catId ?? tracker.state!.categories[0]?.id ?? "");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || pending) return;
    onDone();
    await run(() =>
      topic ? tracker.updatePath(topic.id, t, catId, note) : tracker.addPath(t, catId, note)
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        aria-label="Topic name"
        placeholder="e.g. Rust ramp up"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <Input
        aria-label="What it's for"
        placeholder="What it's for (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <CatPicker tracker={tracker} catId={catId} setCatId={setCatId} />
      <DialogActions
        primary={{ label: topic ? "Save" : "Add", disabled: pending || !title.trim() }}
        del={
          // Only an empty topic can be deleted.
          topic &&
          !topic.goalIds.some((id) => tracker.state!.goals.some((g) => g.id === id)) && {
            what: `the topic "${topic.title}"`,
            onDelete: async () => {
              onDone();
              return tracker.removePath(topic.id);
            },
          }
        }
      />
    </form>
  );
}
