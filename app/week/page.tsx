"use client";

import Link from "next/link";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { WeekView } from "@/components/plan/WeekView";
import { ChevronLeft } from "@/components/icons";
import { weekNumber, weekOf } from "@/lib/plan";
import { dateKey } from "@/lib/tracker";

/** This week, under Today: its goals, its plan days and the weeks before. */
export default function WeekPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage
      id="tasks"
      title={`Week ${weekNumber(weekOf(dateKey()))}`}
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
