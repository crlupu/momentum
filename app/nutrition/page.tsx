"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { HealthSwitch } from "@/components/HealthSwitch";
import CaloriesTracker from "@/components/CaloriesTracker";
import MacroTracker from "@/components/MacroTracker";
import { ChevronLeft, ChevronRight } from "@/components/icons";

/**
 * Nutrition: today first — calories in the ring, today's meals, protein and
 * fibre against their targets — and the charts one row away, on a page of
 * their own.
 */
function Nutrition() {
  const tracker = usePageTracker();
  const view = useSearchParams().get("view");
  if (view === "trends") {
    return (
      <SectionPage
        id="nutrition"
        title="History and trends"
        subtitle={
          <Link href="/nutrition" className="back-link">
            <ChevronLeft aria-hidden />
            Nutrition
          </Link>
        }
      >
        <div className="grid items-start gap-5 md:grid-cols-2 [&>*]:min-w-0">
          <CaloriesTracker tracker={tracker} view="trends" />
          <MacroTracker tracker={tracker} />
        </div>
      </SectionPage>
    );
  }
  return (
    <SectionPage id="nutrition" title="Health" header={<HealthSwitch current="nutrition" />}>
      <div className="grid items-start gap-5 md:grid-cols-2 [&>*]:min-w-0">
        <CaloriesTracker tracker={tracker} />
        <div className="space-y-5">
          <nav className="group-list" aria-label="More in Nutrition">
            <Link href="/nutrition?view=trends" className="group-row">
              <span className="flex-1">History and trends</span>
              <ChevronRight className="group-row__chev" aria-hidden />
            </Link>
          </nav>
        </div>
      </div>
    </SectionPage>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={null}>
      <Nutrition />
    </Suspense>
  );
}
