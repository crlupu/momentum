"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "./ui";
import { ActionButton, usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { CatPicker } from "./Forms";
import { Modal } from "./Modal";
import { ProgressRing } from "./ProgressRing";
import { Check, ExternalLink, Kanban, Minus, Pin, PinOff, Plus, RotateCcw } from "./icons";
import { Goal, Tracker, goalPct, goalTopic } from "@/lib/tracker";

/** A number field's value, or null when empty or not a number. */
function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * One goal, opened: how far it is, its details, and what can be done with it.
 *
 * A goal with a count (videos, pages, modules) is moved along with − and +;
 * one without is simply done or not, with Mark as done.
 */
export function GoalDetail({
  tracker,
  goal: g,
  onClose,
}: {
  tracker: Tracker;
  goal: Goal;
  onClose: () => void;
}) {
  const s = tracker.state!;
  const pct = g.done ? 100 : goalPct(g);
  const topic = goalTopic(g.id, s.paths);

  const summary = g.done
    ? "Done"
    : g.target
      ? `${(g.current ?? 0).toLocaleString()} of ${g.target.toLocaleString()}`
      : "No count yet. Add one in Details to track how far along it is.";

  return (
    <div className="goal-detail">
      <div className="goal-detail__summary">
        <ProgressRing pct={pct} color="var(--accent)" size={64} />
        <div className="min-w-0">
          <p className="goal-detail__pct">{g.target || g.done ? `${pct}% complete` : "Open"}</p>
          <p className="goal-detail__sub">{summary}</p>
          {topic && <p className="goal-detail__sub">In {topic.title}</p>}
        </div>
      </div>

      {/* The count is the control, with − and + beside it. */}
      {!!g.target && !g.done && (
        <div className="goal-counter">
          <span className="goal-counter__label">Progress</span>
          <Stepper
            value={g.current ?? 0}
            total={g.target}
            onStep={(d) => tracker.stepGoal(g.id, d)}
            what={g.title}
          />
        </div>
      )}

      <AfterFirstFrame>
        <Details tracker={tracker} goal={g} />
      </AfterFirstFrame>

      <div className="goal-detail__actions">
        <ActionButton
          variant="primary"
          onAction={async () => {
            const r = await tracker.toggleGoalDone(g.id);
            if (!g.done) onClose();
            return r;
          }}
        >
          {g.done ? (
            <>
              <RotateCcw className="h-4 w-4" /> Reopen
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Mark as done
            </>
          )}
        </ActionButton>
        <ActionButton variant="ghost" onAction={() => tracker.toggleGoalPin(g.id)}>
          {g.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          {g.pinned ? "Unpin" : "Pin to top"}
        </ActionButton>
        <MoveToProjects tracker={tracker} goal={g} onClose={onClose} />
        <span className="ml-auto">
          <DeleteButton
            what={`the goal "${g.title}"`}
            label="Delete"
            size="md"
            bare
            onDelete={async () => {
              onClose();
              return tracker.deleteGoal(g.id);
            }}
          />
        </span>
      </div>
    </div>
  );
}

/**
 * Turns a goal into a project, for things that turned out to be work to
 * build rather than material to get through. Asks first, since the goal
 * leaves Learning; then opens the new board.
 */
function MoveToProjects({ tracker, goal: g, onClose }: { tracker: Tracker; goal: Goal; onClose: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // The new board opens straight away; the save carries on behind it.
  const move = () => {
    const id = tracker.goalToProject(g.id);
    setOpen(false);
    if (id) {
      onClose();
      router.push(`/projects?p=${id}`);
    }
  };

  return (
    <>
      <Button variant="ghost" onPress={() => setOpen(true)}>
        <Kanban className="h-4 w-4" /> Move to Projects
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Move to Projects">
        <p className="mb-1 text-[15px]">
          Make <span className="font-semibold">{g.title}</span> a project?
        </p>
        <p className="mb-4 text-sm text-[var(--muted)]">
          It gets an empty board to add cards to, keeping its description and link, and
          leaves Learning.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onPress={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onPress={move}>
            Move
          </Button>
        </div>
      </Modal>
    </>
  );
}

/**
 * "3 of 10" between a − and a +.
 *
 * Presses are never held back while a save is in flight: the change is on
 * screen at once and each write starts from the one before, so tapping + five
 * times quickly counts five. Locking the buttons until the round trip ended
 * made + ignore taps and − flash to disabled and back on every press.
 *
 * The figure is as wide as the largest it can be, so the buttons don't shift
 * as the count gains a digit.
 */
function Stepper({
  value,
  total,
  onStep,
  what,
}: {
  value: number;
  total: number;
  onStep: (delta: number) => Promise<unknown>;
  what: string;
}) {
  const digits = total.toLocaleString().length;
  return (
    <span className="stepper">
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`One less, ${what}`}
        isDisabled={value <= 0}
        onPress={() => void onStep(-1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="stepper__value font-mono-n" style={{ minInlineSize: `${digits * 2 + 3.5}ch` }}>
        {value.toLocaleString()}
        <span className="stepper__total"> of {total.toLocaleString()}</span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`One more, ${what}`}
        isDisabled={value >= total}
        onPress={() => void onStep(1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </span>
  );
}

/**
 * Renders its children one frame after the sheet opens. The details form is
 * the heaviest part of the sheet and sits below the fold on a phone; drawn
 * with the rest, it held back the frame that shows the sheet at all. The
 * slide-in covers the gap.
 */
function AfterFirstFrame({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready ? <>{children}</> : <div className="goal-section goal-section--pending" aria-hidden />;
}

/** Name, description, topic, category, count and link. */
function Details({ tracker, goal: g }: { tracker: Tracker; goal: Goal }) {
  const s = tracker.state!;
  const topic = goalTopic(g.id, s.paths);
  const [name, setName] = useState(g.title);
  const [current, setCurrent] = useState(g.current != null ? String(g.current) : "");
  const [target, setTarget] = useState(g.target != null ? String(g.target) : "");
  // − and + change the count from above; the fields follow, so they never
  // hold a figure that Save would write back over the newer one.
  useEffect(() => setCurrent(g.current != null ? String(g.current) : ""), [g.current]);
  useEffect(() => setTarget(g.target != null ? String(g.target) : ""), [g.target]);
  const [link, setLink] = useState(g.link ?? "");
  const [note, setNote] = useState(g.note ?? "");
  const { pending, run } = usePending();

  const dirty =
    name.trim() !== g.title ||
    num(current) !== (g.current ?? null) ||
    num(target) !== (g.target ?? null) ||
    link.trim() !== (g.link ?? "") ||
    note.trim() !== (g.note ?? "");

  const save = async () => {
    await run(async () => {
      await tracker.saveGoal(g.id, {
        title: name,
        catId: g.catId,
        current: num(current),
        target: num(target),
      });
      return tracker.setGoalDetails(g.id, { link, note });
    });
  };

  const href = link.trim() && /^https?:\/\//i.test(link.trim()) ? link.trim() : null;

  return (
    <section className="goal-section" aria-labelledby="goal-details">
      <h3 id="goal-details" className="group-label">Details</h3>
      <div className="goal-fields">
        <label className="goal-field">
          <span>Name</span>
          <Input aria-label="Goal name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="goal-field">
          <span>Description</span>
          <textarea
            aria-label="Description"
            rows={4}
            placeholder="Details: what it covers, why, where you left off…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className="goal-field">
          <span>Topic</span>
          <select
            value={topic?.id ?? ""}
            onChange={(e) => void tracker.setGoalTopic(g.id, e.target.value || null)}
          >
            <option value="">No topic</option>
            {s.paths.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </label>

        {/* In a topic, the category is the topic's; changed there. */}
        {topic?.catId ? (
          <div className="goal-field">
            <span>Category</span>
            <span className="goal-field__value">
              <span className="cat-dot" style={{ background: tracker.cat(topic.catId).color }} aria-hidden />
              {tracker.cat(topic.catId).name}
              <span className="goal-field__hint">from {topic.title}</span>
            </span>
          </div>
        ) : (
          <CatPicker tracker={tracker} catId={g.catId} setCatId={(id) => void tracker.updateGoal(g.id, { catId: id })} />
        )}

        <div className="goal-field">
          <span>Count, if it has one (pages, videos, modules)</span>
          <div className="flex gap-2">
            <Input type="number" inputMode="decimal" aria-label="Done so far" placeholder="Done so far" value={current} onChange={(e) => setCurrent(e.target.value)} className="flex-1" />
            <Input type="number" inputMode="decimal" aria-label="Total" placeholder="Total" value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1" />
          </div>
        </div>

        <label className="goal-field">
          <span>Link</span>
          <span className="flex gap-2">
            <Input
              type="url"
              aria-label="Link"
              placeholder="https://… the course or repository"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="flex-1"
            />
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="goal-link"
                aria-label="Open link"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
          </span>
        </label>


        {dirty && (
          <div>
            <Button variant="primary" onPress={() => void save()} isDisabled={pending || !name.trim()}>
              Save changes
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
