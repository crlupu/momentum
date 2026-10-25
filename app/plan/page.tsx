"use client";

import Link from "next/link";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { ChevronLeft } from "@/components/icons";

/** The day plan, under Today: its days and its steps, in order. */
export default function PlanPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage
      id="tasks"
      title="Day plan"
      subtitle={
        <Link href="/" className="back-link">
          <ChevronLeft aria-hidden />
          Today
        </Link>
      }
    >
      <PlanEditor tracker={tracker} />
    </SectionPage>
  );
}
