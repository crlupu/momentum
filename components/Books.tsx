"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";
import { ListPlus, Plus, Upload } from "./icons";
import { Tracker } from "@/lib/tracker";
import { ReadingFlow } from "./books/flow";
import { useFlow } from "./books/flowContext";
import { useCoverLookup } from "./books/Cover";
import { Segmented } from "./books/bits";
import { TodayView } from "./books/TodayView";
import { TracksView } from "./books/TracksView";
import { PhasesView } from "./books/PhasesView";
import { NotesView } from "./books/NotesView";
import { HistoryView } from "./books/HistoryView";

type Tab = "today" | "tracks" | "phases" | "notes" | "history";
const TABS: Tab[] = ["today", "tracks", "phases", "notes", "history"];
const TAB_KEY = "momentum:books-tab";

/**
 * The reading plan. Today shows only the books open now; the queues, phases,
 * notes and history each have a tab of their own.
 */
export function Books({ tracker }: { tracker: Tracker }) {
  useCoverLookup(tracker, tracker.state!.books);
  return (
    <ReadingFlow tracker={tracker}>
      <BooksTabs tracker={tracker} />
    </ReadingFlow>
  );
}

function BooksTabs({ tracker }: { tracker: Tracker }) {
  const flow = useFlow();
  const [tab, setTab] = useState<Tab>("today");

  // The tab last looked at, per device. Only a convenience, so a browser
  // that refuses storage just starts on Today.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.includes(saved)) setTab(saved);
    } catch {}
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            label="Reading view"
            value={tab}
            onChange={choose}
            options={[
              { value: "today", label: "Today" },
              { value: "tracks", label: "Tracks" },
              { value: "phases", label: "Phases" },
              { value: "notes", label: "Notes" },
              { value: "history", label: "History" },
            ]}
          />
        </div>
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onPress={() => flow.open({ kind: "import" })}>
            <Upload className="h-3.5 w-3.5" /> Import plan
          </Button>
          <Button size="sm" variant="ghost" onPress={() => flow.open({ kind: "bulk" })}>
            <ListPlus className="h-3.5 w-3.5" /> Add several
          </Button>
          <Button size="sm" variant="outline" onPress={() => flow.open({ kind: "edit", bookId: null })}>
            <Plus className="h-3.5 w-3.5" /> Add book
          </Button>
        </span>
      </div>

      {tab === "today" && <TodayView tracker={tracker} />}
      {tab === "tracks" && <TracksView tracker={tracker} />}
      {tab === "phases" && <PhasesView tracker={tracker} />}
      {tab === "notes" && <NotesView tracker={tracker} />}
      {tab === "history" && <HistoryView tracker={tracker} />}
    </div>
  );
}

export default Books;
