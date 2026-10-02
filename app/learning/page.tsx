"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { LearningHub } from "@/components/LearningHub";
import { ChevronLeft } from "@/components/icons";

/**
 * Learning: books and goals. A track, phases or history is the same page with
 * where you are in the address (?track=…, ?view=…), so the back button and
 * the "‹ Learning" link both return to the hub.
 */
function Learning() {
  const tracker = usePageTracker();
  const params = useSearchParams();
  const trackId = params.get("track");
  const view = params.get("view");
  const groupId = params.get("goal");
  const s = tracker.state;

  const title = groupId
    ? s?.paths.find((p) => p.id === groupId)?.title
    : trackId
    ? trackId === "none"
      ? "No track"
      : s?.readingTracks.find((t) => t.id === trackId)?.name
    : view === "phases"
      ? "Phases"
      : view === "history"
        ? "History"
        : undefined;

  return (
    <SectionPage
      id="learning"
      title={title}
      subtitle={
        title ? (
          <Link href="/learning" className="back-link">
            <ChevronLeft aria-hidden />
            Learning
          </Link>
        ) : undefined
      }
    >
      <LearningHub tracker={tracker} trackId={trackId} view={view} groupId={groupId} />
    </SectionPage>
  );
}

export default function LearningPage() {
  return (
    <Suspense fallback={null}>
      <Learning />
    </Suspense>
  );
}
