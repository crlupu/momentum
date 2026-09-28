"use client";

import { useState } from "react";
import { Lightbulb, Quote, Search } from "../icons";
import { Tracker } from "@/lib/tracker";
import { fmtDateAuto } from "./bits";
import { useFlow } from "./flowContext";

/** Every key idea and quote across the shelf, newest first, searchable. */
export function NotesView({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const flow = useFlow();
  const [q, setQ] = useState("");
  const titles = new Map(s.books.map((b) => [b.id, b]));

  const all = [
    ...s.readingSessions
      .filter((x) => x.note)
      .map((x) => ({ kind: "idea" as const, id: x.id, bookId: x.bookId, date: x.date, at: x.at, text: x.note!, page: undefined as number | undefined })),
    ...s.bookQuotes.map((x) => ({ kind: "quote" as const, id: x.id, bookId: x.bookId, date: x.date, at: x.at, text: x.text, page: x.page })),
  ].sort((a, b) => (a.date === b.date ? b.at - a.at : a.date > b.date ? -1 : 1));

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? all.filter((n) => {
        const b = titles.get(n.bookId);
        return (
          n.text.toLowerCase().includes(needle) ||
          b?.title.toLowerCase().includes(needle) ||
          b?.author?.toLowerCase().includes(needle)
        );
      })
    : all;

  return (
    <div className="flex flex-col gap-3">
      <label className="rd-search">
        <Search className="h-4 w-4 text-foreground/50" />
        <input
          type="search"
          aria-label="Search notes"
          placeholder="Search notes, quotes and titles"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1"
        />
      </label>
      {all.length === 0 ? (
        <p className="text-[15px] text-foreground/60">
          No notes yet. After logging a session you can write down its key idea, and quotes can be saved
          from a book&apos;s page.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-[15px] text-foreground/60">Nothing matches “{q}”.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((n) => {
            const b = titles.get(n.bookId);
            return (
              <li key={n.id} className={"rd-note" + (n.kind === "quote" ? " rd-note--quote" : "")}>
                <span className="rd-note__icon" aria-hidden>
                  {n.kind === "quote" ? <Quote className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.text}</p>
                  <p className="text-xs text-foreground/50">
                    {b ? (
                      <button
                        type="button"
                        className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                        onClick={() => flow.open({ kind: "detail", bookId: b.id })}
                      >
                        {b.title}
                      </button>
                    ) : (
                      "Removed book"
                    )}
                    {` · ${fmtDateAuto(n.date)}`}
                    {n.page ? ` · p. ${n.page}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
