"use client";

import { KeyboardEvent, useState } from "react";
import { Check, Plus, X } from "./icons";
import { Tracker } from "@/lib/tracker";
import type { Project, ProjectTag } from "@/lib/projects";

/** A tag as a small pill in its colour: on cards, and wherever tags are listed. */
export function TagChip({ tag, className }: { tag: ProjectTag; className?: string }) {
  return (
    <span className={"tag-chip " + (className ?? "")} style={{ background: tag.color }}>
      {tag.name}
    </span>
  );
}

/**
 * A project's tags to switch on and off for a card, and a field to make a
 * new one, which is switched on as it's made. Tags belong to the project, so
 * what's made here is offered on every other card of the same board.
 */
export function TagPicker({
  tracker,
  project,
  selected,
  onChange,
}: {
  tracker: Tracker;
  project: Project;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [name, setName] = useState("");
  const has = new Set(selected);

  const toggle = (id: string) => onChange(has.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const create = () => {
    const n = name.trim();
    if (!n) return;
    const existing = project.tags.find((t) => t.name.toLowerCase() === n.toLowerCase());
    const id = existing?.id ?? tracker.addProjectTag(project.id, n);
    if (!has.has(id)) onChange([...selected, id]);
    setName("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter makes the tag rather than submitting the card's form.
    if (e.key === "Enter") {
      e.preventDefault();
      create();
    }
  };

  return (
    <div className="tag-picker">
      {project.tags.length > 0 && (
        <div className="tag-picker__list" role="group" aria-label="Tags">
          {project.tags.map((t) => {
            const on = has.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={"tag-toggle" + (on ? " is-on" : "")}
                style={{ "--tag": t.color } as React.CSSProperties}
                aria-pressed={on}
                onClick={() => toggle(t.id)}
              >
                {on ? <Check aria-hidden /> : <span className="tag-toggle__dot" aria-hidden />}
                {t.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="tag-picker__new">
        <input
          type="text"
          aria-label="New tag"
          placeholder={project.tags.length ? "New tag…" : "Add a tag, e.g. Backend"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKey}
        />
        <button type="button" className="tag-picker__add" onClick={create} disabled={!name.trim()} aria-label="Create tag">
          <Plus aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** The project's tags with a way to delete each: for the project's settings. */
export function TagManager({ tracker, project }: { tracker: Tracker; project: Project }) {
  const [name, setName] = useState("");
  const create = () => {
    const n = name.trim();
    if (!n || project.tags.some((t) => t.name.toLowerCase() === n.toLowerCase())) return;
    tracker.addProjectTag(project.id, n);
    setName("");
  };
  return (
    <div className="tag-picker">
      {project.tags.length > 0 && (
        <ul className="tag-picker__list">
          {project.tags.map((t) => (
            <li key={t.id} className="tag-owned" style={{ "--tag": t.color } as React.CSSProperties}>
              <span className="tag-toggle__dot" aria-hidden />
              {t.name}
              <button
                type="button"
                className="tag-owned__remove"
                aria-label={`Delete the tag ${t.name}`}
                onClick={() => void tracker.deleteProjectTag(project.id, t.id)}
              >
                <X aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="tag-picker__new">
        <input
          type="text"
          aria-label="New tag"
          placeholder="New tag…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
        />
        <button type="button" className="tag-picker__add" onClick={create} disabled={!name.trim()} aria-label="Create tag">
          <Plus aria-hidden />
        </button>
      </div>
    </div>
  );
}
