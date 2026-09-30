"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { DeleteButton } from "./DeleteButton";
import { CatPicker } from "./Forms";
import { usePending } from "./ActionButton";
import { Path, Tracker } from "@/lib/tracker";

/**
 * A topic's name, what it's for and its category, which every goal in it
 * shares. Deleting a topic keeps its goals: they move to "Not in a topic".
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
        placeholder="e.g. Backend engineering"
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
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" isDisabled={pending || !title.trim()}>
          {topic ? "Save topic" : "Add topic"}
        </Button>
        {topic && (
          <DeleteButton
            what={`the topic "${topic.title}" (its goals stay)`}
            label="Delete topic"
            size="md"
            bare
            onDelete={async () => {
              onDone();
              return tracker.removePath(topic.id);
            }}
          />
        )}
      </div>
    </form>
  );
}
