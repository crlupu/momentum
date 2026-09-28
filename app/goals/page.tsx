"use client";

import { useShell } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import GoalsView from "@/components/GoalsView";

export default function GoalsPage() {
  const { tracker } = useShell();
  return (
    <SectionPage id="goals">
      <GoalsView tracker={tracker} />
    </SectionPage>
  );
}
