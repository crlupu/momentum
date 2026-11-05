"use client";

import Link from "next/link";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { WeekView } from "@/components/plan/WeekView";
import { RoutineSwitch } from "@/components/plan/RoutineSwitch";
import { ChevronLeft } from "@/components/icons";

/** Routine's week: its goals, its plan days and the weeks before. */
export default function WeekPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage
      id="tasks"
      tone="habit"
      title="Routine"
      header={<RoutineSwitch current="week" />}
      subtitle={
        <Link href="/" className="back-link">
          <ChevronLeft aria-hidden />
          Today
        </Link>
      }
    >
      <WeekView tracker={tracker} />
    </SectionPage>
  );
}
