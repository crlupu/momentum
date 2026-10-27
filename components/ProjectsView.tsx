"use client";

import { useState } from "react";
import Link from "next/link";
import { AddButton } from "./ui";
import { Modal } from "./Modal";
import { ProjectForm } from "./ProjectForm";
import { ProjectBoard } from "./ProjectBoard";
import { Segmented } from "./books/bits";
import { CardMeter, SummaryCard } from "./SummaryCard";
import { ChevronLeft, ChevronRight, ExternalLink, Kanban, Plus } from "./icons";
import { Tracker } from "@/lib/tracker";
import { fmtDateAuto } from "@/lib/dates";
import { columnCards, projectFinished, projectProgress, type Project } from "@/lib/projects";

type View = "active" | "done";

/**
 * Projects: a list of boards. Each project is a row with how far along it
 * is and what's in each column; tapping it opens its board.
 */
export function ProjectList({ tracker, onOpen }: { tracker: Tracker; onOpen: (id: string) => void }) {
  const s = tracker.state!;
  const [view, setView] = useState<View>("active");
  const [adding, setAdding] = useState(false);

  const active = s.projects.filter((p) => !projectFinished(p));
  const finished = s.projects.filter((p) => projectFinished(p));
  const shown = view === "done" ? finished : active;

  return (
    <div className="goals">
      <div className="goals-toolbar">
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: `Active · ${active.length}` },
            { value: "done", label: `Finished · ${finished.length}` },
          ]}
        />
        <span className="goals-toolbar__actions">
          <button type="button" className="head-add" aria-label="New project" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
          </button>
        </span>
      </div>

      {s.projects.length === 0 ? (
        <div className="card goals-empty">
          <Kanban className="h-8 w-8" aria-hidden />
          <p className="goals-empty__title">Plan a project on a board</p>
          <p className="goals-empty__text">
            Each project gets its own board: To do, Doing and Done. Add a card for each piece of
            work and drag it across as it moves along.
          </p>
          <AddButton label="New project" onPress={() => setAdding(true)} />
        </div>
      ) : shown.length === 0 ? (
        <p className="goal-list__empty">
          {view === "done" ? "Nothing finished yet. Projects you mark as finished land here." : "No active projects."}
        </p>
      ) : (
        <ul className="project-grid">
          {shown.map((p) => (
            <li key={p.id}>
              <ProjectTile project={p} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New project">
        <ProjectForm tracker={tracker} onDone={() => setAdding(false)} onCreated={onOpen} />
      </Modal>
    </div>
  );
}

function ProjectTile({
  project: p,
  onOpen,
}: {
  project: Project;
  onOpen: (id: string) => void;
}) {
  const { done, total, pct } = projectProgress(p);
  const todo = columnCards(p, "todo").length;
  const doing = columnCards(p, "doing").length;
  const doingCard = columnCards(p, "doing")[0];
  const nextCard = columnCards(p, "todo")[0];
  const nextDue = p.cards
    .filter((c) => c.status !== "done" && c.due)
    .map((c) => c.due!)
    .sort()[0];

  return (
    // The whole card opens the board; the band says so.
    <div
      role="link"
      tabIndex={0}
      className="project-card"
      onClick={() => onOpen(p.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(p.id))}
    >
      <SummaryCard
        label="Project"
        aside={`${pct}%`}
        done={projectFinished(p)}
        doneLabel="Finished"
        title={p.title}
        line={p.note}
        band={
          !projectFinished(p) && (doingCard || nextCard)
            ? { label: doingCard ? "Doing" : "Next", content: (doingCard ?? nextCard)!.title, action: nextDue ? `due ${fmtDateAuto(nextDue)}` : "Open", onPress: () => onOpen(p.id) }
            : { label: total === 0 ? "No cards yet" : "Board", content: "", action: "Open", onPress: () => onOpen(p.id) }
        }
        figures={total ? [
          { value: todo, label: "to do" },
          { value: doing, label: "doing" },
          { value: done, label: "done" },
        ] : undefined}
      >
        {total > 0 &&
          (total <= 16 ? (
            <span className="momentum__segments" aria-hidden>
              {[...columnCards(p, "done"), ...columnCards(p, "doing"), ...columnCards(p, "todo")].map((c) => (
                <span key={c.id} className={"momentum__seg" + (c.status === "done" ? " is-done" : c.status === "doing" ? " is-doing" : "")} />
              ))}
            </span>
          ) : (
            <CardMeter value={pct / 100} />
          ))}
      </SummaryCard>
    </div>
  );
}

/** A project, opened: its board, with the way back and its settings above. */
export function ProjectPage({ tracker, project: p }: { tracker: Tracker; project: Project }) {
  const [editing, setEditing] = useState(false);
  const { done, total, pct } = projectProgress(p);
  const href = p.link && /^https?:\/\//i.test(p.link) ? p.link : null;

  return (
    <div className="project-page">
      {/* Read top down as a Learning topic does: what it is, then how far
          along, the bar and its figure on one line. */}
      <div className="project-page__bar">
        {p.note ? <p className="goal-topic__note m-0">{p.note}</p> : <span />}
        <span className="project-page__actions">
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-action">
              <ExternalLink className="h-4 w-4" aria-hidden /> Open
            </a>
          )}
          <button type="button" className="text-action" onClick={() => setEditing(true)}>
            Edit
          </button>
        </span>
      </div>
      <div className="goal-topic__progress">
        <div className="progress-track h-1.5 flex-1">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="goal-topic__figure">
          <span className="font-mono-n">{pct}%</span> · {done} of {total} done
          {projectFinished(p) && " · Finished"}
        </span>
      </div>

      <ProjectBoard tracker={tracker} project={p} />

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit project">
        <ProjectForm
          key={p.id}
          tracker={tracker}
          project={p}
          onDone={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}

/** "‹ Projects", above a board's large title. */
export function BackToProjects({ href }: { href: string }) {
  return (
    <Link href={href} className="back-link">
      <ChevronLeft aria-hidden />
      Projects
    </Link>
  );
}
