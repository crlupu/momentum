"use client";

import { useState } from "react";
import { Button } from "./ui";
import { Segmented } from "./books/bits";
import { Copy } from "./icons";

/**
 * How to write what an import dialog reads: a worked example (one per
 * format), the rules, and a prompt for an AI chat that asks for exactly that.
 * The example and prompt come from the parser's own module, so what's shown
 * is what's read.
 */
export function FormatHelp({
  formats,
  rules,
  prompt,
}: {
  formats: { label: string; text: string }[];
  rules: string[];
  prompt: string;
}) {
  const [open, setOpen] = useState(false);
  const [which, setWhich] = useState(formats[0].label);
  const [copied, setCopied] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const current = formats.find((f) => f.label === which) ?? formats[0];

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setManual(null);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    } catch {
      // Clipboard refused (not a secure page, say): show it to copy by hand.
      setManual(text);
    }
  };

  return (
    <div className="format-help">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onPress={() => void copy("prompt", prompt)}>
          <Copy className="h-4 w-4" /> {copied === "prompt" ? "Prompt copied" : "Copy AI prompt"}
        </Button>
        <button
          type="button"
          className="text-action"
          aria-expanded={open}
          aria-pressed={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide format" : "Show format"}
        </button>
      </div>
      <p className="format-help__hint">
        The prompt asks an AI for exactly this format: fill in what you want, paste it into any AI chat,
        and import its answer.
      </p>

      {manual && (
        <label className="goal-field">
          <span>Select it and copy</span>
          <textarea readOnly rows={8} value={manual} onFocus={(e) => e.target.select()} className="text-[13px]" />
        </label>
      )}

      {open && (
        <div className="format-help__body">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {formats.length > 1 ? (
              <Segmented
                label="Format"
                size="sm"
                value={current.label}
                onChange={setWhich}
                options={formats.map((f) => ({ value: f.label, label: f.label }))}
              />
            ) : (
              <span className="format-help__label">{current.label}</span>
            )}
            <button type="button" className="text-action" onClick={() => void copy("format", current.text)}>
              <Copy className="h-4 w-4" aria-hidden /> {copied === "format" ? "Copied" : "Copy format"}
            </button>
          </div>
          <pre className="format-help__example">{current.text}</pre>
          <ul className="format-help__rules">
            {rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
