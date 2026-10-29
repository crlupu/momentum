"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Tracker, dateKey } from "@/lib/tracker";
import { focusElapsed, focusMinutes, planOf, stepsOn } from "@/lib/plan";
import { columnCards } from "@/lib/projects";
import { usePending } from "./ActionButton";
import { ActionMenu } from "./Menu";
import { Check, ChevronDown, MoreHorizontal } from "./icons";

function clock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

const R = 108;
const C = 2 * Math.PI * R;

/**
 * A focus block, full screen: what it's for, a ring filling round the clock,
 * Pause and Finish. Nothing else of the app shows, so nothing else pulls.
 * The chevron tucks it away (Today's card keeps the timer); Discard is in
 * the menu, out of the thumb's way.
 */
export function FocusScreen({ tracker, onTuck }: { tracker: Tracker; onTuck: () => void }) {
  const s = tracker.state!;
  const f = s.activeFocus!;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (f.pausedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [f.pausedAt]);
  // The page underneath stays put while this is up.
  useEffect(() => {
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = was;
    };
  }, []);
  const { pending, run } = usePending();

  const ms = focusElapsed(f, now);
  const goal = f.minutes * 60000;
  const done = ms >= goal;
  const project = f.projectId ? s.projects.find((p) => p.id === f.projectId) : undefined;
  const doing = project ? columnCards(project, "doing")[0] : undefined;
  const today = dateKey();
  const plan = planOf(s);
  const steps = plan ? stepsOn(s, plan, f.day) : [];
  const at = steps.findIndex((x) => x.step.id === f.stepId);
  const minutesToday = focusMinutes(s, today) + (f.day === today ? Math.round(ms / 60000) : 0);
  const foot = done
    ? `Keep going, or Finish to log ${Math.round(ms / 60000)} min`
    : [at >= 0 ? `Step ${at + 1} of ${steps.length}` : null, `${minutesToday} min today`].filter(Boolean).join(" · ");

  return createPortal(
    <div className="focus-screen" role="dialog" aria-modal="true" aria-label="Focus">
      <div className="focus-screen__top">
        <button type="button" className="focus-screen__icon" aria-label="Tuck focus away" onClick={onTuck}>
          <ChevronDown aria-hidden />
        </button>
        <ActionMenu
          label="Focus options"
          className="focus-screen__icon"
          items={[
            {
              label: "Discard focus block",
              danger: true,
              onSelect: () => {
                if (window.confirm("Discard this focus block? Its time isn't logged.")) void tracker.cancelFocus();
              },
            },
          ]}
        >
          <MoreHorizontal aria-hidden />
        </ActionMenu>
      </div>

      <div className="focus-screen__what">
        <p className="focus-screen__label">{f.pausedAt ? "Paused" : "Focus"} · {project?.title ?? "Just focus"}</p>
        {doing && <p className="focus-screen__doing">Doing: {doing.title}</p>}
      </div>

      <div className={"focus-screen__ring" + (done ? " is-done" : "")}>
        <svg viewBox="0 0 232 232" aria-hidden>
          <circle cx="116" cy="116" r={R} className="focus-screen__track" />
          <circle
            cx="116"
            cy="116"
            r={R}
            className="focus-screen__arc"
            strokeDasharray={`${C * Math.min(1, ms / goal)} ${C}`}
            transform="rotate(-90 116 116)"
          />
        </svg>
        <div className="focus-screen__clock">
          <span role="timer" className="font-mono-n tabular-nums">
            {clock(ms)}
          </span>
          <span className="focus-screen__of">{done ? "Time's in" : `of ${f.minutes} min`}</span>
        </div>
      </div>

      <p className="focus-screen__foot">{foot}</p>

      <div className="focus-screen__actions">
        {f.pausedAt ? (
          <button type="button" className="focus-screen__btn" disabled={pending} onClick={() => void run(() => tracker.resumeFocus())}>
            Resume
          </button>
        ) : (
          <button type="button" className="focus-screen__btn" disabled={pending} onClick={() => void run(() => tracker.pauseFocus())}>
            Pause
          </button>
        )}
        <button
          type="button"
          className="focus-screen__btn focus-screen__btn--primary"
          disabled={pending}
          onClick={() => void run(() => tracker.finishFocus())}
        >
          <Check aria-hidden /> Finish
        </button>
      </div>
    </div>,
    document.body
  );
}
