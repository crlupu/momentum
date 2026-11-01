"use client";

import { ChevronRight, Repeat } from "./icons";
import { fmtDateAuto } from "@/lib/dates";
import { Tracker, Goal, goalSummary, goalStatus } from "@/lib/tracker";
import { goalLastActive } from "@/lib/ops";
import { REPEAT_LABEL, repeatOf } from "@/lib/routines";

/**
 * One goal as a row: how often it comes round, its name, when it was last
 * worked on and what's next on it, and a way in. A goal is a habit kept up,
 * not a total to reach, so there is no ring or percentage.
 */
export function GoalRow({
  tracker,
  goal: g,
  onOpen,
  inTopic,
}: {
  tracker: Tracker;
  goal: Goal;
  onOpen: (id: string) => void;
  /** In a topic, the category is the topic's and shown on it, not per row. */
  inTopic?: boolean;
  /** Its path's colour. Unused since rings went; kept for callers. */
  color?: string;
}) {
  const cat = tracker.cat(g.catId);
  const status = goalStatus(g);
  const last = goalLastActive(tracker.state!, g.id);
  const repeat = repeatOf("goal", g);
  const meta =
    status === "done"
      ? `Done${g.doneDate ? ` ${fmtDateAuto(g.doneDate)}` : ""}`
      : status === "dropped"
        ? "Dropped"
        : [
            status === "active" ? REPEAT_LABEL[repeat] : "Queued",
            last ? `last ${fmtDateAuto(last)}` : status === "active" ? "not started" : null,
            goalSummary(g),
          ]
            .filter(Boolean)
            .join(", ");

  return (
    <li>
      <button type="button" className="goal-row" onClick={() => onOpen(g.id)}>
        <span className="goal-row__ring" aria-hidden>
          <span className="goal-row__blank">
            <Repeat />
          </span>
        </span>
        <span className="goal-row__text">
          <span className={"goal-row__title" + (status === "done" || status === "dropped" ? " is-done" : "")}>
            {g.title}
          </span>
          <span className="goal-row__meta">
            {!inTopic && (
              <>
                {cat.name}
                <span className="meta-sep">, </span>
              </>
            )}
            {meta}
          </span>
        </span>
        <ChevronRight className="rd-link__chevron" aria-hidden />
      </button>
    </li>
  );
}
