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
import { ChevronRight, ListPlus, Upload } from "./icons";
import { ReadingFlow } from "./books/flow";
import { useFlow } from "./books/flowContext";
import { useCoverLookup } from "./books/Cover";
import { Segmented } from "./books/bits";
import { TodayView } from "./books/TodayView";
import { NoTrack, TrackQueue } from "./books/TracksView";
import { PhasesView } from "./books/PhasesView";
import { HistoryView } from "./books/HistoryView";
import { Tracker, type Goal } from "@/lib/tracker";
import * as R from "@/lib/reading";

type Tab = "now" | "library";
const TAB_KEY = "momentum:learning-tab";

/** Started: some of its count done. Everything else open is still to start. */
const inProgress = (g: Goal) => !g.done && (g.current ?? 0) > 0;

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
}: {
  tracker: Tracker;
  /** A track's own page: its id, or "none" for the books in no track. */
  trackId?: string | null;
  /** The phases or history page. */
  view?: string | null;
}) {
  useCoverLookup(tracker, tracker.state!.books);
  return (
    <ReadingFlow tracker={tracker}>
      {trackId ? (
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
  const [tab, setTab] = useState<Tab>("now");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  // The view last looked at, per device. Only a convenience.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved === "now" || saved === "library") setTab(saved);
    } catch {}
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  const started = s.goals.filter(inProgress);
  const notStarted = s.goals.filter((g) => !g.done && !inProgress(g));
  const opened = openId ? s.goals.find((g) => g.id === openId) : undefined;

  const live = R.liveTracks(s);
  const archived = s.readingTracks.filter((t) => t.archived);
  const untracked = R.untrackedBooks(s).filter((b) => b.status !== "finished" && b.status !== "dropped");
  const go = (q: string) => router.push(`/learning?${q}`);

  return (
    <div className="flex flex-col gap-5">
      <div className="hub-switch">
        <Segmented
          label="Show"
          value={tab}
          onChange={choose}
          options={[
            { value: "now", label: "Now" },
            { value: "library", label: "Library" },
          ]}
        />
      </div>

      {tab === "now" ? (
        <>
          <section aria-label="Reading">
            <h2 className="hub-head">Reading</h2>
            <TodayView tracker={tracker} openOnly />
          </section>
          <Panel title="Goals in progress" bare>
            <GoalList
              tracker={tracker}
              goals={started}
              onOpen={setOpenId}
              empty="No goal under way. Start one from Library by moving its count past 0."
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
              <HubRow title="Phases" sub={phasesLine(s)} onPress={() => go("view=phases")} />
              <HubRow title="History" sub="Finished books and goals" onPress={() => go("view=history")} />
            </ul>
          </Panel>

          <Panel title="Goals not started" onAdd={() => setAdding(true)} addLabel="New goal" bare>
            <GoalList
              tracker={tracker}
              goals={notStarted}
              onOpen={setOpenId}
              empty="Nothing waiting. Add a goal with +."
            />
          </Panel>

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
              sub="From JSON or Markdown"
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
    if (gone) router.replace("/learning");
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
