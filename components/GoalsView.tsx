"use client";

import { useState } from "react";
import { AddButton, PanelHeader } from "./ui";
import { Modal } from "./Modal";
import { GoalForm } from "./Forms";
import { GoalDetail } from "./GoalDetail";
import { TopicForm } from "./TopicForm";
import { ProgressRing } from "./ProgressRing";
import { Segmented } from "./books/bits";
import { ChevronRight, Pin, Target } from "./icons";
import { fmtDateAuto } from "@/lib/dates";
import {
  Tracker,
  Goal,
  Path,
  goalHasProgress,
  goalPct,
  goalStepsDone,
  pathGoals,
  pathPct,
} from "@/lib/tracker";

type View = "active" | "done";

/** Pinned goals first; otherwise the order they were given. */
function pinnedFirst(list: Goal[]): Goal[] {
  return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
}

/**
 * Goals: courses, projects, anything tracked to completion, grouped under
 * topics.
 *
 * The page is a stack of topics, each a section with its combined progress
 * and its goals as rows; goals in no topic come last. A row opens the goal,
 * where its steps are ticked off and its details changed. Active and done
 * goals are two views of the same list rather than columns side by side.
 */
export default function GoalsView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [view, setView] = useState<View>("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ pathId: string | null } | null>(null);
  const [topicEdit, setTopicEdit] = useState<{ id: string | null } | null>(null);

  const inView = (g: Goal) => (view === "done" ? g.done : !g.done);

  // A goal appears under one topic only: the first that holds it.
  const seen = new Set<string>();
  const sections = s.paths.map((topic) => {
    const all = pathGoals(topic, s.goals).filter((g) => !seen.has(g.id));
    all.forEach((g) => seen.add(g.id));
    return { topic, all, shown: pinnedFirst(all.filter(inView)) };
  });
  const loose = pinnedFirst(s.goals.filter((g) => !seen.has(g.id) && inView(g)));

  const activeCount = s.goals.filter((g) => !g.done).length;
  const doneCount = s.goals.length - activeCount;
  const opened = openId ? s.goals.find((g) => g.id === openId) : undefined;
  const editingTopic = topicEdit?.id ? s.paths.find((p) => p.id === topicEdit.id) : undefined;

  const nothing = s.goals.length === 0 && s.paths.length === 0;

  return (
    <div className="goals">
      <div className="goals-toolbar">
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: `Active · ${activeCount}` },
            { value: "done", label: `Done · ${doneCount}` },
          ]}
        />
        <span className="goals-toolbar__actions">
          <AddButton label="New topic" onPress={() => setTopicEdit({ id: null })} />
          <AddButton label="New goal" onPress={() => setAdding({ pathId: null })} />
        </span>
      </div>

      {nothing ? (
        <div className="card goals-empty">
          <Target className="h-8 w-8" aria-hidden />
          <p className="goals-empty__title">Track a course or a project</p>
          <p className="goals-empty__text">
            Add a goal for each one and break it into steps: lessons, chapters, tasks. Group
            related goals under a topic to see how the whole area is going.
          </p>
          <AddButton label="New goal" onPress={() => setAdding({ pathId: null })} />
        </div>
      ) : (
        <>
          {sections.map(({ topic, all, shown }) =>
            view === "done" && shown.length === 0 ? null : (
              <TopicSection
                key={topic.id}
                tracker={tracker}
                topic={topic}
                all={all}
                goals={shown}
                view={view}
                onOpen={setOpenId}
                onAdd={() => setAdding({ pathId: topic.id })}
                onEdit={() => setTopicEdit({ id: topic.id })}
              />
            )
          )}

          {(loose.length > 0 || (view === "active" && s.paths.length === 0)) && (
            <section className="goal-topic">
              <PanelHeader title={s.paths.length > 0 ? "Not in a topic" : "All goals"} />
              <div className="card goal-list">
                {loose.length === 0 ? (
                  <p className="goal-list__empty">No goals yet.</p>
                ) : (
                  <ul className="goal-list__rows">
                    {loose.map((g) => (
                      <GoalRow key={g.id} tracker={tracker} goal={g} onOpen={setOpenId} />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {view === "done" && doneCount === 0 && (
            <p className="goal-list__empty">Nothing finished yet. Goals you mark as done land here.</p>
          )}
        </>
      )}

      <Modal open={!!adding} onClose={() => setAdding(null)} title="New goal">
        <GoalForm
          key={adding?.pathId ?? "none"}
          tracker={tracker}
          pathId={adding?.pathId ?? null}
          onDone={() => setAdding(null)}
        />
      </Modal>

      <Modal
        open={!!topicEdit}
        onClose={() => setTopicEdit(null)}
        title={editingTopic ? "Edit topic" : "New topic"}
      >
        <TopicForm
          key={topicEdit?.id ?? "new"}
          tracker={tracker}
          topic={editingTopic}
          onDone={() => setTopicEdit(null)}
        />
      </Modal>

      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""} wide>
        {opened && (
          <GoalDetail key={opened.id} tracker={tracker} goal={opened} onClose={() => setOpenId(null)} />
        )}
      </Modal>
    </div>
  );
}

/** A topic: its name, how far through it is, and its goals. */
function TopicSection({
  tracker,
  topic,
  all,
  goals,
  view,
  onOpen,
  onAdd,
  onEdit,
}: {
  tracker: Tracker;
  topic: Path;
  /** Every goal in the topic, for the totals. */
  all: Goal[];
  /** The goals shown in the current view. */
  goals: Goal[];
  view: View;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onEdit: () => void;
}) {
  const s = tracker.state!;
  const done = all.filter((g) => g.done).length;
  const pct = pathPct({ ...topic, goalIds: all.map((g) => g.id) }, s.goals);

  return (
    <section className="goal-topic" aria-label={topic.title}>
      <PanelHeader title={topic.title}>
        <button type="button" className="text-action" onClick={onEdit} aria-label={`Edit ${topic.title}`}>
          Edit
        </button>
      </PanelHeader>
      {(topic.note || all.length > 0) && (
        <div className="goal-topic__summary">
          {topic.note && <p className="goal-topic__note">{topic.note}</p>}
          {all.length > 0 && (
            <div className="goal-topic__progress">
              <div className="progress-track h-1.5 flex-1">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="goal-topic__figure">
                <span className="font-mono-n">{pct}%</span> · {done} of {all.length} done
              </span>
            </div>
          )}
        </div>
      )}
      <div className="card goal-list">
        {goals.length === 0 ? (
          <p className="goal-list__empty">No goals in this topic yet.</p>
        ) : (
          <ul className="goal-list__rows">
            {goals.map((g) => (
              <GoalRow key={g.id} tracker={tracker} goal={g} onOpen={onOpen} />
            ))}
          </ul>
        )}
        {view === "active" && (
          <div className="goal-list__foot">
            <AddButton size="sm" label="Add goal" onPress={onAdd} />
          </div>
        )}
      </div>
    </section>
  );
}

/** One goal as a row: its progress, name, what it's at, and a way in. */
function GoalRow({
  tracker,
  goal: g,
  onOpen,
}: {
  tracker: Tracker;
  goal: Goal;
  onOpen: (id: string) => void;
}) {
  const cat = tracker.cat(g.catId);
  const steps = goalStepsDone(g);
  const measured = goalHasProgress(g);

  const meta = g.done
    ? `Done${g.doneDate ? ` ${fmtDateAuto(g.doneDate)}` : ""}`
    : steps.total > 0
      ? `${steps.done} of ${steps.total} ${steps.total === 1 ? "step" : "steps"}`
      : g.target
        ? `${(g.current ?? 0).toLocaleString()} of ${g.target.toLocaleString()}`
        : "No steps yet";

  return (
    <li>
      <button type="button" className="goal-row" onClick={() => onOpen(g.id)}>
        <span className="goal-row__ring" aria-hidden>
          {measured || g.done ? (
            <ProgressRing pct={g.done ? 100 : goalPct(g)} color="var(--accent)" size={40} />
          ) : (
            <span className="goal-row__blank">
              <Target />
            </span>
          )}
        </span>
        <span className="goal-row__text">
          <span className={"goal-row__title" + (g.done ? " is-done" : "")}>
            {g.pinned && <Pin className="goal-row__pin" aria-label="Pinned" />}
            {g.title}
          </span>
          <span className="goal-row__meta">
            <span className="cat-dot" style={{ background: cat.color }} aria-hidden />
            {cat.name}
            <span aria-hidden>·</span>
            {meta}
          </span>
        </span>
        <ChevronRight className="rd-link__chevron" aria-hidden />
      </button>
    </li>
  );
}
