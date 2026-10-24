"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { HealthSwitch } from "@/components/HealthSwitch";
import WeightTracker from "@/components/WeightTracker";
import WeightPlanCard from "@/components/WeightPlan";
import WorkoutVolumeChart from "@/components/WorkoutVolumeChart";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { UpNextWorkout } from "@/components/UpNextWorkout";

/**
 * Fitness, as Apple Health lays it out: a short summary of weight and
 * training, each opening a page of its own with the charts and the plan.
 */
function Fitness() {
  const tracker = usePageTracker();
  const view = useSearchParams().get("view");
  const back = (
    <Link href="/fitness" className="back-link">
      <ChevronLeft aria-hidden />
      Fitness
    </Link>
  );
  if (view === "weight") {
    return (
      <SectionPage id="fitness" title="Weight" subtitle={back}>
        <div className="space-y-5">
          <WeightTracker tracker={tracker} />
          <WeightPlanCard tracker={tracker} />
        </div>
      </SectionPage>
    );
  }
  if (view === "training") {
    return (
      <SectionPage id="fitness" title="Training" subtitle={back}>
        <WorkoutVolumeChart tracker={tracker} />
      </SectionPage>
    );
  }
  return (
    <SectionPage id="fitness" title="Health" header={<HealthSwitch current="fitness" />}>
      <div className="space-y-5">
        <UpNextWorkout tracker={tracker} />
        <WeightTracker tracker={tracker} summary />
        <WorkoutVolumeChart tracker={tracker} summary />
        {/* The pages behind the summary, as one list of rows. */}
        <nav className="group-list" aria-label="More in Fitness">
          <Link href="/fitness?view=weight" className="group-row">
            <span className="flex-1">Weight and plan</span>
            <ChevronRight className="group-row__chev" aria-hidden />
          </Link>
          <Link href="/fitness?view=training" className="group-row">
            <span className="flex-1">Volume by workout</span>
            <ChevronRight className="group-row__chev" aria-hidden />
          </Link>
          <Link href="/configuration#workouts" className="group-row">
            <span className="flex-1">Workouts</span>
            <span className="group-row__value">{tracker.state?.workouts.length ?? 0}</span>
            <ChevronRight className="group-row__chev" aria-hidden />
          </Link>
        </nav>
      </div>
    </SectionPage>
  );
}

export default function FitnessPage() {
  return (
    <Suspense fallback={null}>
      <Fitness />
    </Suspense>
  );
}
