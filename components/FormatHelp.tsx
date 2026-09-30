"use client";

import { useState } from "react";
import { Copy } from "./icons";

/**
 * The format an import reads, as an example to copy — to hand to an AI, or
 * to follow by hand. It comes from the parser's own module, so what's shown
 * is what's read.
 */
export function FormatHelp({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (not a secure page, say): select it to copy by hand.
      setManual(true);
    }
  };

  return (
    <div className="format-help">
      <div className="format-help__head">
        <span className="format-help__label">Format</span>
        <button type="button" className="text-action" onClick={() => void copy()}>
          <Copy className="h-4 w-4" aria-hidden /> {copied ? "Copied" : "Copy format"}
        </button>
      </div>
      {manual ? (
        <textarea readOnly rows={8} value={text} onFocus={(e) => e.target.select()} className="format-help__example" />
      ) : (
        <pre className="format-help__example">{text}</pre>
      )}
    </div>
  );
}
