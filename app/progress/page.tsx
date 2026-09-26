"use client";

import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import Charts from "@/components/Charts";

export default function ProgressPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage id="charts">
      <Charts tracker={tracker} />
    </SectionPage>
  );
}
