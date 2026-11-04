"use client";

import { useShell } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { Dashboard } from "@/components/Dashboard";

/**
 * Today: a dashboard. The routine on top, then a tile per page with its one
 * figure. The habit list lives at /routine, the to-dos at /todos.
 */
export default function TodayPage() {
  const { tracker } = useShell();
  const subtitle = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <SectionPage id="tasks" subtitle={subtitle}>
      {tracker.state && <Dashboard tracker={tracker} />}
    </SectionPage>
  );
}
