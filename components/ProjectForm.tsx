"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { ActionButton, usePending } from "./ActionButton";
import { DialogActions } from "./DialogActions";
import { TagManager } from "./TagPicker";
import { CheckCircle2, ExternalLink, RotateCcw } from "./icons";
import { Tracker } from "@/lib/tracker";
import type { Project } from "@/lib/projects";

/**
 * A project's name, what it is and where it lives. Editing an existing
 * project also manages its tags, and finishes, reopens or deletes it. A
 * new project starts with no tags: they're made as its cards need them.
 */
export function ProjectForm({
  tracker,
  project,
  onDone,
  onCreated,
  onDeleted,
}: {
  tracker: Tracker;
  project?: Project;
  onDone: () => void;
  /** Called with the new project's id, so its board can be opened. */
  onCreated?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [note, setNote] = useState(project?.note ?? "");
  const [link, setLink] = useState(project?.link ?? "");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || pending) return;
    const fields = { title, note, link };
    if (project) {
      onDone();
      await run(() => tracker.updateProject(project.id, fields));
    } else {
      // Closes and opens the new board straight away; the save carries on.
      onDone();
      onCreated?.(tracker.addProject(fields));
    }
  };

  const href = link.trim() && /^https?:\/\//i.test(link.trim()) ? link.trim() : null;

  return (
    <form onSubmit={submit} className="goal-fields">
      <label className="goal-field">
        <span>Name</span>
        <Input
          aria-label="Project name"
          placeholder="e.g. Momentum app"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!project}
        />
      </label>

      <label className="goal-field">
        <span>What it is</span>
        <textarea
          aria-label="What it is"
          rows={2}
          placeholder="A line about the project (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <label className="goal-field">
        <span>Link</span>
        <span className="flex gap-2">
          <Input
            type="url"
            aria-label="Link"
            placeholder="https://… the repository or design"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="flex-1"
          />
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className="goal-link" aria-label="Open link">
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
        </span>
      </label>

      {project && (
        <div className="goal-field">
          <span>Tags for this project&apos;s cards</span>
          <TagManager tracker={tracker} project={project} />
        </div>
      )}

      <DialogActions
        onCancel={onDone}
        primary={{ label: project ? "Save" : "Add", disabled: pending || !title.trim() }}
        del={
          project && {
            what: `the project "${project.title}" and its cards`,
            onDelete: async () => {
              onDone();
              onDeleted?.();
              return tracker.deleteProject(project.id);
            },
          }
        }
        extra={
          project && (
            <ActionButton
              variant="ghost"
              onAction={async () => {
                onDone();
                return tracker.setProjectDone(project.id, !project.done);
              }}
            >
              {project.done ? (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden /> Reopen
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Finish
                </>
              )}
            </ActionButton>
          )
        }
      />
    </form>
  );
}
