"use client";

import { Tracker, dateKey, goalStatus, goalSummary, pathGoals, type Book, type Goal } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { addDays } from "@/lib/plan";
import { fmtDateAuto } from "@/lib/dates";
import { goalUnits } from "@/lib/weekStats";
import { useFlow } from "./books/flowContext";
import { Cover } from "./books/Cover";
import { ProgressRing } from "./ProgressRing";
import { ChevronRight, Plus } from "./icons";

const pctOf = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

/**
 * An open book as a card: its cover, title and author, how far it is as a
 * large percentage with the page, a bar, and the pace it's meant to keep
 * (its track's pages a day, else the pace it has kept) with when that
 * finishes it. + Pages opens the update sheet; the rest opens the book.
 */
export function BookProgressCard({ tracker, book }: { tracker: Tracker; book: Book }) {
  const s = tracker.state!;
  const flow = useFlow();
  const today = dateKey();
  const track = book.trackId ? R.trackOf(s, book.trackId) : undefined;
  const kept = R.bookPace(s, book, today).perDay;
  const perDay = track?.dailyTarget || Math.round(kept);
  const left = book.pages > 0 ? Math.max(0, book.pages - book.read) : 0;
  const eta = perDay > 0 && left > 0 ? addDays(today, Math.ceil(left / perDay)) : null;
  const pct = pctOf(book.read, book.pages);
  return (
    <div className="card edu-book">
      <button type="button" className="edu-book__open" onClick={() => flow.open({ kind: "detail", bookId: book.id })}>
        <span className="edu-book__cover">
          <Cover book={book} />
        </span>
        <span className="edu-book__text">
          <span className="edu-book__title">{book.title}</span>
          {book.author && <span className="edu-book__author">{book.author}</span>}
          <span className="edu-book__figure">
            {book.pages > 0 && <span className="edu-book__pct">{pct}%</span>}
            <span className="edu-book__page">{book.pages > 0 ? `p. ${book.read} of ${book.pages}` : `p. ${book.read}`}</span>
          </span>
        </span>
      </button>
      {book.pages > 0 && (
        <span className="edu-bar edu-bar--thick" aria-hidden>
          <span style={{ inlineSize: `${Math.max(pct, 1.5)}%` }} />
        </span>
      )}
      <div className="edu-book__foot">
        <span>
          {perDay > 0 ? `${perDay} page${perDay === 1 ? "" : "s"} a day` : "No pace yet"}
          {eta ? `, done ~${fmtDateAuto(eta)}` : ""}
        </span>
        <button type="button" className="edu-book__pages" onClick={() => flow.open({ kind: "log", bookId: book.id })}>
          <Plus aria-hidden />
          Pages
        </button>
      </div>
    </div>
  );
}

/** A goal's name inside its topic: "Course · Module" reads as the module. */
const shortTitle = (t: string) => (t.includes(" · ") ? t.split(" · ").slice(1).join(" · ") : t);

/**
 * A topic with the goals going now: the topic's share done, large, over its
 * bar and count, then a row per active goal with its ring, its next step and
 * its count. A row opens the goal.
 */
function TopicCard({ title, goals, all, onOpen }: { title: string; goals: Goal[]; all: Goal[]; onOpen: (id: string) => void }) {
  const sum = all
    .filter((g) => goalStatus(g) !== "dropped")
    .map(goalUnits)
    .reduce((a, u) => ({ done: a.done + u.done, total: a.total + u.total }), { done: 0, total: 0 });
  const pct = pctOf(sum.done, sum.total);
  return (
    <div className="card edu-topic">
      <div className="edu-topic__head">
        <span className="edu-topic__title">{title}</span>
        {sum.total > 0 && <span className="edu-topic__pct">{pct}%</span>}
      </div>
      {sum.total > 0 && (
        <>
          <span className="edu-bar" aria-hidden>
            <span style={{ inlineSize: `${Math.max(pct, 1.5)}%` }} />
          </span>
          <span className="edu-topic__count">
            {sum.done} of {sum.total} done in the topic
          </span>
        </>
      )}
      <ul className="edu-topic__goals">
        {goals.map((g) => {
          const u = goalUnits(g);
          const next = goalSummary(g);
          return (
            <li key={g.id}>
              <button type="button" className="edu-goal" onClick={() => onOpen(g.id)}>
                <ProgressRing pct={pctOf(u.done, u.total)} color="var(--tone)" size={40} figure />
                <span className="edu-goal__text">
                  <span className="edu-goal__title">{shortTitle(g.title)}</span>
                  <span className="edu-goal__sub">
                    {[next, u.total ? `${u.done} of ${u.total}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ChevronRight className="edu-goal__chev" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The goals going now, by topic, the topics in their own order; goals in none come last as Other. */
export function GoalsByTopic({ tracker, onOpen }: { tracker: Tracker; onOpen: (id: string) => void }) {
  const s = tracker.state!;
  const active = (g: Goal) => goalStatus(g) === "active";
  const inTopic = new Set(s.paths.flatMap((p) => p.goalIds));
  const cards = s.paths
    .map((p) => ({ id: p.id, title: p.title, all: pathGoals(p, s.goals) }))
    .map((t) => ({ ...t, goals: t.all.filter(active) }))
    .filter((t) => t.goals.length > 0);
  const others = s.goals.filter((g) => active(g) && !inTopic.has(g.id));
  if (others.length) cards.push({ id: "other", title: "Other", all: others, goals: others });
  return (
    <>
      {cards.map((t) => (
        <TopicCard key={t.id} title={t.title} goals={t.goals} all={t.all} onOpen={onOpen} />
      ))}
    </>
  );
}

/** How many goals are going, in how many topics: "5 going in 4 topics". */
export function goingLine(tracker: Tracker): string {
  const s = tracker.state!;
  const active = s.goals.filter((g) => goalStatus(g) === "active");
  const topics = new Set(active.map((g) => s.paths.find((p) => p.goalIds.includes(g.id))?.id ?? "other"));
  return active.length ? `${active.length} going in ${topics.size} topic${topics.size === 1 ? "" : "s"}` : "";
}
