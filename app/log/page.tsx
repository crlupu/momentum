"use client";

import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import CompletionLog from "@/components/CompletionLog";

export default function LogPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage id="log">
      <CompletionLog tracker={tracker} />
    </SectionPage>
  );
}
