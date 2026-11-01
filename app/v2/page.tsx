"use client";

import { usePageTracker } from "@/components/AppShell";
import { ReadingFlow } from "@/components/books/flow";
import { TodayV2 } from "@/components/v2/Today";

export default function TodayPageV2() {
  const tracker = usePageTracker();
  return (
    <ReadingFlow tracker={tracker}>
      <TodayV2 tracker={tracker} />
    </ReadingFlow>
  );
}
