"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "./Panel";
import { Button } from "./ui";
import { Modal } from "./Modal";
import { GoalForm } from "./Forms";
import { GoalDetail, GoalTitle } from "./GoalDetail";
import { GoalRow } from "./GoalsView";
import { CatPicker } from "./Forms";
import { DeleteButton } from "./DeleteButton";
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
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ProgressRing } from "./ProgressRing";
import { CalendarDays, ChevronDown, ChevronRight, Clock, ReorderLines } from "./icons";
import { fmtDateAuto } from "@/lib/dates";
import { ReadingFlow } from "./books/flow";
import { useFlow } from "./books/flowContext";
import { useCoverLookup } from "./books/Cover";
import { Segmented } from "./books/bits";
import { OpenBook } from "./books/TodayView";
import { NoTrack, TrackQueue } from "./books/TracksView";
import { PhasesView } from "./books/PhasesView";
import { HistoryView } from "./books/HistoryView";
import { STATUS_RANK, Tracker, dateKey, goalStatus, stepsLine, pathGoals, pathPct, type Goal, type GoalStatus, type Path } from "@/lib/tracker";
import * as R from "@/lib/reading";

type Tab = "active" | "library";
const TAB_KEY = "momentum:learning-tab";
type Grouping = "topic" | "phase";
const GROUP_KEY = "momentum:learning-group";

/**
 * A topic and its goals (Rust ramp up: The Rust Book, Rustlings…), or a goal
 * in no topic. A topic shows as one row, whose page lists its goals.
 */
type Item = { kind: "group"; path: Path; steps: Goal[] } | { kind: "goal"; goal: Goal };

function items(s: NonNullable<Tracker["state"]>): Item[] {
  // A goal belongs to the first topic that lists it, as before.
  const seen = new Set<string>();
  const groups: Item[] = s.paths.map((path) => {
    const steps = pathGoals(path, s.goals).filter((g) => !seen.has(g.id));
    steps.forEach((g) => seen.add(g.id));
    return { kind: "group", path, steps };
  });
  const loose: Item[] = s.goals.filter((g) => !seen.has(g.id)).map((goal) => ({ kind: "goal", goal }));
  return [...groups, ...loose];
}

/**
 * Where a row belongs. A topic is active while any of its goals is, queued
 * while any is still to do (or it has none yet), and otherwise done, or
 * dropped if every goal in it was.
 */
function itemStatus(i: Item): GoalStatus {
  if (i.kind === "goal") return goalStatus(i.goal);
  const st = i.steps.map(goalStatus);
  if (st.includes("active")) return "active";
  if (st.length === 0 || st.includes("queued")) return "queued";
  return st.every((x) => x === "dropped") ? "dropped" : "done";
}

/** A topic's goals in status order (active, queued, done), each keeping the topic's own order. */
function byStatus(goals: Goal[]): Goal[] {
  return goals
    .map((g, i) => ({ g, i }))
    .sort((a, b) => STATUS_RANK[goalStatus(a.g)] - STATUS_RANK[goalStatus(b.g)] || a.i - b.i)
    .map((x) => x.g);
}

/**
 * Learning: books and goals in one place, without a second row of tabs.
 *
 * One switch. Now is what's under way: the books open, with their quick page
 * update, and the goals with some of their count done. Library is what to
 * pick from: the reading tracks, each a row that opens its own page, and the
 * goals not yet started. Anything deeper (a track's queue, phases, history)
 * is a page you go into, with a way back, never a tab within a tab.
 */
export function LearningHub({
  tracker,
  trackId,
  view,
  groupId,
}: {
  tracker: Tracker;
  /** A track's own page: its id, or "none" for the books in no track. */
  trackId?: string | null;
  /** The phases or history page. */
  view?: string | null;
  /** A goal with steps: its page. */
  groupId?: string | null;
}) {
  useCoverLookup(tracker, tracker.state!.books);
  return (
    <ReadingFlow tracker={tracker}>
      {groupId ? (
        <GroupPage tracker={tracker} groupId={groupId} />
      ) : trackId ? (
        <TrackPage tracker={tracker} trackId={trackId} />
      ) : view === "phases" ? (
        <PhasesView tracker={tracker} />
      ) : view === "history" ? (
        <HistoryPage tracker={tracker} />
      ) : (
        <Hub tracker={tracker} />
      )}
    </ReadingFlow>
  );
}

function Hub({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const router = useRouter();
  const flow = useFlow();
  const [tab, setTab] = useState<Tab>("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [grouping, setGrouping] = useState<Grouping>("topic");

  // The view last looked at, and how goals were grouped, per device. Only a
  // convenience.
  useEffect(() => {
    try {
      if (localStorage.getItem(TAB_KEY) === "library") setTab("library");
      if (localStorage.getItem(GROUP_KEY) === "phase") setGrouping("phase");
    } catch {}
  }, []);
  const group = (g: Grouping) => {
    setGrouping(g);
    try {
      localStorage.setItem(GROUP_KEY, g);
    } catch {}
  };
  const switcher = (
    <Segmented
      size="sm"
      label="Group goals by"
      value={grouping}
      onChange={group}
      options={[
        { value: "topic", label: "Topic" },
        { value: "phase", label: "Phase" },
      ]}
    />
  );
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  const all = items(s);
  const started = all.filter((i) => itemStatus(i) === "active");
  const notStarted = all.filter((i) => itemStatus(i) === "queued");
  const dropped = all.filter((i) => itemStatus(i) === "dropped");
  // By phase, goals are listed one by one, wherever their topic is.
  const goalsWith = (st: GoalStatus) => s.goals.filter((g) => goalStatus(g) === st);
  const droppedGoals = goalsWith("dropped");
  const [showDropped, setShowDropped] = useState(false);
  const opened = openId ? s.goals.find((g) => g.id === openId) : undefined;
  const today = dateKey();
  // Every book open, in track order: just the books and their page box.
  const reading = R.liveTracks(s).flatMap((t) => R.activeBooks(s, t.id));

  const live = R.liveTracks(s);
  const archived = s.readingTracks.filter((t) => t.archived);
  const untracked = R.untrackedBooks(s).filter((b) => b.status !== "finished" && b.status !== "dropped");
  const go = (q: string) => router.push(`/education?${q}`);

  return (
    <div className="flex flex-col gap-5">
      <div className="hub-switch">
        <Segmented
          label="Show"
          value={tab}
          onChange={choose}
          options={[
            { value: "active", label: "Active" },
            { value: "library", label: "Library" },
          ]}
        />
      </div>

      {tab === "active" ? (
        <>
          <Panel title="Reading" bare>
            {reading.length === 0 ? (
              <p className="card p-4 text-[15px] text-[var(--muted)]">Nothing being read. Start a book from Library.</p>
            ) : (
              <div className="card goal-list">
                <ul className="goal-list__rows">
                  {reading.map((b) => (
                    <OpenBook key={b.id} tracker={tracker} book={b} today={today} minimal />
                  ))}
                </ul>
              </div>
            )}
          </Panel>
          <Panel title="Learning" actions={switcher} bare>
            {grouping === "phase" ? (
              <PhaseGroups tracker={tracker} goals={goalsWith("active")} onOpen={setOpenId} empty="Nothing active." />
            ) : (
              <ItemList
                tracker={tracker}
                items={started}
                onOpen={setOpenId}
                onGroup={(id) => go(`goal=${id}`)}
                empty="Nothing active. Set a goal to Active from Library."
              />
            )}
          </Panel>
        </>
      ) : (
        <>
          <Panel
            title="Reading tracks"
            onAdd={() => flow.open({ kind: "track", trackId: null })}
            addLabel="New track"
            bare
          >
            <ul className="card hub-list">
              {live.map((t) => {
                const open = R.activeBooks(s, t.id).length;
                const next = R.trackQueue(s, t.id).length;
                return (
                  <HubRow
                    key={t.id}
                    dot={t.color}
                    title={t.name}
                    sub={`${open} reading · ${next} up next${t.dailyTarget > 0 ? ` · ${t.dailyTarget} pages a day` : ""}`}
                    onPress={() => go(`track=${t.id}`)}
                  />
                );
              })}
              {untracked.length > 0 && (
                <HubRow
                  title="No track"
                  sub={`${untracked.length} book${untracked.length === 1 ? "" : "s"}`}
                  onPress={() => go("track=none")}
                />
              )}
              {archived.map((t) => (
                <HubRow key={t.id} dot={t.color} title={t.name} sub="Archived" onPress={() => go(`track=${t.id}`)} />
              ))}
            </ul>
          </Panel>

          <Panel title="Queued" actions={switcher} onAdd={() => setAdding(true)} addLabel="New goal" bare>
            {grouping === "phase" ? (
              <PhaseGroups
                tracker={tracker}
                goals={showDropped ? [...goalsWith("queued"), ...droppedGoals] : goalsWith("queued")}
                onOpen={setOpenId}
                empty="Nothing queued. Add a goal with +."
              />
            ) : (
              <ItemList
                tracker={tracker}
                items={showDropped ? [...notStarted, ...dropped] : notStarted}
                onOpen={setOpenId}
                onGroup={(id) => go(`goal=${id}`)}
                empty="Nothing queued. Add a goal with +."
              />
            )}
            {(grouping === "phase" ? droppedGoals.length : dropped.length) > 0 && (
              <DroppedToggle
                shown={showDropped}
                count={grouping === "phase" ? droppedGoals.length : dropped.length}
                onToggle={() => setShowDropped((v) => !v)}
              />
            )}
          </Panel>

          {/* Places to look back and plan ahead, apart from the tracks
              themselves. */}
          <ul className="card hub-list">
            <HubRow icon={<CalendarDays aria-hidden />} title="Phases" sub={phasesLine(s)} onPress={() => go("view=phases")} />
            <HubRow icon={<Clock aria-hidden />} title="History" sub="Finished books and goals" onPress={() => go("view=history")} />
          </ul>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New goal">
        {adding && <GoalForm tracker={tracker} onDone={() => setAdding(false)} />}
      </Modal>
      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""} titleNode={opened && <GoalTitle key={opened.id} tracker={tracker} goal={opened} />} wide>
        {opened && <GoalDetail key={opened.id} tracker={tracker} goal={opened} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}

/** Goals as rows: a goal with steps opens its page, any other its details. */
function ItemList({
  tracker,
  items: list,
  onOpen,
  onGroup,
  empty,
}: {
  tracker: Tracker;
  items: Item[];
  onOpen: (id: string) => void;
  onGroup: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="card goal-list">
      {list.length === 0 ? (
        <p className="goal-list__empty">{empty}</p>
      ) : (
        <ul className="goal-list__rows">
          {list.map((i) =>
            i.kind === "goal" ? (
              <GoalRow key={i.goal.id} tracker={tracker} goal={i.goal} onOpen={onOpen} />
            ) : (
              <GroupRow key={i.path.id} tracker={tracker} path={i.path} steps={i.steps} onOpen={() => onGroup(i.path.id)} />
            )
          )}
        </ul>
      )}
    </div>
  );
}

/** A goal with steps, as one row: how far through, how many steps done. */
function GroupRow({
  tracker,
  path,
  steps,
  onOpen,
}: {
  tracker: Tracker;
  path: Path;
  steps: Goal[];
  onOpen: () => void;
}) {
  const s = tracker.state!;
  const cat = path.catId ? tracker.cat(path.catId) : null;
  const pct = pathPct({ ...path, goalIds: steps.map((g) => g.id) }, s.goals);
  return (
    <li>
      <button type="button" className="goal-row" onClick={onOpen}>
        <span className="goal-row__ring" aria-hidden>
          <ProgressRing pct={pct} color="var(--accent)" size={44} />
        </span>
        <span className="goal-row__text">
          <span className="goal-row__title">{path.title}</span>
          <span className="goal-row__meta">
            {cat && (
              <>
                <span className="cat-dot" style={{ background: cat.color }} aria-hidden />
                {cat.name}
                <span aria-hidden>·</span>
              </>
            )}
            {stepsLine(steps)}
          </span>
        </span>
        <ChevronRight className="rd-link__chevron" aria-hidden />
      </button>
    </li>
  );
}

/**
 * A goal with steps, opened: what it's for, how far along, and its steps,
 * each opening its own details with the − / + count.
 */
function GroupPage({ tracker, groupId }: { tracker: Tracker; groupId: string }) {
  const s = tracker.state!;
  const router = useRouter();
  const path = s.paths.find((p) => p.id === groupId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDropped, setShowDropped] = useState(false);

  useEffect(() => {
    if (!path) router.replace("/education");
  }, [path, router]);
  if (!path) return null;

  const all = byStatus(pathGoals(path, s.goals));
  const droppedHere = all.filter((g) => goalStatus(g) === "dropped");
  const steps = all.filter((g) => goalStatus(g) !== "dropped");
  const shown = showDropped ? all : steps;
  const pct = pathPct({ ...path, goalIds: steps.map((g) => g.id) }, s.goals);
  const opened = openId ? s.goals.find((g) => g.id === openId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {(path.note || steps.length > 0) && (
        <div className="goal-topic__summary">
          {path.note && <p className="goal-topic__note">{path.note}</p>}
          {steps.length > 0 && (
            <div className="goal-topic__progress">
              <div className="progress-track h-1.5 flex-1">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="goal-topic__figure">
                <span className="font-mono-n">{pct}%</span> · {stepsLine(steps)}
              </span>
            </div>
          )}
        </div>
      )}
      {editing ? (
        <TopicEditor tracker={tracker} topic={path} onDone={() => setEditing(false)} />
      ) : (
      <Panel title="Goals" onEdit={() => setEditing(true)} onAdd={() => setAdding(true)} addLabel="Add a goal" bare>
        <div className="card goal-list">
          {shown.length === 0 ? (
            <p className="goal-list__empty">No goals yet. Add one with +.</p>
          ) : (
            <ul className="goal-list__rows">
              {shown.map((g) => (
                <GoalRow key={g.id} tracker={tracker} goal={g} onOpen={setOpenId} inTopic />
              ))}
            </ul>
          )}
        </div>
        {droppedHere.length > 0 && (
          <DroppedToggle shown={showDropped} count={droppedHere.length} onToggle={() => setShowDropped((v) => !v)} />
        )}
      </Panel>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New goal">
        {adding && <GoalForm tracker={tracker} pathId={path.id} onDone={() => setAdding(false)} />}
      </Modal>
      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""} titleNode={opened && <GoalTitle key={opened.id} tracker={tracker} goal={opened} />} wide>
        {opened && <GoalDetail key={opened.id} tracker={tracker} goal={opened} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}

/**
 * Goals by reading phase, the same phases books use: one disclosure per
 * phase in date order, the phase holding today open and the rest closed,
 * then "No phase". A goal in two phases is under both.
 */
function PhaseGroups({
  tracker,
  goals,
  onOpen,
  empty,
}: {
  tracker: Tracker;
  goals: Goal[];
  onOpen: (id: string) => void;
  empty: string;
}) {
  const s = tracker.state!;
  const today = dateKey();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const phases = [...s.readingPhases].sort((a, b) => a.start.localeCompare(b.start));
  const known = new Set(phases.map((p) => p.id));
  const groups = phases
    .map((p) => ({
      key: p.id,
      title: p.name,
      sub: `${fmtDateAuto(p.start)} – ${fmtDateAuto(p.end)}`,
      now: p.start <= today && today <= p.end,
      goals: goals.filter((g) => g.phaseIds?.includes(p.id)),
    }))
    .filter((x) => x.goals.length > 0 || x.now);
  const none = goals.filter((g) => !(g.phaseIds ?? []).some((id) => known.has(id)));
  if (none.length) groups.push({ key: "none", title: "No phase", sub: "", now: false, goals: none });
  // With no phase running today, the list would open on nothing at all.
  const anyNow = groups.some((x) => x.now);

  if (goals.length === 0) return <p className="card goal-list goal-list__empty">{empty}</p>;
  return (
    <div className="flex flex-col gap-2">
      {groups.map((x) => {
        const isOpen = open[x.key] ?? (x.now || (!anyNow && x.key === "none"));
        return (
          <section key={x.key} className="card goal-list">
            <button
              type="button"
              className="phase-head"
              aria-expanded={isOpen}
              onClick={() => setOpen((o) => ({ ...o, [x.key]: !isOpen }))}
            >
              {isOpen ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
              <span className="phase-head__text">
                <span className="phase-head__title">
                  {x.title}
                  {x.now && <span className="phase-head__now">Now</span>}
                </span>
                {x.sub && <span className="phase-head__sub">{x.sub}</span>}
              </span>
              <span className="phase-head__count">{x.goals.length}</span>
            </button>
            {isOpen &&
              (x.goals.length === 0 ? (
                <p className="goal-list__empty">No goals in this phase yet.</p>
              ) : (
                <ul className="goal-list__rows">
                  {x.goals.map((g) => (
                    <GoalRow key={g.id} tracker={tracker} goal={g} onOpen={onOpen} />
                  ))}
                </ul>
              ))}
          </section>
        );
      })}
    </div>
  );
}

/**
 * A topic in Edit, as an iOS list in Edit: its name and category at the
 * top, its goals with grips to drag into order (the order queued goals are
 * taken in), and Delete Topic once it holds no goals.
 */
function TopicEditor({ tracker, topic, onDone }: { tracker: Tracker; topic: Path; onDone: () => void }) {
  const s = tracker.state!;
  const goals = pathGoals(topic, s.goals);
  const [name, setName] = useState(topic.title);
  const saveName = () => {
    if (name.trim() && name.trim() !== topic.title) void tracker.updatePath(topic.id, name, topic.catId, topic.note);
    else setName(topic.title);
  };
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = goals.map((g) => g.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void tracker.reorderTopic(topic.id, arrayMove(ids, from, to));
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Edit topic">
      <div className="goal-steps__head">
        <h2 className="panel-head__title">Edit Topic</h2>
        <button
          type="button"
          className="text-action"
          aria-pressed
          onClick={() => {
            saveName();
            onDone();
          }}
        >
          Done
        </button>
      </div>
      <div className="card flex flex-col gap-3 p-4">
        <input
          aria-label="Topic name"
          className="step-field step-field--name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <CatPicker
          tracker={tracker}
          catId={topic.catId ?? ""}
          setCatId={(id) => void tracker.updatePath(topic.id, topic.title, id, topic.note)}
        />
      </div>

      {goals.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="group-label" style={{ paddingInline: "0.25rem" }}>Drag to set the order</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              <ul className="step-list step-list--on-page">
                {goals.map((g) => (
                  <SortableGoal key={g.id} goal={g} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="self-start">
          <DeleteButton
            what={`the topic "${topic.title}"`}
            label="Delete Topic"
            onDelete={async () => {
              onDone();
              return tracker.removePath(topic.id);
            }}
          />
        </div>
      ) : (
        <p className="px-1 text-sm text-[var(--muted)]">
          To delete this topic, move its goals elsewhere or delete them first.
        </p>
      )}
    </section>
  );
}

/** A goal in a topic being edited: its name and status, and a grip to drag it by. */
function SortableGoal({ goal: g }: { goal: Goal }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: g.id,
  });
  const st = goalStatus(g);
  return (
    <li
      ref={setNodeRef}
      className={"step-row" + (isDragging ? " step-row--dragging" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="step-row__name">
        {g.title}
        <span className="block text-[0.8125rem] text-[var(--muted)]">{st[0].toUpperCase() + st.slice(1)}</span>
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

/** Dropped goals stay out of sight, with everything kept, until asked for. */
function DroppedToggle({ shown, count, onToggle }: { shown: boolean; count: number; onToggle: () => void }) {
  return (
    <button type="button" className="text-action mt-2 self-start" aria-pressed={shown} onClick={onToggle}>
      {shown ? "Hide dropped" : `Show dropped (${count})`}
    </button>
  );
}

function phasesLine(s: NonNullable<Tracker["state"]>): string {
  if (!s.readingPhases.length) return "Group books into stretches of time";
  const today = new Date().toISOString().slice(0, 10);
  const now = s.readingPhases.find((p) => p.start <= today && today <= p.end);
  return now ? `${now.name}, now` : `${s.readingPhases.length} phase${s.readingPhases.length === 1 ? "" : "s"}`;
}

/** A row that opens a page: what it is, a line about it, and a chevron. */
function HubRow({
  dot,
  icon,
  title,
  sub,
  onPress,
}: {
  dot?: string;
  icon?: ReactNode;
  title: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <li>
      <button type="button" className="hub-row" onClick={onPress}>
        {dot && <span className="panel-head__dot" style={{ background: dot }} aria-hidden />}
        {icon && <span className="hub-row__icon">{icon}</span>}
        <span className="hub-row__text">
          <span className="hub-row__title">{title}</span>
          {sub && <span className="hub-row__sub">{sub}</span>}
        </span>
        <ChevronRight className="rd-link__chevron" aria-hidden />
      </button>
    </li>
  );
}

function GoalList({
  tracker,
  goals,
  onOpen,
  empty,
}: {
  tracker: Tracker;
  goals: Goal[];
  onOpen: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="card goal-list">
      {goals.length === 0 ? (
        <p className="goal-list__empty">{empty}</p>
      ) : (
        <ul className="goal-list__rows">
          {goals.map((g) => (
            <GoalRow key={g.id} tracker={tracker} goal={g} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One track's page: what's open and its queue, as the Tracks tab showed it. */
function TrackPage({ tracker, trackId }: { tracker: Tracker; trackId: string }) {
  const s = tracker.state!;
  const router = useRouter();
  const track = s.readingTracks.find((t) => t.id === trackId);
  const untracked = R.untrackedBooks(s).filter((b) => b.status !== "finished" && b.status !== "dropped");

  // Deleted, or a stale link: back to Learning.
  const gone = trackId === "none" ? untracked.length === 0 : !track;
  useEffect(() => {
    if (gone) router.replace("/education");
  }, [gone, router]);

  if (trackId === "none") return untracked.length ? <NoTrack books={untracked} /> : null;
  if (!track) return null;
  return (
    <div className="flex flex-col gap-4">
      <TrackQueue tracker={tracker} track={track} asPage />
      {track.archived && (
        <div>
          <Button variant="ghost" onPress={() => void tracker.updateTrack(track.id, { ...track, archived: false })}>
            Restore track
          </Button>
        </div>
      )}
    </div>
  );
}

/** Finished books, as the History tab showed them, then goals done. */
function HistoryPage({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [openId, setOpenId] = useState<string | null>(null);
  const done = s.goals
    .filter((g) => g.done)
    .sort((a, b) => (b.doneDate ?? "").localeCompare(a.doneDate ?? ""));
  const opened = openId ? s.goals.find((g) => g.id === openId) : undefined;
  return (
    <div className="flex flex-col gap-5">
      <HistoryView tracker={tracker} />
      <Panel title="Goals done" bare>
        <GoalList tracker={tracker} goals={done} onOpen={setOpenId} empty="Goals you mark as done land here." />
      </Panel>
      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""} titleNode={opened && <GoalTitle key={opened.id} tracker={tracker} goal={opened} />} wide>
        {opened && <GoalDetail key={opened.id} tracker={tracker} goal={opened} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}
