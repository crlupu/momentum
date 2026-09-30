"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "../ui";
import { Archive, Trash2, Unarchive } from "../icons";
import { Modal } from "../Modal";
import { DeleteButton } from "../DeleteButton";
import { usePending } from "../ActionButton";
import { Tracker, BOOK_COLORS, dateKey } from "@/lib/tracker";
import * as R from "@/lib/reading";
import { PLAN_FORMAT, applyPlan, parsePlan } from "@/lib/planImport";
import { FormatHelp } from "../FormatHelp";
import { fmtDate } from "@/lib/dates";
import { Field } from "./bits";

/** Create or edit a track: its name, colour, limit, target and time of day. */
export function TrackForm({
  tracker,
  track,
  onClose,
}: {
  tracker: Tracker;
  track: R.ReadingTrack | null;
  onClose: () => void;
}) {
  const s = tracker.state!;
  const used = new Set(s.readingTracks.map((t) => t.color));
  const [name, setName] = useState(track?.name ?? "");
  const [color, setColor] = useState(
    track?.color ?? BOOK_COLORS.find((c) => !used.has(c)) ?? BOOK_COLORS[0]
  );
  const [wip, setWip] = useState(String(track?.wipLimit ?? 1));
  const [target, setTarget] = useState(String(track?.dailyTarget ?? 20));
  const [slot, setSlot] = useState(track?.slot ?? "");
  const [rest, setRest] = useState(String(track?.restDays ?? 1));
  const { pending, run } = usePending();

  const input = (archived = track?.archived): R.TrackInput => ({
    name,
    color,
    wipLimit: Number(wip) || 1,
    dailyTarget: Number(target) || 0,
    slot,
    restDays: Number(rest) || 0,
    archived,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pending) return;
    onClose();
    await run(() => (track ? tracker.updateTrack(track.id, input()) : tracker.addTrack(input())));
  };

  const open = track ? s.books.filter((b) => b.trackId === track.id && b.status === "active").length : 0;
  const books = track ? s.books.filter((b) => b.trackId === track.id).length : 0;
  const others = track ? s.readingTracks.filter((t) => t.id !== track.id) : [];
  const [deleting, setDeleting] = useState(false);
  // "keep", "delete", or the id of a track to move them to.
  const [then, setThen] = useState<string>("keep");

  const remove = () => {
    if (!track) return;
    setDeleting(false);
    onClose();
    void tracker.removeTrack(
      track.id,
      then === "delete" ? { delete: true } : then === "keep" ? { keep: true } : { moveTo: then }
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        aria-label="Track name"
        placeholder="Name, e.g. Technical"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus={!track}
        className="w-full"
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colour">
        {BOOK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className="h-7 w-7 rounded-full"
            style={{
              background: c,
              outline: color === c ? "2px solid var(--foreground)" : undefined,
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Open at once">
          <input type="number" inputMode="numeric" min={1} value={wip} onChange={(e) => setWip(e.target.value)} />
        </Field>
        <Field label="Pages a day">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field label="Rest days / week">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={6}
            value={rest}
            onChange={(e) => setRest(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Time slot (optional)">
        <input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="e.g. Evening" />
      </Field>
      <p className="text-xs text-[var(--muted)]">
        Rest days can be missed without breaking the streak. Each track&apos;s limit is its own, so a
        book open in one never blocks another.
      </p>

      <div className="flex items-center justify-between gap-2">
        {track ? (
          <span className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="sm"
              isDisabled={pending}
              onPress={() => {
                onClose();
                void run(() => tracker.updateTrack(track.id, input(!track.archived)));
              }}
            >
              {track.archived ? (
                <>
                  <Unarchive className="h-4 w-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Archive
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="btn-delete-bare" onPress={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </span>
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button variant="outline" onPress={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isDisabled={pending || !name.trim()}>
            {track ? "Save" : "Add"}
          </Button>
        </span>
      </div>
      {track && !track.archived && open > 0 && (
        <p className="text-xs text-[var(--muted)]">
          Archiving hides the track from Today and its counters. Its books stay where they are.
        </p>
      )}

      {track && (
        <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete track">
          <div className="flex flex-col gap-3">
            <p className="text-[15px]">
              Delete the track <span className="font-semibold">{track.name}</span>?
            </p>
            {books > 0 ? (
              <Field label={`Its ${books} book${books === 1 ? "" : "s"}`}>
                <select value={then} onChange={(e) => setThen(e.target.value)}>
                  <option value="keep">Keep them, without a track</option>
                  {others.map((t) => (
                    <option key={t.id} value={t.id}>
                      Move to {t.name}
                      {t.archived ? " (archived)" : ""}
                    </option>
                  ))}
                  <option value="delete">Delete them too</option>
                </select>
              </Field>
            ) : (
              <p className="text-sm text-[var(--muted)]">It has no books.</p>
            )}
            {books > 0 && (
              <p className="text-sm text-[var(--muted)]">
                {then === "keep"
                  ? "They stay in your library under “No track”, with their progress, notes and history. A book you're reading is paused until you give it a track."
                  : then === "delete"
                    ? "Their progress, sessions and notes are deleted with them."
                    : "They go to the end of that track's queue, keeping their progress, notes and history."}
              </p>
            )}
            <p className="text-sm text-[var(--muted)]">This can&apos;t be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onPress={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button variant="danger" className="btn-danger-solid" onPress={remove}>
                {books > 0 && then === "delete" ? `Delete track and ${books} book${books === 1 ? "" : "s"}` : "Delete track"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </form>
  );
}

/** Create or edit a phase: a name and the dates it is meant to run between. */
export function PhaseForm({
  tracker,
  phase,
  onClose,
}: {
  tracker: Tracker;
  phase: R.ReadingPhase | null;
  onClose: () => void;
}) {
  const today = dateKey();
  const [name, setName] = useState(phase?.name ?? "");
  const [start, setStart] = useState(phase?.start ?? today);
  const [end, setEnd] = useState(phase?.end ?? R.addDays(today, 90));
  const [goal, setGoal] = useState(phase?.goal ?? "");
  const { pending, run } = usePending();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !start || !end || pending) return;
    onClose();
    const input = { name, start, end, goal };
    await run(() => (phase ? tracker.updatePhase(phase.id, input) : tracker.addPhase(input)));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        aria-label="Phase name"
        placeholder="Name, e.g. Phase 1: Q4 2026"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus={!phase}
        className="w-full"
      />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Starts">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Ends">
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="Goal (optional)">
        <textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What this phase is for" />
      </Field>
      <p className="text-xs text-[var(--muted)]">Books are put in a phase from their edit form, or when adding several.</p>
      <div className="flex items-center justify-between gap-2">
        {phase ? (
          <DeleteButton
            what={`"${phase.name}"`}
            bare
            iconOnly
            onDelete={async () => {
              onClose();
              return tracker.removePhase(phase.id);
            }}
          />
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button variant="outline" onPress={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isDisabled={pending || !name.trim()}>
            {phase ? "Save" : "Add"}
          </Button>
        </span>
      </div>
    </form>
  );
}

/** Adds a pasted list, one "Title – Author" a line, to a track and phase. */
export function BulkAddForm({
  tracker,
  trackId,
  onClose,
}: {
  tracker: Tracker;
  trackId?: string;
  onClose: () => void;
}) {
  const s = tracker.state!;
  const tracks = s.readingTracks.filter((t) => !t.archived);
  const [text, setText] = useState("");
  const [track, setTrack] = useState(trackId ?? tracks[0]?.id ?? "");
  const [phase, setPhase] = useState("");
  const { pending, run } = usePending();
  const list = R.parseBookList(text);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!list.length || !track || pending) return;
    onClose();
    await run(() => tracker.addBooks(list, track, phase || undefined));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <textarea
        aria-label="Books, one per line"
        rows={7}
        placeholder={"One per line:\nLearning Domain-Driven Design – Vlad Khononov\nDomain-Driven Design – Eric Evans (560)"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        className="w-full"
      />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Track">
          <select value={track} onChange={(e) => setTrack(e.target.value)}>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phase">
          <select value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">No phase</option>
            {s.readingPhases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {list.length > 0 && (
        <ul className="max-h-40 overflow-y-auto text-sm">
          {list.map((b, i) => (
            <li key={i} className="truncate py-0.5">
              <span className="font-semibold">{b.title}</span>
              {b.author && <span className="text-[var(--muted)]"> · {b.author}</span>}
              {b.pages && <span className="text-[var(--muted)]"> · {b.pages} pages</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--muted)]">
        They join the end of the track&apos;s queue, in this order. A page count in brackets after a line
        is picked up; covers and missing authors are looked up afterwards.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onPress={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isDisabled={pending || !list.length || !track}>
          Add {list.length || ""} book{list.length === 1 ? "" : "s"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Pastes in a reading plan written in Markdown and shows what it will do
 * before doing it. See lib/planImport.ts for the shape it reads.
 */
export function ImportPlanForm({ tracker, onClose }: { tracker: Tracker; onClose: () => void }) {
  const s = tracker.state!;
  const [text, setText] = useState("");
  const { pending, run } = usePending();
  const plan = useMemo(() => parsePlan(text), [text]);
  const preview = useMemo(() => applyPlan(s, plan).preview, [s, plan]);
  const empty = plan.books.length === 0 && plan.phases.length === 0 && plan.tracks.length === 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (empty || pending) return;
    onClose();
    await run(() => tracker.importPlan(plan));
  };

  const list = (items: string[]) => (items.length > 3 ? `${items.slice(0, 3).join(", ")} and ${items.length - 3} more` : items.join(", "));

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <FormatHelp text={PLAN_FORMAT} />
      <textarea
        aria-label="Reading plan"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the plan here"
        className="w-full font-mono text-[13px]"
        autoFocus
      />

      {!empty && (
        <div className="rd-import">
          <h3 className="mb-1 text-sm font-semibold">This will</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {plan.tracks.length > 0 && (
              <li>
                Set up {plan.tracks.length} track{plan.tracks.length === 1 ? "" : "s"}:{" "}
                {plan.tracks
                  .map((t) => `${t.name}${t.dailyTarget ? ` (${t.dailyTarget}/day)` : ""}`)
                  .join(", ")}
                {plan.wipLimit ? ` · ${plan.wipLimit} open book${plan.wipLimit === 1 ? "" : "s"} per track` : ""}
              </li>
            )}
            {plan.phases.length > 0 && (
              <li>
                {[
                  preview.phasesNew > 0 && `Add ${preview.phasesNew} phase${preview.phasesNew === 1 ? "" : "s"}`,
                  preview.phasesUpdated > 0 &&
                    `${preview.phasesNew > 0 ? "update" : "Update"} ${preview.phasesUpdated} already there`,
                ]
                  .filter(Boolean)
                  .join(", ")}
                :{" "}
                {fmtDate(plan.phases[0].start, true)} – {fmtDate(plan.phases[plan.phases.length - 1].end, true)}
              </li>
            )}
            {plan.books.length > 0 && (
              <li>
                {[
                  preview.booksNew > 0 && `Add ${preview.booksNew} book${preview.booksNew === 1 ? "" : "s"}`,
                  preview.booksMatched.length > 0 &&
                    `${preview.booksNew > 0 ? "place" : "Place"} ${preview.booksMatched.length} already on your shelf (${list(preview.booksMatched)}), keeping their progress`,
                ]
                  .filter(Boolean)
                  .join(", and ")}
              </li>
            )}
            {preview.open.length > 0 && <li>Open: {preview.open.join(", ")}</li>}
            {preview.paused.length > 0 && (
              <li>Pause, keeping their progress: {list(preview.paused)}</li>
            )}
            {preview.dropped.length > 0 && <li>Mark dropped: {preview.dropped.join(", ")}</li>}
          </ul>
          {plan.skipped.length > 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
              Couldn&apos;t place {plan.skipped.length} line{plan.skipped.length === 1 ? "" : "s"} (no track above
              them): {list(plan.skipped)}
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">
            Covers, missing authors and page counts are looked up afterwards, a book at a time.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onPress={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isDisabled={pending || empty}>
          Import
        </Button>
      </div>
    </form>
  );
}
