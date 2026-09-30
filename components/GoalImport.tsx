"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { Button } from "./ui";
import { CatPicker } from "./Forms";
import { Copy, Upload } from "./icons";
import { Tracker } from "@/lib/tracker";
import { AI_PROMPT, applyGoalPlan, parseGoalPlan } from "@/lib/goalImport";

/**
 * Goals from a JSON or Markdown file — pasted, or chosen from the phone or
 * computer — with a preview of what importing will do before it's done.
 * The prompt button copies a request an AI chat answers in the right shape.
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
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
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

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (not a secure page, say): show it to copy by hand.
      setShowPrompt(true);
    }
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
      <p className="text-sm text-[var(--muted)]">
        Paste goals as JSON or Markdown, or choose a <code>.json</code> / <code>.md</code> file. To have an AI
        write them, copy the prompt, fill in what you want to learn, and import its answer.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onPress={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Choose file
        </Button>
        <Button variant="outline" onPress={() => void copyPrompt()}>
          <Copy className="h-4 w-4" /> {copied ? "Prompt copied" : "Copy AI prompt"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
          onChange={(e) => void readFile(e)}
          hidden
        />
      </div>

      {showPrompt && (
        <label className="goal-field">
          <span>The prompt — select it and copy</span>
          <textarea readOnly rows={8} value={AI_PROMPT} onFocus={(e) => e.target.select()} className="text-[13px]" />
        </label>
      )}

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
          placeholder={"# Rust ramp up\nCategory: Learning\n- [The Rust Book](https://doc.rust-lang.org/book/) (20)\n  Chapters 1–20, with the exercises\n- Rustlings (94)\n- Rewrite the fixtures consumer in Rust"}
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onPress={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isDisabled={!goals}>
          Import{goals ? ` ${goals} goal${goals === 1 ? "" : "s"}` : ""}
        </Button>
      </div>
    </form>
  );
}
