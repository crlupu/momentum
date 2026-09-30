"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { Button } from "./ui";
import { DialogActions } from "./DialogActions";
import { CatPicker } from "./Forms";
import { Upload } from "./icons";
import { FormatHelp } from "./FormatHelp";
import { Tracker } from "@/lib/tracker";
import { GOAL_JSON_FORMAT, applyGoalPlan, parseGoalPlan } from "@/lib/goalImport";

/**
 * Goals from a JSON or Markdown file — pasted, or chosen from the phone or
 * computer — with a preview of what importing will do before it's done.
 * The format is shown to copy, to hand to an AI.
 */
export function GoalImportForm({
  tracker,
  onClose,
  topicId,
}: {
  tracker: Tracker;
  onClose: () => void;
  /** Opened from a topic: its goals go there unless changed. */
  topicId?: string | null;
}) {
  const s = tracker.state!;
  const [text, setText] = useState("");
  const [into, setInto] = useState<string>(topicId ?? "file");
  const [catId, setCatId] = useState(s.categories[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = useMemo(() => parseGoalPlan(text), [text]);
  const opts = { into: into === "none" ? null : into, fallbackCatId: catId };
  const preview = useMemo(() => applyGoalPlan(s, plan, opts).preview, [s, plan, opts.into, opts.fallbackCatId]); // eslint-disable-line react-hooks/exhaustive-deps
  const goals = plan.topics.reduce((a, t) => a + t.goals.length, 0);
  const namesTopics = plan.topics.some((t) => t.name);
  const newTopicsWithoutCategory =
    into === "file" &&
    plan.topics.some(
      (t) =>
        t.name &&
        preview.topicsNew.includes(t.name) &&
        !s.categories.some((c) => c.name.toLowerCase() === (t.category ?? "").toLowerCase())
    );

  const readFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setText(await f.text());
    e.target.value = "";
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!goals) return;
    onClose();
    void tracker.importGoals(plan, opts);
  };

  const list = (items: string[]) =>
    items.length > 3 ? `${items.slice(0, 3).join(", ")} and ${items.length - 3} more` : items.join(", ");

  return (
    <form onSubmit={submit} className="goal-fields">
      <FormatHelp text={GOAL_JSON_FORMAT} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onPress={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Choose file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
          onChange={(e) => void readFile(e)}
          hidden
        />
      </div>

      <label className="goal-field">
        <span>{fileName ? `From ${fileName}` : "Goals"}</span>
        <textarea
          aria-label="Goals to import"
          rows={9}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
          }}
          placeholder="Paste JSON or Markdown here"
          className="font-mono text-[13px]"
        />
      </label>

      <label className="goal-field">
        <span>Put the goals in</span>
        <select value={into} onChange={(e) => setInto(e.target.value)}>
          <option value="file">{namesTopics ? "The topics the file names" : "No topic (the file names none)"}</option>
          {s.paths.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
          <option value="none">No topic</option>
        </select>
      </label>

      {newTopicsWithoutCategory && (
        <div className="goal-field">
          <span>The file gives no category for some new topics; they get this one:</span>
          <CatPicker tracker={tracker} catId={catId} setCatId={setCatId} />
        </div>
      )}

      {text.trim() && (
        <div className="rd-import">
          {plan.error ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {plan.error}
            </p>
          ) : (
            <>
              <h3 className="mb-1 text-sm font-semibold">This will</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {preview.topicsNew.length > 0 && (
                  <li>
                    Add {preview.topicsNew.length === 1 ? "the topic" : `${preview.topicsNew.length} topics`}{" "}
                    {list(preview.topicsNew)}
                  </li>
                )}
                {preview.goalsNew > 0 && (
                  <li>
                    Add {preview.goalsNew} goal{preview.goalsNew === 1 ? "" : "s"}
                    {preview.topicsMatched.length > 0 && ` (into ${list(preview.topicsMatched)} too)`}
                  </li>
                )}
                {preview.goalsUpdated > 0 && (
                  <li>
                    Update {preview.goalsUpdated} already there, matched by title — keeping their progress
                    unless the file gives one
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      )}

      <DialogActions
        primary={{ label: `Import${goals ? ` ${goals} goal${goals === 1 ? "" : "s"}` : ""}`, disabled: !goals }}
      />
    </form>
  );
}
