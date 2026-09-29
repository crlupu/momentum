"use client";

import { useShell } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import GoalsView from "@/components/GoalsView";

export default function LearningPage() {
  const { tracker } = useShell();
  return (
    <SectionPage id="learning">
      <GoalsView tracker={tracker} />
    </SectionPage>
  );
}
