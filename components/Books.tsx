"use client";

import { useEffect, useState } from "react";
import { Button, AddButton } from "./ui";
import { ListPlus, Upload } from "./icons";
import { Tracker } from "@/lib/tracker";
import { ReadingFlow } from "./books/flow";
import { useFlow } from "./books/flowContext";
import { useCoverLookup } from "./books/Cover";
import { Segmented } from "./books/bits";
import { TodayView } from "./books/TodayView";
import { TracksView } from "./books/TracksView";
import { PhasesView } from "./books/PhasesView";
import { HistoryView } from "./books/HistoryView";

type Tab = "today" | "tracks" | "phases" | "history";
const TABS: Tab[] = ["today", "tracks", "phases", "history"];
const TAB_KEY = "momentum:books-tab";

/**
 * The reading plan. Today shows only the books open now; the queues, phases
 * and history each have a tab of their own.
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
              { value: "history", label: "History" },
            ]}
          />
        </div>
        {/* On a phone the buttons wrap and each stretches to fill its row, so
            none is cut off; from 672px they sit at their own widths. */}
        <span className="flex w-full flex-wrap gap-2 md:w-auto [&>*]:flex-auto md:[&>*]:flex-none">
          <Button variant="ghost" onPress={() => flow.open({ kind: "import" })}>
            <Upload className="h-4 w-4" /> Import plan
          </Button>
          <AddButton
            secondary
            label="Add several"
            icon={<ListPlus className="h-4 w-4" aria-hidden />}
            onPress={() => flow.open({ kind: "bulk" })}
          />
          <AddButton label="Add book" onPress={() => flow.open({ kind: "edit", bookId: null })} />
        </span>
      </div>

      {tab === "today" && <TodayView tracker={tracker} />}
      {tab === "tracks" && <TracksView tracker={tracker} />}
      {tab === "phases" && <PhasesView tracker={tracker} />}
      {tab === "history" && <HistoryView tracker={tracker} />}
    </div>
  );
}

export default Books;
