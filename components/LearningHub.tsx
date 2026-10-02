"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "./Panel";
import { Button } from "./ui";
import { Modal } from "./Modal";
import { GoalForm } from "./Forms";
import { GoalDetail } from "./GoalDetail";
import { GoalImportForm } from "./GoalImport";
import { GoalRow } from "./GoalsView";
import { TopicForm } from "./TopicForm";
import { ProgressRing } from "./ProgressRing";
import { CalendarDays, ChevronRight, Clock, ListPlus, Upload } from "./icons";
import { ReadingFlow } from "./books/flow";
import { useFlow } from "./books/flowContext";
import { useCoverLookup } from "./books/Cover";
import { Segmented } from "./books/bits";
import { OpenBook } from "./books/TodayView";
import { NoTrack, TrackQueue } from "./books/TracksView";
import { PhasesView } from "./books/PhasesView";
import { HistoryView } from "./books/HistoryView";
import { Tracker, dateKey, goalStarted, stepsLine, pathGoals, pathPct, type Goal, type Path } from "@/lib/tracker";
import * as R from "@/lib/reading";

type Tab = "active" | "library";
const TAB_KEY = "momentum:learning-tab";

/** Started: some of its count done. Everything else open is still to start. */
const inProgress = (g: Goal) => !g.done && goalStarted(g);

/**
 * A goal made of steps (stored as a topic and its goals: "Rust ramp up",
 * with The Rust Book, Rustlings… as its steps), or a goal on its own.
 * Grouped goals show as one goal, whose page lists its steps.
 */
type Item = { kind: "group"; path: Path; steps: Goal[] } | { kind: "goal"; goal: Goal };

function items(s: NonNullable<Tracker["state"]>): Item[] {
  // A goal belongs to the first group that lists it, as before.
  const seen = new Set<string>();
  const groups: Item[] = s.paths.map((path) => {
    const steps = pathGoals(path, s.goals).filter((g) => !seen.has(g.id));
    steps.forEach((g) => seen.add(g.id));
    return { kind: "group", path, steps };
  });
  const loose: Item[] = s.goals.filter((g) => !seen.has(g.id)).map((goal) => ({ kind: "goal", goal }));
  return [...groups, ...loose];
}

const itemDone = (i: Item) =>
  i.kind === "goal" ? i.goal.done : i.steps.length > 0 && i.steps.every((g) => g.done);
const itemStarted = (i: Item) =>
  i.kind === "goal"
    ? inProgress(i.goal)
    : i.steps.some(goalStarted);

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
  const [importing, setImporting] = useState(false);

  // The view last looked at, per device. Only a convenience.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved === "library") setTab("library");
    } catch {}
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  const all = items(s).filter((i) => !itemDone(i));
  const started = all.filter(itemStarted);
  const notStarted = all.filter((i) => !itemStarted(i));
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
              <ul className="rd-cards">
                {reading.map((b) => (
                  <OpenBook key={b.id} tracker={tracker} book={b} today={today} minimal />
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Goals" bare>
            <ItemList
              tracker={tracker}
              items={started}
              onOpen={setOpenId}
              onGroup={(id) => go(`goal=${id}`)}
              empty="Nothing under way. A goal shows here once its count moves past 0."
            />
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

          <Panel title="Goals not started" onAdd={() => setAdding(true)} addLabel="New goal" bare>
            <ItemList
              tracker={tracker}
              items={notStarted}
              onOpen={setOpenId}
              onGroup={(id) => go(`goal=${id}`)}
              empty="Nothing waiting. Add a goal with +."
            />
          </Panel>

          {/* Places to look back and plan ahead, apart from the tracks
              themselves. */}
          <ul className="card hub-list">
            <HubRow icon={<CalendarDays aria-hidden />} title="Phases" sub={phasesLine(s)} onPress={() => go("view=phases")} />
            <HubRow icon={<Clock aria-hidden />} title="History" sub="Finished books and goals" onPress={() => go("view=history")} />
          </ul>

          {/* Adding in bulk: rows like the rest of the list, rather than a
              cluster of buttons that wraps unevenly on a phone. */}
          <ul className="card hub-list">
            <HubRow
              icon={<ListPlus aria-hidden />}
              title="Add several books"
              sub="A list, one title a line"
              onPress={() => flow.open({ kind: "bulk" })}
            />
            <HubRow
              icon={<Upload aria-hidden />}
              title="Import reading plan"
              sub="Tracks, phases and books from Markdown"
              onPress={() => flow.open({ kind: "import" })}
            />
            <HubRow
              icon={<Upload aria-hidden />}
              title="Import goals"
              sub="From JSON or Markdown, steps and all"
              onPress={() => setImporting(true)}
            />
          </ul>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New goal">
        {adding && <GoalForm tracker={tracker} onDone={() => setAdding(false)} />}
      </Modal>
      <Modal open={importing} onClose={() => setImporting(false)} title="Import goals">
        {importing && <GoalImportForm tracker={tracker} onClose={() => setImporting(false)} />}
      </Modal>
      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""} wide>
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

  useEffect(() => {
    if (!path) router.replace("/education");
  }, [path, router]);
  if (!path) return null;

  const steps = pathGoals(path, s.goals);
  const pct = pathPct(path, s.goals);
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
      <Panel title="Steps" onEdit={() => setEditing(true)} onAdd={() => setAdding(true)} addLabel="Add a step" bare>
        <div className="card goal-list">
          {steps.length === 0 ? (
            <p className="goal-list__empty">No steps yet. Add one with +.</p>
          ) : (
            <ul className="goal-list__rows">
              {steps.map((g) => (
                <GoalRow key={g.id} tracker={tracker} goal={g} onOpen={setOpenId} inTopic />
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Modal open={adding} onClose={() => setAdding(false)} title="New step">
        {adding && <GoalForm tracker={tracker} pathId={path.id} onDone={() => setAdding(false)} />}
      </Modal>
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit goal">
        {editing && <TopicForm tracker={tracker} topic={path} onDone={() => setEditing(false)} />}
      </Modal>
      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""} wide>
        {opened && <GoalDetail key={opened.id} tracker={tracker} goal={opened} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
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
      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""} wide>
        {opened && <GoalDetail key={opened.id} tracker={tracker} goal={opened} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}
