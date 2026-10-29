"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "./Panel";
import { Button } from "./ui";
import { Modal } from "./Modal";
import { GoalDetail, GoalTitle } from "./GoalDetail";
import { GoalRow } from "./GoalsView";
import { PathsView } from "./PathsView";
import { NextSteps } from "./NextSteps";
import { BookOpen, CalendarDays, ChevronRight, Clock, School } from "./icons";
import { EmptyState } from "./EmptyState";
import { SummaryCard } from "./SummaryCard";
import { useShell } from "./AppShell";
import { fmtDateAuto } from "@/lib/dates";
import { ReadingFlow } from "./books/flow";
import { useFlow } from "./books/flowContext";
import { useCoverLookup } from "./books/Cover";
import { Segmented } from "./books/bits";
import { OpenBook } from "./books/TodayView";
import { NoTrack, TrackPageView } from "./books/TracksView";
import { PhasesView } from "./books/PhasesView";
import { HistoryView } from "./books/HistoryView";
import { Tracker, dateKey, goalStatus, type Goal } from "@/lib/tracker";
import * as R from "@/lib/reading";

type Tab = "active" | "library";
const TAB_KEY = "momentum:learning-tab";

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
        <GroupRedirect />
      ) : trackId ? (
        <TrackPage tracker={tracker} trackId={trackId} />
      ) : view === "phases" ? (
        <PhasesView tracker={tracker} />
      ) : view === "history" ? (
        <HistoryPage tracker={tracker} />
      ) : (
        <Hub tracker={tracker} library={view === "library"} />
      )}
    </ReadingFlow>
  );
}

function Hub({ tracker, library }: { tracker: Tracker; library?: boolean }) {
  const s = tracker.state!;
  const router = useRouter();
  const flow = useFlow();
  const { openGoal } = useShell();
  const [tab, setTab] = useState<Tab>("active");
  const [openId, setOpenId] = useState<string | null>(null);

  // The view last looked at, per device. Only a convenience.
  // A link can ask for Library (Today's "Start a book").
  useEffect(() => {
    try {
      if (library || localStorage.getItem(TAB_KEY) === "library") setTab("library");
    } catch {}
  }, [library]);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  const droppedGoals = s.goals.filter((g) => goalStatus(g) === "dropped");
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
          {reading.length === 0 && !s.goals.some((g) => goalStatus(g) === "active") ? (
            <SummaryCard
              aria-label="Nothing active"
              label="Nothing active"
              title="Pick something to learn"
              line="A course, a certification, a book. Its next step lands here."
              actions={
                <>
                  <Button variant="primary" onPress={openGoal}>
                    Set a goal
                  </Button>
                  <button type="button" className="hero__ghost" onClick={() => choose("library")}>
                    Start a book
                  </button>
                </>
              }
            />
          ) : (
            <NextSteps tracker={tracker} onOpen={setOpenId} />
          )}
          <div className="grid items-start gap-5 md:grid-cols-2 [&>*]:min-w-0">
            <Panel title="Reading" bare>
              {reading.length === 0 ? (
                <EmptyState icon={<BookOpen />} title="No book open">
                  Start one from Library; its page and pace show here.
                </EmptyState>
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
            <Panel title="Learning" bare>
              <PathsView
                tracker={tracker}
                statuses={["active"]}
                onOpen={setOpenId}
                empty={
                  <EmptyState icon={<School />} title="No goals active">
                    Set a goal to Active and its progress ring appears here.
                  </EmptyState>
                }
              />
            </Panel>
          </div>
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
                    note={t.note}
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

          <section className="panel">
            <PathsView
              tracker={tracker}
              heading="Goals"
              statuses={showDropped ? ["active", "queued", "dropped"] : ["active", "queued"]}
              editable
              onOpen={setOpenId}
              empty="No goals yet. Add one with +."
            />
            {droppedGoals.length > 0 && (
              <DroppedToggle
                shown={showDropped}
                count={droppedGoals.length}
                onToggle={() => setShowDropped((v) => !v)}
              />
            )}
          </section>

          {/* Places to look back and plan ahead, apart from the tracks
              themselves. */}
          <section>
          <h3 className="group-head">Plan and look back</h3>
          <ul className="card hub-list">
            <HubRow icon={<CalendarDays aria-hidden />} title="Phases" sub={phasesLine(s)} onPress={() => go("view=phases")} />
            <HubRow icon={<Clock aria-hidden />} title="History" sub="Finished books and goals" onPress={() => go("view=history")} />
          </ul>
          </section>
        </>
      )}

      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened?.title ?? ""} titleNode={opened && <GoalTitle key={opened.id} tracker={tracker} goal={opened} />} wide>
        {opened && <GoalDetail key={opened.id} tracker={tracker} goal={opened} onClose={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}

/** Topic pages are gone: Learning shows paths in place. Old links land on it. */
function GroupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/education");
  }, [router]);
  return null;
}

/**
 * A topic in Edit, as an iOS list in Edit: its name and category at the
 * top, its goals with grips to drag into order (the order queued goals are
 * taken in), and Delete Topic once it holds no goals.
 */
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
  note,
  onPress,
}: {
  dot?: string;
  icon?: ReactNode;
  title: string;
  sub?: string;
  /** A line or two about it, under the figures. */
  note?: string;
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
          {note && <span className="hub-row__note">{note}</span>}
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
      <TrackPageView tracker={tracker} track={track} />
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
